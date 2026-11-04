import type { ArrivalSlug } from '@/lib/arrival-routes'

export interface ArrivalCard {
  slug: ArrivalSlug
  mainMode: 'rail' | 'coach' | 'flight'
  place: string
  placeKo: string
  station: string
  stationKo: string
  glance: { fromSeoul: string; onward: string; back: string }
  fromSeoul: string
  onward: string
  returnLocal: string
  returnStop: string
  returnSeoul: string
  check: string
  checked: string
  sources: { label: string; url: string; use: 'intercity' | 'local' | 'return' }[]
}
