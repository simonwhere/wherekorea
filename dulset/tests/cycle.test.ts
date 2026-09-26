import { describe, expect, it } from 'vitest'
import {
  addPeriod,
  chanceLevel,
  cycleAt,
  cycleStats,
  dayInfo,
  fertilityStatus,
  setLHTest,
  upcomingWindows,
  type CycleInput,
} from '@/lib/logic/cycle'

const base = (over: Partial<CycleInput> = {}): CycleInput => ({
  periods: [],
  lhTests: [],
  cycle: { cycleLength: 28, periodLength: 5 },
  ...over,
})

describe('cycleStats', () => {
  it('falls back to settings without enough logs', () => {
    const s = cycleStats([{ start: '2026-09-01' }], { cycleLength: 30, periodLength: 5 })
    expect(s).toMatchObject({ average: 30, source: 'settings', irregular: false })
  })

  it('averages measured cycles and ignores implausible gaps (missed logs)', () => {
    const s = cycleStats(
      [{ start: '2026-01-01' }, { start: '2026-01-30' }, { start: '2026-02-28' }, { start: '2026-06-01' }],
      { cycleLength: 28, periodLength: 5 },
    )
    // 29, 29 kept; 93-day gap ignored
    expect(s.lengths).toEqual([29, 29])
    expect(s.average).toBe(29)
    expect(s.source).toBe('logs')
  })

  it('flags irregular cycles (spread > 7 days)', () => {
    const s = cycleStats(
      [{ start: '2026-01-01' }, { start: '2026-01-25' }, { start: '2026-03-01' }],
      { cycleLength: 28, periodLength: 5 },
    )
    expect(s.lengths).toEqual([24, 35])
    expect(s.irregular).toBe(true)
  })

  it('flags averages outside 21–35', () => {
    expect(cycleStats([], { cycleLength: 40, periodLength: 5 }).irregular).toBe(true)
  })
})

describe('cycleAt / windows', () => {
  const input = base({ periods: [{ start: '2026-09-01' }] })

  it('computes a 28-day window: ovulation = next period − 14', () => {
    const w = cycleAt(input, '2026-09-10')!
    expect(w.start).toBe('2026-09-01')
    expect(w.nextPeriod).toBe('2026-09-29')
    expect(w.ovulation).toBe('2026-09-15')
    expect(w.fertileStart).toBe('2026-09-10')
    expect(w.fertileEnd).toBe('2026-09-15')
    expect(w.peakStart).toBe('2026-09-13')
    expect(w.peakEnd).toBe('2026-09-15')
    expect(w.basis).toBe('calendar')
    // ±2 days of luteal-phase uncertainty
    expect(w.broadStart).toBe('2026-09-08')
    expect(w.broadEnd).toBe('2026-09-17')
  })

  it('widens the band with the couple’s own cycle spread', () => {
    const i = base({ periods: [{ start: '2026-07-01' }, { start: '2026-07-27' }, { start: '2026-08-28' }] }) // 26, 32 → avg 29
    const w = cycleAt(i, '2026-09-05')!
    expect(w.length).toBe(29)
    expect(w.ovulation).toBe('2026-09-12')
    expect(w.broadStart).toBe('2026-09-02') // fertileStart 09-07 − (2 + 3)
    expect(w.broadEnd).toBe('2026-09-17') // ovulation + 2 + 3
  })

  it('returns null before any logged period', () => {
    expect(cycleAt(input, '2026-08-01')).toBeNull()
    expect(cycleAt(base(), '2026-09-10')).toBeNull()
  })

  it('projects future cycles', () => {
    const w = cycleAt(input, '2026-10-05')!
    expect(w.start).toBe('2026-09-29')
    expect(w.startLogged).toBe(false)
    expect(w.ovulation).toBe('2026-10-13')
  })

  it('does not invent cycle days inside a long gap between logs (missed logs)', () => {
    const i = base({ periods: [{ start: '2026-01-01' }, { start: '2026-06-01' }] })
    expect(cycleAt(i, '2026-01-10')!.start).toBe('2026-01-01')
    expect(cycleAt(i, '2026-04-01')).toBeNull()
    expect(dayInfo(i, '2026-04-01').cycleDay).toBeUndefined()
    expect(cycleAt(i, '2026-06-05')!.start).toBe('2026-06-01')
  })

  it('uses the measured length for completed cycles', () => {
    const w = cycleAt(base({ periods: [{ start: '2026-08-01' }, { start: '2026-09-01' }] }), '2026-08-10')!
    expect(w.length).toBe(31)
    expect(w.ovulation).toBe('2026-08-18')
  })

  it('moves ovulation to the day after the first positive LH test', () => {
    const w = cycleAt({ ...input, lhTests: [{ date: '2026-09-17', result: 'positive' }] }, '2026-09-10')!
    expect(w.basis).toBe('lh')
    expect(w.ovulation).toBe('2026-09-18')
    expect(w.peakStart).toBe('2026-09-16')
    expect([w.broadStart, w.broadEnd]).toEqual([w.fertileStart, w.fertileEnd])
  })

  it('ignores positive LH tests during the period days', () => {
    const w = cycleAt({ ...input, lhTests: [{ date: '2026-09-02', result: 'positive' }] }, '2026-09-10')!
    expect(w.basis).toBe('calendar')
  })

  it('never places ovulation before cycle day 8 for very short cycles', () => {
    const w = cycleAt(base({ periods: [{ start: '2026-09-01' }], cycle: { cycleLength: 18, periodLength: 4 } }), '2026-09-02')!
    expect(w.ovulation).toBe('2026-09-08')
  })

  it('lists upcoming windows', () => {
    const ws = upcomingWindows(input, '2026-09-20', 3)
    expect(ws.map((w) => w.ovulation)).toEqual(['2026-10-13', '2026-11-10', '2026-12-08'])
    const cur = upcomingWindows(input, '2026-09-12', 1)
    expect(cur[0]!.ovulation).toBe('2026-09-15')
  })
})

