// Now 2 integration review — adversarial checks across the tracks (N10–N17).
//
// Each block asks one question the way a hostile reviewer would: does every
// screen read the SAME expected-period range? Does low confidence really hide
// the peak everywhere (home, calendar, notices, .ics)? Can a clinic cycle be
// ended by a period, or leak a date notice? Can the partner — through any
// lens, notice, export or the shared state — ever read the owner's private
// log? Does '안 써요' ever put LH first? Does old data load byte-for-byte?
import { describe, expect, it } from 'vitest'
import { FEEL_CHIPS } from '@/lib/content/fertility'
import { addDays, diffDays } from '@/lib/dates'
import { createDemoState, stateFromOnboarding } from '@/lib/demo'
import { createInitialState, cycleLengthRange } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import {
  CLINIC_LABEL,
  cellView,
  cycleFeels,
  cycleHistory,
  cycleLens,
  cycleSummary,
  dayChanceLabel,
  icsAvailability,
  isMissedGap,
  knownCycleDay,
  legendItems,
  lensPhase,
  lhRowLine,
  monthConfidence,
} from '@/lib/logic/calendarView'
import { CLINIC_REASON, endClinicMode, isClinicMode, startClinicMode } from '@/lib/logic/clinic'
import { heroLine } from '@/lib/logic/cover'
import {
  DUE_SETTINGS_SPREAD,
  LH_LUTEAL_MIN_DAYS,
  LONG_LATE_DAYS,
  MAX_CYCLE,
  MAX_CYCLE_LONG,
  cycleAt,
  cycleConfidence,
  cycleStats,
  dayInfo,
  daysLate,
  expectedPeriod,
  fertilityStatus,
  forecastLimit,
  lateFrom,
  maxCycleLength,
  noSurgeWait,
  upcomingWindows,
} from '@/lib/logic/cycle'
import { fertileHintsAllowed } from '@/lib/logic/dateIdeas'
import { addEntry } from '@/lib/logic/diary'
import { buildDiaryHtml, filterEntries } from '@/lib/logic/diaryExport'
import { fertileWindowEvents } from '@/lib/logic/ics'
import {
  addLHTest,
  addPregnancyTest,
  defaultLogKind,
  lhAskDue,
  lhKey,
  lhTestsOn,
  logPeriodStart,
  logUndo,
  planLHTest,
  removeLHTest,
  undoLog,
  type LHInput,
} from '@/lib/logic/logs'
import { amenorrheaKey, checkupsDone, scheduledNotices } from '@/lib/logic/notifications'
import {
  JOINING_MEMBER,
  applyOnboardingCycle,
  applyPartnerDefaults,
  completePartnerFirstRun,
  needsPartnerFirstRun,
  periodStartsFrom,
} from '@/lib/logic/onboarding'
import {
  FERTILITY_APPLY_ID,
  FERTILITY_CARRIER_TEST_ID,
  FERTILITY_CLAIM_ID,
  FERTILITY_TEST_ID,
  appliedMembers,
  chainKey,
  claimInfo,
  completeMonthlyTask,
  fertilityChain,
  monthlyTask,
  partnerTip,
  setFertilityApplied,
  setFertilityClaimed,
} from '@/lib/logic/partnerTrack'
import { AMENORRHEA_NOTICE_DAYS, LATE_TEST_DAYS, PERIOD_DUE_COPY } from '@/lib/logic/periodDue'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote, stateForViewer, visibleEntries } from '@/lib/logic/personalLog'
import { monthsEnd, tickItem } from '@/lib/logic/plan'
import { lhPrompting, setUsesLH } from '@/lib/logic/prefs'
import { addCustomTask, setCustomTaskDeadlineAlerts } from '@/lib/logic/roadmap'
import { CYCLE_LENGTH_RANGE, cycleLengthRangeFor, cycleSourceNote, sanitizeBackup, setCycle } from '@/lib/logic/settings'
import { CHECKUP_ITEM_IDS, doctorAdvice, noticeTarget } from '@/lib/logic/today'
import { activeRest, startRestCycle } from '@/lib/logic/ttc'
import { cycleStrip, markStillWaiting, ttcMoment, ttcPhase, type Moment } from '@/lib/logic/ttcFlow'
import { albumGroups, chapterContext, filterStory } from '@/lib/logic/usView'
import { buildFullBackup, parseFullBackup, readAnyBackup } from '@/lib/persist'
import { parseState } from '@/lib/storage'
import type { AlertStyle, AppState, ISODate, LHResult, LHSlot, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (tracks the cycle). Last period 09-01.
const OWNER: MemberId = 'b'
const PARTNER: MemberId = 'a'
const NOW = '2026-09-01T09:00:00+09:00'
/** Three regular 28-day cycles before 09-01 → confidence 'cycles', a one-day range on 09-29. */
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
  return { ...s, ...over }
}

const confident = (over: Partial<AppState> = {}) => fresh({ periods: REGULAR, ...over })

function withStyle(s: AppState, member: MemberId, style: AlertStyle): AppState {
  return { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [member]: style } } }
}
function withPersonal(s: AppState, member: MemberId, lowPressure: boolean): AppState {
  return { ...s, settings: { ...s.settings, personal: { ...(s.settings.personal ?? {}), [member]: { lowPressure } } } }
}
const share = (s: AppState, on = true): AppState => ({ ...s, settings: { ...s.settings, shareLevel: on ? 'details' : 'week' } })

function* days(from: ISODate, to: ISODate): Generator<ISODate> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d
}

function lh(s: AppState, date: ISODate, result: LHResult, time = '08:00'): AppState {
  return addLHTest(s, { date, result, time, by: OWNER }, date)
}

/** The log kind an action opens, if it is a log action. */
const logKind = (a: Moment['primary']) => (a?.type === 'log' ? a.kind : undefined)

/** Every string a viewer can read on the moment card. */
function words(m: Moment | null): string {
  if (!m) return ''
  return [m.eyebrow, m.title, m.body, m.note, m.partnerTip, m.primary?.label, m.secondary?.label].filter(Boolean).join(' ')
}

const FERTILE_WORDS = /가임기|배란|LH|가능성 높/

// ── 1. The expected period is ONE range, on every basis ─────

