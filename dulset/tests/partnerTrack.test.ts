import { describe, expect, it } from 'vitest'
import { FERTILITY_CHECK_GUIDE } from '@/lib/content/programs'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment, setAppointmentDone } from '@/lib/logic/appointments'
import { startClinicMode } from '@/lib/logic/clinic'
import {
  CLINIC_PARTNER_TIP,
  FERTILITY_APPLY_ID,
  FERTILITY_CARRIER_TEST_ID,
  FERTILITY_CLAIM_ID,
  FERTILITY_TEST_ID,
  NEUTRAL_PARTNER_TIPS,
  appliedMembers,
  bookingDraft,
  chainKey,
  claimDocs,
  completeMonthlyTask,
  fertilityChain,
  canHandOverCycle,
  handOverCycle,
  monthlyTask,
  neutralPartnerTip,
  ownerAge,
  partnerId,
  partnerTip,
  partnerTipsFor,
  setClaimDocDone,
  setFertilityApplied,
  setFertilityClaimed,
  setShareCycleDetails,
  TASK_STAGE_LABEL,
  taskStageLabel,
  testIdFor,
} from '@/lib/logic/partnerTrack'
import { setPersonalPref, shareLevelOf } from '@/lib/logic/prefs'
import { addCustomTask } from '@/lib/logic/roadmap'
import { tickItem } from '@/lib/logic/plan'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { PERIOD_PARTNER_TIP, skipTellPartnerPeriod, tellPartnerPeriod, ttcMoment } from '@/lib/logic/ttcFlow'
import type { AppState, MemberId } from '@/lib/types'

const TODAY = '2026-09-28'

// 'a' = 민수 (partner, doesn't track the cycle), 'b' = 지은 (tracks the cycle).
function fresh(ownerBirthYear = 1994, over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: ownerBirthYear },
      cycleOwner: 'b',
    },
    new Date(2026, 8, 28, 9),
  )
  return { ...s, ...over }
}

const tick = (s: AppState, id: string, at: string, by: 'a' | 'b' = 'a') => tickItem(id, true, at, by)(s)
const applied = (s: AppState, member: MemberId, at: string) => setFertilityApplied(s, member, true, at)

const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야/
/** Words that would tell a soft / calm partner where the cycle is. */
const TIMING = /가임|배란|LH|증상|기다리|주간|예정일|늦/

