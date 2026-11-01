// His check points on screen (founder 2026-11-01, '12개 전부'): his home, his
// 내 준비, his rows in 챙길 것, his parenting home and his link page — and her
// side, which shows none of it (no medicines, no 금연 words, no 아빠 마음, no
// 접수가 끝났대요, no 독감 on her 이번 주 챙길 것 card).

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DadMindCard from '@/components/baby/DadMindCard'
import LinkBody, { NO_ACTIONS } from '@/components/link/LinkBody'
import LinkPreview from '@/components/link/LinkPreview'
import { NO_MARKS } from '@/components/link/model'
import PlanTab from '@/components/tabs/PlanTab'
import TodayTab from '@/components/tabs/TodayTab'
import MyPrepBar from '@/components/today/MyPrepBar'
import { PlanFocusCard } from '@/components/today/PlanCards'
import TodayTasks from '@/components/today/TodayTasks'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { QUIT_SMOKING_CLINIC, SMOKE_PREGNANT_NOTE, addCheckItem } from '@/lib/logic/checks'
import { dadMindKey } from '@/lib/logic/dadMind'
import { retireAskedKey } from '@/lib/logic/myPrep'
import { buildPartnerSnapshot, snapshotDay } from '@/lib/logic/partnerSnapshot'
import { APPLY_INTAKE_LINE, BOOK_TEST_LINE, TEST_MEDS_LINE, applyClosedKey, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp, stateProbe, withProviders, seedApp } from '../setup'

const HIM = 'a' as const
const HER = 'b' as const
const T: ISODate = '2026-11-01'
const nav = () => {}

/** A fresh couple (민수 a, 지은 b tracks the cycle); `smokes` adds his weekly 금연. */
function fresh(smokes = false): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-10-20',
      habits: { smokes, drinks: 'rarely', exercises: false, takesSupplements: false },
    },
    new Date(2026, 9, 20, 9),
  )
}

describe('1 · the 신청 card on his home', () => {
  it('shows the intake line; [접수가 끝났대요] gives the slot away, 되돌리기 brings it back', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <TodayTab onNavigate={nav} />
        <probe.Probe />
      </>,
      { state: fresh(), viewer: HIM, today: T },
    )
    expect(pageText()).toContain(APPLY_INTAKE_LINE)
    fireEvent.click(screen.getByRole('button', { name: '접수가 끝났대요' }))
    expect(probe.current.state!.decisions[applyClosedKey('2026', HIM)]).toBe(T)
    expect(screen.queryByRole('button', { name: '신청했어요' })).toBeNull()
    expect(pageText()).not.toContain(APPLY_INTAKE_LINE)
    expect(pageText()).toContain('1월에 다시 확인해요')
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(probe.current.state!.decisions[applyClosedKey('2026', HIM)]).toBeUndefined()
    expect(screen.getByRole('button', { name: '신청했어요' })).toBeTruthy()
  })

  it('her home has neither the line nor the chip, before or after he taps it', () => {
    for (const s of [fresh(), { ...fresh(), decisions: { [applyClosedKey('2026', HIM)]: T } }]) {
      renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HER, today: T })
      expect(pageText()).not.toContain(APPLY_INTAKE_LINE)
      expect(screen.queryByRole('button', { name: '접수가 끝났대요' })).toBeNull()
      cleanup()
    }
  })
})

