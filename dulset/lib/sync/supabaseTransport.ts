// The Supabase transport: plain fetch() against the REST (PostgREST) API.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │ NOT YET RUN AGAINST A REAL PROJECT. There is no Supabase project yet │
// │ (docs/next-a-setup.md). The request shaping is unit-tested with a    │
// │ fake fetch (tests/syncTransport.test.ts); the SQL it talks to is in  │
// │ supabase/schema.sql + policies.sql. First run: expect to adjust.     │
// └──────────────────────────────────────────────────────────────────────┘
//
// No SDK: a handful of RPC calls over HTTPS are all the partner link needs,
// and a dependency would add ~30 kB to a build that must stay small. Every call
// goes through a security-definer function (supabase/schema.sql); the
// tables themselves are not readable with the anon key (policies.sql).
//
// Secrets (the prototype's honest model, see supabase/README.md):
//  • the owner key — a random string this device makes once and keeps in
//    localStorage; the server stores its SHA-256. Publishing and pulling
//    need it. It never leaves this device except inside those calls.
//  • the share token — a random string the owner puts in the link she sends
//    (카카오톡); the server stores its hash with an expiry. Whoever has the
//    link sees the snapshot until it expires or she revokes it.
// There is no account. Supabase Auth anonymous sign-in is the next step
// (Next A ②/③) and replaces the owner key with auth.uid() in RLS.

import { localNowISO } from '../logic/notifications'
import { cleanPartnerEvent, type PartnerEvent } from '../logic/partnerEvents'
import type { PartnerSnapshot } from '../logic/partnerSnapshot'
import type { ISODate, ISODateTime } from '../types'
import { eventId, pageReceived, type ReceivedEvent, type SupabaseEnv, type Transport } from './transport'

/** localStorage key of this device's owner key (starts with 'dulset:' so a wipe clears it). */
export const OWNER_KEY_STORAGE = 'dulset:sync:ownerKey'
/** Default share-token lifetime the server applies when a publish issues one. */
export const TOKEN_DAYS_DEFAULT = 30

export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

export class SupabaseTransportError extends Error {
  constructor(
    public readonly code: 'http' | 'network' | 'bad-response',
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'SupabaseTransportError'
  }
}

export interface SupabaseTransportOptions extends SupabaseEnv {
  /** This device's owner key; default: made once and kept under OWNER_KEY_STORAGE. */
  ownerKey?: string
  fetch?: FetchLike
  now?: () => ISODateTime
  /** Where the owner key lives (default: window.localStorage). */
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null
}

/** 32 random bytes as hex (crypto where there is one). */
export function randomSecret(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(32)
    c.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  let out = ''
  while (out.length < 64) out += Math.random().toString(16).slice(2)
  return out.slice(0, 64)
}

/**
 * This device's owner key, made on first use and kept in storage. Null when
 * there is no storage at all (the key would be lost on reload — better to
 * refuse than to publish under a key nobody can use again).
 */
export function deviceOwnerKey(storage: SupabaseTransportOptions['storage'] = defaultStorage()): string | null {
  if (!storage) return null
  try {
    const kept = storage.getItem(OWNER_KEY_STORAGE)
    if (kept && kept.length >= 32) return kept
    const fresh = randomSecret()
    storage.setItem(OWNER_KEY_STORAGE, fresh)
    return fresh
  } catch {
    return null
  }
}

