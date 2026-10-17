// One wording for a pressed [같이 할게요] (founder decision 2026-10-17, "추천대로
// 1~3번 다 진행해줘" — 3). The app used to show a pressed pill '✓ 같이 할게요'
// while the link said '같이 하기로 했어요 · 취소'; now every surface draws a
// check + '같이 하기로 했어요' and a separate small [취소], from one module
// (lib/content/supportCopy): his home's 같이 챙길 것, 챙길 것 rows, the 임신 tab's
// 검사 일정 and the link's toggle. [취소] takes his answer back and the toast
// says '같이 하기를 취소했어요' on both.
//
// The demo couple: 민수 'a' (함께하는 사람) · 지은 'b' (records the cycle).

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SupportToggle } from '@/components/link/LinkTogether'
import SupportButton from '@/components/plan/SupportButton'
import PlanTab from '@/components/tabs/PlanTab'
import PregnancyTab from '@/components/tabs/PregnancyTab'
import TodayTab from '@/components/tabs/TodayTab'
import { templateById } from '@/lib/content/roadmap'
import { SUPPORT_CANCEL, SUPPORT_LABEL, SUPPORT_PRESSED, SUPPORT_TOAST_OFF } from '@/lib/content/supportCopy'
import { isSupported, shortTitle, supportItem, togetherItems, type LinkTogetherItem } from '@/lib/logic/together'
import type { ISODate } from '@/lib/types'
import { demoState, renderApp, seedApp, stateProbe, withProviders } from '../setup'

const T0: ISODate = '2026-10-09'
const HIM = 'a' as const

afterEach(() => cleanup())

/** The said state inside `box`: its line (role=status) and its [취소]. */
function said(box: HTMLElement) {
  const status = within(box).getByRole('status')
  const cancel = within(box).getByRole('button', { name: /같이 하기 취소$/ })
  return { status, cancel }
}

/** The said state reads the same everywhere: a check, '같이 하기로 했어요', and a separate [취소] (not inside the line). */
function expectSaid(box: HTMLElement, short: string) {
  const { status, cancel } = said(box)
  expect(status.textContent).toBe(SUPPORT_PRESSED)
  expect(status.querySelector('svg')).toBeTruthy()
  expect(cancel.textContent).toBe(SUPPORT_CANCEL)
  expect(cancel.getAttribute('aria-label')).toBe(`‘${short}’ 같이 하기 취소`)
  expect(status.contains(cancel)).toBe(false)
  // No pressed pill any more: no aria-pressed, no '같이 할게요' button beside it.
  expect(box.querySelector('[aria-pressed]')).toBeNull()
  expect(within(box).queryByRole('button', { name: /같이 할게요$/ })).toBeNull()
  expect(box.textContent).not.toContain('같이 할게요 ✓')
}

describe('his home · 같이 챙길 것', () => {
  it('[같이 할게요] → ‘같이 하기로 했어요’ + [취소]; [취소] takes it back and says 같이 하기를 취소했어요', () => {
    const probe = stateProbe()
    const state = demoState(T0)
    const first = togetherItems(state, T0, HIM, { whose: ['theirs'], limit: 3 })[0]!
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state, viewer: HIM, today: T0 },
    )
    const row = document.querySelector(`[data-together-row="${first.id}"]`) as HTMLElement
    const offer = within(row).getByRole('button', { name: `‘${first.short}’ 같이 할게요` })
    expect(offer.textContent).toBe(SUPPORT_LABEL)

    fireEvent.click(offer)
    expect(isSupported(probe.current.state!, first.id, HIM)).toBe(true)
    expectSaid(row, first.short)
    expect(screen.getByText('같이 하기로 했어요 · 지은님 화면에도 보여요')).toBeTruthy()
    // Focus follows the tap to what replaced the button.
    expect(document.activeElement).toBe(said(row).cancel)

    fireEvent.click(said(row).cancel)
    expect(isSupported(probe.current.state!, first.id, HIM)).toBe(false)
    expect(screen.getByText(SUPPORT_TOAST_OFF)).toBeTruthy()
    expect(document.body.textContent).not.toContain('거뒀어요')
    const back = within(row).getByRole('button', { name: `‘${first.short}’ 같이 할게요` })
    expect(document.activeElement).toBe(back)
    expect(within(row).queryByRole('status')).toBeNull()
  })

  it('the said state drops under the row text (its own grid row), the button stays in the right column', () => {
    const state = demoState(T0)
    const first = togetherItems(state, T0, HIM, { whose: ['theirs'], limit: 3 })[0]!
    renderApp(<TodayTab onNavigate={() => {}} />, { state: supportItem(state, HIM, first.id, T0), viewer: HIM, today: T0 })
    const row = document.querySelector(`[data-together-row="${first.id}"]`) as HTMLElement
    const box = row.querySelector('[data-support-said]') as HTMLElement
    expect(box.parentElement).toBe(row)
    expect(box.className).toMatch(/\brow-start-2\b/)
    expect(box.className).toMatch(/\bcol-start-2\b/)
  })
})

