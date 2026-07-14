import type { Destination, LiveFestival, UpcomingFestival } from '@/data/types'
import { COORDS } from '@/lib/weather'
import { koreanTitleToEnglish } from '@/lib/romanize'

// TourAPI EngService2 searchFestival2 — festival signals per destination.
// Information display only — festivals never affect Best-now ranking
// (product decision 2026-07-11, docs/design-live-crowd-festival.md).
// Fallback pattern follows lib/weather.ts: any failure → empty → UI section simply absent.
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
// Requires 국문 관광정보 서비스 활용신청 (same key) — silently skipped until approved.
const BASE_KO = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2'
// 15km keeps festivals city-accurate (verified: 30km wrongly pulled an Anyang
// event onto Seoul and Suwon cards). Wide rural nodes may miss some — acceptable.
const MATCH_KM = 15

interface RawFestivalItem {
  title?: string
  eventstartdate?: string // YYYYMMDD
  eventenddate?: string   // YYYYMMDD
  mapx?: string           // lon
  mapy?: string           // lat
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

function yyyymmdd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

function fmtDate(raw: string): string {
  // '20260815' → 'Aug 15'
  if (!/^\d{8}$/.test(raw)) return raw
  const d = new Date(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)))
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
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

async function fetchService(base: string, key: string, today: string): Promise<RawFestivalItem[]> {
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
  const res = await fetch(`${base}?${params.toString()}`, {
    next: { revalidate: 86400 }, // 24h
  })
  if (!res.ok) return []
  const data = await res.json()
  const item = data?.response?.body?.items?.item
  if (item == null) return []
  return Array.isArray(item) ? item : [item]
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
async function fetchAllFestivals(key: string, today: string): Promise<NormalizedFestival[]> {
  const [en, ko] = await Promise.all([
    fetchService(BASE_EN, key, today).catch(() => []),
    fetchService(BASE_KO, key, today).catch(() => []),
  ])
  const valid = (items: RawFestivalItem[]) =>
    items.filter(
      (it) =>
        it.title && it.eventstartdate && it.eventenddate &&
        it.eventenddate! >= today && it.mapx && it.mapy &&
        isMajorFestival(it.title!)
    )
  const dupeKey = (it: RawFestivalItem) =>
    `${it.eventstartdate}-${it.eventenddate}-${Number(it.mapx).toFixed(2)},${Number(it.mapy).toFixed(2)}`

  const out = new Map<string, NormalizedFestival>()
  for (const it of valid(en)) {
    out.set(dupeKey(it), {
      title: cleanTitle(it.title!),
      start: it.eventstartdate!,
      end: it.eventenddate!,
      lat: Number(it.mapy),
      lon: Number(it.mapx),
    })
  }
  for (const it of valid(ko)) {
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
  return [...out.values()]
}

export async function fetchFestivalSignals(
  destinations: Destination[]
): Promise<FestivalSignals> {
  const out: FestivalSignals = { now: {}, upcoming: {} }
  const key = process.env.TOUR_API_KEY
  if (!key) return out

  const today = yyyymmdd(new Date())
  let items: NormalizedFestival[] = []
  try {
    items = await fetchAllFestivals(key, today)
  } catch {
    return out
  }

  for (const d of destinations) {
    const c = COORDS[d.slug]
    if (!c) continue
    const near = items
      .map((it) => ({ it, km: distanceKm(c.lat, c.lon, it.lat, it.lon) }))
      .filter((x) => Number.isFinite(x.km) && x.km <= MATCH_KM)

    const ongoing = near
      .filter((x) => x.it.start <= today)
      .sort((a, b) => (a.it.end < b.it.end ? -1 : 1)) // ending soonest first
      .slice(0, 2)
      .map((x) => ({ name: x.it.title, ends: fmtDate(x.it.end) }))
    if (ongoing.length > 0) out.now[d.slug] = ongoing

    const upcoming = near
      .filter((x) => x.it.start > today)
      .sort((a, b) => (a.it.start < b.it.start ? -1 : 1)) // soonest first
      .slice(0, 3)
      .map((x) => ({
        name: x.it.title,
        range: `${fmtDate(x.it.start)} – ${fmtDate(x.it.end)}`,
        month: Number(x.it.start.slice(4, 6)),
      }))
    if (upcoming.length > 0) out.upcoming[d.slug] = upcoming
  }
  return out
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
