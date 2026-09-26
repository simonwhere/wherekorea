// View model for the 챙길 것 tab (pure — no React), so the stage rules and
// the wording decisions are testable.
//
// lib/logic/roadmap builds items from whatever anchors the state holds. This
// layer decides which anchors belong to *this* stage of the couple's story:
//  - preparing: pregnancy / birth phases are previews (an ended pregnancy or an
//    older child must not produce "기한 지남" rows).
//  - pregnant: no birth yet (an older child's birth day is not this baby's).
//  - parenting: due-date rights (배우자 출산휴가 …) count from the real birth
//    day, and the pregnancy phases are behind us (nothing there is "지금" or
//    overdue any more).
// It also drops ticks that belong to an earlier pregnancy / child, the same way
// the 임신 and 아기 tabs read them (checksSince / tickedAt) — shared milestone
// ticks and the roadmap's own planDone ticks alike.
//
// LMP windows are dated from the due date (due − 280), exactly like the 임신
// tab's week count, so a doctor-adjusted due date moves NT / 정밀초음파 / … too.

import { MONTH_DEADLINES, NOT_ONE_APPOINTMENT, ROADMAP, planKey } from '@/lib/content/roadmap'
import { addDays, addMonths, diffDays, dLabel, isISODate, parts } from '@/lib/dates'
import { isValidTime } from '@/lib/logic/appointments'
import { checksSince } from '@/lib/logic/pregnancyView'
import {
  PHASES,
  STAGE_PHASES,
  buildItems,
  byPhase,
  doneInfo,
  focusItems,
  progressOf,
  setCustomTaskDone,
  setTemplateDone,
  statusFor,
  type RoadmapItem,
  type RoadmapKind,
  type RoadmapTemplate,
} from '@/lib/logic/roadmap'
import { PREGNANCY_DAYS, dueDate, gestationalAge } from '@/lib/logic/pregnancy'
import type {
  Appointment,
  AppointmentKind,
  AppState,
  Baby,
  CustomTask,
  ISODate,
  MemberId,
  MilestoneRecord,
  Pregnancy,
  RoadmapPhase,
  Stage,
} from '@/lib/types'

export const PREGNANCY_PHASES: readonly RoadmapPhase[] = ['pregnancy-1st', 'pregnancy-2nd', 'pregnancy-3rd']

/** Short chip labels (section headers use PHASE_LABEL). */
export const PHASE_SHORT: Record<RoadmapPhase, string> = {
  preconception: '임신 준비',
  'pregnancy-1st': '임신 초기',
  'pregnancy-2nd': '임신 중기',
  'pregnancy-3rd': '임신 후기',
  birth: '출산 직후',
  postpartum: '출산 후',
}

export const KIND_EMOJI: Record<RoadmapKind, string> = {
  hospital: '🏥',
  test: '🔬',
  vaccine: '💉',
  admin: '📝',
  work: '💼',
  prep: '🎒',
  habit: '🌱',
}

/** Roadmap kind → appointment kind for "일정 잡기". */
export const APPOINTMENT_KIND_OF: Record<RoadmapKind, AppointmentKind> = {
  hospital: 'hospital',
  test: 'test',
  vaccine: 'vaccine',
  admin: 'admin',
  work: 'admin',
  prep: 'other',
  habit: 'other',
}

export const HEADER_LINE: Record<Stage, string> = {
  preparing: '아기를 만나기까지, 둘이 함께 챙길 병원·검사·신청',
  pregnant: '아기를 만나기까지, 둘이 함께 챙길 병원·검사·신청',
  parenting: '아기가 태어난 뒤에도, 둘이 함께 챙길 검진·접종·신청',
}

export const PLAN_NOTE = '일반적인 안내예요. 개인 상황은 담당 의료진·회사·보건소에 확인하세요.'

/** Form examples that fit where the couple is (no pregnancy examples while preparing). */
export const APPT_PLACEHOLDER: Record<Stage, { title: string; note: string }> = {
  preparing: { title: '예: 산부인과 검진', note: '예: 금식 여부 병원에 물어보기' },
  pregnant: { title: '예: 정밀초음파', note: '예: 산모수첩 챙기기, 금식 여부 병원에 물어보기' },
  parenting: { title: '예: 영유아 건강검진', note: '예: 궁금한 점 미리 적어 가기' },
}

export const CUSTOM_PLACEHOLDER: Record<RoadmapPhase, string> = {
  preconception: '예: 검사 결과지 한곳에 모아 두기',
  'pregnancy-1st': '예: 회사에 임신 소식 알리기',
  'pregnancy-2nd': '예: 태명 같이 짓기',
  'pregnancy-3rd': '예: 병원 가는 길 미리 가 보기',
  birth: '예: 가족에게 소식 전하기',
  postpartum: '예: 아기 사진 인화하기',
}

