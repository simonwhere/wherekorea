// Notification rules (pure). `scheduledNotices` derives what each member should
// have been told by `today`; `mergeNotices` adds the ones not delivered yet.
// In the prototype, delivery = in-app inbox (+ browser notification while open).
// With a backend these same rules would run server-side and go out as push.

import { addDays, diffDays, formatKo, isBetween } from '../dates'
import { uid } from '../id'
import { MEMBER_IDS, type AppNotification, type AppState, type ISODate, type MemberId, type NotificationKind } from '../types'
import { koreanDays } from './baby'
import { fertilityStatus, upcomingWindows } from './cycle'
import { gestationalAge } from './pregnancy'

export interface Notice {
  key: string
  to: MemberId
  kind: NotificationKind
  title: string
  body: string
  from?: MemberId
}

const MAX_KEPT = 200

function memberName(state: AppState, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name ?? ''
}

function toBoth(n: Omit<Notice, 'to' | 'key'> & { key: string }): Notice[] {
  return MEMBER_IDS.map((to) => ({ ...n, to, key: `${n.key}:${to}` }))
}

/** Age in whole years at `today` from a birth year (approximate — no birthday). */
export function ageFromBirthYear(birthYear: number | undefined, today: ISODate): number | undefined {
  if (!birthYear) return undefined
  return Number(today.slice(0, 4)) - birthYear
}

/**
 * ASRM guidance: evaluate after 12 months of trying (under 35), after 6 months
 * (35–39), and promptly at 40+ or with irregular cycles.
 */
export function doctorThresholdMonths(age: number | undefined): number {
  if (age === undefined) return 12
  if (age >= 40) return 0
  if (age >= 35) return 6
  return 12
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  return Math.floor(diffDays(from, to) / 30.44)
}

export function scheduledNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]
  const low = state.settings.lowPressure

  if (state.stage === 'preparing') {
    const status = fertilityStatus(state, today)
    if (status.kind === 'late' && status.daysLate <= 14) {
      out.push({
        key: `late:${status.expected}:${owner.id}`,
        to: owner.id,
        kind: 'period-due',
        title: '🗓️ 생리 예정일이 지났어요',
        body: `예정일(${formatKo(status.expected)})이 ${status.daysLate}일 지났어요. 생리가 시작됐다면 기록해 주세요. 아니라면 임신 테스트를 해 볼 때예요.`,
      })
    }
    if (status.kind !== 'late' && status.kind !== 'no-data') {
      const [w] = upcomingWindows(state, today, 1)
      if (w) {
        // Heads-up the day before the window, and on any day inside it (dedup by key).
        if (isBetween(today, addDays(w.fertileStart, -1), w.fertileEnd)) {
          out.push(
            ...toBoth({
              key: `fertile-start:${w.fertileStart}`,
              kind: 'fertile-start',
              title: low ? '💞 이번 주는 데이트 주간이에요' : '💞 가임기가 다가왔어요',
              body: low
                ? '둘만의 시간을 챙겨 볼까요? 데이트 탭에 아이디어를 골라 뒀어요.'
                : `${formatKo(w.fertileStart)}부터 ${formatKo(w.fertileEnd)}까지 임신 가능성이 높은 기간이에요. 부담은 내려놓고, 둘만의 시간을 챙겨요.`,
            }),
          )
        }
        if (isBetween(today, w.peakStart, w.peakEnd)) {
          out.push(
            ...toBoth({
              key: `peak:${w.peakStart}`,
              kind: 'peak',
              title: low ? '🌙 오늘 저녁은 둘이서' : '🌟 가능성이 가장 높은 날들이에요',
              body: low
                ? '일찍 퇴근해서 같이 저녁 먹는 건 어때요?'
                : `${formatKo(w.peakStart, { weekday: false })}~${formatKo(w.peakEnd, { weekday: false })}. 이 기간엔 하루나 이틀에 한 번이면 충분해요. 숙제처럼 느끼지 않아도 괜찮아요.`,
            }),
          )
        }
      }
      if (status.kind === 'after-fertile' && status.daysUntilPeriod === 1) {
        out.push({
          key: `period-due:${status.nextPeriod}:${owner.id}`,
          to: owner.id,
          kind: 'period-due',
          title: '🗓️ 내일이 생리 예정일이에요',
          body: '시작하면 달력에 기록해 주세요. 다음 예측이 더 정확해져요.',
        })
      }
    }

    const ttcStart = state.settings.ttcStart
    if (ttcStart) {
      const ownerAge = ageFromBirthYear(owner.birthYear, today)
      const threshold = doctorThresholdMonths(ownerAge)
      const months = monthsBetween(ttcStart, today)
      if (threshold > 0 && months >= threshold) {
        out.push(
          ...toBoth({
            key: `doctor:${ttcStart}:${threshold}`,
            kind: 'doctor',
            title: '🩺 전문의 상담을 고려해 볼 때예요',
            body: `함께 준비한 지 ${months}개월이 지났어요. ${threshold}개월이 지나면 두 사람 모두 검사를 받아보길 권해요. 보건소 '임신 사전건강관리' 지원도 확인해 보세요.`,
          }),
        )
      } else if (threshold === 0) {
        out.push(
          ...toBoth({
            key: `doctor:${ttcStart}:40`,
            kind: 'doctor',
            title: '🩺 준비 초기에 검사를 받아 보세요',
            body: '40세 이상이라면 시작하면서 바로 전문의 상담을 받는 게 좋아요. 보건소 임신 사전건강관리 지원도 확인해 보세요.',
          }),
        )
      }
    }
  }

  if (state.stage === 'pregnant' && state.pregnancy) {
    const ga = gestationalAge(state.pregnancy, today)
    if (ga.weeks >= 4 && ga.weeks <= 42) {
      out.push(
        ...toBoth({
          key: `week:${state.pregnancy.lmp}:${ga.weeks}`,
          kind: 'milestone',
          title: `🤰 임신 ${ga.weeks}주가 되었어요`,
          body: '이번 주 정보와 체크할 검사를 확인해 보세요.',
        }),
      )
    }
  }

  if (state.stage === 'parenting' && state.baby) {
    const baby = state.baby
    for (const d of koreanDays(baby.birthDate)) {
      const until = diffDays(today, d.date)
      if (until === 7 || until === 0) {
        out.push(
          ...toBoth({
            key: `kday:${baby.birthDate}:${d.key}:${until}`,
            kind: 'milestone',
            title: until === 0 ? `🎉 오늘은 ${baby.name}의 ${d.label}!` : `🎈 ${baby.name}의 ${d.label}까지 일주일`,
            body: until === 0 ? '오늘을 일기로 남겨 보세요.' : `${formatKo(d.date)}이에요. 사진 찍을 준비됐나요?`,
          }),
        )
      }
    }
  }

  return out
}

