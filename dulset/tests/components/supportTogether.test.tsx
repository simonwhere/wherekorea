// 같이 챙길 것 on the app screens (founder request 2026-10-09: "여자가 챙겨야 할
// 것들을 남자에게도 계속 보여줘야해 같이 하는거야").
//
// The demo couple: 민수 'a' (함께하는 사람) · 지은 'b' (records the cycle, carries
// the pregnancy). His screens show her roadmap items with a neutral status and
// what he can do (the support line) + [같이 할게요]; her screens read his answer
// as '민수님이 같이 챙긴대요'. In the pregnant stage his home runs the same loop
// as preparing; nothing of it shows in the 42 quiet days after a loss.

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogSheet from '@/components/log/LogSheet'
import PlanTab from '@/components/tabs/PlanTab'
import PregnancyTab from '@/components/tabs/PregnancyTab'
import TodayTab from '@/components/tabs/TodayTab'
import { WEEK_BLOCK_TITLE } from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { planItems, tickItem } from '@/lib/logic/plan'
import { startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { isSupported, supportItem, supportKey, togetherItems } from '@/lib/logic/together'
import { markWeekDone, pickWeek, weekOptions } from '@/lib/logic/weekTogether'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, renderApp, seedApp, stateProbe, withProviders } from '../setup'

const T0: ISODate = '2026-10-09'
const HIM = 'a' as const
const HER = 'b' as const

const card = () => document.querySelector('[data-together-card]') as HTMLElement | null
const usLine = () => document.getElementById('us-line')!
const planRow = (id: string) => document.querySelector(`[data-plan-row="${id}"]`) as HTMLElement | null

/** The same couple in the 42-day quiet after a pregnancy ended yesterday. */
function lossQuiet(): AppState {
  const pregnant = startPregnancy(demoState(T0), addDays(T0, -50), addDays(T0, -15))
  expect(pregnant.stage).toBe('pregnant')
  return endPregnancy(pregnant, addDays(T0, -1))
}

/** Parenting, the baby 70 days old: her 산후도우미 바우처 deadline (birth + 59) passed, not ticked. */
function herDeadlinePassed(): AppState {
  const s = demoState(T0, 'parenting')
  const next = tickItem('birth-postnatal-care', false, T0, HER)({ ...s, baby: { ...s.baby!, birthDate: addDays(T0, -70) } })
  expect(planItems(next, T0).find((i) => i.id === 'birth-postnatal-care')!.status).toBe('overdue')
  return next
}

/** a comes before b in the document. */
function before(a: Element, b: Element): boolean {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('his preparing home: 지은님 챙길 것 · 같이', () => {
  it('lists her near-term items with a neutral status, his support line and [같이 할게요] — between his week and 내 준비', () => {
    const probe = stateProbe()
    const state = demoState(T0)
    const expected = togetherItems(state, T0, HIM, { whose: ['theirs'], limit: 3 })
    expect(expected.length).toBeGreaterThan(0)
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state, viewer: HIM, today: T0 },
    )
    const c = card()!
    expect(c).toBeTruthy()
    expect(c.getAttribute('data-together-card')).toBe('preparing')
    expect(within(c).getByRole('heading', { name: /지은님 챙길 것 · 같이/ })).toBeTruthy()
    const rows = c.querySelectorAll('[data-together-row]')
    expect([...rows].map((r) => r.getAttribute('data-together-row'))).toEqual(expected.map((r) => r.id))
    // Neutral words only — never a warning about her.
    expect(c.textContent).not.toMatch(/기한 지남|안 했어요|마감 D-/)
    const first = rows[0] as HTMLElement
    expect(first.querySelector('[data-together-label]')?.textContent).toBe(expected[0]!.label)
    expect(first.querySelector('[data-support-line]')?.textContent).toBe(expected[0]!.support)

    // Order on his home: 이번 주 우리 둘 → 같이 챙길 것 → 내 준비.
    const week = screen.getByRole('region', { name: WEEK_BLOCK_TITLE })
    const prep = document.querySelector('[data-my-prep]')!
    expect(before(week, c)).toBe(true)
    expect(before(c, prep)).toBe(true)

    // [같이 할게요] → remembered as his answer; a second tap takes it back.
    const btn = within(first).getByRole('button', { name: /같이 할게요/ })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    expect(probe.current.state!.decisions?.[supportKey(expected[0]!.id, HIM)]).toBe(T0)
    expect(
      within(first)
        .getByRole('button', { name: /같이 할게요/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(within(first).getByRole('button', { name: /같이 할게요/ }))
    expect(isSupported(probe.current.state!, expected[0]!.id, HIM)).toBe(false)
  })

  it('her home has no such card (the items are hers)', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: HER, today: T0 })
    expect(card()).toBeNull()
  })

  it('rests in the quiet after a loss: no card, no week block, no 내 준비', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: lossQuiet(), viewer: HIM, today: T0 })
    expect(card()).toBeNull()
    expect(screen.queryByRole('region', { name: WEEK_BLOCK_TITLE })).toBeNull()
    expect(document.querySelector('[data-my-prep]')).toBeNull()
    expect(screen.queryByRole('button', { name: /같이 할게요/ })).toBeNull()
  })
})

