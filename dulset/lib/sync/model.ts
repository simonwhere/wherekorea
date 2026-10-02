// Sync-ready record model (Next A ③ prep, pure).
//
// Two phones will exchange records, so every record that travels needs a
// stable `id`, and the ones a delete must reach the other phone for carry
// `updatedAt` / `deletedAt` marks (lib/types.ts SyncMarks). This module is
// the one place that:
//  • derives a deterministic id for a legacy record that has none (periodId,
//    lhId — the record's own natural key, so both phones agree on it);
//  • stamps a change (touch) or a delete (tombstone) and filters live
//    records (liveOnly) for the day writers start keeping tombstones;
//  • keeps the cycle owner's answers that are not records (decisions:
//    알렸어요 / 괜찮아요 / 생백신 제안 닫음) — decided / decide.
//
// No clock, no randomness: callers pass `now` (stampOn(today)) and ids (uid()).
// The one writer that stamps for everyone is lib/store.tsx update(), through
// stampChanges below: whatever a pure change touched gets `updatedAt` and,
// when it is new, an id — so no writer in lib/logic needs a clock.

import { isISODate } from '../dates'
import { uid } from '../id'
import type { AppState, ISODate, ISODateTime, LHTest, PeriodLog, SyncMarks } from '../types'

// ── Deterministic ids for legacy records ────────────────────

/** The id a period logged before ids existed gets: its start date is already unique. */
export function periodId(start: ISODate): string {
  return `period:${start}`
}

/**
 * The id an LH strip logged before ids existed gets: (date, time | slot) —
 * the same key lib/logic/logs.ts lhKey keeps unique within a day. A second
 * untimed test on one day (older data) gets a '#2' suffix so ids stay unique.
 */
export function lhId(test: Pick<LHTest, 'date' | 'time' | 'slot'>): string {
  return `lh:${test.date}:${test.time ?? test.slot ?? ''}`
}

/** Append '#2', '#3' … while `id` is taken, so a derived id never collides. */
function uniqueId(id: string, taken: Set<string>): string {
  let out = id
  for (let n = 2; taken.has(out); n++) out = `${id}#${n}`
  taken.add(out)
  return out
}

/**
 * Give every period and LH strip without an id its deterministic one (ids
 * already there are kept untouched; the first pass is the last — a second
 * run returns the same object). Called by the v1 → v2 migration and by
 * sanitizeBackup, so after parseState every record has an id even when a
 * writer forgot to set one.
 */
export function ensureRecordIds<S extends Pick<AppState, 'periods' | 'lhTests'>>(state: S): S {
  let changed = false
  // A damaged entry (not an object) is left as it is for sanitizeBackup to drop.
  const idOf = (r: unknown) => (isRecord(r) ? r.id : undefined)
  const periodIds = new Set(state.periods.map(idOf).filter((id): id is string => typeof id === 'string'))
  const periods = state.periods.map((p) => {
    if (!isRecord(p) || typeof p.id === 'string') return p
    changed = true
    return { ...p, id: uniqueId(periodId(p.start), periodIds) } as PeriodLog
  })
  const lhIds = new Set(state.lhTests.map(idOf).filter((id): id is string => typeof id === 'string'))
  const lhTests = state.lhTests.map((t) => {
    if (!isRecord(t) || typeof t.id === 'string') return t
    changed = true
    return { ...t, id: uniqueId(lhId(t), lhIds) } as LHTest
  })
  return changed ? { ...state, periods, lhTests } : state
}

/** A list entry that is a record at all (a damaged save may hold null or a number). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** The id a record reads by — its own, or the deterministic one it would get. */
export function periodIdOf(p: PeriodLog): string {
  return p.id ?? periodId(p.start)
}

export function lhIdOf(t: LHTest): string {
  return t.id ?? lhId(t)
}

// ── Stamps ──────────────────────────────────────────────────

/** A local-date-prefixed timestamp (stampOn / localNowISO), or an ISO date. */
export function isStamp(value: unknown): value is ISODateTime {
  return typeof value === 'string' && value.length <= 40 && isISODate(value.slice(0, 10))
}

/** Record a change: the record with `updatedAt: now` (same object when already stamped so). */
export function touch<R extends SyncMarks>(record: R, now: ISODateTime): R {
  return record.updatedAt === now ? record : { ...record, updatedAt: now }
}

