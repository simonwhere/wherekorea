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
//   • an LH surge ('positive' or 'peak' — 양성 / 가장 진함) moves ovulation to the
//     day after the cycle's first surge day (ovulation typically follows the LH
//     surge by ~24–36 h). 'faint' (희미) is not a surge.
//   • the next period is a RANGE, not a day (expectedPeriod): the luteal phase
//     varies (Bull 2019: 12.4 days on average, 95% within 7–17), and so do the
//     couple's own cycles. "Late" only starts the day after that range ends.
//   • how much the calendar estimate can be trusted (CycleConfidence): an LH
//     surge this cycle, three or more regular logged cycles, or neither — with
//     neither, no peak days / ovulation marker are shown anywhere.
// Calendar predictions are rough: only ~30% of women have their whole fertile window
// inside cycle days 10–17 (Wilcox 2000, BMJ), and cycle-length-only methods hit the
// real ovulation day ≤21% of the time (Johnson 2018). The UI must present these as
// estimates, nudge toward LH tests, and never frame them as contraception or diagnosis.

import { addDays, diffDays, isBetween } from '../dates'
import type { CycleNotes, CycleSettings, ISODate, LHResult, LHTest, PeriodLog, Pregnancy } from '../types'

const LH_RANK: Record<LHResult, number> = { negative: 0, faint: 1, positive: 2, peak: 3 }

/** 'positive' and 'peak' (가장 진함) count as an LH surge. */
export function isSurge(result: LHResult): boolean {
  return result === 'positive' || result === 'peak'
}

/** The strongest of a day's results (two tests a day are allowed). */
export function strongestLH(results: LHResult[]): LHResult | undefined {
  return results.reduce<LHResult | undefined>((best, r) => (!best || LH_RANK[r] > LH_RANK[best] ? r : best), undefined)
}

export const LUTEAL_DAYS = 14
/** Days before ovulation that sperm can survive and conception is possible. */
export const FERTILE_DAYS_BEFORE = 5
/** Days after estimated ovulation counted as fertile (0 — see header). */
export const FERTILE_DAYS_AFTER = 0
/** Peak = ovulation − 2 … ovulation. */
export const PEAK_DAYS_BEFORE = 2
/**
 * LH testing starts this many days before the estimated window ("며칠 전부터").
 * The one value the home card's countdown and the log sheet's default chip share.
 */
export const LH_LEAD_DAYS = 3

/** Plausible range for a single measured cycle; gaps outside it are likely missed logs. */
export const MIN_CYCLE = 15
export const MAX_CYCLE = 60
/** With CycleSettings.longCycles ("45일 이상이거나 들쭉날쭉해요"): cycles up to this long are real cycles. */
export const MAX_CYCLE_LONG = 90
/** How many recent cycles to average. */
export const RECENT_CYCLES = 6

/** The longest gap between two period starts that still counts as one cycle, for these settings. */
export function maxCycleLength(settings: Partial<CycleSettings> | undefined): number {
  return settings?.longCycles ? MAX_CYCLE_LONG : MAX_CYCLE
}

/**
 * How far the calendar estimate can be trusted:
 *   lh     — an LH surge was logged this cycle (ovulation pinned)
 *   cycles — at least CONFIDENCE_MIN_CYCLES logged cycles that differ by no more
 *            than CONFIDENCE_SPREAD days (and not a 긴 주기 setting)
 *   low    — settings only, one or two logged cycles, irregular cycles, or
 *            longCycles: the window is a wide range; no peak days, no ⭐, no 🌟
 */
export type CycleConfidence = 'lh' | 'cycles' | 'low'
export const CONFIDENCE_MIN_CYCLES = 3
export const CONFIDENCE_SPREAD = 7

