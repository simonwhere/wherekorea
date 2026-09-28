import { describe, expect, it } from 'vitest'
import { dailyItems, dailyProgress, doneThisWeek, nudgeTarget, soonAppointment, weeklyDue, weeklyRows } from '@/components/today/model'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { setPersonalPref } from '@/lib/logic/prefs'
import {
  LIVE_VACCINE_REST_DAYS,
  activePositivePending,
  activeRest,
  markPositivePending,
  onPeriodLogged,
  startRestCycle,
} from '@/lib/logic/ttc'
import {
  LOSS_SUPPORT,
  PERIOD_PARTNER_TIP,
  acceptVaccineRest,
  cycleStrip,
  dismissVaccineRest,
  endRestFromHome,
  homeDiaryPrompt,
  homeVoice,
  latestTest,
  periodTellState,
  retestHint,
  retestRange,
  skipTellPartnerPeriod,
  tellPartnerPeriod,
  tellPartnerPositive,
  ttcMoment,
  ttcPhase,
  vaccineRestHint,
  type Moment,
} from '@/lib/logic/ttcFlow'
import type { AlertStyle, AppState, ISODate, PregnancyTest } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (tracks the cycle). Last period 2026-09-01,
// 28-day cycle → next period 09-29, estimated ovulation 09-15, window
// 09-10…09-15, peak 09-13…09-15.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const NOW = '2026-09-01T09:00:00+09:00'

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

function withStyle(s: AppState, member: 'a' | 'b', style: AlertStyle): AppState {
  return { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [member]: style } } }
}

const share = (s: AppState): AppState => ({ ...s, settings: { ...s.settings, shareCycleDetails: true } })

function test(date: ISODate, result: PregnancyTest['result'], time?: string): PregnancyTest {
  return { id: `${date}-${time ?? ''}`, date, result, ...(time ? { time } : {}), by: OWNER }
}

/** Every string a viewer can read on the moment card. */
function words(m: Moment): string {
  return [m.eyebrow, m.title, m.body, m.note, m.partnerTip, m.primary?.label, m.secondary?.label].filter(Boolean).join(' ')
}

const FERTILE_WORDS = /가임기|배란|LH|가능성 높은/
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야/

const DAYS = {
  periodEarly: '2026-09-02',
  period: '2026-09-04',
  beforeFar: '2026-09-06',
  beforeLh: '2026-09-08',
  fertile: '2026-09-11',
  peak: '2026-09-14',
  tww: '2026-09-20',
  expected: '2026-09-29',
  late: '2026-10-02',
  lateLong: '2026-10-20',
} as const satisfies Record<string, ISODate>

describe('ttcPhase', () => {
  it('walks the cycle: period → before → fertile → waiting → late', () => {
    const s = fresh()
    expect(ttcPhase(s, DAYS.periodEarly)?.kind).toBe('period-early')
    expect(ttcPhase(s, '2026-09-03')?.kind).toBe('period-early')
    expect(ttcPhase(s, DAYS.period)?.kind).toBe('period')
    expect(ttcPhase(s, DAYS.beforeLh)).toMatchObject({ kind: 'before-fertile', fertileStart: '2026-09-10', daysUntilFertile: 2 })
    expect(ttcPhase(s, DAYS.fertile)).toMatchObject({ kind: 'fertile', peak: false })
    expect(ttcPhase(s, DAYS.peak)).toMatchObject({ kind: 'fertile', peak: true })
    expect(ttcPhase(s, DAYS.tww)).toMatchObject({ kind: 'tww', testDate: '2026-09-29', early: true })
    expect(ttcPhase(s, DAYS.expected)).toMatchObject({ kind: 'tww', testDate: '2026-09-29', early: false })
    expect(ttcPhase(s, DAYS.late)).toMatchObject({ kind: 'late', daysLate: 3, testDate: '2026-09-29' })
  })

  it('is null outside the preparing stage and no-data without periods', () => {
    expect(ttcPhase({ ...fresh(), stage: 'pregnant' }, DAYS.tww)).toBeNull()
    expect(ttcPhase(fresh({ periods: [] }), DAYS.tww)?.kind).toBe('no-data')
  })

  it('knows today’s LH and a surge today or yesterday', () => {
    const s = fresh({
      lhTests: [
        { date: '2026-09-12', result: 'faint', time: '08:00' },
        { date: '2026-09-12', result: 'positive', time: '20:00' },
      ],
    })
    expect(ttcPhase(s, '2026-09-12')).toMatchObject({ todayLH: 'positive', recentSurge: true })
    expect(ttcPhase(s, '2026-09-13')).toMatchObject({ recentSurge: true })
    expect(ttcPhase(s, '2026-09-14')?.recentSurge).toBe(false)
  })
})

