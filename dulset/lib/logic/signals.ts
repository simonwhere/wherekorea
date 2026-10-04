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
 * warm: says something kind · rest: "not today" · offer: offers to do
 * something (his '오늘 저녁은 내가 할게요', N30) · reply: an answer.
 */
export type SignalTone = 'invite' | 'support' | 'warm' | 'rest' | 'offer' | 'reply'

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
  // The partner offers first (N30, docs/positioning.md §4 #6): relationship-side, no timing.
  dinnerMine: { id: 'dinner-mine', emoji: '🍳', text: '오늘 저녁은 내가 할게요', tone: 'offer' },
  clinicTogether: { id: 'clinic-together', emoji: '🚶', text: '병원 같이 갈게요', tone: 'offer' },
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
  // Answers that fit a kind word and a "not today" (B6: '오늘 고마웠어요' was
  // answered with '푹 쉬어요', '피곤해요, 내일 해요' with '좋아요!').
  glad: { id: 'glad', emoji: '😊', text: '덕분에 힘이 나요', tone: 'reply' },
  soon: { id: 'soon', emoji: '🏠', text: '얼른 갈게요', tone: 'reply' },
  slow: { id: 'slow', emoji: '🌿', text: '그래요, 천천히 해요', tone: 'reply' },
  // Answers to an offer: a thank-you, and an easy 'not this time' (never a 'no' that needs a reason).
  thankYou: { id: 'thank-you', emoji: '🙏', text: '고마워요', tone: 'reply' },
  notNeeded: { id: 'not-needed', emoji: '🙂', text: '이번엔 괜찮아요', tone: 'reply' },
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
    // The partner's list opens with his two offers (N30): '오늘 저녁은 내가 할게요',
    // '병원 같이 갈게요' ('병원 같이 가 줄래요?' stays for his own visit).
    return isCycleOwner
      ? [S.notThisMonth, S.comfort, S.clinic, S.noBabyTalk, S.rest, S.tired]
      : [S.dinnerMine, S.clinicTogether, S.comfort, S.clinic, S.thanks, S.rest, S.tired]
  }
  return [...OTHER_STAGES]
}

/**
 * One-tap answers for a received signal, paired by what it asks: an offer
 * gets a thank-you and an easy '이번엔 괜찮아요'; an invite
 * gets a yes and a no-pressure "다음에"; a call for comfort gets presence; a
 * kind word gets a kind word back (never "푹 쉬어요"); a "not today" gets an
 * easy okay (never "좋아요!"). Answering an invite or a rest never means
 * agreeing — each of those sets keeps a no-pressure option.
 */
