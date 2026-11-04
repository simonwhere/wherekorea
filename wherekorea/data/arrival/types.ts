export interface ArrivalCard {
  slug: 'andong' | 'gyeongju' | 'jeonju'
  place: string
  placeKo: string
  station: string
  stationKo: string
  glance: { rail: string; onward: string; back: string }
  fromSeoul: string
  onward: string
  returnLocal: string
  returnStop: string
  returnSeoul: string
  check: string
  checked: string
  sources: { label: string; url: string; use: 'rail' | 'local' | 'return' }[]
}
