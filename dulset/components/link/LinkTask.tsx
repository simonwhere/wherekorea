'use client'

// "이번 달 할 일" on the partner page — the staged card of
// components/today/MonthlyTask, read from the snapshot (strings and flags),
// with one action: the stage's [했어요], which sends a 'task-done' event
// dated the snapshot's defaultDoneAt (the booked day once it has passed,
// else today). Booking a date, ticking the claim papers and changing the
// date happen in the app; the page says so where it matters.

import { ExternalLink } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import type { SnapshotTask } from '@/lib/logic/partnerSnapshot'
import type { TaskStage } from '@/lib/logic/partnerTrack'
import { Pill } from './bits'

const STAGE_LABEL: Record<TaskStage, string> = {
  apply: '신청',
  book: '예약 전',
  booked: '예약됨',
  visited: '예약일 지남',
  claim: '청구',
}

const DONE_LABEL: Record<TaskStage | 'plain', string> = {
  apply: '신청했어요',
  book: '이미 받았어요',
  booked: '받았어요',
  visited: '네, 다녀왔어요',
  claim: '청구했어요',
  plain: '했어요',
}

function taskIcon(task: SnapshotTask): IconName {
  if (task.step === 'test') return task.stage === 'visited' ? 'check' : task.stage === 'booked' ? 'cal' : 'flask'
  if (task.step === 'apply') return 'pen'
  if (task.step === 'claim') return 'doc'
  return 'pin'
}

function GuideRows({ task }: { task: SnapshotTask }) {
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
  const kept = rows.filter((r): r is [string, string] => !!r[1])
  if (!kept.length) return null
  return (
    <dl className="mt-2 space-y-0.5 text-[12.5px] leading-[1.5]">
      {kept.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-12 shrink-0 font-bold text-ink-3">{k}</dt>
          <dd className="min-w-0 text-ink-2">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function AppointmentLine({ task, muted = false }: { task: SnapshotTask; muted?: boolean }) {
  const a = task.appointment
  if (!a) return null
  return (
    <p className={cx('mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold', muted ? 'text-ink-3' : 'text-ink')}>
      <Icon name="cal" className="h-4 w-4 shrink-0" />
      <span>
        {formatKo(a.date)}
        {a.time ? ` ${a.time}` : ''}
        {a.place ? ` · ${a.place}` : ''}
      </span>
    </p>
  )
}

/** The claim's four papers as she ticked them in the app (read-only here). */
function ClaimDocs({ task }: { task: SnapshotTask }) {
  if (!task.docs?.length) return null
  const left = task.docs.filter((d) => !d.done).length
  return (
    <div className="mt-2">
      <p className="text-[12.5px] font-bold text-ink-3">
        청구 서류 {left === 0 ? '모두 챙겼어요 ✓' : `${task.docs.length - left}/${task.docs.length}`}
      </p>
      <ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
        {task.docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <span
              aria-hidden
              className={cx(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-[12px] font-bold leading-none',
                d.done ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
              )}
            >
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className={cx(d.done && 'text-ink-3 line-through')}>{d.label}</span>
            <span className="sr-only">{d.done ? ' 챙겼어요' : ' 아직'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] text-ink-3">서류 체크는 앱에서 해요. 사진으로도 남겨 두면 든든해요.</p>
    </div>
  )
}

/** Title, deadline, the stage's rows and its one action. `done`: he just marked it (the snapshot confirms soon). */
export function LinkTaskBody({
  task,
  done,
  onDone,
  onSurface2 = false,
  className,
}: {
  task: SnapshotTask
  done: boolean
  onDone: (task: SnapshotTask) => void
  /** Inside a surface-2 box (the moment card): the pill takes the surface colour. */
  onSurface2?: boolean
  className?: string
}) {
  const overdue = task.status === 'overdue'
  const stage = task.stage
  const pastBooked =
    stage === 'booked' && !!task.appointment && task.appointment.date <= task.defaultDoneAt && task.appointment.date !== task.defaultDoneAt

  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-ink">
        이번 달 할 일
        {stage ? (
          <span className={cx('rounded-full px-1.5 py-px text-[10.5px]', stage === 'visited' ? 'bg-brand text-white' : 'bg-brand-soft')}>
            {STAGE_LABEL[stage]}
          </span>
        ) : null}
      </p>
      <p className="mt-px text-base font-extrabold leading-snug tracking-[-0.03em] text-ink">{task.title}</p>
      {task.dueText ? <p className={cx('mt-0.5 text-xs font-semibold', overdue ? 'text-warn' : 'text-ink-2')}>{task.dueText}</p> : null}

      {stage === 'visited' ? (
        <>
          <p className="mt-2 text-[15px] font-extrabold tracking-[-0.02em] text-ink">다녀왔어요?</p>
          <AppointmentLine task={task} />
        </>
      ) : stage === 'booked' ? (
        <>
          <AppointmentLine task={task} muted={pastBooked} />
          <p className="mt-0.5 text-[12.5px] text-ink-3">{`${task.guide?.bring ?? '검사의뢰서'} 챙기기 · 검사 준비는 병원 안내를 따라요.`}</p>
        </>
      ) : (
        <>
          <GuideRows task={task} />
          {stage === 'claim' ? <ClaimDocs task={task} /> : null}
          {task.why ? <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-3">{task.why}</p> : null}
          {stage === 'book' ? (
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink-3">병원 예약은 앱에서 잡아요. 이미 받았다면 아래에서 알려 주세요.</p>
          ) : null}
        </>
      )}

      {task.link && stage !== 'booked' && stage !== 'visited' ? (
        <div className="-mb-2.5">
          <ExternalLink href={task.link.url}>{task.link.label}</ExternalLink>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {done ? (
          <p role="status" className="flex items-center gap-1.5 text-[13.5px] font-bold text-ok">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
            {formatKo(task.defaultDoneAt, { weekday: false })}로 기록했어요
          </p>
        ) : (
          <>
            <Pill onClick={() => onDone(task)} tone={stage === 'visited' ? 'primary' : onSurface2 ? 'outline' : 'soft'} icon="check">
              {DONE_LABEL[stage ?? 'plain']}
            </Pill>
            <span className="text-[12px] text-ink-3">{formatKo(task.defaultDoneAt, { weekday: false })}로 기록돼요</span>
          </>
        )}
      </div>

      {task.tip ? (
        <p className="mt-2 border-t border-line/70 pt-2 text-[12.5px] leading-[1.5] text-ink-2">
          <b className="font-bold text-ink">오늘 해 줄 수 있는 것</b> · {task.tip}
        </p>
      ) : null}
    </div>
  )
}

/** The task as its own card (when it leads the page, or sits in 우리 한 줄). */
export default function LinkTaskCard({
  task,
  done,
  onDone,
  className,
}: {
  task: SnapshotTask
  done: boolean
  onDone: (task: SnapshotTask) => void
  className?: string
}) {
  const overdue = task.status === 'overdue'
  return (
    <section
      aria-label="이번 달 할 일"
      className={cx(
        'flex gap-3 rounded-[20px] border py-3 pl-3.5 pr-3 shadow-warm dark:shadow-none',
        overdue ? 'border-warn/25 bg-warn-soft' : 'border-transparent bg-surface dark:border-line/70 forced-colors:border-line',
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand-ink">
        <Icon name={taskIcon(task)} className="h-6 w-6" />
      </span>
      <LinkTaskBody task={task} done={done} onDone={onDone} onSurface2={overdue} className="min-w-0 flex-1" />
    </section>
  )
}
