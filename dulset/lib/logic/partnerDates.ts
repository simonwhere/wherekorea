// His dated check points (founder 2026-11-01, '12개 전부'): the days the
// notices and screens read, in one pure place.
//
// • 독감 — the roadmap row 'partner-flu' is seasonal, not anchored to the
//   pregnancy: it shows 10월 1일–12월 31일 while preparing and 10월 1일–4월 30일
//   while pregnant (KDCA 2026-27 절기: pregnant people are vaccinated until
//   4월 30일), never in the parenting stage, and is done once per 절기. A 절기
//   runs from September to the next August ('2026-27'); its tick lives under
//   its own planDone key ('partner-flu:2026-27'), so a new season starts open
//   and nothing ever reads '지났어요' — the row simply leaves after its window.
//   Research: docs/research/medical-checklist.json 'partner-flu-season-2026-27'.
// • Days counted from the due date (예정일) or the birth day, for the notices:
//   Tdap at 예정일 −60 and −21 (research 'partner-tdap-once'), 배우자 출산휴가
//   opening at −50 and closing on 출생일 + 119 (출생 후 120일, the birth day
//   counted as day 1 — the earlier, conservative reading; research
//   admin-timeline.json 'spouse-birth-leave-120-days'), 산후도우미 신청 opening at
//   −40 ('postnatal-care-spouse-apply'), 아빠 마음 at 출생일 + 90 until + 364
//   (medical.json 'paternal-perinatal-depression'), the 정액검사 준비 check 7
//   days before the booked day (medical.json 'male-semen-test-abstinence').
// • The catch-up rule: the app runs its rules only while it is open (no server
//   push yet), so a dated notice fires on the first open on or after its day,
//   once, with the real days left (catchUpStep), and a 'window open' notice on
//   the first open inside the window (insideWindow) — joining mid-window still
//   gets it.
//
// A leaf module: dates and types only, so notifications.ts, planNotices.ts and
// the screens may all import it without an import cycle.

import { addDays, diffDays, isISODate, parts, weekdayIndex } from '../dates'
import type { AppState, ISODate, MemberId, Stage } from '../types'

// ── 독감 (seasonal) ─────────────────────────────────────────

/** The roadmap row: 올해 독감 접종 맞기 (who: partner, season: 'flu'). */
export const PARTNER_FLU_ID = 'partner-flu'

/** The seasons a roadmap row may follow (lib/content/data/roadmap.json `season`). */
export type SeasonKind = 'flu'
export const SEASON_KINDS: readonly SeasonKind[] = ['flu']

/** The month a flu 절기 starts in (vaccination opens in late September). */
const FLU_SEASON_FIRST_MONTH = 9

/**
 * The days the flu row shows, by stage ('MM-DD'; `nextYear`: the end falls in
 * the 절기's second year). No entry → the row is not shown in that stage.
 */
export const FLU_WINDOWS: Readonly<Partial<Record<Stage, { from: string; to: string; nextYear: boolean }>>> = {
  preparing: { from: '10-01', to: '12-31', nextYear: false },
  pregnant: { from: '10-01', to: '04-30', nextYear: true },
}

export interface SeasonWindow {
  /** '2026-27' */
  season: string
  start: ISODate
  end: ISODate
}

const two = (n: number): string => String(n % 100).padStart(2, '0')

/** '2026-27' — the 절기 a day belongs to (September 1 → August 31). '' for a broken date. */
export function fluSeasonOf(date: ISODate): string {
  if (!isISODate(date)) return ''
  const { year, month } = parts(date)
  const first = month >= FLU_SEASON_FIRST_MONTH ? year : year - 1
  return `${first}-${two(first + 1)}`
}

const SEASON_RE = /^(\d{4})-(\d{2})$/

/** The stage's window in a 절기 ('2026-27'), or undefined (parenting, or a malformed season). */
export function fluWindow(stage: Stage, season: string): SeasonWindow | undefined {
  const w = FLU_WINDOWS[stage]
  const m = SEASON_RE.exec(season)
  if (!w || !m) return undefined
  const first = Number(m[1])
  if (two(first + 1) !== m[2]) return undefined
  return { season, start: `${first}-${w.from}`, end: `${w.nextYear ? first + 1 : first}-${w.to}` }
}

/** The flu window open on `today` for `stage` (inclusive), else undefined. */
export function openFluWindow(stage: Stage, today: ISODate): SeasonWindow | undefined {
  const w = fluWindow(stage, fluSeasonOf(today))
  return w && today >= w.start && today <= w.end ? w : undefined
}

/** The season id of `date` for a seasonal row of `kind`. */
export function seasonOf(kind: SeasonKind, date: ISODate): string {
  switch (kind) {
    case 'flu':
      return fluSeasonOf(date)
  }
}

/** The window of a seasonal row open on `today` (lib/logic/roadmap reads this for the `season` field). */
export function openSeasonWindow(kind: SeasonKind, stage: Stage, today: ISODate): SeasonWindow | undefined {
  switch (kind) {
    case 'flu':
      return openFluWindow(stage, today)
  }
}

/** planDone key of a seasonal row's tick in one season: 'partner-flu:2026-27'. */
export function seasonDoneKey(id: string, season: string): string {
  return `${id}:${season}`
}

/** Is this planDone key the flu row's tick (any season)? For naming the line in her weekly digest. */
export function isFluDoneKey(key: string): boolean {
  return key.startsWith(`${PARTNER_FLU_ID}:`) && SEASON_RE.test(key.slice(PARTNER_FLU_ID.length + 1))
}

