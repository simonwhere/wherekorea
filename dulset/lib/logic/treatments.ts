// 난임 시술 지원 카운터 (Next B), pure helpers.
//
// `state.treatments` holds the couple's clinic attempts (배란유도 · 인공수정 ·
// 체외수정 신선/동결), `state.leaveDays[member]` each person's own 난임치료휴가
// days. Every number here exists in docs/research/kr-programs.json:
//   • 인공수정 5회 · 체외수정 20회(신선·동결 통합, 2024-02) · 출산당 총 25회
//     ('ivf-count-merged-2024-02', '급여 구조와 성과', '2024년 제도 변경')
//   • 지원결정통지서 유효기간 6개월 (2026-01; 3개월 before)
//     ('notice-valid-6-months-2026')
//   • 난임치료휴가 연 6일, 유급 2일 → 2026-11-27부터 4일
//     ('난임치료휴가(고용노동부)', 'infertility-leave-paid-4-days-2026-11-27',
//     admin-timeline.json '난임치료휴가 연 6일 활용')
// What the counter cannot know (whether a cancelled cycle was deducted, a
// per-attempt 금액, 사실혼 rules) stays out: screens say "보건소마다 달라요".
// Nothing here predicts or scores anything — it counts what the couple logged.

import { addDays, addMonths, diffDays, formatKo, isISODate, parts } from '../dates'
import { uid } from '../id'
import { isClinicMode } from './clinic'
import { canLogCycle, lowPressureFor } from './prefs'
import {
  LEAVE_KINDS,
  MEMBER_IDS,
  TREATMENT_KINDS,
  TREATMENT_OUTCOMES,
  type AppState,
  type ISODate,
  type LeaveDay,
  type LeaveDays,
  type LeaveKind,
  type MemberId,
  type Settings,
  type Treatment,
  type TreatmentKind,
  type TreatmentOutcome,
} from '../types'

export { TREATMENT_KINDS, TREATMENT_OUTCOMES }

// ── Labels ──────────────────────────────────────────────────

/** Longest note on an attempt. */
export const TREATMENT_NOTE_MAX = 140

/**
 * Plain names of the attempts. '배란유도' is the procedure's own name (the
 * couple chose it in the clinic); a screen for a soft / off viewer should
 * still pass these through its lens before showing them on a home card.
 */
export const TREATMENT_LABEL: Record<TreatmentKind, string> = {
  'ovulation-induction': '배란유도',
  iui: '인공수정',
  'ivf-fresh': '체외수정 (신선배아)',
  'ivf-frozen': '체외수정 (동결배아)',
}

/**
 * The same kinds without the word 배란 — what a soft / off / 부담 줄이기 viewer
 * sees on a card (AGENTS.md: those viewers never meet 가임기·배란·LH words).
 */
export const TREATMENT_LABEL_NEUTRAL: Record<TreatmentKind, string> = {
  'ovulation-induction': '약·주사 주기',
  iui: '인공수정',
  'ivf-fresh': '체외수정 (신선배아)',
  'ivf-frozen': '체외수정 (동결배아)',
}

/** The label for a kind, neutral when the viewer's lens asks for it. */
export function treatmentLabel(kind: TreatmentKind, neutral = false): string {
  return (neutral ? TREATMENT_LABEL_NEUTRAL : TREATMENT_LABEL)[kind]
}

/**
 * Does this viewer get the neutral words? Anyone whose alert style is not
 * 'explicit' (soft / off), or who is in 부담 줄이기 (theirs or the couple's).
 * Unknown reads as neutral — hiding a word is the safe direction.
 */
export function neutralTreatmentWords(settings: Pick<Settings, 'alertStyle' | 'lowPressure' | 'personal'>, viewer: MemberId): boolean {
  return lowPressureFor(settings, viewer) || (settings.alertStyle?.[viewer] ?? 'soft') !== 'explicit'
}

