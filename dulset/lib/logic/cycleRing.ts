// The home's cycle ring and week row (components/today/CycleRing.tsx,
// WeekRow.tsx) — pure shaping of ttcFlow.cycleStrip, so the drawing rules are
// testable. These helpers only turn its days into arcs, legend items and week
// cells: cycleStrip already applied the lens (details, wording, LH only in
// explicit wording).
//
// One rule does live here, because the home card, the week row, the calendar
// and the partner's one notice all read it (ttcFlow, calendarView,
// notifications): sharedWeek — WHICH window a partner without her details may
// see, and when (N19, docs/positioning.md §4 '0번: 새는 곳').

import { addDays, formatKo, isISODate, weekdayKo } from '../dates'
import type { AppState, ISODate } from '../types'
import {
  OUR_WEEK_LEAD_DAYS,
  cycleAt,
  pausedSince,
  sortedStarts,
  spansEndedPregnancy,
  type CycleConfidence,
  type CycleInput,
  type CycleWindow,
} from './cycle'
import { recentlyEnded } from './pregnancy'
import { activePositivePending, activeRest } from './ttc'
import type { CycleStrip, StripDay, StripTone } from './ttcFlow'

// ── The shared band (partner without details, N19) ─────────
//
// The husband loop's rule #1: what he sees is what she sent or his own, and a
// change of his screen is information too. So a partner without her details
// ('우리의 주간' or '날짜 없음' sharing) never sees a screen change on the day
// of something she did not tell: an untold period start, an LH result, a test,
// a late period, a rest or a positive test waiting for the clinic. From the
// day after 우리의 주간 ends until the next '곧 우리의 주간' starts, his home,
// week row and calendar are one '평소 주' — the same card, no band, nothing
// drawn ahead. The ONLY moments that change it are the shared start of 곧
// 우리의 주간 and the window itself (this function), what she tells with
// [알리기], her signals, his own actions, and the quiet after a pregnancy
// ended (a stage change both phones already showed).
//
// The window he sees is computed from her logged period starts and the cycle
// settings alone — never from LH strips or tests (her records; positioning §6:
// no LH result goes to him automatically). So her own (LH-tuned) card may name
// a slightly different window than his; that gap is the privacy boundary.
//
// Two rules keep what he was shown in place (Now 3 leftovers):
//  • Once his span has started ('곧 우리의 주간' or the window), it stays until
//    the window's predicted last day: a period she logs inside it, a rest she
//    starts inside it or a positive test she has not told does not cut it
//    short. (A period she TELLS does — her [알리기] card comes first; so does
//    the clinic mode, which both phones show, and a pregnancy that ended.)
//  • An untold period that came EARLIER than his view expected does not pull
//    his next window forward: that window is frozen to what was predicted
//    before she logged it — the cycle the previous start projected, with the
//    statistics of that time (anchoredWindow). A period she told, or one on
//    time or late, anchors his window on its real day as before.
//
// Residuals (documented, tested in tests/leakInference.test.ts):
//  • When the next window would have come and does not (a late period, a rest,
//    a positive test she logged before it started), he sees no change at all —
//    only the absence of one, on the day it would have come.
//  • The freeze covers the NEXT window only: the start after an untold early
//    one anchors on its real day again (so her rhythm and his do not drift
//    apart for good). The spacing of his two windows then differs from the
//    usual one — it says that a cycle ran short, a cycle later, never the day.
//  • A rest is read from the one record she keeps: a rest she backdates to
//    before the span began, logged inside it, ends it on the day she logs it;
//    a rest that paused a span and was then ended by a period logged inside
//    where that span would have been leaves no trace, so the span's remaining
//    days come back (both need a cycle shorter than its window).
//  • A period start logged late (backdated to day 4 or later of its cycle)
//    can start the next shared span on the day it is logged.

/** Period days 1–3 are hers (ttcFlow.PERIOD_EARLY_DAYS — a test keeps them equal): no shared span starts on them. */
export const SHARED_QUIET_DAYS = 3