export function repliesFor(signalId: string | undefined): Signal[] {
  const s = signalId ? signalById(signalId) : undefined
  if (s?.id === S.miss.id) return [R.metoo, R.soon]
  switch (s?.tone) {
    case 'invite':
      return [R.yes, R.later]
    case 'support':
      return [R.here, R.hug]
    case 'warm':
      return [R.metoo, R.glad]
    case 'rest':
      return [R.hug, R.slow]
    case 'offer':
      return [R.thankYou, R.notNeeded]
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

// ── A reply to my signal, on my home (N21 ③) ────────────────

export interface ReceivedReply {
  reply: Signal
  from: MemberId
  /** When it was sent (local ISO time). */
  at: string
  /** The viewer's own signal it answers (the last one sent before it), when known. */
  answered?: Signal
}

/**
 * How long a reply `me` has not opened yet (its 🔔 unread) stays on the home
 * after the reply window: a reply he sent from the link on Monday is applied
 * on her phone only when she opens it — Thursday, say — stamped Monday (N20,
 * partnerSnapshot.applyReceivedEvents). Without this it would reach only the
 * 🔔. The same span as the event pull window (useLinkSync PULL_WINDOW_DAYS).
 */
export const REPLY_UNSEEN_DAYS = 7

/**
 * The latest reply `me` received to a signal of theirs within the reply
 * window (SIGNAL_REPLY_DAYS: today and the two days before) — or, while its
 * 🔔 is still unread, within REPLY_UNSEEN_DAYS — so the answer shows on the
 * home ('우리 한 줄'), not only as a 🔔. Gone once `me` sends a new signal
 * after it (a new question waits for its own answer), or once the window
 * has passed and it was read. Only what the other person SENT: nothing is
 * inferred (docs/positioning.md §4, 남편 루프의 규칙 1).
 */
export function receivedReply(state: Pick<AppState, 'notifications'>, me: MemberId, today: ISODate): ReceivedReply | undefined {
  const from = addDays(today, -SIGNAL_REPLY_DAYS)
  const unseenFrom = addDays(today, -REPLY_UNSEEN_DAYS)
  const shown = (n: AppNotification) => {
    const d = n.createdAt.slice(0, 10)
    return d <= today && (d >= from || (!n.read && d >= unseenFrom))
  }
  const toneOf = (n: AppNotification) => signalById(signalIdOf(n) ?? '')?.tone
  const latest = state.notifications
    .filter((n) => isSignal(n) && n.to === me && typeof n.createdAt === 'string' && shown(n) && toneOf(n) === 'reply')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  if (!latest) return undefined
  const mine = state.notifications
    .filter((n) => isSignal(n) && n.from === me && typeof n.createdAt === 'string' && toneOf(n) !== 'reply')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  // A newer question of mine: this answer belongs to the previous one.
  if (mine.some((n) => n.createdAt > latest.createdAt)) return undefined
  const reply = signalById(signalIdOf(latest) ?? '')
  if (!reply || !latest.from) return undefined
  const asked = mine.find((n) => n.createdAt <= latest.createdAt)
  const answered = asked ? signalById(signalIdOf(asked) ?? '') : undefined
  return { reply, from: latest.from, at: latest.createdAt, ...(answered ? { answered } : {}) }
}

// ── '해 줄 말 · 아껴 둘 말' (N30) ────────────────────────────
//
// On a moment SHE SENT — and only then (docs/positioning.md §4 rule 1): a
// signal of hers he has not answered yet, or what she told with [알리기] (her
// period, a positive test, bleeding after it). One line to say, one to keep
// for later, and two answers he can send with one tap. Never on anything his
// screen could only know from her records (with '자세히' shared or not): the
// table is keyed by what she sent, nothing else. No medical sentence here —
// what bleeding means stays on her screen (positiveBleeding.ts).

export interface SayLines {
  /** 해 줄 말. */
  say: string
  /** 아껴 둘 말. */
  save: string
  /** Two one-tap answers (signal ids: a reply or one of his offers). */
  replies: readonly [string, string]
}

/** What she told with [알리기] (ttcFlow.tellPartnerPeriod / tellPartnerPositive / tellPartnerBleeding). */
export type ToldMoment = 'period' | 'positive' | 'bleeding'

const SAY_FOR_TOLD: Record<ToldMoment, SayLines> = {
  period: {
    say: '‘고생했어’ 한마디면 충분해요.',
    save: '‘다음 달엔 되겠지’ 같은 말은 잠시 아껴 둬요.',
    replies: [R.here.id, S.dinnerMine.id],
  },
  positive: {
    say: '‘같이 기다리자’ 한마디면 충분해요.',
    save: '축하나 결과를 묻는 말은 병원에서 확인한 뒤로 아껴 둬요.',
    replies: [S.clinicTogether.id, R.here.id],
  },
  bleeding: {
    say: '‘옆에 있을게’가 먼저예요.',
    save: '무슨 뜻인지 짐작하는 말은 아껴 둬요.',
    replies: [S.clinicTogether.id, R.here.id],
  },
}

/** Her signals that come with lines for him (the answers are repliesFor's two). */
const SAY_FOR_SIGNAL: Partial<Record<string, Omit<SayLines, 'replies'>>> = {
  [S.notThisMonth.id]: { say: '‘고생했어’ 한마디면 충분해요.', save: '‘다음 달엔 되겠지’ 같은 말은 잠시 아껴 둬요.' },
  [S.comfort.id]: { say: '‘무슨 일이야?’보다 ‘옆에 있을게’가 먼저예요.', save: '해결책이나 조언은 잠시 아껴 둬요.' },
  [S.clinic.id]: { say: '‘같이 갈게’라고 먼저 답해 줘요.', save: '결과를 묻는 말은 잠시 아껴 둬요.' },
  [S.noBabyTalk.id]: { say: '오늘은 다른 이야기로 하루를 채워요.', save: '임신·검사 이야기는 잠시 아껴 둬요.' },
  [S.rest.id]: { say: '‘그래, 푹 쉬자’ 한마디면 돼요.', save: '내일 계획 이야기는 잠시 아껴 둬요.' },
  [S.tired.id]: { say: '‘고생했어, 쉬어’면 충분해요.', save: '‘왜 피곤해?’ 같은 질문은 잠시 아껴 둬요.' },
}

/** 해 줄 말 · 아껴 둘 말 · two answers for what she told ([알리기]). */
export function sayForTold(moment: ToldMoment): SayLines {
  return SAY_FOR_TOLD[moment]
}

/**
 * 해 줄 말 · 아껴 둘 말 for a signal she sent, with repliesFor's two answers —
 * or undefined for a signal that needs none (a thank-you, a reply, his own
 * offers, an unknown id).
 */
export function sayForSignal(signalId: string | undefined): SayLines | undefined {
  const lines = signalId ? SAY_FOR_SIGNAL[signalId] : undefined
  if (!lines) return undefined
  const [a, b] = repliesFor(signalId)
  return { ...lines, replies: [a!.id, b!.id] }
}

/**
 * The latest of `ids` that `from` sent on or after `since` (a day), or
 * undefined — so a moment's two answers turn into '보냈어요' once one went out.
 */
export function sentSince(
  state: Pick<AppState, 'notifications'>,
  from: MemberId,
  since: ISODate,
  ids: readonly string[],
): Signal | undefined {
  const sent = state.notifications
    .filter((n) => isSignal(n) && n.from === from && typeof n.createdAt === 'string' && n.createdAt.slice(0, 10) >= since)
    .filter((n) => ids.includes(signalIdOf(n) ?? ''))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  return sent ? signalById(signalIdOf(sent) ?? '') : undefined
}
