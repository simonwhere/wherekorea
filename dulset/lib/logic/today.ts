// Home ("오늘") screen rules — pure, so wording and timer decisions are testable.

import { diffDays, formatKo, isISODate, parts } from '../dates'
import type { AppState, CheckItem, ISODate, Member, MemberId, NotificationKind, Settings, Stage } from '../types'
import {
  activeDailyItems,
  activeItems,
  doneIds,
  isWeekly,
  nudgeableItem,
  toggleCheck,
  toggleWeekly,
} from './checks'
import { isClinicMode } from './clinic'
import { LONG_LATE_DAYS, cycleStats, fertilityStatus, ourWeekSoon, sortedStarts, type FertilityStatus } from './cycle'
import {
  CHECKUP_ITEM_IDS,
  ageFromBirthYear,
  checkupsDone,
  doctorThresholdMonths,
  localNowISO,
  mergeNotices,
  monthsBetween,
  notifyCompleted,
  ttcClockStart,
} from './notifications'
import { canSeeCycleDetails, lowPressureFor } from './prefs'
import { MAX_GESTATION_DAYS, backToPreparing, canStartPregnancy, recentlyEnded, startPregnancy } from './pregnancy'
import { activePositivePending, clearPositivePending, startLossRest } from './ttc'

// ── Clock anchored to the app's `today` ─────────────────────

/**
 * The device clock time placed on the app's `today`. Identical to `new Date()`
 * in normal use; with `?today=` pinned it keeps timestamps on the pinned day so
 * per-day rules (3 콕 a day, 오늘/이전 in the inbox) still line up with `today`.
 * Mirrors lib/demo.ts `anchorOn`.
 */
export function nowOn(today: ISODate, now: Date = new Date()): Date {
  const { year, month, day } = parts(today)
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())
}

/** localNowISO() on the app's `today` — use for notices written from the home screen. */
export function stampOn(today: ISODate, now: Date = new Date()): string {
  return localNowISO(nowOn(today, now))
}

// ── Greeting ────────────────────────────────────────────────

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return '좋은 아침이에요'
  if (hour >= 12 && hour < 18) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

// ── How fertility info is worded for this viewer ────────────

/**
 * explicit = "가임기 D-3" · soft = "우리의 주간" · calm = no fertile wording at all
 * (low-pressure mode, or the viewer turned fertile alerts off).
 *
 * The viewer's own alertStyle decides; being the cycle owner only sets the
 * default (explicit) when nothing is stored. An owner who picked
 * "‘우리의 주간’처럼 은근하게" (건강 용어 없이) in 설정 gets the soft wording
 * here too — the same rule the calendar uses (calendarView.fertilityView).
 */
export type FertilityVoice = 'explicit' | 'soft' | 'calm'

export function fertilityVoice(
  settings: Pick<Settings, 'lowPressure' | 'alertStyle' | 'personal'>,
  viewer: MemberId,
  isCycleOwner: boolean,
): FertilityVoice {
  // Low-pressure is each person's own choice (settings.personal) — never the partner's.
  if (lowPressureFor(settings, viewer)) return 'calm'
  const style = settings.alertStyle?.[viewer] ?? (isCycleOwner ? 'explicit' : 'soft')
  if (style === 'off') return 'calm'
  return style === 'explicit' ? 'explicit' : 'soft'
}

/** The prominent "이번 주 데이트" teaser only shows close to / inside the window. */
export function showDateTeaser(status: FertilityStatus, voice: FertilityVoice): boolean {
  if (voice === 'calm') return false
  return ourWeekSoon(status)
}

// ── Daily checks ────────────────────────────────────────────

export interface RowProgress {
  done: number
  total: number
  complete: boolean
}

/**
 * Progress over today's one-tap rows: active *daily* items. Weekly check-ins
 * (금연·금주 …) never decide whether the day is done.
 */
