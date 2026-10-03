// '이번 주 우리 둘' (Now 3 N21) — the partner's one thing a week and the
// cycle owner's [고마워요] back. Pure: no clock, no React.
//
// The husband loop's rules (docs/positioning.md §4) shape every function here:
//  • What he sees is either what she sent or his own. The three picks he is
//    offered are drawn from a small, evidence-free catalogue by (week, couple)
//    alone — never from the cycle, a test, a period or anything she has not
//    told him — so the card's contents carry no information about her body.
//    The one exception is a shared appointment ('둘이 함께', who: 'both'),
//    which both of them already see.
//  • Once a week is enough: a week (Mon–Sun, local dates) has at most one pick
//    per person, one [했어요] and one [고마워요] per giver.
//  • His thing is relationship-side: dinner, a walk, a chore, a free evening.
//    No timing, no intercourse, no test words.
//  • Something comes back: partnerWeekSummary is what her home shows of his
//    week (at most three lines), and thanksThisWeek is the thanks his card
//    keeps for the rest of that week. A week with nothing in it is not shown
//    at all — there is never a 0 or '안 했어요' (the summary is simply empty).
//  • During the 42 days after a pregnancy ended (and while the 'loss' quiet is
//    on) everything here rests: no picks, no summary, no thanks asked for.
//
// Nothing here is a new state field: the answers live in `decisions` (lib/sync/
// model.ts decide / undecide — answers that are not records), keyed by the
// week's Monday:
//   'week-pick:<monday>:<member>:<optionId>' → the day he picked it
//   'week-done:<monday>:<member>'            → the day he said [했어요]
//   'week-thanks:<monday>:<by>'              → the day `by` said [고마워요]
// The partner link sends the first two as events ('week-pick' / 'week-done',
// lib/logic/partnerEvents.ts) carrying an id and a date only.

import { addDays, isISODate } from '../dates'
import { decide, isLive, undecide } from '../sync/model'
import type { AppState, AppointmentKind, ISODate, MemberId } from '../types'
import { isWeekly, mondayOf } from './checks'
import { recentlyEnded } from './pregnancy'
import { isSignal, signalById, signalIdOf } from './signals'
import { activeRest } from './ttc'

// ── Weeks ───────────────────────────────────────────────────

/** A week (Mon–Sun) named by its Monday, 'YYYY-MM-DD' — the ISO week in local dates. */
export type WeekKey = ISODate

/** The week `date` falls in (its Monday). */
export function weekOf(date: ISODate): WeekKey {
  return mondayOf(date)
}

/** The days of `week` from Monday up to `today` (or Sunday), in order; [] for a week that hasn't started. */
export function weekDaysSoFar(week: WeekKey, today: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i)
    if (d > today) break
    out.push(d)
  }
  return out
}

// ── The catalogue ───────────────────────────────────────────

export type WeekOptionId =
  | 'evening-free'
  | 'cook-dinner'
  | 'walk-route'
  | 'chore'
  | 'weekend-plan'
  | 'walk-together'
  | 'talk-10'
  | 'clinic-day'

export interface WeekOption {
  id: WeekOptionId
  /** What he picks: '이번 주 이걸로'. */
  text: string
  /** How it reads once done — on her home ('이번 주 민수님') and his card. */
  doneText: string
}

/**
 * The relationship-side picks (no medical content, so no source is needed).
 * Three of these are offered each week, rotated per couple.
 */
export const WEEK_OPTIONS: readonly WeekOption[] = [
  { id: 'evening-free', text: '평일 저녁 하나 비워 두기', doneText: '평일 저녁 하나 비워 뒀어요' },
  { id: 'cook-dinner', text: '이번 주 저녁 한 번은 내가 차리기', doneText: '저녁 한 번 차렸어요' },
  { id: 'walk-route', text: '주말 산책 코스 정하기', doneText: '주말 산책 코스를 정했어요' },
  { id: 'chore', text: '집안일 하나 맡기', doneText: '집안일 하나 맡았어요' },
  { id: 'weekend-plan', text: '주말 계획 먼저 잡기', doneText: '주말 계획을 먼저 잡았어요' },
  { id: 'walk-together', text: '같이 걷는 30분 제안하기', doneText: '같이 걷자고 했어요' },
  { id: 'talk-10', text: '휴대폰 내려놓고 10분 이야기하기', doneText: '휴대폰 내려놓고 이야기했어요' },
]

