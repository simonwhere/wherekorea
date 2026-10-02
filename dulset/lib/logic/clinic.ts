// '병원과 함께 준비 중' (clinic mode, N13) — pure helpers.
//
// A clinic cycle (배란유도·인공수정·이식) has its timing set by the clinic: the
// app's own fertile estimate, LH prompts, date ideas and 우리의 주간 notices
// pause, and the home leads with the next appointment instead. It is stored
// as a rest cycle with reason 'clinic', so every screen that already respects
// a rest cycle respects it too. Unlike 'rest', it does NOT end when a period
// is logged (clinics ask for a 생리 2~3일째 visit, so periods are logged on
// the way to the next cycle): only the couple ends it here, or confirming a
// pregnancy moves the stage on.
//
// Not here (lib/logic/ttc.ts, which owns the rest rules): periodEndsRest must
// return false for 'clinic' so activeRest agrees with isClinicMode.

import { isISODate } from '../dates'
import type { AppState, ISODate, RestCycle } from '../types'

export const CLINIC_REASON: RestCycle['reason'] = 'clinic'

/** Is the couple preparing with a clinic right now? (Does not look at periods — a period never ends it.) */
export function isClinicMode(state: Pick<AppState, 'restCycle'>): boolean {
  return state.restCycle?.reason === CLINIC_REASON
}

/** The clinic rest cycle in effect, if any. */
export function clinicRest(state: Pick<AppState, 'restCycle'>): RestCycle | undefined {
  return isClinicMode(state) ? state.restCycle : undefined
}

/** The day clinic mode was turned on, if it is on. */
export function clinicSince(state: Pick<AppState, 'restCycle'>): ISODate | undefined {
  return clinicRest(state)?.since
}

/**
 * Turn clinic mode on from `since` (today, or the first visit). Replaces an
 * ordinary rest cycle (the clinic's pause covers it); already on → unchanged,
 * so toggling twice keeps the original date. A bad date is ignored.
 */
export function startClinicMode(state: AppState, since: ISODate): AppState {
  if (!isISODate(since) || isClinicMode(state)) return state
  return { ...state, restCycle: { since, reason: CLINIC_REASON } }
}

/** Turn clinic mode off. Another kind of rest cycle is left alone. */
export function endClinicMode(state: AppState): AppState {
  if (!isClinicMode(state)) return state
  const { restCycle: _r, ...rest } = state
  return rest
}

/** The settings toggle: on → startClinicMode(since), off → endClinicMode. */
export function setClinicMode(state: AppState, on: boolean, since: ISODate): AppState {
  return on ? startClinicMode(state, since) : endClinicMode(state)
}