export interface CycleStats {
  /** Measured cycle lengths, oldest → newest (only the plausible ones). */
  lengths: number[]
  /** How many of them the average uses (the most recent, up to RECENT_CYCLES). */
  count: number
  /** Length used for predictions. */
  average: number
  source: 'logs' | 'settings'
  min?: number
  max?: number
  /**
   * True when logs suggest irregular cycles: average outside 21–35 days, or the
   * shortest and longest recent cycles differ by more than 7 days. Never from
   * the settings value alone (an onboarding guess is not a record).
   */
  irregular: boolean
  /**
   * 'lh' only when `lhTests` and `today` were given and the current cycle (the
   * last logged start on/before today) has a surge; otherwise from the logs.
   */
  confidence: CycleConfidence
}

export function sortedStarts(periods: PeriodLog[]): ISODate[] {
  return Array.from(new Set(periods.map((p) => p.start))).sort()
}

/** The confidence the logs alone give ('cycles' or 'low'). */
function logConfidence(recent: number[], settings: CycleSettings): Exclude<CycleConfidence, 'lh'> {
  if (settings.longCycles || recent.length < CONFIDENCE_MIN_CYCLES) return 'low'
  return Math.max(...recent) - Math.min(...recent) <= CONFIDENCE_SPREAD ? 'cycles' : 'low'
}

/** The pregnancy record as the cycle logic reads it (AppState passes the whole record through). */
export type PregnancySpan = Pick<Pregnancy, 'confirmedAt' | 'endedAt'> & Partial<Pick<Pregnancy, 'lmp'>>

/**
 * Did the gap between two logged starts hold a pregnancy that ended? That gap
 * — the last period before it to the first period after the loss — is not a
 * cycle: it never enters the average, the range or 'irregular' (review P-11:
 * cycles are not mixed across a loss). A pregnancy still going on, or one that
 * ended with a birth, has no `endedAt` and excludes nothing (the gap to the
 * first postpartum period is longer than any cycle anyway).
 */
export function spansEndedPregnancy(from: ISODate, to: ISODate, pregnancy: PregnancySpan | undefined): boolean {
  if (!pregnancy?.endedAt) return false
  const begin = pregnancy.lmp ?? pregnancy.confirmedAt
  return from <= pregnancy.endedAt && to > begin
}

/**
 * Average cycle length and how much to trust it. Pass `lhTests` and `today` to
 * learn whether this cycle's LH surge pins the estimate (confidence 'lh'), and
 * `pregnancy` so the gap that held an ended pregnancy is left out
 * (spansEndedPregnancy).
 */
export function cycleStats(
  periods: PeriodLog[],
  settings: CycleSettings,
  lhTests?: LHTest[],
  today?: ISODate,
  pregnancy?: PregnancySpan,
): CycleStats {
  const starts = sortedStarts(periods)
  const maxLen = maxCycleLength(settings)
  const lengths: number[] = []
  for (let i = 1; i < starts.length; i++) {
    if (spansEndedPregnancy(starts[i - 1]!, starts[i]!, pregnancy)) continue
    const len = diffDays(starts[i - 1]!, starts[i]!)
    if (len >= MIN_CYCLE && len <= maxLen) lengths.push(len)
  }
  const recent = lengths.slice(-RECENT_CYCLES)
  let stats: CycleStats
  if (recent.length === 0) {
    const average = clampCycle(settings.cycleLength, settings)
    stats = { lengths, count: 0, average, source: 'settings', irregular: false, confidence: 'low' }
  } else {
    const average = clampCycle(Math.round(recent.reduce((a, b) => a + b, 0) / recent.length), settings)
    const min = Math.min(...recent)
    const max = Math.max(...recent)
    const irregular = average < 21 || average > 35 || (recent.length >= 2 && max - min > CONFIDENCE_SPREAD)
    stats = { lengths, count: recent.length, average, source: 'logs', min, max, irregular, confidence: logConfidence(recent, settings) }
  }
  if (lhTests && today) {
    const cur = [...starts].reverse().find((d) => d <= today)
    if (cur && firstSurge(cur, stats.average, lhTests)) stats.confidence = 'lh'
  }
  return stats
}