describe('expected-period range math and lateFrom on every basis (N10)', () => {
  it('settings basis (one logged period): average ± 2, late the day after, test prompt from day 3', () => {
    const s = fresh()
    const due = expectedPeriod(s, '2026-09-01')
    expect(due).toEqual({ from: '2026-09-27', to: '2026-10-01', basis: 'settings' })
    expect(DUE_SETTINGS_SPREAD).toBe(2)
    expect(lateFrom(due)).toBe('2026-10-02')
    expect(daysLate(due, '2026-10-01')).toBe(0)
    expect(daysLate(due, '2026-10-02')).toBe(1)

    expect(fertilityStatus(s, '2026-09-26')).toMatchObject({ kind: 'after-fertile', dueNow: false, daysUntilPeriod: 1, nextPeriod: '2026-09-27' })
    for (const d of days('2026-09-27', '2026-10-01')) {
      expect(fertilityStatus(s, d)).toMatchObject({ kind: 'after-fertile', dueNow: true, daysUntilPeriod: 0 })
      expect(dayInfo(s, d, d)).toMatchObject({ phase: 'period-predicted', cycleDay: diffDays('2026-09-01', d) + 1 })
      expect(forecastLimit(s, d)).toBeUndefined()
    }
    expect(fertilityStatus(s, '2026-10-02')).toMatchObject({ kind: 'late', daysLate: 1 })
    expect(forecastLimit(s, '2026-10-02')).toMatchObject({ from: '2026-09-27', reason: 'late', lastStart: '2026-09-01' })

    // Home card: the first late days say nothing about a test; day 3 does.
    expect(ttcMoment(s, '2026-10-02', OWNER)).toMatchObject({ copy: 'owner.late', daysLate: 1 })
    expect(words(ttcMoment(s, '2026-10-02', OWNER))).not.toMatch(/테스트해/)
    expect(ttcMoment(s, addDays('2026-10-02', LATE_TEST_DAYS - 1), OWNER)?.body).toMatch(/테스트/)

    // Notices: one heads-up the day before the range, one 'late' on lateFrom, one test prompt from lateFrom + 2 — none inside the range.
    const keys = (d: ISODate) => scheduledNotices(s, d).filter((n) => n.to === OWNER && /^(period-due|late|late-test):/.test(n.key)).map((n) => n.key)
    expect(keys('2026-09-26')).toEqual(['period-due:2026-09-01:b'])
    for (const d of days('2026-09-27', '2026-10-01')) expect(keys(d)).toEqual([])
    expect(keys('2026-10-02')).toEqual(['late:2026-09-01:b'])
    expect(keys('2026-10-03')).toEqual(['late:2026-09-01:b'])
    expect(keys('2026-10-04')).toEqual(['late:2026-09-01:b', 'late-test:2026-09-01:b'])
    expect(keys(addDays(due.to, LONG_LATE_DAYS + 1))).toEqual([])
  })

  it('calendar basis (29·31·34-day cycles): the range runs from the shortest to the longest, so days 32–33 are not late', () => {
    // 06-03 → 07-02 (29) → 08-02 (31) → 09-05 (34): average 31, spread 5 → 'cycles'.
    const s = fresh({ periods: [{ start: '2026-06-03' }, { start: '2026-07-02' }, { start: '2026-08-02' }, { start: '2026-09-05' }] })
    expect(cycleStats(s.periods, s.cycle)).toMatchObject({ average: 31, min: 29, max: 34, confidence: 'cycles' })
    const due = expectedPeriod(s, '2026-09-05')
    expect(due).toEqual({ from: '2026-10-04', to: '2026-10-09', basis: 'calendar' })
    const day = (n: number) => addDays('2026-09-05', n - 1)
    expect(fertilityStatus(s, day(32)).kind).toBe('after-fertile')
    expect(fertilityStatus(s, day(33)).kind).toBe('after-fertile')
    expect(fertilityStatus(s, day(35)).kind).toBe('after-fertile')
    expect(fertilityStatus(s, day(36))).toMatchObject({ kind: 'late', daysLate: 1 })
    expect(scheduledNotices(s, day(33)).filter((n) => /^late/.test(n.key))).toEqual([])
    // Clipped to average ± 4: a 20…45 spread would still read 27…35.
    const wide = fresh({ periods: [{ start: '2026-03-01' }, { start: '2026-03-21' }, { start: '2026-05-05' }, { start: '2026-06-03' }, { start: '2026-07-01' }] })
    const stats = cycleStats(wide.periods, wide.cycle)
    const due2 = expectedPeriod(wide, '2026-07-01')
    expect(diffDays('2026-07-01', due2.from)).toBe(Math.max(stats.min!, stats.average - 4))
    expect(diffDays('2026-07-01', due2.to)).toBe(Math.min(stats.max!, stats.average + 4))
  })

  it('lh basis: from = max(start + average, ovulation + 12), two days wide — a late surge un-lates the cycle, an early one never pulls it earlier', () => {
    const late = lh(confident(), '2026-09-20', 'positive')
    const due = expectedPeriod(late, '2026-09-01')
    expect(LH_LUTEAL_MIN_DAYS).toBe(12)
    expect(due).toEqual({ from: '2026-10-03', to: '2026-10-05', basis: 'lh' })
    // Without the surge 10-02 would be 3 days late; with it the cycle is still waiting.
    expect(fertilityStatus(confident(), '2026-10-02')).toMatchObject({ kind: 'late', daysLate: 3 })
    expect(fertilityStatus(late, '2026-10-02')).toMatchObject({ kind: 'after-fertile', nextPeriod: '2026-10-03', dueNow: false })
    expect(fertilityStatus(late, '2026-10-06')).toMatchObject({ kind: 'late', daysLate: 1 })
    // The window and the projected next cycle start where the range starts.
    expect(cycleAt(late, '2026-09-01')?.nextPeriod).toBe('2026-10-03')
    expect(upcomingWindows(late, '2026-10-02', 1)[0]?.start).toBe('2026-10-03')
    expect(cycleConfidence(late, '2026-10-02')).toBe('lh')

    const early = lh(confident(), '2026-09-10', 'positive')
    expect(expectedPeriod(early, '2026-09-01')).toEqual({ from: '2026-09-29', to: '2026-10-01', basis: 'lh' })
    // 희미 is not a surge.
    expect(expectedPeriod(lh(confident(), '2026-09-20', 'faint'), '2026-09-01').basis).toBe('calendar')
  })

  it('property: late ⇔ today > to, daysLate counts from to, and the range days read 생리 예정 — on every basis', () => {
    const fixtures: AppState[] = [
      fresh(),
      confident(),
      lh(confident(), '2026-09-20', 'positive'),
      lh(confident(), '2026-09-10', 'peak'),
      fresh({ periods: [{ start: '2026-06-03' }, { start: '2026-07-02' }, { start: '2026-08-02' }, { start: '2026-09-05' }] }),
      fresh({ cycle: { cycleLength: 35, periodLength: 6 } }),
      fresh({ cycle: { cycleLength: 21, periodLength: 3 } }),
    ]
    let checked = 0
    for (const s of fixtures) {
      const start = s.periods[s.periods.length - 1]!.start
      const due = expectedPeriod(s, start)
      expect(lateFrom(due)).toBe(addDays(due.to, 1))
      expect(daysLate(due, lateFrom(due))).toBe(1)
      expect(due.from <= due.to).toBe(true)
      for (const d of days(addDays(start, 1), addDays(start, 60))) {
        const st = fertilityStatus(s, d)
        expect(st.kind === 'late').toBe(d > due.to)
        if (st.kind === 'late') {
          expect(st.daysLate).toBe(diffDays(due.to, d))
          expect(st.due).toEqual(due)
          expect(forecastLimit(s, d)).toMatchObject({ from: due.from, reason: 'late', due })
          expect(upcomingWindows(s, d)).toEqual([])
        } else if (st.kind === 'after-fertile') {
          expect(st.due).toEqual(due)
          expect(st.dueNow).toBe(d >= due.from)
        }
        if (d >= due.from && d <= due.to) expect(dayInfo(s, d, d).phase).toBe('period-predicted')
        checked++
      }
    }
    expect(checked).toBeGreaterThan(400)
  })

  it('property: each cycle sends exactly one heads-up (from − 1), one late (to + 1) and one test prompt (to + 3) — never inside the range', () => {
    for (const s of [fresh(), confident(), lh(confident(), '2026-09-20', 'positive')]) {
      const due = expectedPeriod(s, '2026-09-01')
      const seen = new Map<string, ISODate>()
      for (const d of days('2026-09-02', addDays(due.to, LONG_LATE_DAYS + 5))) {
        for (const n of scheduledNotices(s, d)) {
          if (!/^(period-due|late|late-test):/.test(n.key)) continue
          expect(n.to).toBe(OWNER)
          if (!seen.has(n.key)) seen.set(n.key, d)
          if (d >= due.from && d <= due.to) throw new Error(`${n.key} inside the range on ${d}`)
        }
      }
      expect([...seen.entries()]).toEqual([
        ['period-due:2026-09-01:b', addDays(due.from, -1)],
        ['late:2026-09-01:b', lateFrom(due)],
        ['late-test:2026-09-01:b', addDays(due.to, LATE_TEST_DAYS)],
      ])
    }
  })
})

// ── 2. Confidence gates: no peak anywhere at 'low' ──────────

