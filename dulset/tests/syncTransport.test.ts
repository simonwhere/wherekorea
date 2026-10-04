import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoState } from '@/lib/demo'
import type { PartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, type PartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import {
  MOCK_EVENTS_MAX,
  MOCK_OFFLINE_KEY,
  MOCK_SYNC_KEY,
  MockTransportError,
  createMockTransport,
  memoryChannel,
  memoryStorage,
  mockOfflineOn,
  parseMockStore,
} from '@/lib/sync/mockTransport'
import {
  OWNER_KEY_STORAGE,
  SupabaseTransportError,
  createSupabaseTransport,
  deviceOwnerKey,
  isPublishableKey,
  randomSecret,
  rpcHeaders,
  rpcUrl,
  type FetchLike,
} from '@/lib/sync/supabaseTransport'
import {
  TRANSPORT_LABEL,
  pageEvents,
  pageReceived,
  pickSupabaseEnv,
  resetTransport,
  transport,
  transportKind,
  type ReceivedEvent,
} from '@/lib/sync/transport'

const TODAY = '2026-10-02'
const NOW = new Date('2026-10-02T09:00:00+09:00')
const TOKEN = 'tok-0123456789abcdef'

function snapshot(today = TODAY): PartnerSnapshot {
  const s = buildPartnerSnapshot(createDemoState(today, NOW, 'preparing'), today, 'a')
  if (!s) throw new Error('demo snapshot')
  return s
}

const ev = (id: string, extra: Partial<PartnerEvent> = {}): PartnerEvent => ({ id, kind: 'cheer', from: 'a', ...extra }) as PartnerEvent

describe('picking the transport', () => {
  afterEach(() => resetTransport())

  it('supabase only when both variables are set and non-empty; the url loses its trailing slash', () => {
    expect(pickSupabaseEnv(undefined, undefined)).toBeNull()
    expect(pickSupabaseEnv('https://x.supabase.co', '')).toBeNull()
    expect(pickSupabaseEnv('  ', 'key')).toBeNull()
    expect(pickSupabaseEnv('https://x.supabase.co/', 'key')).toEqual({ url: 'https://x.supabase.co', anonKey: 'key' })
    expect(transportKind(null)).toBe('mock')
    expect(transportKind({ url: 'https://x.supabase.co', anonKey: 'k' })).toBe('supabase')
    expect(TRANSPORT_LABEL.mock).toContain('모의')
    expect(TRANSPORT_LABEL.supabase).toBe('연결: Supabase')
  })

  it('this build has no Supabase env, so transport() is the mock (and one instance)', async () => {
    expect(transportKind()).toBe('mock')
    const t = await transport()
    expect(t.kind).toBe('mock')
    expect(await transport()).toBe(t)
  })
})

describe('pageEvents', () => {
  it('pageReceived keeps the receipt stamps; instants compare across offsets (a UTC created_at against a local since)', () => {
    const list: ReceivedEvent[] = [
      { receivedAt: '2026-10-02T00:30:00+00:00', event: ev('utc') }, // 09:30 in Seoul
      { receivedAt: '2026-10-02T09:10:00+09:00', event: ev('local') },
    ]
    expect(pageReceived(list, '').map((r) => r.event.id)).toEqual(['local', 'utc'])
    expect(pageReceived(list, '2026-10-02T09:20:00+09:00')).toEqual([list[0]])
    expect(pageReceived(list, '2026-10-02T09:20:00+09:00')[0]!.receivedAt).toBe('2026-10-02T00:30:00+00:00')
  })

  it('orders by receipt then id, keeps the first of a repeated id, and pages after `since`', () => {
    const list: ReceivedEvent[] = [
      { receivedAt: '2026-10-02T09:00:02+09:00', event: ev('c') },
      { receivedAt: '2026-10-02T09:00:01+09:00', event: ev('b') },
      { receivedAt: '2026-10-02T09:00:01+09:00', event: ev('a') },
      { receivedAt: '2026-10-02T09:00:03+09:00', event: ev('a', { kind: 'nudge' }) },
    ]
    expect(pageEvents(list, '').map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(pageEvents(list, '2026-10-02T09:00:01+09:00').map((e) => e.id)).toEqual(['c'])
    expect(pageEvents(list, '2026-10-02T09:00:03+09:00')).toEqual([])
    expect(pageEvents([], '')).toEqual([])
  })
})

describe('mock transport: two tabs over one storage', () => {
  function twoTabs() {
    const storage = memoryStorage()
    const channel = memoryChannel()
    let tick = 0
    const now = () => `2026-10-02T09:00:${String(tick++).padStart(2, '0')}+09:00`
    const her = createMockTransport({ storage, channel, now })
    const him = createMockTransport({ storage, channel, now })
    return { storage, channel, her, him }
  }

  it('publishes versions, the partner reads by token, an unknown token reads nothing', async () => {
    const { her, him, storage } = twoTabs()
    expect(await him.fetchSnapshot(TOKEN)).toBeNull()
    const snap = snapshot()
    await her.publishSnapshot('couple-1', TOKEN, snap)
    expect(await him.fetchSnapshot(TOKEN)).toEqual(snap)
    expect(await him.fetchSnapshot('tok-other')).toBeNull()
    const again = { ...snap, today: '2026-10-03' }
    await her.publishSnapshot('couple-1', TOKEN, again)
    expect(await him.fetchSnapshot(TOKEN)).toEqual(again)
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    expect(store.snapshots['couple-1']).toMatchObject({
      coupleId: 'couple-1',
      token: TOKEN,
      version: 2,
      publishedAt: '2026-10-02T09:00:01+09:00',
    })
    expect(store.tokens[TOKEN]).toMatchObject({ coupleId: 'couple-1' })
    expect(storage.keys()).toEqual([MOCK_SYNC_KEY])
  })

  it('events: sent with a live token, received once per id, paged by receipt, cleaned on the way out', async () => {
    const { her, him, storage } = twoTabs()
    await expect(him.sendEvent(TOKEN, ev('e1'))).rejects.toBeInstanceOf(MockTransportError)
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    await him.sendEvent(TOKEN, ev('e1'))
    await him.sendEvent(TOKEN, ev('e1', { kind: 'nudge' })) // the same id again: ignored
    await him.sendEvent(TOKEN, ev('e2', { kind: 'check', itemId: 'item-1', date: TODAY, done: true } as never))
    const all = await her.pullEvents('couple-1', '')
    expect(all.map((e) => [e.id, e.kind])).toEqual([
      ['e1', 'cheer'],
      ['e2', 'check'],
    ])
    expect(await her.pullEvents('couple-1', '2026-10-02T09:00:01+09:00')).toEqual([all[1]])
    expect(await her.pullEvents('couple-2', '')).toEqual([])
    // A forged row in storage (free text, unknown kind) never reaches the owner.
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    store.events['couple-1']!.push({ receivedAt: '2026-10-02T09:59:00+09:00', event: { id: 'bad', kind: 'period', text: '…' } as never })
    store.events['couple-1']!.push({
      receivedAt: '2026-10-02T09:59:01+09:00',
      event: { id: 'e3', kind: 'cheer', note: 'free text' } as never,
    })
    storage.setItem(MOCK_SYNC_KEY, JSON.stringify(store))
    const after = await her.pullEvents('couple-1', '2026-10-02T09:00:01+09:00')
    expect(after.map((e) => e.id)).toEqual(['e2', 'e3'])
    expect(after[1]).toEqual({ id: 'e3', kind: 'cheer' })
  })

  it('pullReceived carries each event’s receipt stamp (what her phone applies it by); pullEvents is the same page without it', async () => {
    const { her, him } = twoTabs()
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    await him.sendEvent(TOKEN, ev('e1'))
    await him.sendEvent(TOKEN, ev('e2', { kind: 'nudge' }))
    const received = await her.pullReceived('couple-1', '')
    expect(received.map((r) => [r.event.id, r.receivedAt])).toEqual([
      ['e1', '2026-10-02T09:00:01+09:00'],
      ['e2', '2026-10-02T09:00:02+09:00'],
    ])
    expect(await her.pullEvents('couple-1', '')).toEqual(received.map((r) => r.event))
    expect(await her.pullReceived('couple-1', '2026-10-02T09:00:01+09:00')).toEqual([received[1]])
  })

  it('링크 연 날: recordLinkOpen files (couple, day) → count under the token’s couple; never throws; linkOpenDays counts distinct days', async () => {
    const { her, him, storage } = twoTabs()
    await him.recordLinkOpen(TOKEN, TODAY) // no token yet: nothing, no error
    expect(await her.linkOpenDays('couple-1', TODAY, TODAY)).toBe(0)
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    for (const d of [TODAY, TODAY, TODAY, '2026-10-04', '2026-10-09']) await him.recordLinkOpen(TOKEN, d)
    expect(await her.linkOpenDays('couple-1', '2026-09-28', '2026-10-04')).toBe(2)
    expect(await her.linkOpenDays('couple-1', '2026-10-05', '2026-10-11')).toBe(1)
    expect(await her.linkOpenDays('couple-1', '2026-10-11', '2026-10-05')).toBe(0)
    expect(await her.linkOpenDays('couple-2', '2026-09-28', '2026-10-11')).toBe(0)
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    expect(store.opens).toEqual({ 'couple-1': { [TODAY]: 3, '2026-10-04': 1, '2026-10-09': 1 } })
    // Without storage it is a no-op, not an error.
    await expect(createMockTransport({ storage: null, channel: null }).recordLinkOpen(TOKEN, TODAY)).resolves.toBeUndefined()
  })

  it('keeps at most MOCK_EVENTS_MAX events per couple (oldest dropped)', async () => {
    const { her, him } = twoTabs()
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    for (let i = 0; i < MOCK_EVENTS_MAX + 5; i++) await him.sendEvent(TOKEN, ev(`e${i}`))
    const all = await her.pullEvents('couple-1', '')
    expect(all).toHaveLength(MOCK_EVENTS_MAX)
    expect(all[0]!.id).toBe('e5')
  })

  it('watch: the other tab hears a publish or an event for its couple only; unsubscribe stops it; reset forgets everything', async () => {
    const { her, him, storage } = twoTabs()
    const heard: string[] = []
    const off = him.watch!('couple-1', () => heard.push('1'))
    him.watch!('couple-2', () => heard.push('2'))
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    await him.sendEvent(TOKEN, ev('e1'))
    expect(heard).toEqual(['1', '1'])
    off()
    await her.publishSnapshot('couple-1', TOKEN, snapshot())
    expect(heard).toEqual(['1', '1'])
    her.reset()
    expect(storage.getItem(MOCK_SYNC_KEY)).toBeNull()
    expect(await him.fetchSnapshot(TOKEN)).toBeNull()
  })

  it('without storage a publish fails loudly, a read is empty; a corrupt store reads as empty', async () => {
    const t = createMockTransport({ storage: null, channel: null })
    await expect(t.publishSnapshot('c', TOKEN, snapshot())).rejects.toMatchObject({ code: 'storage' })
    expect(await t.fetchSnapshot(TOKEN)).toBeNull()
    expect(parseMockStore('{"snapshots":[],"tokens":null}')).toEqual({ snapshots: {}, tokens: {}, events: {}, opens: {} })
    expect(parseMockStore('nope')).toEqual({ snapshots: {}, tokens: {}, events: {}, opens: {} })
    expect(parseMockStore(null)).toEqual({ snapshots: {}, tokens: {}, events: {}, opens: {} })
    // A forged counter map keeps only couple → day → positive whole counts.
    expect(
      parseMockStore(JSON.stringify({ opens: { c1: { '2026-10-02': 2, '2026-10-03': 0, bad: 1, '2026-10-04': 1.5 }, c2: 'x', c3: { '2026-10-02': -1 } } })).opens,
    ).toEqual({ c1: { '2026-10-02': 2 } })
  })
})

describe('supabase transport: request shaping with a fake fetch (never run against a server)', () => {
  interface Call {
    url: string
    method: string
    headers: Record<string, string>
    body: unknown
  }
  const ENV = { url: 'https://abc.supabase.co/', anonKey: 'anon-key' }
  const OWNER = 'o'.repeat(40)

  function fake(reply: (call: Call) => { status?: number; body?: unknown } | Error) {
    const calls: Call[] = []
    const fetch: FetchLike = async (input, init) => {
      const call = { url: input, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }
      calls.push(call)
      const r = reply(call)
      if (r instanceof Error) throw r
      const text = r.body === undefined ? '' : JSON.stringify(r.body)
      return { ok: (r.status ?? 200) < 300, status: r.status ?? 200, text: async () => text }
    }
    return { calls, fetch }
  }

  it('rpcUrl / rpcHeaders: POST /rest/v1/rpc/<fn> with the anon key as apikey and bearer', () => {
    expect(rpcUrl(ENV, 'publish_snapshot')).toBe('https://abc.supabase.co/rest/v1/rpc/publish_snapshot')
    expect(rpcHeaders(ENV)).toEqual({
      apikey: 'anon-key',
      Authorization: 'Bearer anon-key',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
  })

  it('owner side: create_couple, issue_token, publish_snapshot, pull_events, mark_events_read carry the owner key and the right argument names', async () => {
    const { calls, fetch } = fake((c) => {
      if (c.url.endsWith('/create_couple')) return { body: (c.body as { p_couple_id?: string }).p_couple_id ?? 'c0ffee00-0000-4000-8000-000000000001' }
      if (c.url.endsWith('/issue_token')) return { body: '2026-11-01T00:00:00+00:00' }
      if (c.url.endsWith('/publish_snapshot')) return { body: 3 }
      if (c.url.endsWith('/pull_events'))
        return {
          body: [
            {
              id: 'e1',
              kind: 'cheer',
              payload: { id: 'e1', kind: 'cheer', from: 'a' },
              created_at: '2026-10-02T00:00:01+00:00',
              read_at: null,
            },
            {
              id: 'bad',
              kind: 'period',
              payload: { id: 'bad', kind: 'period', start: '2026-10-01' },
              created_at: '2026-10-02T00:00:02+00:00',
              read_at: null,
            },
            {
              id: 'e0',
              kind: 'nudge',
              payload: { id: 'e0', kind: 'nudge', text: 'free' },
              created_at: '2026-10-02T00:00:00+00:00',
              read_at: null,
            },
          ],
        }
      if (c.url.endsWith('/mark_events_read')) return { body: 2 }
      return { status: 404, body: { message: 'no such function' } }
    })
    const now = () => '2026-10-02T09:00:00+09:00'
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch, now })
    expect(t.kind).toBe('supabase')
    expect(t.ownerKey).toBe(OWNER)

    expect(await t.createCouple()).toBe('c0ffee00-0000-4000-8000-000000000001')
    expect(await t.issueToken('c1', TOKEN, 14)).toBe('2026-11-01T00:00:00+00:00')
    const snap = snapshot()
    await t.publishSnapshot('c1', TOKEN, snap)
    const pulled = await t.pullEvents('c1', '2026-10-01T09:00:00+09:00')
    expect(await t.markEventsRead('c1', ['e0', 'e1'])).toBe(2)
    expect(await t.markEventsRead('c1', [])).toBe(0)

    expect(calls.map((c) => c.url.split('/rpc/')[1])).toEqual([
      'create_couple',
      // issueToken first registers her phone's own couple id (ensureCouple) — once per page.
      'create_couple',
      'issue_token',
      'publish_snapshot',
      'pull_events',
      'mark_events_read',
    ])
    expect(
      calls.every((c) => c.method === 'POST' && c.headers.apikey === 'anon-key' && c.headers.Authorization === 'Bearer anon-key'),
    ).toBe(true)
    expect(calls[0]!.body).toEqual({ p_owner_key: OWNER })
    expect(calls[1]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1' })
    expect(calls[2]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_token: TOKEN, p_days: 14 })
    expect(calls[3]!.body).toEqual({
      p_owner_key: OWNER,
      p_couple_id: 'c1',
      p_token: TOKEN,
      p_payload: snap,
      p_published_at: '2026-10-02T09:00:00+09:00',
    })
    expect(calls[4]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_since: '2026-10-01T09:00:00+09:00' })
    expect(calls[5]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_ids: ['e0', 'e1'] })
    // Rows are cleaned and ordered by the server's clock; the forged kind and the free text never come through.
    expect(pulled).toEqual([
      { id: 'e0', kind: 'nudge' },
      { id: 'e1', kind: 'cheer', from: 'a' },
    ])
    // The snapshot that went out is the lens-built one: no cycle records inside.
    const sent = JSON.stringify(calls[3]!.body)
    for (const word of ['periods', 'lhTests', 'pregnancyTests', 'personalLog', 'intimacy', 'privateTo'])
      expect(sent).not.toContain(`"${word}"`)
  })

  it('partner side: snapshot_by_token and send_event carry the token only; an empty result is null; since "" is sent as null', async () => {
    const snap = snapshot()
    let empty = false
    const { calls, fetch } = fake((c) => {
      if (c.url.endsWith('/snapshot_by_token'))
        return { body: empty ? [] : [{ couple_id: 'c1', version: 2, published_at: '2026-10-02T00:00:00+00:00', payload: snap }] }
      if (c.url.endsWith('/send_event')) return { status: 204 }
      if (c.url.endsWith('/create_couple')) return { body: 'c1' }
      if (c.url.endsWith('/pull_events')) return { body: [] }
      return { status: 404 }
    })
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    expect(await t.fetchSnapshot(TOKEN)).toEqual(snap)
    empty = true
    expect(await t.fetchSnapshot(TOKEN)).toBeNull()
    await t.sendEvent(TOKEN, ev('e1', { kind: 'reply', signalId: 'thanks', replyId: 'ok' } as never))
    expect(await t.pullEvents('c1', '')).toEqual([])
    expect(calls[0]!.body).toEqual({ p_token: TOKEN })
    expect(calls[2]!.body).toEqual({
      p_token: TOKEN,
      p_event_id: 'e1',
      p_kind: 'reply',
      p_payload: { id: 'e1', kind: 'reply', from: 'a', signalId: 'thanks', replyId: 'ok' },
    })
    // The partner calls never register anything; the owner's pull does, once.
    expect(calls.slice(0, 3).some((c) => c.url.endsWith('/create_couple'))).toBe(false)
    expect(calls[3]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1' })
    expect(calls[4]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_since: null })
    // Only the owner's own calls (her pull and its one registration) carry the owner key.
    for (const c of calls)
      expect(JSON.stringify(c.body)).not.toContain(OWNER.slice(0, 8) + (c.url.includes('pull') || c.url.includes('create_couple') ? '§' : ''))
  })

  it('pullReceived keeps the server’s created_at with each cleaned event', async () => {
    const { fetch } = fake((c) =>
      c.url.endsWith('/create_couple')
        ? { body: 'c1' }
        : c.url.endsWith('/pull_events')
        ? {
            body: [
              { id: 'e1', kind: 'cheer', payload: { id: 'e1', kind: 'cheer' }, created_at: '2026-10-02T00:00:01+00:00', read_at: null },
              { id: 'x', kind: 'period', payload: { id: 'x', kind: 'period' }, created_at: '2026-10-02T00:00:02+00:00', read_at: null },
            ],
          }
        : { status: 404 },
    )
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    expect(await t.pullReceived('c1', '')).toEqual([{ receivedAt: '2026-10-02T00:00:01+00:00', event: { id: 'e1', kind: 'cheer' } }])
  })

  it('링크 연 날: record_link_open carries the token only (the server counts its own Seoul date); link_open_days carries the owner key; neither carries a day of his', async () => {
    let fail = false
    const { calls, fetch } = fake((c) => {
      if (c.url.endsWith('/record_link_open')) return fail ? { status: 403, body: { message: 'x' } } : { status: 204 }
      if (c.url.endsWith('/link_open_days')) return { body: 3 }
      return { status: 404 }
    })
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    await t.recordLinkOpen(TOKEN, TODAY)
    expect(calls[0]!.url).toBe('https://abc.supabase.co/rest/v1/rpc/record_link_open')
    expect(calls[0]!.body).toEqual({ p_token: TOKEN })
    expect(JSON.stringify(calls[0]!.body)).not.toContain(TODAY)
    expect(calls[0]!.headers.apikey).toBe('anon-key')
    // A dead link or a network blip records nothing and never throws on the page.
    fail = true
    await expect(t.recordLinkOpen(TOKEN, TODAY)).resolves.toBeUndefined()
    const offline = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch: fake(() => new Error('offline')).fetch })
    await expect(offline.recordLinkOpen(TOKEN, TODAY)).resolves.toBeUndefined()
    // The study's read-back: owner key, couple, the two dates.
    expect(await t.linkOpenDays('c1', '2026-09-28', '2026-10-04')).toBe(3)
    expect(calls[2]!.url.endsWith('/link_open_days')).toBe(true)
    expect(calls[2]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_from: '2026-09-28', p_to: '2026-10-04' })
    // Without an owner key the read-back refuses before any call.
    const before = calls.length
    const noKey = createSupabaseTransport({ ...ENV, fetch, storage: null })
    await expect(noKey.linkOpenDays('c1', '2026-09-28', '2026-10-04')).rejects.toBeInstanceOf(SupabaseTransportError)
    expect(calls.length).toBe(before)
    // The page side needs none.
    await noKey.recordLinkOpen(TOKEN, TODAY)
    expect(calls.length).toBe(before + 1)
  })

  it('errors: an HTTP failure carries the status, a thrown fetch is "network", a non-JSON body is "bad-response", no owner key refuses before any call', async () => {
    const http = createSupabaseTransport({
      ...ENV,
      ownerKey: OWNER,
      fetch: fake(() => ({ status: 403, body: { message: 'link not valid' } })).fetch,
    })
    await expect(http.fetchSnapshot(TOKEN)).rejects.toMatchObject({ code: 'http', status: 403 })
    const net = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch: fake(() => new Error('offline')).fetch })
    await expect(net.sendEvent(TOKEN, ev('e1'))).rejects.toMatchObject({ code: 'network' })
    const bad: FetchLike = async () => ({ ok: true, status: 200, text: async () => '<html>' })
    const junk = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch: bad })
    await expect(junk.fetchSnapshot(TOKEN)).rejects.toBeInstanceOf(SupabaseTransportError)
    const { calls, fetch } = fake(() => ({ body: 1 }))
    const noKey = createSupabaseTransport({ ...ENV, fetch, storage: null })
    expect(noKey.ownerKey).toBeNull()
    await expect(noKey.publishSnapshot('c1', TOKEN, snapshot())).rejects.toMatchObject({ code: 'bad-response' })
    await expect(noKey.createCouple()).rejects.toBeInstanceOf(SupabaseTransportError)
    expect(calls).toEqual([])
    // The partner side needs no owner key.
    await noKey.sendEvent(TOKEN, ev('e1'))
    expect(calls).toHaveLength(1)
  })

  it('the owner key: made once per device, 64 hex characters, kept under a dulset: key; none without storage', () => {
    const storage = memoryStorage()
    const first = deviceOwnerKey(storage)!
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(deviceOwnerKey(storage)).toBe(first)
    expect(storage.getItem(OWNER_KEY_STORAGE)).toBe(first)
    expect(OWNER_KEY_STORAGE.startsWith('dulset:')).toBe(true)
    expect(deviceOwnerKey(null)).toBeNull()
    expect(randomSecret()).not.toBe(randomSecret())
    const t = createSupabaseTransport({ ...ENV, storage, fetch: fake(() => ({ body: null })).fetch })
    expect(t.ownerKey).toBe(first)
    vi.restoreAllMocks()
  })
})

