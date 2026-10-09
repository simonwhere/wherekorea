// N19 ① — 'a change of his screen is information too' (docs/positioning.md §4,
// 남편 루프의 규칙 #1). PROPERTY: for a partner without her details ('우리의 주간'
// or '날짜 없음' sharing), whatever his own alert style and 부담 없이 choice,
// everything his phone shows for a day — the home card, the week row, the
// cover line, the notices due that day, '오늘 해 줄 수 있는 것', whether his
// month task shows, the 준비 일기 prompt, and the 주기 tab (lens, summary card,
// calendar days, legend) — is IDENTICAL between a state and the same state
// plus any record she did not tell him about: an untold period start (on the
// day, or logged a day late), its end, LH strips, a negative / faint / positive
// test, bleeding after it, her 오늘 컨디션, a 나만 보기 note or diary entry, a
// rest she starts, '아직 안 왔어요', 관계일, '알릴까요? — 괜찮아요', '배테기
// 안 써요'. And the day-before / day-of check: across days on which the shared
// window is off on both, his screen does not change — a late period, a period
// that comes, a test, are invisible on the day they happen.
//
// The only things allowed to change his screen are what she TOLD ([알리기]),
// her signals, the shared start of '곧 우리의 주간' / the window itself,
// his own actions, and the quiet after a pregnancy ended (a stage change both
// phones show). Residuals are pinned below as explicit, documented cases
// (lib/logic/cycleRing.ts, 'Residuals').
//
// Now 3 leftovers: once his span has started it runs to its predicted last
// day — a period, a rest or a positive test she logs inside it and does not
// tell does not cut it short; and an untold EARLY period does not pull the
// next '곧 우리의 주간' forward on any later day (his next window stays where
// his view expected it).

import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, diffDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { cellView, cycleLens, cycleSummary, legendItems, monthConfidence, type Lens } from '@/lib/logic/calendarView'
import { startClinicMode } from '@/lib/logic/clinic'
import { heroLine } from '@/lib/logic/cover'
import { dayInfo, fertilityStatus, setPeriodEnd, type CycleInput } from '@/lib/logic/cycle'
import { SHARED_QUIET_DAYS, sharedWeek } from '@/lib/logic/cycleRing'
import { addEntry } from '@/lib/logic/diary'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { logPeriodStart } from '@/lib/logic/logs'
import { scheduledNotices } from '@/lib/logic/notifications'
import { myPrep } from '@/lib/logic/myPrep'
import { linkClinic } from '@/lib/logic/partnerSnapshot'
import { partnerTip } from '@/lib/logic/partnerTrack'
import { setEntryPrivacy, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { setPersonalPref, setShareLevel, setUsesLH } from '@/lib/logic/prefs'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import {
  PERIOD_EARLY_DAYS,
  cycleStrip,
  homeDiaryPrompt,
  markStillWaiting,
  partnerQuiet,
  partnerTaskVisible,
  skipTellPartnerPeriod,
  tellPartnerBleeding,
  tellPartnerPeriod,
  tellPartnerPositive,
  ttcMoment,
} from '@/lib/logic/ttcFlow'
import type { AlertStyle, AppState, ISODate, PeriodLog, ShareLevel } from '@/lib/types'

// Long synchronous property walks back to back keep the vitest worker from
// answering its runner (a 60 s RPC timeout → 'Timeout calling onTaskUpdate',
// exit 1 with every test green). One macrotask between tests lets it breathe.
beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)))

const OWNER = 'b' as const
const PARTNER = 'a' as const
const stamp = (d: ISODate) => `${d}T21:00:00+09:00`

function couple(periods: PeriodLog[], over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: periods[periods.length - 1]?.start ?? '2026-09-01',
      ttcStart: '2026-08-01',
    },
    new Date(2026, 7, 1, 9, 0),
  )
  return { ...s, periods, ...over }
}

