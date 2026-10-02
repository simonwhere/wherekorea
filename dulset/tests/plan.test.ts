import { describe, expect, it } from 'vitest'
import { stepAppointment, linkedAppointment, validateDraft, type AppointmentDraft } from '@/lib/logic/plan'
import type { Appointment } from '@/lib/types'

const TODAY = '2026-10-02'

const appt = (over: Partial<Appointment>): Appointment => ({
  id: over.id ?? 'x',
  date: '2026-10-14',
  title: '정액검사',
  who: 'a',
  kind: 'test',
  createdBy: 'a',
  taskId: 'pre-checkup-partner',
  ...over,
})

describe('stepAppointment (the one a chain step waits on)', () => {
  it('prefers the next upcoming one, else the latest past one not marked done', () => {
    const list = [
      appt({ id: 'past-old', date: '2026-09-01' }),
      appt({ id: 'past', date: '2026-09-20' }),
      appt({ id: 'soon', date: '2026-10-14' }),
      appt({ id: 'later', date: '2026-11-02' }),
    ]
    expect(stepAppointment(list, 'pre-checkup-partner', TODAY)?.id).toBe('soon')
    expect(stepAppointment(list.filter((a) => a.date < TODAY), 'pre-checkup-partner', TODAY)?.id).toBe('past')
    // Today counts as upcoming (the visit is today).
    expect(stepAppointment([appt({ id: 'today', date: TODAY }), appt({ id: 'past', date: '2026-09-20' })], 'pre-checkup-partner', TODAY)?.id).toBe('today')
  })

  it('skips appointments marked done, other items and broken dates', () => {
    const list = [
      appt({ id: 'done', date: '2026-10-14', done: true }),
      appt({ id: 'other', date: '2026-10-10', taskId: 'pre-dental' }),
      appt({ id: 'broken', date: 'not-a-date' }),
    ]
    expect(stepAppointment(list, 'pre-checkup-partner', TODAY)).toBeUndefined()
    expect(linkedAppointment(list, 'pre-checkup-partner', TODAY)).toBeUndefined()
  })

  it('orders a same-day pair by time', () => {
    const list = [appt({ id: 'pm', date: '2026-10-14', time: '15:00' }), appt({ id: 'am', date: '2026-10-14', time: '08:30' })]
    expect(stepAppointment(list, 'pre-checkup-partner', TODAY)?.id).toBe('am')
    expect(stepAppointment(list, 'pre-checkup-partner', '2026-10-20')?.id).toBe('pm')
  })
})

describe('validateDraft — 주사·약 need a time', () => {
  const ok: AppointmentDraft = { date: TODAY, time: '', title: '검진', place: '', who: 'both', kind: 'hospital', note: '' }

  it('asks for a time on injection and medication appointments only', () => {
    expect(validateDraft({ ...ok, kind: 'injection' }, TODAY)).toBe('time-required')
    expect(validateDraft({ ...ok, kind: 'medication' }, TODAY)).toBe('time-required')
    expect(validateDraft({ ...ok, kind: 'injection', time: '21:00' }, TODAY)).toBeNull()
    expect(validateDraft({ ...ok, kind: 'medication', time: '08:00' }, TODAY)).toBeNull()
    for (const kind of ['hospital', 'test', 'vaccine', 'admin', 'other'] as const) {
      expect(validateDraft({ ...ok, kind }, TODAY)).toBeNull()
    }
    // A broken time is still a time error first.
    expect(validateDraft({ ...ok, kind: 'injection', time: '25:00' }, TODAY)).toBe('time')
  })
})