export function rowProgress(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, date: ISODate): RowProgress {
  const rows = activeDailyItems(state, member)
  const done = doneIds(state, member, date)
  const count = rows.filter((i) => done.includes(i.id)).length
  return { done: count, total: rows.length, complete: rows.length > 0 && count === rows.length }
}

/** The first unchecked daily item — what a 콕 may point at (never a weekly check-in). */
export function firstUnchecked(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  date: ISODate,
): CheckItem | undefined {
  return nudgeableItem(state, member, date)
}

/**
 * Toggle one item; when that toggle finishes the day's daily list, tell the
 * partner (once a day — notifyCompleted dedups by key). A weekly check-in is
 * toggled for the whole week (toggleWeekly) and never counts as "finishing".
 */
export function toggleWithCompletion(
  state: AppState,
  member: MemberId,
  partner: MemberId,
  date: ISODate,
  itemId: string,
  nowISO: string,
): { state: AppState; completed: boolean } {
  const item = state.checkItems.find((i) => i.id === itemId)
  if (item && isWeekly(item)) return { state: toggleWeekly(state, member, date, itemId), completed: false }
  const before = rowProgress(state, member, date).complete
  let next = toggleCheck(state, member, date, itemId)
  const completed = !before && rowProgress(next, member, date).complete
  if (completed) next = notifyCompleted(next, member, partner, date, nowISO)
  return { state: next, completed }
}

// ── Habit timers ────────────────────────────────────────────
//
// Honest timers: they count from the first day the relevant items were actually
// checked — never from the day preparing started — and show "시작 전" until then.
// A count only goes on while checks keep coming: after TIMER_BREAK_DAYS without
// any, it stops ("다시 시작 전") and the next check starts a new count, so
// "약 3개월을 이어 왔어요" is never said about one tap months ago.

/** Sperm take about 64–74 days to form (J Androl; research medical-checklist.json). */
export const SPERM_CYCLE_DAYS = 74
/**
 * …plus 1–2 weeks to mature in the epididymis: about 3 months in all, so a
 * habit shows in semen quality after roughly 3 months (74 + 14 ≈ 90 days).
 */
export const SPERM_GOAL_DAYS = 90
/** Folic acid: at least 1 month before, Korean norm 3 months before conception. */
export const FOLIC_GOAL_DAYS = 90

/**
 * Days without any check of a timer's items after which its count stops (4
 * weeks — longer than the widest gap between two weekly check-ins, 13 days).
 */
export const TIMER_BREAK_DAYS = 28

/** How the timers describe their goal (no "74일 채움" — the science is a range). */
export const SPERM_GOAL_TEXT = '약 3개월(64~74일 + 성숙 1~2주)'
export const FOLIC_GOAL_TEXT = '임신 3개월 전부터(최소 1개월 전)'