describe('3 · 4 · the 검사 card: the booking question and his medicines line', () => {
  const booking = () => setFertilityApplied(fresh(), HIM, true, '2026-10-25')

  it('on his home: both lines before booking; the medicines line while booked (demo)', () => {
    renderApp(<TodayTab onNavigate={nav} />, { state: booking(), viewer: HIM, today: T })
    expect(document.querySelector('[data-task-ask]')?.textContent).toBe(BOOK_TEST_LINE)
    expect(document.querySelector('[data-task-meds]')?.textContent).toBe(TEST_MEDS_LINE)
    cleanup()
    // The demo couple: 민수's test is booked.
    renderApp(<TodayTab onNavigate={nav} />, { state: demoState(T), viewer: HIM, today: T })
    expect(document.querySelector('[data-task-meds]')?.textContent).toBe(TEST_MEDS_LINE)
    expect(document.querySelector('[data-task-ask]')).toBeNull()
  })

  it('never on her screens: home, 챙길 것 (his row’s 자세히 included — any wording)', () => {
    for (const s of [fresh(), booking(), demoState(T)]) {
      renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HER, today: T })
      expect(pageText()).not.toMatch(/먹는 약|근육 키우는 약|처방받은 약/)
      cleanup()
      renderApp(<PlanTab />, { state: s, viewer: HER, today: T })
      expect(pageText()).not.toMatch(/먹는 약|근육 키우는 약|처방받은 약/)
      expect(document.querySelector('[data-detail-meds]')).toBeNull()
      cleanup()
    }
  })

  it('his own 정액검사 row in 챙길 것 carries it under 자세히 (UI-1)', () => {
    for (const s of [fresh(), booking()]) {
      renderApp(<PlanTab />, { state: s, viewer: HIM, today: T })
      // The full row (the focus card's compact copy has no 자세히).
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-plan-row="pre-checkup-partner"]'))
      const row = rows.find((r) => within(r).queryByRole('button', { name: /자세히/ }))
      expect(row).toBeDefined()
      fireEvent.click(within(row!).getByRole('button', { name: /자세히/ }))
      expect(row!.querySelector('[data-detail-meds]')?.textContent).toBe(TEST_MEDS_LINE)
      cleanup()
    }
  })

  it('his link draws it; her preview of his link does not', () => {
    const snap = buildPartnerSnapshot(booking(), T, HIM)!
    const page = snapshotDay(snap, T)!
    render(<LinkBody page={page} today={T} marks={NO_MARKS} actions={NO_ACTIONS} />)
    expect(document.querySelector('[data-task-meds]')?.textContent).toBe(TEST_MEDS_LINE)
    expect(document.querySelector('[data-task-ask]')?.textContent).toBe(BOOK_TEST_LINE)
    cleanup()
    render(<LinkPreview snapshot={snap} today={T} />)
    expect(pageText()).not.toMatch(/먹는 약|근육 키우는 약/)
    expect(document.querySelector('[data-task-ask]')?.textContent).toBe(BOOK_TEST_LINE)
  })
})