function withMemories(s: AppState): AppState {
  let out: AppState = { ...s, settings: { ...s.settings, memories: true } }
  for (let d = '2025-08-20'; d <= '2025-10-31'; d = addDays(d, 1)) {
    out = addEntry(out, { id: `m-${d}`, date: d, author: PARTNER, text: '같이 산책했어요' }, `${d}T20:00:00+09:00`)
  }
  return out
}

const starts = (first: ISODate, lengths: number[]): PeriodLog[] => {
  const out: PeriodLog[] = [{ start: first }]
  for (const n of lengths) out.push({ start: addDays(out[out.length - 1]!.start, n) })
  return out
}

/** Couples whose cycles differ in every way the estimate cares about. */
/** `from`: where the every-third-day sweep starts — staggered, so together they hit every phase. */
const BASES: ReadonlyArray<{ name: string; state: AppState; from?: ISODate }> = [
  { name: 'regular 28', state: couple(starts('2026-06-09', [28, 28, 28])) },
  { name: 'short 23', from: '2026-08-27', state: couple(starts('2026-06-20', [23, 23, 23, 23]), { cycle: { cycleLength: 23, periodLength: 5 } as AppState['cycle'] }) },
  { name: 'long 34', from: '2026-08-28', state: couple(starts('2026-05-20', [34, 34, 34]), { cycle: { cycleLength: 34, periodLength: 5 } as AppState['cycle'] }) },
  { name: 'one record', state: couple([{ start: '2026-09-01' }]) },
  // 'N년 전 오늘' on, with a shared diary line for every day a year ago: the cover line's own day gates are in play.
  { name: 'irregular', from: '2026-08-27', state: withMemories(couple(starts('2026-05-02', [26, 33, 29, 31]))) },
  {
    name: 'LH user',
    from: '2026-08-28',
    state: couple(starts('2026-06-09', [28, 28, 28]), {
      lhTests: [
        { date: '2026-09-09', result: 'negative' },
        { date: '2026-09-11', result: 'positive' },
        { date: '2026-09-12', result: 'peak' },
      ],
    }),
  },
  { name: 'no records', state: couple([]) },
]

/** The lenses a partner may read through without her details. */
const LENSES: ReadonlyArray<{ share: ShareLevel; style: AlertStyle; lowPressure?: boolean; homeDiscreet?: boolean }> = [
  { share: 'week', style: 'soft' },
  { share: 'week', style: 'explicit' },
  { share: 'week', style: 'off' },
  { share: 'week', style: 'soft', lowPressure: true },
  { share: 'week', style: 'soft', homeDiscreet: true },
  { share: 'none', style: 'soft' },
  { share: 'none', style: 'explicit' },
]

function withLens(s: AppState, l: (typeof LENSES)[number]): AppState {
  let out = setShareLevel(s, OWNER, l.share)
  out = { ...out, settings: { ...out.settings, alertStyle: { ...out.settings.alertStyle, [PARTNER]: l.style } } }
  out = setPersonalPref(out, PARTNER, 'lowPressure', !!l.lowPressure)
  out = setPersonalPref(out, PARTNER, 'homeDiscreet', !!l.homeDiscreet)
  return out
}

const lensTag = (l: (typeof LENSES)[number]) => `${l.share}/${l.style}${l.lowPressure ? '/lp' : ''}${l.homeDiscreet ? '/veil' : ''}`

/** The home, the cover, his notices and his task for `d`, as data. */
function homeView(s: AppState, d: ISODate) {
  const m = ttcMoment(s, d, PARTNER)
  // `kind` is the day's internal phase (the screens branch on it for her, never render it for him).
  const moment = m ? (({ kind: _kind, ...rest }) => rest)(m) : null
  const notices = scheduledNotices(s, d)
    .filter((n) => n.to === PARTNER)
    .map((n) => ({ key: n.key, kind: n.kind, title: n.title, body: n.body }))
  return {
    moment,
    strip: cycleStrip(s, d, PARTNER),
    cover: heroLine(s, d, PARTNER, 9),
    notices,
    tip: partnerTip(s, d, PARTNER),
    task: partnerTaskVisible(s, d, PARTNER),
    prompt: homeDiaryPrompt(s, d, PARTNER),
    // N30 / N32 (Now 3b): his 내 준비 bar and the clinic week beside his card — his own records and the couple's mode only.
    prep: myPrep(s, d, PARTNER),
    clinic: linkClinic(s, d, PARTNER) ?? null,
  }
}

