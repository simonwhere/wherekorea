// Each person's own log — 본인만 보기 (N11), pure helpers.
//
// `state.personalLog[member][date]` holds how that person felt that day (a
// feel chip for the 기다리는 주) and a private line. It belongs to that member
// alone: the other member never sees it — not on their screen, not in anything
// shared or exported to them (stateForViewer strips it) — while a backup keeps
// it, because it is the owner's own data. Nothing here predicts or analyses:
// the calendar may show one dot, the next period's day-1 card may say
// "지난 주기 컨디션 기록 N개", and that is all.
//
// Diary entries can also be '나만 보기' (DiaryEntry.privateTo): canSeeEntry /
// visibleEntries decide who sees them, setEntryPrivacy flips it (author only).

import { isISODate } from '../dates'
import { stripIntimacy } from './intimacy'
import {
  MEMBER_IDS,
  PERSONAL_FEELS,
  type AppState,
  type DiaryEntry,
  type ISODate,
  type MemberId,
  type PersonalDay,
  type PersonalFeel,
  type PersonalLog,
} from '../types'

export { PERSONAL_FEELS }

/** Longest private line. */
export const PERSONAL_NOTE_MAX = 140

/**
 * Chip labels for the owner's own screen (never shown to the partner, so
 * plain words are fine). 'spotting' stays descriptive — no 착상혈 and no
 * reading of what it means.
 */
export const FEEL_LABEL: Record<PersonalFeel, string> = {
  normal: '평소 같아요',
  tired: '피곤해요',
  sensitive: '예민해요',
  breast: '가슴이 아파요',
  cramps: '아랫배가 당겨요',
  spotting: '살짝 비쳤어요',
  nausea: '메스꺼워요',
}

export function isPersonalFeel(value: unknown): value is PersonalFeel {
  return typeof value === 'string' && (PERSONAL_FEELS as readonly string[]).includes(value)
}

/** A private line as it is stored: trimmed, at most PERSONAL_NOTE_MAX characters; '' when empty. */
export function cleanPrivateNote(note: string | undefined): string {
  return (note ?? '').trim().slice(0, PERSONAL_NOTE_MAX)
}

/**
 * The strict shape of a personal log (a backup, an older save): members 'a'
 * and 'b' only, real dates, known feels, text notes cut to the limit. Days
 * with nothing left, then members with no days, are dropped; undefined when
 * nothing remains — so a canonical state (setFeel / setPrivateNote never leave
 * empty containers) passes through unchanged.
 */
export function cleanPersonalLog(raw: unknown): PersonalLog | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: PersonalLog = {}
  for (const id of MEMBER_IDS) {
    const days = (raw as Record<string, unknown>)[id]
    if (!days || typeof days !== 'object' || Array.isArray(days)) continue
    const clean: Record<ISODate, PersonalDay> = {}
    for (const [date, day] of Object.entries(days as Record<string, unknown>)) {
      if (!isISODate(date) || !day || typeof day !== 'object' || Array.isArray(day)) continue
      const d = day as Record<string, unknown>
      const entry: PersonalDay = {}
      if (isPersonalFeel(d.feel)) entry.feel = d.feel
      if (typeof d.note === 'string') {
        const note = cleanPrivateNote(d.note)
        if (note) entry.note = note
      }
      if (entry.feel !== undefined || entry.note !== undefined) clean[date] = entry
    }
    if (Object.keys(clean).length) out[id] = clean
  }
  return Object.keys(out).length ? out : undefined
}

/** That member's own record for a day (undefined when nothing was logged). */
export function personalDay(state: Pick<AppState, 'personalLog'>, member: MemberId, date: ISODate): PersonalDay | undefined {
  return state.personalLog?.[member]?.[date]
}

/**
 * Replace one day of one member's log with `patch(current)`; a day left empty
 * disappears, as does a member with no days and a log with no members — so
 * the state never carries empty containers.
 */
function withDay(
  state: AppState,
  member: MemberId,
  date: ISODate,
  patch: (current: PersonalDay) => PersonalDay,
): AppState {
  if (!isISODate(date)) return state
  const current = personalDay(state, member, date) ?? {}
  const next = patch(current)
  // Nothing changed (same feel, same note) → the same state object.
  if (next.feel === current.feel && next.note === current.note) return state
  const days: Record<ISODate, PersonalDay> = { ...(state.personalLog?.[member] ?? {}) }
  if (next.feel !== undefined || next.note !== undefined) days[date] = next
  else delete days[date]
  const log: PersonalLog = { ...(state.personalLog ?? {}) }
  if (Object.keys(days).length) log[member] = days
  else delete log[member]
  if (Object.keys(log).length) return { ...state, personalLog: log }
  const { personalLog: _gone, ...rest } = state
  return rest
}

