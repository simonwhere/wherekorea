// Trying-to-conceive states that sit on top of the cycle (pure):
// • positivePending — a positive home test, not yet confirmed at the clinic.
//   No celebration yet; confirming moves to the pregnancy stage.
// • restCycle — "이번 주기는 쉬어요" (or after a live vaccine / a loss):
//   fertile display and alerts pause until the next period is logged.

import type { AppState, ISODate, RestCycle } from '../types'

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
 * Call after a period start is logged. A new period ends a rest cycle that
 * began before it, and quietly clears a positive test that wasn't confirmed
 * (it may have been an early loss — the UI stays gentle, no questions asked).
 */
export function onPeriodLogged(state: AppState, start: ISODate): AppState {
  let s = state
  if (s.restCycle && s.restCycle.since < start) s = endRestCycle(s)
  if (s.positivePending && s.positivePending.since <= start) s = clearPositivePending(s)
  return s
}

export function isResting(state: Pick<AppState, 'restCycle'>): boolean {
  return !!state.restCycle
}
