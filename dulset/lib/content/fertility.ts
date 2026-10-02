// "정확도 높이기" content for the 달력 tab, the NICE framing, and the words of
// the "+ 기록" sheet. Every number comes from the medical research notes
// (docs/research/medical.json, lh-tests.json). Wording is wellness/reference
// only: no contraception, no diagnosis, no "success-rate" promises.
//
// The data lives in ./data/fertility.json: the sources table, the guide
// sections (each with its audit fields, lib/content/meta.ts), the NICE
// guidance, and the sheet's choices and lines. This module is the typed
// loader plus the small pure helpers (section filtering, the doctor line, the
// 임테기 after-copy) the screens call.

import { doctorThresholdMonths } from '../logic/notifications'
import type { LHResult, PersonalFeel, PregnancyTestResult } from '../types'
import data from './data/fertility.json'
import { auditOf, checkAudited, resolveSources, type ContentAudit, type ContentSource } from './meta'

export type Source = ContentSource

export interface GuideSection {
  id: 'calendar-limits' | 'lh' | 'frequency' | 'signs' | 'doctor'
  icon: string
  title: string
  /** Title used when the viewer prefers "우리의 주간" wording. */
  softTitle?: string
  /** One-line teaser shown while the section is collapsed. */
  summary: string
  points: string[]
  /**
   * Replacement points for the hidden view (low-pressure / alerts off), which
   * must not mention 가임기 or date-timing. Omit to reuse `points`.
   */
  hiddenPoints?: string[]
  sources: Source[]
  /** Shown even when fertile-day estimates are hidden (low-pressure / off). */
  showWhenHidden: boolean
}

/** The keys of the sources table (SOURCES.nice2026 …). */
export type SourceKey = keyof typeof data.sources

interface SectionJson extends Omit<GuideSection, 'sources'>, ContentAudit {
  sources: string[]
}
interface FertilityJson {
  checkedAt: string
  sources: Record<SourceKey, Source>
  sections: SectionJson[]
  niceGuidance: ContentAudit & { title: string; body: string; source: string; sources: string[] }
  estimateDisclaimer: string
  lhChoices: Array<{ result: LHResult; hint: string }>
  ptestChoices: Array<{ result: PregnancyTestResult; hint: string }>
  ptestEarlyNote: string
  feelChips: Array<{ feel: PersonalFeel; label: string }>
  feelPanelNote: string
  waitingWeekLines: string[]
}

const raw = data as unknown as FertilityJson
checkAudited(raw.sections, 'fertility.sections')
checkAudited([raw.niceGuidance], 'fertility.niceGuidance')

/** When the numbers and links below were last checked against their sources. */
export const GUIDE_CHECKED_AT: string = raw.checkedAt

export const SOURCES: Readonly<Record<SourceKey, Source>> = raw.sources

const sourcesOf = (keys: string[], where: string): Source[] => resolveSources(keys, raw.sources, where)

export const GUIDE_SECTIONS: GuideSection[] = raw.sections.map((s) => {
  const { effectiveFrom: _e, checkedAt: _c, verified: _v, checkNote: _n, sources, ...rest } = s
  return { ...rest, sources: sourcesOf(sources, `fertility.sections '${s.id}'`) }
})

/** The audit of each section by id, and of the NICE guidance under 'nice'. */
export const GUIDE_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries([
  ...raw.sections.map((s) => [s.id, auditOf(s)] as const),
  ['nice', auditOf(raw.niceGuidance)] as const,
])

/**
 * Sections for the viewer: hidden views skip timing-related sections and use
 * each remaining section's `hiddenPoints` (no 가임기 / date-timing wording).
 */
export function guideSections(hidden: boolean): GuideSection[] {
  if (!hidden) return GUIDE_SECTIONS
  return GUIDE_SECTIONS.filter((s) => s.showWhenHidden).map((s) => (s.hiddenPoints ? { ...s, points: s.hiddenPoints } : s))
}

/** Unique sources across sections, in first-seen order. */
export function guideSources(sections: GuideSection[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const s of sections)
    for (const src of s.sources) {
      if (seen.has(src.url)) continue
      seen.add(src.url)
      out.push(src)
    }
  return out
}

/**
 * Months of trying after which both partners are encouraged to get checked —
 * the same rule as the notices, the home DoctorCard and onboarding
 * (notifications.doctorThresholdMonths): 12 under 35, 6 at 35+, 0 (right away)
 * at 40+. Unknown age → 12.
 */
