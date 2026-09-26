// View logic for the 임신 tab (pure). Check states for the prenatal schedule
// and the hospital bag live in the shared `milestones` array under the keys
// 'prenatal:<id>' and 'bag:<id>', so both partners see the same ticks.

import { addDays, diffDays, isISODate } from '../dates'
import {
  BAG_ITEMS,
  BAG_PROMINENT_WEEK,
  PARTNER_IDEAS,
  PRENATAL_CHECKS,
  WEEKS,
  type PartnerIdea,
  type PrenatalCheck,
  type Trimester,
  type WeekInfo,
} from '../content/pregnancy'
import type { AppState, Baby, BabySex, ISODate, Member, MemberId, Pregnancy } from '../types'
import { setMilestone } from './baby'
import { sortedStarts } from './cycle'
import { mergeNotices } from './notifications'
import { PREGNANCY_DAYS } from './pregnancy'

/** Longest pregnancy we accept when dating from an LMP (44 weeks). */
export const MAX_GESTATION_DAYS = 308

export const prenatalKey = (id: string) => `prenatal:${id}`
export const bagKey = (id: string) => `bag:${id}`

// ── Week content ────────────────────────────────────────────

/** Content for a completed-week count. Before 4주 shows 4주; after 40주 shows 39–40주. */
export function weekInfoFor(weeks: number): WeekInfo {
  const first = WEEKS[0]!
  const last = WEEKS[WEEKS.length - 1]!
  if (weeks < first.from) return first
  if (weeks > last.to) return last
  return WEEKS.find((w) => weeks >= w.from && weeks <= w.to) ?? last
}

export function weekRangeLabel(info: Pick<WeekInfo, 'from' | 'to'>): string {
  return info.from === info.to ? `${info.from}주` : `${info.from}~${info.to}주`
}

/**
 * Badge on the "이번 주" card. Outside the covered weeks the clamped entry is
 * shown, so the badge says so instead of claiming a week we are not in.
 */
export function weekBadgeLabel(weeks: number, info: Pick<WeekInfo, 'from' | 'to'>): string {
  if (weeks < info.from) return `${info.from}주 무렵`
  if (weeks > info.to) return `${info.to}주 이후`
  return weekRangeLabel(info)
}

export function partnerIdeasFor(trimester: Trimester): PartnerIdea[] {
  return PARTNER_IDEAS[trimester]
}

/** Progress-bar position (0–100) for a week on the 40-week bar. */
export function weekPercent(weeks: number): number {
  return Math.min(100, Math.max(0, (weeks / 40) * 100))
}

// ── Milestone-backed checks ─────────────────────────────────

export function milestoneDate(state: Pick<AppState, 'milestones'>, key: string): ISODate | undefined {
  return state.milestones.find((m) => m.key === key)?.date
}

/**
 * Ticks from this pregnancy are never older than its LMP or the day it was
 * recorded; older ones belong to an earlier pregnancy (backToPreparing keeps
 * milestones). Taking the earlier of the two keeps this pregnancy's ticks even
 * if the LMP is later corrected to a date after them.
 */
export function checksSince(p: Pick<Pregnancy, 'lmp' | 'confirmedAt'>): ISODate {
  return p.confirmedAt && p.confirmedAt < p.lmp ? p.confirmedAt : p.lmp
}

/**
 * When a shared check was ticked for *this* pregnancy. Ticks dated before
 * `since` (see checksSince) belong to an earlier pregnancy and read as open.
 */
export function checkedAt(state: Pick<AppState, 'milestones'>, key: string, since?: ISODate): ISODate | undefined {
  const d = milestoneDate(state, key)
  return d && (!since || d >= since) ? d : undefined
}

/** Tick (dated today) or untick a shared check. */
export function toggleMilestone(state: AppState, key: string, today: ISODate, since?: ISODate): AppState {
  return setMilestone(state, key, checkedAt(state, key, since) ? null : today)
}

export type CheckStatus = 'done' | 'now' | 'next' | 'upcoming' | 'past'

export interface TimelineRow extends PrenatalCheck {
  key: string
  status: CheckStatus
  doneAt?: ISODate
}

/**
 * Prenatal schedule with a status per row. Every open row whose window holds
 * the current week is 'now'; the first open row after it is 'next'.
 * A window that has passed without a tick is 'past' (still tickable).
 */
export function prenatalTimeline(state: Pick<AppState, 'milestones'>, weeks: number, since?: ISODate): TimelineRow[] {
  let nextAssigned = false
  return PRENATAL_CHECKS.map((c) => {
    const key = prenatalKey(c.id)
    const doneAt = checkedAt(state, key, since)
    let status: CheckStatus
    if (doneAt) status = 'done'
    else if (weeks > c.to) status = 'past'
    else if (weeks >= c.from) status = 'now'
    else if (!nextAssigned) {
      status = 'next'
      nextAssigned = true
    } else status = 'upcoming'
    return { ...c, key, status, doneAt }
  })
}