/** Offered (in the third place) only in a week with a shared appointment both of them go to. */
export const CLINIC_DAY_OPTION: WeekOption = {
  id: 'clinic-day',
  text: '병원 일정 있는 날 시간 비워 두기',
  doneText: '병원 가는 날 시간을 비워 뒀어요',
}

/** How many picks a week offers. */
export const WEEK_OPTION_COUNT = 3

export function weekOptionById(id: string): WeekOption | undefined {
  return id === CLINIC_DAY_OPTION.id ? CLINIC_DAY_OPTION : WEEK_OPTIONS.find((o) => o.id === id)
}

// ── Keys (decisions) ────────────────────────────────────────

export const weekPickKey = (week: WeekKey, member: MemberId, optionId: string): string => `week-pick:${week}:${member}:${optionId}`
export const weekDoneKey = (week: WeekKey, member: MemberId): string => `week-done:${week}:${member}`
export const weekThanksKey = (week: WeekKey, by: MemberId): string => `week-thanks:${week}:${by}`

// ── When it is on ───────────────────────────────────────────

type WeekState = Pick<AppState, 'stage' | 'pregnancy' | 'restCycle' | 'periods'>

/**
 * The quiet after a pregnancy ended: the 42 days counted from the end
 * (pregnancy.recentlyEnded) and the 'loss' rest while it is on (ttc.activeRest
 * — the home's after-loss moment). Nothing here asks anything of either of
 * them then.
 */
export function weekQuiet(state: WeekState, today: ISODate): boolean {
  return recentlyEnded(state, today) || activeRest(state, today)?.reason === 'loss'
}

/** '이번 주 우리 둘' runs while preparing, outside the quiet. */
export function weekTogetherOn(state: WeekState, today: ISODate): boolean {
  return state.stage === 'preparing' && isISODate(today) && !weekQuiet(state, today)
}

function tracksCycle(state: Pick<AppState, 'couple'>, member: MemberId): boolean {
  return state.couple.members.find((m) => m.id === member)?.tracksCycle === true
}

const other = (member: MemberId): MemberId => (member === 'a' ? 'b' : 'a')

// ── Rotation ────────────────────────────────────────────────

/** FNV-1a (32-bit): a small, stable string hash — the same picks on both phones and the link. */
function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const CLINIC_KINDS: readonly AppointmentKind[] = ['hospital', 'test', 'vaccine', 'injection', 'medication']

/** A live appointment both of them go to ('둘이 함께') somewhere in `week`. */
export function sharedAppointmentInWeek(state: Pick<AppState, 'appointments'>, week: WeekKey): boolean {
  const end = addDays(week, 6)
  return state.appointments.some(
    (a) => a.who === 'both' && isLive(a) && CLINIC_KINDS.includes(a.kind) && a.date >= week && a.date <= end,
  )
}

/**
 * What seeds the rotation for a couple: the moment their space was created
 * (AppState.createdAt — set once, never edited, the same on every phone and
 * in a backup), else the invite code.
 */
function coupleSeed(state: Pick<AppState, 'createdAt' | 'couple'>): string {
  return typeof state.createdAt === 'string' && state.createdAt ? state.createdAt : state.couple.inviteCode
}

/**
 * The three picks offered to `partnerId` in the week of `today`: a
 * deterministic rotation of WEEK_OPTIONS by (week, couple) — the couple's
 * space (coupleSeed) seeds it, so both phones and the link agree — with
 * CLINIC_DAY_OPTION in the third place in a week with a shared appointment.
 * Nothing about the cycle goes in. Empty for the cycle owner, outside the
 * preparing stage and during the quiet (weekQuiet).
 */
export function weekOptions(state: AppState, today: ISODate, partnerId: MemberId): WeekOption[] {
  if (!weekTogetherOn(state, today) || tracksCycle(state, partnerId)) return []
  const week = weekOf(today)
  const seed = `${coupleSeed(state)}|${week}|`
  const ranked = [...WEEK_OPTIONS]
    .map((o) => ({ o, h: hash32(seed + o.id) }))
    .sort((x, y) => x.h - y.h || (x.o.id < y.o.id ? -1 : 1))
    .map((x) => x.o)
  const picks = ranked.slice(0, WEEK_OPTION_COUNT)
  if (sharedAppointmentInWeek(state, week)) picks[WEEK_OPTION_COUNT - 1] = CLINIC_DAY_OPTION
  return picks
}

