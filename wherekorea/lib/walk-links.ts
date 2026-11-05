/** Public stop numbers are one-based and follow the published walking order. */
export function walkStopNumber(value: unknown, count: number): number | undefined {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return
  const stop = Number(value)
  return Number.isSafeInteger(stop) && stop <= count ? stop : undefined
}

export function walkStopPath(slug: string, stop: number): string {
  return `/walks/${slug}?stop=${stop}`
}

type NamedPlace = { name: string; nameKo: string }

/** A place search opens that stop. A neighbourhood or ambiguous search opens the walk. */
export function searchedWalkStop(walk: NamedPlace & { stops: NamedPlace[] }, query: string): number | undefined {
  const text = query.trim().toLowerCase()
  if (text.length < 2 || [walk.name.toLowerCase(), walk.nameKo].includes(text)) return
  const matchesPlace = (place: NamedPlace) => [place.name.toLowerCase(), place.nameKo].some(name => name.includes(text))
  const index = walk.stops.findIndex(matchesPlace)
  if (index >= 0 && !walk.stops.slice(index + 1).some(matchesPlace)) return index + 1
}
