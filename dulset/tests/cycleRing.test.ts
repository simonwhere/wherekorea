import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { canSeeCycleDetails, setPersonalPref } from '@/lib/logic/prefs'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import { startClinicMode } from '@/lib/logic/clinic'
import { logPeriodStart } from '@/lib/logic/logs'
import { positiveToldKey, periodToldKey, tellPartnerPeriod, tellPartnerPositive } from '@/lib/logic/ttcFlow'
import {
  LEGEND_MAX,
  SHARED_QUIET_DAYS,
  anchoredWindow,
  sharedPeriodToldKey,
  sharedPositiveToldKey,
  sharedSpanFrom,
  arcAngles,
  describeStrip,
  fertileAlpha,
  ringArcs,
  ringGap,
  ringLegend,
  sharedBandBefore,
  sharedCycleInput,
  sharedWeek,
  weekRows,
} from '@/lib/logic/cycleRing'
import { cycleStrip, homeVoice, ttcMoment, type CycleStrip, type StripDay } from '@/lib/logic/ttcFlow'
import type { AlertStyle, AppState, ISODate } from '@/lib/types'

// Same couple as tests/ttcFlow.test.ts: 'b' = 지은 tracks the cycle. Three
// regular 28-day cycles before the last period 2026-09-01 (confidence 'cycles')
// → window 09-10…09-15, peak 09-13…09-15, the next period expected 09-29.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]

function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, periods: REGULAR, ...over }
}
const withStyle = (s: AppState, member: 'a' | 'b', style: AlertStyle): AppState => ({
  ...s,
  settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [member]: style } },
})
const share = (s: AppState): AppState => ({ ...s, settings: { ...s.settings, shareLevel: 'details' } })

const FERTILE = '2026-09-11'
const PEAK = '2026-09-14'
const PERIOD_EARLY = '2026-09-02'
const WINDOW_WORDS = /가임기|배란|LH|가능성 높은/

describe('ringArcs', () => {
  it('one arc per strip day; today at the strip’s today index', () => {
    const strip = cycleStrip(fresh(), FERTILE, OWNER)!
    const arcs = ringArcs(strip, { quietWindow: false })
    expect(arcs).toHaveLength(strip.days.length)
    expect(arcs.findIndex((a) => a.today)).toBe(strip.todayIndex)
    expect(arcs.filter((a) => a.today)).toHaveLength(1)
    expect(arcs[strip.todayIndex]!.date).toBe(FERTILE)
  })

  it('colours: period solid, window deepening .34 → .62 toward the peak, peak solid', () => {
    const strip = cycleStrip(fresh(), FERTILE, OWNER)!
    const arcs = ringArcs(strip, { quietWindow: false })
    const at = (d: ISODate) => arcs.find((a) => a.date === d)!
    expect(at('2026-09-01')).toMatchObject({ tone: 'period', alpha: 1 })
    expect(at('2026-09-10')).toMatchObject({ tone: 'fertile', alpha: 0.34 })
    const window = arcs.filter((a) => a.tone === 'fertile').map((a) => a.alpha)
    expect([...window].sort()).toEqual(window)
    expect(window.every((a) => a >= 0.34 && a <= 0.62)).toBe(true)
    expect(at('2026-09-14')).toMatchObject({ tone: 'peak', alpha: 1 })
    expect(at('2026-09-20')).toMatchObject({ tone: 'none' })
  })

  it('fertileAlpha steps by level', () => {
    expect([0.3, 0.4, 0.5, 0.6, 0.7].map(fertileAlpha)).toEqual([0.34, 0.44, 0.54, 0.62, 0.62])
  })

  it('quietWindow removes every violet arc', () => {
    const strip = cycleStrip(fresh(), PEAK, OWNER)!
    expect(strip.days.some((d) => d.tone === 'peak')).toBe(true)
    const arcs = ringArcs(strip, { quietWindow: true })
    expect(arcs.some((a) => a.tone === 'fertile' || a.tone === 'peak')).toBe(false)
    expect(ringLegend(strip, { quietWindow: true }).map((i) => i.key)).toEqual(['period'])
    expect(describeStrip(strip, { quietWindow: true })).not.toMatch(WINDOW_WORDS)
  })

  it('period days 1–3: days so far solid, the rest of the period at .30 (예상), no window', () => {
    const s = fresh({ periods: [{ start: '2026-09-01', end: '2026-09-05' }, { start: '2026-09-29' }] })
    const strip = cycleStrip(s, '2026-09-30', OWNER)!
    expect(ttcMoment(s, '2026-09-30', OWNER)!.kind).toBe('period-early')
    const arcs = ringArcs(strip, { quietWindow: true })
    expect(arcs[1]).toMatchObject({ today: true, tone: 'period', alpha: 1 })
    expect(arcs[0]).toMatchObject({ tone: 'period', alpha: 1 })
    const ahead = arcs.slice(2).filter((a) => a.tone === 'period' || a.tone === 'period-predicted')
    expect(ahead.length).toBeGreaterThan(0)
    for (const a of ahead) expect(a).toMatchObject({ tone: 'period-predicted', alpha: 0.3 })
    expect(arcs.some((a) => a.tone === 'fertile' || a.tone === 'peak')).toBe(false)
    expect(ringLegend(strip, { quietWindow: true }).map((i) => i.label)).toEqual(['생리', '생리 (예상)'])
  })

  it('keeps LH marks exactly where the strip put them', () => {
    const s = fresh({ lhTests: [{ date: '2026-09-09', result: 'negative' }, { date: '2026-09-12', result: 'positive' }] })
    const arcs = ringArcs(cycleStrip(s, '2026-09-12', OWNER)!, { quietWindow: false })
    expect(arcs.find((a) => a.date === '2026-09-09')!.lh).toBe('low')
    expect(arcs.find((a) => a.date === '2026-09-12')!.lh).toBe('surge')
    expect(arcs.filter((a) => a.lh)).toHaveLength(2)
  })
})

