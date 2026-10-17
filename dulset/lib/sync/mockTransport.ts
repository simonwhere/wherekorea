// The mock transport: two browser tabs are the two phones.
//
// Everything stays in this browser's localStorage under one key (so 모든 기록
// 지우기 removes it with the other 'dulset:' keys). A publish or an event
// reaches the other tab through the 'storage' event the browser fires for
// that key, plus a BroadcastChannel where there is one. No network. Each
// token carries the expiry the server keeps (issued: now + MOCK_TOKEN_DAYS,
// moved by extendToken while 둘셋 is in use, never shortened), and the
// PARTNER-side calls honour it as the server's do (snapshot_by_token,
// send_event, record_link_open all ask `expires_at > now()`): once its end
// has passed — she has not opened 둘셋 for 30 days — his page reads nothing,
// an event is refused and the counter records nothing, so his tab shows
// '링크가 만료됐어요' on that day, not '지은님 폰이 열리면 다시 채워져요' (QA
// 2026-10-17: the mock used to read past the end until her phone revoked it).
// `now()` follows the page's `?today=` pin, so pin both tabs in a demo. The
// owner's phone also revokes an expired link the first time it sees it
// (lib/useLinkSync). extendToken answers as the server's extend_token does:
// a live token is renewed, an expired or revoked one gets null and stays dead. A revoked
// token stays in the store with its `revokedAt` (as the server's row keeps
// revoked_at): a later publish under it is refused ('unknown-token', as
// publish_snapshot's 42501), and the page's reads, events and the counter
// treat it as unknown — so a second owner tab whose publish fires just after
// 링크 해제 in the other tab never brings it back. Only issueToken clears the
// mark (the server's issue_token upsert sets revoked_at = null). The
// server-side rules live in supabase/ and are what the real transport relies
// on. A token is bound to the couple it was first issued for: another couple
// can neither publish under it nor revoke it ('foreign-token'), and gets
// null from extendToken.
//
// Storage and the channel are injectable, so tests drive two "tabs" over
// one fake storage without a browser.
//
// The '링크 연 날' counter (lib/sync/linkOpens.ts) lives in the same key:
// couple id → day → count, nothing else. The stamp an event gets follows the
// page's `?today=` pin when there is one (demos and screenshots pin both tabs
// to the same date — lib/store, components/link/LinkPage), so an event is
// taken in on the date the page shows.
//
// Offline, simulated (mock only): with `?mockOffline=1` on the page's address
// or 'dulset:mock-offline' = '1' in this browser's storage, the PARTNER-side
// calls fail as an unreachable server would (fetchSnapshot / sendEvent throw
// 'offline'; recordLinkOpen records nothing) — so the link's '지금은 불러올 수
// 없어요' can be seen and tested without a network. Her phone's calls
// (publish, pull, revoke) are left alone: the mock is one browser, and the
// point is to see HIS page with no connection. Nothing else reads the flag.

import { addDays, isISODate } from '../dates'
import { localNowISO } from '../logic/notifications'
import { cleanPartnerEvent, type PartnerEvent } from '../logic/partnerEvents'
import type { PartnerSnapshot } from '../logic/partnerSnapshot'
import { stampOn } from '../logic/today'
import type { ISODateTime } from '../types'
import { cleanLinkOpenCounts, countLinkOpen, openDaysBetween, type LinkOpenCounts, type LinkOpenEvent } from './linkOpens'
import { eventId, pageReceived, type ReceivedEvent, type SnapshotEnvelope, type Transport } from './transport'

export const MOCK_SYNC_KEY = 'dulset:mock-sync:v1'
export const MOCK_CHANNEL = 'dulset:mock-sync'
/** Events kept per couple (oldest dropped). */
export const MOCK_EVENTS_MAX = 200
/** The expiry issueToken reports (the same default as the server's issue_token). */
export const MOCK_TOKEN_DAYS = 30
/** localStorage flag ('1') that makes the mock's partner-side calls fail as offline (a test / demo switch). */
export const MOCK_OFFLINE_KEY = 'dulset:mock-offline'
/** The page-address switch for the same: `?mockOffline=1`. */
export const MOCK_OFFLINE_PARAM = 'mockOffline'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** The part of BroadcastChannel the mock uses (a test passes a shared bus). */
export interface ChannelLike {
  post(message: MockMessage): void
  subscribe(listener: (message: MockMessage) => void): () => void
}

export interface MockMessage {
  coupleId: string
  what: 'snapshot' | 'event'
}

