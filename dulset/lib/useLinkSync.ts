'use client'

// The partner link on the OWNER's phone (Next A ①: 남편용 설치 없는 웹 화면).
//
// Two halves share this file:
//  • pure helpers for the link record — the share token, its expiry, the URL
//    and the `#t=` hash the page reads (tested in tests/linkPage.test.ts);
//  • the hooks: useLinkRecord (the record kept on this device), useLinkSync
//    (publish the snapshot, pull the partner's events) and useLinkSyncStatus
//    (what 설정 › 연결 shows).
//
// What travels is only lib/logic/partnerSnapshot.buildPartnerSnapshot — a
// projection through the privacy lenses for today and the six days after it
// (N20), never the AppState — and what comes back is applied with
// lib/logic/partnerSnapshot.applyReceivedEvents through update(fn): each event
// on the day the transport took it in, with the same gates the app's own
// screens use (partnerEvents.applyPartnerEvent), so a reply he sent on Monday
// still counts when her phone opens on Thursday.
//
// The record lives in localStorage under LINK_KEY: the raw token stays on this
// device only (it has to: the owner needs it to publish, and the server
// stores only its hash). The couple's state holds its mirror, `couple.link`
// (the couple id, the token's SHA-256, the dates — lib/logic/partnerLink.ts
// coupleLinkOf), kept in step by useLinkSync on the owner's tab, so a backup
// and 설정 know a link exists without ever carrying the secret. The key
// starts with 'dulset:' so 모든 기록 지우기 clears it with the rest.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { localNowISO } from './logic/notifications'
import { addDays } from './dates'
import { hasAppliedEvent } from './logic/partnerEvents'
import {
  coupleLinkOf,
  linkStatus,
  makeLink,
  parseLinkRecord,
  revokeLinkRecord,
  sameCoupleLink,
  setCoupleLink,
  type LinkRecord,
} from './logic/partnerLink'
import { applyReceivedEvents, buildPartnerSnapshot } from './logic/partnerSnapshot'
import { partnerId } from './logic/partnerTrack'
import { stampOn } from './logic/today'
import { cycleOwnerId } from './logic/ttcFlow'
import type { AppApi } from './store'
import { MOCK_SYNC_KEY, parseMockStore, type StorageLike } from './sync/mockTransport'
import { transport, transportKind, type TransportKind } from './sync/transport'
import type { ISODateTime } from './types'

// ── The record (pure helpers live in lib/logic/partnerLink.ts) ──

export {
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
  shareText,
  shareURL,
  toBase64Url,
  tokenFromHash,
  type LinkRecord,
  type LinkStatus,
} from './logic/partnerLink'

/** localStorage key of the link record (prefix 'dulset:' — a wipe clears it). */
export const LINK_KEY = 'dulset:link'
/** Fired on window after the record changed in this tab (other tabs get the 'storage' event). */
export const LINK_EVENT = 'dulset:link-changed'

// ── Storage ─────────────────────────────────────────────────

function safeLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** The raw value → record cache, so useSyncExternalStore gets the same object while nothing changed. */
let cache: { raw: string | null; link: LinkRecord | null } = { raw: null, link: null }

export function readLink(): LinkRecord | null {
  let raw: string | null = null
  try {
    raw = safeLocal()?.getItem(LINK_KEY) ?? null
  } catch {
    raw = null
  }
  if (raw !== cache.raw) cache = { raw, link: parseLinkRecord(raw) }
  return cache.link
}

export function writeLink(link: LinkRecord | null): boolean {
  const ls = safeLocal()
  if (!ls) return false
  try {
    if (link) ls.setItem(LINK_KEY, JSON.stringify(link))
    else ls.removeItem(LINK_KEY)
  } catch {
    return false
  }
  try {
    window.dispatchEvent(new Event(LINK_EVENT))
  } catch {
    /* no window */
  }
  return true
}