describe('confidence: low hides the peak days everywhere (home, calendar, legend, notices, .ics)', () => {
  const SWEEP = ['2026-09-02', '2026-09-30'] as const

  it('one logged period: no peak phase, no ⭐, no 높음, no 🌟, no peak .ics event — anywhere', () => {
    const s = fresh()
    expect(cycleConfidence(s, '2026-09-10')).toBe('low')
    const peakKeys: string[] = []
    const cells = []
    for (const d of days(...SWEEP)) {
      const info = dayInfo(s, d, d)
      expect(info.phase).not.toBe('peak')
      expect(info.isOvulation).toBe(false)
      expect(dayChanceLabel(info, 'explicit')).toBeNull()
      const cell = cellView(info, { month: '2026-09-01', today: d, view: 'explicit' })
      expect(cell.star).toBe(false)
      expect(cell.ariaLabel).not.toMatch(/배란|높음/)
      cells.push(cell)
      const strip = cycleStrip(s, d, OWNER)
      if (strip) {
        expect(strip.days.some((x) => x.tone === 'peak')).toBe(false)
        expect(strip.peakLabel).toBeUndefined()
        if (strip.hasWindow) expect(strip.windowLabel).toBe('예상 범위 (넓음)')
      }
      const m = ttcMoment(s, d, OWNER)
      expect(words(m)).not.toMatch(/가능성 높|⭐|LH 기준/)
      if (m?.kind === 'fertile' || m?.kind === 'before-fertile') expect(m.eyebrow).toMatch(/달력 기준/)
      for (const n of scheduledNotices(s, d)) {
        if (n.key.startsWith('peak:')) peakKeys.push(n.key)
        if (n.key.startsWith('fertile:') && n.to === OWNER) expect(n.body).toMatch(/넓음/)
      }
      const summary = cycleSummary(s, d, 'explicit')
      expect(summary.rows.some((r) => r.key === 'ovulation')).toBe(false)
      expect(JSON.stringify(summary)).not.toMatch(/가능성이 높은|배란 예상일/)
    }
    expect(peakKeys).toEqual([])
    expect(monthConfidence(cells)).toBe('low')
    const legend = legendItems('explicit', { details: true, owner: true }, { confidence: 'low' })
    expect(legend.map((l) => l.key)).toEqual(['period', 'fertile', 'possible'])
    expect(legendItems('soft', { details: true, owner: true }, { confidence: 'low' }).some((l) => /특히 좋은/.test(l.label))).toBe(false)
    const events = fertileWindowEvents(upcomingWindows(s, '2026-09-02', 3), { discreet: false, peak: true })
    expect(events.every((e) => !e.uid.includes('peak') && !/가장 높은/.test(e.title))).toBe(true)
  })

  it('three regular cycles: the peak is back on every one of those screens; a 긴 주기 setting takes it away again; an LH surge brings it back', () => {
    const s = confident()
    expect(cycleConfidence(s, '2026-09-10')).toBe('cycles')
    expect(dayInfo(s, '2026-09-14', '2026-09-14')).toMatchObject({ phase: 'peak', confidence: 'cycles' })
    expect(dayInfo(s, '2026-09-15', '2026-09-15').isOvulation).toBe(true)
    expect(cellView(dayInfo(s, '2026-09-15', '2026-09-15'), { month: '2026-09-01', today: '2026-09-15', view: 'explicit' }).star).toBe(true)
    expect(dayChanceLabel(dayInfo(s, '2026-09-14', '2026-09-14'), 'explicit')).toBe('높음')
    expect(cycleStrip(s, '2026-09-14', OWNER)?.peakLabel).toBe('가능성 높음')
    expect(scheduledNotices(s, '2026-09-13').some((n) => n.key === 'peak:2026-09-01:b')).toBe(true)
    expect(fertileWindowEvents(upcomingWindows(s, '2026-09-02', 2), { discreet: false, peak: true })).toHaveLength(4)
    expect(cycleSummary(s, '2026-09-10', 'explicit').rows.some((r) => r.key === 'ovulation')).toBe(true)

    const long = confident({ cycle: { cycleLength: 28, periodLength: 5, longCycles: true } })
    expect(cycleConfidence(long, '2026-09-10')).toBe('low')
    for (const d of days(...SWEEP)) {
      expect(dayInfo(long, d, d).phase).not.toBe('peak')
      expect(scheduledNotices(long, d).some((n) => n.key.startsWith('peak:'))).toBe(false)
    }
    const pinned = lh(long, '2026-09-13', 'positive')
    expect(cycleConfidence(pinned, '2026-09-14')).toBe('lh')
    expect(dayInfo(pinned, '2026-09-14', '2026-09-14')).toMatchObject({ phase: 'peak', isOvulation: true, confidence: 'lh' })

    // Four cycles that differ by more than 7 days are 'low' too.
    const irregular = fresh({ periods: [{ start: '2026-05-01' }, { start: '2026-05-25' }, { start: '2026-06-29' }, { start: '2026-07-26' }, { start: '2026-09-01' }] })
    expect(cycleStats(irregular.periods, irregular.cycle).confidence).toBe('low')
    expect(dayInfo(irregular, '2026-09-14', '2026-09-14').phase).not.toBe('peak')
  })

  it('the partner never sees a peak the owner cannot: soft wording, no details, low confidence', () => {
    const s = fresh()
    for (const style of ['explicit', 'soft', 'off'] as AlertStyle[]) {
      for (const shared of [false, true]) {
        const v = share(withStyle(s, PARTNER, style), shared)
        for (const d of days('2026-09-08', '2026-09-20')) {
          const strip = cycleStrip(v, d, PARTNER)
          expect(strip?.days.some((x) => x.tone === 'peak') ?? false).toBe(false)
          expect(strip?.peakLabel).toBeUndefined()
          expect(ttcMoment(v, d, PARTNER)?.peak ?? false).toBe(false)
          for (const n of scheduledNotices(v, d)) if (n.to === PARTNER) expect(n.kind).not.toBe('peak')
        }
      }
    }
  })
})

// ── 3. Long cycles ──────────────────────────────────────────

describe('long cycles (cycle.longCycles, N12)', () => {
  const LONG = [{ start: '2026-03-01' }, { start: '2026-05-15' }, { start: '2026-07-29' }] // two 75-day cycles

  it('a 75-day gap is a cycle only with the setting on; the average, the day count and 기록 누락? follow', () => {
    const off = fresh({ periods: LONG })
    const on = fresh({ periods: LONG, cycle: { cycleLength: 28, periodLength: 5, longCycles: true } })
    expect(cycleStats(off.periods, off.cycle)).toMatchObject({ source: 'settings', average: 28, count: 0, confidence: 'low' })
    expect(cycleStats(on.periods, on.cycle)).toMatchObject({ source: 'logs', average: 75, count: 2, confidence: 'low' })
    expect(maxCycleLength(off.cycle)).toBe(MAX_CYCLE)
    expect(maxCycleLength(on.cycle)).toBe(MAX_CYCLE_LONG)
    expect(cycleHistory(on, '2026-09-20').rows.every((r) => r.hint === undefined)).toBe(true)
    expect(cycleHistory(off, '2026-09-20').rows.filter((r) => r.hint === 'gap')).toHaveLength(2)
    expect(cycleHistory(on, '2026-09-20').maxCycle).toBe(90)
    expect(isMissedGap(75, { maxCycle: 90, average: 75 })).toBe(false)
    expect(isMissedGap(75, { maxCycle: 60, average: 28 })).toBe(true)
    // Without the setting a 61–79-day gap on a 40-day average is dropped from the average but not called a missed log.
    expect(isMissedGap(61, { maxCycle: 60, average: 40 })).toBe(false)
    expect(knownCycleDay({ cycleDay: 70 }, maxCycleLength(on.cycle))).toBe(70)
    expect(knownCycleDay({ cycleDay: 70 })).toBeUndefined()
    // The 75-day cycle's expected range comes from its own average now.
    expect(expectedPeriod(on, '2026-07-29').basis).toBe('settings')
    expect(diffDays('2026-07-29', expectedPeriod(on, '2026-07-29').from)).toBe(75 - DUE_SETTINGS_SPREAD)
  })

  it('every clamp agrees: settings, onboarding and a backup accept 15–90 only with the setting', () => {
    expect(cycleLengthRange(undefined)).toEqual({ min: 15, max: 60 })
    expect(cycleLengthRange(true)).toEqual({ min: 15, max: 90 })
    expect(CYCLE_LENGTH_RANGE).toEqual({ min: 15, max: 60 })
    expect(cycleLengthRangeFor({ longCycles: true }).max).toBe(90)
    const s = fresh()
    expect(setCycle(s, { cycleLength: 75 }).cycle).toEqual({ cycleLength: 60, periodLength: 5 })
    const on = setCycle(s, { longCycles: true, cycleLength: 75 })
    expect(on.cycle).toEqual({ cycleLength: 75, periodLength: 5, longCycles: true })
    // Turning it off pulls the length back and removes the field (older saves have none).
    expect(setCycle(on, { longCycles: false }).cycle).toEqual({ cycleLength: 60, periodLength: 5 })
    expect('longCycles' in setCycle(s, { longCycles: false }).cycle).toBe(false)
    expect(cycleSourceNote({ source: 'settings' }, 2, { longCycles: true })).toMatch(/15~90일/)
    expect(cycleSourceNote({ source: 'settings' }, 2)).toMatch(/15~60일/)

    const backup = (cycle: unknown) => sanitizeBackup({ ...JSON.parse(JSON.stringify(s)), cycle } as AppState)!.cycle
    expect(backup({ cycleLength: 75, periodLength: 5 })).toEqual({ cycleLength: 60, periodLength: 5 })
    expect(backup({ cycleLength: 75, periodLength: 5, longCycles: true })).toEqual({ cycleLength: 75, periodLength: 5, longCycles: true })
    expect(backup({ cycleLength: 75, periodLength: 5, longCycles: 'yes' })).toEqual({ cycleLength: 60, periodLength: 5 })
    expect(backup({ cycleLength: 45, periodLength: 5 })).toEqual({ cycleLength: 45, periodLength: 5 })

    expect(createInitialState({ me: { name: 'a', role: 'wife' }, partner: { name: 'b', role: 'husband' }, cycleOwner: 'a', longCycles: true, cycleLength: 80 }).cycle).toMatchObject({ longCycles: true, cycleLength: 80 })
    const onboarded = stateFromOnboarding(
      {
        me: { name: '지은', role: 'wife' },
        partner: { name: '민수', role: 'husband' },
        cycleOwner: 'a',
        cycleLength: 80,
        longCycles: true,
        alertStyle: { a: 'explicit', b: 'soft' },
        lowPressure: false,
      },
      '2026-10-02',
      new Date('2026-10-02T09:00:00+09:00'),
    )
    expect(onboarded.cycle).toMatchObject({ cycleLength: 80, longCycles: true })
  })
})