/** Everything the partner's phone shows for `d`, as data: the home and the 주기 tab. */
function partnerView(s: AppState, d: ISODate) {
  const view = homeView(s, d)
  // The 주기 tab as CycleTab reads it (the lens gets the cycle and the pregnancy record).
  const lens: Lens = cycleLens(s, PARTNER, d)
  const input: CycleInput = { periods: s.periods, lhTests: s.lhTests, cycle: s.cycle, pregnancy: s.pregnancy, cycleNotes: s.cycleNotes }
  const summary = cycleSummary(input, d, lens.view, lens)
  const cells = Array.from({ length: 14 }, (_, i) => addDays(d, i - 3)).map((date) =>
    cellView(dayInfo(input, date, d), { month: `${d.slice(0, 7)}-01`, today: d, view: lens.view, lens }),
  )
  return {
    ...view,
    lens: { view: lens.view, details: lens.details, band: lens.band, pause: lens.pause, pendingSince: lens.pendingSince, rest: lens.rest },
    summary: { headline: summary.headline, rows: summary.rows, status: summary.status, cycleDay: summary.cycleDay },
    cells: cells.map((c) => [c.phase, c.star, c.lh ?? '', c.ptest ?? '', c.ariaLabel]),
    legend: legendItems(lens.view, lens, { confidence: monthConfidence(cells) }),
  }
}

/**
 * What the screen shows that does not simply follow the date: the tip and the
 * 준비 일기 prompt rotate by the date alone, a memory line points at the entry
 * of a year ago today, and the calendar's today ring and labels move with it —
 * the rest must hold still.
 */
function stable(v: ReturnType<typeof homeView> & { cells?: unknown[][] }) {
  const { tip: _tip, prompt: _prompt, cells, cover, ...rest } = v
  // A memory line points at that day's entry (a year ago today): the kind and words must hold, not the entry.
  return { ...rest, cover: { kind: cover.kind, text: cover.text }, cells: (cells ?? []).map((c) => c.slice(0, 4)) }
}

function herStatus(s: AppState, d: ISODate) {
  return fertilityStatus(s, d)
}

/** The day is near or past her expected period (a period or a test is plausible then). */
function nearDue(s: AppState, d: ISODate): boolean {
  const st = herStatus(s, d)
  return (st.kind === 'after-fertile' && st.daysUntilPeriod <= 3) || st.kind === 'late'
}

const lastStart = (s: AppState, d: ISODate) => [...s.periods].map((p) => p.start).filter((x) => x <= d).sort().pop()

type Record = { name: string; when: (s: AppState, d: ISODate) => boolean; add: (s: AppState, d: ISODate) => AppState }

