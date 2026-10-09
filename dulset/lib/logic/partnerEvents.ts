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
//
// N32 (병원과 함께일 때 남편의 주) adds one more, an id only:
//  • 'join-appointment' {appointmentId} — his [같이 갈게요] on a '둘이 함께'
//    appointment the snapshot showed him (partnerSnapshot.linkClinic: the
//    couple's own clinic appointments, never a hospital found or suggested).
//    Her phone keeps it in `decisions` ('appt-join:<id>:<member>' → the day,
//    joinAppointment — no new state field, the appointment itself is not
//    touched) and leaves her one 🔔 keyed 'appt:<id>:join:<member>' (it opens
//    챙길 것). Only a live, not-done, not-past '둘이 함께' appointment takes it,
//    and only once per person.
//
// 같이 챙길 것 (founder request 2026-10-09) adds one more, an id and a switch:
//  • 'support' {itemId, on} — his [같이 할게요] on one of HER roadmap items or
//    a shared one that the link showed him (together.linkTogether), and taking
//    it back. Her phone keeps it in `decisions` ('support:<itemId>:<member>'
//    → the day, together.supportItem / unsupportItem — the same keys the app's
//    own button writes). A "set", not a toggle: on twice is one answer, off
//    without an answer changes nothing. `on: true` only where the app would
//    take it (together.canSupportItem: his, an open item of this stage that is
//    hers or shared, with a support line, outside the quiet after a loss);
//    `on: false` is always accepted. The link never sends one of the couple's
//    own items (their titles are free text), so the id must be a roadmap one.
//
// N30's 해 줄 말 needs no new kind: an answer on a card she told him about
// ([알리기]) arrives as 'signal' {signalId}, accepted only while that card
// offers it and nothing was sent since (toldAnswerOpen).
//
// The month task's booked step (N14 leftover): [받았어요] / [다녀왔어요] is never
// recorded before the booked day — earliestDoneAt is the later of the task's
// own minDoneAt and its appointment's date, and the 'task-done' gate, the
// link and the app's card all read it (taskLocked: before that day the card
// shows '예약일 10월 15일' instead of the button).

import { addDays, diffDays, formatKo, isISODate } from '../dates'
import { applyHabitAnswers, type HabitPatch } from '../initial'
import { decide, decided, isLive } from '../sync/model'
import type { AlertStyle, Appointment, AppState, ISODate, MemberId } from '../types'
import { isDone, isWeekly, nudgeableItem, weeklyDone } from './checks'
import { canNudge, mergeNotices, sendCheer, sendNudge } from './notifications'
import { PARTNER_SETUP_KEY } from './onboarding'
import { completeMonthlyTask, monthlyTask, partnerId, type MonthlyTask } from './partnerTrack'
import { setAlertStyle } from './settings'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, sendSignal, signalIdOf, signalsFor, signalsSentToday } from './signals'
import { stampOn, toggleWithCompletion } from './today'
import { templateById } from '../content/roadmap'
import { planItems } from './plan'
import { isForEndedPregnancy } from './planNotices'
import { canSupportItem, isSupported, supportItem, unsupportItem } from './together'
import { ttcMoment } from './ttcFlow'
import { markWeekDone, pickWeek, weekDone, weekOf, weekOptions, weekPick, weekTogetherOn } from './weekTogether'

export type PartnerEventKind =
  | 'check'
  | 'reply'
  | 'signal'
  | 'nudge'
  | 'cheer'
  | 'task-done'
  | 'week-pick'
  | 'week-done'
  | 'setup'
  | 'join-appointment'
  | 'support'
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
  'join-appointment',
  'support',
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
  | (EventBase & { kind: 'join-appointment'; appointmentId: string })
  | (EventBase & { kind: 'support'; itemId: string; on: boolean })

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
    case 'join-appointment':
      if (!isId(raw.appointmentId)) return undefined
      return { ...base, kind: 'join-appointment', appointmentId: raw.appointmentId }
    case 'support':
      if (!isId(raw.itemId) || typeof raw.on !== 'boolean') return undefined
      return { ...base, kind: 'support', itemId: raw.itemId, on: raw.on }
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
  /** [같이 갈게요]: no such live '둘이 함께' appointment ahead, or he already said so. */
  | 'appointment'
  /** [같이 할게요]: not a roadmap item of hers / theirs he may share now (together.canSupportItem). */
  | 'support'

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
      // The partner's own list — never '이번 달은 아니었어요' (hers), never a
      // demoted one — or one of the two answers on a card she SENT, while it
      // stands and until he answered it (toldAnswerOpen, N30).
      const own = signalsFor(state.stage, false).some((s) => s.id === ev.signalId)
      if (!own && !toldAnswerOpen(state, partner, ev.signalId, today)) return 'signal'
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
      const min = earliestDoneAt(task)
      if (!isISODate(ev.date) || ev.date > today || (min !== undefined && ev.date < min)) return 'date'
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
    case 'join-appointment': {
      const a = joinableAppointment(state, ev.appointmentId, today)
      if (!a || hasJoinedAppointment(state, a.id, partner)) return 'appointment'
      return null
    }
    case 'support': {
      // A roadmap item only: the link never carries the couple's own items.
      if (!templateById(ev.itemId)) return 'support'
      if (!ev.on) return null
      const item = planItems(state, today).find((i) => i.id === ev.itemId)
      if (!item || !canSupportItem(state, partner, item, today)) return 'support'
      return null
    }
    default:
      return 'kind'
  }
}

