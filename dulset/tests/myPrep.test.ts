// 내 준비 (Now 3 N30, lib/logic/myPrep.ts): his own progress — the habit
// timer, this week's N/7, his 검사 chain step — each only when it has
// something to say, from his records alone (never her cycle), resting in the
// quiet after a loss and empty for the person whose cycle it is.

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { activeDailyItems, activeItems, toggleCheck } from '@/lib/logic/checks'
import { logPeriodStart } from '@/lib/logic/logs'
import { hasMyPrep, myPrep } from '@/lib/logic/myPrep'
import { FERTILITY_TEST_ID, setFertilityApplied, setFertilityClaimed } from '@/lib/logic/partnerTrack'
import { tickItem } from '@/lib/logic/plan'
import { setShareLevel } from '@/lib/logic/prefs'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import { endPregnancy } from '@/lib/logic/today'
import type { AppState, ISODate, MemberId } from '@/lib/types'

const OWNER = 'b' as const
const PARTNER = 'a' as const
const TODAY: ISODate = '2026-10-04' // a Sunday: the week runs 09-28…10-04

function couple(over: Partial<AppState> = {}, partnerRole: 'husband' | 'wife' = 'husband'): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: partnerRole, birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-15',
      ttcStart: '2026-08-01',
      habits: { smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false },
    },
    new Date(2026, 7, 1, 9),
  )
  return { ...s, ...over }
}

/** He ticks every daily item on each of `days`. */
function allDone(s: AppState, member: MemberId, days: ISODate[]): AppState {
  let out = s
  for (const d of days) for (const i of activeDailyItems(out, member)) out = toggleCheck(out, member, d, i.id)
  return out
}

/** He ticks his habit row on each of `days` (the timer counts habit checks). */
function habitDays(s: AppState, from: ISODate, n: number): AppState {
  const habit = activeItems(s, PARTNER).find((i) => i.kind === 'habit')!
  let out = s
  for (let k = 0; k < n; k++) out = toggleCheck(out, PARTNER, addDays(from, k), habit.id)
  return out
}