/** Records she did not tell him about. `when` keeps each one where it can really happen. */
const UNTOLD: readonly Record[] = [
  { name: 'period start (today)', when: nearDue, add: (s, d) => logPeriodStart(s, d, OWNER, d) },
  { name: 'period start (logged a day late)', when: (s, d) => nearDue(s, addDays(d, -1)), add: (s, d) => logPeriodStart(s, addDays(d, -1), OWNER, d) },
  {
    name: 'period end',
    when: (s, d) => herStatus(s, d).kind === 'period',
    add: (s, d) => setPeriodEnd(s, lastStart(s, d)!, d),
  },
  {
    name: 'LH surge',
    when: () => true,
    add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: addDays(d, -1), result: 'faint' as const }, { date: d, result: 'positive' as const }] }),
  },
  { name: 'LH peak', when: () => true, add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: d, result: 'peak' as const }] }) },
  { name: 'LH negative', when: () => true, add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: d, result: 'negative' as const }] }) },
  {
    name: 'negative test',
    when: () => true,
    add: (s, d) => ({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `neg-${d}`, date: d, result: 'negative' as const, by: OWNER }] }),
  },
  {
    name: 'faint test',
    when: () => true,
    add: (s, d) => ({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `faint-${d}`, date: d, result: 'faint' as const, by: OWNER }] }),
  },
  {
    name: 'positive test (untold)',
    when: nearDue,
    add: (s, d) =>
      markPositivePending({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `pos-${d}`, date: d, result: 'positive' as const, by: OWNER }] }, d, `pos-${d}`),
  },
  {
    name: 'bleeding after an untold positive',
    when: (s, d) => nearDue(s, addDays(d, -2)),
    add: (s, d) => markBleeding(markPositivePending(s, addDays(d, -2)), d),
  },
  { name: '오늘 컨디션', when: () => true, add: (s, d) => setFeel(s, OWNER, d, 'tired') },
  { name: '나만 보기 note', when: () => true, add: (s, d) => setPrivateNote(s, OWNER, d, '오늘은 혼자 생각하고 싶어요') },
  {
    name: '나만 보기 diary entry',
    when: () => true,
    add: (s, d) => {
      const w = addEntry(s, { id: `secret-${d}`, date: d, author: OWNER, text: '혼자만 볼 이야기' }, stamp(d))
      return setEntryPrivacy(w, `secret-${d}`, OWNER, true)
    },
  },
  // A rest she starts, inside his span or outside it (from today: a backdated one is a documented residual).
  { name: 'rest', when: () => true, add: (s, d) => startRestCycle(s, d, 'rest') },
  { name: 'vaccine rest (from today)', when: () => true, add: (s, d) => startRestCycle(s, d, 'vaccine') },
  { name: 'vaccine rest', when: (s, d) => !sharedWeek(s, d), add: (s, d) => startRestCycle(s, addDays(d, -3), 'vaccine') },
  // Inside his span (Now 3 leftover): a period or a positive test she does not tell keeps it to its last day.
  { name: 'period start inside the span', when: (s, d) => !!sharedWeek(s, d), add: (s, d) => logPeriodStart(s, d, OWNER, d) },
  {
    name: 'positive test inside the span',
    when: (s, d) => !!sharedWeek(s, d),
    add: (s, d) =>
      markPositivePending({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `in-${d}`, date: d, result: 'positive' as const, by: OWNER }] }, d, `in-${d}`),
  },
  // An early period (any day after the window, before the expected day) — the day itself; later days below.
  {
    name: 'early period start',
    when: (s, d) => herStatus(s, d).kind === 'after-fertile',
    add: (s, d) => logPeriodStart(s, d, OWNER, d),
  },
  {
    name: '아직 안 왔어요',
    when: (s, d) => {
      const st = herStatus(s, d)
      return st.kind === 'late' && st.daysLate > 14
    },
    add: (s, d) => markStillWaiting(s, lastStart(s, d)!, d),
  },
  {
    name: '관계일',
    when: () => true,
    add: (s, d) => toggleIntimacyDay(giveIntimacyConsent(s, OWNER, d), OWNER, d, d),
  },
  {
    name: '알릴까요? — 괜찮아요',
    when: (s, d) => herStatus(s, d).kind === 'period',
    add: (s, d) => skipTellPartnerPeriod(s, lastStart(s, d)!, stamp(d)),
  },
  { name: '배테기 안 써요', when: () => true, add: (s) => setUsesLH(s, false, OWNER) },
]

const DAYS = (from: ISODate, to: ISODate, step = 1): ISODate[] => {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, step)) out.push(d)
  return out
}