// ── His pick and [했어요] ───────────────────────────────────

/** What `member` picked for `week` (the latest pick if a stray second one exists), or undefined. */
export function weekPick(state: Pick<AppState, 'decisions'>, week: WeekKey, member: MemberId): WeekOption | undefined {
  const prefix = `week-pick:${week}:${member}:`
  let best: { option: WeekOption; day: ISODate } | undefined
  for (const [key, day] of Object.entries(state.decisions ?? {})) {
    if (!key.startsWith(prefix)) continue
    const option = weekOptionById(key.slice(prefix.length))
    if (!option) continue
    if (!best || day > best.day) best = { option, day }
  }
  return best?.option
}

/** The day `member` said [했어요] for `week`, or undefined. */
export function weekDone(state: Pick<AppState, 'decisions'>, week: WeekKey, member: MemberId): ISODate | undefined {
  return state.decisions?.[weekDoneKey(week, member)]
}

/**
 * [이번 주 이걸로]: `member` picks `optionId` for the week of `today`. Only one
 * of this week's offered picks counts; picking another one before [했어요]
 * replaces it, and after [했어요] the week's pick stays. The same pick again,
 * anything outside weekOptions, or a quiet week → the same state.
 */
export function pickWeek(state: AppState, member: MemberId, optionId: string, today: ISODate): AppState {
  if (!weekOptions(state, today, member).some((o) => o.id === optionId)) return state
  const week = weekOf(today)
  if (weekDone(state, week, member) !== undefined) return state
  if (weekPick(state, week, member)?.id === optionId) return state
  const prefix = `week-pick:${week}:${member}:`
  let s = state
  for (const key of Object.keys(state.decisions ?? {})) if (key.startsWith(prefix)) s = undecide(s, key)
  return decide(s, weekPickKey(week, member, optionId), today)
}

/** [했어요] for the week of `today`: only with a pick, once (the first day stands), not in a quiet week. */
export function markWeekDone(state: AppState, member: MemberId, today: ISODate): AppState {
  if (!weekTogetherOn(state, today) || tracksCycle(state, member)) return state
  const week = weekOf(today)
  if (!weekPick(state, week, member)) return state
  return decide(state, weekDoneKey(week, member), today)
}

/** Take [했어요] back for the week of `today` (the pick stays). */
export function unmarkWeekDone(state: AppState, member: MemberId, today: ISODate): AppState {
  if (!isISODate(today)) return state
  return undecide(state, weekDoneKey(weekOf(today), member))
}

// ── What he did this week (her home) ────────────────────────

export type WeekDeedKind = 'week-done' | 'task' | 'reply' | 'daily' | 'checkin' | 'signal'

export interface WeekDeed {
  kind: WeekDeedKind
  /** The line as shown ('저녁 한 번 차렸어요', '걷기 3일', '신호에 답했어요' …). */
  text: string
  /** Days or times behind the line — always 1 or more when present. */
  count?: number
}

/** At most this many lines. */
export const WEEK_SUMMARY_MAX = 3

