'use client'

// "이번 달 할 일" — the partner's one meaningful task this month, as a staged
// card (lib/logic/partnerTrack.monthlyTask, N14):
//   신청 (where · what you get · [신청했어요]) → 예약 전 (what · where · bring ·
//   cost · [일정 잡기]) → 예약됨 (the booked day · [받았어요]) → 다녀왔어요?
//   → 청구 (the four papers · [청구했어요]) → the next item.
// Every stage ends with '오늘 해 줄 수 있는 것' — one small thing for today.
//
// A chain step is completed through the '언제 했어요?' sheet (the date it
// happened, the booked day by default once it has passed), never silently as
// "today": the next deadline counts from that date. Done and undo both go
// through completeMonthlyTask — never tickItem: the claim step ('검사비
// 청구하기') has no roadmap row of its own.

import { useCallback, useMemo, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import UndoToast, { type UndoMessage } from '@/components/log/UndoToast'
import AppointmentSheet from '@/components/plan/AppointmentSheet'
import { Button, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { addDays, formatKo, formatShort, isISODate } from '@/lib/dates'
import {
  bookingDraft,
  completeMonthlyTask,
  setClaimDocDone,
  type MonthlyTask,
  type TaskStage,
} from '@/lib/logic/partnerTrack'
import { KIND_EMOJI, type AppointmentDraft } from '@/lib/logic/plan'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'
import { ExternalLink, LinkButton } from './bits'

type Nav = (tab: TabKey) => void

/** The 챙길 것 tab, with or without a navigate callback (the top card has none — hashes work everywhere). */
function goPlan(onNavigate?: Nav) {
  if (onNavigate) onNavigate('plan')
  else if (typeof window !== 'undefined') window.location.hash = 'plan'
}

// ── [했어요] → '언제 했어요?' → 되돌리기 ───────────────────

const WHEN_TITLE: Record<NonNullable<MonthlyTask['step']>, string> = {
  apply: '언제 신청했어요?',
  test: '언제 검사받았어요?',
  claim: '언제 청구했어요?',
}

const WHEN_HINT: Record<NonNullable<MonthlyTask['step']>, string> = {
  apply: '신청한 날부터 검사 마감(3개월)을 세요.',
  test: '검사한 날부터 청구 마감(1개월)을 세요.',
  claim: '청구 후 3개월 안에 입금돼요.',
}

const MIN_TEXT: Record<NonNullable<MonthlyTask['step']>, string> = {
  apply: '오늘까지의 날짜를 골라 주세요.',
  test: '신청한 날 이후, 오늘까지의 날짜를 골라 주세요.',
  claim: '검사한 날 이후, 오늘까지의 날짜를 골라 주세요.',
}

/** '언제 했어요?' — chips for today / yesterday / the booked day, and a date field. */
function WhenSheet({ task, onConfirm, onClose }: { task: MonthlyTask; onConfirm: (at: ISODate) => void; onClose: () => void }) {
  const { today } = useApp()
  const step = task.step!
  const [date, setDate] = useState(task.defaultDoneAt)
  const [error, setError] = useState(false)
  const booked = task.appointment && task.appointment.date <= today ? task.appointment.date : undefined
  const chips: Array<{ label: string; value: ISODate }> = [
    ...(booked ? [{ label: `예약일 ${formatShort(booked)}`, value: booked }] : []),
    { label: '오늘', value: today },
    { label: '어제', value: addDays(today, -1) },
  ].filter((c, i, all) => all.findIndex((x) => x.value === c.value) === i)
  const valid = (d: string) => isISODate(d) && d <= today && (!task.minDoneAt || d >= task.minDoneAt)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid(date)) return setError(true)
    onConfirm(date)
  }

  return (
    <Sheet open onClose={onClose} title={WHEN_TITLE[step]}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-2">{WHEN_HINT[step]}</p>
        <div role="group" aria-label="날짜 고르기" className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = c.value === date
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setDate(c.value)
                  setError(false)
                }}
                className={cx(
                  'inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <Field label="날짜">
          <input
            type="date"
            className={inputClass}
            value={date}
            max={today}
            min={task.minDoneAt}
            required
            aria-invalid={error}
            onChange={(e) => {
              setDate(e.target.value)
              setError(false)
            }}
          />
        </Field>
        {error ? (
          <p role="alert" className="-mt-2 text-xs font-medium text-period">
            {MIN_TEXT[step]}
          </p>
        ) : null}
        <Button type="submit" full size="lg">
          {isISODate(date) ? `${formatKo(date)}로 기록하기` : '기록하기'}
        </Button>
      </form>
    </Sheet>
  )
}