describe('N19 property: an untold record never changes the partner’s screen on its day', () => {
  it('the shared quiet days are the home’s period days 1–3', () => {
    expect(SHARED_QUIET_DAYS).toBe(PERIOD_EARLY_DAYS)
  })

  for (const base of BASES) {
    it(
      `${base.name}: every untold record × every lens × every day — identical`,
      () => {
        let compared = 0
        let memoryLines = 0
        const used = new Set<string>()
        for (const lens of LENSES) {
          const s0 = withLens(base.state, lens)
          for (const d of DAYS(base.from ?? '2026-08-26', '2026-10-24', 3)) {
            const before = partnerView(s0, d)
            if (before.cover.kind === 'memory') memoryLines++
            for (const r of UNTOLD) {
              if (!r.when(s0, d)) continue
              const s1 = r.add(s0, d)
              if (s1 === s0) continue
              expect(partnerView(s1, d), `${base.name} · ${lensTag(lens)} · ${d} · ${r.name}`).toEqual(before)
              used.add(r.name)
              compared++
            }
          }
        }
        expect(compared).toBeGreaterThan(200)
        if (base.name === 'irregular') expect(memoryLines).toBeGreaterThan(20)
        if (base.name === 'regular 28') expect(used.size).toBe(UNTOLD.length)
      },
      120_000,
    )
  }
})

describe('N19 day-before / day-of: a screen that changes on the day of an untold event is a leak', () => {
  for (const base of BASES) {
    it(
      `${base.name}: outside the shared window his screen holds still day after day — late, a period, a test`,
      () => {
        let held = 0
        // The lenses that draw the most (the rest only hide more).
        for (const lens of LENSES.filter((l) => !l.homeDiscreet && !l.lowPressure && !(l.share === 'none' && l.style === 'explicit'))) {
          const s0 = withLens(base.state, lens)
          for (const d of DAYS('2026-08-27', '2026-10-24')) {
            const y = addDays(d, -1)
            if (sharedWeek(s0, y) || sharedWeek(s0, d) || y.slice(0, 7) !== d.slice(0, 7)) continue
            const yesterday = stable(partnerView(s0, y))
            // Time alone (a period that is late today, a due day passing).
            expect(stable(partnerView(s0, d)), `${base.name} · ${lensTag(lens)} · ${y}→${d}`).toEqual(yesterday)
            // An untold period start or test today.
            for (const r of UNTOLD.slice(0, 9)) {
              if (!r.when(s0, d)) continue
              const s1 = r.add(s0, d)
              if (s1 === s0 || sharedWeek(s1, d)) continue
              expect(stable(partnerView(s1, d)), `${base.name} · ${lensTag(lens)} · ${y}→${d} · ${r.name}`).toEqual(yesterday)
            }
            held++
          }
        }
        expect(held).toBeGreaterThan(50)
      },
      120_000,
    )
  }

  it('over a whole untold cycle his screen changes only at or inside the shared window', () => {
    // 지은 logs every period on the day it comes and tells him nothing.
    let s = withLens(couple(starts('2026-06-09', [28, 28])), { share: 'week', style: 'soft' })
    const comes = ['2026-09-01', '2026-09-29', '2026-10-27']
    const changes: ISODate[] = []
    let prev: string | undefined
    for (const d of DAYS('2026-08-20', '2026-11-15')) {
      if (comes.includes(d)) s = logPeriodStart(s, d, OWNER, d)
      const now = stable(homeView(s, d))
      // The week row's own days move with the date; compare whether it is there and what it draws.
      const key = JSON.stringify({ ...now, strip: now.strip && now.strip.days.filter((x) => x.tone !== 'none').map((x) => x.date) })
      if (prev !== undefined && key !== prev) changes.push(d)
      prev = key
      // Never a change on a period's first three days.
      if (comes.some((c) => d >= c && diffDays(c, d) < PERIOD_EARLY_DAYS)) expect(changes.includes(d), d).toBe(false)
    }
    // Each change touches the shared window: its start ('곧'), the window, its heads-up, its end.
    for (const d of changes) {
      expect(!!sharedWeek(s, d) || !!sharedWeek(s, addDays(d, -1)), d).toBe(true)
    }
    // Three windows came and went, each starting with 곧 우리의 주간.
    const starts3 = changes.filter((d) => sharedWeek(s, d)?.kind === 'soon' && !sharedWeek(s, addDays(d, -1)))
    expect(starts3).toEqual(['2026-09-07', '2026-10-05', '2026-11-02'])
  })
})

