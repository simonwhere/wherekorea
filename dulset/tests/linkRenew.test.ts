// The partner link renews itself while 둘셋 is in use (founder decision
// 2026-10-17, "추천대로 1~3번 다 진행해줘" ①). Before, a link died 30 days after
// it was made — e.g. inside the 42 quiet days after a loss. Now:
//  • lib/logic/partnerLink.renewedExpiry — an active link's expiry moves to
//    LINK_DAYS from today, at most once a day, never shorter, never for a
//    revoked or expired link (an expired link is not revived);
//  • Transport.extendToken — the mock and the Supabase transport renew a
//    LIVE token only (never issueToken: that would un-revoke);
//  • lib/useLinkSync.renewLinkOnTransport — what her phone runs after a
//    publish; the record takes the new expiry only when the transport took it;
//  • only HER use counts: his opens and events never move the expiry her
//    설정 › 연결 shows (that would be a read receipt — positioning §6).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, diffDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import {
  coupleLinkOf,
  LINK_DAYS,
  linkExpiry,
  linkShownStatus,
  linkStatus,
  makeLink,
  renewedExpiry,
  revokeLinkRecord,
  type LinkRecord,
} from '@/lib/logic/partnerLink'
import { buildPartnerSnapshot, snapshotDay } from '@/lib/logic/partnerSnapshot'
import { QUIET_DAYS_AFTER_END } from '@/lib/logic/pregnancy'
import { partnerId } from '@/lib/logic/partnerTrack'
import { activeRest } from '@/lib/logic/ttc'
import { endPregnancy } from '@/lib/logic/today'
import {
  createMockTransport,
  memoryChannel,
  memoryStorage,
  MOCK_SYNC_KEY,
  mockTokenExpiry,
  parseMockStore,
  type MockTransport,
} from '@/lib/sync/mockTransport'
import { createSupabaseTransport, type FetchLike } from '@/lib/sync/supabaseTransport'
import type { Transport } from '@/lib/sync/transport'
import type { AppState, ISODate } from '@/lib/types'
import { keepRenewal, LINK_KEY, readLink, renewLinkOnTransport, revokeMockToken, writeLink } from '@/lib/useLinkSync'

const ROOT = join(__dirname, '..')
const D: ISODate = '2026-10-20'
/** Her clock on a day (a fixed time of day, the device's +09:00 — what stampOn(today) gives on a phone in Seoul). */
const at = (day: ISODate, time = '09:30:00') => `${day}T${time}+09:00`
const seq = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)

// ── The helper ──────────────────────────────────────────────

