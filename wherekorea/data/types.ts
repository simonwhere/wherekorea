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

// Trust metadata — see data-policy.md §"Trust metadata". Structure now, UI later.
export type MetricSource = 'official' | 'estimate' | 'api' | 'seed'
export type Confidence = 'high' | 'medium' | 'low'

export interface MetricMeta {
  source: MetricSource
  confidence: Confidence
  last_verified: string   // ISO date, e.g. '2026-06-28'
}

export interface DestinationImage {
  src: string
  alt: string
  credit?: string
}

// Live festival signal — information display only, never a ranking input.
export interface LiveFestival {
  name: string
  ends: string // formatted end date, e.g. 'Aug 15'
}

export interface UpcomingFestival {
  name: string
  range: string // formatted date range, e.g. 'Sep 24 – Oct 4'
  month: number // start month 1–12, for timing-strip alignment
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
  live_festivals?: LiveFestival[] // ongoing now — set at runtime by TourAPI fetch, info only
  live_festivals_upcoming?: UpcomingFestival[] // starting later — runtime, info only
  card_budget_level: BudgetLevel
  tags: VibeTag[]

  // Best-now ranking inputs — see docs/best-now-ranking.md (v2, LOCKED)
  base_appeal: number    // 1–10 editorial, year-round draw strength
  best_months: number[]  // months 1–12 when it's genuinely good to visit

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
  crowd_peak_months: number[]   // months 1–12 when crowding spikes (hybrid model)
  crowd_notes: string
  insider_tips: string[]
  similar_destinations: string[] // slugs of other destinations
  useful_links: UsefulLink[]
  trust?: {
    budget?: MetricMeta
    crowd?: MetricMeta
  }
}