describe('owner moments (explicit)', () => {
  const s = fresh()
  const m = (d: ISODate, st: AppState = s) => ttcMoment(st, d, OWNER)!

  it('period days 1–3: 수고했어요 first, no next-window talk, asks once about telling', () => {
    const e = m(DAYS.periodEarly)
    expect(e).toMatchObject({ kind: 'period-early', copy: 'owner.period-early', title: '이번 주기도 수고했어요' })
    expect(e.primary).toBeUndefined()
    expect(words(e)).not.toMatch(/가임기|우리의 주간/)
    expect(e.askTell).toEqual({ start: '2026-09-01' })
  })

  it('from day 4 the next window shows (예상)', () => {
    const e = m(DAYS.period)
    expect(e.title).toBe('다음 가임기는 9월 10일부터예요 (예상)')
    expect(e.askTell).toBeUndefined()
  })

  it('before the window: LH countdown, then [LH 기록]', () => {
    expect(m(DAYS.beforeFar)).toMatchObject({ copy: 'owner.before-fertile', title: 'LH 테스트 시작 D-2' })
    expect(m(DAYS.beforeFar).primary).toBeUndefined()
    const lh = m(DAYS.beforeLh)
    expect(lh).toMatchObject({ copy: 'owner.lh-start', title: '오늘 LH 테스트해 봐요' })
    expect(lh.primary).toEqual({ type: 'log', kind: 'lh', label: 'LH 기록' })
  })

  it('in the window: [LH 기록], peak and surge wording', () => {
    expect(m(DAYS.fertile)).toMatchObject({ title: '가임기예요 (예상)', tone: 'fert' })
    expect(m(DAYS.fertile).primary).toMatchObject({ type: 'log', kind: 'lh' })
    expect(m(DAYS.peak)).toMatchObject({ title: '가능성 높은 날이에요 (예상)', peak: true })
    const surge = fresh({ lhTests: [{ date: '2026-09-12', result: 'peak' }] })
    expect(m('2026-09-12', surge).title).toBe('LH 양성이 나왔어요')
  })

  it('waiting weeks: testable day (예상) + "too early" line, [테스트 결과 기록]', () => {
    const e = m(DAYS.tww)
    expect(e).toMatchObject({ kind: 'tww', copy: 'owner.tww', testDate: '2026-09-29', early: true })
    expect(e.title).toBe('테스트해 볼 수 있는 날: 9월 29일 (예상)')
    expect(e.body).toBe('너무 이르면 음성일 수 있어요.')
    expect(e.body).not.toMatch(/\d+%/)
    expect(e.primary).toEqual({ type: 'log', kind: 'ptest', label: '테스트 결과 기록' })
    expect(m(DAYS.expected).title).toBe('오늘부터 테스트해 볼 수 있어요')
  })

  it('a negative test → 다시 해 볼 날 (2–3 days later, or the expected day if sooner)', () => {
    const neg = fresh({ pregnancyTests: [test('2026-09-24', 'negative')] })
    const e = m('2026-09-24', neg)
    expect(e).toMatchObject({ copy: 'owner.retest', retest: { from: '2026-09-26', to: '2026-09-27', due: false } })
    expect(e.title).toBe('다시 해 볼 날: 9월 26일~27일')
    expect(m('2026-09-26', neg).title).toBe('오늘 다시 테스트해 볼 수 있어요')
    const near = fresh({ pregnancyTests: [test('2026-09-28', 'negative')] })
    expect(m('2026-09-28', near).retest).toMatchObject({ from: '2026-09-29', to: '2026-09-29' })
    // A test from the previous cycle doesn't count.
    const old = fresh({ pregnancyTests: [test('2026-08-28', 'negative')] })
    expect(m(DAYS.tww, old).retest).toBeUndefined()
  })

  it('late: [테스트 결과 기록] first; long gaps ask for the period', () => {
    const e = m(DAYS.late)
    expect(e).toMatchObject({ copy: 'owner.late', title: '예정일이 3일 지났어요', daysLate: 3 })
    expect(e.primary).toMatchObject({ kind: 'ptest' })
    expect(e.secondary).toMatchObject({ kind: 'period' })
    const long = m(DAYS.lateLong)
    expect(long).toMatchObject({ copy: 'owner.late-long' })
    expect(long.primary).toMatchObject({ kind: 'period' })
    const neg = fresh({ pregnancyTests: [test('2026-10-01', 'negative')] })
    expect(m(DAYS.late, neg)).toMatchObject({ copy: 'owner.retest', body: '다시 해 볼 날: 10월 3일~4일' })
  })

  it('no data: [생리 시작 기록]', () => {
    const e = m(DAYS.tww, fresh({ periods: [] }))
    expect(e).toMatchObject({ kind: 'no-data', copy: 'owner.no-data' })
    expect(e.primary).toMatchObject({ type: 'log', kind: 'period' })
  })

  it('returns null once pregnant', () => {
    expect(ttcMoment({ ...s, stage: 'pregnant' }, DAYS.tww, OWNER)).toBeNull()
  })
})