/**
 * Rows before the first current/next one (all done or past) fold away so the
 * list opens at "지금". An open application row (국민행복카드, 보건소 등록)
 * stays visible even after its usual window: unlike a scan, it can still be
 * done later, and folding it would hide support the couple has not claimed.
 * If nothing is current or next, everything stays visible.
 */
export function splitTimeline(rows: TimelineRow[]): { earlier: TimelineRow[]; rest: TimelineRow[] } {
  const i = rows.findIndex((r) => r.status === 'now' || r.status === 'next')
  if (i <= 0) return { earlier: [], rest: rows }
  const head = rows.slice(0, i)
  const keep = (r: TimelineRow) => r.status === 'past' && !!r.programId
  return { earlier: head.filter((r) => !keep(r)), rest: [...head.filter(keep), ...rows.slice(i)] }
}

export interface BagProgress {
  done: number
  total: number
}

export function bagProgress(state: Pick<AppState, 'milestones'>, since?: ISODate): BagProgress {
  return { done: BAG_ITEMS.filter((i) => checkedAt(state, bagKey(i.id), since)).length, total: BAG_ITEMS.length }
}

export function bagProminent(weeks: number): boolean {
  return weeks >= BAG_PROMINENT_WEEK
}

// ── Date inputs ─────────────────────────────────────────────

export interface DateBounds {
  min: ISODate
  max: ISODate
}

/** LMP: not in the future, not more than 44 weeks back. */
export function lmpBounds(today: ISODate): DateBounds {
  return { min: addDays(today, -MAX_GESTATION_DAYS), max: today }
}

/**
 * A due date that puts today between 0 and 44 weeks: at most 4 weeks past
 * and at most 280 days ahead.
 */
export function dueDateBounds(today: ISODate): DateBounds {
  return { min: addDays(today, PREGNANCY_DAYS - MAX_GESTATION_DAYS), max: addDays(today, PREGNANCY_DAYS) }
}

function checkBounds(value: string, b: DateBounds, tooEarly: string, tooLate: string): string | null {
  if (!isISODate(value)) return '날짜를 선택해 주세요.'
  if (value < b.min) return tooEarly
  if (value > b.max) return tooLate
  return null
}

export function validateLmp(value: string, today: ISODate): string | null {
  return checkBounds(value, lmpBounds(today), '44주보다 이전 날짜예요. 날짜를 확인해 주세요.', '오늘 이후 날짜는 고를 수 없어요.')
}

export function validateDueDate(value: string, today: ISODate): string | null {
  return checkBounds(
    value,
    dueDateBounds(today),
    '예정일이 너무 오래 지났어요. 날짜를 확인해 주세요.',
    '예정일이 너무 멀어요. 날짜를 확인해 주세요.',
  )
}

/** Latest logged period start that could be this pregnancy's LMP, else 4 weeks ago. */
export function defaultLmp(state: Pick<AppState, 'periods'>, today: ISODate): ISODate {
  const b = lmpBounds(today)
  const starts = sortedStarts(state.periods).filter((d) => d >= b.min && d <= b.max)
  return starts[starts.length - 1] ?? addDays(today, -28)
}

/** How far a doctor-given due date is from the LMP-based one (+ = later). */
export function overrideShiftDays(lmp: ISODate, override: ISODate): number {
  return diffDays(addDays(lmp, PREGNANCY_DAYS), override)
}

// ── Birth ───────────────────────────────────────────────────

export interface BirthInput {
  name: string
  birthDate: string
  sex: BabySex
}

export function validateBirth(input: BirthInput, today: ISODate, lmp?: ISODate): string | null {
  if (!isISODate(input.birthDate)) return '태어난 날을 선택해 주세요.'
  if (input.birthDate > today) return '오늘 이후 날짜는 고를 수 없어요.'
  if (lmp && input.birthDate < lmp) return '마지막 생리 시작일보다 이른 날짜예요.'
  return null
}

export function toBaby(input: BirthInput): Baby {
  return { name: input.name.trim().slice(0, 20) || '아기', birthDate: input.birthDate, sex: input.sex }
}

// ── Partner share ───────────────────────────────────────────

/**
 * Share a prenatal check with the partner ("같이 가요"). Deduped per check per
 * day so repeated taps never turn into nagging.
 */
export function shareCheckWithPartner(
  state: AppState,
  from: Member,
  to: MemberId,
  check: Pick<PrenatalCheck, 'id' | 'title' | 'weekLabel'>,
  today: ISODate,
  nowISO: string,
): { state: AppState; sent: boolean } {
  const { state: next, added } = mergeNotices(
    state,
    [
      {
        key: `prenatal-share:${check.id}:${today}:${to}`,
        to,
        from: from.id,
        kind: 'milestone',
        title: `🏥 ${from.name}님이 검사 일정을 공유했어요`,
        body: `${check.weekLabel} · ${check.title} — 일정 맞춰서 같이 가 볼까요?`,
      },
    ],
    nowISO,
  )
  return { state: next, sent: added.length > 0 }
}
