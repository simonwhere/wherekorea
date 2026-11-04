import type { TravelTime } from '@/data/types'

/** Display existing route anchors; this is not a discovery filter or trip origin. */
export const COMPARE_DEPARTURES = [
  { value: 'seoul', label: 'Seoul', route: 'from_seoul' },
  { value: 'incheon', label: 'Incheon Airport', route: 'from_incheon_airport' },
  { value: 'busan', label: 'Busan Station', route: 'from_busan_station' },
] as const satisfies readonly { value: string; label: string; route: keyof TravelTime }[]

export type CompareDeparture = typeof COMPARE_DEPARTURES[number]['value']

export function parseCompareDeparture(value: unknown): CompareDeparture {
  return COMPARE_DEPARTURES.find((option) => option.value === value)?.value ?? 'seoul'
}

/** Untrusted storage and URL input share the same destination validation. */
export function sanitizeCompareList(value: unknown, validSlugs: readonly string[]): string[] {
  if (!Array.isArray(value)) return []
  const known = new Set(validSlugs)
  return [...new Set(value.filter((slug): slug is string => typeof slug === 'string' && known.has(slug)))].slice(0, 3)
}

/** null means no URL instruction; [] means an explicitly empty/invalid selection. */
export function compareSlugsFromParam(value: unknown, validSlugs: readonly string[]): string[] | null {
  if (value === undefined || value === null) return null
  return sanitizeCompareList(typeof value === 'string' ? value.split(',') : [], validSlugs)
}