function subscribeLink(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === LINK_KEY || e.key === null) onChange()
  }
  window.addEventListener(LINK_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LINK_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

const noLink = (): LinkRecord | null => null

/** The link record on this device (null before one is made, or after a wipe). */
export function useLinkRecord(): LinkRecord | null {
  return useSyncExternalStore(subscribeLink, readLink, noLink)
}

// ── Revoking on the transport ───────────────────────────────

/**
 * Remove a token from the mock's store directly (what revokeToken does on
 * the mock transport) — kept for tests and tools that hold the storage
 * rather than a transport. Returns whether the token was known.
 */
export function revokeMockToken(storage: StorageLike, token: string): boolean {
  const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
  if (!store.tokens[token]) return false
  const tokens = { ...store.tokens }
  delete tokens[token]
  storage.setItem(MOCK_SYNC_KEY, JSON.stringify({ ...store, tokens }))
  return true
}

/** The link stops working on the transport (both transports have revokeToken; a transport without it is left alone). */
export async function revokeOnTransport(link: Pick<LinkRecord, 'coupleId' | 'token'>): Promise<void> {
  const t = await transport()
  if (t.revokeToken) await t.revokeToken(link.coupleId, link.token)
}

// ── Mutations (설정 › 연결, the onboarding's last screen) ────

/**
 * Make the link (or a new one in place of the current: the old token is
 * revoked on the transport, best effort, so an old 카톡 message stops working).
 * The snapshot goes up with the next useLinkSync run on the owner's phone.
 */
export async function rotateLink(nowISO: ISODateTime = localNowISO()): Promise<LinkRecord> {
  const prev = readLink()
  if (prev && !prev.revokedAt) {
    try {
      await revokeOnTransport(prev)
    } catch {
      /* the old token dies with its expiry at the latest */
    }
  }
  const next = makeLink(prev, nowISO)
  writeLink(next)
  return next
}

/** Stop the link: the record keeps its revokedAt (설정 shows it), the transport forgets the token. */
export async function revokeLink(nowISO: ISODateTime = localNowISO()): Promise<void> {
  const prev = readLink()
  if (!prev) return
  writeLink(revokeLinkRecord(prev, nowISO))
  try {
    await revokeOnTransport(prev)
  } catch {
    /* best effort: an unreachable server still expires it */
  }
}

/** Share the address: the system share sheet (카카오톡 is on it) where there is one, else the clipboard. */
export async function shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const nav = navigator as Navigator & { share?: (data: { text?: string; url?: string; title?: string }) => Promise<void> }
    if (typeof nav.share === 'function') {
      await nav.share({ title: '둘셋', text, url })
      return 'shared'
    }
  } catch (e) {
    // A dismissed sheet is not a failure to report; anything else falls back to copying.
    if (e instanceof Error && e.name === 'AbortError') return 'failed'
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      return 'copied'
    }
  } catch {
    /* legacy path */
  }
  try {
    const el = document.createElement('textarea')
    el.value = `${text}\n${url}`
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}

// ── Status (for 설정 › 연결) ─────────────────────────────────

export interface LinkSyncStatus {
  kind: TransportKind
  /** The last snapshot publish that succeeded on this tab. */
  publishedAt: ISODateTime | null
  /** The last events pull that succeeded on this tab. */
  pulledAt: ISODateTime | null
  /** The last transport error, in words for the screen. */
  error: string | null
}

let status: LinkSyncStatus = { kind: transportKind(), publishedAt: null, pulledAt: null, error: null }
const statusListeners = new Set<() => void>()

function setStatus(patch: Partial<LinkSyncStatus>): void {
  status = { ...status, ...patch }
  statusListeners.forEach((l) => l())
}

function subscribeStatus(l: () => void): () => void {
  statusListeners.add(l)
  return () => statusListeners.delete(l)
}

const getStatus = () => status
const INITIAL_STATUS: LinkSyncStatus = { kind: transportKind(), publishedAt: null, pulledAt: null, error: null }
const getInitialStatus = () => INITIAL_STATUS

export function useLinkSyncStatus(): LinkSyncStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getInitialStatus)
}

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '연결에 문제가 있어요'
}

// ── The sync hook (mounted once in AppShell) ────────────────
// It takes the app api instead of calling useApp itself, so this module
// never imports the store (tests load the pure helpers above without JSX).

/** After the last state change, this long before the snapshot goes up. */
export const PUBLISH_DEBOUNCE_MS = 400
/** Events are pulled this often while the tab is visible (plus on focus and on the transport's watch). */
export const PULL_EVERY_MS = 4_000
/** The pull window: events the transport took in during the last N days (applyPartnerEvent skips repeats). */
export const PULL_WINDOW_DAYS = 7