describe('renewedExpiry: an active link moves to LINK_DAYS from today', () => {
  const link = makeLink(null, at(D), seq)

  it('active: the new expiry is today + LINK_DAYS with today’s time of day, as a local stamp', () => {
    expect(link.expiresAt).toBe(at(addDays(D, 30)))
    const now = at(addDays(D, 20), '21:05:00')
    expect(renewedExpiry(link, now)).toBe(at(addDays(D, 50), '21:05:00'))
    expect(renewedExpiry(link, now)).toBe(linkExpiry(now))
    expect(LINK_DAYS).toBe(30)
  })

  it('never for an expired, revoked or missing link — an expired link is not revived', () => {
    expect(renewedExpiry(link, at(addDays(D, 30)))).toBeNull() // the expiry instant itself is expired
    expect(renewedExpiry(link, at(addDays(D, 45)))).toBeNull()
    expect(renewedExpiry(revokeLinkRecord(link, at(addDays(D, 3))), at(addDays(D, 10)))).toBeNull()
    expect(renewedExpiry(null, at(D))).toBeNull()
    expect(renewedExpiry(undefined, at(D))).toBeNull()
  })

  it('at most once a day: a second open on the same day changes nothing; the next day moves it again', () => {
    const r1 = renewedExpiry(link, at(addDays(D, 20), '08:00:00'))!
    const renewed: LinkRecord = { ...link, expiresAt: r1 }
    expect(renewedExpiry(renewed, at(addDays(D, 20), '08:00:01'))).toBeNull()
    expect(renewedExpiry(renewed, at(addDays(D, 20), '23:59:59'))).toBeNull()
    expect(renewedExpiry(renewed, at(addDays(D, 21), '07:00:00'))).toBe(at(addDays(D, 51), '07:00:00'))
    // The day it was made: nothing to renew yet.
    expect(renewedExpiry(link, at(D, '23:00:00'))).toBeNull()
  })

  it('never shortens: a `?today=` pinned in the past (or a link made on a later clock) leaves the expiry alone', () => {
    expect(renewedExpiry(link, at(addDays(D, -10)))).toBeNull()
    expect(renewedExpiry(link, at(addDays(D, -400)))).toBeNull()
    const madeLater = makeLink(null, at('2026-12-01'), seq)
    expect(renewedExpiry(madeLater, at(D))).toBeNull()
    // Whatever the day, a renewal is never earlier than what it replaces.
    for (let k = -40; k <= 40; k++) {
      const r = renewedExpiry(link, at(addDays(D, k), '12:00:00'))
      if (r) expect(r > link.expiresAt).toBe(true)
    }
  })

  it('linkShownStatus: a link her phone revoked because it had expired reads as stopped, a 링크 해제 as revoked', () => {
    const expiredThenRevoked = revokeLinkRecord(link, at(addDays(D, 31)))
    expect(linkStatus(expiredThenRevoked, at(addDays(D, 31)))).toBe('revoked')
    expect(linkShownStatus(expiredThenRevoked, at(addDays(D, 31)))).toBe('expired')
    expect(linkShownStatus(expiredThenRevoked, at(addDays(D, 90)))).toBe('expired')
    const pressed = revokeLinkRecord(link, at(addDays(D, 3)))
    expect(linkShownStatus(pressed, at(addDays(D, 10)))).toBe('revoked')
    expect(linkShownStatus(link, at(addDays(D, 10)))).toBe('active')
    expect(linkShownStatus(link, at(addDays(D, 30)))).toBe('expired')
    expect(linkShownStatus(null, at(D))).toBe('none')
  })
})

// ── The mock transport ──────────────────────────────────────

function mockPair(start: string) {
  const storage = memoryStorage()
  const channel = memoryChannel()
  const clock = { now: start }
  const owner = createMockTransport({ storage, channel, now: () => clock.now, offline: () => false })
  const page = createMockTransport({ storage, channel, now: () => clock.now, offline: () => false })
  const store = () => parseMockStore(storage.getItem(MOCK_SYNC_KEY))
  return { storage, clock, owner, page, store }
}