describe('owner wording follows her own alert style', () => {
  it('soft: 우리의 주간, never 가임기·배란·LH', () => {
    const s = withStyle(fresh(), OWNER, 'soft')
    for (const d of Object.values(DAYS)) {
      const m = ttcMoment(s, d, OWNER)!
      expect(words(m), d).not.toMatch(FERTILE_WORDS)
    }
    expect(ttcMoment(s, DAYS.fertile, OWNER)!.title).toBe('이번 주는 우리의 주간이에요')
    expect(ttcMoment(s, DAYS.beforeLh, OWNER)!.primary).toEqual({ type: 'log', kind: 'lh', label: '오늘 기록' })
  })

  it('low-pressure: a calm card instead of window talk (her own period still shows)', () => {
    const s = setPersonalPref(fresh(), OWNER, 'lowPressure', true)
    for (const d of Object.values(DAYS)) expect(words(ttcMoment(s, d, OWNER)!), d).not.toMatch(FERTILE_WORDS)
    expect(ttcMoment(s, DAYS.fertile, OWNER)).toMatchObject({ copy: 'owner.calm', title: '날짜는 신경 쓰지 않아도 괜찮아요' })
    expect(ttcMoment(s, DAYS.period, OWNER)).toMatchObject({ copy: 'owner.period', title: '생리 4일째예요' })
    // Only her own switch counts: the partner's low-pressure doesn't change her screen.
    const his = setPersonalPref(fresh(), PARTNER, 'lowPressure', true)
    expect(ttcMoment(his, DAYS.fertile, OWNER)!.copy).toBe('owner.fertile')
  })

  it('off: calm card with a way back to settings', () => {
    const s = withStyle(fresh(), OWNER, 'off')
    const m = ttcMoment(s, DAYS.peak, OWNER)!
    expect(m).toMatchObject({ copy: 'owner.calm' })
    expect(m.secondary).toMatchObject({ type: 'nav', to: 'settings' })
    expect(words(m)).not.toMatch(FERTILE_WORDS)
  })
})

describe('partner moments', () => {
  const p = (s: AppState, d: ISODate) => ttcMoment(s, d, PARTNER)!

  it('soft (default): 우리의 주간 + date ideas in the window, never 가임기·배란', () => {
    const s = fresh()
    const m = p(s, DAYS.fertile)
    expect(m).toMatchObject({ role: 'partner', copy: 'partner.our-week', dateIdeas: true, title: '이번 주는 우리의 주간이에요' })
    expect(m.secondary).toMatchObject({ type: 'nav', to: 'date' })
    for (const d of Object.values(DAYS)) expect(words(p(s, d)), d).not.toMatch(FERTILE_WORDS)
    expect(p(s, DAYS.beforeLh)).toMatchObject({ copy: 'partner.our-week-soon', dateIdeas: true })
    expect(p(s, DAYS.beforeFar)).toMatchObject({ copy: 'partner.neutral', monthlyTask: true })
  })

  it('without shared details: no period, test or peak information', () => {
    const s = fresh()
    expect(p(s, DAYS.periodEarly).copy).toBe('partner.neutral')
    expect(p(s, DAYS.period).copy).toBe('partner.neutral')
    expect(p(s, DAYS.peak).peak).toBe(false)
    expect(p(s, DAYS.peak).body).toBe('둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.')
    // A late period is hers to share: he keeps the waiting card.
    expect(p(s, DAYS.late).copy).toBe('partner.tww')
    const neg = fresh({ pregnancyTests: [test('2026-09-24', 'negative')] })
    expect(p(neg, '2026-09-24').retest).toBeUndefined()
  })

  it('with shared details: period care, peak days and a late period', () => {
    const s = share(fresh())
    expect(p(s, DAYS.periodEarly)).toMatchObject({ copy: 'partner.period-shared', partnerTip: PERIOD_PARTNER_TIP })
    expect(p(s, DAYS.period).partnerTip).toBeUndefined()
    expect(p(s, DAYS.peak)).toMatchObject({ peak: true, body: '특히 오늘·내일이에요 (예상). 부담은 내려놓아요.' })
    expect(p(s, '2026-09-15').body).toBe('오늘까지예요 (예상). 부담은 내려놓아요.')
    expect(p(s, DAYS.late).copy).toBe('partner.late-shared')
    expect(words(p(s, DAYS.peak))).not.toMatch(FERTILE_WORDS)
  })

  it('explicit partner reads 가임기 (예상) only when she shares the details', () => {
    const s = withStyle(fresh(), PARTNER, 'explicit')
    expect(p(share(s), DAYS.fertile).eyebrow).toBe('가임기 (예상) · 9월 15일까지')
    expect(p(share(s), DAYS.peak).body).toBe('특히 오늘은 가능성 높은 날이에요 (예상). 부담은 내려놓아요.')
    expect(p(share(s), DAYS.periodEarly).eyebrow).toBe('지은님 생리 2일째')
    // Without the details: the shared "우리의 주간" wording, like the calendar (cycleLens).
    for (const d of Object.values(DAYS)) {
      const m = p(s, d)
      expect(m.voice, d).not.toBe('explicit')
      expect(words(m), d).not.toMatch(FERTILE_WORDS)
    }
    expect(homeVoice(s, PARTNER)).toBe('soft')
    expect(homeVoice(share(s), PARTNER)).toBe('explicit')
  })

  it('off / low-pressure partner: a neutral card through the whole cycle', () => {
    for (const s of [withStyle(fresh(), PARTNER, 'off'), setPersonalPref(fresh(), PARTNER, 'lowPressure', true)]) {
      for (const d of [DAYS.beforeLh, DAYS.fertile, DAYS.peak, DAYS.tww, DAYS.late]) {
        const m = p(s, d)
        expect(m.copy, d).toBe('partner.neutral')
        expect(m.dateIdeas).toBeUndefined()
        expect(words(m)).not.toMatch(FERTILE_WORDS)
      }
    }
  })

  it('waiting weeks: "기다리는 시간이에요" — no symptom questions', () => {
    expect(p(fresh(), DAYS.tww)).toMatchObject({
      copy: 'partner.tww',
      title: '기다리는 시간이에요',
      body: '증상은 묻지 말고 평소처럼 보내요.',
    })
  })

  it('no data yet: waits for her first record', () => {
    expect(p(fresh({ periods: [] }), DAYS.tww)).toMatchObject({ copy: 'partner.no-data', monthlyTask: true })
  })
})

