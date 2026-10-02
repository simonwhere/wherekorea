// Pregnancy content for the 임신 tab: week-by-week notes, a typical Korean
// prenatal check schedule, a hospital-bag list and partner ideas.
//
// Everything here is deliberately general — widely known milestones only, no
// numbers beyond what lib/content/programs.ts and the research notes support.
// Sizes are rough comparisons (always shown with "대략"). Schedules differ by
// hospital, so the UI always defers to the care team.
//
// The data lives in ./data/pregnancy.json; the weeks, the prenatal checks and
// the one-stop services carry audit fields (lib/content/meta.ts). This module
// is the typed loader plus the label maps the screens use.

import data from './data/pregnancy.json'
import { auditOf, checkAudited, type ContentAudit, type ContentSource } from './meta'

export type Trimester = 1 | 2 | 3

export const TRIMESTER_LABEL: Record<Trimester, string> = {
  1: '초기',
  2: '중기',
  3: '후기',
}

/** Week the trimester starts (completed weeks), matching gestationalAge(). */
export const TRIMESTER_START: Record<Trimester, number> = { 1: 0, 2: 14, 3: 28 }

// ── Week by week ────────────────────────────────────────────

export interface WeekInfo {
  /** First and last completed week this entry covers (inclusive). */
  from: number
  to: number
  /** Rough size comparison — always shown as "대략". */
  size: string
  sizeEmoji: string
  /** 1–2 widely known development notes. */
  highlights: string[]
  /** Tip for the pregnant partner. */
  mom: string
  /** "이번 주 할 일" for the other partner. */
  partner: string
}

// ── Prenatal check schedule ─────────────────────────────────

export interface PrenatalCheck {
  id: string
  /** Typical window in completed weeks (inclusive). */
  from: number
  to: number
  weekLabel: string
  title: string
  /** One-line "why". */
  why: string
  /** Related support program (lib/content/programs.ts). */
  programId?: string
}

// ── Hospital bag ────────────────────────────────────────────

export type BagGroup = 'docs' | 'mom' | 'baby' | 'partner'

export const BAG_GROUP_LABEL: Record<BagGroup, string> = {
  docs: '서류',
  mom: '엄마',
  baby: '아기',
  partner: '파트너',
}

export interface BagItem {
  id: string
  label: string
  group: BagGroup
  note?: string
}

// ── Partner corner ──────────────────────────────────────────

export interface PartnerIdea {
  id: string
  icon: string
  title: string
  body: string
  /** In-app link (hash tab) or external link. */
  link?: { kind: 'tab'; tab: 'date' | 'diary'; label: string } | { kind: 'url'; url: string; label: string }
}

export interface OneStop {
  title: string
  body: string
  url: string
}

interface PregnancyJson {
  checkedAt: string
  sources: Record<string, ContentSource>
  weekInfoNote: string
  dueDateNote: string
  weeks: Array<WeekInfo & ContentAudit & { sources: string[] }>
  prenatalChecks: Array<PrenatalCheck & ContentAudit & { sources: string[] }>
  bagItems: BagItem[]
  bagProminentWeek: number
  partnerIdeas: Record<Trimester, PartnerIdea[]>
  oneStop: Record<'pregnancy' | 'birth', OneStop & ContentAudit & { sources: ContentSource[] }>
}

const raw = data as unknown as PregnancyJson
checkAudited(raw.weeks, 'pregnancy.weeks')
checkAudited(raw.prenatalChecks, 'pregnancy.prenatalChecks')
checkAudited([raw.oneStop.pregnancy, raw.oneStop.birth], 'pregnancy.oneStop')

export const PREGNANCY_CHECKED_AT: string = raw.checkedAt

export const WEEK_INFO_NOTE: string = raw.weekInfoNote

export const DUE_DATE_NOTE: string = raw.dueDateNote

export const WEEKS: WeekInfo[] = raw.weeks.map(({ from, to, size, sizeEmoji, highlights, mom, partner }) => ({
  from,
  to,
  size,
  sizeEmoji,
  highlights,
  mom,
  partner,
}))

/** Typical Korean schedule. Hospitals differ — the UI always says so. */
export const PRENATAL_CHECKS: PrenatalCheck[] = raw.prenatalChecks.map(({ id, from, to, weekLabel, title, why, programId }) => ({
  id,
  from,
  to,
  weekLabel,
  title,
  why,
  ...(programId ? { programId } : {}),
}))

/**
 * The audit of the pregnancy content: weeks by 'week:<from>-<to>', prenatal
 * checks by 'check:<id>', one-stop services by 'one-stop:<key>'.
 */
export const PREGNANCY_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries([
  ...raw.weeks.map((w) => [`week:${w.from}-${w.to}`, auditOf(w)] as const),
  ...raw.prenatalChecks.map((c) => [`check:${c.id}`, auditOf(c)] as const),
  ['one-stop:pregnancy', auditOf(raw.oneStop.pregnancy)] as const,
  ['one-stop:birth', auditOf(raw.oneStop.birth)] as const,
])

export const BAG_ITEMS: BagItem[] = raw.bagItems

/** From this week the bag list opens by default and moves up the page. */
export const BAG_PROMINENT_WEEK: number = raw.bagProminentWeek

export const PARTNER_IDEAS: Record<Trimester, PartnerIdea[]> = raw.partnerIdeas

// ── One-stop services ───────────────────────────────────────

const oneStop = (o: OneStop): OneStop => ({ title: o.title, body: o.body, url: o.url })

export const ONE_STOP: Readonly<Record<'pregnancy' | 'birth', OneStop>> = {
  pregnancy: oneStop(raw.oneStop.pregnancy),
  birth: oneStop(raw.oneStop.birth),
}
