// Seams between the three 2026-10-17 tracks (founder decision "추천대로 1~3번 다
// 진행해줘") on the app screens:
//  ② her '나만 보기' appointment (Appointment.privateTo) — booked from one of her
//    챙길 것 items that carries his support line and [같이 할게요];
//  ③ the one wording of a pressed [같이 할게요] ('같이 하기로 했어요' + [취소]).
// The inference rule (AGENTS.md 공유 범위): his screens are exactly what they
// would be without that appointment — the 챙길 것 row (no '예약됨' chip, no
// date from it, [일정 잡기] as if there were none), the home's together card,
// 오늘 할 일 and 다가오는 일정 — before and after he says [같이 할게요]. Her own
// screens keep it, with its lock, next to his '민수님이 같이 챙긴대요'.

import { cleanup } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import PlanTab from '@/components/tabs/PlanTab'
import TodayTab from '@/components/tabs/TodayTab'
import { UpcomingCard } from '@/components/today/PlanCards'
import { addDays } from '@/lib/dates'
import { PREP_APPOINTMENTS } from '@/lib/demo'
import { addAppointment, privateOwner, sharedAppointments } from '@/lib/logic/appointments'
import { supportItem, togetherRow } from '@/lib/logic/together'
import { planItems } from '@/lib/logic/plan'
import type { AppState, Appointment, ISODate, MemberId } from '@/lib/types'
import { demoState, renderApp } from '../setup'

const T0: ISODate = '2026-10-17'
const HIM = 'a' as const
const HER = 'b' as const
const ITEM = 'pre-checkup-carrier'
const noop = () => {}

/** React's useId values count up across roots; everything else must match byte for byte. */
const normalized = (html: string) => html.replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g, '#id')

function htmlOf(ui: ReactElement, state: AppState, viewer: MemberId): string {
  renderApp(ui, { state, viewer, today: T0 })
  const html = normalized(document.body.innerHTML)
  cleanup()
  return html
}

/** The preparing demo without its own 나만 보기 example — her 산부인과 검사 (booked from her item): shared, private or gone. */
function variants(): { shared: AppState; mine: AppState; none: AppState; appt: Appointment } {
  const base = demoState(T0)
  // A place no other text on the page carries, so 'not on his screen' can be read off the page.
  const place = '연남동 여성의원 3층'
  const shared = {
    ...base,
    appointments: sharedAppointments(base.appointments).map((a) => (a.title === PREP_APPOINTMENTS.carrierCheck ? { ...a, place } : a)),
  }
  const appt = shared.appointments.find((a) => a.title === PREP_APPOINTMENTS.carrierCheck)!
  expect(appt).toMatchObject({ who: HER, taskId: ITEM })
  expect(appt.date > T0).toBe(true)
  const mine = { ...shared, appointments: shared.appointments.map((a) => (a.id === appt.id ? { ...a, privateTo: HER } : a)) }
  const none = { ...shared, appointments: shared.appointments.filter((a) => a.id !== appt.id) }
  expect(privateOwner(mine.appointments.find((a) => a.id === appt.id)!)).toBe(HER)
  return { shared, mine, none, appt }
}

const planRow = (id: string) => document.querySelector(`[data-plan-row="${id}"]`) as HTMLElement | null

