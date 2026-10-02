// The partner link (Next A ①) — pure helpers, no React, no storage.
//
// Two things live here:
//  • the link RECORD the owner's phone keeps on the device (lib/useLinkSync
//    LINK_KEY): the share token as it travels in the URL hash, the couple id
//    the transport files everything under, when it was made, when it expires,
//    whether it was stopped — and the URL / hash helpers around it;
//  • the couple's own copy of that link in the state (lib/types.ts
//    Couple.link): the same facts with the token replaced by its SHA-256, so
//    a backup, the other phone and 설정 know a link exists and when it ends,
//    while the secret itself never leaves the phone that made it.
//
// A token is 128 random bits as 22 base64url characters; it rides in the hash
// (`/link/#t=…`) so no server log ever sees it.

import { addDays, isISODate } from '../dates'
import type { AppState, CoupleLink, ISODateTime } from '../types'

// ── The record ──────────────────────────────────────────────

/** A link lives this long (supabase/schema.sql issue_token's default). */
export const LINK_DAYS = 30
/** The path of the partner page in the static export (app/link/page.tsx). */
export const LINK_PATH = '/link/'

export interface LinkRecord {
  /** The share token as it travels in the URL (random 128 bits, base64url). */
  token: string
  /** The couple's id for the transport (a uuid made once; kept across rotations). */
  coupleId: string
  createdAt: ISODateTime
  expiresAt: ISODateTime
  revokedAt?: ISODateTime
}

export type LinkStatus = 'none' | 'active' | 'expired' | 'revoked'

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** The server's couple_id is a uuid; the mock takes any short id. */
const COUPLE_ID_MAX = 64

/** base64url without padding (pure; no btoa so tests and old engines agree). */
export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = i + 1 < bytes.length ? bytes[i + 1]! : undefined
    const c = i + 2 < bytes.length ? bytes[i + 2]! : undefined
    out += B64URL[a >> 2]
    out += B64URL[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b !== undefined) out += B64URL[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c !== undefined) out += B64URL[c & 63]
  }
  return out
}

function cryptoBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.getRandomValues === 'function') return c.getRandomValues(bytes)
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256)
  return bytes
}

/** A fresh share token: 128 random bits as 22 base64url characters. */
export function randomToken(random: (n: number) => Uint8Array = cryptoBytes): string {
  return toBase64Url(random(16))
}

/** A uuid v4 for the couple (the server's couple_id is a uuid). */
export function newCoupleId(random: (n: number) => Uint8Array = cryptoBytes): string {
  const b = random(16)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function isToken(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v)
}

function isCoupleId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= COUPLE_ID_MAX && /^[A-Za-z0-9_.:-]+$/.test(v)
}

/** A local-date-prefixed stamp (lib/logic/notifications.localNowISO shape). */
export function isLinkStamp(v: unknown): v is ISODateTime {
  return typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) && isISODate(v.slice(0, 10))
}

/** `days` after a local stamp, keeping its time of day and offset (date math via lib/dates). */
export function linkExpiry(createdAt: ISODateTime, days: number = LINK_DAYS): ISODateTime {
  return addDays(createdAt.slice(0, 10), days) + createdAt.slice(10)
}

/** The record as stored, or null when missing or not a record (a foreign value never crashes the screen). */
export function parseLinkRecord(raw: string | null): LinkRecord | null {
  if (!raw) return null
  try {
    const p: unknown = JSON.parse(raw)
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null
    const o = p as Record<string, unknown>
    if (!isToken(o.token) || !isCoupleId(o.coupleId) || !isLinkStamp(o.createdAt) || !isLinkStamp(o.expiresAt)) return null
    return {
      token: o.token,
      coupleId: o.coupleId,
      createdAt: o.createdAt,
      expiresAt: o.expiresAt,
      ...(isLinkStamp(o.revokedAt) ? { revokedAt: o.revokedAt } : {}),
    }
  } catch {
    return null
  }
}

/** Compare two local stamps by their wall-clock part (the offset is the same device's). */
const wall = (iso: ISODateTime) => iso.slice(0, 19)

export function linkStatus(link: Pick<LinkRecord, 'expiresAt' | 'revokedAt'> | null | undefined, nowISO: ISODateTime): LinkStatus {
  if (!link) return 'none'
  if (link.revokedAt) return 'revoked'
  if (wall(nowISO) >= wall(link.expiresAt)) return 'expired'
  return 'active'
}

/** Whole days left before the link expires (0 on its last day; never negative). */
export function linkDaysLeft(link: Pick<LinkRecord, 'expiresAt'>, nowISO: ISODateTime): number {
  const today = nowISO.slice(0, 10)
  const end = link.expiresAt.slice(0, 10)
  let n = 0
  let d = today
  while (d < end && n < 400) {
    d = addDays(d, 1)
    n++
  }
  return n
}

/**
 * A new link: a fresh token, this moment, LINK_DAYS ahead. A previous record
 * keeps its coupleId (the transport's events and snapshot stay the couple's);
 * its old token is the caller's to revoke (lib/useLinkSync rotateLink).
 */