describe('what she TOLD is allowed to change his screen (and only from that day)', () => {
  const s = withLens(couple(starts('2026-06-09', [28, 28, 28])), { share: 'week', style: 'soft' })

  it('[알리기] her period: 이번 달은 쉬어 가요 on days 1–3, then the 평소 주 again', () => {
    const period = logPeriodStart(s, '2026-09-29', OWNER, '2026-09-29')
    const told = tellPartnerPeriod(period, '2026-09-29', stamp('2026-09-29'))
    expect(ttcMoment(period, '2026-09-30', PARTNER)!.copy).toBe('partner.neutral')
    expect(ttcMoment(told, '2026-09-30', PARTNER)!.copy).toBe('partner.period-told')
    expect(ttcMoment(told, '2026-10-01', PARTNER)!.copy).toBe('partner.period-told')
    expect(ttcMoment(told, '2026-10-02', PARTNER)!.copy).toBe('partner.neutral')
    // Her logging the end afterwards says nothing more: a fixed span.
    const ended = setPeriodEnd(told, '2026-09-29', '2026-09-30')
    for (const d of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']) {
      expect(ttcMoment(ended, d, PARTNER)!.copy, d).toBe(ttcMoment(told, d, PARTNER)!.copy)
    }
    // Told late (day 5, while '알릴까요?' was still open): the card on that day and the next.
    const late = tellPartnerPeriod(period, '2026-09-29', stamp('2026-10-03'))
    expect(ttcMoment(late, '2026-10-02', PARTNER)!.copy).toBe('partner.neutral')
    expect(ttcMoment(late, '2026-10-03', PARTNER)!.copy).toBe('partner.period-told')
    expect(ttcMoment(late, '2026-10-04', PARTNER)!.copy).toBe('partner.period-told')
    // 10-05 is the shared start of 곧 우리의 주간 (window 10-08…): the told card has ended.
    expect(ttcMoment(late, '2026-10-05', PARTNER)!.copy).toBe('partner.our-week-soon')
    expect(ttcMoment(period, '2026-10-05', PARTNER)!.copy).toBe('partner.our-week-soon')
  })

  it('[알리기] a positive test, then bleeding: the told cards — even through the clinic mode', () => {
    const pending = markPositivePending(s, '2026-09-30')
    expect(ttcMoment(pending, '2026-10-01', PARTNER)!.copy).toBe('partner.neutral')
    expect(ttcMoment(tellPartnerPositive(pending, stamp('2026-10-01')), '2026-10-01', PARTNER)!.copy).toBe('partner.positive-told')
    const bleed = markBleeding(pending, '2026-10-02')
    expect(ttcMoment(bleed, '2026-10-02', PARTNER)!.copy).toBe('partner.neutral')
    expect(ttcMoment(tellPartnerBleeding(bleed, stamp('2026-10-02')), '2026-10-02', PARTNER)!.copy).toBe('partner.bleeding-told')
    // In clinic mode an untold positive keeps the clinic card; told, the told card.
    const clinic = markPositivePending(startClinicMode(s, '2026-09-10'), '2026-09-30')
    expect(ttcMoment(clinic, '2026-10-01', PARTNER)!.copy).toBe('partner.clinic')
    expect(ttcMoment(tellPartnerPositive(clinic, stamp('2026-10-01')), '2026-10-01', PARTNER)!.copy).toBe('partner.positive-told')
  })
})