describe('가임력 검사 chain (per person)', () => {
  it('starts with the application for the partner', () => {
    expect(partnerId(fresh())).toBe('a')
    expect(fertilityChain(fresh(), TODAY)).toMatchObject({ member: 'a', step: 'apply', lapsed: false })
    expect(testIdFor(fresh(), 'a')).toBe(FERTILITY_TEST_ID)
    expect(testIdFor(fresh(), 'b')).toBe(FERTILITY_CARRIER_TEST_ID)
  })

  it('gives 3 months to test after applying and 1 month to claim after the test', () => {
    let s = applied(fresh(), 'a', '2026-09-28')
    // The application day is day 1 (like 신고기간): 9/28 + 3개월 → 12/27.
    expect(fertilityChain(s, '2026-10-01')).toMatchObject({ step: 'test', appliedAt: '2026-09-28', testBy: '2026-12-27', lapsed: false })
    expect(fertilityChain(s, '2026-12-27').lapsed).toBe(false)
    expect(fertilityChain(s, '2026-12-28').lapsed).toBe(true)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-15')
    expect(fertilityChain(s, '2026-10-20')).toMatchObject({ step: 'claim', testedAt: '2026-10-15', claimBy: '2026-11-14', lapsed: false })
    expect(fertilityChain(s, '2026-11-15').lapsed).toBe(true)
    s = setFertilityClaimed(s, true, '2026-10-30', 'a')
    expect(fertilityChain(s, '2026-10-30')).toMatchObject({ step: 'done', claimedAt: '2026-10-30' })
    expect(s.planDone[chainKey(FERTILITY_CLAIM_ID, 'a')]).toEqual({ at: '2026-10-30', by: 'a' })
    // Undo.
    expect(fertilityChain(setFertilityClaimed(s, false, '2026-10-30', 'a'), '2026-10-30').step).toBe('claim')
    expect(setFertilityClaimed(s, true, '2026-10-31', 'a')).toBe(s)
  })

  it("keeps her application and his apart: her tick never moves his card to 검사", () => {
    const hers = applied(fresh(), 'b', '2026-09-20')
    expect(appliedMembers(hers.planDone)).toEqual(['b'])
    expect(fertilityChain(hers, TODAY, 'a').step).toBe('apply')
    expect(fertilityChain(hers, TODAY, 'b')).toMatchObject({ step: 'test', appliedAt: '2026-09-20' })
    expect(monthlyTask(hers, TODAY, 'a')?.step).toBe('apply')
    // The couple's shared row stays open until both have applied…
    expect(hers.planDone[FERTILITY_APPLY_ID]).toBeUndefined()
    const both = applied(hers, 'a', '2026-09-25')
    expect(appliedMembers(both.planDone)).toEqual(['a', 'b'])
    expect(both.planDone[FERTILITY_APPLY_ID]).toEqual({ at: '2026-09-25', by: 'a' })
    expect(fertilityChain(both, TODAY, 'a')).toMatchObject({ step: 'test', appliedAt: '2026-09-25' })
    expect(fertilityChain(both, TODAY, 'b')).toMatchObject({ step: 'test', appliedAt: '2026-09-20' })
    // …and undoing one of them reopens the row without losing the other's date.
    const undone = setFertilityApplied(both, 'b', false, TODAY)
    expect(undone.planDone[FERTILITY_APPLY_ID]).toBeUndefined()
    expect(appliedMembers(undone.planDone)).toEqual(['a'])
    expect(fertilityChain(undone, TODAY, 'a').appliedAt).toBe('2026-09-25')
    expect(fertilityChain(undone, TODAY, 'b').step).toBe('apply')
    // Applying twice keeps the first date; undoing nothing is a no-op.
    expect(applied(both, 'a', TODAY)).toBe(both)
    const none = fresh()
    expect(setFertilityApplied(none, 'a', false, TODAY)).toBe(none)
  })

  it('reads the couple’s shared 챙길 것 row (둘이 함께) as both applied — older data and the 보건소 visit together', () => {
    const together = tick(fresh(), FERTILITY_APPLY_ID, '2026-09-20', 'b')
    expect(appliedMembers(together.planDone)).toEqual(['a', 'b'])
    expect(fertilityChain(together, TODAY, 'a')).toMatchObject({ step: 'test', appliedAt: '2026-09-20' })
    expect(fertilityChain(together, TODAY, 'b')).toMatchObject({ step: 'test', appliedAt: '2026-09-20' })
    // He undoes his: the row opens, hers is kept under her own key.
    const his = setFertilityApplied(together, 'a', false, TODAY)
    expect(his.planDone[FERTILITY_APPLY_ID]).toBeUndefined()
    expect(his.planDone[chainKey(FERTILITY_APPLY_ID, 'b')]).toEqual({ at: '2026-09-20', by: 'b' })
    expect(fertilityChain(his, TODAY, 'a').step).toBe('apply')
    expect(fertilityChain(his, TODAY, 'b').step).toBe('test')
  })

  it('reads an older claim mark as the partner’s (or whoever made it) and undoes it too', () => {
    let s = applied(fresh(), 'a', '2026-09-01')
    s = tick(s, FERTILITY_TEST_ID, '2026-09-10')
    const legacy = { ...s, planDone: { ...s.planDone, [FERTILITY_CLAIM_ID]: { at: '2026-09-20', by: 'a' as const } } }
    expect(fertilityChain(legacy, TODAY, 'a')).toMatchObject({ step: 'done', claimedAt: '2026-09-20' })
    expect(fertilityChain(legacy, TODAY, 'b').claimedAt).toBeUndefined()
    const undone = setFertilityClaimed(legacy, false, TODAY, 'a')
    expect(undone.planDone[FERTILITY_CLAIM_ID]).toBeUndefined()
    expect(fertilityChain(undone, TODAY, 'a').step).toBe('claim')
    // No recorded member: it was made from the partner's card.
    const unsigned = { ...s, planDone: { ...s.planDone, [FERTILITY_CLAIM_ID]: { at: '2026-09-20' } } }
    expect(fertilityChain(unsigned, TODAY, 'a').step).toBe('done')
    expect(fertilityChain(unsigned, TODAY, 'b').claimedAt).toBeUndefined()
  })

  it('has nothing to claim when the test came after the 3-month window', () => {
    let s = applied(fresh(), 'a', '2026-06-01') // testBy 2026-08-31
    s = tick(s, FERTILITY_TEST_ID, '2026-08-31')
    expect(fertilityChain(s, '2026-09-05')).toMatchObject({ step: 'claim', claimBy: '2026-09-30' })
    const late = tick(applied(fresh(), 'a', '2026-06-01'), FERTILITY_TEST_ID, '2026-09-01')
    expect(fertilityChain(late, '2026-09-05')).toMatchObject({ step: 'done', claimBy: undefined, lapsed: false })
    expect(monthlyTask(late, '2026-09-05', 'a')?.step).toBeUndefined()
  })

  it('has nothing to claim when the test came before the application (소급 불가)', () => {
    let s = tick(fresh(), FERTILITY_TEST_ID, '2026-09-01')
    expect(fertilityChain(s, TODAY)).toMatchObject({ step: 'done', claimBy: undefined })
    s = applied(s, 'a', '2026-09-10')
    expect(fertilityChain(s, TODAY)).toMatchObject({ step: 'done', claimBy: undefined })
  })

  it('tracks the four claim papers per person', () => {
    const s = fresh()
    expect(claimDocs(s, 'a').map((d) => [d.id, d.label, d.done])).toEqual([
      ['form', '청구서', false],
      ['receipt', '영수증', false],
      ['statement', '세부내역서', false],
      ['bankbook', '통장사본', false],
    ])
    expect(FERTILITY_CHECK_GUIDE.claimDocs.map((d) => d.label)).toEqual(['청구서', '영수증', '세부내역서', '통장사본'])
    const one = setClaimDocDone(s, 'a', 'receipt', true, TODAY)
    expect(claimDocs(one, 'a').find((d) => d.id === 'receipt')?.done).toBe(true)
    expect(claimDocs(one, 'b').every((d) => !d.done)).toBe(true)
    expect(setClaimDocDone(one, 'a', 'receipt', true, '2026-09-29')).toBe(one)
    expect(claimDocs(setClaimDocDone(one, 'a', 'receipt', false, TODAY), 'a').every((d) => !d.done)).toBe(true)
    expect(setClaimDocDone(s, 'a', 'form', false, TODAY)).toBe(s)
  })
})

