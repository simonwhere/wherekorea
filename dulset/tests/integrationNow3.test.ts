// Now 3 integration — the adversarial pass over N19–N24 and the link-open
// counter (docs/positioning.md §4 '남편 루프의 규칙 다섯', STATUS Now 3):
//
//  1. The inference-leak property on the LINK: for a partner without her
//     details, every day of the seven-day snapshot (N20) is identical with and
//     without any record she did not tell — on the day it happens, and on every
//     later day of the snapshot unless the one shared window itself differs —
//     and outside the shared window a day holds still against the day before.
//     Plus the in-app surfaces tests/leakInference.test.ts does not read: the
//     #date banner, the 둘만의 시간 gate, '이번 주 우리 둘', his doctor card,
//     his plan / appointment notices.
//  2. '날짜 없음' (N23) leaks no band, date or phase anywhere: card, week row,
//     주기 tab (lens, cells, legend), notices, #date, .ics, cover line, link.
//  3. '우리의 주간' is the old 'not shared' minus the leaks and '자세히' is the
//     old 'shared' (the cards, the band, the details) — and an old save with
//     the yes/no migrates to the same screens as the matching level.
//  4. '이번 주 우리 둘' (N21): no timing / test words, never a zero, quiet after
//     a loss, nothing for the owner or outside the preparing stage.
//  5. Partner events (N21/N22): 'setup' takes only its enumerated values,
//     every event applies once; the first run answered on the link is not
//     asked again in the app.
//  6. The counter sends the token only and keeps (couple, day) → count; no
//     screen reads it back.
// Seeded where random, so a failure reproduces.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import {
  cellView,
  cycleLens,
  cyclePause,
  cycleSummary,
  dayChanceFor,
  explainDayFor,
  icsAvailability,
  legendItems,
  lensPhase,
  monthConfidence,
  phaseLabel,
} from '@/lib/logic/calendarView'
import { startClinicMode } from '@/lib/logic/clinic'
import { heroLine } from '@/lib/logic/cover'
import { dayInfo, setPeriodEnd, type CycleInput } from '@/lib/logic/cycle'
import { sharedWeek } from '@/lib/logic/cycleRing'
import { dateBanner, fertileHintsAllowed } from '@/lib/logic/dateIdeas'
import { addEntry } from '@/lib/logic/diary'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { logPeriodStart } from '@/lib/logic/logs'
import { WEEK_THANKS_BODY, scheduledNotices, sendWeekThanks, weekThanksNoticeKey } from '@/lib/logic/notifications'
import { PARTNER_SETUP_KEY, needsPartnerFirstRun } from '@/lib/logic/onboarding'
import {
  SETUP_ALERT_STYLES,
  SETUP_DRINKS,
  applyPartnerEvent,
  cleanPartnerEvent,
  partnerEventProblem,
  type PartnerEvent,
} from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, linkWeek, type PartnerDay } from '@/lib/logic/partnerSnapshot'
import { setEntryPrivacy, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { appointmentReminders, planDeadlineNotices } from '@/lib/logic/planNotices'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import {
  canSeeCycleDetails,
  canSeeWeekBand,
  setPersonalPref,
  setShareLevel,
  settingsFor,
  setUsesLH,
  shareLevelOf,
  withShareLevelAtMost,
} from '@/lib/logic/prefs'
import { sanitizeBackup } from '@/lib/logic/settings'
import { receivedReply, sendSignal } from '@/lib/logic/signals'
import { doctorAdvice, endPregnancy } from '@/lib/logic/today'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import { cycleStrip, markStillWaiting, skipTellPartnerPeriod, ttcMoment } from '@/lib/logic/ttcFlow'
import {
  CLINIC_DAY_OPTION,
  WEEK_OPTIONS,
  WEEK_SUMMARY_MAX,
  canThankWeek,
  markWeekDone,
  partnerWeekSummary,
  pickWeek,
  thankWeek,
  thanksThisWeek,
  weekOf,
  weekOptions,
} from '@/lib/logic/weekTogether'
import { parseState } from '@/lib/storage'
import { countLinkOpen, openDaysBetween, type LinkOpenCounts } from '@/lib/sync/linkOpens'
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '@/lib/sync/migrations'
import { createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import type { AlertStyle, AppState, ISODate, MemberId, PeriodLog, ShareLevel } from '@/lib/types'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OWNER = 'b' as const
const PARTNER = 'a' as const
const stamp = (d: ISODate) => `${d}T21:00:00+09:00`

// ── Fixtures ────────────────────────────────────────────────

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

const starts = (first: ISODate, lengths: number[]): PeriodLog[] => {
  const out: PeriodLog[] = [{ start: first }]
  for (const n of lengths) out.push({ start: addDays(out[out.length - 1]!.start, n) })
  return out
}

const BASES: ReadonlyArray<{ name: string; state: AppState }> = [
  { name: 'regular 28', state: couple(starts('2026-06-09', [28, 28, 28])) },
  { name: 'short 23', state: couple(starts('2026-06-20', [23, 23, 23, 23]), { cycle: { cycleLength: 23, periodLength: 5 } as AppState['cycle'] }) },
  { name: 'long 34', state: couple(starts('2026-05-20', [34, 34, 34]), { cycle: { cycleLength: 34, periodLength: 5 } as AppState['cycle'] }) },
  { name: 'irregular', state: couple(starts('2026-05-02', [26, 33, 29, 31])) },
  {
    name: 'LH user',
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

interface PartnerLens {
  share: ShareLevel
  style: AlertStyle
  lowPressure?: boolean
}

const NO_DETAIL_LENSES: readonly PartnerLens[] = [
  { share: 'week', style: 'soft' },
  { share: 'week', style: 'explicit' },
  { share: 'week', style: 'off' },
  { share: 'week', style: 'soft', lowPressure: true },
  { share: 'none', style: 'soft' },
  { share: 'none', style: 'explicit' },
]

function withLens(s: AppState, l: PartnerLens): AppState {
  let out = setShareLevel(s, OWNER, l.share)
  out = { ...out, settings: { ...out.settings, alertStyle: { ...out.settings.alertStyle, [PARTNER]: l.style } } }
  return setPersonalPref(out, PARTNER, 'lowPressure', !!l.lowPressure)
}

const tag = (l: PartnerLens) => `${l.share}/${l.style}${l.lowPressure ? '/lp' : ''}`

const DAYS = (from: ISODate, to: ISODate, step = 1): ISODate[] => {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, step)) out.push(d)
  return out
}

const lastStart = (s: AppState, d: ISODate) => [...s.periods].map((p) => p.start).filter((x) => x <= d).sort().pop()

type Untold = { name: string; when?: (s: AppState, d: ISODate) => boolean; add: (s: AppState, d: ISODate) => AppState }

/** Records she did not tell him about (the ones a date can carry). */
/**
 * Outside the shared window: a period logged inside it, or a pause she starts inside it (a rest, a
 * positive test), ends it for him too — the documented residuals (lib/logic/cycleRing.ts
 * 'Residuals', pinned in tests/leakInference.test.ts). A test inside the window is too early anyway.
 */
const offWindow = (s: AppState, d: ISODate) => !sharedWeek(s, d) && !sharedWeek(s, addDays(d, -1))

const UNTOLD: readonly Untold[] = [
  { name: 'period start (today)', when: offWindow, add: (s, d) => logPeriodStart(s, d, OWNER, d) },
  { name: 'period start (logged a day late)', when: offWindow, add: (s, d) => logPeriodStart(s, addDays(d, -1), OWNER, d) },
  { name: 'period end', when: (s, d) => !!lastStart(s, d) && diffDays(lastStart(s, d)!, d) < 7, add: (s, d) => setPeriodEnd(s, lastStart(s, d)!, d) },
  { name: 'LH surge', add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: addDays(d, -1), result: 'faint' as const }, { date: d, result: 'positive' as const }] }) },
  { name: 'LH peak', add: (s, d) => ({ ...s, lhTests: [...s.lhTests, { date: d, result: 'peak' as const }] }) },
  { name: 'negative test', add: (s, d) => ({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `neg-${d}`, date: d, result: 'negative' as const, by: OWNER }] }) },
  {
    name: 'positive test (untold)',
    when: offWindow,
    add: (s, d) =>
      markPositivePending({ ...s, pregnancyTests: [...s.pregnancyTests, { id: `pos-${d}`, date: d, result: 'positive' as const, by: OWNER }] }, d, `pos-${d}`),
  },
  {
    name: 'bleeding after an untold positive',
    when: (s, d) => offWindow(s, d) && offWindow(s, addDays(d, -2)),
    add: (s, d) => markBleeding(markPositivePending(s, addDays(d, -2)), d),
  },
  { name: '오늘 컨디션', add: (s, d) => setFeel(s, OWNER, d, 'tired') },
  { name: '나만 보기 note', add: (s, d) => setPrivateNote(s, OWNER, d, '혼자 생각하고 싶어요') },
  {
    name: '나만 보기 diary entry',
    add: (s, d) => setEntryPrivacy(addEntry(s, { id: `secret-${d}`, date: d, author: OWNER, text: '혼자만 볼 이야기' }, stamp(d)), `secret-${d}`, OWNER, true),
  },
  { name: 'rest (outside the shared window)', when: (s, d) => !sharedWeek(s, d), add: (s, d) => startRestCycle(s, d, 'rest') },
  { name: '아직 안 왔어요', when: (s, d) => !!lastStart(s, d), add: (s, d) => markStillWaiting(s, lastStart(s, d)!, d) },
  { name: '관계일', add: (s, d) => toggleIntimacyDay(giveIntimacyConsent(s, OWNER, d), OWNER, d, d) },
  { name: '알릴까요? — 괜찮아요', when: (s, d) => !!lastStart(s, d), add: (s, d) => skipTellPartnerPeriod(s, lastStart(s, d)!, stamp(d)) },
  { name: '배테기 안 써요', add: (s) => setUsesLH(s, false, OWNER) },
]

