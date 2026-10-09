// Now 3b integration review (N27–N32 + leftovers): adversarial property tests
// for what the husband's screens gained this round — the frozen band / next
// window, '해 줄 말 · 아껴 둘 말', '특히 오늘·내일', 내 준비, his clinic week and
// [같이 갈게요], his month task's reminders, the re-keyed 우리의 주간 notices,
// the weekly .ics, the 엽산-only starter list — and the N25 verify script.
//
// The rule under all of it (docs/positioning.md §4 규칙 1, AGENTS.md
// 'inference-leak'): his screen changes only on what she SENT ([알리기], a
// signal, her sharing choice) or on his own actions. Every block below either
// holds a surface still against her untold records, or pins what it may carry.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays, diffDays, weekdayIndex } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { CLINIC_KIND_WORD, addAppointment, setAppointmentDone } from '@/lib/logic/appointments'
import { mondayOf, toggleCheck, activeDailyItems, activeItems } from '@/lib/logic/checks'
import { endClinicMode, startClinicMode } from '@/lib/logic/clinic'
import { cycleAt, sortedStarts } from '@/lib/logic/cycle'
import { sharedCycleInput, sharedWeek } from '@/lib/logic/cycleRing'
import { dateBanner, fertileHintsAllowed, partnerHintState } from '@/lib/logic/dateIdeas'
import { WEEKLY_DAYS, WEEKLY_LINK_TITLE, firstWeekly, weeklyLinkIcs } from '@/lib/logic/ics'
import { logPeriodStart } from '@/lib/logic/logs'
import { myPrep } from '@/lib/logic/myPrep'
import { mergeNotices, nudgesPerDay, scheduledNotices } from '@/lib/logic/notifications'
import { completePartnerFirstRun } from '@/lib/logic/onboarding'
import {
  appointmentJoinKey,
  appointmentJoinNoticeKey,
  applyPartnerEvent,
  cleanPartnerEvent,
  partnerEventProblem,
  toldAnswerOpen,
  type PartnerEvent,
} from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, linkClinic, linkIdeas, type PartnerDay } from '@/lib/logic/partnerSnapshot'
import { FERTILITY_TEST_ID, fertilityChain, monthlyTask, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { MONTHLY_TASK_KEY_SAFE, monthlyTaskNotices, planDeadlineNotices } from '@/lib/logic/planNotices'
import { tickItem } from '@/lib/logic/plan'
import { setPersonalPref, setShareLevel } from '@/lib/logic/prefs'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { sanitizeBackup } from '@/lib/logic/settings'
import { SIGNALS_PER_DAY, sayForSignal, sayForTold, sendSignal, signalById } from '@/lib/logic/signals'
import { endPregnancy, noticeTarget, stampOn } from '@/lib/logic/today'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import { tellPartnerBleeding, tellPartnerPeriod, tellPartnerPositive, ttcMoment } from '@/lib/logic/ttcFlow'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { parseState } from '@/lib/storage'
import { migrate } from '@/lib/sync/migrations'
import type { AlertStyle, AppState, Appointment, ISODate, PeriodLog, ShareLevel } from '@/lib/types'

// Long synchronous property walks back to back keep the vitest worker from
// answering its runner (a 60 s RPC timeout → 'Timeout calling onTaskUpdate',
// exit 1 with every test green). One macrotask between tests lets it breathe.
beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)))

const OWNER = 'b' as const
const PARTNER = 'a' as const
const ROOT = join(__dirname, '..')

/** scripts/verify-supabase.mjs, loaded as tests/verifySupabase.test.ts loads it (a plain .mjs, no types). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let V: any
beforeAll(async () => {
  V = await import(/* @vite-ignore */ join(ROOT, 'scripts/verify-supabase.mjs'))
})

// ── Couples ─────────────────────────────────────────────────

function couple(periods: PeriodLog[], over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: OWNER,
      lastPeriodStart: periods[periods.length - 1]?.start ?? '2026-09-01',
      ttcStart: '2026-07-01',
      habits: { smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false },
    },
    new Date(2026, 6, 1, 9, 0),
  )
  return { ...s, periods, ...over }
}

const starts = (first: ISODate, lengths: number[]): PeriodLog[] => {
  const out: PeriodLog[] = [{ start: first }]
  for (const n of lengths) out.push({ start: addDays(out[out.length - 1]!.start, n) })
  return out
}

const DAYS = (from: ISODate, to: ISODate, step = 1): ISODate[] => {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, step)) out.push(d)
  return out
}

/** His own progress: daily ticks on a few days, his 검사 applied and booked (his records only). */
function withHisPrep(s: AppState): AppState {
  let out = setFertilityApplied(s, PARTNER, true, '2026-08-10')
  out = addAppointment(out, { date: '2026-10-08', time: '09:00', title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID }, PARTNER)
  for (const d of DAYS('2026-08-20', '2026-10-20', 3)) for (const i of activeDailyItems(out, PARTNER)) out = toggleCheck(out, PARTNER, d, i.id)
  return out
}

const BASES: ReadonlyArray<{ name: string; state: AppState }> = [
  { name: 'regular 28', state: withHisPrep(couple(starts('2026-06-09', [28, 28, 28]))) },
  { name: 'short 24', state: withHisPrep(couple(starts('2026-06-14', [24, 24, 24, 24]), { cycle: { cycleLength: 24, periodLength: 5 } as AppState['cycle'] })) },
  { name: 'long 33', state: couple(starts('2026-05-25', [33, 33, 33]), { cycle: { cycleLength: 33, periodLength: 5 } as AppState['cycle'] }) },
  { name: 'irregular', state: withHisPrep(couple(starts('2026-05-02', [26, 33, 29, 31]))) },
  { name: 'no records', state: couple([]) },
]

type Lens = { share: ShareLevel; style: AlertStyle; lowPressure?: boolean; homeDiscreet?: boolean }
const NO_DETAIL: readonly Lens[] = [
  { share: 'week', style: 'soft' },
  { share: 'week', style: 'explicit' },
  { share: 'week', style: 'soft', homeDiscreet: true },
  { share: 'none', style: 'explicit' },
]
const DETAIL: readonly Lens[] = [
  { share: 'details', style: 'explicit' },
  { share: 'details', style: 'soft' },
]

