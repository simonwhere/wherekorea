import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { logPeriodStart } from '@/lib/logic/logs'
import { FERTILITY_TEST_ID, setFertilityApplied, setFertilityClaimed } from '@/lib/logic/partnerTrack'
import {
  MONTHLY_TASK_KEY_SAFE,
  NOTICE_EXPIRY_REMINDER_DAYS,
  NOTICE_EXPIRY_TITLE,
  appointmentReminders,
  isForEndedPregnancy,
  monthlyTaskNotices,
  noticeExpiryKey,
  noticeExpiryNotices,
  planDeadlineNotices,
  taskDueKey,
  taskVisitKey,
} from '@/lib/logic/planNotices'
import { tickItem } from '@/lib/logic/plan'
import { backToPreparing, recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy, noticeTarget } from '@/lib/logic/today'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import { addTreatment } from '@/lib/logic/treatments'
import type { AppState } from '@/lib/types'

function base(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart: '2026-01-01' },
    new Date(2026, 0, 2, 9),
  )
}

function parenting(birth: string): AppState {
  const s = startPregnancy(base(), '2026-01-01', '2026-02-10')
  return recordBirth(s, { name: '콩이', birthDate: birth, sex: 'unknown' })
}

describe('plan deadline reminders', () => {
  it('reminds both parents 7 days, 1 day and on the last day for 출생신고', () => {
    // Born 2026-10-01 → 출생신고 within 1 month (birth day = day 1) → last day 2026-10-31.
    const s = parenting('2026-10-01')
    const at = (d: string) => planDeadlineNotices(s, d).filter((n) => n.key.startsWith('deadline:birth-registration:'))
    const d7 = at('2026-10-24')
    expect(d7.map((n) => n.to).sort()).toEqual(['a', 'b'])
    expect(d7[0]!.title).toContain('출생신고 D-7')
    expect(at('2026-10-30')[0]!.title).toContain('D-1')
    expect(at('2026-10-31')[0]!.title).toContain('오늘까지예요')
    expect(at('2026-10-25')).toEqual([])
    expect(noticeTarget(d7[0]!.kind, 'parenting', d7[0]!.key)).toBe('plan')
  })

  it('stops once the item is ticked, and sends nothing while preparing', () => {
    let s = parenting('2026-10-01')
    s = tickItem('birth-registration', true, '2026-10-05', 'a')(s)
    expect(planDeadlineNotices(s, '2026-10-24').some((n) => n.key.startsWith('deadline:birth-registration:'))).toBe(false)
    expect(planDeadlineNotices(base(), '2026-10-24')).toEqual([])
  })
})

describe('appointments after a pregnancy ended', () => {
  it('drops reminders for visits booked for the ended pregnancy, keeps others', () => {
    let s = startPregnancy(base(), '2026-06-01', '2026-07-10')
    s = addAppointment(s, { date: '2026-10-20', title: '정밀초음파', who: 'both', kind: 'test', taskId: 'p2-anatomy' }, 'b')
    s = addAppointment(s, { date: '2026-10-20', title: '치과', who: 'b', kind: 'hospital' }, 'b')
    expect(appointmentReminders(s, '2026-10-19').filter((n) => n.title.includes('정밀초음파'))).toHaveLength(2)
    s = backToPreparing(s, '2026-09-01')
    const anatomy = s.appointments.find((a) => a.taskId === 'p2-anatomy')!
    expect(isForEndedPregnancy(s, anatomy)).toBe(true)
    const after = appointmentReminders(s, '2026-10-19')
    expect(after.some((n) => n.title.includes('정밀초음파'))).toBe(false)
    expect(after.some((n) => n.title.includes('치과'))).toBe(true)
  })
})