export function makeLink(prev: Pick<LinkRecord, 'coupleId'> | null, nowISO: ISODateTime, random?: (n: number) => Uint8Array): LinkRecord {
  return {
    token: randomToken(random),
    coupleId: prev?.coupleId ?? newCoupleId(random),
    createdAt: nowISO,
    expiresAt: linkExpiry(nowISO),
  }
}

export function revokeLinkRecord(link: LinkRecord, nowISO: ISODateTime): LinkRecord {
  return link.revokedAt ? link : { ...link, revokedAt: nowISO }
}

/** The address she sends: origin + the page + the token in the hash (never in the query, so no server log sees it). */
export function shareURL(origin: string, token: string, path: string = LINK_PATH): string {
  return `${origin.replace(/\/+$/, '')}${path}#t=${token}`
}

/** The token in a page's hash ('#t=…'), or null when there is none or it is malformed. */
export function tokenFromHash(hash: string): string | null {
  const h = hash.replace(/^#/, '')
  if (!h) return null
  let v: string | null = null
  try {
    v = new URLSearchParams(h).get('t')
  } catch {
    v = null
  }
  if (v === null) {
    const m = /(?:^|[&?])t=([^&]+)/.exec(h)
    try {
      v = m ? decodeURIComponent(m[1]!) : null
    } catch {
      v = null
    }
  }
  return isToken(v) ? v : null
}

/** What the share sheet sends with the address. */
export function shareText(partnerName: string): string {
  return `${partnerName}님, 둘셋이에요. 설치 없이 이 링크로 우리 화면을 볼 수 있어요.`
}

// ── SHA-256 (for the token's hash in the state) ─────────────
//
// Pure and synchronous on purpose: crypto.subtle is async and missing on a
// plain-http origin, and the hash must be the same everywhere (tests compare
// it with node:crypto). FIPS 180-4; ~50 lines.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

function utf8(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  // Older engines: encodeURIComponent gives the UTF-8 bytes as %XX escapes.
  const esc = unescape(encodeURIComponent(text))
  const out = new Uint8Array(esc.length)
  for (let i = 0; i < esc.length; i++) out[i] = esc.charCodeAt(i)
  return out
}

/** Hex SHA-256 of `text` (UTF-8). */
export function sha256Hex(text: string): string {
  const bytes = utf8(text)
  const l = bytes.length
  const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6)
  padded.set(bytes)
  padded[l] = 0x80
  const dv = new DataView(padded.buffer)
  const bits = l * 8
  dv.setUint32(padded.length - 8, Math.floor(bits / 0x100000000))
  dv.setUint32(padded.length - 4, bits >>> 0)
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as [number, number, number, number, number, number, number, number]
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('')
}

const HASH_RE = /^[0-9a-f]{64}$/

// ── Couple.link (the state's copy) ──────────────────────────

/** The state's copy of a record: the same facts, the token as its hash. */
export function coupleLinkOf(link: LinkRecord): CoupleLink {
  return {
    coupleId: link.coupleId,
    tokenHash: sha256Hex(link.token),
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    ...(link.revokedAt ? { revokedAt: link.revokedAt } : {}),
  }
}

/** Does this phone's record match the couple's link in the state (same couple, same token)? */
export function linkMatches(state: Pick<AppState, 'couple'>, link: Pick<LinkRecord, 'coupleId' | 'token'> | null): boolean {
  const own = state.couple.link
  if (!own || !link) return false
  return own.coupleId === link.coupleId && own.tokenHash === sha256Hex(link.token)
}

/**
 * Couple.link, checked: a couple id, a 64-hex hash, real stamps with the
 * expiry not before the creation; a stray revokedAt is dropped alone, anything
 * else makes it no link. Unknown keys never ride along.
 */
export function cleanCoupleLink(raw: unknown): CoupleLink | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  if (!isCoupleId(o.coupleId) || typeof o.tokenHash !== 'string' || !HASH_RE.test(o.tokenHash)) return undefined
  if (!isLinkStamp(o.createdAt) || !isLinkStamp(o.expiresAt) || wall(o.expiresAt) < wall(o.createdAt)) return undefined
  return {
    coupleId: o.coupleId,
    tokenHash: o.tokenHash,
    createdAt: o.createdAt,
    expiresAt: o.expiresAt,
    ...(isLinkStamp(o.revokedAt) ? { revokedAt: o.revokedAt } : {}),
  }
}

export function sameCoupleLink(a: CoupleLink | undefined, b: CoupleLink | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.coupleId === b.coupleId &&
    a.tokenHash === b.tokenHash &&
    a.createdAt === b.createdAt &&
    a.expiresAt === b.expiresAt &&
    a.revokedAt === b.revokedAt
  )
}

/** Set (or clear, with undefined) the couple's link in the state; a bad value clears it; the same value → the same object. */
export function setCoupleLink(state: AppState, link: CoupleLink | undefined): AppState {
  const next = link ? cleanCoupleLink(link) : undefined
  if (sameCoupleLink(state.couple.link, next)) return state
  const couple = { ...state.couple }
  if (next) couple.link = next
  else delete couple.link
  return { ...state, couple }
}
