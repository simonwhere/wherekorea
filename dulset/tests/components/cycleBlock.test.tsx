// (c) The home's moment card says "(예상)" at most once (review D-1): the copy
// carries it, or the ring legend / week row does — never both. Checked on the
// rendered card across viewers, alert styles and moments of the demo cycle.

import { describe, expect, it } from 'vitest'
import TodayTab from '@/components/tabs/TodayTab'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addPeriod } from '@/lib/logic/cycle'
import type { AlertStyle, AppState, ISODate, MemberId } from '@/lib/types'
import { demoState, renderApp } from '../setup'

const T0: ISODate = '2026-10-02'
const ESTIMATE = /\(예상/g

function styled(s: AppState, viewer: MemberId, style: AlertStyle): AppState {
  return { ...s, settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [viewer]: style } } }
}

function momentCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>('section[aria-label="오늘의 주기"]')
  if (!card) throw new Error('no moment card on the page')
  return card
}

const marks = (el: HTMLElement) => (el.textContent?.match(ESTIMATE) ?? []).length

describe('CycleBlock · "(예상)" at most once per card', () => {
  const base = demoState(T0)
  const nextStart = addDays(T0, 17)
  const scenarios: Array<{ name: string; state: AppState; today: ISODate }> = [
    { name: '우리의 주간 (day 12)', state: base, today: T0 },
    { name: 'LH 시작 무렵 (day 8)', state: base, today: addDays(T0, -4) },
    { name: '기다리는 주 (day 17)', state: base, today: addDays(T0, 5) },
    { name: '예정일 (day 28)', state: base, today: nextStart },
    { name: '늦음 (day 31)', state: base, today: addDays(T0, 20) },
    { name: '생리 2일째', state: addPeriod(base, nextStart, undefined, 'b'), today: addDays(nextStart, 1) },
    {
      name: '기록 없음 (fresh couple)',
      state: createInitialState(
        { me: { name: '지은', role: 'wife' }, partner: { name: '민수', role: 'husband' }, cycleOwner: 'a' },
        new Date(`${T0}T10:00:00`),
      ),
      today: T0,
    },
  ]
  const viewers: Array<{ viewer: MemberId; styles: AlertStyle[] }> = [
    { viewer: 'b', styles: ['explicit', 'soft'] },
    { viewer: 'a', styles: ['explicit', 'soft', 'off'] },
  ]

  let seen = 0
  for (const { viewer, styles } of viewers)
    for (const style of styles)
      for (const sc of scenarios)
        it(`${viewer === 'b' ? '지은' : '민수'} · ${style} · ${sc.name}`, () => {
          renderApp(<TodayTab onNavigate={() => {}} />, { state: styled(sc.state, viewer, style), viewer, today: sc.today })
          const n = marks(momentCard())
          seen += n
          expect(n).toBeLessThanOrEqual(1)
        })

  it('the marker does appear somewhere (so the count above is not trivially zero)', () => {
    expect(seen).toBeGreaterThan(0)
  })
})
