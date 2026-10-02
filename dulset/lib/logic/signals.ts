// "우리 신호" — one-tap preset messages between partners, for the things that
// are awkward to say out loud (inspired by KONOTOKI's one-tap "promise" buttons).
//
// While preparing, the set is about the moments that are hard in a trying
// month: "이번 달은 아니었어요", "위로가 필요해요", "병원 같이 가 줄래요?",
// "오늘은 임신 얘기 말고 쉬어요". Generic chat lines (저녁·데이트·보고 싶어요)
// overlap with KakaoTalk, so they're demoted — their ids stay in the catalogue
// so signals already sent still read correctly. There is always an easy,
// guilt-free "not today": a rest signal in every list, and a rest / not-today
// reply under every signal (둘셋의 설계 판단 — docs/review-preconception.md).

import { addDays } from '../dates'
import { uid } from '../id'
import type { AppNotification, AppState, ISODate, MemberId, Stage } from '../types'

/**
 * invite: asks for something (a yes / not today) · support: asks for comfort ·
 * warm: says something kind · rest: "not today" · reply: an answer.
 */
export type SignalTone = 'invite' | 'support' | 'warm' | 'rest' | 'reply'

export interface Signal {
  id: string
  emoji: string
  text: string
  tone: SignalTone
}

// ── Catalogue (every id ever used — old notifications resolve through it) ──

const S = {
  // Preparing — the trying-month moments.
  notThisMonth: { id: 'not-this-month', emoji: '🌧️', text: '이번 달은 아니었어요', tone: 'support' },
  comfort: { id: 'comfort', emoji: '🫂', text: '위로가 필요해요', tone: 'support' },
  clinic: { id: 'clinic', emoji: '🏥', text: '병원 같이 가 줄래요?', tone: 'invite' },
  noBabyTalk: { id: 'no-baby-talk', emoji: '☕', text: '오늘은 임신 얘기 말고 쉬어요', tone: 'rest' },
  // Rest / not today — always offered.
  rest: { id: 'rest', emoji: '🛋️', text: '오늘은 둘이 푹 쉬어요', tone: 'rest' },
  tired: { id: 'tired', emoji: '😴', text: '오늘은 좀 피곤해요, 내일 해요', tone: 'rest' },
  // Generic, chat-like (demoted; ids kept for old data).
  thanks: { id: 'thanks', emoji: '🙏', text: '오늘 고마웠어요', tone: 'warm' },
  dinner: { id: 'dinner', emoji: '🍝', text: '오늘 저녁 같이 먹어요', tone: 'invite' },
  early: { id: 'early', emoji: '🏃', text: '오늘 일찍 들어갈게요', tone: 'invite' },
  date: { id: 'date', emoji: '💞', text: '우리 데이트 갈래요?', tone: 'invite' },
  miss: { id: 'miss', emoji: '💗', text: '보고 싶어요', tone: 'warm' },
} as const satisfies Record<string, Signal>

const R = {
  yes: { id: 'yes', emoji: '🙆', text: '좋아요!', tone: 'reply' },
  later: { id: 'later', emoji: '🙂', text: '다음에 해요, 괜찮아요', tone: 'reply' },
  hug: { id: 'hug', emoji: '🤗', text: '알겠어요, 푹 쉬어요', tone: 'reply' },
  here: { id: 'here', emoji: '🫂', text: '옆에 있을게요', tone: 'reply' },
  metoo: { id: 'metoo', emoji: '💗', text: '나도요', tone: 'reply' },
} as const satisfies Record<string, Signal>

/** Every signal and reply id the app knows (including demoted ones). */
export const ALL_SIGNALS: readonly Signal[] = [...Object.values(S), ...Object.values(R)]

/** Demoted generic ids: still readable, no longer offered while preparing. */
export const LEGACY_SIGNAL_IDS: readonly string[] = [S.dinner.id, S.early.id, S.date.id, S.miss.id]

/**
 * The generic replies (kept for older screens that don't call repliesFor):
 * 좋아요 / 다음에 해요 / 푹 쉬어요 — they fit invite, warm and rest signals only.
 */
export const REPLIES: readonly Signal[] = [R.yes, R.later, R.hug]

/**
 * The stage-neutral fallback for a screen that pairs it with REPLIES. So it
 * holds no 'support' signal: "위로가 필요해요" must never be answered with
 * "다음에 해요, 괜찮아요". Prefer signalsFor(stage, isCycleOwner) + repliesFor.
 */
export const SIGNALS: readonly Signal[] = [S.clinic, S.thanks, S.dinner, S.rest, S.tired]