describe('mock transport: offline, simulated (?mockOffline=1 / dulset:mock-offline — N25 prep)', () => {
  it('mockOfflineOn reads the page address switch and the storage flag; anything else is online', () => {
    const storage = memoryStorage()
    expect(mockOfflineOn('', storage)).toBe(false)
    expect(mockOfflineOn('?today=2026-10-04', storage)).toBe(false)
    expect(mockOfflineOn('?mockOffline=1', storage)).toBe(true)
    expect(mockOfflineOn('?today=2026-10-04&mockOffline=true', null)).toBe(true)
    expect(mockOfflineOn('?mockOffline=0', storage)).toBe(false)
    storage.setItem(MOCK_OFFLINE_KEY, '1')
    expect(mockOfflineOn('', storage)).toBe(true)
    storage.setItem(MOCK_OFFLINE_KEY, 'yes')
    expect(mockOfflineOn('', storage)).toBe(false)
    const broken = { getItem: () => { throw new Error('blocked') } }
    expect(mockOfflineOn(undefined, broken)).toBe(false)
  })

  it('his calls fail as an unreachable server would; the counter records nothing; her calls go on', async () => {
    const storage = memoryStorage()
    const channel = memoryChannel()
    let off = false
    const her = createMockTransport({ storage, channel, offline: () => false })
    const him = createMockTransport({ storage, channel, offline: () => off })
    const snap = snapshot()
    await her.publishSnapshot('couple-1', TOKEN, snap)
    expect(await him.fetchSnapshot(TOKEN)).toEqual(snap)
    off = true
    await expect(him.fetchSnapshot(TOKEN)).rejects.toMatchObject({ code: 'offline' })
    await expect(him.sendEvent(TOKEN, ev('e1'))).rejects.toBeInstanceOf(MockTransportError)
    await expect(him.recordLinkOpen(TOKEN, TODAY)).resolves.toBeUndefined()
    expect(parseMockStore(storage.getItem(MOCK_SYNC_KEY)).opens).toEqual({})
    expect(await her.pullEvents('couple-1', '')).toEqual([])
    // Her phone still publishes; back online, he sees it.
    const again = { ...snap, today: '2026-10-03' }
    await her.publishSnapshot('couple-1', TOKEN, again)
    off = false
    expect(await him.fetchSnapshot(TOKEN)).toEqual(again)
    await him.sendEvent(TOKEN, ev('e2'))
    expect((await her.pullEvents('couple-1', '')).map((e) => e.id)).toEqual(['e2'])
  })

  it('by default the switch comes from the storage the mock writes to', async () => {
    const storage = memoryStorage()
    const t = createMockTransport({ storage, channel: null })
    await t.publishSnapshot('couple-1', TOKEN, snapshot())
    storage.setItem(MOCK_OFFLINE_KEY, '1')
    await expect(t.fetchSnapshot(TOKEN)).rejects.toMatchObject({ code: 'offline' })
    storage.removeItem(MOCK_OFFLINE_KEY)
    expect(await t.fetchSnapshot(TOKEN)).not.toBeNull()
  })
})

