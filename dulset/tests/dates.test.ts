import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dLabel,
  diffDays,
  formatKo,
  isISODate,
  monthGrid,
  range,
  startOfMonth,
  todayISO,
  weekdayKo,
} from '@/lib/dates'

describe('dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isISODate('2026-02-28')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2028-02-29')).toBe(true)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-1-01')).toBe(false)
    expect(isISODate(null)).toBe(false)
  })

  it('adds days across month/year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-09-26', 280)).toBe('2027-07-03')
  })

  it('diffs whole days', () => {
    expect(diffDays('2026-09-01', '2026-09-29')).toBe(28)
    expect(diffDays('2026-09-29', '2026-09-01')).toBe(-28)
    // Would be off by an hour across DST in local-time math; UTC math keeps it whole.
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31)
  })

  it('adds months with end-of-month clamping', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-02-29', 12)).toBe('2029-02-28')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
  })

  it('formats Korean dates', () => {
    expect(formatKo('2026-09-26')).toBe('9월 26일 (토)')
    expect(formatKo('2026-09-26', { weekday: false, year: true })).toBe('2026년 9월 26일')
    expect(weekdayKo('2026-09-27')).toBe('일')
  })

  it('labels D-days', () => {
    expect(dLabel('2026-09-26', '2026-09-26')).toBe('D-day')
    expect(dLabel('2026-09-29', '2026-09-26')).toBe('D-3')
    expect(dLabel('2026-09-20', '2026-09-26')).toBe('D+6')
  })

  it('builds a 6-week month grid starting on Sunday', () => {
    const g = monthGrid('2026-09-15')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-08-30') // Sunday before Sep 1 (Tue)
    expect(g).toContain('2026-09-30')
    expect(startOfMonth('2026-09-15')).toBe('2026-09-01')
  })

  it('ranges inclusively', () => {
    expect(range('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(range('2026-09-03', '2026-09-01')).toEqual([])
  })

  it('reads the local date', () => {
    expect(todayISO(new Date(2026, 8, 26, 23, 59))).toBe('2026-09-26')
  })
})
