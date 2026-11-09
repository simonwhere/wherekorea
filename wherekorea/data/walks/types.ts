export interface WalkPhoto {
  src: string
  alt: string
  caption?: string
  credit: string
  license: string
  source: string
  licenseUrl: string
}

export interface WalkStop {
  name: string
  nameKo: string
  lat: number
  lng: number
  walk: string
  what: string
  photo?: WalkPhoto
}

export interface WalkGuide {
  slug: string
  city: string
  name: string
  nameKo: string
  intro: string
  cardRoute: string
  aliases?: string[]
  stops: WalkStop[]
  food: { name: string; nameKo: string; detail: string; stop?: number }
  breakfast?: WalkBreakfast
  sources: { label: string; url: string }[]
}

export interface WalkBreakfast {
  venue: string
  venueKo: string
  hours: string
  detail: string
  address: string
  checked: string
  source: { label: string; url: string }
  stop: number
  ordering?: {
    summary: string
    phone: string
    questionKo: string
    pickupUrl?: string
  }
}
