// The 12 husband check points on screen, where the tracks meet (integrate
// 2026-11-01): his link answers what his app asks — [접수가 끝났대요], the
// flu tick (husbandScreens.test.tsx), the sauna / laptop question and 아빠
// 마음 — while her preview of his link shows none of them; and her side never
// names his 금연 · 술 · medicine rows (her parenting home, her preview).

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LinkBody, { NO_ACTIONS } from '@/components/link/LinkBody'
import LinkPreview from '@/components/link/LinkPreview'
import { APPLY_CLOSED_TEXT, NO_MARKS } from '@/components/link/model'
import TodayTab from '@/components/tabs/TodayTab'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { activeDailyItems, addCheckItem, toggleCheck } from '@/lib/logic/checks'
import { dadMindDay } from '@/lib/logic/partnerDates'
import { buildPartnerSnapshot, snapshotDay, type PartnerPage } from '@/lib/logic/partnerSnapshot'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import type { AppState, ISODate } from '@/lib/types'
import { pageText, renderApp } from '../setup'

const HIM = 'a' as const
const HER = 'b' as const
const T: ISODate = '2026-11-01'
const nav = () => {}

function fresh(smokes = false, drinks: 'rarely' | 'often' = 'rarely'): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-10-20',
      habits: { smokes, drinks, exercises: false, takesSupplements: false },
    },
    new Date(2026, 9, 20, 9),
  )
}
const page = (s: AppState, d: ISODate = T): PartnerPage => snapshotDay(buildPartnerSnapshot(s, d, HIM), d)!

describe('his link answers what his app asks', () => {
  it('[접수가 끝났대요] on the 신청 card sends apply-closed and reads 1월에 다시 확인해요; her preview has no chip', () => {
    const onTaskClosed = vi.fn()
    const p = page(fresh())
    render(<LinkBody page={p} today={T} marks={NO_MARKS} actions={{ ...NO_ACTIONS, onTaskClosed }} />)
    fireEvent.click(screen.getByRole('button', { name: '접수가 끝났대요' }))
    expect(onTaskClosed).toHaveBeenCalledWith(expect.objectContaining({ step: 'apply', canSayClosed: true }))
    cleanup()
    render(<LinkBody page={p} today={T} marks={{ ...NO_MARKS, closed: { taskId: p.task!.id, at: Date.now() } }} actions={NO_ACTIONS} />)
    expect(document.querySelector('[data-task-closed]')?.textContent).toContain(APPLY_CLOSED_TEXT)
    expect(screen.queryByRole('button', { name: '접수가 끝났대요' })).toBeNull()
    cleanup()
    render(<LinkPreview snapshot={buildPartnerSnapshot(fresh(), T, HIM)!} today={T} />)
    expect(pageText()).not.toContain('접수가 끝났대요')
  })

  it('the sauna / laptop question in his 내 준비: [내려놓기] / [그대로 두기]; her preview leaves it out', () => {
    const s = startPregnancy(addCheckItem(fresh(), HIM, '노트북 무릎 위에 두지 않기', 'habit', '2026-10-20'), '2026-10-01', T)
    const onRetire = vi.fn()
    render(<LinkBody page={page(s)} today={T} marks={NO_MARKS} actions={{ ...NO_ACTIONS, onRetire }} />)
    const ask = document.querySelector('[data-prep-retire]') as HTMLElement
    expect(ask.textContent).toContain('내려놓을까요?')
    fireEvent.click(within(ask).getByRole('button', { name: '내려놓기' }))
    expect(onRetire).toHaveBeenLastCalledWith(false)
    fireEvent.click(within(ask).getByRole('button', { name: '그대로 두기' }))
    expect(onRetire).toHaveBeenLastCalledWith(true)
    cleanup()
    render(<LinkBody page={page(s)} today={T} marks={{ ...NO_MARKS, retire: { at: Date.now() } }} actions={NO_ACTIONS} />)
    expect(document.querySelector('[data-prep-retire]')).toBeNull()
    cleanup()
    render(<LinkPreview snapshot={buildPartnerSnapshot(s, T, HIM)!} today={T} />)
    expect(document.querySelector('[data-prep-retire]')).toBeNull()
  })

  it('아빠 마음 on his parenting link: the sheet with its call links stays open after he answers; never in her preview', () => {
    const birth: ISODate = '2026-07-20'
    const s = recordBirth(startPregnancy(fresh(), '2025-10-15', '2025-11-20'), { name: '콩이', birthDate: birth, sex: 'unknown' })
    const day = dadMindDay(birth)
    expect(page(s, addDays(day, -1)).dadMind).toBeUndefined()
    const onDadMind = vi.fn()
    const p = page(s, day)
    expect(p.dadMind).toBe(true)
    const { rerender } = render(<LinkBody page={p} today={day} marks={NO_MARKS} actions={{ ...NO_ACTIONS, onDadMind }} />)
    const card = screen.getByRole('region', { name: '요즘 나는 어때요?' })
    fireEvent.click(within(card).getByRole('button', { name: '이야기할 곳 보기' }))
    expect(onDadMind).toHaveBeenCalledTimes(1)
    // Her phone confirms: the flag leaves the snapshot — the sheet he is reading stays.
    rerender(<LinkBody page={{ ...p, dadMind: undefined }} today={day} marks={NO_MARKS} actions={{ ...NO_ACTIONS, onDadMind }} />)
    const dialog = screen.getByRole('dialog', { name: '이야기할 곳' })
    expect(
      within(dialog)
        .getByRole('link', { name: /1577-0199/ })
        .getAttribute('href'),
    ).toBe('tel:15770199')
    expect(within(dialog).getByRole('link', { name: /109/ }).getAttribute('href')).toBe('tel:109')
    expect(screen.queryByRole('region', { name: '요즘 나는 어때요?' })).toBeNull()
    cleanup()
    render(<LinkPreview snapshot={buildPartnerSnapshot(s, day, HIM)!} today={day} />)
    expect(document.querySelector('[data-dad-mind]')).toBeNull()
    expect(pageText()).not.toContain('요즘 나는 어때요')
  })
})