describe('이번 달 할 일 — stages', () => {
  it('asks the partner to apply first, with where to apply and what he gets', () => {
    // 민수 hears about fertile days the soft way (the partner's default): no "가임" word.
    const t = monthlyTask(fresh(), TODAY, 'a')!
    expect(t).toMatchObject({ id: FERTILITY_APPLY_ID, step: 'apply', stage: 'apply', title: '임신 전 검사 지원 신청하기', top: false })
    expect(t.why).toContain('먼저 신청')
    expect(t.why).toContain('보건소·병원마다')
    expect(t.guide).toEqual({ where: 'e보건소(온라인) 또는 주소지 보건소', bring: '검사의뢰서 (출력물이나 모바일 화면)', cost: '최대 5만 원 지원 · 차액은 본인 부담' })
    expect(t.link?.url).toBe(FERTILITY_CHECK_GUIDE.url)
    expect(t.owners).toEqual(['a'])
    expect(t.defaultDoneAt).toBe(TODAY)
    expect(`${t.title} ${t.why} ${t.guide?.where} ${t.tip}`).not.toMatch(/가임|배란/)
    expect(`${t.title} ${t.why} ${t.tip}`).not.toMatch(BANNED)
  })

  it('says "가임력 검사" only to a viewer who chose the explicit wording', () => {
    const s = fresh()
    const explicit = { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, a: 'explicit' as const } } }
    expect(monthlyTask(explicit, TODAY, 'a')?.title).toBe('가임력 검사 지원 신청하기')
    // …but not once they turn on 부담 없이 for their own phone.
    const low = { ...explicit, settings: { ...explicit.settings, personal: { a: { lowPressure: true } } } }
    expect(monthlyTask(low, TODAY, 'a')?.title).toBe('임신 전 검사 지원 신청하기')
    const off = { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, a: 'off' as const } } }
    expect(monthlyTask(off, TODAY, 'a')?.title).toBe('임신 전 검사 지원 신청하기')
  })

  it('before booking: what, where, what to bring, what it costs, and a prefilled 일정 잡기', () => {
    const s = applied(fresh(), 'a', TODAY)
    const t = monthlyTask(s, '2026-10-01', 'a')!
    expect(t).toMatchObject({ id: FERTILITY_TEST_ID, step: 'test', stage: 'book', title: '정액검사 받기', dueBy: '2026-12-27', top: true })
    expect(t).toMatchObject({ status: 'now', end: '2026-12-27', deadline: true })
    expect(t.dueText).toBe('검사 마감 12월 27일 (일) · 신청 후 3개월 안')
    expect(t.appointment).toBeUndefined()
    expect(t.guide).toEqual({
      what: '정액검사',
      where: '사업에 참여하는 의료기관 (e보건소·보건소에서 확인)',
      bring: '검사의뢰서',
      cost: '최대 5만 원 지원 · 차액은 본인 부담',
    })
    expect(t.why).toContain('병원 안내를 따라요')
    expect(t.minDoneAt).toBe(TODAY)
    expect(t.defaultDoneAt).toBe('2026-10-01')
    const draft = bookingDraft(s, 'a', '2026-10-01')
    expect(draft).toMatchObject({ date: '2026-10-01', title: '정액검사', who: 'a', kind: 'test', taskId: FERTILITY_TEST_ID })
    expect(draft.note).toContain('검사의뢰서')
  })

  it('booked: carries the appointment, then asks 다녀왔어요? once its day has come', () => {
    let s = applied(fresh(), 'a', TODAY)
    s = addAppointment(s, { date: '2026-10-14', time: '08:30', title: '정액검사', place: '비뇨의학과', who: 'a', kind: 'test', taskId: FERTILITY_TEST_ID }, 'a')
    const appt = s.appointments[0]!
    const booked = monthlyTask(s, '2026-10-02', 'a')!
    expect(booked).toMatchObject({ step: 'test', stage: 'booked' })
    expect(booked.appointment?.id).toBe(appt.id)
    expect(booked.defaultDoneAt).toBe('2026-10-02')
    // The day itself and after: the question, dated to the booked day.
    for (const day of ['2026-10-14', '2026-10-20']) {
      const visited = monthlyTask(s, day, 'a')!
      expect(visited).toMatchObject({ step: 'test', stage: 'visited', defaultDoneAt: '2026-10-14' })
      expect(visited.appointment?.id).toBe(appt.id)
    }
    // 네, 10/14에: the test is dated to the visit (not to today) and the appointment is 다녀왔어요.
    const visited = monthlyTask(s, '2026-10-20', 'a')!
    const done = completeMonthlyTask(s, visited, visited.defaultDoneAt, 'a')
    expect(done.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-10-14', by: 'a' })
    expect(done.appointments[0]!.done).toBe(true)
    expect(fertilityChain(done, '2026-10-20')).toMatchObject({ step: 'claim', claimBy: '2026-11-13' })
    // 되돌리기 puts both back.
    const back = completeMonthlyTask(done, visited, visited.defaultDoneAt, 'a', false)
    expect(back.planDone[FERTILITY_TEST_ID]).toBeUndefined()
    expect(back.appointments[0]!.done).toBeFalsy()
    expect(monthlyTask(back, '2026-10-20', 'a')?.stage).toBe('visited')
    // An appointment already marked 다녀왔어요 in 챙길 것 is behind us: back to booking.
    const marked = setAppointmentDone(s, appt.id, true)
    expect(monthlyTask(marked, '2026-10-20', 'a')?.stage).toBe('book')
  })

  it('then the claim with its four papers and the 1-month deadline, then moves on', () => {
    let s = applied(fresh(), 'a', TODAY)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-15')
    const t = monthlyTask(s, '2026-10-20', 'a')!
    expect(t).toMatchObject({ id: FERTILITY_CLAIM_ID, step: 'claim', stage: 'claim', title: '검사비 청구하기', dueBy: '2026-11-14', top: true })
    expect(t.dueText).toContain('청구 마감 11월 14일')
    expect(t.docs?.map((d) => d.label)).toEqual(['청구서', '영수증', '세부내역서', '통장사본'])
    expect(t.why).toContain('청구 후 3개월 안에 입금')
    expect(t.minDoneAt).toBe('2026-10-15')
    expect(t.doneAt).toBeUndefined()
    const ticked = setClaimDocDone(s, 'a', 'statement', true, '2026-10-20')
    expect(monthlyTask(ticked, '2026-10-20', 'a')!.docs?.find((d) => d.id === 'statement')?.done).toBe(true)
    s = completeMonthlyTask(s, t, '2026-10-22', 'a')
    expect(s.planDone[chainKey(FERTILITY_CLAIM_ID, 'a')]).toEqual({ at: '2026-10-22', by: 'a' })
    const next = monthlyTask(s, '2026-10-22', 'a')!
    expect(next.step).toBeUndefined()
    expect(next.stage).toBeUndefined()
    expect([FERTILITY_APPLY_ID, FERTILITY_TEST_ID, FERTILITY_CLAIM_ID]).not.toContain(next.id)
    // His own item before a shared one.
    expect(next.owners).toEqual(['a'])
  })

  it('keeps a lapsed step for a month, gently, then lets it go', () => {
    const s = applied(fresh(), 'a', '2026-06-01')
    const lapsed = monthlyTask(s, '2026-09-05', 'a')! // testBy 2026-08-31
    expect(lapsed).toMatchObject({ step: 'test', status: 'overdue' })
    expect(lapsed.dueText).toContain('지났어요')
    expect(monthlyTask(s, '2026-10-15', 'a')?.step).toBeUndefined()
  })

  it('puts the check at the top when the cycle owner is 35 or older', () => {
    const t = monthlyTask(fresh(1990), TODAY, 'a')! // 36 in 2026
    expect(ownerAge(fresh(1990), TODAY)).toBe(36)
    expect(t).toMatchObject({ step: 'apply', top: true })
    expect(t.why).toContain('35세 이상')
    expect(t.why).toContain('ASRM')
    // Not at 34.
    expect(monthlyTask(fresh(1992), TODAY, 'a')).toMatchObject({ step: 'apply', top: false })
  })

  it('never lets an item of his own, even a dated one, outrank a chain step', () => {
    const withTask = (s: AppState) =>
      addCustomTask(s, { title: '회사 일정 조율', phase: 'preconception', who: 'a', due: '2026-10-02' }, 'a')
    expect(monthlyTask(withTask(fresh(1994)), TODAY, 'a')).toMatchObject({ step: 'apply', top: false })
    expect(monthlyTask(withTask(fresh(1990)), TODAY, 'a')).toMatchObject({ step: 'apply', top: true })
    expect(monthlyTask(withTask(applied(fresh(), 'a', TODAY)), '2026-10-01', 'a')?.step).toBe('test')
    // Once the chain is done, his own dated item comes first.
    let s = withTask(applied(fresh(), 'a', '2026-09-01'))
    s = tick(s, FERTILITY_TEST_ID, '2026-09-10')
    s = setFertilityClaimed(s, true, '2026-09-20', 'a')
    expect(monthlyTask(s, TODAY, 'a')?.title).toBe('회사 일정 조율')
  })

  it('completes the steps the way the roadmap records them, dated to when it happened', () => {
    let s = fresh()
    s = completeMonthlyTask(s, monthlyTask(s, TODAY, 'a')!, '2026-09-25', 'a')
    expect(s.planDone[chainKey(FERTILITY_APPLY_ID, 'a')]).toEqual({ at: '2026-09-25', by: 'a' })
    expect(fertilityChain(s, TODAY, 'a').appliedAt).toBe('2026-09-25')
    s = completeMonthlyTask(s, monthlyTask(s, TODAY, 'a')!, '2026-10-10', 'a')
    expect(s.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-10-10', by: 'a' })
    // Ticked on her phone for him: the step stays his.
    const hers = completeMonthlyTask(fresh(), monthlyTask(fresh(), TODAY, 'a')!, TODAY, 'b', true, 'a')
    expect(hers.planDone[chainKey(FERTILITY_APPLY_ID, 'a')]).toEqual({ at: TODAY, by: 'b' })
    expect(fertilityChain(hers, TODAY, 'a').step).toBe('test')
    expect(fertilityChain(hers, TODAY, 'b').step).toBe('apply')
  })

  it('undoes each step the same way, and completing twice keeps the first date', () => {
    let s = applied(fresh(), 'a', TODAY)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-10')
    const claim = monthlyTask(s, '2026-10-12', 'a')!
    expect(claim.step).toBe('claim')
    const claimed = completeMonthlyTask(s, claim, '2026-10-12', 'a')
    expect(completeMonthlyTask(claimed, claim, '2026-10-13', 'a')).toBe(claimed)
    expect(completeMonthlyTask(claimed, claim, '2026-10-12', 'a', false)).toEqual(s)
    // Undoing the test puts the chain back on the test step with its deadline.
    const test = { id: FERTILITY_TEST_ID, step: 'test' as const }
    const untested = completeMonthlyTask(s, test, '2026-10-12', 'a', false)
    expect(monthlyTask(untested, '2026-10-12', 'a')).toMatchObject({ step: 'test', stage: 'book', dueBy: '2026-12-27' })
    // Undoing the application too.
    const unapplied = completeMonthlyTask(untested, { id: FERTILITY_APPLY_ID, step: 'apply' }, TODAY, 'a', false)
    expect(monthlyTask(unapplied, TODAY, 'a')?.step).toBe('apply')
  })

  it('never offers daily habits or "when needed" items as the month task', () => {
    let s = applied(fresh(), 'a', '2026-01-01')
    s = tick(s, FERTILITY_TEST_ID, '2026-01-10')
    s = setFertilityClaimed(s, true, '2026-01-20', 'a')
    const seen = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const t = monthlyTask(s, TODAY, 'a')
      if (!t) break
      seen.add(t.id)
      s = completeMonthlyTask(s, t, TODAY, 'a')
    }
    expect(seen.has('pre-habits-partner')).toBe(false)
    expect(seen.has('pre-infertility-support')).toBe(false)
    expect(seen.size).toBeGreaterThan(0)
  })

  it('outside preparing (or for the owner) picks the most urgent open item as before', () => {
    const owner = monthlyTask(fresh(), TODAY, 'b')!
    expect(owner.step).toBeUndefined()
    expect(owner.owners).toContain('b')
    expect(owner.tip).toBeUndefined()
    const preg = fresh(1994, {
      stage: 'pregnant',
      pregnancy: { lmp: '2026-08-10', confirmedAt: '2026-09-15' },
    })
    const t = monthlyTask(preg, TODAY, 'a')
    expect(t?.step).toBeUndefined()
    expect(t?.phase).not.toBe('preconception')
    expect(t?.tip).toBeUndefined()
  })
})