export interface SharedWeek {
  /** 'soon': the days before the window ('곧 우리의 주간', cycle.OUR_WEEK_LEAD_DAYS); 'window': inside it. */
  kind: 'soon' | 'window'
  fertileStart: ISODate
  fertileEnd: ISODate
  /**
   * The calendar window behind it (her logged start — or, for a frozen
   * window, the start his view expected). Never in a notice key
   * (notifications.partnerFertileKey uses the window's week).
   */
  window: CycleWindow
  /** Logged cycles only ('cycles' / 'low') — never 'lh'. */
  confidence: CycleConfidence
}

type SharedState = Pick<AppState, 'stage' | 'periods' | 'cycle' | 'pregnancy' | 'restCycle' | 'positivePending'> &
  Partial<Pick<AppState, 'cycleNotes' | 'decisions' | 'notifications' | 'pregnancyTests'>>

/** What a partner without details is computed from: her logged period starts and the cycle settings — no LH, no tests. */
export function sharedCycleInput(state: Omit<SharedState, 'stage' | 'restCycle' | 'positivePending'>): CycleInput {
  return {
    periods: state.periods,
    lhTests: [],
    cycle: state.cycle,
    ...(state.pregnancy ? { pregnancy: state.pregnancy } : {}),
    ...(state.cycleNotes ? { cycleNotes: state.cycleNotes } : {}),
  }
}

/**
 * The decision keys ttcFlow writes when she tells him ([알리기]) — spelled out
 * here because ttcFlow imports this file (tests/cycleRing.test.ts keeps them
 * equal to ttcFlow.periodToldKey / positiveToldKey).
 */
export const sharedPeriodToldKey = (start: ISODate) => `period-told:${start}`
export const sharedPositiveToldKey = (since: ISODate) => `positive-told:${since}`

/** sync/model.decided for a state that may not carry the decision fields. */
function toldKey(state: Partial<Pick<AppState, 'decisions' | 'notifications'>>, key: string): boolean {
  if (state.decisions?.[key] !== undefined) return true
  return (state.notifications ?? []).some((n) => n.key === key)
}

/** Her calendar input as it stood on the day `start` was her latest logged start (no LH, nothing later). */
function inputUpTo(state: SharedState, start: ISODate): CycleInput {
  return sharedCycleInput({ ...state, periods: state.periods.filter((p) => p.start <= start) })
}

/**
 * The window his view uses for the cycle that begins at her logged start
 * `starts[i]`: the projection as it stood then — or, for a start she did not
 * tell that came before the day the previous start projected, the window
 * of that projected cycle (frozen to what his view expected before she logged
 * it). Null when the calendar has nothing to say.
 */
export function anchoredWindow(state: SharedState, starts: readonly ISODate[], i: number): CycleWindow | null {
  const start = starts[i]
  if (!start) return null
  const own = cycleAt(inputUpTo(state, start), start)
  const prev = starts[i - 1]
  if (!prev || toldKey(state, sharedPeriodToldKey(start)) || spansEndedPregnancy(prev, start, state.pregnancy)) return own
  const before = inputUpTo(state, prev)
  const expected = cycleAt(before, prev)
  if (!expected || start >= expected.nextPeriod) return own
  return cycleAt(before, expected.nextPeriod) ?? own
}

/** The first day his span shows: 곧 우리의 주간 (OUR_WEEK_LEAD_DAYS before the window), never on that cycle's days 1–3. */
export function sharedSpanFrom(w: Pick<CycleWindow, 'start' | 'fertileStart'>): ISODate {
  const lead = addDays(w.fertileStart, -OUR_WEEK_LEAD_DAYS)
  const quiet = addDays(w.start, SHARED_QUIET_DAYS)
  return lead > quiet ? lead : quiet
}

function shaped(w: CycleWindow, today: ISODate): SharedWeek {
  return {
    kind: today < w.fertileStart ? 'soon' : 'window',
    fertileStart: w.fertileStart,
    fertileEnd: w.fertileEnd,
    // His view counts from its start as from a logged one — a frozen window
    // must not read differently from the one an on-time period would give.
    window: w.startLogged ? w : { ...w, startLogged: true },
    confidence: w.confidence,
  }
}