/** Set (or, with undefined, clear) how `member` felt on `date`. An unknown feel is ignored. */
export function setFeel(state: AppState, member: MemberId, date: ISODate, feel: PersonalFeel | undefined): AppState {
  if (feel !== undefined && !isPersonalFeel(feel)) return state
  return withDay(state, member, date, (d) => {
    const { feel: _old, ...rest } = d
    return feel === undefined ? rest : { ...rest, feel }
  })
}

/** Set (or, with an empty / undefined text, clear) `member`'s private line on `date`. */
export function setPrivateNote(state: AppState, member: MemberId, date: ISODate, note: string | undefined): AppState {
  const text = cleanPrivateNote(note)
  return withDay(state, member, date, (d) => {
    const { note: _old, ...rest } = d
    return text ? { ...rest, note: text } : rest
  })
}

export interface PersonalDayEntry extends PersonalDay {
  date: ISODate
}

/** `member`'s own days in [from, to], oldest first. */
export function personalDays(state: Pick<AppState, 'personalLog'>, member: MemberId, from: ISODate, to: ISODate): PersonalDayEntry[] {
  const days = state.personalLog?.[member]
  if (!days) return []
  return Object.entries(days)
    .filter(([date]) => date >= from && date <= to)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([date, day]) => ({ date, ...day }))
}

/**
 * The feel chips `member` logged in one cycle — [cycleStart, cycleEnd], where
 * cycleEnd is the day before the next period — for "지난 주기 컨디션 기록 N개"
 * on the next period's day-1 card. Days with only a note don't count.
 */
export function lastCycleFeels(
  state: Pick<AppState, 'personalLog'>,
  member: MemberId,
  cycleStart: ISODate,
  cycleEnd: ISODate,
): PersonalDayEntry[] {
  return personalDays(state, member, cycleStart, cycleEnd).filter((d) => d.feel !== undefined)
}

/** How many days of each feel, for a small summary ('피곤해요 3일 · 가슴이 아파요 2일'). */
export function countFeels(entries: ReadonlyArray<Pick<PersonalDay, 'feel'>>): Partial<Record<PersonalFeel, number>> {
  const out: Partial<Record<PersonalFeel, number>> = {}
  for (const e of entries) if (e.feel) out[e.feel] = (out[e.feel] ?? 0) + 1
  return out
}

// ── '나만 보기' diary entries ────────────────────────────────

/** A '나만 보기' entry is only for the member it is private to. */
export function canSeeEntry(entry: Pick<DiaryEntry, 'privateTo'>, viewer: MemberId): boolean {
  return entry.privateTo === undefined || entry.privateTo === viewer
}

/** The entries `viewer` may see (everything but the other member's '나만 보기' entries). */
export function visibleEntries<E extends Pick<DiaryEntry, 'privateTo'>>(entries: readonly E[], viewer: MemberId): E[] {
  return entries.filter((e) => canSeeEntry(e, viewer))
}

/**
 * Make an entry '나만 보기' (private to its author) or shared again. Only the
 * author can change it; anyone else's call, or an unknown id, is a no-op.
 */
export function setEntryPrivacy(state: AppState, id: string, by: MemberId, privateOnly: boolean): AppState {
  const entry = state.diary.find((e) => e.id === id)
  if (!entry || entry.author !== by) return state
  if (privateOnly ? entry.privateTo === by : entry.privateTo === undefined) return state
  return {
    ...state,
    diary: state.diary.map((e) => {
      if (e.id !== id) return e
      const { privateTo: _old, ...rest } = e
      return privateOnly ? { ...rest, privateTo: by } : rest
    }),
  }
}

/**
 * The state as the other phone (or anything shared with `viewer` — a link, an
 * export) may hold it: only `viewer`'s own personal log, none of the other
 * member's '나만 보기' entries, and the 관계일 record only for its holder
 * (lib/logic/intimacy.ts stripIntimacy). Cycle details are a separate
 * question (lib/logic/calendarView.ts cycleLens) — this covers what is
 * owner-only by design.
 */
export function stateForViewer(state: AppState, viewer: MemberId): AppState {
  const own = state.personalLog?.[viewer]
  const { personalLog: _all, ...rest } = stripIntimacy(state, viewer)
  return {
    ...rest,
    ...(own && Object.keys(own).length ? { personalLog: { [viewer]: own } } : {}),
    diary: visibleEntries(state.diary, viewer),
  }
}
