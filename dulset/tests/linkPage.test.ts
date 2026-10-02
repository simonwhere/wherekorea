// The partner link (Next A ①): the link record and its token
// (lib/useLinkSync — the pure half), the partner page's view model
// (components/link/model), and the whole round trip over the mock
// transport: the owner publishes, the page fetches, a tap becomes an event,
// the owner applies it with the same gates as the app and republishes, the
// page sees it; a revoke or an expired link shows the calm notice.

import { describe, expect, it } from 'vitest'
import {
  noticeCopy,
  parseCachedView,
  pruneMarks,
  viewCanNudge,
  viewChecks,
  viewSignal,
  viewSignalsLeft,
  viewTask,
  NO_MARKS,
  MARK_TTL_MS,
  ownerOf,
  viewerOf,
} from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { activeItems, isDone } from '@/lib/logic/checks'
import { applyPartnerEvents, hasAppliedEvent, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, snapshotUsable, type PartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { partnerId } from '@/lib/logic/partnerTrack'
import { pendingSignal, signalIdOf } from '@/lib/logic/signals'
import { createMockTransport, memoryChannel, memoryStorage, MOCK_SYNC_KEY, parseMockStore } from '@/lib/sync/mockTransport'
import type { AppState, ISODate } from '@/lib/types'
import {
  LINK_DAYS,
  LINK_PATH,
  isToken,
  linkDaysLeft,
  linkExpiry,
  linkStatus,
  makeLink,
  newCoupleId,
  parseLinkRecord,
  randomToken,
  revokeLinkRecord,
  revokeMockToken,
  shareText,
  shareURL,
  toBase64Url,
  tokenFromHash,
} from '@/lib/useLinkSync'

const TODAY: ISODate = '2026-10-02'
const NOW = '2026-10-02T14:03:00+09:00'
const seq = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)

// ── The record ──────────────────────────────────────────────