/**
 * Was the span starting on `from` (in the cycle that began on `cycleStart`)
 * held back by a pause she started before it — so it never showed? A rest
 * (any reason: the clinic and the 'loss' quiet are ruled out earlier), or a
 * positive test: the record while it is on, and a positive test dated in that
 * stretch (or one she told) once a period has cleared the record.
 */
function pausedBefore(state: SharedState, from: ISODate, cycleStart: ISODate, today: ISODate): boolean {
  // Strictly before its first day: one started on that day finds the span already shown.
  const rest = activeRest(state, today)
  if (rest && rest.since < from) return true
  const pending = activePositivePending(state)
  if (pending && (pending.since < from || toldKey(state, sharedPositiveToldKey(pending.since)))) return true
  // Once a period has cleared the record: a positive test dated before the span, or one she told.
  return (state.pregnancyTests ?? []).some(
    (t) => t.result === 'positive' && t.date >= cycleStart && (t.date < from || toldKey(state, sharedPositiveToldKey(t.date))),
  )
}

/**
 * The shared window a partner without details sees on `today` — '곧 우리의
 * 주간' (the lead days before it) or the window itself — or undefined: the
 * '평소 주'. Undefined outside the preparing stage, in the quiet after a
 * pregnancy ended, while the clinic mode is on, while a rest or a positive
 * test she started before the span pauses the dates, on period days 1–3, and
 * whenever the window is not near. Once a span has started it runs to its
 * last day whatever she logs and does not tell; an untold early period does
 * not pull the next one forward (see above). Pure; one rule for the home
 * card, the week row, the calendar and his notice.
 */
export function sharedWeek(state: SharedState, today: ISODate): SharedWeek | undefined {
  // The state is immutable (update(fn) only), so one state object answers the same for a day:
  // the home, the week row, the calendar, the notices and the link's seven days ask it again and again.
  let memo = SHARED_MEMO.get(state)
  if (!memo) SHARED_MEMO.set(state, (memo = new Map()))
  if (memo.has(today)) return memo.get(today)
  const out = computeSharedWeek(state, today)
  memo.set(today, out)
  return out
}

const SHARED_MEMO = new WeakMap<object, Map<string, SharedWeek | undefined>>()

function computeSharedWeek(state: SharedState, today: ISODate): SharedWeek | undefined {
  if (state.stage !== 'preparing' || !isISODate(today) || recentlyEnded(state, today)) return undefined
  if (pausedSince(sharedCycleInput(state))) return undefined
  const rest = activeRest(state, today)
  if (rest && (rest.reason === 'clinic' || rest.reason === 'loss')) return undefined
  const starts = sortedStarts(state.periods).filter((d) => d <= today)
  const n = starts.length - 1
  if (n < 0) return undefined
  const latest = starts[n]!
  // The previous cycle's span, still running: a start she logged inside it and
  // has not told waits until that span's last day.
  if (n >= 1 && !toldKey(state, sharedPeriodToldKey(latest))) {
    const prev = anchoredWindow(state, starts, n - 1)
    if (prev) {
      const from = sharedSpanFrom(prev)
      // (A start on the span's first day finds it already shown, as a pause does.)
      if (from <= latest && today >= from && today <= prev.fertileEnd && !pausedBefore(state, from, starts[n - 1]!, today)) {
        return shaped(prev, today)
      }
    }
  }
  const w = anchoredWindow(state, starts, n)
  if (!w) return undefined
  const from = sharedSpanFrom(w)
  if (today < from || today > w.fertileEnd || pausedBefore(state, from, latest, today)) return undefined
  return shaped(w, today)
}

/** Did the shared window already run on the day before `monday` (the week row's left edge stays square)? */
export function sharedBandBefore(week: Pick<SharedWeek, 'fertileStart'> | undefined, monday: ISODate): boolean {
  return !!week && week.fertileStart <= addDays(monday, -1)
}

// ── Ring ────────────────────────────────────────────────────

export type RingTone = StripTone

export interface RingArc {
  date: ISODate
  tone: RingTone
  /** Opacity of the arc colour (period 1, predicted .30, window .34–.62, peak 1). */
  alpha: number
  today: boolean
  lh?: 'low' | 'surge'
}

