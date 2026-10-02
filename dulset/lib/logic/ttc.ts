// Trying-to-conceive states that sit on top of the cycle (pure):
// • positivePending — a positive home test, not yet confirmed at the clinic.
//   No celebration yet; confirming moves to the pregnancy stage.
// • restCycle — "이번 주기는 쉬어요" (or after a live vaccine / a loss):
//   fertile display and alerts pause until the next period is logged.
//   After a live vaccine (MMR·수두) the pause lasts until the first period that
//   starts at least LIVE_VACCINE_REST_DAYS after the shot, since the guidance
//   is to put off pregnancy for 4 weeks (MMR) / 1 month per dose (수두)
//   (질병관리청·CDC, docs/research/medical-checklist.json).

import { diffDays } from '../dates'
import type { AppState, ISODate, PositivePending, RestCycle } from '../types'

/**
 * A vaccine rest cycle only ends with a period that starts this many days or
 * more after `since` (the day of the shot): 1 month covers both MMR's 4 weeks
 * and 수두's "1개월 per dose" in every month.
 */
export const LIVE_VACCINE_REST_DAYS = 31

export function markPositivePending(state: AppState, since: ISODate, testId?: string): AppState {
  if (state.stage !== 'preparing' || state.positivePending) return state
  return { ...state, positivePending: { since, ...(testId ? { testId } : {}) } }
}

export function clearPositivePending(state: AppState): AppState {
  if (!state.positivePending) return state
  const { positivePending: _p, ...rest } = state
  return rest
}

export function startRestCycle(state: AppState, since: ISODate, reason: RestCycle['reason'] = 'rest'): AppState {
  return { ...state, restCycle: { since, reason } }
}

export function endRestCycle(state: AppState): AppState {
  if (!state.restCycle) return state
  const { restCycle: _r, ...rest } = state
  return rest
}

/**
 * Does a period starting on `start` end this rest cycle? Never for 'clinic'
 * (병원과 함께 준비 중, lib/logic/clinic.ts): clinics ask for a 생리 2~3일째
 * visit, so periods are logged on the way to the next cycle — only the couple
 * ends it.
 */
export function periodEndsRest(rest: RestCycle, start: ISODate): boolean {
  if (rest.reason === 'clinic') return false
  if (!(rest.since < start)) return false
  if (rest.reason === 'vaccine') return diffDays(rest.since, start) >= LIVE_VACCINE_REST_DAYS
  return true
}

/**
 * Call after a period start is logged. A new period ends a rest cycle that
 * began before it (a vaccine rest only once the month has passed), and quietly
 * clears a positive test that wasn't confirmed (it may have been an early
 * loss — the UI stays gentle, no questions asked).
 */
export function onPeriodLogged(state: AppState, start: ISODate): AppState {
  let s = state
  if (s.restCycle && periodEndsRest(s.restCycle, start)) s = endRestCycle(s)
  if (s.positivePending && s.positivePending.since <= start) s = clearPositivePending(s)
  return s
}

export function isResting(state: Pick<AppState, 'restCycle'>): boolean {
  return !!state.restCycle
}

/**
 * The rest cycle still in effect: the same rule as onPeriodLogged, applied to
 * every logged period — so screens stay right even if a period was logged
 * somewhere that didn't call onPeriodLogged.
 */
export function activeRest(state: Pick<AppState, 'restCycle' | 'periods'>): RestCycle | undefined {
  const r = state.restCycle
  if (!r) return undefined
  return state.periods.some((p) => periodEndsRest(r, p.start)) ? undefined : r
}

/** The positive test still awaiting the clinic (preparing only; a later period settles it). */
export function activePositivePending(
  state: Pick<AppState, 'positivePending' | 'periods' | 'stage'>,
): PositivePending | undefined {
  const p = state.positivePending
  if (!p || state.stage !== 'preparing') return undefined
  return state.periods.some((x) => x.start >= p.since) ? undefined : p
}
