import type { Destination } from '@/data/types'

// Crowd is an INFORMATION metric, never a ranking input.
// Product decision (2026-07-11): crowd must not affect Best-now score —
// see docs/best-now-ranking.md §crowd 처리. The one exception is the
// user-chosen 'Quietest now' view, where crowd IS the lens.

// Is this destination in its crowding peak this month? (month: 1–12)
export function isPeakNow(d: Destination, month: number): boolean {
  return d.crowd_peak_months.includes(month)
}
