// The partner page (/link) draws 해 줄 말 · 아껴 둘 말 (N30) where the app does:
// on a card she told him about ([알리기]) — the two lines and two one-tap
// answers that go back as a 'signal' event, then '보냈어요 · …' — and under a
// signal of hers. Rendered in jsdom over the real mock transport; the words
// come from the snapshot (lib/logic/signals' catalogue), never from her records.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import LinkPage from '@/components/link/LinkPage'
import { LinkPendingSignal } from '@/components/link/LinkSignals'
import { LINK_INTRO_KEY, NO_MARKS, pruneMarks, viewTold } from '@/components/link/model'
import { logPeriodStart } from '@/lib/logic/logs'
import { makeLink } from '@/lib/logic/partnerLink'
import { applyPartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, snapshotDay, type SnapshotSignal } from '@/lib/logic/partnerSnapshot'
import { partnerId } from '@/lib/logic/partnerTrack'
import { sayForSignal, sayForTold, sendSignal, signalById } from '@/lib/logic/signals'
import { stampOn } from '@/lib/logic/today'
import { tellPartnerPeriod, ttcMoment } from '@/lib/logic/ttcFlow'
import { MOCK_SYNC_KEY, createMockTransport, parseMockStore } from '@/lib/sync/mockTransport'
import { resetTransport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { demoState, pageText } from '../setup'

const D: ISODate = '2026-10-04'
const OWNER = 'b' as const
const PARTNER = 'a' as const

/** The demo couple; her period starts today and she tells him ([알리기]). */
function toldState(): AppState {
  const s = logPeriodStart(demoState(D), D, OWNER, D)
  return tellPartnerPeriod(s, D, stampOn(D))
}

async function openLink(state: AppState) {
  const link = makeLink(null, `${D}T09:00:00+09:00`)
  const her = createMockTransport({ channel: null, now: () => `${D}T09:00:00+09:00`, offline: () => false })
  await her.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, D, partnerId(state))!)
  window.history.replaceState(null, '', `/link/?today=${D}#t=${link.token}`)
  render(<LinkPage />)
  return link
}

const store = () => parseMockStore(window.localStorage.getItem(MOCK_SYNC_KEY))

beforeEach(() => {
  resetTransport()
  window.localStorage.setItem(LINK_INTRO_KEY, JSON.stringify({ at: 1 }))
})
afterEach(() => resetTransport())