// ── Which state the roadmap reads ───────────────────────────

// Records synced from the other phone or saved by an older version may carry a
// blank or broken date. Date math throws on those, and the 오늘 tab reads this
// model too — so a broken anchor reads as "not recorded yet" instead.

/** The pregnancy record if its dates are usable (a broken doctor's due date is ignored). */
export function usablePregnancy(p: Pregnancy | undefined): Pregnancy | undefined {
  if (!p || !isISODate(p.lmp)) return undefined
  if (p.dueDateOverride === undefined || isISODate(p.dueDateOverride)) return p
  const { dueDateOverride: _broken, ...rest } = p
  return rest
}

export function usableBaby(b: Baby | undefined): Baby | undefined {
  return b && isISODate(b.birthDate) ? b : undefined
}

function usableTasks(list: CustomTask[]): CustomTask[] {
  return list.map((c) => {
    if (c.due === undefined || isISODate(c.due)) return c
    const { due: _broken, ...rest } = c
    return rest
  })
}

/** Appointments with a real date (the list and its date math skip broken ones). */
export function usableAppointments(list: Appointment[]): Appointment[] {
  return list.filter((a) => isISODate(a.date))
}

type RoadmapState = Pick<AppState, 'couple' | 'pregnancy' | 'baby' | 'planDone' | 'milestones' | 'customTasks'>

type KeyGroup = 'pregnancy' | 'baby' | 'plan' | 'other'

function keyGroup(key: string): KeyGroup {
  if (key.startsWith('prenatal:') || key.startsWith('bag:')) return 'pregnancy'
  if (key.startsWith('checkup:') || key.startsWith('claim:')) return 'baby'
  if (key.startsWith('plan:')) return 'plan'
  return 'other'
}

/**
 * The earliest tick date that still belongs to the current pregnancy / child
 * (older ticks read as open, like the 임신·아기 tabs do). undefined = all count.
 */
export function tickSince(state: Pick<AppState, 'stage' | 'pregnancy' | 'baby'>, key: string): ISODate | undefined {
  const group = keyGroup(key)
  if (group === 'other') return undefined
  const p = state.pregnancy
  if (state.stage === 'preparing') {
    // Back to preparing after a pregnancy ended: its ticks stay with it.
    const ended = p?.endedAt
    const born = state.baby?.birthDate
    if (ended && born) return ended > born ? ended : born
    return ended ?? born
  }
  if (group === 'baby' && state.stage === 'parenting' && state.baby) return state.baby.birthDate
  return p ? checksSince(p) : state.baby?.birthDate
}

function currentMilestones(state: Pick<AppState, 'stage' | 'pregnancy' | 'baby' | 'milestones'>): MilestoneRecord[] {
  return state.milestones.filter((m) => {
    const since = tickSince(state, m.key)
    return !since || m.date >= since
  })
}

const TEMPLATE_PHASE = new Map(ROADMAP.map((t) => [t.id, t.phase]))

/**
 * The roadmap's own ticks (planDone) for this pregnancy / child. A tick on a
 * pregnancy, birth or postpartum item made before this pregnancy began belongs
 * to an earlier one. 임신 준비 ticks (vaccines, checks) always count.
 */
function currentPlanDone(state: Pick<AppState, 'stage' | 'pregnancy' | 'baby' | 'planDone'>): AppState['planDone'] {
  const out: AppState['planDone'] = {}
  for (const [id, done] of Object.entries(state.planDone)) {
    const phase = TEMPLATE_PHASE.get(id)
    const since = phase && phase !== 'preconception' ? tickSince(state, planKey(id)) : undefined
    if (!since || done.at >= since) out[id] = done
  }
  return out
}

/** The state as 챙길 것 should read it for the couple's current stage. */
export function roadmapState(state: AppState): RoadmapState {
  let pregnancy = usablePregnancy(state.pregnancy)
  let baby = usableBaby(state.baby)
  if (state.stage === 'preparing') {
    pregnancy = undefined
    baby = undefined
  } else if (state.stage === 'pregnant') {
    baby = undefined
    // Weeks count from the due date (as on the 임신 tab), so LMP windows do too.
    if (pregnancy) pregnancy = { ...pregnancy, lmp: addDays(dueDate(pregnancy), -PREGNANCY_DAYS) }
  } else if (baby) {
    // After the birth, due-date-anchored windows count from the real birth day.
    pregnancy = pregnancy
      ? { ...pregnancy, lmp: addDays(dueDate(pregnancy), -PREGNANCY_DAYS), dueDateOverride: baby.birthDate }
      : { lmp: addDays(baby.birthDate, -PREGNANCY_DAYS), confirmedAt: baby.birthDate, dueDateOverride: baby.birthDate }
  }
  return {
    couple: state.couple,
    pregnancy,
    baby,
    planDone: currentPlanDone(state),
    customTasks: usableTasks(state.customTasks),
    milestones: currentMilestones(state),
  }
}