describe('ring geometry', () => {
  it('day 1 starts at 12 o’clock and runs clockwise; the gap tightens past 35 days', () => {
    expect(arcAngles(0, 28).mid).toBeCloseTo(-90 + 360 / 56)
    expect(arcAngles(0, 28).start).toBeCloseTo(-90 + 1.3)
    expect(arcAngles(7, 28).mid).toBeCloseTo(-90 + 7.5 * (360 / 28))
    expect(arcAngles(27, 28).end).toBeLessThan(270)
    expect(ringGap(28)).toBe(2.6)
    expect(ringGap(36)).toBe(1.6)
    // A very long (late) cycle still leaves every arc a positive length.
    const a = arcAngles(0, 200)
    expect(a.end).toBeGreaterThan(a.start)
  })
})

describe('ringLegend', () => {
  it('owner, explicit: 생리 · 가임기 (예상) · 가능성 높음 · LH 기록 — at most four', () => {
    const s = fresh({ lhTests: [{ date: '2026-09-10', result: 'negative' }] })
    const legend = ringLegend(cycleStrip(s, PEAK, OWNER)!, { quietWindow: false })
    expect(legend.map((i) => i.label)).toEqual(['생리', '가임기 (예상)', '가능성 높음', 'LH 기록'])
    expect(legend.length).toBeLessThanOrEqual(LEGEND_MAX)
  })

  it('low confidence (one logged period): a wide range — no peak arcs, no 가능성 높음, no ⭐ words', () => {
    const low = fresh({ periods: [{ start: '2026-09-01' }], lhTests: [{ date: '2026-09-10', result: 'negative' }] })
    const strip = cycleStrip(low, PEAK, OWNER)!
    expect(strip.confidence).toBe('low')
    expect(strip.windowLabel).toBe('예상 범위 (넓음)')
    expect(strip.peakLabel).toBeUndefined()
    expect(strip.days.some((d) => d.tone === 'peak')).toBe(false)
    expect(strip.days.filter((d) => d.tone === 'fertile')).toHaveLength(6)
    // A flat band (no gradient toward a peak that isn't named).
    expect(new Set(strip.days.filter((d) => d.tone === 'fertile').map((d) => d.level)).size).toBe(1)
    const legend = ringLegend(strip, { quietWindow: false })
    // (The last two ring days, 09-27 and 09-28, are the expected range: 생리 (예상).)
    expect(legend.map((i) => i.label)).toEqual(['생리', '생리 (예상)', '예상 범위 (넓음)', 'LH 기록'])
    expect(legend.map((i) => i.label).join(' ')).not.toMatch(/가능성 높|배란/)
    expect(describeStrip(strip)).not.toMatch(/가능성 높|배란/)
    // Soft wording keeps its own words for the wide range.
    expect(cycleStrip(withStyle(low, OWNER, 'soft'), PEAK, OWNER)!.windowLabel).toBe('우리의 주간 (예상 범위)')
    expect(cycleStrip(low, PEAK, PARTNER)!.windowLabel).toBe('우리의 주간 (예상 범위)')
    // An LH surge this cycle brings the peak back.
    const lh = fresh({ periods: [{ start: '2026-09-01' }], lhTests: [{ date: '2026-09-12', result: 'positive' }] })
    const pinned = cycleStrip(lh, '2026-09-13', OWNER)!
    expect(pinned.confidence).toBe('lh')
    expect(pinned.windowLabel).toBe('가임기 (예상)')
    expect(pinned.days.some((d) => d.tone === 'peak')).toBe(true)
  })

  it('병원과 함께 준비 중: the ring draws logged days only — no window, no 생리 (예상)', () => {
    const clinic = startRestCycle(fresh({ lhTests: [{ date: '2026-09-10', result: 'negative' }] }), '2026-09-05', 'clinic')
    // 09-29 is the expected period's day: on the ring as 생리 (예상) for an ordinary rest, not with a clinic.
    const strip = cycleStrip(clinic, '2026-09-29', OWNER)!
    expect(strip.hasWindow).toBe(false)
    const arcs = ringArcs(strip, { quietWindow: false })
    expect(arcs.every((a) => a.tone === 'period' || a.tone === 'none')).toBe(true)
    expect(arcs.some((a) => a.tone === 'period')).toBe(true)
    expect(ringLegend(strip, { quietWindow: false }).map((i) => i.label)).toEqual(['생리', 'LH 기록'])
    expect(describeStrip(strip)).not.toMatch(WINDOW_WORDS)
    // An ordinary rest keeps the expected period on the ring.
    const rest = startRestCycle(fresh(), '2026-09-05', 'rest')
    expect(ringArcs(cycleStrip(rest, '2026-09-29', OWNER)!, { quietWindow: false }).some((a) => a.tone === 'period-predicted')).toBe(true)
  })

  it('a soft-voice strip has no LH and says 우리의 주간 (예상)', () => {
    const s = fresh({ lhTests: [{ date: '2026-09-10', result: 'positive' }] })
    for (const strip of [
      cycleStrip(withStyle(s, OWNER, 'soft'), PEAK, OWNER)!,
      cycleStrip(withStyle(s, OWNER, 'off'), PEAK, OWNER)!,
      cycleStrip(share(s), PEAK, PARTNER)!,
    ]) {
      expect(strip.windowLabel).toBe('우리의 주간 (예상)')
      const legend = ringLegend(strip, { quietWindow: false })
      expect(legend.some((i) => i.key === 'lh')).toBe(false)
      expect(legend.map((i) => i.label).join(' ')).not.toMatch(WINDOW_WORDS)
      expect(ringArcs(strip, { quietWindow: false }).some((a) => a.lh)).toBe(false)
      expect(describeStrip(strip)).not.toMatch(WINDOW_WORDS)
    }
  })

  it('low pressure: no band at all, so no window words', () => {
    const s = setPersonalPref(fresh(), OWNER, 'lowPressure', true)
    const strip = cycleStrip(s, PEAK, OWNER)!
    expect(ringArcs(strip, { quietWindow: false }).some((a) => a.tone === 'fertile' || a.tone === 'peak')).toBe(false)
    expect(ringLegend(strip, { quietWindow: false }).map((i) => i.key)).toEqual(['period'])
  })

  it('never more than four items (the lighter 생리 (예상) gives way first)', () => {
    const days: StripDay[] = [
      { date: '2026-09-01', tone: 'period', level: 1, today: false },
      { date: '2026-09-02', tone: 'period-predicted', level: 0.35, today: false },
      { date: '2026-09-03', tone: 'fertile', level: 0.4, today: true, lh: 'low' },
      { date: '2026-09-04', tone: 'peak', level: 1, today: false, lh: 'surge' },
    ]
    const strip: CycleStrip = {
      mode: 'cycle',
      days,
      todayIndex: 2,
      cycleDay: 3,
      length: 4,
      startLabel: '1일',
      endLabel: '4일',
      hasWindow: true,
      windowLabel: '가임기 (예상)',
      peakLabel: '가능성 높음',
      view: 'explicit',
    }
    const legend = ringLegend(strip, { quietWindow: false })
    expect(legend).toHaveLength(LEGEND_MAX)
    expect(legend.map((i) => i.key)).toEqual(['period', 'window', 'peak', 'lh'])
    expect(legend[3]).toMatchObject({ label: 'LH 양성 · 기록', lh: { low: true, surge: true } })
  })
})

