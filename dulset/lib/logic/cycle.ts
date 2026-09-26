// Cycle + fertile-window estimation (pure functions).
//
// Model (calendar method, refined by LH tests when logged):
//   • ovulation ≈ next period start − 14 days (luteal phase ≈ 14 days)
//   • fertile window = the 6 days ending on ovulation day (Wilcox et al., NEJM 1995;
//     ASRM 2022). Days after ovulation are deliberately NOT included — conception
//     probability falls to ~0 then, and apps that add them overstate the window
//     (Setton et al., Obstet Gynecol 2016)
//   • "peak" = the 3 days ending on ovulation day; fecundability is highest for
//     intercourse in the 2 days before ovulation (ASRM 2022; Dunson 1999)
//   • a positive LH test moves ovulation to the day after the first positive test
//     (ovulation typically follows the LH surge by ~24–36 h)
// Calendar predictions are rough: only ~30% of women have their whole fertile window
// inside cycle days 10–17 (Wilcox 2000, BMJ), and cycle-length-only methods hit the
// real ovulation day ≤21% of the time (Johnson 2018). The UI must present these as
// estimates, nudge toward LH tests, and never frame them as contraception or diagnosis.

import { addDays, diffDays, isBetween } from '../dates'
import type { CycleSettings, ISODate, LHTest, PeriodLog } from '../types'

export const LUTEAL_DAYS = 14
/** Days before ovulation that sperm can survive and conception is possible. */
export const FERTILE_DAYS_BEFORE = 5
/** Days after estimated ovulation counted as fertile (0 — see header). */
export const FERTILE_DAYS_AFTER = 0
/** Peak = ovulation − 2 … ovulation. */
export const PEAK_DAYS_BEFORE = 2

/** Plausible range for a single measured cycle; gaps outside it are likely missed logs. */
export const MIN_CYCLE = 15
export const MAX_CYCLE = 60
/** How many recent cycles to average. */
const RECENT_CYCLES = 6

/**
 * Approximate probability of conception from intercourse on a single day relative to
 * ovulation (day 0), from Wilcox, Weinberg & Baird, NEJM 1995;333:1517-21.
 */
export const DAY_SPECIFIC_PROBABILITY: Readonly<Record<number, number>> = {
  [-5]: 0.1,
  [-4]: 0.16,
  [-3]: 0.14,
  [-2]: 0.27,
  [-1]: 0.31,
  [0]: 0.33,
}

export interface CycleStats {
  /** Measured cycle lengths, oldest → newest (only the plausible ones). */
  lengths: number[]
  /** Length used for predictions. */
  average: number
  source: 'logs' | 'settings'
  min?: number
  max?: number
  /**
   * True when logs suggest irregular cycles: average outside 21–35 days, or the
   * shortest and longest recent cycles differ by more than 7 days.
   */
  irregular: boolean
}

export function sortedStarts(periods: PeriodLog[]): ISODate[] {
  return Array.from(new Set(periods.map((p) => p.start))).sort()
}

export function cycleStats(periods: PeriodLog[], settings: CycleSettings): CycleStats {
  const starts = sortedStarts(periods)
  const lengths: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i - 1]!, starts[i]!)
    if (len >= MIN_CYCLE && len <= MAX_CYCLE) lengths.push(len)
  }
  const recent = lengths.slice(-RECENT_CYCLES)
  if (recent.length === 0) {
    const average = clampCycle(settings.cycleLength)
    return { lengths, average, source: 'settings', irregular: average < 21 || average > 35 }
  }
  const average = clampCycle(Math.round(recent.reduce((a, b) => a + b, 0) / recent.length))
  const min = Math.min(...recent)
  const max = Math.max(...recent)
  const irregular = average < 21 || average > 35 || (recent.length >= 2 && max - min > 7)
  return { lengths, average, source: 'logs', min, max, irregular }
}

function clampCycle(n: number): number {
  if (!Number.isFinite(n)) return 28
  return Math.min(MAX_CYCLE, Math.max(MIN_CYCLE, Math.round(n)))
}

