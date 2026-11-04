import { compareSlugsFromParam, sanitizeCompareList, parseCompareDeparture, type CompareDeparture } from '@/lib/compare-state'
import { withBrowseContext } from '@/lib/browse-state'

/** Use the actual URL, including native optimistic updates, not an old server prop. */
export function comparisonFromSearch(search: string, known: readonly string[]): string[] | null {
  const params = new URLSearchParams(search)
  const entries = params.getAll('destinations')
  return compareSlugsFromParam(entries.length === 0 ? undefined : entries.length === 1 ? entries[0] : entries, known)
}

export function comparisonDepartureFromSearch(search: string): CompareDeparture {
  const entries = new URLSearchParams(search).getAll('from')
  return parseCompareDeparture(entries.length === 1 ? entries[0] : undefined)
}

/** Keep departure on comparison URLs only, with the same validated browsing context. */
export function comparisonHref(slugs: readonly string[] | null, search: string, departure?: CompareDeparture): string {
  const params = new URLSearchParams()
  // null retains the bare-route restoration contract; [] is intentionally empty.
  if (slugs !== null) params.set('destinations', slugs.join(','))
  const from = departure === undefined ? comparisonDepartureFromSearch(search) : parseCompareDeparture(departure)
  if (from !== 'seoul') params.set('from', from)
  return withBrowseContext(`/compare?${params.toString()}`, search)
}

export function comparisonAfterRemoval(search: string, saved: readonly string[], slug: string, known: readonly string[]) {
  const current = comparisonFromSearch(search, known) ?? sanitizeCompareList(saved, known)
  const slugs = current.filter((item) => item !== slug)
  return { slugs, href: comparisonHref(slugs, search) }
}

export type CompareSyncAction =
  | { kind: 'none'; key: string | null | undefined }
  | { kind: 'replace'; key: string; slugs: string[] }
  | { kind: 'restore'; key: null; slugs: string[] }

/** The remembered key is an acknowledgement, not a second selection state. */
export function compareSyncAction(
  urlSelection: string[] | null,
  previousKey: string | null | undefined,
  isHydrated: boolean,
  saved: readonly string[],
): CompareSyncAction {
  if (!isHydrated) return { kind: 'none', key: previousKey }
  if (urlSelection !== null) {
    const key = urlSelection.join(',')
    return key === previousKey ? { kind: 'none', key } : { kind: 'replace', key, slugs: urlSelection }
  }
  return saved.length ? { kind: 'restore', key: null, slugs: [...saved] } : { kind: 'none', key: null }
}
