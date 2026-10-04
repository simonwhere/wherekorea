// Now 3 (N27–N32) hand-offs wired in components:
//  • 챙길 것: a '둘이 함께' appointment carries the partner's [같이 갈게요] (N32,
//    the same answer his link sends) and then reads '민수님이 같이 가요' for her.
//  • 설정 › 내 알림: the partner gets '매주 이 시간에 알려 받기' (N31); the cycle
//    owner does not.
//  • 🔔: while preparing, a reaction note on her own entry stays in the 기록장
//    (N27) — the sheet lists what the badge counts.
//  • 설정 마저 하기 no longer asks 결혼한 날 (the 기록장 asks it, N27).

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotificationsSheet from '@/components/NotificationsSheet'
import AppointmentList from '@/components/plan/AppointmentList'
import AlertsSection from '@/components/settings/AlertsSection'
import SetupCard from '@/components/today/SetupCard'
import { addDays } from '@/lib/dates'
import { addAppointment } from '@/lib/logic/appointments'
import { appointmentJoinKey } from '@/lib/logic/partnerEvents'
import { reactToEntry, reactionNoticeKey } from '@/lib/logic/usView'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-04'
const PARTNER = 'a' // 민수
const OWNER = 'b' // 지은, records the cycle

const noop = () => {}

function withTogetherVisit(base: AppState): { state: AppState; id: string } {
  const state = addAppointment(
    base,
    { date: addDays(T0, 2), time: '08:30', title: '난포 초음파', place: '○○의원', who: 'both', kind: 'hospital' },
    OWNER,
  )
  return { state, id: state.appointments[state.appointments.length - 1]!.id }
}

describe('챙길 것 · [같이 갈게요] on a 둘이 함께 appointment (N32)', () => {
  it('the partner says it in one tap; she then reads 민수님이 같이 가요', () => {
    const { state, id } = withTogetherVisit(demoState(T0))
    const probe = stateProbe()
    const { unmount } = renderApp(
      <>
        <AppointmentList onAdd={noop} onEdit={noop} onDone={noop} />
        <probe.Probe />
      </>,
      { state, viewer: PARTNER, today: T0 },
    )
    const row = screen.getByRole('button', { name: '난포 초음파 일정 고치기' }).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '같이 갈게요' }))
    const after = probe.current.state!
    expect(after.decisions?.[appointmentJoinKey(id, PARTNER)]).toBe(T0)
    // Once said, the button gives way to '같이 가요'.
    expect(within(row).queryByRole('button', { name: '같이 갈게요' })).toBeNull()
    expect(row.textContent).toContain('같이 가요')
    unmount()

    renderApp(<AppointmentList onAdd={noop} onEdit={noop} onDone={noop} />, { state: after, viewer: OWNER, today: T0 })
    const herRow = screen.getByRole('button', { name: '난포 초음파 일정 고치기' }).closest('li') as HTMLElement
    expect(herRow.textContent).toContain('민수님이 같이 가요')
    // The cycle owner has no [같이 갈게요] of her own.
    expect(within(herRow).queryByRole('button', { name: '같이 갈게요' })).toBeNull()
  })

  it('is not offered on his own or her own appointment', () => {
    const base = demoState(T0)
    const state = addAppointment(base, { date: addDays(T0, 3), title: '치과', who: OWNER, kind: 'hospital' }, OWNER)
    renderApp(<AppointmentList onAdd={noop} onEdit={noop} onDone={noop} />, { state, viewer: PARTNER, today: T0 })
    const row = screen.getByRole('button', { name: '치과 일정 고치기' }).closest('li') as HTMLElement
    expect(within(row).queryByRole('button', { name: '같이 갈게요' })).toBeNull()
  })
})

describe('설정 › 내 알림 · 매주 이 시간에 알려 받기 (N31)', () => {
  it('is the partner’s, with a 월~일 picker and one download button', () => {
    renderApp(<AlertsSection />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    const days = screen.getByRole('group', { name: '알려 받을 요일' })
    const buttons = within(days).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    // 2026-10-04 is a Sunday: today's day is picked first.
    expect(within(days).getByRole('button', { name: '일' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(days).getByRole('button', { name: '수' }))
    expect(screen.getByRole('button', { name: /매주 수요일 캘린더에 넣기/ })).toBeTruthy()
  })

  it('is not on the cycle owner’s settings', () => {
    renderApp(<AlertsSection />, { state: demoState(T0), viewer: OWNER, today: T0 })
    expect(screen.queryByRole('group', { name: '알려 받을 요일' })).toBeNull()
  })
})

describe('🔔 while preparing (N27)', () => {
  it('keeps a reaction on her own entry out of the list (it waits in the 기록장)', () => {
    const base = demoState(T0)
    // One of her entries he hasn't reacted to yet (the note is keyed, once per entry).
    const mine = base.diary.find(
      (e) => e.author === OWNER && !e.reactions?.[PARTNER] && !base.notifications.some((n) => n.key === reactionNoticeKey(e.id, PARTNER)),
    )!
    const state = reactToEntry(base, mine.id, PARTNER, '👏', `${T0}T09:00:00+09:00`)
    expect(state.notifications.some((n) => n.to === OWNER && n.title.includes('마음을 남겼어요'))).toBe(true)
    renderApp(<NotificationsSheet open onClose={noop} />, { state, viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '알림' })
    expect(dialog.textContent).not.toContain('마음을 남겼어요')
  })
})

describe('설정 마저 하기 (N27)', () => {
  it('asks 출생연도 and 시작한 날 only — 결혼한 날 is the 기록장’s question', () => {
    const base = demoState(T0)
    const state: AppState = {
      ...base,
      couple: {
        ...base.couple,
        marriedDate: undefined,
        members: [
          { ...base.couple.members[0], birthYear: undefined },
          { ...base.couple.members[1], birthYear: undefined },
        ],
      },
      settings: { ...base.settings, ttcStart: undefined },
    }
    renderApp(<SetupCard />, { state, viewer: OWNER, today: T0 })
    const text = pageText()
    expect(text).toContain('내 출생연도')
    expect(text).toContain('함께 준비를 시작한 날')
    expect(text).not.toContain('결혼한 날')
  })
})