/** The flu tick of the 절기 `today` falls in (whatever the stage), if any. */
export function fluDone(planDone: AppState['planDone'], today: ISODate): { at: ISODate; by?: MemberId } | undefined {
  const season = fluSeasonOf(today)
  return season ? planDone[seasonDoneKey(PARTNER_FLU_ID, season)] : undefined
}

// ── Days from the due date / the birth ──────────────────────

/** Tdap (p3-partner-tdap): when the window opens and once more three weeks before the due date. */
export const TDAP_NOTICE_OFFSETS = [-60, -21] as const
/** 배우자 출산휴가 (birth-partner-leave) may be taken from 50 days before the due date. */
export const PARTNER_LEAVE_OPEN_OFFSET = -50
/** …and until 출생 후 120일: the birth day + 119 (the birth day counted as day 1). */
export const PARTNER_LEAVE_LAST_OFFSET = 119
/** His reminders before that last day (days left), legal D-1 included. */
export const PARTNER_LEAVE_REMINDER_DAYS = [30, 7, 1] as const
/** 산후도우미 신청 (p3-postnatal-care) opens 40 days before the due date. */
export const POSTNATAL_CARE_OPEN_OFFSET = -40
/** 아빠 마음, asked once: the birth day + 90. */
export const DAD_MIND_OFFSET = 90
/**
 * …and no later than the birth day + 364 (the first year, the birth day
 * counted as day 1): the research covers up to 12 months after the birth
 * (medical.json 'paternal-perinatal-depression', Cameron 2016). After it the
 * card, the notice and the link's flag all stop.
 */
export const DAD_MIND_LAST_OFFSET = 364
/** The 정액검사 준비 check: 7 days before the booked day (or at booking, when it is sooner). */
export const TEST_PREP_NOTICE_DAYS = 7

/** 난임치료휴가 유급 4일 (treatments.PAID_LEAVE_CHANGE): his one notice, on a first open inside these days (clinic mode). */
export const INFERTILITY_LEAVE_NOTICE = { from: '2026-11-27', until: '2026-12-10' } as const

/** A day counted from the due date. */
export function fromDue(due: ISODate, offset: number): ISODate {
  return addDays(due, offset)
}

/** A day counted from the birth day. */
export function fromBirth(birth: ISODate, offset: number): ISODate {
  return addDays(birth, offset)
}

/** The days his two Tdap notices are due: [예정일 −60, 예정일 −21]. */
export function tdapNoticeDays(due: ISODate): ISODate[] {
  return TDAP_NOTICE_OFFSETS.map((o) => addDays(due, o))
}

/** The first day 배우자 출산휴가 may be taken (예정일 −50). */
export function partnerLeaveOpens(due: ISODate): ISODate {
  return addDays(due, PARTNER_LEAVE_OPEN_OFFSET)
}

/**
 * The last day 배우자 출산휴가 may be used: the real birth day + 119. Counted
 * from the birth, never the due date (an early birth moves it earlier). Show
 * it with '정확한 마지막 날은 회사나 고용센터(1350)에 확인해요' — a reading that
 * does not count the birth day gives one day more.
 */
export function partnerLeaveLastDay(birth: ISODate): ISODate {
  return addDays(birth, PARTNER_LEAVE_LAST_OFFSET)
}

/** The day 산후도우미 신청 opens (예정일 −40). */
export function postnatalCareOpens(due: ISODate): ISODate {
  return addDays(due, POSTNATAL_CARE_OPEN_OFFSET)
}

/** The day 아빠 마음 is asked (출생일 + 90). */
export function dadMindDay(birth: ISODate): ISODate {
  return addDays(birth, DAD_MIND_OFFSET)
}

/** The last day 아빠 마음 may still ask (출생일 + 364). */
export function dadMindLastDay(birth: ISODate): ISODate {
  return addDays(birth, DAD_MIND_LAST_OFFSET)
}

// ── Mondays ─────────────────────────────────────────────────

/** `d` if it is a Monday, else the Monday after it (the same weeks as checks.mondayOf). */
export function mondayOnOrAfter(d: ISODate): ISODate {
  return addDays(d, (8 - weekdayIndex(d)) % 7)
}

/**
 * The first Monday of January of `year`: after [접수가 끝났대요] the 신청 step
 * rests until this day (partnerTrack.applyClosed), and the one '새해 접수'
 * notice goes out on it (partnerNotices).
 */
export function firstMondayOfJanuary(year: number): ISODate {
  return mondayOnOrAfter(`${year}-01-01`)
}

// ── Catch-up ────────────────────────────────────────────────

/**
 * Which reminder step is due with `daysLeft` days to go: the smallest
 * threshold that is still ≥ daysLeft (D-30 · D-7 · D-1 with 20 left → 30,
 * with 5 left → 7, on the last day → 1 when 0 is not a step). Undefined before
 * the first step and after the end (daysLeft < 0). Key a notice by the step,
 * so it fires once — on the first open on or after its day — and say the real
 * days left in it.
 */
export function catchUpStep(thresholds: readonly number[], daysLeft: number): number | undefined {
  if (!Number.isFinite(daysLeft) || daysLeft < 0) return undefined
  let step: number | undefined
  for (const t of thresholds) if (t >= daysLeft && (step === undefined || t < step)) step = t
  return step
}

/** Days from `today` to `day` (negative once it has passed); undefined for a broken date. */
export function daysUntil(today: ISODate, day: ISODate): number | undefined {
  return isISODate(today) && isISODate(day) ? diffDays(today, day) : undefined
}

/** Is `today` inside [start, end] (end inclusive; no end = open from start on)? A 'window open' notice fires on the first open where this holds. */
export function insideWindow(today: ISODate, start: ISODate, end?: ISODate): boolean {
  if (!isISODate(today) || !isISODate(start)) return false
  return today >= start && (end === undefined || today <= end)
}