function withLens(s: AppState, l: Lens): AppState {
  let out = setShareLevel(s, OWNER, l.share)
  out = { ...out, settings: { ...out.settings, alertStyle: { ...out.settings.alertStyle, [PARTNER]: l.style } } }
  out = setPersonalPref(out, PARTNER, 'lowPressure', !!l.lowPressure)
  out = setPersonalPref(out, PARTNER, 'homeDiscreet', !!l.homeDiscreet)
  return out
}
const tag = (l: Lens) => `${l.share}/${l.style}${l.lowPressure ? '/lp' : ''}${l.homeDiscreet ? '/veil' : ''}`

/** Her period as his view expected it on `d` (the shared calendar: her logged starts only). */
function expectedNext(s: AppState, d: ISODate): ISODate | undefined {
  const last = sortedStarts(s.periods).filter((x) => x <= d).pop()
  return last ? cycleAt(sharedCycleInput(s), last)?.nextPeriod : undefined
}

/** Every Now 3b surface on his phone for `d` (in-app), as data. */
function hisSurfaces(s: AppState, d: ISODate) {
  const m = ttcMoment(s, d, PARTNER)
  return {
    moment: m ? (({ kind: _k, ...rest }) => rest)(m) : null,
    prep: myPrep(s, d, PARTNER),
    clinic: linkClinic(s, d, PARTNER) ?? null,
    taskNotices: monthlyTaskNotices(s, d),
    plan: planDeadlineNotices(s, d).filter((n) => n.to === PARTNER),
    notices: scheduledNotices(s, d)
      .filter((n) => n.to === PARTNER)
      .map((n) => [n.key, n.title, n.body]),
    banner: dateBanner(s, d, PARTNER),
    ideas: linkIdeas(s, d, PARTNER).map((i) => i.id),
    hints: !!sharedWeek(s, d) && fertileHintsAllowed(partnerHintState(s, PARTNER), PARTNER, d),
  }
}

type Rec = { name: string; when: (s: AppState, d: ISODate) => boolean; add: (s: AppState, d: ISODate) => AppState }

const nearExpected = (s: AppState, d: ISODate) => {
  const e = expectedNext(s, d)
  return !!e && Math.abs(diffDays(e, d)) <= 3
}

/** Her records she did NOT tell him about (including the frozen-band case: an early period outside his span). */
const UNTOLD: readonly Rec[] = [
  { name: 'period start near due', when: nearExpected, add: (s, d) => logPeriodStart(s, d, OWNER, d) },
  {
    name: 'EARLY period start (frozen band)',
    when: (s, d) => {
      const e = expectedNext(s, d)
      return !!e && diffDays(d, e) >= 2 && diffDays(d, e) <= 12 && !sharedWeek(s, d)
    },
    add: (s, d) => logPeriodStart(s, d, OWNER, d),
  },
  { name: 'period start inside his span', when: (s, d) => !!sharedWeek(s, d), add: (s, d) => logPeriodStart(s, d, OWNER, d) },
  { name: 'LH positive', when: () => true, add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: d, result: 'positive' as const }] }) },
  {
    name: 'positive test (untold)',
    when: () => true,
    add: (s, d) => markPositivePending({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `p-${d}`, date: d, result: 'positive' as const, by: OWNER }] }, d, `p-${d}`),
  },
  { name: 'rest from today', when: () => true, add: (s, d) => startRestCycle(s, d, 'rest') },
  { name: '오늘 컨디션', when: () => true, add: (s, d) => setFeel(s, OWNER, d, 'tired') },
  { name: '나만 보기 note', when: () => true, add: (s, d) => setPrivateNote(s, OWNER, d, 'PRIVATE_3b') },
  {
    name: 'her own appointment',
    when: () => true,
    add: (s, d) => addAppointment(s, { date: addDays(d, 2), time: '07:40', title: '난포 초음파 HER_3b', note: 'HER_NOTE_3b', who: OWNER, kind: 'injection' }, OWNER),
  },
  { name: 'her own 검사 applied', when: () => true, add: (s, d) => setFertilityApplied(s, OWNER, true, d) },
]

/**
 * Her own ticks are couple data by design (his 우리 한 줄 shows her numbers, docs/positioning.md
 * §3), so they are not 'untold' — but they must never move HIS bar (내 준비).
 */
const HER_TICKS: Rec = {
  name: 'her check ticks',
  when: () => true,
  add: (s, d) => activeItems(s, OWNER).reduce((acc, i) => toggleCheck(acc, OWNER, d, i.id), s),
}

// ── 1. The leak property on the Now 3b surfaces — in-app and all seven link days ──

describe('Now 3b: an untold record never changes his new surfaces — in-app and every day of the link', () => {
  for (const base of BASES) {
    it(`${base.name}: every no-details lens × every fourth day × every untold record`, { timeout: 180_000 }, () => {
      let compared = 0
      let frozen = 0
      const used = new Set<string>()
      for (const lens of NO_DETAIL) {
        const s0 = withLens(base.state, lens)
        for (const d of DAYS('2026-08-26', '2026-10-24', 4)) {
          const before = hisSurfaces(s0, d)
          const snap0 = buildPartnerSnapshot(s0, d, PARTNER)!
          for (const r of UNTOLD) {
            if (!r.when(s0, d)) continue
            const s1 = r.add(s0, d)
            if (s1 === s0) continue
            const where = `${base.name} · ${tag(lens)} · ${d} · ${r.name}`
            expect(hisSurfaces(s1, d), where).toEqual(before)
            const snap1 = buildPartnerSnapshot(s1, d, PARTNER)!
            const { days: _d0, ...shared0 } = snap0
            const { days: _d1, ...shared1 } = snap1
            expect(shared1, where).toEqual(shared0)
            // Day 0 always; a later day too — strictly (no window-moved exemption) for the frozen band
            // before the day his view expected her period, otherwise while the shared window is unmoved.
            const expected = r.name.startsWith('EARLY') ? expectedNext(s0, d) : undefined
            for (let k = 0; k < snap0.days.length; k++) {
              const x = addDays(d, k)
              const strict = !!expected && x < expected
              const unmoved =
                JSON.stringify(sharedWeek(s0, x) ?? null) === JSON.stringify(sharedWeek(s1, x) ?? null) &&
                JSON.stringify(sharedWeek(s0, addDays(x, -1)) ?? null) === JSON.stringify(sharedWeek(s1, addDays(x, -1)) ?? null)
              if (k === 0 || strict || unmoved) expect(snap1.days[k], `${where} · +${k}`).toEqual(snap0.days[k])
              if (strict && k > 0) {
                // The in-app screens on that later day hold still too.
                expect(hisSurfaces(s1, x), `${where} · app +${k}`).toEqual(hisSurfaces(s0, x))
                frozen++
              }
            }
            used.add(r.name)
            compared++
          }
        }
      }
      expect(compared).toBeGreaterThan(base.name === 'no records' ? 100 : 400)
      if (base.name !== 'no records') {
        expect(used.has('EARLY period start (frozen band)'), `${base.name}: the frozen-band case ran`).toBe(true)
        expect(frozen).toBeGreaterThan(10)
      }
    })
  }

  it('told, the same early period may move his window — the check above is not vacuous', () => {
    const s0 = withLens(BASES[0]!.state, NO_DETAIL[0]!)
    let moved = 0
    let held = 0
    const e = expectedNext(s0, '2026-09-20')!
    for (let k = 3; k <= 12; k++) {
      const d = addDays(e, -k)
      if (sharedWeek(s0, d)) continue
      const untold = logPeriodStart(s0, d, OWNER, d)
      const told = tellPartnerPeriod(untold, d, stampOn(d))
      for (const x of DAYS(d, addDays(e, -1))) {
        if (JSON.stringify(sharedWeek(told, x) ?? null) !== JSON.stringify(sharedWeek(untold, x) ?? null)) moved++
        // Untold, the days before the expected date read as if nothing had been logged.
        expect(sharedWeek(untold, x) ?? null, `${k} ${x}`).toEqual(sharedWeek(s0, x) ?? null)
        held++
      }
    }
    expect(held).toBeGreaterThan(30)
    expect(moved).toBeGreaterThan(0)
  })
})