describe('the documented exceptions', () => {
  const s = withLens(couple(starts('2026-06-09', [28, 28, 28])), { share: 'week', style: 'soft' })

  it('the clinic mode is the couple’s: its card is the same whatever her untold records say', () => {
    // 병원과 함께 준비 중 (N13) shows on both phones — the 주기 tab's badge, the
    // shared schedule (positioning §4 한 달 지도 '병원과 함께', N32). The card
    // carries the schedule only: identical with or without any untold record.
    let c = startClinicMode(s, '2026-09-05')
    c = addAppointment(c, { date: '2026-09-22', time: '08:00', title: '초음파', place: '', who: 'both', kind: 'hospital', note: '메모는 빼요' }, OWNER)
    for (const d of DAYS('2026-09-06', '2026-10-20', 3)) {
      const before = partnerView(c, d)
      expect(before.moment!.copy, d).toBe('partner.clinic')
      expect(JSON.stringify(before.moment)).not.toContain('메모는 빼요')
      expect(before.strip, d).toBeNull()
      expect(before.lens.pause, d).toBe('clinic')
      for (const r of UNTOLD) {
        // A rest replaces the clinic mode itself (startRestCycle) — the couple's switch, not an untold record.
        if (r.name.includes('rest') || !r.when(c, d)) continue
        const after = r.add(c, d)
        if (after === c) continue
        expect(partnerView(after, d), `${d} · ${r.name}`).toEqual(before)
      }
    }
  })

  it('a rest she starts inside 우리의 주간 keeps his span to its last day; the dates rest after it (Now 3 leftover)', () => {
    const d = '2026-09-12' // inside the 09-10…09-15 window (28-day cycle from 09-01)
    expect(sharedWeek(s, d)?.kind).toBe('window')
    expect(ttcMoment(s, d, PARTNER)!.copy).toBe('partner.our-week')
    const rest = startRestCycle(s, d, 'rest')
    for (const x of DAYS(d, '2026-09-15')) expect(partnerView(rest, x), x).toEqual(partnerView(s, x))
    expect(ttcMoment(rest, d, PARTNER)!.dateIdeas).toBe(true)
    // The day after it ends, both read the 평소 주; the next window does not come while she rests (absence only).
    expect(ttcMoment(rest, '2026-09-16', PARTNER)!.copy).toBe('partner.neutral')
    expect(sharedWeek(rest, '2026-10-05')).toBeUndefined()
    // A rest from before the span holds it back (he never saw it start): no change on any day.
    const before = startRestCycle(s, '2026-09-05', 'rest')
    for (const x of DAYS('2026-09-05', '2026-09-16')) expect(sharedWeek(before, x), x).toBeUndefined()
  })

  it('residual: a rest she backdates to before the span, logged inside it, ends the span on the day she logs it', () => {
    const d = '2026-09-12'
    const backdated = startRestCycle(s, '2026-09-05', 'vaccine')
    expect(sharedWeek(s, d)).toBeDefined()
    expect(sharedWeek(backdated, d)).toBeUndefined()
  })

  it('LH never reaches him: his window is her logged starts only, so it can differ from her LH-tuned one', () => {
    // A surge on 09-08 pins her ovulation early (her window ends earlier);
    // his card keeps the calendar window, exactly as without the strips.
    const lh = { ...s, lhTests: [{ date: '2026-09-07', result: 'faint' as const }, { date: '2026-09-08', result: 'positive' as const }] }
    for (const d of DAYS('2026-09-05', '2026-09-20')) {
      expect(partnerView(lh, d), d).toEqual(partnerView(s, d))
    }
  })

  it('the quiet after a pregnancy ended comes with the stage change he saw, and lasts the 42 days even if she ends hers early', () => {
    const pregnant = startPregnancy(s, '2026-09-01', '2026-10-01')
    const ended = endPregnancy(pregnant, '2026-10-20')
    expect(ttcMoment(ended, '2026-10-21', PARTNER)!.copy).toBe('partner.after-loss')
    expect(partnerQuiet(ended, '2026-10-21')).toBe(true)
    expect(partnerTaskVisible(ended, '2026-10-21', PARTNER)).toBe(false)
    // She turns her quiet off and logs a period: her dates come back; his card keeps the quiet.
    const off = logPeriodStart({ ...ended, restCycle: undefined }, '2026-11-10', OWNER, '2026-11-10')
    expect(ttcMoment(off, '2026-11-20', OWNER)!.copy).not.toBe('owner.after-loss')
    expect(ttcMoment(off, '2026-11-20', PARTNER)!.copy).toBe('partner.after-loss')
    expect(partnerTaskVisible(off, '2026-11-20', PARTNER)).toBe(false)
    // The 43rd day: the 평소 주 again, and his task is back.
    const after = addDays('2026-10-20', 42)
    expect(partnerQuiet(off, after)).toBe(false)
    expect(partnerTaskVisible(off, after, PARTNER)).toBe(true)
    // A record from before the pregnancy (backToPreparing without the rest) still reads the 42 days.
    expect(partnerQuiet(backToPreparing(pregnant, '2026-10-20'), '2026-10-25')).toBe(true)
  })
})

