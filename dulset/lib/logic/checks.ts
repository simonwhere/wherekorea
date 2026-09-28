// Daily check (영양제·약·생활습관) — pure state helpers.
//
// Two cadences:
//   daily  — the one-tap rows of the day (엽산, 걷기 30분 …). Default, and what an
//            item without `cadence` (older data) means.
//   weekly — a once-a-week check-in for "keep not doing it" habits (금연·금주·
//            사우나 쉬기). One check anywhere in the ISO week (Mon–Sun) counts.
//            They never decide whether a day is "complete", never feed the weekly
//            count, and are never the target of a 콕 — holding back isn't a chore.

import { addDays, weekdayIndex } from '../dates'
import { uid } from '../id'
import type { AppState, CheckItem, CheckKind, ISODate, MemberId } from '../types'

export type Cadence = NonNullable<CheckItem['cadence']>

export function isWeekly(item: Pick<CheckItem, 'cadence'>): boolean {
  return item.cadence === 'weekly'
}

export function isDaily(item: Pick<CheckItem, 'cadence'>): boolean {
  return !isWeekly(item)
}

/** Items that counted for a member on a given day (existed, and not yet archived). */
export function itemsFor(state: Pick<AppState, 'checkItems'>, member: MemberId, date: ISODate): CheckItem[] {
  return state.checkItems.filter(
    (i) =>
      i.owner === member &&
      i.createdAt <= date &&
      (i.active ? true : i.archivedAt !== undefined && date < i.archivedAt),
  )
}

/** Daily items that counted on `date` (what "complete" is measured against). */
export function dailyItemsFor(state: Pick<AppState, 'checkItems'>, member: MemberId, date: ISODate): CheckItem[] {
  return itemsFor(state, member, date).filter(isDaily)
}

/** Items to show on today's checklist. */
export function activeItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return state.checkItems.filter((i) => i.owner === member && i.active)
}

/** Today's one-tap rows: active daily items. */
export function activeDailyItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return activeItems(state, member).filter(isDaily)
}

/** Active weekly check-ins. */
export function activeWeeklyItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return activeItems(state, member).filter(isWeekly)
}

export function doneIds(state: Pick<AppState, 'checkLog'>, member: MemberId, date: ISODate): string[] {
  return state.checkLog[date]?.[member] ?? []
}

export function isDone(state: Pick<AppState, 'checkLog'>, member: MemberId, date: ISODate, itemId: string): boolean {
  return doneIds(state, member, date).includes(itemId)
}

// ── ISO week (Mon–Sun) ──────────────────────────────────────

/** Monday of the ISO week containing `date`. */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((weekdayIndex(date) + 6) % 7))
}

