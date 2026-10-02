// "우리의 날들" — Between-style couple counters and anniversaries (pure).
//
// Korean couples count the first day as day 1: 100일 is start + 99 days, and
// 주년 falls on the same calendar date each year.

import { addDays, addMonths, diffDays } from '../dates'
import { uid } from '../id'
import type { AppState, CustomAnniversary, ISODate } from '../types'
import type { Notice } from './notifications'

/** Day count with the start day as 1일 (사귄 지 N일). */
export function daysSince(start: ISODate, today: ISODate): number {
  return diffDays(start, today) + 1
}

export type AnniversaryKind = 'met-days' | 'met-year' | 'married-year' | 'custom'

export interface AnniversaryEvent {
  /** Stable per occurrence, e.g. 'met-days:300' — used for notice dedup. */
  key: string
  title: string
  date: ISODate
  kind: AnniversaryKind
  emoji: string
  /** 300 for 300일, 3 for 3주년. */
  n?: number
}

const DAY_STEP = 100
const MAX_DAYS = 10_000

function yearly(start: ISODate, from: ISODate, to: ISODate): Array<{ n: number; date: ISODate }> {
  const out: Array<{ n: number; date: ISODate }> = []
  const startYear = Number(start.slice(0, 4))
  const fromYear = Number(from.slice(0, 4))
  const toYear = Number(to.slice(0, 4))
  for (let y = Math.max(startYear + 1, fromYear - 1); y <= toYear + 1; y++) {
    const n = y - startYear
    const date = addMonths(start, 12 * n)
    if (date >= from && date <= to) out.push({ n, date })
  }
  return out
}

/** All anniversaries in [from, to], oldest first. */
export function anniversariesBetween(
  couple: Pick<AppState['couple'], 'metDate' | 'marriedDate'>,
  custom: CustomAnniversary[],
  from: ISODate,
  to: ISODate,
): AnniversaryEvent[] {
  const out: AnniversaryEvent[] = []
  const met = couple.metDate
  if (met) {
    // 100일, 200일 … (start day counts as day 1).
    const firstN = Math.max(1, Math.ceil((diffDays(met, from) + 1) / DAY_STEP))
    for (let n = firstN * DAY_STEP; n <= MAX_DAYS; n += DAY_STEP) {
      const date = addDays(met, n - 1)
      if (date > to) break
      if (date >= from) out.push({ key: `met-days:${n}`, title: `만난 지 ${n.toLocaleString('ko-KR')}일`, date, kind: 'met-days', emoji: '💞', n })
    }
    for (const { n, date } of yearly(met, from, to)) {
      out.push({ key: `met-year:${n}`, title: `만난 지 ${n}주년`, date, kind: 'met-year', emoji: '🎉', n })
    }
  }
  const married = couple.marriedDate
  if (married) {
    for (const { n, date } of yearly(married, from, to)) {
      out.push({ key: `married-year:${n}`, title: `결혼 ${n}주년`, date, kind: 'married-year', emoji: '💍', n })
    }
  }
  for (const c of custom) {
    if (c.yearly) {
      if (c.date >= from && c.date <= to) out.push({ key: `custom:${c.id}:0`, title: c.title, date: c.date, kind: 'custom', emoji: c.emoji || '⭐' })
      for (const { n, date } of yearly(c.date, from, to)) {
        out.push({ key: `custom:${c.id}:${n}`, title: `${c.title} ${n}주년`, date, kind: 'custom', emoji: c.emoji || '⭐', n })
      }
    } else if (c.date >= from && c.date <= to) {
      out.push({ key: `custom:${c.id}:0`, title: c.title, date: c.date, kind: 'custom', emoji: c.emoji || '⭐' })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1))
}

/** The next `count` anniversaries from today (inclusive), looking ~13 months ahead. */
export function nextAnniversaries(
  couple: Pick<AppState['couple'], 'metDate' | 'marriedDate'>,
  custom: CustomAnniversary[],
  today: ISODate,
  count = 3,
): AnniversaryEvent[] {
  return anniversariesBetween(couple, custom, today, addDays(today, 400)).slice(0, count)
}

/** "N년 전 오늘" — past yearly occurrences of the couple dates and custom days that fall on today. */
export function onThisDay(
  couple: Pick<AppState['couple'], 'metDate' | 'marriedDate'>,
  custom: CustomAnniversary[],
  today: ISODate,
): AnniversaryEvent[] {
  return anniversariesBetween(couple, custom, today, today)
}

// ── Mutations ───────────────────────────────────────────────

export function setCoupleDates(state: AppState, patch: { metDate?: ISODate | null; marriedDate?: ISODate | null }): AppState {
  const couple = { ...state.couple }
  if (patch.metDate !== undefined) {
    if (patch.metDate) couple.metDate = patch.metDate
    else delete couple.metDate
  }
  if (patch.marriedDate !== undefined) {
    if (patch.marriedDate) couple.marriedDate = patch.marriedDate
    else delete couple.marriedDate
  }
  return { ...state, couple }
}

export function addAnniversary(state: AppState, input: { title: string; date: ISODate; yearly: boolean; emoji?: string }): AppState {
  const title = input.title.trim()
  if (!title) return state
  const a: CustomAnniversary = { id: uid(), title, date: input.date, yearly: input.yearly, emoji: input.emoji }
  return { ...state, anniversaries: [...state.anniversaries, a] }
}

export function updateAnniversary(state: AppState, id: string, patch: Partial<Omit<CustomAnniversary, 'id'>>): AppState {
  return {
    ...state,
    anniversaries: state.anniversaries.map((a) =>
      a.id === id ? { ...a, ...patch, title: patch.title !== undefined ? patch.title.trim() || a.title : a.title } : a,
    ),
  }
}

export function removeAnniversary(state: AppState, id: string): AppState {
  return { ...state, anniversaries: state.anniversaries.filter((a) => a.id !== id) }
}

// ── Notices ─────────────────────────────────────────────────


/**
 * A week before and on the day of each anniversary, to both — unless the
 * couple turned 기념일 알림 off (settings.anniversaryAlerts, Next B). Unset
 * means on (lib/initial.ts SETTINGS_DEFAULTS; the same rule as
 * lib/logic/settings.ts anniversaryAlertsOn, read inline here because
 * settings.ts imports notifications.ts, which imports this file).
 */
export function anniversaryNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  if (state.settings.anniversaryAlerts === false) return out
  const events = anniversariesBetween(state.couple, state.anniversaries, today, addDays(today, 7))
  for (const e of events) {
    const until = diffDays(today, e.date)
    if (until !== 0 && until !== 7) continue
    for (const to of ['a', 'b'] as const) {
      out.push({
        key: `anniv:${e.key}:${e.date}:${until}:${to}`,
        to,
        kind: 'milestone',
        title: until === 0 ? `${e.emoji} 오늘은 ${e.title}` : `${e.emoji} ${e.title}까지 일주일`,
        body: until === 0 ? '오늘을 우리 기록에 남겨 볼까요?' : '어떻게 보낼지 같이 정해 볼까요?',
      })
    }
  }
  return out
}
