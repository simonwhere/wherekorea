// "우리 신호" — one-tap preset messages between partners, for the things that
// are awkward to say out loud (inspired by KONOTOKI's one-tap "promise" buttons).
// Always includes an easy, guilt-free way to say "not today".

import { uid } from '../id'
import type { AppNotification, AppState, ISODate, MemberId } from '../types'

export type SignalTone = 'invite' | 'warm' | 'rest' | 'reply'

export interface Signal {
  id: string
  emoji: string
  text: string
  tone: SignalTone
}

export const SIGNALS: readonly Signal[] = [
  { id: 'dinner', emoji: '🍝', text: '오늘 저녁 같이 먹어요', tone: 'invite' },
  { id: 'early', emoji: '🏃', text: '오늘 일찍 들어갈게요', tone: 'invite' },
  { id: 'date', emoji: '💞', text: '우리 데이트 갈래요?', tone: 'invite' },
  { id: 'miss', emoji: '💗', text: '보고 싶어요', tone: 'warm' },
  { id: 'thanks', emoji: '🙏', text: '오늘 고마웠어요', tone: 'warm' },
  { id: 'rest', emoji: '🛋️', text: '오늘은 둘이 푹 쉬어요', tone: 'rest' },
  { id: 'tired', emoji: '😴', text: '오늘은 좀 피곤해요, 내일 해요', tone: 'rest' },
] as const

export const REPLIES: readonly Signal[] = [
  { id: 'yes', emoji: '🙆', text: '좋아요!', tone: 'reply' },
  { id: 'later', emoji: '🙂', text: '다음에 해요, 괜찮아요', tone: 'reply' },
  { id: 'hug', emoji: '🤗', text: '알겠어요, 푹 쉬어요', tone: 'reply' },
] as const

export function signalById(id: string): Signal | undefined {
  return [...SIGNALS, ...REPLIES].find((s) => s.id === id)
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
  return { ...state, notifications: [n, ...state.notifications] }
}

/** Latest signal the viewer received today that they haven't replied to yet. */
export function pendingSignal(state: AppState, me: MemberId, today: ISODate): AppNotification | undefined {
  const received = state.notifications
    .filter((n) => isSignal(n) && n.to === me && n.createdAt.startsWith(today) && signalById(signalIdOf(n) ?? '')?.tone !== 'reply')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  if (!received) return undefined
  const replied = state.notifications.some(
    (n) => isSignal(n) && n.from === me && n.createdAt > received.createdAt && signalById(signalIdOf(n) ?? '')?.tone === 'reply',
  )
  return replied ? undefined : received
}
