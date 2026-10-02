// Content for the 아기 tab. Checkup windows and vaccine anchors come from the
// NHIS / KDCA summaries in the research notes (kr-programs); milestone ages
// are loose "most babies around…" ranges, not norms. Nothing here is a
// diagnosis — every screen that shows it points to 영유아 건강검진.
//
// The data lives in ./data/baby.json; the milestones, checkups, vaccine
// anchors, 백일·돌 note and 행복출산 card carry audit fields
// (lib/content/meta.ts). This module is the typed loader plus the label maps
// and UI limits the screens use.

import type { BabySex } from '../types'
import data from './data/baby.json'
import { auditOf, checkAudited, contentError, type ContentAudit, type ContentSource } from './meta'

export const SEX_EMOJI: Record<BabySex, string> = {
  girl: '👧',
  boy: '👦',
  unknown: '👶',
}

export const SEX_LABEL: Record<BabySex, string> = {
  girl: '여아',
  boy: '남아',
  unknown: '선택 안 함',
}

export const SEX_OPTIONS: BabySex[] = ['girl', 'boy', 'unknown']

// ── 발달 이정표 ─────────────────────────────────────────────

export interface Milestone {
  key: string
  label: string
  emoji: string
  /** Loose typical age, shown as-is ("2개월 무렵"). */
  typical: string
  /** Rough start month — only used for ordering. */
  fromMonth: number
}

// ── 영유아 건강검진 (국민건강보험공단) ────────────────────────

export type CheckupKind = 'general' | 'dental'

/**
 * A checkup window. `fromDays`/`toDays` are days after birth; month windows
 * run from the day the baby turns `fromMonth` months to the day before they
 * turn `toMonth + 1` months ("4~6개월" = 만 4개월 ~ 6개월 끝).
 */
export type CheckupSpec =
  | { id: string; kind: CheckupKind; round: number; label: string; fromDays: number; toDays: number }
  | { id: string; kind: CheckupKind; round: number; label: string; fromMonth: number; toMonth: number }

export const CHECKUP_KIND_LABEL: Record<CheckupKind, string> = {
  general: '건강검진',
  dental: '구강검진',
}

// ── 성장 기록 ───────────────────────────────────────────────

export interface GrowthLimit {
  min: number
  max: number
  step: number
  unit: string
  label: string
}

export const GROWTH_LIMITS = {
  heightCm: { min: 30, max: 130, step: 0.1, unit: 'cm', label: '키' },
  weightKg: { min: 1, max: 30, step: 0.01, unit: 'kg', label: '몸무게' },
  headCm: { min: 25, max: 60, step: 0.1, unit: 'cm', label: '머리둘레' },
} as const satisfies Record<'heightCm' | 'weightKg' | 'headCm', GrowthLimit>

export type GrowthField = keyof typeof GROWTH_LIMITS

// ── The JSON ────────────────────────────────────────────────

type Audited<T> = T & ContentAudit & { sources: string[] }

interface BabyJson {
  checkedAt: string
  sources: Record<string, ContentSource>
  milestones: Array<Audited<Milestone>>
  milestoneNote: string
  checkups: Array<Audited<CheckupSpec>>
  checkupNote: string
  checkupLink: { url: string; label: string }
  vaccineAnchors: Array<Audited<{ name: string; when: string }>>
  vaccineNote: string
  vaccineAlertTip: string
  growthChartLink: { text: string; url: string }
  koreanDaysNote: Audited<{ title: string; body: string; source: string }>
  claimWindowDays: number
  claim60ProgramIds: string[]
  firstMeetingProgramId: string
  happyBirth: Audited<{ title: string; body: string; url: string }>
}

const raw = data as unknown as BabyJson
checkAudited(raw.milestones, 'baby.milestones')
checkAudited(raw.checkups, 'baby.checkups')
checkAudited(raw.vaccineAnchors, 'baby.vaccineAnchors')
checkAudited([raw.koreanDaysNote, raw.happyBirth], 'baby')

export const BABY_CHECKED_AT: string = raw.checkedAt

export const MILESTONES: Milestone[] = raw.milestones.map(({ key, label, emoji, typical, fromMonth }) => ({
  key,
  label,
  emoji,
  typical,
  fromMonth,
}))

export const MILESTONE_NOTE: string = raw.milestoneNote

export const CHECKUPS: CheckupSpec[] = raw.checkups.map((c) => {
  const { effectiveFrom: _e, checkedAt: _c, verified: _v, checkNote: _n, sources: _s, ...spec } = c
  return spec as CheckupSpec
})

export const CHECKUP_NOTE: string = raw.checkupNote

export const CHECKUP_LINK: { readonly url: string; readonly label: string } = raw.checkupLink

// ── 예방접종 — a few anchors only; the full schedule lives on 예방접종도우미 ──

export const VACCINE_ANCHORS: { name: string; when: string }[] = raw.vaccineAnchors.map(({ name, when }) => ({ name, when }))

export const VACCINE_NOTE: string = raw.vaccineNote

export const VACCINE_ALERT_TIP: string = raw.vaccineAlertTip

export const GROWTH_CHART_LINK: { readonly text: string; readonly url: string } = raw.growthChartLink

// ── 한국 기념일 ─────────────────────────────────────────────

export interface KoreanDaysNote {
  readonly title: string
  readonly body: string
  readonly source: { readonly url: string; readonly label: string }
}

/** 국립민속박물관 한국민속대백과 (돌, 돌잡이) summary. */
export const KOREAN_DAYS_NOTE: KoreanDaysNote = (() => {
  const key = raw.koreanDaysNote.source
  const src = raw.sources[key] ?? contentError('baby.koreanDaysNote', `unknown source '${key}'`)
  return { title: raw.koreanDaysNote.title, body: raw.koreanDaysNote.body, source: { url: src.url, label: src.name } }
})()

// ── 지원 제도 ───────────────────────────────────────────────

/**
 * 부모급여·아동수당·양육수당: apply within 60 days of birth to be paid from the
 * birth month. lib/logic/babyView counts the birth day as day 1 (the earlier
 * reading), so the last day shown is the 60th day of life.
 */
export const CLAIM_WINDOW_DAYS: number = raw.claimWindowDays

/** lib/content/programs ids with the 60-day rule, and 첫만남이용권 (use within 1 year). */
export const CLAIM_60_PROGRAM_IDS: readonly string[] = raw.claim60ProgramIds
export const FIRST_MEETING_PROGRAM_ID: string = raw.firstMeetingProgramId

export const HAPPY_BIRTH: { readonly title: string; readonly body: string; readonly url: string } = {
  title: raw.happyBirth.title,
  body: raw.happyBirth.body,
  url: raw.happyBirth.url,
}

/**
 * The audit of the baby content: milestones by 'milestone:<key>', checkups by
 * 'checkup:<id>', vaccine anchors by 'vaccine:<name>', plus 'korean-days' and 'happy-birth'.
 */
export const BABY_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries([
  ...raw.milestones.map((m) => [`milestone:${m.key}`, auditOf(m)] as const),
  ...raw.checkups.map((c) => [`checkup:${c.id}`, auditOf(c)] as const),
  ...raw.vaccineAnchors.map((v) => [`vaccine:${v.name}`, auditOf(v)] as const),
  ['korean-days', auditOf(raw.koreanDaysNote)] as const,
  ['happy-birth', auditOf(raw.happyBirth)] as const,
])
