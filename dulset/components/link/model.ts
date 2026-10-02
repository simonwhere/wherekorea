// The partner page's view model — pure, so tests/linkPage.test.ts covers it.
//
// The page holds a snapshot (lib/logic/partnerSnapshot) and sends events
// (lib/logic/partnerEvents). Between a tap and the owner's republished
// snapshot there is a gap of a few seconds (her phone pulls, applies,
// publishes; the page polls), during which the page shows what he just did
// as done — a "local mark". A mark is dropped when the snapshot agrees with
// it, or after MARK_TTL_MS when it never did (the event was rejected: not his
// item, the day's limit, a stale task). Nothing here ever changes the
// snapshot's words: marks touch only done flags and counts.

import type { PartnerSnapshot, SnapshotChecks } from '@/lib/logic/partnerSnapshot'

/** How long a tap shows as done without the snapshot confirming it. */
export const MARK_TTL_MS = 20_000

export interface LocalMarks {
  /** itemId → what he set it to, and when (ms). */
  checks: Record<string, { done: boolean; at: number }>
  /** The month task he marked done. */
  task?: { id: string; at: number }
  /** The signal he answered. */
  reply?: { signalId: string; at: number }
  /** His own signals sent (for the day's count). */
  signals: number[]
  nudge?: { at: number }
  /** 응원 sent (the link caps them, lib/logic/partnerEvents.CHEERS_PER_DAY). */
  cheers: number[]
}

export const NO_MARKS: LocalMarks = { checks: {}, signals: [], cheers: [] }

const fresh = (at: number, now: number) => now - at < MARK_TTL_MS

/**
 * Marks still worth showing against this snapshot: expired ones go, and so
 * do the ones the snapshot now agrees with (its done flag, its task having
 * moved on, its pending signal gone). A snapshot that still disagrees keeps
 * the mark until it expires.
 */
export function pruneMarks(marks: LocalMarks, snapshot: PartnerSnapshot | null, now: number): LocalMarks {
  const checks: LocalMarks['checks'] = {}
  for (const [id, m] of Object.entries(marks.checks)) {
    if (!fresh(m.at, now)) continue
    const item = snapshot?.checks.items.find((i) => i.id === id)
    if (item && item.done === m.done) continue
    checks[id] = m
  }
  const task = marks.task && fresh(marks.task.at, now) && snapshot?.task?.id === marks.task.id ? marks.task : undefined
  const reply =
    marks.reply && fresh(marks.reply.at, now) && snapshot?.signal && snapshot.signal.signalId === marks.reply.signalId
      ? marks.reply
      : undefined
  const nudge = marks.nudge && fresh(marks.nudge.at, now) && snapshot?.owner.canNudge ? marks.nudge : undefined
  return {
    checks,
    ...(task ? { task } : {}),
    ...(reply ? { reply } : {}),
    signals: marks.signals.filter((at) => fresh(at, now)),
    ...(nudge ? { nudge } : {}),
    cheers: marks.cheers.filter((at) => fresh(at, now)),
  }
}

/** The checks with his local marks applied, and the counts recomputed the way the home counts them (daily rows only). */
export function viewChecks(checks: SnapshotChecks, marks: LocalMarks): SnapshotChecks {
  const items = checks.items.map((i) => {
    const m = marks.checks[i.id]
    return m ? { ...i, done: m.done } : i
  })
  const daily = items.filter((i) => !i.weekly)
  const done = daily.filter((i) => i.done).length
  const total = daily.length
  return { ...checks, items, done, total, complete: total > 0 && done === total }
}

/**
 * Signals he may still send today after the ones sent locally. A reply counts
 * only while the snapshot still shows the signal it answered: once her phone
 * has applied it, signalsLeft already includes it.
 */
export function viewSignalsLeft(snapshot: Pick<PartnerSnapshot, 'signalsLeft' | 'signal'>, marks: LocalMarks): number {
  const reply = marks.reply && snapshot.signal?.signalId === marks.reply.signalId ? 1 : 0
  return Math.max(0, snapshot.signalsLeft - marks.signals.length - reply)
}

/** The pending signal is shown until he answers it (then the snapshot confirms). */
export function viewSignal(snapshot: PartnerSnapshot, marks: LocalMarks): PartnerSnapshot['signal'] | undefined {
  if (!snapshot.signal) return undefined
  if (marks.reply && marks.reply.signalId === snapshot.signal.signalId) return undefined
  return snapshot.signal
}

/** 콕 is offered until he sends one (the owner's phone then recounts the day). */
export function viewCanNudge(snapshot: PartnerSnapshot, marks: LocalMarks): boolean {
  return snapshot.owner.canNudge && !marks.nudge
}

/** The month task is shown until he marks it done (the snapshot then carries the next one). */
export function viewTask(
  snapshot: PartnerSnapshot,
  marks: LocalMarks,
): { task: NonNullable<PartnerSnapshot['task']>; done: boolean } | null {
  if (!snapshot.task) return null
  return { task: snapshot.task, done: !!marks.task && marks.task.id === snapshot.task.id }
}

// ── The snapshot cache on the partner's device ──────────────

/** localStorage key of the last snapshot this browser saw (offline-first after the first load). */
export const LINK_VIEW_KEY = 'dulset:link-view:v1'

export interface CachedView {
  token: string
  snapshot: PartnerSnapshot
  /** When it was fetched (ms since epoch, the page's own clock). */
  at: number
}

export function parseCachedView(raw: string | null): CachedView | null {
  if (!raw) return null
  try {
    const p: unknown = JSON.parse(raw)
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null
    const o = p as Record<string, unknown>
    const s = o.snapshot as Partial<PartnerSnapshot> | undefined
    if (typeof o.token !== 'string' || typeof o.at !== 'number' || !s || typeof s !== 'object' || s.version !== 1) return null
    if (!Array.isArray(s.members) || !s.checks || typeof s.today !== 'string') return null
    return { token: o.token, snapshot: s as PartnerSnapshot, at: o.at }
  } catch {
    return null
  }
}

/** The owner as the snapshot names her (the one who is not the viewer). */
export function ownerOf(snapshot: Pick<PartnerSnapshot, 'members' | 'cycleOwner'>): PartnerSnapshot['members'][number] {
  return snapshot.members.find((m) => m.id === snapshot.cycleOwner) ?? snapshot.members[0]
}

export function viewerOf(snapshot: Pick<PartnerSnapshot, 'members' | 'viewer'>): PartnerSnapshot['members'][number] {
  return snapshot.members.find((m) => m.id === snapshot.viewer) ?? snapshot.members[1]
}

// ── The calm notices ────────────────────────────────────────

export type NoticeKind = 'expired' | 'nolink' | 'stale' | 'offline'

/** The copy for each notice; the owner's name when the page knows it. No health word, no detail. */
export function noticeCopy(kind: NoticeKind, ownerName?: string): { title: string; body: string } {
  const who = ownerName ? `${ownerName}님` : '상대'
  switch (kind) {
    case 'expired':
      return { title: '링크가 만료됐어요', body: `${who}에게 새 링크를 받아 주세요.` }
    case 'nolink':
      return { title: '링크 주소가 올바르지 않아요', body: '받은 링크를 그대로 열어 주세요.' }
    case 'stale':
      return { title: `${who}의 둘셋이 잠시 쉬고 있어요`, body: `${who}이 앱을 열면 이 화면도 새로 보여요.` }
    default:
      return { title: '지금은 불러올 수 없어요', body: '인터넷을 확인하고 다시 열어 주세요.' }
  }
}