export interface CycleWindow {
  /** Day 1 of this cycle (a logged period start, or projected). */
  start: ISODate
  /** Whether `start` is a logged period or a projection. */
  startLogged: boolean
  length: number
  /** Projected start of the following period. */
  nextPeriod: ISODate
  ovulation: ISODate
  fertileStart: ISODate
  fertileEnd: ISODate
  peakStart: ISODate
  peakEnd: ISODate
  /**
   * Wider "could also be fertile" band around a calendar estimate, reflecting
   * luteal-phase variation (~±2 days) and, for projected cycles, the spread of
   * the couple's own recent cycle lengths. Equals the fertile window when an LH
   * test pinned ovulation.
   */
  broadStart: ISODate
  broadEnd: ISODate
  basis: 'calendar' | 'lh'
}

/** Extra days of uncertainty before/after a calendar estimate. */
interface Spread {
  early: number
  late: number
}

const LUTEAL_SPREAD = 2

function buildWindow(
  start: ISODate,
  startLogged: boolean,
  length: number,
  lhOvulation?: ISODate,
  spread: Spread = { early: 0, late: 0 },
): CycleWindow {
  const nextPeriod = addDays(start, length)
  // Never put ovulation before cycle day 8 even for very short averages.
  const calendarOvulation = addDays(start, Math.max(7, length - LUTEAL_DAYS))
  const ovulation = lhOvulation ?? calendarOvulation
  const fertileStart = addDays(ovulation, -FERTILE_DAYS_BEFORE)
  const fertileEnd = addDays(ovulation, FERTILE_DAYS_AFTER)
  let broadStart = fertileStart
  let broadEnd = fertileEnd
  if (!lhOvulation) {
    broadStart = addDays(fertileStart, -(LUTEAL_SPREAD + spread.early))
    broadEnd = addDays(ovulation, LUTEAL_SPREAD + spread.late)
    const earliest = addDays(start, 5) // cycle day 6
    const latest = addDays(nextPeriod, -1)
    if (broadStart < earliest) broadStart = earliest < fertileStart ? earliest : fertileStart
    if (broadEnd > latest) broadEnd = latest > fertileEnd ? latest : fertileEnd
  }
  return {
    start,
    startLogged,
    length,
    nextPeriod,
    ovulation,
    fertileStart,
    fertileEnd,
    peakStart: addDays(ovulation, -PEAK_DAYS_BEFORE),
    peakEnd: ovulation,
    broadStart,
    broadEnd,
    basis: lhOvulation ? 'lh' : 'calendar',
  }
}

/** First positive LH test inside [start, start + length + 7). */
function lhOvulationFor(start: ISODate, length: number, lhTests: LHTest[]): ISODate | undefined {
  const positives = lhTests
    .filter((t) => t.result === 'positive' && diffDays(start, t.date) >= 0 && diffDays(start, t.date) < length + 7)
    .map((t) => t.date)
    .sort()
  // Ignore a positive during the period itself (cycle day 1–5) — almost certainly noise.
  const first = positives.find((d) => diffDays(start, d) >= 5)
  return first ? addDays(first, 1) : undefined
}

export interface CycleInput {
  periods: PeriodLog[]
  lhTests: LHTest[]
  cycle: CycleSettings
}

/**
 * The cycle containing `date`. Returns null until at least one period is logged.
 * Dates after the last logged period are covered by projecting forward with the
 * average length; dates before the first logged period return null.
 */
