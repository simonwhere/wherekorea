// Transport abstraction for the partner link (Next A ① → ③).
//
// What travels: the PartnerSnapshot the cycle owner's phone builds through
// the privacy lenses (lib/logic/partnerSnapshot.ts — never the AppState: no
// period, LH or test record, no personal log, no 관계일, nothing the partner's
// own lens would hide), published under an expiring share token, and the
// small PartnerEvents the partner sends back (lib/logic/partnerEvents.ts:
// a check, a reply, a signal, 콕, 응원, his month task — ids and dates only).
// The owner's phone publishes and pulls; the partner's browser fetches and
// sends.
//
// Two implementations share this interface:
//  • lib/sync/mockTransport.ts — localStorage + BroadcastChannel: two browser
//    tabs are the two phones, nothing leaves the device (the default today);
//  • lib/sync/supabaseTransport.ts — the Supabase REST API over fetch(), used
//    only when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are
//    set at build time (docs/next-a-setup.md). Not yet run against a server.
//
// Nothing here imports React or the store; screens call transport() and
// keep their own polling / subscription.

import type { PartnerEvent } from '../logic/partnerEvents'
import type { PartnerSnapshot } from '../logic/partnerSnapshot'
import type { ISODateTime } from '../types'

/** What a published snapshot is wrapped in (the row in storage / the DB). */
export interface SnapshotEnvelope {
  coupleId: string
  /** The share token this snapshot was published for (the mock stores it; the server stores its hash). */
  token: string
  /** Monotonic per couple: the mock counts, the server assigns max + 1. */
  version: number
  /** Local-date-prefixed stamp (stampOn) of the publish. */
  publishedAt: ISODateTime
  snapshot: PartnerSnapshot
}

/**
 * An event as a transport holds it. Events carry no clock of their own
 * (lib/logic/partnerEvents.ts: an id and ids/dates), so the transport stamps
 * the moment it took the event in — the mock with this device's clock, the
 * server with its own — and pages on that.
 */
export interface ReceivedEvent {
  receivedAt: ISODateTime
  event: PartnerEvent
}

export type TransportKind = 'mock' | 'supabase'

export interface Transport {
  readonly kind: TransportKind
  /**
   * The owner's phone: publish the latest snapshot for `coupleId` under the
   * share `token` (a new version each time; the token is issued on first use).
   */
  publishSnapshot(coupleId: string, token: string, snapshot: PartnerSnapshot): Promise<void>
  /** The partner's browser: the latest snapshot the token can see, or null (unknown, expired, revoked, none yet). */
  fetchSnapshot(token: string): Promise<PartnerSnapshot | null>
  /** The partner's browser: send one event (idempotent by its id — a second send of the same id changes nothing). */
  sendEvent(token: string, ev: PartnerEvent): Promise<void>
  /**
   * The owner's phone: the events for `coupleId` the transport took in after
   * `since` (an exclusive stamp; '' for everything), oldest first, one per
   * id, each already through cleanPartnerEvent. The caller passes a window
   * from its own clock (e.g. a week back) and relies on applyPartnerEvent's
   * once-per-id rule, so neither clock skew nor a repeat delivery matters.
   */
  pullEvents(coupleId: string, since: ISODateTime): Promise<PartnerEvent[]>
  /**
   * Optional: be told when a snapshot or event for `coupleId` may have
   * changed (the mock: the other tab wrote). Returns the unsubscribe.
   * Without it, callers poll.
   */
  watch?(coupleId: string, onChange: () => void): () => void
  /**
   * Optional: issue (or extend) a share token for the link before the first
   * publish; returns the expiry the transport set. A publish issues the token
   * on first use anyway, so the owner's phone need not call this.
   */
  issueToken?(coupleId: string, token: string, days?: number): Promise<ISODateTime>
  /**
   * Optional: the link stops working at once — the partner's next fetch gets
   * null (lib/useLinkSync revokeOnTransport; 설정 › 연결 → 링크 해제 and a
   * rotation). A token that belongs to another couple is refused.
   */
  revokeToken?(coupleId: string, token: string): Promise<void>
}

/** The dedup key of an event (its own id — the idempotency key both sides use). */
export function eventId(ev: Pick<PartnerEvent, 'id'>): string {
  return ev.id
}

/**
 * Received events after `since` (exclusive), oldest first (ties by id), one
 * per id (the first arrival wins). Pure; both transports use it.
 */
export function pageEvents(list: readonly ReceivedEvent[], since: ISODateTime): PartnerEvent[] {
  const seen = new Set<string>()
  const out: PartnerEvent[] = []
  const sorted = [...list].sort((a, b) =>
    a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0,
  )
  for (const r of sorted) {
    if (seen.has(r.event.id)) continue
    seen.add(r.event.id)
    if (r.receivedAt > since) out.push(r.event)
  }
  return out
}

// ── Picking the transport ───────────────────────────────────

export interface SupabaseEnv {
  url: string
  anonKey: string
}

/**
 * The Supabase project this build was given, or null. Next.js inlines these
 * two names at build time (they must be spelled out, not computed), so the
 * choice is fixed per build: no env → the mock, and nothing ever leaves the
 * device (docs/next-a-setup.md).
 */
export function supabaseEnv(): SupabaseEnv | null {
  // A bundle without Next's `process` shim (the single-file demo, a plain
  // esbuild/vite build) has no env at all: the mock, never a crash at load.
  if (typeof process === 'undefined' || !process.env) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return pickSupabaseEnv(url, anonKey)
}

/** Pure core of supabaseEnv: both set and non-empty, url without a trailing slash. */
export function pickSupabaseEnv(url: string | undefined, anonKey: string | undefined): SupabaseEnv | null {
  const u = (url ?? '').trim().replace(/\/+$/, '')
  const k = (anonKey ?? '').trim()
  return u && k ? { url: u, anonKey: k } : null
}

/** 'supabase' when both variables exist at build time, else 'mock' (what 설정 › 데이터 shows as 연결). */
export function transportKind(env: SupabaseEnv | null = supabaseEnv()): TransportKind {
  return env ? 'supabase' : 'mock'
}

/** The line 설정 › 데이터 shows for the connection. */
export const TRANSPORT_LABEL: Record<TransportKind, string> = {
  mock: '연결: 이 기기 안 (모의)',
  supabase: '연결: Supabase',
}

let singleton: Transport | null = null

/**
 * The app's transport — one instance per page. Built lazily so a static
 * export never touches window at import time; the implementation is loaded
 * on first use, so the mock build never carries the Supabase code path.
 */
export async function transport(): Promise<Transport> {
  if (singleton) return singleton
  const env = supabaseEnv()
  if (env) {
    const { createSupabaseTransport } = await import('./supabaseTransport')
    singleton = createSupabaseTransport(env)
  } else {
    const { createMockTransport } = await import('./mockTransport')
    singleton = createMockTransport()
  }
  return singleton
}

/** Tests only: forget the instance. */
export function resetTransport(): void {
  singleton = null
}