/** The current cycle's confidence as of `today` (cycleStats with the LH tests). */
export function cycleConfidence(input: CycleInput, today: ISODate): CycleConfidence {
  return cycleStats(input.periods, input.cycle, input.lhTests, today, input.pregnancy).confidence
}

function clampCycle(n: number, settings: CycleSettings): number {
  if (!Number.isFinite(n)) return 28
  return Math.min(maxCycleLength(settings), Math.max(MIN_CYCLE, Math.round(n)))
}

export interface CycleWindow {
  /** Day 1 of this cycle (a logged period start, or projected). */
  start: ISODate
  /** Whether `start` is a logged period or a projection. */
  startLogged: boolean
  /** The length used for the estimate (the average; a finished cycle's real length). */
  length: number
  /**
   * Projected start of the following period: start + length, or — when an LH
   * surge pinned this cycle's ovulation — the start of the expected range
   * (expectedPeriod: at least 12 days after ovulation).
   */
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
  /** 'lh' when basis is 'lh'; otherwise what the logs give (cycleStats). */
  confidence: CycleConfidence
}

/** Extra days of uncertainty before/after a calendar estimate. */
interface Spread {
  early: number
  late: number
}

/** Luteal-phase variation either side of a calendar estimate. */
export const LUTEAL_SPREAD = 2

function buildWindow(
  start: ISODate,
  startLogged: boolean,
  length: number,
  lhOvulation: ISODate | undefined,
  spread: Spread,
  confidence: CycleConfidence,
  nextPeriodOverride?: ISODate,
): CycleWindow {
  const nextPeriod = nextPeriodOverride ?? addDays(start, length)
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
    confidence: lhOvulation ? 'lh' : confidence,
  }
}

/** LH tests on cycle days 1–5 are ignored as surges — almost certainly noise during the period. */
export const SURGE_MIN_CYCLE_DAY = 6

/**
 * The cycle's first LH surge day ('positive' or 'peak') inside
 * [start, start + length + slack), from cycle day 6 on. The default week of
 * slack lets a late surge still count while the period hasn't come; pass 0 for
 * a completed cycle.
 */
export function firstSurge(start: ISODate, length: number, lhTests: LHTest[], slack = 7): ISODate | undefined {
  return lhTests
    .filter((t) => isSurge(t.result))
    .map((t) => t.date)
    .filter((d) => {
      const n = diffDays(start, d)
      return n >= SURGE_MIN_CYCLE_DAY - 1 && n < length + slack
    })
    .sort()[0]
}

/** Ovulation ≈ the day after the first surge day. */
function lhOvulationFor(start: ISODate, length: number, lhTests: LHTest[], slack?: number): ISODate | undefined {
  const first = firstSurge(start, length, lhTests, slack)
  return first ? addDays(first, 1) : undefined
}

/** LH tests logged from `start` to `end` (inclusive) — one count per strip, two a day possible. */
export function lhTestsInCycle(lhTests: readonly LHTest[], start: ISODate, end: ISODate): number {
  return lhTests.filter((t) => t.date >= start && t.date <= end).length
}

/**
 * A cycle that tested LH but never saw a surge keeps testing this many days
 * past the estimated window (ovulation is often later than the calendar
 * says — Bull 2019: the follicular phase ran 10–30 days) before the home
 * moves on to the 기다리는 주 (N11 'tww-no-surge').
 */
export const NO_SURGE_WAIT_DAYS = 7

export interface NoSurgeWait {
  /** LH tests logged this cycle so far. */
  tests: number
  /** The estimated window's last day (the wait starts the day after). */
  fertileEnd: ISODate
  /** Last day of the wait (fertileEnd + NO_SURGE_WAIT_DAYS). */
  until: ISODate
}

/**
 * "아직 양성이 없었어요": the cycle starting on `cycleStart` has LH tests but no
 * surge, the estimated window has passed, and `today` is within
 * NO_SURGE_WAIT_DAYS after it. Undefined otherwise (no tests, a surge, still
 * inside the window, or past the wait).
 */
