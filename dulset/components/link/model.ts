// The partner page's view model — pure, so tests/linkPage.test.ts covers it.
//
// The page holds a snapshot (lib/logic/partnerSnapshot — seven days since
// v2; the page draws the entry for its own date, a PartnerPage) and sends
// events (lib/logic/partnerEvents). Between a tap and the owner's
// republished snapshot there is a gap of a few seconds (her phone pulls,
// applies, publishes; the page polls) — or days, when her phone is closed —
// during which the page shows what he just did as done — a "local mark". A
// mark is dropped when the snapshot agrees with it, or after MARK_TTL_MS when
// it never did (the event was rejected: not his item, the day's limit, a
// stale task). Nothing here ever changes the snapshot's words: marks touch
// only done flags and counts.
//
// Also here: the first-run card's and the install card's per-device memory
// (N22), the in-app browser check (카카오톡 → '사파리/크롬으로 열기'), and the
// '이번 주 우리 둘' lines (N21).

import { weekdayKo } from '@/lib/dates'
import type { SetupDrinks, SetupHabits } from '@/lib/logic/partnerEvents'
import type { PartnerPage, PartnerSnapshot, SnapshotChecks, SnapshotPrep, SnapshotWeek } from '@/lib/logic/partnerSnapshot'
import type { WeekOptionId } from '@/lib/logic/weekTogether'
import type { AlertStyle, ISODate } from '@/lib/types'

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
  /** '이번 주 우리 둘': the pick he just made (its week's Monday) … */
  weekPick?: { monday: ISODate; optionId: WeekOptionId; at: number }
  /** … and his [했어요]. */
  weekDone?: { monday: ISODate; at: number }
}

export const NO_MARKS: LocalMarks = { checks: {}, signals: [], cheers: [] }

const fresh = (at: number, now: number) => now - at < MARK_TTL_MS

/**
 * Marks still worth showing against this snapshot: expired ones go, and so
 * do the ones the snapshot now agrees with (its done flag, its task having
 * moved on, its pending signal gone). A snapshot that still disagrees keeps
 * the mark until it expires.
 */