export interface RingOptions {
  /**
   * Period days 1–3 (moment 'period-early'): "수고했어요" first — no window or
   * peak arcs, and the legend lists only the period items.
   */
  quietWindow: boolean
  /**
   * "(예상)" at most once per card (review D-1): 'none' when the card's copy
   * already carries it (every legend label plain — '생리 예정', '가임기'),
   * 'one' when it doesn't (the window label keeps its marker, the rest are
   * plain). Unset keeps the labels as the strip names them.
   */
  estimate?: 'none' | 'one'
}

/** Window arcs get deeper toward the peak: .34 / .44 / .54 / .62 by strip level. */
export function fertileAlpha(level: number): number {
  if (level >= 0.6) return 0.62
  if (level >= 0.5) return 0.54
  if (level >= 0.4) return 0.44
  return 0.34
}

const isWindow = (d: Pick<StripDay, 'tone'>) => d.tone === 'fertile' || d.tone === 'peak'

/**
 * One arc per strip day, day 1 first (drawn at 12 o'clock, clockwise). Period
 * days after today are still an estimate (a period logged without its end runs
 * its usual length), so they draw like the predicted period: "생리 (예상)".
 */
export function ringArcs(strip: CycleStrip, opts: RingOptions): RingArc[] {
  return strip.days.map((d, i) => {
    const ahead = d.tone === 'period' && i > strip.todayIndex
    const tone: RingTone = opts.quietWindow && isWindow(d) ? 'none' : ahead ? 'period-predicted' : d.tone
    const alpha =
      tone === 'period-predicted' ? 0.3 : tone === 'fertile' ? fertileAlpha(d.level) : 1
    return { date: d.date, tone, alpha, today: d.today, ...(d.lh ? { lh: d.lh } : {}) }
  })
}

/** Gap between arcs, in degrees: tighter for long cycles so the arcs stay readable. */
export function ringGap(count: number): number {
  return count > 35 ? 1.6 : 2.6
}

/**
 * Angles (degrees, 0 = 3 o'clock, clockwise) of arc `index` of `count`:
 * where it starts and ends (gap removed) and its middle (for the today / LH dots).
 */
export function arcAngles(index: number, count: number): { start: number; end: number; mid: number } {
  const seg = 360 / Math.max(1, count)
  const gap = Math.min(ringGap(count), seg * 0.5)
  const start = -90 + index * seg + gap / 2
  return { start, end: start + seg - gap, mid: -90 + (index + 0.5) * seg }
}

// ── Legend ──────────────────────────────────────────────────

export type LegendKey = 'period' | 'period-predicted' | 'window' | 'peak' | 'lh'

export interface LegendItem {
  key: LegendKey
  label: string
  /** For 'lh': which marks appear (a hollow ring for a record, a filled dot for 양성). */
  lh?: { low: boolean; surge: boolean }
}

/** At most this many legend items (one line at 390px). */
export const LEGEND_MAX = 4

/**
 * A legend label without its "(예상)" marker: '생리 (예상)' → '생리 예정',
 * '가임기 (예상)' → '가임기', '우리의 주간 (예상 범위)' → '우리의 주간 (넓은 범위)',
 * '특히 좋은 때 (예상)' → '특히 좋은 때'. Labels without a marker stay as they are.
 */
export function plainLegendLabel(label: string): string {
  if (label === '생리 (예상)') return '생리 예정'
  return label.replace(/ \(예상 범위\)/, ' (넓은 범위)').replace(/ \(예상\)/g, '')
}

/**
 * The legend under the ring / week row: only what is actually drawn, in the
 * viewer's own wording (strip.windowLabel / peakLabel). Same flags as the old
 * strip legend. When five would show, the lighter "생리 (예상)" goes first.
 * With opts.estimate the "(예상)" markers follow the once-per-card rule
 * (plainLegendLabel).
 */