export function cycleAt(input: CycleInput, date: ISODate): CycleWindow | null {
  const starts = sortedStarts(input.periods)
  if (starts.length === 0) return null
  const stats = cycleStats(input.periods, input.cycle)

  // Latest logged start on/before date.
  let idx = -1
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= date) idx = i
  if (idx === -1) return null

  const loggedStart = starts[idx]!
  const nextLogged = starts[idx + 1]
  if (nextLogged) {
    // A completed, measured cycle — use its real length (unless it was a missed log).
    const len = diffDays(loggedStart, nextLogged)
    if (len >= MIN_CYCLE && len <= MAX_CYCLE) {
      return buildWindow(loggedStart, true, len, lhOvulationFor(loggedStart, len, input.lhTests))
    }
  }

  const L = stats.average
  // The couple's own variability widens the band for not-yet-finished cycles.
  const spread: Spread =
    stats.min !== undefined && stats.max !== undefined
      ? { early: Math.max(0, L - stats.min), late: Math.max(0, stats.max - L) }
      : { early: 0, late: 0 }
  const k = Math.floor(diffDays(loggedStart, date) / L)
  if (k <= 0 || nextLogged) {
    return buildWindow(loggedStart, true, L, lhOvulationFor(loggedStart, L, input.lhTests), spread)
  }
  const projectedStart = addDays(loggedStart, k * L)
  return buildWindow(projectedStart, false, L, lhOvulationFor(projectedStart, L, input.lhTests), spread)
}

/** 'possible' = inside the wider uncertainty band but outside the estimated window. */
export type DayPhase = 'period' | 'period-predicted' | 'peak' | 'fertile' | 'possible' | 'none'

export interface DayInfo {
  date: ISODate
  phase: DayPhase
  isOvulation: boolean
  /** 1-based cycle day, when inside a known/projected cycle. */
  cycleDay?: number
  /** Days relative to estimated ovulation (0 = ovulation day). */
  ovulationOffset?: number
  hasLH?: 'positive' | 'negative'
}

function loggedPeriodCovers(periods: PeriodLog[], date: ISODate, periodLength: number): boolean {
  return periods.some((p) => {
    const end = p.end && p.end >= p.start ? p.end : addDays(p.start, Math.max(1, periodLength) - 1)
    return isBetween(date, p.start, end)
  })
}

export function dayInfo(input: CycleInput, date: ISODate): DayInfo {
  const lh = input.lhTests.find((t) => t.date === date)?.result
  const w = cycleAt(input, date)
  const base: DayInfo = { date, phase: 'none', isOvulation: false, hasLH: lh }
  if (loggedPeriodCovers(input.periods, date, input.cycle.periodLength)) {
    return { ...base, phase: 'period', ...(w ? cyclePos(w, date) : {}) }
  }
  if (!w) return base
  const pos = cyclePos(w, date)
  // Projected period days of a projected cycle (never overrides a logged one).
  if (!w.startLogged && diffDays(w.start, date) < input.cycle.periodLength) {
    return { ...base, ...pos, phase: 'period-predicted' }
  }
  let phase: DayPhase = 'none'
  if (isBetween(date, w.peakStart, w.peakEnd)) phase = 'peak'
  else if (isBetween(date, w.fertileStart, w.fertileEnd)) phase = 'fertile'
  else if (isBetween(date, w.broadStart, w.broadEnd)) phase = 'possible'
  return { ...base, ...pos, phase, isOvulation: date === w.ovulation }
}

function cyclePos(w: CycleWindow, date: ISODate): Pick<DayInfo, 'cycleDay' | 'ovulationOffset'> {
  return { cycleDay: diffDays(w.start, date) + 1, ovulationOffset: diffDays(w.ovulation, date) }
}

export type FertilityStatus =
  | { kind: 'no-data' }
  | { kind: 'period'; cycleDay: number; nextFertileStart: ISODate }
  | { kind: 'before-fertile'; daysUntil: number; fertileStart: ISODate; cycleDay: number }
  | { kind: 'fertile'; peak: boolean; isOvulation: boolean; fertileEnd: ISODate; cycleDay: number }
  | { kind: 'after-fertile'; nextPeriod: ISODate; daysUntilPeriod: number; cycleDay: number }
  | { kind: 'late'; daysLate: number; expected: ISODate }

/**
 * One-line summary of "where are we today" for the home screen and alerts.
 * `late` means the expected period has passed with nothing logged — the UI should
 * gently suggest logging the period or taking a pregnancy test.
 */