describe('supabase transport: her couple id is registered once, a couple space can be removed, the newer keys', () => {
  interface Call {
    url: string
    body: Record<string, unknown>
    headers: Record<string, string>
  }
  const ENV = { url: 'https://abc.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.e30.sig' }
  const OWNER = 'o'.repeat(40)
  const COUPLE = '7f3c2a10-1b2c-4d5e-8f90-0123456789ab'

  function fake(reply: (fn: string, body: Record<string, unknown>) => { status?: number; body?: unknown }) {
    const calls: Call[] = []
    const fetch: FetchLike = async (input, init) => {
      const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {}
      calls.push({ url: input, body, headers: init.headers })
      const r = reply(input.split('/rpc/')[1]!, body)
      const text = r.body === undefined ? '' : JSON.stringify(r.body)
      return { ok: (r.status ?? 200) < 300, status: r.status ?? 200, text: async () => text }
    }
    return { calls, fetch }
  }
  const fns = (calls: Call[]) => calls.map((c) => c.url.split('/rpc/')[1])

  it('issue, publish and pull register the couple first — once per page, with her own id; a second publish goes straight', async () => {
    const { calls, fetch } = fake((fn, body) =>
      fn === 'create_couple'
        ? { body: String(body.p_couple_id).toUpperCase() }
        : fn === 'pull_events'
          ? { body: [] }
          : fn === 'issue_token'
            ? { body: '2026-11-03T00:00:00+00:00' }
            : { body: 1 },
    )
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    await t.publishSnapshot(COUPLE, TOKEN, snapshot())
    await t.publishSnapshot(COUPLE, TOKEN, snapshot())
    await t.pullEvents(COUPLE, '')
    await t.issueToken(COUPLE, TOKEN)
    expect(fns(calls)).toEqual(['create_couple', 'publish_snapshot', 'publish_snapshot', 'pull_events', 'issue_token'])
    expect(calls[0]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: COUPLE })
    // Partner calls never register.
    await t.fetchSnapshot(TOKEN).catch(() => null)
    expect(fns(calls).filter((f) => f === 'create_couple')).toHaveLength(1)
  })

  it('a refused registration is not remembered (the next call tries again); another id back is a bad response', async () => {
    let refuse = true
    const { calls, fetch } = fake((fn, body) =>
      fn === 'create_couple' ? (refuse ? { status: 403, body: { message: 'couple belongs to another device' } } : { body: body.p_couple_id }) : { body: 1 },
    )
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    await expect(t.publishSnapshot(COUPLE, TOKEN, snapshot())).rejects.toMatchObject({ code: 'http', status: 403 })
    expect(fns(calls)).toEqual(['create_couple'])
    refuse = false
    await t.publishSnapshot(COUPLE, TOKEN, snapshot())
    expect(fns(calls)).toEqual(['create_couple', 'create_couple', 'publish_snapshot'])
    const other = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch: fake(() => ({ body: '00000000-0000-4000-8000-000000000000' })).fetch })
    await expect(other.ensureCouple(COUPLE)).rejects.toMatchObject({ code: 'bad-response' })
  })

  it('deleteCouple: delete_couple with the owner key; true when a row went; the couple registers again afterwards', async () => {
    const { calls, fetch } = fake((fn, body) => (fn === 'delete_couple' ? { body: true } : fn === 'create_couple' ? { body: body.p_couple_id } : { body: 1 }))
    const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER, fetch })
    await t.publishSnapshot(COUPLE, TOKEN, snapshot())
    expect(await t.deleteCouple(COUPLE)).toBe(true)
    expect(calls[2]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: COUPLE })
    await t.publishSnapshot(COUPLE, TOKEN, snapshot())
    expect(fns(calls)).toEqual(['create_couple', 'publish_snapshot', 'delete_couple', 'create_couple', 'publish_snapshot'])
    const noKey = createSupabaseTransport({ ...ENV, fetch, storage: null })
    await expect(noKey.deleteCouple(COUPLE)).rejects.toBeInstanceOf(SupabaseTransportError)
  })

  it('the newer publishable key (sb_publishable_…) rides in apikey only; the classic JWT anon key as apikey and bearer', () => {
    expect(isPublishableKey('sb_publishable_abc')).toBe(true)
    expect(isPublishableKey(ENV.anonKey)).toBe(false)
    expect(rpcHeaders({ url: ENV.url, anonKey: 'sb_publishable_abc' })).toEqual({
      apikey: 'sb_publishable_abc',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
    expect(rpcHeaders(ENV).Authorization).toBe(`Bearer ${ENV.anonKey}`)
  })
})