/** A check label without its minutes, for '걷기 3일' ('걷기 30분' → '걷기', '30분 걷기·운동' → '걷기·운동'). */
export function shortCheckLabel(label: string): string {
  const short = label
    .replace(/\s*\d+\s*분\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return short || label.trim()
}

/**
 * Up to three things `partnerId` did in the week of `today` (Monday up to
 * today), most meaningful first: this week's pick [했어요] · a step of a 할 일
 * (챙길 것 / 이번 달 할 일) · a reply to her signal · the daily check he kept most
 * ('걷기 3일') · a weekly check-in (without its name: '체크인 했어요') · a signal
 * of his own. Every line counts something that happened — nothing is ever 0,
 * and a week with nothing comes back empty (the screen then shows no line and
 * no button). Empty during the quiet and outside the preparing stage. His
 * pick itself never shows here, only once it is done.
 */
export function partnerWeekSummary(state: AppState, today: ISODate, partnerId: MemberId): WeekDeed[] {
  if (!weekTogetherOn(state, today)) return []
  const week = weekOf(today)
  const days = weekDaysSoFar(week, today)
  if (!days.length) return []
  const first = days[0]!
  const last = days[days.length - 1]!
  const inWeek = (d: unknown): boolean => typeof d === 'string' && d >= first && d <= last
  const out: WeekDeed[] = []

  const pick = weekPick(state, week, partnerId)
  if (pick && inWeek(weekDone(state, week, partnerId))) out.push({ kind: 'week-done', text: pick.doneText })

  // A step of a 할 일 he marked done this week: roadmap / chain ticks (not the
  // claim checklist's sub-items) and his own 직접 추가 items.
  const ticks = Object.entries(state.planDone ?? {}).filter(([key, d]) => !key.includes(':doc:') && d?.by === partnerId && inWeek(d.at)).length
  const customs = state.customTasks.filter((c) => isLive(c) && c.doneBy === partnerId && inWeek(c.doneAt)).length
  const tasks = ticks + customs
  if (tasks > 0) out.push({ kind: 'task', text: tasks === 1 ? '할 일 하나를 마쳤어요' : `할 일 ${tasks}개를 마쳤어요`, count: tasks })

  // Signals he sent this week: replies to hers, and his own.
  let replies = 0
  let signals = 0
  for (const n of state.notifications) {
    if (!isSignal(n) || n.from !== partnerId || !inWeek(n.createdAt?.slice(0, 10))) continue
    if (signalById(signalIdOf(n) ?? '')?.tone === 'reply') replies++
    else signals++
  }
  if (replies > 0) out.push({ kind: 'reply', text: '신호에 답했어요', count: replies })

  // The daily check he kept most (archived mid-week still counts its days).
  const mine = state.checkItems.filter((i) => i.owner === partnerId)
  const doneOn = (d: ISODate): readonly string[] => state.checkLog[d]?.[partnerId] ?? []
  let top: { label: string; n: number } | undefined
  for (const item of mine) {
    if (isWeekly(item)) continue
    const n = days.filter((d) => doneOn(d).includes(item.id)).length
    if (n > 0 && (!top || n > top.n)) top = { label: item.label, n }
  }
  if (top) out.push({ kind: 'daily', text: `${shortCheckLabel(top.label)} ${top.n}일`, count: top.n })

  const weeklyIds = new Set(mine.filter(isWeekly).map((i) => i.id))
  const checkins = new Set(days.flatMap((d) => doneOn(d).filter((id) => weeklyIds.has(id)))).size
  if (checkins > 0) out.push({ kind: 'checkin', text: '체크인 했어요', count: checkins })

  if (signals > 0) out.push({ kind: 'signal', text: '신호를 보냈어요', count: signals })

  return out.slice(0, WEEK_SUMMARY_MAX)
}

// ── [고마워요] ──────────────────────────────────────────────

/** The day `by` said [고마워요] in `week`, or undefined. */
export function weekThanked(state: Pick<AppState, 'decisions'>, by: MemberId, week: WeekKey): ISODate | undefined {
  return state.decisions?.[weekThanksKey(week, by)]
}

/** May `by` say [고마워요] this week? Once a week, only when the other did something (their summary has a line), never in the quiet. */
export function canThankWeek(state: AppState, by: MemberId, today: ISODate): boolean {
  if (!weekTogetherOn(state, today)) return false
  if (weekThanked(state, by, weekOf(today)) !== undefined) return false
  return partnerWeekSummary(state, today, other(by)).length > 0
}

/** [고마워요]: remembered once for the week of `today` (the first day stands). Otherwise the same state. */
export function thankWeek(state: AppState, by: MemberId, today: ISODate): AppState {
  if (!canThankWeek(state, by, today)) return state
  return decide(state, weekThanksKey(weekOf(today), by), today)
}

/**
 * The thanks `member` received this week — who said it and on which day
 * ('지은님이 고마워했어요 (화)'), kept on their card for the rest of the week.
 * Undefined when there was none, and during the quiet.
 */
export function thanksThisWeek(state: AppState, member: MemberId, today: ISODate): { from: MemberId; day: ISODate } | undefined {
  if (!weekTogetherOn(state, today)) return undefined
  const from = other(member)
  const day = weekThanked(state, from, weekOf(today))
  return day !== undefined && day <= today ? { from, day } : undefined
}
