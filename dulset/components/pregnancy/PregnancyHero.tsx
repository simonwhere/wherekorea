'use client'

import { useCallback, useState } from 'react'
import { Button, Card, cx } from '@/components/ui'
import { TRIMESTER_LABEL, TRIMESTER_START, type Trimester } from '@/lib/content/pregnancy'
import { dLabel, formatKo } from '@/lib/dates'
import { dueDate, formatGA, type GestationalAge } from '@/lib/logic/pregnancy'
import { weekPercent } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import type { Pregnancy } from '@/lib/types'
import DueDateSheet from './DueDateSheet'

const TRIMESTERS: Trimester[] = [1, 2, 3]

export default function PregnancyHero({ pregnancy, ga }: { pregnancy: Pregnancy; ga: GestationalAge }) {
  const { today } = useApp()
  const [editOpen, setEditOpen] = useState(false)
  // Stable, so the sheet does not re-focus its panel when the page re-renders.
  const closeEdit = useCallback(() => setEditOpen(false), [])
  const due = dueDate(pregnancy)
  const pct = ga.progress * 100
  const pastDue = ga.daysToDue < 0

  return (
    <Card tone="brand">
      <p className="text-xs font-semibold text-brand-ink">임신 {TRIMESTER_LABEL[ga.trimester]}</p>
      <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight text-ink">임신 {formatGA(ga)}</h1>
      <p className="mt-1 text-sm text-ink-2">
        출산 예정일 {formatKo(due)} · <span className="font-bold text-brand-ink">{dLabel(due, today)}</span>
      </p>

      {/* 40-week bar with trimester markers at 14주 and 28주. */}
      <div className="mt-5">
        <div
          role="progressbar"
          aria-label="40주 중 진행"
          aria-valuemin={0}
          aria-valuemax={40}
          aria-valuenow={Math.min(40, ga.weeks)}
          aria-valuetext={`40주 중 ${formatGA(ga)}`}
          className="relative h-2.5 rounded-full bg-surface"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          {[14, 28].map((w) => (
            <span
              key={w}
              aria-hidden
              className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ink-3/40"
              style={{ left: `${weekPercent(w)}%` }}
            />
          ))}
          <span
            aria-hidden
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-2 grid text-[11px]" style={{ gridTemplateColumns: '14fr 14fr 12fr' }}>
          {TRIMESTERS.map((t) => {
            const current = t === ga.trimester
            return (
              <div key={t} className={cx('min-w-0', t > 1 && 'border-l border-ink-3/30 pl-1.5')}>
                {t > 1 ? <span className="tabular-nums text-ink-3">{TRIMESTER_START[t]}주 </span> : null}
                <span className={cx(current ? 'font-bold text-brand-ink' : 'text-ink-3')}>{TRIMESTER_LABEL[t]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {pastDue ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-2">
          예정일이 지났어요. 병원 안내에 따라 편하게 지내요. 아기를 만났다면 아래 ‘아기가 태어났어요’로 이어 가요.
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[11px] leading-snug text-ink-3">
          {pregnancy.dueDateOverride ? '병원 예정일 기준' : `마지막 생리일(${formatKo(pregnancy.lmp, { weekday: false })}) 기준 예상`}
        </span>
        <Button variant="secondary" onClick={() => setEditOpen(true)} className="shrink-0">
          예정일 수정
        </Button>
      </div>

      <DueDateSheet open={editOpen} onClose={closeEdit} pregnancy={pregnancy} />
    </Card>
  )
}