export function noSurgeWait(input: CycleInput, cycleStart: ISODate, today: ISODate): NoSurgeWait | undefined {
  const tests = lhTestsInCycle(input.lhTests, cycleStart, today)
  if (tests === 0) return undefined
  const w = cycleAt(input, cycleStart)
  if (!w || w.basis === 'lh') return undefined
  const until = addDays(w.fertileEnd, NO_SURGE_WAIT_DAYS)
  if (today <= w.fertileEnd || today > until) return undefined
  return { tests, fertileEnd: w.fertileEnd, until }
}

export interface CycleInput {
  periods: PeriodLog[]
  lhTests: LHTest[]
  cycle: CycleSettings
  /**
   * The couple's pregnancy record, if any (AppState passes it through). Once it
   * has ended (back to preparing), predictions pause until a period is logged
   * after `endedAt` — the old cycle says nothing about what comes next — and
   * the gap that held it never enters the average (spansEndedPregnancy).
   */
  pregnancy?: PregnancySpan
  /** Per-cycle notes ('아직 안 왔어요' …), passed through by AppState. */
  cycleNotes?: CycleNotes
}

// ── The expected period: a range ────────────────────────────

/**
 * When the next period is expected — a range, with what it rests on:
 *   lh       — a surge this cycle: from = max(start + average, ovulation + 12),
 *              to = from + 2 (the luteal phase rarely runs under 12 days;
 *              Bull 2019 — docs/research/medical.json)
 *   calendar — three or more logged cycles: from the shortest to the longest
 *              recent cycle, clipped to average ± 4
 *   settings — otherwise: average ± 2
 * "Late" starts the day after `to` (lateFrom); the day before `from` is when
 * "내일부터 생리 예정 무렵" goes out. Every screen reads this one function.
 */
export interface ExpectedPeriod {
  from: ISODate
  to: ISODate
  basis: 'lh' | 'calendar' | 'settings'
}

/** Ovulation + this many days at the earliest, when an LH surge pinned ovulation. */
export const LH_LUTEAL_MIN_DAYS = 12
/** The measured range is clipped to average ± this (calendar basis). */
export const DUE_CLIP_DAYS = 4
/** Without a measured range: average ± this (settings basis). */
export const DUE_SETTINGS_SPREAD = 2

function dueFor(stats: CycleStats, cycleStart: ISODate, lhTests: LHTest[]): ExpectedPeriod {
  const L = stats.average
  const surge = firstSurge(cycleStart, L, lhTests)
  if (surge) {
    const byAverage = addDays(cycleStart, L)
    const byLuteal = addDays(surge, 1 + LH_LUTEAL_MIN_DAYS)
    const from = byAverage > byLuteal ? byAverage : byLuteal
    return { from, to: addDays(from, LUTEAL_SPREAD), basis: 'lh' }
  }
  if (stats.source === 'logs' && stats.count >= CONFIDENCE_MIN_CYCLES && stats.min !== undefined && stats.max !== undefined) {
    const lo = Math.max(stats.min, L - DUE_CLIP_DAYS)
    const hi = Math.max(lo, Math.min(stats.max, L + DUE_CLIP_DAYS))
    return { from: addDays(cycleStart, lo), to: addDays(cycleStart, hi), basis: 'calendar' }
  }
  return { from: addDays(cycleStart, L - DUE_SETTINGS_SPREAD), to: addDays(cycleStart, L + DUE_SETTINGS_SPREAD), basis: 'settings' }
}

/** The expected period of the cycle starting on `cycleStart` (see ExpectedPeriod). */
export function expectedPeriod(input: CycleInput, cycleStart: ISODate): ExpectedPeriod {
  return dueFor(cycleStats(input.periods, input.cycle, undefined, undefined, input.pregnancy), cycleStart, input.lhTests)
}

/** The first day that counts as late: the day after the range. */
export function lateFrom(due: Pick<ExpectedPeriod, 'to'>): ISODate {
  return addDays(due.to, 1)
}