/** The seven days (Mon → Sun) of the ISO week containing `date`. */
export function weekDays(date: ISODate): ISODate[] {
  const mon = mondayOf(date)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

/** Days of `date`'s week on which `itemId` was checked, up to and including `date`. */
export function weeklyCheckDays(
  state: Pick<AppState, 'checkLog'>,
  member: MemberId,
  itemId: string,
  date: ISODate,
): ISODate[] {
  return weekDays(date).filter((d) => d <= date && isDone(state, member, d, itemId))
}

/** A weekly check-in counts once per ISO week: checked on any day from Monday to `date`. */
export function weeklyDone(state: Pick<AppState, 'checkLog'>, member: MemberId, itemId: string, date: ISODate): boolean {
  return weeklyCheckDays(state, member, itemId, date).length > 0
}

/** An active weekly item that hasn't been checked in yet this week. */
export function isDueThisWeek(
  state: Pick<AppState, 'checkLog'>,
  member: MemberId,
  item: Pick<CheckItem, 'id' | 'cadence' | 'active'>,
  today: ISODate,
): boolean {
  return item.active && isWeekly(item) && !weeklyDone(state, member, item.id, today)
}

/** Weekly check-ins still due this week (shown until they're done). */
export function weeklyDue(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, today: ISODate): CheckItem[] {
  return activeWeeklyItems(state, member).filter((i) => !weeklyDone(state, member, i.id, today))
}

// ── Progress ────────────────────────────────────────────────

export interface Progress {
  done: number
  total: number
  complete: boolean
}

/** A day's progress over the daily items that counted that day (weekly check-ins don't count). */
export function progress(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, date: ISODate): Progress {
  const items = dailyItemsFor(state, member, date)
  const done = doneIds(state, member, date)
  const count = items.filter((i) => done.includes(i.id)).length
  return { done: count, total: items.length, complete: items.length > 0 && count === items.length }
}

/** Days of this week (Monday → today) with every daily item done: "이번 주 N/7". */
export function weekCount(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, today: ISODate): number {
  return weekDays(today).filter((d) => d <= today && progress(state, member, d).complete).length
}

/** Days of this week (Monday → today) on which both finished their daily items. */
export function coupleWeekCount(state: Pick<AppState, 'checkItems' | 'checkLog'>, today: ISODate): number {
  return weekDays(today).filter((d) => d <= today && progress(state, 'a', d).complete && progress(state, 'b', d).complete)
    .length
}

/** "이번 주 3/7" — the label that replaces the old "연속 N일" streak. */
export function weekCountLabel(count: number): string {
  return `이번 주 ${count}/7`
}

/**
 * Consecutive complete days ending today (or yesterday, if today isn't finished
 * yet — so an unfinished morning doesn't reset the streak to zero).
 *
 * @deprecated A streak breaks on one missed day; screens show weekCount ("이번 주 N/7").
 */
export function streak(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  today: ISODate,
  maxDays = 365,
): number {
  let day = progress(state, member, today).complete ? today : addDays(today, -1)
  let n = 0
  while (n < maxDays && progress(state, member, day).complete) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/**
 * Days in a row where BOTH members completed everything.
 *
 * @deprecated Screens show coupleWeekCount ("이번 주 N/7").
 */
export function coupleStreak(state: Pick<AppState, 'checkItems' | 'checkLog'>, today: ISODate, maxDays = 365): number {
  const both = (d: ISODate) => progress(state, 'a', d).complete && progress(state, 'b', d).complete
  let day = both(today) ? today : addDays(today, -1)
  let n = 0
  while (n < maxDays && both(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/**
 * What a 콕 may point at: the member's first unchecked active *daily* item.
 * Never a weekly "keep not doing it" check-in.
 */
export function nudgeableItem(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  date: ISODate,
): CheckItem | undefined {
  const done = doneIds(state, member, date)
  return activeDailyItems(state, member).find((i) => !done.includes(i.id))
}

/** First day an item was ever checked (e.g. "엽산 먹은 지 D+40"). */
export function firstCheckedDate(state: Pick<AppState, 'checkLog'>, member: MemberId, itemId: string): ISODate | undefined {
  const days = Object.keys(state.checkLog)
    .filter((d) => (state.checkLog[d]?.[member] ?? []).includes(itemId))
    .sort()
  return days[0]
}

/** The earliest first check among several items (undefined when none was ever checked). */
export function firstCheckOf(state: Pick<AppState, 'checkLog'>, member: MemberId, itemIds: readonly string[]): ISODate | undefined {
  const ids = new Set(itemIds)
  if (!ids.size) return undefined
  return Object.keys(state.checkLog)
    .filter((d) => (state.checkLog[d]?.[member] ?? []).some((id) => ids.has(id)))
    .sort()[0]
}

/** Days on which a member checked an item, within [from, to]. */
export function daysChecked(
  state: Pick<AppState, 'checkLog'>,
  member: MemberId,
  itemId: string,
  from: ISODate,
  to: ISODate,
): number {
  return Object.keys(state.checkLog).filter(
    (d) => d >= from && d <= to && (state.checkLog[d]?.[member] ?? []).includes(itemId),
  ).length
}

// ── Mutations ───────────────────────────────────────────────

export function toggleCheck(state: AppState, member: MemberId, date: ISODate, itemId: string): AppState {
  const day = state.checkLog[date] ?? {}
  const current = day[member] ?? []
  const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
  return { ...state, checkLog: { ...state.checkLog, [date]: { ...day, [member]: next } } }
}

/**
 * Toggle a weekly check-in from `today`'s row: when it's already done this week
 * (on any day since Monday), un-checking clears this week's check-ins; otherwise
 * it's checked today. A daily item falls back to toggleCheck.
 */
export function toggleWeekly(state: AppState, member: MemberId, today: ISODate, itemId: string): AppState {
  const item = state.checkItems.find((i) => i.id === itemId)
  if (!item || !isWeekly(item)) return toggleCheck(state, member, today, itemId)
  const days = weeklyCheckDays(state, member, itemId, today)
  if (!days.length) return toggleCheck(state, member, today, itemId)
  let s = state
  for (const d of days) s = toggleCheck(s, member, d, itemId)
  return s
}

export function addCheckItem(
  state: AppState,
  owner: MemberId,
  label: string,
  kind: CheckKind,
  today: ISODate,
  note?: string,
  cadence?: Cadence,
): AppState {
  const clean = label.trim()
  if (!clean) return state
  const item: CheckItem = {
    id: uid(),
    owner,
    label: clean,
    kind,
    note: note?.trim() || undefined,
    active: true,
    createdAt: today,
    ...(cadence === 'weekly' ? { cadence } : {}),
  }
  return { ...state, checkItems: [...state.checkItems, item] }
}

export function updateCheckItem(
  state: AppState,
  id: string,
  patch: Partial<Pick<CheckItem, 'label' | 'note' | 'kind' | 'cadence'>>,
): AppState {
  return {
    ...state,
    checkItems: state.checkItems.map((i) => {
      if (i.id !== id) return i
      const next: CheckItem = {
        ...i,
        ...patch,
        label: patch.label !== undefined ? patch.label.trim() || i.label : i.label,
      }
      // 'daily' is the default — keep stored items minimal.
      if (next.cadence !== 'weekly') delete next.cadence
      return next
    }),
  }
}

/** Archive rather than delete, so past days keep their history. */
export function archiveCheckItem(state: AppState, id: string, today: ISODate): AppState {
  return {
    ...state,
    checkItems: state.checkItems.map((i) => (i.id === id ? { ...i, active: false, archivedAt: today } : i)),
  }
}

export function restoreCheckItem(state: AppState, id: string): AppState {
  return {
    ...state,
    checkItems: state.checkItems.map((i) => (i.id === id ? { ...i, active: true, archivedAt: undefined } : i)),
  }
}