describe('the SQL and the client agree (supabase/*.sql — read as text, never run here)', () => {
  const schema = readFileSync(path.resolve(__dirname, '../supabase/schema.sql'), 'utf8')
  const policies = readFileSync(path.resolve(__dirname, '../supabase/policies.sql'), 'utf8')
  const CLIENT_RPCS = [
    'create_couple',
    'delete_couple',
    'issue_token',
    'revoke_token',
    'publish_snapshot',
    'pull_events',
    'mark_events_read',
    'snapshot_by_token',
    'send_event',
    'record_link_open',
    'link_open_days',
  ]

  it('create_couple takes her own couple id (and replaces the one-argument draft); delete_couple removes a space with cascade; event kinds are not an enum', () => {
    expect(schema).toMatch(/drop function if exists public\.create_couple\(text\);/)
    expect(schema).toMatch(/create or replace function public\.create_couple\(p_owner_key text, p_couple_id uuid default null\)/)
    expect(policies).toMatch(/grant execute on function public\.create_couple\(text, uuid\) to anon, authenticated;/)
    expect(policies).not.toMatch(/public\.create_couple\(text\) to/)
    expect(schema).toMatch(/create or replace function public\.delete_couple\(p_owner_key text, p_couple_id uuid\)/)
    expect(policies).toMatch(/grant execute on function public\.delete_couple\(text, uuid\) to anon, authenticated;/)
    // Owner checked as (id, hash) — the hash alone is not unique any more.
    const couples = /create table if not exists public\.couples \(([\s\S]*?)\n\);/.exec(schema)?.[1] ?? ''
    expect(couples).not.toMatch(/unique/)
    expect(schema).toMatch(/alter table public\.couples drop constraint if exists couples_owner_key_hash_key;/)
    // Every table under a couple goes with it.
    for (const t of ['couple_tokens', 'partner_snapshots', 'partner_events', 'link_opens']) {
      const body = new RegExp(`create table if not exists public\\.${t} \\(([\\s\\S]*?)\\n\\);`).exec(schema)?.[1] ?? ''
      expect(body, t).toMatch(/references public\.couples \(id\) on delete cascade/)
    }
    // No server-side list of kinds to keep in step: 'join-appointment' (N32) and later kinds pass the length check.
    const events = /create table if not exists public\.partner_events \(([\s\S]*?)\n\);/.exec(schema)?.[1] ?? ''
    expect(events).toMatch(/kind text not null,/)
    expect(events).not.toMatch(/check \(kind/)
    expect(schema).toMatch(/length\(p_kind\) > 40/)
    expect('join-appointment'.length).toBeLessThanOrEqual(40)
  })

  it('every function the client calls exists and is granted to the API roles; the helpers are not', () => {
    for (const fn of CLIENT_RPCS) {
      expect(schema, fn).toMatch(new RegExp(`create or replace function public\\.${fn}\\(`))
      expect(policies, fn).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to anon, authenticated;`))
    }
    for (const helper of ['dulset_hash', 'dulset_owner_couple', 'dulset_token_couple', 'dulset_cleanup'])
      expect(policies).not.toMatch(new RegExp(`grant execute on function public\\.${helper}`))
  })

  it('링크 연 날 keeps couple · day · count and nothing else, behind RLS with no policy; the page sends the token only', () => {
    const table = /create table if not exists public\.link_opens \(([\s\S]*?)\n\);/.exec(schema)?.[1] ?? ''
    const columns = table
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('primary key') && !l.startsWith('--'))
      .map((l) => l.split(/\s+/)[0])
    expect(columns).toEqual(['couple_id', 'day', 'count'])
    expect(table).not.toMatch(/\bip\b|agent|device|token/i)
    expect(schema).toMatch(/create or replace function public\.record_link_open\(p_token text\)/)
    expect(schema).toMatch(/now\(\) at time zone 'Asia\/Seoul'/)
    expect(policies).toMatch(/alter table public\.link_opens enable row level security;/)
    expect(policies).toMatch(/revoke all on table public\.link_opens from anon, authenticated;/)
    // A seven-day snapshot fits the server's limit.
    expect(schema).toMatch(/octet_length\(p_payload::text\) > 131072/)
    expect(JSON.stringify(snapshot()).length).toBeLessThan(131072)
  })
})