export function laterOf(a?: ISODate, b?: ISODate): ISODate | undefined {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

/** 'D+1' on the start day (Korean "N일째" counting); undefined before the start. */
export function dayCount(start: ISODate | undefined, today: ISODate): number | undefined {
  if (!start || start > today) return undefined
  return diffDays(start, today) + 1
}

/**
 * not-started: not counting — nothing checked yet, or no check for
 * TIMER_BREAK_DAYS (then `lastCheck` is set) · running: counting · reached: the
 * goal span has passed while checks kept coming.
 */
export type TimerState = 'not-started' | 'running' | 'reached'

export interface Timer {
  state: TimerState
  /** First check of the current run of checks (day 1). */
  start?: ISODate
  /** Set when an earlier run stopped: the last check before the long gap. */
  lastCheck?: ISODate
  /** Korean-style day count from `start` (undefined while not started). */
  day?: number
  /** Days the goal span covers (for the progress bar). */
  goal: number
  /** 0–1 */
  progress: number
  /** '시작 전' · '다시 시작 전' · 'D+12' */
  label: string
  /** The goal in words, e.g. '약 3개월(64~74일 + 성숙 1~2주)'. */
  goalText: string
  /** One honest line for under the bar. */
  note: string
}

interface TimerCopy {
  goalText: string
  notStarted: string
  stopped: string
  running: string
  reached: string
}

const SPERM_COPY: TimerCopy = {
  goalText: SPERM_GOAL_TEXT,
  notStarted: '시작 전이에요. 습관을 처음 체크한 날부터 세어 드려요.',
  stopped: '한동안 체크가 없었어요. 다시 체크한 날부터 새로 세어 드려요.',
  running: '새 정자가 만들어지는 데 64~74일, 성숙하는 데 1~2주가 더 걸려 모두 약 3개월이에요. 오늘의 습관이 3개월 뒤를 만들어요.',
  reached: '약 3개월을 이어 왔어요. 지금처럼 이어 가요.',
}

const FOLIC_COPY: TimerCopy = {
  goalText: FOLIC_GOAL_TEXT,
  notStarted: '시작 전이에요. 엽산을 처음 체크한 날부터 세어 드려요.',
  stopped: '한동안 체크가 없었어요. 다시 체크한 날부터 새로 세어 드려요.',
  running: '임신 3개월 전부터(최소 1개월 전) 임신 12주까지 하루 400µg을 권해요.',
  reached: '3개월을 챙겼어요. 임신 12주까지 이어 가요.',
}

/** The current run of checks: its first day, or where the last run stopped. */
interface CheckRun {
  start?: ISODate
  lastCheck?: ISODate
}

/**
 * From the sorted days with a check: the run still going on `today` (no gap
 * longer than TIMER_BREAK_DAYS, up to today), else the day it stopped.
 */
export function currentRun(days: readonly ISODate[], today: ISODate): CheckRun {
  const past = days.filter((d) => d <= today)
  const last = past[past.length - 1]
  if (!last) return {}
  if (diffDays(last, today) > TIMER_BREAK_DAYS) return { lastCheck: last }
  let start = last
  for (let i = past.length - 2; i >= 0; i--) {
    if (diffDays(past[i]!, start) > TIMER_BREAK_DAYS) break
    start = past[i]!
  }
  return { start }
}

function timer(run: CheckRun, today: ISODate, goal: number, copy: TimerCopy): Timer {
  const start = run.start
  const day = dayCount(start, today)
  if (day === undefined) {
    return run.lastCheck
      ? {
          state: 'not-started',
          lastCheck: run.lastCheck,
          goal,
          progress: 0,
          label: '다시 시작 전',
          goalText: copy.goalText,
          note: copy.stopped,
        }
      : { state: 'not-started', goal, progress: 0, label: '시작 전', goalText: copy.goalText, note: copy.notStarted }
  }
  const reached = day >= goal
  return {
    state: reached ? 'reached' : 'running',
    start,
    day,
    goal,
    progress: Math.min(1, day / goal),
    label: `D+${day}`,
    goalText: copy.goalText,
    note: reached ? copy.reached : copy.running,
  }
}

/** The items the habit timer follows: every habit the member has (archived ones keep their history). */
export function habitItems(state: Pick<AppState, 'checkItems'>, member: MemberId): CheckItem[] {
  return state.checkItems.filter((i) => i.owner === member && i.kind === 'habit')
}

type TimerInput = Pick<AppState, 'checkItems' | 'checkLog'> & Partial<Pick<AppState, 'stage' | 'baby'>>

/**
 * Checks before this day belong to an earlier child (preparing for a second
 * one): a timer for this preparation doesn't count them.
 */
function timerFloor(state: TimerInput): ISODate | undefined {
  return state.stage === 'preparing' && state.baby?.birthDate ? state.baby.birthDate : undefined
}

/** Sorted days (from the floor, up to today) on which any of `ids` was checked. */
function checkDays(state: TimerInput, member: MemberId, ids: readonly string[], today: ISODate): ISODate[] {
  const set = new Set(ids)
  if (!set.size) return []
  const floor = timerFloor(state) ?? ''
  return Object.keys(state.checkLog)
    .filter((d) => d >= floor && d <= today && (state.checkLog[d]?.[member] ?? []).some((id) => set.has(id)))
    .sort()
}

/**
 * "건강 습관 D+N" for the member whose cycle isn't tracked: counts from the
 * first day any of their habit items (걷기·금연·금주·사우나 쉬기 …) was
 * checked in the current run. Nothing checked yet → 'not-started' ("시작 전");
 * no check for TIMER_BREAK_DAYS → 'not-started' ("다시 시작 전").
 */
export function habitTimer(state: TimerInput, member: MemberId, today: ISODate): Timer {
  const days = checkDays(state, member, habitItems(state, member).map((i) => i.id), today)
  return timer(currentRun(days, today), today, SPERM_GOAL_DAYS, SPERM_COPY)
}

/**
 * Whether sperm-side guidance (3-month timer, sauna/laptop heat, men's
 * supplements) fits this member: the one whose cycle isn't tracked, unless
 * they're '아내' (e.g. two women preparing together).
 */
export function isSpermSide(member: Pick<Member, 'tracksCycle' | 'role'>): boolean {
  return !member.tracksCycle && member.role !== 'wife'
}

export function isFolicLabel(label: string): boolean {
  return label.replace(/\s/g, '').includes('엽산')
}

/** "엽산 먹은 지 D+N" from its first check ('not-started' until then), or null without a 엽산 item. */
export function folicTimer(state: TimerInput, member: MemberId, today: ISODate): (Timer & { item: CheckItem }) | null {
  const item = activeItems(state, member).find((i) => isFolicLabel(i.label))
  if (!item) return null
  return { ...timer(currentRun(checkDays(state, member, [item.id], today), today), today, FOLIC_GOAL_DAYS, FOLIC_COPY), item }
}

// ── "See a doctor" guidance ─────────────────────────────────

/**
 * 'amenorrhea' (N12): the period is 15 days or more past the expected range,
 * she answered '아직 안 왔어요' and no positive test is waiting — NICE: irregular
 * or absent periods are a reason to be seen earlier (docs/research/medical.json).
 * Its card line is PERIOD_DUE_COPY.stillWaiting.advice.
 */
export type DoctorReason = 'age' | 'months' | 'irregular' | 'amenorrhea'

/** The two 임신 전 검사 rows: both ticked answers the 'months' reason (notifications.ts holds the list; re-exported for the card). */
export { CHECKUP_ITEM_IDS }

export interface DoctorAdvice {
  reasons: DoctorReason[]
  threshold: number
  months?: number
  age?: number
  /**
   * Why cycles look irregular: 'variation' = logged cycles differ a lot,
   * 'length' = the (logged or entered) average is unusually short or long.
   */
  irregularBy?: 'variation' | 'length'
}

/**
 * ASRM: 12 months under 35, 6 months at 35+, promptly at 40+; irregular cycles
 * and an absent period are reasons to go early (NICE). Returns null when
 * nothing applies — and always while the couple prepares with a clinic (N13:
 * they are being seen already), and without the 'months' reason once both
 * 임신 전 검사 rows are ticked (the checks the card asks for are done).
 *
 * `viewer`: who reads the card. The 'amenorrhea' reason is her period data
 * (it says she is weeks late right now), so a reader without shared cycle
 * details never gets it — the same rule as the 🩺 notice, which goes to the
 * owner only. Without a viewer the advice is the couple's full picture.
 */
export function doctorAdvice(state: AppState, today: ISODate, viewer?: MemberId): DoctorAdvice | null {
  if (state.stage !== 'preparing') return null
  // Right after a pregnancy ended, a "see a specialist" card is not what anyone needs.
  if (recentlyEnded(state, today)) return null
  if (isClinicMode(state)) return null
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]
  const age = ageFromBirthYear(owner.birthYear, today)
  const threshold = doctorThresholdMonths(age)
  const reasons: DoctorReason[] = []
  // Months of trying count from the later of ttcStart and an ended pregnancy.
  const ttc = ttcClockStart(state)
  const months = ttc && ttc <= today ? monthsBetween(ttc, today) : undefined
  const checked = checkupsDone(state)
  if (threshold === 0) reasons.push('age')
  else if (months !== undefined && months >= threshold && !checked) reasons.push('months')
  // The gap that held an ended pregnancy is not a cycle (cycle.spansEndedPregnancy).
  const stats = cycleStats(state.periods, state.cycle, undefined, undefined, state.pregnancy)
  let irregularBy: DoctorAdvice['irregularBy']
  // Her period data: the partner reads it only with shared details.
  if (stats.irregular && (viewer === undefined || canSeeCycleDetails(state, viewer))) {
    reasons.push('irregular')
    irregularBy = stats.average < 21 || stats.average > 35 ? 'length' : 'variation'
  }
  // '아직 안 왔어요' answered for a long-late cycle, no positive test waiting.
  const status = fertilityStatus(state, today)
  const cur = sortedStarts(state.periods).filter((d) => d <= today).pop()
  if (
    status.kind === 'late' &&
    status.daysLate > LONG_LATE_DAYS &&
    cur &&
    state.cycleNotes?.[cur]?.stillWaiting &&
    !activePositivePending(state) &&
    (viewer === undefined || canSeeCycleDetails(state, viewer))
  ) {
    reasons.push('amenorrhea')
  }
  return reasons.length ? { reasons, threshold, months, age, irregularBy } : null
}