/** How an attempt ended — the same words the test panels use, never '실패'. */
export const OUTCOME_LABEL: Record<TreatmentOutcome, string> = {
  negative: '음성',
  positive: '양성',
  cancelled: '중단',
  ongoing: '진행 중',
}

// ── Government support numbers (docs/research/kr-programs.json) ──

/**
 * 건강보험 급여 횟수, 출산당: 인공수정 5 · 체외수정 20 (신선·동결 통합) · 합계 25.
 * kr-programs.json 'ivf-count-merged-2024-02' (effective 2024-02), '2024년
 * 제도 변경' (평생 → 출산당, 2024-11). 배란유도 has no denominator there.
 */
export const SUPPORT_TOTALS = { iui: 5, ivf: 20, all: 25 } as const

/**
 * May a screen show those denominators ('1/5회 사용')? True while
 * kr-programs.json 'ivf-count-merged-2024-02' is `inUI` (tests/treatments
 * pins the two together). Set it to false and every counter reads
 * 'N회 사용 · 지원 횟수는 보건소에서 확인해요' with a link instead — a number
 * nobody checked never reaches the screen. 배란유도 never has one.
 */
export const SUPPORT_TOTALS_VERIFIED = true

/** Where the support numbers come from (shown next to the counter). */
export const SUPPORT_SOURCE = {
  name: '보건복지부 보도자료 · 국민건강보험공단 난임 시술 급여안내',
  url: 'https://www.gov.kr/portal/service/serviceInfo/SME000000100',
  effective: '2024-02-01',
  /** When docs/research/kr-programs.json last checked these numbers. */
  checked: '2026-10-02',
} as const

/** 지원결정통지서 validity from the day it was issued (kr-programs.json 'notice-valid-6-months-2026'). */
export const NOTICE_VALID_MONTHS_FROM = '2026-01-01'
export const NOTICE_VALID_MONTHS = { before: 3, from: 6 } as const

/** How many months a notice issued on `issuedOn` is valid: 6 from 2026-01, 3 before. */
export function noticeValidMonths(issuedOn: ISODate): number {
  return issuedOn >= NOTICE_VALID_MONTHS_FROM ? NOTICE_VALID_MONTHS.from : NOTICE_VALID_MONTHS.before
}

/** The last valid day of a notice issued on `issuedOn` (undefined for a bad date). */
export function noticeExpiryFrom(issuedOn: ISODate): ISODate | undefined {
  if (!isISODate(issuedOn)) return undefined
  return addDays(addMonths(issuedOn, noticeValidMonths(issuedOn)), -1)
}

/** 난임치료휴가: 연 6일 per person (kr-programs.json '난임치료휴가(고용노동부)', 2025-02-23). */
export const LEAVE_DAYS_PER_YEAR = 6
/** 유급 2일 → 4일 from this day (kr-programs.json 'infertility-leave-paid-4-days-2026-11-27'). */
export const PAID_LEAVE_CHANGE = '2026-11-27'
export const PAID_LEAVE_DAYS = { before: 2, from: 4 } as const

/** Paid days of the 6 for a leave year that contains `date`: 2 before 2026-11-27, 4 from it. */
export function paidDaysFor(date: ISODate): number {
  return date >= PAID_LEAVE_CHANGE ? PAID_LEAVE_DAYS.from : PAID_LEAVE_DAYS.before
}

// ── Cleaning (sanitizeBackup / normalize) ───────────────────

type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isKind = (v: unknown): v is TreatmentKind => (TREATMENT_KINDS as readonly string[]).includes(v as string)
const isOutcome = (v: unknown): v is TreatmentOutcome => (TREATMENT_OUTCOMES as readonly string[]).includes(v as string)
const isLeaveKind = (v: unknown): v is LeaveKind => (LEAVE_KINDS as readonly string[]).includes(v as string)

/** A note as it is stored: trimmed, at most TREATMENT_NOTE_MAX characters; '' when empty. */
export function cleanTreatmentNote(note: string | undefined): string {
  return (note ?? '').trim().slice(0, TREATMENT_NOTE_MAX)
}