describe('2 · 올해 독감 접종 in his 내 준비', () => {
  it('ticks from 내 준비 under this season’s key, and says so', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <MyPrepBar />
        <probe.Probe />
      </>,
      { state: fresh(), viewer: HIM, today: T },
    )
    const row = screen.getByRole('checkbox', { name: /올해 독감 접종 맞기/ })
    expect(row.getAttribute('aria-checked')).toBe('false')
    expect(row.textContent).toContain('비용은 병원마다 달라요')
    fireEvent.click(row)
    expect(probe.current.state!.planDone['partner-flu:2026-27']).toMatchObject({ at: T, by: HIM })
    expect(screen.getByRole('checkbox', { name: /올해 독감 접종 맞기/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('is not on the 이번 주 챙길 것 card (hers or his), and her home has no 내 준비', () => {
    for (const viewer of [HIM, HER]) {
      renderApp(<PlanFocusCard onNavigate={nav} />, { state: fresh(), viewer, today: T })
      expect(document.querySelector('[data-plan-row="partner-flu"]')).toBeNull()
      cleanup()
    }
    renderApp(<TodayTab onNavigate={nav} />, { state: fresh(), viewer: HER, today: T })
    expect(screen.queryByRole('region', { name: '내 준비' })).toBeNull()
  })

  it('his link ticks it (a season-done event, integrate 2026-11-01); her preview shows it read-only', () => {
    const page = snapshotDay(buildPartnerSnapshot(fresh(), T, HIM), T)!
    const onSeason = vi.fn()
    render(<LinkBody page={page} today={T} marks={NO_MARKS} actions={{ ...NO_ACTIONS, onSeason }} />)
    const row = screen.getByRole('checkbox', { name: /올해 독감 접종 맞기/ })
    expect(row.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(row)
    expect(onSeason).toHaveBeenCalledWith(true)
    cleanup()
    render(<LinkBody page={page} today={T} marks={NO_MARKS} actions={NO_ACTIONS} preview />)
    const line = document.querySelector('[data-prep-season]') as HTMLElement
    expect(line.textContent).toContain('올해 독감 접종 맞기')
    expect(line.textContent).toContain('지금')
    expect(line.tagName).not.toBe('BUTTON')
  })
})

describe('8 · the 금연 row', () => {
  it('preparing: the 금연클리닉 link under it; pregnant: the line too', () => {
    renderApp(<TodayTasks onNavigate={nav} />, { state: fresh(true), viewer: HIM, today: T })
    const link = screen.getByRole('link', { name: /보건소 금연클리닉 찾기/ })
    expect(link.getAttribute('href')).toBe(QUIT_SMOKING_CLINIC.url)
    expect(pageText()).not.toContain(SMOKE_PREGNANT_NOTE)
    cleanup()
    const pregnant = startPregnancy(fresh(true), '2026-09-20', T)
    renderApp(<TodayTasks onNavigate={nav} />, { state: pregnant, viewer: HIM, today: T })
    expect(document.querySelector('[data-check-note]')?.textContent).toBe(SMOKE_PREGNANT_NOTE)
    expect(screen.getByRole('link', { name: /보건소 금연클리닉 찾기/ })).toBeTruthy()
  })

  it('her screens never carry it; his link does, her preview of it does not', () => {
    const pregnant = startPregnancy(fresh(true), '2026-09-20', T)
    renderApp(<TodayTab onNavigate={nav} />, { state: pregnant, viewer: HER, today: T })
    expect(pageText()).not.toContain(SMOKE_PREGNANT_NOTE)
    expect(pageText()).not.toContain('금연클리닉')
    cleanup()
    const snap = buildPartnerSnapshot(pregnant, T, HIM)!
    render(<LinkBody page={snapshotDay(snap, T)!} today={T} marks={NO_MARKS} actions={NO_ACTIONS} />)
    expect(pageText()).toContain(SMOKE_PREGNANT_NOTE)
    expect(pageText()).toContain('보건소 금연클리닉 찾기')
    cleanup()
    render(<LinkPreview snapshot={snap} today={T} />)
    expect(pageText()).not.toContain(SMOKE_PREGNANT_NOTE)
    expect(pageText()).not.toContain('금연클리닉')
  })
})

describe('9 · the sauna / laptop question inside 내 준비', () => {
  it('[내려놓기] archives the rows and the question is gone; never on her home', () => {
    let s = startPregnancy(fresh(), '2026-09-20', T)
    s = addCheckItem(s, HIM, '노트북 무릎 위에 두지 않기', 'habit', T)
    const probe = stateProbe()
    renderApp(
      <>
        <TodayTab onNavigate={nav} />
        <probe.Probe />
      </>,
      { state: s, viewer: HIM, today: T },
    )
    const prep = screen.getByRole('region', { name: '내 준비' })
    expect(prep.textContent).toContain('사우나·노트북 체크는 임신 준비용이었어요. 내려놓을까요?')
    // One card at a time: the question sits inside 내 준비, not as a card of its own.
    expect(document.querySelectorAll('[data-prep-retire]').length).toBe(1)
    fireEvent.click(within(prep).getByRole('button', { name: '내려놓기' }))
    const after = probe.current.state!
    expect(after.decisions[retireAskedKey('2026-09-20', HIM)]).toBe(T)
    expect(after.checkItems.filter((i) => i.owner === HIM && /사우나|노트북/.test(i.label)).every((i) => !i.active)).toBe(true)
    expect(document.querySelector('[data-prep-retire]')).toBeNull()
    cleanup()
    renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HER, today: T })
    expect(pageText()).not.toContain('내려놓을까요')
  })
})

describe('6 · 7 · his rows in 챙길 것', () => {
  it('배우자 출산휴가: ‘출생 후 120일 안’ before the birth, the real last day after', () => {
    const due = '2027-04-10'
    const pregnant = startPregnancy(fresh(), addDays(due, -280), T)
    renderApp(<PlanTab />, { state: pregnant, viewer: HIM, today: addDays(due, -30) })
    const row = document.querySelector('[data-plan-row="birth-partner-leave"]') as HTMLElement
    expect(row.textContent).toContain('출생 후 120일 안')
    expect(row.querySelector('[role="checkbox"]')?.getAttribute('aria-label')).toBe('남은 날까지 날짜를 다 정했어요')
    cleanup()
    const born = recordBirth(pregnant, { name: '아기', birthDate: addDays(due, -14), sex: 'unknown' })
    renderApp(<PlanTab />, { state: born, viewer: HIM, today: addDays(due, -10) })
    const after = document.querySelector('[data-plan-row="birth-partner-leave"]') as HTMLElement
    expect(after.textContent).not.toContain('출생 후 120일 안')
    // birth + 119 = 2027-07-24.
    expect(after.textContent).toContain('7.24')
  })

  it('Tdap after 예정일 2주 전, still open: ‘아직이면 병원에 물어봐요.’ on his row only', () => {
    const due = '2027-04-10'
    const s = startPregnancy(fresh(), addDays(due, -280), T)
    const day = addDays(due, -10)
    renderApp(<PlanTab />, { state: s, viewer: HIM, today: day })
    const row = document.querySelector('[data-plan-row="p3-partner-tdap"]') as HTMLElement | null
    expect(row).not.toBeNull()
    expect(row!.querySelector('[data-row-note]')?.textContent).toBe('아직이면 병원에 물어봐요.')
    cleanup()
    renderApp(<PlanTab />, { state: s, viewer: HER, today: day })
    expect(pageText()).not.toContain('아직이면 병원에 물어봐요')
  })
})

describe('12 · 아빠 마음 on his parenting home', () => {
  const birth = '2026-07-30'
  const parenting = () =>
    recordBirth(startPregnancy(fresh(), addDays(birth, -280), addDays(birth, -200)), { name: '아기', birthDate: birth, sex: 'unknown' })

  it('asks once from 출생일 + 90; [이야기할 곳 보기] opens the lines and keeps only ‘asked’', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <TodayTab onNavigate={nav} />
        <probe.Probe />
      </>,
      { state: parenting(), viewer: HIM, today: T },
    )
    const card = screen.getByRole('region', { name: '요즘 나는 어때요?' })
    const before = probe.current.state!
    fireEvent.click(within(card).getByRole('button', { name: '이야기할 곳 보기' }))
    const dialog = screen.getByRole('dialog', { name: '이야기할 곳' })
    expect(dialog.textContent).toContain('정신건강위기상담')
    expect(dialog.textContent).toContain('죽고 싶은 생각이 들면')
    expect(
      within(dialog)
        .getByRole('link', { name: /1577-0199/ })
        .getAttribute('href'),
    ).toBe('tel:15770199')
    expect(within(dialog).getByRole('link', { name: /109/ }).getAttribute('href')).toBe('tel:109')
    expect(within(dialog).getByRole('link', { name: /119/ }).getAttribute('href')).toBe('tel:119')
    expect(dialog.textContent).toContain('배우자도 상담받을 수 있어요')
    const after = probe.current.state!
    expect(after.decisions).toEqual({ ...before.decisions, [dadMindKey(birth, HIM)]: T })
    expect(screen.queryByRole('region', { name: '요즘 나는 어때요?' })).toBeNull()
  })

  it('[괜찮아요] closes it; before day 90 and on her home there is nothing', () => {
    const probe = stateProbe()
    seedApp({ state: parenting(), viewer: HIM, today: T })
    render(
      withProviders(
        <>
          <DadMindCard />
          <probe.Probe />
        </>,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: '괜찮아요' }))
    expect(probe.current.state!.decisions[dadMindKey(birth, HIM)]).toBe(T)
    expect(document.querySelector('[data-dad-mind]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    renderApp(<TodayTab onNavigate={nav} />, { state: parenting(), viewer: HIM, today: addDays(birth, 89) })
    expect(document.querySelector('[data-dad-mind]')).toBeNull()
    cleanup()
    renderApp(<TodayTab onNavigate={nav} />, { state: parenting(), viewer: HER, today: T })
    expect(document.querySelector('[data-dad-mind]')).toBeNull()
    expect(pageText()).not.toContain('요즘 나는 어때요')
  })
})