// ── Pregnancy confirmation ──────────────────────────────────

export function lastPeriodStart(state: Pick<AppState, 'periods'>): ISODate | undefined {
  const starts = sortedStarts(state.periods)
  return starts[starts.length - 1]
}

/** Oldest LMP the confirm sheet accepts — the same 44 weeks as every other LMP field. */
export const LMP_MAX_DAYS = MAX_GESTATION_DAYS

/** A plausible LMP: not in the future and at most 44 weeks ago. */
export function isValidLmp(lmp: string, today: ISODate): boolean {
  if (!isISODate(lmp) || lmp > today) return false
  return diffDays(lmp, today) <= LMP_MAX_DAYS
}

/** Switch to the pregnancy stage and let the other member know. */
export function confirmPregnancy(
  state: AppState,
  lmp: ISODate,
  today: ISODate,
  from: MemberId,
  to: MemberId,
  nowISO: string,
): AppState {
  // A sheet left open on the other phone must not overwrite a pregnancy the
  // partner already recorded (or re-send the "기쁜 소식").
  if (!canStartPregnancy(state)) return state
  // The clinic confirmed it: the "병원 확인 전" state is settled here, whichever
  // screen recorded it — a leftover would come back after a later 준비로 돌아가기.
  const next = clearPositivePending(startPregnancy(state, lmp, today))
  const name = state.couple.members.find((m) => m.id === from)?.name ?? ''
  return mergeNotices(
    next,
    [
      {
        key: `pregnant:${lmp}:${to}`,
        to,
        from,
        kind: 'milestone',
        title: '🎉 기쁜 소식이 기록됐어요',
        body: `${name}님이 임신 소식을 기록했어요. 이제 둘셋이 임신 주수를 함께 챙길게요.`,
      },
    ],
    nowISO,
  ).state
}