/** Add notices whose key hasn't been delivered yet. */
export function mergeNotices(state: AppState, notices: Notice[], nowISO: string): { state: AppState; added: AppNotification[] } {
  const existing = new Set(state.notifications.map((n) => n.key).filter(Boolean))
  const added: AppNotification[] = []
  for (const n of notices) {
    if (existing.has(n.key)) continue
    existing.add(n.key)
    added.push({ id: uid(), createdAt: nowISO, read: false, ...n })
  }
  if (added.length === 0) return { state, added }
  return { state: { ...state, notifications: trim([...added, ...state.notifications]) }, added }
}

function trim(list: AppNotification[]): AppNotification[] {
  if (list.length <= MAX_KEPT) return list
  // Drop the oldest read ones first.
  const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const unread = sorted.filter((n) => !n.read)
  const read = sorted.filter((n) => n.read)
  return [...unread, ...read].slice(0, MAX_KEPT).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

// ── Partner interactions ────────────────────────────────────

export const NUDGES_PER_DAY = 3

export function nudgesSentToday(state: AppState, from: MemberId, today: ISODate): number {
  return state.notifications.filter((n) => n.kind === 'nudge' && n.from === from && n.createdAt.startsWith(today))
    .length
}

/**
 * "콕 찌르기" — a gentle reminder to the partner. Limited per day so it never
 * turns into nagging. `nowISO` should be a local-date-prefixed timestamp.
 */
export function sendNudge(state: AppState, from: MemberId, to: MemberId, today: ISODate, nowISO: string, itemLabel?: string): AppState {
  if (nudgesSentToday(state, from, today) >= NUDGES_PER_DAY) return state
  const name = memberName(state, from)
  const n: AppNotification = {
    id: uid(),
    to,
    from,
    kind: 'nudge',
    title: `👉 ${name}님이 콕 찔렀어요`,
    body: itemLabel ? `${itemLabel} 챙겼어요? 오늘도 같이 해요!` : '오늘 체크 잊지 않았죠? 같이 해요!',
    createdAt: nowISO,
    read: false,
  }
  return { ...state, notifications: trim([n, ...state.notifications]) }
}

export function sendCheer(state: AppState, from: MemberId, to: MemberId, nowISO: string, message?: string): AppState {
  const name = memberName(state, from)
  const n: AppNotification = {
    id: uid(),
    to,
    from,
    kind: 'cheer',
    title: `👏 ${name}님이 응원을 보냈어요`,
    body: message?.trim() || '오늘도 고마워요. 우리 잘하고 있어요!',
    createdAt: nowISO,
    read: false,
  }
  return { ...state, notifications: trim([n, ...state.notifications]) }
}

/** Tell the partner once per day when someone finishes all their checks. */
export function notifyCompleted(state: AppState, member: MemberId, partner: MemberId, today: ISODate, nowISO: string): AppState {
  const name = memberName(state, member)
  return mergeNotices(
    state,
    [
      {
        key: `complete:${member}:${today}`,
        to: partner,
        from: member,
        kind: 'cheer',
        title: `✅ ${name}님이 오늘 체크를 모두 마쳤어요`,
        body: '응원 한마디 보내 볼까요?',
      },
    ],
    nowISO,
  ).state
}

export function markRead(state: AppState, member: MemberId, id?: string): AppState {
  return {
    ...state,
    notifications: state.notifications.map((n) => (n.to === member && (!id || n.id === id) ? { ...n, read: true } : n)),
  }
}

export function clearNotifications(state: AppState, member: MemberId): AppState {
  // Generated notices stay (dismissed) so their key isn't delivered again; drop the rest.
  return {
    ...state,
    notifications: state.notifications
      .filter((n) => n.to !== member || n.key)
      .map((n) => (n.to === member ? { ...n, read: true, dismissed: true } : n)),
  }
}

/** Inbox for a member: newest first, dismissed hidden. */
export function inbox(state: AppState, member: MemberId): AppNotification[] {
  return state.notifications
    .filter((n) => n.to === member && !n.dismissed)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** Local timestamp whose first 10 chars are the local date (for per-day counting). */
export function localNowISO(now = new Date()): string {
  const off = now.getTimezoneOffset()
  const local = new Date(now.getTime() - off * 60_000)
  const sign = off <= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${local.toISOString().slice(0, 19)}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}