/**
 * [했어요] for the month task: a chain step asks '언제 했어요?' first (the
 * date it happened), a plain item is ticked today; both with a 5-second
 * 되돌리기. Keep it in a parent that outlives the row: once done, monthlyTask
 * moves on to the next step. `toast` renders the toast and the sheet.
 */
export function useMonthlyTaskDone(): { done: (task: MonthlyTask) => void; toast: React.ReactNode } {
  const { update, today, me } = useApp()
  const toast = useToast()
  const [undo, setUndo] = useState<(UndoMessage & { task: MonthlyTask; at: ISODate }) | null>(null)
  const [asking, setAsking] = useState<MonthlyTask | null>(null)
  const expire = useCallback(() => setUndo(null), [])
  const closeAsk = useCallback(() => setAsking(null), [])

  const complete = useCallback(
    (task: MonthlyTask, at: ISODate) => {
      update((s) => completeMonthlyTask(s, task, at, me.id))
      const when = task.step ? ` · ${formatKo(at, { weekday: false })}` : ''
      setUndo({ id: Date.now(), text: `‘${task.title}’ 완료했어요${when}`, task, at })
    },
    [update, me.id],
  )

  const done = useCallback(
    (task: MonthlyTask) => {
      if (task.step) setAsking(task)
      else complete(task, today)
    },
    [complete, today],
  )

  const confirm = useCallback(
    (at: ISODate) => {
      if (!asking) return
      complete(asking, at)
      setAsking(null)
    },
    [asking, complete],
  )

  const revert = useCallback(() => {
    if (!undo) return
    const { task, at } = undo
    update((s) => completeMonthlyTask(s, task, at, me.id, false))
    setUndo(null)
    toast.show('되돌렸어요')
  }, [undo, update, me.id, toast])

  const el = useMemo(
    () => (
      <>
        <UndoToast message={undo} onUndo={revert} onExpire={expire} />
        {asking ? <WhenSheet key={asking.id} task={asking} onConfirm={confirm} onClose={closeAsk} /> : null}
      </>
    ),
    [undo, revert, expire, asking, confirm, closeAsk],
  )
  return { done, toast: el }
}

// ── Pieces ──────────────────────────────────────────────────

/** A pill action (40px, 44px to tap): the stage's one or two buttons. */
function Pill({
  onClick,
  tone,
  icon,
  children,
}: {
  onClick: () => void
  tone: 'primary' | 'soft' | 'surface'
  icon?: 'check' | 'plus'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13.5px] font-bold transition-colors before:absolute before:-inset-y-0.5 before:inset-x-0 before:content-['']",
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        tone === 'primary' && 'bg-brand text-white hover:bg-brand/90',
        tone === 'soft' && 'bg-surface-2 text-ink hover:bg-line/60',
        tone === 'surface' && 'bg-surface text-ink hover:bg-line/40',
      )}
    >
      {icon ? <Icon name={icon} className="h-4 w-4" strokeWidth={2.4} /> : null}
      {children}
    </button>
  )
}

const STAGE_LABEL: Record<TaskStage, string> = {
  apply: '신청',
  book: '예약 전',
  booked: '예약됨',
  visited: '예약일 지남',
  claim: '청구',
}

/** '무엇 · 정액검사' rows from the stage guide. */
function GuideRows({ task }: { task: MonthlyTask }) {
  const g = task.guide
  if (!g) return null
  const rows: Array<[string, string | undefined]> =
    task.stage === 'apply'
      ? [
          ['어디서', g.where],
          ['받는 것', g.bring],
          ['지원', g.cost],
        ]
      : task.stage === 'claim'
        ? [['어디에', g.where]]
        : [
            ['무엇', g.what],
            ['어디서', g.where],
            ['챙길 것', g.bring],
            ['비용', g.cost],
          ]
  return (
    <dl className="mt-2 space-y-0.5 text-[12.5px] leading-[1.5]">
      {rows
        .filter((r): r is [string, string] => !!r[1])
        .map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-12 shrink-0 font-bold text-ink-3">{k}</dt>
            <dd className="min-w-0 text-ink-2">{v}</dd>
          </div>
        ))}
    </dl>
  )
}

