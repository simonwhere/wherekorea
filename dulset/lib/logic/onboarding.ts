// Onboarding (N15) — the pure parts of the four screens and of what comes
// after them:
//   • "최근 시작일 더 넣기": up to PAST_STARTS_MAX earlier period starts next to
//     the last one, so the first month already predicts from her own cycles
//     instead of the 28-day default (review Top 8);
//   • the quick [오늘][어제][1주 전]… chips that FirstPeriodCard / PeriodPanel
//     share with the 주기 screen;
//   • the partner's defaults until they open their own screen (걷기 30분 +
//     은근하게 — nobody answers the smoking / drinking questions for them) and
//     the first-run sheet that lets them answer themselves;
//   • "이 폰은 누구 거예요?" after a restore (the per-device viewer).
// Nothing here reads the clock or the browser.

import { addDays, diffDays, isISODate } from '../dates'
import { defaultCheckItems, type HabitAnswers } from '../initial'
import { MIN_CYCLE, addPeriod } from './cycle'
import { linkPartner, setAlertStyle, setSetting } from './settings'
import type { AlertStyle, AppState, CheckItem, ISODate, MemberId, Settings } from '../types'

// ── Quick "when did it start" chips ─────────────────────────

export interface QuickStartChip {
  label: string
  daysAgo: number
}

/** [오늘][어제][1주 전][2주 전][3주 전] — the same row in onboarding, FirstPeriodCard and the empty log sheet. */
export const QUICK_START_CHIPS: readonly QuickStartChip[] = [
  { label: '오늘', daysAgo: 0 },
  { label: '어제', daysAgo: 1 },
  { label: '1주 전', daysAgo: 7 },
  { label: '2주 전', daysAgo: 14 },
  { label: '3주 전', daysAgo: 21 },
] as const

export function quickStartDate(today: ISODate, daysAgo: number): ISODate {
  return addDays(today, -daysAgo)
}

// ── Earlier period starts ("최근 시작일 더 넣기") ───────────

/** How many earlier starts the onboarding screen takes (besides the last one). */
export const PAST_STARTS_MAX = 6
/** The oldest earlier start accepted — two years back is more than enough cycles. */
export const PAST_STARTS_MAX_AGE_DAYS = 730

export type PastStartError = 'invalid' | 'future' | 'not-before-last' | 'too-old' | 'too-close' | 'duplicate' | 'full'

export const PAST_START_ERROR_TEXT: Record<PastStartError, string> = {
  invalid: '날짜를 다시 골라 주세요.',
  future: '오늘 이후 날짜는 넣을 수 없어요.',
  'not-before-last': '마지막 시작일보다 앞선 날이어야 해요.',
  'too-old': '2년 안의 날짜로 넣어 주세요.',
  'too-close': `다른 시작일과 ${MIN_CYCLE}일 이상 떨어져야 해요. 같은 생리라면 하나만 남겨요.`,
  duplicate: '이미 넣은 날이에요.',
  full: `최근 시작일은 ${PAST_STARTS_MAX}개까지 넣을 수 있어요. 나머지는 주기 탭에서 언제든 더 넣을 수 있어요.`,
}

export interface PastStartContext {
  /** The last period start (the first date on the screen). */
  lastStart: ISODate
  pastStarts: readonly ISODate[]
  today: ISODate
}

/** Why `date` can't join the earlier starts (null = fine). */
export function pastStartProblem(date: string, ctx: PastStartContext): PastStartError | null {
  if (!isISODate(date)) return 'invalid'
  if (date > ctx.today) return 'future'
  if (date >= ctx.lastStart) return 'not-before-last'
  if (diffDays(date, ctx.today) > PAST_STARTS_MAX_AGE_DAYS) return 'too-old'
  if (ctx.pastStarts.includes(date)) return 'duplicate'
  if (ctx.pastStarts.length >= PAST_STARTS_MAX) return 'full'
  const others = [ctx.lastStart, ...ctx.pastStarts]
  if (others.some((d) => Math.abs(diffDays(d, date)) < MIN_CYCLE)) return 'too-close'
  return null
}

/** Newest first, unique. */
function sortNewestFirst(list: readonly ISODate[]): ISODate[] {
  return Array.from(new Set(list)).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}

/** Add an earlier start; the list stays newest first. On an error the list is returned unchanged. */
export function addPastStart(date: string, ctx: PastStartContext): { list: ISODate[]; error: PastStartError | null } {
  const error = pastStartProblem(date, ctx)
  if (error) return { list: [...ctx.pastStarts], error }
  return { list: sortNewestFirst([...ctx.pastStarts, date]), error: null }
}

export function removePastStart(list: readonly ISODate[], date: ISODate): ISODate[] {
  return list.filter((d) => d !== date)
}

/**
 * The earlier starts that still fit after the last start changed (or was
 * cleared with '잘 모르겠어요'): each must sit before the new last start and
 * keep MIN_CYCLE days from its neighbours. Newest first.
 */
export function cleanPastStarts(list: readonly ISODate[], lastStart: string | undefined, today: ISODate): ISODate[] {
  if (!isISODate(lastStart) || lastStart > today) return []
  const kept: ISODate[] = []
  for (const d of sortNewestFirst(list)) {
    if (pastStartProblem(d, { lastStart, pastStarts: kept, today }) === null) kept.push(d)
  }
  return kept
}

/**
 * The next earlier start to offer with one tap: one average cycle before the
 * oldest date on the screen (null when the list is full or that would be too old).
 */
export function suggestPastStart(ctx: PastStartContext & { cycleLength: number }): ISODate | null {
  if (ctx.pastStarts.length >= PAST_STARTS_MAX) return null
  const oldest = [ctx.lastStart, ...ctx.pastStarts].reduce((a, b) => (b < a ? b : a))
  const next = addDays(oldest, -Math.max(MIN_CYCLE, Math.round(ctx.cycleLength)))
  return pastStartProblem(next, ctx) === null ? next : null
}