/** What a snapshot day draws from her cycle: the card, the band, the ideas (the rest is his own or date-bound). */
function cycleFace(day: PartnerDay) {
  return { moment: day.moment, strip: day.strip, ideas: day.ideas }
}

const sameShared = (a: AppState, b: AppState, d: ISODate) => JSON.stringify(sharedWeek(a, d) ?? null) === JSON.stringify(sharedWeek(b, d) ?? null)

// ── 1. The inference-leak property on the link (N19 × N20) ──

describe('N19 × N20: an untold record never changes any day of the seven-day link', () => {
  for (const base of BASES) {
    it(
      `${base.name}: every lens × every fourth day × every untold record — all seven days`,
      () => {
        let compared = 0
        let futureCompared = 0
        const used = new Set<string>()
        for (const lens of NO_DETAIL_LENSES) {
          const s0 = withLens(base.state, lens)
          for (const d of DAYS('2026-08-27', '2026-10-24', 4)) {
            const snap0 = buildPartnerSnapshot(s0, d, PARTNER)!
            for (const r of UNTOLD) {
              if (r.when && !r.when(s0, d)) continue
              const s1 = r.add(s0, d)
              if (s1 === s0) continue
              const snap1 = buildPartnerSnapshot(s1, d, PARTNER)!
              const where = `${base.name} · ${tag(lens)} · ${d} · ${r.name}`
              // The day it happens: the whole page is the same.
              expect(snap1.days[0], where).toEqual(snap0.days[0])
              // Every later day of the snapshot: the same unless the one shared window itself moved
              // (a new period start moves the next 우리의 주간 — that window is what she shares).
              for (let k = 1; k < snap0.days.length; k++) {
                const x = addDays(d, k)
                if (!sameShared(s0, s1, x) || !sameShared(s0, s1, addDays(x, -1))) continue
                expect(snap1.days[k], `${where} · day +${k}`).toEqual(snap0.days[k])
                futureCompared++
              }
              // The shared fields too (stage, members, the signals he may send).
              const { days: _d0, ...shared0 } = snap0
              const { days: _d1, ...shared1 } = snap1
              expect(shared1, where).toEqual(shared0)
              used.add(r.name)
              compared++
            }
          }
        }
        expect(compared).toBeGreaterThan(300)
        expect(futureCompared).toBeGreaterThan(compared * 3)
        if (base.name === 'regular 28') expect(used.size).toBe(UNTOLD.length)
      },
      120_000,
    )
  }

  it('outside the shared window a pre-rendered day holds still against the day before it', () => {
    let held = 0
    for (const base of BASES) {
      for (const lens of NO_DETAIL_LENSES) {
        const s = withLens(base.state, lens)
        for (const d of DAYS('2026-08-27', '2026-10-24', 5)) {
          const snap = buildPartnerSnapshot(s, d, PARTNER)!
          for (let k = 1; k < snap.days.length; k++) {
            const x = addDays(d, k)
            if (sharedWeek(s, x) || sharedWeek(s, addDays(x, -1))) continue
            expect(cycleFace(snap.days[k]!), `${base.name} · ${tag(lens)} · ${d} +${k}`).toEqual(cycleFace(snap.days[k - 1]!))
            held++
          }
        }
      }
    }
    expect(held).toBeGreaterThan(1000)
  })

  it('a pre-rendered day equals the page built on that day (the forecast never says more than the day itself)', () => {
    for (const base of BASES) {
      for (const lens of NO_DETAIL_LENSES) {
        const s = withLens(base.state, lens)
        for (const d of DAYS('2026-08-27', '2026-10-24', 6)) {
          const snap = buildPartnerSnapshot(s, d, PARTNER)!
          for (let k = 1; k < snap.days.length; k++) {
            const sameDay = buildPartnerSnapshot(s, addDays(d, k), PARTNER)!.days[0]!
            expect(cycleFace(snap.days[k]!), `${base.name} · ${tag(lens)} · ${d} +${k}`).toEqual(cycleFace(sameDay))
          }
        }
      }
    }
  })
})

