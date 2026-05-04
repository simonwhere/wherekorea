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

// OR logic: a destination matches if it satisfies ANY active filter tag.
// An empty filter set returns all destinations.
export function filterDestinations(
  destinations: Destination[],
  activeTags: FilterTag[],
  searchQuery: string
): Destination[] {
  return destinations.filter((d) => {
    if (
      searchQuery.trim() &&
      !d.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    ) {
      return false
    }
    if (activeTags.length === 0) return true
    return activeTags.some((tag) => matchesTag(d, tag))
  })
}