// ── 4. '아직 안 왔어요' ─────────────────────────────────────

describe("'아직 안 왔어요' (stillWaiting): the day keeps counting, a quiet weekly 🩺 line, the partner hears nothing", () => {
  // One period 09-01, range 09-27…10-01 → 15 days late on 10-16.
  const base = fresh()
  const DAY15 = addDays('2026-10-01', LONG_LATE_DAYS + 1)
  const waiting = markStillWaiting(base, '2026-09-01', DAY15)

  it('asks first, then keeps the count; marking is idempotent and ignores bad dates', () => {
    const ask = ttcMoment(base, DAY15, OWNER)!
    expect(ask).toMatchObject({ copy: 'owner.late-long', daysLate: 15 })
    expect(ask.secondary).toEqual({ type: 'still-waiting', label: PERIOD_DUE_COPY.missedLog.stillWaiting })
    expect(logKind(ask.primary)).toBe('period')
    expect(waiting.cycleNotes).toEqual({ '2026-09-01': { stillWaiting: DAY15 } })
    expect(markStillWaiting(waiting, '2026-09-01', addDays(DAY15, 3))).toBe(waiting)
    expect(markStillWaiting(base, 'nope', DAY15)).toBe(base)
    expect(markStillWaiting(base, '2026-09-01', '2026-13-40')).toBe(base)
    const m = ttcMoment(waiting, addDays(DAY15, 4), OWNER)!
    expect(m.copy).toBe('owner.late-waiting')
    expect(m.eyebrow).toBe(PERIOD_DUE_COPY.stillWaiting.eyebrow(diffDays('2026-09-01', addDays(DAY15, 4)) + 1))
    expect(m.eyebrow).toMatch(/^주기 50일째/)
    expect(cycleSummary(waiting, addDays(DAY15, 4), 'explicit')).toMatchObject({ cycleDay: 50, headline: { title: m.eyebrow } })
    // No number of days / weeks for "when to be seen" anywhere in the still-waiting copy — the evidence has none (NICE's '1년' is the ordinary wait, named as such).
    const copy = PERIOD_DUE_COPY.stillWaiting
    for (const text of [copy.title, copy.body, copy.note, copy.advice, copy.notice.title, copy.notice.body]) {
      expect(text).not.toMatch(/\d+\s*(일|주|개월)/)
    }
    expect([copy.note, copy.advice, copy.notice.body].every((t) => /NICE/.test(t))).toBe(true)
    // A research file path is evidence for the code comment, never a sentence on a phone.
    for (const text of Object.values(PERIOD_DUE_COPY).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'object' ? Object.values(v).filter((x): x is string => typeof x === 'string') : []))) {
      expect(text).not.toMatch(/docs\/|\.json|\.ts\b/)
    }
  })

  it('sends the owner one 🩺 line a week after the answer (never the partner, never with a positive test or a pause), and the DoctorCard carries the reason', () => {
    const keysFor = (s: AppState, d: ISODate, to: MemberId) => scheduledNotices(s, d).filter((n) => n.to === to && n.key.startsWith('amenorrhea:'))
    expect(keysFor(waiting, addDays(DAY15, AMENORRHEA_NOTICE_DAYS - 1), OWNER)).toEqual([])
    const first = keysFor(waiting, addDays(DAY15, AMENORRHEA_NOTICE_DAYS), OWNER)
    expect(first).toEqual([expect.objectContaining({ key: amenorrheaKey('2026-09-01', 1, OWNER), kind: 'doctor', title: PERIOD_DUE_COPY.stillWaiting.notice.title })])
    expect(keysFor(waiting, addDays(DAY15, 2 * AMENORRHEA_NOTICE_DAYS), OWNER)[0]?.key).toBe(amenorrheaKey('2026-09-01', 2, OWNER))
    for (const d of days(DAY15, addDays(DAY15, 40))) {
      expect(keysFor(waiting, d, PARTNER)).toEqual([])
      expect(keysFor(base, d, OWNER)).toEqual([]) // not answered → nothing
    }
    expect(noticeTarget('doctor', 'preparing', amenorrheaKey('2026-09-01', 1, OWNER))).toBe('today')
    // A positive home test waiting for the clinic answers the question instead.
    const positive = addPregnancyTest(waiting, { date: addDays(DAY15, 2), result: 'positive', by: OWNER, id: 'p' }).state
    expect(keysFor(positive, addDays(DAY15, AMENORRHEA_NOTICE_DAYS), OWNER)).toEqual([])
    expect(keysFor(startRestCycle(waiting, DAY15), addDays(DAY15, AMENORRHEA_NOTICE_DAYS), OWNER)).toEqual([])
    expect(keysFor(startClinicMode(waiting, DAY15), addDays(DAY15, AMENORRHEA_NOTICE_DAYS), OWNER)).toEqual([])

    expect(doctorAdvice(base, DAY15)).toBeNull()
    expect(doctorAdvice(waiting, DAY15)?.reasons).toEqual(['amenorrhea'])
    expect(doctorAdvice(positive, DAY15)).toBeNull()
    expect(doctorAdvice(startClinicMode(waiting, DAY15), DAY15)).toBeNull()
    // A period logged later ends it: the new cycle is ordinary again.
    const next = logPeriodStart(waiting, addDays(DAY15, 10), OWNER, addDays(DAY15, 10))
    expect(ttcMoment(next, addDays(DAY15, 10), OWNER)?.copy).toBe('owner.period-early')
    // (The one measured 55-day cycle now reads as irregular by length — that is the ordinary rule, not this one.)
    expect(doctorAdvice(next, addDays(DAY15, 10))?.reasons ?? []).not.toContain('amenorrhea')
  })

  it('the partner: without details a waiting card with no cycle words; with details the shared waiting card; nothing in a backup leaks', () => {
    const d = addDays(DAY15, 4)
    const his = ttcMoment(waiting, d, PARTNER)!
    // N19: without her details a late wait is the one 평소 주 card (nothing changes on the due day).
    expect(his.copy).toBe('partner.neutral')
    expect(words(his)).not.toMatch(/늦|생리|주기|테스트/)
    expect(ttcMoment(share(waiting), d, PARTNER)?.copy).toBe('partner.late-shared')
    expect(cycleStrip(waiting, d, PARTNER)).toBeNull()
    expect(parseState(JSON.stringify(waiting))!.cycleNotes).toEqual(waiting.cycleNotes)
    const bad = { ...JSON.parse(JSON.stringify(waiting)), cycleNotes: { '2026-09-01': { stillWaiting: 'soon' }, nope: { stillWaiting: DAY15 } } }
    expect(sanitizeBackup(bad as AppState)!.cycleNotes).toBeUndefined()
  })
})

// ── 5. tww-no-surge ─────────────────────────────────────────

