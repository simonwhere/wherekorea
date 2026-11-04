import { getBudgetEvidence } from '@/data/budget-evidence'

export type RegionalFoodPrice = {
  regionLabel: string
  sourceKoreanLabel: string
  kimchiStewKrw: number
  bibimbapKrw: number
}

export type FoodPriceReference = {
  sourceMonth: '2026-08'
  sourceMonthLabel: 'Aug 2026'
  checkedAt: '2026-10-08'
  sourceUrl: string
  publisher: string
  dataProvider: string
  originalSource: string
  unit: 'KRW'
  portion: 'one meal per person'
  provisional: true
  regionLabel: string
  regionLabels: readonly string[]
  sourceKoreanLabels: readonly string[]
  /** Raw regional observations, retained even when the displayed reference is a range. */
  regions: readonly RegionalFoodPrice[]
  meals: readonly {
    id: 'kimchi-stew' | 'bibimbap'
    label: string
    minimumKrw: number
    maximumKrw: number
  }[]
  note: string
}

// Observed via the KCA monthly / regional search form on 2026-10-08:
// 2026-08, all menu items; result heading "2026-08월" and table named
// "외식비 품목별 지역별 가격 목록". The POST result path getDineAreaTrend.do
// does not preserve the chosen month when opened directly. Link to the search form.
// These are two published menu averages, not new daily food-budget estimates.
export const REGIONAL_FOOD_PRICES: Readonly<Record<string, RegionalFoodPrice>> = {
  Seoul: { regionLabel: 'Seoul', sourceKoreanLabel: '서울', kimchiStewKrw: 8769, bibimbapKrw: 11923 },
  Busan: { regionLabel: 'Busan', sourceKoreanLabel: '부산', kimchiStewKrw: 8429, bibimbapKrw: 9686 },
  Gyeonggi: { regionLabel: 'Gyeonggi', sourceKoreanLabel: '경기', kimchiStewKrw: 8841, bibimbapKrw: 9945 },
  Gangwon: { regionLabel: 'Gangwon', sourceKoreanLabel: '강원', kimchiStewKrw: 9000, bibimbapKrw: 10444 },
  'North Jeolla': { regionLabel: 'North Jeolla', sourceKoreanLabel: '전북', kimchiStewKrw: 9550, bibimbapKrw: 12100 },
  'South Jeolla': { regionLabel: 'South Jeolla', sourceKoreanLabel: '(구)전남', kimchiStewKrw: 8278, bibimbapKrw: 9556 },
  'North Gyeongsang': { regionLabel: 'North Gyeongsang', sourceKoreanLabel: '경북', kimchiStewKrw: 8923, bibimbapKrw: 9908 },
  'South Gyeongsang': { regionLabel: 'South Gyeongsang', sourceKoreanLabel: '경남', kimchiStewKrw: 8808, bibimbapKrw: 9154 },
  Jeju: { regionLabel: 'Jeju', sourceKoreanLabel: '제주', kimchiStewKrw: 9625, bibimbapKrw: 10500 },
}

export function getFoodPriceReference(slug: string): FoodPriceReference | null {
  const budget = getBudgetEvidence(slug)
  if (!budget || !budget.foodRegions.length) return null
  const regions: RegionalFoodPrice[] = []
  for (const region of budget.foodRegions) {
    if (!Object.hasOwn(REGIONAL_FOOD_PRICES, region)) return null
    regions.push(REGIONAL_FOOD_PRICES[region])
  }
  const stewPrices = regions.map(({ kimchiStewKrw }) => kimchiStewKrw)
  const bibimbapPrices = regions.map(({ bibimbapKrw }) => bibimbapKrw)
  const regionLabels = regions.map(({ regionLabel }) => regionLabel)
  return {
    sourceMonth: '2026-08',
    sourceMonthLabel: 'Aug 2026',
    checkedAt: '2026-10-08',
    sourceUrl: 'https://www.price.go.kr/tprice/portal/pricetrend/dineoutpricetrend/getDinerOutTrend.do',
    publisher: 'Korea Consumer Agency',
    dataProvider: '행정안전부',
    originalSource: '국가데이터처',
    unit: 'KRW',
    portion: 'one meal per person',
    provisional: true,
    regionLabel: regionLabels.join(' / '),
    regionLabels,
    sourceKoreanLabels: regions.map(({ sourceKoreanLabel }) => sourceKoreanLabel),
    regions,
    meals: [
      { id: 'kimchi-stew', label: 'Kimchi stew with rice', minimumKrw: Math.min(...stewPrices), maximumKrw: Math.max(...stewPrices) },
      { id: 'bibimbap', label: 'Bibimbap', minimumKrw: Math.min(...bibimbapPrices), maximumKrw: Math.max(...bibimbapPrices) },
    ],
    note: 'Regional averages for one meal, not a restaurant quote or a daily food total. Surveyed shops, portions and quality vary; figures are provisional.',
  }
}
