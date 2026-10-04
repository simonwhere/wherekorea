// The partner page (/link) for Now 3's last pieces, rendered in jsdom over the
// real mock transport: his clinic week with [같이 갈게요] (N32), the booked test
// that cannot be recorded before its day (N14 leftover), the '내 준비' bar
// (N30), '매주 이 시간에 알려 받기' with a token-less .ics (N31), a token-less
// open that uses the token this browser remembers, and the simulated offline
// notice and line (mock only — ?mockOffline=1 / dulset:mock-offline).

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LinkPage from '@/components/link/LinkPage'
import { LINK_INTRO_KEY, LINK_TOKEN_KEY, LINK_VIEW_KEY } from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { addAppointment } from '@/lib/logic/appointments'
import { startClinicMode } from '@/lib/logic/clinic'
import { makeLink, type LinkRecord } from '@/lib/logic/partnerLink'
import { applyPartnerEvent, appointmentJoinKey } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { monthlyTask, partnerId } from '@/lib/logic/partnerTrack'
import { MOCK_OFFLINE_KEY, MOCK_SYNC_KEY, createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import { resetTransport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, foundWords, pageText } from '../setup'

const MONDAY: ISODate = '2026-10-05'
const CLINIC_TITLE = 'CLINIC_TITLE_3f9e'
const CLINIC_NOTE = 'CLINIC_NOTE_77aa'

/** The demo couple on a Monday, nothing picked this week. */
function mondayState(): AppState {
  const s = demoState(MONDAY)
  return { ...s, decisions: Object.fromEntries(Object.entries(s.decisions).filter(([k]) => !k.startsWith('week-'))) }
}

/** …in clinic mode, with a '둘이 함께' clinic appointment on Wednesday. */
function clinicState(): AppState {
  let s = startClinicMode(mondayState(), MONDAY)
  s = addAppointment(
    s,
    { date: addDays(MONDAY, 2), time: '08:30', title: CLINIC_TITLE, place: '○○의원', who: 'both', kind: 'hospital', note: CLINIC_NOTE },
    'b',
  )
  return s
}

/** Her phone publishes; the page opens with `query` and the link's hash (or none). */
async function openLink(state: AppState, opts: { query?: string; hash?: boolean; link?: LinkRecord } = {}) {
  const link = opts.link ?? makeLink(null, `${MONDAY}T09:00:00+09:00`)
  const her = createMockTransport({ channel: null, now: () => `${MONDAY}T09:00:00+09:00`, offline: () => false })
  await her.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, MONDAY, partnerId(state))!)
  window.history.replaceState(null, '', `/link/?today=${MONDAY}${opts.query ?? ''}${opts.hash === false ? '' : `#t=${link.token}`}`)
  render(<LinkPage />)
  return link
}

const store = () => parseMockStore(window.localStorage.getItem(MOCK_SYNC_KEY))

beforeEach(() => {
  resetTransport()
  window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
})
afterEach(() => {
  resetTransport()
  vi.restoreAllMocks()
})

describe('/link — his clinic week (N32)', () => {
  it('shows the next seven days’ ‘둘이 함께’ appointment as day · time · place · a kind word, with the leave line and its source', async () => {
    await openLink(clinicState())
    const list = await screen.findByRole('list', { name: '이번 주 병원 일정' })
    expect(list.textContent).toContain('10월 7일 (수) 08:30')
    expect(list.textContent).toContain('병원 진료 · ○○의원 · 둘이 함께')
    expect(pageText()).toContain('난임치료휴가는 남성 근로자도 쓸 수 있어요 · 2026년 11월 27일부터 유급 4일(연 6일)')
    expect(pageText()).toContain('회사마다 달라요')
    const source = screen.getByRole('link', { name: /출처/ })
    expect(source.getAttribute('href')).toMatch(/^https:\/\//)
    expect(source.getAttribute('target')).toBe('_blank')
    // The clinic block never carries the title, the note, her own appointments (산부인과 검사, 치과) or a count.
    const block = document.querySelector('[data-clinic]')!
    expect(foundWords(block.textContent ?? '', [CLINIC_TITLE, CLINIC_NOTE, '산부인과', '치과', '회차', '횟수', '/5', '/20'])).toEqual([])
    // Nor does anything on the page carry the note (the moment card is ttcFlow's own words — see the hand-off).
    expect(foundWords(pageText(), [CLINIC_NOTE])).toEqual([])
  })

  it('[같이 갈게요] sends join-appointment with the appointment id only, reads ‘같이 가요’ at once, and her phone keeps it', async () => {
    let s = clinicState()
    const link = await openLink(s)
    const list = await screen.findByRole('list', { name: '이번 주 병원 일정' })
    fireEvent.click(within(list).getByRole('button', { name: /같이 갈게요/ }))
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'join-appointment')).toBe(true))
    const ev = store().events[link.coupleId]!.find((r) => r.event.kind === 'join-appointment')!.event
    expect(Object.keys(ev).sort()).toEqual(['appointmentId', 'from', 'id', 'kind'])
    const appt = s.appointments.find((a) => a.title === CLINIC_TITLE)!
    expect(ev).toMatchObject({ appointmentId: appt.id, from: 'a' })
    expect(await within(list).findByText('같이 가요')).toBeTruthy()
    expect(within(list).queryByRole('button', { name: /같이 갈게요/ })).toBeNull()
    // Her phone applies it like any event.
    s = applyPartnerEvent(s, ev, MONDAY)
    expect(s.decisions[appointmentJoinKey(appt.id, 'a')]).toBe(MONDAY)
  })

  it('outside clinic mode there is no clinic block at all', async () => {
    await openLink(mondayState())
    await screen.findByRole('region', { name: '이번 주 우리 둘' })
    expect(screen.queryByRole('list', { name: '이번 주 병원 일정' })).toBeNull()
    expect(pageText()).not.toContain('난임치료휴가')
  })
})