describe('LH strips but no surge by the window’s end (tww-no-surge, N11)', () => {
  const strips = (s: AppState) => lh(lh(lh(s, '2026-09-10', 'negative'), '2026-09-12', 'faint'), '2026-09-14', 'negative')
  // N29: the no-surge card asks for more strips only from an owner who said '써요'.
  const s = setUsesLH(strips(confident()), true, OWNER)

  it('waits a week past the window with LH as the action, then moves on; a surge ends it; the sheet opens on LH meanwhile', () => {
    expect(noSurgeWait(s, '2026-09-01', '2026-09-15')).toBeUndefined()
    expect(noSurgeWait(s, '2026-09-01', '2026-09-16')).toEqual({ tests: 3, fertileEnd: '2026-09-15', until: '2026-09-22' })
    expect(noSurgeWait(s, '2026-09-01', '2026-09-22')).toBeDefined()
    expect(noSurgeWait(s, '2026-09-01', '2026-09-23')).toBeUndefined()
    const m = ttcMoment(s, '2026-09-16', OWNER)!
    expect(m.copy).toBe('owner.tww-no-surge')
    expect(m.primary).toMatchObject({ type: 'log', kind: 'lh' })
    expect(m.secondary).toMatchObject({ type: 'log', kind: 'ptest' })
    expect(m.eyebrow).toMatch(/LH 3회/)
    expect(ttcMoment(s, '2026-09-23', OWNER)?.copy).toBe('owner.tww')
    expect(defaultLogKind(s, '2026-09-16', '2026-09-16')).toBe('lh')
    expect(defaultLogKind(s, '2026-09-22', '2026-09-22')).toBe('lh')
    expect(defaultLogKind(s, '2026-09-23', '2026-09-23')).toBe('ptest')
    // A surge during the wait pins the cycle and ends it.
    const pinned = lh(s, '2026-09-17', 'positive')
    expect(noSurgeWait(pinned, '2026-09-01', '2026-09-18')).toBeUndefined()
    expect(cycleConfidence(pinned, '2026-09-18')).toBe('lh')
    expect(ttcMoment(pinned, '2026-09-18', OWNER)?.copy).not.toBe('owner.tww-no-surge')
    // Without strips there is nothing to wait for.
    expect(noSurgeWait(confident(), '2026-09-01', '2026-09-16')).toBeUndefined()
    expect(ttcMoment(confident(), '2026-09-16', OWNER)?.copy).toBe('owner.tww')
    // Strips logged without answering (or '나중에'): the wait is there, the card does not ask for more (N29).
    for (const answer of [undefined, 'later'] as const) {
      const quiet = setUsesLH(strips(confident()), answer, OWNER)
      expect(noSurgeWait(quiet, '2026-09-01', '2026-09-16')).toBeDefined()
      expect(ttcMoment(quiet, '2026-09-16', OWNER)?.copy).toBe('owner.tww')
      expect(logKind(ttcMoment(quiet, '2026-09-16', OWNER)?.primary)).not.toBe('lh')
    }
  })

  it('soft and calm owners, and the partner, never read LH; the history row says LH N회 · 양성 없음 once the cycle is over', () => {
    const soft = ttcMoment(withStyle(s, OWNER, 'soft'), '2026-09-16', OWNER)!
    expect(soft.copy).toBe('owner.tww-no-surge')
    expect(words(soft)).not.toMatch(FERTILE_WORDS)
    expect(soft.primary?.label).toBe('오늘 기록')
    // A calm owner keeps the plain waiting card (a test-day countdown is not window talk) — never the LH ask.
    const calm = ttcMoment(withStyle(s, OWNER, 'off'), '2026-09-16', OWNER)!
    expect(calm.copy).toBe('owner.tww')
    expect(words(calm)).not.toMatch(FERTILE_WORDS)
    expect(words(ttcMoment(s, '2026-09-16', PARTNER))).not.toMatch(/LH|양성/)
    const running = cycleHistory(s, '2026-09-16').rows[0]!
    expect(lhRowLine(running)).toBe('LH 3회')
    const finished = cycleHistory(logPeriodStart(s, '2026-09-29', OWNER, '2026-09-29'), '2026-09-30').rows[1]!
    expect(finished.start).toBe('2026-09-01')
    expect(lhRowLine(finished)).toBe('LH 3회 · 양성 없음')
    // '안 써요': the strips she logged are hers, but the card does not ask for more.
    const off = setUsesLH(s, false, OWNER)
    expect(ttcMoment(off, '2026-09-16', OWNER)?.copy).toBe('owner.tww')
    // No action at all on the early wait (N29: 오늘 컨디션 sits in 메모 › 자세히); the sheet still opens on 메모.
    expect(ttcMoment(off, '2026-09-16', OWNER)?.primary).toBeUndefined()
    expect(defaultLogKind(off, '2026-09-16', '2026-09-16')).toBe('note')
  })
})

// ── 6. Clinic mode pauses everything and is never ended by a period ──

describe('병원과 함께 준비 중 (clinic): never ended by a period, pauses every date on every screen', () => {
  // Trying since 2025-06 → the 🩺 months notice would be due without a clinic.
  const base = confident({ settings: { ...confident().settings, ttcStart: '2025-06-01' } })
  const clinic = startClinicMode(base, '2026-09-03')
  const DATE_KEY = /^(fertile|peak|period-due|late|late-test|doctor|amenorrhea):/

  it('a logged period (even a late one) never ends it; only the couple does — and the dates come back then', () => {
    expect(isClinicMode(clinic)).toBe(true)
    expect(activeRest(clinic)?.reason).toBe(CLINIC_REASON)
    let s = clinic
    for (const start of ['2026-09-29', '2026-10-27', '2026-12-10']) {
      s = logPeriodStart(s, start, OWNER, start)
      expect(isClinicMode(s)).toBe(true)
      expect(activeRest(s)?.reason).toBe(CLINIC_REASON)
      expect(ttcPhase(s, start)?.kind).toBe('rest')
    }
    // Late days read as the clinic card, never 늦었어요.
    for (const d of days('2026-09-02', '2026-11-05')) {
      const kind = ttcPhase(clinic, d)?.kind
      expect(kind).toBe('rest')
      expect(ttcMoment(clinic, d, OWNER)?.copy).toBe('owner.clinic')
      expect(ttcMoment(clinic, d, PARTNER)?.copy).toBe('partner.clinic')
    }
    expect(startClinicMode(startRestCycle(base, '2026-09-02'), '2026-09-03').restCycle).toEqual({ since: '2026-09-03', reason: 'clinic' })
    const vaccine = startRestCycle(base, '2026-09-02', 'vaccine')
    expect(endClinicMode(vaccine)).toBe(vaccine)
    const ended = endClinicMode(clinic)
    expect(activeRest(ended)).toBeUndefined()
    expect(scheduledNotices(ended, '2026-09-11').some((n) => n.key.startsWith('fertile:'))).toBe(true)
    expect(scheduledNotices(base, '2026-09-11').some((n) => n.kind === 'doctor')).toBe(true)
  })

  it('no date notice, no 🩺, no date ideas, no window on the ring, no projected period, no .ics, no LH ask, no DoctorCard — for both people, all cycle long', () => {
    for (const d of days('2026-09-02', '2026-11-05')) {
      expect(scheduledNotices(clinic, d).filter((n) => DATE_KEY.test(n.key))).toEqual([])
      for (const viewer of [OWNER, PARTNER]) {
        expect(fertileHintsAllowed(clinic, viewer)).toBe(false)
        const strip = cycleStrip(clinic, d, viewer)
        if (strip) {
          expect(strip.hasWindow).toBe(false)
          expect(strip.days.every((x) => x.tone === 'period' || x.tone === 'none')).toBe(true)
        }
        const lens = cycleLens(clinic, viewer)
        expect(lens.pause).toBe('clinic')
        const summary = cycleSummary(clinic, d, lens.view, lens)
        expect(summary.rows.map((r) => r.key)).toEqual(lens.details ? ['avg'] : [])
        expect(summary.headline.title).toBe(CLINIC_LABEL)
        expect(icsAvailability(clinic, d, clinic.settings, lens.view, lens.pause).enabled).toBe(false)
        expect(lensPhase(dayInfo(clinic, d, d).phase, lens)).not.toMatch(/peak|fertile|possible|period-predicted/)
      }
      expect(lhAskDue(clinic, d, null)).toBe(false)
      expect(defaultLogKind(clinic, d, d)).toBe('period')
      expect(doctorAdvice(clinic, d)).toBeNull()
    }
    expect(partnerTip(clinic, '2026-09-11', PARTNER)).toBe('결과를 묻지 말고, 병원 일정만 같이 챙겨요.')
    expect(monthlyTask(clinic, '2026-09-11', PARTNER)?.tip).toBe('결과를 묻지 말고, 병원 일정만 같이 챙겨요.')
    // The owner's card leads with the next appointment; the partner's names only his own or a
    // '둘이 함께' one, by a kind word — never her own, never a title (N32).
    const withVisit = addAppointment(clinic, { date: '2026-09-13', time: '08:00', title: '채혈·초음파', who: OWNER, kind: 'test' }, OWNER)
    expect(ttcMoment(withVisit, '2026-09-11', OWNER)?.title).toBe('9월 13일 08:00 채혈·초음파')
    const his = ttcMoment(withVisit, '2026-09-11', PARTNER)!
    expect(his.body).not.toMatch(/채혈|초음파|08:00/)
    expect(words(his)).not.toMatch(FERTILE_WORDS)
    const together = addAppointment(withVisit, { date: '2026-09-14', time: '10:00', title: '인공수정', who: 'both', kind: 'injection' }, OWNER)
    const both = ttcMoment(together, '2026-09-11', PARTNER)!
    expect(both.body).toContain('9월 14일 10:00 병원 일정 · 둘이 함께')
    expect(both.body).not.toMatch(/인공수정|채혈/)
  })

  it('survives a backup and a reload; an unknown reason is dropped, an ordinary rest kept', () => {
    expect(parseState(JSON.stringify(clinic))!.restCycle).toEqual({ since: '2026-09-03', reason: 'clinic' })
    const raw = JSON.parse(JSON.stringify(clinic))
    expect(sanitizeBackup({ ...raw, restCycle: { since: '2026-09-03', reason: 'surgery' } })!.restCycle).toBeUndefined()
    expect(sanitizeBackup({ ...raw, restCycle: { since: '2026-09-03', reason: 'rest' } })!.restCycle).toEqual({ since: '2026-09-03', reason: 'rest' })
  })
})

// ── 7. Privacy: the owner's private log never reaches the partner ──

