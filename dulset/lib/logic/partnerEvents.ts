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
// Date-bearing events ('check', 'task-done', 'week-pick', 'week-done') are
// "set" events, not toggles, so even without the mark a repeat would be a no-op.
//
// Now 3 adds three kinds, still ids, dates and fixed values only:
//  • 'week-pick' {optionId, date} / 'week-done' {date} — '이번 주 우리 둘'
//    (N21): his pick among the week's three (weekTogether.weekOptions) and his
//    [했어요], applied with weekTogether.pickWeek / markWeekDone and kept in
//    `decisions` like the app's own taps;
//  • 'setup' {habits: {smokes?, drinks?}, alertStyle?} — the link's first run
//    (N22): the two habit answers change his weekly check-ins without
//    rebuilding his list (initial.applyHabitAnswers), and 소식 받는 방식 sets
//    his own alert style (settings.setAlertStyle). Only the enumerated values
//    get through cleanPartnerEvent; anything else drops the whole event.

import { addDays, diffDays, isISODate } from '../dates'
import { applyHabitAnswers, type HabitPatch } from '../initial'
import { decide, decided } from '../sync/model'
import type { AlertStyle, AppState, ISODate, MemberId } from '../types'
import { isDone, isWeekly, nudgeableItem, weeklyDone } from './checks'
import { canNudge, sendCheer, sendNudge } from './notifications'
import { PARTNER_SETUP_KEY } from './onboarding'
import { completeMonthlyTask, monthlyTask, partnerId } from './partnerTrack'
import { setAlertStyle } from './settings'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, sendSignal, signalIdOf, signalsFor, signalsSentToday } from './signals'
import { stampOn, toggleWithCompletion } from './today'
import { markWeekDone, pickWeek, weekDone, weekOf, weekOptions, weekPick, weekTogetherOn } from './weekTogether'

export type PartnerEventKind = 'check' | 'reply' | 'signal' | 'nudge' | 'cheer' | 'task-done' | 'week-pick' | 'week-done' | 'setup'
export const PARTNER_EVENT_KINDS: readonly PartnerEventKind[] = [
  'check',
  'reply',
  'signal',
  'nudge',
  'cheer',
  'task-done',
  'week-pick',
  'week-done',
  'setup',
] as const

/** The link's drinking answer (N22): 거의 안 마셔요 / 가끔 / 자주. */
export type SetupDrinks = 'no' | 'sometimes' | 'often'
export const SETUP_DRINKS: readonly SetupDrinks[] = ['no', 'sometimes', 'often'] as const
/** 소식 받는 방식 — the partner's own alert style. */
export const SETUP_ALERT_STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off'] as const

/** The link's two habit questions; an unanswered one is absent. */
export interface SetupHabits {
  smokes?: boolean
  drinks?: SetupDrinks
}

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
  | (EventBase & { kind: 'week-pick'; optionId: string; date: ISODate })
  | (EventBase & { kind: 'week-done'; date: ISODate })
  | (EventBase & { kind: 'setup'; habits: SetupHabits; alertStyle?: AlertStyle })

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
    case 'week-pick':
      if (!isId(raw.optionId) || !isISODate(raw.date)) return undefined
      return { ...base, kind: 'week-pick', optionId: raw.optionId, date: raw.date }
    case 'week-done':
      if (!isISODate(raw.date)) return undefined
      return { ...base, kind: 'week-done', date: raw.date }
    case 'setup': {
      const habits = cleanSetupHabits(raw.habits)
      if (!habits) return undefined
      if (raw.alertStyle !== undefined && !SETUP_ALERT_STYLES.includes(raw.alertStyle as AlertStyle)) return undefined
      return { ...base, kind: 'setup', habits, ...(raw.alertStyle !== undefined ? { alertStyle: raw.alertStyle as AlertStyle } : {}) }
    }
    default:
      return undefined
  }
}

/** {smokes?: boolean, drinks?: SetupDrinks} rebuilt key by key; a wrong value (or not an object) → undefined. */
function cleanSetupHabits(raw: unknown): SetupHabits | undefined {
  if (!isObj(raw)) return undefined
  if (raw.smokes !== undefined && typeof raw.smokes !== 'boolean') return undefined
  if (raw.drinks !== undefined && !SETUP_DRINKS.includes(raw.drinks as SetupDrinks)) return undefined
  return {
    ...(typeof raw.smokes === 'boolean' ? { smokes: raw.smokes } : {}),
    ...(raw.drinks !== undefined ? { drinks: raw.drinks as SetupDrinks } : {}),
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
  /** '이번 주 우리 둘': not one of the week's picks, no pick to mark done, the week's pick already done, or the quiet. */
  | 'week'

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
    case 'week-pick': {
      if (!isISODate(ev.date) || ev.date > today || diffDays(ev.date, today) > CHECK_BACK_DAYS) return 'date'
      // The quiet is read on her day too: a tap from before a loss is not applied inside it.
      if (!weekTogetherOn(state, today)) return 'week'
      if (!weekOptions(state, ev.date, partner).some((o) => o.id === ev.optionId)) return 'week'
      if (weekDone(state, weekOf(ev.date), partner) !== undefined) return 'week'
      return null
    }
    case 'week-done': {
      if (!isISODate(ev.date) || ev.date > today || diffDays(ev.date, today) > CHECK_BACK_DAYS) return 'date'
      if (!weekTogetherOn(state, today) || !weekTogetherOn(state, ev.date)) return 'week'
      if (!weekPick(state, weekOf(ev.date), partner)) return 'week'
      return null
    }
    case 'setup':
      // Only fixed values got through cleanPartnerEvent; they are his own rows and his own alert style.
      return null
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
    case 'week-pick':
      next = pickWeek(state, partner, ev.optionId, ev.date)
      break
    case 'week-done':
      next = markWeekDone(state, partner, ev.date)
      break
    case 'setup': {
      const h = ev.habits
      const patch: HabitPatch = {
        ...(h.smokes !== undefined ? { smokes: h.smokes } : {}),
        ...(h.drinks !== undefined ? { drinks: h.drinks === 'no' ? 'rarely' : h.drinks } : {}),
      }
      next = applyHabitAnswers(state, partner, patch, today)
      if (ev.alertStyle && next.settings.alertStyle[partner] !== ev.alertStyle) next = setAlertStyle(next, partner, ev.alertStyle)
      // He answered the first run on the link: the in-app sheet does not ask again (onboarding.needsPartnerFirstRun).
      next = decide(next, PARTNER_SETUP_KEY, today)
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
