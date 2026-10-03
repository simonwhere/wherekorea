// Notification rules (pure). `scheduledNotices` derives what each member should
// have been told by `today`; `mergeNotices` adds the ones not delivered yet.
// In the prototype, delivery = in-app inbox (+ browser notification while open).
// With a backend these same rules would run server-side and go out as push.

import { addDays, addMonths, diffDays, formatKo, isBetween } from '../dates'
import { uid } from '../id'
import { MEMBER_IDS, type AppNotification, type AppState, type ISODate, type MemberId, type NotificationKind } from '../types'
import { anniversaryNotices } from './anniversary'
import { koreanDays } from './baby'
import { mondayOf } from './checks'
import { isClinicMode } from './clinic'
import { LONG_LATE_DAYS, fertilityStatus, sortedStarts, upcomingWindows, type CycleWindow } from './cycle'
import { sharedWeek } from './cycleRing'
import { AMENORRHEA_NOTICE_DAYS, LATE_TEST_DAYS, PERIOD_DUE_COPY } from './periodDue'
import { gestationalAge, recentlyEnded } from './pregnancy'
import { canSeeCycleDetails, canSeeWeekBand, lhPrompting, lowPressureFor } from './prefs'
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

/**
 * The two 임신 전 검사 rows (lib/content/roadmap; partnerTrack FERTILITY_TEST_ID /
 * FERTILITY_CARRIER_TEST_ID). Both ticked, the "N개월이 지났으면 두 사람 모두
 * 검사를" notice and card have been answered (review ④) — the 🩺 'months'
 * reason is dropped (lib/logic/today.ts doctorAdvice reads the same rule).
 */
export const CHECKUP_ITEM_IDS: readonly string[] = ['pre-checkup-partner', 'pre-checkup-carrier']

export function checkupsDone(state: Pick<AppState, 'planDone'>): boolean {
  return CHECKUP_ITEM_IDS.every((id) => !!state.planDone[id])
}

/** 'doctor:<ttc start>' (toBoth appends ':<member>'). */
export function doctorKey(ttcStart: ISODate): string {
  return `doctor:${ttcStart}`
}

const DOCTOR_KEY_TO = /^doctor:(\d{4}-\d{2}-\d{2})(?::\d+)?:([ab])$/

/**
 * Was the 🩺 notice for this trying period already sent (under the current or
 * an old threshold-bearing key)? With `member`, to that person only — each
 * person's copy goes out on its own day (the partner's never waits on a
 * positive test she has not told him about).
 */
export function doctorTold(state: Pick<AppState, 'notifications'>, ttcStart: ISODate, member?: MemberId): boolean {
  return state.notifications.some((n) => {
    const m = n.key ? DOCTOR_KEY_TO.exec(n.key) : null
    return !!m && m[1] === ttcStart && (member === undefined || m[2] === member)
  })
}

/** The day she told the partner about this positive test ([알리기], ttcFlow.positiveToldKey — read here without importing ttcFlow). */
function positiveTold(state: Pick<AppState, 'decisions' | 'notifications'>, since: ISODate): boolean {
  const key = `positive-told:${since}`
  return state.decisions?.[key] !== undefined || state.notifications.some((n) => n.key === key)
}