describe('오늘 해 줄 수 있는 것', () => {
  // 지은's cycle: period 9/10, 28 days → fertile around 9/19–9/24, waiting from 9/25, late from 10/9.
  const cycle = (over: Partial<AppState> = {}) =>
    fresh(1994, { periods: [{ start: '2026-08-13', by: 'b' }, { start: '2026-09-10', by: 'b' }], ...over })
  const style = (s: AppState, a: 'explicit' | 'soft' | 'off') => ({ ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, a } } })
  const shared = (s: AppState) => setShareCycleDetails(s, 'b', true)

  it('is on every stage of the partner card and rotates on neutral days', () => {
    const s = cycle()
    for (const day of ['2026-09-12', '2026-09-28', '2026-10-05']) {
      expect(monthlyTask(s, day, 'a')?.tip).toBeTruthy()
    }
    const tips = new Set(['2026-09-11', '2026-09-12', '2026-09-13'].map((d) => partnerTip(cycle(), d, 'a')))
    expect(tips.size).toBeGreaterThan(1)
    expect(NEUTRAL_PARTNER_TIPS).toContain(neutralPartnerTip(TODAY))
    for (const tip of NEUTRAL_PARTNER_TIPS) {
      expect(tip).not.toMatch(TIMING)
      expect(tip).not.toMatch(BANNED)
    }
  })

  it('follows the moment for a soft viewer: our week, the waiting week — never the period he was not told about', () => {
    const s = cycle()
    // (N24) The tips rotate by date within the moment's own list.
    expect(partnerTipsFor('partner.our-week')).toContain(partnerTip(s, '2026-09-22', 'a'))
    // (N19) Without her details the waiting weeks are the '평소 주': a neutral tip;
    // with them, the waiting week's own list.
    expect(NEUTRAL_PARTNER_TIPS).toContain(partnerTip(s, '2026-09-28', 'a'))
    expect(partnerTipsFor('partner.tww')).toContain(partnerTip(shared(s), '2026-09-28', 'a'))
    // Period day 2, not told, not shared: a neutral tip, nothing about her period.
    const period = cycle({ periods: [...s.periods, { start: '2026-10-08', by: 'b' }] })
    const tip = partnerTip(period, '2026-10-09', 'a')!
    expect(NEUTRAL_PARTNER_TIPS).toContain(tip)
    // Late, not shared: the same neutral rotation as any '평소 주' day (he can't see it's late).
    expect(partnerTip(s, '2026-10-12', 'a')).toBe(neutralPartnerTip('2026-10-12'))
    // Late, shared: don't bring it up first.
    expect(partnerTip(shared(s), '2026-10-12', 'a')).toBe('먼저 말을 꺼내지 않아요. 이야기하고 싶을 때 들어 주면 돼요.')
  })

  it('rotates the waiting week, 우리의 주간 and 곧 우리의 주간 by the date (N24): never one line for days on end', () => {
    for (const copy of ['partner.tww', 'partner.our-week', 'partner.our-week-soon'] as const) {
      const list = partnerTipsFor(copy)
      expect(list.length, copy).toBeGreaterThanOrEqual(4)
      expect(list.length, copy).toBeLessThanOrEqual(6)
      expect(new Set(list).size, copy).toBe(list.length)
      for (const t of list) {
        expect(t, copy).not.toMatch(TIMING)
        expect(t, copy).not.toMatch(BANNED)
        // Relationship-side only: no symptom or test questions, no number of times.
        expect(t, copy).not.toMatch(/증상|테스트|임신|결과|배란|가임|생리|(\d|한|두|세)\s?번/)
        expect(t, copy).toMatch(/요\.$/)
      }
    }
    // A shared waiting week (with details) changes its line from day to day.
    const s = shared(cycle())
    const days = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']
    const tips = days.map((d) => partnerTip(s, d, 'a'))
    for (const t of tips) expect(partnerTipsFor('partner.tww')).toContain(t)
    expect(new Set(tips).size).toBeGreaterThan(3)
    for (let i = 1; i < tips.length; i++) expect(tips[i]).not.toBe(tips[i - 1])
    // The same date gives the same line on every phone and the link.
    expect(partnerTip(s, '2026-09-27', 'a')).toBe(partnerTip(structuredClone(s), '2026-09-27', 'a'))
  })

  it('asks nothing through the quiet after a pregnancy ended', () => {
    const lost = endPregnancy(startPregnancy(cycle(), '2026-09-10', '2026-10-01'), '2026-10-20')
    expect(partnerTip(lost, '2026-10-21', 'a')).toBeUndefined()
  })

  it('gives a calm viewer (부담 없이 / 알림 끔) only neutral tips, all cycle long', () => {
    const calm = setPersonalPref(cycle(), 'a', 'lowPressure', true)
    const off = style(cycle(), 'off')
    for (const s of [calm, off, shared(calm)]) {
      for (let i = 0; i < 40; i++) {
        const day = addDays('2026-09-10', i)
        const tip = partnerTip(s, day, 'a')
        // Only a card with its own lines (a told moment) takes the tip's place.
        if (tip === undefined) expect(ttcMoment(s, day, 'a')?.partnerTip ?? ttcMoment(s, day, 'a')?.say, day).toBeTruthy()
        else expect(tip, day).not.toMatch(TIMING)
      }
    }
  })

  it('steps aside when the moment card already carries a tip (period days 1–3 she told him about)', () => {
    const s = cycle({ periods: [{ start: '2026-08-13', by: 'b' }, { start: '2026-09-10', by: 'b' }, { start: '2026-10-08', by: 'b' }] })
    const told = tellPartnerPeriod(s, '2026-10-08', '2026-10-08T21:00:00+09:00')
    expect(partnerTip(told, '2026-10-09', 'a')).toBeUndefined()
    expect(ttcMoment(told, '2026-10-09', 'a')?.partnerTip).toBe(PERIOD_PARTNER_TIP)
    expect(PERIOD_PARTNER_TIP).toContain('고생했어')
    // The told card carries 해 줄 말 · 아껴 둘 말 too (N30): the tip steps aside for those as well.
    expect(ttcMoment(told, '2026-10-09', 'a')?.say?.say).toContain('고생했어')
    // Shared details, days 1–3: not a moment she sent — no 해 줄 말 on that card (N30),
    // so the stage card offers its own small thing instead.
    expect(ttcMoment(shared(s), '2026-10-09', 'a')?.partnerTip).toBeUndefined()
    expect(partnerTip(shared(s), '2026-10-09', 'a')).toBe('가벼운 산책을 제안해 봐요.')
    expect(partnerTip(shared(s), '2026-10-12', 'a')).toBe('가벼운 산책을 제안해 봐요.')
    // She answered '괜찮아요'; from day 4 with the details shared: a walk.
    const answered = skipTellPartnerPeriod(shared(s), '2026-10-08', '2026-10-08T21:00:00+09:00')
    expect(partnerTip(answered, '2026-10-11', 'a')).toBe('가벼운 산책을 제안해 봐요.')
  })

  it('in a clinic cycle keeps to the schedule, whatever the day', () => {
    const s = startClinicMode(cycle(), '2026-09-15')
    for (const day of ['2026-09-22', '2026-09-28', '2026-10-12']) expect(partnerTip(s, day, 'a')).toBe(CLINIC_PARTNER_TIP)
    expect(CLINIC_PARTNER_TIP).not.toMatch(TIMING)
  })

  it('is only for the partner while preparing', () => {
    expect(partnerTip(cycle(), TODAY, 'b')).toBeUndefined()
    expect(partnerTip(fresh(1994, { stage: 'pregnant', pregnancy: { lmp: '2026-08-10', confirmedAt: '2026-09-15' } }), TODAY, 'a')).toBeUndefined()
  })
})