export function doctorGuideMonths(age: number | undefined): 0 | 6 | 12 {
  const m = doctorThresholdMonths(age)
  return m === 0 ? 0 : m === 6 ? 6 : 12
}

/** Personal line for the doctor section, e.g. "지은님(36세) 기준으로는 6개월 동안 …". */
export function doctorAgeLine(name: string, age: number): string {
  const months = doctorGuideMonths(age)
  if (months === 0) return `${name}님(${age}세) 기준으로는 기다리지 말고 지금 상담해 보세요.`
  const span = months === 12 ? '1년' : '6개월'
  return `${name}님(${age}세) 기준으로는 ${span} 동안 소식이 없으면 상담을 받아 보세요.`
}

/** NICE framing shown instead of fertile-day estimates in the hidden view. */
export const NICE_GUIDANCE: { readonly title: string; readonly body: string; readonly source: Source } = {
  title: raw.niceGuidance.title,
  body: raw.niceGuidance.body,
  source: sourcesOf([raw.niceGuidance.source], 'fertility.niceGuidance')[0]!,
}

export const ESTIMATE_DISCLAIMER: string = raw.estimateDisclaimer

// ── "+ 기록" sheet ──────────────────────────────────────────
// Reading a strip: the test line (T) against the control line (C). The app
// never reads photos or judges a result — the user picks what they see.

export const LH_CHOICES: ReadonlyArray<{ result: LHResult; hint: string }> = raw.lhChoices

export const PTEST_CHOICES: ReadonlyArray<{ result: PregnancyTestResult; hint: string }> = raw.ptestChoices

/** Shown above the 임테기 choices (SOURCES.earlyTest — no numbers on purpose). */
export const PTEST_EARLY_NOTE: string = raw.ptestEarlyNote

/**
 * What the sheet says right after a 임테기 result. A positive test is "병원
 * 확인 전": calm, no celebration (about 10% of confirmed pregnancies end
 * early — ACOG, docs/research/couple-record.json), and fertile-day display
 * pauses. `explicit` = the viewer's wording allows 가임기. `waiting` = false
 * when a period was already logged on/after the test's day (a past test
 * entered late): it is kept as a record and nothing pauses.
 */
export function ptestAfterCopy(
  result: PregnancyTestResult,
  explicit: boolean,
  waiting = true,
): { title: string; body: string[] } {
  if (result === 'positive' && !waiting)
    return { title: '남겨 뒀어요', body: ['그 뒤에 생리 기록이 있어서 날짜 예상은 그대로 둬요.'] }
  if (result === 'positive')
    return {
      title: '병원에서 확인해 봐요',
      body: [
        '확인하기 전까지는 ‘병원 확인 전’으로 둘게요.',
        explicit ? '가임기 표시와 알림은 잠시 멈춰요.' : '날짜 표시와 알림은 잠시 멈춰요.',
      ],
    }
  if (result === 'faint') return { title: '희미한 선도 남겨 뒀어요', body: ['헷갈릴 땐 2~3일 뒤 다시 해 보거나 병원에서 확인해 봐요.'] }
  return {
    title: '남겨 뒀어요',
    body: ['생리 예정일 전이었다면 2~3일 뒤 다시 해 봐도 좋아요.', '생리가 시작되면 생리로 기록해 주세요.'],
  }
}

// ── 기다리는 주: 오늘 컨디션 (N11) ──────────────────────────
// Her own record of how the day felt (lib/logic/personalLog.ts — 본인만 보기,
// never the partner's screen). Plain words, no reading of what they mean:
// '살짝 비쳐요' stays descriptive — no 착상혈, no "it could mean…".

/** The six chips of the 오늘 컨디션 panel, in this order. */
export const FEEL_CHIPS: ReadonlyArray<{ feel: PersonalFeel; label: string }> = raw.feelChips

/** Under the chips: what the record is for, and who sees it. */
export const FEEL_PANEL_NOTE: string = raw.feelPanelNote

/**
 * One quiet line a day for the 기다리는 주 card. Nothing here is a medical
 * claim — docs/research has no evidence that ties a day after ovulation to a
 * symptom or an action, so the card rotates self-care only (and says
 * '너무 이르면 음성일 수 있어요', SOURCES.earlyTest, next to the test action).
 */
export const WAITING_WEEK_LINES: readonly string[] = raw.waitingWeekLines

/** The line for day `n` of the wait (n ≥ 0 — rotates through WAITING_WEEK_LINES). */
export function waitingWeekLine(n: number): string {
  const i = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  return WAITING_WEEK_LINES[i % WAITING_WEEK_LINES.length]!
}