/**
 * The pull window's start: PULL_WINDOW_DAYS back from her day or from the
 * clock, whichever is earlier (a `?today=` demo pin and the real clock both
 * stay inside it).
 */
export function pullSince(today: string, nowMs: number = Date.now()): ISODateTime {
  const byDay = stampOn(addDays(today, -PULL_WINDOW_DAYS))
  const byClock = localNowISO(new Date(nowMs - PULL_WINDOW_DAYS * 86_400_000))
  return byDay < byClock ? byDay : byClock
}

/**
 * On the cycle owner's phone (the tab whose viewer is the owner — in the
 * prototype the other tab is the partner's phone, and never publishes):
 *  • after every relevant state change (debounced), build the snapshot and
 *    publish it under the live token — the same snapshot twice is not re-sent;
 *  • pull the partner's events every few seconds, on focus, and when the
 *    transport says something changed; apply the new ones with update(fn),
 *    each on the day it was taken in (applyReceivedEvents).
 * An expired link is revoked on the transport the first time it is seen.
 */
export function useLinkSync(app: AppApi): void {
  const { state, update, today, viewer } = app
  const link = useLinkRecord()
  const owner = cycleOwnerId(state)
  const now = stampOn(today)
  const kind = linkStatus(link, now)
  const active = viewer === owner && kind === 'active'
  const coupleId = link?.coupleId
  const token = link?.token

  const stateRef = useRef(state)
  stateRef.current = state
  const todayRef = useRef(today)
  todayRef.current = today
  /** token + snapshot JSON of the last successful publish from this tab. */
  const lastPublished = useRef<string>('')

  // An expired link: tell the transport once, and keep the record as revoked.
  useEffect(() => {
    if (!link || kind !== 'expired' || viewer !== owner) return
    void revokeLink(now)
  }, [link, kind, viewer, owner, now])

  // The couple's copy of the link (couple.link: the token's hash, never the
  // token) follows this device's record, on the owner's tab. A record that
  // is gone (a wipe, a restore on another phone) leaves the copy as it is:
  // 설정 can then say this phone holds no token for it.
  const mirror = useMemo(() => (link ? coupleLinkOf(link) : undefined), [link])
  const stateLink = state.couple.link
  useEffect(() => {
    if (viewer !== owner || !mirror || sameCoupleLink(stateLink, mirror)) return
    update((s) => setCoupleLink(s, mirror))
  }, [viewer, owner, mirror, stateLink, update])

  // Publish (debounced).
  useEffect(() => {
    if (!active || !coupleId || !token) return
    const snapshot = buildPartnerSnapshot(state, today, partnerId(state))
    if (!snapshot) return
    const key = `${token}\n${JSON.stringify(snapshot)}`
    if (key === lastPublished.current) return
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const t = await transport()
          await t.publishSnapshot(coupleId, token, snapshot)
          lastPublished.current = key
          setStatus({ kind: t.kind, publishedAt: localNowISO(), error: null })
        } catch (e) {
          setStatus({ error: errorText(e) })
        }
      })()
    }, PUBLISH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [active, coupleId, token, state, today])

  // Pull and apply.
  const pull = useCallback(
    async (id: string) => {
      try {
        const t = await transport()
        const day = todayRef.current
        const received = await t.pullReceived(id, pullSince(day))
        const fresh = received.filter((r) => !hasAppliedEvent(stateRef.current, r.event.id))
        if (fresh.length) update((s) => applyReceivedEvents(s, fresh, day))
        setStatus({ kind: t.kind, pulledAt: localNowISO(), error: null })
      } catch (e) {
        setStatus({ error: errorText(e) })
      }
    },
    [update],
  )

  useEffect(() => {
    if (!active || !coupleId) return
    let alive = true
    let busy = false
    const run = () => {
      if (!alive || busy || document.visibilityState === 'hidden') return
      busy = true
      void pull(coupleId).finally(() => {
        busy = false
      })
    }
    run()
    const timer = window.setInterval(run, PULL_EVERY_MS)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    let off: (() => void) | undefined
    void transport().then((t) => {
      const o = t.watch?.(coupleId, run)
      if (alive) off = o
      else o?.()
    })
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      off?.()
    }
  }, [active, coupleId, pull])
}
