// (d) 설정 renders every section for both viewers in every stage without
// throwing, and the chip table of contents opens each one.

import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SETTINGS_TOC_LABEL, type SettingsAnchor } from '@/components/settings/anchors'
import SettingsTab from '@/components/tabs/SettingsTab'
import type { ISODate, MemberId, Stage } from '@/lib/types'
import { demoState, renderApp } from '../setup'

const T0: ISODate = '2026-10-02'
const STAGES: Stage[] = ['preparing', 'pregnant', 'parenting']
const VIEWERS: MemberId[] = ['a', 'b']

const anchorOf = (label: string): SettingsAnchor => {
  const hit = (Object.entries(SETTINGS_TOC_LABEL) as Array<[SettingsAnchor, string]>).find(([, l]) => l === label)
  if (!hit) throw new Error(`no settings anchor for chip '${label}'`)
  return hit[0]
}

describe('SettingsTab', () => {
  for (const stage of STAGES)
    for (const viewer of VIEWERS)
      it(`${stage} · ${viewer === 'a' ? '민수' : '지은'}: every section opens from its chip`, () => {
        renderApp(<SettingsTab />, { state: demoState(T0, stage), viewer, today: T0 })
        expect(screen.getByRole('heading', { level: 1, name: '설정' })).toBeTruthy()
        const toc = screen.getByRole('navigation', { name: '설정 목차' })
        const chips = within(toc).getAllByRole('button')
        const labels = chips.map((c) => c.textContent?.trim() ?? '')
        // 공유 범위 and the cycle numbers only drive anything while preparing.
        expect(labels.includes('공유')).toBe(stage === 'preparing')
        expect(labels.includes('주기')).toBe(stage === 'preparing')
        expect(labels).toContain('우리 둘')
        expect(labels).toContain('데이터')
        for (const chip of chips) fireEvent.click(chip)
        for (const label of labels) {
          const section = document.getElementById(anchorOf(label))
          expect(section, `section #${anchorOf(label)} (${label})`).not.toBeNull()
          // Opened: the section has more than its heading row.
          expect(section!.textContent!.length, `section #${anchorOf(label)} has content`).toBeGreaterThan(label.length + 10)
        }
      })

  it('the sharing section is the cycle owner’s: 지은 picks the range, 민수 only reads about it', () => {
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: 'b', today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '공유' }))
    const owner = document.getElementById('share')!
    const choices = within(owner).getAllByRole('radio') as HTMLInputElement[]
    expect(choices.length).toBeGreaterThanOrEqual(2)
    // Privacy by default: the demo keeps the details to herself.
    expect(within(owner).getByRole('radio', { name: /우리의 주간 \(기본\)/ })).toHaveProperty('checked', true)

    cleanup()
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: 'a', today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '공유' }))
    const partner = document.getElementById('share')!
    expect(within(partner).queryAllByRole('radio')).toHaveLength(0)
  })
})
