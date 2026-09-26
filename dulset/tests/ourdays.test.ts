import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  addAnniversary,
  anniversariesBetween,
  daysSince,
  nextAnniversaries,
  onThisDay,
  removeAnniversary,
  setCoupleDates,
} from '@/lib/logic/anniversary'
import {
  addAppointment,
  appointmentIcsEvent,
  appointmentNotices,
  attendees,
  removeAppointment,
  setAppointmentDone,
  upcomingAppointments,
  updateAppointment,
} from '@/lib/logic/appointments'
import {
  addCustomTask,
  buildItems,
  focusItems,
  ownersOf,
  resolveWindow,
  setCustomTaskDone,
  setTemplateDone,
  statusFor,
  type RoadmapTemplate,
} from '@/lib/logic/roadmap'
import { startPregnancy } from '@/lib/logic/pregnancy'
import type { AppState } from '@/lib/types'

function fresh(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9),
  )
}

describe('anniversaries', () => {
  it('counts the first day as day 1', () => {
    expect(daysSince('2021-05-14', '2021-05-14')).toBe(1)
    expect(daysSince('2021-05-14', '2021-08-21')).toBe(100)
  })

  it('lists 100-day steps, yearly met/married days and custom days in order', () => {
    const couple = { metDate: '2021-05-14', marriedDate: '2024-10-19' }
    const ev = anniversariesBetween(couple, [], '2026-01-01', '2026-12-31')
    const byKey = Object.fromEntries(ev.map((e) => [e.key, e.date]))
    expect(byKey['met-year:5']).toBe('2026-05-14')
    expect(byKey['married-year:2']).toBe('2026-10-19')
    // 1800th day = met + 1799
    expect(byKey['met-days:1800']).toBe('2026-04-17')
    expect(ev.every((e, i) => i === 0 || ev[i - 1]!.date <= e.date)).toBe(true)
  })

  it('handles custom yearly and one-off days, and Feb 29', () => {
    const custom = [
      { id: 'x', title: '첫 여행', date: '2022-07-02', yearly: true, emoji: '✈️' },
      { id: 'y', title: '프러포즈', date: '2026-11-01', yearly: false },
      { id: 'z', title: '윤일', date: '2024-02-29', yearly: true },
    ]
    const ev = anniversariesBetween({}, custom, '2026-01-01', '2026-12-31')
    expect(ev.map((e) => e.title)).toEqual(['윤일 2주년', '첫 여행 4주년', '프러포즈'])
    expect(ev[0]!.date).toBe('2026-02-28')
  })

  it('finds the next few and "on this day"', () => {
    const couple = { metDate: '2021-05-14' }
    const next = nextAnniversaries(couple, [], '2026-05-10', 2)
    expect(next.map((e) => `${e.date} ${e.title}`)).toEqual(['2026-05-14 만난 지 5주년', '2026-07-26 만난 지 1,900일'])
    expect(onThisDay(couple, [], '2026-05-14').map((e) => e.key)).toContain('met-year:5')
  })

  it('sets/clears couple dates and custom anniversaries', () => {
    let s = setCoupleDates(fresh(), { metDate: '2021-05-14', marriedDate: '2024-10-19' })
    expect(s.couple.metDate).toBe('2021-05-14')
    s = setCoupleDates(s, { marriedDate: null })
    expect(s.couple.marriedDate).toBeUndefined()
    s = addAnniversary(s, { title: '  첫 여행 ', date: '2022-07-02', yearly: true })
    expect(s.anniversaries[0]!.title).toBe('첫 여행')
    expect(addAnniversary(s, { title: ' ', date: '2022-07-02', yearly: true })).toBe(s)
    s = removeAnniversary(s, s.anniversaries[0]!.id)
    expect(s.anniversaries).toEqual([])
  })
})

