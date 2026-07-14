import type { Destination } from '@/data/types'

// 12-month "when to go" strip — green: best months, amber: shoulder (±1),
// dim: off-season. Red dot: crowding peak month. Ring: current month.
// Pure component (server-safe); month passed in by callers for consistency.

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function monthStatus(d: Destination, m: number): 'best' | 'shoulder' | 'off' {
  if (d.best_months.includes(m)) return 'best'
  const prev = m === 1 ? 12 : m - 1
  const next = m === 12 ? 1 : m + 1
  if (d.best_months.includes(prev) || d.best_months.includes(next)) return 'shoulder'
  return 'off'
}

const CELL_BG: Record<string, string> = {
  best: 'rgba(74,222,128,0.75)',
  shoulder: 'rgba(250,204,21,0.45)',
  off: 'rgba(255,255,255,0.10)',
}

interface Props {
  destination: Destination
  currentMonth?: number // 1–12; highlights the column
  compact?: boolean     // smaller cells, no labels (compare rows)
}

export default function TimingStrip({ destination: d, currentMonth, compact = false }: Props) {
  const size = compact ? 14 : 20
  return (
    <div style={{ display: 'flex', gap: compact ? 2 : 3 }}>
      {MONTH_LABELS.map((label, i) => {
        const m = i + 1
        const status = monthStatus(d, m)
        const isPeak = d.crowd_peak_months.includes(m)
        const isNow = currentMonth === m
        return (
          <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              title={`${label}: ${status}${isPeak ? ' · peak crowds' : ''}`}
              style={{
                width: size, height: size, borderRadius: 4,
                background: CELL_BG[status],
                outline: isNow ? '1.5px solid rgba(255,255,255,0.9)' : 'none',
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
                color: isNow ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.40)',
              }}>{label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
