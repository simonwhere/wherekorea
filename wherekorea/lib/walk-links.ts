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

type SearchableWalk = NamedPlace & { aliases?: string[]; food: NamedPlace; stops: NamedPlace[] }

export function searchedCityWalk<T extends SearchableWalk>(walks: T[], query: string): T | undefined {
  if (walks.length === 1) return walks[0]
  const text = query.trim().toLowerCase()
  if (text.length < 2) return
  const matches = walks.filter(walk => walk.aliases?.some(alias => alias.toLowerCase().includes(text)) || [walk, walk.food, ...walk.stops].some(place =>
    [place.name, place.nameKo].some(name => name.toLowerCase().includes(text))))
  if (matches.length === 1) return matches[0]
}

/** A place search opens that stop. A neighbourhood or ambiguous search opens the walk. */
export function searchedWalkStop(walk: NamedPlace & { stops: NamedPlace[]; food?: NamedPlace & {stop?: number} }, query: string): number | undefined {
  const text = query.trim().toLowerCase()
  if (text.length < 2 || [walk.name.toLowerCase(), walk.nameKo].includes(text)) return
  const matchesPlace = (place: NamedPlace) => [place.name.toLowerCase(), place.nameKo].some(name => name.includes(text))
  if (walk.food?.stop && [walk.food.name.toLowerCase(), walk.food.nameKo].includes(text)) return walk.food.stop
  const index = walk.stops.findIndex(matchesPlace)
  if (index >= 0 && !walk.stops.slice(index + 1).some(matchesPlace)) return index + 1
}
