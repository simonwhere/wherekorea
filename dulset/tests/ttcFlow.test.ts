import { describe, expect, it } from 'vitest'
import { dailyItems, dailyProgress, doneThisWeek, nudgeTarget, soonAppointment, weeklyDue, weeklyRows } from '@/components/today/model'
import { FEEL_CHIPS, WAITING_WEEK_LINES, waitingWeekLine } from '@/lib/content/fertility'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { isClinicMode, startClinicMode } from '@/lib/logic/clinic'
import { logPeriodStart } from '@/lib/logic/logs'
import { FEEL_LABEL, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { setPersonalPref } from '@/lib/logic/prefs'
import { CLINIC_LABEL, CLINIC_PARTNER_HEADLINE, cycleLens, lensPhase, showsLH } from '@/lib/logic/calendarView'
import { dayInfo } from '@/lib/logic/cycle'
import { fertileHintsAllowed } from '@/lib/logic/dateIdeas'
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
  PERIOD_ASK_DAYS,
  PERIOD_PARTNER_TIP,
  ULTRASOUND_FROM_DAYS,
  acceptVaccineRest,
  cycleStrip,
  dismissVaccineRest,
  endRestFromHome,
  feelLabel,
  homeDiaryPrompt,
  homeVoice,
  lastFeelsFor,
  latestTest,
  markStillWaiting,
  nextClinicAppointment,
  periodTellState,
  retestHint,
  retestRange,
  skipTellPartnerPeriod,
  stillWaitingSince,
  tellPartnerPeriod,
  tellPartnerPositive,
  ttcMoment,
  ttcPhase,
  vaccineRestHint,
  type Moment,
} from '@/lib/logic/ttcFlow'
import { cycleSummary } from '@/lib/logic/calendarView'
import { scheduledNotices } from '@/lib/logic/notifications'
import { dueRange } from '@/lib/logic/periodDue'
import { sanitizeBackup } from '@/lib/logic/settings'
import type { AlertStyle, AppState, ISODate, PregnancyTest } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (tracks the cycle). Three regular 28-day
// cycles, then the period 2026-09-01 (confidence 'cycles') → next period
// expected 09-29 (a one-day range, late from 09-30), estimated ovulation 09-15,
// window 09-10…09-15, peak 09-13…09-15.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const NOW = '2026-09-01T09:00:00+09:00'
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

function withStyle(s: AppState, member: 'a' | 'b', style: AlertStyle): AppState {
  return { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [member]: style } } }
}