/** Days late as of `today` (1 on lateFrom); 0 while inside or before the range. */
export function daysLate(due: Pick<ExpectedPeriod, 'to'>, today: ISODate): number {
  return Math.max(0, diffDays(due.to, today))
}

/** Past this many days late, "N일 지났어요" reads oddly — more likely a missed log (or a long cycle). */
export const LONG_LATE_DAYS = 14

/**
 * The day an ended pregnancy ended, while no period has been logged after it
 * (predictions are paused). A record ended on the day it was confirmed is a
 * correction, not a pregnancy, and doesn't pause anything.
 */
export function pausedSince(input: Pick<CycleInput, 'periods' | 'pregnancy'>): ISODate | undefined {
  const p = input.pregnancy
  if (!p?.endedAt || !(p.endedAt > p.confirmedAt)) return undefined
  const starts = sortedStarts(input.periods)
  const last = starts[starts.length - 1]
  return !last || last <= p.endedAt ? p.endedAt : undefined
}

export interface ForecastLimit {
  /** No cycle projection on or after this date. */
  from: ISODate
  /**
   * late: the expected range passed with nothing logged — what follows depends
   * on when it actually starts (or on a pregnancy). paused: after an ended pregnancy.
   */
  reason: 'late' | 'paused'
  /** Most recent logged period start. */
  lastStart?: ISODate
  /** The range that passed (late only): its days still show as 생리 예정. */
  due?: ExpectedPeriod
}

/**
 * Where predictions stop as of `today` (undefined = project freely). Every
 * screen that projects cycles (calendar grid, day sheet, alerts, previews,
 * .ics) follows this, so none of them shows a fertile window the others hide.
 */
export function forecastLimit(input: CycleInput, today: ISODate): ForecastLimit | undefined {
  const starts = sortedStarts(input.periods)
  const last = starts[starts.length - 1]
  const paused = pausedSince(input)
  if (paused) {
    if (!last) return { from: addDays(paused, 1), reason: 'paused' }
    const expected = expectedPeriod(input, last).from
    const endNext = addDays(paused, 1)
    return { from: expected < endNext ? expected : endNext, reason: 'paused', lastStart: last }
  }
  if (!last || last > today) return undefined
  const due = expectedPeriod(input, last)
  return today > due.to ? { from: due.from, reason: 'late', lastStart: last, due } : undefined
}

/**
 * The cycle containing `date`. Returns null until at least one period is logged.
 * Dates after the last logged period are covered by projecting forward with the
 * average length (from the expected range's first day when an LH surge pinned
 * the last logged cycle); dates before the first logged period return null.
 */
export function cycleAt(input: CycleInput, date: ISODate): CycleWindow | null {
  const starts = sortedStarts(input.periods)
  if (starts.length === 0) return null
  const stats = cycleStats(input.periods, input.cycle, undefined, undefined, input.pregnancy)
  const maxLen = maxCycleLength(input.cycle)

  // Latest logged start on/before date.
  let idx = -1
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= date) idx = i
  if (idx === -1) return null

  const loggedStart = starts[idx]!
  const nextLogged = starts[idx + 1]
  const noSpread: Spread = { early: 0, late: 0 }
  if (nextLogged) {
    // A completed, measured cycle — use its real length (unless it was a missed log).
    const len = diffDays(loggedStart, nextLogged)
    if (len >= MIN_CYCLE && len <= maxLen) {
      // Finished cycle: a surge after the next period began belongs to that next cycle, not this one.
      return buildWindow(loggedStart, true, len, lhOvulationFor(loggedStart, len, input.lhTests, 0), noSpread, stats.confidence)
    }
  }

  const L = stats.average
  // Inside a gap too long to be one cycle (missed logs): only the first projected
  // cycle after the logged start is meaningful; later dates are unknown.
  if (nextLogged && diffDays(loggedStart, date) >= L) return null
  // The couple's own variability widens the band for not-yet-finished cycles.
  const spread: Spread =
    stats.min !== undefined && stats.max !== undefined ? { early: Math.max(0, L - stats.min), late: Math.max(0, stats.max - L) } : noSpread
  const lhOv = lhOvulationFor(loggedStart, L, input.lhTests)
  // With a surge, the next period is expected from the range's first day, not start + average.
  const nextPeriod = lhOv ? dueFor(stats, loggedStart, input.lhTests).from : undefined
  const first = buildWindow(loggedStart, true, L, lhOv, spread, stats.confidence, nextPeriod)
  if (date < first.nextPeriod || nextLogged) return first
  let start = first.nextPeriod
  for (let guard = 0; addDays(start, L) <= date && guard < 2000; guard++) start = addDays(start, L)
  return buildWindow(start, false, L, lhOvulationFor(start, L, input.lhTests), spread, stats.confidence)
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
  /** Strongest LH result logged that day. */
  hasLH?: LHResult
  /** Past the forecast limit (late period / after a pregnancy): nothing is predicted here. */
  unpredicted?: 'late' | 'paused'
  /** The cycle's confidence (days inside a known/projected cycle). */
  confidence?: CycleConfidence
}

