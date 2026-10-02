// Trying-to-conceive states that sit on top of the cycle (pure):
// • positivePending — a positive home test, not yet confirmed at the clinic.
//   No celebration yet; confirming moves to the pregnancy stage.
// • restCycle — "이번 주기는 쉬어요" (or after a live vaccine / a loss):
//   fertile display and alerts pause until the next period is logged.
//   After a live vaccine (MMR·수두) the pause lasts until the first period that
//   starts at least LIVE_VACCINE_REST_DAYS after the shot, since the guidance
//   is to put off pregnancy for 4 weeks (MMR) / 1 month per dose (수두)
//   (질병관리청·CDC, docs/research/medical-checklist.json).
//   After a pregnancy ended (Next B, 'loss' with `until`): the quiet lasts the
//   whole QUIET_DAYS_AFTER_END — a period logged inside it does NOT end it
//   (docs/review-realuse.md P-11; the first period usually comes in 4–6 weeks,
//   docs/research/after-loss.json 'period-return'), and it ends on its own once
//   `until` has passed, or when she turns it off.

import { diffDays, isISODate } from '../dates'
import type { AppState, ISODate, PositivePending, RestCycle } from '../types'
import { quietEndsOn } from './pregnancy'

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

// ── 'loss': the quiet after a pregnancy ended ───────────────

/**
 * The last day of the quiet after a pregnancy ended on `endedAt`: the 42nd
 * day counted the Korean way (the day it ended is day 1), so it lines up with
 * pregnancy.recentlyEnded and the cover's quiet weeks (pregnancy.quietEndsOn).
 */
export function lossRestUntil(endedAt: ISODate): ISODate {
  return quietEndsOn(endedAt)
}

/**
 * Start the quiet after a pregnancy ended: a 'loss' rest from `endedAt` to
 * lossRestUntil(endedAt). pregnancy.backToPreparing starts the same rest on
 * its own (so every 준비로 돌아가기 path gets it); this is for a state that
 * lost it (an old save, 쉬어요 turned off and on again). Replaces any other
 * rest; a bad date is a no-op.
 */
export function startLossRest(state: AppState, endedAt: ISODate): AppState {
  if (!isISODate(endedAt)) return state
  return { ...state, restCycle: { since: endedAt, reason: 'loss', until: lossRestUntil(endedAt) } }
}

/** Has the pause's last day (`until`) gone by? Only a rest with `until` ever expires on its own. */
export function restExpired(rest: Pick<RestCycle, 'until'>, today: ISODate): boolean {
  return rest.until !== undefined && today > rest.until
}

/**
 * Does a period starting on `start` end this rest cycle? Never for 'clinic'
 * (병원과 함께 준비 중, lib/logic/clinic.ts): clinics ask for a 생리 2~3일째
 * visit, so periods are logged on the way to the next cycle — only the couple
 * ends it. A 'loss' rest with `until` keeps its quiet: only a period that
 * starts after `until` ends it (one inside the quiet is logged and kept, and
 * the dates come back when the quiet is over).
 */
export function periodEndsRest(rest: RestCycle, start: ISODate): boolean {
  if (rest.reason === 'clinic') return false
  if (!(rest.since < start)) return false
  if (rest.reason === 'vaccine') return diffDays(rest.since, start) >= LIVE_VACCINE_REST_DAYS
  if (rest.reason === 'loss' && rest.until !== undefined) return start > rest.until
  return true
}

/**
 * Call after a period start is logged. A new period ends a rest cycle that
 * began before it (a vaccine rest only once the month has passed, a loss rest
 * only after its quiet), and quietly clears a positive test that wasn't
 * confirmed (it may have been an early loss — the UI stays gentle, no
 * questions asked).
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
 * somewhere that didn't call onPeriodLogged. With `today`, a rest whose
 * `until` has passed (a 'loss' quiet) is over too, period or not; a caller
 * without `today` sees it until a period after `until` is logged (so screens
 * that can't know the day err on the quiet side).
 */
export function activeRest(state: Pick<AppState, 'restCycle' | 'periods'>, today?: ISODate): RestCycle | undefined {
  const r = state.restCycle
  if (!r) return undefined
  if (today !== undefined && restExpired(r, today)) return undefined
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
