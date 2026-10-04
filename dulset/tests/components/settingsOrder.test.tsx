// 설정 after N27/N28: 연결 and 공유 범위 right after 우리 둘, 우리 둘의 날 low while
// preparing, the other stages' examples under 정보, and 첫 화면's 기념일 알림 off
// by default while preparing (an explicit choice is stored), with the 'N년 전
// 오늘' switch moved to the 기록장.

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OTHER_STAGE_DEMOS } from '@/components/settings/AboutSection'
import { SETTINGS_TOC_LABEL, settingsSections, type SettingsAnchor } from '@/components/settings/anchors'
import SettingsTab from '@/components/tabs/SettingsTab'
import type { ISODate, Stage } from '@/lib/types'
import { demoState, renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-04'

const chipLabels = () =>
  within(screen.getByRole('navigation', { name: '설정 목차' }))
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')

const sectionOrder = (): string[] =>
  Array.from(document.querySelectorAll('section[id]'))
    .map((el) => el.id)
    .filter((id): id is SettingsAnchor => id in SETTINGS_TOC_LABEL)

describe('settings order', () => {
  it('preparing: 우리 둘 → 연결 → 공유 first, 기념일 near the bottom; chips and sections agree', () => {
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: 'b', today: T0 })
    const labels = chipLabels()
    expect(labels.slice(0, 3)).toEqual(['우리 둘', '연결', '공유'])
    expect(labels.indexOf('기념일')).toBeGreaterThan(labels.indexOf('지원'))
    expect(labels.slice(-2)).toEqual(['데이터', '정보'])
    expect(sectionOrder()).toEqual(settingsSections('preparing'))
    expect(labels).toEqual(settingsSections('preparing').map((id) => SETTINGS_TOC_LABEL[id]))
  })

  for (const stage of ['pregnant', 'parenting'] as Stage[]) {
    it(`${stage}: 연결 right after 우리 둘, no 공유 or 주기`, () => {
      renderApp(<SettingsTab />, { state: demoState(T0, stage), viewer: 'b', today: T0 })
      const labels = chipLabels()
      expect(labels.slice(0, 2)).toEqual(['우리 둘', '연결'])
      expect(labels).not.toContain('공유')
      expect(labels).not.toContain('주기')
      expect(sectionOrder()).toEqual(settingsSections(stage))
    })
  }
})

describe('설정 › 정보: the other stages’ examples (N27)', () => {
  it('offers 임신 중 · 육아 중 behind a confirm that says what is replaced', () => {
    renderApp(<SettingsTab />, { state: demoState(T0), viewer: 'b', today: T0 })
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '정보' }))
    const about = document.getElementById('about')!
    for (const d of OTHER_STAGE_DEMOS) expect(within(about).getByRole('button', { name: d.label })).toBeTruthy()
    fireEvent.click(within(about).getByRole('button', { name: '임신 중 예시' }))
    const dialog = screen.getByRole('dialog', { name: '임신 중 예시 열기' })
    expect(dialog.textContent).toContain('지금 기록은 지워지고')
    expect(within(dialog).getByRole('button', { name: '먼저 백업하러 가기' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '그만둘게요' }))
    expect(screen.queryByRole('dialog', { name: '임신 중 예시 열기' })).toBeNull()
  })
})

describe('설정 › 첫 화면 while preparing (N27)', () => {
  it('기념일 알림 reads off when never chosen; turning it on stores true; no N년 전 오늘 switch here', () => {
    const probe = stateProbe()
    const s = demoState(T0)
    const unset = { ...s, settings: { ...s.settings } }
    delete unset.settings.anniversaryAlerts
    renderApp(
      <>
        <SettingsTab />
        <probe.Probe />
      </>,
      { state: unset, viewer: 'b', today: T0 },
    )
    fireEvent.click(within(screen.getByRole('navigation', { name: '설정 목차' })).getByRole('button', { name: '첫 화면' }))
    const home = document.getElementById('home')!
    const toggle = within(home).getByRole('switch', { name: /기념일 알림/ })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(within(home).queryByRole('switch', { name: /N년 전 오늘/ })).toBeNull()
    expect(home.textContent).toContain('우리 탭(기록장)')
    fireEvent.click(toggle)
    expect(probe.current.state!.settings.anniversaryAlerts).toBe(true)
  })
})
