import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { inbox } from '@/lib/logic/notifications'
import { SIGNALS_PER_DAY, pendingSignal, sendSignal, signalsSentToday } from '@/lib/logic/signals'

const base = () =>
  createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
    },
    new Date(2026, 8, 1, 9),
  )

describe('signals', () => {
  it('delivers a signal to the partner and shows it as pending until replied', () => {
    let s = sendSignal(base(), 'b', 'a', 'dinner', '2026-09-02', '2026-09-02T18:00:00+09:00')
    const [n] = inbox(s, 'a')
    expect(n!.title).toBe('🍝 지은님: 오늘 저녁 같이 먹어요')
    expect(n!.from).toBe('b')
    expect(pendingSignal(s, 'a', '2026-09-02')?.id).toBe(n!.id)
    s = sendSignal(s, 'a', 'b', 'yes', '2026-09-02', '2026-09-02T18:05:00+09:00')
    expect(pendingSignal(s, 'a', '2026-09-02')).toBeUndefined()
    // A reply is not itself something to reply to.
    expect(pendingSignal(s, 'b', '2026-09-02')).toBeUndefined()
  })

  it('does not carry yesterday’s signal into today', () => {
    const s = sendSignal(base(), 'b', 'a', 'miss', '2026-09-02', '2026-09-02T18:00:00+09:00')
    expect(pendingSignal(s, 'a', '2026-09-03')).toBeUndefined()
  })

  it('limits signals per day and ignores unknown ids', () => {
    let s = base()
    for (let i = 0; i < SIGNALS_PER_DAY + 3; i++) {
      s = sendSignal(s, 'a', 'b', 'miss', '2026-09-02', `2026-09-02T1${i}:00:00+09:00`)
    }
    expect(signalsSentToday(s, 'a', '2026-09-02')).toBe(SIGNALS_PER_DAY)
    expect(sendSignal(s, 'b', 'a', 'nope', '2026-09-02', 'x')).toBe(s)
  })

  it('keeps keys unique so the notification engine never dedups two signals away', () => {
    let s = base()
    s = sendSignal(s, 'a', 'b', 'miss', '2026-09-02', '2026-09-02T10:00:00+09:00')
    s = sendSignal(s, 'a', 'b', 'miss', '2026-09-02', '2026-09-02T11:00:00+09:00')
    const keys = s.notifications.map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
