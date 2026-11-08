import { destinations } from '@/data/destinations'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import type { Destination } from '@/data/types'
import { SIGNATURE_EVENTS, signatureEventSearchNames } from '@/data/signature-events'
import { walks } from '@/data/walks'
import type { CardFestivalLink } from '@/lib/festival-search'

export const cardFestivalLinks: CardFestivalLink[] = SIGNATURE_EVENTS.flatMap(({ city, name, official }) =>
  official ? [{ city, name, nameKo: official.korean, anchor: official.anchor, aliases: official.aliases ?? [] }] : [])

// Build on the server so the filter only receives names, not photo credits or full guides.
export const searchableDestinations: Destination[] = destinations.map(destination => {
  const names = new Set(destination.search_names)
  names.add(KOREAN_NAMES[destination.slug])
  for (const walk of walks.filter(walk => walk.city === destination.slug)) {
    for (const alias of walk.aliases ?? []) names.add(alias)
    if (walk.breakfast) {
      names.add(walk.breakfast.venue)
      names.add(walk.breakfast.venueKo)
    }
    for (const place of [walk, walk.food, ...walk.stops]) {
      names.add(place.name)
      names.add(place.nameKo)
    }
  }
  for (const name of signatureEventSearchNames(destination.slug)) names.add(name)
  return { ...destination, search_names: [...names] }
})
