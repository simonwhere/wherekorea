// The partner link (Next A ①): the link record and its token
// (lib/useLinkSync — the pure half), the partner page's view model
// (components/link/model), and the whole round trip over the mock
// transport: the owner publishes, the page fetches, a tap becomes an event,
// the owner applies it with the same gates as the app and republishes, the
// page sees it; a revoke or an expired link shows the calm notice.

import { describe, expect, it } from 'vitest'
import {
  devicePlatform,
  inAppBrowser,
  installSteps,
  kakaoExternalURL,
  noticeCopy,
  parseCachedView,
  parseDeviceMark,
  prepParts,
  pruneMarks,
  setupFields,
  thanksText,
  viewCanNudge,
  viewChecks,
  viewSignal,
  viewSignalsLeft,
  viewTask,
  viewWeek,
  LINK_INSTALL_KEY,
  LINK_INTRO_KEY,
  LINK_OUTSIDE_KEY,
  LINK_VIEW_KEY,
  NO_MARKS,
  MARK_TTL_MS,
  ownerOf,
  viewerOf,
} from '@/components/link/model'
import { addDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { activeItems, isDone } from '@/lib/logic/checks'
import { hasAppliedEvent, type PartnerEvent } from '@/lib/logic/partnerEvents'
import {
  applyReceivedEvents,
  buildPartnerSnapshot,
  snapshotDay,
  snapshotUsable,
  type PartnerPage,
  type PartnerSnapshot,
} from '@/lib/logic/partnerSnapshot'
import { alertStyleOf } from '@/lib/logic/settings'
import { partnerId } from '@/lib/logic/partnerTrack'
import { pendingSignal, signalIdOf } from '@/lib/logic/signals'
import { thankWeek, weekDone, weekOf, weekPick } from '@/lib/logic/weekTogether'
import { createMockTransport, memoryChannel, memoryStorage, MOCK_SYNC_KEY, parseMockStore, pinnedNowISO } from '@/lib/sync/mockTransport'
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
  pullSince,
  PULL_WINDOW_DAYS,
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

/** The demo couple's snapshot, and the page the link draws for TODAY (`snapshot` below is that page). */
function demo(): { state: AppState; full: PartnerSnapshot; snapshot: PartnerPage } {
  const state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
  const full = buildPartnerSnapshot(state, TODAY, partnerId(state))!
  expect(full).not.toBeNull()
  const snapshot = snapshotDay(full, TODAY)!
  expect(snapshot).not.toBeNull()
  return { state, full, snapshot }
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
    const confirmed: PartnerPage = {
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
      const next: PartnerPage = { ...snapshot, task: { ...task, id: 'another' } }
      expect(pruneMarks(marks, next, now).task).toBeUndefined()
      expect(pruneMarks(marks, snapshot, now).task).toEqual(marks.task)
    }
    const sig = snapshot.signal
    if (sig?.signalId) {
      expect(viewSignal(snapshot, NO_MARKS)).toEqual(sig)
      const marks = { ...NO_MARKS, reply: { signalId: sig.signalId, at: now } }
      expect(viewSignal(snapshot, marks)).toBeUndefined()
      expect(viewSignalsLeft(snapshot, marks)).toBe(Math.max(0, snapshot.signalsLeft - 1))
      const answered: PartnerPage = { ...snapshot, signal: undefined }
      expect(pruneMarks(marks, answered, now).reply).toBeUndefined()
      // Once her phone has applied the reply (the signal is gone, signalsLeft counts it), the local mark no longer subtracts.
      expect(viewSignalsLeft(answered, marks)).toBe(snapshot.signalsLeft)
    }
    expect(viewSignalsLeft(snapshot, { ...NO_MARKS, signals: [now, now, now, now, now, now] })).toBe(0)
    expect(viewCanNudge(snapshot, NO_MARKS)).toBe(snapshot.owner.canNudge)
    expect(viewCanNudge(snapshot, { ...NO_MARKS, nudge: { at: now } })).toBe(false)
    const noNudge: PartnerPage = { ...snapshot, owner: { ...snapshot.owner, canNudge: false } }
    expect(pruneMarks({ ...NO_MARKS, nudge: { at: now } }, noNudge, now).nudge).toBeUndefined()
  })

  it('parseCachedView accepts only a seven-day snapshot of this version (the v1 cache key and shape are left behind)', () => {
    const { full } = demo()
    expect(LINK_VIEW_KEY).toBe('dulset:link-view:v2')
    const ok = { token: randomToken(seq), snapshot: full, at: 123 }
    expect(parseCachedView(JSON.stringify(ok))).toEqual(ok)
    expect(parseCachedView(null)).toBeNull()
    expect(parseCachedView('{}')).toBeNull()
    expect(parseCachedView(JSON.stringify({ ...ok, snapshot: { ...full, version: 1 } }))).toBeNull()
    expect(parseCachedView(JSON.stringify({ ...ok, snapshot: { ...full, days: [] } }))).toBeNull()
    expect(parseCachedView(JSON.stringify({ ...ok, snapshot: { ...full, days: [{ date: '2026-10-02' }] } }))).toBeNull()
    const { days: _d, ...v1 } = full
    expect(parseCachedView(JSON.stringify({ ...ok, snapshot: { ...v1, ...full.days[0], version: 1 } }))).toBeNull()
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

  it('the week-over notice never puts it on her: no “쉬고 있어요”, no “앱을 열면”, and says what still works', () => {
    const c = noticeCopy('stale', '지은')
    expect(`${c.title} ${c.body}`).not.toMatch(/쉬고 있어요|앱을 열면|열어 주세요|부탁/)
    expect(c.body).toContain('지은님 폰이 열리면 다시 채워져요')
    expect(c.body).toContain('신호와 응원')
  })
})