describe('her 나만 보기 booking on an item he can say [같이 할게요] to', () => {
  it('the item still takes his [같이 할게요] — the row as he sees it is the row without the booking', () => {
    const { shared, mine, none } = variants()
    const item = (s: AppState) => planItems(s, T0).find((i) => i.id === ITEM)!
    for (const s of [mine, supportItem(mine, HIM, ITEM, T0)]) {
      const without = { ...s, appointments: none.appointments }
      expect(togetherRow(s, T0, HIM, item(s))).toEqual(togetherRow(without, T0, HIM, item(without)))
    }
    expect(togetherRow(mine, T0, HIM, item(mine)).canSupport).toBe(true)
    // (A shared booking does date his row — so the comparison above can tell.)
    expect(togetherRow(shared, T0, HIM, item(shared)).date).not.toEqual(togetherRow(none, T0, HIM, item(none)).date)
  })

  it('his 챙길 것 tab and his home are byte for byte the ones without it — before and after [같이 할게요]', () => {
    const { shared, mine, none } = variants()
    const said = (s: AppState) => supportItem(s, HIM, ITEM, T0)
    for (const ui of [<PlanTab key="plan" />, <TodayTab key="today" onNavigate={noop} />]) {
      expect(htmlOf(ui, mine, HIM)).toBe(htmlOf(ui, none, HIM))
      expect(htmlOf(ui, said(mine), HIM)).toBe(htmlOf(ui, said(none), HIM))
    }
    // The shared booking is on his 챙길 것 row ('예약됨') — the private one never is.
    expect(htmlOf(<PlanTab />, shared, HIM)).not.toBe(htmlOf(<PlanTab />, none, HIM))
  })

  it('his row: the support line, ‘같이 하기로 했어요’ + [취소] once said — and no 예약됨, no lock, no time or place of hers', () => {
    const { mine, appt } = variants()
    renderApp(<PlanTab />, { state: supportItem(mine, HIM, ITEM, T0), viewer: HIM, today: T0 })
    const row = planRow(ITEM)!
    expect(row.querySelector('[data-support-line]')?.textContent).toContain('같이')
    expect(row.querySelector('[data-support-said]')?.textContent).toContain('같이 하기로 했어요')
    expect(row.querySelector('[data-support-cancel]')?.textContent).toBe('취소')
    expect(row.textContent).not.toContain('예약됨')
    expect(row.textContent).not.toContain(appt.time!)
    expect(document.querySelector('[data-only-me]')).toBeNull()
    expect(document.body.textContent).not.toContain(appt.title)
    expect(document.body.textContent).not.toContain(appt.place!)
  })

  it('her row keeps it: 예약됨 with the lock, and his ‘민수님이 같이 챙긴대요’', () => {
    const { mine, appt } = variants()
    renderApp(<PlanTab />, { state: supportItem(mine, HIM, ITEM, T0), viewer: HER, today: T0 })
    const row = planRow(ITEM)!
    expect(row.textContent).toContain(`${appt.time} 예약됨`)
    expect(row.querySelector('[data-only-me]')?.textContent).toContain('나만 보기')
    expect(row.querySelector('[data-supported-by]')?.textContent).toBe('민수님이 같이 챙긴대요')
    // Her own rows carry no [같이 할게요] (the lines are his to act on).
    expect(row.querySelector('[data-support-button]')).toBeNull()
  })
})

describe('다가오는 일정 (home): hers shows her own 나만 보기 one with the lock; his never does', () => {
  /** A stage demo plus her 나만 보기 visit tomorrow. */
  function withHers(stage: 'pregnant' | 'parenting'): { state: AppState; without: AppState } {
    const base = demoState(T0, stage)
    const without = { ...base, appointments: sharedAppointments(base.appointments) }
    const state = addAppointment(
      without,
      { date: addDays(T0, 1), time: '07:40', title: '피부과 진료', place: '동네 피부과', who: HER, kind: 'hospital', privateTo: HER },
      HER,
    )
    return { state, without }
  }

  it('pregnant: her card leads with it, with the lock', () => {
    const { state } = withHers('pregnant')
    renderApp(<UpcomingCard onNavigate={noop} />, { state, viewer: HER, today: T0 })
    const first = document.querySelector('li') as HTMLElement
    expect(first.textContent).toContain('피부과 진료')
    expect(first.querySelector('[data-only-me]')?.textContent).toContain('나만 보기')
    expect(document.querySelectorAll('[data-only-me]')).toHaveLength(1)
  })

  it('parenting: his card is the card without it', () => {
    const { state, without } = withHers('parenting')
    const ui = <UpcomingCard onNavigate={noop} />
    expect(htmlOf(ui, state, HIM)).toBe(htmlOf(ui, without, HIM))
    expect(htmlOf(ui, state, HIM)).not.toContain('피부과')
    expect(htmlOf(ui, state, HER)).toContain('피부과 진료')
  })
})