/**
 * Last day of "N개월 안" counted from `base` itself (the day it happened is day
 * 1, as 가족관계등록법 제37조 counts 신고기간): the day before the same date N
 * months on, or that month's last day when it has no such date (민법 제160조).
 * Jan 15 → Feb 14, Feb 1 → Feb 28, Jan 31 → Feb 28.
 */
export function monthsEnd(base: ISODate, months: number): ISODate {
  const same = addMonths(base, months)
  return parts(same).day === parts(base).day ? addDays(same, -1) : same
}

/** Swap a calendar-month deadline's shortest-reading end for its exact last day. */
function withMonthDeadline(it: RoadmapItem, today: ISODate): RoadmapItem {
  const months = it.template ? MONTH_DEADLINES[it.template.id] : undefined
  const w = it.template?.window
  if (!months || !w || !it.start) return it
  const end = monthsEnd(addDays(it.start, -w.start), months)
  const status = it.status === 'done' ? 'done' : statusFor({ done: false, start: it.start, end, deadline: it.deadline }, today)
  return { ...it, end, status }
}

// ── Items ───────────────────────────────────────────────────

export interface PlanItem extends RoadmapItem {
  /** The window closed (or the stage moved past it) without a tick. Still tickable. */
  lapsed: boolean
  /** A dated template whose anchor isn't known yet (before 임신/출생 기록). */
  pending: boolean
}

/**
 * How long a missed legal deadline stays "기한 지남" (warn, top of the focus
 * card). Past that it reads as a quiet "지났어요": most couples did it and just
 * didn't tick it here, and a months-old warning helps nobody.
 */
export const OVERDUE_GRACE_DAYS = 30

export function planItems(state: AppState, today: ISODate, templates: RoadmapTemplate[] = ROADMAP): PlanItem[] {
  const parenting = state.stage === 'parenting'
  return buildItems(roadmapState(state), templates, today).map((raw) => {
    const it = withMonthDeadline(raw, today)
    const pending = !!it.template?.window && !it.start
    if (it.status === 'done') return { ...it, lapsed: false, pending }
    // Pregnancy is behind a parenting couple: nothing there is due or overdue now.
    if (parenting && PREGNANCY_PHASES.includes(it.phase)) return { ...it, status: 'later', lapsed: !!it.start, pending }
    if (it.status === 'overdue' && it.end && diffDays(it.end, today) > OVERDUE_GRACE_DAYS) {
      return { ...it, status: 'later', lapsed: true, pending }
    }
    const lapsed = !!it.end && today > it.end && it.status !== 'overdue'
    return { ...it, lapsed, pending }
  })
}

/**
 * Tick a roadmap item (template or the couple's own) as done / not done.
 * A tick that's already there (e.g. made on the 임신 tab) keeps its date.
 */
export function tickItem(id: string, done: boolean, today: ISODate, by: MemberId, templates: RoadmapTemplate[] = ROADMAP) {
  return (s: AppState): AppState => {
    const t = templates.find((x) => x.id === id)
    if (t) {
      const already = !!doneInfo(roadmapState(s), t)
      return already === done ? s : setTemplateDone(s, t, done, today, by)
    }
    const c = s.customTasks.find((x) => x.id === id)
    if (!c || !!c.doneAt === done) return s
    return setCustomTaskDone(s, id, done, today, by)
  }
}

/** Whether a completion reads from a shared milestone (임신·아기 tabs see the same tick). */
export function isShared(item: RoadmapItem): boolean {
  return !!item.template?.milestoneKey && !item.template.milestoneKey.startsWith('plan:')
}

const FOCUS_RANK = { overdue: 0, deadlineNow: 1, now: 2, soon: 3 } as const

function focusRank(i: RoadmapItem): number {
  if (i.status === 'overdue') return FOCUS_RANK.overdue
  if (i.status === 'now') return i.deadline ? FOCUS_RANK.deadlineNow : FOCUS_RANK.now
  return FOCUS_RANK.soon
}

const NO_DATE = '9999-12-31'

/** Soonest first: when a 'soon' window opens, or when an open one closes (open-ended last). */
function focusKey(i: RoadmapItem): ISODate {
  if (i.status === 'soon') return i.start ?? NO_DATE
  return i.end ?? NO_DATE
}

