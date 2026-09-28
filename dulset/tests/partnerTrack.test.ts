import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  FERTILITY_APPLY_ID,
  FERTILITY_CLAIM_ID,
  FERTILITY_TEST_ID,
  completeMonthlyTask,
  fertilityChain,
  handOverCycle,
  monthlyTask,
  ownerAge,
  setFertilityClaimed,
  setShareCycleDetails,
} from '@/lib/logic/partnerTrack'
import { addCustomTask } from '@/lib/logic/roadmap'
import { tickItem } from '@/lib/logic/plan'
import type { AppState } from '@/lib/types'

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

describe('가임력 검사 chain', () => {
  it('starts with the application', () => {
    expect(fertilityChain(fresh(), TODAY)).toMatchObject({ step: 'apply', lapsed: false })
  })

  it('gives 3 months to test after applying and 1 month to claim after the test', () => {
    let s = tick(fresh(), FERTILITY_APPLY_ID, '2026-09-28')
    // The application day is day 1 (like 신고기간): 9/28 + 3개월 → 12/27.
    expect(fertilityChain(s, '2026-10-01')).toMatchObject({ step: 'test', appliedAt: '2026-09-28', testBy: '2026-12-27', lapsed: false })
    expect(fertilityChain(s, '2026-12-27').lapsed).toBe(false)
    expect(fertilityChain(s, '2026-12-28').lapsed).toBe(true)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-15')
    expect(fertilityChain(s, '2026-10-20')).toMatchObject({ step: 'claim', testedAt: '2026-10-15', claimBy: '2026-11-14', lapsed: false })
    expect(fertilityChain(s, '2026-11-15').lapsed).toBe(true)
    s = setFertilityClaimed(s, true, '2026-10-30', 'a')
    expect(fertilityChain(s, '2026-10-30')).toMatchObject({ step: 'done', claimedAt: '2026-10-30' })
    // Undo.
    expect(fertilityChain(setFertilityClaimed(s, false, '2026-10-30', 'a'), '2026-10-30').step).toBe('claim')
    expect(setFertilityClaimed(s, true, '2026-10-31', 'a')).toBe(s)
  })

  it('has nothing to claim when the test came after the 3-month window', () => {
    let s = tick(fresh(), FERTILITY_APPLY_ID, '2026-06-01') // testBy 2026-08-31
    s = tick(s, FERTILITY_TEST_ID, '2026-08-31')
    expect(fertilityChain(s, '2026-09-05')).toMatchObject({ step: 'claim', claimBy: '2026-09-30' })
    const late = tick(tick(fresh(), FERTILITY_APPLY_ID, '2026-06-01'), FERTILITY_TEST_ID, '2026-09-01')
    expect(fertilityChain(late, '2026-09-05')).toMatchObject({ step: 'done', claimBy: undefined, lapsed: false })
    expect(monthlyTask(late, '2026-09-05', 'a')?.step).toBeUndefined()
  })

  it('has nothing to claim when the test came before the application (소급 불가)', () => {
    let s = tick(fresh(), FERTILITY_TEST_ID, '2026-09-01')
    expect(fertilityChain(s, TODAY)).toMatchObject({ step: 'done', claimBy: undefined })
    s = tick(s, FERTILITY_APPLY_ID, '2026-09-10')
    expect(fertilityChain(s, TODAY)).toMatchObject({ step: 'done', claimBy: undefined })
  })
})