// ── 2. '해 줄 말 · 아껴 둘 말' only on what she sent ─────────────────

const TOLD_COPIES = new Set(['partner.period-told', 'partner.positive-told', 'partner.bleeding-told'])

describe("'해 줄 말 · 아껴 둘 말': only on a moment she SENT, never inferred", () => {
  it('without [알리기] no card carries it — any lens (자세히 too), any day, any untold record; never on her own card', { timeout: 120_000 }, () => {
    let checked = 0
    for (const base of BASES) {
      for (const lens of [...NO_DETAIL, ...DETAIL]) {
        const s0 = withLens(base.state, lens)
        for (const d of DAYS('2026-08-26', '2026-10-24', 3)) {
          for (const r of [undefined, ...UNTOLD]) {
            if (r && !r.when(s0, d)) continue
            const s = r ? r.add(s0, d) : s0
            const where = `${base.name} · ${tag(lens)} · ${d} · ${r?.name ?? 'as is'}`
            expect(ttcMoment(s, d, PARTNER)?.say, where).toBeUndefined()
            expect(ttcMoment(s, d, OWNER)?.say, where).toBeUndefined()
            checked++
          }
          const snap = buildPartnerSnapshot(s0, d, PARTNER)!
          for (const day of snap.days) expect(day.moment?.say, `${base.name} · ${tag(lens)} · ${d} link`).toBeUndefined()
        }
      }
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('told: the card, its lines and its two answers — in the app and on the link, word for word; [보냈어요] after his answer', () => {
    const d = '2026-09-29'
    for (const lens of [...NO_DETAIL, ...DETAIL]) {
      const s0 = logPeriodStart(withLens(BASES[0]!.state, lens), d, OWNER, d)
      const told = tellPartnerPeriod(s0, d, stampOn(d))
      const m = ttcMoment(told, d, PARTNER)!
      expect(m.copy, tag(lens)).toBe('partner.period-told')
      expect(m.say, tag(lens)).toMatchObject({ ...sayForTold('period'), since: d })
      const day = buildPartnerSnapshot(told, d, PARTNER)!.days[0]!
      expect(day.moment?.say, tag(lens)).toEqual({
        say: sayForTold('period').say,
        save: sayForTold('period').save,
        replies: sayForTold('period').replies.map((id) => ({ ...signalById(id)! })),
      })
      // The link's answer: a 'signal' event with one of the two ids — accepted once.
      const [first, second] = sayForTold('period').replies
      expect(toldAnswerOpen(told, PARTNER, first, d)).toBe(true)
      const ev: PartnerEvent = { id: `say-${tag(lens).replace(/\//g, '-')}`, kind: 'signal', signalId: first, from: PARTNER }
      const answered = applyPartnerEvent(told, ev, d)
      expect(answered).not.toBe(told)
      expect(ttcMoment(answered, d, PARTNER)!.say?.sent).toBe(first)
      expect(buildPartnerSnapshot(answered, d, PARTNER)!.days[0]!.moment?.say?.sent).toBe(first)
      expect(toldAnswerOpen(answered, PARTNER, first, d)).toBe(false)
      expect(partnerEventProblem(answered, { ...ev, id: `${ev.id}-again` }, d)).toBe('signal')
      // 'dinner-mine' is one of his own offers anyway: still his to send.
      expect(partnerEventProblem(answered, { id: `${ev.id}-own`, kind: 'signal', signalId: second }, d)).toBeNull()
      // An id that is neither his own nor the card's answer is refused.
      for (const other of ['hug', 'not-this-month', 'metoo', 'zzz'])
        expect(partnerEventProblem(told, { id: `${ev.id}-${other}`, kind: 'signal', signalId: other }, d), other).toBe('signal')
    }
  })

  it('the answers of a told card are refused when there is no told card (untold period, other days, her own phone)', () => {
    const d = '2026-09-29'
    const untold = logPeriodStart(BASES[0]!.state, d, OWNER, d)
    for (const id of sayForTold('period').replies.filter((x) => x === 'here')) {
      expect(toldAnswerOpen(untold, PARTNER, id, d)).toBe(false)
      expect(partnerEventProblem(untold, { id: 'nope-1', kind: 'signal', signalId: id }, d)).toBe('signal')
    }
    // After the told card's days (1–3 of the period) the answer goes away with it.
    const told = tellPartnerPeriod(untold, d, stampOn(d))
    expect(toldAnswerOpen(told, PARTNER, 'here', addDays(d, 5))).toBe(false)
    expect(ttcMoment(told, addDays(d, 5), PARTNER)?.say).toBeUndefined()
  })

  it('positive and bleeding she told carry their own lines; their answers include [병원 같이 갈게요]', () => {
    const d = '2026-10-02'
    const s = markPositivePending(
      { ...BASES[0]!.state, pregnancyTests: [{ id: 'pt', date: d, result: 'positive' as const, by: OWNER }] },
      d,
      'pt',
    )
    expect(ttcMoment(s, d, PARTNER)?.say).toBeUndefined()
    const pos = tellPartnerPositive(s, stampOn(d))
    expect(ttcMoment(pos, d, PARTNER)).toMatchObject({ copy: 'partner.positive-told', say: { ...sayForTold('positive'), since: d } })
    const bleed = tellPartnerBleeding(markBleeding(pos, addDays(d, 1)), stampOn(addDays(d, 1)))
    const b = ttcMoment(bleed, addDays(d, 1), PARTNER)!
    expect(b.copy).toBe('partner.bleeding-told')
    expect(b.say?.replies).toContain('clinic-together')
    for (const x of [pos, bleed]) for (const dd of [d, addDays(d, 1)]) {
      const m = ttcMoment(x, dd, PARTNER)
      if (m?.say) expect(TOLD_COPIES.has(m.copy)).toBe(true)
    }
  })

  it("under her signal: the link's lines come only with a signal SHE sent, and match the app's table", () => {
    const d = '2026-09-20'
    for (const id of ['not-this-month', 'comfort', 'clinic', 'no-baby-talk', 'rest', 'tired']) {
      const s = sendSignal(BASES[0]!.state, OWNER, PARTNER, id, d, `${d}T10:00:00+09:00`)
      const day = buildPartnerSnapshot(s, d, PARTNER)!.days[0]!
      const lines = sayForSignal(id)
      if (lines) expect(day.signal?.say, id).toEqual({ say: lines.say, save: lines.save })
      else expect(day.signal?.say, id).toBeUndefined()
    }
    // His own signal to her never produces lines anywhere on his page.
    const his = sendSignal(BASES[0]!.state, PARTNER, OWNER, 'dinner-mine', d, `${d}T10:00:00+09:00`)
    expect(buildPartnerSnapshot(his, d, PARTNER)!.days[0]!.signal).toBeUndefined()
  })
})

// ── 3. '특히 오늘·내일' — '자세히' only ─────────────────────────────

describe("'특히 오늘·내일' (the best days) reaches only a partner she shares 자세히 with", () => {
  it('never in his card or any link day without 자세히 — every day, LH or not; present on some day with 자세히', { timeout: 120_000 }, () => {
    const PEAK = /특히 오늘|오늘·내일|가능성 높은/
    const lh = (s: AppState) => ({
      ...s,
      lhTests: [
        { date: '2026-09-17', result: 'faint' as const },
        { date: '2026-09-18', result: 'positive' as const },
        { date: '2026-10-16', result: 'peak' as const },
      ],
    })
    let seen = 0
    for (const base of BASES.slice(0, 4)) {
      for (const st of [base.state, lh(base.state)]) {
        for (const lens of NO_DETAIL) {
          const s = withLens(st, lens)
          for (const d of DAYS('2026-08-26', '2026-10-24')) expect(JSON.stringify(ttcMoment(s, d, PARTNER)), `${base.name} · ${tag(lens)} · ${d}`).not.toMatch(PEAK)
          for (const d of DAYS('2026-08-26', '2026-10-24', 7)) expect(JSON.stringify(buildPartnerSnapshot(s, d, PARTNER)), `${base.name} · ${tag(lens)} · link ${d}`).not.toMatch(PEAK)
        }
        const det = withLens(st, DETAIL[0]!)
        for (const d of DAYS('2026-08-26', '2026-10-24')) if (PEAK.test(JSON.stringify(ttcMoment(det, d, PARTNER)))) seen++
      }
    }
    expect(seen).toBeGreaterThan(5)
  })
})

// ── 4. 내 준비 — no zeros, nothing of hers ─────────────────────────

describe('내 준비 (myPrep): his records only — no 0, no 안 했어요, empty for her and in the quiet', () => {
  const ZERO = /(^|[^\d])0(\/7|일|회|번|개)|안 했어요|시작 전|0\/7/

  it('every day of three months, for random histories of his: never a zero, and her records never change it', { timeout: 120_000 }, () => {
    let rnd = 17
    const next = () => (rnd = (rnd * 48271) % 2147483647) / 2147483647
    let nonEmpty = 0
    for (let seed = 0; seed < 12; seed++) {
      let s = couple(starts('2026-06-09', [28, 28, 28]))
      if (next() < 0.8) s = setFertilityApplied(s, PARTNER, true, addDays('2026-07-01', Math.floor(next() * 60)))
      if (next() < 0.5)
        s = addAppointment(s, { date: addDays('2026-09-01', Math.floor(next() * 50)), title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID }, PARTNER)
      if (next() < 0.3) s = tickItem(FERTILITY_TEST_ID, true, addDays('2026-09-10', Math.floor(next() * 20)), PARTNER)(s)
      for (const d of DAYS('2026-08-01', '2026-10-31')) if (next() < 0.35) for (const i of activeItems(s, PARTNER)) if (next() < 0.7) s = toggleCheck(s, PARTNER, d, i.id)
      for (const d of DAYS('2026-08-01', '2026-10-31', 2)) {
        const p = myPrep(s, d, PARTNER)
        for (const v of [p.timerLabel, p.weekCount, p.chainStep]) if (v) expect(v, `${seed} ${d}`).not.toMatch(ZERO)
        if (p.timerLabel || p.weekCount || p.chainStep) nonEmpty++
        expect(myPrep(s, d, OWNER), `${seed} ${d} her own`).toEqual({})
        if (d.endsWith('1') || d.endsWith('7')) {
          for (const r of [...UNTOLD, HER_TICKS]) {
            if (!r.when(s, d)) continue
            expect(myPrep(r.add(s, d), d, PARTNER), `${seed} ${d} ${r.name}`).toEqual(p)
          }
        }
      }
    }
    expect(nonEmpty).toBeGreaterThan(300)
  })

  it('rests through the 42 days after a pregnancy ended (both phones saw it), then comes back', () => {
    let s = withHisPrep(couple(starts('2026-06-09', [28, 28])))
    s = startPregnancy(s, '2026-08-04', '2026-09-01')
    s = endPregnancy(s, '2026-09-20')
    for (const d of DAYS('2026-09-20', '2026-10-31')) {
      const inQuiet = diffDays('2026-09-20', d) < 42
      if (inQuiet) expect(myPrep(s, d, PARTNER), d).toEqual({})
    }
    expect(Object.keys(myPrep(s, '2026-11-05', PARTNER)).length).toBeGreaterThan(0)
  })
})

// ── 5. His clinic week (N32) ────────────────────────────────

type ClinicIds = { his: string; both: string; hers: string; doneBoth: string; far: string; past: string }

function clinicCouple(): { s: AppState; ids: ClinicIds } {
  let s = startClinicMode(couple(starts('2026-06-09', [28, 28, 28])), '2026-09-01')
  const add = (a: Omit<Appointment, 'id' | 'createdBy'> & { title: string }) => {
    s = addAppointment(s, a, OWNER)
    return s.appointments[s.appointments.length - 1]!.id
  }
  const ids: ClinicIds = {
    his: add({ date: '2026-10-06', time: '08:30', title: '비뇨의학과 TITLE_HIS', note: 'NOTE_HIS', place: '○○의원', who: PARTNER, kind: 'test' }),
    both: add({ date: '2026-10-07', time: '09:30', title: '인공수정 TITLE_BOTH', note: 'NOTE_BOTH', place: '서울 난임센터', who: 'both', kind: 'injection' }),
    hers: add({ date: '2026-10-05', time: '07:40', title: '난포 초음파 TITLE_HERS', note: 'NOTE_HERS', place: '서울 난임센터', who: OWNER, kind: 'hospital' }),
    doneBoth: add({ date: '2026-10-08', title: '상담 TITLE_DONE', who: 'both', kind: 'hospital' }),
    far: add({ date: '2026-10-20', title: '시술 TITLE_FAR', who: 'both', kind: 'hospital' }),
    past: add({ date: '2026-09-30', title: '채혈 TITLE_PAST', who: 'both', kind: 'test' }),
  }
  s = setAppointmentDone(s, ids.doneBoth, true)
  // A synced tombstone (deletedAt): never shown.
  s = {
    ...s,
    appointments: [...s.appointments, { id: 'gone', date: '2026-10-06', title: '삭제 TITLE_GONE', who: 'both', kind: 'hospital', createdBy: OWNER, deletedAt: '2026-10-01T00:00:00+09:00' } as Appointment],
  }
  return { s, ids }
}

describe('his clinic week: his own and 둘이 함께 only, no title or memo, off with clinic mode, quiet after a loss', () => {
  const MARK = /TITLE_|NOTE_|비뇨|인공수정|난포|초음파|채혈|시술|상담|삭제/

  it('day by day: only live, not-done his/both rows of the next seven days; kind words; her own row never changes it', () => {
    const { s, ids } = clinicCouple()
    for (const d of DAYS('2026-09-28', '2026-10-24')) {
      const c = linkClinic(s, d, PARTNER)!
      expect(c, d).toBeDefined()
      const json = JSON.stringify(c)
      expect(json, d).not.toMatch(MARK)
      const shown = c.appointments.map((a) => a.id)
      const allowed = [ids.his, ids.both, ids.far, ids.past].filter((id) => {
        const a = s.appointments.find((x) => x.id === id)!
        return a.date >= d && a.date <= addDays(d, 6)
      })
      expect(shown.sort(), d).toEqual(allowed.sort())
      for (const a of c.appointments) {
        expect(Object.keys(a).every((k) => ['id', 'date', 'time', 'place', 'label', 'with', 'joined'].includes(k)), d).toBe(true)
        expect(Object.values(CLINIC_KIND_WORD)).toContain(a.label)
      }
      // Her own appointment (or another one) never moves his week.
      const more = addAppointment(s, { date: addDays(d, 1), time: '06:00', title: 'TITLE_HERS2', who: OWNER, kind: 'injection' }, OWNER)
      expect(linkClinic(more, d, PARTNER), d).toEqual(c)
      // His card names his/both only, by a kind word.
      expect(JSON.stringify(ttcMoment(s, d, PARTNER)), d).not.toMatch(MARK)
      expect(ttcMoment(more, d, PARTNER), d).toEqual(ttcMoment(s, d, PARTNER))
    }
    expect(linkClinic(s, '2026-10-04', OWNER)).toBeUndefined()
  })

  it('nothing when clinic mode is off, outside the preparing stage, and in the 42 days after a pregnancy ended', () => {
    const { s } = clinicCouple()
    for (const d of DAYS('2026-09-28', '2026-10-10')) {
      expect(linkClinic(endClinicMode(s), d, PARTNER), d).toBeUndefined()
      expect(buildPartnerSnapshot(endClinicMode(s), d, PARTNER)!.days.every((x) => x.clinic === undefined), d).toBe(true)
      expect(linkClinic({ ...s, stage: 'pregnant' }, d, PARTNER), d).toBeUndefined()
    }
    let loss = startPregnancy(clinicCouple().s, '2026-08-04', '2026-09-01')
    loss = endPregnancy(loss, '2026-09-25')
    loss = { ...loss, restCycle: { since: '2026-09-26', reason: 'clinic' } }
    for (const d of DAYS('2026-09-26', '2026-11-04')) expect(linkClinic(loss, d, PARTNER), d).toBeUndefined()
  })
})

// ── 6. [같이 갈게요] — the join-appointment event ──────────────────

describe("'join-appointment': ids only, a live 둘이 함께 row only, once", () => {
  const today = '2026-10-04'

  it('applies once (same id or a new one), leaves her one 🔔 with day · time · place, never touches the appointment', () => {
    const { s, ids } = clinicCouple()
    const ev: PartnerEvent = { id: 'join-1', kind: 'join-appointment', appointmentId: ids.both, from: PARTNER }
    const once = applyPartnerEvent(s, ev, today)
    expect(once).not.toBe(s)
    expect(once.appointments).toBe(s.appointments)
    expect(once.decisions?.[appointmentJoinKey(ids.both, PARTNER)]).toBe(today)
    const bell = once.notifications.filter((n) => n.key === appointmentJoinNoticeKey(ids.both, PARTNER))
    expect(bell).toHaveLength(1)
    expect(bell[0]!.to).toBe(OWNER)
    expect(`${bell[0]!.title} ${bell[0]!.body}`).not.toMatch(/TITLE_|NOTE_|인공수정/)
    expect(bell[0]!.body).toContain('09:30')
    expect(noticeTarget('system', 'preparing', bell[0]!.key)).toBe('plan')
    expect(applyPartnerEvent(once, ev, today)).toBe(once)
    expect(applyPartnerEvent(once, { ...ev, id: 'join-2' }, today)).toBe(once)
    expect(partnerEventProblem(once, { ...ev, id: 'join-2' }, today)).toBe('appointment')
    // The link then shows it joined.
    expect(linkClinic(once, today, PARTNER)!.appointments.find((a) => a.id === ids.both)?.joined).toBe(true)
  })

  it('refuses every other id: his own, hers, done, past, deleted, unknown; from her; malformed or with extra fields', () => {
    const { s, ids } = clinicCouple()
    for (const id of [ids.his, ids.hers, ids.doneBoth, ids.past, 'gone', 'no-such-id']) {
      const ev: PartnerEvent = { id: `x-${id}`, kind: 'join-appointment', appointmentId: id }
      expect(partnerEventProblem(s, ev, today), id).toBe('appointment')
      expect(applyPartnerEvent(s, ev, today), id).toBe(s)
    }
    expect(partnerEventProblem(s, { id: 'from-her', kind: 'join-appointment', appointmentId: ids.both, from: OWNER }, today)).toBe('actor')
    expect(cleanPartnerEvent({ id: 'x', kind: 'join-appointment', appointmentId: '../../etc' })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'x', kind: 'join-appointment' })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'x', kind: 'join-appointment', appointmentId: ids.both, title: 'TITLE', note: 'n', date: today })).toEqual({
      id: 'x',
      kind: 'join-appointment',
      appointmentId: ids.both,
    })
  })

  it('random event storms: only decisions and notifications ever change, the appointments never', () => {
    const { s, ids } = clinicCouple()
    let rnd = 5
    const pick = <T,>(xs: readonly T[]) => xs[(rnd = (rnd * 16807) % 2147483647) % xs.length]!
    let st = s
    for (let i = 0; i < 300; i++) {
      const raw = { id: `e${i % 40}`, kind: 'join-appointment', appointmentId: pick([...Object.values(ids), 'gone', 'zzz']), from: pick([PARTNER, OWNER, undefined]) }
      const ev = cleanPartnerEvent(raw)
      if (!ev) continue
      const next = applyPartnerEvent(st, ev, pick(['2026-10-03', '2026-10-04', '2026-10-06', '2026-10-09']))
      expect(next.appointments).toBe(s.appointments)
      expect(next.periods).toBe(s.periods)
      expect(next.checkItems).toBe(s.checkItems)
      st = next
    }
    // Only the two live, upcoming '둘이 함께' rows can ever be joined — each once, by him.
    const joined = Object.keys(st.decisions ?? {}).filter((k) => k.startsWith('appt-join:'))
    expect(joined.length).toBeGreaterThan(0)
    expect(joined.every((k) => k === appointmentJoinKey(ids.both, PARTNER) || k === appointmentJoinKey(ids.far, PARTNER))).toBe(true)
    const bells = st.notifications.filter((n) => n.key?.startsWith('appt:') && n.key.includes(':join:'))
    expect(bells.length).toBe(joined.length)
    expect(bells.every((n) => n.to === OWNER)).toBe(true)
  })
})

