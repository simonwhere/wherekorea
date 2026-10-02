// (b) The "+ 기록" sheet's LH panel: a past day offers the 아침 / 저녁 slots
// (N17), today asks for the clock time.

import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogSheet from '@/components/log/LogSheet'
import { addDays } from '@/lib/dates'
import type { ISODate } from '@/lib/types'
import { demoState, renderApp } from '../setup'

const T0: ISODate = '2026-10-02'
/** 지은 (b) records the cycle; she uses LH strips (settings.usesLH true in the demo). */
const OWNER = 'b'

describe('LogSheet · LH panel', () => {
  it('a past date shows the 아침 / 저녁 slot chips with what was logged, and no time input', () => {
    const yesterday = addDays(T0, -1)
    renderApp(<LogSheet request={{ kind: 'lh', date: yesterday }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    const dialog = screen.getByRole('dialog', { name: '기록하기' })
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
    const time = within(dialog).getByLabelText('검사 시각') as HTMLInputElement
    expect(time.type).toBe('time')
    expect(time.value).toMatch(/^\d{2}:\d{2}$/)
    expect(within(dialog).queryByRole('group', { name: '검사한 때' })).toBeNull()
  })

  it('an empty past day starts on the 아침 slot with both slots free', () => {
    const day = addDays(T0, -4)
    renderApp(<LogSheet request={{ kind: 'lh', date: day }} onClose={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
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
