// The partner page (/link) rendered in jsdom over the real mock transport
// (window.localStorage): the seven-day snapshot drawn for the page's own date,
// the first-run card and its 'setup' event (N22), '이번 주 우리 둘' and its
// 'week-pick' event (N21), the calm view after the week (N20), the home-screen
// card and the 카카오톡 hint, the '링크 연 날' counter, and the read-only
// preview for 설정 › 연결 (N23). Nothing is mocked but the browser's UA.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LinkPage from '@/components/link/LinkPage'
import LinkPreview from '@/components/link/LinkPreview'
import { LINK_INSTALL_KEY, LINK_INTRO_KEY } from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { makeLink } from '@/lib/logic/partnerLink'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { partnerId } from '@/lib/logic/partnerTrack'
import { setShareLevel } from '@/lib/logic/prefs'
import { MOCK_SYNC_KEY, createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import { resetTransport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, foundWords, pageText } from '../setup'

const MONDAY: ISODate = '2026-10-05'
const REAL_UA = navigator.userAgent

/** The demo couple on a Monday with nothing picked yet this week (the demo picks on its own Monday). */
function mondayState(): AppState {
  const s = demoState(MONDAY)
  return { ...s, decisions: Object.fromEntries(Object.entries(s.decisions).filter(([k]) => !k.startsWith('week-'))) }
}

/** Her phone publishes `state`'s snapshot built on `builtOn`; the page opens on `opensOn` with the link's hash. */
async function openLink(state: AppState, builtOn: ISODate, opensOn: ISODate = builtOn) {
  const link = makeLink(null, `${builtOn}T09:00:00+09:00`)
  const her = createMockTransport({ channel: null, now: () => `${builtOn}T09:00:00+09:00` })
  await her.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, builtOn, partnerId(state))!)
  window.history.replaceState(null, '', `/link/?today=${opensOn}#t=${link.token}`)
  render(<LinkPage />)
  return link
}

const store = () => parseMockStore(window.localStorage.getItem(MOCK_SYNC_KEY))

