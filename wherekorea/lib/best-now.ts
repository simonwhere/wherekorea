import type { Destination } from '@/data/types'

// Best-now ranking v2.1 — formula in docs/best-now-ranking.md
// best_now_score = base_appeal×5 + season_fit + weather_now
// Crowd is deliberately NOT part of the score (informational metric only).
// v2.1 (2026-09-02): weather_now is precipitation-aware, and `live` can be
// switched off when ranking for a month other than now (planning mode) —
// live weather says nothing about October, so the term goes neutral.

// season_fit (0–35): is this a genuinely good month to visit? (month: 1–12)
export function seasonFit(d: Destination, month: number): number {
  if (d.best_months.includes(month)) return 35
  const prev = month === 1 ? 12 : month - 1
  const next = month === 12 ? 1 : month + 1
  if (d.best_months.includes(prev) || d.best_months.includes(next)) return 18
  return 5
}

// WMO weather codes: 45/48 fog is not precipitation; 51+ is drizzle/rain/snow/showers/storm.
export type PrecipKind = 'none' | 'rain' | 'snow'
export function precipKind(code: number | undefined): PrecipKind {
  if (code === undefined || code === null) return 'none'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 51) return 'rain'
  return 'none'
}

const PRECIP_PENALTY = 12
const WEATHER_NEUTRAL = 24

// Fail closed: a partial API outage must not reward or punish destinations
// merely because their request happened to succeed.
export function hasCompleteLiveWeather(list: Destination[]): boolean {
  return list.length > 0 && list.every(
    (d) => d.live_weather_is_live === true && d.live_weather_current !== undefined
  )
}

// weather_now (0–40): comfort band from live temp, minus a precipitation penalty; neutral 24 when missing
export function weatherNow(d: Destination): number {
  const t = d.live_weather_current
  if (d.live_weather_is_live === false || t === undefined || t === null) return WEATHER_NEUTRAL
  let score: number
  if (t >= 15 && t <= 25) score = 40
  else if ((t >= 10 && t < 15) || (t > 25 && t <= 28)) score = 28
  else if ((t >= 5 && t < 10) || (t > 28 && t <= 31)) score = 15
  else score = 6
  if (precipKind(d.live_weather_code) !== 'none') score = Math.max(6, score - PRECIP_PENALTY)
  return score
}

// live=false → planning mode (a month other than now): weather term is neutral for everyone.
export function bestNowScore(d: Destination, month: number, live = true): number {
  return d.base_appeal * 5 + seasonFit(d, month) + (live ? weatherNow(d) : WEATHER_NEUTRAL)
}

// One-line "why it ranks here" copy — decision language, no hype
// (editorial-guidelines: practical, no exaggerated certainty)
export function bestNowReason(d: Destination, month: number, live = true): string {
  const s = seasonFit(d, month)
  const season = s === 35 ? 'In season' : s === 18 ? 'Shoulder season' : 'Off-season'

  const t = d.live_weather_current
  if (!live || d.live_weather_is_live === false || t === undefined || t === null) return season
  const precip = precipKind(d.live_weather_code)
  if (precip === 'rain') return `${season} · rain now`
  if (precip === 'snow') return `${season} · snow now`
  const w = weatherNow(d)
  const weather =
    w === 40 ? 'pleasant now'
    : w === 28 ? 'fair now'
    : t > 25 ? 'hot now'
    : 'cold now'
  return `${season} · ${weather}`
}

// Sort: score desc → season_fit desc → weather desc → name asc
export function sortByBestNow(list: Destination[], month: number, live = true): Destination[] {
  const useLiveWeather = live && hasCompleteLiveWeather(list)
  return [...list].sort(
    (a, b) =>
      bestNowScore(b, month, useLiveWeather) - bestNowScore(a, month, useLiveWeather) ||
      seasonFit(b, month) - seasonFit(a, month) ||
      (useLiveWeather ? weatherNow(b) - weatherNow(a) : 0) ||
      a.name.localeCompare(b.name)
  )
}
