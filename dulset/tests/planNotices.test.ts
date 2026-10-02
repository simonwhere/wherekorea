import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import {
  NOTICE_EXPIRY_REMINDER_DAYS,
  NOTICE_EXPIRY_TITLE,
  appointmentReminders,
  isForEndedPregnancy,
  noticeExpiryKey,
  noticeExpiryNotices,
  planDeadlineNotices,
} from '@/lib/logic/planNotices'
import { tickItem } from '@/lib/logic/plan'
import { backToPreparing, recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { noticeTarget } from '@/lib/logic/today'
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