describe('/link — the booked test, 내 준비, the weekly reminder', () => {
  it('a test booked ahead shows ‘예약일 …’ instead of [받았어요] (nothing recorded before the day)', async () => {
    const s = mondayState()
    const task = monthlyTask(s, MONDAY, 'a')!
    expect(task.stage).toBe('booked')
    await openLink(s)
    const locked = await waitFor(() => {
      const el = document.querySelector('[data-task-locked]')
      if (!el) throw new Error('no lock yet')
      return el
    })
    expect(locked.textContent).toContain(`예약일 ${Number(task.appointment!.date.slice(5, 7))}월 ${Number(task.appointment!.date.slice(8, 10))}일`)
    expect(screen.queryByRole('button', { name: '받았어요' })).toBeNull()
  })

  it('draws 내 준비 as its own bar under the week card (no second 내 준비 line inside it)', async () => {
    await openLink(mondayState())
    const week = await screen.findByRole('region', { name: '이번 주 우리 둘' })
    const prep = screen.getByRole('region', { name: '내 준비' })
    expect(prep.textContent).toContain('내 준비')
    expect(week.textContent).not.toContain('내 준비')
    // The bar follows the week card.
    expect(week.compareDocumentPosition(prep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('‘캘린더에 넣기’ makes a weekly .ics for the picked day that links to /link/ without the token', async () => {
    const link = await openLink(mondayState())
    const card = await screen.findByRole('region', { name: '매주 이 시간에 알려 받기' })
    // Today (a Monday) is picked first; he picks Friday.
    expect(card.querySelector('[data-weekly-day="MO"]')!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(card.querySelector('[data-weekly-day="FR"]')!)
    expect(card.querySelector('[data-weekly-day="FR"]')!.getAttribute('aria-pressed')).toBe('true')
    const blobs: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b)
      return 'blob:x'
    }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: '캘린더에 넣기' }))
    expect(blobs).toHaveLength(1)
    const ics = await blobs[0]!.text()
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=FR')
    expect(ics).toContain('SUMMARY:둘셋 · 이번 주 우리')
    expect(ics).toContain('/link/')
    expect(ics.includes(link.token)).toBe(false)
    expect(ics).not.toMatch(/생리|배란|가임기|LH|임신/)
    expect(await screen.findByText(/캘린더 파일을 받았어요/)).toBeTruthy()
  })

  it('a token-less /link/ (the calendar’s address) opens with the token this browser remembers', async () => {
    const s = mondayState()
    const link = await openLink(s)
    await screen.findByRole('region', { name: '이번 주 우리 둘' })
    expect(window.localStorage.getItem(LINK_TOKEN_KEY)).toBe(link.token)
    cleanup()
    resetTransport()
    window.history.replaceState(null, '', `/link/?today=${MONDAY}`)
    render(<LinkPage />)
    expect(await screen.findByRole('region', { name: '이번 주 우리 둘' })).toBeTruthy()
    expect(pageText()).not.toContain('링크 주소가 올바르지 않아요')
  })
})

describe('/link — offline, simulated (mock only)', () => {
  it('nothing kept on this phone and ?mockOffline=1: the calm ‘지금은 불러올 수 없어요’ notice with [다시 시도]', async () => {
    await openLink(mondayState(), { query: '&mockOffline=1' })
    expect(await screen.findByText('지금은 불러올 수 없어요')).toBeTruthy()
    expect(pageText()).toContain('인터넷을 확인하고 다시 열어 주세요')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    // His tap would not have gone anywhere: no event was stored.
    expect(Object.values(store().events).flat()).toHaveLength(0)
  })

  it('a page kept from before stays on screen with a slim offline line; back online, the line goes', async () => {
    const s = mondayState()
    const link = await openLink(s)
    await screen.findByRole('region', { name: '이번 주 우리 둘' })
    expect(window.localStorage.getItem(LINK_VIEW_KEY)).toContain(link.token)
    cleanup()
    resetTransport()
    window.localStorage.setItem(MOCK_OFFLINE_KEY, '1')
    window.history.replaceState(null, '', `/link/?today=${MONDAY}#t=${link.token}`)
    render(<LinkPage />)
    const line = await waitFor(() => {
      const el = document.querySelector('[data-offline-line]')
      if (!el) throw new Error('no offline line yet')
      return el
    })
    expect(line.textContent).toContain('지금은 불러올 수 없어요')
    expect(line.textContent).toContain('마지막으로 받은 화면이에요')
    expect(screen.getByRole('region', { name: '이번 주 우리 둘' })).toBeTruthy()
    window.localStorage.removeItem(MOCK_OFFLINE_KEY)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(document.querySelector('[data-offline-line]')).toBeNull())
  })
})
