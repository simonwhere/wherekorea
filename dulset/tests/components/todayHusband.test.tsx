// Now 3 N29–N30 on the home and the sheet:
//  • his '내 준비' bar sits right under '이번 주 우리 둘' (out of 더 보기);
//  • a moment she TOLD carries 해 줄 말 · 아껴 둘 말 and two answers he sends
//    with one tap ('보냈어요' after); her signal to him carries the two lines;
//  • her 메모 keeps 오늘 컨디션 behind '자세히';
//  • her home has no 'LH 기록' action unless she said '써요' and the window is on.

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogSheet from '@/components/log/LogSheet'
import TodayTab from '@/components/tabs/TodayTab'
import CycleBlock from '@/components/today/CycleBlock'
import { addDays } from '@/lib/dates'
import { logPeriodStart } from '@/lib/logic/logs'
import { setUsesLH } from '@/lib/logic/prefs'
import { sendSignal } from '@/lib/logic/signals'
import { tellPartnerPeriod, ttcMoment } from '@/lib/logic/ttcFlow'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp, seedApp, stateProbe, withProviders } from '../setup'

const T0: ISODate = '2026-10-03'
const PARTNER = 'a' as const
const OWNER = 'b' as const

describe('his 내 준비 bar (N30)', () => {
  it('sits on his home under 이번 주 우리 둘 — not inside 더 보기 — and never on hers', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    const bar = screen.getByRole('region', { name: '내 준비' })
    expect(bar.textContent).toMatch(/생활 습관|이번 주 \d\/7|신청|검사|청구/)
    expect(bar.textContent).not.toMatch(/0\/7|안 했어요|시작 전/)
    const week = screen.getByRole('region', { name: '이번 주 우리 둘' })
    // Right after the week block in the page order, and not a second 내 준비 line inside it.
    expect(week.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(week.textContent).not.toContain('내 준비')
  })

  it('is not on her home', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    expect(screen.queryByRole('region', { name: '내 준비' })).toBeNull()
  })
})

describe("what she told: 해 줄 말 · 아껴 둘 말 and two answers (N30)", () => {
  function toldState(): { state: AppState; day: ISODate } {
    const day = '2026-10-10'
    let s = logPeriodStart(demoState(day), day, OWNER, day)
    s = tellPartnerPeriod(s, day, `${day}T08:00:00+09:00`)
    return { state: s, day }
  }

  it('shows the two lines and answers on his told card; one tap sends it and the card says so', () => {
    const { state, day } = toldState()
    const probe = stateProbe()
    seedApp({ state, viewer: PARTNER, today: day })
    const m = ttcMoment(state, day, PARTNER)!
    expect(m.copy).toBe('partner.period-told')
    render(
      withProviders(
        <>
          <CycleBlock moment={m} onNavigate={() => {}} />
          <probe.Probe />
        </>,
      ),
    )
    const box = document.querySelector('[data-told-say]') as HTMLElement
    expect(box.textContent).toContain('해 줄 말')
    expect(box.textContent).toContain('아껴 둘 말')
    // The tip that says the same is not repeated.
    expect(pageText()).not.toContain('오늘 해 줄 수 있는 것')
    const answers = within(box).getAllByRole('button')
    expect(answers.map((b) => b.textContent?.trim())).toEqual(['🫂 옆에 있을게요', '🍳 오늘 저녁은 내가 할게요'])
    fireEvent.click(answers[1]!)
    const sent = probe.current.state!.notifications.find((n) => n.key?.startsWith('signal:dinner-mine:') && n.from === PARTNER)
    expect(sent).toMatchObject({ to: OWNER })
  })

  it('her card never carries them', () => {
    const { state, day } = toldState()
    renderApp(<CycleBlock moment={ttcMoment(state, day, OWNER)!} onNavigate={() => {}} />, { state, viewer: OWNER, today: day })
    expect(document.querySelector('[data-told-say]')).toBeNull()
  })

  it('her signal to him comes with the two lines over the replies; his to her does not', () => {
    const s = sendSignal(demoState(T0), OWNER, PARTNER, 'comfort', T0, `${T0}T09:00:00+09:00`)
    renderApp(<TodayTab onNavigate={() => {}} />, { state: s, viewer: PARTNER, today: T0 })
    const lines = document.querySelector('[data-say-lines]') as HTMLElement
    expect(lines.textContent).toContain('‘옆에 있을게’가 먼저예요')
    expect(lines.textContent).toContain('아껴 둘 말')
  })
})

describe("her 메모: 오늘 컨디션 behind '자세히' (N29)", () => {
  it('folded by default; one tap opens the chips, and a saved one shows on the toggle', () => {
    renderApp(<LogSheet request={{ kind: 'note', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    expect(within(dialog).queryByRole('group', { name: '오늘 컨디션' })).toBeNull()
    const toggle = within(dialog).getByRole('button', { name: /자세히/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    const chips = within(dialog).getByRole('group', { name: '오늘 컨디션' })
    fireEvent.click(within(chips).getByRole('button', { name: '피곤해요' }))
    expect(toggle.textContent).toContain('피곤해요')
  })

  it('his 메모 has no 자세히 (her own log only)', () => {
    renderApp(<LogSheet request={{ kind: 'note', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    expect(within(screen.getByRole('dialog', { name: '기록하기' })).queryByRole('button', { name: /자세히/ })).toBeNull()
  })
})

describe("her home: 'LH 기록' only for 써요, inside the window (N29)", () => {
  it('no LH action before the window or without 써요; inside it with 써요, there it is', () => {
    const s = demoState(T0)
    // Walk a cycle: whatever the day, an LH action needs 써요 and the window.
    for (let i = 0; i < 30; i++) {
      const d = addDays(T0, i)
      const unanswered = ttcMoment(setUsesLH(s, undefined, OWNER), d, OWNER)
      expect(unanswered?.primary?.type === 'log' && unanswered.primary.kind === 'lh', d).toBe(false)
      expect(unanswered?.primary?.label, d).not.toBe('오늘 컨디션')
      const uses = ttcMoment(setUsesLH(s, true, OWNER), d, OWNER)
      if (uses?.primary?.type === 'log' && uses.primary.kind === 'lh') expect(['owner.fertile', 'owner.tww-no-surge'], d).toContain(uses.copy)
    }
  })
})