describe('handing the cycle over', () => {
  it('starts private again: the new owner decides what the partner sees', () => {
    const shared = setShareCycleDetails(fresh(), 'b', true)
    const moved = handOverCycle(shared, 'a', 'b')
    expect(moved.couple.members.map((m) => [m.id, m.tracksCycle])).toEqual([
      ['a', true],
      ['b', false],
    ])
    expect(shareLevelOf(moved)).toBe('week')
    // Only 민수 (the new owner) may widen it now.
    expect(setShareCycleDetails(moved, 'b', true)).toBe(moved)
    expect(shareLevelOf(setShareCycleDetails(moved, 'a', true))).toBe('details')
    // Already the owner: nothing changes.
    expect(handOverCycle(shared, 'b', 'b')).toBe(shared)
    // The chain follows the roles: 지은 is the partner now.
    expect(partnerId(moved)).toBe('b')
    expect(testIdFor(moved, 'b')).toBe(FERTILITY_TEST_ID)
  })

  it("won't let the partner take over the owner's records", () => {
    const withRecords = { ...fresh(), periods: [{ start: '2026-09-18' }] }
    expect(canHandOverCycle(withRecords, 'b')).toBe(true)
    expect(canHandOverCycle(withRecords, 'a')).toBe(false)
    // 민수 can't make himself the owner of 지은's period log…
    expect(handOverCycle(withRecords, 'a', 'a')).toBe(withRecords)
    // …but 지은 can hand it over.
    expect(handOverCycle(withRecords, 'a', 'b').couple.members.find((m) => m.tracksCycle)?.id).toBe('a')
    // LH or test records count too.
    expect(canHandOverCycle({ ...fresh(), lhTests: [{ date: '2026-09-28', result: 'positive' }] }, 'a')).toBe(false)
    expect(canHandOverCycle({ ...fresh(), pregnancyTests: [{ id: 't', date: '2026-09-28', result: 'negative' }] }, 'a')).toBe(false)
    // Nothing logged yet (set up with the wrong person): either of them can fix it.
    expect(canHandOverCycle(fresh(), 'a')).toBe(true)
    expect(handOverCycle(fresh(), 'a', 'a').couple.members.find((m) => m.tracksCycle)?.id).toBe('a')
  })
})