/**
 * Record a delete that must reach the other phone: the record stays, marked
 * `deletedAt` (and `updatedAt`) = now. Screens read through liveOnly().
 */
export function tombstone<R extends SyncMarks>(record: R, now: ISODateTime): R {
  return { ...record, updatedAt: now, deletedAt: now }
}

/** Not deleted (a record without marks counts as live). */
export function isLive(record: SyncMarks): boolean {
  return record.deletedAt === undefined
}

/** The records that still exist, in order (same array when nothing is deleted). */
export function liveOnly<R extends SyncMarks>(list: readonly R[]): R[] {
  return list.some((r) => !isLive(r)) ? list.filter(isLive) : (list as R[])
}

/**
 * Last-writer-wins between two copies of one record: the later `updatedAt`
 * wins, an unstamped (legacy) copy loses to a stamped one, equal stamps keep
 * `mine`. Stamps are compared as strings (local-date-prefixed, same device
 * clock convention everywhere).
 */
export function newerOf<R extends SyncMarks>(mine: R, theirs: R): R {
  const a = mine.updatedAt ?? ''
  const b = theirs.updatedAt ?? ''
  return b > a ? theirs : mine
}

// ── Decisions (answers that are not records) ────────────────

/**
 * Keys of the answers that used to live as dismissed notification stubs
 * (lib/logic/ttcFlow.ts periodToldKey · periodSkipKey · positiveToldKey ·
 * bleedingToldKey · vaccineHintKey, lib/logic/partnerEvents.ts
 * appliedEventKey). The v1 → v2 and v2 → v3 migrations copy every
 * notification with such a key into `decisions`; v3 drops the pure stubs.
 */
export const DECISION_KEY_RE = /^(period-told|positive-told|bleeding-told|rest-suggest|partner-event):/

export const DECISION_KEY_MAX = 120

/** A key decisions may hold: a short, non-empty string. */
export function isDecisionKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= DECISION_KEY_MAX
}

/**
 * Has this question been answered? True when `decisions[key]` holds a day,
 * or — for data the readers switch over before every writer does — when a
 * notification with that key exists (the legacy stub / the notice itself).
 */
export function decided(state: Pick<AppState, 'decisions' | 'notifications'>, key: string): boolean {
  if (state.decisions?.[key] !== undefined) return true
  return state.notifications.some((n) => n.key === key)
}

/** The day `key` was decided, or undefined (legacy stubs count by their day). */
export function decisionDay(state: Pick<AppState, 'decisions' | 'notifications'>, key: string): ISODate | undefined {
  const own = state.decisions?.[key]
  if (own !== undefined) return own
  const stub = state.notifications.find((n) => n.key === key)
  const day = stub?.createdAt.slice(0, 10)
  return isISODate(day) ? day : undefined
}

/**
 * Remember an answer: decisions[key] = today. The first answer stands (a
 * re-applied change or a second tap never moves the day); the same state
 * object comes back when nothing changes.
 */
export function decide<S extends Pick<AppState, 'decisions'>>(state: S, key: string, today: ISODate): S {
  if (!isDecisionKey(key) || !isISODate(today)) return state
  if (state.decisions?.[key] !== undefined) return state
  return { ...state, decisions: { ...(state.decisions ?? {}), [key]: today } }
}

/** Forget an answer (e.g. a test that was removed), so the question may be asked again. */
export function undecide<S extends Pick<AppState, 'decisions'>>(state: S, key: string): S {
  if (state.decisions?.[key] === undefined) return state
  const { [key]: _gone, ...rest } = state.decisions
  return { ...state, decisions: rest }
}

/**
 * The decisions a list of notifications implies (the pre-v2 stubs and the
 * notices that doubled as a decision): key → the day of the earliest one.
 * Pure, so the migration and tests share it.
 */
export function decisionsFromNotifications(notifications: AppState['notifications']): Record<string, ISODate> {
  const out: Record<string, ISODate> = {}
  for (const n of notifications) {
    if (!isRecord(n) || !isDecisionKey(n.key) || !DECISION_KEY_RE.test(n.key)) continue
    const day = typeof n.createdAt === 'string' ? n.createdAt.slice(0, 10) : ''
    if (!isISODate(day)) continue
    const prev = out[n.key]
    if (prev === undefined || day < prev) out[n.key] = day
  }
  return out
}