const share = (s: AppState): AppState => ({ ...s, settings: { ...s.settings, shareCycleDetails: true } })
/** She answered "알릴까요?" for the 09-01 period with 괜찮아요. */
const answered = (s: AppState): AppState => skipTellPartnerPeriod(s, '2026-09-01', NOW)

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
    // Day 4 stays 수고했어요 until she answers 알릴까요? (a start logged late).
    expect(ttcPhase(s, DAYS.period)?.kind).toBe('period-early')
    expect(ttcPhase(answered(s), DAYS.period)?.kind).toBe('period')
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

  it('a start logged late still gets 수고했어요 and 알릴까요? (to day 7); answered, the next window shows (예상)', () => {
    // Day 4, unanswered: as if she had logged it on day 1.
    const late = m(DAYS.period)
    expect(late).toMatchObject({ kind: 'period-early', title: '이번 주기도 수고했어요', askTell: { start: '2026-09-01' } })
    expect(words(late)).not.toMatch(/가임기|우리의 주간/)
    // Answered (either way): straight on to the window talk.
    const e = m(DAYS.period, answered(s))
    expect(e.title).toBe('다음 가임기는 9월 10일부터예요 (예상)')
    expect(e.askTell).toBeUndefined()
    expect(m(DAYS.period, tellPartnerPeriod(s, '2026-09-01', NOW)).copy).toBe('owner.period')
    // Past day 7 the question is gone even unanswered (an 8-day period here).
    const long = fresh({ cycle: { cycleLength: 28, periodLength: 8 } })
    expect(m('2026-09-07', long).kind).toBe('period-early')
    expect(m(addDays('2026-09-01', PERIOD_ASK_DAYS), long)).toMatchObject({ kind: 'period', copy: 'owner.period' })
  })

  it('before the window: LH countdown, then [LH 기록]', () => {
    // Window from 09-10, LH lead 3 days (cycle.LH_LEAD_DAYS, shared with the sheet): testing from 09-07.
    expect(m(DAYS.beforeFar)).toMatchObject({ copy: 'owner.before-fertile', title: 'LH 테스트 시작 D-1' })
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

  it('waiting weeks: 배란 뒤 N일째, a countdown to the expected range (예상), 오늘 컨디션 as the action until the test day', () => {
    const e = m(DAYS.tww)
    expect(e).toMatchObject({ kind: 'tww', copy: 'owner.tww', testDate: '2026-09-29', early: true })
    // Ovulation 09-15 → 09-20 is five days after it.
    expect(e.eyebrow).toBe('배란 뒤 5일째 (예상)')
    expect(e.title).toBe('테스트까지 D-9')
    expect(e.body).toContain('생리 예정은 9월 29일 무렵이에요 (예상).')
    expect(e.body).not.toMatch(/\d+%/)
    expect(e.note).toBe('너무 이르면 음성일 수 있어요.')
    expect(e.primary).toEqual({ type: 'log', kind: 'note', label: '오늘 컨디션' })
    expect(e.secondary).toEqual({ type: 'log', kind: 'ptest', label: '테스트 결과 기록' })
    expect(e.due).toEqual({ from: '2026-09-29', to: '2026-09-29', basis: 'calendar' })
    expect(m('2026-09-28')).toMatchObject({ title: '테스트까지 D-1', eyebrow: '배란 뒤 13일째 (예상)' })
    // From the test day (the range's first day): the test is the action; the period may start any day too.
    const due = m(DAYS.expected)
    expect(due).toMatchObject({ kind: 'tww', copy: 'owner.period-due', early: false, title: '생리 예정 무렵이에요 (예상)' })
    expect(due.eyebrow).toBe('배란 뒤 14일째 (예상)')
    expect(due.body).toBe('9월 29일 무렵이에요 (예상). 시작하면 기록해 주세요.')
    expect(due.primary).toEqual({ type: 'log', kind: 'ptest', label: '테스트 결과 기록' })
    expect(due.secondary).toEqual({ type: 'log', kind: 'period', label: '생리 시작 기록' })
  })

  it('the waiting card changes with the day: one self-care line a day, no medical claim, and her own feel chip', () => {
    const bodies = new Set<string>()
    for (let i = 0; i < WAITING_WEEK_LINES.length; i++) {
      const d = addDays('2026-09-16', i)
      const e = m(d)
      expect(e.copy).toBe('owner.tww')
      const line = e.body.replace(/^생리 예정은 .* 무렵이에요 \(예상\)\. /, '')
      expect(WAITING_WEEK_LINES).toContain(line)
      expect(line).toBe(waitingWeekLine(i + 1))
      bodies.add(e.body)
    }
    expect(bodies.size).toBe(WAITING_WEEK_LINES.length)
    // Days without evidence carry no medical claim: no symptom reading, no numbers, no 착상.
    expect(WAITING_WEEK_LINES.join(' ')).not.toMatch(/착상|증상|%|\d+일/)
    expect(waitingWeekLine(WAITING_WEEK_LINES.length)).toBe(WAITING_WEEK_LINES[0])
    expect(waitingWeekLine(-3)).toBe(WAITING_WEEK_LINES[0])
    // What she logged today sits on the card — hers only (the partner's card never carries it).
    const felt = setFeel(s, OWNER, DAYS.tww, 'tired')
    expect(m(DAYS.tww, felt).todayFeel).toBe('tired')
    expect(feelLabel('tired')).toBe('피곤해요')
    expect(feelLabel('nausea')).toBe(FEEL_LABEL.nausea)
    expect(FEEL_CHIPS.map((c) => c.label)).toEqual(['평소 같아요', '피곤해요', '예민해요', '가슴이 아파요', '배가 살짝 아파요', '살짝 비쳐요'])
    expect(ttcMoment(felt, DAYS.tww, PARTNER)!.todayFeel).toBeUndefined()
    expect(ttcMoment(share(felt), DAYS.tww, PARTNER)!.todayFeel).toBeUndefined()
    expect(m(DAYS.tww).todayFeel).toBeUndefined()
    // Soft / calm wording never reads 배란: the eyebrow stays 기다리는 주.
    expect(ttcMoment(withStyle(felt, OWNER, 'soft'), DAYS.tww, OWNER)).toMatchObject({ eyebrow: '기다리는 주', todayFeel: 'tired' })
    expect(ttcMoment(withStyle(felt, OWNER, 'off'), DAYS.tww, OWNER)!.eyebrow).toBe('기다리는 주')
  })

  it('LH strips but no surge by the window’s end: keep testing for a week (tww-no-surge), then the ordinary wait', () => {
    // Window 09-10…09-15; strips 09-11…09-15 all negative / faint.
    const strips = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'].map((date, i) => ({
      date,
      result: i === 2 ? ('faint' as const) : ('negative' as const),
      by: OWNER,
    }))
    const st = fresh({ lhTests: strips })
    const e = m('2026-09-16', st)
    expect(e).toMatchObject({ kind: 'tww', copy: 'owner.tww-no-surge', eyebrow: 'LH 5회 · 아직 양성이 없어요', title: '며칠 더 테스트해 봐요' })
    expect(e.body).toBe('배란이 늦어질 수 있어요 (예상). 9월 22일까지 LH 테스트를 이어 가 봐요.')
    expect(e.primary).toEqual({ type: 'log', kind: 'lh', label: 'LH 기록' })
    expect(e.secondary).toEqual({ type: 'log', kind: 'ptest', label: '테스트 결과 기록' })
    expect(ttcPhase(st, '2026-09-16')?.noSurge).toEqual({ tests: 5, fertileEnd: '2026-09-15', until: '2026-09-22' })
    expect(m('2026-09-22', st).copy).toBe('owner.tww-no-surge')
    // The day after the wait: the ordinary 기다리는 주.
    expect(m('2026-09-23', st)).toMatchObject({ copy: 'owner.tww', title: '테스트까지 D-6' })
    // A surge during the wait pins ovulation: back to the ordinary flow (LH 기준).
    const surge = fresh({ lhTests: [...strips, { date: '2026-09-18', result: 'positive' as const, by: OWNER }] })
    expect(ttcPhase(surge, '2026-09-19')?.noSurge).toBeUndefined()
    expect(ttcMoment(surge, '2026-09-19', OWNER)!.copy).not.toBe('owner.tww-no-surge')
    // No strips this cycle → no such card; soft wording keeps LH off the card.
    expect(m('2026-09-16').copy).toBe('owner.tww')
    const soft = ttcMoment(withStyle(st, OWNER, 'soft'), '2026-09-16', OWNER)!
    expect(soft).toMatchObject({ copy: 'owner.tww-no-surge', eyebrow: '기다리는 주' })
    expect(words(soft)).not.toMatch(FERTILE_WORDS)
    expect(soft.primary).toEqual({ type: 'log', kind: 'lh', label: '오늘 기록' })
    expect(ttcMoment(withStyle(st, OWNER, 'off'), '2026-09-16', OWNER)!.copy).toBe('owner.tww')
    // The partner's card is the same waiting card as ever.
    expect(ttcMoment(st, '2026-09-16', PARTNER)!.copy).toBe('partner.tww')
    // A negative home test she took still wins ('다시 해 볼 날').
    expect(m('2026-09-16', { ...st, pregnancyTests: [test('2026-09-16', 'negative')] }).copy).toBe('owner.retest')
  })

  it('period days 1–3: her chips from the cycle that just ended, as a count — hers only', () => {
    // Chips in the 09-01 cycle, then the period 09-29.
    let st = fresh({ periods: [...REGULAR, { start: '2026-09-29' }] })
    st = setFeel(st, OWNER, '2026-09-20', 'tired')
    st = setFeel(st, OWNER, '2026-09-24', 'breast')
    st = setPrivateNote(st, OWNER, '2026-09-26', '테스트는 음성')
    st = setFeel(st, OWNER, '2026-09-29', 'cramps') // this cycle, not counted
    const e = ttcMoment(st, '2026-09-29', OWNER)!
    expect(e).toMatchObject({ copy: 'owner.period-early', lastFeels: { count: 2, cycleStart: '2026-09-01' } })
    expect(ttcMoment(st, '2026-10-01', OWNER)!.lastFeels).toEqual({ count: 2, cycleStart: '2026-09-01' })
    expect(lastFeelsFor(st, OWNER, '2026-09-29')).toEqual({ count: 2, cycleStart: '2026-09-01' })
    // Nothing logged → no link; no previous logged cycle → no link.
    expect(ttcMoment(fresh({ periods: [...REGULAR, { start: '2026-09-29' }] }), '2026-09-29', OWNER)!.lastFeels).toBeUndefined()
    expect(lastFeelsFor({ periods: [{ start: '2026-09-29' }], personalLog: st.personalLog }, OWNER, '2026-09-29')).toBeUndefined()
    // The partner never sees it, shared details or not.
    expect(ttcMoment(st, '2026-09-29', PARTNER)!.lastFeels).toBeUndefined()
    expect(ttcMoment(share(st), '2026-09-29', PARTNER)!.lastFeels).toBeUndefined()
    expect(words(ttcMoment(share(st), '2026-09-29', PARTNER)!)).not.toMatch(/지난 주기|피곤|가슴|예민|비쳐|살짝/)
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

describe('the expected period as a range on the home (N10)', () => {
  const m = (d: ISODate, st: AppState) => ttcMoment(st, d, OWNER)!
  // 지은's real case: 29…34-day cycles (average 31) → the 09-04 cycle's range is 10-03…10-08.
  const jieun = fresh({
    periods: [{ start: '2026-04-01' }, { start: '2026-05-01' }, { start: '2026-06-04' }, { start: '2026-07-03' }, { start: '2026-08-06' }, { start: '2026-09-04' }],
  })

  it('days 32–33 are inside the range: no 늦었어요, no test prompt — the home, the 주기 tab and the notice read one range', () => {
    const d32 = m('2026-10-05', jieun)
    expect(d32).toMatchObject({ kind: 'tww', copy: 'owner.period-due', cycleDay: 32 })
    expect(d32.body).toContain('10월 3일~8일 무렵이에요 (예상)')
    expect(words(d32)).not.toMatch(/지났어요|테스트해 볼까요|임신 테스트/)
    // From the test day the test is the action; the period log is right there too.
    expect(d32.primary).toMatchObject({ kind: 'ptest' })
    expect(d32.secondary).toMatchObject({ kind: 'period' })
    const tab = cycleSummary(jieun, '2026-10-05', 'explicit')
    expect(tab.headline.title).toBe('생리 예정 무렵이에요 (예상)')
    expect(tab.rows.find((r) => r.key === 'period')).toMatchObject({ label: '다음 생리 (예상)', value: '10월 3일~8일 무렵', sub: '기록 기준' })
    expect(ttcPhase(jieun, '2026-10-08')?.kind).toBe('tww')
    // Before the range: the countdown names the same range.
    const early = m('2026-09-28', jieun)
    expect(early.title).toBe('테스트까지 D-5')
    expect(early.body).toContain(dueRange(early.due!))
    expect(dueRange(early.due!)).toBe('10월 3일~8일')
    // The 주기 tab's row before the range: a countdown to its first day and the basis.
    expect(cycleSummary(jieun, '2026-09-28', 'explicit').rows.find((r) => r.key === 'period')?.sub).toBe('D-5 · 기록 기준')
  })

  it('late starts the day after the range; the test comes up from the third day (lateFrom + 2)', () => {
    const d1 = m('2026-10-09', jieun)
    expect(d1).toMatchObject({ kind: 'late', copy: 'owner.late', daysLate: 1, title: '예정일이 1일 지났어요', eyebrow: '생리 예정 10월 3일~8일 (예상)' })
    // Past the test day the test stays the action, but the card doesn't talk about testing yet.
    expect(d1.primary).toMatchObject({ kind: 'ptest' })
    expect(d1.secondary).toMatchObject({ kind: 'period' })
    expect(words(d1)).not.toMatch(/테스트해 볼까요|임신 테스트/)
    expect(m('2026-10-10', jieun)).toMatchObject({ daysLate: 2, copy: 'owner.late' })
    expect(m('2026-10-10', jieun).primary).toMatchObject({ kind: 'ptest' })
    expect(m('2026-10-10', jieun).body).toBe('조금 늦어질 수 있어요. 시작하면 기록해 주세요.')
    const d3 = m('2026-10-11', jieun)
    expect(d3).toMatchObject({ daysLate: 3, copy: 'owner.late', body: '테스트해 볼까요? 생리가 시작됐다면 기록해 주세요.' })
    expect(d3.primary).toMatchObject({ kind: 'ptest' })
    // The 주기 tab agrees on the day and on when the test comes up.
    expect(cycleSummary(jieun, '2026-10-09', 'explicit').headline).toMatchObject({ title: '생리 예정일이 1일 지났어요' })
    expect(cycleSummary(jieun, '2026-10-09', 'explicit').headline.sub).not.toContain('임신 테스트')
    expect(cycleSummary(jieun, '2026-10-11', 'explicit').headline.sub).toContain('임신 테스트')
    expect(cycleSummary(jieun, '2026-10-09', 'explicit').rows[0]).toMatchObject({ label: '생리 예정 (지남)', value: '10월 3일~8일 무렵', sub: 'D+1' })
    // …and the notice too (one late notice at +1, the test one at +3).
    const late = (d: ISODate) => scheduledNotices(jieun, d).filter((n) => n.to === OWNER && n.key.startsWith('late'))
    expect(late('2026-10-08')).toEqual([])
    expect(late('2026-10-09').map((n) => n.key)).toEqual(['late:2026-09-04:b'])
    expect(late('2026-10-11').map((n) => n.key)).toEqual(['late:2026-09-04:b', 'late-test:2026-09-04:b'])
    expect(late('2026-10-09')[0]!.body).toContain('10월 3일~8일')
    // A negative test she took herself still gets its 다시 해 볼 날, even on day 1.
    const neg = { ...jieun, pregnancyTests: [test('2026-10-08', 'negative')] }
    expect(m('2026-10-09', neg)).toMatchObject({ copy: 'owner.retest', body: '다시 해 볼 날: 10월 10일~11일' })
  })

  it('an LH surge this cycle sets the range from max(start + average, ovulation + 12)', () => {
    // Surge 09-25 → ovulation 09-26 → 10-08…10-10 (start + 31 = 10-05 is earlier).
    const lh = { ...jieun, lhTests: [{ date: '2026-09-25', result: 'positive' as const }] }
    expect(m('2026-10-05', lh)).toMatchObject({ kind: 'tww', copy: 'owner.tww', title: '테스트까지 D-3' })
    expect(m('2026-10-05', lh).body).toContain('10월 8일~10일')
    expect(m('2026-10-10', lh).copy).toBe('owner.period-due')
    expect(m('2026-10-11', lh)).toMatchObject({ kind: 'late', daysLate: 1 })
    // The ring keeps counting this cycle inside the range (never a projected one).
    expect(cycleStrip(lh, '2026-10-09', OWNER)).toMatchObject({ mode: 'cycle', cycleDay: 36, length: 36 })
  })

  it('15 days past the range: [생리 시작 기록] [아직 안 왔어요]; the answer keeps the cycle counting', () => {
    const d = '2026-10-23' // 15 days past 10-08
    const ask = m(d, jieun)
    expect(ask).toMatchObject({ kind: 'late', copy: 'owner.late-long', title: '혹시 기록을 빠뜨렸나요?', daysLate: 15, cycleStart: '2026-09-04' })
    expect(ask.body).toContain('9월 4일')
    expect(ask.primary).toEqual({ type: 'log', kind: 'period', label: '생리 시작 기록' })
    expect(ask.secondary).toEqual({ type: 'still-waiting', label: '아직 안 왔어요' })
    expect(m('2026-10-22', jieun).copy).toBe('owner.late') // day 14: still the gentle count
    // [아직 안 왔어요]
    const waiting = markStillWaiting(jieun, '2026-09-04', d)
    expect(waiting.cycleNotes).toEqual({ '2026-09-04': { stillWaiting: d } })
    expect(stillWaitingSince(waiting, '2026-09-04')).toBe(d)
    expect(markStillWaiting(waiting, '2026-09-04', '2026-10-25')).toBe(waiting) // answered once
    expect(markStillWaiting(jieun, 'not a date', d)).toBe(jieun)
    const card = m('2026-10-25', waiting)
    expect(card).toMatchObject({ copy: 'owner.late-waiting', eyebrow: '주기 52일째 · 길어지고 있어요', title: '조금 더 기다려 봐요', cycleDay: 52 })
    expect(card.body).toContain('병원에서 확인해 봐요')
    expect(card.body).not.toMatch(/\d+(일|주|개월)/) // no number of days: none in the evidence
    expect(card.note).toContain('NICE')
    expect(card.primary).toMatchObject({ kind: 'period' })
    expect(card.secondary).toMatchObject({ kind: 'ptest' })
    expect(words(card)).not.toMatch(/누락|빠뜨렸/)
    expect(cycleStrip(waiting, '2026-10-25', OWNER)).toMatchObject({ mode: 'cycle', cycleDay: 52, length: 52 })
    // The 주기 tab counts along, and the answer survives a backup.
    const tab = cycleSummary(waiting, '2026-10-25', 'explicit')
    expect(tab.headline.title).toBe('주기 52일째 · 길어지고 있어요')
    expect(tab.cycleDay).toBe(52)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(waiting)))!.cycleNotes).toEqual(waiting.cycleNotes)
    // A period logged later ends it: a fresh cycle.
    const logged = { ...waiting, periods: [...waiting.periods, { start: '2026-10-26' }] }
    expect(ttcPhase(logged, '2026-10-27')?.kind).toBe('period-early')
    // The partner sees none of this (no details): the waiting card.
    expect(ttcMoment(waiting, '2026-10-25', PARTNER)!.copy).toBe('partner.tww')
  })
})

