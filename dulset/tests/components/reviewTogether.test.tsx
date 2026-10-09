// Visual/UX review of 같이 챙길 것 (founder request 2026-10-09: "여자가 챙겨야 할
// 것들을 남자에게도 계속 보여줘야해 같이 하는거야").
//
//  • His '+ 기록' while pregnant: the bar's center button is his '했어요' sheet
//    (this week's pick, today's checks, signals) — the same loop as preparing.
//    Her pregnant bar stays four tabs.
//  • His pregnant home: his 이번 달 할 일 (a shared item such as 분만 병원 정하기)
//    in 우리 한 줄, as on his link — and never a second time in 이번 주 같이 챙길 것.
//  • The 42 quiet days after a loss: 챙길 것 shows no support line, no
//    [같이 할게요] and no '민수님이 같이 챙긴대요' on either screen.
//  • The toast's hide timer goes with its provider.

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppShell from '@/components/AppShell'
import PlanTab from '@/components/tabs/PlanTab'
import TodayTab from '@/components/tabs/TodayTab'
import { ToastProvider, useToast } from '@/components/ui'
import { addDays } from '@/lib/dates'
import { monthlyTask } from '@/lib/logic/partnerTrack'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { supportItem, supportKey, togetherItems } from '@/lib/logic/together'
import { weekQuiet } from '@/lib/logic/weekTogether'
import { StoreProvider } from '@/lib/store'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, renderApp, seedApp } from '../setup'

const T0: ISODate = '2026-10-09'
const HIM = 'a' as const
const HER = 'b' as const

const nav = () => screen.getByRole('navigation', { name: '주요 메뉴' })

async function renderShell(state: AppState, viewer: 'a' | 'b') {
  seedApp({ state, viewer, today: T0 })
  render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  )
  await screen.findByRole('navigation', { name: '주요 메뉴' })
}

describe("the pregnant tab bar: his '+ 기록' is the '했어요' sheet", () => {
  it('his bar has the center button and it opens his week, checks and signals', async () => {
    await renderShell(demoState(T0, 'pregnant'), HIM)
    const plus = within(nav()).getByRole('button', { name: '기록하기' })
    // 오늘 · 임신 · [+] · 챙길 것 · 우리
    const labels = within(nav())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim())
    expect(labels).toEqual(['오늘', '임신', '기록하기', '챙길 것', '우리'])
    fireEvent.click(plus)
    const dialog = await screen.findByRole('dialog', { name: '기록하기' })
    expect(dialog.textContent).toContain('이번 주 우리 둘')
    expect(dialog.textContent).toContain('신호 보내기')
  })

  it('her pregnant bar stays four tabs', async () => {
    await renderShell(demoState(T0, 'pregnant'), HER)
    expect(within(nav()).queryByRole('button', { name: '기록하기' })).toBeNull()
    expect(within(nav()).getAllByRole('button')).toHaveLength(4)
  })

  it('preparing keeps the button (her bar too)', async () => {
    await renderShell(demoState(T0), HER)
    expect(within(nav()).getByRole('button', { name: '기록하기' })).toBeTruthy()
  })

  it('parenting: no center button for him either', async () => {
    await renderShell(demoState(T0, 'parenting'), HIM)
    expect(within(nav()).queryByRole('button', { name: '기록하기' })).toBeNull()
  })
})

describe('his pregnant home: 이번 달 할 일 in 우리 한 줄, once', () => {
  it('shows his month task in 우리 한 줄 and leaves it out of 이번 주 같이 챙길 것', () => {
    const state = demoState(T0, 'pregnant')
    const task = monthlyTask(state, T0, HIM)
    expect(task).toBeTruthy()
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: HIM, today: T0 })
    const us = document.getElementById('us-line')!
    expect(us.textContent).toContain('이번 달 할 일')
    expect(us.textContent).toContain(task!.title)
    const card = document.querySelector('[data-together-card]') as HTMLElement
    expect(card).toBeTruthy()
    const ids = [...card.querySelectorAll('[data-together-row]')].map((r) => r.getAttribute('data-together-row'))
    expect(ids).not.toContain(task!.id)
    // The next row takes its place: still up to three rows, in togetherItems' order minus the task.
    const expected = togetherItems(state, T0, HIM, { whose: ['theirs', 'ours'], exclude: [task!.id], limit: 3 }).map((r) => r.id)
    expect(ids).toEqual(expected)
  })

  it('her pregnant home has no month task line (it is his)', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0, 'pregnant'), viewer: HER, today: T0 })
    expect(document.getElementById('us-line')!.textContent).not.toContain('이번 달 할 일')
  })

  it('a shared row with no day yet reads 예정, never a bare row', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0, 'pregnant'), viewer: HIM, today: T0 })
    const card = document.querySelector('[data-together-card]') as HTMLElement
    for (const row of card.querySelectorAll('[data-together-row]')) {
      expect(row.querySelector('[data-together-label]')?.textContent?.trim()).toBeTruthy()
    }
  })
})

describe('챙길 것 in the 42 quiet days after a loss', () => {
  /** He said [같이 할게요] to one of her items, then the pregnancy ended yesterday. */
  function quietWithSupport(): AppState {
    const prep = supportItem(demoState(T0), HIM, 'pre-checkup-carrier', addDays(T0, -60))
    expect(prep.decisions?.[supportKey('pre-checkup-carrier', HIM)]).toBeTruthy()
    const pregnant = startPregnancy(prep, addDays(T0, -50), addDays(T0, -15))
    const quiet = endPregnancy(pregnant, addDays(T0, -1))
    expect(weekQuiet(quiet, T0)).toBe(true)
    return quiet
  }

  it('his rows carry no support line and no [같이 할게요]', () => {
    renderApp(<PlanTab />, { state: quietWithSupport(), viewer: HIM, today: T0 })
    expect(document.querySelectorAll('[data-plan-row]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-support-line]')).toBeNull()
    expect(document.querySelector('[data-support-button]')).toBeNull()
  })

  it("her rows don't say '민수님이 같이 챙긴대요'", () => {
    renderApp(<PlanTab />, { state: quietWithSupport(), viewer: HER, today: T0 })
    expect(document.querySelector('[data-supported-by]')).toBeNull()
    expect(document.body.textContent).not.toContain('같이 챙긴대요')
  })

  it('outside the quiet the same rows carry them (control)', () => {
    const state = supportItem(demoState(T0), HIM, 'pre-checkup-carrier', T0)
    renderApp(<PlanTab />, { state, viewer: HER, today: T0 })
    expect(document.querySelector('[data-supported-by]')).toBeTruthy()
  })
})

describe('toast timer', () => {
  it('clears its hide timer when the provider unmounts', () => {
    vi.useFakeTimers()
    try {
      let show: (t: string) => void = () => {}
      function Grab() {
        show = useToast().show
        return null
      }
      const view = render(
        <ToastProvider>
          <Grab />
        </ToastProvider>,
      )
      act(() => show('같이 챙길게요'))
      expect(vi.getTimerCount()).toBe(1)
      view.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