describe('mock transport: extendToken renews a live token only', () => {
  const snap = () => {
    const s = createDemoState(D, new Date(`${D}T10:00:00+09:00`), 'preparing')
    return buildPartnerSnapshot(s, D, partnerId(s))!
  }

  it('live → the new expiry (now + days), kept on the token; never shorter', async () => {
    const { clock, owner, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    // The first publish issues it for MOCK_TOKEN_DAYS (= the server's 30).
    expect(store().tokens[link.token]!.expiresAt).toBe(at(addDays(D, 30)))
    clock.now = at(addDays(D, 20))
    expect(await owner.extendToken(link.coupleId, link.token)).toBe(at(addDays(D, 50)))
    expect(store().tokens[link.token]!.expiresAt).toBe(at(addDays(D, 50)))
    expect(await owner.extendToken(link.coupleId, link.token, 7)).toBe(at(addDays(D, 50))) // shorter → unchanged
    clock.now = at(addDays(D, 5)) // a pin in the past
    expect(await owner.extendToken(link.coupleId, link.token)).toBe(at(addDays(D, 50)))
    expect(store().tokens[link.token]!.expiresAt).toBe(at(addDays(D, 50)))
    // days are clamped like the server's (1–90).
    clock.now = at(addDays(D, 21))
    expect(await owner.extendToken(link.coupleId, link.token, 500)).toBe(at(addDays(D, 21 + 90)))
  })

  it('revoked → null, and it stays revoked (the page still reads nothing, an event is still refused)', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    await owner.revokeToken!(link.coupleId, link.token)
    clock.now = at(addDays(D, 2))
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
    expect(store().tokens[link.token]!.revokedAt).toBe(at(D))
    expect(await page.fetchSnapshot(link.token)).toBeNull()
    await expect(page.sendEvent(link.token, { id: 'e-after', kind: 'cheer' })).rejects.toThrow()
  })

  it('a publish under a revoked token is refused, as the server’s publish_snapshot (42501): it never comes back (RC-2)', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    await owner.revokeToken!(link.coupleId, link.token)
    const revoked = store().tokens[link.token]!
    // A second owner tab whose publish timer fires just after 링크 해제 in the other tab.
    clock.now = at(addDays(D, 1))
    await expect(owner.publishSnapshot(link.coupleId, link.token, snap())).rejects.toMatchObject({ code: 'unknown-token' })
    expect(store().tokens[link.token]).toEqual(revoked)
    expect(await page.fetchSnapshot(link.token)).toBeNull()
    clock.now = at(addDays(D, 3))
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
    // The counter records nothing for it; revoking again keeps the first stamp.
    await page.recordLinkOpen(link.token, addDays(D, 3))
    expect(await owner.linkOpenDays(link.coupleId, D, addDays(D, 6))).toBe(0)
    await owner.revokeToken!(link.coupleId, link.token)
    expect(store().tokens[link.token]!.revokedAt).toBe(at(D))
    // Another couple still cannot touch it.
    await expect(owner.revokeToken!('another-couple', link.token)).rejects.toMatchObject({ code: 'foreign-token' })
    await expect(owner.publishSnapshot('another-couple', link.token, snap())).rejects.toMatchObject({ code: 'foreign-token' })
  })

  it('issueToken clears the mark, as the server’s issue_token upsert (revoked_at = null)', async () => {
    const { owner, page, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    await owner.revokeToken!(link.coupleId, link.token)
    expect(await owner.issueToken!(link.coupleId, link.token)).toBe(at(addDays(D, 30)))
    expect(store().tokens[link.token]!.revokedAt).toBeUndefined()
    expect(await page.fetchSnapshot(link.token)).not.toBeNull()
  })

  it('revokeMockToken (tests and tools that hold the storage) leaves the same tombstone', async () => {
    const { owner, page, store, storage } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    expect(revokeMockToken(storage, link.token, at(addDays(D, 1)))).toBe(true)
    expect(store().tokens[link.token]!.revokedAt).toBe(at(addDays(D, 1)))
    expect(revokeMockToken(storage, link.token)).toBe(false)
    await expect(owner.publishSnapshot(link.coupleId, link.token, snap())).rejects.toThrow()
    expect(await page.fetchSnapshot(link.token)).toBeNull()
  })

  it('expired → null and the expiry stays where it ended (an expired link is never revived)', async () => {
    const { clock, owner, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    clock.now = at(addDays(D, 30)) // the expiry instant
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
    clock.now = at(addDays(D, 45))
    expect(await owner.extendToken(link.coupleId, link.token, 90)).toBeNull()
    expect(store().tokens[link.token]!.expiresAt).toBe(at(addDays(D, 30)))
  })

  // QA 2026-10-17: as the server's snapshot_by_token / send_event / record_link_open ask expires_at > now().
  it('past its end, his page reads nothing, events are refused, nothing is counted — before her phone revokes it', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    await owner.publishSnapshot(link.coupleId, link.token, snap())
    // The last moment before the end: still open.
    clock.now = at(addDays(D, 30), '09:29:59')
    expect(await page.fetchSnapshot(link.token)).not.toBeNull()
    await page.sendEvent(link.token, { id: 'before-end', kind: 'cheer' })
    await page.recordLinkOpen(link.token, addDays(D, 30))
    expect(await owner.linkOpenDays(link.coupleId, D, addDays(D, 40))).toBe(1)
    // The end itself and after (nobody revoked it — her phone has not opened since): closed for him.
    for (const now of [at(addDays(D, 30)), at(addDays(D, 50), '20:00:00')]) {
      clock.now = now
      expect(store().tokens[link.token]!.revokedAt).toBeUndefined()
      expect(await page.fetchSnapshot(link.token), now).toBeNull()
      await expect(page.sendEvent(link.token, { id: `after-${now}`, kind: 'cheer' })).rejects.toMatchObject({ code: 'unknown-token' })
      await page.recordLinkOpen(link.token, now.slice(0, 10))
    }
    expect((await owner.pullEvents(link.coupleId, '')).map((e) => e.id)).toEqual(['before-end'])
    expect(await owner.linkOpenDays(link.coupleId, D, addDays(D, 60))).toBe(1)
    // Renewed while she used 둘셋, the same day reads again (the end moved), and a pin in the past still reads.
    const live = makeLink(null, at(D), (n) => Uint8Array.from({ length: n }, (_, i) => (i * 53 + 7) % 256))
    clock.now = at(D)
    await owner.publishSnapshot(live.coupleId, live.token, snap())
    clock.now = at(addDays(D, 20))
    await owner.extendToken(live.coupleId, live.token)
    clock.now = at(addDays(D, 45))
    expect(await page.fetchSnapshot(live.token)).not.toBeNull()
    clock.now = at(addDays(D, -3))
    expect(await page.fetchSnapshot(live.token)).not.toBeNull()
  })

  it('another couple’s token → null, and that couple’s link is untouched; an unknown token → null', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const mine = makeLink(null, at(D), seq)
    const theirs = makeLink(null, at(D))
    await owner.publishSnapshot(mine.coupleId, mine.token, snap())
    clock.now = at(addDays(D, 10))
    expect(await owner.extendToken(theirs.coupleId, mine.token)).toBeNull()
    expect(store().tokens[mine.token]).toMatchObject({ coupleId: mine.coupleId, expiresAt: at(addDays(D, 30)) })
    expect(await page.fetchSnapshot(mine.token)).not.toBeNull()
    expect(await owner.extendToken(mine.coupleId, 'unknown-token-0123456789')).toBeNull()
  })

  it('a store written before tokens carried an expiry: issuedAt + 30 days counts', async () => {
    const { storage, clock, owner } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    storage.setItem(
      MOCK_SYNC_KEY,
      JSON.stringify({ snapshots: {}, tokens: { [link.token]: { coupleId: link.coupleId, issuedAt: at(D) } }, events: {}, opens: {} }),
    )
    expect(mockTokenExpiry({ issuedAt: at(D) })).toBe(at(addDays(D, 30)))
    expect(mockTokenExpiry({ issuedAt: 'garbage' })).toBeNull()
    clock.now = at(addDays(D, 12))
    expect(await owner.extendToken(link.coupleId, link.token)).toBe(at(addDays(D, 42)))
    clock.now = at(addDays(D, 100))
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
  })

  it('issueToken sets the expiry it reports (as the server’s issue_token)', async () => {
    const { owner, store } = mockPair(at(D))
    const link = makeLink(null, at(D), seq)
    expect(await owner.issueToken!(link.coupleId, link.token, 14)).toBe(at(addDays(D, 14)))
    expect(store().tokens[link.token]!.expiresAt).toBe(at(addDays(D, 14)))
  })
})

