import type { Destination } from '@/data/types'
import type { SignatureEvent } from '@/data/signature-events'
import { browseHref, parseBrowseState, type BrowseState } from '@/lib/browse-state'
import { rankDestinations } from '@/lib/recommendation'
import { seasonFit } from '@/lib/best-now'

export const TIMING_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function timingView(destinations: Destination[], params: URLSearchParams, fallbackMonth?: number) {
  const browse = parseBrowseState(params, fallbackMonth)
  // This page is a seasonal comparison, even if reached from Here now. It does
  // not fetch or imply a forecast; the incoming mode still travels with links.
  const visible = rankDestinations(destinations, { ...browse, mode: 'plan' })
  return { browse, visible }
}

export function timingMonthHref(browse: BrowseState, month: number, contextHref = '/when-to-go'): string {
  const selected = Number.isInteger(month) && month >= 1 && month <= 12 ? month : browse.month
  return browseHref({ ...browse, month: selected, mode: 'plan' }, contextHref)
}

export function timingMonthStatus(destination: Destination, month: number): 'best' | 'shoulder' | 'off' {
  const fit = seasonFit(destination, month)
  return fit === 35 ? 'best' : fit === 18 ? 'shoulder' : 'off'
}

export function timingCellLabel(destination: Destination, month: number, selectedMonth?: number): string {
  const status = timingMonthStatus(destination, month)
  const fit = status === 'best' ? 'recommended month' : status === 'shoulder' ? 'next to a recommended month' : 'outside recommended months'
  return `${TIMING_MONTHS[month - 1]}: ${fit}${destination.crowd_peak_months.includes(month) ? '; usual peak period, not live crowd data' : ''}${month === selectedMonth ? '; selected travel month' : ''}`
}

export function signatureEventsForMonth(events: SignatureEvent[], month: number, allowedCities: string[]): SignatureEvent[] {
  if (!Number.isInteger(month) || month < 1 || month > 12) return []
  const allowed = new Set(allowedCities)
  return events.filter((event) => allowed.has(event.city) && event.months.includes(month))
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
}

/** A seed contains no event year or confirmed dates. Never promote it to a schedule. */
export function signatureTimingLabel(event: SignatureEvent): string {
  const months = [...new Set(event.months)].filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
  if (months.length === 0) return 'Typical timing not recorded'
  if (months.length === 12) return 'Typical pattern: year-round'
  return `Typical months: ${months.map((month) => TIMING_MONTHS[month - 1].slice(0, 3)).join(', ')}`
}