describe('dayInfo', () => {
  const input = base({ periods: [{ start: '2026-09-01', end: '2026-09-04' }] })

  it('classifies phases', () => {
    expect(dayInfo(input, '2026-09-03').phase).toBe('period')
    expect(dayInfo(input, '2026-09-05').phase).toBe('none')
    expect(dayInfo(input, '2026-09-10').phase).toBe('fertile')
    expect(dayInfo(input, '2026-09-14').phase).toBe('peak')
    expect(dayInfo(input, '2026-09-15')).toMatchObject({ phase: 'peak', isOvulation: true, cycleDay: 15, ovulationOffset: 0 })
    expect(dayInfo(input, '2026-09-16').phase).toBe('possible')
    expect(dayInfo(input, '2026-09-18').phase).toBe('none')
    expect(dayInfo(input, '2026-09-08').phase).toBe('possible')
    expect(dayInfo(input, '2026-09-30').phase).toBe('period-predicted')
  })

  it('uses periodLength when no end date is logged', () => {
    const i = base({ periods: [{ start: '2026-09-01' }], cycle: { cycleLength: 28, periodLength: 3 } })
    expect(dayInfo(i, '2026-09-03').phase).toBe('period')
    expect(dayInfo(i, '2026-09-04').phase).toBe('none')
  })

  it('maps offsets to chance levels', () => {
    expect(chanceLevel(0)).toBe('high')
    expect(chanceLevel(-2)).toBe('high')
    expect(chanceLevel(-3)).toBe('medium')
    expect(chanceLevel(-5)).toBe('medium')
    expect(chanceLevel(1)).toBe('low')
    expect(chanceLevel(2)).toBe('low')
    expect(chanceLevel(undefined)).toBe('low')
  })
})

describe('fertilityStatus', () => {
  const input = base({ periods: [{ start: '2026-09-01', end: '2026-09-05' }] })

  it('walks through a cycle', () => {
    expect(fertilityStatus(base(), '2026-09-10')).toEqual({ kind: 'no-data' })
    expect(fertilityStatus(input, '2026-09-02')).toMatchObject({ kind: 'period', cycleDay: 2 })
    expect(fertilityStatus(input, '2026-09-07')).toMatchObject({ kind: 'before-fertile', daysUntil: 3 })
    expect(fertilityStatus(input, '2026-09-11')).toMatchObject({ kind: 'fertile', peak: false })
    expect(fertilityStatus(input, '2026-09-15')).toMatchObject({ kind: 'fertile', peak: true, isOvulation: true })
    expect(fertilityStatus(input, '2026-09-20')).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 9 })
    expect(fertilityStatus(input, '2026-09-29')).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 0 })
  })

  it('reports a late period once the expected day has passed', () => {
    expect(fertilityStatus(input, '2026-10-01')).toEqual({ kind: 'late', daysLate: 2, expected: '2026-09-29' })
  })
})

describe('mutations', () => {
  it('adds, replaces and sorts periods; sets/clears LH tests', () => {
    let s = base()
    s = addPeriod(s, '2026-09-01')
    s = addPeriod(s, '2026-08-01', '2026-08-05')
    s = addPeriod(s, '2026-09-01', '2026-09-04')
    expect(s.periods).toEqual([
      { start: '2026-08-01', end: '2026-08-05' },
      { start: '2026-09-01', end: '2026-09-04' },
    ])
    s = setLHTest(s, '2026-09-14', 'positive')
    expect(s.lhTests).toEqual([{ date: '2026-09-14', result: 'positive' }])
    s = setLHTest(s, '2026-09-14', null)
    expect(s.lhTests).toEqual([])
  })

  it('rejects an end date before the start', () => {
    expect(addPeriod(base(), '2026-09-05', '2026-09-01').periods).toEqual([{ start: '2026-09-05' }])
  })
})
