import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  APPOINTMENT_KIND_EMOJI,
  APPOINTMENT_KIND_LABEL,
  addAppointment,
  appointmentNotices,
  needsTime,
  setAppointmentDone,
  upcomingAppointments,
} from '@/lib/logic/appointments'
import { APPOINTMENT_KINDS } from '@/lib/types'

const TODAY = '2026-10-02'

const fresh = () =>
  createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b' },
    new Date(2026, 9, 2, 9),
  )

describe('appointment kinds', () => {
  it('has a label and an emoji for every kind, 주사·약 included (N13)', () => {
    for (const k of APPOINTMENT_KINDS) {
      expect(APPOINTMENT_KIND_LABEL[k]).toBeTruthy()
      expect(APPOINTMENT_KIND_EMOJI[k]).toBeTruthy()
    }
    expect(APPOINTMENT_KIND_LABEL.injection).toBe('주사')
    expect(APPOINTMENT_KIND_LABEL.medication).toBe('약')
    expect(needsTime('injection')).toBe(true)
    expect(needsTime('medication')).toBe(true)
    expect(needsTime('hospital')).toBe(false)
  })

  it('adds a timed 주사 and reminds the one who takes it', () => {
    const s = addAppointment(fresh(), { date: '2026-10-06', time: '21:00', title: '트리거 주사', who: 'b', kind: 'injection' }, 'b')
    const a = s.appointments[0]!
    expect(a).toMatchObject({ kind: 'injection', time: '21:00', who: 'b', createdBy: 'b' })
    const dayBefore = appointmentNotices(s, '2026-10-05')
    expect(dayBefore.map((n) => [n.to, n.title])).toEqual([
      ['b', '💉 내일 트리거 주사'],
      ['a', '💉 내일 지은님 일정: 트리거 주사'],
    ])
    expect(dayBefore[0]!.body).toContain('21:00')
    const onDay = appointmentNotices(s, '2026-10-06')
    expect(onDay.map((n) => n.to)).toEqual(['b'])
    expect(onDay[0]!.title).toBe('💉 오늘 트리거 주사')
    // Done: no more reminders, and it leaves the upcoming list.
    const done = setAppointmentDone(s, a.id, true)
    expect(appointmentNotices(done, '2026-10-06')).toEqual([])
    expect(upcomingAppointments(done.appointments, TODAY)).toEqual([])
  })

  it('refuses a broken time and an empty title', () => {
    const s = fresh()
    expect(addAppointment(s, { date: TODAY, time: '25:00', title: '약', who: 'a', kind: 'medication' }, 'a')).toBe(s)
    expect(addAppointment(s, { date: TODAY, title: '  ', who: 'a', kind: 'medication' }, 'a')).toBe(s)
  })
})
