export type LegacyBudgetComponents = {
  lodgingPerPersonKrw: number
  foodKrw: number
  localTransportKrw: number
  admissionsKrw: number
}

export type BudgetEvidenceSource = {
  id: string
  label: string
  url: string
  publisher: string
  /** The period described by the source, not the day this page was visited. */
  sourcePeriod: { start: string; end: string } | null
  checkedAt: string
  priceType: 'regional-food-average' | 'lodging-market-trend' | 'published-room-rate'
  status: 'recorded-reference' | 'published-reference' | 'unavailable'
  scope: string
  /** None of these references replaces or re-verifies the published daily amount. */
  referenceOnly: true
  publishedRoomRatesKrw?: readonly number[]
}

export type BudgetEvidence = {
  publishedDailyKrw: number
  /** Preserved from trust.budget.last_verified; not reset by a source-page visit. */
  reviewedAt: string
  reviewAttemptAt: string
  /** Earlier documented estimates only. Missing breakdowns are never back-calculated. */
  legacyComponents: LegacyBudgetComponents | null
  foodRegions: readonly string[]
  note: string
  componentNote: string
  sources: readonly BudgetEvidenceSource[]
}

const RECORDED_FOOD: BudgetEvidenceSource = {
  id: 'chamgagyeok-recorded-2026-06',
  label: 'Regional restaurant prices: June 2026 record',
  url: 'https://www.price.go.kr/tprice/portal/servicepriceinfo/dineoutprice/dineOutPriceList.do',
  publisher: 'Korea Consumer Agency',
  sourcePeriod: { start: '2026-06-01', end: '2026-06-30' },
  checkedAt: '2026-07-18',
  priceType: 'regional-food-average',
  status: 'recorded-reference',
  scope: 'A June 2026 regional menu-price table was transcribed in the project record on July 18. It is not a city-specific daily meal total and was not re-fetched in the October review.',
  referenceOnly: true,
}

const LATEST_FOOD_REFERENCE: BudgetEvidenceSource = {
  id: 'chamgagyeok-observed-2026-08',
  label: 'Regional restaurant prices: August 2026',
  url: 'https://www.price.go.kr/tprice/portal/pricetrend/dineoutpricetrend/getDinerOutTrend.do',
  publisher: 'Korea Consumer Agency',
  sourcePeriod: { start: '2026-08-01', end: '2026-08-31' },
  checkedAt: '2026-10-08',
  priceType: 'regional-food-average',
  status: 'published-reference',
  scope: 'The live search form returned the August 2026 regional table; kimchi-stew meal and bibimbap averages were recorded for the relevant regions. These provisional menu prices are not daily meal totals. Shop, portion and quality differences limit direct comparisons. The link requires selecting the month again.',
  referenceOnly: true,
}

const LODGING_TREND: BudgetEvidenceSource = {
  id: 'yanolja-lodging-2026-q2',
  label: 'Korean lodging industry: second quarter 2026',
  url: 'https://www.yanolja-research.com/media/view/871?lang=ko',
  publisher: 'Yanolja Research',
  sourcePeriod: { start: '2026-04-01', end: '2026-06-30' },
  checkedAt: '2026-10-08',
  priceType: 'lodging-market-trend',
  status: 'published-reference',
  scope: 'Published August 7, 2026. Changes in lodging-sector performance, not a city-specific mid-range room price or a quote for a travel date.',
  referenceOnly: true,
}

const BUSAN_ROOM: BudgetEvidenceSource = {
  id: 'toyoko-busan-jungang-twin',
  label: 'Busan: a published twin-room rate',
  url: 'https://www.toyoko-inn.co.kr/view/viewLink.do?page=jungangstation/homepage/ENG/accommodation/Twin',
  publisher: 'Toyoko Inn Busan Jungang Station',
  sourcePeriod: null,
  checkedAt: '2026-10-08',
  priceType: 'published-room-rate',
  status: 'published-reference',
  scope: 'The hotel lists a twin room for two at ₩84,000, with ₩79,800 also shown in parentheses. The effective period, all rate conditions and date-specific availability were not established. One room listing is not a city average.',
  referenceOnly: true,
  publishedRoomRatesKrw: [84000, 79800],
}

const JEONJU_ROOM: BudgetEvidenceSource = {
  id: 'jeonju-city-geurim-rooms',
  label: 'Jeonju: a hanok guesthouse rate listing',
  url: 'https://tour.jeonju.go.kr/board/view.jeonju?boardId=BBS_0000004&dataSid=104&menuCd=DOM_000000104001000000&orderBy=DATA_TITLE+ASC&paging=ok&searchType=DATA_TITLE&startPage=1',
  publisher: 'Jeonju City tourism portal',
  sourcePeriod: null,
  checkedAt: '2026-10-08',
  priceType: 'published-room-rate',
  status: 'published-reference',
  scope: 'The listing for Geurim shows several two-person rooms at ₩80,000. Its effective price period is not stated and older local construction information remains on the page. This is not a current booking quote or city average.',
  referenceOnly: true,
  publishedRoomRatesKrw: [80000],
}

const NAMHAE_ROOM: BudgetEvidenceSource = {
  id: 'namhae-county-haemaji-listing',
  label: 'Namhae: a seasonal guesthouse rate listing',
  url: 'https://www.namhae.go.kr/tour/00513.web?xposition=34.7831598282806&yposition=128.049212107972',
  publisher: 'Namhae County tourism portal',
  sourcePeriod: null,
  checkedAt: '2026-10-08',
  priceType: 'published-room-rate',
  status: 'published-reference',
  scope: 'The Haemaji guesthouse entry lists rates from ₩50,000 to ₩80,000 by season and weekday. Base occupancy, room standard and the effective year are not clear. These rates cannot establish a mid-range city average.',
  referenceOnly: true,
  publishedRoomRatesKrw: [50000, 60000, 70000, 80000],
}

