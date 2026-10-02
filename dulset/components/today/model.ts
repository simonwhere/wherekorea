// Home ("오늘") rules for the 우리 둘 · 챙길 것 cards — pure, so they're testable.

import { ROADMAP } from '@/lib/content/roadmap'
import { dLabel, diffDays, isISODate } from '@/lib/dates'
import { daysSince, onThisDay, type AnniversaryEvent } from '@/lib/logic/anniversary'
import { upcomingAppointments } from '@/lib/logic/appointments'
import {
  activeDailyItems,
  activeWeeklyItems,
  isDone,
  nudgeableItem,
  weeklyDue as checksWeeklyDue,
  weeklyDone,
} from '@/lib/logic/checks'
import { rowProgress } from '@/lib/logic/today'
import type { RoadmapTemplate } from '@/lib/logic/roadmap'
import type { Appointment, AppState, CheckItem, ISODate, Member, MemberId, RoadmapPhase } from '@/lib/types'

/** How far ahead the 다가오는 일정 card looks, and how many it shows. */
export const UPCOMING_DAYS = 14
export const UPCOMING_MAX = 2
/** Rows on the 이번 주 챙길 것 card (the 챙길 것 tab itself shows them all). */
export const FOCUS_MAX = 3

/** The next appointments (not done) from today, within UPCOMING_DAYS. */
export function upcomingForToday(list: Appointment[], today: ISODate): Appointment[] {
  return upcomingAppointments(list, today, UPCOMING_DAYS).slice(0, UPCOMING_MAX)
}

const PREGNANCY_PHASES: readonly RoadmapPhase[] = ['pregnancy-1st', 'pregnancy-2nd', 'pregnancy-3rd']

/**
 * Appointments the home screen may show for the couple's current stage.
 *
 * While preparing, visits booked for a pregnancy (정밀초음파, 조리원 상담 …)
 * belong to a pregnancy that isn't happening now — typically one that ended —
 * so they stay off the home screen (they're still in 챙길 것, untouched). The
 * birth-day ones (배우자 출산휴가 …) too, unless that pregnancy's baby was born
 * (a couple preparing for a second child still sees the first one's visits).
 */
export function homeAppointments(
  state: Pick<AppState, 'stage' | 'pregnancy' | 'baby' | 'appointments'>,
  templates: readonly RoadmapTemplate[] = ROADMAP,
): Appointment[] {
  if (state.stage !== 'preparing') return state.appointments
  const p = state.pregnancy
  const bornFromIt = !!p && !!state.baby && state.baby.birthDate >= p.lmp
  const hidden = new Set(
    templates
      .filter((t) => PREGNANCY_PHASES.includes(t.phase) || (t.phase === 'birth' && !!p?.endedAt && !bornFromIt))
      .map((t) => t.id),
  )
  return state.appointments.filter((a) => !a.taskId || !hidden.has(a.taskId))
}

/** '오늘' · '내일' · 'D-5'. */
export function dayLabel(date: ISODate, today: ISODate): string {
  const n = diffDays(today, date)
  if (n === 0) return '오늘'
  if (n === 1) return '내일'
  return dLabel(date, today)
}

/** '둘이 함께', '나', or the other member's name. */
export function whoLabel(who: MemberId | 'both', members: readonly Member[], viewer: MemberId): string {
  if (who === 'both') return '둘이 함께'
  if (who === viewer) return '나'
  return members.find((m) => m.id === who)?.name ?? ''
}

/** 함께한 지 N일 (the day they met is day 1), or null without a (past) 만난 날. */
export function togetherDays(couple: Pick<AppState['couple'], 'metDate'>, today: ISODate): number | null {
  const met = couple.metDate
  return isISODate(met) && met <= today ? daysSince(met, today) : null
}

/** Anniversaries that fall on today (100일 단위, N주년, 결혼 N주년, our own days). */
export function todaysAnniversaries(state: Pick<AppState, 'couple' | 'anniversaries'>, today: ISODate): AnniversaryEvent[] {
  return onThisDay(state.couple, state.anniversaries, today)
}

/**
 * Rows for the 이번 주 챙길 것 card: the focus list, plus rows ticked from
 * this card during this visit, kept (as done) where they were so the list
 * doesn't jump under the finger.
 */
export function withTicked<T extends { id: string; status: string }>(
  focus: T[],
  items: T[],
  ticked: ReadonlyArray<{ id: string; index: number }>,
): T[] {
  const rows = [...focus]
  for (const t of ticked) {
    if (rows.some((r) => r.id === t.id)) continue
    const item = items.find((i) => i.id === t.id)
    if (item && item.status === 'done') rows.splice(Math.min(t.index, rows.length), 0, item)
  }
  return rows
}

// ── 오늘 할 일 (preparing home) ─────────────────────────────
// Thin wrappers over lib/logic/checks' cadence helpers (daily rows vs the
// once-a-week check-in), shaped for the home rows.

/** Today's one-tap rows: active daily items (weekly check-ins are separate). */
export function dailyItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return activeDailyItems(state, member)
}

/** Checked on any day from this week's Monday to today. */
export function doneThisWeek(state: Pick<AppState, 'checkLog'>, member: MemberId, itemId: string, today: ISODate): boolean {
  return weeklyDone(state, member, itemId, today)
}

/** Weekly check-ins ("이번 주도 지켰어요") not yet done this week — shown until they are. */
export function weeklyDue(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, today: ISODate): CheckItem[] {
  return checksWeeklyDue(state, member, today)
}

/**
 * The weekly check-in rows for today: the ones still due this week, plus any
 * checked in today (shown ticked, so a mis-tap can be undone right there).
 */
export function weeklyRows(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  today: ISODate,
): { item: CheckItem; checked: boolean }[] {
  return activeWeeklyItems(state, member)
    .map((item) => ({ item, checked: isDone(state, member, today, item.id) }))
    .filter((r) => r.checked || !weeklyDone(state, member, r.item.id, today))
}

/** "민수 1/2": today's progress over daily items only. */
export function dailyProgress(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  today: ISODate,
): { done: number; total: number; complete: boolean } {
  return rowProgress(state, member, today)
}

/**
 * The partner's first unchecked daily item, for a 콕 — never a weekly
 * "keep not doing it" habit (those are check-ins, not chores).
 */
export function nudgeTarget(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, today: ISODate): CheckItem | undefined {
  return nudgeableItem(state, member, today)
}

/** Today's or tomorrow's appointment (the first one). */
export function soonAppointment(list: Appointment[], today: ISODate): Appointment | undefined {
  return soonAppointments(list, today)[0]
}

/**
 * Every appointment today or tomorrow (not done), in time order, for the
 * 오늘 할 일 list — a clinic day has 채혈 08:00 and 주사 21:00 (N13 ⑤), not just
 * the first of them.
 */
export function soonAppointments(list: Appointment[], today: ISODate): Appointment[] {
  return upcomingAppointments(list, today, 1).filter((a) => diffDays(today, a.date) <= 1)
}
