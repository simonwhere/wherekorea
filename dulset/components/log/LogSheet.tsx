'use client'

// "+ 기록" — one sheet for every log: 생리 · LH · 임테기 · 메모. Opened from the
// bottom-bar button, the home screen and calendar days (lib/logLauncher).
// Tapping a choice saves right away (no save button) and offers 되돌리기.

import { useCallback, useMemo, useState } from 'react'
import LHPanel from '@/components/log/LHPanel'
import NotePanel from '@/components/log/NotePanel'
import PeriodPanel from '@/components/log/PeriodPanel'
import PTestPanel from '@/components/log/PTestPanel'
import UndoToast, { type UndoMessage } from '@/components/log/UndoToast'
import { DateStepper, KindChips, type SaveLog } from '@/components/log/parts'
import { Sheet, useToast } from '@/components/ui'
import { isISODate } from '@/lib/dates'
import { cycleLens, dayLine, showsLH, showsTests } from '@/lib/logic/calendarView'
import { dayInfo } from '@/lib/logic/cycle'
import { defaultLogKind, logUndo, undoLog, type LogKind, type LogUndo } from '@/lib/logic/logs'
import { canLogCycle } from '@/lib/logic/prefs'
import type { LogRequest } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

export default function LogSheet({ request, onClose }: { request: LogRequest | null; onClose: () => void }) {
  const { update } = useApp()
  const toast = useToast()
  const [undo, setUndo] = useState<(UndoMessage & { change: LogUndo }) | null>(null)
  const expire = useCallback(() => setUndo(null), [])

  const save = useCallback<SaveLog>(
    (change, target, message, opts) => {
      let captured: LogUndo | undefined
      update((s) => {
        captured = logUndo(s, target)
        return change(s)
      })
      if (captured) setUndo({ id: Date.now(), text: message, change: captured })
      if (!opts?.keepOpen) onClose()
    },
    [update, onClose],
  )

  const revert = useCallback(() => {
    if (!undo) return
    const change = undo.change
    update((s) => undoLog(s, change))
    setUndo(null)
    toast.show('되돌렸어요')
  }, [undo, update, toast])

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
  const { state, today, viewer, partner, cycleOwner } = useApp()
  const lens = useMemo(() => cycleLens(state, viewer), [state, viewer])
  // Only the person whose cycle it is logs periods, LH and tests — and only while preparing.
  const canLog = canLogCycle(state, viewer) && state.stage === 'preparing'
  const kinds: LogKind[] = canLog ? (lens.view === 'hidden' ? ['period', 'ptest', 'note'] : ['period', 'lh', 'ptest', 'note']) : ['note']

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
  const partnerLens = cycleLens(state, partner.id)
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
        ) : (
          <NotePanel date={date} save={save} />
        )}
      </section>

      {canLog ? (
        kind !== 'note' ? (
          <p className="text-[11px] leading-relaxed text-ink-3">
            {partnerSees
              ? `${partner.name}님 화면에도 함께 보여요.`
              : partnerLens.details || partnerLens.view === 'hidden'
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
