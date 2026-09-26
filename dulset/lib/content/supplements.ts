// Suggested daily-check items and the evidence behind each one.
//
// Sources are the guideline/trial pages collected in the research step
// (medical.json). Wording stays conservative: every item says how strong the
// evidence is, and items without benefit are shown as information only — the
// app never "sells" a supplement.

import type { CheckItem, CheckKind } from '../types'

/**
 * Who a suggestion is for. 'partner' means the member whose cycle is NOT
 * tracked (sperm-side advice), not "the other person on this phone".
 */
export type Audience = 'cycle-owner' | 'partner' | 'both'

export type Evidence = 'strong' | 'moderate' | 'limited' | 'not-recommended'

export interface Suggestion {
  id: string
  label: string
  kind: CheckKind
  note?: string
  audience: Audience
  evidence: Evidence
  /** One line, plain Korean, no medical claims beyond the source. */
  summary: string
  source: { name: string; url: string }
  /** Words that mean the item is already on someone's list (e.g. '담배' for 금연). */
  match?: string[]
  /** Shown as a note only — never offered as a check item. */
  infoOnly?: boolean
  /** Sperm-side advice (heat, men's supplements) — hidden for a non-owner who is '아내'. */
  sperm?: boolean
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: '근거 탄탄',
  moderate: '근거 보통',
  limited: '근거 제한적',
  'not-recommended': '권장하지 않아요',
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'folic-acid',
    label: '엽산',
    kind: 'supplement',
    note: '400µg',
    audience: 'cycle-owner',
    evidence: 'strong',
    summary:
      '임신 최소 1개월 전(한국은 보통 3개월 전)부터 임신 12주까지 하루 400µg. 신경관 결손 예방 효과가 가장 확실한 영양제예요.',
    source: {
      name: 'USPSTF 2023 (A등급) · CDC · WHO · 질병관리청',
      url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/folic-acid-for-the-prevention-of-neural-tube-defects-preventive-medication',
    },
    match: ['엽산'],
  },
  {
    id: 'vitamin-d',
    label: '비타민 D',
    kind: 'supplement',
    note: '10µg · 선택',
    audience: 'cycle-owner',
    evidence: 'moderate',
    summary: '영국 NHS는 임신 준비·임신 중 하루 10µg을 권해요. 특히 해가 짧은 10~3월에요.',
    source: { name: 'NHS', url: 'https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/' },
    match: ['비타민d'],
  },
  {
    id: 'multivitamin',
    label: '종합비타민',
    kind: 'supplement',
    note: '레티놀 1만 IU 이하인지 확인',
    audience: 'cycle-owner',
    evidence: 'limited',
    summary:
      '꼭 먹을 필요는 없어요. 먹는다면 비타민 A(레티놀)가 하루 1만 IU를 넘지 않는지, 엽산이 겹치지 않는지 확인해요. 고용량 레티놀은 임신 중 피해야 해요.',
    source: { name: 'NHS', url: 'https://www.nhs.uk/pregnancy/keeping-well/pregnancy-vitamins-and-supplements/' },
    match: ['종합비타민', '멀티비타민'],
  },
  {
    id: 'no-alcohol',
    label: '술 안 마시기',
    kind: 'habit',
    audience: 'both',
    evidence: 'strong',
    summary: '임신을 준비하는 동안에도 안전한 음주량은 알려져 있지 않아요.',
    source: { name: '미국 CDC', url: 'https://www.cdc.gov/maternal-infant-health/pregnancy-substance-abuse/index.html' },
    match: ['술', '금주', '음주'],
  },
  {
    id: 'no-smoking',
    label: '담배 안 피우기',
    kind: 'habit',
    audience: 'both',
    evidence: 'strong',
    summary: '흡연은 남성의 정액 질을 떨어뜨리고, 여성의 난임 위험을 높여요.',
    source: {
      name: 'ASRM 위원회 의견',
      url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/tobacco-or-marijuana-use/',
    },
    match: ['담배', '금연', '흡연'],
  },
  {
    id: 'caffeine',
    label: '카페인 200mg 이하',
    kind: 'habit',
    audience: 'both',
    evidence: 'moderate',
    summary: '하루 200mg 미만이면 유산·조산의 주요 요인은 아닌 것으로 보여요 (ACOG). 식약처 기준은 임신부 하루 300mg 이하예요.',
    source: {
      name: 'ACOG 위원회 의견 462',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2010/08/moderate-caffeine-consumption-during-pregnancy',
    },
    match: ['카페인', '커피'],
  },
  {
    id: 'no-sauna',
    sperm: true,
    label: '사우나·뜨거운 탕 피하기',
    kind: 'habit',
    note: '고환 온도',
    audience: 'partner',
    evidence: 'moderate',
    summary: '주 2회 15분 사우나를 3개월 했더니 정자 수·운동성이 떨어졌고, 끊은 뒤 6개월 무렵 회복됐어요.',
    source: { name: 'Garolla 외, Human Reproduction 2013', url: 'https://pubmed.ncbi.nlm.nih.gov/23411620/' },
    match: ['사우나', '온욕', '뜨거운탕', '반신욕'],
  },
  {
    id: 'no-laptop-lap',
    sperm: true,
    label: '노트북 무릎 위에 두지 않기',
    kind: 'habit',
    audience: 'partner',
    evidence: 'limited',
    summary: '정자는 체온보다 몇 도 낮은 온도에서 잘 만들어져요. 노트북 열의 영향은 근거가 제한적이지만 쉽게 피할 수 있어요.',
    source: { name: '열 노출과 정액 질 리뷰 (Int Braz J Urol)', url: 'http://www.scielo.br/j/ibju/a/DZ7qfNnKzYGk6vdMC8HWjRB/?lang=en' },
    match: ['노트북'],
  },
  {
    id: 'exercise',
    label: '30분 걷기·운동',
    kind: 'habit',
    audience: 'both',
    evidence: 'limited',
    summary: '가벼운 운동은 건강한 체중과 컨디션에 도움이 돼요. 체중(BMI 30 이상)은 임신까지 걸리는 시간에 영향을 줄 수 있어요.',
    source: {
      name: 'NICE NG257 (2026)',
      url: 'https://www.nice.org.uk/guidance/NG257/chapter/advice-about-factors-that-can-affect-fertility',
    },
    match: ['운동', '걷기', '산책'],
  },
  {
    id: 'sleep',
    label: '7시간 이상 자기',
    kind: 'habit',
    audience: 'both',
    evidence: 'limited',
    summary: '성인은 하루 7시간 이상 자는 게 좋다고 해요. 수면과 임신 가능성 사이의 직접 근거는 아직 제한적이에요.',
    source: { name: '미국 CDC (수면)', url: 'https://www.cdc.gov/sleep/about/index.html' },
    match: ['수면', '7시간', '잠'],
  },
  {
    id: 'coq10',
    sperm: true,
    label: '코엔자임Q10·항산화제',
    kind: 'supplement',
    note: '선택 · 의사와 상의',
    audience: 'partner',
    evidence: 'limited',
    summary: '난임 남성 연구에서 항산화제가 출생률을 높일 수도 있다고 봤지만 근거의 확실성이 낮아요. 먹는다면 의사와 상의해 보세요.',
    source: { name: 'Cochrane 리뷰 2022', url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD007411.pub5/full' },
    match: ['코엔자임', 'coq10', '항산화'],
  },
  {
    id: 'male-zinc-folate',
    sperm: true,
    label: '남성 아연·엽산 영양제',
    kind: 'supplement',
    audience: 'partner',
    evidence: 'not-recommended',
    summary:
      '난임 치료를 준비하는 남성 2,370명이 6개월 동안 아연·엽산 또는 위약을 먹은 무작위 연구에서 정액 질·출생률은 나아지지 않았고, 정자 DNA 손상은 오히려 늘었어요. 생활습관이 더 중요해요.',
    source: { name: 'FAZST, JAMA 2020', url: 'https://jamanetwork.com/journals/jama/fullarticle/2758450' },
    infoOnly: true,
  },
]