describe('이번 주 우리 둘 on the page (N21)', () => {
  it('a pick and [했어요] show at once as local marks and drop when the snapshot agrees', () => {
    const { snapshot } = demo()
    const w = snapshot.week!
    expect(w).toBeDefined()
    // The demo's 민수 already picked and did this week's one; take a fresh week view.
    const open: PartnerPage = { ...snapshot, week: { ...w, pick: undefined, done: false, doneText: undefined } }
    const id = w.options[2]!.id
    const marks = { ...NO_MARKS, weekPick: { monday: w.monday, optionId: id, at: 1_000 } }
    expect(viewWeek(open, marks)!.pick).toBe(id)
    expect(viewWeek(open, marks)!.done).toBe(false)
    const doneMarks = { ...marks, weekDone: { monday: w.monday, at: 1_100 } }
    expect(viewWeek(open, doneMarks)!.done).toBe(true)
    // A mark for another week (or an option not offered) changes nothing.
    expect(viewWeek(open, { ...NO_MARKS, weekPick: { monday: '2020-01-06', optionId: id, at: 1 } })!.pick).toBeUndefined()
    expect(viewWeek(open, { ...NO_MARKS, weekPick: { monday: w.monday, optionId: 'nope' as never, at: 1 } })!.pick).toBeUndefined()
    // The snapshot agrees: the marks go; it never did: they expire.
    const agreed: PartnerPage = { ...open, week: { ...open.week!, pick: id, done: true, doneText: '…' } }
    expect(pruneMarks(doneMarks, agreed, 2_000).weekPick).toBeUndefined()
    expect(pruneMarks(doneMarks, agreed, 2_000).weekDone).toBeUndefined()
    expect(pruneMarks(doneMarks, open, 2_000).weekPick).toEqual(doneMarks.weekPick)
    expect(pruneMarks(doneMarks, open, 1_000 + MARK_TTL_MS).weekPick).toBeUndefined()
    // No week (the quiet, another stage): nothing to show.
    expect(viewWeek({ week: undefined }, doneMarks)).toBeNull()
  })

  it('내 준비 and 지은님에게서 read as one short line each, never a zero', () => {
    expect(prepParts(undefined)).toEqual([])
    expect(prepParts({})).toEqual([])
    expect(prepParts({ habit: 'D+40', week: 3, chain: '신청했어요, 다음은 검사' })).toEqual([
      '건강 습관 D+40',
      '이번 주 3/7',
      '신청했어요, 다음은 검사',
    ])
    expect(prepParts({ week: 0 })).toEqual([])
    expect(prepParts({ habit: 'D+95', habitReached: true })[0]).toContain('약 3개월')
    expect(thanksText('지은', '2026-09-22')).toBe('지은님이 고마워했어요 (화)')
  })
})