// ── The Supabase transport (request shape against a fake fetch) ──

describe('supabase transport: extendToken calls extend_token, never issue_token', () => {
  const OWNER = 'o'.repeat(64)
  const COUPLE = '7f3c2a10-1b2c-4d5e-8f90-0123456789ab'
  const TOKEN = 'tok-0123456789abcdef'

  function fake(answer: unknown, status = 200) {
    const calls: Array<{ fn: string; body: Record<string, unknown> }> = []
    const fetch: FetchLike = async (url, init) => {
      const fn = url.split('/rest/v1/rpc/')[1] ?? ''
      calls.push({ fn, body: init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {} })
      const text = fn === 'create_couple' ? JSON.stringify(COUPLE) : answer === undefined ? '' : JSON.stringify(answer)
      return { ok: status < 300 || fn === 'create_couple', status: fn === 'create_couple' ? 200 : status, text: async () => text }
    }
    const t = createSupabaseTransport({ url: 'https://x.supabase.co', anonKey: 'anon-key', ownerKey: OWNER, fetch })
    return { t, calls }
  }

  it('the live token: the owner key, the couple, the token and 30 days; the server’s expiry comes back', async () => {
    const { t, calls } = fake('2026-11-19T00:30:00+00:00')
    expect(await t.extendToken(COUPLE, TOKEN)).toBe('2026-11-19T00:30:00+00:00')
    expect(calls.map((c) => c.fn)).toEqual(['create_couple', 'extend_token'])
    expect(calls[1]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: COUPLE, p_token: TOKEN, p_days: 30 })
    expect(calls.some((c) => c.fn === 'issue_token')).toBe(false)
  })

  it('null (expired, revoked, another couple’s) → null; an error throws (the caller keeps the record)', async () => {
    expect(await fake(null).t.extendToken(COUPLE, TOKEN)).toBeNull()
    expect(await fake(undefined).t.extendToken(COUPLE, TOKEN)).toBeNull()
    await expect(fake({ message: 'no such function' }, 404).t.extendToken(COUPLE, TOKEN)).rejects.toThrow('extend_token')
  })

  it('the SQL: a security-definer function that renews only a live token, never shorter, granted like its siblings', () => {
    const schema = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
    const fn = schema.slice(schema.indexOf('create or replace function public.extend_token'))
    const body = fn.slice(0, fn.indexOf('$$;'))
    expect(body).toContain('returns timestamptz')
    expect(body).toContain('security definer')
    expect(body).toContain('set search_path = public, extensions')
    expect(body).toContain('public.dulset_owner_couple(p_owner_key, p_couple_id)')
    expect(body).toContain('least(greatest(coalesce(p_days, 30), 1), 90)')
    expect(body).toContain('greatest(expires_at, now() + make_interval(days => v_days))')
    expect(body).toMatch(/revoked_at is null[\s\S]*expires_at > now\(\)/)
    expect(body).not.toMatch(/revoked_at\s*=\s*null/)
    const policies = readFileSync(join(ROOT, 'supabase/policies.sql'), 'utf8')
    expect(policies).toContain('grant execute on function public.extend_token(text, uuid, text, integer) to anon, authenticated;')
  })
})