/** Lowercase, no spaces or separators — so '비타민 D' matches '비타민d'. */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[\s·・,./()\-_]/g, '')
}

export function isSuggestionAdded(s: Suggestion, items: Pick<CheckItem, 'label'>[]): boolean {
  const keys = [s.label, ...(s.match ?? [])].map(normalizeLabel).filter(Boolean)
  return items.some((i) => {
    const l = normalizeLabel(i.label)
    return keys.some((k) => l.includes(k))
  })
}

export interface SuggestionFilter {
  /** false hides sperm-side items (see lib/logic/today isSpermSide). Default true. */
  sperm?: boolean
}

/** Everything relevant to this member, including info-only notes. */
export function suggestionsForRole(role: Exclude<Audience, 'both'>, filter: SuggestionFilter = {}): Suggestion[] {
  const sperm = filter.sperm ?? true
  return SUGGESTIONS.filter((s) => (s.audience === 'both' || s.audience === role) && (sperm || !s.sperm))
}

/** Suggestions a member can still add (relevant, not info-only, not on their list yet). */
export function availableSuggestions(
  role: Exclude<Audience, 'both'>,
  items: Pick<CheckItem, 'label'>[],
  filter: SuggestionFilter = {},
): Suggestion[] {
  return suggestionsForRole(role, filter).filter((s) => !s.infoOnly && !isSuggestionAdded(s, items))
}

/** Info-only notes for a member (e.g. "men's zinc/folate pills: no benefit"). */
export function infoNotes(role: Exclude<Audience, 'both'>, filter: SuggestionFilter = {}): Suggestion[] {
  return suggestionsForRole(role, filter).filter((s) => s.infoOnly)
}