describe('지원결정통지서 만료 reminders (Next B)', () => {
  const withNotice = (expires = '2027-01-15') =>
    addTreatment(base(), { id: 't1', kind: 'iui', startDate: '2026-09-01', outcome: 'ongoing', supported: true, noticeExpires: expires })
  const expiry = (s: AppState, today: string) => planDeadlineNotices(s, today).filter((n) => n.key.startsWith('notice-expiry:'))

  it('goes to both people at D-30, D-7 and D-1 with one key per step and person', () => {
    const s = withNotice()
    expect(NOTICE_EXPIRY_REMINDER_DAYS).toEqual([30, 7, 1])
    const d30 = expiry(s, '2026-12-16')
    expect(d30.map((n) => n.to).sort()).toEqual(['a', 'b'])
    expect(d30.map((n) => n.key).sort()).toEqual([noticeExpiryKey('2027-01-15', 30, 'a'), noticeExpiryKey('2027-01-15', 30, 'b')])
    expect(d30[0]!.key).toBe('notice-expiry:2027-01-15:30:a')
    expect(d30[0]!.kind).toBe('system')
    expect(d30[0]!.title).toBe(`${NOTICE_EXPIRY_TITLE} D-30`)
    expect(d30[0]!.body).toContain('1월 15일')
    expect(d30[0]!.body).toContain('보건소마다 달라요')
    expect(expiry(s, '2027-01-08')[0]!.title).toContain('D-7')
    expect(expiry(s, '2027-01-14')[0]!.title).toContain('D-1')
    // Not on other days, not on the day itself, not after.
    for (const day of ['2026-12-15', '2026-12-17', '2027-01-07', '2027-01-15', '2027-01-16']) expect(expiry(s, day)).toEqual([])
    // The same list comes straight from noticeExpiryNotices.
    expect(noticeExpiryNotices(s, '2026-12-16')).toEqual(d30)
    // No fertility word for a soft / off partner.
    for (const w of ['가임기', '배란', 'LH']) expect(`${d30[0]!.title} ${d30[0]!.body}`).not.toContain(w)
  })

  it('reads the newest notice; nothing without one, while pregnant, or in the quiet weeks after a loss', () => {
    expect(expiry(base(), '2026-12-16')).toEqual([])
    let s = withNotice('2026-08-31') // already expired
    expect(expiry(s, '2026-08-24')).toHaveLength(2)
    s = addTreatment(s, { id: 't2', kind: 'ivf-fresh', startDate: '2026-09-20', noticeExpires: '2027-03-01' })
    expect(expiry(s, '2026-08-24')).toEqual([]) // t2's notice is the current one now
    expect(expiry(s, '2027-01-30').map((n) => n.key)).toEqual(['notice-expiry:2027-03-01:30:a', 'notice-expiry:2027-03-01:30:b'])
    const pregnant = startPregnancy(withNotice(), '2026-09-01', '2026-10-10')
    expect(expiry(pregnant, '2026-12-16')).toEqual([])
    // Back to preparing on 2026-12-01: quiet until 42 days have passed.
    const ended = backToPreparing(pregnant, '2026-12-01')
    expect(expiry(ended, '2026-12-16')).toEqual([])
    expect(expiry(ended, '2027-01-14')).toHaveLength(2)
  })
})

// ── 이번 달 할 일 (N30): his month task's dates, preparing ──────────────────