describe('link token', () => {
  it('toBase64Url: 16 random bytes become 22 url-safe characters (no padding, no + or /)', () => {
    expect(toBase64Url(new Uint8Array([0, 0, 0]))).toBe('AAAA')
    expect(toBase64Url(new Uint8Array([255, 255, 255]))).toBe('____')
    expect(toBase64Url(new Uint8Array([251, 255]))).toBe('-_8')
    const t = randomToken(seq)
    expect(t).toHaveLength(22)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(isToken(t)).toBe(true)
    // 128 bits of entropy: two draws from the real generator differ.
    expect(randomToken()).not.toBe(randomToken())
    expect(randomToken()).toHaveLength(22)
  })

  it('isToken: the server wants at least 16 characters, and only url-safe ones', () => {
    expect(isToken('short')).toBe(false)
    expect(isToken('a'.repeat(16))).toBe(true)
    expect(isToken('a'.repeat(129))).toBe(false)
    expect(isToken('has space here 12345')).toBe(false)
    expect(isToken(42)).toBe(false)
  })

  it('newCoupleId is a v4 uuid', () => {
    expect(newCoupleId(seq)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newCoupleId()).not.toBe(newCoupleId())
  })

  it('linkExpiry keeps the time of day and the offset, LINK_DAYS later', () => {
    expect(linkExpiry(NOW)).toBe('2026-11-01T14:03:00+09:00')
    expect(linkExpiry('2026-12-20T09:00:00+09:00', 30)).toBe('2027-01-19T09:00:00+09:00')
    expect(LINK_DAYS).toBe(30)
  })

  it('makeLink: a fresh token and expiry; a rotation keeps the couple id', () => {
    const first = makeLink(null, NOW, seq)
    expect(first.token).toBe(randomToken(seq))
    expect(first.createdAt).toBe(NOW)
    expect(first.expiresAt).toBe(linkExpiry(NOW))
    expect(first.revokedAt).toBeUndefined()
    const second = makeLink(first, '2026-10-05T08:00:00+09:00')
    expect(second.coupleId).toBe(first.coupleId)
    expect(second.token).not.toBe(first.token)
    expect(second.expiresAt).toBe('2026-11-04T08:00:00+09:00')
    // A revoked record still hands its couple id on (events keep their home).
    expect(makeLink(revokeLinkRecord(first, NOW), NOW).coupleId).toBe(first.coupleId)
  })

  it('linkStatus / linkDaysLeft: active until the expiry minute, then expired; revoked wins', () => {
    const link = makeLink(null, NOW)
    expect(linkStatus(null, NOW)).toBe('none')
    expect(linkStatus(link, NOW)).toBe('active')
    expect(linkStatus(link, '2026-11-01T14:02:59+09:00')).toBe('active')
    expect(linkStatus(link, '2026-11-01T14:03:00+09:00')).toBe('expired')
    expect(linkStatus(link, '2027-01-01T00:00:00+09:00')).toBe('expired')
    expect(linkStatus(revokeLinkRecord(link, NOW), NOW)).toBe('revoked')
    expect(linkDaysLeft(link, NOW)).toBe(30)
    expect(linkDaysLeft(link, '2026-10-31T23:00:00+09:00')).toBe(1)
    expect(linkDaysLeft(link, '2026-11-01T09:00:00+09:00')).toBe(0)
    expect(linkDaysLeft(link, '2026-12-01T09:00:00+09:00')).toBe(0)
  })

  it('revokeLinkRecord is idempotent', () => {
    const link = makeLink(null, NOW)
    const once = revokeLinkRecord(link, NOW)
    expect(once.revokedAt).toBe(NOW)
    expect(revokeLinkRecord(once, '2026-10-03T00:00:00+09:00')).toBe(once)
  })

  it('parseLinkRecord: the stored shape only; anything else reads as no link', () => {
    const link = makeLink(null, NOW, seq)
    expect(parseLinkRecord(JSON.stringify(link))).toEqual(link)
    expect(parseLinkRecord(JSON.stringify(revokeLinkRecord(link, NOW)))).toEqual(revokeLinkRecord(link, NOW))
    expect(parseLinkRecord(null)).toBeNull()
    expect(parseLinkRecord('')).toBeNull()
    expect(parseLinkRecord('not json')).toBeNull()
    expect(parseLinkRecord('[]')).toBeNull()
    expect(parseLinkRecord(JSON.stringify({ ...link, token: 'short' }))).toBeNull()
    expect(parseLinkRecord(JSON.stringify({ ...link, coupleId: '' }))).toBeNull()
    expect(parseLinkRecord(JSON.stringify({ ...link, expiresAt: 'tomorrow' }))).toBeNull()
    // An odd revokedAt is dropped rather than failing the record.
    expect(parseLinkRecord(JSON.stringify({ ...link, revokedAt: 5 }))).toEqual(link)
    // Extra keys never ride along.
    expect(parseLinkRecord(JSON.stringify({ ...link, secret: 'x' }))).toEqual(link)
  })

  it('shareURL puts the token in the hash of the /link/ page; tokenFromHash reads it back', () => {
    const t = randomToken(seq)
    const url = shareURL('https://dulset.app/', t)
    expect(url).toBe(`https://dulset.app${LINK_PATH}#t=${t}`)
    expect(url).not.toContain('?t=')
    const hash = url.slice(url.indexOf('#'))
    expect(tokenFromHash(hash)).toBe(t)
    expect(tokenFromHash(`t=${t}`)).toBe(t)
    expect(tokenFromHash(`#x=1&t=${t}`)).toBe(t)
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#today')).toBeNull()
    expect(tokenFromHash('#t=short')).toBeNull()
    expect(tokenFromHash('#t=' + 'a'.repeat(200))).toBeNull()
  })

  it('the share text is 해요체 and names the partner without a health word', () => {
    const text = shareText('민수')
    expect(text).toContain('민수님')
    expect(text).toMatch(/요\.$/)
    expect(text).not.toMatch(/가임기|배란|LH|생리|임신/)
  })
})

// ── The page's view model ───────────────────────────────────

