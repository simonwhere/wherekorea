// The partner page (/link) for the founder request of 2026-10-09 — "여자가
// 챙겨야 할 것들을 남자에게도 계속 보여줘야해 같이 하는거야" — rendered in jsdom
// over the real mock transport: 같이 챙길 것 (her items and the shared ones,
// neutral statuses, his support line, [같이 할게요] / 취소 as 'support' events
// her phone applies), and the pregnant page (the stage card in the moment
// card's place, his next shared checkup, '이번 주 우리 둘' from the pregnant
// catalogue, 내 준비 with his own items) in the order the page promises.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LinkPage from '@/components/link/LinkPage'
import LinkPreview from '@/components/link/LinkPreview'
import { LINK_INTRO_KEY } from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { addAppointment } from '@/lib/logic/appointments'
import { makeLink } from '@/lib/logic/partnerLink'
import { applyPartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { partnerId } from '@/lib/logic/partnerTrack'
import { supportKey } from '@/lib/logic/together'
import { MOCK_SYNC_KEY, createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import { resetTransport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, foundWords, pageText } from '../setup'

const TODAY: ISODate = '2026-10-09'
const HER_TITLE = 'HER_TITLE_51c2'
const HER_NOTE = 'HER_NOTE_0d7b'
/** Words that must never be said about her items on his page. */
const PRESSURE = ['기한 지남', '지났어요', '안 했어요', '늦었', '서둘러']

async function openLink(state: AppState, day: ISODate = TODAY) {
  const link = makeLink(null, `${day}T09:00:00+09:00`)
  const her = createMockTransport({ channel: null, now: () => `${day}T09:00:00+09:00`, offline: () => false })
  await her.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, day, partnerId(state))!)
  window.history.replaceState(null, '', `/link/?today=${day}#t=${link.token}`)
  render(<LinkPage />)
  return link
}

const store = () => parseMockStore(window.localStorage.getItem(MOCK_SYNC_KEY))

/** The pregnant demo with one checkup of hers tomorrow (a title and a note that never travel). */
function pregnantState(): AppState {
  const s = demoState(TODAY, 'pregnant')
  return addAppointment(
    s,
    { date: addDays(TODAY, 1), time: '11:00', title: HER_TITLE, place: '동네 산부인과', who: 'b', kind: 'hospital', note: HER_NOTE },
    'b',
  )
}

beforeEach(() => {
  resetTransport()
  window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
})
afterEach(() => {
  cleanup()
  resetTransport()
})

describe('/link — 같이 챙길 것', () => {
  it('shows her items and the shared ones with a neutral status and what he can do — never a warning about her', async () => {
    await openLink(demoState(TODAY))
    const block = await screen.findByRole('region', { name: '같이 챙길 것' })
    expect(block.textContent).toContain('지은님이 챙기는 것도 같이 봐요')
    // Three rows first; the rest open with 'N개 더 보기' (and fold back).
    expect(block.querySelectorAll('[data-together-item]')).toHaveLength(3)
    const more = within(block).getByRole('button', { name: /^2개 더 보기/ })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    const rows = block.querySelectorAll('[data-together-item]')
    expect(rows).toHaveLength(5)
    expect(within(block).getByRole('button', { name: /^접기/ }).getAttribute('aria-expanded')).toBe('true')
    for (const row of rows) {
      expect(row.querySelector('[data-together-support]')?.textContent).toMatch(/^내가 할 수 있는 것 · .+/)
      expect(['upcoming', 'this-week', 'done']).toContain(row.getAttribute('data-status'))
    }
    expect(block.textContent).toContain('임신 전 기본 검사')
    expect(block.textContent).toContain('검사 날 같이 가기')
    expect(foundWords(block.textContent ?? '', PRESSURE)).toEqual([])
    // While preparing her bookings stay in the app: no day, no time, no place of hers.
    expect(foundWords(block.textContent ?? '', ['10월 14일', '10:00', '산부인과', '치과 검진·스케일링 ·'])).toEqual([])
  })

  it('[같이 할게요] sends a support event (an id and on), reads at once, her phone keeps it — and 취소 takes it back', async () => {
    let s = demoState(TODAY)
    const link = await openLink(s)
    const block = await screen.findByRole('region', { name: '같이 챙길 것' })
    const row = block.querySelector('[data-together-item="pre-checkup-carrier"]') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: '‘임신 전 기본 검사’ 같이 할게요' }))
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'support')).toBe(true))
    const ev = store().events[link.coupleId]!.find((r) => r.event.kind === 'support')!.event
    expect(Object.keys(ev).sort()).toEqual(['from', 'id', 'itemId', 'kind', 'on'])
    expect(ev).toMatchObject({ from: 'a', itemId: 'pre-checkup-carrier', on: true })
    expect(await within(row).findByText('같이 하기로 했어요')).toBeTruthy()
    expect(await screen.findByText('‘임신 전 기본 검사’ 같이 할게요. 지은님에게 전해져요')).toBeTruthy()
    // Her phone applies it: the same key the app's own button writes.
    s = applyPartnerEvent(s, ev, TODAY)
    expect(s.decisions[supportKey('pre-checkup-carrier', 'a')]).toBe(TODAY)
    // He takes it back.
    fireEvent.click(within(row).getByRole('button', { name: '‘임신 전 기본 검사’ 같이 하기 취소' }))
    await waitFor(() => expect(store().events[link.coupleId]!.filter((r) => r.event.kind === 'support')).toHaveLength(2))
    const off = store().events[link.coupleId]!.filter((r) => r.event.kind === 'support')[1]!.event
    expect(off).toMatchObject({ itemId: 'pre-checkup-carrier', on: false })
    expect(await within(row).findByRole('button', { name: '‘임신 전 기본 검사’ 같이 할게요' })).toBeTruthy()
    s = applyPartnerEvent(s, off, TODAY)
    expect(s.decisions[supportKey('pre-checkup-carrier', 'a')]).toBeUndefined()
  })

  it('a row he already answered (her phone applied it) reads ‘같이 하기로 했어요’ with 취소', async () => {
    const s = applyPartnerEvent(demoState(TODAY), { id: 'pre', from: 'a', kind: 'support', itemId: 'pre-varicella', on: true }, TODAY)
    await openLink(s)
    const block = await screen.findByRole('region', { name: '같이 챙길 것' })
    const row = block.querySelector('[data-together-item="pre-varicella"]') as HTMLElement
    expect(within(row).getByText('같이 하기로 했어요')).toBeTruthy()
    expect(within(row).getByRole('button', { name: /같이 하기 취소/ })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: /같이 할게요$/ })).toBeNull()
  })
})