function loggedPeriodCovers(periods: PeriodLog[], date: ISODate, periodLength: number): boolean {
  return periods.some((p) => {
    const end = p.end && p.end >= p.start ? p.end : addDays(p.start, Math.max(1, periodLength) - 1)
    return isBetween(date, p.start, end)
  })
}

/**
 * What the calendar shows for `date`. Pass `today` wherever the answer is shown
 * to the user: it stops projections past a missed period or an ended pregnancy
 * (see forecastLimit), and keeps counting the current cycle on an unlogged
 * expected day instead of starting a projected one.
 *
 * 생리 예정 ('period-predicted') covers the open cycle's expected range
 * (expectedPeriod) and the first days of a projected cycle. With low
 * confidence there are no peak days and no ovulation marker: those days read
 * as plain window days.
 */
export function dayInfo(input: CycleInput, date: ISODate, today?: ISODate): DayInfo {
  const lh = strongestLH(input.lhTests.filter((t) => t.date === date).map((t) => t.result))
  const w = cycleAt(input, date)
  const base: DayInfo = { date, phase: 'none', isOvulation: false, hasLH: lh }
  if (loggedPeriodCovers(input.periods, date, input.cycle.periodLength)) {
    return { ...base, phase: 'period', ...(w ? cyclePos(w, date) : {}) }
  }
  const limit = today ? forecastLimit(input, today) : undefined
  if (limit && date >= limit.from) {
    const info: DayInfo = { ...base, unpredicted: limit.reason }
    if (limit.reason === 'late' && limit.lastStart) {
      // Keep counting from the last logged start, and keep the missed range's
      // days visible as 생리 예정 — nothing after them.
      info.cycleDay = diffDays(limit.lastStart, date) + 1
      if (limit.due && date <= limit.due.to) info.phase = 'period-predicted'
    }
    return info
  }
  if (!w) return base
  const pos = cyclePos(w, date)
  const starts = sortedStarts(input.periods)
  // The open cycle's expected range (a finished cycle shows only what was logged).
  const open = w.startLogged && !starts.some((s) => s > w.start)
  const due = open
    ? dueFor(cycleStats(input.periods, input.cycle, undefined, undefined, input.pregnancy), w.start, input.lhTests)
    : undefined
  const inRange = !!due && date >= due.from && date <= due.to
  // A projected cycle's first days: its period, plus the tail of the range before it.
  const head = Math.max(input.cycle.periodLength, DUE_CLIP_DAYS + 1)
  if (inRange || (!w.startLogged && diffDays(w.start, date) < head)) {
    // On an unlogged expected day (today), it is still the current cycle's last day + 1.
    if (today && date <= today) {
      const last = [...starts].reverse().find((d) => d <= date)
      if (last) return { ...base, phase: 'period-predicted', cycleDay: diffDays(last, date) + 1 }
    }
    return { ...base, ...pos, phase: 'period-predicted' }
  }
  const low = w.confidence === 'low'
  let phase: DayPhase = 'none'
  if (!low && isBetween(date, w.peakStart, w.peakEnd)) phase = 'peak'
  else if (isBetween(date, w.fertileStart, w.fertileEnd)) phase = 'fertile'
  else if (isBetween(date, w.broadStart, w.broadEnd)) phase = 'possible'
  return { ...base, ...pos, phase, isOvulation: !low && date === w.ovulation, confidence: w.confidence }
}