describe('an untold early period never pulls his next 곧 우리의 주간 forward (Now 3 leftover)', () => {
  /** The day after his window's last day, up to the day before her period was expected (cycle.ts calendar, logged starts only). */
  function luteal(st: AppState, from: ISODate, to: ISODate): ISODate[] {
    return DAYS(from, to).filter((d) => herStatus(st, d).kind === 'after-fertile' && !sharedWeek(st, d))
  }
  const firstShared = (st: AppState, from: ISODate) => DAYS(from, addDays(from, 45)).find((x) => !!sharedWeek(st, x))

  for (const base of BASES.filter((b) => b.name !== 'no records')) {
    it(
      `${base.name}: before the expected day his screen is the one he had; his next span starts no earlier than an on-time period's`,
      () => {
        let checked = 0
        for (const lens of LENSES.filter((l) => !l.homeDiscreet && !l.lowPressure)) {
          const s0 = withLens(base.state, lens)
          for (const d of luteal(s0, base.from ?? '2026-08-26', '2026-10-20').filter((_, i) => i % 3 === 0)) {
            const st = herStatus(s0, d)
            if (st.kind !== 'after-fertile') continue
            const expected = st.nextPeriod
            const s1 = logPeriodStart(s0, d, OWNER, d)
            // Every day from her log to the day before the expected one: exactly the screen before her log.
            for (const x of DAYS(d, addDays(expected, -1))) {
              expect(partnerView(s1, x), `${base.name} · ${lensTag(lens)} · logged ${d} · ${x}`).toEqual(partnerView(s0, x))
            }
            // From then on: his next span is never earlier than the one an on-time period would bring.
            const onTime = logPeriodStart(s0, expected, OWNER, expected)
            const early = firstShared(s1, d)
            const usual = firstShared(onTime, expected)
            if (usual) expect(early === undefined || early >= usual, `${base.name} · ${lensTag(lens)} · ${d}: ${early} < ${usual}`).toBe(true)
            checked++
          }
        }
        expect(checked).toBeGreaterThan(3)
      },
      120_000,
    )
  }

  it('told, the same early period may move his window — what she sends is his to see', () => {
    const s = withLens(couple(starts('2026-06-09', [28, 28, 28])), { share: 'week', style: 'soft' })
    const early = logPeriodStart(s, '2026-09-20', OWNER, '2026-09-20')
    const told = tellPartnerPeriod(early, '2026-09-20', stamp('2026-09-20'))
    expect(firstShared(early, '2026-09-20')).toBe(firstShared(logPeriodStart(s, '2026-09-29', OWNER, '2026-09-29'), '2026-09-29'))
    expect(firstShared(told, '2026-09-20')! < firstShared(early, '2026-09-20')!).toBe(true)
  })
})