describe("privacy property: personalLog and '나만 보기' never reach the partner — any lens, notice, export or shared state", () => {
  const TODAY = '2026-10-02'
  const PRIVATE_NOTE = 'SENTINEL_PRIVATE_지은의비밀줄'
  const PRIVATE_ENTRY = 'SENTINEL_DIARY_나만보는일기'
  const SHARED_ENTRY = 'SENTINEL_SHARED_같이보는일기'
  const FEEL_WORDS = [...new Set([...Object.values(FEEL_LABEL), ...FEEL_CHIPS.map((c) => c.label)])]

  function rich(): AppState {
    let s = createDemoState(TODAY, new Date('2026-10-02T09:00:00+09:00'), 'preparing')
    for (const d of days(addDays(TODAY, -40), addDays(TODAY, 20))) s = setFeel(s, OWNER, d, 'nausea')
    s = setPrivateNote(s, OWNER, TODAY, PRIVATE_NOTE)
    s = setPrivateNote(s, OWNER, addDays(TODAY, -10), PRIVATE_NOTE)
    s = addEntry(s, { id: 'private-1', date: TODAY, author: OWNER, text: PRIVATE_ENTRY }, `${TODAY}T10:00:00+09:00`)
    s = setEntryPrivacy(s, 'private-1', OWNER, true)
    s = addEntry(s, { id: 'shared-1', date: TODAY, author: OWNER, text: SHARED_ENTRY }, `${TODAY}T10:01:00+09:00`)
    return s
  }

  function leaks(text: string): string | null {
    if (text.includes(PRIVATE_NOTE)) return 'private note'
    if (text.includes(PRIVATE_ENTRY)) return 'private entry'
    for (const w of FEEL_WORDS) if (text.includes(w)) return `feel word ${w}`
    return null
  }

  it('is a real fixture: the owner sees her own log, chips and private entry', () => {
    const s = rich()
    expect(s.personalLog?.[OWNER]?.[TODAY]).toEqual({ feel: 'nausea', note: PRIVATE_NOTE })
    expect(visibleEntries(s.diary, OWNER).some((e) => e.text === PRIVATE_ENTRY)).toBe(true)
    const twwDay = [...days(addDays(TODAY, -20), addDays(TODAY, 20))].find((d) => ttcMoment(s, d, OWNER)?.kind === 'tww')
    expect(twwDay).toBeDefined()
    expect(ttcMoment(s, twwDay!, OWNER)?.todayFeel).toBe('nausea')
    const own = cycleFeels(s, OWNER, cycleHistory(s, TODAY).rows, TODAY)
    expect(Object.values(own).flat().some((d) => d.note === PRIVATE_NOTE)).toBe(true)
    expect(buildDiaryHtml({ entries: s.diary, viewer: OWNER, members: s.couple.members, title: 't', photos: {} })).toContain(PRIVATE_ENTRY)
  })

  it('for the partner × alert style × sharing × low-pressure × 40 days: moment, ring, 주기 summary, notices, tips, cover line, exports, shared state', () => {
    const s0 = rich()
    let checked = 0
    for (const style of ['explicit', 'soft', 'off'] as AlertStyle[]) {
      for (const shared of [false, true]) {
        for (const lowPressure of [false, true]) {
          const s = withPersonal(share(withStyle(s0, PARTNER, style), shared), PARTNER, lowPressure)
          const ctx = chapterContext(s)
          // What the other phone / a link / an export may hold at all.
          const his = stateForViewer(s, PARTNER)
          expect(his.personalLog?.[OWNER]).toBeUndefined()
          expect(leaks(JSON.stringify(his))).toBeNull()
          expect(his.diary.some((e) => e.text === SHARED_ENTRY)).toBe(true)
          const html = buildDiaryHtml({ entries: s.diary, viewer: PARTNER, members: s.couple.members, title: '우리', photos: {} })
          expect(leaks(html)).toBeNull()
          expect(html).toContain(SHARED_ENTRY)
          expect(leaks(JSON.stringify(filterStory(s.diary, ctx, { chapter: 'all', author: 'all', viewer: PARTNER })))).toBeNull()
          expect(leaks(JSON.stringify(filterEntries(s.diary, { stage: 'all', author: 'all', viewer: PARTNER })))).toBeNull()
          expect(leaks(JSON.stringify(albumGroups(s.diary, PARTNER)))).toBeNull()
          expect(leaks(JSON.stringify(visibleEntries(s.diary, PARTNER)))).toBeNull()
          for (const d of days(addDays(TODAY, -20), addDays(TODAY, 20))) {
            const texts = [
              words(ttcMoment(s, d, PARTNER)),
              JSON.stringify(cycleStrip(s, d, PARTNER)),
              JSON.stringify(cycleSummary(s, d, cycleLens(s, PARTNER).view, cycleLens(s, PARTNER))),
              JSON.stringify(scheduledNotices(s, d).filter((n) => n.to === PARTNER)),
              partnerTip(s, d, PARTNER) ?? '',
              JSON.stringify(monthlyTask(s, d, PARTNER)),
              heroLine(s, d, PARTNER, 9).text,
            ]
            for (const t of texts) {
              const why = leaks(t)
              if (why) throw new Error(`${why} leaked to the partner (${style}/${shared ? 'shared' : 'private'}/${lowPressure ? 'calm' : 'normal'}) on ${d}: ${t.slice(0, 120)}`)
            }
            checked++
          }
        }
      }
    }
    expect(checked).toBe(3 * 2 * 2 * 41)
  })

  it('soft / off / low-pressure viewers never read 가임기·배란·LH on the home, the ring or in a notice — owner included', () => {
    const s0 = rich()
    for (const viewer of [OWNER, PARTNER]) {
      for (const style of ['soft', 'off'] as AlertStyle[]) {
        for (const lowPressure of [false, true]) {
          for (const shared of [false, true]) {
            const s = withPersonal(share(withStyle(s0, viewer, style), shared), viewer, lowPressure)
            for (const d of days(addDays(TODAY, -20), addDays(TODAY, 20))) {
              expect(words(ttcMoment(s, d, viewer))).not.toMatch(FERTILE_WORDS)
              const strip = cycleStrip(s, d, viewer)
              expect(`${strip?.windowLabel ?? ''} ${strip?.peakLabel ?? ''}`).not.toMatch(FERTILE_WORDS)
              expect(strip?.days.some((x) => x.lh) ?? false).toBe(false)
              for (const n of scheduledNotices(s, d)) if (n.to === viewer) expect(`${n.title} ${n.body}`).not.toMatch(FERTILE_WORDS)
            }
          }
        }
      }
    }
  })

  it('a partner without shared details gets no period, LH or test notice and no 생리 on his card unless she told him', () => {
    const s = rich()
    for (const d of days(addDays(TODAY, -20), addDays(TODAY, 20))) {
      for (const n of scheduledNotices(s, d)) {
        if (n.to !== PARTNER) continue
        expect(['period-due', 'peak']).not.toContain(n.kind)
        expect(n.key).not.toMatch(/^(late|late-test|amenorrhea):/)
      }
      const m = ttcMoment(s, d, PARTNER)!
      if (m.copy !== 'partner.period-told') expect(words(m)).not.toMatch(/생리|LH|임테기|테스트/)
    }
  })
})

// ── 8. LH slots: fill, replace only when agreed, undo ───────

