// Pregnancy dating (pure). Gestational age is counted from the first day of the
// last menstrual period (LMP); Naegele's rule puts the due date at LMP + 280 days.

import { addDays, diffDays, isISODate } from '../dates'
import type { AppState, Baby, ISODate, Pregnancy } from '../types'

export const PREGNANCY_DAYS = 280
/** Longest pregnancy we accept when dating from an LMP (44 weeks). Every LMP field uses it. */
export const MAX_GESTATION_DAYS = 308

export function dueDate(p: Pregnancy): ISODate {
  return p.dueDateOverride ?? addDays(p.lmp, PREGNANCY_DAYS)
}

/**
 * Names the pregnancy in a notice key (partnerNotices: 'tdap:<tag>:…',
 * 'partner-leave-open:<tag>:…', 'postnatal-open:<tag>:…'): the day it was
 * recorded (confirmedAt — the stage switch both see), never the LMP or the due
 * date. A record whose confirmedAt is missing or not after the LMP (a repaired
 * backup copies the LMP in) gets '0'. Lives here, not in partnerNotices (which
 * imports this file), so backToPreparing can settle those notices.
 */
export function pregnancyTag(p: Pick<Pregnancy, 'lmp' | 'confirmedAt'>): string {
  return isISODate(p.confirmedAt) && isISODate(p.lmp) && p.confirmedAt > p.lmp ? p.confirmedAt : '0'
}

/** The check-point notices tied to one pregnancy (by pregnancyTag), settled when it ends. */
export const PREGNANCY_NOTICE_PREFIXES = ['tdap:', 'partner-leave-open:', 'postnatal-open:'] as const

export interface GestationalAge {
  /** Completed weeks (임신 N주). */
  weeks: number
  /** Extra days (N주 M일). */
  days: number
  totalDays: number
  trimester: 1 | 2 | 3
  /** Days until the due date (negative once past). */
  daysToDue: number
  /** 0–1 progress through 40 weeks. */
  progress: number
}

/**
 * Uses the due date as the anchor, so a doctor-adjusted due date shifts the
 * week count too (as it does on ultrasound-based dating).
 */
export function gestationalAge(p: Pregnancy, today: ISODate): GestationalAge {
  const due = dueDate(p)
  const totalDays = PREGNANCY_DAYS - diffDays(today, due)
  const safe = Math.max(0, totalDays)
  const weeks = Math.floor(safe / 7)
  const trimester: 1 | 2 | 3 = weeks < 14 ? 1 : weeks < 28 ? 2 : 3
  return {
    weeks,
    days: safe % 7,
    totalDays,
    trimester,
    daysToDue: diffDays(today, due),
    progress: Math.min(1, Math.max(0, totalDays / PREGNANCY_DAYS)),
  }
}

export function formatGA(ga: Pick<GestationalAge, 'weeks' | 'days'>): string {
  return ga.days ? `${ga.weeks}주 ${ga.days}일` : `${ga.weeks}주`
}

// ── Stage transitions (pure) ────────────────────────────────
//
// Each transition only applies from the stage it belongs to, so a sheet left
// open on the other phone can't overwrite a pregnancy or baby record that the
// partner has already entered (the state is shared).

/** Whether a new pregnancy can be recorded: preparing, or 'pregnant' without a record yet. */
export function canStartPregnancy(state: Pick<AppState, 'stage' | 'pregnancy'>): boolean {
  return state.stage === 'preparing' || (state.stage === 'pregnant' && !state.pregnancy)
}

/** Whether a birth can be recorded: pregnant, or 'parenting' without a baby yet. */
export function canRecordBirth(state: Pick<AppState, 'stage' | 'baby'>): boolean {
  return state.stage === 'pregnant' || (state.stage === 'parenting' && !state.baby)
}

export function startPregnancy(state: AppState, lmp: ISODate, today: ISODate, dueDateOverride?: ISODate): AppState {
  if (!canStartPregnancy(state)) return state
  const pregnancy: Pregnancy = { lmp, confirmedAt: today }
  if (dueDateOverride) pregnancy.dueDateOverride = dueDateOverride
  return { ...state, stage: 'pregnant', pregnancy }
}

export function updatePregnancy(state: AppState, patch: Partial<Pregnancy>): AppState {
  if (!state.pregnancy) return state
  return { ...state, pregnancy: { ...state.pregnancy, ...patch } }
}

export function recordBirth(state: AppState, baby: Baby): AppState {
  if (!canRecordBirth(state)) return state
  return { ...state, stage: 'parenting', baby }
}

/**
 * After a pregnancy ended, the home screen stays gentle (no "임신했어요 🎉",
 * no specialist prompt) for this many days.
 */
export const QUIET_DAYS_AFTER_END = 42

/** The ended pregnancy (back in preparing), if it ended less than QUIET_DAYS_AFTER_END days ago. */
export function recentlyEnded(state: Pick<AppState, 'stage' | 'pregnancy'>, today: ISODate): boolean {
  const p = state.pregnancy
  if (state.stage !== 'preparing' || !p?.endedAt || !(p.endedAt > p.confirmedAt)) return false
  const since = diffDays(p.endedAt, today)
  return since >= 0 && since < QUIET_DAYS_AFTER_END
}

/**
 * The last day of the quiet after a pregnancy ended on `endedAt`: the 42nd day
 * counted the Korean way (the day it ended is day 1) — the same day
 * recentlyEnded stops and the cover's quiet weeks end. ttc.lossRestUntil is
 * this (a test keeps them equal; ttc.ts imports this file, so it lives here).
 */
export function quietEndsOn(endedAt: ISODate): ISODate {
  return addDays(endedAt, QUIET_DAYS_AFTER_END - 1)
}

/**
 * Go back to preparing (e.g. after a loss). Keeps all history, records when the
 * pregnancy ended (the "trying" clock restarts), and settles the notices about
 * that pregnancy for both members (its week notices and the check points named
 * by pregnancyTag) — kept as dismissed stubs so they aren't delivered again.
 * The quiet starts on its own (Next B, review P-11): a 'loss'
 * rest cycle from today to quietEndsOn(today), so no date estimate, LH prompt
 * or cycle notice comes for QUIET_DAYS_AFTER_END days — a period logged inside
 * it is kept but does not end it (ttc.periodEndsRest) — and the home shows the
 * support card first. She can turn it off from the home (ttcFlow.endRestFromHome).
 * today.endPregnancy is the same transition by its product name.
 */
export function backToPreparing(state: AppState, today: ISODate): AppState {
  if (state.stage !== 'pregnant') return state
  const p = state.pregnancy
  if (!p) return { ...state, stage: 'preparing' }
  // Its week and 임신 notices, and his check points named by this pregnancy (Tdap, 배우자 출산휴가
  // window, 산후도우미 — to both). Not 'flu-season:': that belongs to the 절기, not the pregnancy.
  const tag = pregnancyTag(p)
  const prefixes = [`pregnant:${p.lmp}:`, `week:${p.lmp}:`, ...PREGNANCY_NOTICE_PREFIXES.map((x) => `${x}${tag}:`)]
  const tied = (key: string | undefined) => !!key && prefixes.some((x) => key.startsWith(x))
  return {
    ...state,
    stage: 'preparing',
    pregnancy: { ...p, endedAt: today },
    restCycle: { since: today, reason: 'loss', until: quietEndsOn(today) },
    notifications: state.notifications.map((n) => (tied(n.key) ? { ...n, read: true, dismissed: true } : n)),
  }
}
