// Partner events — what the no-install partner page may send BACK to the
// owner's phone (Next A ①), and how her phone applies them. Pure.
//
// The page holds a snapshot (lib/logic/partnerSnapshot.ts), never the state,
// so every tap on it becomes a small, typed event: a check ticked, a reply to
// her signal, a signal of his own, a 콕, an 응원, his month task done. Nothing
// else exists — there is no event for a period, an LH strip or a test, and a
// forged one is dropped unread (cleanPartnerEvent, partnerEventProblem). An
// event carries ids and dates only, never free text: the words always come
// from the catalogues on her phone (signals, the 콕 line, the cheer line).
//
// Her phone applies an event with the SAME pure functions the app's own
// screens use (today.toggleWithCompletion, signals.sendSignal,
// notifications.sendNudge / sendCheer, partnerTrack.completeMonthlyTask) and
// with the same gates — his items only, the one month task that is his, the
// replies that fit the signal, 콕 받기 (notifications.canNudge), the daily
// limits. Every event is applied at most once: its id is remembered in
// `decisions` ('partner-event:<id>' → the day, lib/sync/model.ts decide — an
// answer that is not a record, like 알렸어요), so a transport that delivers
// twice changes nothing the second time; marks older than EVENT_MEMORY_DAYS
// are forgotten (no transport re-delivers that late: lib/useLinkSync
// PULL_WINDOW_DAYS, supabase dulset_cleanup), so the map stays small.
// Date-bearing events ('check', 'task-done') are "set" events, not toggles,
// so even without the mark a repeat would be a no-op.

import { addDays, diffDays, isISODate } from '../dates'
import { decide, decided } from '../sync/model'
import type { AppState, ISODate, MemberId } from '../types'
import { isDone, isWeekly, nudgeableItem, weeklyDone } from './checks'
import { canNudge, sendCheer, sendNudge } from './notifications'
import { completeMonthlyTask, monthlyTask, partnerId } from './partnerTrack'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, sendSignal, signalIdOf, signalsFor, signalsSentToday } from './signals'
import { stampOn, toggleWithCompletion } from './today'

export type PartnerEventKind = 'check' | 'reply' | 'signal' | 'nudge' | 'cheer' | 'task-done'
export const PARTNER_EVENT_KINDS: readonly PartnerEventKind[] = ['check', 'reply', 'signal', 'nudge', 'cheer', 'task-done'] as const

interface EventBase {
  /** The page's own id for the event (unique per tap) — the idempotency key. */
  id: string
  /** Who sent it; when present it must be the partner (never the cycle owner). */
  from?: MemberId
}

export type PartnerEvent =
  | (EventBase & { kind: 'check'; itemId: string; date: ISODate; done: boolean })
  | (EventBase & { kind: 'reply'; signalId: string; replyId: string })
  | (EventBase & { kind: 'signal'; signalId: string })
  | (EventBase & { kind: 'nudge' })
  | (EventBase & { kind: 'cheer' })
  | (EventBase & { kind: 'task-done'; taskId: string; date: ISODate })

/** Ids are short tokens (uuid, nanoid, 'signal:…'); anything longer or stranger is not an id. */
export const EVENT_ID_MAX = 64
const ID_RE = /^[A-Za-z0-9_.:-]+$/
/** A check from the page may be dated up to this many days back (an event that arrives late). */
export const CHECK_BACK_DAYS = 7
/** The link's own cap on 응원 per day (the app has none; a link is a wider door). */
export const CHEERS_PER_DAY = 5

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= EVENT_ID_MAX && ID_RE.test(v)
const isMemberId = (v: unknown): v is MemberId => v === 'a' || v === 'b'

/**
 * The strict shape of an event as it arrives over a transport: a known kind,
 * well-formed ids and dates, and ONLY the fields that kind has — free text,
 * extra keys and unknown kinds never get through. Undefined when unusable.
 */