function cyclePos(w: CycleWindow, date: ISODate): Pick<DayInfo, 'cycleDay' | 'ovulationOffset'> {
  return { cycleDay: diffDays(w.start, date) + 1, ovulationOffset: diffDays(w.ovulation, date) }
}

export type FertilityStatus =
  | { kind: 'no-data' }
  /**
   * Bleeding today. `nextFertileStart` only when the window is still ahead;
   * `fertileEnd` when a short cycle's estimated window already overlaps the period.
   */
  | {
      kind: 'period'
      cycleDay: number
      nextFertileStart?: ISODate
      daysUntilFertile?: number
      fertileEnd?: ISODate
      confidence: CycleConfidence
    }
  | { kind: 'before-fertile'; daysUntil: number; fertileStart: ISODate; cycleDay: number; confidence: CycleConfidence }
  | { kind: 'fertile'; peak: boolean; isOvulation: boolean; fertileEnd: ISODate; cycleDay: number; confidence: CycleConfidence }
  /**
   * After the window, up to the end of the expected range. `nextPeriod` is the
   * range's first day; `daysUntilPeriod` counts down to it (0 from then on,
   * when `dueNow` is true: the period may start any day).
   */
  | {
      kind: 'after-fertile'
      nextPeriod: ISODate
      daysUntilPeriod: number
      cycleDay: number
      due: ExpectedPeriod
      dueNow: boolean
      confidence: CycleConfidence
    }
  /** The expected range passed with nothing logged: `daysLate` counts from the day after it. */
  | { kind: 'late'; daysLate: number; due: ExpectedPeriod }
  /** A pregnancy ended and no period has been logged since: nothing to predict yet. */
  | { kind: 'after-pregnancy'; endedAt: ISODate; daysSince: number }

/**
 * One-line summary of "where are we today" for the home screen and alerts.
 * `late` means the expected range has passed with nothing logged — the UI should
 * gently suggest logging the period (and, a few days on, a pregnancy test).
 * `after-pregnancy` must never do that: the old cycle is meaningless after a
 * pregnancy ended.
 */
export function fertilityStatus(input: CycleInput, today: ISODate): FertilityStatus {
  const paused = pausedSince(input)
  if (paused) return { kind: 'after-pregnancy', endedAt: paused, daysSince: Math.max(0, diffDays(paused, today)) }
  const starts = sortedStarts(input.periods)
  const cur = [...starts].reverse().find((d) => d <= today)
  if (!cur) return { kind: 'no-data' }
  const stats = cycleStats(input.periods, input.cycle, undefined, undefined, input.pregnancy)
  const due = dueFor(stats, cur, input.lhTests)
  if (today > due.to) return { kind: 'late', daysLate: diffDays(due.to, today), due }
  // Inside the expected range we stay in the current cycle (never the projected next one).
  const w = cycleAt(input, cur)
  if (!w) return { kind: 'no-data' }
  const info = dayInfo(input, today, today)
  const cycleDay = info.cycleDay ?? diffDays(cur, today) + 1
  const confidence = w.confidence
  if (info.phase === 'period') {
    // Short cycles: the estimated window can start during the period — never
    // call a date that has already come the "next" window.
    if (today < w.fertileStart)
      return {
        kind: 'period',
        cycleDay,
        nextFertileStart: w.fertileStart,
        daysUntilFertile: diffDays(today, w.fertileStart),
        confidence,
      }
    if (today <= w.fertileEnd) return { kind: 'period', cycleDay, fertileEnd: w.fertileEnd, confidence }
    return { kind: 'period', cycleDay, confidence }
  }
  if (today < w.fertileStart) {
    return { kind: 'before-fertile', daysUntil: diffDays(today, w.fertileStart), fertileStart: w.fertileStart, cycleDay, confidence }
  }
  if (today <= w.fertileEnd) {
    return {
      kind: 'fertile',
      peak: info.phase === 'peak',
      isOvulation: info.isOvulation,
      fertileEnd: w.fertileEnd,
      cycleDay,
      confidence,
    }
  }
  return {
    kind: 'after-fertile',
    nextPeriod: due.from,
    daysUntilPeriod: Math.max(0, diffDays(today, due.from)),
    cycleDay,
    due,
    dueNow: today >= due.from,
    confidence,
  }
}

