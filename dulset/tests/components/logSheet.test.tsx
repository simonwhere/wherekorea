// (b) The "+ 기록" sheet's LH panel: by default two big buttons [양성][아직]
// (N29, one tap); '자세히' opens the four levels, a past day's 아침 / 저녁
// slots (N17) and today's clock time — saved the same way.

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogSheet from '@/components/log/LogSheet'
import { addDays } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import { demoState, renderApp, seedApp, stateProbe, withProviders } from '../setup'

const T0: ISODate = '2026-10-02'
/** 지은 (b) records the cycle; she uses LH strips (settings.usesLH true in the demo). */
const OWNER = 'b'

/** Open '자세히' (the four levels, the time or the slots). */
function openDetail(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: /자세히/ }))
}

describe('LogSheet · LH panel', () => {
  it('opens on two big buttons — 양성 · 아직 — with the details folded away (N29)', () => {
    renderApp(<LogSheet request={{ kind: 'lh', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    const quick = within(dialog).getByRole('group', { name: 'LH 결과' })
    expect(within(quick).getAllByRole('button').map((b) => b.textContent?.replace(/검사선.*$/, ''))).toEqual(['양성', '아직'])
    expect(within(dialog).queryByRole('group', { name: 'LH 테스트 결과' })).toBeNull()
    expect(within(dialog).queryByLabelText('검사 시각')).toBeNull()
    const more = within(dialog).getByRole('button', { name: /자세히/ })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    openDetail(dialog)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(within(within(dialog).getByRole('group', { name: 'LH 테스트 결과' })).getAllByRole('button')).toHaveLength(4)
  })

  it('[양성] / [아직] save 양성 / 음성 in one tap — the same records as the four levels', () => {
    const probe = stateProbe()
    // An empty past day: the first free slot (아침) takes it.
    const day = addDays(T0, -4)
    seedApp({ state: demoState(T0), viewer: OWNER, today: T0 })
    render(
      withProviders(
        <>
          <LogSheet request={{ kind: 'lh', date: day }} onClose={() => {}} />
          <probe.Probe />
        </>,
      ),
    )
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'LH 결과' })).getByRole('button', { name: /양성/ }))
    const saved = probe.current.state!.lhTests.filter((t) => t.date === day)
    expect(saved).toEqual([expect.objectContaining({ date: day, result: 'positive', slot: 'morning', by: OWNER })])
  })

  it('a past date shows the 아침 / 저녁 slot chips with what was logged, and no time input', () => {
    const yesterday = addDays(T0, -1)
    renderApp(<LogSheet request={{ kind: 'lh', date: yesterday }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    openDetail(dialog)
    const slots = within(dialog).getByRole('group', { name: '검사한 때' })
    const morning = within(slots).getByRole('button', { name: /아침/ })
    const evening = within(slots).getByRole('button', { name: /저녁/ })
    // The demo logged 희미 at 08:40 and 20:50 that day: both slots show their strip.
    expect(morning.textContent).toContain('08:40')
    expect(morning.textContent).toContain('희미')
    expect(evening.textContent).toContain('20:50')
    expect(dialog.querySelector('input[type="time"]')).toBeNull()
    // The four results are offered as choices.
    const results = within(dialog).getByRole('group', { name: 'LH 테스트 결과' })
    expect(within(results).getAllByRole('button')).toHaveLength(4)
  })

  it('today shows a 검사 시각 time input and no slot chips', () => {
    renderApp(<LogSheet request={{ kind: 'lh', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    openDetail(dialog)
    const time = within(dialog).getByLabelText('검사 시각') as HTMLInputElement
    expect(time.type).toBe('time')
    expect(time.value).toMatch(/^\d{2}:\d{2}$/)
    expect(within(dialog).queryByRole('group', { name: '검사한 때' })).toBeNull()
  })

  it('an empty past day starts on the 아침 slot with both slots free', () => {
    const day = addDays(T0, -4)
    renderApp(<LogSheet request={{ kind: 'lh', date: day }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    openDetail(screen.getByRole('dialog', { name: '기록하기' }))
    const slots = screen.getByRole('group', { name: '검사한 때' })
    const [morning, evening] = within(slots).getAllByRole('button')
    expect(morning?.getAttribute('aria-pressed')).toBe('true')
    expect(evening?.getAttribute('aria-pressed')).toBe('false')
    expect(morning?.textContent).toContain('아직 없어요')
    expect(evening?.textContent).toContain('아직 없어요')
  })

  it('the partner (not the cycle owner) gets the note chip only — no LH panel', () => {
    renderApp(<LogSheet request={{ kind: 'lh', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: 'a', today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    expect(within(dialog).queryByRole('group', { name: 'LH 테스트 결과' })).toBeNull()
    expect(within(dialog).queryByLabelText('검사 시각')).toBeNull()
    expect(dialog.textContent).toContain('주기 기록은 지은님이 해요')
  })
})

// N28: for the partner while preparing, '+ 기록' is a '했어요' sheet — the things
// he can do in one tap (a signal to answer, this week's one thing, today's
// checks, 신호 보내기) with the memo folded at the bottom. No cycle tool at all.
describe('LogSheet · the partner’s 했어요 sheet', () => {
  const PARTNER = 'a'

  it('opens on this week, today’s checks and 신호 보내기, the memo folded, no LH', () => {
    const probe = stateProbe()
    renderApp(
      <>
        <LogSheet request={{ date: T0 }} onClose={() => {}} />
        <probe.Probe />
      </>,
      { state: demoState(T0), viewer: PARTNER, today: T0 },
    )
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    expect(dialog.querySelector('[data-did-sheet]')).not.toBeNull()
    expect(within(dialog).getByRole('region', { name: '이번 주 우리 둘' })).toBeTruthy()
    expect(within(dialog).getByRole('group', { name: '신호 보내기' })).toBeTruthy()
    // No cycle tool for him: no kind chips, no LH panel, no period buttons.
    expect(within(dialog).queryByRole('group', { name: 'LH 테스트 결과' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: /오늘 시작/ })).toBeNull()
    expect(dialog.textContent).toContain('주기 기록은 지은님이 해요')
    // The memo waits behind its own fold.
    const memo = dialog.querySelector('details') as HTMLDetailsElement
    expect(memo.open).toBe(false)
    expect(memo.textContent).toContain('메모 남기기')

    // A check is one tap and lands in his own record.
    const checks = within(dialog).getAllByRole('checkbox')
    expect(checks.length).toBeGreaterThan(0)
    const doneCount = () => (probe.current.state!.checkLog[T0]?.[PARTNER] ?? []).length
    const before = doneCount()
    const was = checks[0]!.getAttribute('aria-checked')
    fireEvent.click(checks[0]!)
    expect(within(dialog).getAllByRole('checkbox')[0]!.getAttribute('aria-checked')).not.toBe(was)
    expect(doneCount()).toBe(was === 'false' ? before + 1 : before - 1)
  })

  it('openLog({ kind: "note" }) still opens the memo alone', () => {
    renderApp(<LogSheet request={{ kind: 'note', date: T0 }} onClose={() => {}} />, { state: demoState(T0), viewer: PARTNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
    expect(dialog.querySelector('[data-did-sheet]')).toBeNull()
    expect(within(dialog).queryByRole('region', { name: '이번 주 우리 둘' })).toBeNull()
  })
})