describe('her side: 민수님이 같이 챙긴대요', () => {
  const supported = () => supportItem(demoState(T0), HIM, 'pre-checkup-carrier', T0)

  it('shows his answer in 우리 한 줄 on her home', () => {
    const state = supported()
    expect(isSupported(state, 'pre-checkup-carrier', HIM)).toBe(true)
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: HER, today: T0 })
    const lines = usLine().querySelector('[data-support-lines]') as HTMLElement
    expect(lines).toBeTruthy()
    expect(lines.textContent).toContain('민수님이 ‘임신 전 기본 검사’ 같이 챙긴대요')
  })

  it('shows it on the item in 챙길 것, and his own screen keeps the toggle on', () => {
    const state = supported()
    renderApp(<PlanTab />, { state, viewer: HER, today: T0 })
    const row = planRow('pre-checkup-carrier')!
    expect(row.querySelector('[data-supported-by]')?.textContent).toBe('민수님이 같이 챙긴대요')
    // Her own rows carry no support line or button (the lines are his to act on).
    expect(within(row).queryByRole('button', { name: /같이 할게요/ })).toBeNull()
  })

  it('his 챙길 것: her row has his line and the pressed toggle; his own row has none', () => {
    renderApp(<PlanTab />, { state: supported(), viewer: HIM, today: T0 })
    const hers = planRow('pre-checkup-carrier')!
    expect(hers.querySelector('[data-support-line]')?.textContent).toContain('검사 날 같이 가기')
    expect(
      within(hers)
        .getByRole('button', { name: /같이 할게요/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    const his = planRow('pre-checkup-partner')!
    expect(his.querySelector('[data-support-line]')).toBeNull()
  })
})

describe('챙길 것: her items read neutral on his view', () => {
  it('a passed deadline of hers: no 기한 지남, no warning row, not on his focus card — her own view keeps it', () => {
    const state = herDeadlinePassed()
    renderApp(<PlanTab />, { state, viewer: HIM, today: T0 })
    const row = planRow('birth-postnatal-care')!
    expect(row).toBeTruthy()
    expect(row.textContent).not.toContain('기한 지남')
    expect(row.className).not.toContain('bg-warn-soft')
    expect(row.querySelector('[data-support-line]')).toBeNull()
    // The focus card ('이번 주 챙길 것') lists it only on her screen.
    const focus = screen.getByRole('heading', { name: '이번 주 챙길 것' }).closest('section, div[class*="rounded"]') as HTMLElement
    const focusIds = [...document.querySelectorAll('[data-plan-row]')]
      .filter((el) => focus.contains(el))
      .map((el) => el.getAttribute('data-plan-row'))
    expect(focusIds).not.toContain('birth-postnatal-care')
  })

  it('her own view keeps 기한 지남', () => {
    renderApp(<PlanTab />, { state: herDeadlinePassed(), viewer: HER, today: T0 })
    expect(planRow('birth-postnatal-care')!.textContent).toContain('기한 지남')
  })
})

describe('pregnant home', () => {
  const pregnant = () => demoState(T0, 'pregnant')

  it('his: 임신 N주 → 이번 주 우리 둘 → 이번 주 같이 챙길 것 → 내 준비 → 우리 한 줄', () => {
    const state = pregnant()
    expect(weekOptions(state, T0, HIM)).toHaveLength(3)
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: HIM, today: T0 })
    expect(document.querySelector('[data-pregnant-home]')?.getAttribute('data-pregnant-home')).toBe('partner')
    const hero = screen.getByRole('heading', { name: /^임신 \d+주/ })
    const week = screen.getByRole('region', { name: WEEK_BLOCK_TITLE })
    const c = card()!
    const prep = document.querySelector('[data-my-prep]')!
    const us = usLine()
    expect(c.getAttribute('data-together-card')).toBe('pregnant')
    expect(within(c).getByRole('heading', { name: /이번 주 같이 챙길 것/ })).toBeTruthy()
    for (const [a, b] of [
      [hero, week],
      [week, c],
      [c, prep],
      [prep, us],
    ] as const)
      expect(before(a, b)).toBe(true)
    // The pregnancy catalogue, his own items in 내 준비, her items with what he can do.
    for (const o of weekOptions(state, T0, HIM)) expect(week.textContent).toContain(o.text)
    expect(prep.textContent).toContain('배우자 지원 제도')
    expect(c.querySelector('[data-support-line]')).toBeTruthy()
    expect(c.textContent).not.toMatch(/기한 지남|안 했어요/)
    // Her checks list (PlanFocusCard) is not on his home: the together card replaces it.
    expect(screen.queryByRole('heading', { name: '이번 주 챙길 것' })).toBeNull()
  })

  it('hers: no week block or together card; 우리 한 줄 has 이번 주 민수님 + [고마워요] once he did his week', () => {
    let state = pregnant()
    const pick = weekOptions(state, T0, HIM)[0]!
    state = markWeekDone(pickWeek(state, HIM, pick.id, T0), HIM, T0)
    state = supportItem(state, HIM, 'p1-nt', T0)
    const probe = stateProbe()
    renderApp(
      <>
        <TodayTab onNavigate={() => {}} />
        <probe.Probe />
      </>,
      { state, viewer: HER, today: T0 },
    )
    expect(document.querySelector('[data-pregnant-home]')?.getAttribute('data-pregnant-home')).toBe('owner')
    expect(card()).toBeNull()
    expect(screen.queryByRole('region', { name: WEEK_BLOCK_TITLE })).toBeNull()
    const block = usLine().querySelector('[data-week-summary]') as HTMLElement
    expect(block.textContent).toContain(pick.doneText)
    expect(usLine().querySelector('[data-support-lines]')?.textContent).toContain('민수님이 ‘NT(목덜미 투명대)’ 같이 챙긴대요')
    fireEvent.click(within(block).getByRole('button', { name: /고마워요/ }))
    expect(probe.current.state!.decisions?.[`week-thanks:${'2026-10-05'}:${HER}`]).toBe(T0)
  })

  it('his 임신 tab: the NT row carries his line and [같이 할게요]; hers does not', () => {
    const state = pregnant()
    const first = renderApp(<PregnancyTab />, { state, viewer: HIM, today: T0 })
    const nt = screen.getByText(/목덜미투명대\(NT\) 초음파/).closest('li') as HTMLElement
    expect(nt.querySelector('[data-support-line]')?.textContent).toContain('예약 시간 비워 두기')
    expect(within(nt).getByRole('button', { name: /같이 할게요/ })).toBeTruthy()
    first.unmount()
    renderApp(<PregnancyTab />, { state, viewer: HER, today: T0 })
    expect(document.querySelector('[data-support-line]')).toBeNull()
  })
})

describe("his '+ 기록' while pregnant", () => {
  it("opens the '했어요' sheet: this week's pick, today's checks, 신호 보내기", () => {
    const state = demoState(T0, 'pregnant')
    seedApp({ state, viewer: HIM, today: T0 })
    render(withProviders(<LogSheet request={{}} onClose={() => {}} />))
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    expect(dialog.querySelector('[data-did-sheet]')).toBeTruthy()
    expect(within(dialog).getByRole('region', { name: WEEK_BLOCK_TITLE })).toBeTruthy()
    expect(within(dialog).getByRole('group', { name: '신호 보내기' })).toBeTruthy()
    act(() => {})
  })
})