/** decisions, checked: short string keys → real days; anything else is dropped. */
export function cleanDecisions(raw: unknown): Record<string, ISODate> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ISODate> = {}
  for (const [key, day] of Object.entries(raw as Record<string, unknown>)) {
    if (isDecisionKey(key) && isISODate(day)) out[key] = day
  }
  return out
}

/**
 * A notification that only ever remembered a decision (the pre-v3 stub:
 * empty title and body, dismissed, with a decision key) — never a notice
 * someone was meant to read. v2 → v3 drops these once they are in `decisions`.
 */
export function isDecisionStub(n: Pick<AppState['notifications'][number], 'key' | 'title' | 'body' | 'dismissed'>): boolean {
  return isDecisionKey(n.key) && DECISION_KEY_RE.test(n.key) && n.title === '' && n.body === '' && n.dismissed === true
}

// ── Stamping what a change touched (lib/store.tsx update) ───

/** The lists whose records travel (lib/types.ts SyncMarks). */
export const SYNCED_LISTS = ['periods', 'lhTests', 'pregnancyTests', 'appointments', 'diary', 'customTasks', 'treatments'] as const
export type SyncedList = (typeof SYNCED_LISTS)[number]

type Rec = SyncMarks & { id?: string }

/** The natural key a record is matched by when it has no id yet (periods / LH strips of older writers). */
function naturalKey(list: SyncedList, r: Rec): string | undefined {
  if (list === 'periods') return `start:${(r as PeriodLog).start}`
  if (list === 'lhTests') {
    const t = r as LHTest
    return `lh:${t.date}:${t.time ?? t.slot ?? ''}`
  }
  return undefined
}

/** JSON with sorted keys and without the marks, so two spellings of one record compare equal. */
function content(r: Rec): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(o)
          .sort()
          .filter((k) => o[k] !== undefined)
          .map((k) => [k, sort(o[k])]),
      )
    }
    return v
  }
  const { updatedAt: _u, deletedAt: _d, id: _i, ...rest } = r
  return JSON.stringify(sort(rest))
}

function stampList<R extends Rec>(list: SyncedList, before: readonly R[], after: readonly R[], now: ISODateTime, newId: () => string): R[] {
  const same = new Set<R>(before)
  const byId = new Map<string, R>()
  const byKey = new Map<string, R>()
  for (const r of before) {
    if (typeof r.id === 'string' && !byId.has(r.id)) byId.set(r.id, r)
    const k = naturalKey(list, r)
    if (k !== undefined && !byKey.has(k)) byKey.set(k, r)
  }
  let changed = false
  const out = after.map((r) => {
    if (same.has(r)) return r
    const key = naturalKey(list, r)
    const prev = (typeof r.id === 'string' ? byId.get(r.id) : undefined) ?? (key !== undefined ? byKey.get(key) : undefined)
    if (prev && content(prev) === content(r)) {
      // Rebuilt but not changed (a spread in a map): the old record, with its stamp and id, stands.
      changed = true
      return prev
    }
    changed = true
    const id = typeof r.id === 'string' ? r.id : (prev?.id ?? newId())
    return { ...r, id, updatedAt: now } as R
  })
  return changed ? out : (after as R[])
}

/**
 * Stamp what a pure change touched: in every synced list of `next`, a record
 * that is not the same object as in `prev` gets `updatedAt: now` — and, when
 * it has no id (periods and LH strips from older writers), the id of the
 * record it replaces (matched by its natural key) or a fresh one. A record
 * rebuilt without a change keeps its old object. Lists and records the
 * change did not touch come back untouched, by reference; `next` itself when
 * nothing needed a stamp. lib/store.tsx runs this after every update(fn), so
 * no writer in lib/logic needs a clock or an id generator.
 */
export function stampChanges(prev: AppState, next: AppState, now: ISODateTime, newId: () => string = uid): AppState {
  if (prev === next) return next
  let out = next
  for (const key of SYNCED_LISTS) {
    const before = prev[key]
    const after = next[key]
    if (!after || before === after) continue
    const stamped = stampList(key, (before ?? []) as readonly Rec[], after as readonly Rec[], now, newId)
    if (stamped !== after) out = { ...out, [key]: stamped }
  }
  return out
}
