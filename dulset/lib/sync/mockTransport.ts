// The mock transport: two browser tabs are the two phones.
//
// Everything stays in this browser's localStorage under one key (so 모든 기록
// 지우기 removes it with the other 'dulset:' keys). A publish or an event
// reaches the other tab through the 'storage' event the browser fires for
// that key, plus a BroadcastChannel where there is one. No network, no
// expiry of its own (a share token lives until it is revoked or the key is
// cleared; the owner's phone revokes an expired link — lib/useLinkSync) —
// the server-side rules live in supabase/ and are what the real transport
// relies on. A token is bound to the couple it was first issued for: another
// couple can neither publish under it nor revoke it ('foreign-token').
//
// Storage and the channel are injectable, so tests drive two "tabs" over
// one fake storage without a browser.
//
// The '링크 연 날' counter (lib/sync/linkOpens.ts) lives in the same key:
// couple id → day → count, nothing else. The stamp an event gets follows the
// page's `?today=` pin when there is one (demos and screenshots pin both tabs
// to the same date — lib/store, components/link/LinkPage), so an event is
// taken in on the date the page shows.

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

export interface MockStore {
  /** The latest envelope per couple. */
  snapshots: Record<string, SnapshotEnvelope>
  /** Share token → couple (issued on first publish). */
  tokens: Record<string, { coupleId: string; issuedAt: ISODateTime }>
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

export type MockErrorCode = 'unknown-token' | 'foreign-token' | 'storage'

const MOCK_ERROR_TEXT: Record<MockErrorCode, string> = {
  'unknown-token': '이 링크는 더 이상 유효하지 않아요',
  'foreign-token': '이 링크는 다른 두 사람의 것이에요',
  storage: '이 기기에 저장할 수 없어요',
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
  /** The whole store, for 설정 › 데이터 (how many events wait) and tests. */
  read(): MockStore
  /** Forget everything (the wipe does this through the 'dulset:' prefix too). */
  reset(): void
}

export function createMockTransport(opts: MockTransportOptions = {}): MockTransport {
  const storage = opts.storage === undefined ? browserStorage() : opts.storage
  const channel = opts.channel === undefined ? browserChannel() : opts.channel
  const now = opts.now ?? (() => pinnedNowISO())

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
  const coupleOf = (store: MockStore, token: string): string => {
    const t = store.tokens[token]
    if (!t) throw new MockTransportError('unknown-token')
    return t.coupleId
  }
  /** The token's binding for `coupleId`: its existing one, a fresh one, never another couple's. */
  const bind = (store: MockStore, coupleId: string, token: string, at: ISODateTime): MockStore['tokens'][string] => {
    const t = store.tokens[token]
    if (t && t.coupleId !== coupleId) throw new MockTransportError('foreign-token')
    return t ?? { coupleId, issuedAt: at }
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
      const version = (store.snapshots[coupleId]?.version ?? 0) + 1
      const at = now()
      write({
        ...store,
        tokens: { ...store.tokens, [token]: bind(store, coupleId, token, at) },
        snapshots: { ...store.snapshots, [coupleId]: { coupleId, token, version, publishedAt: at, snapshot } },
      })
      channel?.post({ coupleId, what: 'snapshot' })
    },

    async issueToken(coupleId, token, days = MOCK_TOKEN_DAYS) {
      const store = read()
      const at = now()
      const bound = bind(store, coupleId, token, at)
      if (!store.tokens[token]) write({ ...store, tokens: { ...store.tokens, [token]: bound } })
      // The mock keeps no expiry: the owner's phone enforces it (lib/useLinkSync revokes an expired link).
      return addDays(at.slice(0, 10), Math.max(1, Math.min(90, days))) + at.slice(10)
    },

    async revokeToken(coupleId, token) {
      const store = read()
      const t = store.tokens[token]
      if (!t) return
      if (t.coupleId !== coupleId) throw new MockTransportError('foreign-token')
      const tokens = { ...store.tokens }
      delete tokens[token]
      write({ ...store, tokens })
      channel?.post({ coupleId, what: 'snapshot' })
    },

    async fetchSnapshot(token) {
      const store = read()
      const t = store.tokens[token]
      if (!t) return null
      return store.snapshots[t.coupleId]?.snapshot ?? null
    },

    async sendEvent(token, ev) {
      const store = read()
      const coupleId = coupleOf(store, token)
      const list = store.events[coupleId] ?? []
      if (list.some((r) => eventId(r.event) === eventId(ev))) return
      const events = [...list, { receivedAt: now(), event: ev }].slice(-MOCK_EVENTS_MAX)
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
      // Never throws: an unknown or revoked token, a bad day or a full storage records nothing.
      try {
        const store = read()
        const t = store.tokens[token]
        if (!t || !isISODate(day)) return
        const ev: LinkOpenEvent = { coupleId: t.coupleId, day }
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