/** Oldest first, then by id so the order is stable. */
function sortTreatments(list: readonly Treatment[]): Treatment[] {
  return [...list].sort((x, y) => (x.startDate < y.startDate ? -1 : x.startDate > y.startDate ? 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

/**
 * The strict shape of one attempt (a backup, an older save, a sheet): a known
 * kind and a real start date are required; every optional field is kept only
 * when it is usable (an end date not before the start, a known outcome, a
 * yes/no for `supported`, a real notice date, a non-empty note cut to the
 * limit). Unknown fields are dropped. null when it isn't an attempt at all.
 */
export function cleanTreatment(raw: unknown): Treatment | null {
  if (!isObj(raw) || !isStr(raw.id) || !raw.id || !isKind(raw.kind) || !isISODate(raw.startDate)) return null
  const t: Treatment = { id: raw.id, kind: raw.kind, startDate: raw.startDate }
  if (isISODate(raw.endDate) && raw.endDate >= raw.startDate) t.endDate = raw.endDate
  if (isOutcome(raw.outcome)) t.outcome = raw.outcome
  if (typeof raw.supported === 'boolean') t.supported = raw.supported
  if (isISODate(raw.noticeExpires)) t.noticeExpires = raw.noticeExpires
  if (isStr(raw.note)) {
    const note = cleanTreatmentNote(raw.note)
    if (note) t.note = note
  }
  return t
}

/**
 * The strict shape of the list: valid attempts only, one per id (the first
 * wins), oldest first; undefined when nothing is left — so a canonical state
 * (addTreatment never leaves an empty list) passes through unchanged.
 */
export function cleanTreatments(raw: unknown): Treatment[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: Treatment[] = []
  for (const item of raw) {
    const t = cleanTreatment(item)
    if (!t || seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  return out.length ? sortTreatments(out) : undefined
}

/**
 * leaveDays[member] = sorted, unique real dates of a known kind; members
 * other than 'a' / 'b' and empty lists are dropped; undefined when empty.
 */
export function cleanLeaveDays(raw: unknown): LeaveDays | undefined {
  if (!isObj(raw)) return undefined
  const out: LeaveDays = {}
  for (const id of MEMBER_IDS) {
    const list = raw[id]
    if (!Array.isArray(list)) continue
    const byDate = new Map<ISODate, LeaveDay>()
    for (const item of list) {
      if (!isObj(item) || !isISODate(item.date) || !isLeaveKind(item.kind) || byDate.has(item.date)) continue
      byDate.set(item.date, { date: item.date, kind: item.kind })
    }
    if (byDate.size) out[id] = [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : 1))
  }
  return Object.keys(out).length ? out : undefined
}

// ── Attempts ────────────────────────────────────────────────

export type TreatmentInput = Omit<Treatment, 'id'> & { id?: string }

/** The couple's attempts, oldest first (empty when none). */
export function treatmentsOf(state: Pick<AppState, 'treatments'>): Treatment[] {
  return state.treatments ?? []
}

export function treatmentById(state: Pick<AppState, 'treatments'>, id: string): Treatment | undefined {
  return treatmentsOf(state).find((t) => t.id === id)
}

function withTreatments(state: AppState, list: Treatment[]): AppState {
  if (list.length) return { ...state, treatments: sortTreatments(list) }
  const { treatments: _gone, ...rest } = state
  return rest
}

/**
 * Add an attempt. An unknown kind, a bad start date, or an id already in the
 * list is a no-op (the same state object). Optional fields are cleaned the way
 * a backup is (cleanTreatment), so the state never carries a bad field.
 */
export function addTreatment(state: AppState, input: TreatmentInput): AppState {
  const t = cleanTreatment({ ...input, id: input.id ?? uid() })
  if (!t || treatmentById(state, t.id)) return state
  return withTreatments(state, [...treatmentsOf(state), t])
}

export type TreatmentPatch = Partial<Omit<Treatment, 'id'>>

/**
 * Patch one attempt: a key present with `undefined` clears that optional
 * field (`{ endDate: undefined }`), a key absent leaves it alone; a bad value
 * is ignored field by field. An unknown id, or a patch that changes nothing,
 * returns the same state object.
 */
export function updateTreatment(state: AppState, id: string, patch: TreatmentPatch): AppState {
  const current = treatmentById(state, id)
  if (!current) return state
  const merged: Loose = { ...current }
  for (const key of ['kind', 'startDate', 'endDate', 'outcome', 'supported', 'noticeExpires', 'note'] as const) {
    if (!(key in patch)) continue
    if (patch[key] === undefined) delete merged[key]
    else merged[key] = patch[key]
  }
  // kind / startDate can't be cleared: a bad or missing value keeps the current one.
  if (!isKind(merged.kind)) merged.kind = current.kind
  if (!isISODate(merged.startDate)) merged.startDate = current.startDate
  const next = cleanTreatment(merged)
  if (!next) return state
  if (JSON.stringify(next) === JSON.stringify(current)) return state
  return withTreatments(
    state,
    treatmentsOf(state).map((t) => (t.id === id ? next : t)),
  )
}

export function removeTreatment(state: AppState, id: string): AppState {
  if (!treatmentById(state, id)) return state
  return withTreatments(
    state,
    treatmentsOf(state).filter((t) => t.id !== id),
  )
}

// ── Support counter ─────────────────────────────────────────

export interface SupportCount {
  /** Attempts logged as 지원 (supported) and not cancelled. */
  used: number
  /** The 건강보험 / 지원 ceiling, when kr-programs.json has one. */
  total?: number
  /** True when no verified denominator exists for this kind (배란유도). */
  denominatorUnknown: boolean
}

export interface SupportCounts {
  /** 인공수정 N/5. */
  iui: SupportCount
  /** 체외수정 N/20 — 신선 + 동결 together (one pool since 2024-02). */
  ivf: SupportCount
  /** 인공수정 + 체외수정 N/25, 출산당. */
  all: SupportCount
  /** 배란유도: counted, never with a denominator. */
  ovulationInduction: SupportCount
  /** Supported, not-cancelled attempts per kind (신선 / 동결 shown separately, no cap of their own). */
  byKind: Record<TreatmentKind, number>
  /** Counts restart after a birth (출산당): attempts on or before this day are left out. */
  since?: ISODate
}

/**
 * Does this attempt use up one of the 25? Only a 지원 attempt that wasn't
 * cancelled — 난자채취 실패·미성숙 난자 같은 불가피한 중단은 미차감
 * (kr-programs.json 'ivf-count-merged-2024-02'); the clinic / 보건소 decide
 * the edge cases, which is why screens add '보건소마다 달라요'.
 */
export function countsTowardSupport(t: Pick<Treatment, 'supported' | 'outcome'>): boolean {
  return t.supported === true && t.outcome !== 'cancelled'
}

/**
 * The 지원 횟수 used so far, per kind, with the verified denominators only.
 * 출산당: once a baby was born (state.baby), only attempts after the birth count.
 */
export function supportCounts(
  state: Pick<AppState, 'treatments' | 'baby'>,
  { verified = SUPPORT_TOTALS_VERIFIED }: { verified?: boolean } = {},
): SupportCounts {
  const since = state.baby?.birthDate
  const byKind: Record<TreatmentKind, number> = { 'ovulation-induction': 0, iui: 0, 'ivf-fresh': 0, 'ivf-frozen': 0 }
  for (const t of treatmentsOf(state)) {
    if (since && t.startDate <= since) continue
    if (countsTowardSupport(t)) byKind[t.kind] += 1
  }
  const ivf = byKind['ivf-fresh'] + byKind['ivf-frozen']
  const count = (used: number, total: number): SupportCount =>
    verified ? { used, total, denominatorUnknown: false } : { used, denominatorUnknown: true }
  return {
    iui: count(byKind.iui, SUPPORT_TOTALS.iui),
    ivf: count(ivf, SUPPORT_TOTALS.ivf),
    all: count(byKind.iui + ivf, SUPPORT_TOTALS.all),
    ovulationInduction: { used: byKind['ovulation-induction'], denominatorUnknown: true },
    byKind,
    ...(since ? { since } : {}),
  }
}

/** 'N/5' for a known denominator, 'N회' otherwise. */
export function supportCountLabel(c: SupportCount): string {
  return c.total === undefined ? `${c.used}회` : `${c.used}/${c.total}`
}

/** What the counter says when no verified denominator exists (with a 정부24 / 보건소 link next to it). */
export const SUPPORT_CHECK_LINE = '지원 횟수는 보건소에서 확인해요'

/** '1/5회 사용' with a verified denominator; '1회 사용 · 지원 횟수는 보건소에서 확인해요' without one. */
export function supportUsedLabel(c: SupportCount): string {
  return c.total === undefined ? `${c.used}회 사용 · ${SUPPORT_CHECK_LINE}` : `${c.used}/${c.total}회 사용`
}

/** 배란유도 is counted but never against the 25: 'N회 · 지원 횟수 밖'. */
export function ovulationInductionLabel(c: SupportCount): string {
  return `${c.used}회 · 지원 횟수 밖`
}

// ── 지원결정통지서 ───────────────────────────────────────────

export interface NoticeStatus {
  /** The attempt the notice belongs to. */
  treatmentId: string
  /** Last valid day. */
  expires: ISODate
  /** Days from today to the last valid day (0 = today; negative = expired). */
  daysLeft: number
  expired: boolean
}

/**
 * The newest 지원결정통지서 in the list (the latest `noticeExpires`), with
 * how many days it has left — undefined when no attempt has one. Which notice
 * is "current" is the couple's: they write the date on the attempt it covers.
 */
export function noticeStatus(state: Pick<AppState, 'treatments'>, today: ISODate): NoticeStatus | undefined {
  let best: Treatment | undefined
  for (const t of treatmentsOf(state)) {
    if (!t.noticeExpires) continue
    if (!best || t.noticeExpires > best.noticeExpires!) best = t
  }
  if (!best?.noticeExpires) return undefined
  const daysLeft = diffDays(today, best.noticeExpires)
  return { treatmentId: best.id, expires: best.noticeExpires, daysLeft, expired: daysLeft < 0 }
}

/** '1월 15일 (목)까지 · D-105' / '오늘까지예요' / '8월 31일 (월)에 만료됐어요'. */
export function noticeLine(n: Pick<NoticeStatus, 'expires' | 'daysLeft' | 'expired'>): string {
  if (n.expired) return `${formatKo(n.expires)}에 만료됐어요`
  if (n.daysLeft === 0) return '오늘까지예요'
  return `${formatKo(n.expires)}까지 · D-${n.daysLeft}`
}

/** '8.10 ~ 8.25' (both dates), '8.10부터' (no end yet), or just '8.10' when the end must stay out of sight. */
export function treatmentWhen(t: Pick<Treatment, 'startDate' | 'endDate'>, today: ISODate, withEnd = true): string {
  const short = (d: ISODate) => {
    const p = parts(d)
    return d.slice(0, 4) === today.slice(0, 4) ? `${p.month}.${p.day}` : `${p.year}.${p.month}.${p.day}`
  }
  if (!withEnd) return short(t.startDate)
  if (!t.endDate) return `${short(t.startDate)}부터`
  return t.endDate === t.startDate ? short(t.startDate) : `${short(t.startDate)} ~ ${short(t.endDate)}`
}

// ── 난임치료휴가 ────────────────────────────────────────────

/** That person's leave days, sorted (empty when none). */
export function leaveDaysOf(state: Pick<AppState, 'leaveDays'>, member: MemberId): LeaveDay[] {
  return state.leaveDays?.[member] ?? []
}

/** How many leave days `member` used in calendar year `year`. */
export function leaveUsed(state: Pick<AppState, 'leaveDays'>, member: MemberId, year: number): number {
  return leaveDaysOf(state, member).filter((d) => parts(d.date).year === year).length
}

export interface LeaveSummary {
  year: number
  used: number
  /** 연 6일. */
  total: number
  /** Paid days of the 6 as of `today` (2 → 4 on 2026-11-27). */
  paid: number
  /** The day the paid days change, when it is still ahead of `today`. */
  paidChangesOn?: ISODate
}

/** 'N/6 · 유급 2일' for this year, per person. */
export function leaveSummary(state: Pick<AppState, 'leaveDays'>, member: MemberId, today: ISODate): LeaveSummary {
  const year = parts(today).year
  const paid = paidDaysFor(today)
  return {
    year,
    used: leaveUsed(state, member, year),
    total: LEAVE_DAYS_PER_YEAR,
    paid,
    ...(today < PAID_LEAVE_CHANGE ? { paidChangesOn: PAID_LEAVE_CHANGE } : {}),
  }
}

/** '1/6일'. */
export function leaveUsedLabel(l: Pick<LeaveSummary, 'used' | 'total'>): string {
  return `${l.used}/${l.total}일`
}

/** '유급 2일' — and, while the change is still ahead, '유급 2일 (2026년 11월 27일부터 4일)'. */
export function leavePaidLine(l: Pick<LeaveSummary, 'paid' | 'paidChangesOn'>): string {
  const base = `유급 ${l.paid}일`
  return l.paidChangesOn ? `${base} (${formatKo(l.paidChangesOn, { year: true, weekday: false })}부터 ${PAID_LEAVE_DAYS.from}일)` : base
}

/** '1/6일 · 유급 2일 (2026년 11월 27일부터 4일)'. */
export function leaveLine(l: LeaveSummary): string {
  return `${leaveUsedLabel(l)} · ${leavePaidLine(l)}`
}

function withLeaveDays(state: AppState, member: MemberId, list: LeaveDay[]): AppState {
  const all: LeaveDays = { ...(state.leaveDays ?? {}) }
  if (list.length) all[member] = [...list].sort((x, y) => (x.date < y.date ? -1 : 1))
  else delete all[member]
  if (Object.keys(all).length) return { ...state, leaveDays: all }
  const { leaveDays: _gone, ...rest } = state
  return rest
}

/** Add one leave day for `member` (a day already there, or a bad date, is a no-op). */
export function addLeaveDay(state: AppState, member: MemberId, date: ISODate, kind: LeaveKind = 'infertility'): AppState {
  if (!isISODate(date) || !isLeaveKind(kind)) return state
  const list = leaveDaysOf(state, member)
  if (list.some((d) => d.date === date)) return state
  return withLeaveDays(state, member, [...list, { date, kind }])
}

export function removeLeaveDay(state: AppState, member: MemberId, date: ISODate): AppState {
  const list = leaveDaysOf(state, member)
  if (!list.some((d) => d.date === date)) return state
  return withLeaveDays(
    state,
    member,
    list.filter((d) => d.date !== date),
  )
}

// ── Who sees / edits the counter ────────────────────────────

/**
 * The counter card (챙길 것) belongs to the preparing stage: it shows while
 * 병원과 함께 준비 중, and stays once anything was logged so a couple who
 * turned clinic mode off keeps their records in reach.
 */
export function showsTreatmentCounter(state: Pick<AppState, 'stage' | 'restCycle' | 'treatments' | 'leaveDays'>): boolean {
  if (state.stage !== 'preparing') return false
  return isClinicMode(state) || treatmentsOf(state).length > 0 || !!state.leaveDays
}

/**
 * Who logs attempts: the cycle owner, like periods and tests (an attempt is
 * dated to her cycle and its end often is a period). Both people see the
 * counts; what the partner sees of each row follows canSeeCycleDetails.
 * 난임치료휴가 days are each person's own and either phone may note them.
 */
export function canEditTreatments(state: Pick<AppState, 'couple'>, viewer: MemberId): boolean {
  return canLogCycle(state, viewer)
}