export function cleanPartnerEvent(raw: unknown): PartnerEvent | undefined {
  if (!isObj(raw) || !isId(raw.id)) return undefined
  const base: EventBase = { id: raw.id, ...(isMemberId(raw.from) ? { from: raw.from } : {}) }
  switch (raw.kind) {
    case 'check':
      if (!isId(raw.itemId) || !isISODate(raw.date) || typeof raw.done !== 'boolean') return undefined
      return { ...base, kind: 'check', itemId: raw.itemId, date: raw.date, done: raw.done }
    case 'reply':
      if (!isId(raw.signalId) || !isId(raw.replyId)) return undefined
      return { ...base, kind: 'reply', signalId: raw.signalId, replyId: raw.replyId }
    case 'signal':
      if (!isId(raw.signalId)) return undefined
      return { ...base, kind: 'signal', signalId: raw.signalId }
    case 'nudge':
      return { ...base, kind: 'nudge' }
    case 'cheer':
      return { ...base, kind: 'cheer' }
    case 'task-done':
      if (!isId(raw.taskId) || !isISODate(raw.date)) return undefined
      return { ...base, kind: 'task-done', taskId: raw.taskId, date: raw.date }
    default:
      return undefined
  }
}

// ── Applied-once bookkeeping ────────────────────────────────

export const appliedEventKey = (id: string): string => `partner-event:${id}`

/** Marks older than this are forgotten (every transport's re-delivery window is shorter). */
export const EVENT_MEMORY_DAYS = 30

export function hasAppliedEvent(state: Pick<AppState, 'decisions' | 'notifications'>, id: string): boolean {
  return decided(state, appliedEventKey(id))
}

/** Remember the event as applied on `today` (lib/sync/model.ts decide: the first mark stands). */
function rememberEvent(state: AppState, id: string, today: ISODate): AppState {
  return decide(state, appliedEventKey(id), today)
}

/** Drop the applied-once marks older than EVENT_MEMORY_DAYS (the same object when there are none). */
export function forgetOldEvents(state: AppState, today: ISODate): AppState {
  const cutoff = addDays(today, -EVENT_MEMORY_DAYS)
  const old = Object.entries(state.decisions ?? {}).filter(([k, day]) => k.startsWith('partner-event:') && day < cutoff)
  if (!old.length) return state
  const decisions = { ...state.decisions }
  for (const [k] of old) delete decisions[k]
  return { ...state, decisions }
}

// ── Gates ───────────────────────────────────────────────────

export type EventProblem =
  /** Already applied (its id is remembered). */
  | 'applied'
  /** `from` is not the partner. */
  | 'actor'
  /** Not a kind the partner page has. */
  | 'kind'
  /** Not one of his active items. */
  | 'item'
  /** A date in the future, too far back, or before the task's earliest sensible day. */
  | 'date'
  /** No such signal to answer / not a signal he may send. */
  | 'signal'
  /** A reply that doesn't fit the signal. */
  | 'reply'
  /** The day's signals are used up. */
  | 'limit'
  /** 콕 not possible: she said no, the day's are used, or nothing is left unchecked. */
  | 'nudge'
  /** Not his current month task. */
  | 'task'

function cheersSentToday(state: Pick<AppState, 'notifications'>, from: MemberId, today: ISODate): number {
  return state.notifications.filter((n) => n.kind === 'cheer' && n.from === from && !n.key && n.createdAt.startsWith(today)).length
}

/**
 * Why `ev` would not be applied, or null when it would be. The actor is
 * always the partner of this state (partnerTrack.partnerId): the link's token
 * stands for him, and nothing here can act as the cycle owner.
 */
