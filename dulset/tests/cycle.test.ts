import { describe, expect, it } from 'vitest'
import * as cycleModule from '@/lib/logic/cycle'
import {
  CONFIDENCE_MIN_CYCLES,
  CONFIDENCE_SPREAD,
  DUE_CLIP_DAYS,
  DUE_SETTINGS_SPREAD,
  LH_LUTEAL_MIN_DAYS,
  LUTEAL_SPREAD,
  MAX_CYCLE,
  MAX_CYCLE_LONG,
  NO_SURGE_WAIT_DAYS,
  addPeriod,
  chanceLevel,
  cycleAt,
  cycleConfidence,
  cycleStats,
  dayInfo,
  daysLate,
  expectedPeriod,
  fertilityStatus,
  firstSurge,
  forecastLimit,
  isSurge,
  lateFrom,
  lhTestsInCycle,
  maxCycleLength,
  noSurgeWait,
  setLHTest,
  setPeriodEnd,
  strongestLH,
  upcomingWindows,
  type CycleInput,
} from '@/lib/logic/cycle'
import { LATE_TEST_DAYS, PERIOD_DUE_COPY, dueLine, dueRange } from '@/lib/logic/periodDue'

const base = (over: Partial<CycleInput> = {}): CycleInput => ({
  periods: [],
  lhTests: [],
  cycle: { cycleLength: 28, periodLength: 5 },
  ...over,
})