describe('his month task: 예약일 지남 · 검사 3개월 · 청구 1개월 (N30)', () => {
  // 민수 (a) applied 09-28 → test by 12-27 (신청 후 3개월, the day is day 1).
  const applied = () => setFertilityApplied(base(), 'a', true, '2026-09-28')
  const keysOn = (s: AppState, d: string) => monthlyTaskNotices(s, d).map((n) => n.key)

  it('nothing before he applied, and nothing to her', () => {
    expect(monthlyTaskNotices(base(), '2026-12-20')).toEqual([])
    for (let d = 0; d < 120; d++) {
      const day = new Date(Date.UTC(2026, 8, 28 + d)).toISOString().slice(0, 10)
      expect(monthlyTaskNotices(applied(), day).every((n) => n.to === 'a'), day).toBe(true)
    }
  })

  it('the 검사 deadline: D-7, D-1 and the last day — to him, keyed by the step and its deadline', () => {
    const s = applied()
    expect(keysOn(s, '2026-12-19')).toEqual([])
    expect(keysOn(s, '2026-12-20')).toEqual([taskDueKey('test', '2026-12-27', 7, 'a')])
    expect(keysOn(s, '2026-12-26')).toEqual(['deadline:task-test:2026-12-27:1:a'])
    const last = monthlyTaskNotices(s, '2026-12-27')
    expect(last.map((n) => n.key)).toEqual(['deadline:task-test:2026-12-27:0:a'])
    expect(last[0]!.title).toContain('오늘까지예요')
    expect(last[0]!.body).toContain('신청 후 3개월')
    // After it lapsed: nothing more (the card says 보건소에 다시 확인해요).
    expect(keysOn(s, '2026-12-28')).toEqual([])
    // Routed to 오늘, where his month task card is (today.noticeTarget 'deadline:task-', Now 3b).
    expect(noticeTarget('system', 'preparing', last[0]!.key)).toBe('today')
  })

  it('the day after a booked test with no 다녀왔어요 yet: one quiet question, once per booking', () => {
    let s = addAppointment(applied(), { date: '2026-10-08', time: '09:30', title: '정액검사', place: '', who: 'a', kind: 'test', note: '', taskId: FERTILITY_TEST_ID }, 'a')
    const id = s.appointments[s.appointments.length - 1]!.id
    expect(keysOn(s, '2026-10-08')).toEqual([])
    const q = monthlyTaskNotices(s, '2026-10-09')
    expect(q.map((n) => n.key)).toEqual([taskVisitKey(id, 'a')])
    expect(q[0]!.body).toContain('네, 다녀왔어요')
    expect(keysOn(s, '2026-10-15')).toEqual([taskVisitKey(id, 'a')]) // same key: delivered once (mergeNotices)
    // He marked the test done: no more question; the claim deadline takes over (검사 후 1개월).
    s = tickItem(FERTILITY_TEST_ID, true, '2026-10-08', 'a')(s)
    expect(keysOn(s, '2026-10-09')).toEqual([])
    expect(monthlyTaskNotices(s, 'not-a-date')).toEqual([])
    // Claim by 11-07 (the test day is day 1).
    expect(keysOn(s, '2026-10-31')).toEqual(['deadline:task-claim:2026-11-07:7:a'])
    expect(monthlyTaskNotices(s, '2026-11-07')[0]!.body).toContain('검사 후 1개월')
    expect(keysOn(setFertilityClaimed(s, true, '2026-10-20', 'a'), '2026-11-06')).toEqual([])
  })

  it('reads nothing of her cycle, and rests in the quiet after a loss', () => {
    const s = applied()
    const before = monthlyTaskNotices(s, '2026-12-20')
    for (const h of [logPeriodStart(s, '2026-12-18', 'b', '2026-12-20'), markPositivePending(s, '2026-12-19'), startRestCycle(s, '2026-12-01')]) {
      expect(monthlyTaskNotices(h, '2026-12-20')).toEqual(before)
    }
    const lost = endPregnancy(startPregnancy(s, '2026-11-01', '2026-12-10'), '2026-12-15')
    expect(monthlyTaskNotices(lost, '2026-12-20')).toEqual([])
    // Keys never carry anything but the step, his deadline or booking id, and him.
    for (const n of before) expect(MONTHLY_TASK_KEY_SAFE.test(n.key), n.key).toBe(true)
  })

  it('goes out through planDeadlineNotices while preparing', () => {
    expect(planDeadlineNotices(applied(), '2026-12-20').map((n) => n.key)).toContain('deadline:task-test:2026-12-27:7:a')
  })
})