describe('weekRows (partner without details)', () => {
  it('this week only, when next week has no band; today marked; no cycle days', () => {
    // Monday 09-14: the window's last two days (Mon 14, Tue 15), nothing next week.
    const strip = cycleStrip(fresh(), PEAK, PARTNER)!
    expect(strip.mode).toBe('weeks')
    const rows = weekRows(strip)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.cells.map((c) => c.weekday)).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    expect(rows[0]!.cells.find((c) => c.today)!.date).toBe(PEAK)
    expect(rows[0]!.cells.map((c) => c.day)).toEqual([14, 15, 16, 17, 18, 19, 20])
    expect(rows[0]!.bands).toEqual([{ from: 0, to: 1, roundStart: true, roundEnd: true }])
  })

  it('a band running into next week adds the second row with square joins', () => {
    // Window 09-10 (Thu) … 09-15 (Tue next week).
    const strip = cycleStrip(fresh(), FERTILE, PARTNER)!
    const rows = weekRows(strip)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.bands).toEqual([{ from: 3, to: 6, roundStart: true, roundEnd: false }])
    expect(rows[1]!.bands).toEqual([{ from: 0, to: 1, roundStart: false, roundEnd: true }])
  })

  it('bandBefore squares the left end of a band that started last week', () => {
    const strip = cycleStrip(fresh(), PEAK, PARTNER)!
    const rows = weekRows(strip, { bandBefore: true })
    expect(rows[0]!.bands[0]).toMatchObject({ from: 0, roundStart: false })
    expect(weekRows(strip)[0]!.bands[0]).toMatchObject({ from: 0, roundStart: true })
  })

  it('describes only the shared week, never the cycle', () => {
    const text = describeStrip(cycleStrip(fresh(), FERTILE, PARTNER)!)
    expect(text).toMatch(/^이번 주와 다음 주/)
    expect(text).toMatch(/우리의 주간 \(예상\)/)
    expect(text).not.toMatch(/생리|주기|LH|가임기/)
  })
})