describe('cycleStats', () => {
  it('falls back to settings without enough logs', () => {
    const s = cycleStats([{ start: '2026-09-01' }], { cycleLength: 30, periodLength: 5 })
    expect(s).toMatchObject({ average: 30, source: 'settings', irregular: false, confidence: 'low', count: 0 })
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
    expect(s.count).toBe(2)
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
  // Three logged 28-day cycles before the current one: confidence 'cycles'.
  const input = base({
    periods: [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01', end: '2026-09-04' }],
  })

  it('classifies phases (three regular cycles: the peak days and the ovulation marker show)', () => {
    expect(dayInfo(input, '2026-09-03').phase).toBe('period')
    expect(dayInfo(input, '2026-09-05').phase).toBe('none')
    expect(dayInfo(input, '2026-09-10').phase).toBe('fertile')
    expect(dayInfo(input, '2026-09-14').phase).toBe('peak')
    expect(dayInfo(input, '2026-09-15')).toMatchObject({ phase: 'peak', isOvulation: true, cycleDay: 15, ovulationOffset: 0, confidence: 'cycles' })
    expect(dayInfo(input, '2026-09-16').phase).toBe('possible')
    expect(dayInfo(input, '2026-09-18').phase).toBe('none')
    expect(dayInfo(input, '2026-09-08').phase).toBe('possible')
    expect(dayInfo(input, '2026-09-30').phase).toBe('period-predicted')
    // Three identical cycles: the range is the one day 09-29; 09-28 is still an ordinary day.
    expect(dayInfo(input, '2026-09-28').phase).toBe('none')
    expect(dayInfo(input, '2026-09-29').phase).toBe('period-predicted')
  })

  it('shows the expected range as 생리 예정 (settings only: average ± 2)', () => {
    const low = base({ periods: [{ start: '2026-09-01', end: '2026-09-04' }] })
    expect(dayInfo(low, '2026-09-26').phase).toBe('none')
    for (const d of ['2026-09-27', '2026-09-29', '2026-10-01']) expect(dayInfo(low, d).phase, d).toBe('period-predicted')
    expect(dayInfo(low, '2026-10-02').phase).toBe('period-predicted') // the projected cycle's period
    expect(dayInfo(low, '2026-10-05').phase).toBe('none')
    // The projected cycle still starts at start + average: its window is unchanged.
    expect(cycleAt(low, '2026-10-05')!.start).toBe('2026-09-29')
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
  // One logged period + the 28-day setting: the range is 09-27…10-01 (settings basis).
  const input = base({ periods: [{ start: '2026-09-01', end: '2026-09-05' }] })
  // Three regular 28-day cycles: the range is the single day 09-29 (calendar basis, min = max).
  const regular = base({
    periods: [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01', end: '2026-09-05' }],
  })

  it('walks through a cycle', () => {
    expect(fertilityStatus(base(), '2026-09-10')).toEqual({ kind: 'no-data' })
    expect(fertilityStatus(input, '2026-09-02')).toMatchObject({ kind: 'period', cycleDay: 2, confidence: 'low' })
    expect(fertilityStatus(input, '2026-09-07')).toMatchObject({ kind: 'before-fertile', daysUntil: 3 })
    expect(fertilityStatus(input, '2026-09-11')).toMatchObject({ kind: 'fertile', peak: false })
    // Settings only: no peak day, no ovulation day (low confidence).
    expect(fertilityStatus(input, '2026-09-15')).toMatchObject({ kind: 'fertile', peak: false, isOvulation: false, confidence: 'low' })
    expect(fertilityStatus(regular, '2026-09-15')).toMatchObject({ kind: 'fertile', peak: true, isOvulation: true, confidence: 'cycles' })
    expect(fertilityStatus(input, '2026-09-20')).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 7, dueNow: false })
    expect(fertilityStatus(regular, '2026-09-20')).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 9, nextPeriod: '2026-09-29' })
    // Inside the range the cycle keeps counting (never the projected next one).
    expect(fertilityStatus(input, '2026-09-29')).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 0, dueNow: true, cycleDay: 29 })
    expect(fertilityStatus(input, '2026-10-01')).toMatchObject({ kind: 'after-fertile', dueNow: true, cycleDay: 31 })
  })

  it('reports a late period only the day after the range (lateFrom = to + 1)', () => {
    const due = expectedPeriod(input, '2026-09-01')
    expect(due).toEqual({ from: '2026-09-27', to: '2026-10-01', basis: 'settings' })
    expect(lateFrom(due)).toBe('2026-10-02')
    expect(fertilityStatus(input, '2026-10-01').kind).toBe('after-fertile')
    expect(fertilityStatus(input, '2026-10-02')).toEqual({ kind: 'late', daysLate: 1, due })
    expect(fertilityStatus(input, '2026-10-04')).toMatchObject({ kind: 'late', daysLate: 3 })
    expect(daysLate(due, '2026-09-30')).toBe(0)
    expect(daysLate(due, '2026-10-04')).toBe(3)
    // Three regular cycles: the single-day range 09-29 → late from 09-30.
    expect(fertilityStatus(regular, '2026-09-29')).toMatchObject({ kind: 'after-fertile', dueNow: true })
    expect(fertilityStatus(regular, '2026-09-30')).toMatchObject({ kind: 'late', daysLate: 1 })
  })
})

// ── N10: the expected period is a range ─────────────────────

