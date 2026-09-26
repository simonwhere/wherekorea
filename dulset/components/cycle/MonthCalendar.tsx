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
  type FertilityView,
} from '@/lib/logic/calendarView'
import type { ISODate } from '@/lib/types'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export default function MonthCalendar({
  input,
  month,
  onMonthChange,
  today,
  view,
  onSelect,
}: {
  input: CycleInput
  month: ISODate
  onMonthChange: (month: ISODate) => void
  today: ISODate
  view: FertilityView
  onSelect: (date: ISODate) => void
}) {
  const cells = useMemo(
    () => monthGrid(month).map((d) => cellView(dayInfo(input, d), { month, today, view })),
    [input, month, today, view],
  )
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
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
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
          className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div role="group" aria-label={`${monthTitle(month)} 달력`}>
        <div className="grid grid-cols-7" aria-hidden>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cx(
                'pb-1 text-center text-[11px] font-semibold',
                i === 0 ? 'text-period' : i === 6 ? 'text-him' : 'text-ink-3',
              )}
            >
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
                    {c.lh === 'positive' ? (
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-ok px-0.5 text-[8px] font-bold leading-[11px] text-surface">
                        LH+
                      </span>
                    ) : c.lh === 'negative' ? (
                      <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-ink-3" />
                    ) : null}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line px-2 pt-3" aria-label="범례">
        {legendItems(view).map((l) => (
          <li key={l.key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className={cx('inline-block h-3.5 w-3.5 rounded-full', l.swatch)} aria-hidden />
            {l.label}
          </li>
        ))}
        {view === 'explicit' ? (
          <li className="flex items-center gap-1 text-[11px] text-ink-2">
            <span aria-hidden className="text-[11px]">⭐</span>배란 예상
          </li>
        ) : null}
        {view !== 'hidden' ? (
          <>
            <li className="flex items-center gap-1 text-[11px] text-ink-2">
              <span aria-hidden className="rounded bg-ok px-0.5 text-[8px] font-bold leading-[11px] text-surface">LH+</span>
              LH 양성
            </li>
            <li className="flex items-center gap-1.5 text-[11px] text-ink-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" />
              LH 음성
            </li>
          </>
        ) : null}
        <li className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-brand" aria-hidden />
          오늘
        </li>
      </ul>
      <p className="mt-2 px-2 text-[11px] text-ink-3">날짜를 누르면 기록하거나 자세히 볼 수 있어요.</p>
    </Card>
  )
}