describe('her side never names his 금연 · 술 · medicine rows', () => {
  const withRows = (): AppState => addCheckItem(fresh(true, 'often'), HIM, 'Finasteride', 'medication', '2026-10-20')

  it('her parenting home: his rows read 매일 체크 / 체크인; his own home still names them', () => {
    const birth: ISODate = '2026-10-10'
    const s = recordBirth(startPregnancy(withRows(), '2026-01-03', '2026-02-10'), { name: '콩이', birthDate: birth, sex: 'unknown' })
    renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HER, today: T })
    const card = screen.getByRole('list', { name: '민수님의 항목' })
    expect(card.textContent).not.toMatch(/금연|금주|술|Finasteride/)
    expect(card.textContent).toContain('체크인')
    expect(card.textContent).toContain('매일 체크')
    expect(pageText()).not.toMatch(/금연|금주|술 쉬기|Finasteride|금연클리닉/)
    cleanup()
    renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HIM, today: T })
    expect(pageText()).toContain('금연')
    expect(pageText()).toContain('Finasteride')
  })

  it('her preview of his link: the same rows unnamed; his link names them', () => {
    const s = withRows()
    render(<LinkPreview snapshot={buildPartnerSnapshot(s, T, HIM)!} today={T} />)
    const preview = pageText()
    expect(preview).not.toMatch(/금연|금주|술 쉬기|Finasteride/)
    expect(preview).toContain('체크인')
    cleanup()
    render(<LinkBody page={page(s)} today={T} marks={NO_MARKS} actions={NO_ACTIONS} />)
    expect(pageText()).toContain('금연')
    expect(pageText()).toContain('Finasteride')
  })
})

/** Everything a screen reader or a hover could say: the text plus every aria-label and title. */
function allNames(): string {
  const attrs = Array.from(document.querySelectorAll('[aria-label],[title]')).map(
    (el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`,
  )
  return `${pageText()} ${attrs.join(' ')}`
}

/** His daily rows ticked on `day` except the one named `left`, so the 콕 points at it. */
function onlyLeft(s: AppState, left: string, day: ISODate = T): AppState {
  return activeDailyItems(s, HIM)
    .filter((i) => i.label !== left)
    .reduce((acc, i) => toggleCheck(acc, HIM, day, i.id), s)
}

describe('her 우리 한 줄: the 콕 button never names his medicine or smoking row (P2)', () => {
  const cases: Array<[string, AppState]> = [
    [
      'Finasteride (medicine), preparing',
      onlyLeft(addCheckItem(fresh(true, 'often'), HIM, 'Finasteride', 'medication', '2026-10-20'), 'Finasteride'),
    ],
    [
      'an old daily 담배 안 피우기, preparing',
      onlyLeft(addCheckItem(fresh(), HIM, '담배 안 피우기', 'habit', '2026-10-20'), '담배 안 피우기'),
    ],
    [
      'Finasteride, pregnant',
      onlyLeft(
        startPregnancy(addCheckItem(fresh(), HIM, 'Finasteride', 'medication', '2026-10-20'), '2026-09-20', '2026-10-25'),
        'Finasteride',
      ),
    ],
  ]

  for (const [name, s] of cases) {
    it(name, () => {
      renderApp(<TodayTab onNavigate={nav} />, { state: s, viewer: HER, today: T })
      const poke = screen.getByRole('button', { name: /민수님에게 콕 찌르기/ })
      expect(poke.getAttribute('aria-label')).toBe('민수님에게 콕 찌르기 (매일 체크)')
      expect(allNames()).not.toMatch(/Finasteride|담배|금연|금주|술 쉬기/)
    })
  }

  it('an ordinary row keeps its name on her button', () => {
    // fresh(): his one daily row is 걷기 30분, unticked.
    renderApp(<TodayTab onNavigate={nav} />, { state: fresh(), viewer: HER, today: T })
    expect(screen.getByRole('button', { name: /민수님에게 콕 찌르기/ }).getAttribute('aria-label')).toBe('민수님에게 콕 찌르기 (걷기 30분)')
  })
})