function setUA(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

beforeEach(() => {
  resetTransport()
  setUA(REAL_UA)
})
afterEach(() => {
  resetTransport()
  setUA(REAL_UA)
})

describe('/link — the page for its own date, the first 30 seconds, the week', () => {
  it('shows the first-run card once per device; setup sends only what he answered', async () => {
    const link = await openLink(mondayState(), MONDAY)
    expect(await screen.findByText('민수님, 처음이죠?')).toBeTruthy()
    expect(pageText()).toContain('지은님이 고른 것만 보여요')
    fireEvent.click(screen.getByRole('button', { name: '안 피워요' }))
    fireEvent.click(screen.getByRole('button', { name: '‘우리의 주간’처럼 은근하게' }))
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작하기' }))
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'setup')).toBe(true))
    const setup = store().events[link.coupleId]!.find((r) => r.event.kind === 'setup')!.event
    expect(setup).toMatchObject({ kind: 'setup', habits: { smokes: false }, alertStyle: 'soft' })
    expect('drinks' in (setup as { habits: object }).habits).toBe(false)
    await waitFor(() => expect(screen.queryByText('민수님, 처음이죠?')).toBeNull())
    expect(window.localStorage.getItem(LINK_INTRO_KEY)).toContain('"at"')
  })

  it('draws 이번 주 우리 둘: three picks, a tap sends week-pick with ids and a date, [했어요] follows', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    const link = await openLink(mondayState(), MONDAY)
    const week = await screen.findByRole('region', { name: '이번 주 우리 둘' })
    const options = week.querySelectorAll('[data-week-option]')
    expect(options).toHaveLength(3)
    expect(pageText()).toContain('고른 건 지은님에게 보이지 않고')
    fireEvent.click(options[1]!)
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'week-pick')).toBe(true))
    const pick = store().events[link.coupleId]!.find((r) => r.event.kind === 'week-pick')!.event
    expect(Object.keys(pick).sort()).toEqual(['date', 'from', 'id', 'kind', 'optionId'])
    expect(pick).toMatchObject({ date: MONDAY, optionId: options[1]!.getAttribute('data-week-option') })
    // The pick shows at once (a local mark) with its [했어요].
    const done = await screen.findByRole('button', { name: '했어요' })
    fireEvent.click(done)
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'week-done')).toBe(true))
    expect(await screen.findByText(/이번 주 하나를 했어요/)).toBeTruthy()
  })

  it('a later day of the week is drawn from the same snapshot; no cycle record word reaches the page', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    const s = setShareLevel(mondayState(), 'b', 'week')
    await openLink(s, MONDAY, addDays(MONDAY, 3))
    await screen.findByRole('region', { name: '이번 주 우리 둘' })
    expect(pageText()).toContain('10월 8일')
    expect(foundWords(pageText(), ['생리', 'LH', '배테기', '임테기', '양성', '음성', '나만 보기', '오늘 컨디션'])).toEqual([])
  })

  it('after the week it carries, the calm view: no burden on her, signals and 응원 still there', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    await openLink(mondayState(), MONDAY, addDays(MONDAY, 9))
    expect(await screen.findByText('새 화면은 곧 채워져요')).toBeTruthy()
    expect(pageText()).toContain('지은님 폰이 열리면 다시 채워져요')
    expect(pageText()).not.toMatch(/쉬고 있어요|앱을 열면/)
    expect(screen.getByRole('button', { name: '지은님에게 응원 보내기' })).toBeTruthy()
    expect(document.querySelectorAll('[data-signal]').length).toBeGreaterThan(0)
    // Nothing dated: no checks, no week, no card.
    expect(document.querySelector('[data-check]')).toBeNull()
    expect(screen.queryByRole('region', { name: '이번 주 우리 둘' })).toBeNull()
  })

  it('records 링크 연 날 once for the day, under the couple — the token only went out', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    const link = await openLink(mondayState(), MONDAY)
    await screen.findByRole('region', { name: '이번 주 우리 둘' })
    await waitFor(() => expect(store().opens[link.coupleId]).toEqual({ [MONDAY]: 1 }))
    expect(JSON.stringify(store().opens)).not.toContain(link.token)
  })

  it('a real browser gets the closable home-screen card; 카카오톡 gets ‘사파리/크롬으로 열기’ instead', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    await openLink(mondayState(), MONDAY)
    const card = await screen.findByRole('complementary', { name: '홈 화면에 두기' })
    expect(card.textContent).toContain('홈 화면에 두면 다시 열기 쉬워요')
    fireEvent.click(screen.getByRole('button', { name: '홈 화면 안내 닫기' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: '홈 화면에 두기' })).toBeNull())
    expect(window.localStorage.getItem(LINK_INSTALL_KEY)).toContain('"at"')
  })

  it('inside 카카오톡: the way out keeps the whole address', async () => {
    window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.1')
    await openLink(mondayState(), MONDAY)
    const hint = await screen.findByRole('complementary', { name: '사파리나 크롬으로 열기' })
    expect(hint.textContent).toContain('카카오톡 안에서 열었어요')
    const a = screen.getByRole('link', { name: '사파리/크롬으로 열기' })
    expect(decodeURIComponent(a.getAttribute('href')!.split('url=')[1]!)).toBe(window.location.href)
    expect(screen.queryByRole('complementary', { name: '홈 화면에 두기' })).toBeNull()
  })
})

describe('LinkPreview (설정 › 연결 · 민수님 화면 미리보기)', () => {
  it('draws the same page, read-only, without the first-run card or any transport', async () => {
    const s = mondayState()
    const snap = buildPartnerSnapshot(s, MONDAY, partnerId(s))!
    await act(async () => {
      render(<LinkPreview snapshot={snap} today={MONDAY} />)
    })
    const root = document.querySelector('[aria-label="민수님 화면 미리보기"]')!
    expect(root).toBeTruthy()
    expect(root.hasAttribute('inert')).toBe(true)
    expect(pageText()).toContain('이번 주 우리 둘')
    expect(pageText()).not.toContain('처음이죠?')
    expect(pageText()).toContain('미리보기예요')
    expect(window.localStorage.getItem(MOCK_SYNC_KEY)).toBeNull()
  })
})
