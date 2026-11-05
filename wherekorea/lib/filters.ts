import type { Destination, FilterTag, VibeTag } from '@/data/types'

function matchesTag(destination: Destination, tag: FilterTag): boolean {
  // Stay filters match the recommended_stay field directly
  if (tag === '1–2 days' || tag === '3 days' || tag === '4+ days') {
    return destination.recommended_stay === tag
  }
  // No-car friendly matches Easy no_car_friendliness
  if (tag === 'no-car friendly') {
    return destination.no_car_friendliness === 'Easy'
  }
  // All other filters match against the destination's vibe tags
  return destination.tags.includes(tag as VibeTag)
}

function matchesSearch(d: Destination, searchQuery: string): boolean {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return true
  const searchable = [
    d.name,
    d.card_vibe,
    d.vibe,
    d.hero_summary,
    d.best_for,
    d.food,
    d.seasonal_weather_context,
    ...(d.hotspots ?? []).map(place => place.name),
    ...(d.search_names ?? []),
    ...d.tags,
  ]
  return searchable.some((value) => value.toLowerCase().includes(q))
}

const FILTER_GROUPS: FilterTag[][] = [
  ['coastal', 'history / traditional', 'city', 'nature', 'mountain / hiking'],
  // Mobility is a constraint, not another travel-party preference. Selecting
  // Couples or Solo must never reintroduce destinations that need a car.
  ['no-car friendly'],
  ['couple', 'solo'],
  ['1–2 days', '3 days', '4+ days'],
]

// OR within a group, AND across groups. Example: Coast + Nature broadens the
// place type; adding No Car Needed narrows those results to accessible places.
export function filterDestinations(
  destinations: Destination[],
  activeTags: FilterTag[],
  searchQuery: string
): Destination[] {
  return destinations.filter((d) => {
    if (!matchesSearch(d, searchQuery)) return false
    if (activeTags.length === 0) return true
    return FILTER_GROUPS.every((group) => {
      const activeInGroup = activeTags.filter((tag) => group.includes(tag))
      return activeInGroup.length === 0 || activeInGroup.some((tag) => matchesTag(d, tag))
    })
  })
}