describe('/link — the pregnant page', () => {
  it('stage card → 이번 주 우리 둘 → 같이 챙길 것 → 내 준비 → 오늘 할 일 → 우리 한 줄, in that order', async () => {
    await openLink(pregnantState())
    const card = await screen.findByRole('region', { name: '우리의 임신 주수' })
    const order = ['우리의 임신 주수', '이번 주 우리 둘', '같이 챙길 것', '내 준비', '우리 한 줄'].map((name) => screen.getByRole('region', { name }))
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy()
    }
    // The checks sit between 내 준비 and 우리 한 줄.
    const checks = screen.getByRole('heading', { name: '오늘 할 일' })
    expect(order[3]!.compareDocumentPosition(checks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(checks.compareDocumentPosition(order[4]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 임신 12주 3일 (the demo), its trimester, the due date with (예상) and D-N.
    expect(card.textContent).toContain('임신 12주 3일')
    expect(card.textContent).toContain('임신 초기')
    expect(card.textContent).toMatch(/예정일 \d+월 \d+일 \(예상\)/)
    expect(card.textContent).toMatch(/D-\d+/)
    // No moment card while pregnant.
    expect(screen.queryByRole('region', { name: '오늘의 우리' })).toBeNull()
  })

  it('his next shared checkup: hers tomorrow by the day only, with what he can do — never her title, note, time or place', async () => {
    await openLink(pregnantState())
    const box = (await screen.findByRole('region', { name: '우리의 임신 주수' })).querySelector('[data-stage-checkup]')!
    expect(box.textContent).toContain('다음 병원 일정 · 내일')
    expect(box.textContent).toContain('병원 진료 · 지은님')
    expect(box.textContent).toContain('같이 갈 수 있으면 시간 비워 두기')
    expect(foundWords(pageText(), [HER_TITLE, HER_NOTE, '11:00', '동네 산부인과'])).toEqual([])
  })

  it('the week comes from the pregnant catalogue (검진 날 in a checkup week), and 내 준비 lists his own items', async () => {
    await openLink(pregnantState())
    const week = await screen.findByRole('region', { name: '이번 주 우리 둘' })
    expect(within(week).getByRole('button', { name: /검진 날 같이 가기/ })).toBeTruthy()
    const prep = screen.getByRole('region', { name: '내 준비' })
    const items = within(prep).getByRole('list', { name: '내 준비 항목' })
    expect(items.textContent).toContain('배우자 지원 제도 살펴보기')
    expect(items.textContent).toContain('배우자 출산휴가 20일')
    expect(prep.textContent).not.toMatch(/\b0\/|안 했어요/)
    // The shared NT row with his line; the weekly reminder is offered too.
    const block = screen.getByRole('region', { name: '같이 챙길 것' })
    expect(block.querySelector('[data-together-item="p1-nt"]')?.textContent).toContain('예약 시간 비워 두기')
    // His month task (분만 병원 정하기, a shared item) is its own card, not a second row here.
    fireEvent.click(within(block).getByRole('button', { name: /개 더 보기/ }))
    expect(block.querySelector('[data-together-item="p1-birth-hospital"]')).toBeNull()
    expect(pageText()).toContain('분만 병원 정하기')
    expect(screen.getByRole('button', { name: /캘린더에 넣기/ })).toBeTruthy()
  })

  it('the preview in 설정 › 연결 draws the same pregnant page, read-only', () => {
    const s = pregnantState()
    render(<LinkPreview snapshot={buildPartnerSnapshot(s, TODAY, partnerId(s))!} today={TODAY} />)
    expect(screen.getByRole('region', { name: '우리의 임신 주수' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '같이 챙길 것' })).toBeTruthy()
  })
})
