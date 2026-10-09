// Final QA of 같이 챙길 것 (founder request 2026-10-09):
//  • his pregnant home never lists one of his own 내 준비 items (육아휴직 계획,
//    카시트 …) a second time in '이번 주 같이 챙길 것' — the link's same rule
//    (partnerSnapshot linkTogetherPlan);
//  • on his link the next visit shows once: the stage card says what he does
//    (the booked item's support line, as his day-before 🔔 does) with that
//    item's [같이 할게요], and 같이 챙길 것 leaves the row out.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LinkPage from '@/components/link/LinkPage'
import { LINK_INTRO_KEY } from '@/components/link/model'
import TodayTab from '@/components/tabs/TodayTab'
import { addDays } from '@/lib/dates'
import { PREGNANT_PREP_IDS, myPrep } from '@/lib/logic/myPrep'
import { makeLink } from '@/lib/logic/partnerLink'
import { applyPartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { partnerId } from '@/lib/logic/partnerTrack'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { supportKey, togetherItems } from '@/lib/logic/together'
import { MOCK_SYNC_KEY, createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import { resetTransport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, foundWords, pageText, renderApp } from '../setup'

const T0: ISODate = '2026-10-09'
const HIM = 'a' as const
const HER = 'b' as const

describe('his pregnant home at 29주: 내 준비 items are not in 이번 주 같이 챙길 것', () => {
  // 29주 2일: 육아휴직 계획 is open now and 카시트 opens in five days — both shared items of his 내 준비.
  const state = startPregnancy(demoState(T0), addDays(T0, -205), addDays(T0, -170))

  it('without the rule they would be on the card (the case is real)', () => {
    const all = togetherItems(state, T0, HIM, { whose: ['theirs', 'ours'] }).map((r) => r.id)
    expect(all.some((id) => PREGNANT_PREP_IDS.includes(id))).toBe(true)
    expect((myPrep(state, T0, HIM).items ?? []).length).toBeGreaterThan(0)
  })

  it('the card leaves them out and keeps up to three other rows', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: HIM, today: T0 })
    const card = document.querySelector('[data-together-card]') as HTMLElement
    expect(card).toBeTruthy()
    const ids = [...card.querySelectorAll('[data-together-row]')].map((r) => r.getAttribute('data-together-row')!)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.length).toBeLessThanOrEqual(3)
    for (const id of ids) expect(PREGNANT_PREP_IDS).not.toContain(id)
    // His 내 준비 still names what is next for him.
    expect(document.querySelector('[data-my-prep-chain]')?.textContent).toMatch(/다음은|챙겼어요/)
  })
})

// ── The link's stage card carries the visit's [같이 할게요]; the list doesn't repeat it ──

describe('/link — the next visit shows once: on the stage card, with its own [같이 할게요]', () => {
  const store = () => parseMockStore(window.localStorage.getItem(MOCK_SYNC_KEY))

  async function openLink(state: AppState, day: ISODate = T0) {
    const link = makeLink(null, `${day}T09:00:00+09:00`)
    const her = createMockTransport({ channel: null, now: () => `${day}T09:00:00+09:00`, offline: () => false })
    await her.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, day, partnerId(state))!)
    window.history.replaceState(null, '', `/link/?today=${day}#t=${link.token}`)
    render(<LinkPage />)
    return link
  }

  beforeEach(() => {
    resetTransport()
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
  })
  afterEach(() => resetTransport())

  it("her flu shot tomorrow (p1-flu): '내가 할 것 · 접종 날 같이 가기' + [같이 할게요] on the card, no p1-flu row below", async () => {
    // The pregnant demo: her flu shot tomorrow, booked for p1-flu (the same line his day-before 🔔 gives).
    const state = demoState(T0, 'pregnant')
    const link = await openLink(state)
    const card = await screen.findByRole('region', { name: '우리의 임신 주수' })
    const box = card.querySelector('[data-stage-checkup]') as HTMLElement
    expect(box.textContent).toContain('다음 병원 일정 · 내일')
    expect(box.textContent).toContain('내가 할 것 · 접종 날 같이 가기')
    expect(foundWords(pageText(), ['독감 접종 11:00', '동네 산부인과', '11:00'])).toEqual([])
    const list = screen.getByRole('region', { name: '같이 챙길 것' })
    expect(list.querySelector('[data-together-item="p1-flu"]')).toBeNull()
    // His tap on the card is the same 'support' event as a row's, and her phone keeps it.
    fireEvent.click(within(box).getByRole('button', { name: /같이 할게요$/ }))
    await waitFor(() => expect(within(box).getByText('같이 하기로 했어요')).toBeTruthy())
    const events = store().events[link.coupleId] ?? []
    const ev = events.map((e) => e.event).find((e) => e.kind === 'support')
    expect(ev).toMatchObject({ kind: 'support', itemId: 'p1-flu', on: true })
    const after = applyPartnerEvent(state, ev!, T0)
    expect(after.decisions[supportKey('p1-flu', HIM)]).toBe(T0)
  })

  it('a visit not booked for an item: the general line, no button on the card, the list unchanged', async () => {
    const s = demoState(T0, 'pregnant')
    const state = {
      ...s,
      appointments: [
        ...s.appointments.filter((a) => a.taskId !== 'p1-flu'),
        { id: 'qa-visit', date: addDays(T0, 1), title: 'QA_VISIT', who: HER, kind: 'hospital' as const, createdBy: HER },
      ],
    }
    await openLink(state)
    const box = (await screen.findByRole('region', { name: '우리의 임신 주수' })).querySelector('[data-stage-checkup]') as HTMLElement
    expect(box.textContent).toContain('같이 갈 수 있으면 시간 비워 두기')
    expect(within(box).queryByRole('button', { name: /같이 할게요$/ })).toBeNull()
    const ids = [...screen.getByRole('region', { name: '같이 챙길 것' }).querySelectorAll('[data-together-item]')].map((r) =>
      r.getAttribute('data-together-item'),
    )
    expect(ids.length).toBeGreaterThan(0)
  })
})