export function ringLegend(strip: CycleStrip, opts: RingOptions): LegendItem[] {
  const arcs = strip.mode === 'cycle' ? ringArcs(strip, opts) : strip.days.map((d) => ({ tone: d.tone, lh: d.lh }))
  const has = (t: RingTone) => arcs.some((a) => a.tone === t)
  const low = arcs.some((a) => a.lh === 'low')
  const surge = arcs.some((a) => a.lh === 'surge')
  const plain = (label: string) => (opts.estimate ? plainLegendLabel(label) : label)
  const items: LegendItem[] = []
  if (has('period')) items.push({ key: 'period', label: '생리' })
  if (has('period-predicted')) items.push({ key: 'period-predicted', label: plain('생리 (예상)') })
  if ((has('fertile') || has('peak')) && strip.windowLabel) {
    items.push({ key: 'window', label: opts.estimate === 'one' ? strip.windowLabel : plain(strip.windowLabel) })
  }
  if (has('peak') && strip.peakLabel) items.push({ key: 'peak', label: plain(strip.peakLabel) })
  if (low || surge) {
    items.push({ key: 'lh', label: low && surge ? 'LH 양성 · 기록' : surge ? 'LH 양성' : 'LH 기록', lh: { low, surge } })
  }
  if (items.length > LEGEND_MAX) return items.filter((i) => i.key !== 'period-predicted').slice(0, LEGEND_MAX)
  return items
}

// ── Week row (partner without shared details) ──────────────

export interface WeekCell {
  date: ISODate
  /** Day of the month ('1' on the 1st — the week row shows no month). */
  day: number
  weekday: string
  today: boolean
  band: boolean
}

export interface WeekBand {
  /** Columns 0–6, inclusive. */
  from: number
  to: number
  /** Rounded ends where the band starts / stops inside the row; square where it runs on past the row. */
  roundStart: boolean
  roundEnd: boolean
}

export interface WeekRowData {
  cells: WeekCell[]
  bands: WeekBand[]
}

/**
 * This week (Monday–Sunday), plus next week only when it holds band days.
 * `bandBefore`: the shared window already ran on the Sunday before this week
 * (so the band's left end is square, like a strip cut at the edge).
 */
export function weekRows(strip: CycleStrip, opts: { bandBefore?: boolean } = {}): WeekRowData[] {
  const cells: WeekCell[] = strip.days.map((d) => ({
    date: d.date,
    day: Number(d.date.slice(8)),
    weekday: weekdayKo(d.date),
    today: d.today,
    band: isWindow(d),
  }))
  const rows = [cells.slice(0, 7)]
  const next = cells.slice(7, 14)
  if (next.some((c) => c.band)) rows.push(next)

  return rows.map((row, r) => {
    const bands: WeekBand[] = []
    let i = 0
    while (i < row.length) {
      if (!row[i]!.band) {
        i++
        continue
      }
      const from = i
      while (i + 1 < row.length && row[i + 1]!.band) i++
      const to = i
      const before = r === 0 ? !!opts.bandBefore : !!rows[r - 1]![6]?.band
      const after = r + 1 < rows.length ? !!rows[r + 1]![0]?.band : false
      bands.push({ from, to, roundStart: !(from === 0 && before), roundEnd: !(to === row.length - 1 && after) })
      i++
    }
    return { cells: row, bands }
  })
}

// ── Screen-reader text ──────────────────────────────────────

const day = (d: ISODate) => formatKo(d, { weekday: false })

/** What the ring / week row shows, as a sentence (its role="img" label). */
export function describeStrip(strip: CycleStrip, opts: RingOptions = { quietWindow: false }): string {
  const parts: string[] = []
  if (strip.mode === 'cycle' && strip.cycleDay) parts.push(`주기 ${strip.cycleDay}일째, ${strip.length}일 기준`)
  else parts.push('이번 주와 다음 주')
  const days = strip.mode === 'cycle' ? ringArcs(strip, opts) : strip.days
  const band = days.filter(isWindow)
  if (band.length && strip.windowLabel) {
    parts.push(`${strip.windowLabel} ${day(band[0]!.date)}부터 ${day(band[band.length - 1]!.date)}까지`)
  }
  const peak = days.filter((d) => d.tone === 'peak')
  if (peak.length && strip.peakLabel) {
    parts.push(`${strip.peakLabel} ${day(peak[0]!.date)}부터 ${day(peak[peak.length - 1]!.date)}까지`)
  }
  const period = days.filter((d) => d.tone === 'period')
  if (period.length) parts.push(`생리 기록 ${period.length}일`)
  return parts.join('. ')
}