describe('appointments', () => {
  it('adds, validates, sorts and completes', () => {
    let s = fresh()
    s = addAppointment(s, { date: '2026-09-10', time: '14:30', title: '치과 스케일링', who: 'both', kind: 'hospital' }, 'a')
    s = addAppointment(s, { date: '2026-09-10', time: '09:00', title: '보건소 가임력 검사', who: 'b', kind: 'test', place: ' 구청 보건소 ' }, 'a')
    s = addAppointment(s, { date: '2026-09-05', title: '정액검사', who: 'a', kind: 'test' }, 'a')
    expect(addAppointment(s, { date: '2026-09-05', time: '25:00', title: 'x', who: 'a', kind: 'test' }, 'a')).toBe(s)
    const up = upcomingAppointments(s.appointments, '2026-09-05')
    expect(up.map((a) => a.title)).toEqual(['정액검사', '보건소 가임력 검사', '치과 스케일링'])
    expect(up[1]!.place).toBe('구청 보건소')
    expect(attendees(up[2]!)).toEqual(['a', 'b'])
    s = setAppointmentDone(s, up[0]!.id, true)
    expect(upcomingAppointments(s.appointments, '2026-09-05')).toHaveLength(2)
    s = updateAppointment(s, up[1]!.id, { time: '', place: '' })
    const edited = s.appointments.find((a) => a.id === up[1]!.id)!
    expect(edited.time).toBeUndefined()
    expect(edited.place).toBeUndefined()
    s = removeAppointment(s, up[2]!.id)
    expect(s.appointments).toHaveLength(2)
  })

  it('reminds attendees the day before and on the day, and gives the other partner a heads-up', () => {
    let s = fresh()
    s = addAppointment(s, { date: '2026-09-10', time: '09:00', title: '산부인과 진료', who: 'b', kind: 'hospital' }, 'b')
    const dayBefore = appointmentNotices(s, '2026-09-09')
    expect(dayBefore.map((n) => n.to).sort()).toEqual(['a', 'b'])
    expect(dayBefore.find((n) => n.to === 'a')!.title).toContain('지은님 일정')
    const onDay = appointmentNotices(s, '2026-09-10')
    expect(onDay.map((n) => n.to)).toEqual(['b'])
    expect(appointmentNotices(s, '2026-09-08')).toEqual([])
    const keys = [...dayBefore, ...onDay].map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('exports a discreet calendar event', () => {
    const s = addAppointment(fresh(), { date: '2026-09-10', time: '09:00', title: '정액검사', who: 'a', kind: 'test', note: '금욕 2~7일' }, 'a')
    const a = s.appointments[0]!
    expect(appointmentIcsEvent(a, false).title).toBe('🔬 09:00 정액검사')
    expect(appointmentIcsEvent(a, true)).toMatchObject({ title: '📌 둘셋 일정', description: undefined })
  })
})

describe('roadmap', () => {
  const T: RoadmapTemplate[] = [
    { id: 'pre-folic', phase: 'preconception', who: 'carrier', kind: 'habit', title: '엽산', when: '3개월 전', detail: '', sources: [] },
    { id: 'nt', phase: 'pregnancy-1st', who: 'carrier', kind: 'test', title: 'NT', when: '11~13주', detail: '', window: { anchor: 'lmp', start: 77, end: 97 }, milestoneKey: 'prenatal:nt', sources: [] },
    { id: 'birth-report', phase: 'birth', who: 'both', kind: 'admin', title: '출생신고', when: '1개월 이내', detail: '', window: { anchor: 'birth', start: 0, end: 30 }, deadline: true, sources: [] },
    { id: 'spouse-leave', phase: 'pregnancy-3rd', who: 'partner', kind: 'work', title: '배우자 출산휴가', when: '예정일 50일 전~', detail: '', window: { anchor: 'edd', start: -50 }, sources: [] },
  ]

  it('maps carrier/partner to real members', () => {
    expect(ownersOf(fresh(), 'carrier')).toEqual(['b'])
    expect(ownersOf(fresh(), 'partner')).toEqual(['a'])
    expect(ownersOf(fresh(), 'both')).toEqual(['a', 'b'])
  })

  it('resolves windows only when the anchor exists', () => {
    expect(resolveWindow({ anchor: 'lmp', start: 77, end: 97 }, {})).toEqual({})
    expect(resolveWindow({ anchor: 'lmp', start: 77, end: 97 }, { lmp: '2026-09-01' })).toEqual({ start: '2026-11-17', end: '2026-12-07' })
    expect(resolveWindow({ anchor: 'edd', start: -50 }, { edd: '2027-06-08' })).toEqual({ start: '2027-04-19', end: undefined })
  })

  it('computes statuses', () => {
    expect(statusFor({ done: true, start: '2026-01-01', deadline: false }, '2026-09-01')).toBe('done')
    expect(statusFor({ done: false, deadline: false }, '2026-09-01')).toBe('undated')
    expect(statusFor({ done: false, start: '2026-09-10', end: '2026-09-20', deadline: false }, '2026-09-01')).toBe('soon')
    expect(statusFor({ done: false, start: '2026-10-10', deadline: false }, '2026-09-01')).toBe('later')
    expect(statusFor({ done: false, start: '2026-08-10', end: '2026-08-20', deadline: true }, '2026-09-01')).toBe('overdue')
    expect(statusFor({ done: false, start: '2026-08-10', end: '2026-08-20', deadline: false }, '2026-09-01')).toBe('later')
    expect(statusFor({ done: false, start: '2026-08-10', deadline: false }, '2026-09-01')).toBe('now')
  })

  it('builds items with shared milestone completion and custom tasks', () => {
    let s = startPregnancy(fresh(), '2026-09-01', '2026-10-05')
    let items = buildItems(s, T, '2026-11-20')
    const nt = items.find((i) => i.id === 'nt')!
    expect(nt.status).toBe('now')
    expect(nt.owners).toEqual(['b'])
    s = setTemplateDone(s, T[1]!, true, '2026-11-20', 'a')
    expect(s.milestones).toContainEqual({ key: 'prenatal:nt', date: '2026-11-20' })
    s = setTemplateDone(s, T[0]!, true, '2026-11-20', 'a')
    expect(s.planDone['pre-folic']).toEqual({ at: '2026-11-20', by: 'a' })
    s = addCustomTask(s, { title: '아기 방 정리', phase: 'pregnancy-3rd', who: 'a', due: '2027-05-01' }, 'a')
    items = buildItems(s, T, '2026-11-20')
    expect(items.find((i) => i.id === 'nt')!.status).toBe('done')
    const custom = items.find((i) => i.custom)!
    expect(custom).toMatchObject({ who: 'partner', owners: ['a'], status: 'later' })
    s = setCustomTaskDone(s, custom.id, true, '2026-11-21', 'b')
    expect(s.customTasks[0]).toMatchObject({ doneAt: '2026-11-21', doneBy: 'b' })
    s = setCustomTaskDone(s, custom.id, false, '2026-11-21', 'b')
    expect(s.customTasks[0]!.doneAt).toBeUndefined()
    expect(focusItems(buildItems(s, T, '2027-04-20')).map((i) => i.id)).toContain('spouse-leave')
  })
})