// ── 7. His month task's reminders ───────────────────────────

describe("his month task's reminders: to him only, keys with no health data, quiet when his task rests", () => {
  it('over applications, bookings and tests at many dates: every key is MONTHLY_TASK_KEY_SAFE and names only his own dates', () => {
    let total = 0
    for (const appliedAt of ['2026-06-03', '2026-06-30', '2026-07-15', '2026-08-31']) {
      for (const booked of [undefined, '2026-08-20', '2026-09-30']) {
        for (const tested of [undefined, '2026-09-05']) {
          let s = setFertilityApplied(couple(starts('2026-06-09', [28, 28, 28, 28])), PARTNER, true, appliedAt)
          if (booked) s = addAppointment(s, { date: booked, title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID }, PARTNER)
          if (tested) s = tickItem(FERTILITY_TEST_ID, true, tested, PARTNER)(s)
          const herDates = new Set([...s.periods.map((p) => p.start)])
          for (const d of DAYS('2026-06-01', '2026-12-31')) {
            const chain = fertilityChain(s, d, PARTNER)
            for (const n of monthlyTaskNotices(s, d)) {
              total++
              expect(n.key, `${appliedAt} ${d}`).toMatch(MONTHLY_TASK_KEY_SAFE)
              expect(n.to).toBe(PARTNER)
              expect(noticeTarget(n.kind, 'preparing', n.key)).toBe('today')
              const date = /:(\d{4}-\d{2}-\d{2}):/.exec(n.key)?.[1]
              if (date) {
                expect([chain.testBy, chain.claimBy], `${n.key}`).toContain(date)
                expect(herDates.has(date) && date !== chain.testBy && date !== chain.claimBy).toBe(false)
              }
              expect(`${n.title} ${n.body}`).not.toMatch(/생리|가임|배란|LH|임신|양성|주기/)
            }
            expect(monthlyTaskNotices({ ...s, stage: 'pregnant' }, d)).toEqual([])
          }
        }
      }
    }
    expect(total).toBeGreaterThan(30)
  })

  it('rests in the 42 days after a pregnancy ended, and never reads her untold records', () => {
    let s = setFertilityApplied(couple(starts('2026-06-09', [28, 28])), PARTNER, true, '2026-07-10')
    const loss = endPregnancy(startPregnancy(s, '2026-08-04', '2026-09-01'), '2026-10-05')
    for (const d of DAYS('2026-10-05', '2026-11-15')) expect(monthlyTaskNotices(loss, d), d).toEqual([])
    for (const d of DAYS('2026-09-25', '2026-10-12')) {
      const base = monthlyTaskNotices(s, d)
      for (const r of UNTOLD) if (r.when(s, d) && r.name !== 'her own appointment') expect(monthlyTaskNotices(r.add(s, d), d), `${d} ${r.name}`).toEqual(base)
    }
    s = setFertilityApplied(s, PARTNER, false, '2026-07-10')
    expect(DAYS('2026-09-01', '2026-12-31').flatMap((d) => monthlyTaskNotices(s, d))).toEqual([])
  })
})