describe('/link — 해 줄 말 on a card she told him about (N30)', () => {
  it('shows the two lines and two answers; one tap sends a signal event her phone accepts, and the card reads 보냈어요', async () => {
    const state = toldState()
    expect(ttcMoment(state, D, PARTNER)?.say).toBeTruthy()
    const link = await openLink(state)
    const lines = sayForTold('period')
    const box = await waitFor(() => {
      const el = document.querySelector('[data-told-say]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(box.textContent).toContain(`해 줄 말 · ${lines.say}`)
    expect(box.textContent).toContain(`아껴 둘 말 · ${lines.save}`)
    // Instead of the tip that says the same (as the app's card).
    expect(pageText()).not.toContain('오늘 해 줄 수 있는 것')
    const group = within(box).getByRole('group', { name: '지은님에게 답하기' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('data-told-answer'))).toEqual([...lines.replies])
    for (const b of buttons) expect(b.className).toContain('min-h-[44px]')

    fireEvent.click(buttons[0]!)
    const first = signalById(lines.replies[0])!
    await waitFor(() => expect(box.querySelector('[data-told-sent]')?.textContent).toContain(`보냈어요 · ${first.emoji} ${first.text}`))
    expect(within(box).queryByRole('group')).toBeNull()
    await waitFor(() => expect(store().events[link.coupleId]?.some((r) => r.event.kind === 'signal')).toBe(true))
    const ev = store().events[link.coupleId]!.find((r) => r.event.kind === 'signal')!.event
    expect(ev).toMatchObject({ kind: 'signal', signalId: lines.replies[0], from: PARTNER })
    // Her phone applies it; the card she told about now carries it as sent, on the app and the link alike.
    const after = applyPartnerEvent(state, ev, D)
    expect(ttcMoment(after, D, PARTNER)?.say?.sent).toBe(lines.replies[0])
    expect(snapshotDay(buildPartnerSnapshot(after, D, PARTNER)!, D)?.moment?.say?.sent).toBe(lines.replies[0])
  })

  it('no [알리기], no lines: the same period untold leaves his card without them', async () => {
    const untold = logPeriodStart(demoState(D), D, OWNER, D)
    expect(ttcMoment(untold, D, PARTNER)?.say).toBeUndefined()
    await openLink(untold)
    await screen.findByRole('heading', { name: '오늘 할 일' })
    expect(document.querySelector('[data-told-say]')).toBeNull()
    expect(pageText()).not.toContain('아껴 둘 말')
  })

  it('under a signal of hers: both lines (her signal’s own), with the replies', async () => {
    const id = 'comfort'
    const state = sendSignal(demoState(D), OWNER, PARTNER, id, D, stampOn(D))
    await openLink(state)
    const lines = sayForSignal(id)!
    await waitFor(() => expect(document.querySelector('#us-line [data-say-lines]')).not.toBeNull())
    const us = document.querySelector('#us-line')!
    expect(us.textContent).toContain(`해 줄 말 · ${lines.say}`)
    expect(us.textContent).toContain(`아껴 둘 말 · ${lines.save}`)
    expect(us.querySelectorAll('[data-reply]')).toHaveLength(2)
  })
})

describe('/link — her answer to his signal (QA Now 3b)', () => {
  it('his offer, her 고마워요: the snapshot carries it and his 우리 한 줄 shows it as the app does', async () => {
    let s = sendSignal(demoState(D), PARTNER, OWNER, 'dinner-mine', D, `${D}T11:10:00+09:00`)
    expect(snapshotDay(buildPartnerSnapshot(s, D, PARTNER)!, D)?.reply).toBeUndefined()
    s = sendSignal(s, OWNER, PARTNER, 'thank-you', D, `${D}T11:20:00+09:00`)
    const day = snapshotDay(buildPartnerSnapshot(s, D, PARTNER)!, D)!
    expect(day.reply).toEqual({ emoji: '🙏', text: '고마워요', from: OWNER, at: `${D}T11:20:00+09:00`, answered: '오늘 저녁은 내가 할게요' })
    // Only her words and his signal's words: nothing else rides along.
    expect(Object.keys(day.reply!).sort()).toEqual(['answered', 'at', 'emoji', 'from', 'text'])
    await openLink(s)
    await waitFor(() => expect(document.querySelector('#us-line [data-received-reply]')).not.toBeNull())
    const line = document.querySelector('#us-line [data-received-reply]')!.textContent ?? ''
    expect(line).toContain('지은님이 답했어요 · 오전 11:20')
    expect(line).toContain('‘오늘 저녁은 내가 할게요’에')
    expect(line).toContain('고마워요')
  })

  it('no reply from her, no line — and a newer signal of his drops the old answer', () => {
    let s = sendSignal(demoState(D), PARTNER, OWNER, 'dinner-mine', D, `${D}T11:10:00+09:00`)
    s = sendSignal(s, OWNER, PARTNER, 'thank-you', D, `${D}T11:20:00+09:00`)
    s = sendSignal(s, PARTNER, OWNER, 'clinic-together', D, `${D}T11:30:00+09:00`)
    expect(snapshotDay(buildPartnerSnapshot(s, D, PARTNER)!, D)?.reply).toBeUndefined()
  })
})

describe('link model — the told answer as a local mark', () => {
  const page = () => snapshotDay(buildPartnerSnapshot(toldState(), D, PARTNER)!, D)!

  it('viewTold reads 보냈어요 at once for one of the card’s two answers only', () => {
    const p = page()
    const [a] = sayForTold('period').replies
    expect(viewTold(p, NO_MARKS)?.sent).toBeUndefined()
    expect(viewTold(p, { ...NO_MARKS, told: { signalId: a, at: 1 } })?.sent).toBe(a)
    expect(viewTold(p, { ...NO_MARKS, told: { signalId: 'hug', at: 1 } })?.sent).toBeUndefined()
    expect(viewTold({ moment: null }, { ...NO_MARKS, told: { signalId: a, at: 1 } })).toBeUndefined()
  })

  it('pruneMarks keeps the mark while the snapshot has not confirmed it, and drops it once it has (or it expired)', () => {
    const p = page()
    const [a] = sayForTold('period').replies
    const marks = { ...NO_MARKS, told: { signalId: a, at: 1_000 } }
    expect(pruneMarks(marks, p, 2_000).told).toEqual(marks.told)
    expect(pruneMarks(marks, p, 1_000 + 60_000).told).toBeUndefined()
    const confirmed = { ...p, moment: { ...p.moment!, say: { ...p.moment!.say!, sent: a } } }
    expect(pruneMarks(marks, confirmed, 2_000).told).toBeUndefined()
  })

  it('an older snapshot with only the one-line tip still shows it', () => {
    const signal: SnapshotSignal = { signalId: 'not-this-month', text: '이번 달은 아니었어요', from: OWNER, at: `${D}T09:00:00+09:00`, replies: [], tip: 'TIP_ONLY_LINE' }
    render(<LinkPendingSignal signal={signal} sender={{ id: OWNER, name: '지은', emoji: '🌷', role: 'wife' }} senderIsHer left={3} onReply={() => {}} />)
    expect(pageText()).toContain('해 줄 말 · TIP_ONLY_LINE')
    expect(pageText()).not.toContain('아껴 둘 말')
  })
})
