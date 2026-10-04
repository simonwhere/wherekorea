'use client'

// "+ 기록" — one sheet for every log: 생리 · LH · 임테기 · 메모. Opened from the
// bottom-bar button, the home screen and calendar days (lib/logLauncher).
// Tapping a choice saves right away (no save button) and offers 되돌리기.
//
// For the partner (the one who does not record the cycle) while preparing, the
// same button is a '했어요' sheet (N28): a signal to answer, this week's one
// thing → [했어요], today's checks, '신호 보내기', and the memo folded at the
// bottom (openLog({ kind: 'note' }) still opens the memo alone). Everything on
// it is his own or something she sent — the same pieces as his home and link.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import IntimacyPanel from '@/components/log/IntimacyPanel'
import LHPanel from '@/components/log/LHPanel'
import NotePanel from '@/components/log/NotePanel'
import PeriodPanel from '@/components/log/PeriodPanel'
import PTestPanel from '@/components/log/PTestPanel'
import UndoToast, { UNDO_MS, type UndoMessage } from '@/components/log/UndoToast'
import { DateStepper, KindChips, type SaveLog } from '@/components/log/parts'
import { PendingSignal, SignalChips } from '@/components/signals/SignalsCard'
import WeekTogether from '@/components/today/WeekTogether'
import { dailyItems, weeklyRows } from '@/components/today/model'
import { useWeeklyUndo } from '@/components/today/useWeeklyUndo'
import { Sheet, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { isISODate } from '@/lib/dates'
import { cycleLens, dayLine, showsLH, showsTests } from '@/lib/logic/calendarView'
import { dayInfo } from '@/lib/logic/cycle'
import { canSeeIntimacy } from '@/lib/logic/intimacy'
import { defaultLogKind, logUndo, undoLog, type LogKind, type LogUndo } from '@/lib/logic/logs'
import { checkInLabel, doneIds, isWeekly } from '@/lib/logic/checks'
import { canLogCycle } from '@/lib/logic/prefs'
import { stampOn, toggleWithCompletion } from '@/lib/logic/today'
import { partnerTaskVisible } from '@/lib/logic/ttcFlow'
import type { LogRequest } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'
import type { CheckItem, ISODate } from '@/lib/types'

/** body[data-toast-top]: toasts sit at the top (app/globals.css), as while a sheet is open. */
const TOAST_TOP_ATTR = 'data-toast-top'

export default function LogSheet({ request, onClose }: { request: LogRequest | null; onClose: () => void }) {
  const { update } = useApp()
  const toast = useToast()
  const [undo, setUndo] = useState<(UndoMessage & { change: LogUndo }) | null>(null)
  // Where the open sheet came from (the save callback stays stable across requests).
  const from = useRef<LogRequest['from']>(undefined)
  if (request) from.current = request.from

  // From 오늘, the toast keeps the top spot for as long as 되돌리기 lasts, so
  // the card's new buttons (알리기 · 병원 일정 넣기) under it stay reachable.
  const toastTop = useRef(0)
  const clearToastTop = useCallback(() => {
    window.clearTimeout(toastTop.current)
    document.body.removeAttribute(TOAST_TOP_ATTR)
  }, [])
  const holdToastTop = useCallback(() => {
    clearToastTop()
    document.body.setAttribute(TOAST_TOP_ATTR, '')
    toastTop.current = window.setTimeout(() => document.body.removeAttribute(TOAST_TOP_ATTR), UNDO_MS)
  }, [clearToastTop])
  useEffect(() => clearToastTop, [clearToastTop])

  const expire = useCallback(() => {
    setUndo(null)
    clearToastTop()
  }, [clearToastTop])

  const save = useCallback<SaveLog>(
    (change, target, message, opts) => {
      let captured: LogUndo | undefined
      update((s) => {
        captured = logUndo(s, target)
        return change(s)
      })
      if (captured) setUndo({ id: Date.now(), text: message, change: captured })
      if (captured && from.current === 'today') holdToastTop()
      if (!opts?.keepOpen) onClose()
    },
    [update, onClose, holdToastTop],
  )

  const revert = useCallback(() => {
    if (!undo) return
    const change = undo.change
    update((s) => undoLog(s, change))
    setUndo(null)
    clearToastTop()
    toast.show('되돌렸어요')
  }, [undo, update, toast, clearToastTop])

  // Each openLog() call starts fresh (date, chip, panel state), even if the
  // sheet happens to be open already.
  const [opened, setOpened] = useState<{ request: LogRequest | null; n: number }>({ request: null, n: 0 })
  if (request && opened.request !== request) setOpened({ request, n: opened.n + 1 })

  return (
    <>
      <Sheet open={request !== null} onClose={onClose} title="기록하기">
        {request ? <LogBody key={opened.n} request={request} save={save} onClose={onClose} /> : null}
      </Sheet>
      <UndoToast message={undo} onUndo={revert} onExpire={expire} />
    </>
  )
}

function LogBody({ request, save, onClose }: { request: LogRequest; save: SaveLog; onClose: () => void }) {
  const { state, viewer } = useApp()
  // The partner's '+ 기록' while preparing: what he did, not a memo-only sheet (N28).
  if (state.stage === 'preparing' && !canLogCycle(state, viewer) && request.kind !== 'note') return <DidBody save={save} />
  return <RecordBody request={request} save={save} onClose={onClose} />
}

function RecordBody({ request, save, onClose }: { request: LogRequest; save: SaveLog; onClose: () => void }) {
  const { state, today, viewer, partner, cycleOwner } = useApp()
  const lens = useMemo(() => cycleLens(state, viewer, today), [state, viewer, today])
  // Only the person whose cycle it is logs periods, LH and tests — and only while preparing.
  const canLog = canLogCycle(state, viewer) && state.stage === 'preparing'
  // 관계 (Next B): only for the person who gave the separate consent, and only while they still log the cycle.
  const intimacy = canLog && canSeeIntimacy(state, viewer)
  const kinds: LogKind[] = canLog
    ? [...(lens.view === 'hidden' ? (['period', 'ptest', 'note'] as const) : (['period', 'lh', 'ptest', 'note'] as const)), ...(intimacy ? (['intimacy'] as const) : [])]
    : ['note']

  const [date, setDate] = useState<ISODate>(() => {
    const d = request.date
    return isISODate(d) && d <= today ? d : today
  })
  const [kind, setKind] = useState<LogKind>(() => {
    const want = request.kind ?? (canLog ? defaultLogKind(state, date, today) : 'note')
    return kinds.includes(want) ? want : kinds[0]!
  })

  const line = canLog ? dayLine(dayInfo(state, date, today), lens) : ''
  // What the partner's screen shows of this kind of record (their own wording applies too).
  const partnerLens = cycleLens(state, partner.id, today)
  const partnerSees = kind === 'lh' ? showsLH(partnerLens) : kind === 'ptest' ? showsTests(partnerLens) : partnerLens.details

  return (
    <div className="space-y-4">
      <DateStepper date={date} today={today} onChange={setDate} line={line} />
      {kinds.length > 1 ? <KindChips kinds={kinds} value={kind} onChange={setKind} /> : null}

      <section aria-label="기록">
        {kind === 'period' ? (
          <PeriodPanel key={date} date={date} save={save} />
        ) : kind === 'lh' ? (
          <LHPanel key={date} date={date} view={lens.view} paused={!!lens.pause} save={save} />
        ) : kind === 'ptest' ? (
          <PTestPanel key={date} date={date} view={lens.view} save={save} onClose={onClose} />
        ) : kind === 'intimacy' ? (
          <IntimacyPanel key={date} date={date} />
        ) : (
          <NotePanel date={date} save={save} />
        )}
      </section>

      {canLog ? (
        kind === 'intimacy' ? null : kind !== 'note' ? (
          <p className="text-[11px] leading-relaxed text-ink-3">
            {partnerSees
              ? `${partner.name}님 화면에도 함께 보여요.`
              : partnerLens.details || partnerLens.view === 'hidden' || partnerLens.pause
                ? `${partner.name}님 화면에는 이 기록이 보이지 않아요.`
                : `${partner.name}님에게는 기록 내용 없이 우리의 주간만 보여요.`}{' '}
            날짜 예상은 참고용이며 피임 목적으로 쓰면 안 돼요.
          </p>
        ) : null
      ) : canLogCycle(state, viewer) ? null : (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
          주기 기록은 {cycleOwner.name}님이 해요.
        </p>
      )}
    </div>
  )
}

// ── '했어요' (the partner's + 기록, N28) ─────────────────────

const sectionTitle = 'mb-1.5 text-[13px] font-bold text-ink-2'

function DidBody({ save }: { save: SaveLog }) {
  const { state, today, me, cycleOwner } = useApp()
  // The same chain line as his home's week block (TodayTab): not in the quiet after a loss.
  const withChain = partnerTaskVisible(state, today, me.id)
  return (
    <div className="space-y-5" data-did-sheet>
      <p className="-mt-1 text-[13px] leading-relaxed text-ink-2">한 것을 여기서 바로 남겨요. 누르면 바로 저장돼요.</p>
      <PendingSignal />
      <WeekTogether withChain={withChain} />
      <DidChecks />
      <SignalChips />
      <details className="group rounded-xl bg-surface-2 px-3.5">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
          <Icon name="book" className="h-[18px] w-[18px] text-ink-3" />
          <span className="flex-1">메모 남기기</span>
          <Icon name="chev" className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="pb-3.5">
          <NotePanel date={today} save={save} />
        </div>
      </details>
      <p className="text-[11px] leading-relaxed text-ink-3">주기 기록은 {cycleOwner.name}님이 해요.</p>
    </div>
  )
}

/** Today's checks as one-tap rows — the same toggle as the home's 오늘 할 일 (TodayTasks), weekly check-ins with 되돌리기. */
function DidChecks() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const weeklyUndo = useWeeklyUndo()
  const items = dailyItems(state, me.id)
  const weekly = weeklyRows(state, me.id, today)
  const done = doneIds(state, me.id, today)
  if (!items.length && !weekly.length) return null

  const toggle = (item: CheckItem) => {
    const now = stampOn(today)
    const alreadyTold = state.notifications.some((n) => n.key === `complete:${me.id}:${today}`)
    const preview = toggleWithCompletion(state, me.id, partner.id, today, item.id, now)
    update((s) => toggleWithCompletion(s, me.id, partner.id, today, item.id, now).state)
    if (preview.completed) toast.show(alreadyTold ? '오늘 체크 완료!' : `오늘 체크 완료! ${partner.name}님에게 알렸어요`)
    else if (preview.cleared?.length) weeklyUndo.offer(item, preview.cleared)
    else if (isWeekly(item) && !done.includes(item.id)) toast.show('이번 주 체크인 완료!')
  }

  const rows = [
    ...items.map((item) => ({ item, checked: done.includes(item.id), weekly: false })),
    ...weekly.map((r) => ({ ...r, weekly: true })),
  ]
  return (
    <section aria-labelledby="did-checks">
      <h3 id="did-checks" className={sectionTitle}>
        오늘 체크
      </h3>
      <ul className="divide-y divide-line/70 rounded-xl border border-line bg-surface px-3">
        {rows.map(({ item, checked, weekly: isWeeklyRow }) => (
          <li key={item.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(item)}
              className="flex min-h-[52px] w-full items-center gap-3 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            >
              <span className={cx('min-w-0 flex-1 text-[15px] font-bold tracking-[-0.02em]', checked ? 'text-ink-2' : 'text-ink')}>
                {isWeeklyRow ? checkInLabel(item) : item.label}
              </span>
              <span
                aria-hidden
                className={cx(
                  'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full',
                  checked ? 'bg-ok text-white' : 'shadow-[inset_0_0_0_2px_rgb(var(--control))]',
                )}
              >
                {checked ? <Icon name="check" className="h-4 w-4" strokeWidth={2.8} /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {weeklyUndo.toast}
    </section>
  )
}