/**
 * Is `signalId` one of the two answers 해 줄 말 offers on his card today — a
 * card that exists only because she told him ([알리기]: ttcFlow toldSay) —
 * with nothing sent since she told? The link sends that answer as a 'signal'
 * event (its '여기 있을게요' is a reply, not one of his own signals).
 */
export function toldAnswerOpen(state: AppState, partner: MemberId, signalId: string, today: ISODate): boolean {
  const say = ttcMoment(state, today, partner, { surface: 'link' })?.say
  return !!say && !say.sent && say.replies.includes(signalId)
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
    case 'join-appointment':
      next = joinAppointment(state, partner, ev.appointmentId, today, nowISO)
      break
    case 'support':
      // A "set": the same answer twice is one answer.
      if (isSupported(state, ev.itemId, partner) === ev.on) break
      next = ev.on ? supportItem(state, partner, ev.itemId, today) : unsupportItem(state, partner, ev.itemId)
      break
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

// ── [같이 갈게요] (N32) ──────────────────────────────────────

/** decisions key: `member` said [같이 갈게요] to the appointment (→ the day he did). */
export const appointmentJoinKey = (appointmentId: string, member: MemberId): string => `appt-join:${appointmentId}:${member}`
/** Her 🔔 for it; the 'appt:' prefix opens 챙길 것 (today.noticeTarget). */
export const appointmentJoinNoticeKey = (appointmentId: string, member: MemberId): string => `appt:${appointmentId}:join:${member}`

/** Has `member` said [같이 갈게요] to this appointment? */
export function hasJoinedAppointment(state: Pick<AppState, 'decisions'>, appointmentId: string, member: MemberId): boolean {
  return state.decisions?.[appointmentJoinKey(appointmentId, member)] !== undefined
}

/** Who said [같이 갈게요] to the appointment — for her 챙길 것 row ('민수님이 같이 가요'). */
export function appointmentJoinedBy(state: Pick<AppState, 'decisions'>, appointmentId: string): MemberId[] {
  return (['a', 'b'] as const).filter((m) => hasJoinedAppointment(state, appointmentId, m))
}

/**
 * The appointment [같이 갈게요] may answer on `today`: live, not done, not in
 * the past, and one they both go to ('둘이 함께') — never a visit booked for a
 * pregnancy that has ended (planNotices.isForEndedPregnancy: 정밀초음파, 조리원
 * 상담 … stay in 챙길 것 as they were, without the button). Undefined otherwise.
 */
export function joinableAppointment(
  state: Pick<AppState, 'appointments' | 'stage' | 'pregnancy' | 'baby' | 'customTasks'>,
  appointmentId: string,
  today: ISODate,
): Appointment | undefined {
  const a = state.appointments.find((x) => x.id === appointmentId)
  if (!a || !isLive(a) || a.done || a.who !== 'both' || !isISODate(a.date) || a.date < today) return undefined
  if (isForEndedPregnancy(state, a)) return undefined
  return a
}

function memberName(state: Pick<AppState, 'couple'>, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name ?? ''
}

/**
 * `member` says [같이 갈게요] to a '둘이 함께' appointment: the answer is kept
 * in `decisions` (the appointment record is not touched — it stays the
 * couple's) and the other one gets a 🔔 with the day, the time and the place
 * — never the title or the note. The link sends it as 'join-appointment'; the
 * app can call it from a 챙길 것 row. Not joinable, or already joined → the
 * same state.
 */
export function joinAppointment(
  state: AppState,
  member: MemberId,
  appointmentId: string,
  today: ISODate,
  nowISO: string = stampOn(today),
): AppState {
  const a = joinableAppointment(state, appointmentId, today)
  if (!a || hasJoinedAppointment(state, a.id, member)) return state
  const to: MemberId = member === 'a' ? 'b' : 'a'
  const name = memberName(state, member)
  const when = `${formatKo(a.date)}${a.time ? ` ${a.time}` : ''}`
  const marked = decide(state, appointmentJoinKey(a.id, member), today)
  return mergeNotices(
    marked,
    [
      {
        key: appointmentJoinNoticeKey(a.id, member),
        to,
        from: member,
        kind: 'system',
        title: `🤝 ${name ? `${name}님이` : '같이'} 병원에 같이 간대요`,
        body: `${when}${a.place ? ` · ${a.place}` : ''}`,
      },
    ],
    nowISO,
  ).state
}

// ── The month task's earliest day (N14 leftover) ────────────

/** What bounds the day a month task may be done (a MonthlyTask, or the snapshot's copy of one). */
export type DoneBounds = Pick<MonthlyTask, 'minDoneAt' | 'stage'> & { appointment?: { date: ISODate } }

/**
 * The earliest day his month task may be recorded as done: the task's own
 * minDoneAt (the step before it), and — once a test is booked — never before
 * the booked day. Undefined when nothing bounds it.
 */
export function earliestDoneAt(task: DoneBounds): ISODate | undefined {
  const hasBooking = (task.stage === 'booked' || task.stage === 'visited') && !!task.appointment && isISODate(task.appointment.date)
  const booked = hasBooking ? task.appointment!.date : undefined
  if (!booked) return task.minDoneAt
  return task.minDoneAt && task.minDoneAt > booked ? task.minDoneAt : booked
}

/**
 * Is [했어요] not possible yet on `today`? True while the booked day is still
 * ahead (the card then shows '예약일 10월 15일' instead of the button).
 */
export function taskLocked(task: DoneBounds, today: ISODate): boolean {
  const min = earliestDoneAt(task)
  return min !== undefined && today < min
}

/** The 'check' event's earliest allowed day, for a page that lets him tick a day he missed. */
export function earliestCheckDate(today: ISODate): ISODate {
  return addDays(today, -CHECK_BACK_DAYS)
}