function defaultStorage(): SupabaseTransportOptions['storage'] {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** The RPC endpoint for a function (PostgREST: POST /rest/v1/rpc/<name>). */
export function rpcUrl(env: SupabaseEnv, fn: string): string {
  return `${env.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`
}

/** Headers every call carries: the anon key twice (apikey + bearer), JSON in and out. */
export function rpcHeaders(env: SupabaseEnv): Record<string, string> {
  return {
    apikey: env.anonKey,
    Authorization: `Bearer ${env.anonKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** A snapshot row as snapshot_by_token returns it. */
export interface SnapshotRow {
  couple_id: string
  version: number
  published_at: string
  payload: PartnerSnapshot
}

/** An event row as pull_events returns it (created_at is the server's clock — the moment it took the event in). */
export interface EventRow {
  id: string
  kind: string
  payload: PartnerEvent
  created_at: string
  read_at: string | null
}

export interface SupabaseTransport extends Transport {
  readonly kind: 'supabase'
  /** Register this device as the owner of a new couple; returns its id (keep it in settings). */
  createCouple(): Promise<string>
  /** Issue (or extend) a share token for the link; returns the expiry the server set. */
  issueToken(coupleId: string, token: string, days?: number): Promise<string>
  /** The link stops working at once. */
  revokeToken(coupleId: string, token: string): Promise<void>
  /** Events the owner has handled, so a later pull can skip them (read_at). */
  markEventsRead(coupleId: string, ids: string[]): Promise<number>
  /** Research only: distinct days in from…to the couple's link was opened (link_open_days). */
  linkOpenDays(coupleId: string, from: ISODate, to: ISODate): Promise<number>
  /** The owner key in use (null = none available on this device: publishing will fail). */
  readonly ownerKey: string | null
}

export function createSupabaseTransport(opts: SupabaseTransportOptions): SupabaseTransport {
  const env: SupabaseEnv = { url: opts.url, anonKey: opts.anonKey }
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init))
  const now = opts.now ?? (() => localNowISO())
  const ownerKey = opts.ownerKey ?? deviceOwnerKey(opts.storage === undefined ? defaultStorage() : opts.storage)

  async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T | null> {
    let res: Awaited<ReturnType<FetchLike>>
    try {
      res = await doFetch(rpcUrl(env, fn), { method: 'POST', headers: rpcHeaders(env), body: JSON.stringify(body) })
    } catch (err) {
      throw new SupabaseTransportError('network', `${fn}: ${err instanceof Error ? err.message : 'network'}`)
    }
    const text = await res.text()
    if (!res.ok) throw new SupabaseTransportError('http', `${fn}: ${res.status} ${text.slice(0, 200)}`, res.status)
    if (!text.trim()) return null
    try {
      return JSON.parse(text) as T
    } catch {
      throw new SupabaseTransportError('bad-response', `${fn}: not JSON`, res.status)
    }
  }

  const needOwner = (): string => {
    if (!ownerKey) throw new SupabaseTransportError('bad-response', 'owner key: none on this device')
    return ownerKey
  }

  /** The one row a set-returning RPC gives back (PostgREST returns an array). */
  const firstRow = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  /** pull_events, cleaned: rows were written by the partner's browser — strict shape before anything reads them. */
  async function received(coupleId: string, since: ISODateTime): Promise<ReceivedEvent[]> {
    const rows = await rpc<EventRow[]>('pull_events', { p_owner_key: needOwner(), p_couple_id: coupleId, p_since: since || null })
    const kept: ReceivedEvent[] = []
    for (const r of Array.isArray(rows) ? rows : []) {
      const event = r && typeof r === 'object' ? cleanPartnerEvent(r.payload) : undefined
      if (event && typeof r.created_at === 'string') kept.push({ receivedAt: r.created_at, event })
    }
    // The server already pages by created_at; this keeps the order and the one-per-id rule.
    return pageReceived(kept, since)
  }

  return {
    kind: 'supabase',
    ownerKey,

    async createCouple() {
      const id = await rpc<string>('create_couple', { p_owner_key: needOwner() })
      if (typeof id !== 'string') throw new SupabaseTransportError('bad-response', 'create_couple: no id')
      return id
    },

    async issueToken(coupleId, token, days = TOKEN_DAYS_DEFAULT) {
      const expires = await rpc<string>('issue_token', { p_owner_key: needOwner(), p_couple_id: coupleId, p_token: token, p_days: days })
      if (typeof expires !== 'string') throw new SupabaseTransportError('bad-response', 'issue_token: no expiry')
      return expires
    },

    async revokeToken(coupleId, token) {
      await rpc<null>('revoke_token', { p_owner_key: needOwner(), p_couple_id: coupleId, p_token: token })
    },

    async publishSnapshot(coupleId, token, snapshot) {
      await rpc<number>('publish_snapshot', {
        p_owner_key: needOwner(),
        p_couple_id: coupleId,
        p_token: token,
        p_payload: snapshot,
        p_published_at: now(),
      })
    },

    async fetchSnapshot(token) {
      const row = firstRow(await rpc<SnapshotRow | SnapshotRow[]>('snapshot_by_token', { p_token: token }))
      return row && row.payload && typeof row.payload === 'object' ? row.payload : null
    },

    async sendEvent(token, ev) {
      await rpc<null>('send_event', {
        p_token: token,
        p_event_id: eventId(ev),
        p_kind: ev.kind,
        p_payload: ev,
      })
    },

    async pullEvents(coupleId, since) {
      return (await received(coupleId, since)).map((r) => r.event)
    },

    async pullReceived(coupleId, since) {
      return received(coupleId, since)
    },

    async recordLinkOpen(token) {
      // The token only: the server resolves the couple from its hash and counts
      // its own Seoul date (record_link_open) — no day, no device, no content
      // from here. Never throws: the page must not break over a counter.
      try {
        await rpc<null>('record_link_open', { p_token: token })
      } catch {
        /* an unknown or expired link, a network blip: nothing is recorded */
      }
    },

    async linkOpenDays(coupleId, from, to) {
      const n = await rpc<number>('link_open_days', { p_owner_key: needOwner(), p_couple_id: coupleId, p_from: from, p_to: to })
      return typeof n === 'number' ? n : 0
    },

    async markEventsRead(coupleId, ids) {
      if (ids.length === 0) return 0
      const n = await rpc<number>('mark_events_read', { p_owner_key: needOwner(), p_couple_id: coupleId, p_ids: ids })
      return typeof n === 'number' ? n : 0
    },
  }
}
