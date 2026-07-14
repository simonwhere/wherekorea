import type { Destination } from '@/data/types'

// Best-now ranking v2 — formula LOCKED in docs/best-now-ranking.md
// best_now_score = base_appeal×5 + season_fit + weather_now
// Crowd is deliberately NOT part of the score (informational metric only).

// season_fit (0–35): is now a genuinely good month to visit? (month: 1–12)
export function seasonFit(d: Destination, month: number): number {
  if (d.best_months.includes(month)) return 35
  const prev = month === 1 ? 12 : month - 1
  const next = month === 12 ? 1 : month + 1
  if (d.best_months.includes(prev) || d.best_months.includes(next)) return 18
  return 5
}

// weather_now (0–40): comfort band from live temp; neutral 24 when missing
export function weatherNow(d: Destination): number {
  const t = d.live_weather_current
  if (t === undefined || t === null || t === 0) return 24 // missing/0 → neutral
  if (t >= 15 && t <= 25) return 40
  if ((t >= 10 && t < 15) || (t > 25 && t <= 28)) return 28
  if ((t >= 5 && t < 10) || (t > 28 && t <= 31)) return 15
  return 6
}

export function bestNowScore(d: Destination, month: number): number {
  return d.base_appeal * 5 + seasonFit(d, month) + weatherNow(d)
}

// One-line "why it ranks here" copy — decision language, no hype
// (editorial-guidelines: practical, no exaggerated certainty)
export function bestNowReason(d: Destination, month: number): string {
  const s = seasonFit(d, month)
  const season = s === 35 ? 'In season' : s === 18 ? 'Shoulder season' : 'Off-season'

  const t = d.live_weather_current
  if (t === undefined || t === null || t === 0) return season
  const w = weatherNow(d)
  const weather =
    w === 40 ? 'pleasant now'
    : w === 28 ? 'fair now'
    : t > 25 ? 'hot now'
    : 'cold now'
  return `${season} · ${weather}`
}

// Sort: score desc → season_fit desc → weather desc → name asc
export function sortByBestNow(list: Destination[], month: number): Destination[] {
  return [...list].sort(
    (a, b) =>
      bestNowScore(b, month) - bestNowScore(a, month) ||
      seasonFit(b, month) - seasonFit(a, month) ||
      weatherNow(b) - weatherNow(a) ||
      a.name.localeCompare(b.name)
  )
}
