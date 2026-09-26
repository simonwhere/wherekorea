// Pregnancy dating (pure). Gestational age is counted from the first day of the
// last menstrual period (LMP); Naegele's rule puts the due date at LMP + 280 days.

import { addDays, diffDays } from '../dates'
import type { AppState, Baby, ISODate, Pregnancy } from '../types'

export const PREGNANCY_DAYS = 280

export function dueDate(p: Pregnancy): ISODate {
  return p.dueDateOverride ?? addDays(p.lmp, PREGNANCY_DAYS)
}

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

export function startPregnancy(state: AppState, lmp: ISODate, today: ISODate, dueDateOverride?: ISODate): AppState {
  return {
    ...state,
    stage: 'pregnant',
    pregnancy: { lmp, dueDateOverride, confirmedAt: today },
  }
}

export function updatePregnancy(state: AppState, patch: Partial<Pregnancy>): AppState {
  if (!state.pregnancy) return state
  return { ...state, pregnancy: { ...state.pregnancy, ...patch } }
}

export function recordBirth(state: AppState, baby: Baby): AppState {
  return { ...state, stage: 'parenting', baby }
}

/** Go back to preparing (e.g. after a loss). Keeps all history. */
export function backToPreparing(state: AppState): AppState {
  return { ...state, stage: 'preparing' }
}
