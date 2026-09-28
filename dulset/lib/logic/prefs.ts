// Per-person preferences. `lowPressure` and `discreet` used to be couple-wide;
// each partner now decides for their own phone. Everything reads them here.

import type { AppState, MemberId, Settings } from '../types'

export function lowPressureFor(settings: Pick<Settings, 'lowPressure' | 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.lowPressure ?? settings.lowPressure
}

export function discreetFor(settings: Pick<Settings, 'discreet' | 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.discreet ?? settings.discreet
}

export function setPersonalPref(
  state: AppState,
  member: MemberId,
  key: 'lowPressure' | 'discreet',
  value: boolean,
): AppState {
  const personal = { ...(state.settings.personal ?? {}) }
  personal[member] = { ...(personal[member] ?? {}), [key]: value }
  return { ...state, settings: { ...state.settings, personal } }
}

/** The cycle owner always sees their own details; the partner only when shared. */
export function canSeeCycleDetails(state: Pick<AppState, 'couple' | 'settings'>, viewer: MemberId): boolean {
  const owner = state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
  return viewer === owner || state.settings.shareCycleDetails === true
}

/** Only the person whose cycle it is logs periods, LH and pregnancy tests. */
export function canLogCycle(state: Pick<AppState, 'couple'>, viewer: MemberId): boolean {
  const owner = state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
  return viewer === owner
}

/**
 * Share the cycle details (생리일·배테기·임테기 결과) with the partner, or keep
 * to "우리의 주간" only (the default: privacy first). Only the person whose
 * cycle it is can change it; anyone else's call is a no-op.
 */
export function setShareCycleDetails(state: AppState, by: MemberId, share: boolean): AppState {
  if (!canLogCycle(state, by) || state.settings.shareCycleDetails === share) return state
  return { ...state, settings: { ...state.settings, shareCycleDetails: share } }
}

/** Settings with lowPressure / discreet resolved for one person (for view helpers). */
export function settingsFor<S extends Pick<Settings, 'lowPressure' | 'discreet' | 'personal'>>(settings: S, member: MemberId): S {
  return { ...settings, lowPressure: lowPressureFor(settings, member), discreet: discreetFor(settings, member) }
}