/** 'amenorrhea:<cycle start>:<week>:<owner>' — the quiet 🩺 notice after '아직 안 왔어요' (one per week). */
export function amenorrheaKey(cycleStart: ISODate, week: number, owner: MemberId): string {
  return `amenorrhea:${cycleStart}:${week}:${owner}`
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

/**
 * The explicit '가장 좋은 날' body. The cycle owner keeps the frequency line
 * (ASRM / NICE); the partner never gets a number of times — on his side it
 * reads as a quota (docs/positioning.md §6, review-realuse B10; N24).
 */
export function peakBody(peakStart: ISODate, peakEnd: ISODate, isCycleOwner: boolean): string {
  const range = `${formatKo(peakStart, { weekday: false })}~${formatKo(peakEnd, { weekday: false })} (예상).`
  return isCycleOwner ? `${range} 이 기간엔 하루나 이틀에 한 번이면 충분해요. 부담은 내려놓아요.` : `${range} 부담은 내려놓아요.`
}

/**
 * The explicit '가임기가 다가왔어요' body. Only the person who uses the strips is
 * pointed at an LH test (`lh`: the owner, unless she said '안 써요'); the
 * partner (with her details) reads the dates alone — no test homework for him.
 */
function explicitFertileBody(w: Pick<CycleWindow, 'fertileStart' | 'fertileEnd' | 'confidence'>, lh: boolean, isCycleOwner: boolean): string {
  if (w.confidence === 'low') {
    // Settings only, one or two cycles, or irregular: a wide calendar range, no peak days.
    return `${formatKo(w.fertileStart)}부터 ${formatKo(w.fertileEnd)}까지 무렵이 예상 범위예요 (넓음 · 달력 기준).${lh ? ' LH 배란테스트로 확인해 보면 좋아요.' : ''}`
  }
  const tail = lh ? '예상치라 LH 배란테스트로 확인하면 더 정확해요.' : isCycleOwner ? '달력 기준 예상이에요.' : '부담은 내려놓아요.'
  return `${formatKo(w.fertileStart)}부터 ${formatKo(w.fertileEnd)}까지가 예상 가임기예요. ${tail}`
}

export function scheduledNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]

  if (state.stage === 'preparing') {
    const status = fertilityStatus(state, today)
    // The notices about the expected period are keyed by the cycle (its first
    // day), so each goes out once per cycle however the range moves.
    const cycleStart = [...sortedStarts(state.periods)].reverse().find((d) => d <= today)
    // A positive test awaiting the clinic already answers "late?" — no test prompt.
    // A rest cycle pauses every date (ttcFlow.ttcPhase shows 쉬는 주기 even on
    // late days), so neither the late nor the period-due notice goes out. A
    // 'loss' quiet (ttc.startLossRest) counts until its last day, period or not.
    const pending = activePositivePending(state)
    const resting = !!activeRest(state, today)
    if (status.kind === 'late' && status.daysLate <= LONG_LATE_DAYS && !pending && !resting && cycleStart) {
      // The day after the expected range: log it if it started. The pregnancy
      // test comes up only LATE_TEST_DAYS days past the range (periodDue.ts).
      out.push({
        key: `late:${cycleStart}:${owner.id}`,
        to: owner.id,
        kind: 'period-due',
        title: PERIOD_DUE_COPY.late.title,
        body: PERIOD_DUE_COPY.late.body(status.due),
      })
      if (status.daysLate >= LATE_TEST_DAYS) {
        out.push({
          key: `late-test:${cycleStart}:${owner.id}`,
          to: owner.id,
          kind: 'period-due',
          title: PERIOD_DUE_COPY.lateTest.title,
          body: PERIOD_DUE_COPY.lateTest.body(status.due, status.daysLate),
        })
      }
    }
    // '아직 안 왔어요' (15 days or more past the range, no positive test awaiting
    // the clinic): a quiet 🩺 line to the owner alone, once a week from her
    // answer — never to the partner (it would give her period away), never
    // while a rest / clinic cycle or a waiting positive test pauses the dates.
    const waitingSince = cycleStart ? state.cycleNotes?.[cycleStart]?.stillWaiting : undefined
    if (status.kind === 'late' && status.daysLate > LONG_LATE_DAYS && waitingSince && !pending && !resting && cycleStart) {
      const week = Math.floor(diffDays(waitingSince, today) / AMENORRHEA_NOTICE_DAYS)
      if (week >= 1) {
        out.push({
          key: amenorrheaKey(cycleStart, week, owner.id),
          to: owner.id,
          kind: 'doctor',
          title: PERIOD_DUE_COPY.stillWaiting.notice.title,
          body: PERIOD_DUE_COPY.stillWaiting.notice.body,
        })
      }
    }
    // Rest cycles and a positive test awaiting the clinic send no fertile-day alerts
    // (activeRest / activePositivePending: a period logged since settles both).
    const herWindow =
      status.kind !== 'late' && status.kind !== 'no-data' && status.kind !== 'after-pregnancy' && !resting && !pending
        ? upcomingWindows(state, today, 1)[0]
        : undefined
    // A partner without her details hears of 우리의 주간 only through the
    // shared window (cycleRing.sharedWeek — her logged starts alone, never on
    // period days 1–3, never through a pause): so no notice — or its absence —
    // moves with an LH result, a test or an untold period (N19). With '날짜
    // 없음' (N23: prefs.canSeeWeekBand) he gets none at all.
    const shared = sharedWeek(state, today)
    const lh = lhPrompting(state)
    for (const m of state.couple.members) {
      const style = state.settings.alertStyle?.[m.id] ?? 'soft'
      // Low-pressure mode (NICE: every 2–3 days, all cycle long): no fertile-day alerts for that person.
      if (style === 'off' || lowPressureFor(state.settings, m.id)) continue
      const isOwner = m.id === owner.id
      if (!isOwner && !canSeeWeekBand(state, m.id)) continue
      const details = canSeeCycleDetails(state, m.id)
      const w = details ? herWindow : shared?.window
      if (!w) continue
      // A partner the owner hasn't shared cycle details with gets only the
      // shared "우리의 주간" wording — no window dates, no peak days (which
      // would give away an LH result). Same rule as the home and calendar
      // (ttcFlow.homeVoice, calendarView.cycleLens).
      const soft = style === 'soft' || !details
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
            ? softFertileBody(isOwner)
            : explicitFertileBody(w, isOwner && lh, isOwner),
        })
      }
      // Explicit style only: soft style already got its one gentle nudge above.
      // No 🌟 with low confidence — the calendar alone can't name the best days.
      if (
        !soft &&
        w.confidence !== 'low' &&
        isBetween(today, w.peakStart, w.peakEnd) &&
        !deliveredUnderOldKey(state.notifications, w, m.id, 'peak')
      ) {
        out.push({
          key: peakKey(w.start, m.id),
          to: m.id,
          kind: 'peak',
          title: '🌟 가능성이 가장 높은 날들이에요',
          body: peakBody(w.peakStart, w.peakEnd, isOwner),
        })
      }
    }
    // While a positive test waits for the clinic, "tomorrow is your period" and
    // "time to see a fertility doctor" are the wrong messages; they wait until
    // a period settles it (then still apply) or the pregnancy is confirmed.
    // The heads-up goes out the day before the expected RANGE starts (its first day).
    if (
      status.kind === 'after-fertile' &&
      today === addDays(status.due.from, -1) &&
      !pending &&
      !resting &&
      cycleStart
    ) {
      out.push({
        key: `period-due:${cycleStart}:${owner.id}`,
        to: owner.id,
        kind: 'period-due',
        title: PERIOD_DUE_COPY.dueTomorrow.title,
        body: PERIOD_DUE_COPY.dueTomorrow.body(status.due),
      })
    }

    // Counted from the later of ttcStart and an ended pregnancy, and quiet for a
    // while after a pregnancy ended (same rules as the home DoctorCard). A couple
    // already preparing with a clinic (N13) is not told to see one.
    const ttcStart = ttcClockStart(state)
    if (ttcStart && !recentlyEnded(state, today) && !isClinicMode(state)) {
      const ownerAge = ageFromBirthYear(owner.birthYear, today)
      const threshold = doctorThresholdMonths(ownerAge)
      const months = monthsBetween(ttcStart, today)
      const notice =
        threshold > 0 && months >= threshold && !checkupsDone(state)
          ? {
              title: '🩺 전문의 상담을 고려해 볼 때예요',
              body: `함께 준비한 지 ${months}개월이 지났어요. ${threshold}개월이 지나면 두 사람 모두 검사를 받아보길 권해요. 보건소 '임신 사전건강관리' 지원도 확인해 보세요.`,
            }
          : threshold === 0
            ? {
                title: '🩺 준비 초기에 검사를 받아 보세요',
                body: '40세 이상이라면 시작하면서 바로 전문의 상담을 받는 게 좋아요. 보건소 임신 사전건강관리 지원도 확인해 보세요.',
              }
            : undefined
      // One doctor notice per trying period and person: the key carries only its
      // start, so a threshold that changes with her age on 1 January (12 → 6
      // months) doesn't send the same 🩺 again (old threshold-bearing keys still
      // count — doctorTold). While a positive test waits for the clinic it holds
      // for the person who knows of it: her, and the partner once she told him —
      // a partner she has not told gets his copy as on any other day (N19).
      if (notice) {
        for (const to of MEMBER_IDS) {
          const knows = to === owner.id || (!!pending && positiveTold(state, pending.since))
          if ((pending && knows) || doctorTold(state, ttcStart, to)) continue
          out.push({ key: `${doctorKey(ttcStart)}:${to}`, to, kind: 'doctor', ...notice })
        }
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
const LONG_LIVED_KEY = /^(doctor|period-told|positive-told|bleeding-told|rest-suggest):/

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

export function nudgesSentToday(state: Pick<AppState, 'notifications'>, from: MemberId, today: ISODate): number {
  return state.notifications.filter((n) => n.kind === 'nudge' && n.from === from && n.createdAt.startsWith(today))
    .length
}

/**
 * Can `from` 콕 `to` today at all? Not once the day's NUDGES_PER_DAY are used,
 * and never when `to` turned 콕 받기 off (settings.acceptNudgesFor, Next B) —
 * the home hides the button and sendNudge drops the call either way.
 */
export function canNudge(state: Pick<AppState, 'notifications' | 'settings'>, from: MemberId, to: MemberId, today: ISODate): boolean {
  return acceptsNudges(state.settings, to) && nudgesSentToday(state, from, today) < NUDGES_PER_DAY
}

/**
 * settings.acceptNudgesFor, read here without importing settings.ts (which
 * imports this file): unset = yes, the lib/initial PERSONAL_DEFAULTS value
 * (tests/notificationsV2.test.ts keeps the two in step).
 */
function acceptsNudges(settings: Pick<AppState['settings'], 'personal'>, member: MemberId): boolean {
  return settings.personal?.[member]?.acceptNudges ?? true
}

/**
 * "콕 찌르기" — a gentle reminder to the partner. Limited per day so it never
 * turns into nagging, and dropped for a partner who said no to 콕 (canNudge).
 * `nowISO` should be a local-date-prefixed timestamp.
 */
export function sendNudge(state: AppState, from: MemberId, to: MemberId, today: ISODate, nowISO: string, itemLabel?: string): AppState {
  if (!canNudge(state, from, to, today)) return state
  const sent = nudgesSentToday(state, from, today)
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

/** The 🔔 that goes with [고마워요] (N21): what it says. */
export const WEEK_THANKS_BODY = '이번 주 고마워요'

/** 'thanks:<monday>:<from>' — one 🔔 per giver per week (weekTogether.thankWeek keeps the decision). */
export function weekThanksNoticeKey(today: ISODate, from: MemberId): string {
  return `thanks:${mondayOf(today)}:${from}`
}

/**
 * [고마워요] (once a week, weekTogether.thankWeek): one 🔔 that says so —
 * '💛 지은님이 고마워했어요 · 이번 주 고마워요' — keyed by the week, so a second
 * tap (another tab, a re-render) adds nothing. A cheer for the inbox and the
 * cover (cover.heroLine reads the week's thanks as '고마워했어요').
 */
export function sendWeekThanks(state: AppState, from: MemberId, to: MemberId, today: ISODate, nowISO: string): AppState {
  const name = memberName(state, from)
  return mergeNotices(
    state,
    [{ key: weekThanksNoticeKey(today, from), to, from, kind: 'cheer', title: `💛 ${name}님이 고마워했어요`, body: WEEK_THANKS_BODY }],
    nowISO,
  ).state
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