// ── Property: every phase × viewer × voice × sharing ────────

describe('ring / legend / week row across every phase and viewer', () => {
  const DAYS: ISODate[] = ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-08', '2026-09-11', '2026-09-14', '2026-09-20', '2026-09-29', '2026-10-02']
  const STRICT = /가임기|배란|LH|가능성 높/
  const DETAILS = /생리|주기|LH|임테기|테스트|일째/

  function fixtures(): Array<{ name: string; state: AppState; day: ISODate }> {
    const out: Array<{ name: string; state: AppState; day: ISODate }> = []
    for (const day of DAYS) out.push({ name: `cycle ${day}`, state: fresh(), day })
    const lh = fresh({
      lhTests: [
        { date: '2026-09-10', result: 'negative' },
        { date: '2026-09-12', result: 'positive' },
        { date: '2026-09-13', result: 'peak' },
      ],
    })
    for (const day of ['2026-09-12', '2026-09-13', '2026-09-14']) out.push({ name: `lh ${day}`, state: lh, day })
    // A new period two days ago (period-early: 수고했어요 first).
    const early = fresh({ periods: [{ start: '2026-09-01', end: '2026-09-05' }, { start: '2026-09-29' }] })
    out.push({ name: 'period-early', state: early, day: '2026-09-30' })
    out.push({ name: 'rest', state: startRestCycle(fresh(), '2026-09-05'), day: '2026-09-11' })
    out.push({ name: 'positive-pending', state: markPositivePending(fresh(), '2026-09-26'), day: '2026-09-28' })
    out.push({ name: 'no-data', state: fresh({ periods: [] }), day: '2026-09-11' })
    out.push({
      name: 'after-loss',
      state: backToPreparing(startPregnancy(fresh(), '2026-07-01', '2026-08-05'), '2026-09-01'),
      day: '2026-09-11',
    })
    return out
  }

  it('one today, ≤ 4 legend items, no window on period days 1–3, and each voice keeps its words', () => {
    let rings = 0
    let weeks = 0
    let quiet = 0
    for (const { name, state, day } of fixtures()) {
      for (const viewer of [OWNER, PARTNER] as const) {
        for (const style of ['explicit', 'soft', 'off'] as const) {
          for (const lowPressure of [false, true]) {
            for (const shared of [false, true]) {
              let s = withStyle(state, viewer, style)
              s = setPersonalPref(s, viewer, 'lowPressure', lowPressure)
              if (shared) s = share(s)
              const strip = cycleStrip(s, day, viewer)
              if (!strip) continue
              const label = `${name} ${viewer} ${style} lp=${lowPressure} share=${shared}`
              const moment = ttcMoment(s, day, viewer)
              const quietWindow = moment?.kind === 'period-early'
              const voice = homeVoice(s, viewer)
              const details = canSeeCycleDetails(s, viewer)
              const said = describeStrip(strip, { quietWindow })

              if (!details) {
                // Without her consent: two calendar weeks and the shared band only.
                expect(strip.mode, label).toBe('weeks')
                expect(said, label).not.toMatch(DETAILS)
                const rows = weekRows(strip)
                expect(rows.length).toBeGreaterThanOrEqual(1)
                expect(rows.length).toBeLessThanOrEqual(2)
                expect(rows.flatMap((r) => r.cells).filter((c) => c.today).map((c) => c.date)).toEqual([day])
                for (const r of rows) for (const b of r.bands) for (let i = b.from; i <= b.to; i++) expect(r.cells[i]!.band).toBe(true)
                // (N19) The week row exists only while the shared window is on — never an empty '평소 주' row.
                expect(strip.hasWindow, label).toBe(true)
                weeks++
              } else {
                expect(strip.mode, label).toBe('cycle')
                const arcs = ringArcs(strip, { quietWindow })
                expect(arcs).toHaveLength(strip.days.length)
                const todays = arcs.flatMap((a, i) => (a.today ? [i] : []))
                expect(todays, label).toEqual([strip.todayIndex])
                expect(arcs[strip.todayIndex]!.date).toBe(day)
                // Period days after today are an estimate.
                arcs.forEach((a, i) => {
                  if (i > strip.todayIndex) expect(a.tone, label).not.toBe('period')
                })
                const legend = ringLegend(strip, { quietWindow })
                expect(legend.length, label).toBeLessThanOrEqual(LEGEND_MAX)
                expect(new Set(legend.map((i) => i.key)).size).toBe(legend.length)
                if (quietWindow) {
                  quiet++
                  expect(arcs.some((a) => a.tone === 'fertile' || a.tone === 'peak'), label).toBe(false)
                  expect(legend.every((i) => i.key === 'period' || i.key === 'period-predicted' || i.key === 'lh'), label).toBe(true)
                }
                if (voice !== 'explicit') {
                  expect(arcs.some((a) => a.lh), label).toBe(false)
                  expect(legend.map((i) => i.label).join(' '), label).not.toMatch(STRICT)
                }
                rings++
              }
              if (voice !== 'explicit') expect(said, label).not.toMatch(STRICT)
              if (lowPressure) {
                expect(strip.windowLabel, label).toBeUndefined()
                expect(strip.days.some((d) => d.tone === 'fertile' || d.tone === 'peak'), label).toBe(false)
              }
            }
          }
        }
      }
    }
    expect(rings).toBeGreaterThan(100)
    // (N19) Fewer week rows than before: the '평소 주' days draw none at all.
    expect(weeks).toBeGreaterThan(5)
    expect(quiet).toBeGreaterThan(0)
  })
})

