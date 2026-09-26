// Home ("오늘") screen rules — pure, so wording and timer decisions are testable.

import { diffDays, formatKo, isISODate, parts } from '../dates'
import type { AppState, CheckItem, ISODate, Member, MemberId, NotificationKind, Settings, Stage } from '../types'
import { activeItems, doneIds, firstCheckedDate, toggleCheck } from './checks'
import { cycleStats, ourWeekSoon, sortedStarts, type FertilityStatus } from './cycle'
import {
  ageFromBirthYear,
  doctorThresholdMonths,
  localNowISO,
  mergeNotices,
  monthsBetween,
  notifyCompleted,
  ttcClockStart,
} from './notifications'
import { MAX_GESTATION_DAYS, canStartPregnancy, recentlyEnded, startPregnancy } from './pregnancy'

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
  settings: Pick<Settings, 'lowPressure' | 'alertStyle'>,
  viewer: MemberId,
  isCycleOwner: boolean,
): FertilityVoice {
  if (settings.lowPressure) return 'calm'
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

/** Progress over the rows the checklist shows (active items). */
export function rowProgress(state: Pick<AppState, 'checkItems' | 'checkLog'>, member: MemberId, date: ISODate): RowProgress {
  const rows = activeItems(state, member)
  const done = doneIds(state, member, date)
  const count = rows.filter((i) => done.includes(i.id)).length
  return { done: count, total: rows.length, complete: rows.length > 0 && count === rows.length }
}

export function firstUnchecked(
  state: Pick<AppState, 'checkItems' | 'checkLog'>,
  member: MemberId,
  date: ISODate,
): CheckItem | undefined {
  const done = doneIds(state, member, date)
  return activeItems(state, member).find((i) => !done.includes(i.id))
}

/**
 * Toggle one item; when that toggle finishes the list, tell the partner (once a
 * day — notifyCompleted dedups by key).
 */
export function toggleWithCompletion(
  state: AppState,
  member: MemberId,
  partner: MemberId,
  date: ISODate,
  itemId: string,
  nowISO: string,
): { state: AppState; completed: boolean } {
  const before = rowProgress(state, member, date).complete
  let next = toggleCheck(state, member, date, itemId)
  const completed = !before && rowProgress(next, member, date).complete
  if (completed) next = notifyCompleted(next, member, partner, date, nowISO)
  return { state: next, completed }
}

// ── Habit timers ────────────────────────────────────────────

/** Spermatogenesis takes about 74 days (~3 months with transport/maturation). */
export const SPERM_CYCLE_DAYS = 74
/** Folic acid: at least 1 month before, Korean norm 3 months before conception. */
export const FOLIC_GOAL_DAYS = 90

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

export interface Timer {
  start?: ISODate
  day?: number
  goal: number
  /** 0–1 */
  progress: number
}

function timer(start: ISODate | undefined, today: ISODate, goal: number): Timer {
  const day = dayCount(start, today)
  return { start: day ? start : undefined, day, goal, progress: day ? Math.min(1, day / goal) : 0 }
}

/**
 * "건강 습관 D+N" for the member whose cycle isn't tracked. Counts from the
 * later of ttcStart and the first check of their first habit item.
 */
export function habitTimer(state: AppState, member: MemberId, today: ISODate): Timer {
  const firstHabit = activeItems(state, member).find((i) => i.kind === 'habit')
  const checked = firstHabit ? firstCheckedDate(state, member, firstHabit.id) : undefined
  return timer(laterOf(state.settings.ttcStart, checked), today, SPERM_CYCLE_DAYS)
}

/**
 * Whether sperm-side guidance (74-day timer, sauna/laptop heat, men's
 * supplements) fits this member: the one whose cycle isn't tracked, unless
 * they're '아내' (e.g. two women preparing together).
 */
export function isSpermSide(member: Pick<Member, 'tracksCycle' | 'role'>): boolean {
  return !member.tracksCycle && member.role !== 'wife'
}

export function isFolicLabel(label: string): boolean {
  return label.replace(/\s/g, '').includes('엽산')
}

/** "엽산 먹은 지 D+N", or null when there's no folic-acid item. */
export function folicTimer(state: AppState, member: MemberId, today: ISODate): (Timer & { item: CheckItem }) | null {
  const item = activeItems(state, member).find((i) => isFolicLabel(i.label))
  if (!item) return null
  return { ...timer(firstCheckedDate(state, member, item.id), today, FOLIC_GOAL_DAYS), item }
}

// ── "See a doctor" guidance ─────────────────────────────────

export type DoctorReason = 'age' | 'months' | 'irregular'

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
 * are a reason to go early (NICE). Returns null when nothing applies.
 */
export function doctorAdvice(state: AppState, today: ISODate): DoctorAdvice | null {
  if (state.stage !== 'preparing') return null
  // Right after a pregnancy ended, a "see a specialist" card is not what anyone needs.
  if (recentlyEnded(state, today)) return null
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]
  const age = ageFromBirthYear(owner.birthYear, today)
  const threshold = doctorThresholdMonths(age)
  const reasons: DoctorReason[] = []
  // Months of trying count from the later of ttcStart and an ended pregnancy.
  const ttc = ttcClockStart(state)
  const months = ttc && ttc <= today ? monthsBetween(ttc, today) : undefined
  if (threshold === 0) reasons.push('age')
  else if (months !== undefined && months >= threshold) reasons.push('months')
  const stats = cycleStats(state.periods, state.cycle)
  let irregularBy: DoctorAdvice['irregularBy']
  if (stats.irregular) {
    reasons.push('irregular')
    irregularBy = stats.average < 21 || stats.average > 35 ? 'length' : 'variation'
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
  const next = startPregnancy(state, lmp, today)
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
export type NoticeTab = 'today' | 'cycle' | 'pregnancy' | 'baby' | 'date'

/**
 * Where tapping a notice should take the viewer, or null when there's nothing
 * more to see. Only returns tabs that exist in the current stage.
 */
export function noticeTarget(kind: NotificationKind, stage: Stage): NoticeTab | null {
  switch (kind) {
    case 'fertile-start':
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
