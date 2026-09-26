// Local calendar-date helpers. Dates are 'YYYY-MM-DD' strings; arithmetic is
// done on UTC midnights so day differences are always whole numbers.

import type { ISODate } from './types'

const DAY_MS = 86_400_000
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false
  const m = ISO_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

function toUTC(iso: ISODate): number {
  const m = ISO_RE.exec(iso)
  if (!m) throw new Error(`Invalid ISO date: ${iso}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** The device's local calendar date. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUTC(toUTC(iso) + days * DAY_MS)
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS)
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function isBetween(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end
}

export function weekdayIndex(iso: ISODate): number {
  return new Date(toUTC(iso)).getUTCDay()
}

export function weekdayKo(iso: ISODate): string {
  return WEEKDAYS_KO[weekdayIndex(iso)]!
}

export function parts(iso: ISODate): { year: number; month: number; day: number } {
  const t = new Date(toUTC(iso))
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

/** '10월 3일 (금)' */
export function formatKo(iso: ISODate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { year, month, day } = parts(iso)
  const base = `${opts.year ? `${year}년 ` : ''}${month}월 ${day}일`
  return opts.weekday === false ? base : `${base} (${weekdayKo(iso)})`
}

/** '10.3' — compact label for chips. */
export function formatShort(iso: ISODate): string {
  const { month, day } = parts(iso)
  return `${month}.${day}`
}

/** 'D-3', 'D-day', 'D+12' relative to today. */
export function dLabel(target: ISODate, today: ISODate): string {
  const n = diffDays(today, target)
  if (n === 0) return 'D-day'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

export function startOfMonth(iso: ISODate): ISODate {
  const { year, month } = parts(iso)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const { year, month, day } = parts(iso)
  const total = year * 12 + (month - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/**
 * 6x7 grid of dates for a month view, weeks starting on Sunday.
 * Days outside the month are included so the grid is always rectangular.
 */
export function monthGrid(anyDayInMonth: ISODate): ISODate[] {
  const first = startOfMonth(anyDayInMonth)
  const start = addDays(first, -weekdayIndex(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function range(start: ISODate, end: ISODate): ISODate[] {
  const n = diffDays(start, end)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i))
}