describe('sharedWeek — which window a partner without her details sees, and when (N19)', () => {
  it("'곧 우리의 주간' from three days before, the window to its last day, nothing else", () => {
    const s = fresh()
    expect(sharedWeek(s, '2026-09-06')).toBeUndefined()
    expect(sharedWeek(s, '2026-09-07')).toMatchObject({ kind: 'soon', fertileStart: '2026-09-10', fertileEnd: '2026-09-15', confidence: 'cycles' })
    expect(sharedWeek(s, '2026-09-10')?.kind).toBe('window')
    expect(sharedWeek(s, '2026-09-15')?.kind).toBe('window')
    expect(sharedWeek(s, '2026-09-16')).toBeUndefined()
    // The waiting weeks, the due days, a late period: off.
    for (const d of ['2026-09-20', '2026-09-28', '2026-09-29', '2026-10-02', '2026-10-20']) expect(sharedWeek(s, d), d).toBeUndefined()
    // The window's cycle start keys his one notice.
    expect(sharedWeek(s, '2026-09-12')!.window.start).toBe('2026-09-01')
  })

  it('never on period days 1–3 (the home’s 수고했어요 days), even when a short cycle’s window covers them', () => {
    expect(SHARED_QUIET_DAYS).toBe(3)
    // (The settings say 21 days too: no start came earlier than his view expected.)
    const short = fresh({
      periods: [{ start: '2026-08-18' }, { start: '2026-09-08' }, { start: '2026-09-29' }],
      cycle: { cycleLength: 21, periodLength: 5 },
    })
    for (const d of ['2026-09-29', '2026-09-30', '2026-10-01']) expect(sharedWeek(short, d), d).toBeUndefined()
    expect(sharedWeek(short, '2026-10-02')).toMatchObject({ kind: 'window', fertileEnd: '2026-10-06' })
  })

  it('reads her logged starts and the settings only — never LH strips or tests', () => {
    const lh = fresh({
      lhTests: [{ date: '2026-09-07', result: 'faint' }, { date: '2026-09-08', result: 'positive' }],
      pregnancyTests: [{ id: 't', date: '2026-09-24', result: 'negative' }],
    })
    expect(sharedCycleInput(lh).lhTests).toEqual([])
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-09-01', i)
      expect(sharedWeek(lh, d), d).toEqual(sharedWeek(fresh(), d))
    }
  })

  it('off through every pause started before the span and the quiet after a pregnancy ended; off outside preparing', () => {
    const s = fresh()
    // The span would start 09-07: a pause from before then holds it back.
    expect(sharedWeek(startRestCycle(s, '2026-09-05', 'rest'), '2026-09-12')).toBeUndefined()
    expect(sharedWeek(startRestCycle(s, '2026-09-05', 'vaccine'), '2026-09-12')).toBeUndefined()
    expect(sharedWeek(startRestCycle(s, '2026-09-06', 'rest'), '2026-09-12')).toBeUndefined()
    // One started on the span's first day finds it already shown: it runs on.
    expect(sharedWeek(startRestCycle(s, '2026-09-07', 'rest'), '2026-09-12')).toEqual(sharedWeek(s, '2026-09-12'))
    expect(sharedWeek({ ...s, restCycle: { since: '2026-09-05', reason: 'clinic' } }, '2026-09-12')).toBeUndefined()
    expect(sharedWeek(markPositivePending(s, '2026-09-06'), '2026-09-12')).toBeUndefined()
    const lost = backToPreparing(startPregnancy(s, '2026-08-01', '2026-09-01'), '2026-09-05')
    expect(sharedWeek({ ...lost, periods: [...lost.periods, { start: '2026-09-20' }] }, '2026-09-30')).toBeUndefined()
    expect(sharedWeek({ ...s, stage: 'pregnant' }, '2026-09-12')).toBeUndefined()
    expect(sharedWeek(fresh({ periods: [] }), '2026-09-12')).toBeUndefined()
  })

  it("the week row's left end: square only when the shared window already ran before Monday", () => {
    const w = sharedWeek(fresh(), '2026-09-14')!
    expect(sharedBandBefore(w, '2026-09-14')).toBe(true) // window from 09-10, Monday 09-14
    expect(sharedBandBefore(w, '2026-09-07')).toBe(false)
    expect(sharedBandBefore(undefined, '2026-09-14')).toBe(false)
    const strip = cycleStrip(fresh(), '2026-09-14', PARTNER)!
    expect(strip).toMatchObject({ mode: 'weeks', bandBefore: true })
    expect(cycleStrip(fresh(), '2026-09-08', PARTNER)!.bandBefore).toBeUndefined()
    const rows = weekRows(strip, { bandBefore: strip.bandBefore })
    expect(rows[0]!.bands[0]).toMatchObject({ from: 0, roundStart: false })
  })
})