describe('N19: the in-app surfaces leakInference does not read hold still too', () => {
  /**
   * #date banner, his week block, his doctor card, his plan and appointment notices, a reply on his
   * home. (fertileHintsAllowed itself is only a gate — inside the shared window, which these
   * records never open, it decides the ideas; no screen renders it on its own.)
   */
  function extraView(s: AppState, d: ISODate) {
    return {
      banner: dateBanner(s, d, PARTNER),
      hints: !!sharedWeek(s, d) && fertileHintsAllowed(s, PARTNER, d),
      week: weekOptions(s, d, PARTNER).map((o) => o.id),
      linkWeek: linkWeek(s, d, PARTNER, true) ?? null,
      doctor: doctorAdvice(s, d, PARTNER),
      plan: planDeadlineNotices(s, d).filter((n) => n.to === PARTNER),
      appts: appointmentReminders(s, d).filter((n) => n.to === PARTNER),
      reply: receivedReply(s, PARTNER, d) ?? null,
      // The 주기 tab's day sheet for the days around (label, explanation, chance) — components/cycle/DaySheet.
      daySheet: DAYS(addDays(d, -3), addDays(d, 10)).map((date) => {
        const lens = cycleLens(s, PARTNER, d)
        const info = dayInfo(s, date, d)
        return [phaseLabel(lensPhase(info.phase, lens, date), lens.view), explainDayFor(info, lens, date < d), dayChanceFor(info, lens)]
      }),
    }
  }

  it('every base × lens × every third day × every untold record — identical', () => {
    let compared = 0
    for (const base of BASES) {
      for (const lens of NO_DETAIL_LENSES) {
        const s0 = withLens(base.state, lens)
        for (const d of DAYS('2026-08-27', '2026-10-24', 3)) {
          const before = extraView(s0, d)
          for (const r of UNTOLD) {
            if (r.when && !r.when(s0, d)) continue
            const s1 = r.add(s0, d)
            if (s1 === s0) continue
            expect(extraView(s1, d), `${base.name} · ${tag(lens)} · ${d} · ${r.name}`).toEqual(before)
            compared++
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(2000)
  }, 120_000)

  it('his day sheet agrees with his calendar cell: 우리의 주간 inside his one window, the same plain line on every other day', () => {
    for (const base of BASES) {
      const s = withLens(base.state, { share: 'week', style: 'soft' })
      for (const d of DAYS('2026-08-27', '2026-10-24', 3)) {
        const lens = cycleLens(s, PARTNER, d)
        const info = dayInfo(s, d, d)
        const inBand = lensPhase(info.phase, lens, d) === 'fertile'
        expect(inBand, `${base.name} · ${d}`).toBe(sharedWeek(s, d)?.kind === 'window')
        expect(explainDayFor(info, lens, false).startsWith('우리의 주간'), `${base.name} · ${d}`).toBe(inBand)
      }
    }
  })

  it('no frequency line ever reaches him — at any sharing level, in any card, notice, day sheet, summary or link day', () => {
    const FREQUENCY = /2~3일에 한 번|하루나 이틀에 한 번|이틀에 한 번|일에 한 번이면/
    const lenses: PartnerLens[] = [...NO_DETAIL_LENSES, { share: 'details', style: 'explicit' }, { share: 'details', style: 'soft' }, { share: 'details', style: 'off' }]
    for (const base of BASES) {
      for (const l of lenses) {
        const s = withLens(base.state, l)
        for (const d of DAYS('2026-08-27', '2026-10-24', 2)) {
          const lens = cycleLens(s, PARTNER, d)
          const summary = cycleSummary(s, d, lens.view, lens)
          const texts = [
            JSON.stringify(ttcMoment(s, d, PARTNER)),
            JSON.stringify(scheduledNotices(s, d).filter((n) => n.to === PARTNER)),
            explainDayFor(dayInfo(s, d, d), lens, false),
            JSON.stringify(summary.headline),
            JSON.stringify(summary.rows),
          ]
          for (const t of texts) expect(t, `${base.name} · ${tag(l)} · ${d}`).not.toMatch(FREQUENCY)
        }
        for (const d of DAYS('2026-08-27', '2026-10-24', 7)) {
          expect(JSON.stringify(buildPartnerSnapshot(s, d, PARTNER)), `${base.name} · ${tag(l)} · link ${d}`).not.toMatch(FREQUENCY)
        }
      }
    }
  }, 120_000)

  it('the #date banner says 우리의 주간 to him exactly when his home does (the one shared window), never on period days 1–3', () => {
    for (const base of BASES) {
      const s = withLens(base.state, { share: 'week', style: 'soft' })
      for (const d of DAYS('2026-08-20', '2026-11-10')) {
        const home = ttcMoment(s, d, PARTNER)?.copy
        const ourWeek = home === 'partner.our-week' || home === 'partner.our-week-soon'
        expect(dateBanner(s, d, PARTNER).kind === 'our-week', `${base.name} · ${d}`).toBe(ourWeek)
        expect(ourWeek, `${base.name} · ${d}`).toBe(!!sharedWeek(s, d))
      }
    }
  })
})

// ── 2. '날짜 없음' leaks nothing anywhere (N23) ─────────────

// '가임력 검사' is his own month task (the 임신 사전건강관리 chain), not a window word.
const WINDOW_WORDS = /우리의 주간|가임(?!력)|배란|LH|배테기|생리 예정|예정일|피크|가능성|D-\d/
const NONE_COPIES = new Set(['partner.neutral', 'partner.clinic', 'partner.after-loss'])

describe("N23 '날짜 없음': no band, no date, no phase — anywhere he looks", () => {
  const STYLES: ReadonlyArray<{ style: AlertStyle; lowPressure?: boolean }> = [
    { style: 'explicit' },
    { style: 'soft' },
    { style: 'off' },
    { style: 'soft', lowPressure: true },
  ]
  const extras: ReadonlyArray<{ name: string; state: AppState }> = [
    ...BASES,
    { name: 'clinic', state: startClinicMode(couple(starts('2026-06-09', [28, 28, 28])), '2026-09-05') },
    { name: 'after a loss', state: endPregnancy({ ...couple(starts('2026-06-09', [28, 28])), stage: 'pregnant' as const }, '2026-09-20') },
  ]

  for (const base of extras) {
    it(`${base.name}: card, row, 주기 tab, notices, #date, .ics, cover, link`, () => {
      for (const st of STYLES) {
        const s = withLens(base.state, { share: 'none', ...st })
        expect(canSeeWeekBand(s, PARTNER)).toBe(false)
        expect(canSeeCycleDetails(s, PARTNER)).toBe(false)
        const input: CycleInput = { periods: s.periods, lhTests: s.lhTests, cycle: s.cycle, pregnancy: s.pregnancy, cycleNotes: s.cycleNotes }
        for (const d of DAYS('2026-08-20', '2026-11-10')) {
          const where = `${base.name} · ${st.style}${st.lowPressure ? '/lp' : ''} · ${d}`
          // The home card and the week row.
          const m = ttcMoment(s, d, PARTNER)
          if (m) {
            expect(NONE_COPIES.has(m.copy), `${where} · ${m.copy}`).toBe(true)
            expect(m.dateIdeas ?? false, where).toBe(false)
            expect([m.eyebrow, m.title, m.body, m.note, m.partnerTip].join(' '), where).not.toMatch(WINDOW_WORDS)
            expect(m.cycleDay, where).toBeUndefined()
            expect(m.cycleStart, where).toBeUndefined()
          }
          expect(cycleStrip(s, d, PARTNER), where).toBeNull()
          // The 주기 tab: the lens, every cell of the month, the legend.
          const lens = cycleLens(s, PARTNER, d)
          expect(lens.view, where).toBe('hidden')
          expect(lens.details, where).toBe(false)
          expect(lens.band ?? null, where).toBeNull()
          const cells = DAYS(addDays(d, -10), addDays(d, 20), 3).map((date) =>
            cellView(dayInfo(input, date, d), { month: `${d.slice(0, 7)}-01`, today: d, view: lens.view, lens }),
          )
          for (const c of cells) {
            expect(c.phase, `${where} · ${c.date}`).toBe('none')
            expect(c.star, where).toBe(false)
            expect(c.lh ?? null, where).toBeNull()
            expect(c.ptest ?? null, where).toBeNull()
            expect(c.ariaLabel, where).not.toMatch(WINDOW_WORDS)
          }
          expect(legendItems(lens.view, lens, { confidence: monthConfidence(cells) }), where).toEqual([])
          // His notices: none about the window.
          for (const n of scheduledNotices(s, d).filter((x) => x.to === PARTNER)) {
            expect(n.kind === 'fertile-start' || n.kind === 'peak', `${where} · ${n.key}`).toBe(false)
            expect(`${n.title} ${n.body}`, `${where} · ${n.key}`).not.toMatch(WINDOW_WORDS)
          }
          // #date, the 둘만의 시간 gate, the phone calendar.
          expect(fertileHintsAllowed(s, PARTNER, d), where).toBe(false)
          expect(dateBanner(s, d, PARTNER).kind, where).not.toBe('our-week')
          const ics = icsAvailability(s, d, settingsFor(s.settings, PARTNER), lens.view, cyclePause(s, d))
          expect(ics.enabled, where).toBe(false)
          expect(ics.windows, where).toEqual([])
          // The cover line.
          expect(heroLine(s, d, PARTNER, 9).text, where).not.toMatch(WINDOW_WORDS)
        }
        // The link: every day of every snapshot.
        for (const d of DAYS('2026-08-20', '2026-11-10', 7)) {
          const snap = buildPartnerSnapshot(s, d, PARTNER)!
          for (const day of snap.days) {
            const where = `${base.name} · link ${d} → ${day.date}`
            expect(day.strip, where).toBeNull()
            expect(day.ideas, where).toEqual([])
            if (day.moment) expect(NONE_COPIES.has(day.moment.copy), `${where} · ${day.moment.copy}`).toBe(true)
            expect(JSON.stringify(day), where).not.toMatch(WINDOW_WORDS)
          }
        }
      }
    })
  }

  it('her own screens are untouched by 날짜 없음 (it narrows his lens only)', () => {
    for (const base of BASES) {
      const none = withLens(base.state, { share: 'none', style: 'soft' })
      const week = withLens(base.state, { share: 'week', style: 'soft' })
      for (const d of DAYS('2026-08-27', '2026-10-24', 2)) {
        expect(ttcMoment(none, d, OWNER), `${base.name} · ${d}`).toEqual(ttcMoment(week, d, OWNER))
        expect(cycleStrip(none, d, OWNER), `${base.name} · ${d}`).toEqual(cycleStrip(week, d, OWNER))
        expect(cycleLens(none, OWNER, d), `${base.name} · ${d}`).toEqual(cycleLens(week, OWNER, d))
        expect(scheduledNotices(none, d).filter((n) => n.to === OWNER)).toEqual(scheduledNotices(week, d).filter((n) => n.to === OWNER))
        expect(dateBanner(none, d, OWNER)).toEqual(dateBanner(week, d, OWNER))
      }
    }
  })
})

// ── 3. The levels against the old yes/no, and old saves ─────

describe("N23 levels: '우리의 주간' = the old 'not shared' minus the leaks, '자세히' = the old 'shared'", () => {
  const s = couple(starts('2026-06-09', [28, 28, 28]))

  it("'자세히': the shared waiting and late cards, the band on every day, the details in his 주기 tab", () => {
    const details = withLens(s, { share: 'details', style: 'explicit' })
    expect(canSeeCycleDetails(details, PARTNER)).toBe(true)
    // 09-01 cycle: window 09-10…09-15, waiting after it, due 09-29.
    expect(ttcMoment(details, '2026-09-20', PARTNER)!.copy).toBe('partner.tww')
    expect(cycleStrip(details, '2026-09-20', PARTNER)).not.toBeNull()
    const lens = cycleLens(details, PARTNER, '2026-09-20')
    expect(lens.details).toBe(true)
    expect(lens.view).toBe('explicit')
    // Late (nothing logged since 09-01): the shared late card.
    expect(ttcMoment(details, '2026-10-03', PARTNER)!.copy).toBe('partner.late-shared')
    // The explicit notice names the dates — and gives him no LH homework (N24).
    const notice = scheduledNotices(details, '2026-09-09').find((n) => n.to === PARTNER && n.kind === 'fertile-start')!
    expect(notice.body).toMatch(/9월 10일.*9월 15일/)
    expect(notice.body).not.toMatch(/LH|배란테스트/)
  })

  it("'우리의 주간': the window and its lead days only — the waiting and late days are the one 평소 주", () => {
    const week = withLens(s, { share: 'week', style: 'explicit' })
    expect(canSeeWeekBand(week, PARTNER)).toBe(true)
    expect(canSeeCycleDetails(week, PARTNER)).toBe(false)
    expect(ttcMoment(week, '2026-09-08', PARTNER)!.copy).toBe('partner.our-week-soon')
    expect(ttcMoment(week, '2026-09-12', PARTNER)!.copy).toBe('partner.our-week')
    expect(cycleStrip(week, '2026-09-12', PARTNER)).not.toBeNull()
    for (const d of ['2026-09-17', '2026-09-20', '2026-09-28', '2026-09-29', '2026-10-03']) {
      expect(ttcMoment(week, d, PARTNER)!.copy, d).toBe('partner.neutral')
      expect(cycleStrip(week, d, PARTNER), d).toBeNull()
    }
    // Explicit style without details reads as 은근하게: no dates in the notice.
    const notice = scheduledNotices(week, '2026-09-09').find((n) => n.to === PARTNER && n.kind === 'fertile-start')!
    expect(notice.body).not.toMatch(/\d+월 \d+일/)
  })

  it('the link band under 자세히 is exactly the 우리의 주간 band (linkState), on every day of every snapshot', () => {
    for (const base of BASES) {
      const details = withLens(base.state, { share: 'details', style: 'explicit' })
      const week = withLens(base.state, { share: 'week', style: 'explicit' })
      for (const d of DAYS('2026-08-27', '2026-10-24', 3)) {
        const a = buildPartnerSnapshot(details, d, PARTNER)!.days
        const b = buildPartnerSnapshot(week, d, PARTNER)!.days
        a.forEach((day, k) => expect(day.strip, `${base.name} · ${d} +${k}`).toEqual(b[k]!.strip))
      }
    }
  })

  it('a pre-rendered day never shows a change only a predicted period would bring — not even to a 자세히 partner', () => {
    let lateAhead = 0
    for (const base of BASES) {
      const details = withLens(base.state, { share: 'details', style: 'explicit' })
      for (const d of DAYS('2026-08-27', '2026-10-24', 2)) {
        const snap = buildPartnerSnapshot(details, d, PARTNER)!
        if (snap.days[0]!.moment?.copy === 'partner.late-shared') continue
        for (let k = 1; k < snap.days.length; k++) {
          const day = snap.days[k]!
          expect(day.moment?.copy, `${base.name} · ${d} +${k}`).not.toBe('partner.late-shared')
          // …even where the page built on that day would say it.
          if (buildPartnerSnapshot(details, day.date, PARTNER)!.days[0]!.moment?.copy === 'partner.late-shared') lateAhead++
        }
      }
    }
    expect(lateAhead).toBeGreaterThan(10)
  })

  it('the link never carries more than 우리의 주간 in its band, whatever she shares in the app', () => {
    for (const share of ['none', 'week', 'details'] as const) {
      const st = withLens(s, { share, style: 'explicit' })
      for (const d of DAYS('2026-09-01', '2026-10-10', 3)) {
        for (const day of buildPartnerSnapshot(st, d, PARTNER)!.days) {
          if (!day.strip) continue
          expect(share, `${share} · ${day.date}`).not.toBe('none')
          expect(day.strip.mode).toBe('weeks')
          expect(day.strip.days.every((x) => x.tone === 'none' || x.tone === 'fertile'), `${share} · ${day.date}`).toBe(true)
          expect(JSON.stringify(day.strip)).not.toMatch(/period|lh|surge|peak/)
        }
      }
      expect(shareLevelOf(withShareLevelAtMost(st, 'week'))).toBe(share === 'none' ? 'none' : 'week')
    }
  })

  /** A schema-3 save as an older phone kept it: the yes/no, no shareLevel. */
  function v3Blob(base: AppState, legacy: unknown): string {
    const { shareLevel: _l, ...settings } = base.settings
    const out = { ...base, schemaVersion: 3, settings: legacy === undefined ? settings : { ...settings, shareCycleDetails: legacy } }
    return JSON.stringify(out)
  }

  function partnerScreens(st: AppState) {
    return DAYS('2026-09-01', '2026-10-10', 2).map((d) => ({
      moment: ttcMoment(st, d, PARTNER),
      strip: cycleStrip(st, d, PARTNER),
      lens: cycleLens(st, PARTNER, d),
      notices: scheduledNotices(st, d).filter((n) => n.to === PARTNER),
      link: buildPartnerSnapshot(st, d, PARTNER)!.days[0],
    }))
  }

  it('an old save migrates to exactly the screens of the matching level (true → 자세히, false / unset / junk → 우리의 주간)', () => {
    const base = withLens(couple(starts('2026-06-09', [28, 28, 28])), { share: 'week', style: 'explicit' })
    const cases: Array<[unknown, ShareLevel]> = [
      [true, 'details'],
      [false, 'week'],
      [undefined, 'week'],
      ['true', 'week'],
      [1, 'week'],
      [null, 'week'],
    ]
    for (const [legacy, level] of cases) {
      const loaded = parseState(v3Blob(base, legacy))!
      expect(loaded.schemaVersion, String(legacy)).toBe(SCHEMA_VERSION)
      expect(shareLevelOf(loaded), String(legacy)).toBe(level)
      expect('shareCycleDetails' in loaded.settings, String(legacy)).toBe(false)
      expect(partnerScreens(loaded), String(legacy)).toEqual(partnerScreens(setShareLevel(base, OWNER, level)))
      // Idempotent: loading the migrated save again changes nothing.
      expect(parseState(JSON.stringify(loaded)), String(legacy)).toEqual(loaded)
      expect(migrate(loaded)).toEqual(loaded)
    }
    expect(MIGRATIONS.map((m) => [m.from, m.to])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ])
  })

  it('a schema-4 save never widens: a stray yes beside a level is dropped, a bad level reads as 우리의 주간', () => {
    const base = couple(starts('2026-06-09', [28, 28, 28]))
    const none = { ...base, settings: { ...base.settings, shareLevel: 'none', shareCycleDetails: true } } as unknown as AppState
    const kept = parseState(JSON.stringify(none))!
    expect(shareLevelOf(kept)).toBe('none')
    expect('shareCycleDetails' in kept.settings).toBe(false)
    const bad = { ...base, settings: { ...base.settings, shareLevel: 'everything' } } as unknown as AppState
    expect(shareLevelOf(parseState(JSON.stringify(bad))!)).toBe('week')
    expect(shareLevelOf(sanitizeBackup(bad)!)).toBe('week')
    // Only the cycle owner sets it.
    expect(setShareLevel(base, PARTNER, 'details')).toBe(base)
    expect(setShareLevel(base, OWNER, 'bogus' as ShareLevel)).toBe(base)
  })
})

// ── 4. '이번 주 우리 둘' (N21) ───────────────────────────────

const TIMING_WORDS = /가임|배란|우리의 주간|LH|배테기|테스트|임테기|생리|관계|시도|타이밍|횟수|숙제|노력|실패|오늘 꼭|임신|주기/

describe("N21 '이번 주 우리 둘': relationship-side, never a zero, quiet after a loss", () => {
  it('the catalogue and every week’s three picks carry no timing, test or banned word', () => {
    for (const o of [...WEEK_OPTIONS, CLINIC_DAY_OPTION]) {
      expect(`${o.text} ${o.doneText}`, o.id).not.toMatch(TIMING_WORDS)
    }
    const couples = ['2026-08-01T09:00:00+09:00', '2025-01-15T22:10:00+09:00', '2026-03-03T07:00:00Z'].map((createdAt) => ({
      ...couple(starts('2026-06-09', [28, 28, 28])),
      createdAt,
    }))
    for (const c of couples) {
      const seen = new Set<string>()
      for (const d of DAYS('2026-01-05', '2027-01-04', 7)) {
        const opts = weekOptions(c, d, PARTNER)
        expect(opts).toHaveLength(3)
        expect(new Set(opts.map((o) => o.id)).size).toBe(3)
        // The same three all week, on either phone (pure), whatever her records.
        expect(weekOptions(c, addDays(d, 6), PARTNER)).toEqual(opts)
        expect(weekOptions(logPeriodStart(c, d, OWNER, d), d, PARTNER)).toEqual(opts)
        opts.forEach((o) => seen.add(o.id))
        // Nothing for her, outside the preparing stage.
        expect(weekOptions(c, d, OWNER)).toEqual([])
        expect(weekOptions({ ...c, stage: 'pregnant' }, d, PARTNER)).toEqual([])
        expect(weekOptions({ ...c, stage: 'parenting' }, d, PARTNER)).toEqual([])
      }
      // The rotation reaches the whole catalogue over a year.
      expect(seen.size).toBe(WEEK_OPTIONS.length)
    }
  })

  it('the clinic-day pick comes only in a week with an appointment they both go to', () => {
    let s = couple(starts('2026-06-09', [28, 28, 28]))
    const plain = weekOptions(s, '2026-10-05', PARTNER)
    expect(plain.some((o) => o.id === 'clinic-day')).toBe(false)
    const hers = addAppointment(s, { date: '2026-10-07', time: '09:00', title: '진료', place: '', who: OWNER, kind: 'hospital', note: '' }, OWNER)
    expect(weekOptions(hers, '2026-10-05', PARTNER)).toEqual(plain)
    s = addAppointment(s, { date: '2026-10-07', time: '09:00', title: '진료', place: '', who: 'both', kind: 'hospital', note: '메모' }, OWNER)
    const withClinic = weekOptions(s, '2026-10-05', PARTNER)
    expect(withClinic[2]).toEqual(CLINIC_DAY_OPTION)
    expect(withClinic.slice(0, 2)).toEqual(plain.slice(0, 2))
    expect(JSON.stringify(linkWeek(s, '2026-10-05', PARTNER, true))).not.toContain('메모')
  })

  it('her summary of his week: up to three lines, each counting something (≥ 1), nothing for a week with nothing — random weeks', () => {
    let seed = 20261003
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const base = couple(starts('2026-06-09', [28, 28, 28]))
    const walk = base.checkItems.find((i) => i.owner === PARTNER && i.cadence !== 'weekly')!
    for (let run = 0; run < 120; run++) {
      const monday = addDays('2026-09-07', 7 * Math.floor(rnd() * 6))
      const today = addDays(monday, Math.floor(rnd() * 7))
      let s = base
      const days = DAYS(monday, today)
      // Some of: his walks, a pick + [했어요], a reply to her signal, a signal of his.
      if (rnd() < 0.5)
        for (const d of days) if (rnd() < 0.5) s = { ...s, checkLog: { ...s.checkLog, [d]: { ...(s.checkLog[d] ?? {}), [PARTNER]: [walk.id] } } }
      if (rnd() < 0.4) {
        const o = weekOptions(s, monday, PARTNER)[Math.floor(rnd() * 3)]!
        s = pickWeek(s, PARTNER, o.id, monday)
        if (rnd() < 0.6) s = markWeekDone(s, PARTNER, today)
      }
      if (rnd() < 0.3) {
        s = sendSignal(s, OWNER, PARTNER, 'rest', monday, `${monday}T08:00:00+09:00`)
        s = sendSignal(s, PARTNER, OWNER, 'yes', monday, `${monday}T09:00:00+09:00`)
      }
      if (rnd() < 0.2) s = sendSignal(s, PARTNER, OWNER, 'dinner', today, `${today}T19:00:00+09:00`)
      const lines = partnerWeekSummary(s, today, PARTNER)
      expect(lines.length).toBeLessThanOrEqual(WEEK_SUMMARY_MAX)
      for (const l of lines) {
        if (l.count !== undefined) expect(l.count, l.text).toBeGreaterThanOrEqual(1)
        expect(l.text).not.toMatch(/(^|\s)0(일|번|개)|안 했|못 했/)
        expect(l.text).not.toMatch(TIMING_WORDS)
      }
      // Thanks only for a week with something in it.
      expect(canThankWeek(s, OWNER, today)).toBe(lines.length > 0)
      if (!lines.length) expect(thankWeek(s, OWNER, today)).toBe(s)
    }
    // A week with nothing: no line (no '0'), no button.
    expect(partnerWeekSummary(base, '2026-10-03', PARTNER)).toEqual([])
    expect(canThankWeek(base, OWNER, '2026-10-03')).toBe(false)
  })

  it('the 42 days after a pregnancy ended: no picks, no summary, no thanks, no week taps — on the app and the link', () => {
    const before = couple(starts('2026-06-09', [28, 28]))
    const ended = endPregnancy({ ...before, stage: 'pregnant' as const, pregnancy: { lmp: '2026-08-04' } as AppState['pregnancy'] }, '2026-09-20')
    expect(ended.stage).toBe('preparing')
    const offered = weekOptions(before, '2026-09-21', PARTNER)[0]!
    for (const d of DAYS('2026-09-20', addDays('2026-09-20', 41))) {
      expect(weekOptions(ended, d, PARTNER), d).toEqual([])
      expect(partnerWeekSummary(ended, d, PARTNER), d).toEqual([])
      expect(canThankWeek(ended, OWNER, d), d).toBe(false)
      expect(thankWeek(ended, OWNER, d), d).toBe(ended)
      expect(thanksThisWeek(ended, PARTNER, d), d).toBeUndefined()
      expect(pickWeek(ended, PARTNER, offered.id, d), d).toBe(ended)
      expect(markWeekDone(ended, PARTNER, d), d).toBe(ended)
      const pick: PartnerEvent = { id: `p-${d}`, kind: 'week-pick', optionId: offered.id, date: d }
      expect(applyPartnerEvent(ended, pick, d), d).toBe(ended)
      expect(applyPartnerEvent(ended, { id: `w-${d}`, kind: 'week-done', date: d }, d), d).toBe(ended)
      expect(linkWeek(ended, d, PARTNER, true), d).toBeUndefined()
    }
    for (const day of buildPartnerSnapshot(ended, '2026-10-01', PARTNER)!.days) expect(day.week, day.date).toBeUndefined()
    // The 43rd day: the week is back.
    const after = addDays('2026-09-20', 42)
    expect(weekOptions(ended, after, PARTNER)).toHaveLength(3)
  })

  it('[고마워요]: once a week, one 🔔 that says so, and his cover line reads 고마워했어요 — her own words, nothing inferred', () => {
    let s = couple(starts('2026-06-09', [28, 28, 28]))
    const walk = s.checkItems.find((i) => i.owner === PARTNER && i.cadence !== 'weekly')!
    s = { ...s, checkLog: { '2026-09-28': { [PARTNER]: [walk.id] } } }
    const day = '2026-09-30'
    expect(canThankWeek(s, OWNER, day)).toBe(true)
    let thanked = thankWeek(s, OWNER, day)
    thanked = sendWeekThanks(thanked, OWNER, PARTNER, day, stamp(day))
    const bell = thanked.notifications.find((n) => n.key === weekThanksNoticeKey(day, OWNER))!
    expect(bell).toMatchObject({ to: PARTNER, from: OWNER, kind: 'cheer', body: WEEK_THANKS_BODY })
    expect(bell.title).toContain('고마워했어요')
    // A second tap the same week adds nothing.
    expect(sendWeekThanks(thanked, OWNER, PARTNER, addDays(day, 2), stamp(addDays(day, 2)))).toBe(thanked)
    expect(thankWeek(thanked, OWNER, addDays(day, 1))).toBe(thanked)
    expect(heroLine(thanked, day, PARTNER, 9).text).toBe('지은님이 고마워했어요')
    // His week block keeps it for the rest of the week; the next week starts clean.
    expect(thanksThisWeek(thanked, PARTNER, '2026-10-04')).toEqual({ from: OWNER, day })
    expect(thanksThisWeek(thanked, PARTNER, '2026-10-05')).toBeUndefined()
    expect(buildPartnerSnapshot(thanked, '2026-10-02', PARTNER)!.days[0]!.week!.thanks).toBe(day)
    // The next day his cover goes back to its usual line.
    expect(heroLine(thanked, addDays(day, 1), PARTNER, 9).text).not.toContain('고마워')
  })
})

// ── 5. Partner events: setup values, once per id (N21/N22) ──

describe("N22 'setup' and the week events: only enumerated values, applied once", () => {
  const SMOKES = [true, false, undefined, 'yes', 1, null, {}]
  const DRINKS = [...SETUP_DRINKS, undefined, 'never', 'often ', 'OFTEN', 2, null]
  const STYLES = [...SETUP_ALERT_STYLES, undefined, 'loud', '', null, 0]
  const validSmokes = (v: unknown) => v === undefined || typeof v === 'boolean'
  const validDrinks = (v: unknown) => v === undefined || (SETUP_DRINKS as readonly unknown[]).includes(v)
  const validStyle = (v: unknown) => v === undefined || (SETUP_ALERT_STYLES as readonly unknown[]).includes(v)

  it('every combination: dropped whole unless every value is allowed; unknown keys never get through', () => {
    let accepted = 0
    for (const smokes of SMOKES)
      for (const drinks of DRINKS)
        for (const alertStyle of STYLES) {
          const habits: Record<string, unknown> = { exercises: true, note: '술은 거의 안 마셔요' }
          if (smokes !== undefined) habits.smokes = smokes
          if (drinks !== undefined) habits.drinks = drinks
          const raw: Record<string, unknown> = { id: 'setup-1', kind: 'setup', habits, text: 'free text', from: 'a' }
          if (alertStyle !== undefined) raw.alertStyle = alertStyle
          const ev = cleanPartnerEvent(raw)
          const ok = validSmokes(smokes) && validDrinks(drinks) && validStyle(alertStyle)
          expect(!!ev, JSON.stringify(raw)).toBe(ok)
          if (!ev || ev.kind !== 'setup') continue
          accepted++
          expect(Object.keys(ev).sort()).toEqual(['from', 'habits', 'id', 'kind', ...(alertStyle !== undefined ? ['alertStyle'] : [])].sort())
          expect(Object.keys(ev.habits).every((k) => k === 'smokes' || k === 'drinks')).toBe(true)
          expect(JSON.stringify(ev)).not.toMatch(/free text|술은|exercises/)
        }
    expect(accepted).toBe(3 * 4 * 4)
    for (const habits of [null, [], 'smokes', 3, undefined]) expect(cleanPartnerEvent({ id: 'x', kind: 'setup', habits })).toBeUndefined()
  })

  it('applied once per id; the same answers under a new id change nothing more; never from her', () => {
    const s = couple(starts('2026-06-09', [28, 28, 28]))
    const ev: PartnerEvent = { id: 'setup-a', kind: 'setup', habits: { smokes: true, drinks: 'often' }, alertStyle: 'explicit' }
    const once = applyPartnerEvent(s, ev, '2026-10-03')
    expect(once).not.toBe(s)
    expect(once.settings.alertStyle[PARTNER]).toBe('explicit')
    expect(applyPartnerEvent(once, ev, '2026-10-03')).toBe(once)
    const again = applyPartnerEvent(once, { ...ev, id: 'setup-b' }, '2026-10-04')
    expect(again.checkItems).toEqual(once.checkItems)
    expect(again.settings).toEqual(once.settings)
    // Her rows are never touched.
    expect(once.checkItems.filter((i) => i.owner === OWNER)).toEqual(s.checkItems.filter((i) => i.owner === OWNER))
    // Not from the cycle owner.
    expect(partnerEventProblem(s, { ...ev, from: OWNER }, '2026-10-03')).toBe('actor')
    expect(applyPartnerEvent(s, { ...ev, from: OWNER }, '2026-10-03')).toBe(s)
  })

  it('answered on the link, the in-app first run does not ask again — and 설정 › 연결 learns nothing (no linkedAt)', () => {
    const s = { ...couple(starts('2026-06-09', [28, 28, 28])), checkLog: {} }
    // Member 'b' is the one who joins in this prototype; make 'a' the cycle owner for this check.
    const joined = {
      ...s,
      couple: { ...s.couple, members: s.couple.members.map((m) => ({ ...m, tracksCycle: m.id === 'a' })) as AppState['couple']['members'] },
    }
    delete (joined.couple as { linkedAt?: string }).linkedAt
    expect(needsPartnerFirstRun(joined, 'b')).toBe(true)
    const answered = applyPartnerEvent(joined, { id: 'setup-1', kind: 'setup', habits: { drinks: 'no' } }, '2026-10-03')
    expect(answered.decisions?.[PARTNER_SETUP_KEY]).toBe('2026-10-03')
    expect(needsPartnerFirstRun(answered, 'b')).toBe(false)
    expect(answered.couple.linkedAt).toBeUndefined()
  })

  it('week events: only this week’s picks, only after a pick, once, never from the future', () => {
    const s = couple(starts('2026-06-09', [28, 28, 28]))
    const today = '2026-10-03'
    const offered = weekOptions(s, today, PARTNER)
    const notOffered = WEEK_OPTIONS.find((o) => !offered.some((x) => x.id === o.id))!
    expect(applyPartnerEvent(s, { id: 'p0', kind: 'week-pick', optionId: notOffered.id, date: today }, today)).toBe(s)
    expect(applyPartnerEvent(s, { id: 'p1', kind: 'week-pick', optionId: 'not-an-option', date: today }, today)).toBe(s)
    expect(applyPartnerEvent(s, { id: 'd0', kind: 'week-done', date: today }, today).decisions).toEqual(
      applyPartnerEvent(s, { id: 'd0', kind: 'week-done', date: today }, today).decisions,
    )
    expect(applyPartnerEvent(s, { id: 'pf', kind: 'week-pick', optionId: offered[0]!.id, date: addDays(today, 1) }, today)).toBe(s)
    const picked = applyPartnerEvent(s, { id: 'p2', kind: 'week-pick', optionId: offered[0]!.id, date: today }, today)
    expect(picked).not.toBe(s)
    expect(applyPartnerEvent(picked, { id: 'p2', kind: 'week-pick', optionId: offered[0]!.id, date: today }, today)).toBe(picked)
    const done = applyPartnerEvent(picked, { id: 'd1', kind: 'week-done', date: today }, today)
    expect(done).not.toBe(picked)
    expect(applyPartnerEvent(done, { id: 'd1', kind: 'week-done', date: today }, today)).toBe(done)
    // After [했어요] the week's pick stays.
    const switched = applyPartnerEvent(done, { id: 'p3', kind: 'week-pick', optionId: offered[1]!.id, date: today }, today)
    expect(linkWeek(switched, today, PARTNER, true)!.pick).toBe(offered[0]!.id)
    // Strict shapes: extra keys and free text never get through.
    const raw = { id: 'p4', kind: 'week-pick', optionId: offered[0]!.id, date: today, note: '오늘 꼭', extra: 1 }
    expect(Object.keys(cleanPartnerEvent(raw)!).sort()).toEqual(['date', 'id', 'kind', 'optionId'])
    expect(cleanPartnerEvent({ id: 'p5', kind: 'week-pick', optionId: offered[0]!.id, date: '10/3' })).toBeUndefined()
  })
})

// ── 6. The link-open counter: the token in, (couple, day) → count kept, never read on her screens ──

describe('the 링크 연 날 counter', () => {
  function memoryStorage() {
    const m = new Map<string, string>()
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      dump: () => m,
    }
  }

  it('the mock keeps couple → day → count and nothing else: no token, no time, no page content', async () => {
    const storage = memoryStorage()
    const t = createMockTransport({ storage, channel: null, now: () => '2026-10-03T09:00:00+09:00' })
    const coupleId = 'couple-1'
    const token = 'tok_' + 'x'.repeat(28)
    await t.publishSnapshot(coupleId, token, buildPartnerSnapshot(couple(starts('2026-06-09', [28, 28, 28])), '2026-10-03', PARTNER)!)
    const before = parseMockStore(storage.getItem('dulset:mock-sync:v1'))
    for (const d of ['2026-10-03', '2026-10-03', '2026-10-04']) await t.recordLinkOpen(token, d)
    await t.recordLinkOpen('tok_unknown_' + 'y'.repeat(20), '2026-10-03')
    await t.recordLinkOpen(token, 'yesterday')
    const after = parseMockStore(storage.getItem('dulset:mock-sync:v1'))
    expect(after.opens).toEqual({ [coupleId]: { '2026-10-03': 2, '2026-10-04': 1 } })
    // Nothing else in the store moved.
    expect({ ...after, opens: {} }).toEqual({ ...before, opens: {} })
    expect(JSON.stringify(after.opens)).not.toContain(token)
    expect(await t.linkOpenDays(coupleId, '2026-09-28', '2026-10-04')).toBe(2)
  })

  it('counting takes only the couple and the day (extra fields are not stored)', () => {
    const ev = { coupleId: 'c1', day: '2026-10-03', token: 'secret', ua: 'KAKAOTALK', at: '09:12' } as unknown as Parameters<typeof countLinkOpen>[1]
    const counts: LinkOpenCounts = countLinkOpen({}, ev)
    expect(counts).toEqual({ c1: { '2026-10-03': 1 } })
    expect(openDaysBetween(counts, 'c1', '2026-10-01', '2026-10-07')).toBe(1)
    expect(countLinkOpen({}, { coupleId: '', day: '2026-10-03' })).toEqual({})
  })

  it('the SQL keeps the same three columns and record_link_open takes the token alone', () => {
    const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
    const table = sql.slice(sql.indexOf('create table if not exists public.link_opens'))
    const cols = table.slice(table.indexOf('(') + 1, table.indexOf(');')).split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((c) => c && c !== 'primary')
    expect(cols).toEqual(['couple_id', 'day', 'count'])
    expect(sql).toMatch(/function public\.record_link_open\(p_token text\)/)
  })

  it('no screen reads it back: nothing under app/ or components/ calls linkOpenDays / link_open_days', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name)) files.push(p)
      }
    }
    walk(join(ROOT, 'app'))
    walk(join(ROOT, 'components'))
    for (const f of files) {
      // Comments may name it; code may not call it.
      const code = readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      expect(code, f).not.toMatch(/linkOpenDays\s*\(|link_open_days/)
    }
  })
})