describe('the link’s first 30 seconds (N22)', () => {
  it('setup sends only what he answered, and nothing when he answered nothing', () => {
    expect(setupFields({})).toBeNull()
    expect(setupFields({ smokes: false })).toEqual({ habits: { smokes: false } })
    expect(setupFields({ drinks: 'no', alertStyle: 'soft' })).toEqual({ habits: { drinks: 'no' }, alertStyle: 'soft' })
    expect(setupFields({ alertStyle: 'off' })).toEqual({ habits: {}, alertStyle: 'off' })
  })

  it('the per-device marks read {at} only; the keys start with dulset: so a wipe clears them', () => {
    for (const k of [LINK_INTRO_KEY, LINK_INSTALL_KEY, LINK_OUTSIDE_KEY]) expect(k.startsWith('dulset:')).toBe(true)
    expect(parseDeviceMark(JSON.stringify({ at: 5 }))).toEqual({ at: 5 })
    for (const bad of [null, '', 'x', '[]', '{}', JSON.stringify({ at: 'x' }), JSON.stringify({ at: null })]) expect(parseDeviceMark(bad)).toBeNull()
  })

  it('knows 카카오톡 and other in-app browsers from a real one, and the phone’s steps to the home screen', () => {
    const kakaoIOS =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.1'
    const kakaoAndroid =
      'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36;KAKAOTALK 2410900'
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    const chrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
    const naver = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.6.1)'
    const insta = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0'
    expect(inAppBrowser(kakaoIOS)).toBe('kakao')
    expect(inAppBrowser(kakaoAndroid)).toBe('kakao')
    expect(inAppBrowser(naver)).toBe('naver')
    expect(inAppBrowser(insta)).toBe('instagram')
    expect(inAppBrowser(safari)).toBeNull()
    expect(inAppBrowser(chrome)).toBeNull()
    expect(devicePlatform(kakaoIOS)).toBe('ios')
    expect(devicePlatform(chrome)).toBe('android')
    expect(devicePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
    expect(devicePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other')
    expect(installSteps('ios').join(' ')).toContain('사파리')
    expect(installSteps('android').join(' ')).toContain('크롬')
    expect(installSteps('other')).toHaveLength(2)
    // The way out keeps the whole address, the token's hash included.
    const url = 'https://dulset.app/link/#t=abcdefghijklmnop1234'
    expect(kakaoExternalURL(url)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`)
    expect(decodeURIComponent(kakaoExternalURL(url).split('url=')[1]!)).toBe(url)
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

  /** Her phone's pull-and-apply step (lib/useLinkSync): fresh events, each on the day it was taken in. */
  async function pullApply(t: ReturnType<typeof createMockTransport>, coupleId: string, state: AppState, today: ISODate) {
    const received = await t.pullReceived(coupleId, pullSince(today, new Date(`${today}T23:00:00+09:00`).getTime()))
    const fresh = received.filter((r) => !hasAppliedEvent(state, r.event.id))
    return applyReceivedEvents(state, fresh, today)
  }

  it('publish → fetch → check event → pull/apply (once) → republish → the page sees it done; revoke → null', async () => {
    const { storage, owner, page } = twoTabs()
    let state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
    const partner = partnerId(state)
    const link = makeLink(null, NOW)

    // Owner's phone: publish the snapshot (seven days) under the link's token.
    const snap1 = buildPartnerSnapshot(state, TODAY, partner)!
    await owner.publishSnapshot(link.coupleId, link.token, snap1)

    // Partner page: fetch with the token from the URL hash, draw its own date.
    const url = shareURL('http://localhost', link.token)
    const token = tokenFromHash(url.slice(url.indexOf('#')))
    expect(token).toBe(link.token)
    const seen = await page.fetchSnapshot(token!)
    expect(seen).toEqual(snap1)
    expect(snapshotUsable(seen, TODAY)).toBe(true)
    const view1 = snapshotDay(seen, TODAY)!
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
    const received = await owner.pullReceived(link.coupleId, '')
    expect(received.map((r) => r.event)).toEqual([ev])
    expect(received[0]!.receivedAt.startsWith(TODAY)).toBe(true)
    state = await pullApply(owner, link.coupleId, state, TODAY)
    expect(isDone(state, partner, TODAY, item.id)).toBe(true)
    expect(hasAppliedEvent(state, ev.id)).toBe(true)
    // A later pull returns the same event; applying it changes nothing.
    expect(await pullApply(owner, link.coupleId, state, TODAY)).toBe(state)

    const snap2 = buildPartnerSnapshot(state, TODAY, partner)!
    await owner.publishSnapshot(link.coupleId, link.token, snap2)
    const view2 = snapshotDay((await page.fetchSnapshot(token!))!, TODAY)!
    expect(view2.checks.items.find((i) => i.id === item.id)?.done).toBe(true)
    expect(view2.checks.done).toBe(view1.checks.done + 1)

    // A reply to her pending signal, if there is one, goes the same way.
    const pending = pendingSignal(state, partner, TODAY)
    if (pending && view2.signal?.replies.length) {
      const reply: PartnerEvent = {
        id: 'tap-2',
        from: partner,
        kind: 'reply',
        signalId: signalIdOf(pending)!,
        replyId: view2.signal.replies[0]!.id,
      }
      await page.sendEvent(token!, reply)
      state = await pullApply(owner, link.coupleId, state, TODAY)
      expect(pendingSignal(state, partner, TODAY)).toBeUndefined()
      expect(buildPartnerSnapshot(state, TODAY, partner)!.days[0]!.signal).toBeUndefined()
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

  it('her phone stays closed: the page keeps drawing the right day for a week, and his taps still count when it opens', async () => {
    const storage = memoryStorage()
    const channel = memoryChannel()
    let state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
    const partner = partnerId(state)
    const link = makeLink(null, NOW)
    const owner = createMockTransport({ storage, channel, now: () => `${TODAY}T10:00:00+09:00` })
    const snap = buildPartnerSnapshot(state, TODAY, partner)!
    await owner.publishSnapshot(link.coupleId, link.token, snap)

    // His days pass; each day the page draws that day's page from the same snapshot.
    const later = addDays(TODAY, 3)
    let clock = `${later}T21:00:00+09:00`
    const page = createMockTransport({ storage, channel, now: () => clock })
    const fetched = (await page.fetchSnapshot(link.token))!
    for (let k = 0; k <= 6; k++) expect(snapshotDay(fetched, addDays(TODAY, k))!.date).toBe(addDays(TODAY, k))
    const view = snapshotDay(fetched, later)!
    expect(view.date).toBe(later)
    // He ticks a row on day +3 …
    const item = view.checks.items.find((i) => !i.done && !i.weekly)!
    await page.sendEvent(link.token, { id: 'late-tap', from: partner, kind: 'check', itemId: item.id, date: later, done: true })
    // … and answers 응원 on day +4.
    clock = `${addDays(TODAY, 4)}T08:00:00+09:00`
    await page.sendEvent(link.token, { id: 'late-cheer', from: partner, kind: 'cheer' })
    // After the week the page has nothing for its date (the calm '새 화면은 곧 채워져요').
    expect(snapshotDay(fetched, addDays(TODAY, 7))).toBeNull()

    // Her phone opens on day +6: both count, each on the day it arrived.
    const opens = addDays(TODAY, 6)
    state = await pullApply(owner, link.coupleId, state, opens)
    expect(isDone(state, partner, later, item.id)).toBe(true)
    expect(state.decisions['partner-event:late-tap']).toBe(later)
    expect(state.decisions['partner-event:late-cheer']).toBe(addDays(TODAY, 4))
  })

  it('이번 주 우리 둘 and the first-run setup travel as events and come back in the next snapshot', async () => {
    const { owner, page } = twoTabs()
    // A Monday; the demo's own pick for the week is taken out so the week starts empty.
    const monday = '2026-10-05'
    const demoState = createDemoState(monday, new Date(`${monday}T10:00:00+09:00`), 'preparing')
    let state: AppState = {
      ...demoState,
      decisions: Object.fromEntries(Object.entries(demoState.decisions).filter(([k]) => !k.startsWith('week-'))),
    }
    const partner = partnerId(state)
    const link = makeLink(null, `${monday}T10:00:00+09:00`)
    await owner.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, monday, partner)!)
    const view = snapshotDay((await page.fetchSnapshot(link.token))!, monday)!
    const w = view.week!
    expect(w.options).toHaveLength(3)
    expect(w.pick).toBeUndefined()

    await page.sendEvent(link.token, { id: 'wp', from: partner, kind: 'week-pick', optionId: w.options[0]!.id, date: monday })
    await page.sendEvent(link.token, { id: 'wd', from: partner, kind: 'week-done', date: monday })
    await page.sendEvent(link.token, { id: 'su', from: partner, kind: 'setup', habits: { smokes: false, drinks: 'sometimes' }, alertStyle: 'off' })
    state = await pullApply(owner, link.coupleId, state, monday)
    expect(weekPick(state, weekOf(monday), partner)?.id).toBe(w.options[0]!.id)
    expect(weekDone(state, weekOf(monday), partner)).toBe(monday)
    expect(alertStyleOf(state, partner)).toBe('off')
    // Her [고마워요] reaches his card.
    state = thankWeek(state, state.couple.members.find((m) => m.id !== partner)!.id, monday)
    await owner.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, monday, partner)!)
    const after = snapshotDay((await page.fetchSnapshot(link.token))!, monday)!
    expect(after.week).toMatchObject({ pick: w.options[0]!.id, done: true, thanks: monday })
  })

  it('a snapshot is good for the seven days it carries, not one more', () => {
    const { full } = demo()
    expect(snapshotUsable(full, TODAY)).toBe(true)
    expect(snapshotUsable(full, addDays(TODAY, 6))).toBe(true)
    expect(snapshotUsable(full, addDays(TODAY, 7))).toBe(false)
  })

  it('an unknown token reads as nothing (no error, no data) on the mock', async () => {
    const { page } = twoTabs()
    expect(await page.fetchSnapshot(randomToken())).toBeNull()
  })

  it('링크 연 날: the page records the day with the token only; the counter counts days, not loads; nothing for a dead token', async () => {
    const { storage, owner, page } = twoTabs()
    const state = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), 'preparing')
    const link = makeLink(null, NOW)
    await owner.publishSnapshot(link.coupleId, link.token, buildPartnerSnapshot(state, TODAY, partnerId(state))!)
    await page.recordLinkOpen(link.token, TODAY)
    await page.recordLinkOpen(link.token, TODAY)
    await page.recordLinkOpen(link.token, addDays(TODAY, 2))
    await page.recordLinkOpen(randomToken(), TODAY)
    await page.recordLinkOpen(link.token, 'not-a-day')
    expect(await owner.linkOpenDays(link.coupleId, TODAY, addDays(TODAY, 6))).toBe(2)
    expect(await owner.linkOpenDays(link.coupleId, addDays(TODAY, 1), addDays(TODAY, 6))).toBe(1)
    expect(await owner.linkOpenDays('another-couple', TODAY, addDays(TODAY, 6))).toBe(0)
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    expect(store.opens[link.coupleId]).toEqual({ [TODAY]: 2, [addDays(TODAY, 2)]: 1 })
    // Nothing but the couple, the day and the count.
    expect(JSON.stringify(store.opens)).not.toContain(link.token)
    revokeMockToken(storage, link.token)
    await page.recordLinkOpen(link.token, addDays(TODAY, 3))
    expect(await owner.linkOpenDays(link.coupleId, TODAY, addDays(TODAY, 6))).toBe(2)
  })

  it('the mock stamps events on the page’s ?today= date; the pull window covers the pin and the clock', () => {
    expect(pinnedNowISO('?today=2026-09-20').startsWith('2026-09-20T')).toBe(true)
    expect(pinnedNowISO('?today=nope').startsWith('2026-')).toBe(true)
    expect(pinnedNowISO('').length).toBeGreaterThan(19)
    const now = new Date('2026-10-03T12:00:00+09:00').getTime()
    expect(pullSince('2026-10-03', now).startsWith(addDays('2026-10-03', -PULL_WINDOW_DAYS))).toBe(true)
    // A pin far behind the clock: the window reaches back from the pin.
    expect(pullSince('2026-09-01', now).startsWith('2026-08-25')).toBe(true)
    // A pin ahead of the clock: the window still reaches back from the clock.
    expect(pullSince('2026-12-01', now).startsWith('2026-09-26')).toBe(true)
  })
})
