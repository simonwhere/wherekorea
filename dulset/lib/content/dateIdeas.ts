// Curated date ideas for the 데이트 / 둘만의 tab. No external API: each idea
// carries a Korean search keyword that opens in 카카오맵 / 네이버지도.
//
// The ideas live in ./data/dateIdeas.json with their audit fields
// (lib/content/meta.ts). Only the health tips carry sources, from the
// research notes:
// - Alcohol: CDC — no known safe amount while trying to get pregnant or pregnant.
// - Heat: Garolla et al., Hum Reprod 2013 (sauna → reversible drop in sperm quality);
//   early-pregnancy heat exposure linked to neural tube defects (Milunsky, JAMA 1992).
// - Stress: NICE CG156 — stress can affect the couple's relationship and time together.
// 1박 destinations come from WhereKorea's couple-tagged destinations.
// This module is the typed loader plus the label maps the screens use.

import type { Stage } from '../types'
import data from './data/dateIdeas.json'
import { auditOf, checkAudited, contentError, stripAudit, type ContentAudit } from './meta'

export type DateCategory = 'home' | 'walk' | 'food' | 'culture' | 'drive' | 'trip' | 'stay'
export type Season = 'spring' | 'summer' | 'fall' | 'winter'
export type DateFlag = 'no-alcohol' | 'no-heat' | 'low-energy' | 'baby-friendly'
export type Budget = 1 | 2 | 3
export type Duration = '1~2시간' | '반나절' | '하루' | '1박'

export interface DateIdea {
  id: string
  title: string
  emoji: string
  category: DateCategory
  description: string
  /** Why it's good for the two of us right now. */
  why: string
  budget: Budget
  duration: Duration
  /** Korean search keyword for 카카오맵 / 네이버지도. */
  mapQuery: string
  /** Shown in every stage. */
  tip?: string
  /** Stage-specific tip that replaces `tip` (fertility or pregnancy guidance). */
  stageTips?: Partial<Record<Stage, string>>
  /** Omitted = good all year. */
  seasons?: Season[]
  stages: Stage[]
  flags?: DateFlag[]
}

export const CATEGORY_META: Record<DateCategory, { label: string; emoji: string }> = {
  home: { label: '집에서', emoji: '🏠' },
  walk: { label: '산책', emoji: '🚶' },
  food: { label: '맛집·카페', emoji: '🍽️' },
  culture: { label: '문화·공방', emoji: '🎨' },
  drive: { label: '드라이브', emoji: '🚗' },
  trip: { label: '여행', emoji: '🧳' },
  stay: { label: '숙소', emoji: '🏨' },
}

export const CATEGORY_ORDER: DateCategory[] = ['home', 'walk', 'food', 'culture', 'drive', 'trip', 'stay']

export const BUDGET_META: Record<Budget, { symbol: string; label: string }> = {
  1: { symbol: '₩', label: '부담 없이' },
  2: { symbol: '₩₩', label: '적당히' },
  3: { symbol: '₩₩₩', label: '특별하게' },
}

export const FLAG_BADGE: Record<DateFlag, string> = {
  'no-alcohol': '🍹 무알콜',
  'no-heat': '♨️ 뜨거운 탕 피하기',
  'low-energy': '🛋️ 체력 부담 적음',
  'baby-friendly': '👶 아기와 함께',
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  fall: '가을',
  winter: '겨울',
}

export interface TipSource {
  label: string
  url: string
}

interface DateIdeaJson extends DateIdea, ContentAudit {
  /** Keys into tipSources (only ideas with a health tip have any). */
  sources: string[]
}
interface DateIdeasJson {
  checkedAt: string
  tipSources: Record<string, TipSource>
  tipSourcesByStage: Record<Stage, string[]>
  items: DateIdeaJson[]
}

const raw = data as unknown as DateIdeasJson
checkAudited(raw.items, 'dateIdeas.items')

export const DATE_IDEAS_CHECKED_AT: string = raw.checkedAt

export const DATE_IDEAS: DateIdea[] = raw.items.map((i) => {
  const { sources: _s, ...rest } = stripAudit(i)
  return rest
})

/** The audit of each idea by id (verified false only where a health tip rests on medium evidence). */
export const DATE_IDEA_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries(raw.items.map((i) => [i.id, auditOf(i)]))

const tipSource = (key: string): TipSource => raw.tipSources[key] ?? contentError('dateIdeas.tipSources', `unknown source '${key}'`)

/** Sources for the health tips shown on idea cards, per stage (none after birth). */
export const DATE_TIP_SOURCES: Record<Stage, readonly TipSource[]> = {
  preparing: raw.tipSourcesByStage.preparing.map(tipSource),
  pregnant: raw.tipSourcesByStage.pregnant.map(tipSource),
  parenting: raw.tipSourcesByStage.parenting.map(tipSource),
}
