// 관계일 기록 (Next B) — the cycle owner's own, after a separate consent. Pure.
//
// `state.intimacy = { consentAt, by, days }` exists only after the owner said
// yes (giveIntimacyConsent). The holder (`by`) is the only person who can mark
// days and the only person who ever sees them: intimacyDays returns [] for
// anyone else, and stripIntimacy removes the whole record from anything the
// partner's phone may hold (the lib/logic/personalLog.ts stateForViewer
// pattern — that function must call stripIntimacy too). Revoking deletes
// everything. The days are a diary, not an input: nothing here (or anywhere)
// predicts, scores or suggests from them.

import { isISODate } from '../dates'
import type { AppState, ISODate, Intimacy, MemberId } from '../types'
import { canLogCycle } from './prefs'

type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const isMemberId = (v: unknown): v is MemberId => v === 'a' || v === 'b'

function sortedUnique(days: readonly ISODate[]): ISODate[] {
  return [...new Set(days)].sort()
}

/**
 * The strict shape of the record (a backup, an older save): a real consent
 * date and a holder 'a' | 'b' are required (no consent → no record); days are
 * real dates, unique, sorted. Anything else is dropped.
 */
export function cleanIntimacy(raw: unknown): Intimacy | undefined {
  if (!isObj(raw) || !isISODate(raw.consentAt) || !isMemberId(raw.by)) return undefined
  const days = Array.isArray(raw.days) ? sortedUnique(raw.days.filter(isISODate)) : []
  return { consentAt: raw.consentAt, by: raw.by, days }
}

/** Who gave the consent (and owns the days), if anyone. */
export function intimacyHolder(state: Pick<AppState, 'intimacy'>): MemberId | undefined {
  return state.intimacy?.by
}

export function hasIntimacyConsent(state: Pick<AppState, 'intimacy'>): boolean {
  return state.intimacy !== undefined
}

/** Only the holder sees the record. */
export function canSeeIntimacy(state: Pick<AppState, 'intimacy'>, viewer: MemberId): boolean {
  return state.intimacy?.by === viewer
}

/**
 * The owner says yes. Only the person whose cycle it is can (canLogCycle);
 * anyone else's call, a bad date, or a record that already exists is a no-op.
 */
export function giveIntimacyConsent(state: AppState, by: MemberId, today: ISODate): AppState {
  if (state.intimacy || !isISODate(today) || !canLogCycle(state, by)) return state
  return { ...state, intimacy: { consentAt: today, by, days: [] } }
}

/** Take the consent back: the record and every day in it are deleted. */
export function revokeIntimacy(state: AppState): AppState {
  if (!state.intimacy) return state
  const { intimacy: _gone, ...rest } = state
  return rest
}

/**
 * Mark or unmark one day. Only the consent holder, and only while they are
 * still the cycle owner; a bad date, or (when `today` is given) a day in the
 * future, is a no-op.
 */
export function toggleIntimacyDay(state: AppState, by: MemberId, date: ISODate, today?: ISODate): AppState {
  const rec = state.intimacy
  if (!rec || rec.by !== by || !canLogCycle(state, by) || !isISODate(date)) return state
  if (today !== undefined && date > today) return state
  const days = rec.days.includes(date) ? rec.days.filter((d) => d !== date) : sortedUnique([...rec.days, date])
  return { ...state, intimacy: { ...rec, days } }
}

/** The holder's days (sorted copy); [] for anyone else. */
export function intimacyDays(state: Pick<AppState, 'intimacy'>, viewer: MemberId): ISODate[] {
  return canSeeIntimacy(state, viewer) ? [...state.intimacy!.days] : []
}

export function isIntimacyDay(state: Pick<AppState, 'intimacy'>, viewer: MemberId, date: ISODate): boolean {
  return canSeeIntimacy(state, viewer) && state.intimacy!.days.includes(date)
}

/**
 * The state as anything shared with `viewer` may hold it: the record stays
 * only for its holder. For stateForViewer (lib/logic/personalLog.ts) and any
 * export or link made for the other member.
 */
export function stripIntimacy<S extends Pick<AppState, 'intimacy'>>(state: S, viewer: MemberId): S {
  if (!state.intimacy || state.intimacy.by === viewer) return state
  const { intimacy: _gone, ...rest } = state
  return rest as S
}
