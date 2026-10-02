// The home's cycle ring and week row (components/today/CycleRing.tsx,
// WeekRow.tsx) — pure shaping of ttcFlow.cycleStrip, so the drawing rules are
// testable. Nothing here decides WHAT a viewer may see: cycleStrip already
// applied the lens (details, wording, LH only in explicit wording). These
// helpers only turn its days into arcs, legend items and week cells.

import { formatKo, weekdayKo } from '../dates'
import type { ISODate } from '../types'
import type { CycleStrip, StripDay, StripTone } from './ttcFlow'

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