// ── What her phone runs after a publish ─────────────────────

describe('renewLinkOnTransport: the record moves only when the transport took the renewal', () => {
  const link = makeLink(null, at(D), seq)
  const now = at(addDays(D, 20), '10:00:00')

  it('due and taken → the record with the LOCAL stamp (not the transport’s own value)', async () => {
    const extendToken = vi.fn(async () => '2026-12-09T01:00:00+00:00')
    const kept = await renewLinkOnTransport(link, now, { extendToken })
    expect(kept).toEqual({ ...link, expiresAt: at(addDays(D, 50), '10:00:00') })
    expect(extendToken).toHaveBeenCalledWith(link.coupleId, link.token, LINK_DAYS)
  })

  it('not due → null and no call (at most once a day; never for an expired or revoked link)', async () => {
    const extendToken = vi.fn(async () => 'x')
    const renewed = { ...link, expiresAt: at(addDays(D, 50), '10:00:00') }
    expect(await renewLinkOnTransport(renewed, at(addDays(D, 20), '18:00:00'), { extendToken })).toBeNull()
    expect(await renewLinkOnTransport(link, at(addDays(D, 31)), { extendToken })).toBeNull()
    expect(await renewLinkOnTransport(revokeLinkRecord(link, at(addDays(D, 2))), now, { extendToken })).toBeNull()
    expect(extendToken).not.toHaveBeenCalled()
  })

  it('no extendToken, a no from the transport, or an error → null (설정 never claims an extension that did not happen)', async () => {
    expect(await renewLinkOnTransport(link, now, {})).toBeNull()
    expect(await renewLinkOnTransport(link, now, { extendToken: async () => null })).toBeNull()
    expect(
      await renewLinkOnTransport(link, now, {
        extendToken: async () => {
          throw new Error('network')
        },
      }),
    ).toBeNull()
  })

  it('the couple.link mirror follows the renewed record (same hash, same start, the new end)', async () => {
    const kept = (await renewLinkOnTransport(link, now, { extendToken: async () => 'ok' }))!
    expect(coupleLinkOf(kept)).toEqual({ ...coupleLinkOf(link), expiresAt: kept.expiresAt })
  })
})

