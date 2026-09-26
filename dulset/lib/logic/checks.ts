// Daily check (영양제·약·생활습관) — pure state helpers.

import { addDays } from '../dates'
import { uid } from '../id'
import type { AppState, CheckItem, CheckKind, ISODate, MemberId } from '../types'

/** Items that counted for a member on a given day (existed, and not yet archived). */
export function itemsFor(state: Pick<AppState, 'checkItems'>, member: MemberId, date: ISODate): CheckItem[] {
  return state.checkItems.filter(
    (i) =>
      i.owner === member &&
      i.createdAt <= date &&
      (i.active ? true : i.archivedAt !== undefined && date < i.archivedAt),
  )
}

/** Items to show on today's checklist. */
export function activeItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return state.checkItems.filter((i) => i.owner === member && i.active)
}

export function doneIds(state: Pick<AppState, 'checkLog'>, member: MemberId, date: ISODate): string[] {
  return state.checkLog[date]?.[member] ?? []
}

export function isDone(state: Pick<AppState, 'checkLog'>, member: MemberId, date: ISODate, itemId: string): boolean {
  return doneIds(state, member, date).includes(itemId)
}

export interface Progress {
  done: number
  total: number
  complete: boolean
}

export function progress(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, date: ISODate): Progress {
  const items = itemsFor(state, member, date)
  const done = doneIds(state, member, date)
  const count = items.filter((i) => done.includes(i.id)).length
  return { done: count, total: items.length, complete: items.length > 0 && count === items.length }
}

/**
 * Consecutive complete days ending today (or yesterday, if today isn't finished
 * yet — so an unfinished morning doesn't reset the streak to zero).
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

/** Days in a row where BOTH members completed everything. */
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

/** First day an item was ever checked (e.g. "엽산 먹은 지 D+40"). */
export function firstCheckedDate(state: Pick<AppState, 'checkLog'>, member: MemberId, itemId: string): ISODate | undefined {
  const days = Object.keys(state.checkLog)
    .filter((d) => (state.checkLog[d]?.[member] ?? []).includes(itemId))
    .sort()
  return days[0]
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

export function addCheckItem(
  state: AppState,
  owner: MemberId,
  label: string,
  kind: CheckKind,
  today: ISODate,
  note?: string,
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
  }
  return { ...state, checkItems: [...state.checkItems, item] }
}

export function updateCheckItem(
  state: AppState,
  id: string,
  patch: Partial<Pick<CheckItem, 'label' | 'note' | 'kind'>>,
): AppState {
  return {
    ...state,
    checkItems: state.checkItems.map((i) =>
      i.id === id
        ? {
            ...i,
            ...patch,
            label: patch.label !== undefined ? patch.label.trim() || i.label : i.label,
          }
        : i,
    ),
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
