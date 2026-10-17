// '나만 보기' appointments on the app screens (founder decision 2026-10-17 ②).
//
// The demo couple: 민수 'a' (함께하는 사람) · 지은 'b' (records the cycle). The
// appointment sheet offers '{partner}님에게도 보여요' to the person going, on
// their own appointment only — on by default (shared, as before); off keeps it
// '나만 보기'. Her lists mark it with a lock; his screens never show it.

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppointmentList from '@/components/plan/AppointmentList'
import AppointmentSheet from '@/components/plan/AppointmentSheet'
import PlanTab from '@/components/tabs/PlanTab'
import TodayTasks from '@/components/today/TodayTasks'
import { addDays } from '@/lib/dates'
import { DEMO_PRIVATE_APPOINTMENT } from '@/lib/demo'
import { addAppointment, privateOwner, removeAppointment, sharedAppointments } from '@/lib/logic/appointments'
import { mergeNotices } from '@/lib/logic/notifications'
import { FERTILITY_CARRIER_TEST_ID } from '@/lib/logic/partnerTrack'
import { appointmentReminders } from '@/lib/logic/planNotices'
import { draftFromAppointment, emptyDraft, planItems } from '@/lib/logic/plan'
import type { AppState, Appointment, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-17'
const HIM = 'a' as const
const HER = 'b' as const
const noop = () => {}

const toggle = () => screen.queryByRole('switch')
const who = (name: string) => within(screen.getByRole('group', { name: '누가 가요' })).getByRole('button', { name })
const lastAdded = (s: AppState): Appointment => s.appointments[s.appointments.length - 1]!

/** The demo without its own 나만 보기 appointment, plus one of hers tomorrow. */
function withHersTomorrow(): { state: AppState; appt: Appointment } {
  const base = demoState(T0)
  const state = addAppointment(
    { ...base, appointments: sharedAppointments(base.appointments) },
    { date: addDays(T0, 1), time: '18:30', title: '피부과 진료', place: '동네 피부과', who: HER, kind: 'hospital', privateTo: HER },
    HER,
  )
  return { state, appt: lastAdded(state) }
}

describe('the appointment sheet: 민수님에게도 보여요', () => {
  it('is on by default for her own appointment; off keeps it 나만 보기 and drops the heads-up promise', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <AppointmentSheet initial={{ ...emptyDraft(T0), who: HER, date: addDays(T0, 1) }} onClose={noop} />
        <probe.Probe />
      </>,
      { state: demoState(T0), viewer: HER, today: T0 },
    )
    const sw = toggle()!
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(pageText()).toContain('민수님에게도 보여요')
    expect(pageText()).toContain('함께 가지 않는 사람에게도 전날 살짝 알려 줘요')
    expect(pageText()).not.toContain('민수님 화면·알림·링크에 나오지 않아요')

    fireEvent.click(sw)
    expect(toggle()!.getAttribute('aria-checked')).toBe('false')
    expect(pageText()).toContain('민수님 화면·알림·링크에 나오지 않아요')
    expect(pageText()).not.toContain('함께 가지 않는 사람에게도')

    fireEvent.change(screen.getByLabelText('무슨 일정'), { target: { value: '피부과 진료' } })
    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }))
    const added = lastAdded(probe.current.state!)
    expect(added.title).toBe('피부과 진료')
    expect(added.privateTo).toBe(HER)
    expect(pageText()).toContain('나만 보는 일정으로 넣었어요')
  })

  it('left on, it is shared exactly as before', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <AppointmentSheet initial={{ ...emptyDraft(T0), who: HER }} onClose={noop} />
        <probe.Probe />
      </>,
      { state: demoState(T0), viewer: HER, today: T0 },
    )
    fireEvent.change(screen.getByLabelText('무슨 일정'), { target: { value: '치과' } })
    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }))
    expect('privateTo' in lastAdded(probe.current.state!)).toBe(false)
    expect(pageText()).toContain('민수님 화면에도 보여요')
  })

  it('is offered only to the person going: not on 둘 다 or the other person’s visit — and switching away shares it again', () => {
    renderApp(<AppointmentSheet initial={{ ...emptyDraft(T0), who: 'both' }} onClose={noop} />, {
      state: demoState(T0),
      viewer: HER,
      today: T0,
    })
    expect(toggle()).toBeNull()
    fireEvent.click(who('민수'))
    expect(toggle()).toBeNull()
    fireEvent.click(who('지은'))
    expect(toggle()!.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle()!)
    expect(toggle()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(who('둘 다'))
    expect(toggle()).toBeNull()
    fireEvent.click(who('지은'))
    expect(toggle()!.getAttribute('aria-checked')).toBe('true')
  })

  it('is his too, on his own appointment (지은님에게도 보여요)', () => {
    renderApp(<AppointmentSheet initial={{ ...emptyDraft(T0), who: HIM }} onClose={noop} />, {
      state: demoState(T0),
      viewer: HIM,
      today: T0,
    })
    expect(pageText()).toContain('지은님에게도 보여요')
  })

  it('editing keeps it (and 같은 일정 복제 too); turning it on shares it again', () => {
    const { state, appt } = withHersTomorrow()
    const probe = stateProbe()
    const { unmount } = renderApp(
      <>
        <AppointmentSheet initial={draftFromAppointment(appt)} editing={appt} onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    expect(toggle()!.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: /같은 일정 \+2일 복제/ }))
    const copy = lastAdded(probe.current.state!)
    expect(copy.id).not.toBe(appt.id)
    expect(copy.date).toBe(addDays(appt.date, 2))
    expect(copy.privateTo).toBe(HER)
    unmount()

    renderApp(
      <>
        <AppointmentSheet initial={draftFromAppointment(appt)} editing={appt} onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    fireEvent.change(screen.getByLabelText('무슨 일정'), { target: { value: '피부과 재진' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const kept = probe.current.state!.appointments.find((a) => a.id === appt.id)!
    expect(kept.title).toBe('피부과 재진')
    expect(kept.privateTo).toBe(HER)
  })

  it('turning it on while editing shares it again', () => {
    const { state, appt } = withHersTomorrow()
    const probe = stateProbe()
    renderApp(
      <>
        <AppointmentSheet initial={draftFromAppointment(appt)} editing={appt} onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    fireEvent.click(toggle()!)
    expect(toggle()!.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const after = probe.current.state!.appointments.find((a) => a.id === appt.id)!
    expect('privateTo' in after).toBe(false)
  })
})

describe('her lists show the lock; his show nothing', () => {
  it('챙길 것 · 다가오는 일정: 나만 보기 on hers, nowhere on his', () => {
    const state = demoState(T0)
    const mine = state.appointments.find((a) => privateOwner(a) === HER)!
    expect(mine.title).toBe(DEMO_PRIVATE_APPOINTMENT.title)
    const { unmount } = renderApp(<AppointmentList onAdd={noop} onEdit={noop} onDone={noop} />, { state, viewer: HER, today: T0 })
    const row = screen.getByRole('button', { name: `${mine.title} 일정 고치기` }).closest('li') as HTMLElement
    expect(row.querySelector('[data-only-me]')?.textContent).toContain('나만 보기')
    // Shared rows carry no lock.
    expect(document.querySelectorAll('[data-only-me]')).toHaveLength(1)
    // The subtitle is true above a locked row — and the same words on his side (never a sign one exists).
    const SUB = '기본은 둘이 같이 봐요 · 내 일정은 나만 보기로 둘 수 있어요'
    expect(pageText()).toContain(SUB)
    unmount()

    renderApp(<AppointmentList onAdd={noop} onEdit={noop} onDone={noop} />, { state, viewer: HIM, today: T0 })
    expect(pageText()).toContain(SUB)
    expect(pageText()).not.toContain(mine.title)
    expect(pageText()).not.toContain(DEMO_PRIVATE_APPOINTMENT.place)
    expect(document.querySelector('[data-only-me]')).toBeNull()
  })

  it('오늘 할 일: her own tomorrow with the lock; on his home it is not there at all', () => {
    const { state } = withHersTomorrow()
    const { unmount } = renderApp(<TodayTasks onNavigate={noop} />, { state, viewer: HER, today: T0 })
    expect(pageText()).toContain('피부과 진료')
    expect(document.querySelector('[data-only-me]')?.textContent).toContain('나만 보기')
    unmount()

    renderApp(<TodayTasks onNavigate={noop} />, { state, viewer: HIM, today: T0 })
    expect(pageText()).not.toContain('피부과')
    expect(document.querySelector('[data-only-me]')).toBeNull()
  })
})

describe('[다녀왔어요] on her 나만 보기 visit (챙길 것): his 챙길 것 never carries its date', () => {
  const VISIT: ISODate = addDays(T0, -5) // 10.12
  /** Her shared carrier-test booking replaced by a 나만 보기 one, five days back. */
  function privateVisit(): { state: AppState; appt: Appointment } {
    const base = demoState(T0)
    const booked = base.appointments.find((a) => a.taskId === FERTILITY_CARRIER_TEST_ID)!
    const state = addAppointment(
      removeAppointment(base, booked.id),
      { date: VISIT, title: '산전 검사 나만', who: HER, kind: 'test', taskId: FERTILITY_CARRIER_TEST_ID, privateTo: HER },
      HER,
    )
    return { state, appt: lastAdded(state) }
  }
  const carrierItem = (s: AppState) => planItems(s, T0).find((i) => i.id === FERTILITY_CARRIER_TEST_ID)!

  function pressVisited(appt: Appointment) {
    fireEvent.click(screen.getByRole('button', { name: /지난·다녀온 일정 \d+개 보기/ }))
    const row = screen.getByRole('button', { name: `${appt.title} 일정 고치기` }).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '다녀왔어요 ✓' }))
  }

  it('marks only the visit and asks before ticking 챙길 것; his page has no "10.12 지은 챙김"', () => {
    const { state, appt } = privateVisit()
    const probe = stateProbe()
    const { unmount } = renderApp(
      <>
        <PlanTab />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    pressVisited(appt)
    const after = probe.current.state!
    expect(after.appointments.find((a) => a.id === appt.id)!.done).toBe(true)
    expect(carrierItem(after).status).not.toBe('done')
    expect(pageText()).toContain('챙길 것에도 체크할까요? 민수님 화면에도 보여요')
    expect(screen.getByRole('button', { name: '체크하기' })).toBeTruthy()
    expect(pageText()).not.toContain('챙길 것에도 체크했어요')
    unmount()

    renderApp(<PlanTab />, { state: after, viewer: HIM, today: T0 })
    expect(pageText()).not.toContain('10.12 지은 챙김')
    expect(pageText()).not.toContain(appt.title)
  })

  it('her yes (체크하기) ticks it dated to the visit', () => {
    const { state, appt } = privateVisit()
    const probe = stateProbe()
    renderApp(
      <>
        <PlanTab />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    pressVisited(appt)
    fireEvent.click(screen.getByRole('button', { name: '체크하기' }))
    const item = carrierItem(probe.current.state!)
    expect(item.status).toBe('done')
    expect(item.doneAt).toBe(VISIT)
    expect(pageText()).toContain('챙길 것에도 체크했어요 ✓')
    expect(screen.queryByRole('button', { name: '체크하기' })).toBeNull()
  })
})

describe('the sheet after his heads-up went out: honest about what was already told', () => {
  /** Her shared appointment tomorrow; `told` runs the day-before rule so his 🔔 holds the heads-up. */
  function sharedTomorrow(told: boolean): { state: AppState; appt: Appointment } {
    const base = demoState(T0)
    const added = addAppointment(base, { date: addDays(T0, 1), title: '이비인후과 진료', who: HER, kind: 'hospital' }, HER)
    const appt = lastAdded(added)
    const state = told ? mergeNotices(added, appointmentReminders(added, T0), `${T0}T10:00:00`).state : added
    return { state, appt }
  }
  const hisAbout = (s: AppState, id: string) => s.notifications.filter((n) => n.to === HIM && n.key?.startsWith(`appt:${id}:`))

  it('switched off: says 앞으로 …, and saving takes the heads-up out of his 🔔', () => {
    const { state, appt } = sharedTomorrow(true)
    expect(hisAbout(state, appt.id)).toHaveLength(1)
    const probe = stateProbe()
    renderApp(
      <>
        <AppointmentSheet initial={draftFromAppointment(appt)} editing={appt} onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    fireEvent.click(toggle()!)
    expect(pageText()).toContain('앞으로 민수님 화면·알림·링크에 나오지 않아요. 이미 폰에 뜬 알림은 남을 수 있어요')
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const after = probe.current.state!
    expect(after.appointments.find((a) => a.id === appt.id)!.privateTo).toBe(HER)
    expect(hisAbout(after, appt.id)).toEqual([])
  })

  it('nothing told yet: the plain line', () => {
    const { state, appt } = sharedTomorrow(false)
    renderApp(<AppointmentSheet initial={draftFromAppointment(appt)} editing={appt} onClose={noop} />, { state, viewer: HER, today: T0 })
    fireEvent.click(toggle()!)
    expect(pageText()).toContain('민수님 화면·알림·링크에 나오지 않아요')
    expect(pageText()).not.toContain('앞으로 민수님')
  })
})
