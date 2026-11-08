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

type BreakfastPin = { venue: string; venueKo: string; stop: number }
type SearchableWalk = NamedPlace & { aliases?: string[]; food: NamedPlace; stops: NamedPlace[]; breakfast?: BreakfastPin }

function matchesBreakfast(breakfast: BreakfastPin | undefined, text: string) {
  return breakfast && [breakfast.venue, breakfast.venueKo].some(name => name.toLowerCase().includes(text))
}

export function searchedCityWalk<T extends SearchableWalk>(walks: T[], query: string): T | undefined {
  if (walks.length === 1) return walks[0]
  const text = query.trim().toLowerCase()
  if (text.length < 2) return
  const exact = walks.find(walk => [walk.name, walk.nameKo].some(name => name.toLowerCase() === text))
  if (exact) return exact
  const matches = walks.filter(walk => matchesBreakfast(walk.breakfast, text) || walk.aliases?.some(alias => alias.toLowerCase().includes(text)) || [walk, walk.food, ...walk.stops].some(place =>
    [place.name, place.nameKo].some(name => name.toLowerCase().includes(text))))
  if (matches.length === 1) return matches[0]
  // Two walks may both reach the exact place the traveller searched for.
  if (matches.length && matches.every(walk => walk.stops.some(stop => [stop.name.toLowerCase(), stop.nameKo].includes(text)))) return matches[0]
}

/** A place search opens that stop. A neighbourhood or ambiguous search opens the walk. */
export function searchedWalkStop(walk: NamedPlace & { stops: NamedPlace[]; food?: NamedPlace & {stop?: number}; breakfast?: BreakfastPin }, query: string): number | undefined {
  const text = query.trim().toLowerCase()
  if (text.length < 2 || [walk.name.toLowerCase(), walk.nameKo].includes(text)) return
  const matchesPlace = (place: NamedPlace) => [place.name.toLowerCase(), place.nameKo].some(name => name.includes(text))
  if (walk.breakfast && [walk.breakfast.venue.toLowerCase(), walk.breakfast.venueKo].includes(text)) return walk.breakfast.stop
  const exact = walk.stops.findIndex(place => [place.name.toLowerCase(), place.nameKo].includes(text))
  if (exact >= 0) return exact + 1
  if (walk.food?.stop && [walk.food.name.toLowerCase(), walk.food.nameKo].includes(text)) return walk.food.stop
  const index = walk.stops.findIndex(matchesPlace)
  if (index >= 0 && !walk.stops.slice(index + 1).some(matchesPlace)) return index + 1
}