/** How many days ahead of the estimated window "이번 주는 우리의 주간" starts. */
export const OUR_WEEK_LEAD_DAYS = 3

/**
 * Is the estimated window on now or starting within OUR_WEEK_LEAD_DAYS? One rule
 * for the date banner, the home teaser and the heads-up notice (sent the day
 * before the window) — including short cycles, where the window can start
 * while the period is still going.
 */
export function ourWeekSoon(status: FertilityStatus): boolean {
  switch (status.kind) {
    case 'fertile':
      return true
    case 'before-fertile':
      return status.daysUntil <= OUR_WEEK_LEAD_DAYS
    case 'period':
      return status.fertileEnd !== undefined || (status.daysUntilFertile !== undefined && status.daysUntilFertile <= OUR_WEEK_LEAD_DAYS)
    default:
      return false
  }
}

/**
 * Upcoming fertile windows (current one first if still ongoing), for alerts,
 * the calendar legend and .ics export.
 */
export function upcomingWindows(input: CycleInput, from: ISODate, count = 3): CycleWindow[] {
  // Late period or paused after a pregnancy: the next window is unknown.
  if (forecastLimit(input, from)) return []
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

/**
 * Add (or replace) the period starting on `start`. Replacing keeps who logged
 * it unless `by` is given.
 */
export function addPeriod<S extends CycleInput>(state: S, start: ISODate, end?: ISODate, by?: PeriodLog['by']): S {
  const prev = state.periods.find((p) => p.start === start)
  const who = by ?? prev?.by
  const periods = state.periods.filter((p) => p.start !== start)
  // A re-log of the same day keeps the record's sync id (lib/sync/model.ts); a
  // new record gets one from the store when it is saved (stampChanges).
  periods.push({ ...(prev?.id ? { id: prev.id } : {}), start, ...(end && end >= start ? { end } : {}), ...(who ? { by: who } : {}) })
  periods.sort((a, b) => (a.start < b.start ? -1 : 1))
  return { ...state, periods }
}

export function removePeriod<S extends CycleInput>(state: S, start: ISODate): S {
  return { ...state, periods: state.periods.filter((p) => p.start !== start) }
}

/** Set or clear the last bleeding day; keeps the rest of the record (who logged it). */
export function setPeriodEnd<S extends CycleInput>(state: S, start: ISODate, end: ISODate | undefined): S {
  return {
    ...state,
    periods: state.periods.map((p) => {
      if (p.start !== start) return p
      const { end: _old, ...rest } = p
      return end && end >= start ? { ...rest, end } : rest
    }),
  }
}

/**
 * Legacy single-result setter (the demo data uses it): replaces every LH test
 * on `date` with one untimed result, or clears the day (result = null). The
 * log sheet uses lib/logic/logs.ts addLHTest / removeLHTest (two a day, timed).
 */
export function setLHTest<S extends CycleInput>(state: S, date: ISODate, result: LHTest['result'] | null): S {
  const lhTests = state.lhTests.filter((t) => t.date !== date)
  if (result) lhTests.push({ date, result })
  lhTests.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { ...state, lhTests }
}