export interface MockToken {
  coupleId: string
  issuedAt: ISODateTime
  expiresAt?: ISODateTime
  /** Set by revokeToken (a tombstone, as the server's revoked_at): the token never opens or publishes again. */
  revokedAt?: ISODateTime
}

/** A token the mock still honours: known and not revoked (any `revokedAt` read from storage counts as revoked). */
export function liveMockToken(t: MockToken | undefined): t is MockToken {
  return !!t && !t.revokedAt
}

/** A local-date-prefixed stamp (what now() gives); anything else from storage is not trusted. */
const isStamp = (v: unknown): v is ISODateTime =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) && isISODate(v.slice(0, 10))
/** Stamps compare by their wall-clock part (one device's clock, one offset). */
const wall = (iso: ISODateTime) => iso.slice(0, 19)
/** `days` (1–90, as the server clamps) after a stamp, keeping its time of day and offset. */
const stampPlusDays = (at: ISODateTime, days: number): ISODateTime =>
  addDays(at.slice(0, 10), Math.max(1, Math.min(90, days))) + at.slice(10)

/** The expiry a mock token carries (older stores: issuedAt + MOCK_TOKEN_DAYS), or null when neither stamp is readable. */
export function mockTokenExpiry(t: Pick<MockToken, 'issuedAt' | 'expiresAt'>): ISODateTime | null {
  if (isStamp(t.expiresAt)) return t.expiresAt
  return isStamp(t.issuedAt) ? stampPlusDays(t.issuedAt, MOCK_TOKEN_DAYS) : null
}

export interface MockStore {
  /** The latest envelope per couple. */
  snapshots: Record<string, SnapshotEnvelope>
  /**
   * Share token → couple (issued on first publish), the expiry the server would keep (absent on older
   * stores: issuedAt + MOCK_TOKEN_DAYS) and, once revoked, revokedAt (kept: a tombstone).
   */
  tokens: Record<string, MockToken>
  /** Events per couple, in arrival order, each with the moment this device took it in. */
  events: Record<string, ReceivedEvent[]>
  /** '링크 연 날': couple → day → how many opens (lib/sync/linkOpens.ts). */
  opens: LinkOpenCounts
}

const EMPTY: MockStore = { snapshots: {}, tokens: {}, events: {}, opens: {} }

/** Read the store (an unreadable or foreign value counts as empty). */
export function parseMockStore(raw: string | null): MockStore {
  if (!raw) return { ...EMPTY }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...EMPTY }
    const p = parsed as Partial<MockStore>
    const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, never>) : {})
    return { snapshots: obj(p.snapshots), tokens: obj(p.tokens), events: obj(p.events), opens: cleanLinkOpenCounts(p.opens) }
  } catch {
    return { ...EMPTY }
  }
}

export type MockErrorCode = 'unknown-token' | 'foreign-token' | 'storage' | 'offline'

const MOCK_ERROR_TEXT: Record<MockErrorCode, string> = {
  'unknown-token': '이 링크는 더 이상 유효하지 않아요',
  'foreign-token': '이 링크는 다른 두 사람의 것이에요',
  storage: '이 기기에 저장할 수 없어요',
  offline: '지금은 연결할 수 없어요 (모의 오프라인)',
}

/**
 * Is the mock simulating no network for this page? `?mockOffline=1` (or
 * 'true') in `search`, or MOCK_OFFLINE_KEY = '1' in `storage`. Pure over its
 * inputs; any read error counts as online.
 */
export function mockOfflineOn(search: string | undefined, storage: Pick<StorageLike, 'getItem'> | null | undefined): boolean {
  try {
    const v = search ? new URLSearchParams(search).get(MOCK_OFFLINE_PARAM) : null
    if (v === '1' || v === 'true') return true
  } catch {
    /* no address */
  }
  try {
    return storage?.getItem(MOCK_OFFLINE_KEY) === '1'
  } catch {
    return false
  }
}

export class MockTransportError extends Error {
  constructor(public readonly code: MockErrorCode) {
    super(MOCK_ERROR_TEXT[code])
    this.name = 'MockTransportError'
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** A BroadcastChannel wrapped as ChannelLike, or null where there is none. */
function browserChannel(): ChannelLike | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null
    const bc = new BroadcastChannel(MOCK_CHANNEL)
    return {
      post: (message) => {
        try {
          bc.postMessage(message)
        } catch {
          /* a closed channel — the storage event still carries it */
        }
      },
      subscribe: (listener) => {
        const handler = (e: MessageEvent) => {
          const m = e.data as Partial<MockMessage> | null
          if (m && typeof m.coupleId === 'string' && (m.what === 'snapshot' || m.what === 'event'))
            listener({ coupleId: m.coupleId, what: m.what })
        }
        bc.addEventListener('message', handler)
        return () => bc.removeEventListener('message', handler)
      },
    }
  } catch {
    return null
  }
}