// ── 7. Owner-only data never reaches any of the seven days ──

describe('owner-only data never reaches the link, at any sharing level (regression of the Next A / Next B sweeps)', () => {
  it('personalLog, 나만 보기, 관계일, treatment notes, bleeding, a negative test: absent from every day of every snapshot', () => {
    let s = couple(starts('2026-06-09', [28, 28, 28]))
    s = setPrivateNote(s, OWNER, '2026-09-20', 'PRIVATE_NOTE_MARK')
    s = setFeel(s, OWNER, '2026-09-21', 'cramps')
    s = setEntryPrivacy(addEntry(s, { id: 'secret', date: '2026-09-22', author: OWNER, text: 'PRIVATE_DIARY_MARK' }, stamp('2026-09-22')), 'secret', OWNER, true)
    s = toggleIntimacyDay(giveIntimacyConsent(s, OWNER, '2026-09-11'), OWNER, '2026-09-11', '2026-09-11')
    s = { ...s, treatments: [{ id: 't1', kind: 'iui', startDate: '2026-08-20', note: 'PRIVATE_TREATMENT_MARK' }] as AppState['treatments'] }
    s = { ...s, pregnancyTests: [{ id: 'neg', date: '2026-09-26', result: 'negative', by: OWNER }] }
    const bleed = markBleeding(markPositivePending(s, '2026-09-28'), '2026-09-30')
    for (const share of ['none', 'week', 'details'] as const) {
      for (const st of [s, bleed]) {
        const lensed = withLens(st, { share, style: 'explicit' })
        for (const d of DAYS('2026-09-08', '2026-10-12', 2)) {
          const text = JSON.stringify(buildPartnerSnapshot(lensed, d, PARTNER))
          expect(text, `${share} · ${d}`).not.toMatch(/PRIVATE_|음성|양성|출혈|관계일|컨디션|cramps/)
          // No date of hers rides along: the band (if any) is 우리의 주간 only.
          for (const day of JSON.parse(text).days as PartnerDay[]) {
            for (const x of day.strip?.days ?? []) expect(['none', 'fertile'], `${share} · ${d}`).toContain(x.tone)
          }
        }
      }
    }
  })
})

// ── Static: the snapshot day carries every 'partner-visible' field through the lenses ──

describe('the partner snapshot is still built from the lenses alone', () => {
  it('his month task rests through the quiet on the link exactly as on his home (N19 ②)', () => {
    const ended = endPregnancy({ ...couple(starts('2026-06-09', [28, 28])), stage: 'pregnant' as const }, '2026-09-20')
    for (const d of DAYS('2026-09-20', '2026-10-31', 3)) {
      for (const day of buildPartnerSnapshot(ended, d, PARTNER)!.days) {
        const inQuiet = diffDays('2026-09-20', day.date) < 42
        if (inQuiet) expect(day.task, day.date).toBeUndefined()
      }
    }
  })

  it('a member id outside the couple or the owner herself gets no snapshot', () => {
    const s = couple(starts('2026-06-09', [28, 28, 28]))
    expect(buildPartnerSnapshot(s, '2026-10-03', OWNER)).toBeNull()
    const viewer: MemberId = PARTNER
    expect(buildPartnerSnapshot(s, '2026-10-03', viewer)!.viewer).toBe(PARTNER)
  })
})
