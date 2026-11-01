// Her week line about him in the 🔔 sheet (2026-11-01): '이번 주 민수님' carries
// the same once-a-week [고마워요] as 우리 한 줄 — one decision, one 💛 to him.

import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotificationsSheet from '@/components/NotificationsSheet'
import { mergeNotices } from '@/lib/logic/notifications'
import { PARTNER_FLU_ID } from '@/lib/logic/partnerDates'
import { weekDigestNotices } from '@/lib/logic/partnerNotices'
import { tickItem } from '@/lib/logic/plan'
import { weekThanked } from '@/lib/logic/weekTogether'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, renderApp, stateProbe } from '../setup'

const SUNDAY: ISODate = '2026-11-01'
const MONDAY: ISODate = '2026-10-26'
const PARTNER = 'a' // 민수
const OWNER = 'b' // 지은
const noop = () => {}

/** The demo space with his flu tick this week and her week line in the inbox. */
function withDigest(): AppState {
  let s = demoState(SUNDAY)
  s = { ...s, decisions: Object.fromEntries(Object.entries(s.decisions ?? {}).filter(([k]) => !k.startsWith('week-thanks:'))) }
  s = tickItem(PARTNER_FLU_ID, true, '2026-10-30', PARTNER)(s)
  const digest = weekDigestNotices(s, SUNDAY)
  expect(digest).toHaveLength(1)
  return mergeNotices(s, digest, `${SUNDAY}T20:00:00+09:00`).state
}

describe('🔔 · 이번 주 민수님 with [고마워요]', () => {
  it('she thanks him from the sheet: the week’s decision and the 💛 to him; then the row reads 고맙다고 전했어요', () => {
    const state = withDigest()
    const probe = stateProbe()
    renderApp(
      <>
        <NotificationsSheet open onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: OWNER, today: SUNDAY },
    )
    const dialog = screen.getByRole('dialog', { name: '알림' })
    expect(dialog.textContent).toContain('이번 주 민수님')
    expect(dialog.textContent).toContain('독감 접종을 했어요')
    fireEvent.click(within(dialog).getByRole('button', { name: '민수님에게 고마워요' }))
    const after = probe.current.state!
    expect(weekThanked(after, OWNER, MONDAY)).toBe(SUNDAY)
    expect(after.notifications.filter((n) => n.key === `thanks:${MONDAY}:${OWNER}` && n.to === PARTNER)).toHaveLength(1)
    expect(within(dialog).queryByRole('button', { name: '민수님에게 고마워요' })).toBeNull()
    expect(dialog.textContent).toContain('고맙다고 전했어요 (일)')
  })

  it('[고마워요] also reads the digest as read: the unread count drops by one (UI-4)', () => {
    const state = withDigest()
    const probe = stateProbe()
    renderApp(
      <>
        <NotificationsSheet open onClose={noop} />
        <probe.Probe />
      </>,
      { state, viewer: OWNER, today: SUNDAY },
    )
    const dialog = screen.getByRole('dialog', { name: '알림' })
    const count = () => Number(/읽지 않은 알림 (\d+)개/.exec(dialog.textContent ?? '')?.[1] ?? 0)
    const before = count()
    expect(before).toBeGreaterThan(0)
    fireEvent.click(within(dialog).getByRole('button', { name: '민수님에게 고마워요' }))
    expect(count()).toBe(before - 1)
    expect(probe.current.state!.notifications.find((n) => n.key === `week-digest:${MONDAY}:${OWNER}`)?.read).toBe(true)
  })

  it('he never sees her week line or its button', () => {
    renderApp(<NotificationsSheet open onClose={noop} />, { state: withDigest(), viewer: PARTNER, today: SUNDAY })
    const dialog = screen.getByRole('dialog', { name: '알림' })
    expect(dialog.textContent).not.toContain('이번 주 민수님')
    expect(within(dialog).queryByRole('button', { name: /고마워요/ })).toBeNull()
  })
})