// ── 8. The re-keyed 우리의 주간 notices ──────────────────────────

describe("his 우리의 주간 notice keys: the window's week, never a date of her cycle; the old keys still count", () => {
  const WEEK_KEY = /^(fertile|peak)-week:(\d{4}-\d{2}-\d{2}):a$/

  it('every key he gets names the Monday of his shared window — never her period start', () => {
    let keys = 0
    for (const base of BASES.slice(0, 4)) {
      for (const lens of [NO_DETAIL[0]!, NO_DETAIL[1]!, ...DETAIL]) {
        const s = withLens(base.state, lens)
        const herStarts = new Set(s.periods.map((p) => p.start))
        for (const d of DAYS('2026-08-26', '2026-10-24')) {
          for (const n of scheduledNotices(s, d).filter((x) => x.to === PARTNER && (x.kind === 'fertile-start' || x.kind === 'peak'))) {
            keys++
            const m = WEEK_KEY.exec(n.key)
            expect(m, `${base.name} · ${tag(lens)} · ${d} · ${n.key}`).not.toBeNull()
            expect(weekdayIndex(m![2]!), n.key).toBe(1)
            if (lens.share !== 'details') {
              const w = sharedWeek(s, d)!
              expect(m![2], n.key).toBe(mondayOf(w.fertileStart))
            }
            if (herStarts.has(m![2]!)) expect(m![2]).toBe(mondayOf(m![2]!)) // only ever a Monday by construction
          }
          // Her own keys are hers (her phone): never sent to him.
          for (const n of scheduledNotices(s, d).filter((x) => x.to === PARTNER)) expect(n.key.startsWith('fertile:') || n.key.startsWith('peak:')).toBe(false)
        }
      }
    }
    expect(keys).toBeGreaterThan(20)
  })

  it('a walk merges exactly one heads-up per window; an old fertile:/fertile-start: key already delivered counts as that one', () => {
    // Her September period is logged too (as the walk reaches it), so two windows fall inside the walk.
    const s0 = withLens({ ...BASES[0]!.state, periods: [...BASES[0]!.state.periods, { start: '2026-09-29' }] }, NO_DETAIL[0]!)
    const walk = (start: AppState) => {
      let st = start
      for (const d of DAYS('2026-08-26', '2026-10-24')) st = mergeNotices(st, scheduledNotices(st, d), stampOn(d)).state
      return st.notifications.filter((n) => n.to === PARTNER && n.kind === 'fertile-start')
    }
    const plain = walk(s0)
    const windows = new Set(plain.map((n) => n.key))
    expect(plain.length).toBe(windows.size)
    expect(plain.length).toBeGreaterThanOrEqual(2)
    // The September window was announced under an old key: no second notice for it, the next one comes.
    const sep = DAYS('2026-09-01', '2026-09-30').map((d) => sharedWeek(s0, d)).find((w) => w)!
    for (const oldKey of [`fertile:${sep.window.start}:a`, `fertile-start:${sep.fertileStart}:a`]) {
      const pre: AppState = {
        ...s0,
        notifications: [{ id: 'old', key: oldKey, to: PARTNER, kind: 'fertile-start', title: '이번 주는 우리의 주간', body: '', createdAt: `${addDays(sep.fertileStart, -1)}T09:00:00+09:00`, read: true }],
      }
      const got = walk(pre)
      expect(got.some((n) => n.key === `fertile-week:${mondayOf(sep.fertileStart)}:a`), oldKey).toBe(false)
      expect(got.length, oldKey).toBe(plain.length - 1 + 1) // the old one + every other window
    }
  })
})

