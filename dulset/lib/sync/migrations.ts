// Schema migrations for the saved state (pure, ordered, idempotent).
//
// lib/storage.ts parseState runs them after normalize and before
// sanitizeBackup: `migrate(state)` applies every step from the state's
// `schemaVersion` (1 when the field is missing — every save before Next A)
// up to SCHEMA_VERSION and stamps the number. Each step is a pure
// (state) => state; running the chain twice gives the same bytes, so a
// backup that already is at the current version passes through untouched.
//
// Adding a version: bump SCHEMA_VERSION, append { from: N, to: N + 1, up }
// here, and add the new field in the usual five places (lib/types.ts,
// lib/initial.ts, storage.normalize, settings.sanitizeBackup, lib/demo.ts).

import type { AppState, ISODateTime, SyncMarks } from '../types'
import { decisionsFromNotifications, ensureRecordIds, isDecisionStub, isRecord, isStamp } from './model'

/** The shape every state is brought to. */
export const SCHEMA_VERSION = 3

export interface Migration {
  from: number
  to: number
  up: (state: AppState) => AppState
}

/** The version a saved state is at: its `schemaVersion`, or 1 for a save from before the field. */
export function schemaVersionOf(state: Partial<Pick<AppState, 'schemaVersion'>>): number {
  const v = state.schemaVersion
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1
}

/**
 * v1 → v2 (Next A ③ prep):
 *  • periods / lhTests get deterministic ids (lib/sync/model.ts);
 *  • every record that will sync gets a lower-bound `updatedAt` when it has
 *    none: the moment the couple's space was created — never later than any
 *    real edit, so a stamped copy from the other phone always wins;
 *  • the decisions that lived as dismissed notification stubs are copied into
 *    `decisions` (the stubs themselves go in v3).
 */
function v1to2(state: AppState): AppState {
  const withIds = ensureRecordIds(state)
  const at = legacyStamp(state)
  // A damaged entry (not an object) passes through for sanitizeBackup to drop.
  const stamp = <R extends SyncMarks>(list: readonly R[] | undefined): R[] | undefined =>
    list?.map((r) => (isRecord(r) && r.updatedAt === undefined ? { ...r, updatedAt: at } : r))
  const decisions = { ...decisionsFromNotifications(state.notifications), ...(state.decisions ?? {}) }
  return {
    ...withIds,
    periods: stamp(withIds.periods) ?? [],
    lhTests: stamp(withIds.lhTests) ?? [],
    pregnancyTests: stamp(withIds.pregnancyTests) ?? [],
    appointments: stamp(withIds.appointments) ?? [],
    diary: stamp(withIds.diary) ?? [],
    customTasks: stamp(withIds.customTasks) ?? [],
    ...(withIds.treatments ? { treatments: stamp(withIds.treatments) } : {}),
    decisions,
  }
}

/**
 * v2 → v3 (Next A ① integration):
 *  • every reader and writer of a decision now goes through model.decided /
 *    decide, so the dismissed notification stubs that only remembered one
 *    (알렸어요 / 괜찮아요 / 생백신 제안 닫음 / a partner-link event applied)
 *    are copied into `decisions` once more — in case a v2 save was written
 *    between the two steps — and dropped. The real notices (the calm note
 *    the partner got) stay in his inbox;
 *  • the prototype's two-tab rebase marks (`sync`) leave the state for the
 *    lib/storage.ts sidecar, so a backup holds records only.
 */
function v2to3(state: AppState): AppState {
  const decisions = { ...decisionsFromNotifications(state.notifications), ...(state.decisions ?? {}) }
  const kept = state.notifications.filter((n) => !(isRecord(n) && isDecisionStub(n)))
  const { sync: _sync, ...rest } = state as AppState & { sync?: unknown }
  return { ...rest, notifications: kept.length === state.notifications.length ? state.notifications : kept, decisions }
}

/**
 * The lower-bound stamp legacy records get: the space's createdAt when it is
 * a real stamp (local-offset form), else the first moment of its day, else
 * the epoch of this app — anything a real edit is certainly later than.
 */
export function legacyStamp(state: Pick<AppState, 'createdAt'>): ISODateTime {
  const c = state.createdAt
  if (isStamp(c)) return c.length >= 19 ? c : `${c.slice(0, 10)}T00:00:00`
  return '2026-01-01T00:00:00'
}

export const MIGRATIONS: readonly Migration[] = [
  { from: 1, to: 2, up: v1to2 },
  { from: 2, to: 3, up: v2to3 },
]

/**
 * Bring a parsed state to SCHEMA_VERSION. A state already there (or beyond —
 * a backup from a newer app, kept as is) comes back as the same object.
 */
export function migrate(state: AppState, migrations: readonly Migration[] = MIGRATIONS): AppState {
  let version = schemaVersionOf(state)
  if (version >= SCHEMA_VERSION && state.schemaVersion === version) return state
  let next = state
  for (const m of migrations) {
    if (m.from !== version) continue
    next = m.up(next)
    version = m.to
  }
  return { ...next, schemaVersion: version }
}