describe('confidence: the calendar alone names no best days (N12)', () => {
  const m = (d: ISODate, st: AppState) => ttcMoment(st, d, OWNER)!
  const one = fresh({ periods: [{ start: '2026-09-01' }] }) // settings only
  const two = fresh({ periods: [{ start: '2026-08-04' }, { start: '2026-09-01' }] }) // one logged cycle

  it('settings only / one or two cycles: a wide range, the basis in the eyebrow, LH as the action', () => {
    const f = m(DAYS.peak, one)
    expect(f).toMatchObject({ copy: 'owner.fertile', confidence: 'low', title: '가임기 예상 범위예요 (넓음)', peak: false })
    expect(f.eyebrow).toBe('달력 기준 · 설정값 · 9월 15일까지')
    expect(f.body).toContain('범위가 좁아져요')
    expect(f.primary).toEqual({ type: 'log', kind: 'lh', label: 'LH 기록' })
    expect(words(f)).not.toMatch(/가능성 높|배란 예상/)
    expect(m(DAYS.peak, two).eyebrow).toBe('달력 기준 · 기록 1주기 · 9월 15일까지')
    expect(m(DAYS.beforeLh, one)).toMatchObject({ copy: 'owner.lh-start', eyebrow: '다가오는 가임기 · 달력 기준 · 설정값' })
    expect(m(DAYS.beforeLh, one).body).toContain('무렵부터예요 (예상 범위, 넓음)')
    // The strip: no peak, a flat band named as a range.
    const strip = cycleStrip(one, DAYS.peak, OWNER)!
    expect(strip).toMatchObject({ confidence: 'low', windowLabel: '예상 범위 (넓음)' })
    expect(strip.peakLabel).toBeUndefined()
    expect(strip.days.some((d) => d.tone === 'peak')).toBe(false)
    // Three regular cycles: the peak is named again.
    expect(m(DAYS.peak, fresh())).toMatchObject({ title: '가능성 높은 날이에요 (예상)', peak: true, confidence: 'cycles', eyebrow: '가임기 (예상) · 9월 15일까지' })
  })

  it('an LH surge this cycle: LH 기준, peak days back', () => {
    const lh = fresh({ periods: [{ start: '2026-09-01' }], lhTests: [{ date: '2026-09-12', result: 'positive' }] })
    expect(m('2026-09-13', lh)).toMatchObject({ confidence: 'lh', eyebrow: 'LH 기준 · 9월 13일까지', title: 'LH 양성이 나왔어요' })
    expect(cycleStrip(lh, '2026-09-13', OWNER)!.days.some((d) => d.tone === 'peak')).toBe(true)
  })

  it('soft, off and low-pressure wording never carries the basis (no LH, no 가임기) at any confidence', () => {
    for (const st of [one, two, fresh({ periods: [{ start: '2026-09-01' }], lhTests: [{ date: '2026-09-12', result: 'positive' }] })]) {
      for (const s of [withStyle(st, OWNER, 'soft'), withStyle(st, OWNER, 'off'), setPersonalPref(st, OWNER, 'lowPressure', true), share(st), withStyle(share(st), PARTNER, 'explicit')]) {
        for (const d of Object.values(DAYS)) {
          for (const v of [OWNER, PARTNER] as const) {
            const mo = ttcMoment(s, d, v)!
            if (mo.voice === 'explicit') continue
            expect(words(mo), `${v} ${d} ${mo.copy}`).not.toMatch(FERTILE_WORDS)
          }
        }
      }
    }
    expect(cycleStrip(withStyle(one, OWNER, 'soft'), DAYS.peak, OWNER)!.windowLabel).toBe('우리의 주간 (예상 범위)')
    expect(ttcMoment(withStyle(one, OWNER, 'soft'), DAYS.peak, OWNER)!.title).toBe('이번 주는 우리의 주간이에요')
  })
})