describe('expectedPeriod', () => {
  // 지은: five cycles of 29…34 days (average 31) — the review's case.
  const jieun = base({
    periods: [
      { start: '2026-04-01' }, // 30
      { start: '2026-05-01' }, // 34
      { start: '2026-06-04' }, // 29
      { start: '2026-07-03' }, // 34
      { start: '2026-08-06' }, // 29
      { start: '2026-09-04' },
    ],
  })

  it('calendar basis: the measured min…max, clipped to average ± 4', () => {
    const stats = cycleStats(jieun.periods, jieun.cycle)
    expect(stats).toMatchObject({ average: 31, min: 29, max: 34, count: 5, confidence: 'cycles' })
    expect(expectedPeriod(jieun, '2026-09-04')).toEqual({ from: '2026-10-03', to: '2026-10-08', basis: 'calendar' })
    expect(DUE_CLIP_DAYS).toBe(4)
    // Days 32 and 33 (10-05, 10-06) are inside the range — NOT late.
    expect(fertilityStatus(jieun, '2026-10-05')).toMatchObject({ kind: 'after-fertile', dueNow: true, cycleDay: 32 })
    expect(fertilityStatus(jieun, '2026-10-06')).toMatchObject({ kind: 'after-fertile', dueNow: true, cycleDay: 33 })
    expect(fertilityStatus(jieun, '2026-10-08')).toMatchObject({ kind: 'after-fertile', dueNow: true })
    expect(fertilityStatus(jieun, '2026-10-09')).toMatchObject({ kind: 'late', daysLate: 1 })
    // A wide spread is clipped: 24, 36, 28 (average 29) → 25…33.
    const wide = base({ periods: [{ start: '2026-06-01' }, { start: '2026-06-25' }, { start: '2026-07-31' }, { start: '2026-08-28' }] })
    expect(cycleStats(wide.periods, wide.cycle)).toMatchObject({ average: 29, min: 24, max: 36 })
    expect(expectedPeriod(wide, '2026-08-28')).toEqual({ from: '2026-09-22', to: '2026-09-30', basis: 'calendar' })
  })

  it('settings basis (fewer than three cycles): average ± 2', () => {
    expect(DUE_SETTINGS_SPREAD).toBe(2)
    expect(expectedPeriod(base({ periods: [{ start: '2026-09-01' }] }), '2026-09-01')).toEqual({ from: '2026-09-27', to: '2026-10-01', basis: 'settings' })
    // Two logged cycles (30, 30): still ± 2 around the measured average.
    const two = base({ periods: [{ start: '2026-07-03' }, { start: '2026-08-02' }, { start: '2026-09-01' }] })
    expect(expectedPeriod(two, '2026-09-01')).toEqual({ from: '2026-09-29', to: '2026-10-03', basis: 'settings' })
  })

  it('lh basis: max(start + average, ovulation + 12), two days wide', () => {
    expect(LH_LUTEAL_MIN_DAYS).toBe(12)
    expect(LUTEAL_SPREAD).toBe(2)
    // Surge on 09-21 → ovulation 09-22 → 10-04 is later than start + 31 (10-05)? No: 09-04 + 31 = 10-05 wins.
    const lateSurge = { ...jieun, lhTests: [{ date: '2026-09-25', result: 'positive' as const }] }
    // ovulation 09-26 + 12 = 10-08 > 10-05 → 10-08…10-10.
    expect(expectedPeriod(lateSurge, '2026-09-04')).toEqual({ from: '2026-10-08', to: '2026-10-10', basis: 'lh' })
    expect(fertilityStatus(lateSurge, '2026-10-05')).toMatchObject({ kind: 'after-fertile', dueNow: false, daysUntilPeriod: 3 })
    expect(fertilityStatus(lateSurge, '2026-10-11')).toMatchObject({ kind: 'late', daysLate: 1 })
    // An early surge never pulls the estimate before start + average (review D1: 9 days past ovulation was called late).
    const earlySurge = { ...jieun, lhTests: [{ date: '2026-09-15', result: 'peak' as const }] }
    expect(expectedPeriod(earlySurge, '2026-09-04')).toEqual({ from: '2026-10-05', to: '2026-10-07', basis: 'lh' })
    expect(fertilityStatus(earlySurge, '2026-09-25').kind).toBe('after-fertile')
    expect(cycleAt(earlySurge, '2026-09-25')!.nextPeriod).toBe('2026-10-05')
    // The projected next cycle starts where the range starts when LH moved it.
    expect(cycleAt(lateSurge, '2026-10-05')!.start).toBe('2026-09-04')
    expect(cycleAt(lateSurge, '2026-10-08')!).toMatchObject({ start: '2026-10-08', startLogged: false })
  })

  it('shows the range as 생리 예정 days and stops the forecast after it', () => {
    for (const d of ['2026-10-03', '2026-10-05', '2026-10-08']) expect(dayInfo(jieun, d, '2026-10-02').phase, d).toBe('period-predicted')
    expect(dayInfo(jieun, '2026-10-02', '2026-10-02').phase).toBe('none')
    // Late (10-10): the range stays visible, nothing after it is projected.
    expect(forecastLimit(jieun, '2026-10-10')).toMatchObject({ from: '2026-10-03', reason: 'late', due: { to: '2026-10-08' } })
    expect(dayInfo(jieun, '2026-10-06', '2026-10-10')).toMatchObject({ phase: 'period-predicted', cycleDay: 33, unpredicted: 'late' })
    expect(dayInfo(jieun, '2026-10-09', '2026-10-10')).toMatchObject({ phase: 'none', unpredicted: 'late', cycleDay: 36 })
    expect(upcomingWindows(jieun, '2026-10-10')).toEqual([])
    expect(upcomingWindows(jieun, '2026-10-08')).toHaveLength(3)
  })

  it('words it once, as a range', () => {
    const due = { from: '2026-10-21', to: '2026-10-23', basis: 'calendar' as const }
    expect(dueRange(due)).toBe('10월 21일~23일')
    expect(dueLine(due)).toBe('10월 21일~23일 무렵 (예상)')
    expect(dueRange({ from: '2026-09-27', to: '2026-10-01' })).toBe('9월 27일~10월 1일')
    expect(dueRange({ from: '2026-09-29', to: '2026-09-29' })).toBe('9월 29일')
    expect(LATE_TEST_DAYS).toBe(3)
    expect(PERIOD_DUE_COPY.late.body(due)).not.toMatch(/임신 테스트/)
    expect(PERIOD_DUE_COPY.lateTest.body(due, 3)).toContain('임신 테스트')
    expect(PERIOD_DUE_COPY.dueTomorrow.body(due)).toContain('무렵 (예상)')
    // The amenorrhea line carries no number of days (none in docs/research).
    expect(PERIOD_DUE_COPY.stillWaiting.body).not.toMatch(/\d+(일|주|개월)/)
    expect(PERIOD_DUE_COPY.stillWaiting.body).toContain('병원에서 확인해 봐요')
    for (const text of [
      PERIOD_DUE_COPY.late.body(due),
      PERIOD_DUE_COPY.lateTest.body(due, 3),
      PERIOD_DUE_COPY.stillWaiting.body,
      PERIOD_DUE_COPY.missedLog.body('2026-09-04'),
    ])
      expect(text).not.toMatch(/숙제|실패|노력|오늘 꼭|관계를 가져야/)
  })
})