function demo(): { state: AppState; snapshot: PartnerSnapshot } {
  const state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
  const snapshot = buildPartnerSnapshot(state, TODAY, partnerId(state))!
  expect(snapshot).not.toBeNull()
  return { state, snapshot }
}

describe('partner page view model', () => {
  it('ownerOf / viewerOf read the snapshot members', () => {
    const { snapshot } = demo()
    expect(ownerOf(snapshot).id).toBe(snapshot.cycleOwner)
    expect(viewerOf(snapshot).id).toBe(snapshot.viewer)
    expect(ownerOf(snapshot).id).not.toBe(viewerOf(snapshot).id)
  })

  it('a local check mark shows as done and recounts the daily row; weekly rows never count', () => {
    const { snapshot } = demo()
    const daily = snapshot.checks.items.filter((i) => !i.weekly && !i.done)
    expect(daily.length).toBeGreaterThan(0)
    const item = daily[0]!
    const marks = { ...NO_MARKS, checks: { [item.id]: { done: true, at: 1_000 } } }
    const view = viewChecks(snapshot.checks, marks)
    expect(view.items.find((i) => i.id === item.id)?.done).toBe(true)
    expect(view.done).toBe(snapshot.checks.done + 1)
    expect(view.total).toBe(snapshot.checks.total)
    expect(view.complete).toBe(view.done === view.total)
    // Unmarked rows are the same objects (nothing else is touched).
    for (const i of view.items) if (i.id !== item.id) expect(i).toBe(snapshot.checks.items.find((s) => s.id === i.id))
  })

  it('pruneMarks drops a mark the snapshot confirms, keeps a fresh disagreeing one, drops an expired one', () => {
    const { snapshot } = demo()
    const item = snapshot.checks.items.find((i) => !i.done)!
    const marks = { ...NO_MARKS, checks: { [item.id]: { done: true, at: 1_000 } } }
    // Not confirmed yet, fresh: kept.
    expect(pruneMarks(marks, snapshot, 2_000).checks[item.id]).toBeDefined()
    // Expired without confirmation (the event was rejected): gone.
    expect(pruneMarks(marks, snapshot, 1_000 + MARK_TTL_MS).checks[item.id]).toBeUndefined()
    // Confirmed by the snapshot: gone (the snapshot carries it now).
    const confirmed: PartnerSnapshot = {
      ...snapshot,
      checks: { ...snapshot.checks, items: snapshot.checks.items.map((i) => (i.id === item.id ? { ...i, done: true } : i)) },
    }
    expect(pruneMarks(marks, confirmed, 2_000).checks[item.id]).toBeUndefined()
    // No snapshot yet: fresh marks stay.
    expect(pruneMarks(marks, null, 2_000).checks[item.id]).toBeDefined()
  })

  it('the task, the reply, 콕 and the day’s signals follow their marks', () => {
    const { snapshot } = demo()
    const now = 5_000
    const task = snapshot.task
    if (task) {
      expect(viewTask(snapshot, NO_MARKS)).toEqual({ task, done: false })
      const marks = { ...NO_MARKS, task: { id: task.id, at: now } }
      expect(viewTask(snapshot, marks)?.done).toBe(true)
      // The snapshot moved on to the next task: the mark is dropped.
      const next: PartnerSnapshot = { ...snapshot, task: { ...task, id: 'another' } }
      expect(pruneMarks(marks, next, now).task).toBeUndefined()
      expect(pruneMarks(marks, snapshot, now).task).toEqual(marks.task)
    }
    const sig = snapshot.signal
    if (sig?.signalId) {
      expect(viewSignal(snapshot, NO_MARKS)).toEqual(sig)
      const marks = { ...NO_MARKS, reply: { signalId: sig.signalId, at: now } }
      expect(viewSignal(snapshot, marks)).toBeUndefined()
      expect(viewSignalsLeft(snapshot, marks)).toBe(Math.max(0, snapshot.signalsLeft - 1))
      const answered: PartnerSnapshot = { ...snapshot, signal: undefined }
      expect(pruneMarks(marks, answered, now).reply).toBeUndefined()
      // Once her phone has applied the reply (the signal is gone, signalsLeft counts it), the local mark no longer subtracts.
      expect(viewSignalsLeft(answered, marks)).toBe(snapshot.signalsLeft)
    }
    expect(viewSignalsLeft(snapshot, { ...NO_MARKS, signals: [now, now, now, now, now, now] })).toBe(0)
    expect(viewCanNudge(snapshot, NO_MARKS)).toBe(snapshot.owner.canNudge)
    expect(viewCanNudge(snapshot, { ...NO_MARKS, nudge: { at: now } })).toBe(false)
    const noNudge: PartnerSnapshot = { ...snapshot, owner: { ...snapshot.owner, canNudge: false } }
    expect(pruneMarks({ ...NO_MARKS, nudge: { at: now } }, noNudge, now).nudge).toBeUndefined()
  })

  it('parseCachedView accepts only a snapshot of this version', () => {
    const { snapshot } = demo()
    const ok = { token: randomToken(seq), snapshot, at: 123 }
    expect(parseCachedView(JSON.stringify(ok))).toEqual(ok)
    expect(parseCachedView(null)).toBeNull()
    expect(parseCachedView('{}')).toBeNull()
    expect(parseCachedView(JSON.stringify({ ...ok, snapshot: { ...snapshot, version: 2 } }))).toBeNull()
    expect(parseCachedView(JSON.stringify({ ...ok, at: 'x' }))).toBeNull()
  })

  it('the notices are calm, 해요체, name the owner when known, and carry no health word', () => {
    for (const kind of ['expired', 'nolink', 'stale', 'offline'] as const) {
      const c = noticeCopy(kind, '지은')
      expect(`${c.title} ${c.body}`).not.toMatch(/가임기|배란|LH|생리|임신|테스트/)
      expect(c.body).toMatch(/요\.$/)
    }
    expect(noticeCopy('expired', '지은')).toEqual({ title: '링크가 만료됐어요', body: '지은님에게 새 링크를 받아 주세요.' })
    expect(noticeCopy('expired').body).toBe('상대에게 새 링크를 받아 주세요.')
  })
})