describe('myPrep — his own progress, nothing of hers', () => {
  it('is empty before anything happened: no 0, no 시작 전, no chain before the first step', () => {
    const p = myPrep(couple(), TODAY, PARTNER)
    expect(p).toEqual({})
    expect(hasMyPrep(p)).toBe(false)
  })

  it('counts the habit timer from his first habit check, with its bar (약 3개월)', () => {
    const s = habitDays(couple(), '2026-09-20', 15)
    const p = myPrep(s, TODAY, PARTNER)
    expect(p.timerLabel).toBe('생활 습관 D+15 · 약 3개월 중')
    expect(p.timerProgress).toBeGreaterThan(0)
    expect(p.timerProgress).toBeLessThan(1)
    expect(hasMyPrep(p)).toBe(true)
  })

  it('says 이번 주 N/7 only once N > 0 — and counts this week only', () => {
    expect(myPrep(couple(), TODAY, PARTNER).weekCount).toBeUndefined()
    const s = allDone(couple(), PARTNER, ['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-02'])
    // 09-27 belongs to the week before.
    expect(myPrep(s, TODAY, PARTNER).weekCount).toBe('이번 주 3/7')
  })

  it('follows his 검사 chain: 신청 → 예약 → 다녀왔어요? → 청구 → done', () => {
    let s = setFertilityApplied(couple(), PARTNER, true, '2026-09-20')
    expect(myPrep(s, TODAY, PARTNER)).toMatchObject({
      chainStep: '신청 ✓ · 다음은 검사 예약',
      chainSteps: [
        { id: 'apply', label: '신청', state: 'done' },
        { id: 'test', label: '검사', state: 'now' },
        { id: 'claim', label: '청구', state: 'next' },
      ],
    })
    s = addAppointment(s, { date: '2026-10-08', time: '09:30', title: '정액검사', place: '', who: PARTNER, kind: 'test', note: '', taskId: FERTILITY_TEST_ID }, PARTNER)
    expect(myPrep(s, TODAY, PARTNER).chainStep).toBe('신청 ✓ · 검사 예약 10월 8일')
    expect(myPrep(s, '2026-10-09', PARTNER).chainStep).toBe('신청 ✓ · 검사 다녀왔어요?')
    s = tickItem(FERTILITY_TEST_ID, true, '2026-10-08', PARTNER)(s)
    expect(myPrep(s, '2026-10-09', PARTNER).chainStep).toBe('검사 ✓ · 다음은 청구')
    s = setFertilityClaimed(s, true, '2026-10-20', PARTNER)
    expect(myPrep(s, '2026-10-21', PARTNER)).toMatchObject({ chainStep: '신청·검사·청구 ✓' })
    expect(myPrep(s, '2026-10-21', PARTNER).chainSteps!.every((x) => x.state === 'done')).toBe(true)
  })

  it('a lapsed step reads as a place to ask, then goes quiet a month later (like the month task)', () => {
    const s = setFertilityApplied(couple(), PARTNER, true, '2026-06-01') // test by 08-31
    expect(myPrep(s, '2026-09-10', PARTNER).chainStep).toBe('신청 ✓ · 보건소에 다시 확인해요')
    expect(myPrep(s, '2026-10-10', PARTNER).chainStep).toBeUndefined()
  })

  it('reads nothing of her cycle: the same bar with or without any record of hers', () => {
    let s = allDone(habitDays(setFertilityApplied(couple(), PARTNER, true, '2026-09-20'), '2026-09-01', 30), PARTNER, ['2026-09-29'])
    const before = myPrep(s, TODAY, PARTNER)
    const hers: AppState[] = [
      logPeriodStart(s, '2026-10-03', OWNER, TODAY),
      markPositivePending(s, '2026-10-03'),
      startRestCycle(s, '2026-10-01', 'rest'),
      { ...s, lhTests: [{ date: '2026-10-01', result: 'positive' }] },
      setShareLevel(s, OWNER, 'none'),
      setShareLevel(s, OWNER, 'details'),
    ]
    for (const h of hers) expect(myPrep(h, TODAY, PARTNER)).toEqual(before)
    s = { ...s, periods: [] }
    expect(myPrep(s, TODAY, PARTNER)).toEqual(before)
  })

  it('is empty for the person whose cycle it is, while parenting and in the quiet after a loss', () => {
    const s = habitDays(couple(), '2026-09-20', 10)
    expect(myPrep(s, TODAY, OWNER)).toEqual({})
    expect(myPrep({ ...s, stage: 'parenting' }, TODAY, PARTNER)).toEqual({})
    // While pregnant he has his own items instead (no habit timer, no 검사 chain).
    const pregnant = myPrep(startPregnancy(s, '2026-08-20', '2026-09-25'), TODAY, PARTNER)
    expect(pregnant.timerLabel).toBeUndefined()
    expect(pregnant.items?.length).toBeGreaterThan(0)
    const lost = endPregnancy(startPregnancy(s, '2026-08-20', '2026-09-25'), '2026-10-01')
    expect(myPrep(lost, '2026-10-03', PARTNER)).toEqual({})
    expect(myPrep(s, 'not-a-date', PARTNER)).toEqual({})
  })

  it('no timer for a partner who is not the sperm side (the timer is about sperm formation)', () => {
    const s = habitDays(couple({}, 'wife'), '2026-09-20', 10)
    expect(myPrep(s, TODAY, PARTNER).timerLabel).toBeUndefined()
  })

  it('carries no banned word and no zero, whatever the state', () => {
    const states = [couple(), habitDays(couple(), '2026-07-01', 90), setFertilityApplied(couple(), PARTNER, true, '2026-09-01')]
    for (const s of states) {
      const text = JSON.stringify(myPrep(s, TODAY, PARTNER))
      expect(text).not.toMatch(/숙제|실패|노력|오늘 꼭|관계를 가져야|0\/7|안 했어요|시작 전/)
    }
    // Past ~3 months: reached.
    expect(myPrep(habitDays(couple(), '2026-06-20', 106), TODAY, PARTNER)).toMatchObject({ timerLabel: '생활 습관 약 3개월을 채웠어요', timerProgress: 1 })
  })
})
