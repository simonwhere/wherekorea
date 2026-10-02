import { describe, expect, it } from 'vitest'
import * as cycleModule from '@/lib/logic/cycle'
import {
  addPeriod,
  chanceLevel,
  cycleAt,
  cycleStats,
  dayInfo,
  fertilityStatus,
  firstSurge,
  isSurge,
  setLHTest,
  setPeriodEnd,
  strongestLH,
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

  it('flags averages outside 21–35 only from logged cycles, never from the settings value alone', () => {
    // An onboarding guess (36 or 40 days, nothing measured) is not a record of irregular cycles.
    expect(cycleStats([], { cycleLength: 40, periodLength: 5 }).irregular).toBe(false)
    expect(cycleStats([{ start: '2026-09-01' }], { cycleLength: 36, periodLength: 5 })).toMatchObject({ source: 'settings', irregular: false })
    // Two measured 40-day cycles do flag it.
    const logged = cycleStats([{ start: '2026-01-01' }, { start: '2026-02-10' }, { start: '2026-03-22' }], { cycleLength: 28, periodLength: 5 })
    expect(logged).toMatchObject({ source: 'logs', average: 40, irregular: true })
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

describe('LH strength (음성 · 희미 · 양성 · 가장 진함)', () => {
  const input = base({ periods: [{ start: '2026-09-01' }] })

  it('counts 양성 and 가장 진함 as a surge, not 희미', () => {
    expect(isSurge('positive')).toBe(true)
    expect(isSurge('peak')).toBe(true)
    expect(isSurge('faint')).toBe(false)
    expect(isSurge('negative')).toBe(false)
    expect(cycleAt({ ...input, lhTests: [{ date: '2026-09-14', result: 'faint' }] }, '2026-09-10')!.basis).toBe('calendar')
    expect(cycleAt({ ...input, lhTests: [{ date: '2026-09-14', result: 'peak' }] }, '2026-09-10')!.ovulation).toBe('2026-09-15')
  })

  it('uses the earliest surge day of the cycle: ovulation the next day', () => {
    const lhTests = [
      { date: '2026-09-17', result: 'peak' as const },
      { date: '2026-09-16', time: '20:00', result: 'positive' as const },
      { date: '2026-09-16', time: '08:00', result: 'faint' as const },
      { date: '2026-09-15', result: 'faint' as const },
    ]
    expect(firstSurge('2026-09-01', 28, lhTests)).toBe('2026-09-16')
    expect(cycleAt({ ...input, lhTests }, '2026-09-10')!.ovulation).toBe('2026-09-17')
    // The day shows its strongest result (two tests a day).
    expect(dayInfo({ ...input, lhTests }, '2026-09-16').hasLH).toBe('positive')
    expect(strongestLH(['faint', 'negative'])).toBe('faint')
    expect(strongestLH([])).toBeUndefined()
  })

  it('ignores surges on cycle days 1–5 and, for a finished cycle, after it', () => {
    expect(firstSurge('2026-09-01', 28, [{ date: '2026-09-05', result: 'positive' }])).toBeUndefined()
    expect(firstSurge('2026-09-01', 28, [{ date: '2026-09-06', result: 'positive' }])).toBe('2026-09-06')
    // A late surge still counts for the running cycle (a week of slack) but not with slack 0.
    expect(firstSurge('2026-09-01', 28, [{ date: '2026-10-01', result: 'positive' }])).toBe('2026-10-01')
    expect(firstSurge('2026-09-01', 28, [{ date: '2026-10-01', result: 'positive' }], 0)).toBeUndefined()
  })

  it('a finished cycle never takes a surge from the cycle after it', () => {
    // 09-01 → 09-29 (28 days). A surge on 10-05 is cycle day 7 of the next cycle.
    const two = base({ periods: [{ start: '2026-09-01' }, { start: '2026-09-29' }], lhTests: [{ date: '2026-10-05', result: 'positive' }] })
    const first = cycleAt(two, '2026-09-10')!
    expect(first.basis).toBe('calendar')
    expect(first.ovulation).toBe('2026-09-15')
    expect(first.fertileEnd < '2026-09-29').toBe(true)
    // It moves the next cycle instead.
    expect(cycleAt(two, '2026-10-02')!.ovulation).toBe('2026-10-06')
  })

  it('no longer exports the unverified per-day probability table', () => {
    // Only the ~10% / ~33% endpoints were verified (review N1).
    expect('DAY_SPECIFIC_PROBABILITY' in cycleModule).toBe(false)
  })
})

describe('who logged it', () => {
  it('addPeriod and setPeriodEnd keep the author', () => {
    let s = addPeriod(base(), '2026-09-01', undefined, 'b')
    expect(s.periods).toEqual([{ start: '2026-09-01', by: 'b' }])
    s = setPeriodEnd(s, '2026-09-01', '2026-09-05')
    expect(s.periods).toEqual([{ start: '2026-09-01', end: '2026-09-05', by: 'b' }])
    s = addPeriod(s, '2026-09-01', '2026-09-04')
    expect(s.periods).toEqual([{ start: '2026-09-01', end: '2026-09-04', by: 'b' }])
    expect(setPeriodEnd(s, '2026-09-01', undefined).periods).toEqual([{ start: '2026-09-01', by: 'b' }])
  })
})
