import type { Destination } from '@/data/types'
import { DAILY_AVG, matchesCategory } from '@/data/destinations-meta'
import { currentKoreaMonth, isDailyBudgetLimit, type BrowseState } from '@/lib/browse-state'
import { filterDestinations } from '@/lib/filters'
import { hasCompleteLiveWeather, seasonFit, weatherNow } from '@/lib/best-now'
import { isPeakNow, MONTH_SHORT } from '@/lib/crowd'

/** Parse only the current documented KRW-thousands format; never guess missing costs. */
export function dailyEstimateKrw(slug: string): number | null {
  const label = Object.prototype.hasOwnProperty.call(DAILY_AVG, slug) ? DAILY_AVG[slug] : undefined
  const match = typeof label === 'string' ? /^₩(\d+(?:\.\d+)?)k$/.exec(label) : null
  const amount = match ? Number(match[1]) * 1000 : NaN
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

/**
 * Transparent rule-based ordering, not a learned or personalized quality score.
 * Respect selected conditions first; order by season, then (explicit Now mode)
 * current weather, then editorial year-round appeal. Crowd is information only.
 */
export function rankDestinations(list: Destination[], state: BrowseState): Destination[] {
  const maxDailyKrw = isDailyBudgetLimit(state.maxDailyKrw) ? state.maxDailyKrw : undefined
  const useWeather = state.mode === 'now' && state.month === currentKoreaMonth()
    && hasCompleteLiveWeather(list)
    && list.every((destination) => Number.isFinite(destination.live_weather_current))
  const eligible = list.filter((destination) => {
    const cost = dailyEstimateKrw(destination.slug)
    return (!state.excludeSeoul || destination.slug !== 'seoul')
      && matchesCategory(destination, state.category)
      && (state.category !== 'low-crowd' || !isPeakNow(destination, state.month))
      && (maxDailyKrw === undefined || (cost !== null && cost <= maxDailyKrw))
  })
  return filterDestinations(eligible, state.filters, state.q).sort((a, b) =>
    seasonFit(b, state.month) - seasonFit(a, state.month)
    || (useWeather ? weatherNow(b) - weatherNow(a) : 0)
    || b.base_appeal - a.base_appeal
    || a.name.localeCompare(b.name)
  )
}

export function recommendationReasons(destination: Destination, state: BrowseState): {
  reasons: string[]
  tradeoff: string
} {
  const fit = seasonFit(destination, state.month)
  const month = MONTH_SHORT[state.month - 1]
  const reasons = [
    fit === 35 ? `${month} is one of its recommended months`
      : fit === 18 ? `${month} sits next to a recommended season`
        : `${month} is outside its recommended months`,
  ]
  if (isDailyBudgetLimit(state.maxDailyKrw) && dailyEstimateKrw(destination.slug) !== null) {
    // Keep the assumption beside the fit reason. Solo is an editorial interest
    // tag; it must not silently convert this shared-room basket to a solo price.
    reasons.push(`Estimated ${DAILY_AVG[destination.slug]}/person/day: mid-range, shared room; excludes intercity travel`)
  }
  if (state.filters.includes('no-car friendly') && destination.no_car_friendliness === 'Easy') {
    reasons.push('Easy to explore without a car')
  }
  const stay = state.filters.find((tag) => tag === destination.recommended_stay)
  if (stay) reasons.push(`Recommended stay: ${stay}`)
  const matchedInterests = state.filters.filter((tag) => destination.tags.some((value) => value === tag))
  if (matchedInterests.length) reasons.push(`Matches: ${matchedInterests.join(', ')}`)
  if (reasons.length === 1) reasons.push(destination.best_for)
  return { reasons: reasons.slice(0, 3), tradeoff: destination.skip_if }
}
