'use client'

import { useMemo } from 'react'
import { Card, cx } from '@/components/ui'
import { monthGrid, startOfMonth } from '@/lib/dates'
import { dayInfo, type CycleInput } from '@/lib/logic/cycle'
import {
  canShiftMonth,
  cellView,
  legendItems,
  monthTitle,
  shiftMonth,
  type Lens,
} from '@/lib/logic/calendarView'
import type { ISODate, PregnancyTestResult } from '@/lib/types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export default function MonthCalendar({
  input,
  tests,
  month,
  onMonthChange,
  today,
  lens,
  onSelect,
}: {
  input: CycleInput
  /** Strongest pregnancy-test result per day. */
  tests: Record<ISODate, PregnancyTestResult>
  month: ISODate
  onMonthChange: (month: ISODate) => void
  today: ISODate
  /** What this viewer may see (details, wording, pause). */
  lens: Lens
  onSelect: (date: ISODate) => void
}) {
  const cells = useMemo(
    () => monthGrid(month).map((d) => cellView(dayInfo(input, d, today), { month, today, view: lens.view, lens, ptest: tests[d] })),
    [input, tests, month, today, lens],
  )
  const legend = legendItems(lens.view, lens)
  // LH badges only reach explicit wording (calendarView.showsLH), so name LH only then.
  const lhMarks = cells.some((c) => c.lhBadge)
  const testMarks = cells.some((c) => c.ptestBadge)
  const marks =
    lhMarks && testMarks
      ? '초록 글씨는 LH 결과, ‘임’은 임테기 기록이에요.'
      : lhMarks
        ? '초록 글씨는 LH 결과예요.'
        : testMarks
          ? '‘임’은 임테기 기록이에요.'
          : ''
  const isCurrent = startOfMonth(month) === startOfMonth(today)
  const canPrev = canShiftMonth(month, -1, today)
  const canNext = canShiftMonth(month, 1, today)

  return (
    <Card className="px-2 py-3">
      <div className="mb-2 flex items-center justify-between gap-1 px-1">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, -1, today))}
          disabled={!canPrev}
          aria-label="이전 달"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-30"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold tabular-nums text-ink" aria-live="polite">
            {monthTitle(month)}
          </h3>
          {!isCurrent ? (
            <button
              type="button"
              onClick={() => onMonthChange(startOfMonth(today))}
              aria-label="오늘이 있는 달로 돌아가기"
              className="group flex h-11 items-center rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2 group-hover:bg-surface-2">
                오늘
              </span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, 1, today))}
          disabled={!canNext}
          aria-label="다음 달"
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div role="group" aria-label={`${monthTitle(month)} 달력`}>
        <div className="grid grid-cols-7" aria-hidden>
          {/* Red stays for period days only, so weekday names are all neutral. */}
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[11px] font-semibold text-ink-3">
              {w}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className="grid grid-cols-7">
            {cells.slice(row * 7, row * 7 + 7).map((c) => (
              <div key={c.date} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onSelect(c.date)}
                  aria-label={c.ariaLabel}
                  aria-current={c.isToday ? 'date' : undefined}
                  className="flex h-12 w-full min-w-[40px] items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className={c.className} aria-hidden>
                    {c.day}
                    {c.star ? <span className="absolute -right-1 -top-1 text-[10px] leading-none">⭐</span> : null}
                    {c.ptestBadge ? (
                      <span className={cx('absolute -left-1 -top-1', c.ptestBadge.className)}>{c.ptestBadge.text}</span>
                    ) : null}
                    {c.lhBadge ? (
                      c.lhBadge.text ? (
                        <span className={cx('absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap', c.lhBadge.className)}>
                          {c.lhBadge.text}
                        </span>
                      ) : (
                        <span className={cx('absolute -bottom-1 left-1/2 -translate-x-1/2', c.lhBadge.className)} />
                      )
                    ) : null}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {legend.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line px-2 pt-3" aria-label="범례">
          {legend.map((l) => (
            <li key={l.key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
              {l.mark ? (
                <span aria-hidden className="text-[11px] leading-none">
                  {l.mark}
                </span>
              ) : (
                <span className={cx('inline-block h-3.5 w-3.5 rounded-full', l.swatch)} aria-hidden />
              )}
              {l.swatch2 ? <span className={cx('-ml-1 inline-block h-3.5 w-3.5 rounded-full', l.swatch2)} aria-hidden /> : null}
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
      {marks ? <p className="mt-1.5 px-2 text-[11px] text-ink-3">{marks}</p> : null}
      <p className="mt-2 px-2 text-[11px] text-ink-3">
        {lens.owner ? '날짜를 누르면 그날을 기록할 수 있어요.' : '날짜를 누르면 자세히 볼 수 있어요.'}
      </p>
    </Card>
  )
}