describe('keepRenewal: a 새 링크 or 링크 해제 pressed while the call was out wins', () => {
  beforeEach(() => {
    const ls = memoryStorage()
    vi.stubGlobal('window', { localStorage: ls, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  const link = makeLink(null, at(D), seq)
  const renewed = { ...link, expiresAt: at(addDays(D, 50)) }

  it('the same record → written', () => {
    writeLink(link)
    expect(keepRenewal(link, renewed)).toBe(true)
    expect(readLink()).toEqual(renewed)
    expect(JSON.parse((window as unknown as { localStorage: Storage }).localStorage.getItem(LINK_KEY)!).expiresAt).toBe(renewed.expiresAt)
  })

  it('revoked meanwhile → not written (the revoke stays); rotated meanwhile → not written; gone → not written', () => {
    const revoked = revokeLinkRecord(link, at(addDays(D, 20)))
    writeLink(revoked)
    expect(keepRenewal(link, renewed)).toBe(false)
    expect(readLink()).toEqual(revoked)
    const rotated = makeLink(link, at(addDays(D, 20)))
    writeLink(rotated)
    expect(keepRenewal(link, renewed)).toBe(false)
    expect(readLink()).toEqual(rotated)
    writeLink(null)
    expect(keepRenewal(link, renewed)).toBe(false)
    expect(readLink()).toBeNull()
  })
})

// ── Scenarios over the mock transport ───────────────────────

/** Her phone opening 둘셋 on `day`, as lib/useLinkSync runs it on the owner's tab. */
async function openApp(owner: MockTransport, link: LinkRecord, state: AppState, day: ISODate, clock: { now: string }): Promise<LinkRecord> {
  const now = at(day)
  clock.now = now
  const kind = linkStatus(link, now)
  if (kind === 'expired') {
    // The expired effect: tell the transport once, keep the record as revoked.
    await owner.revokeToken!(link.coupleId, link.token)
    return revokeLinkRecord(link, now)
  }
  if (kind !== 'active') return link
  const snapshot = buildPartnerSnapshot(state, day, partnerId(state))
  if (snapshot) await owner.publishSnapshot(link.coupleId, link.token, snapshot)
  return (await renewLinkOnTransport(link, now, owner)) ?? link
}

describe('scenario: the link lives through the 42 quiet days after a loss while she keeps opening 둘셋', () => {
  it('made in pregnancy, the pregnancy ends a week later, she opens every ~10 days → still active on day 60, his page still opens', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    let state = createDemoState(D, new Date(`${D}T10:00:00+09:00`), 'pregnant')
    expect(state.stage).toBe('pregnant')
    let link = makeLink(null, at(D), seq)
    link = await openApp(owner, link, state, D, clock)
    expect(await page.fetchSnapshot(link.token)).not.toBeNull()

    // A week later the pregnancy ends: back to preparing with the 42-day quiet ('loss' rest).
    const ended = addDays(D, 7)
    state = endPregnancy(state, ended)
    expect(state.stage).toBe('preparing')
    expect(activeRest(state, ended)?.reason).toBe('loss')
    const quietEnds = addDays(ended, QUIET_DAYS_AFTER_END)
    // Before 2026-10-17 the link died 30 days after it was made — inside the quiet days.
    const original = makeLink(null, at(D), seq)
    expect(linkStatus(original, at(addDays(D, 30)))).toBe('expired')
    expect(addDays(D, 30) < quietEnds).toBe(true)

    // She opens 둘셋 every ~10 days; his page opens most days.
    const opens = [ended, addDays(D, 17), addDays(D, 27), addDays(D, 37), addDays(D, 47), addDays(D, 57)]
    for (const day of opens) {
      link = await openApp(owner, link, state, day, clock)
      expect(linkStatus(link, at(day)), day).toBe('active')
      expect(link.expiresAt, day).toBe(at(addDays(day, LINK_DAYS)))
      // The transport keeps the same end (a server enforcing it would still serve him).
      expect(store().tokens[link.token]!.expiresAt, day).toBe(at(addDays(day, LINK_DAYS)))
    }

    // Day 60: no open today, still active; his page fetches and draws today.
    const day60 = addDays(D, 60)
    clock.now = at(day60, '21:00:00')
    expect(linkStatus(link, clock.now)).toBe('active')
    expect(diffDays(day60, link.expiresAt.slice(0, 10))).toBe(27)
    expect(mockTokenExpiry(store().tokens[link.token]!)! > clock.now).toBe(true)
    const seen = await page.fetchSnapshot(link.token)
    expect(seen).not.toBeNull()
    expect(snapshotDay(seen!, day60)?.date).toBe(day60)
    await page.sendEvent(link.token, { id: 'day60-cheer', kind: 'cheer' })
    expect((await owner.pullEvents(link.coupleId, '')).map((e) => e.id)).toContain('day60-cheer')
  })

  it('his opens and events never move the expiry (her 설정 must not become a read receipt)', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const state = createDemoState(D, new Date(`${D}T10:00:00+09:00`), 'preparing')
    let link = makeLink(null, at(D), seq)
    link = await openApp(owner, link, state, D, clock)
    const before = { record: link.expiresAt, token: store().tokens[link.token]!.expiresAt }
    for (let k = 1; k <= 25; k++) {
      clock.now = at(addDays(D, k), '20:00:00')
      await page.recordLinkOpen(link.token, addDays(D, k))
      await page.fetchSnapshot(link.token)
      await page.sendEvent(link.token, { id: `cheer-${k}`, kind: 'cheer' })
    }
    expect(link.expiresAt).toBe(before.record)
    expect(store().tokens[link.token]!.expiresAt).toBe(before.token)
    expect(await owner.linkOpenDays(link.coupleId, D, addDays(D, 30))).toBe(25)
  })
})

describe('scenario: 30 days without opening 둘셋 → the link stops, and a later open does not revive it', () => {
  it('opened on day 5 (renewed to day 35), then nothing until day 40 → expired → revoked; day 41 stays stopped', async () => {
    const { clock, owner, page, store } = mockPair(at(D))
    const state = createDemoState(D, new Date(`${D}T10:00:00+09:00`), 'preparing')
    let link = makeLink(null, at(D), seq)
    link = await openApp(owner, link, state, D, clock)
    link = await openApp(owner, link, state, addDays(D, 5), clock)
    expect(link.expiresAt).toBe(at(addDays(D, 35)))

    // Thirty-five days later she opens again: past the end. (A server already refuses him — the token's end has passed.)
    const back = addDays(D, 40)
    expect(mockTokenExpiry(store().tokens[link.token]!)! < at(back)).toBe(true)
    expect(renewedExpiry(link, at(back))).toBeNull()
    clock.now = at(back)
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
    link = await openApp(owner, link, state, back, clock)
    expect(linkStatus(link, at(back))).toBe('revoked')
    expect(linkShownStatus(link, at(back))).toBe('expired')
    expect(await page.fetchSnapshot(link.token)).toBeNull()

    // The next open: still stopped, nothing published under it, no renewal.
    const next = addDays(D, 41)
    const again = await openApp(owner, link, state, next, clock)
    expect(again).toBe(link)
    expect(renewedExpiry(again, at(next))).toBeNull()
    expect(await owner.extendToken(link.coupleId, link.token)).toBeNull()
    expect(await page.fetchSnapshot(link.token)).toBeNull()
    expect(linkShownStatus(again, at(next))).toBe('expired')
  })
})

// ── Source guards ───────────────────────────────────────────

describe('only her use renews the link', () => {
  it('the owner hook renews after a publish and never reads the link-open counter or his events for it; the partner page never extends', () => {
    const hook = readFileSync(join(ROOT, 'lib/useLinkSync.ts'), 'utf8')
    const publish = hook.slice(hook.indexOf('// Publish (debounced).'), hook.indexOf('// Pull and apply.'))
    expect(publish).toContain('await t.publishSnapshot(coupleId, token, snapshot)')
    // The timer re-reads the record first: a token revoked or replaced in another tab is never published under (RC-2).
    expect(publish).toContain('if (!live || live.token !== token || live.coupleId !== coupleId || live.revokedAt) return')
    expect(publish.indexOf('live.revokedAt')).toBeLessThan(publish.indexOf('await t.publishSnapshot('))
    expect(publish.indexOf('renewLinkOnTransport(')).toBeGreaterThan(publish.indexOf('await t.publishSnapshot('))
    expect(hook.match(/renewLinkOnTransport\(current/g)).toHaveLength(1)
    expect(hook).not.toMatch(/linkOpenDays|recordLinkOpen/)
    const pullBlock = hook.slice(hook.indexOf('// Pull and apply.'))
    expect(pullBlock).not.toMatch(/extendToken|renewLinkOnTransport|keepRenewal/)
    for (const f of ['components/link/LinkPage.tsx', 'components/link/model.ts', 'lib/sync/linkOpens.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8'), f).not.toMatch(/extendToken|extend_token|issueToken/)
    }
  })

  it('설정 › 연결 and the onboarding say, in one line, it stops after 30 days of not opening 둘셋 (해요체)', () => {
    const section = readFileSync(join(ROOT, 'components/settings/LinkSection.tsx'), 'utf8')
    // What is not opened is named (둘셋을): never 'not opened for 30 days' with the link as the topic,
    // which reads as his opens keeping it alive — a read receipt (AGENTS.md: 만료일이 읽음 표시가 되지 않게).
    // One line, no extra explanation of who counts (founder copy sweep, 2026-10-18).
    expect(section).toContain('{LINK_DAYS}일 동안 둘셋을 안 열면 링크가 만료돼요.')
    expect(section).toContain('${LINK_DAYS}일 동안 둘셋을 안 열면 링크가 만료돼요.')
    expect(section).not.toContain('님이 링크를 여는 것과는 상관없어요')
    expect(section).not.toMatch(/일 동안 열지 않으면|자동으로 연장|링크를 \$?\{?LINK_DAYS\}?일 동안 안 열면/)
    expect(section).not.toContain('일 동안 열리고')
    expect(section).not.toContain('만료 전까지')
    // One word for a stopped link on both screens: hers says what his says (noticeCopy('expired')).
    expect(section).toContain("'링크가 만료됐어요'")
    expect(section).not.toMatch(/멈췄어요|멈춘 링크|멈춰요/)
    const done = readFileSync(join(ROOT, 'components/onboarding/DoneStep.tsx'), 'utf8')
    expect(done).toContain('{LINK_DAYS}일 동안 둘셋을 안 열면 링크가 만료돼요.')
    expect(done).not.toMatch(/일 동안 열지 않으면|멈춰요/)
    for (const w of ['숙제', '실패', '노력']) {
      expect(section.includes(w), w).toBe(false)
    }
  })
})

// A transport with no extendToken at all (an older build of either one) keeps the link exactly as before.
describe('a transport without extendToken', () => {
  it('leaves the record alone, so the link stops LINK_DAYS after the last successful renewal (or after it was made)', async () => {
    const link = makeLink(null, at(D), seq)
    const bare: Pick<Transport, 'extendToken'> = {}
    expect(await renewLinkOnTransport(link, at(addDays(D, 20)), bare)).toBeNull()
    expect(linkStatus(link, at(addDays(D, 30)))).toBe('expired')
  })
})
