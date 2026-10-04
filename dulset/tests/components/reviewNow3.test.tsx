// Now 3 visual review: the hand-offs drawn on screen.
//  • the partner's 주기 tab gets his one shared window (cycleLens with cycle/pregnancy/cycleNotes)
//    and the same card with or without her records (N19);
//  • no frequency section and no estimate note for a partner on 날짜 없음 (positioning §6);
//  • the 평소 주 card never repeats the week block's header right below it;
//  • the link's weekly check-in rows read like the app's (N24), and its first-run card can be skipped from the top.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FertilityGuide from '@/components/cycle/FertilityGuide'
import LinkChecks from '@/components/link/LinkChecks'
import LinkIntro from '@/components/link/LinkIntro'
import { WEEK_BLOCK_TITLE, cardEyebrow } from '@/components/link/model'
import CycleTab from '@/components/tabs/CycleTab'
import TodayTab from '@/components/tabs/TodayTab'
import { ESTIMATE_DISCLAIMER } from '@/lib/content/fertility'
import type { SnapshotChecks, SnapshotMember } from '@/lib/logic/partnerSnapshot'
import type { AppState, ISODate, ShareLevel } from '@/lib/types'
import { demoState, pageText, renderApp } from '../setup'

const T0: ISODate = '2026-10-03' // inside the demo's 우리의 주간 (10월 1일 ~ 6일)
const USUAL: ISODate = '2026-10-15' // a 평소 주 day for a partner without her details
const PARTNER = 'a' as const
const OWNER = 'b' as const

function withLevel(s: AppState, shareLevel: ShareLevel): AppState {
  return { ...s, settings: { ...s.settings, shareLevel } }
}

afterEach(() => cleanup())

describe('the partner’s 주기 tab', () => {
  it('draws his one shared window on 우리의 주간 (cycleLens gets the cycle)', () => {
    renderApp(<CycleTab />, { state: withLevel(demoState(T0), 'week'), viewer: PARTNER, today: T0 })
    expect(pageText()).toContain('지금은 우리의 주간이에요 (예상)')
    // The demo tells him its latest start (period-told), so his window is hers — 10월 1일 ~ 6일.
    // (An untold early start would hold his where it was expected: tests/integrationNow3b.)
    expect(pageText()).toContain('10월 1일 (목) ~ 10월 6일 (화)')
    expect(pageText()).not.toContain('10월 3일 (토) ~ 10월 8일 (목)')
  })

  it('shows the same card before and after her first record — never a separate empty state', () => {
    const none = { ...withLevel(demoState(USUAL), 'week'), periods: [] }
    renderApp(<CycleTab />, { state: none, viewer: PARTNER, today: USUAL })
    const empty = pageText()
    expect(empty).not.toContain('아직 주기 기록이 없어요')
    expect(empty).toContain('편안한 날들이에요')
    cleanup()
    renderApp(<CycleTab />, { state: withLevel(demoState(T0), 'week'), viewer: PARTNER, today: USUAL })
    expect(pageText()).toContain('편안한 날들이에요')
  })

  it('on 날짜 없음: no frequency section and no estimate note for him; she keeps both', () => {
    renderApp(<CycleTab />, { state: withLevel(demoState(T0), 'none'), viewer: PARTNER, today: T0 })
    expect(pageText()).toContain('우리 리듬대로 지내요')
    expect(pageText()).not.toContain('얼마나 자주면 될까요?')
    expect(pageText()).not.toContain(ESTIMATE_DISCLAIMER)
    cleanup()
    renderApp(<CycleTab />, { state: withLevel(demoState(T0), 'none'), viewer: OWNER, today: T0 })
    expect(pageText()).toContain('얼마나 자주면 될까요?')
    expect(pageText()).toContain(ESTIMATE_DISCLAIMER)
  })

  it('FertilityGuide leaves the frequency section out for the partner only', () => {
    render(<FertilityGuide view="soft" ownerName="지은" owner={false} />)
    expect(screen.queryByText('얼마나 자주면 될까요?')).toBeNull()
    cleanup()
    render(<FertilityGuide view="soft" ownerName="지은" />)
    expect(screen.getByText('얼마나 자주면 될까요?')).toBeTruthy()
  })
})

describe('the 평소 주 card above the week block', () => {
  it('never prints “이번 주 우리 둘” twice in a row on his home', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: withLevel(demoState(T0), 'week'), viewer: PARTNER, today: USUAL })
    const card = screen.getByRole('region', { name: '오늘의 주기' })
    expect(within(card).getByText('이번 주도 둘이 함께해요')).toBeTruthy()
    expect(within(card).queryByText(WEEK_BLOCK_TITLE)).toBeNull()
    expect(within(card).getByText('오늘의 우리')).toBeTruthy()
    expect(screen.getByRole('region', { name: WEEK_BLOCK_TITLE })).toBeTruthy()
  })

  it('cardEyebrow only swaps the exact duplicate, and only with the week block below', () => {
    expect(cardEyebrow(WEEK_BLOCK_TITLE, true)).toBe('오늘의 우리')
    expect(cardEyebrow(WEEK_BLOCK_TITLE, false)).toBe(WEEK_BLOCK_TITLE)
    expect(cardEyebrow('기다리는 시간', true)).toBe('기다리는 시간')
    expect(cardEyebrow(undefined, true)).toBeUndefined()
  })
})

describe('the link', () => {
  const me: SnapshotMember = { id: PARTNER, name: '민수', emoji: '👨', role: 'husband' }
  const checks: SnapshotChecks = {
    items: [
      { id: 'walk', label: '30분 걷기', kind: 'habit', weekly: false, done: false },
      { id: 'drink', label: '금주', kind: 'habit', weekly: true, done: false },
    ],
    done: 0,
    total: 2,
    complete: false,
    week: 0,
  }

  it('weekly rows read ‘술 쉬기’ with the week’s question, like the app', () => {
    render(<LinkChecks me={me} her={false} checks={checks} onToggle={() => {}} />)
    const row = screen.getByRole('checkbox', { name: /술 쉬기/ })
    expect(row.textContent).toContain('이번 주 지켰어요? · 주 1회')
    expect(row.textContent).not.toContain('금주')
  })

  it('the first-run card can be skipped from its title row', () => {
    const onLater = vi.fn()
    const onSetup = vi.fn()
    render(<LinkIntro myName="민수" ownerName="지은" onSetup={onSetup} onLater={onLater} />)
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(onLater).toHaveBeenCalledTimes(1)
    expect(onSetup).not.toHaveBeenCalled()
  })
})