describe('LH slots: a past day fills 아침 then 저녁, never silently replaces, and undo is exact', () => {
  const TODAY = '2026-09-20'
  const base = confident()

  it('two slot entries on one past day both stay; the third is refused until agreed, then replaces exactly one', () => {
    let s = addLHTest(base, { date: '2026-09-12', slot: 'morning', result: 'negative', by: OWNER }, TODAY)
    s = addLHTest(s, { date: '2026-09-12', slot: 'evening', result: 'faint', by: OWNER }, TODAY)
    expect(lhTestsOn(s.lhTests, '2026-09-12').map(lhKey)).toEqual(['morning', 'evening'])
    const third: LHInput = { date: '2026-09-12', slot: 'evening', result: 'positive', by: OWNER }
    expect(planLHTest(lhTestsOn(s.lhTests, '2026-09-12'), third).action).toBe('replace')
    expect(addLHTest(s, third, TODAY)).toBe(s)
    const before = logUndo(s, { kind: 'lh', date: '2026-09-12' })
    const replaced = addLHTest(s, third, TODAY, { replace: true })
    expect(lhTestsOn(replaced.lhTests, '2026-09-12').map((t) => [lhKey(t), t.result])).toEqual([['morning', 'negative'], ['evening', 'positive']])
    expect(undoLog(replaced, before).lhTests).toEqual(s.lhTests)
    expect(removeLHTest(replaced, '2026-09-12', 'evening').lhTests.map(lhKey)).toEqual(['morning'])
    expect(parseState(JSON.stringify(replaced))!.lhTests).toEqual(replaced.lhTests)
    const bogus = JSON.parse(JSON.stringify(replaced))
    bogus.lhTests[0].slot = 'noon'
    expect(sanitizeBackup(bogus)!.lhTests.some((t) => (t as { slot?: string }).slot === 'noon')).toBe(false)
  })

  it('fuzz: 300 random logs never exceed two a day and never drop a test without agreement; agreed replacements change exactly one', () => {
    let seed = 20261002
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x1_0000_0000
    }
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!
    const DATES: ISODate[] = ['2026-09-10', '2026-09-11', '2026-09-12', TODAY]
    const RESULTS: LHResult[] = ['negative', 'faint', 'positive', 'peak']
    const SLOTS: Array<LHSlot | undefined> = ['morning', 'evening', undefined]
    const TIMES = ['07:30', '08:10', '13:00', '21:45', undefined]
    const sig = (s: AppState) => new Set(s.lhTests.map((t) => `${t.date}|${lhKey(t)}|${t.result}`))
    let s = base
    let replaced = 0
    for (let i = 0; i < 300; i++) {
      const date = pick(DATES)
      const input: LHInput = { date, result: pick(RESULTS), by: OWNER, ...(date === TODAY ? { time: pick(TIMES) } : { slot: pick(SLOTS) }) }
      const day = lhTestsOn(s.lhTests, date)
      const plan = planLHTest(day, input)
      const quiet = addLHTest(s, input, TODAY)
      if (plan.action === 'replace') {
        expect(quiet).toBe(s)
      } else {
        expect(quiet.lhTests.length).toBe(s.lhTests.length + 1)
        for (const k of sig(s)) expect(sig(quiet).has(k)).toBe(true)
      }
      const agreed = addLHTest(s, input, TODAY, { replace: true })
      if (plan.action === 'replace') {
        expect(agreed.lhTests.length).toBe(s.lhTests.length)
        const gone = [...sig(s)].filter((k) => !sig(agreed).has(k))
        expect(gone.length).toBeLessThanOrEqual(1)
        replaced++
      }
      s = agreed
      for (const d of DATES) expect(lhTestsOn(s.lhTests, d).length).toBeLessThanOrEqual(2)
      const keys = lhTestsOn(s.lhTests, date).map(lhKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(replaced).toBeGreaterThan(50)
    expect(addLHTest(s, { date: addDays(TODAY, 1), result: 'peak', by: OWNER }, TODAY)).toBe(s)
  })
})

// ── 9. usesLH = false never puts LH first ───────────────────

describe("'안 써요' (settings.usesLH = false): never an LH title, action or prompt; only '써요' puts LH first on the card (N29)", () => {
  it('through a whole cycle, for the explicit and the soft owner', () => {
    const off = setUsesLH(confident(), false, OWNER)
    expect(lhPrompting(off)).toBe(false)
    expect(lhPrompting(setUsesLH(confident(), 'later', OWNER))).toBe(true)
    expect(lhPrompting(confident())).toBe(true)
    // Only the owner's answer counts.
    const c = confident()
    expect(setUsesLH(c, false, PARTNER)).toBe(c)
    let feelDays = 0
    for (const style of ['explicit', 'soft'] as AlertStyle[]) {
      const s = withStyle(off, OWNER, style)
      let lhDaysOn = 0
      for (const d of days('2026-09-02', '2026-10-05')) {
        const m = ttcMoment(s, d, OWNER)!
        expect(logKind(m.primary)).not.toBe('lh')
        expect(logKind(m.secondary)).not.toBe('lh')
        expect(m.copy).not.toMatch(/lh-start|no-surge/)
        expect(m.title).not.toMatch(/LH/)
        if (logKind(m.primary) === 'note') feelDays++
        if (style === 'explicit' && (m.kind === 'before-fertile' || m.kind === 'fertile')) expect(m.body).toMatch(/달력 기준 예상/)
        expect(defaultLogKind(s, d, d)).not.toBe('lh')
        expect(lhAskDue(s, d, null)).toBe(false)
        for (const n of scheduledNotices(s, d)) expect(n.body).not.toMatch(/LH/)
        if (logKind(ttcMoment(withStyle(setUsesLH(confident(), true, OWNER), OWNER, style), d, OWNER)?.primary) === 'lh') lhDaysOn++
        // Unanswered and '나중에' never put LH first on the card either (N29: '써요' only).
        for (const answer of [undefined, 'later'] as const)
          expect(logKind(ttcMoment(withStyle(setUsesLH(confident(), answer, OWNER), OWNER, style), d, OWNER)?.primary)).not.toBe('lh')
      }
      expect(lhDaysOn).toBeGreaterThan(5) // the same days do put LH first for an owner who said '써요'
    }
    // 오늘 컨디션 is never the card's action since N29 (it sits in 메모 › 자세히).
    expect(feelDays).toBe(0)
    // Strips she logs anyway stay hers (the panel is her tool) and still pin the cycle.
    const pinned = lh(off, '2026-09-13', 'positive')
    expect(cycleConfidence(pinned, '2026-09-14')).toBe('lh')
    expect(logKind(ttcMoment(pinned, '2026-09-14', OWNER)?.primary)).not.toBe('lh')
  })
})

// ── 10. Full backup (.zip) round trip with every Now 2 field ──

describe('full backup: every Now 2 field round-trips through the .zip and the .json path', () => {
  function everything(): AppState {
    let s = confident({ cycle: { cycleLength: 28, periodLength: 5, longCycles: true } })
    s = setUsesLH(s, 'later', OWNER)
    s = setFeel(s, OWNER, '2026-09-20', 'tired')
    s = setPrivateNote(s, OWNER, '2026-09-20', '비밀')
    s = addLHTest(s, { date: '2026-09-12', slot: 'evening', result: 'faint', by: OWNER }, '2026-09-20')
    s = markStillWaiting(s, '2026-09-01', '2026-10-16')
    s = addEntry(s, { id: 'e1', date: '2026-09-20', author: OWNER, text: '사진', photoId: 'p1' }, `${NOW}`)
    s = setEntryPrivacy(s, 'e1', OWNER, true)
    s = addCustomTask(s, { title: '결정통지서 만료', phase: 'preconception', who: 'both', due: '2026-11-30', deadlineAlerts: true }, OWNER)
    s = addCustomTask(s, { title: '장보기', phase: 'preconception', who: OWNER, deadlineAlerts: true }, OWNER) // no due → no alerts
    s = startClinicMode(s, '2026-09-21')
    return s
  }

  it('is canonical (parseState is the identity on it) and comes back whole with its photo', async () => {
    const s = everything()
    expect(s.customTasks.map((c) => c.deadlineAlerts)).toEqual([true, undefined])
    expect(setCustomTaskDeadlineAlerts(s, s.customTasks[1]!.id, true)).toBe(s) // needs a due date
    expect(setCustomTaskDeadlineAlerts(s, s.customTasks[0]!.id, false).customTasks[0]!.deadlineAlerts).toBeUndefined()
    expect(parseState(JSON.stringify(s))).toEqual(s)
    const photo = { id: 'p1', type: 'image/jpeg', data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) }
    const zip = buildFullBackup(s, [photo, { id: 'orphan', type: 'image/png', data: new Uint8Array([1]) }], new Date(2026, 9, 2, 9))
    const parsed = parseFullBackup(zip)
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.photos.map((p) => p.id)).toEqual(['p1'])
    expect(parseState(parsed.stateJson)).toEqual(s)
    const back = await readAnyBackup(new Blob([zip as BlobPart]))
    if ('error' in back) throw new Error(back.error)
    expect(back.kind).toBe('zip')
    expect(back.state).toEqual(s)
    expect(back.photos[0]?.data).toEqual(photo.data)
    const json = await readAnyBackup(new Blob([JSON.stringify(s)]))
    if ('error' in json) throw new Error(json.error)
    expect(json).toMatchObject({ kind: 'json', photos: [] })
    expect(json.state).toEqual(s)
    // One flipped byte inside the record's data (past the 30-byte header and the 18-byte name): refused whole, never half a diary.
    const broken = new Uint8Array(zip)
    broken[60] = broken[60]! ^ 0xff
    expect(await readAnyBackup(new Blob([broken as BlobPart]))).toEqual({ error: 'invalid' })
  })
})

// ── 11. Partner chain per person ────────────────────────────