describe('telling the partner the period started', () => {
  it('[알리기] sends one gentle notice; he then sees 이번 달은 쉬어 가요', () => {
    const s = tellPartnerPeriod(fresh(), '2026-09-01', NOW)
    const n = s.notifications.find((x) => x.key === 'period-told:2026-09-01')
    expect(n).toMatchObject({ to: PARTNER, from: OWNER, kind: 'system', read: false })
    expect(n!.body).toContain('이번 달은 쉬어 가요')
    expect(periodTellState(s, '2026-09-01')).toBe('told')
    expect(ttcMoment(s, DAYS.periodEarly, OWNER)!.askTell).toBeUndefined()
    expect(ttcMoment(s, DAYS.periodEarly, PARTNER)).toMatchObject({
      copy: 'partner.period-told',
      title: '이번 달은 쉬어 가요',
      partnerTip: PERIOD_PARTNER_TIP,
    })
    // Once only.
    expect(tellPartnerPeriod(s, '2026-09-01', NOW)).toBe(s)
    // Even a low-pressure partner hears what she chose to tell.
    expect(ttcMoment(setPersonalPref(s, PARTNER, 'lowPressure', true), DAYS.periodEarly, PARTNER)!.copy).toBe('partner.period-told')
  })

  it('[괜찮아요] remembers the answer and tells nobody', () => {
    const s = skipTellPartnerPeriod(fresh(), '2026-09-01', NOW)
    expect(periodTellState(s, '2026-09-01')).toBe('skipped')
    expect(s.notifications.filter((n) => n.to === PARTNER)).toHaveLength(0)
    expect(s.notifications[0]).toMatchObject({ read: true, dismissed: true })
    expect(ttcMoment(s, DAYS.periodEarly, OWNER)!.askTell).toBeUndefined()
    expect(ttcMoment(s, DAYS.periodEarly, PARTNER)!.copy).toBe('partner.neutral')
    expect(tellPartnerPeriod(s, '2026-09-01', NOW)).toBe(s)
  })
})

describe('positive test, before the clinic', () => {
  const pending = markPositivePending(fresh({ pregnancyTests: [test('2026-09-27', 'positive')] }), '2026-09-27', '2026-09-27-')

  it('owner: 병원에서 확인해 봐요 + [병원 일정 넣기] + [병원에서 확인했어요], no 🎉', () => {
    const m = ttcMoment(pending, '2026-09-28', OWNER)!
    expect(m).toMatchObject({ kind: 'positive-pending', copy: 'owner.positive-pending', title: '병원에서 확인해 봐요' })
    expect(m.primary).toEqual({ type: 'nav', to: 'plan', label: '병원 일정 넣기' })
    expect(m.secondary).toEqual({ type: 'confirm-pregnancy', label: '병원에서 확인했어요' })
    expect(m.offerTellPositive).toEqual({ since: '2026-09-27' })
    expect(words(m)).not.toMatch(/🎉|축하/)
  })

  it('partner hears nothing until she tells — then a calm notice', () => {
    expect(ttcMoment(pending, '2026-09-28', PARTNER)!.copy).toBe('partner.neutral')
    const told = tellPartnerPositive(pending, NOW)
    const n = told.notifications.find((x) => x.key === 'positive-told:2026-09-27')!
    expect(n).toMatchObject({ to: PARTNER, kind: 'system' })
    expect(`${n.title} ${n.body}`).not.toMatch(/🎉|축하/)
    const m = ttcMoment(told, '2026-09-28', PARTNER)!
    expect(m).toMatchObject({ copy: 'partner.positive-told' })
    expect(words(m)).not.toMatch(/🎉|축하/)
    expect(ttcMoment(told, '2026-09-28', OWNER)!.offerTellPositive).toBeUndefined()
  })

  it('pauses the window and settles quietly when a period comes', () => {
    expect(cycleStrip(pending, '2026-09-28', OWNER)!.hasWindow).toBe(false)
    const later = { ...pending, periods: [...pending.periods, { start: '2026-09-30' }] }
    expect(activePositivePending(later)).toBeUndefined()
    expect(ttcPhase(later, '2026-10-01')?.kind).toBe('period-early')
  })
})

describe('rest cycle', () => {
  it('owner: 이번 주기는 쉬어요 + [다시 켜기]; partner: nothing about the window', () => {
    const s = startRestCycle(fresh(), '2026-09-05', 'rest')
    const m = ttcMoment(s, DAYS.peak, OWNER)!
    expect(m).toMatchObject({ kind: 'rest', copy: 'owner.rest', title: '이번 주기는 쉬어요', restReason: 'rest' })
    expect(m.primary).toEqual({ type: 'end-rest', label: '다시 켜기' })
    expect(ttcMoment(s, DAYS.peak, PARTNER)!.copy).toBe('partner.neutral')
    expect(cycleStrip(s, DAYS.peak, OWNER)!.hasWindow).toBe(false)
    expect(cycleStrip(s, DAYS.peak, PARTNER)).toBeNull()
    expect(words(m)).not.toMatch(FERTILE_WORDS)
  })

  it('ends with the next period (the late check still comes first)', () => {
    const s = startRestCycle(fresh(), '2026-09-05', 'rest')
    expect(ttcPhase(s, DAYS.late)?.kind).toBe('late')
    const next = { ...s, periods: [...s.periods, { start: '2026-09-29' }] }
    expect(activeRest(next)).toBeUndefined()
    expect(onPeriodLogged(next, '2026-09-29').restCycle).toBeUndefined()
  })

  it('a vaccine rest lasts until a period at least a month after the shot', () => {
    const s = startRestCycle(fresh(), '2026-09-20', 'vaccine')
    const soon = { ...s, periods: [...s.periods, { start: '2026-09-29' }] }
    expect(activeRest(soon)?.reason).toBe('vaccine')
    expect(onPeriodLogged(soon, '2026-09-29').restCycle).toBeDefined()
    expect(ttcMoment(soon, '2026-10-08', OWNER)).toMatchObject({ kind: 'rest', restReason: 'vaccine' })
    const later = addDays('2026-09-20', LIVE_VACCINE_REST_DAYS)
    const done = { ...soon, periods: [...soon.periods, { start: later }] }
    expect(activeRest(done)).toBeUndefined()
    expect(onPeriodLogged(done, later).restCycle).toBeUndefined()
  })
})

