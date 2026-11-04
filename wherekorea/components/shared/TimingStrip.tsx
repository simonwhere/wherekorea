import type { Destination } from '@/data/types'
import { TIMING_MONTHS, timingCellLabel, timingMonthStatus } from '@/components/whentogo/timing-model'

// 12-month "when to go" strip — green: best months, amber: shoulder (±1),
// dim: outside recommended months. Dot: usual peak period. Ring: selected month.
// Pure component (server-safe); month passed in by callers for consistency.

const CELL_BG: Record<string, string> = {
  best: 'rgba(74,222,128,0.75)',
  shoulder: 'rgba(250,204,21,0.45)',
  off: 'rgba(255,255,255,0.10)',
}

interface Props {
  destination: Destination
  currentMonth?: number // legacy prop name: selected travel month, 1–12
  compact?: boolean     // smaller cells, no labels (compare rows)
}

export default function TimingStrip({ destination: d, currentMonth, compact = false }: Props) {
  const size = compact ? 14 : 20
  return (
    <div role="img" aria-label={`${d.name} seasonal guide. ${TIMING_MONTHS.map((_, index) => timingCellLabel(d, index + 1, currentMonth)).join('. ')}`}
      style={{ display: 'flex', gap: compact ? 2 : 3 }}>
      {TIMING_MONTHS.map((label, i) => {
        const m = i + 1
        const status = timingMonthStatus(d, m)
        const isPeak = d.crowd_peak_months.includes(m)
        const isSelected = currentMonth === m
        return (
          <div key={m} aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={timingCellLabel(d, m, currentMonth)}
              style={{
                width: size, height: size, borderRadius: 4,
                background: CELL_BG[status],
                outline: isSelected ? '1.5px solid rgba(255,255,255,0.9)' : 'none',
                outlineOffset: 1,
                position: 'relative',
              }}
            >
              {isPeak && (
                <span style={{
                  position: 'absolute', bottom: 1.5, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#f87171',
                }} />
              )}
            </div>
            {!compact && (
              <span style={{
                fontSize: 8.5, fontWeight: 600,
                color: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.70)',
              }}>{label.slice(0, 3)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
