// QA (Now 3b): his 주기 tab reads what she told him exactly as his home and
// his link do. CycleTab used to build his lens from a slice of the state
// without `decisions` / `notifications`, so cycleRing.sharedWeek could not see
// 'period-told:<start>' and a start she TOLD read as untold there (his window
// held where it was expected while his home had moved). Untold, it must still
// hold — the inference-leak rule (tests/leakInference.test.ts).

import { describe, expect, it } from 'vitest'
import CycleTab from '@/components/tabs/CycleTab'
import { addDays, formatKo } from '@/lib/dates'
import { cycleAt, sortedStarts } from '@/lib/logic/cycle'
import { sharedCycleInput, sharedWeek } from '@/lib/logic/cycleRing'
import { logPeriodStart } from '@/lib/logic/logs'
import { stampOn } from '@/lib/logic/today'
import { tellPartnerPeriod } from '@/lib/logic/ttcFlow'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText, renderApp } from '../setup'

const OWNER = 'b' as const
const PARTNER = 'a' as const

const range = (s: AppState, d: ISODate) => {
  const w = sharedWeek(s, d)
  return w ? `${formatKo(w.fertileStart)} ~ ${formatKo(w.fertileEnd)}` : null
}

/** An early start she logs on `d` (told or not) and a later day `x` on which the two read differently for him. */
function earlyCase(): { untold: AppState; told: AppState; x: ISODate } {
  const s0 = { ...demoState('2026-09-20'), settings: { ...demoState('2026-09-20').settings, shareLevel: 'week' as const } }
  const last = sortedStarts(s0.periods).filter((p) => p <= '2026-09-20').pop()!
  const e = cycleAt(sharedCycleInput(s0), last)!.nextPeriod
  for (let k = 3; k <= 12; k++) {
    const d = addDays(e, -k)
    if (sharedWeek(s0, d)) continue
    const untold = logPeriodStart(s0, d, OWNER, d)
    const told = tellPartnerPeriod(untold, d, stampOn(d))
    for (let i = 0; i < 40; i++) {
      const x = addDays(d, i)
      const a = range(told, x)
      const b = range(untold, x)
      if (a && b && a !== b) return { untold, told, x }
    }
  }
  throw new Error('no early case found — the fixture changed')
}

describe('his 주기 tab and what she told him (QA Now 3b)', () => {
  it('a start she told moves his window here as on his home; untold, it holds', () => {
    const { untold, told, x } = earlyCase()
    renderApp(<CycleTab />, { state: told, viewer: PARTNER, today: x })
    expect(pageText()).toContain(range(told, x)!)
    expect(pageText()).not.toContain(range(untold, x)!)
  })

  it('untold: his 주기 tab still shows the window as it was expected', () => {
    const { untold, x } = earlyCase()
    renderApp(<CycleTab />, { state: untold, viewer: PARTNER, today: x })
    expect(pageText()).toContain(range(untold, x)!)
  })
})