/**
 * "이번 주 챙길 것": overdue deadlines first, then open windows (legal
 * deadlines, then whatever closes soonest; open-ended ones last, newest first),
 * then windows opening soon.
 */
export function planFocus(items: PlanItem[], limit = Infinity): PlanItem[] {
  const pool = focusItems(items, items.length) as PlanItem[]
  return pool
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => {
      const r = focusRank(a.it) - focusRank(b.it)
      if (r) return r
      const ka = focusKey(a.it)
      const kb = focusKey(b.it)
      if (ka !== kb) return ka < kb ? -1 : 1
      // Same day: the shorter window is the more time-critical one (NT before 조리원 계약).
      const la = a.it.start && a.it.end ? diffDays(a.it.start, a.it.end) : Infinity
      const lb = b.it.start && b.it.end ? diffDays(b.it.start, b.it.end) : Infinity
      if (la !== lb) return la - lb
      // Both open-ended: what opened most recently is this week's news (카시트 before 국민행복카드).
      if (a.it.status === 'now' && !a.it.end && !b.it.end && a.it.start !== b.it.start) {
        return (a.it.start ?? '') > (b.it.start ?? '') ? -1 : 1
      }
      return a.idx - b.idx
    })
    .slice(0, limit)
    .map((x) => x.it)
}

/** When nothing is due: a few open items from this stage to look at calmly. */
export function calmSuggestions(items: PlanItem[], stage: Stage, limit = 3): PlanItem[] {
  const phases = STAGE_PHASES[stage]
  return items.filter((i) => phases.includes(i.phase) && i.status !== 'done' && !i.lapsed && !i.pending).slice(0, limit)
}

// ── Phase filter ────────────────────────────────────────────

/** The phase the couple is in today (default for "+ 직접 추가"). */
export function currentPhase(state: Pick<AppState, 'stage' | 'pregnancy' | 'baby'>, today: ISODate): RoadmapPhase {
  if (state.stage === 'preparing') return 'preconception'
  if (state.stage === 'pregnant') {
    const p = usablePregnancy(state.pregnancy)
    if (!p) return 'pregnancy-1st'
    const t = gestationalAge(p, today).trimester
    return t === 1 ? 'pregnancy-1st' : t === 2 ? 'pregnancy-2nd' : 'pregnancy-3rd'
  }
  const baby = usableBaby(state.baby)
  return !baby || diffDays(baby.birthDate, today) < 60 ? 'birth' : 'postpartum'
}

export type PhaseFilter = 'stage' | 'all' | RoadmapPhase

export function phasesFor(filter: PhaseFilter, stage: Stage): RoadmapPhase[] {
  if (filter === 'stage') return STAGE_PHASES[stage]
  if (filter === 'all') return [...PHASES]
  return [filter]
}

export interface PhaseGroup {
  phase: RoadmapPhase
  items: PlanItem[]
  done: number
  total: number
  /** Why dates are missing in this phase, if they are. */
  hint?: string
}

export function phaseGroups(items: PlanItem[], filter: PhaseFilter, state: Pick<AppState, 'stage'>): PhaseGroup[] {
  const map = byPhase(items) as Map<RoadmapPhase, PlanItem[]>
  return phasesFor(filter, state.stage).map((phase) => {
    const list = map.get(phase) ?? []
    const { done, total } = progressOf(list)
    return { phase, items: list, done, total, hint: pendingHint(list) }
  })
}

/** "임신을 기록하면 …" when some dated items wait for an anchor. */
export function pendingHint(items: PlanItem[]): string | undefined {
  const waiting = items.filter((i) => i.pending && i.status !== 'done')
  if (!waiting.length) return undefined
  const needsPregnancy = waiting.some((i) => i.template?.window?.anchor !== 'birth')
  return needsPregnancy ? '임신을 기록하면 날짜가 자동으로 계산돼요' : '아기가 태어난 날을 기록하면 날짜가 자동으로 계산돼요'
}

// ── Wording ─────────────────────────────────────────────────

export type PillTone = 'brand' | 'soft' | 'ok' | 'warn' | 'muted'

export interface StatusPill {
  label: string
  tone: PillTone
}

