import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoState } from '@/lib/demo'
import type { PartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot, type PartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import {
  MOCK_EVENTS_MAX,
  MOCK_SYNC_KEY,
  MockTransportError,
  createMockTransport,
  memoryChannel,
  memoryStorage,
  parseMockStore,
} from '@/lib/sync/mockTransport'
import {
  OWNER_KEY_STORAGE,
  SupabaseTransportError,
  createSupabaseTransport,
  deviceOwnerKey,
  randomSecret,
  rpcHeaders,
  rpcUrl,
  type FetchLike,
} from '@/lib/sync/supabaseTransport'
import {
  TRANSPORT_LABEL,
  pageEvents,
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
    expect(parseMockStore('{"snapshots":[],"tokens":null}')).toEqual({ snapshots: {}, tokens: {}, events: {} })
    expect(parseMockStore('nope')).toEqual({ snapshots: {}, tokens: {}, events: {} })
    expect(parseMockStore(null)).toEqual({ snapshots: {}, tokens: {}, events: {} })
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
      if (c.url.endsWith('/create_couple')) return { body: 'c0ffee00-0000-4000-8000-000000000001' }
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
      'issue_token',
      'publish_snapshot',
      'pull_events',
      'mark_events_read',
    ])
    expect(
      calls.every((c) => c.method === 'POST' && c.headers.apikey === 'anon-key' && c.headers.Authorization === 'Bearer anon-key'),
    ).toBe(true)
    expect(calls[0]!.body).toEqual({ p_owner_key: OWNER })
    expect(calls[1]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_token: TOKEN, p_days: 14 })
    expect(calls[2]!.body).toEqual({
      p_owner_key: OWNER,
      p_couple_id: 'c1',
      p_token: TOKEN,
      p_payload: snap,
      p_published_at: '2026-10-02T09:00:00+09:00',
    })
    expect(calls[3]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_since: '2026-10-01T09:00:00+09:00' })
    expect(calls[4]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_ids: ['e0', 'e1'] })
    // Rows are cleaned and ordered by the server's clock; the forged kind and the free text never come through.
    expect(pulled).toEqual([
      { id: 'e0', kind: 'nudge' },
      { id: 'e1', kind: 'cheer', from: 'a' },
    ])
    // The snapshot that went out is the lens-built one: no cycle records inside.
    const sent = JSON.stringify(calls[2]!.body)
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
    expect(calls[3]!.body).toEqual({ p_owner_key: OWNER, p_couple_id: 'c1', p_since: null })
    for (const c of calls) expect(JSON.stringify(c.body)).not.toContain(OWNER.slice(0, 8) + (c.url.includes('pull') ? '§' : ''))
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