// ── 9. The weekly .ics (N31) ────────────────────────────────

describe('the weekly .ics: his weekday, a fixed title, the page without the token, nothing of her cycle', () => {
  it('for every weekday × start date × origin: no token, no health word, starts on his day, weekly', () => {
    const TOKEN = 'tok_SECRET_9f3a'
    for (const day of WEEKLY_DAYS) {
      for (const start of DAYS('2026-09-28', '2026-10-11')) {
        for (const origin of [undefined, 'https://dulset.app', 'https://dulset.app/']) {
          const text = weeklyLinkIcs(day, start, { origin, stamp: new Date(Date.UTC(2026, 9, 4)) })
          expect(text).toContain(`RRULE:FREQ=WEEKLY;BYDAY=${day}`)
          expect(text).toContain(WEEKLY_LINK_TITLE)
          expect(text).not.toMatch(/#t=|[?&]t=|token/i)
          expect(text.includes(TOKEN)).toBe(false)
          expect(text).not.toMatch(/가임|배란|생리|임신|LH|정액|검사|우리의 주간/)
          const first = firstWeekly(day, start)
          expect(first >= start && diffDays(start, first) < 7).toBe(true)
          expect(text).toContain(`DTSTART:${first.replace(/-/g, '')}T2000`)
        }
      }
    }
    // A bad weekday or date: a calendar with no event (never a guessed day).
    expect(weeklyLinkIcs('XX' as never, '2026-10-04')).not.toContain('BEGIN:VEVENT')
    expect(weeklyLinkIcs('MO', 'nope')).not.toContain('BEGIN:VEVENT')
    // It takes no state at all: nothing of hers can reach it.
    expect(weeklyLinkIcs.length).toBeLessThanOrEqual(3)
  })
})

// ── 10. The 엽산-only starter list is for new couples only ─────────────

describe('default checks: 엽산 only for a new couple; an existing list is never rebuilt', () => {
  it('a new couple (with or without the habit answers) starts her on 엽산 alone', () => {
    for (const habits of [undefined, { smokes: true, drinks: 'often' as const, exercises: true, takesSupplements: true }]) {
      const s = createInitialState({ me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: OWNER, habits }, new Date(2026, 9, 4, 9))
      expect(activeItems(s, OWNER).map((i) => i.label)).toEqual(['엽산'])
    }
  })

  it('an old save keeps her 엽산 · 비타민 D · 술 · 걷기 through load, backup, migration, his first run and the link setup', () => {
    const base = couple(starts('2026-06-09', [28, 28]))
    const old = (['엽산', '비타민 D', '술 안 마시기', '30분 걷기·운동'] as const).map((label, i) => ({
      id: `old-${i}`,
      owner: OWNER,
      label,
      kind: i < 2 ? ('supplement' as const) : ('habit' as const),
      active: true,
      createdAt: '2026-05-01',
    }))
    const s: AppState = { ...base, checkItems: [...base.checkItems.filter((i) => i.owner !== OWNER), ...old] }
    const hers = (x: AppState | null | undefined) =>
      x!.checkItems
        .filter((i) => i.owner === OWNER && i.active)
        .map((i) => i.label)
        .sort()
    const want = [...old.map((i) => i.label)].sort()
    expect(hers(parseState(JSON.stringify(s)))).toEqual(want)
    expect(hers(sanitizeBackup(JSON.parse(JSON.stringify(s)) as AppState))).toEqual(want)
    expect(hers(migrate({ ...s, schemaVersion: 1 } as AppState))).toEqual(want)
    expect(hers(completePartnerFirstRun(s, PARTNER, { habits: { smokes: true, drinks: 'often', exercises: false, takesSupplements: false }, alertStyle: 'soft' }, '2026-10-04', stampOn('2026-10-04')))).toEqual(want)
    const setup = applyPartnerEvent(s, { id: 'setup-1', kind: 'setup', habits: { smokes: true, drinks: 'often' }, alertStyle: 'explicit' }, '2026-10-04')
    expect(setup).not.toBe(s)
    expect(hers(setup)).toEqual(want)
  })
})

// ── 11. Small rules this round leans on ─────────────────────

describe('Now 3b small rules', () => {
  it('콕: one a day from him, three from her — through the shared reader', () => {
    const s = BASES[0]!.state
    expect(nudgesPerDay(s, PARTNER)).toBe(1)
    expect(nudgesPerDay(s, OWNER)).toBe(3)
    expect(SIGNALS_PER_DAY).toBeGreaterThanOrEqual(1)
  })

  it('every reader of the 둘만의 시간 gate goes through partnerHintState (no screen gates on her untold pause)', () => {
    const files = ['lib/logic/ttcFlow.ts', 'lib/logic/dateIdeas.ts', 'lib/logic/partnerSnapshot.ts']
    let calls = 0
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      for (const line of src.split('\n')) {
        if (!/fertileHintsAllowed\(/.test(line) || /export function fertileHintsAllowed/.test(line) || /^\s*(\/\/|\*)/.test(line)) continue
        calls++
        expect(line, `${f}: ${line.trim()}`).toMatch(/partnerHintState\(/)
      }
    }
    expect(calls).toBe(3)
  })

  it('his month-task 🔔 opens 오늘 while preparing, 챙길 것 otherwise', () => {
    expect(noticeTarget('system', 'preparing', 'deadline:task-test:2026-12-27:7:a')).toBe('today')
    expect(noticeTarget('system', 'preparing', 'deadline:task-visit:abc:a')).toBe('today')
    expect(noticeTarget('system', 'pregnant', 'deadline:task-test:2026-12-27:7:a')).toBe('plan')
    expect(noticeTarget('system', 'preparing', 'deadline:pre-x:2026-12-27:7:a')).toBe('plan')
  })

  it('a booked test bounds [했어요] on his month task itself (partnerTrack agrees with the event gate)', () => {
    let s = setFertilityApplied(couple(starts('2026-06-09', [28, 28])), PARTNER, true, '2026-09-01')
    s = addAppointment(s, { date: '2026-10-14', title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID }, PARTNER)
    expect(monthlyTask(s, '2026-10-04', PARTNER)).toMatchObject({ stage: 'booked', minDoneAt: '2026-10-14' })
    expect(monthlyTask(s, '2026-10-20', PARTNER)).toMatchObject({ stage: 'visited', minDoneAt: '2026-10-14' })
    expect(partnerEventProblem(s, { id: 't1', kind: 'task-done', taskId: FERTILITY_TEST_ID, date: '2026-10-04' }, '2026-10-04')).toBe('date')
  })
})

// ── 12. scripts/verify-supabase.mjs — never the key, a hint for every failure class ──

describe('verify-supabase: never the key, one hint per failure class', () => {
  const URL = 'https://abcdefghij.supabase.co'
  const ANON = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: 'anon', ref: 'abcdefghij' })).toString('base64url')}.sig_ABCDEF123456`

  it('each network failure class and HTTP status gets its own hint', () => {
    const hints = new Set<string>()
    for (const cause of ['timeout', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ENOTFOUND', 'ECONNREFUSED', 'Request was cancelled.'])
      hints.add(V.hintFor({ network: true, cause }))
    for (const status of [400, 401, 403, 404, 409, 500, 418]) hints.add(V.hintFor({ status }))
    // timeout · tls (2 causes, one hint) · dns · refused · blocked + 400 · 401 · 403 · 404 · 409 · 5xx · other
    expect(hints.size).toBe(12)
    expect(V.networkClass('CERT_HAS_EXPIRED')).toBe('tls')
    expect(V.networkClass('getaddrinfo EAI_AGAIN x.supabase.co')).toBe('dns')
    expect(V.hintFor({ network: true, cause: 'SELF_SIGNED_CERT_IN_CHAIN' })).toContain('NODE_EXTRA_CA_CERTS')
    expect(V.hintFor({ network: true, cause: 'SELF_SIGNED_CERT_IN_CHAIN' })).not.toMatch(/rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED=0/)
  })

  it('a key a header cannot carry is refused before any request, without repeating it', () => {
    for (const bad of [`${ANON} `.replace(/ $/, ' x'), `${ANON}"`, `${ANON}한`]) {
      const cfg = V.readSupabaseEnv({ env: { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: bad }, exists: () => false })
      expect(cfg.problems.length).toBeGreaterThan(0)
      expect(cfg.problems.join(' ').includes(bad.trim())).toBe(false)
    }
    expect(V.readSupabaseEnv({ env: { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON }, exists: () => false }).problems).toEqual([])
  })

  it('a fetch error that quotes the header (key and all) is redacted from every step, the result and the table', async () => {
    const quoting = async (_url: string, init: { headers: Record<string, string> }) => {
      throw Object.assign(new TypeError(`Headers.append: "${init.headers.Authorization}" is an invalid header value.`), {
        cause: { message: `invalid header ${init.headers.apikey}` },
      })
    }
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: quoting })
    const table = V.formatTable(r, { url: URL, kind: 'anon', source: '환경 변수', anonKey: ANON })
    expect(JSON.stringify(r).includes(ANON)).toBe(false)
    expect(table.includes(ANON)).toBe(false)
    expect(r.steps[0].result).toBe('FAIL')
    expect(r.steps.slice(1).every((x: { result: string }) => x.result === 'SKIP')).toBe(true)
  })

  it('TLS and DNS failures say what to fix (not "allow *.supabase.co")', async () => {
    for (const [code, word] of [
      ['SELF_SIGNED_CERT_IN_CHAIN', 'NODE_EXTRA_CA_CERTS'],
      ['ENOTFOUND', '프로젝트 이름'],
    ] as const) {
      const failing = async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code } })
      }
      const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: failing })
      expect(r.steps[0].hint, code).toContain(word)
    }
  })

  it('an unexpected crash message is redacted too; no console call in the script prints the key directly', () => {
    expect(V.safeErrorMessage(new Error(`boom ${ANON}`), { NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, DULSET_VERIFY_ENV_FILE: '/nonexistent' })).toBe('boom [숨김]')
    const src = readFileSync(join(ROOT, 'scripts/verify-supabase.mjs'), 'utf8')
    for (const line of src.split('\n').filter((l) => /console\.(log|error|warn|info)\(/.test(l))) {
      expect(line, line.trim()).not.toMatch(/anonKey(?!\])|KEY_NAME\]|ANON_KEY/)
    }
  })
})