/** Status pill for a row (none for plain future / undated rows). */
export function statusPill(item: PlanItem, stage: Stage): StatusPill | null {
  switch (item.status) {
    case 'done':
      return { label: '완료', tone: 'ok' }
    case 'overdue':
      return { label: '기한 지남', tone: 'warn' }
    case 'now':
      return { label: '지금', tone: 'brand' }
    case 'soon':
      return { label: '곧', tone: 'soft' }
    default:
      if (item.lapsed) return { label: '지났어요', tone: 'muted' }
      // "날짜 미정" only where dates matter now (e.g. 출생 전 birth items while pregnant).
      if (item.pending && STAGE_PHASES[stage].includes(item.phase)) return { label: '날짜 미정', tone: 'muted' }
      return null
  }
}

/** '10.3', or '2027.1.5' when the year isn't this year. */
export function shortDate(date: ISODate, today: ISODate): string {
  const p = parts(date)
  return date.slice(0, 4) === today.slice(0, 4) ? `${p.month}.${p.day}` : `${p.year}.${p.month}.${p.day}`
}

/** The resolved date range, or the human timing when there are no dates. */
export function dateText(item: Pick<RoadmapItem, 'start' | 'end' | 'when'>, today: ISODate): string {
  if (!item.start) return item.when
  if (!item.end) return `${shortDate(item.start, today)}부터`
  if (item.start === item.end) return shortDate(item.start, today)
  return `${shortDate(item.start, today)} ~ ${shortDate(item.end, today)}`
}

/** 'D-12' before it opens, '마감 D-3' / '5일 남음' while open. */
export function countdown(item: PlanItem, today: ISODate): string | undefined {
  if (item.status === 'done' || item.lapsed) return undefined
  // Overdue rows already show their dates and a "기한 지남" pill — no D+N counting up.
  if (item.status === 'overdue') return undefined
  if (item.status === 'now') {
    if (!item.end) return undefined
    const left = diffDays(today, item.end)
    if (item.deadline) return left === 0 ? '오늘 마감' : `마감 D-${left}`
    return left === 0 ? '오늘까지' : `${left}일 남음`
  }
  if (item.start && item.start > today) return dLabel(item.start, today)
  return undefined
}

export function ownerText(owners: MemberId[], members: AppState['couple']['members']): string {
  if (owners.length > 1) return '둘이 함께'
  return members.find((m) => m.id === owners[0])?.name ?? ''
}

// ── Appointments ────────────────────────────────────────────

export type Who = MemberId | 'both'

export function whoOf(owners: MemberId[]): Who {
  return owners.length === 1 ? owners[0]! : 'both'
}

export interface AppointmentDraft {
  date: string
  time: string
  title: string
  place: string
  who: Who
  kind: AppointmentKind
  note: string
  taskId?: string
}

/**
 * "일정 잡기" fits an open, dated-or-dateable visit / test / application — not
 * a daily habit, something to know or keep doing, or a preview whose dates
 * aren't known yet.
 */
export function canSchedule(item: PlanItem): boolean {
  if (item.status === 'done' || item.lapsed || item.pending || item.kind === 'habit') return false
  return !NOT_ONE_APPOINTMENT.has(item.id)
}

/** Prefill for "일정 잡기" on a roadmap item. */
export function draftForItem(item: RoadmapItem, today: ISODate): AppointmentDraft {
  const date = item.start && item.start > today ? item.start : today
  return {
    date,
    time: '',
    title: item.title,
    place: '',
    who: whoOf(item.owners),
    kind: item.template ? APPOINTMENT_KIND_OF[item.kind] : 'other',
    note: '',
    taskId: item.id,
  }
}

export function draftFromAppointment(a: Appointment): AppointmentDraft {
  return {
    date: a.date,
    time: a.time ?? '',
    title: a.title,
    place: a.place ?? '',
    who: a.who,
    kind: a.kind,
    note: a.note ?? '',
    taskId: a.taskId,
  }
}

export function emptyDraft(today: ISODate): AppointmentDraft {
  return { date: today, time: '', title: '', place: '', who: 'both', kind: 'hospital', note: '' }
}

export type DraftError = 'date' | 'time' | 'title'

/** New appointments start today or later; an edited one may keep its own (past) date. */
export function validateDraft(d: AppointmentDraft, minDate: ISODate): DraftError | null {
  if (!isISODate(d.date) || d.date < minDate) return 'date'
  if (!isValidTime(d.time)) return 'time'
  if (!d.title.trim()) return 'title'
  return null
}

/** Upcoming (not done) appointment linked to a roadmap item, if any. */
export function linkedAppointment(list: Appointment[], itemId: string, today: ISODate): Appointment | undefined {
  return usableAppointments(list)
    .filter((a) => a.taskId === itemId && !a.done && a.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date < b.date ? -1 : 1))[0]
}

export const CUSTOM_TITLE_MAX = 40
export const APPT_TITLE_MAX = 60
export const APPT_TEXT_MAX = 80