/** Pregnancy and baby stages: a small, calm set (with comfort — answered by repliesFor). */
const OTHER_STAGES: readonly Signal[] = [S.comfort, S.clinic, S.thanks, S.dinner, S.rest, S.tired]

/**
 * Signals to offer. Preparing: the trying-month set ('이번 달은 아니었어요' is
 * for the person whose cycle it is — the partner can't know it first). Other
 * stages keep a small, calm set. Every list has at least one rest signal.
 */
export function signalsFor(stage: Stage, isCycleOwner = true): Signal[] {
  if (stage === 'preparing') {
    return isCycleOwner
      ? [S.notThisMonth, S.comfort, S.clinic, S.noBabyTalk, S.rest, S.tired]
      : [S.comfort, S.clinic, S.noBabyTalk, S.thanks, S.rest, S.tired]
  }
  return [...OTHER_STAGES]
}

/**
 * One-tap answers for a received signal. Each set keeps a no-pressure option
 * (다음에 해요 / 푹 쉬어요), so answering never means agreeing.
 */
export function repliesFor(signalId: string | undefined): Signal[] {
  const s = signalId ? signalById(signalId) : undefined
  switch (s?.tone) {
    case 'invite':
      return [R.yes, R.later]
    case 'support':
      return [R.here, R.hug]
    case 'warm':
      return [R.metoo, R.hug]
    case 'rest':
      return [R.hug, R.yes]
    default:
      return [...REPLIES]
  }
}

export function signalById(id: string): Signal | undefined {
  return ALL_SIGNALS.find((s) => s.id === id)
}

/** Signals are stored as notifications keyed 'signal:<id>:<date>:<from>:<n>'. */
export function isSignal(n: AppNotification): boolean {
  return n.key?.startsWith('signal:') ?? false
}

export function signalIdOf(n: AppNotification): string | undefined {
  return isSignal(n) ? n.key!.split(':')[1] : undefined
}

export const SIGNALS_PER_DAY = 5

export function signalsSentToday(state: AppState, from: MemberId, today: ISODate): number {
  return state.notifications.filter((n) => isSignal(n) && n.from === from && n.createdAt.startsWith(today)).length
}

/** Send a signal (or reply) to the partner. No-op past the daily limit. */
export function sendSignal(
  state: AppState,
  from: MemberId,
  to: MemberId,
  signalId: string,
  today: ISODate,
  nowISO: string,
): AppState {
  const s = signalById(signalId)
  if (!s) return state
  const sent = signalsSentToday(state, from, today)
  if (sent >= SIGNALS_PER_DAY) return state
  const name = state.couple.members.find((m) => m.id === from)?.name ?? ''
  const n: AppNotification = {
    id: uid(),
    to,
    from,
    kind: 'cheer',
    title: `${s.emoji} ${name}님: ${s.text}`,
    body: s.tone === 'reply' ? '답장이 왔어요.' : '버튼 하나로 답장할 수 있어요.',
    createdAt: nowISO,
    key: `signal:${s.id}:${today}:${from}:${sent}`,
    read: false,
  }
  // A reply answers the partner's recent signals (the same window the home
  // offers a reply for), so they're no longer unread for the one replying.
  const answered = (m: AppNotification) =>
    s.tone === 'reply' && isSignal(m) && m.to === from && withinReplyWindow(m, today) && !m.read
  return { ...state, notifications: [n, ...state.notifications.map((m) => (answered(m) ? { ...m, read: true } : m))] }
}

/**
 * A signal can be answered with one tap for this many days after the day it
 * was sent (a 23:50 signal is still answerable next morning): today and the
 * two days before — about 72 hours.
 */
export const SIGNAL_REPLY_DAYS = 2

function withinReplyWindow(n: Pick<AppNotification, 'createdAt'>, today: ISODate): boolean {
  const day = n.createdAt.slice(0, 10)
  return day >= addDays(today, -SIGNAL_REPLY_DAYS) && day <= today
}

/** Latest signal the viewer received in the last few days that they haven't replied to yet. */
export function pendingSignal(state: AppState, me: MemberId, today: ISODate): AppNotification | undefined {
  const received = state.notifications
    .filter((n) => isSignal(n) && n.to === me && withinReplyWindow(n, today) && signalById(signalIdOf(n) ?? '')?.tone !== 'reply')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  if (!received) return undefined
  const replied = state.notifications.some(
    (n) => isSignal(n) && n.from === me && n.createdAt > received.createdAt && signalById(signalIdOf(n) ?? '')?.tone === 'reply',
  )
  return replied ? undefined : received
}