// ── N12: confidence and long cycles ─────────────────────────

describe('cycleStats.confidence', () => {
  const three = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
  const settings = { cycleLength: 28, periodLength: 5 }

  it("is 'low' with settings only or one or two logged cycles", () => {
    expect(cycleStats([], settings).confidence).toBe('low')
    expect(cycleStats([{ start: '2026-09-01' }], settings).confidence).toBe('low')
    expect(cycleStats(three.slice(1), settings).confidence).toBe('low') // two cycles
    expect(CONFIDENCE_MIN_CYCLES).toBe(3)
  })

  it("is 'cycles' with three or more logged cycles that differ by at most 7 days", () => {
    expect(cycleStats(three, settings).confidence).toBe('cycles')
    expect(CONFIDENCE_SPREAD).toBe(7)
    // 29…34 (spread 5): still regular enough.
    const jieun = [{ start: '2026-04-01' }, { start: '2026-05-01' }, { start: '2026-06-04' }, { start: '2026-07-03' }, { start: '2026-08-06' }, { start: '2026-09-04' }]
    expect(cycleStats(jieun, settings).confidence).toBe('cycles')
    // 24, 35, 27, 32 (spread 11): irregular → low (review D3: 🌀 and 🌟 on the same day).
    const irregular = [{ start: '2026-05-01' }, { start: '2026-05-25' }, { start: '2026-06-29' }, { start: '2026-07-26' }, { start: '2026-08-27' }]
    expect(cycleStats(irregular, settings)).toMatchObject({ irregular: true, confidence: 'low' })
  })

  it("is 'lh' when this cycle has a surge (given the tests and today)", () => {
    const lh = [{ date: '2026-09-13', result: 'positive' as const }]
    expect(cycleStats([{ start: '2026-09-01' }], settings, lh, '2026-09-14').confidence).toBe('lh')
    expect(cycleStats([{ start: '2026-09-01' }], settings, lh, '2026-09-10').confidence).toBe('lh') // the surge is in this cycle, today before it
    expect(cycleStats(three, settings, lh, '2026-09-14').confidence).toBe('lh')
    // Last cycle's surge says nothing about this one.
    expect(cycleStats([{ start: '2026-08-04' }, { start: '2026-09-01' }], settings, [{ date: '2026-08-17', result: 'peak' }], '2026-09-10').confidence).toBe('low')
    expect(cycleConfidence(base({ periods: [{ start: '2026-09-01' }], lhTests: lh }), '2026-09-14')).toBe('lh')
    // Each window carries it: an LH-pinned current cycle, calendar projections after it.
    const input = base({ periods: [{ start: '2026-09-01' }], lhTests: lh })
    expect(cycleAt(input, '2026-09-10')!.confidence).toBe('lh')
    expect(cycleAt(input, '2026-10-10')!.confidence).toBe('low')
    expect(cycleAt(base({ periods: three }), '2026-10-10')!.confidence).toBe('cycles')
  })

  it('low confidence hides the peak days and the ovulation day everywhere dayInfo feeds', () => {
    const low = base({ periods: [{ start: '2026-09-01' }] })
    for (const d of ['2026-09-13', '2026-09-14', '2026-09-15']) {
      expect(dayInfo(low, d)).toMatchObject({ phase: 'fertile', isOvulation: false, confidence: 'low' })
    }
    expect(dayInfo(low, '2026-09-10').phase).toBe('fertile')
    expect(dayInfo(low, '2026-09-16').phase).toBe('possible')
    // An LH surge brings them back for this cycle.
    const lh = { ...low, lhTests: [{ date: '2026-09-12', result: 'positive' as const }] }
    expect(dayInfo(lh, '2026-09-13')).toMatchObject({ phase: 'peak', isOvulation: true, confidence: 'lh' })
  })
})

