'use client'

// Read-only day info: future days (nothing to log yet) and the partner's view
// (only the cycle owner logs). The owner's past days open the "+ 기록" sheet.

import { useMemo } from 'react'
import { Button, Sheet, cx } from '@/components/ui'
import { cycleAt, dayInfo } from '@/lib/logic/cycle'
import {
  CHANCE_LABEL,
  LH_LABEL,
  PHASE_CLASS,
  PTEST_LABEL,
  dayChanceFor,
  dayTitle,
  explainDayFor,
  futureDayNote,
  knownCycleDay,
  lensPhase,
  phaseLabel,
  showsLH,
  showsTests,
  type Lens,
} from '@/lib/logic/calendarView'
import { lhTestsOn, pregnancyTestsOn } from '@/lib/logic/logs'
import { openLog } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

export default function DaySheet({ date, onClose, lens }: { date: ISODate | null; onClose: () => void; lens: Lens }) {
  const { today } = useApp()
  return (
    <Sheet
      open={date !== null}
      onClose={onClose}
      title={
        date ? (
          <span className="flex items-center gap-2">
            {dayTitle(date, today)}
            {date === today ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">오늘</span>
            ) : null}
          </span>
        ) : (
          ''
        )
      }
    >
      {date ? <DayBody key={date} date={date} lens={lens} onClose={onClose} /> : null}
    </Sheet>
  )
}

function DayBody({ date, lens, onClose }: { date: ISODate; lens: Lens; onClose: () => void }) {
  const { state, today, cycleOwner } = useApp()
  // `today` stops projections past a missed period / an ended pregnancy, like the grid.
  const info = useMemo(() => dayInfo(state, date, today), [state, date, today])
  const cycle = useMemo(() => cycleAt(state, date), [state, date])
  const phase = lensPhase(info.phase, lens)
  const label = phaseLabel(phase, lens.view)
  const chance = dayChanceFor(info, lens)
  const cycleDay = lens.details ? knownCycleDay(info) : undefined
  const lh = showsLH(lens) ? lhTestsOn(state.lhTests, date) : []
  const tests = showsTests(lens) ? pregnancyTestsOn(state.pregnancyTests, date) : []
  const star = lens.view === 'explicit' && lens.details && !lens.pause && info.isOvulation && cycle

  return (
    <div className="space-y-5">
      <section aria-label="예상">
        <div className="flex items-start gap-3">
          <span className={cx('mt-0.5 h-5 w-5 shrink-0 rounded-full', phase === 'none' ? 'bg-surface-2' : PHASE_CLASS[phase])} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">
              {label || (cycleDay !== undefined ? `주기 ${cycleDay}일째` : lens.details ? '예상 없음' : '평범한 날')}
              {label && cycleDay !== undefined ? <span className="ml-1.5 text-xs font-medium text-ink-3">주기 {cycleDay}일째</span> : null}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{explainDayFor(info, lens, date < today)}</p>
            {star ? (
              <p className="mt-2 text-[13px] font-medium text-fert">
                <span aria-hidden>⭐ </span>배란 예상일 · {cycle.basis === 'lh' ? 'LH 양성 다음 날로 계산했어요' : '달력으로 계산했어요'}
              </p>
            ) : null}
            {chance ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                임신 가능성(예상):
                <strong
                  className={cx('font-bold', chance === CHANCE_LABEL.high ? 'text-fert' : chance === CHANCE_LABEL.low ? 'text-ink-3' : 'text-ink')}
                >
                  {chance}
                </strong>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {lh.length > 0 || tests.length > 0 ? (
        <section aria-label="이 날의 기록" className="space-y-1">
          {lh.map((t) => (
            <p key={`lh-${t.time ?? ''}`} className="text-[13px] tabular-nums text-ink-2">
              LH {LH_LABEL[t.result]}
              {t.time ? <span className="ml-1.5 text-xs text-ink-3">{t.time}</span> : null}
            </p>
          ))}
          {tests.map((t) => (
            <p key={t.id} className="text-[13px] tabular-nums text-ink-2">
              임테기 {PTEST_LABEL[t.result]}
              {t.time ? <span className="ml-1.5 text-xs text-ink-3">{t.time}</span> : null}
            </p>
          ))}
        </section>
      ) : null}

      {lens.owner ? (
        date > today ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">{futureDayNote(lens.view)}</p>
        ) : null
      ) : (
        <div className="space-y-2">
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
            주기 기록은 {cycleOwner.name}님이 해요.
          </p>
          {date <= today ? (
            <Button
              full
              variant="secondary"
              onClick={() => {
                onClose()
                openLog({ date, kind: 'note' })
              }}
            >
              이 날 메모 남기기
            </Button>
          ) : null}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-ink-3">모든 날짜는 참고용 예상이며 피임 목적으로 쓰면 안 돼요.</p>
    </div>
  )
}