/**
 * The pregnancy ended (유산·임신 종료, from 설정 › 단계 or the pregnancy tab):
 * back to preparing (pregnancy.backToPreparing keeps the record, settles its
 * notices and starts the quiet on its own — a 'loss' rest until the 42nd day:
 * no date estimates, no LH prompts, the support card first, and a period
 * logged inside it does not end it). ttc.startLossRest is applied once more
 * here so the rest is the same whichever of the two a screen calls. She can
 * turn it off (ttcFlow.endRestFromHome / the 쉬어요 switch). Not pregnant →
 * unchanged.
 */
export function endPregnancy(state: AppState, today: ISODate): AppState {
  if (state.stage !== 'pregnant') return state
  return startLossRest(backToPreparing(state, today), today)
}

export const TRIMESTER_LABEL: Record<1 | 2 | 3, string> = {
  1: '임신 초기',
  2: '임신 중기',
  3: '임신 후기',
}

// ── Notifications inbox ─────────────────────────────────────

export const KIND_ICON: Record<NotificationKind, string> = {
  'fertile-start': '💞',
  peak: '🌟',
  'period-due': '🗓️',
  nudge: '👉',
  cheer: '👏',
  'date-idea': '💡',
  milestone: '🎉',
  doctor: '🩺',
  system: '🔔',
}