describe('live vaccine → rest suggestion', () => {
  const ticked = (at: ISODate, id = 'pre-rubella') => ({ ...fresh(), planDone: { [id]: { at, by: OWNER } } })

  it('suggests a vaccine rest to the owner within the wait', () => {
    const s = ticked('2026-09-20')
    expect(vaccineRestHint(s, '2026-09-25', OWNER)).toMatchObject({ label: 'MMR', wait: '4주', at: '2026-09-20', until: '2026-10-18' })
    expect(vaccineRestHint(s, '2026-10-18', OWNER)).toBeNull()
    expect(vaccineRestHint(s, '2026-09-25', PARTNER)).toBeNull()
    expect(vaccineRestHint(ticked('2026-09-20', 'pre-varicella'), '2026-10-19', OWNER)).toMatchObject({ label: '수두', until: '2026-10-20' })
  })

  it('also counts a done vaccine appointment', () => {
    const s = fresh({
      appointments: [{ id: 'x', date: '2026-09-22', title: 'MMR', who: OWNER, kind: 'vaccine', taskId: 'pre-rubella', createdBy: OWNER, done: true }],
    })
    expect(vaccineRestHint(s, '2026-09-25', OWNER)?.at).toBe('2026-09-22')
  })

  it('turning a vaccine rest off counts as an answer', () => {
    const s = ticked('2026-09-20')
    const rested = acceptVaccineRest(s, vaccineRestHint(s, '2026-09-25', OWNER)!)
    const back = endRestFromHome(rested, '2026-09-26', NOW)
    expect(back.restCycle).toBeUndefined()
    expect(vaccineRestHint(back, '2026-09-26', OWNER)).toBeNull()
    // A plain rest just ends.
    const plain = endRestFromHome(startRestCycle(fresh(), '2026-09-05'), '2026-09-06', NOW)
    expect(plain.restCycle).toBeUndefined()
    expect(plain.notifications).toHaveLength(0)
  })

  it('accept starts a vaccine rest from the shot; dismiss hides it', () => {
    const s = ticked('2026-09-20')
    const hint = vaccineRestHint(s, '2026-09-25', OWNER)!
    const rested = acceptVaccineRest(s, hint)
    expect(rested.restCycle).toEqual({ since: '2026-09-20', reason: 'vaccine' })
    expect(vaccineRestHint(rested, '2026-09-25', OWNER)).toBeNull()
    const dismissed = dismissVaccineRest(s, hint, NOW)
    expect(vaccineRestHint(dismissed, '2026-09-25', OWNER)).toBeNull()
    expect(dismissed.notifications[0]).toMatchObject({ dismissed: true, read: true })
  })
})

