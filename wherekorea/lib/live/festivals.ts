import type { Destination, LiveFestival, UpcomingFestival } from '@/data/types'
import { COORDS } from '@/lib/weather'
import { koreanTitleToEnglish } from '@/lib/romanize'
import { koreaDateKey, festivalDateLabel, festivalPhase, validFestivalCoordinates, validFestivalDate } from '@/lib/live/festival-dates'
import { logFestivalFailure, type FestivalDataStatus, type FestivalServiceStatus } from '@/lib/live/status'

// TourAPI EngService2 searchFestival2 — festival signals per destination.
// Information display only — festivals never affect Best-now ranking
// (product decision 2026-07-11, docs/design-live-crowd-festival.md).
// Existing helpers retain an empty-data fallback. The status-aware wrapper distinguishes
// unavailable feeds from a successful response with no matching festival signals.
//
// Matching strategy (verified against live API 2026-07-11):
// current-year entries ship with EMPTY areacode/sigungucode, so area filters miss them.
// Instead we fetch ALL active+upcoming festivals in ONE call and geo-match each item
// (mapx/mapy) to destinations within MATCH_KM.
//
// Two signals per destination:
//   now      — started, not yet ended ("Happening now")
//   upcoming — starts later ("Festivals ahead", for month-based planning)

const BASE_EN = 'https://apis.data.go.kr/B551011/EngService2/searchFestival2'
// Korean DB is far richer; titles are dictionary-translated + romanized.
// Requires 국문 관광정보 서비스 활용신청 (same key); a failure makes coverage partial.
const BASE_KO = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2'
// 15km keeps festivals city-accurate (verified: 30km wrongly pulled an Anyang
// event onto Seoul and Suwon cards). Wide rural nodes may miss some — acceptable.
const MATCH_KM = 15

interface RawFestivalItem {
  title?: string
  eventstartdate?: string // YYYYMMDD
  eventenddate?: string   // YYYYMMDD
  mapx?: string | number  // lon
  mapy?: string | number  // lat
}

interface FestivalServiceResult {
  items: RawFestivalItem[]
  status: FestivalServiceStatus
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function failed(reason: FestivalServiceStatus['reason'], httpStatus?: number): FestivalServiceResult {
  return { items: [], status: { state: 'unavailable', reason, ...(httpStatus === undefined ? {} : { httpStatus }) } }
}

/** TourAPI may return HTTP 200 with an error header or XML instead of JSON. */
export function parseFestivalResponse(input: unknown): FestivalServiceResult {
  if (!record(input) || !record(input.response) || !record(input.response.header)) return failed('invalid_payload')
  const code = input.response.header.resultCode
  if (code !== '0000' && code !== '00' && code !== '0' && code !== 0) {
    return failed(code === undefined ? 'invalid_payload' : 'provider_error')
  }
  const body = input.response.body
  if (!record(body)) return failed('invalid_payload')
  const total = typeof body.totalCount === 'string' && /^\d+$/.test(body.totalCount)
    ? Number(body.totalCount) : body.totalCount
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) return failed('invalid_payload')
  const raw = record(body.items) ? body.items.item : undefined
  const items = raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw]
  if (total === 0) {
    if (items.length !== 0 || (body.items !== undefined && body.items !== null && body.items !== '' && !record(body.items))) return failed('invalid_payload')
    return { items: [], status: { state: 'empty', reportedItems: 0, returnedItems: 0, rejectedItems: 0 } }
  }
  if (items.length === 0 || items.length > total) return failed('invalid_payload')
  const valid = items.filter((item): item is RawFestivalItem => record(item)
    && typeof item.title === 'string' && item.title.trim().length > 0
    && validFestivalDate(item.eventstartdate) && validFestivalDate(item.eventenddate)
    && item.eventstartdate <= item.eventenddate
    && validFestivalCoordinates(item.mapy, item.mapx))
  const rejectedItems = items.length - valid.length
  const reason = rejectedItems > 0 ? 'invalid_items' : total > items.length ? 'truncated' : undefined
  return {
    items: valid,
    status: {
      state: reason ? 'partial' : 'available',
      ...(reason ? { reason } : {}),
      reportedItems: total, returnedItems: items.length, rejectedItems,
    },
  }
}

