// Controlled vocabulary enums — values must match data-policy.md exactly

export type RecommendedStay = '1–2 days' | '3 days' | '4+ days'
export type NoCar = 'Easy' | 'Okay' | 'Hard'
export type CrowdFriction = 'Low' | 'Medium' | 'High'
export type BudgetLevel = '$' | '$$' | '$$$'

// Vibe tags live on Destination.tags — used for card display and filter matching
export type VibeTag =
  | 'coastal'
  | 'history / traditional'
  | 'city'
  | 'nature'
  | 'mountain / hiking'
  | 'couple'
  | 'solo'

// All 11 filter options shown in the filter strip
// Stay filters and no-car friendly are derived from other fields in filter logic
export type FilterTag =
  | VibeTag
  | '1–2 days'
  | '3 days'
  | '4+ days'
  | 'no-car friendly'

export const FILTER_TAGS: FilterTag[] = [
  'coastal',
  'history / traditional',
  'city',
  'nature',
  'mountain / hiking',
  'no-car friendly',
  'couple',
  'solo',
  '1–2 days',
  '3 days',
  '4+ days',
]

export interface TravelTime {
  from_seoul: string
  from_incheon_airport: string
  from_busan_station: string
}

export interface DetailBudget {
  low: string
  mid: string
  high: string
  notes: string
}

export interface UsefulLink {
  label: string
  url: string
}

export interface DestinationImage {
  src: string
  alt: string
  credit?: string
}

export interface Destination {
  // identity
  slug: string
  name: string

  // card image
  image: DestinationImage

  // card fields (all required on every card)
  card_vibe: string        // short label for card display (2–5 words)
  vibe: string             // full vibe copy for detail/editorial use
  recommended_stay: RecommendedStay
  live_weather_snapshot: string
  live_weather_current?: number  // current temp °C — set at runtime by weather fetch
  live_weather_icon?: string     // WMO emoji — set at runtime
  card_budget_level: BudgetLevel
  tags: VibeTag[]

  // detail page fields
  hero_summary: string
  why: string
  best_for: string
  skip_if: string
  travel_time: TravelTime
  no_car_friendliness: NoCar
  local_movement: string
  car_recommended: boolean
  seasonal_weather_context: string
  food: string
  detail_budget: DetailBudget
  crowd_friction: CrowdFriction
  crowd_notes: string
  insider_tips: string[]
  similar_destinations: string[] // slugs of other destinations
  useful_links: UsefulLink[]
}