/** '약 4주 전' for the quick-add button (whole weeks, at least 2). */
export function aboutWeeksAgo(cycleLength: number): string {
  return `약 ${Math.max(2, Math.round(cycleLength / 7))}주 전`
}

/** Every start the first state will hold, oldest first (the last start included). */
export function periodStartsFrom(lastStart: string | undefined, pastStarts: readonly ISODate[], today: ISODate): ISODate[] {
  if (!isISODate(lastStart) || lastStart > today) return []
  return [...cleanPastStarts(pastStarts, lastStart, today).reverse(), lastStart]
}

export interface OnboardingCycleInput {
  /** Earlier starts from the 주기 screen (any order; validated here again). */
  pastStarts?: readonly ISODate[]
  /** 배란테스트기 써요? — undefined when the question was skipped. */
  usesLH?: Settings['usesLH']
}

/**
 * After stateFromOnboarding: add the earlier starts before the last logged
 * start (as the cycle owner's own records) and keep the LH answer. Without a
 * last start (잘 모르겠어요) no earlier start is added — the newest of them
 * would otherwise pass for the last one.
 */
export function applyOnboardingCycle(state: AppState, input: OnboardingCycleInput, today: ISODate): AppState {
  let s = state
  const last = state.periods.map((p) => p.start).sort().at(-1)
  if (last && input.pastStarts?.length) {
    const owner = state.couple.members.find((m) => m.tracksCycle)?.id
    for (const start of cleanPastStarts(input.pastStarts, last, today)) s = addPeriod(s, start, undefined, owner)
  }
  if (typeof input.usesLH === 'boolean' || input.usesLH === 'later') s = setSetting(s, 'usesLH', input.usesLH)
  return s
}

// ── The partner's defaults and first run ────────────────────

/** Until the partner answers for themselves: a non-smoker who rarely drinks and does nothing yet. */
export const PARTNER_DEFAULT_HABITS: HabitAnswers = { smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false }

/** The member who didn't onboard (member 'a' creates the space). */
export const JOINING_MEMBER: MemberId = 'b'

export function nonOwner(state: Pick<AppState, 'couple'>): MemberId {
  return state.couple.members.find((m) => m.tracksCycle)?.id === 'b' ? 'a' : 'b'
}

/**
 * One member's starter rows: from their own answers, or — before they answer —
 * the default daily row only (걷기 30분; no weekly check-in they never agreed to).
 */
export function starterItemsFor(state: Pick<AppState, 'couple'>, member: MemberId, today: ISODate, habits?: HabitAnswers): CheckItem[] {
  const mine = defaultCheckItems(state.couple.members, today, habits ?? PARTNER_DEFAULT_HABITS).filter((i) => i.owner === member)
  return habits ? mine : mine.filter((i) => i.cadence !== 'weekly')
}

/** Replace one member's check rows (the other member's rows and all history stay). */
export function setStarterItems(state: AppState, member: MemberId, items: readonly CheckItem[]): AppState {
  return { ...state, checkItems: [...state.checkItems.filter((i) => i.owner !== member), ...items] }
}

/**
 * Right after onboarding (N15 asks nobody about the other person's habits):
 * the starter lists are rebuilt from the defaults — the cycle owner's 엽산 ·
 * 비타민 D, and 걷기 30분 only for the member who doesn't track the cycle, who
 * also gets the 은근하게 alert style until they choose for themselves.
 */
export function applyPartnerDefaults(state: AppState, today: ISODate): AppState {
  const member = nonOwner(state)
  const owner: MemberId = member === 'a' ? 'b' : 'a'
  const items = [...starterItemsFor(state, owner, today), ...starterItemsFor(state, member, today)]
  return setAlertStyle({ ...state, checkItems: items }, member, 'soft')
}

/**
 * Show "민수님, 처음이죠?" — the joining member's own screen, opened for the
 * first time: not linked yet (the sheet links on completion) and no check of
 * theirs anywhere (data from before this sheet existed is left alone).
 */
export function needsPartnerFirstRun(state: AppState, viewer: MemberId): boolean {
  if (viewer !== JOINING_MEMBER || state.stage !== 'preparing' || state.couple.linkedAt) return false
  return !Object.values(state.checkLog).some((day) => (day[JOINING_MEMBER]?.length ?? 0) > 0)
}

export interface PartnerFirstRunAnswers {
  /** Only for a member who doesn't track the cycle (the owner's rows are fixed). */
  habits?: HabitAnswers
  alertStyle?: AlertStyle
}

/**
 * The partner answered (or chose '이대로 시작할게요' — null): rebuild their rows
 * from their answers, set their alert style, and record that they joined
 * (couple.linkedAt), so the sheet never comes back.
 */
export function completePartnerFirstRun(
  state: AppState,
  member: MemberId,
  answers: PartnerFirstRunAnswers | null,
  today: ISODate,
  nowISO: string,
): AppState {
  let s = state
  const tracks = state.couple.members.find((m) => m.id === member)?.tracksCycle === true
  if (answers?.habits && !tracks) s = setStarterItems(s, member, starterItemsFor(s, member, today, answers.habits))
  if (answers?.alertStyle) s = setAlertStyle(s, member, answers.alertStyle)
  return linkPartner(s, nowISO)
}

// ── Whose phone ─────────────────────────────────────────────

/** A stored "this phone belongs to" value, or null when it isn't one. */
export function parseDeviceViewer(value: unknown): MemberId | null {
  return value === 'a' || value === 'b' ? value : null
}