const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u

/** Use a title's leading emoji as the row icon (fallback: by kind) so it isn't shown twice. */
export function splitTitleIcon(title: string, kind: NotificationKind): { icon: string; text: string } {
  const m = LEADING_EMOJI.exec(title)
  if (m && m[1]) return { icon: m[1], text: title.slice(m[0].length) }
  return { icon: KIND_ICON[kind] ?? '🔔', text: title }
}

/** '방금', '5분 전', '3시간 전', '2일 전', then '9월 3일'. */
export function relativeTimeKo(createdAt: string, nowMs: number): string {
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return ''
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000))
  if (sec < 60) return '방금'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  const d = createdAt.slice(0, 10)
  return isISODate(d) ? formatKo(d, { weekday: false }) : ''
}

/** Tabs a notice can open (a subset of AppShell's TabKey). */
export type NoticeTab = 'today' | 'cycle' | 'pregnancy' | 'baby' | 'date' | 'plan' | 'diary'

/**
 * Where tapping a notice should take the viewer, or null when there's nothing
 * more to see. Only returns tabs that exist in the current stage.
 */
export function noticeTarget(kind: NotificationKind, stage: Stage, key?: string): NoticeTab | null {
  // Couple-wide notices are routed by their key (kind alone is ambiguous).
  if (key?.startsWith('anniv:') || key?.startsWith('reaction:')) return 'diary'
  // 지원결정통지서 만료 D-N (planNotices.noticeExpiryNotices): the counter card sits first on 챙길 것.
  if (key?.startsWith('appt:') || key?.startsWith('deadline:') || key?.startsWith('notice-expiry:')) return 'plan'
  // What the cycle owner chose to tell (ttcFlow.tellPartnerPeriod / tellPartnerPositive):
  // the partner's card on 오늘 says what to do with it.
  if (key?.startsWith('period-told:') || key?.startsWith('positive-told:') || key?.startsWith('bleeding-told:')) return 'today'
  switch (kind) {
    case 'fertile-start':
      // The 우리의 주간 card (with its date ideas) is on 오늘 now, not the 데이트 tab.
      return stage === 'preparing' ? 'today' : null
    case 'peak':
    case 'period-due':
      return stage === 'preparing' ? 'cycle' : null
    case 'nudge':
    case 'cheer':
      return 'today'
    case 'date-idea':
      return 'date'
    case 'milestone':
      return stage === 'pregnant' ? 'pregnancy' : stage === 'parenting' ? 'baby' : null
    case 'doctor':
      // The supportive doctor card lives on the home screen.
      return stage === 'preparing' ? 'today' : null
    default:
      return null
  }
}

/** Split by the local-date prefix of createdAt (localNowISO timestamps). */
export function groupByDay<T extends { createdAt: string }>(list: T[], today: ISODate): { today: T[]; earlier: T[] } {
  const out = { today: [] as T[], earlier: [] as T[] }
  for (const n of list) (n.createdAt.slice(0, 10) === today ? out.today : out.earlier).push(n)
  return out
}

// ── Misc copy ───────────────────────────────────────────────

export const DATE_CARD_COPY: Record<Stage, { title: string; body: string }> = {
  preparing: { title: '둘만의 시간', body: '가볍게 즐길 데이트 아이디어를 모아 뒀어요' },
  pregnant: { title: '둘만의 시간', body: '태교 여행, 산책 데이트도 챙겨요' },
  parenting: { title: '둘만의 시간', body: '짧아도 괜찮아요. 우리 둘만의 30분' },
}
