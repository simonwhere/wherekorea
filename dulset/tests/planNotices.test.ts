import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { appointmentReminders, isForEndedPregnancy, planDeadlineNotices } from '@/lib/logic/planNotices'
import { tickItem } from '@/lib/logic/plan'
import { backToPreparing, recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { noticeTarget } from '@/lib/logic/today'
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