/** An in-memory bus for tests: every transport created with it hears every post. */
export function memoryChannel(): ChannelLike {
  const listeners = new Set<(m: MockMessage) => void>()
  return {
    post: (m) => listeners.forEach((l) => l(m)),
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

/** An in-memory Storage for tests (share one between two "tabs"). */
export function memoryStorage(): StorageLike & { keys(): string[] } {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  }
}

export interface MockTransportOptions {
  storage?: StorageLike | null
  channel?: ChannelLike | null
  /** The stamp a publish or an event gets (defaults to the clock, on the page's `?today=` date when pinned). */
  now?: () => ISODateTime
  /** Simulated offline for the partner-side calls (defaults to mockOfflineOn over the page's address and storage). */
  offline?: () => boolean
}

/** This device's clock, on the `?today=YYYY-MM-DD` date when the page is pinned (as lib/store reads it). */
export function pinnedNowISO(search: string | undefined = typeof window !== 'undefined' ? window.location.search : undefined): ISODateTime {
  try {
    const v = search ? new URLSearchParams(search).get('today') : null
    if (v && isISODate(v)) return stampOn(v)
  } catch {
    /* no pin */
  }
  return localNowISO()
}

export interface MockTransport extends Transport {
  readonly kind: 'mock'
  /** Renew a live token of this couple (Transport.extendToken); null for an unknown, foreign, expired or revoked one. */
  extendToken(coupleId: string, token: string, days?: number): Promise<ISODateTime | null>
  /** The whole store, for 설정 › 데이터 (how many events wait) and tests. */
  read(): MockStore
  /** Forget everything (the wipe does this through the 'dulset:' prefix too). */
  reset(): void
}

export function createMockTransport(opts: MockTransportOptions = {}): MockTransport {
  const storage = opts.storage === undefined ? browserStorage() : opts.storage
  const channel = opts.channel === undefined ? browserChannel() : opts.channel
  const now = opts.now ?? (() => pinnedNowISO())
  const offline =
    opts.offline ?? (() => mockOfflineOn(typeof window !== 'undefined' ? window.location.search : undefined, storage))
  const failIfOffline = (): void => {
    if (offline()) throw new MockTransportError('offline')
  }

  const read = (): MockStore => {
    try {
      return parseMockStore(storage?.getItem(MOCK_SYNC_KEY) ?? null)
    } catch {
      return { ...EMPTY }
    }
  }
  const write = (store: MockStore): void => {
    if (!storage) throw new MockTransportError('storage')
    try {
      storage.setItem(MOCK_SYNC_KEY, JSON.stringify(store))
    } catch {
      throw new MockTransportError('storage')
    }
  }
  /** A token his page may use right now: live and before its end (the server's `revoked_at is null and expires_at > now()`). */
  // The clock is read once, and only for a live token; the stamp comes back so an event is taken in at that same moment.
  const openToken = (store: MockStore, token: string): { t: MockToken; at: ISODateTime } | undefined => {
    const t = store.tokens[token]
    if (!liveMockToken(t)) return undefined
    const at = now()
    const end = mockTokenExpiry(t)
    return end && wall(at) < wall(end) ? { t, at } : undefined
  }
  /** The token's binding for `coupleId`: its existing one (revoked or not), a fresh one, never another couple's. */
  const bind = (store: MockStore, coupleId: string, token: string, at: ISODateTime): MockToken => {
    const t = store.tokens[token]
    if (t && t.coupleId !== coupleId) throw new MockTransportError('foreign-token')
    return t ?? { coupleId, issuedAt: at, expiresAt: stampPlusDays(at, MOCK_TOKEN_DAYS) }
  }

  /** The couple's events after `since`, cleaned: what the other tab wrote is as untrusted as a server row. */
  const received = (coupleId: string, since: ISODateTime): ReceivedEvent[] => {
    const kept: ReceivedEvent[] = []
    for (const r of read().events[coupleId] ?? []) {
      const event = r && typeof r === 'object' ? cleanPartnerEvent(r.event) : undefined
      if (event && typeof r.receivedAt === 'string') kept.push({ receivedAt: r.receivedAt, event })
    }
    return pageReceived(kept, since)
  }

  return {
    kind: 'mock',

    async publishSnapshot(coupleId, token, snapshot) {
      const store = read()
      const at = now()
      const bound = bind(store, coupleId, token, at)
      // Never under a revoked token (the server's publish_snapshot raises 42501): it stays dead.
      if (bound.revokedAt) throw new MockTransportError('unknown-token')
      const version = (store.snapshots[coupleId]?.version ?? 0) + 1
      write({
        ...store,
        tokens: { ...store.tokens, [token]: bound },
        snapshots: { ...store.snapshots, [coupleId]: { coupleId, token, version, publishedAt: at, snapshot } },
      })
      channel?.post({ coupleId, what: 'snapshot' })
    },

    async issueToken(coupleId, token, days = MOCK_TOKEN_DAYS) {
      const store = read()
      const at = now()
      const { revokedAt: _cleared, ...bound } = bind(store, coupleId, token, at)
      // As the server's issue_token: the expiry is set to now + days and revoked_at is cleared.
      const expiresAt = stampPlusDays(at, days)
      write({ ...store, tokens: { ...store.tokens, [token]: { ...bound, expiresAt } } })
      return expiresAt
    },

    async extendToken(coupleId, token, days = MOCK_TOKEN_DAYS) {
      // As the server's extend_token: only a live token of this couple, never shorter, never revived.
      const store = read()
      const t = store.tokens[token]
      if (!liveMockToken(t) || t.coupleId !== coupleId) return null
      const at = now()
      const current = mockTokenExpiry(t)
      if (!current || wall(at) >= wall(current)) return null
      const next = stampPlusDays(at, days)
      const expiresAt = wall(next) > wall(current) ? next : current
      if (expiresAt !== t.expiresAt) write({ ...store, tokens: { ...store.tokens, [token]: { ...t, expiresAt } } })
      return expiresAt
    },

    async revokeToken(coupleId, token) {
      const store = read()
      const t = store.tokens[token]
      if (!t) return
      if (t.coupleId !== coupleId) throw new MockTransportError('foreign-token')
      // Already revoked: nothing changes (the server keeps the first revoked_at).
      if (t.revokedAt) return
      write({ ...store, tokens: { ...store.tokens, [token]: { ...t, revokedAt: now() } } })
      channel?.post({ coupleId, what: 'snapshot' })
    },

    async fetchSnapshot(token) {
      failIfOffline()
      const store = read()
      // Unknown, revoked or past its end: nothing (the server's snapshot_by_token returns no rows).
      const open = openToken(store, token)
      if (!open) return null
      return store.snapshots[open.t.coupleId]?.snapshot ?? null
    },

    async sendEvent(token, ev) {
      failIfOffline()
      const store = read()
      // Unknown, revoked or past its end: refused (the server's send_event raises 42501).
      const open = openToken(store, token)
      if (!open) throw new MockTransportError('unknown-token')
      const coupleId = open.t.coupleId
      const list = store.events[coupleId] ?? []
      if (list.some((r) => eventId(r.event) === eventId(ev))) return
      const events = [...list, { receivedAt: open.at, event: ev }].slice(-MOCK_EVENTS_MAX)
      write({ ...store, events: { ...store.events, [coupleId]: events } })
      channel?.post({ coupleId, what: 'event' })
    },

    async pullEvents(coupleId, since) {
      return received(coupleId, since).map((r) => r.event)
    },

    async pullReceived(coupleId, since) {
      return received(coupleId, since)
    },

    async recordLinkOpen(token, day) {
      // Never throws: an unknown, revoked or expired token, a bad day, a full storage or (simulated) offline records nothing.
      try {
        if (offline()) return
        const store = read()
        const open = openToken(store, token)
        if (!open || !isISODate(day)) return
        const ev: LinkOpenEvent = { coupleId: open.t.coupleId, day }
        write({ ...store, opens: countLinkOpen(store.opens, ev) })
      } catch {
        /* the page never breaks over a counter */
      }
    },

    async linkOpenDays(coupleId, from, to) {
      return openDaysBetween(read().opens, coupleId, from, to)
    },

    watch(coupleId, onChange) {
      const offChannel = channel?.subscribe((m) => {
        if (m.coupleId === coupleId) onChange()
      })
      let offStorage: (() => void) | undefined
      try {
        if (typeof window !== 'undefined') {
          const handler = (e: StorageEvent) => {
            if (e.key === MOCK_SYNC_KEY) onChange()
          }
          window.addEventListener('storage', handler)
          offStorage = () => window.removeEventListener('storage', handler)
        }
      } catch {
        offStorage = undefined
      }
      return () => {
        offChannel?.()
        offStorage?.()
      }
    },

    read,

    reset() {
      try {
        storage?.removeItem(MOCK_SYNC_KEY)
      } catch {
        /* nothing stored */
      }
    },
  }
}