function AppointmentLine({ task, muted = false }: { task: MonthlyTask; muted?: boolean }) {
  const a = task.appointment
  if (!a) return null
  return (
    <p className={cx('mt-1.5 text-[13px] font-semibold', muted ? 'text-ink-3' : 'text-ink')}>
      <span aria-hidden>📅 </span>
      {formatKo(a.date)}
      {a.time ? ` ${a.time}` : ''}
      {a.place ? ` · ${a.place}` : ''}
    </p>
  )
}

/** The claim's four papers, each a 44px toggle (per person, kept in the state). */
function ClaimDocs({ task }: { task: MonthlyTask }) {
  const { update, today, me } = useApp()
  if (!task.docs) return null
  const left = task.docs.filter((d) => !d.done).length
  return (
    <div className="mt-2">
      <p className="text-[12.5px] font-bold text-ink-3">
        청구 서류 {left === 0 ? '모두 챙겼어요 ✓' : `${task.docs.length - left}/${task.docs.length}`}
      </p>
      <ul className="mt-0.5 grid grid-cols-2 gap-x-2">
        {task.docs.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={d.done}
              onClick={() => update((s) => setClaimDocDone(s, me.id, d.id, !d.done, today))}
              className="-ml-1 flex h-11 w-full items-center gap-2 rounded-xl px-1 text-left text-[13.5px] font-semibold text-ink hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span
                aria-hidden
                className={cx(
                  'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-[12px] font-bold leading-none',
                  d.done ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
                )}
              >
                ✓
              </span>
              <span className={cx(d.done && 'text-ink-3 line-through')}>{d.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-3">서류는 사진으로도 남겨 두면 든든해요.</p>
    </div>
  )
}

/**
 * The stage's content and actions — shared by the compact top card and the
 * body inside the moment card / 우리 한 줄. The booking sheet is its own
 * (Sheet is a portal); completing goes through `onDone` (the parent's hook).
 */
function StageBody({
  task,
  onDone,
  onNavigate,
  onSurface2,
  compact,
  fold = false,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate?: Nav
  onSurface2: boolean
  compact: boolean
  /** The action row is what the home keeps above the tab bar (useFoldFit) when this card leads. */
  fold?: boolean
}) {
  const { state, today, me } = useApp()
  const [booking, setBooking] = useState<AppointmentDraft | null>(null)
  const closeBooking = useCallback(() => setBooking(null), [])
  // '아직이에요' on '다녀왔어요?': show the booked day as past until the page is reopened.
  const [notYet, setNotYet] = useState<string | null>(null)
  const overdue = task.status === 'overdue'
  const stage: TaskStage | undefined = task.stage === 'visited' && notYet === task.appointment?.id ? 'booked' : task.stage
  const tone = onSurface2 ? 'surface' : 'soft'
  const pastBooked = stage === 'booked' && !!task.appointment && task.appointment.date <= today

  const book = () => setBooking(bookingDraft(state, me.id, today))

  return (
    <>
      {task.dueText ? (
        <p className={cx('mt-0.5 text-xs font-semibold', overdue ? 'text-warn' : 'text-ink-2')}>{task.dueText}</p>
      ) : null}

      {stage === 'visited' ? (
        <>
          <p className="mt-2 text-[15px] font-extrabold tracking-[-0.02em] text-ink">다녀왔어요?</p>
          <AppointmentLine task={task} />
        </>
      ) : stage === 'booked' ? (
        <>
          <AppointmentLine task={task} muted={pastBooked} />
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {pastBooked ? '예약일이 지났어요. 일정을 고치거나 다녀온 날을 기록해요.' : `${task.guide?.bring ?? '검사의뢰서'} 챙기기 · 검사 준비는 병원 안내를 따라요.`}
          </p>
        </>
      ) : (
        <>
          <GuideRows task={task} />
          {stage === 'claim' ? <ClaimDocs task={task} /> : null}
          {task.why && !compact ? <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-3">{task.why}</p> : null}
        </>
      )}

      {task.link && stage !== 'booked' && stage !== 'visited' ? (
        <div className="-mb-2.5">
          <ExternalLink href={task.link.url}>{task.link.label}</ExternalLink>
        </div>
      ) : null}

      <div data-fold={fold ? '' : undefined} className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {stage === 'apply' ? (
          <Pill onClick={() => onDone(task)} tone={tone} icon="check">
            신청했어요
          </Pill>
        ) : stage === 'book' ? (
          <>
            <Pill onClick={book} tone="primary" icon="plus">
              일정 잡기
            </Pill>
            <LinkButton size="md" onClick={() => onDone(task)} className="px-1">
              이미 받았어요
            </LinkButton>
          </>
        ) : stage === 'booked' ? (
          <>
            <Pill onClick={() => onDone(task)} tone={tone} icon="check">
              받았어요
            </Pill>
            <LinkButton size="md" arrow onClick={() => goPlan(onNavigate)} className="px-1">
              {pastBooked ? '일정 고치기' : '일정 보기'}
            </LinkButton>
          </>
        ) : stage === 'visited' ? (
          <>
            <Pill onClick={() => onDone(task)} tone="primary" icon="check">
              네, 다녀왔어요
            </Pill>
            <LinkButton size="md" onClick={() => setNotYet(task.appointment?.id ?? null)} className="px-1">
              아직이에요
            </LinkButton>
          </>
        ) : stage === 'claim' ? (
          <Pill onClick={() => onDone(task)} tone={tone} icon="check">
            청구했어요
          </Pill>
        ) : (
          <Pill onClick={() => onDone(task)} tone={tone} icon="check">
            했어요
          </Pill>
        )}
        {onNavigate && stage !== 'booked' ? (
          <LinkButton size="md" arrow onClick={() => onNavigate('plan')} className="-mr-1 ml-auto shrink-0 px-1">
            챙길 것
          </LinkButton>
        ) : null}
      </div>

      {task.tip ? (
        <p className="mt-2 border-t border-line/70 pt-2 text-[12.5px] leading-[1.5] text-ink-2">
          <b className="font-bold text-ink">오늘 해 줄 수 있는 것</b> · {task.tip}
        </p>
      ) : null}

      {booking ? <AppointmentSheet key={booking.taskId} initial={booking} onClose={closeBooking} /> : null}
    </>
  )
}

function StageEyebrow({ task }: { task: MonthlyTask }) {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-ink">
      이번 달 할 일
      {task.stage ? (
        <span className={cx('rounded-full px-1.5 py-px text-[10.5px]', task.stage === 'visited' ? 'bg-brand text-white' : 'bg-brand-soft')}>
          {STAGE_LABEL[task.stage]}
        </span>
      ) : null}
    </p>
  )
}

/** Title, deadline and the stage, then its actions and a link to 챙길 것. */
export function MonthlyTaskBody({
  task,
  onDone,
  onNavigate,
  className,
  onSurface2 = false,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate: Nav
  className?: string
  /** Sits on a surface-2 box (the moment card): the button takes the surface colour. */
  onSurface2?: boolean
}) {
  return (
    <div className={className}>
      <StageEyebrow task={task} />
      <p className="mt-px text-base font-extrabold leading-snug tracking-[-0.03em] text-ink">{task.title}</p>
      <StageBody task={task} onDone={onDone} onNavigate={onNavigate} onSurface2={onSurface2} compact={false} />
    </div>
  )
}

/** The tile on the compact card: the 가임력 검사 chain's own steps, else the roadmap kind. */
function taskEmoji(task: MonthlyTask): string {
  if (task.step === 'test') return task.stage === 'visited' ? '🙋' : task.stage === 'booked' ? '📅' : '🧪'
  if (task.step === 'apply') return '📝'
  if (task.step === 'claim') return '🧾'
  return KIND_EMOJI[task.kind] ?? '📌'
}

/**
 * The partner's first line when the task is urgent (`top`: a live deadline, or
 * the owner is 35+): the stage card under the cover — what, by when, where,
 * what to bring, and the stage's one action.
 */
export function MonthlyTaskCard({
  task,
  onDone,
  onNavigate,
  className,
  fold = false,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate?: Nav
  className?: string
  /** Leading the home (above the moment card): its action row is the first-screen fold target. */
  fold?: boolean
}) {
  const overdue = task.status === 'overdue'
  return (
    <section
      aria-label="이번 달 할 일"
      className={cx(
        'flex gap-3 rounded-[20px] border py-3 pl-3.5 pr-3 shadow-warm dark:shadow-none',
        overdue
          ? 'border-warn/25 bg-warn-soft'
          : 'border-transparent bg-surface dark:border-line/70 forced-colors:border-line',
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-[21px]">
        {taskEmoji(task)}
      </span>
      <div className="min-w-0 flex-1">
        <StageEyebrow task={task} />
        <p className="mt-px text-base font-extrabold leading-snug tracking-[-0.03em] text-ink">{task.title}</p>
        <StageBody task={task} onDone={onDone} onNavigate={onNavigate} onSurface2={overdue} compact fold={fold} />
      </div>
    </section>
  )
}