describe('병원과 함께 준비 중 (clinic mode, N13)', () => {
  const clinic = (over: Partial<AppState> = {}) => startClinicMode(fresh(over), '2026-09-05')
  const appt = (date: ISODate, title: string, who: 'a' | 'b' | 'both' = 'b', time?: string, place?: string): AppState =>
    addAppointment(clinic(), { date, title, who, kind: 'hospital', time, place }, OWNER)

  it('owner: the next appointment leads the card; a period does not end it; [병원 준비 마치기] does', () => {
    const s = appt('2026-09-15', '채혈·초음파', 'b', '08:00', '서울 난임센터')
    const mo = ttcMoment(s, DAYS.peak, OWNER)!
    expect(mo).toMatchObject({ kind: 'rest', copy: 'owner.clinic', restReason: 'clinic', eyebrow: CLINIC_LABEL, title: '내일 08:00 채혈·초음파' })
    expect(mo.body).toBe('9월 15일 (화) 08:00 · 서울 난임센터 · 지은')
    expect(mo.note).toContain('생리를 기록해도 꺼지지 않아요')
    expect(mo.primary).toEqual({ type: 'nav', to: 'plan', label: '병원 일정 보기' })
    expect(mo.secondary).toEqual({ type: 'end-rest', label: '병원 준비 마치기' })
    expect(words(mo)).not.toMatch(FERTILE_WORDS)
    expect(ttcMoment(s, '2026-09-15', OWNER)!.title).toBe('오늘 08:00 채혈·초음파')
    expect(ttcMoment(s, '2026-09-10', OWNER)!.title).toBe('9월 15일 08:00 채혈·초음파')
    // Done or past appointments don't lead; the next open one does.
    const two = addAppointment(s, { date: '2026-09-20', title: '인공수정', who: 'both', kind: 'hospital' }, OWNER)
    expect(ttcMoment(two, '2026-09-16', OWNER)!).toMatchObject({ title: '9월 20일 인공수정', body: '9월 20일 (일) · 둘이 함께' })
    expect(nextClinicAppointment(two, '2026-09-21')).toBeUndefined()
    // A logged period keeps the card (and the pause); every date estimate stays off.
    const logged = { ...s, periods: [...s.periods, { start: '2026-09-29' }] }
    expect(activeRest(logged)?.reason).toBe('clinic')
    expect(ttcPhase(logged, '2026-10-02')?.kind).toBe('rest')
    expect(ttcMoment(logged, DAYS.lateLong, OWNER)!.copy).toBe('owner.clinic')
    expect(scheduledNotices(logged, '2026-10-05').filter((n) => n.kind === 'fertile-start' || n.kind === 'peak' || n.kind === 'period-due')).toEqual([])
    expect(endRestFromHome(logged, '2026-10-02', NOW).restCycle).toBeUndefined()
  })

  it('owner without an appointment: asks for one ([일정 넣기] → 챙길 것)', () => {
    const mo = ttcMoment(clinic(), DAYS.tww, OWNER)!
    expect(mo).toMatchObject({ copy: 'owner.clinic', title: '병원 일정에 맞춰 준비해요', body: '다음 병원 일정을 넣어 두면 여기서 알려 드려요.' })
    expect(mo.primary).toEqual({ type: 'nav', to: 'plan', label: '일정 넣기' })
    expect(mo.secondary).toEqual({ type: 'end-rest', label: '병원 준비 마치기' })
  })

  it('partner: 일정에 맞춰 함께해요 — the schedule, never a window, a date idea or a question', () => {
    const s = appt('2026-09-15', '채혈·초음파', 'b', '08:00')
    for (const st of [s, share(s), withStyle(s, PARTNER, 'explicit'), withStyle(s, PARTNER, 'off')]) {
      const mo = ttcMoment(st, DAYS.peak, PARTNER)!
      expect(mo).toMatchObject({ kind: 'rest', copy: 'partner.clinic', eyebrow: CLINIC_LABEL, title: '일정에 맞춰 함께해요' })
      expect(mo.body).toContain('내일 08:00 채혈·초음파 · 지은')
      expect(mo.body).toContain('결과는 묻지 말고 일정만 함께 챙겨요')
      expect(mo.primary).toEqual({ type: 'nav', to: 'plan', label: '병원 일정 보기' })
      expect(mo.dateIdeas).toBeUndefined()
      expect(words(mo)).not.toMatch(FERTILE_WORDS)
      // No shared band for him; with her details, the ring shows her logged days only.
      const strip = cycleStrip(st, DAYS.peak, PARTNER)
      if (st.settings.shareCycleDetails) expect(strip!.days.every((d) => d.tone === 'period' || d.tone === 'none')).toBe(true)
      else expect(strip).toBeNull()
    }
    expect(ttcMoment(clinic(), DAYS.peak, PARTNER)!.body).toContain('일정이 잡히면 여기서 알려 드려요')
    expect(fertileHintsAllowed(s, PARTNER)).toBe(false)
    expect(fertileHintsAllowed(s, OWNER)).toBe(false)
  })

  it('the ring shows logged data only: no projected period, no window, while the sheet still logs', () => {
    const s = clinic()
    const strip = cycleStrip(s, DAYS.expected, OWNER)!
    expect(strip.hasWindow).toBe(false)
    expect(strip.days.some((d) => d.tone === 'period-predicted' || d.tone === 'fertile' || d.tone === 'peak')).toBe(false)
    expect(strip.days.filter((d) => d.tone === 'period')).toHaveLength(5)
    // The calendar agrees (lens.pause 'clinic'): nothing projected, periods logged.
    const lens = cycleLens(s, OWNER)
    expect(lens.pause).toBe('clinic')
    expect(lensPhase(dayInfo(s, DAYS.expected, DAYS.expected).phase, lens)).toBe('none')
    expect(lensPhase(dayInfo(s, DAYS.periodEarly, DAYS.expected).phase, lens)).toBe('period')
    expect(cycleSummary(s, DAYS.tww, 'explicit', lens).headline.title).toBe(CLINIC_LABEL)
    expect(cycleSummary(s, DAYS.tww, 'explicit', lens).rows.map((r) => r.key)).toEqual(['avg'])
    expect(cycleSummary(s, DAYS.tww, 'soft', cycleLens(s, PARTNER)).headline).toEqual(CLINIC_PARTNER_HEADLINE)
    // Logging still works for the owner; the clinic mode survives it.
    const logged = logPeriodStart(s, DAYS.expected, OWNER, DAYS.expected)
    expect(logged.periods.some((p) => p.start === DAYS.expected)).toBe(true)
    expect(isClinicMode(logged)).toBe(true)
  })

  it('an ordinary rest still reads 이번 주기는 쉬어요 and ends with the next period', () => {
    const s = startRestCycle(fresh(), '2026-09-05', 'rest')
    expect(ttcMoment(s, DAYS.peak, OWNER)!.copy).toBe('owner.rest')
    expect(ttcMoment(s, DAYS.peak, PARTNER)!.copy).toBe('partner.neutral')
    expect(cycleLens(s, OWNER).pause).toBe('rest')
    expect(cycleStrip(s, DAYS.expected, OWNER)!.days.some((d) => d.tone === 'period-predicted')).toBe(true)
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
    expect(ttcMoment(answered(s), DAYS.period, OWNER)).toMatchObject({ copy: 'owner.period', title: '생리 4일째예요' })
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
    expect(p(answered(s), DAYS.period).partnerTip).toBeUndefined()
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

  it('says where to stand next: the first scan from LMP + 5 weeks, folic acid continues', () => {
    const m = ttcMoment(pending, '2026-09-28', OWNER)!
    expect(ULTRASOUND_FROM_DAYS).toBe(35)
    // Last period 09-01 → 10-06.
    expect(m.body).toContain('5~6주 무렵(10월 6일부터)')
    expect(m.body).toContain('병원마다 달라요')
    expect(m.body).toContain('엽산은 그대로 이어 가요')
    expect(m.primary).toEqual({ type: 'nav', to: 'plan', label: '병원 일정 넣기' })
    // Without a logged period there is no date to count from.
    const noLmp = markPositivePending(fresh({ periods: [] }), '2026-09-26')
    expect(ttcMoment(noLmp, '2026-09-28', OWNER)!.body).toMatch(/5~6주 무렵 초음파/)
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

  it('rest wins over late, and ends with the next period', () => {
    const s = startRestCycle(fresh(), '2026-09-05', 'rest')
    // Past the expected day the card still rests — no "예정일이 지났어요", no test prompt.
    expect(ttcPhase(s, DAYS.late)?.kind).toBe('rest')
    expect(ttcMoment(s, DAYS.late, OWNER)).toMatchObject({ copy: 'owner.rest', title: '이번 주기는 쉬어요' })
    expect(ttcMoment(s, DAYS.lateLong, OWNER)!.copy).toBe('owner.rest')
    // The ring keeps counting the real cycle (day 32), with no window.
    expect(cycleStrip(s, DAYS.late, OWNER)).toMatchObject({ mode: 'cycle', cycleDay: 32, length: 32, hasWindow: false })
    const next = { ...s, periods: [...s.periods, { start: '2026-09-29' }] }
    expect(activeRest(next)).toBeUndefined()
    expect(onPeriodLogged(next, '2026-09-29').restCycle).toBeUndefined()
    expect(ttcPhase(next, '2026-10-01')?.kind).toBe('period-early')
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
    expect(cycleStrip(answered(fresh()), DAYS.period, OWNER)!.hasWindow).toBe(true)
  })

  it('once she told him, his strip rests on period days 1–3 too (and only then)', () => {
    const told = tellPartnerPeriod(fresh(), '2026-09-01', NOW)
    expect(ttcMoment(told, DAYS.periodEarly, PARTNER)!.copy).toBe('partner.period-told')
    expect(cycleStrip(told, DAYS.periodEarly, PARTNER)).toBeNull()
    expect(cycleStrip(told, '2026-09-03', PARTNER)).toBeNull()
    // Day 4: the shared band is back; 괜찮아요 (not told) never hides it.
    expect(cycleStrip(told, DAYS.period, PARTNER)!.mode).toBe('weeks')
    expect(cycleStrip(answered(fresh()), DAYS.periodEarly, PARTNER)!.mode).toBe('weeks')
    // Her own strip is unchanged by the answer.
    expect(cycleStrip(told, DAYS.periodEarly, OWNER)!.hasWindow).toBe(false)
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
    expect(ttcMoment(s, DAYS.tww, OWNER)).toMatchObject({ copy: 'owner.tww', title: '테스트까지 D-9', eyebrow: '배란 뒤 5일째 (예상)' })
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

describe('home strip and calendar agree on peak days and LH marks', () => {
  const lh = { lhTests: [{ date: '2026-09-11', result: 'faint' as const }, { date: '2026-09-12', result: 'positive' as const }] }
  const viewers: [string, AppState, 'a' | 'b'][] = [
    ['owner explicit', fresh(lh), OWNER],
    ['owner soft', withStyle(fresh(lh), OWNER, 'soft'), OWNER],
    ['owner off', withStyle(fresh(lh), OWNER, 'off'), OWNER],
    ['owner low-pressure', setPersonalPref(fresh(lh), OWNER, 'lowPressure', true), OWNER],
    ['partner soft, no details', fresh(lh), PARTNER],
    ['partner explicit, no details', withStyle(fresh(lh), PARTNER, 'explicit'), PARTNER],
    ['partner soft, details', share(fresh(lh)), PARTNER],
    ['partner explicit, details', withStyle(share(fresh(lh)), PARTNER, 'explicit'), PARTNER],
    ['partner off, details', withStyle(share(fresh(lh)), PARTNER, 'off'), PARTNER],
    ['partner low-pressure, details', setPersonalPref(share(fresh(lh)), PARTNER, 'lowPressure', true), PARTNER],
  ]

  it('a strip day is a peak day exactly when the calendar shows it as one', () => {
    for (const [name, s, v] of viewers) {
      for (const today of [DAYS.fertile, DAYS.peak, DAYS.tww]) {
        const strip = cycleStrip(s, today, v)
        if (!strip) continue
        const lens = cycleLens(s, v)
        for (const d of strip.days) {
          // The strip only draws this cycle's window (the calendar also shows 가능 범위 around it).
          if (d.tone === 'fertile' || d.tone === 'peak') {
            const cal = lensPhase(dayInfo(s, d.date, today).phase, lens)
            expect(d.tone === 'peak', `${name} ${today} ${d.date}`).toBe(cal === 'peak')
          }
          expect(!!d.lh && !showsLH(lens), `${name} ${d.date} LH`).toBe(false)
        }
      }
    }
  })

  it('a partner with shared details sees the darker peak days, softly named', () => {
    const strip = cycleStrip(share(fresh(lh)), DAYS.fertile, PARTNER)!
    expect(strip.mode).toBe('cycle')
    expect(strip.days.filter((d) => d.tone === 'peak').length).toBeGreaterThanOrEqual(2)
    expect(strip.peakLabel).toBe('특히 좋은 때 (예상)')
    expect(strip.windowLabel).toBe('우리의 주간 (예상)')
    expect(strip.days.some((d) => d.lh)).toBe(false)
    // In explicit wording: 가능성 높음, with the LH marks.
    const ex = cycleStrip(withStyle(share(fresh(lh)), PARTNER, 'explicit'), DAYS.fertile, PARTNER)!
    expect(ex.peakLabel).toBe('가능성 높음')
    expect(ex.days.find((d) => d.date === '2026-09-12')?.lh).toBe('surge')
  })

  it('without shared details: only the 우리의 주간 band, no peak', () => {
    for (const s of [fresh(lh), withStyle(fresh(lh), PARTNER, 'explicit')]) {
      const strip = cycleStrip(s, DAYS.fertile, PARTNER)!
      expect(strip.mode).toBe('weeks')
      expect(strip.peakLabel).toBeUndefined()
      expect(strip.days.some((d) => d.tone === 'peak' || d.lh)).toBe(false)
    }
  })

  it('no peak while resting or waiting for the clinic', () => {
    expect(cycleStrip(startRestCycle(share(fresh()), '2026-09-05'), DAYS.peak, PARTNER)?.peakLabel).toBeUndefined()
    const pending = markPositivePending(fresh(), '2026-09-28')
    expect(cycleStrip(pending, '2026-09-28', OWNER)!.days.some((d) => d.tone === 'peak')).toBe(false)
  })
})

describe('우리의 주간 teaser follows fertileHintsAllowed', () => {
  it('date ideas only for a viewer who may see fertile hints', () => {
    const cases: [AppState, 'a' | 'b'][] = [
      [fresh(), PARTNER],
      [share(fresh()), PARTNER],
      [withStyle(fresh(), PARTNER, 'off'), PARTNER],
      [setPersonalPref(fresh(), PARTNER, 'lowPressure', true), PARTNER],
      [startRestCycle(fresh(), '2026-09-05'), PARTNER],
      [fresh(), OWNER],
      [withStyle(fresh(), OWNER, 'soft'), OWNER],
    ]
    let seen = 0
    for (const [s, v] of cases) {
      for (const d of Object.values(DAYS)) {
        const m = ttcMoment(s, d, v)
        if (!m) continue
        if (m.dateIdeas || m.copy === 'partner.our-week' || m.copy === 'partner.our-week-soon') {
          seen++
          expect(fertileHintsAllowed(s, v), `${v} ${d}`).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })
})