export function pruneMarks(marks: LocalMarks, snapshot: PartnerPage | null, now: number): LocalMarks {
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
  const week = snapshot?.week
  const weekPick =
    marks.weekPick && fresh(marks.weekPick.at, now) && week?.monday === marks.weekPick.monday && week.pick !== marks.weekPick.optionId && !week.done
      ? marks.weekPick
      : undefined
  const weekDone = marks.weekDone && fresh(marks.weekDone.at, now) && week?.monday === marks.weekDone.monday && !week.done ? marks.weekDone : undefined
  return {
    checks,
    ...(task ? { task } : {}),
    ...(reply ? { reply } : {}),
    signals: marks.signals.filter((at) => fresh(at, now)),
    ...(nudge ? { nudge } : {}),
    cheers: marks.cheers.filter((at) => fresh(at, now)),
    ...(weekPick ? { weekPick } : {}),
    ...(weekDone ? { weekDone } : {}),
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
export function viewSignalsLeft(snapshot: Pick<PartnerPage, 'signalsLeft' | 'signal'>, marks: LocalMarks): number {
  const reply = marks.reply && snapshot.signal?.signalId === marks.reply.signalId ? 1 : 0
  return Math.max(0, snapshot.signalsLeft - marks.signals.length - reply)
}

/** The pending signal is shown until he answers it (then the snapshot confirms). */
export function viewSignal(snapshot: Pick<PartnerPage, 'signal'>, marks: LocalMarks): PartnerPage['signal'] | undefined {
  if (!snapshot.signal) return undefined
  if (marks.reply && marks.reply.signalId === snapshot.signal.signalId) return undefined
  return snapshot.signal
}

/** 콕 is offered until he sends one (the owner's phone then recounts the day). */
export function viewCanNudge(snapshot: Pick<PartnerPage, 'owner'>, marks: LocalMarks): boolean {
  return snapshot.owner.canNudge && !marks.nudge
}

/** The month task is shown until he marks it done (the snapshot then carries the next one). */
export function viewTask(
  snapshot: Pick<PartnerPage, 'task'>,
  marks: LocalMarks,
): { task: NonNullable<PartnerPage['task']>; done: boolean } | null {
  if (!snapshot.task) return null
  return { task: snapshot.task, done: !!marks.task && marks.task.id === snapshot.task.id }
}

/** '이번 주 우리 둘' with his marks: the pick he just made and his [했어요] show at once. Null when the week rests. */
export function viewWeek(page: Pick<PartnerPage, 'week'>, marks: LocalMarks): SnapshotWeek | null {
  const w = page.week
  if (!w) return null
  if (w.done) return w
  const picked = marks.weekPick && marks.weekPick.monday === w.monday ? marks.weekPick.optionId : w.pick
  const pick = picked && w.options.some((o) => o.id === picked) ? picked : w.pick
  const done = !!pick && !!marks.weekDone && marks.weekDone.monday === w.monday
  return { ...w, ...(pick ? { pick } : {}), done }
}

/** 내 준비 as the parts of one line, each only when it has something to say (no zeros). */
export function prepParts(prep: SnapshotPrep | undefined): string[] {
  if (!prep) return []
  const out: string[] = []
  if (prep.habit) out.push(prep.habitReached ? `건강 습관 ${prep.habit}(약 3개월 넘었어요)` : `건강 습관 ${prep.habit}`)
  if (prep.week && prep.week > 0) out.push(`이번 주 ${prep.week}/7`)
  if (prep.chain) out.push(prep.chain)
  return out
}

/** '지은님이 고마워했어요 (화)' — her [고마워요] this week. */
/** The week block's own header (LinkWeek: '이번 주 우리 둘 · 10월 5일부터'). */
export const WEEK_BLOCK_TITLE = '이번 주 우리 둘'

/**
 * The moment card sits right above the week block on both his home and the
 * link. When its eyebrow would repeat the block's header word for word (the
 * '평소 주' card, ttcFlow partnerNeutral), it reads '오늘의 우리' instead, so the
 * same header never shows twice in a row. Any other eyebrow is kept.
 */
export function cardEyebrow(eyebrow: string | undefined, weekBelow: boolean): string | undefined {
  return weekBelow && eyebrow === WEEK_BLOCK_TITLE ? '오늘의 우리' : eyebrow
}

export function thanksText(ownerName: string, day: ISODate): string {
  return `${ownerName}님이 고마워했어요 (${weekdayKo(day)})`
}

// ── The snapshot cache on the partner's device ──────────────

/** localStorage key of the last snapshot this browser saw (offline-first after the first load; v2 = the seven-day snapshot). */
export const LINK_VIEW_KEY = 'dulset:link-view:v2'

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
    if (typeof o.token !== 'string' || typeof o.at !== 'number' || !s || typeof s !== 'object' || s.version !== 2) return null
    if (!Array.isArray(s.members) || !Array.isArray(s.days) || !s.days.length || typeof s.today !== 'string') return null
    if (typeof s.validUntil !== 'string' || !s.days.every((d) => d && typeof d === 'object' && typeof d.date === 'string' && !!d.checks)) return null
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

/**
 * The copy for each notice; the owner's name when the page knows it. No
 * health word, no detail. 'stale' (the week the snapshot covers is over)
 * never asks anything of her — it says what happens on its own (her phone
 * opening fills the page again) and what he can still do meanwhile.
 */
export function noticeCopy(kind: NoticeKind, ownerName?: string): { title: string; body: string } {
  const who = ownerName ? `${ownerName}님` : '상대'
  switch (kind) {
    case 'expired':
      return { title: '링크가 만료됐어요', body: `${who}에게 새 링크를 받아 주세요.` }
    case 'nolink':
      return { title: '링크 주소가 올바르지 않아요', body: '받은 링크를 그대로 열어 주세요.' }
    case 'stale':
      return { title: '새 화면은 곧 채워져요', body: `${who} 폰이 열리면 다시 채워져요. 그동안 신호와 응원은 그대로 보낼 수 있어요.` }
    default:
      return { title: '지금은 불러올 수 없어요', body: '인터넷을 확인하고 다시 열어 주세요.' }
  }
}

// ── First run on this device (N22) ──────────────────────────

/** localStorage key: the first-run card was seen (and maybe answered) on this device. */
export const LINK_INTRO_KEY = 'dulset:link-intro:v1'
/** localStorage key: the '홈 화면에 두기' card was closed on this device. */
export const LINK_INSTALL_KEY = 'dulset:link-install:v1'
/** localStorage key: the '사파리/크롬으로 열기' hint was closed in this in-app browser. */
export const LINK_OUTSIDE_KEY = 'dulset:link-outside:v1'

/** A per-device "done" mark as stored: {at} (ms). Anything else reads as not done. */
export function parseDeviceMark(raw: string | null): { at: number } | null {
  if (!raw) return null
  try {
    const p: unknown = JSON.parse(raw)
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null
    const at = (p as { at?: unknown }).at
    return typeof at === 'number' && Number.isFinite(at) ? { at } : null
  } catch {
    return null
  }
}

/** The link's setup answers as the page holds them (each question may stay unanswered). */
export interface SetupDraft {
  smokes?: boolean
  drinks?: SetupDrinks
  alertStyle?: AlertStyle
}

/**
 * The 'setup' event's fields from the answers — only what he answered (the
 * owner's phone changes nothing he left alone); null when he answered nothing.
 */
export function setupFields(d: SetupDraft): { habits: SetupHabits; alertStyle?: AlertStyle } | null {
  const habits: SetupHabits = {
    ...(d.smokes !== undefined ? { smokes: d.smokes } : {}),
    ...(d.drinks !== undefined ? { drinks: d.drinks } : {}),
  }
  if (!Object.keys(habits).length && !d.alertStyle) return null
  return { habits, ...(d.alertStyle ? { alertStyle: d.alertStyle } : {}) }
}

// ── Where the page is open (N22: '홈 화면에 추가' · '사파리/크롬으로 열기') ──

export type InAppBrowser = 'kakao' | 'naver' | 'instagram' | 'facebook' | 'line' | 'other'

/** The messenger / SNS browser the page opened in (카카오톡 first), or null for a real browser. */
export function inAppBrowser(ua: string): InAppBrowser | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/NAVER\(inapp|NAVER\/\d/i.test(ua) && !/Whale/i.test(ua)) return 'naver'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/\bLine\//i.test(ua)) return 'line'
  if (/DaumApps|; wv\)/i.test(ua)) return 'other'
  return null
}

export type DevicePlatform = 'ios' | 'android' | 'other'

/** iPhone/iPad (an iPad on desktop mode says Macintosh but has touch) · Android · anything else. */
export function devicePlatform(ua: string, maxTouchPoints = 0): DevicePlatform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** 카카오톡's own way out to the phone's default browser (the page's full address, hash and all). */
export function kakaoExternalURL(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
}

/** The steps the '홈 화면에 두기' card shows for this phone. */
export function installSteps(platform: DevicePlatform): string[] {
  if (platform === 'ios') return ['사파리로 열고', '아래 가운데 공유 버튼', '‘홈 화면에 추가’']
  if (platform === 'android') return ['크롬으로 열고', '오른쪽 위 메뉴(⋮)', '‘홈 화면에 추가’']
  return ['iPhone: 사파리 공유 → 홈 화면에 추가', 'Android: 크롬 메뉴 → 홈 화면에 추가']
}