describe('sharing the cycle details', () => {
  it('starts private and only the cycle owner can change it', () => {
    const s = fresh()
    expect(shareLevelOf(s)).toBe('week')
    expect(setShareCycleDetails(s, 'a', true)).toBe(s) // 민수 can't open 지은's records
    const shared = setShareCycleDetails(s, 'b', true)
    expect(shareLevelOf(shared)).toBe('details')
    expect(setShareCycleDetails(shared, 'b', true)).toBe(shared)
    expect(shareLevelOf(setShareCycleDetails(shared, 'b', false))).toBe('week')
  })
})

describe('taskStageLabel (QA Now 3b): the booked day itself has not passed', () => {
  it("reads '오늘 예약일' on the booked day, '예약일 지남' after it, the plain label otherwise", () => {
    expect(taskStageLabel('visited', '2026-10-23', '2026-10-23')).toBe('오늘 예약일')
    expect(taskStageLabel('visited', '2026-10-23', '2026-10-24')).toBe('예약일 지남')
    expect(taskStageLabel('visited', undefined, '2026-10-23')).toBe('예약일 지남')
    expect(taskStageLabel('booked', '2026-10-23', '2026-10-23')).toBe('예약됨')
    for (const stage of ['apply', 'book', 'booked', 'claim'] as const) expect(taskStageLabel(stage, undefined, undefined)).toBe(TASK_STAGE_LABEL[stage])
  })
})
