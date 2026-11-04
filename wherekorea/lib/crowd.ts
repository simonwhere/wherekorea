import type { Destination } from '@/data/types'
import { CROWD_MONTHLY } from '@/data/crowd-monthly'

// Crowd is an INFORMATION metric, never a ranking input.
// Product decision (2026-07-11): crowd must not affect Best-now score —
// see docs/best-now-ranking.md §crowd 처리. The one exception is the
// user-chosen 'Quietest now' view, where crowd IS the lens.

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Is this destination in its crowding peak this month? (month: 1–12)
export function isPeakNow(d: Destination, month: number): boolean {
  return d.crowd_peak_months.includes(month)
}

// Monthly visitor index (1.0 = this destination's yearly average) — KT/SKT mobile-network data.
// This sampled index compares months within one city, not crowd levels across cities.
export function crowdIndex(slug: string, month: number): number | null {
  const row = CROWD_MONTHLY[slug]
  if (!row || !Number.isInteger(month) || month < 1 || month > 12) return null
  const value = row[month - 1]
  return Number.isFinite(value) ? value : null
}

// Compact label for cards: "1.8× visitors in Oct" (one decimal, always with the month)
export function crowdIndexLabel(slug: string, month: number): string | null {
  const r = crowdIndex(slug, month)
  if (r === null) return null
  return `${r.toFixed(1)}× visitors in ${MONTH_SHORT[month - 1]}`
}
