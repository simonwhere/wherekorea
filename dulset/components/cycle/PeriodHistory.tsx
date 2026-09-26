'use client'

import { useState } from 'react'
import { Card, SectionTitle } from '@/components/ui'
import { diffDays, formatKo } from '@/lib/dates'
import { MAX_CYCLE } from '@/lib/logic/cycle'
import { periodHistory } from '@/lib/logic/calendarView'
import type { ISODate, PeriodLog } from '@/lib/types'

const COLLAPSED_COUNT = 6

export default function PeriodHistory({
  periods,
  today,
  onSelect,
}: {
  periods: PeriodLog[]
  today: ISODate
  onSelect: (date: ISODate) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const rows = periodHistory(periods)
  if (rows.length === 0) return null
  const visible = showAll ? rows : rows.slice(0, COLLAPSED_COUNT)
  const thisYear = today.slice(0, 4)

  return (
    <>
      <SectionTitle sub="눌러서 고치거나 지울 수 있어요">생리 기록</SectionTitle>
      <Card className="px-0 py-1">
        <ul className="divide-y divide-line">
          {visible.map((r) => {
            const withYear = r.start.slice(0, 4) !== thisYear
            return (
              <li key={r.start}>
                <button
                  type="button"
                  onClick={() => onSelect(r.start)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2"
                >
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-period" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {formatKo(r.start, { year: withYear })}
                      {r.end ? (
                        <span className="font-medium text-ink-2"> ~ {formatKo(r.end, { weekday: false })}</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-ink-3">
                      {r.bleedDays ? `${r.bleedDays}일간` : '마지막 날 미기록'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {r.cycleLength !== undefined ? (
                      <span className="block text-sm font-bold tabular-nums text-ink">{r.cycleLength}일 주기</span>
                    ) : r.start <= today && diffDays(r.start, today) < MAX_CYCLE ? (
                      <span className="block text-xs font-semibold text-brand-ink">
                        이번 주기 · {diffDays(r.start, today) + 1}일째
                      </span>
                    ) : r.start <= today ? (
                      <span className="block text-xs text-ink-3">이후 기록 없음</span>
                    ) : null}
                    {r.hint === 'gap' ? (
                      <span className="mt-0.5 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                        기록 누락?
                      </span>
                    ) : r.hint === 'short' ? (
                      <span className="mt-0.5 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                        간격이 짧아요 · 중복?
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {rows.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex h-11 w-full items-center justify-center border-t border-line text-xs font-semibold text-ink-2 hover:bg-surface-2"
            aria-expanded={showAll}
          >
            {showAll ? '접기' : `모두 보기 (${rows.length})`}
          </button>
        ) : null}
      </Card>
      {rows.some((r) => r.hint === 'gap') ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
          ‘기록 누락?’은 두 기록 사이가 {MAX_CYCLE}일을 넘을 때 표시돼요. 그 사이 기록을 빠뜨렸다면 달력에서 날짜를 눌러 추가해 주세요.
          평균 주기 계산에서는 빠져요.
        </p>
      ) : null}
    </>
  )
}