export function fertilityStatus(input: CycleInput, today: ISODate): FertilityStatus {
  const starts = sortedStarts(input.periods)
  if (starts.length === 0) return { kind: 'no-data' }
  const last = starts[starts.length - 1]!
  const stats = cycleStats(input.periods, input.cycle)
  const expected = addDays(last, stats.average)
  const daysPast = diffDays(expected, today)
  if (last <= today && daysPast >= 1) {
    return { kind: 'late', daysLate: daysPast, expected }
  }
  // On the expected day itself (nothing logged yet) stay in the current cycle
  // instead of jumping to the projected next one.
  const w = cycleAt(input, today === expected ? addDays(expected, -1) : today)
  if (!w) return { kind: 'no-data' }
  if (today === expected) {
    return { kind: 'after-fertile', nextPeriod: expected, daysUntilPeriod: 0, cycleDay: diffDays(w.start, today) + 1 }
  }
  const info = dayInfo(input, today)
  const cycleDay = info.cycleDay ?? 1
  if (info.phase === 'period') {
    return { kind: 'period', cycleDay, nextFertileStart: w.fertileStart }
  }
  if (today < w.fertileStart) {
    return { kind: 'before-fertile', daysUntil: diffDays(today, w.fertileStart), fertileStart: w.fertileStart, cycleDay }
  }
  if (today <= w.fertileEnd) {
    return {
      kind: 'fertile',
      peak: info.phase === 'peak',
      isOvulation: info.isOvulation,
      fertileEnd: w.fertileEnd,
      cycleDay,
    }
  }
  return { kind: 'after-fertile', nextPeriod: w.nextPeriod, daysUntilPeriod: diffDays(today, w.nextPeriod), cycleDay }
}

/**
 * Upcoming fertile windows (current one first if still ongoing), for alerts,
 * the calendar legend and .ics export.
 */
export function upcomingWindows(input: CycleInput, from: ISODate, count = 3): CycleWindow[] {
  const out: CycleWindow[] = []
  let cursor = from
  for (let guard = 0; out.length < count && guard < count * 3; guard++) {
    const w = cycleAt(input, cursor)
    if (!w) break
    if (w.fertileEnd >= from && !out.some((o) => o.start === w.start)) out.push(w)
    cursor = w.nextPeriod
  }
  return out
}

export type ChanceLevel = 'high' | 'medium' | 'low'

export function chanceLevel(ovulationOffset: number | undefined): ChanceLevel {
  if (ovulationOffset === undefined) return 'low'
  if (ovulationOffset >= -PEAK_DAYS_BEFORE && ovulationOffset <= 0) return 'high'
  if (ovulationOffset >= -FERTILE_DAYS_BEFORE && ovulationOffset <= FERTILE_DAYS_AFTER) return 'medium'
  return 'low'
}

// ── Mutations (pure) ────────────────────────────────────────

export function addPeriod<S extends CycleInput>(state: S, start: ISODate, end?: ISODate): S {
  const periods = state.periods.filter((p) => p.start !== start)
  periods.push(end && end >= start ? { start, end } : { start })
  periods.sort((a, b) => (a.start < b.start ? -1 : 1))
  return { ...state, periods }
}

export function removePeriod<S extends CycleInput>(state: S, start: ISODate): S {
  return { ...state, periods: state.periods.filter((p) => p.start !== start) }
}

export function setPeriodEnd<S extends CycleInput>(state: S, start: ISODate, end: ISODate | undefined): S {
  return {
    ...state,
    periods: state.periods.map((p) =>
      p.start === start ? (end && end >= start ? { start, end } : { start: p.start }) : p,
    ),
  }
}

/** Set or clear (result = null) the LH test for a date. */
export function setLHTest<S extends CycleInput>(state: S, date: ISODate, result: LHTest['result'] | null): S {
  const lhTests = state.lhTests.filter((t) => t.date !== date)
  if (result) lhTests.push({ date, result })
  lhTests.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { ...state, lhTests }
}
