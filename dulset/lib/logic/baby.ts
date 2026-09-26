// Baby age & Korean milestone days (pure).
//
// Korean convention counts the birth day as day 1, so 백일 (100th day) is
// birth + 99 days, and "D+N" on the home screen shows the N-th day of life.

import { addDays, addMonths, diffDays } from '../dates'
import { uid } from '../id'
import type { AppState, GrowthRecord, ISODate } from '../types'

/** 1 on the birth day. */
export function dayOfLife(birth: ISODate, today: ISODate): number {
  return diffDays(birth, today) + 1
}

export interface BabyAge {
  /** Completed months (생후 N개월). */
  months: number
  /** Completed weeks. */
  weeks: number
  days: number
  dayOfLife: number
}

export function babyAge(birth: ISODate, today: ISODate): BabyAge {
  const days = diffDays(birth, today)
  let months = 0
  while (addMonths(birth, months + 1) <= today) months++
  return { months, weeks: Math.floor(Math.max(0, days) / 7), days, dayOfLife: days + 1 }
}

export function formatBabyAge(age: BabyAge): string {
  if (age.days < 0) return '태어나기 전'
  if (age.months < 1) return `생후 ${age.days}일`
  if (age.months < 24) return `생후 ${age.months}개월`
  return `${Math.floor(age.months / 12)}살 ${age.months % 12}개월`
}

export interface KoreanDay {
  key: string
  label: string
  date: ISODate
}

/** 50일, 100일(백일), 200일, 300일, 첫돌, 두 돌… */
export function koreanDays(birth: ISODate, years = 3): KoreanDay[] {
  const out: KoreanDay[] = [
    { key: 'day50', label: '50일', date: addDays(birth, 49) },
    { key: 'day100', label: '백일', date: addDays(birth, 99) },
    { key: 'day200', label: '200일', date: addDays(birth, 199) },
    { key: 'day300', label: '300일', date: addDays(birth, 299) },
  ]
  for (let y = 1; y <= years; y++) {
    // addMonths clamps, so Feb 29 babies celebrate on Feb 28 in non-leap years.
    out.push({ key: `year${y}`, label: y === 1 ? '첫돌' : `${y}번째 생일`, date: addMonths(birth, 12 * y) })
  }
  return out
}

export function nextKoreanDay(birth: ISODate, today: ISODate): KoreanDay | undefined {
  return koreanDays(birth).find((d) => d.date >= today)
}

// ── Growth records ──────────────────────────────────────────

export function addGrowth(state: AppState, record: Omit<GrowthRecord, 'id'>): AppState {
  const hasValue = [record.heightCm, record.weightKg, record.headCm].some(
    (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  )
  if (!hasValue) return state
  const growth = [...state.growth, { ...record, id: uid() }].sort((a, b) => (a.date < b.date ? -1 : 1))
  return { ...state, growth }
}

export function removeGrowth(state: AppState, id: string): AppState {
  return { ...state, growth: state.growth.filter((g) => g.id !== id) }
}

// ── Milestones ──────────────────────────────────────────────

export function setMilestone(state: AppState, key: string, date: ISODate | null): AppState {
  const milestones = state.milestones.filter((m) => m.key !== key)
  if (date) milestones.push({ key, date })
  return { ...state, milestones }
}