describe('챙길 것 rows and the 임신 tab’s 검사 일정', () => {
  it('his 챙길 것: her row reads ‘같이 하기로 했어요’ + [취소]; [취소] removes his answer', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <PlanTab />
        <probe.Probe />
      </>,
      { state: supportItem(demoState(T0), HIM, 'pre-checkup-carrier', T0), viewer: HIM, today: T0 },
    )
    const row = document.querySelector('[data-plan-row="pre-checkup-carrier"]') as HTMLElement
    const line = row.querySelector('[data-support-line]') as HTMLElement
    expect(line.textContent).toContain('검사 날 같이 가기')
    expectSaid(line, '임신 전 기본 검사')
    fireEvent.click(said(line).cancel)
    expect(isSupported(probe.current.state!, 'pre-checkup-carrier', HIM)).toBe(false)
    expect(screen.getByText(SUPPORT_TOAST_OFF)).toBeTruthy()
    expect(within(row).getByRole('button', { name: '‘임신 전 기본 검사’ 같이 할게요' })).toBeTruthy()
  })

  it('his 임신 tab: the NT row reads the same, [취소] works there too', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <PregnancyTab />
        <probe.Probe />
      </>,
      { state: supportItem(demoState(T0, 'pregnant'), HIM, 'p1-nt', T0), viewer: HIM, today: T0 },
    )
    const nt = screen.getByText(/목덜미투명대\(NT\) 초음파/).closest('li') as HTMLElement
    expectSaid(nt, 'NT(목덜미 투명대)')
    fireEvent.click(said(nt).cancel)
    expect(isSupported(probe.current.state!, 'p1-nt', HIM)).toBe(false)
    expect(screen.getByText(SUPPORT_TOAST_OFF)).toBeTruthy()
    expect(within(nt).getByRole('button', { name: '‘NT(목덜미 투명대)’ 같이 할게요' })).toBeTruthy()
  })
})

describe('the app button and the link toggle say the same thing', () => {
  const id = 'pre-checkup-carrier'
  const t = templateById(id)!
  const short = shortTitle(t.title)
  const item = (supported: boolean): LinkTogetherItem => ({
    id,
    title: t.title,
    kind: t.kind,
    whose: 'theirs',
    status: 'upcoming',
    label: '예정',
    support: t.support!,
    supported,
    canSupport: true,
  })

  function both(supported: boolean) {
    seedApp({ state: demoState(T0), viewer: HIM, today: T0 })
    render(
      withProviders(
        <>
          <div data-testid="app">
            <SupportButton itemId={id} short={short} supported={supported} canSupport />
          </div>
          <div data-testid="link">
            <SupportToggle item={item(supported)} onSupport={() => {}} />
          </div>
        </>,
      ),
    )
    act(() => {})
    return { app: screen.getByTestId('app'), link: screen.getByTestId('link') }
  }

  it('said: the same line, the same [취소], the same accessible name', () => {
    const { app, link } = both(true)
    const a = said(app)
    const l = said(link)
    expect(a.status.textContent).toBe(SUPPORT_PRESSED)
    expect(l.status.textContent).toBe(a.status.textContent)
    expect(l.cancel.textContent).toBe(a.cancel.textContent)
    expect(l.cancel.getAttribute('aria-label')).toBe(a.cancel.getAttribute('aria-label'))
    expect(a.cancel.getAttribute('aria-label')).toBe('‘임신 전 기본 검사’ 같이 하기 취소')
  })

  it('not said: [+ 같이 할게요] on both, with the same accessible name', () => {
    const { app, link } = both(false)
    const a = within(app).getByRole('button')
    const l = within(link).getByRole('button')
    expect(a.textContent).toBe(SUPPORT_LABEL)
    expect(l.textContent).toBe(a.textContent)
    expect(l.getAttribute('aria-label')).toBe(a.getAttribute('aria-label'))
    expect(a.getAttribute('aria-label')).toBe('‘임신 전 기본 검사’ 같이 할게요')
    expect(a.querySelector('svg') && l.querySelector('svg')).toBeTruthy()
  })
})

describe('the link toggle: focus follows the tap, like the app button', () => {
  it('[같이 할게요] → focus on [취소] → back on [같이 할게요]', () => {
    const t = templateById('pre-checkup-carrier')!
    const base: LinkTogetherItem = {
      id: t.id,
      title: t.title,
      kind: t.kind,
      whose: 'theirs',
      status: 'upcoming',
      label: '예정',
      support: t.support!,
      supported: false,
      canSupport: true,
    }
    function Harness() {
      const [on, setOn] = useState(false)
      return <SupportToggle item={{ ...base, supported: on }} onSupport={(_, v) => setOn(v)} />
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '‘임신 전 기본 검사’ 같이 할게요' }))
    expect(screen.getByRole('status').textContent).toBe(SUPPORT_PRESSED)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '‘임신 전 기본 검사’ 같이 하기 취소' }))
    fireEvent.click(screen.getByRole('button', { name: '‘임신 전 기본 검사’ 같이 하기 취소' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '‘임신 전 기본 검사’ 같이 할게요' }))
  })
})

describe('SupportButton when [같이 할게요] cannot be said (the quiet after a loss, togetherRow.canSupport)', () => {
  function one(props: { supported: boolean; canSupport: boolean; done?: boolean }) {
    seedApp({ state: demoState(T0), viewer: HIM, today: T0 })
    render(withProviders(<SupportButton itemId="pre-checkup-carrier" short="임신 전 기본 검사" {...props} />))
    act(() => {})
  }

  it('nothing to offer → nothing drawn', () => {
    one({ supported: false, canSupport: false })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('already said → the line and its [취소] stay, so he can still take it back', () => {
    one({ supported: true, canSupport: false })
    expect(screen.getByRole('status').textContent).toBe(SUPPORT_PRESSED)
    expect(screen.getByRole('button', { name: '‘임신 전 기본 검사’ 같이 하기 취소' })).toBeTruthy()
  })

  it('a done item → nothing, said or not', () => {
    one({ supported: true, canSupport: true, done: true })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