// Keep only genuine festivals. The Korean festival DB mixes in routine programs
// that aren't destination-choice signals: palace guard-changing ceremonies,
// "상설"(permanent/standing) culture programs, and city walking/architecture tours.
// Verified against the live Seoul feed 2026-07-14: a 15km match returned 26 items,
// but half were ceremonies/tours (수문장 교대의식, 상설 전통문화행사, 건축투어…).
// Rule: require a real festival marker AND reject routine markers. Works on the
// raw title from either service (English titles carry 'Festival/Fair/Expo').
// The Korean 제(祭) suffix marks a festival by type (문화제/영화제/극제…), so the
// common families are listed explicitly — bare 제 is too ambiguous (국제, 경제).
const FESTIVAL_MARKERS = /축제|축전|문화제|영화제|음악제|예술제|문학제|무용제|미술제|국악제|합창제|극제|대제|페스타|페스티벌|페스트|페어|엑스포|박람회|비엔날레|한마당|festival|festa|expo|fair|biennale/i
const ROUTINE_MARKERS = /상설|의식|수문장|파수|봉수|교대|투어|탐방|ceremony|changing of|guard/i
function isMajorFestival(title: string): boolean {
  return FESTIVAL_MARKERS.test(title) && !ROUTINE_MARKERS.test(title)
}

export interface FestivalSignals {
  now: Record<string, LiveFestival[]>
  upcoming: Record<string, UpcomingFestival[]>
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// English titles come as "English Name (한글명)" — keep the English part for cards.
function cleanTitle(t: string): string {
  const cut = t.replace(/\s*\([^)]*[가-힣][^)]*\)\s*$/, '').trim()
  return cut.length > 0 ? cut : t
}

