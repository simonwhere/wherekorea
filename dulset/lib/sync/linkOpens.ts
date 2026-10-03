// '링크 연 날' counter (Now 3, decided 2026-10-03 — docs/positioning.md §7,
// STATUS N25): the event's type and the pure counting the mock transport
// uses. The transports (lib/sync/*Transport.ts recordLinkOpen /
// linkOpenDays) and the SQL (supabase/schema.sql link_opens,
// record_link_open, link_open_days) count the same way.
//
// What it records is the whole of it: which couple's link was opened, on
// which local day. No IP, no device or browser, no time of day, no token, no
// content of the page — the server keeps (couple id, day) → a count, for the
// research weeks only, and deletes it after. The page reloads every few
// seconds (components/link/LinkPage.tsx POLL_EVERY_MS), so the counter counts
// days, never calls. Nothing of it is ever shown on her phone: it is not a
// read receipt (positioning §6 — 읽음 표시는 압박이에요).

import type { ISODate } from '../types'

/** One open of the partner link: the transport's couple id (Couple.link.coupleId) and the local day. */
export interface LinkOpenEvent {
  coupleId: string
  day: ISODate
}

// ── Counting (the mock's store and tests; the server does the same in SQL) ──

/** Per couple, per local day: how many times the link was opened that day. */
export type LinkOpenCounts = Record<string, Record<ISODate, number>>

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** Days kept per couple in the mock (a study lasts four weeks; the server keeps what the study needs and is wiped after). */
export const LINK_OPEN_DAYS_KEPT = 120

/** One more open on `ev.day` for `ev.coupleId` (a new object; the oldest days beyond LINK_OPEN_DAYS_KEPT drop). */
export function countLinkOpen(counts: LinkOpenCounts, ev: LinkOpenEvent): LinkOpenCounts {
  if (!ev.coupleId || !DAY_RE.test(ev.day)) return counts
  const mine = { ...(counts[ev.coupleId] ?? {}) }
  mine[ev.day] = (mine[ev.day] ?? 0) + 1
  const days = Object.keys(mine).sort()
  for (const d of days.slice(0, Math.max(0, days.length - LINK_OPEN_DAYS_KEPT))) delete mine[d]
  return { ...counts, [ev.coupleId]: mine }
}

/** On how many distinct days in from…to (inclusive) the couple's link was opened. */
export function openDaysBetween(counts: LinkOpenCounts, coupleId: string, from: ISODate, to: ISODate): number {
  const mine = counts[coupleId]
  if (!mine || from > to) return 0
  return Object.entries(mine).filter(([d, n]) => DAY_RE.test(d) && d >= from && d <= to && n > 0).length
}

/** A stored counts map, checked: couple → {day → positive integer}; anything else is dropped. */
export function cleanLinkOpenCounts(raw: unknown): LinkOpenCounts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: LinkOpenCounts = {}
  for (const [couple, days] of Object.entries(raw as Record<string, unknown>)) {
    if (!couple || couple.length > 64 || !days || typeof days !== 'object' || Array.isArray(days)) continue
    const kept: Record<ISODate, number> = {}
    for (const [d, n] of Object.entries(days as Record<string, unknown>)) {
      if (DAY_RE.test(d) && typeof n === 'number' && Number.isInteger(n) && n > 0) kept[d] = n
    }
    if (Object.keys(kept).length) out[couple] = kept
  }
  return out
}