describe('the 가임력 검사 chain is per person: her application never moves his card', () => {
  const TODAY = '2026-09-28'
  const s0 = fresh()

  it('apply → test → claim under each person’s own keys; the shared row only once both applied', () => {
    const hers = setFertilityApplied(s0, OWNER, true, '2026-09-20')
    expect(appliedMembers(hers.planDone)).toEqual([OWNER])
    expect(hers.planDone[FERTILITY_APPLY_ID]).toBeUndefined()
    expect(fertilityChain(hers, TODAY, PARTNER).step).toBe('apply')
    expect(monthlyTask(hers, TODAY, PARTNER)?.step).toBe('apply')
    const both = setFertilityApplied(hers, PARTNER, true, '2026-09-25')
    expect(both.planDone[FERTILITY_APPLY_ID]).toEqual({ at: '2026-09-25', by: PARTNER })
    expect(fertilityChain(both, TODAY, PARTNER)).toMatchObject({ step: 'test', appliedAt: '2026-09-25', testBy: monthsEnd('2026-09-25', 3) })
    expect(fertilityChain(both, TODAY, OWNER)).toMatchObject({ step: 'test', appliedAt: '2026-09-20' })
    // Undoing hers keeps his.
    const undone = setFertilityApplied(both, OWNER, false, TODAY)
    expect(undone.planDone[FERTILITY_APPLY_ID]).toBeUndefined()
    expect(fertilityChain(undone, TODAY, PARTNER).step).toBe('test')
    expect(fertilityChain(undone, TODAY, OWNER).step).toBe('apply')
    // The test is dated the day it happened, and the claim deadline counts from it.
    const task = monthlyTask(both, TODAY, PARTNER)!
    expect(task.step).toBe('test')
    const tested = completeMonthlyTask(both, task, '2026-10-14', PARTNER)
    expect(tested.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-10-14', by: PARTNER })
    expect(fertilityChain(tested, '2026-10-20', PARTNER)).toMatchObject({ step: 'claim', claimBy: monthsEnd('2026-10-14', 1) })
    expect(tested.planDone[FERTILITY_CARRIER_TEST_ID]).toBeUndefined()
    const claimed = setFertilityClaimed(tested, true, '2026-10-20', PARTNER)
    expect(claimed.planDone[chainKey(FERTILITY_CLAIM_ID, PARTNER)]).toEqual({ at: '2026-10-20', by: PARTNER })
    expect(claimInfo(claimed, OWNER)).toBeUndefined()
    expect(fertilityChain(claimed, '2026-10-21', PARTNER).step).toBe('done')
    // An older, unsuffixed claim mark belongs to whoever made it (else the partner).
    const legacy = { ...s0, planDone: { [FERTILITY_CLAIM_ID]: { at: '2026-09-01' } } }
    expect(claimInfo(legacy, PARTNER)).toEqual({ at: '2026-09-01' })
    expect(claimInfo(legacy, OWNER)).toBeUndefined()
    expect(CHECKUP_ITEM_IDS).toEqual([FERTILITY_TEST_ID, FERTILITY_CARRIER_TEST_ID])
  })

  it('both 임신 전 검사 rows ticked: the 🩺 months card and notice are answered; age stays', () => {
    const long = fresh({ settings: { ...s0.settings, ttcStart: '2025-06-01' } })
    expect(doctorAdvice(long, TODAY)?.reasons).toEqual(['months'])
    expect(scheduledNotices(long, TODAY).filter((n) => n.kind === 'doctor')).toHaveLength(2)
    const one = tickItem(FERTILITY_TEST_ID, true, '2026-09-10', PARTNER)(long)
    expect(checkupsDone(one)).toBe(false)
    expect(doctorAdvice(one, TODAY)?.reasons).toEqual(['months'])
    const both = tickItem(FERTILITY_CARRIER_TEST_ID, true, '2026-09-12', OWNER)(one)
    expect(checkupsDone(both)).toBe(true)
    expect(doctorAdvice(both, TODAY)).toBeNull()
    expect(scheduledNotices(both, TODAY).filter((n) => n.kind === 'doctor')).toEqual([])
    // 40+ is about starting early, not about the two checks.
    const forty = { ...both, couple: { ...both.couple, members: [both.couple.members[0], { ...both.couple.members[1], birthYear: 1985 }] as AppState['couple']['members'] } }
    expect(doctorAdvice(forty, TODAY)?.reasons).toEqual(['age'])
  })
})

// ── 12. Onboarding defaults ─────────────────────────────────

describe('onboarding (N15): earlier starts, the partner’s defaults and first run', () => {
  it('property: periodStartsFrom is strictly increasing, ≥ 15 days apart, within two years, ending on the last start', () => {
    let seed = 7
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x1_0000_0000
    }
    const today = '2026-10-02'
    const last = '2026-09-20'
    for (let i = 0; i < 200; i++) {
      const list: ISODate[] = []
      for (let k = 0; k < Math.floor(rnd() * 12); k++) list.push(addDays(last, -Math.floor(rnd() * 800) + 5))
      const starts = periodStartsFrom(last, list, today)
      expect(starts[starts.length - 1]).toBe(last)
      expect(starts.length).toBeLessThanOrEqual(7)
      for (let j = 1; j < starts.length; j++) expect(diffDays(starts[j - 1]!, starts[j]!)).toBeGreaterThanOrEqual(15)
      for (const d of starts) {
        expect(d <= last).toBe(true)
        expect(diffDays(d, today)).toBeLessThanOrEqual(730)
      }
      const s = applyOnboardingCycle(createInitialState({ me: { name: '지', role: 'wife' }, partner: { name: '민', role: 'husband' }, cycleOwner: 'a', lastPeriodStart: last }, new Date('2026-10-02T09:00:00+09:00')), { pastStarts: list }, today)
      expect(s.periods.map((p) => p.start)).toEqual(starts)
      expect(s.periods.slice(0, -1).every((p) => p.by === 'a')).toBe(true)
    }
  })

  it('the non-owner starts with 걷기 30분 and 은근하게 only; the sheet asks them once and never again', () => {
    const s = applyPartnerDefaults(fresh(), '2026-09-01')
    expect(s.checkItems.filter((i) => i.owner === PARTNER).map((i) => i.label)).toEqual(['걷기 30분'])
    expect(s.checkItems.filter((i) => i.owner === OWNER).map((i) => i.label)).toEqual(['엽산'])
    expect(s.settings.alertStyle[PARTNER]).toBe('soft')
    expect(JOINING_MEMBER).toBe('b')
    const joining = applyPartnerDefaults(createInitialState({ me: { name: '지은', role: 'wife' }, partner: { name: '민수', role: 'husband' }, cycleOwner: 'a' }, new Date(2026, 8, 1, 9)), '2026-09-01')
    expect(joining.checkItems.filter((i) => i.owner === 'b').map((i) => i.label)).toEqual(['걷기 30분'])
    expect(needsPartnerFirstRun(joining, 'b')).toBe(true)
    expect(needsPartnerFirstRun(joining, 'a')).toBe(false)
    const done = completePartnerFirstRun(joining, 'b', { habits: { smokes: true, drinks: 'often', exercises: true, takesSupplements: false }, alertStyle: 'explicit' }, '2026-09-01', NOW)
    expect(needsPartnerFirstRun(done, 'b')).toBe(false)
    expect(done.couple.linkedAt).toBe(NOW)
    expect(done.checkItems.filter((i) => i.owner === 'b').map((i) => i.label)).toEqual(['운동 30분', '금연', '금주', '사우나·뜨거운 탕 쉬기'])
    expect(done.settings.alertStyle.b).toBe('explicit')
    // The demo already has linkedAt → no sheet there.
    expect(needsPartnerFirstRun(createDemoState('2026-10-02', new Date('2026-10-02T09:00:00+09:00'), 'preparing'), 'b')).toBe(false)
  })
})

// ── 13. Old data loads unchanged ────────────────────────────

describe('old data (before Now 2) loads byte-for-byte; every demo state is canonical', () => {
  it('a save without any Now 2 field — legacy rest, untimed LH, plain diary, 45-day cycle — is the identity through parseState', () => {
    let old = fresh({ cycle: { cycleLength: 45, periodLength: 5 } })
    old = { ...old, restCycle: { since: '2026-09-02', reason: 'rest' } }
    old = { ...old, lhTests: [{ date: '2026-09-12', result: 'positive' }, { date: '2026-09-13', result: 'peak', time: '08:00', by: OWNER }] }
    old = addEntry(old, { id: 'd1', date: '2026-09-02', author: PARTNER, text: '옛날 일기' }, NOW)
    old = addCustomTask(old, { title: '장보기', phase: 'preconception', who: OWNER, due: '2026-09-10' }, OWNER)
    const json = JSON.stringify(old)
    expect(json).not.toMatch(/personalLog|cycleNotes|usesLH|longCycles|privateTo|deadlineAlerts|slot/)
    const loaded = parseState(json)!
    expect(loaded).toEqual(old)
    expect(JSON.stringify(loaded)).toBe(json)
    expect(parseState(JSON.stringify(loaded))).toEqual(loaded)
    // Its screens read it as before: a 45-day settings cycle, the rest still on.
    expect(cycleStats(loaded.periods, loaded.cycle).average).toBe(45)
    expect(activeRest(loaded)?.reason).toBe('rest')
  })

  it('every demo stage survives parseState unchanged', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      const demo = createDemoState('2026-10-02', new Date('2026-10-02T09:00:00+09:00'), stage)
      expect(parseState(JSON.stringify(demo))).toEqual(demo)
    }
  })
})