async function fetchService(base: string, key: string, today: string): Promise<FestivalServiceResult> {
  const params = new URLSearchParams({
    serviceKey: key,
    MobileOS: 'ETC',
    MobileApp: 'WhereKorea',
    _type: 'json',
    arrange: 'A',
    numOfRows: '400',
    pageNo: '1',
    eventStartDate: today, // API semantics: active or upcoming as of this date
  })
  try {
    const res = await fetch(`${base}?${params.toString()}`, {
      next: { revalidate: 86400 }, // 24h; checkedAt is not an upstream fetch timestamp.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return failed('http_error', res.status)
    let input: unknown
    try { input = await res.json() } catch (error) {
      return failed(error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'invalid_json')
    }
    return parseFestivalResponse(input)
  } catch (error) {
    return failed(error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'network_error')
  }
}

interface NormalizedFestival {
  title: string
  start: string
  end: string
  lat: number
  lon: number
}

// Merge both services: English titles win; Korean-only entries get
// dictionary-translation + romanization. Dedupe by dates + rounded coords.
async function fetchAllFestivals(key: string, today: string): Promise<{
  items: NormalizedFestival[]
  services: FestivalDataStatus['services']
}> {
  const [en, ko] = await Promise.all([
    fetchService(BASE_EN, key, today),
    fetchService(BASE_KO, key, today),
  ])
  logFestivalFailure('english', en.status)
  logFestivalFailure('korean', ko.status)
  const valid = (items: RawFestivalItem[]) =>
    items.filter(
      (it) =>
        it && typeof it.title === 'string' && it.title.trim() &&
        festivalPhase(it.eventstartdate, it.eventenddate, today) !== null &&
        validFestivalCoordinates(it.mapy, it.mapx) && isMajorFestival(it.title)
    )
  const dupeKey = (it: RawFestivalItem) =>
    `${it.eventstartdate}-${it.eventenddate}-${Number(it.mapx).toFixed(2)},${Number(it.mapy).toFixed(2)}`

  const out = new Map<string, NormalizedFestival>()
  for (const it of valid(en.items)) {
    out.set(dupeKey(it), {
      title: cleanTitle(it.title!),
      start: it.eventstartdate!,
      end: it.eventenddate!,
      lat: Number(it.mapy),
      lon: Number(it.mapx),
    })
  }
  for (const it of valid(ko.items)) {
    const k = dupeKey(it)
    if (out.has(k)) continue // English version exists — prefer it
    const title = koreanTitleToEnglish(it.title!)
    if (!title) continue // conversion failed the readability gate — skip
    out.set(k, {
      title,
      start: it.eventstartdate!,
      end: it.eventenddate!,
      lat: Number(it.mapy),
      lon: Number(it.mapx),
    })
  }
  return { items: [...out.values()], services: { english: en.status, korean: ko.status } }
}

export async function fetchFestivalData(
  destinations: Destination[]
): Promise<{ data: FestivalSignals; status: FestivalDataStatus }> {
  const out: FestivalSignals = { now: {}, upcoming: {} }
  const status: FestivalDataStatus = {
    state: 'unconfigured', checkedAt: new Date().toISOString(), cacheSeconds: 86400,
    upstreamUpdatedAt: null, scheduleVerified: false, services: {}, matchedDestinations: 0,
  }
  const key = process.env.TOUR_API_KEY?.trim()
  if (!key) return { data: out, status }

  const today = koreaDateKey()
  const { items, services } = await fetchAllFestivals(key, today)
  status.services = services

  for (const d of destinations) {
    const c = Object.prototype.hasOwnProperty.call(COORDS, d.slug) ? COORDS[d.slug] : undefined
    if (!c) continue
    const near = items
      .map((it) => ({ it, km: distanceKm(c.lat, c.lon, it.lat, it.lon) }))
      .filter((x) => Number.isFinite(x.km) && x.km <= MATCH_KM)

    const ongoing = near
      .filter((x) => x.it.start <= today)
      .sort((a, b) => (a.it.end < b.it.end ? -1 : 1)) // ending soonest first
      .slice(0, 2)
      .map((x) => ({ name: x.it.title, ends: festivalDateLabel(x.it.end) }))
    if (ongoing.length > 0) out.now[d.slug] = ongoing

    const upcoming = near
      .filter((x) => x.it.start > today)
      .sort((a, b) => (a.it.start < b.it.start ? -1 : 1)) // soonest first
      .slice(0, 3)
      .map((x) => ({
        name: x.it.title,
        range: `${festivalDateLabel(x.it.start)} – ${festivalDateLabel(x.it.end)}`,
        month: Number(x.it.start.slice(4, 6)),
      }))
    if (upcoming.length > 0) out.upcoming[d.slug] = upcoming
  }
  status.matchedDestinations = new Set([...Object.keys(out.now), ...Object.keys(out.upcoming)]).size
  const sourceStates = Object.values(services).map((service) => service.state)
  status.state = sourceStates.every((state) => state === 'unavailable') ? 'unavailable'
    : sourceStates.some((state) => state === 'unavailable' || state === 'partial') ? 'partial'
      : status.matchedDestinations === 0 ? 'empty' : 'available'
  return { data: out, status }
}

// Back-compatible rich helper for detail pages and the weekly post.
export async function fetchFestivalSignals(destinations: Destination[]): Promise<FestivalSignals> {
  return (await fetchFestivalData(destinations)).data
}

export async function fetchFestivalDataForAll(destinations: Destination[]): Promise<{
  data: Record<string, LiveFestival[]>; status: FestivalDataStatus
}> {
  const result = await fetchFestivalData(destinations)
  return { data: result.data.now, status: result.status }
}

// Back-compat helper for the homepage (ongoing only)
export async function fetchFestivalsForAll(
  destinations: Destination[]
): Promise<Record<string, LiveFestival[]>> {
  const signals = await fetchFestivalSignals(destinations)
  return signals.now
}

export function applyFestivals(
  destinations: Destination[],
  map: Record<string, LiveFestival[]>
): Destination[] {
  return destinations.map((d) => {
    const f = map[d.slug]
    if (!f || f.length === 0) return d
    return { ...d, live_festivals: f }
  })
}
