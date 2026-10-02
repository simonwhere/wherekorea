import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { inbox } from '@/lib/logic/notifications'
import {
  ALL_SIGNALS,
  LEGACY_SIGNAL_IDS,
  REPLIES,
  SIGNALS,
  SIGNALS_PER_DAY,
  SIGNAL_REPLY_DAYS,
  pendingSignal,
  repliesFor,
  sendSignal,
  signalById,
  signalIdOf,
  signalsFor,
  signalsSentToday,
} from '@/lib/logic/signals'
import type { Stage } from '@/lib/types'

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

  it('can be answered for about 72 hours (today and the two days before), not longer', () => {
    const s = sendSignal(base(), 'b', 'a', 'miss', '2026-09-02', '2026-09-02T18:00:00+09:00')
    expect(SIGNAL_REPLY_DAYS).toBe(2)
    expect(pendingSignal(s, 'a', '2026-09-03')).toBeDefined()
    expect(pendingSignal(s, 'a', '2026-09-04')).toBeDefined()
    expect(pendingSignal(s, 'a', '2026-09-05')).toBeUndefined()
    // Never a signal from the future (a pinned ?today before it was sent).
    expect(pendingSignal(s, 'a', '2026-09-01')).toBeUndefined()
  })

  it('a signal sent at 23:50 is still answered with one tap the next morning — and then it is done', () => {
    let s = sendSignal(base(), 'b', 'a', 'miss', '2026-09-02', '2026-09-02T23:50:00+09:00')
    const [n] = inbox(s, 'a')
    expect(pendingSignal(s, 'a', '2026-09-03')?.id).toBe(n!.id)
    s = sendSignal(s, 'a', 'b', 'yes', '2026-09-03', '2026-09-03T08:00:00+09:00')
    expect(pendingSignal(s, 'a', '2026-09-03')).toBeUndefined()
    // The answered signal is no longer unread for the one who replied.
    expect(s.notifications.find((x) => x.id === n!.id)?.read).toBe(true)
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

describe('preparing signals', () => {
  const texts = (list: { text: string }[]) => list.map((x) => x.text)
  const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야/

  it('offers the trying-month moments while preparing', () => {
    const owner = texts(signalsFor('preparing', true))
    expect(owner).toEqual(
      expect.arrayContaining(['이번 달은 아니었어요', '위로가 필요해요', '병원 같이 가 줄래요?', '오늘은 임신 얘기 말고 쉬어요']),
    )
  })

  it('leaves "이번 달은 아니었어요" to the person whose cycle it is', () => {
    expect(texts(signalsFor('preparing', false))).not.toContain('이번 달은 아니었어요')
    expect(texts(signalsFor('preparing', false))).toEqual(
      expect.arrayContaining(['위로가 필요해요', '병원 같이 가 줄래요?', '오늘은 임신 얘기 말고 쉬어요']),
    )
  })

  it('demotes generic chat lines but keeps their ids readable', () => {
    for (const owner of [true, false]) {
      const ids = signalsFor('preparing', owner).map((x) => x.id)
      for (const legacy of LEGACY_SIGNAL_IDS) expect(ids).not.toContain(legacy)
    }
    for (const id of ['dinner', 'early', 'date', 'miss', 'thanks', 'rest', 'tired', 'yes', 'later', 'hug']) {
      expect(signalById(id)).toBeDefined()
    }
    // An old signal already in the inbox still reads and still waits for a reply.
    const s = sendSignal(base(), 'b', 'a', 'date', '2026-09-02', '2026-09-02T18:00:00+09:00')
    expect(pendingSignal(s, 'a', '2026-09-02')).toBeDefined()
  })

  it('always offers a rest / not-today signal, in every stage', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as Stage[]) {
      for (const owner of [true, false]) {
        expect(signalsFor(stage, owner).some((x) => x.tone === 'rest')).toBe(true)
      }
    }
    expect(SIGNALS.some((x) => x.tone === 'rest')).toBe(true)
  })

  it('keeps preparing-only lines out of the pregnancy and baby stages', () => {
    for (const stage of ['pregnant', 'parenting'] as Stage[]) {
      const ids = signalsFor(stage).map((x) => x.id)
      expect(ids).not.toContain('not-this-month')
      expect(ids).not.toContain('no-baby-talk')
    }
    expect(SIGNALS.map((x) => x.id)).not.toContain('not-this-month')
  })

  it('answers every signal with a fitting reply set that includes a no-pressure option', () => {
    const noPressure = new Set(['later', 'hug'])
    for (const sig of ALL_SIGNALS.filter((x) => x.tone !== 'reply')) {
      const replies = repliesFor(sig.id)
      expect(replies.length).toBeGreaterThanOrEqual(2)
      expect(replies.every((r) => r.tone === 'reply')).toBe(true)
      expect(replies.some((r) => noPressure.has(r.id))).toBe(true)
    }
    // Comfort isn't answered with "좋아요!".
    expect(texts(repliesFor('not-this-month'))).toEqual(['옆에 있을게요', '알겠어요, 푹 쉬어요'])
    expect(texts(repliesFor('clinic'))).toEqual(['좋아요!', '다음에 해요, 괜찮아요'])
    expect(repliesFor(undefined)).toEqual([...REPLIES])
  })

  it('keeps the SIGNALS + REPLIES fallback free of comfort signals ("다음에 해요" never answers "위로가 필요해요")', () => {
    expect(SIGNALS.some((x) => x.tone === 'support')).toBe(false)
    // Only the tones the generic 좋아요 / 다음에 해요 / 푹 쉬어요 fit.
    for (const sig of SIGNALS) expect(['invite', 'warm', 'rest']).toContain(sig.tone)
    // Stage-aware screens still offer comfort (with its own replies) in every stage.
    for (const stage of ['preparing', 'pregnant', 'parenting'] as Stage[]) {
      expect(signalsFor(stage, false).map((x) => x.id)).toContain('comfort')
    }
  })

  it('treats the new replies as replies (they answer, they are not pending)', () => {
    let s = sendSignal(base(), 'b', 'a', 'not-this-month', '2026-09-02', '2026-09-02T08:00:00+09:00')
    const got = pendingSignal(s, 'a', '2026-09-02')!
    expect(got.title).toBe('🌧️ 지은님: 이번 달은 아니었어요')
    expect(signalIdOf(got)).toBe('not-this-month')
    s = sendSignal(s, 'a', 'b', 'here', '2026-09-02', '2026-09-02T08:05:00+09:00')
    expect(pendingSignal(s, 'a', '2026-09-02')).toBeUndefined()
    expect(pendingSignal(s, 'b', '2026-09-02')).toBeUndefined()
    expect(inbox(s, 'b')[0]!.title).toBe('🫂 민수님: 옆에 있을게요')
  })

  it('uses warm 해요체 and no banned or celebration words', () => {
    for (const x of ALL_SIGNALS) {
      expect(x.text).not.toMatch(BANNED)
      expect(x.emoji).not.toMatch(/🎉|🥳|🎊/)
    }
  })
})