const NOTE = 'Approximate daily cost per person: a mid-range room shared by two, meals, local transport and light admissions. Travel between cities is extra.'

function components(lodging: number, food: number, transport: number, admissions: number): LegacyBudgetComponents {
  // These are the existing v1 table's values in thousands of won, not new observations.
  return {
    lodgingPerPersonKrw: lodging * 1000,
    foodKrw: food * 1000,
    localTransportKrw: transport * 1000,
    admissionsKrw: admissions * 1000,
  }
}

function record(
  publishedDailyKrw: number,
  reviewedAt: string,
  foodRegions: readonly string[],
  legacyComponents: LegacyBudgetComponents | null,
  references: readonly BudgetEvidenceSource[] = [],
): BudgetEvidence {
  return {
    publishedDailyKrw,
    reviewedAt,
    reviewAttemptAt: '2026-10-08',
    legacyComponents,
    foodRegions,
    note: NOTE,
    componentNote: legacyComponents
      ? 'The amounts below are earlier estimates, not current prices. The daily figure is rounded.'
      : 'A separate cost breakdown has not been recorded for this daily estimate.',
    sources: [RECORDED_FOOD, LATEST_FOOD_REFERENCE, LODGING_TREND, ...references],
  }
}

// Published numbers and metric-review dates are copied unchanged from the existing
// dataset. v2 remains a proposal. In particular, these are not October price quotes.
export const BUDGET_EVIDENCE: Readonly<Record<string, BudgetEvidence>> = {
  seoul: record(145000, '2026-06-28', ['Seoul'], components(65, 55, 10, 15)),
  busan: record(125000, '2026-06-28', ['Busan'], components(52, 48, 10, 13), [BUSAN_ROOM]),
  jeju: record(165000, '2026-06-28', ['Jeju'], components(75, 58, 12, 18)),
  gyeongju: record(115000, '2026-06-28', ['North Gyeongsang'], components(48, 45, 8, 15)),
  jeonju: record(110000, '2026-06-28', ['North Jeolla'], components(48, 45, 8, 12), [JEONJU_ROOM]),
  gangneung: record(130000, '2026-06-28', ['Gangwon'], components(58, 52, 10, 12)),
  sokcho: record(120000, '2026-06-28', ['Gangwon'], components(52, 48, 9, 13)),
  tongyeong: record(110000, '2026-06-28', ['South Gyeongsang'], components(45, 45, 8, 12)),
  namhae: record(105000, '2026-06-28', ['South Gyeongsang'], components(45, 42, 9, 10), [NAMHAE_ROOM]),
  jirisan: record(100000, '2026-06-28', ['South Jeolla', 'North Jeolla', 'South Gyeongsang'], components(40, 40, 8, 8)),
  yeosu: record(115000, '2026-07-11', ['South Jeolla'], null),
  andong: record(100000, '2026-07-11', ['North Gyeongsang'], null),
  suwon: record(110000, '2026-07-11', ['Gyeonggi'], null),
  chuncheon: record(105000, '2026-07-11', ['Gangwon'], null),
  'damyang-boseong': record(100000, '2026-07-11', ['South Jeolla'], null),
}

export function getBudgetEvidence(slug: string): BudgetEvidence | null {
  return Object.hasOwn(BUDGET_EVIDENCE, slug) ? BUDGET_EVIDENCE[slug] : null
}

function realDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null
}

/** Structural checking only; this does not verify the source's prices or availability. */
export function validateBudgetEvidence(
  evidence: BudgetEvidence,
  today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
): string[] {
  const errors: string[] = []
  const now = realDay(today)
  if (now === null) errors.push('Invalid comparison date.')
  const reviewed = realDay(evidence.reviewedAt)
  const attempted = realDay(evidence.reviewAttemptAt)
  if (reviewed === null || attempted === null || reviewed > attempted || (now !== null && attempted > now)) errors.push('Invalid review dates.')
  if (!Number.isSafeInteger(evidence.publishedDailyKrw) || evidence.publishedDailyKrw <= 0) errors.push('Invalid daily amount.')
  if (evidence.legacyComponents && Object.values(evidence.legacyComponents).some((amount) => !Number.isSafeInteger(amount) || amount < 0)) errors.push('Invalid component amount.')
  const ids = new Set<string>()
  for (const source of evidence.sources) {
    if (ids.has(source.id)) errors.push('Duplicate source identity.')
    ids.add(source.id)
    const checked = realDay(source.checkedAt)
    if (checked === null || (attempted !== null && checked > attempted) || (now !== null && checked > now)) errors.push('Invalid source check date.')
    if (source.sourcePeriod) {
      const start = realDay(source.sourcePeriod.start)
      const end = realDay(source.sourcePeriod.end)
      if (start === null || end === null || start > end || (checked !== null && end > checked)) errors.push('Invalid source period.')
    }
    try {
      const url = new URL(source.url)
      if (url.protocol !== 'https:' || url.username || url.password) errors.push('Invalid source URL.')
    } catch {
      errors.push('Invalid source URL.')
    }
    if (!source.referenceOnly) errors.push('References must not replace the daily estimate.')
  }
  return errors
}
