// Final QA of 같이 챙길 것 (founder request 2026-10-09: "여자가 챙겨야 할 것들을
// 남자에게도 계속 보여줘야해 같이 하는거야") — the hand-off items applied here:
//
//  • togetherRow carries the 42-day quiet itself: no support line, no note,
//    no '민수님이 같이 챙긴대요' and no [같이 할게요] on any row (챙길 것, 검사 일정,
//    the home card) — one place instead of each screen's own check.
//  • A deleted appointment (a tombstone) is never 다가오는 / 지난 일정.
//  • [같이 갈게요] never answers a visit booked for a pregnancy that ended —
//    not in the app's 챙길 것, not as a link event, not on his clinic week.

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { addAppointment, pastAppointments, upcomingAppointments } from '@/lib/logic/appointments'
import { setClinicMode } from '@/lib/logic/clinic'
import { applyPartnerEvent, joinableAppointment, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { linkClinic } from '@/lib/logic/partnerSnapshot'
import { planItems } from '@/lib/logic/plan'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { supportItem, togetherRow } from '@/lib/logic/together'
import { weekQuiet } from '@/lib/logic/weekTogether'
import type { AppState, Appointment, ISODate } from '@/lib/types'

const T0: ISODate = '2026-10-09'
const HIM = 'a' as const
const HER = 'b' as const

const demo = (stage: AppState['stage'] = 'preparing', today: ISODate = T0) => createDemoState(today, new Date(`${today}T10:00:00`), stage)

/** He said [같이 할게요] to two of her items, then the pregnancy ended `endedAgo` days before T0. */
function afterLoss(endedAgo = 1): AppState {
  let s = demo()
  s = supportItem(s, HIM, 'pre-checkup-carrier', addDays(T0, -80))
  const pregnant = startPregnancy(s, addDays(T0, -70), addDays(T0, -40))
  return endPregnancy(pregnant, addDays(T0, -endedAgo))
}

describe('togetherRow rests in the quiet after a loss', () => {
  it('no support line, note, supportedBy or [같이 할게요] on any row for either of them', () => {
    const s = afterLoss()
    expect(weekQuiet(s, T0)).toBe(true)
    const items = planItems(s, T0)
    expect(items.length).toBeGreaterThan(10)
    for (const item of items) {
      for (const viewer of [HIM, HER] as const) {
        const row = togetherRow(s, T0, viewer, item)
        expect(row.support, `${viewer} ${item.id}`).toBeUndefined()
        expect(row.supportNote, `${viewer} ${item.id}`).toBeUndefined()
        expect(row.supportedBy, `${viewer} ${item.id}`).toBeUndefined()
        expect(row.canSupport, `${viewer} ${item.id}`).toBe(false)
      }
    }
  })

  it('the rows keep their plan: titles and (neutral) statuses are unchanged by the quiet', () => {
    const quiet = afterLoss()
    const after = afterLoss(60)
    expect(weekQuiet(after, T0)).toBe(false)
    for (const item of planItems(quiet, T0)) {
      const row = togetherRow(quiet, T0, HIM, item)
      expect(row.title).toBe(item.title)
      // Her overdue items never read '기한 지남' on his side, quiet or not.
      if (row.whose === 'theirs') expect(row.label ?? '').not.toContain('기한 지남')
    }
  })

  it('control: once the quiet is over the support lines come back on his side and his answer on hers', () => {
    const s = supportItem(demo(), HIM, 'pre-checkup-carrier', T0)
    const items = planItems(s, T0)
    expect(items.some((i) => togetherRow(s, T0, HIM, i).support)).toBe(true)
    const hers = items.find((i) => i.id === 'pre-checkup-carrier')!
    expect(togetherRow(s, T0, HER, hers).supportedBy).toBe('민수님이 같이 챙긴대요')
  })
})

describe('tombstones are never 다가오는 or 지난 일정', () => {
  it('upcomingAppointments and pastAppointments skip a deleted appointment', () => {
    const base = demo()
    const live: Appointment = { id: 'x-live', date: addDays(T0, 3), title: '검사', who: 'both', kind: 'test', createdBy: HER }
    const gone: Appointment = { ...live, id: 'x-gone', deletedAt: `${T0}T09:00:00` }
    const goneOld: Appointment = { ...live, id: 'x-gone-old', date: addDays(T0, -3), deletedAt: `${T0}T09:00:00` }
    const list = [...base.appointments, live, gone, goneOld]
    const up = upcomingAppointments(list, T0).map((a) => a.id)
    const past = pastAppointments(list, T0).map((a) => a.id)
    expect(up).toContain('x-live')
    expect(up).not.toContain('x-gone')
    expect(past).not.toContain('x-gone-old')
    expect(up.length + past.length).toBe(list.length - 2)
  })
})

describe('[같이 갈게요] never answers a visit of a pregnancy that ended', () => {
  /** A '둘이 함께' 정밀초음파-type visit booked for the pregnancy, `endedAgo` days after it ended. */
  function bookedThenEnded(endedAgo: number): { s: AppState; id: string; pregnant: AppState } {
    let s = demo()
    s = startPregnancy(s, addDays(T0, -100), addDays(T0, -70))
    const ptask = planItems(s, T0).find((i) => i.phase === 'pregnancy-2nd' && !i.custom)!
    s = addAppointment(s, { date: addDays(T0, 2), title: '정밀 초음파', who: 'both', kind: 'hospital', taskId: ptask.id }, HER)
    const id = s.appointments.at(-1)!.id
    return { s: endPregnancy(s, addDays(T0, -endedAgo)), id, pregnant: s }
  }

  it('joinable while pregnant, not once it ended (in the quiet and after it)', () => {
    for (const endedAgo of [1, 60]) {
      const { s, id, pregnant } = bookedThenEnded(endedAgo)
      expect(joinableAppointment(pregnant, id, T0)).toBeTruthy()
      expect(joinableAppointment(s, id, T0), `ended ${endedAgo} days ago`).toBeUndefined()
    }
  })

  it('his link event is refused and changes nothing', () => {
    const { s, id } = bookedThenEnded(60)
    const ev: PartnerEvent = { id: 'qa-join', kind: 'join-appointment', appointmentId: id }
    expect(partnerEventProblem(s, ev, T0)).toBe('appointment')
    expect(applyPartnerEvent(s, ev, T0)).toBe(s)
  })

  it('his clinic week leaves it out; a visit of their own in the same week stays', () => {
    const { s: ended, id } = bookedThenEnded(60)
    let s = setClinicMode(ended, true, T0)
    s = addAppointment(s, { date: addDays(T0, 3), title: '채혈', who: 'both', kind: 'test' }, HER)
    const own = s.appointments.at(-1)!.id
    const clinic = linkClinic(s, T0, HIM)
    expect(clinic).toBeTruthy()
    const ids = clinic!.appointments.map((a) => a.id)
    expect(ids).toContain(own)
    expect(ids).not.toContain(id)
  })
})

describe('a month task booked ahead waits for its day (any stage, not only the test step)', () => {
  it("his pregnant-stage month task on a shared visit she booked for tomorrow can't be done today", async () => {
    const { monthlyTask } = await import('@/lib/logic/partnerTrack')
    const { taskLocked } = await import('@/lib/logic/partnerEvents')
    let s = startPregnancy(demo(), addDays(T0, -40), addDays(T0, -30))
    const before = monthlyTask(s, T0, HIM)
    expect(before).toBeDefined()
    const id = before!.id
    s = addAppointment(s, { date: addDays(T0, 1), time: '10:00', title: '검진', place: '', who: 'both', kind: 'hospital', note: '', taskId: id }, HER)
    const task = monthlyTask(s, T0, HIM)!
    expect(task.id).toBe(id)
    expect(task.minDoneAt).toBe(addDays(T0, 1))
    expect(taskLocked(task, T0)).toBe(true)
    const ev: PartnerEvent = { id: 'ev-early', from: HIM, kind: 'task-done', taskId: id, date: T0 } as PartnerEvent
    expect(partnerEventProblem(s, ev, T0)).toBe('date')
    // On the booked day it opens.
    expect(taskLocked(monthlyTask(s, addDays(T0, 1), HIM)!, addDays(T0, 1))).toBe(false)
  })
})