describe('after a pregnancy ended', () => {
  const ended = backToPreparing(startPregnancy(fresh(), '2026-08-01', '2026-09-01'), '2026-09-20')

  it('both see a quiet support card, no window, no LH', () => {
    const o = ttcMoment(ended, '2026-09-25', OWNER)!
    expect(o).toMatchObject({ kind: 'after-loss', copy: 'owner.after-loss', support: true })
    expect(o.primary).toBeUndefined()
    const p = ttcMoment(ended, '2026-09-25', PARTNER)!
    expect(p).toMatchObject({ kind: 'after-loss', copy: 'partner.after-loss', support: true })
    expect(cycleStrip(ended, '2026-09-25', OWNER)).toBeNull()
    expect(words(o) + words(p)).not.toMatch(/🎉|LH|가임기/)
  })

  it('past the quiet days it just asks for the next period', () => {
    expect(ttcMoment(ended, '2026-11-15', OWNER)).toMatchObject({ kind: 'no-data', copy: 'owner.paused' })
  })

  it('support facts carry sources and the leave rules', () => {
    const leave = LOSS_SUPPORT.find((x) => x.id === 'spouse-leave')!
    expect(leave.title).toContain('5일')
    expect(leave.body).toMatch(/3일은 유급/)
    expect(leave.body).toMatch(/20일 안에/)
    expect(leave.body).toContain('2026-09-18')
    expect(LOSS_SUPPORT.find((x) => x.id === 'voucher')!.body).toContain('2년')
    for (const item of LOSS_SUPPORT) {
      expect(item.sources.length).toBeGreaterThan(0)
      for (const src of item.sources) expect(src.url).toMatch(/^https?:\/\//)
    }
  })
})

describe('cycle strip', () => {
  it('owner: this cycle with period days, a 6-day window and darker peak days', () => {
    const strip = cycleStrip(fresh(), DAYS.fertile, OWNER)!
    expect(strip).toMatchObject({ mode: 'cycle', length: 28, cycleDay: 11, todayIndex: 10, hasWindow: true, windowLabel: '가임기 (예상)' })
    const tone = (d: ISODate) => strip.days.find((x) => x.date === d)!.tone
    expect(['2026-09-01', '2026-09-05'].map(tone)).toEqual(['period', 'period'])
    expect(['2026-09-10', '2026-09-12'].map(tone)).toEqual(['fertile', 'fertile'])
    expect(['2026-09-13', '2026-09-14', '2026-09-15'].map(tone)).toEqual(['peak', 'peak', 'peak'])
    expect(tone('2026-09-16')).toBe('none')
    expect(strip.days.filter((d) => d.tone === 'fertile' || d.tone === 'peak')).toHaveLength(6)
    const fert = strip.days.filter((d) => d.tone === 'fertile').map((d) => d.level)
    expect([...fert].sort()).toEqual(fert) // gradient toward the peak
    expect(strip.days.filter((d) => d.today)).toHaveLength(1)
  })

  it('keeps the next window off the strip on period days 1–3', () => {
    expect(cycleStrip(fresh(), DAYS.periodEarly, OWNER)!.hasWindow).toBe(false)
    // …but the partner without details keeps the same two-week band (nothing to infer from).
    expect(cycleStrip(fresh(), DAYS.periodEarly, PARTNER)!.mode).toBe('weeks')
    expect(cycleStrip(share(fresh()), DAYS.periodEarly, PARTNER)!.hasWindow).toBe(false)
    expect(cycleStrip(fresh(), DAYS.period, OWNER)!.hasWindow).toBe(true)
  })

  it('marks LH for the owner', () => {
    const s = fresh({ lhTests: [{ date: '2026-09-09', result: 'negative' }, { date: '2026-09-12', result: 'positive' }] })
    const strip = cycleStrip(s, '2026-09-12', OWNER)!
    expect(strip.days.find((d) => d.date === '2026-09-09')!.lh).toBe('low')
    expect(strip.days.find((d) => d.date === '2026-09-12')!.lh).toBe('surge')
    // A soft view never shows the test's name — no marks.
    expect(cycleStrip(withStyle(s, OWNER, 'soft'), '2026-09-12', OWNER)!.days.some((d) => d.lh)).toBe(false)
  })

  it('partner without details: two weeks, only the shared window', () => {
    const s = fresh({ lhTests: [{ date: '2026-09-12', result: 'positive' }] })
    const strip = cycleStrip(s, DAYS.fertile, PARTNER)!
    expect(strip).toMatchObject({ mode: 'weeks', windowLabel: '우리의 주간 (예상)' })
    expect(strip.days).toHaveLength(14)
    expect(strip.days[0]!.date).toBe('2026-09-07') // Monday
    expect(strip.cycleDay).toBeUndefined()
    expect(strip.days.some((d) => d.tone === 'period' || d.tone === 'period-predicted' || d.tone === 'peak' || d.lh)).toBe(false)
    expect(strip.days.some((d) => d.tone === 'fertile')).toBe(true)
  })

  it('partner with details sees the cycle; calm partner without details sees none', () => {
    expect(cycleStrip(share(fresh()), DAYS.fertile, PARTNER)!.mode).toBe('cycle')
    expect(cycleStrip(withStyle(fresh(), PARTNER, 'off'), DAYS.fertile, PARTNER)).toBeNull()
    const calm = cycleStrip(share(setPersonalPref(fresh(), PARTNER, 'lowPressure', true)), DAYS.fertile, PARTNER)!
    expect(calm.hasWindow).toBe(false)
    expect(calm.days.some((d) => d.tone === 'fertile' || d.tone === 'peak')).toBe(false)
  })

  it('late: keeps counting the last cycle up to today', () => {
    const strip = cycleStrip(fresh(), DAYS.late, OWNER)!
    expect(strip).toMatchObject({ mode: 'cycle', cycleDay: 32, length: 32, todayIndex: 31 })
    expect(strip.days.find((d) => d.date === '2026-09-29')!.tone).toBe('period-predicted')
  })

  it('no strip without data', () => {
    expect(cycleStrip(fresh({ periods: [] }), DAYS.tww, OWNER)).toBeNull()
  })
})

describe('small helpers', () => {
  it('latestTest picks the last by date and time', () => {
    const tests = [test('2026-09-24', 'negative', '20:00'), test('2026-09-24', 'faint', '07:00'), test('2026-08-30', 'positive')]
    expect(latestTest(tests, '2026-09-01', '2026-09-25')!.time).toBe('20:00')
    expect(latestTest(tests, '2026-09-01', '2026-09-23')).toBeUndefined()
  })

  it('retestHint ignores positives; retestRange spans months', () => {
    expect(retestHint(test('2026-09-24', 'positive'), '2026-09-29', '2026-09-24')).toBeUndefined()
    expect(retestRange({ from: '2026-09-30', to: '2026-10-01' })).toBe('9월 30일~10월 1일')
  })

  it('no baby diary prompts on period days 1–3, none right after a loss', () => {
    const s = fresh()
    for (let i = 0; i < 40; i++) {
      const d = addDays('2026-09-01', i * 28)
      const moved = { ...s, periods: [{ start: d }] }
      expect(homeDiaryPrompt(moved, addDays(d, 1))).not.toMatch(/아이|아기/)
    }
    const ended = backToPreparing(startPregnancy(fresh(), '2026-08-01', '2026-09-01'), '2026-09-20')
    expect(homeDiaryPrompt(ended, '2026-09-25')).toBeNull()
  })
})

describe('review fixes', () => {
  it('a test taken before this cycle’s ovulation doesn’t make 다시 해 볼 날 due', () => {
    const s = fresh({ pregnancyTests: [test('2026-09-02', 'negative')] })
    expect(ttcPhase(s, DAYS.tww)?.retest).toBeUndefined()
    expect(ttcMoment(s, DAYS.tww, OWNER)).toMatchObject({ copy: 'owner.tww', title: '테스트해 볼 수 있는 날: 9월 29일 (예상)' })
    expect(ttcPhase(s, DAYS.late)?.retest).toBeUndefined()
    // …while one after it still does.
    const after = fresh({ pregnancyTests: [test('2026-09-02', 'negative'), test('2026-09-22', 'negative')] })
    expect(ttcPhase(after, '2026-09-23')?.retest).toMatchObject({ tested: '2026-09-22', from: '2026-09-24', due: false })
  })

  it('owner with alerts off: the strip keeps the band in 우리의 주간 wording, no LH marks', () => {
    const s = withStyle(fresh({ lhTests: [{ date: '2026-09-11', result: 'faint' }] }), OWNER, 'off')
    const strip = cycleStrip(s, DAYS.fertile, OWNER)!
    expect(strip.view).toBe('soft')
    expect(strip.windowLabel).toBe('우리의 주간 (예상)')
    expect(strip.days.some((d) => d.lh)).toBe(false)
    // Explicit owner still gets the LH mark and 가임기 wording.
    const ex = cycleStrip(fresh({ lhTests: [{ date: '2026-09-11', result: 'faint' }] }), DAYS.fertile, OWNER)!
    expect(ex.windowLabel).toBe('가임기 (예상)')
    expect(ex.days.find((d) => d.date === '2026-09-11')?.lh).toBe('low')
  })

  it('explicit partner without details: strip in 우리의 주간 wording', () => {
    const s = withStyle(fresh(), PARTNER, 'explicit')
    expect(cycleStrip(s, DAYS.fertile, PARTNER)).toMatchObject({ mode: 'weeks', windowLabel: '우리의 주간 (예상)' })
    expect(cycleStrip(share(s), DAYS.fertile, PARTNER)).toMatchObject({ mode: 'cycle', windowLabel: '가임기 (예상)' })
  })

  it('partner without details: no strip while the period is late (next window unknown)', () => {
    const s = fresh()
    for (const d of ['2026-09-30', DAYS.late, '2026-10-04']) {
      expect(ttcPhase(s, d)?.kind).toBe('late')
      expect(cycleStrip(s, d, PARTNER), d).toBeNull()
    }
  })

  it('positive test awaiting the clinic: no projected period on the strip (like the calendar)', () => {
    const s = markPositivePending(fresh(), '2026-09-30')
    const strip = cycleStrip(s, DAYS.late, OWNER)!
    expect(strip.days.some((d) => d.tone === 'period-predicted')).toBe(false)
    expect(strip.hasWindow).toBe(false)
    // Without the pending test, the missed period's days still show as predicted.
    expect(cycleStrip(fresh(), DAYS.late, OWNER)!.days.some((d) => d.tone === 'period-predicted')).toBe(true)
  })

  it('partner with details and a late period: waiting card, no questions', () => {
    const m = ttcMoment(share(fresh()), DAYS.late, PARTNER)!
    expect(m).toMatchObject({ copy: 'partner.late-shared', title: '기다리는 시간이에요', monthlyTask: true })
    expect(words(m)).not.toMatch(/어때요\?|테스트/)
  })

  it('soft / off / low-pressure viewers never get 가임기 or LH on the strip', () => {
    const lh = { lhTests: [{ date: '2026-09-11', result: 'positive' as const }] }
    const cases: [AppState, 'a' | 'b'][] = [
      [withStyle(fresh(lh), OWNER, 'soft'), OWNER],
      [withStyle(fresh(lh), OWNER, 'off'), OWNER],
      [setPersonalPref(fresh(lh), OWNER, 'lowPressure', true), OWNER],
      [fresh(lh), PARTNER],
      [share(fresh(lh)), PARTNER],
      [withStyle(share(fresh(lh)), PARTNER, 'off'), PARTNER],
      [setPersonalPref(share(fresh(lh)), PARTNER, 'lowPressure', true), PARTNER],
    ]
    for (const [s, v] of cases) {
      for (const d of Object.values(DAYS)) {
        const strip = cycleStrip(s, d, v)
        if (!strip) continue
        expect(strip.windowLabel ?? '', `${v} ${d}`).not.toMatch(FERTILE_WORDS)
        expect(strip.days.some((x) => x.lh), `${v} ${d}`).toBe(false)
      }
    }
  })

  it('vaccine rest says from when the next period turns it back on', () => {
    const s = startRestCycle(fresh(), '2026-09-05', 'vaccine')
    const m = ttcMoment(s, DAYS.tww, OWNER)!
    expect(m).toMatchObject({ copy: 'owner.rest', restReason: 'vaccine' })
    expect(m.note).toContain('10월 6일 이후 첫 생리')
  })
})

describe('copy rules across every moment and viewer', () => {
  it('no banned words, predictions say 예상, no celebration', () => {
    const states: AppState[] = [
      fresh(),
      share(fresh()),
      withStyle(fresh(), PARTNER, 'explicit'),
      withStyle(fresh(), OWNER, 'soft'),
      setPersonalPref(fresh(), OWNER, 'lowPressure', true),
      startRestCycle(fresh(), '2026-09-05', 'vaccine'),
      markPositivePending(fresh(), '2026-09-26'),
      fresh({ pregnancyTests: [test('2026-09-24', 'negative')] }),
      fresh({ periods: [] }),
      withStyle(fresh(), OWNER, 'off'),
      withStyle(fresh(), PARTNER, 'off'),
      tellPartnerPeriod(fresh(), '2026-09-01', NOW),
      tellPartnerPositive(markPositivePending(fresh(), '2026-09-26'), NOW),
      backToPreparing(startPregnancy(fresh(), '2026-08-01', '2026-09-01'), '2026-09-20'),
    ]
    for (const s of states) {
      for (const d of [...Object.values(DAYS), '2026-09-26']) {
        for (const v of [OWNER, PARTNER]) {
          const m = ttcMoment(s, d, v)!
          const text = words(m)
          expect(text, `${v} ${d} ${m.copy}`).not.toMatch(BANNED)
          expect(text).not.toMatch(/🎉/)
          // A date for the window or the testable day is always an estimate.
          if (/부터예요|무렵|까지|테스트해 볼 수 있는 날/.test(m.title + (m.eyebrow ?? '')) && m.copy !== 'owner.late') {
            expect(`${m.eyebrow ?? ''} ${m.title} ${m.body}`, m.copy).toMatch(/예상/)
          }
        }
      }
    }
  })
})

describe('home rows: 오늘 할 일 / 우리 한 줄', () => {
  // 민수: one daily item and one weekly check-in.
  function rows(): AppState {
    const s = fresh()
    const mine = s.checkItems.filter((i) => i.owner === PARTNER)
    const [daily, weekly] = [mine[0]!, mine[1]!]
    return {
      ...s,
      checkItems: [
        ...s.checkItems.filter((i) => i.owner !== PARTNER),
        { ...daily, cadence: 'daily' },
        { ...weekly, cadence: 'weekly' },
      ],
    }
  }

  it('splits daily rows from weekly check-ins; progress counts daily only', () => {
    const s = rows()
    expect(dailyItems(s, PARTNER)).toHaveLength(1)
    expect(weeklyDue(s, PARTNER, '2026-09-30')).toHaveLength(1)
    const daily = dailyItems(s, PARTNER)[0]!
    const done = { ...s, checkLog: { '2026-09-30': { [PARTNER]: [daily.id] } } }
    expect(dailyProgress(done, PARTNER, '2026-09-30')).toEqual({ done: 1, total: 1, complete: true })
  })

  it('a weekly check-in stays done for the rest of its Mon–Sun week', () => {
    const s = rows()
    const weekly = s.checkItems.find((i) => i.cadence === 'weekly')!
    const checked = { ...s, checkLog: { '2026-09-29': { [PARTNER]: [weekly.id] } } } // Tuesday
    expect(doneThisWeek(checked, PARTNER, weekly.id, '2026-10-04')).toBe(true) // Sunday
    expect(weeklyDue(checked, PARTNER, '2026-10-04')).toHaveLength(0)
    expect(weeklyDue(checked, PARTNER, '2026-10-05')).toHaveLength(1) // next Monday
  })

  it('a weekly check-in done today stays on the list (ticked) so a mis-tap can be undone', () => {
    const s = rows()
    const weekly = s.checkItems.find((i) => i.cadence === 'weekly')!
    expect(weeklyRows(s, PARTNER, '2026-09-30')).toEqual([{ item: weekly, checked: false }])
    const today = { ...s, checkLog: { '2026-09-30': { [PARTNER]: [weekly.id] } } }
    expect(weeklyRows(today, PARTNER, '2026-09-30')).toEqual([{ item: weekly, checked: true }])
    // Done earlier in the week: off the list for the rest of it.
    expect(weeklyRows(today, PARTNER, '2026-10-01')).toEqual([])
  })

  it('never nudges about a weekly habit', () => {
    const s = rows()
    const daily = dailyItems(s, PARTNER)[0]!
    expect(nudgeTarget(s, PARTNER, '2026-09-30')?.id).toBe(daily.id)
    const done = { ...s, checkLog: { '2026-09-30': { [PARTNER]: [daily.id] } } }
    expect(nudgeTarget(done, PARTNER, '2026-09-30')).toBeUndefined()
  })

  it('shows only today’s or tomorrow’s appointment', () => {
    const a = (id: string, date: ISODate) => ({ id, date, title: id, who: 'both' as const, kind: 'hospital' as const, createdBy: OWNER })
    expect(soonAppointment([a('x', '2026-10-03'), a('y', '2026-09-29')], '2026-09-28')?.id).toBe('y')
    expect(soonAppointment([a('x', '2026-10-03')], '2026-09-28')).toBeUndefined()
  })
})