// ── Round trip over the mock transport ──────────────────────

describe('owner ⇄ partner page over the mock transport', () => {
  function twoTabs() {
    const storage = memoryStorage()
    const channel = memoryChannel()
    let tick = 0
    const now = () => `2026-10-02T15:00:${String(tick++).padStart(2, '0')}+09:00`
    const owner = createMockTransport({ storage, channel, now })
    const page = createMockTransport({ storage, channel, now })
    return { storage, owner, page }
  }

  it('publish → fetch → check event → pull/apply (once) → republish → the page sees it done; revoke → null', async () => {
    const { storage, owner, page } = twoTabs()
    let state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
    const partner = partnerId(state)
    const link = makeLink(null, NOW)

    // Owner's phone: publish the snapshot under the link's token.
    const snap1 = buildPartnerSnapshot(state, TODAY, partner)!
    await owner.publishSnapshot(link.coupleId, link.token, snap1)

    // Partner page: fetch with the token from the URL hash.
    const url = shareURL('http://localhost', link.token)
    const token = tokenFromHash(url.slice(url.indexOf('#')))
    expect(token).toBe(link.token)
    const seen = await page.fetchSnapshot(token!)
    expect(seen).toEqual(snap1)
    expect(snapshotUsable(seen, TODAY)).toBe(true)
    // The page never gets the state: nothing of hers beyond the projection.
    expect(JSON.stringify(seen)).not.toMatch(/"periods"|"lhTests"|"pregnancyTests"|"personalLog"|"intimacy"/)

    // A tap on his first unchecked daily row.
    const item =
      activeItems(state, partner).find((i) => !isDone(state, partner, TODAY, i.id) && i.kind !== 'habit') ??
      activeItems(state, partner).find((i) => !isDone(state, partner, TODAY, i.id))!
    expect(item).toBeDefined()
    const ev: PartnerEvent = { id: 'tap-1', from: partner, kind: 'check', itemId: item.id, date: TODAY, done: true }
    await page.sendEvent(token!, ev)
    // The same tap again (a retry) is one event.
    await page.sendEvent(token!, ev)

    // Owner's phone: pull, apply once, republish.
    const events = await owner.pullEvents(link.coupleId, '')
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(ev)
    const fresh = events.filter((e) => !hasAppliedEvent(state, e.id))
    expect(fresh).toHaveLength(1)
    state = applyPartnerEvents(state, fresh, TODAY)
    expect(isDone(state, partner, TODAY, item.id)).toBe(true)
    expect(hasAppliedEvent(state, ev.id)).toBe(true)
    // A later pull returns the same event; it is no longer fresh and applying it changes nothing.
    const again = await owner.pullEvents(link.coupleId, '')
    expect(again.filter((e) => !hasAppliedEvent(state, e.id))).toHaveLength(0)
    expect(applyPartnerEvents(state, again, TODAY)).toBe(state)

    const snap2 = buildPartnerSnapshot(state, TODAY, partner)!
    await owner.publishSnapshot(link.coupleId, link.token, snap2)
    const seen2 = (await page.fetchSnapshot(token!))!
    expect(seen2.checks.items.find((i) => i.id === item.id)?.done).toBe(true)
    expect(seen2.checks.done).toBe(snap1.checks.done + 1)

    // A reply to her pending signal, if there is one, goes the same way.
    const pending = pendingSignal(state, partner, TODAY)
    if (pending && seen2.signal?.replies.length) {
      const reply: PartnerEvent = {
        id: 'tap-2',
        from: partner,
        kind: 'reply',
        signalId: signalIdOf(pending)!,
        replyId: seen2.signal.replies[0]!.id,
      }
      await page.sendEvent(token!, reply)
      const evs = await owner.pullEvents(link.coupleId, '')
      state = applyPartnerEvents(state, evs, TODAY)
      expect(pendingSignal(state, partner, TODAY)).toBeUndefined()
      const snap3 = buildPartnerSnapshot(state, TODAY, partner)!
      expect(snap3.signal).toBeUndefined()
    }

    // 설정 › 연결 → 링크 해제: the mock forgets the token; the page sees nothing → '링크가 만료됐어요'.
    expect(revokeMockToken(storage, link.token)).toBe(true)
    expect(await page.fetchSnapshot(token!)).toBeNull()
    expect(revokeMockToken(storage, link.token)).toBe(false)
    // The snapshot and the events stay (a new link for the same couple continues).
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    expect(store.snapshots[link.coupleId]).toBeDefined()
    expect(store.tokens[link.token]).toBeUndefined()
    // A page event with the dead token is refused.
    await expect(page.sendEvent(token!, { id: 'tap-9', kind: 'cheer' })).rejects.toThrow()

    // A rotation: a new token for the same couple; the new link sees the latest snapshot.
    const rotated = makeLink(link, '2026-10-03T09:00:00+09:00')
    expect(rotated.coupleId).toBe(link.coupleId)
    await owner.publishSnapshot(rotated.coupleId, rotated.token, snap2)
    expect(await page.fetchSnapshot(rotated.token)).toEqual(snap2)
    expect(await page.fetchSnapshot(link.token)).toBeNull()
  })

  it('a stale snapshot (her phone silent past validUntil) is not shown as current', () => {
    const { snapshot } = demo()
    expect(snapshotUsable(snapshot, TODAY)).toBe(true)
    expect(snapshotUsable(snapshot, addDays(TODAY, 1))).toBe(true)
    expect(snapshotUsable(snapshot, addDays(TODAY, 2))).toBe(false)
  })

  it('an unknown token reads as nothing (no error, no data) on the mock', async () => {
    const { page } = twoTabs()
    expect(await page.fetchSnapshot(randomToken())).toBeNull()
  })
})
