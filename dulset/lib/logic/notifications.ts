// Notification rules (pure). `scheduledNotices` derives what each member should
// have been told by `today`; `mergeNotices` adds the ones not delivered yet.
// In the prototype, delivery = in-app inbox (+ browser notification while open).
// With a backend these same rules would run server-side and go out as push.

import { addDays, addMonths, diffDays, formatKo, isBetween } from '../dates'
import { uid } from '../id'
import { MEMBER_IDS, type AppNotification, type AppState, type ISODate, type MemberId, type NotificationKind } from '../types'
import { anniversaryNotices } from './anniversary'
import { koreanDays } from './baby'
import { LONG_LATE_DAYS, fertilityStatus, upcomingWindows, type CycleWindow } from './cycle'
import { gestationalAge, recentlyEnded } from './pregnancy'
import { canSeeCycleDetails, lowPressureFor } from './prefs'
import { activePositivePending, activeRest } from './ttc'

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

function toBoth(n: Omit<Notice, 'to'>): Notice[] {
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

/**
 * Whole calendar months from `from` to `to` (same rule as the baby's age:
 * 2025-09-26 → 2026-09-26 is 12). 0 when `to` is not after `from`.
 */
export function monthsBetween(from: ISODate, to: ISODate): number {
  if (to <= from) return 0
  let n = Math.max(0, Math.floor(diffDays(from, to) / 31) - 1)
  while (addMonths(from, n + 1) <= to) n++
  return n
}

/**
 * Where "함께 준비한 지 N개월" counts from: ttcStart, or the day a pregnancy
 * ended if that is later — conceiving means the couple wasn't "trying without
 * success" before it, and the pregnancy months are not trying months.
 */
export function ttcClockStart(state: Pick<AppState, 'settings' | 'stage' | 'pregnancy'>): ISODate | undefined {
  const ttc = state.settings.ttcStart
  if (!ttc) return undefined
  const p = state.pregnancy
  const ended = state.stage === 'preparing' && p?.endedAt && p.endedAt > p.confirmedAt ? p.endedAt : undefined
  return ended && ended > ttc ? ended : ttc
}

// ── Fertile-window notice keys ──────────────────────────────
//
// One "우리의 주간" heads-up (and, for the explicit style, one "가장 좋은 날"
// notice) per cycle and person. The key carries the cycle's first day, not the
// window's: an LH positive that moves the window inside the same cycle must not
// send a second notice. Keys used before this change ('fertile-start:<window
// start>' / 'peak:<peak start>') still count as delivered for their cycle.

/** 'fertile:<cycle start>:<member>'. */
export function fertileKey(cycleStart: ISODate, member: MemberId): string {
  return `fertile:${cycleStart}:${member}`
}

/** 'peak:<cycle start>:<member>'. */
export function peakKey(cycleStart: ISODate, member: MemberId): string {
  return `peak:${cycleStart}:${member}`
}

const LEGACY_FERTILE_KEY = /^fertile-start:(\d{4}-\d{2}-\d{2}):([ab])$/
const PEAK_KEY = /^peak:(\d{4}-\d{2}-\d{2}):([ab])$/

/**
 * Was this cycle's notice of `kind` already delivered to `member` under an old
 * key? Old keys held a date inside the cycle (window / peak start), which is
 * always after the cycle's first day and before the next period — so a new key
 * ('peak:<cycle start>') never matches here, only an old one does.
 */
export function deliveredUnderOldKey(
  notifications: Pick<AppNotification, 'key'>[],
  w: Pick<CycleWindow, 'start' | 'nextPeriod'>,
  member: MemberId,
  kind: 'fertile' | 'peak',
): boolean {
  const re = kind === 'fertile' ? LEGACY_FERTILE_KEY : PEAK_KEY
  return notifications.some((n) => {
    const m = n.key ? re.exec(n.key) : null
    return !!m && m[2] === member && m[1]! > w.start && m[1]! < w.nextPeriod
  })
}

/** 'doctor:<ttc start>' (toBoth appends ':<member>'). */
export function doctorKey(ttcStart: ISODate): string {
  return `doctor:${ttcStart}`
}

const DOCTOR_KEY = /^doctor:(\d{4}-\d{2}-\d{2})(?::\d+)?:[ab]$/

/** Was the 🩺 notice for this trying period already sent (under the current or an old threshold-bearing key)? */
export function doctorTold(state: Pick<AppState, 'notifications'>, ttcStart: ISODate): boolean {
  return state.notifications.some((n) => {
    const m = n.key ? DOCTOR_KEY.exec(n.key) : null
    return !!m && m[1] === ttcStart
  })
}

/** The soft "우리의 주간" heads-up — no health words (설정's preview shows the same). */
export const SOFT_FERTILE_TITLE = '💞 이번 주는 우리의 주간이에요'

/**
 * Its body. Date ideas sit in the partner's 우리의 주간 card on 오늘, where the
 * notice opens (today.noticeTarget); the cycle owner's own card has none, so
 * the owner isn't promised any. (The 데이트 tab is gone: #date is only linked from that card.)
 */
export function softFertileBody(isCycleOwner: boolean): string {
  return isCycleOwner
    ? '둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.'
    : '둘만의 시간을 챙겨 볼까요? 오늘 화면의 ‘우리의 주간’ 카드에 아이디어를 골라 뒀어요.'
}

export function scheduledNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]

  if (state.stage === 'preparing') {
    const status = fertilityStatus(state, today)
    // A positive test awaiting the clinic already answers "late?" — no test prompt.
    // A rest cycle pauses every date (ttcFlow.ttcPhase shows 쉬는 주기 even on
    // late days), so neither the late nor the period-due notice goes out.
    const pending = activePositivePending(state)
    const resting = !!activeRest(state)
    if (status.kind === 'late' && status.daysLate <= LONG_LATE_DAYS && !pending && !resting) {
      out.push({
        key: `late:${status.expected}:${owner.id}`,
        to: owner.id,
        kind: 'period-due',
        title: '🗓️ 생리 예정일이 지났어요',
        body: `예정일(${formatKo(status.expected)})이 ${status.daysLate}일 지났어요. 생리가 시작됐다면 기록해 주세요. 아니라면 임신 테스트를 해 볼 때예요.`,
      })
    }
    // Rest cycles and a positive test awaiting the clinic send no fertile-day alerts
    // (activeRest / activePositivePending: a period logged since settles both).
    if (
      status.kind !== 'late' &&
      status.kind !== 'no-data' &&
      status.kind !== 'after-pregnancy' &&
      !resting &&
      !pending
    ) {
      const [w] = upcomingWindows(state, today, 1)
      if (w) {
        for (const m of state.couple.members) {
          const style = state.settings.alertStyle?.[m.id] ?? 'soft'
          // Low-pressure mode (NICE: every 2–3 days, all cycle long): no fertile-day alerts for that person.
          if (style === 'off' || lowPressureFor(state.settings, m.id)) continue
          // A partner the owner hasn't shared cycle details with gets only the
          // shared "우리의 주간" wording — no window dates, no peak days (which
          // would give away an LH result). Same rule as the home and calendar
          // (ttcFlow.homeVoice, calendarView.cycleLens).
          const soft = style === 'soft' || !canSeeCycleDetails(state, m.id)
          // Heads-up the day before the window, and on any day inside it — once
          // per cycle (the key is the cycle's first day, so an LH-shifted window
          // in the same cycle is not announced again).
          if (
            isBetween(today, addDays(w.fertileStart, -1), w.fertileEnd) &&
            !deliveredUnderOldKey(state.notifications, w, m.id, 'fertile')
          ) {
            out.push({
              key: fertileKey(w.start, m.id),
              to: m.id,
              kind: 'fertile-start',
              title: soft ? SOFT_FERTILE_TITLE : '💞 가임기가 다가왔어요',
              body: soft
                ? softFertileBody(m.id === owner.id)
                : `${formatKo(w.fertileStart)}부터 ${formatKo(w.fertileEnd)}까지가 예상 가임기예요. 예상치라 LH 배란테스트로 확인하면 더 정확해요.`,
            })
          }
          // Explicit style only: soft style already got its one gentle nudge above.
          if (
            !soft &&
            isBetween(today, w.peakStart, w.peakEnd) &&
            !deliveredUnderOldKey(state.notifications, w, m.id, 'peak')
          ) {
            out.push({
              key: peakKey(w.start, m.id),
              to: m.id,
              kind: 'peak',
              title: '🌟 가능성이 가장 높은 날들이에요',
              body: `${formatKo(w.peakStart, { weekday: false })}~${formatKo(w.peakEnd, { weekday: false })} (예상). 이 기간엔 하루나 이틀에 한 번이면 충분해요. 부담은 내려놓아요.`,
            })
          }
        }
      }
    }
    // While a positive test waits for the clinic, "tomorrow is your period" and
    // "time to see a fertility doctor" are the wrong messages; they wait until
    // a period settles it (then still apply) or the pregnancy is confirmed.
    if (status.kind === 'after-fertile' && status.daysUntilPeriod === 1 && !pending && !resting) {
      out.push({
        key: `period-due:${status.nextPeriod}:${owner.id}`,
        to: owner.id,
        kind: 'period-due',
        title: '🗓️ 내일이 생리 예정일이에요',
        body: '시작하면 달력에 기록해 주세요. 다음 예측이 더 정확해져요.',
      })
    }

    // Counted from the later of ttcStart and an ended pregnancy, and quiet for a
    // while after a pregnancy ended (same rules as the home DoctorCard).
    const ttcStart = ttcClockStart(state)
    if (ttcStart && !recentlyEnded(state, today) && !pending) {
      const ownerAge = ageFromBirthYear(owner.birthYear, today)
      const threshold = doctorThresholdMonths(ownerAge)
      const months = monthsBetween(ttcStart, today)
      // One doctor notice per trying period: the key carries only its start, so a
      // threshold that changes with her age on 1 January (12 → 6 months) doesn't
      // send the same 🩺 again. Notices sent under the old threshold-bearing key
      // still count (doctorTold).
      if (doctorTold(state, ttcStart)) {
        /* already told */
      } else if (threshold > 0 && months >= threshold) {
        out.push(
          ...toBoth({
            key: doctorKey(ttcStart),
            kind: 'doctor',
            title: '🩺 전문의 상담을 고려해 볼 때예요',
            body: `함께 준비한 지 ${months}개월이 지났어요. ${threshold}개월이 지나면 두 사람 모두 검사를 받아보길 권해요. 보건소 '임신 사전건강관리' 지원도 확인해 보세요.`,
          }),
        )
      } else if (threshold === 0) {
        out.push(
          ...toBoth({
            key: doctorKey(ttcStart),
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

  // Couple-wide reminders that apply in every stage. (Appointment reminders are
  // added by the engine via planNotices, which knows the roadmap phases.)
  out.push(...anniversaryNotices(state, today))

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

/**
 * Records that must outlive the cap:
 * - keys the engine produces again for as long as a condition holds (the doctor
 *   notice repeats every day once N months have passed) — otherwise a read or
 *   dismissed notice comes back unread;
 * - the cycle owner's answers kept as dismissed records (ttcFlow: "알릴까요?"
 *   told / skipped, the positive-test note, the live-vaccine rest suggestion) —
 *   otherwise an answered question would be asked again. A few per cycle at most.
 */
const LONG_LIVED_KEY = /^(doctor|period-told|positive-told|rest-suggest):/

function trim(list: AppNotification[]): AppNotification[] {
  if (list.length <= MAX_KEPT) return list
  // Keep, in order: long-lived dedup records, unread, other keyed (dedup) records,
  // then the rest — newest first within each group. The oldest read, unkeyed
  // ones go first.
  const rank = (n: AppNotification) => (n.key && LONG_LIVED_KEY.test(n.key) ? 0 : !n.read ? 1 : n.key ? 2 : 3)
  const sorted = [...list].sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return sorted.slice(0, MAX_KEPT).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
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
  const sent = nudgesSentToday(state, from, today)
  if (sent >= NUDGES_PER_DAY) return state
  const name = memberName(state, from)
  const n: AppNotification = {
    id: uid(),
    to,
    from,
    kind: 'nudge',
    title: `👉 ${name}님이 콕 찔렀어요`,
    body: itemLabel ? `${itemLabel} 챙겼어요? 오늘도 같이 해요!` : '오늘 체크 잊지 않았죠? 같이 해요!',
    createdAt: nowISO,
    // Keyed, so the recipient clearing the inbox leaves a stub and the daily cap still counts it.
    key: `nudge:${from}:${today}:${sent}`,
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
