// Per-person preferences. `lowPressure` and `discreet` used to be couple-wide;
// each partner now decides for their own phone. Everything reads them here.
// (`hideCover` — the cover photo on my phone — is read and set in ./cover.ts.)
// Also the couple's one answer about LH strips (settings.usesLH, N17).

import type { AppState, MemberId, Settings } from '../types'

// ── 배란테스트기 (LH) ────────────────────────────────────────

export type UsesLH = NonNullable<Settings['usesLH']>

/** [써요][안 써요][나중에] — the one question about 배란테스트기. */
export const USES_LH_OPTIONS: ReadonlyArray<{ value: UsesLH; label: string }> = [
  { value: true, label: '써요' },
  { value: false, label: '안 써요' },
  { value: 'later', label: '나중에' },
]

/**
 * Should the app bring LH strips up at all — the home's 'LH 테스트 시작 D-N'
 * card and LH as the primary action, the sheet's default chip? Only an
 * explicit '안 써요' turns that off; unanswered and '나중에' keep it (the sheet
 * asks at the first LH moment — logs.lhAskDue). Logging LH stays possible
 * either way: the panel is the owner's own tool.
 */
export function lhPrompting(state: Pick<AppState, 'settings'>): boolean {
  return state.settings.usesLH !== false
}

/**
 * Answer the question (undefined clears it, so it is asked again). The cycle
 * owner's answer is the one that counts: with `by` given, anyone else's is a no-op.
 */
export function setUsesLH(state: AppState, value: UsesLH | undefined, by?: MemberId): AppState {
  if (by && !canLogCycle(state, by)) return state
  if (state.settings.usesLH === value) return state
  const settings = { ...state.settings }
  if (value === undefined) delete settings.usesLH
  else settings.usesLH = value
  return { ...state, settings }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** 'HH:MM' this person usually tests LH at (a note for now; local reminders come with the app). */
export function lhTestTimeFor(settings: Pick<Settings, 'personal'>, member: MemberId): string | undefined {
  return settings.personal?.[member]?.lhTestTime
}

/** Set (or clear, with undefined or a malformed value) the person's usual LH test time. */
export function setLHTestTime(state: AppState, member: MemberId, time: string | undefined): AppState {
  const valid = typeof time === 'string' && TIME_RE.test(time) ? time : undefined
  if (lhTestTimeFor(state.settings, member) === valid) return state
  const personal = { ...(state.settings.personal ?? {}) }
  const mine = { ...(personal[member] ?? {}) }
  if (valid) mine.lhTestTime = valid
  else delete mine.lhTestTime
  personal[member] = mine
  return { ...state, settings: { ...state.settings, personal } }
}

// ── 부담 없이 · 잠금화면 숨김 ────────────────────────────────

export function lowPressureFor(settings: Pick<Settings, 'lowPressure' | 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.lowPressure ?? settings.lowPressure
}

export function discreetFor(settings: Pick<Settings, 'discreet' | 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.discreet ?? settings.discreet
}

/**
 * The per-person switches: 부담 없이 · 잠금화면 숨김, and (Next B) 콕 받기
 * (`acceptNudges`, read with settings.acceptNudgesFor) and 잠금화면 숨김을 홈
 * 카드까지 (`homeDiscreet`, homeDiscreetFor). Same value → the same object.
 */
export type PersonalSwitch = 'lowPressure' | 'discreet' | 'acceptNudges' | 'homeDiscreet'

export function setPersonalPref(state: AppState, member: MemberId, key: PersonalSwitch, value: boolean): AppState {
  if (state.settings.personal?.[member]?.[key] === value) return state
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

// ── 링크에 표지 사진 (Next A ①) ─────────────────────────────

/**
 * Does the owner let the no-install partner link carry the cover photo's id
 * (lib/logic/partnerSnapshot.ts)? Off unless she said yes: only `true`
 * counts (settings.coverOnLink; unset = off, like a new couple).
 */
export function coverOnLink(settings: Pick<Settings, 'coverOnLink'>): boolean {
  return settings.coverOnLink === true
}

/**
 * Let the link carry the cover photo, or not (the default). The cycle
 * owner's choice, like setShareCycleDetails: anyone else's call is a no-op.
 * Off removes the field, so an older save and a new one stay byte-identical.
 */
export function setCoverOnLink(state: AppState, by: MemberId, on: boolean): AppState {
  if (!canLogCycle(state, by) || coverOnLink(state.settings) === on) return state
  const settings = { ...state.settings }
  if (on) settings.coverOnLink = true
  else delete settings.coverOnLink
  return { ...state, settings }
}

/** Settings with lowPressure / discreet resolved for one person (for view helpers). */
export function settingsFor<S extends Pick<Settings, 'lowPressure' | 'discreet' | 'personal'>>(settings: S, member: MemberId): S {
  return { ...settings, lowPressure: lowPressureFor(settings, member), discreet: discreetFor(settings, member) }
}