describe('이번 달 할 일', () => {
  it('asks the partner to apply for the check first', () => {
    // 민수 hears about fertile days the soft way (the partner's default): no "가임" word.
    const t = monthlyTask(fresh(), TODAY, 'a')!
    expect(t).toMatchObject({ id: FERTILITY_APPLY_ID, step: 'apply', title: '임신 전 검사 지원 신청하기', top: false })
    expect(t.why).toContain('먼저 신청')
    expect(t.why).toContain('보건소·병원마다')
    expect(`${t.title} ${t.why}`).not.toMatch(/가임|배란/)
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

  it('shows the 3-month test deadline once the application is ticked', () => {
    const s = tick(fresh(), FERTILITY_APPLY_ID, TODAY)
    const t = monthlyTask(s, '2026-10-01', 'a')!
    expect(t).toMatchObject({ id: FERTILITY_TEST_ID, step: 'test', title: '정액검사 받기', dueBy: '2026-12-27', top: true })
    expect(t).toMatchObject({ status: 'now', end: '2026-12-27', deadline: true })
    expect(t.dueText).toBe('검사 마감 12월 27일 (일) · 신청 후 3개월 안')
  })

  it('then the 1-month claim deadline, then moves on', () => {
    let s = tick(fresh(), FERTILITY_APPLY_ID, TODAY)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-15')
    const t = monthlyTask(s, '2026-10-20', 'a')!
    expect(t).toMatchObject({ id: FERTILITY_CLAIM_ID, step: 'claim', title: '검사비 청구하기', dueBy: '2026-11-14', top: true })
    expect(t.dueText).toContain('청구 마감 11월 14일')
    expect(t.doneAt).toBeUndefined()
    s = completeMonthlyTask(s, t, '2026-10-22', 'a')
    expect(s.planDone[FERTILITY_CLAIM_ID]).toEqual({ at: '2026-10-22', by: 'a' })
    const next = monthlyTask(s, '2026-10-22', 'a')!
    expect(next.step).toBeUndefined()
    expect([FERTILITY_APPLY_ID, FERTILITY_TEST_ID, FERTILITY_CLAIM_ID]).not.toContain(next.id)
    // His own item before a shared one.
    expect(next.owners).toEqual(['a'])
  })

  it('keeps a lapsed step for a month, gently, then lets it go', () => {
    const s = tick(fresh(), FERTILITY_APPLY_ID, '2026-06-01')
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

  it('under 35, a dated task of his own can come first; at 35+ the check stays on top', () => {
    const withTask = (year: number) =>
      addCustomTask(fresh(year), { title: '회사 일정 조율', phase: 'preconception', who: 'a', due: '2026-10-02' }, 'a')
    expect(monthlyTask(withTask(1994), TODAY, 'a')?.title).toBe('회사 일정 조율')
    expect(monthlyTask(withTask(1990), TODAY, 'a')).toMatchObject({ step: 'apply', top: true })
  })

  it('completes the steps the way the roadmap records them', () => {
    let s = fresh()
    s = completeMonthlyTask(s, monthlyTask(s, TODAY, 'a')!, TODAY, 'a')
    expect(s.planDone[FERTILITY_APPLY_ID]).toEqual({ at: TODAY, by: 'a' })
    s = completeMonthlyTask(s, monthlyTask(s, TODAY, 'a')!, '2026-10-10', 'a')
    expect(s.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-10-10', by: 'a' })
  })

  it('undoes each step the same way, and completing twice keeps the first date', () => {
    let s = tick(fresh(), FERTILITY_APPLY_ID, TODAY)
    s = tick(s, FERTILITY_TEST_ID, '2026-10-10')
    const claim = monthlyTask(s, '2026-10-12', 'a')!
    expect(claim.step).toBe('claim')
    const claimed = completeMonthlyTask(s, claim, '2026-10-12', 'a')
    expect(completeMonthlyTask(claimed, claim, '2026-10-13', 'a')).toBe(claimed)
    expect(completeMonthlyTask(claimed, claim, '2026-10-12', 'a', false)).toEqual(s)
    // Undoing the test puts the chain back on the test step with its deadline.
    const test = { id: FERTILITY_TEST_ID, step: 'test' as const }
    const untested = completeMonthlyTask(s, test, '2026-10-12', 'a', false)
    expect(monthlyTask(untested, '2026-10-12', 'a')).toMatchObject({ step: 'test', dueBy: '2026-12-27' })
  })

  it('never offers daily habits or "when needed" items as the month task', () => {
    let s = tick(fresh(), FERTILITY_APPLY_ID, '2026-01-01')
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
    const preg = fresh(1994, {
      stage: 'pregnant',
      pregnancy: { lmp: '2026-08-10', confirmedAt: '2026-09-15' },
    })
    const t = monthlyTask(preg, TODAY, 'a')
    expect(t?.step).toBeUndefined()
    expect(t?.phase).not.toBe('preconception')
  })
})

describe('handing the cycle over', () => {
  it('starts private again: the new owner decides what the partner sees', () => {
    const shared = setShareCycleDetails(fresh(), 'b', true)
    const moved = handOverCycle(shared, 'a')
    expect(moved.couple.members.map((m) => [m.id, m.tracksCycle])).toEqual([
      ['a', true],
      ['b', false],
    ])
    expect(moved.settings.shareCycleDetails).toBe(false)
    // Only 민수 (the new owner) may widen it now.
    expect(setShareCycleDetails(moved, 'b', true)).toBe(moved)
    expect(setShareCycleDetails(moved, 'a', true).settings.shareCycleDetails).toBe(true)
    // Already the owner: nothing changes.
    expect(handOverCycle(shared, 'b')).toBe(shared)
  })
})

describe('sharing the cycle details', () => {
  it('starts private and only the cycle owner can change it', () => {
    const s = fresh()
    expect(s.settings.shareCycleDetails).toBe(false)
    expect(setShareCycleDetails(s, 'a', true)).toBe(s) // 민수 can't open 지은's records
    const shared = setShareCycleDetails(s, 'b', true)
    expect(shared.settings.shareCycleDetails).toBe(true)
    expect(setShareCycleDetails(shared, 'b', true)).toBe(shared)
    expect(setShareCycleDetails(shared, 'b', false).settings.shareCycleDetails).toBe(false)
  })
})