describe('long cycles (cycle.longCycles)', () => {
  const settings = { cycleLength: 28, periodLength: 5 }
  const long = { cycleLength: 50, periodLength: 5, longCycles: true }

  it('accepts cycles up to 90 days as real cycles (60 otherwise)', () => {
    expect(MAX_CYCLE).toBe(60)
    expect(MAX_CYCLE_LONG).toBe(90)
    expect(maxCycleLength(settings)).toBe(60)
    expect(maxCycleLength(long)).toBe(90)
    expect(maxCycleLength(undefined)).toBe(60)
    const periods = [{ start: '2026-01-01' }, { start: '2026-03-06' }, { start: '2026-04-30' }, { start: '2026-07-03' }] // 64, 55, 64
    expect(cycleStats(periods, settings).lengths).toEqual([55])
    expect(cycleStats(periods, long)).toMatchObject({ lengths: [64, 55, 64], average: 61, source: 'logs' })
    // The settings value clamps to 90 with longCycles, 60 without.
    expect(cycleStats([], { cycleLength: 75, periodLength: 5, longCycles: true }).average).toBe(75)
    expect(cycleStats([], { cycleLength: 75, periodLength: 5 }).average).toBe(60)
  })

  it('never names the peak days for a 긴 주기 setting (calendar alone), but an LH surge still does', () => {
    const periods = [{ start: '2026-01-01' }, { start: '2026-03-06' }, { start: '2026-04-30' }, { start: '2026-07-03' }]
    expect(cycleStats(periods, long).confidence).toBe('low')
    const w = cycleAt({ periods, lhTests: [], cycle: long }, '2026-07-10')!
    expect(w.confidence).toBe('low')
    expect(w.length).toBe(61)
    expect(dayInfo({ periods, lhTests: [], cycle: long }, w.ovulation).isOvulation).toBe(false)
    const lh = { periods, lhTests: [{ date: '2026-08-10', result: 'peak' as const }], cycle: long }
    expect(cycleAt(lh, '2026-07-10')!.confidence).toBe('lh')
    expect(dayInfo(lh, '2026-08-11').isOvulation).toBe(true)
  })

  it('a 64-day cycle is a cycle, not a missed log, and the day keeps counting past 60', () => {
    const periods = [{ start: '2026-01-01' }, { start: '2026-03-06' }, { start: '2026-04-30' }, { start: '2026-07-03' }]
    const input = { periods, lhTests: [], cycle: long }
    // 61-day average, three cycles → calendar range 57…65 (clipped ± 4): day 64 is still inside it.
    expect(expectedPeriod(input, '2026-07-03')).toEqual({ from: '2026-08-29', to: '2026-09-05', basis: 'calendar' })
    expect(fertilityStatus(input, '2026-09-04')).toMatchObject({ kind: 'after-fertile', dueNow: true, cycleDay: 64 })
    expect(fertilityStatus(input, '2026-09-06')).toMatchObject({ kind: 'late', daysLate: 1 })
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

describe('no surge by the window’s end (N11 tww-no-surge)', () => {
  // Three regular cycles then 09-01: window 09-10…09-15, ovulation 09-15.
  const regular = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
  const strips = ['2026-09-11', '2026-09-13', '2026-09-15'].map((date) => ({ date, result: 'negative' as const }))

  it('counts the cycle’s strips, and waits NO_SURGE_WAIT_DAYS past the window', () => {
    const input = base({ periods: regular, lhTests: [...strips, { date: '2026-08-10', result: 'positive' }] })
    expect(lhTestsInCycle(input.lhTests, '2026-09-01', '2026-09-30')).toBe(3)
    expect(lhTestsInCycle(input.lhTests, '2026-09-01', '2026-09-12')).toBe(1)
    expect(NO_SURGE_WAIT_DAYS).toBe(7)
    // Inside the window: nothing yet; from the day after it to +7: the wait; then nothing.
    expect(noSurgeWait(input, '2026-09-01', '2026-09-15')).toBeUndefined()
    expect(noSurgeWait(input, '2026-09-01', '2026-09-16')).toEqual({ tests: 3, fertileEnd: '2026-09-15', until: '2026-09-22' })
    expect(noSurgeWait(input, '2026-09-01', '2026-09-22')).toEqual({ tests: 3, fertileEnd: '2026-09-15', until: '2026-09-22' })
    expect(noSurgeWait(input, '2026-09-01', '2026-09-23')).toBeUndefined()
  })

  it('needs strips this cycle, and ends with a surge (the cycle is then LH-pinned)', () => {
    expect(noSurgeWait(base({ periods: regular }), '2026-09-01', '2026-09-16')).toBeUndefined()
    const pinned = base({ periods: regular, lhTests: [...strips, { date: '2026-09-17', result: 'positive' }] })
    expect(noSurgeWait(pinned, '2026-09-01', '2026-09-16')).toBeUndefined()
    expect(noSurgeWait(pinned, '2026-09-01', '2026-09-18')).toBeUndefined()
    // Two strips a day count as two.
    const twice = base({ periods: regular, lhTests: [...strips, { date: '2026-09-11', result: 'faint', time: '21:00' }] })
    expect(noSurgeWait(twice, '2026-09-01', '2026-09-16')?.tests).toBe(4)
  })
})