export function partnerEventProblem(state: AppState, ev: PartnerEvent, today: ISODate): EventProblem | null {
  const partner = partnerId(state)
  const owner = partner === 'a' ? 'b' : 'a'
  if (ev.from !== undefined && ev.from !== partner) return 'actor'
  if (hasAppliedEvent(state, ev.id)) return 'applied'
  switch (ev.kind) {
    case 'check': {
      const item = state.checkItems.find((i) => i.id === ev.itemId)
      if (!item || item.owner !== partner || !item.active) return 'item'
      if (!isISODate(ev.date) || ev.date > today || diffDays(ev.date, today) > CHECK_BACK_DAYS) return 'date'
      if (ev.date < item.createdAt) return 'date'
      return null
    }
    case 'reply': {
      const pending = pendingSignal(state, partner, today)
      if (!pending || signalIdOf(pending) !== ev.signalId) return 'signal'
      if (!repliesFor(ev.signalId).some((r) => r.id === ev.replyId)) return 'reply'
      if (signalsSentToday(state, partner, today) >= SIGNALS_PER_DAY) return 'limit'
      return null
    }
    case 'signal': {
      // The partner's own list only: never '이번 달은 아니었어요' (hers), never a demoted one.
      if (!signalsFor(state.stage, false).some((s) => s.id === ev.signalId)) return 'signal'
      if (signalsSentToday(state, partner, today) >= SIGNALS_PER_DAY) return 'limit'
      return null
    }
    case 'nudge':
      if (!nudgeableItem(state, owner, today) || !canNudge(state, partner, owner, today)) return 'nudge'
      return null
    case 'cheer':
      if (cheersSentToday(state, partner, today) >= CHEERS_PER_DAY) return 'limit'
      return null
    case 'task-done': {
      const task = monthlyTask(state, today, partner)
      if (!task || task.id !== ev.taskId) return 'task'
      if (!isISODate(ev.date) || ev.date > today || (task.minDoneAt !== undefined && ev.date < task.minDoneAt)) return 'date'
      return null
    }
    default:
      return 'kind'
  }
}

// ── Apply ───────────────────────────────────────────────────

/**
 * Apply one event on the owner's phone — `update((s) => applyPartnerEvent(s,
 * ev, today))`. Rejected or already applied → the same state object. Applied
 * → the change the app's own screen would make, plus the event's id
 * remembered. `nowISO` stamps what the event creates (a reply, a 콕); it
 * defaults to the owner's clock on `today` (today.stampOn), as the app does.
 */
export function applyPartnerEvent(state: AppState, ev: PartnerEvent, today: ISODate, nowISO: string = stampOn(today)): AppState {
  if (partnerEventProblem(state, ev, today) !== null) return state
  const partner = partnerId(state)
  const owner: MemberId = partner === 'a' ? 'b' : 'a'
  let next = state
  switch (ev.kind) {
    case 'check': {
      const item = state.checkItems.find((i) => i.id === ev.itemId)!
      const current = isWeekly(item) ? weeklyDone(state, partner, item.id, ev.date) : isDone(state, partner, ev.date, item.id)
      // A "set", not a toggle: the same answer twice is one answer.
      if (current === ev.done) return state
      next = toggleWithCompletion(state, partner, owner, ev.date, item.id, nowISO).state
      break
    }
    case 'reply':
      next = sendSignal(state, partner, owner, ev.replyId, today, nowISO)
      break
    case 'signal':
      next = sendSignal(state, partner, owner, ev.signalId, today, nowISO)
      break
    case 'nudge':
      next = sendNudge(state, partner, owner, today, nowISO, nudgeableItem(state, owner, today)?.label)
      break
    case 'cheer':
      next = sendCheer(state, partner, owner, nowISO)
      break
    case 'task-done': {
      const task = monthlyTask(state, today, partner)!
      next = completeMonthlyTask(state, task, ev.date, partner)
      break
    }
  }
  return rememberEvent(next, ev.id, today)
}

/** A batch in arrival order; a duplicate inside it is applied once. */
export function applyPartnerEvents(
  state: AppState,
  events: readonly PartnerEvent[],
  today: ISODate,
  nowISO: string = stampOn(today),
): AppState {
  let s = state
  for (const ev of events) s = applyPartnerEvent(s, ev, today, nowISO)
  // Something was applied: a good moment to forget the marks nobody can re-deliver.
  return s === state ? state : forgetOldEvents(s, today)
}

/** The ids of a batch that this state has applied (for a transport's acknowledgements). */
export function appliedEventIds(
  state: Pick<AppState, 'decisions' | 'notifications'>,
  events: readonly Pick<PartnerEvent, 'id'>[],
): string[] {
  return events.filter((e) => hasAppliedEvent(state, e.id)).map((e) => e.id)
}

/** The 'check' event's earliest allowed day, for a page that lets him tick a day he missed. */
export function earliestCheckDate(today: ISODate): ISODate {
  return addDays(today, -CHECK_BACK_DAYS)
}
