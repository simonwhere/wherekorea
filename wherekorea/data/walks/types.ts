export interface WalkPhoto {
  src: string
  alt: string
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
  stops: WalkStop[]
  food: { name: string; nameKo: string; detail: string }
  sources: { label: string; url: string }[]
}