describe('his span holds once it has started; an untold early period does not pull the next one forward (Now 3 leftovers)', () => {
  // Window 09-10…09-15, span from 09-07; the next period expected 09-29.
  const s = fresh()

  it('the decision keys are the ones ttcFlow writes', () => {
    expect(sharedPeriodToldKey('2026-09-29')).toBe(periodToldKey('2026-09-29'))
    expect(sharedPositiveToldKey('2026-09-26')).toBe(positiveToldKey('2026-09-26'))
    expect(sharedSpanFrom({ start: '2026-09-01', fertileStart: '2026-09-10' })).toBe('2026-09-07')
    // Never on that cycle's days 1–3.
    expect(sharedSpanFrom({ start: '2026-09-01', fertileStart: '2026-09-03' })).toBe('2026-09-04')
  })

  it('a rest she starts inside the span keeps it to its last day; the dates rest after', () => {
    for (const since of ['2026-09-08', '2026-09-10', '2026-09-13']) {
      const rest = startRestCycle(s, since, 'rest')
      for (const d of ['2026-09-13', '2026-09-15']) expect(sharedWeek(rest, d), `${since} ${d}`).toEqual(sharedWeek(s, d))
      expect(sharedWeek(rest, '2026-09-16')).toBeUndefined()
    }
    // The vaccine rest the same.
    expect(sharedWeek(startRestCycle(s, '2026-09-11', 'vaccine'), '2026-09-14')).toEqual(sharedWeek(s, '2026-09-14'))
  })

  it('a positive test inside the span keeps it — until she tells him', () => {
    const pos = markPositivePending(
      { ...s, pregnancyTests: [{ id: 'p', date: '2026-09-12', result: 'positive', by: OWNER }] },
      '2026-09-12',
      'p',
    )
    expect(sharedWeek(pos, '2026-09-14')).toEqual(sharedWeek(s, '2026-09-14'))
    expect(sharedWeek(tellPartnerPositive(pos, '2026-09-12T21:00:00+09:00'), '2026-09-14')).toBeUndefined()
  })

  it('a period she logs inside the span (untold) waits until the span ends; told, it ends the span', () => {
    const early = logPeriodStart(s, '2026-09-12', OWNER, '2026-09-12')
    for (const d of ['2026-09-12', '2026-09-13', '2026-09-15']) expect(sharedWeek(early, d), d).toEqual(sharedWeek(s, d))
    expect(sharedWeek(early, '2026-09-16')).toBeUndefined()
    const told = tellPartnerPeriod(early, '2026-09-12', '2026-09-12T21:00:00+09:00')
    expect(sharedWeek(told, '2026-09-13')).toBeUndefined()
  })

  it('the clinic mode (both phones show it) still ends the span', () => {
    expect(sharedWeek(startClinicMode(s, '2026-09-12'), '2026-09-13')).toBeUndefined()
  })

  it('an untold early period: his next span stays where his view expected it; told, it follows her real day', () => {
    // 09-20 instead of 09-29 (nine days early), not told.
    const early = logPeriodStart(s, '2026-09-20', OWNER, '2026-09-20')
    const starts = ['2026-06-09', '2026-07-07', '2026-08-04', '2026-09-01', '2026-09-20']
    // Frozen to the cycle the 09-01 start projected: from 09-29, window 10-08…10-13.
    expect(anchoredWindow(early, starts, 4)).toMatchObject({ start: '2026-09-29', fertileStart: '2026-10-08', fertileEnd: '2026-10-13' })
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-09-20', i)
      // Exactly what he would have seen had her period come on the day his view expected.
      const onTime = logPeriodStart(s, '2026-09-29', OWNER, '2026-09-29')
      if (d >= '2026-09-29') expect(sharedWeek(early, d), d).toEqual(sharedWeek(onTime, d))
      else expect(sharedWeek(early, d), d).toBeUndefined()
    }
    expect(sharedWeek(early, '2026-10-05')).toMatchObject({ kind: 'soon', fertileStart: '2026-10-08' })
    // Told: his window follows her real start (09-20, the short cycle in the average: window
    // 09-27…10-02, span from 09-24).
    const told = tellPartnerPeriod(early, '2026-09-20', '2026-09-20T21:00:00+09:00')
    expect(sharedWeek(told, '2026-09-23')).toBeUndefined()
    expect(sharedWeek(told, '2026-09-24')).toMatchObject({ kind: 'soon', fertileStart: '2026-09-27', fertileEnd: '2026-10-02' })
    // On time or late: his window follows her real start as before.
    const late = logPeriodStart(s, '2026-10-02', OWNER, '2026-10-02')
    // (The 31-day cycle in the average: 29 days → window 10-12…10-17, span from 10-09.)
    expect(sharedWeek(late, '2026-10-08')).toBeUndefined()
    expect(sharedWeek(late, '2026-10-09')).toMatchObject({ kind: 'soon', fertileStart: '2026-10-12', window: { start: '2026-10-02' } })
  })

  it('the freeze covers the next window only: the start after it anchors on its real day again', () => {
    let st = logPeriodStart(s, '2026-09-20', OWNER, '2026-09-20')
    st = logPeriodStart(st, '2026-10-18', OWNER, '2026-10-18')
    // 10-18 is on time after 09-20 (28 days): his window counts from her real 10-18 again, in step with
    // hers (the short 09-01→09-20 cycle now in the average: 26 days → window 10-25…10-30).
    expect(sharedWeek(st, '2026-10-27')).toMatchObject({
      kind: 'window',
      fertileStart: '2026-10-25',
      fertileEnd: '2026-10-30',
      window: { start: '2026-10-18' },
    })
    // And the frozen window before it has ended by then: nothing between 10-14 and the new span (10-22).
    for (const d of ['2026-10-14', '2026-10-18', '2026-10-21']) expect(sharedWeek(st, d), d).toBeUndefined()
  })
})
