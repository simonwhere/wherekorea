// N27 on the first run: the welcome says the one line and its sub-copy, offers
// only the preparing example (임신 중 · 육아 중 moved to 설정 › 정보), ① no longer
// asks for 처음 만난 날 (the 기록장 does), and the cover-photo question waits
// until the partner's link has gone out.

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import Onboarding from '@/components/Onboarding'
import { WELCOME_LINE, WELCOME_SUB } from '@/components/onboarding/WelcomeStep'
import { COVER_ASKED_KEY } from '@/components/onboarding/coverAskAfterLink'
import { addDays } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import { renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-04'
/** components/cover/coverAskFlag's sessionStorage copy of the one-time question. */
const ASK_COVER_FLAG = 'dulset:ask-cover'

const next = () => fireEvent.click(screen.getByRole('button', { name: '다음' }))

function start() {
  const probe = stateProbe()
  renderApp(
    <>
      <Onboarding />
      <probe.Probe />
    </>,
    { state: null, viewer: 'a', today: T0 },
  )
  return probe
}

/** ① → ② → ③ with the least input, ending on ④. */
function walkToInvite() {
  fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
  const me = screen.getByRole('group', { name: '나' })
  fireEvent.change(within(me).getByLabelText(/이름 또는 애칭/), { target: { value: '지은' } })
  fireEvent.click(within(me).getByRole('button', { name: '아내' }))
  const other = screen.getByRole('group', { name: '함께하는 사람' })
  fireEvent.change(within(other).getByLabelText(/이름 또는 애칭/), { target: { value: '민수' } })
  next()
  fireEvent.click(screen.getByRole('button', { name: /^1주 전/ }))
  next()
  fireEvent.click(screen.getByRole('checkbox', { name: /개인정보 수집·이용에 동의해요/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /민감정보/ }))
  fireEvent.click(screen.getByRole('button', { name: '동의하고 계속하기' }))
  expect(screen.getByRole('heading', { level: 1, name: /준비됐어요/ })).toBeTruthy()
}

// jsdom has no share sheet; the test that sends the link puts one in (the real one resolves once shared).
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
})

describe('Onboarding · N27', () => {
  it('the welcome says the one line with its sub-copy and offers only the preparing example', () => {
    start()
    expect(WELCOME_LINE).toBe('남편이 같이 하는 임신 준비')
    expect(WELCOME_SUB).toContain('부부·예비부부·사실혼, 함께 준비하는 두 사람 누구나')
    expect(screen.getByText(WELCOME_LINE)).toBeTruthy()
    expect(screen.getByText(WELCOME_SUB)).toBeTruthy()
    const demo = screen.getByRole('region', { name: '예시로 둘러보기' })
    const buttons = within(demo).getAllByRole('button')
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['준비 중 예시 보기'])
    expect(screen.queryByRole('button', { name: /임신 중/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /육아 중/ })).toBeNull()
    // The four value rows are gone.
    expect(screen.queryByText('가임기 예상을 두 사람에게')).toBeNull()
  })

  it('① asks names, roles and who records — no 처음 만난 날, and the state starts without couple dates', () => {
    const probe = start()
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(screen.queryByLabelText(/처음 만난 날/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    walkToInvite()
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    const s = probe.current.state!
    expect(s.onboarded).toBe(true)
    expect(s.periods.map((p) => p.start)).toEqual([addDays(T0, -7)])
    expect(s.couple.metDate).toBeUndefined()
    expect(s.couple.marriedDate).toBeUndefined()
  })

  it('no cover question when the link was not sent', () => {
    const probe = start()
    walkToInvite()
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(probe.current.state?.onboarded).toBe(true)
    expect(window.sessionStorage.getItem(ASK_COVER_FLAG)).toBeNull()
    expect(window.localStorage.getItem(COVER_ASKED_KEY)).toBeNull()
  })

  it('the cover question is queued once the link went out in ④', async () => {
    Object.defineProperty(navigator, 'share', { value: async () => {}, configurable: true, writable: true })
    const probe = start()
    walkToInvite()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '카톡으로 링크 보내기' }))
    })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('보냈어요'))
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(probe.current.state?.onboarded).toBe(true)
    expect(window.sessionStorage.getItem(ASK_COVER_FLAG)).toBe('1')
    expect(window.localStorage.getItem(COVER_ASKED_KEY)).toBe('1')
  })
})
