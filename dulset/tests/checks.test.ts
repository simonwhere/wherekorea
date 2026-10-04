// N29 — her default checks: 엽산 only (lib/initial.ts defaultCheckItems). The
// rest are offered in 나의 체크 항목 (lib/content supplements); an existing
// couple's items are never rebuilt. His starter list is unchanged.

import { describe, expect, it } from 'vitest'
import { availableSuggestions } from '@/lib/content/supplements'
import { createInitialState, defaultCheckItems, type HabitAnswers } from '@/lib/initial'
import { activeItems, addCheckItem } from '@/lib/logic/checks'
import type { Member } from '@/lib/types'

const members = (): [Member, Member] => [
  { id: 'a', name: '민수', role: 'husband', tracksCycle: false, emoji: '👨' },
  { id: 'b', name: '지은', role: 'wife', tracksCycle: true, emoji: '👩' },
]
const NONE: HabitAnswers = { smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false }

describe('her default checks: 엽산 only (N29)', () => {
  it('with or without the partner’s habit answers', () => {
    for (const habits of [NONE, undefined, { ...NONE, smokes: true, drinks: 'often' as const }]) {
      const hers = defaultCheckItems(members(), '2026-10-04', habits).filter((i) => i.owner === 'b')
      expect(hers.map((i) => [i.label, i.kind, i.note, i.cadence ?? 'daily'])).toEqual([['엽산', 'supplement', '400µg', 'daily']])
    }
  })

  it('his starter list is unchanged (1–2 daily rows + the weekly check-ins that fit him)', () => {
    const his = defaultCheckItems(members(), '2026-10-04', NONE).filter((i) => i.owner === 'a')
    expect(his.map((i) => i.label)).toEqual(['걷기 30분', '사우나·뜨거운 탕 쉬기'])
    // Without answers (older callers): the original list for him.
    expect(defaultCheckItems(members(), '2026-10-04').filter((i) => i.owner === 'a').map((i) => i.label)).toEqual([
      '사우나·뜨거운 탕 피하기',
      '담배 안 피우기',
      '술 안 마시기',
      '30분 걷기·운동',
    ])
  })

  it('a new couple starts with 엽산 for her; 비타민 D, 술 안 마시기, 30분 걷기 wait in 나의 체크 항목', () => {
    const s = createInitialState(
      { me: { name: '지은', role: 'wife' }, partner: { name: '민수', role: 'husband' }, cycleOwner: 'a', lastPeriodStart: '2026-09-20' },
      new Date(2026, 9, 4, 9),
    )
    expect(activeItems(s, 'a').map((i) => i.label)).toEqual(['엽산'])
    const offered = availableSuggestions('cycle-owner', activeItems(s, 'a')).map((x) => x.label)
    expect(offered).toEqual(expect.arrayContaining(['비타민 D', '술 안 마시기', '30분 걷기·운동']))
    expect(offered).not.toContain('엽산')
    // One tap in the editor adds one back.
    const withD = addCheckItem(s, 'a', '비타민 D', 'supplement', '2026-10-04', '선택')
    expect(activeItems(withD, 'a').map((i) => i.label)).toEqual(['엽산', '비타민 D'])
  })

  it('an existing couple’s items are untouched (defaultCheckItems only builds a new list)', () => {
    const s = createInitialState(
      { me: { name: '지은', role: 'wife' }, partner: { name: '민수', role: 'husband' }, cycleOwner: 'a', lastPeriodStart: '2026-09-20' },
      new Date(2026, 9, 4, 9),
    )
    const old = { ...s, checkItems: [...s.checkItems, { id: 'vd', owner: 'a' as const, label: '비타민 D', kind: 'supplement' as const, active: true, createdAt: '2026-01-01' }] }
    expect(activeItems(old, 'a').map((i) => i.label)).toEqual(['엽산', '비타민 D'])
  })
})
