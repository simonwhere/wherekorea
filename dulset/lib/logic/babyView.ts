// View logic for the 아기 tab (pure). Checkup and milestone ticks live in the
// shared `milestones` array under 'checkup:<id>' and 'ms:<key>', so both
// partners see the same state. Ticks dated before the baby's birth belong to an
// earlier child (or a wrong birth date) and read as open.

import {
  CHECKUPS,
  CLAIM_60_PROGRAM_IDS,
  CLAIM_WINDOW_DAYS,
  FIRST_MEETING_PROGRAM_ID,
  GROWTH_LIMITS,
  MILESTONES,
  type CheckupKind,
  type CheckupSpec,
  type GrowthField,
  type Milestone,
} from '../content/baby'
import { addDays, addMonths, dLabel, diffDays, isISODate, parts } from '../dates'
import type { AppState, Baby, BabySex, GrowthRecord, ISODate } from '../types'
import { babyAge, formatBabyAge, koreanDays, type KoreanDay } from './baby'

export const checkupKey = (id: string) => `checkup:${id}`
export const milestoneKey = (key: string) => `ms:${key}`

/** Average Gregorian month, for plotting age on a continuous axis. */
export const DAYS_PER_MONTH = 30.4375

/** Oldest birth date we accept (the app covers roughly 0–6세). */
export const MAX_BABY_AGE_YEARS = 10

export interface DateBounds {
  min: ISODate
  max: ISODate
}

/** '태어난 날', '생후 12일', '생후 5개월', '2살 3개월' on `date`. */
export function ageAt(birth: ISODate, date: ISODate): string {
  return date === birth ? '태어난 날' : formatBabyAge(babyAge(birth, date))
}

/** When a shared tick was made for *this* baby (ticks before birth don't count). */
export function tickedAt(state: Pick<AppState, 'milestones'>, key: string, birth: ISODate): ISODate | undefined {
  const d = state.milestones.find((m) => m.key === key)?.date
  return d && d >= birth ? d : undefined
}

// ── Baby info ───────────────────────────────────────────────

export interface BabyInput {
  name: string
  birthDate: string
  sex: BabySex
}

export function birthBounds(today: ISODate): DateBounds {
  return { min: addMonths(today, -12 * MAX_BABY_AGE_YEARS), max: today }
}

export function validateBabyInfo(input: BabyInput, today: ISODate): string | null {
  if (!isISODate(input.birthDate)) return '태어난 날을 선택해 주세요.'
  const b = birthBounds(today)
  if (input.birthDate > b.max) return '오늘 이후 날짜는 고를 수 없어요.'
  if (input.birthDate < b.min) return `${MAX_BABY_AGE_YEARS}년보다 이전 날짜예요. 날짜를 확인해 주세요.`
  return null
}

export function toBabyInfo(input: BabyInput): Baby {
  return { name: input.name.trim().slice(0, 20) || '아기', birthDate: input.birthDate, sex: input.sex }
}

/** Edit name / birth date / sex. Keeps the stage and every record. */
export function saveBabyInfo(state: AppState, input: BabyInput): AppState {
  return { ...state, baby: toBabyInfo(input) }
}

// ── 한국 기념일 ─────────────────────────────────────────────

export type DayStatus = 'past' | 'today' | 'upcoming'

export interface KoreanDayRow extends KoreanDay {
  status: DayStatus
  /** 'D-3', 'D-day', 'D+12' */
  d: string
}

export function koreanDayRows(birth: ISODate, today: ISODate, years = 3): KoreanDayRow[] {
  return koreanDays(birth, years).map((k) => ({
    ...k,
    status: k.date < today ? 'past' : k.date === today ? 'today' : 'upcoming',
    d: dLabel(k.date, today),
  }))
}

// ── 영유아 건강검진 ─────────────────────────────────────────

export interface CheckupWindow {
  id: string
  key: string
  kind: CheckupKind
  round: number
  label: string
  start: ISODate
  /** Inclusive. */
  end: ISODate
}

/**
 * Actual dates for a checkup window. Month windows start the day the baby
 * turns `fromMonth` months and end the day before they turn `toMonth + 1`
 * months — the same month math as `babyAge`, so "생후 6개월" on the label is
 * exactly the span where babyAge().months reads 6 (Jan 31 births included).
 */
export function checkupWindow(spec: CheckupSpec, birth: ISODate): CheckupWindow {
  const base = { id: spec.id, key: checkupKey(spec.id), kind: spec.kind, round: spec.round, label: spec.label }
  if ('fromDays' in spec) {
    return { ...base, start: addDays(birth, spec.fromDays), end: addDays(birth, spec.toDays) }
  }
  return { ...base, start: addMonths(birth, spec.fromMonth), end: addDays(addMonths(birth, spec.toMonth + 1), -1) }
}

/** All windows, earliest first (건강검진 before 구강검진 on the same day). */
export function checkupWindows(birth: ISODate, specs: CheckupSpec[] = CHECKUPS): CheckupWindow[] {
  return specs
    .map((s) => checkupWindow(s, birth))
    .sort((a, b) => (a.start === b.start ? (a.kind === b.kind ? a.round - b.round : a.kind === 'general' ? -1 : 1) : a.start < b.start ? -1 : 1))
}

export type CheckupStatus = 'done' | 'now' | 'next' | 'upcoming' | 'past'

export interface CheckupRow extends CheckupWindow {
  status: CheckupStatus
  doneAt?: ISODate
}

/**
 * Every open window that holds today is 'now'. The open window(s) starting
 * soonest after today are 'next'. A window that ended without a tick is
 * 'past' (still tickable — maybe it just wasn't recorded).
 */
export function checkupTimeline(state: Pick<AppState, 'milestones'>, birth: ISODate, today: ISODate): CheckupRow[] {
  const rows: CheckupRow[] = checkupWindows(birth).map((w) => {
    const doneAt = tickedAt(state, w.key, birth)
    const status: CheckupStatus = doneAt ? 'done' : today > w.end ? 'past' : today >= w.start ? 'now' : 'upcoming'
    return { ...w, status, doneAt }
  })
  const nextStart = rows.find((r) => r.status === 'upcoming')?.start
  return rows.map((r) => (r.status === 'upcoming' && r.start === nextStart ? { ...r, status: 'next' } : r))
}

/** Rows to show up front: what's open now, else what's next. */
export function checkupFocus(rows: CheckupRow[]): CheckupRow[] {
  const now = rows.filter((r) => r.status === 'now')
  return now.length ? now : rows.filter((r) => r.status === 'next')
}

/** Tick (dated today) or untick a checkup for this baby. */
export function toggleCheckup(state: AppState, id: string, birth: ISODate, today: ISODate): AppState {
  const key = checkupKey(id)
  const milestones = state.milestones.filter((m) => m.key !== key)
  if (!tickedAt(state, key, birth)) milestones.push({ key, date: today })
  return { ...state, milestones }
}

// ── 발달 이정표 ─────────────────────────────────────────────

export interface MilestoneRow extends Milestone {
  mkey: string
  date?: ISODate
  /** Age on the achieved date ('생후 5개월'). */
  ageLabel?: string
}

export function milestoneRows(state: Pick<AppState, 'milestones'>, birth: ISODate): MilestoneRow[] {
  return MILESTONES.map((m) => {
    const mkey = milestoneKey(m.key)
    const date = tickedAt(state, mkey, birth)
    return { ...m, mkey, date, ageLabel: date ? ageAt(birth, date) : undefined }
  })
}

export function validateMilestoneDate(date: string, birth: ISODate, today: ISODate): string | null {
  if (!isISODate(date)) return '날짜를 선택해 주세요.'
  if (date > today) return '오늘 이후 날짜는 고를 수 없어요.'
  if (date < birth) return '태어난 날보다 이른 날짜예요.'
  return null
}

// ── 성장 기록 ───────────────────────────────────────────────

export interface GrowthInput {
  date: string
  heightCm: string
  weightKg: string
  headCm: string
}

export type GrowthErrorKey = 'date' | GrowthField | 'form'
export type GrowthErrors = Partial<Record<GrowthErrorKey, string>>

export const GROWTH_FIELDS: GrowthField[] = ['weightKg', 'heightCm', 'headCm']

const DECIMALS: Record<GrowthField, number> = { heightCm: 1, weightKg: 2, headCm: 1 }

/** '' → undefined, '7,5' → 7.5, 'abc' → NaN. */
export function parseMeasure(raw: string): number | undefined {
  const t = raw.trim().replace(',', '.')
  if (!t) return undefined
  return /^\d+(\.\d+)?$|^\.\d+$/.test(t) ? Number(t) : Number.NaN
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** '7.25kg', '68.5cm' — trims trailing zeros. */
export function formatMeasure(value: number, field: GrowthField): string {
  return `${roundTo(value, DECIMALS[field])}${GROWTH_LIMITS[field].unit}`
}

export function growthDateBounds(birth: ISODate, today: ISODate): DateBounds {
  return { min: birth, max: today }
}

export function validateGrowth(
  input: GrowthInput,
  birth: ISODate,
  today: ISODate,
): { record?: Omit<GrowthRecord, 'id'>; errors: GrowthErrors } {
  const errors: GrowthErrors = {}
  if (!isISODate(input.date)) errors.date = '날짜를 선택해 주세요.'
  else if (input.date > today) errors.date = '오늘 이후 날짜는 고를 수 없어요.'
  else if (input.date < birth) errors.date = '태어난 날보다 이른 날짜예요.'

  const values: Partial<Record<GrowthField, number>> = {}
  for (const f of GROWTH_FIELDS) {
    const n = parseMeasure(input[f])
    if (n === undefined) continue
    const lim = GROWTH_LIMITS[f]
    if (Number.isNaN(n)) errors[f] = `${lim.label}는 숫자로 적어 주세요.`
    else if (f === 'weightKg' && n >= 1000 && n <= 30000) errors[f] = '몸무게는 그램(g)이 아니라 kg으로 적어 주세요. 예: 3.45'
    else if (n < lim.min || n > lim.max) errors[f] = `${lim.label}는 ${lim.min}~${lim.max}${lim.unit} 사이로 적어 주세요.`
    else values[f] = roundTo(n, DECIMALS[f])
  }
  const anyTyped = GROWTH_FIELDS.some((f) => input[f].trim() !== '')
  if (!anyTyped) errors.form = '키, 몸무게, 머리둘레 중 하나는 적어 주세요.'

  if (Object.keys(errors).length) return { errors }
  return { errors, record: { date: input.date, ...values } }
}

/** Newest first; same-day records keep the latest-added on top. */
export function growthNewestFirst(growth: GrowthRecord[]): GrowthRecord[] {
  return growth
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.date === b.g.date ? b.i - a.i : a.g.date < b.g.date ? 1 : -1))
    .map((x) => x.g)
}

export function ageInMonths(birth: ISODate, date: ISODate): number {
  return diffDays(birth, date) / DAYS_PER_MONTH
}

export interface SeriesPoint {
  id: string
  date: ISODate
  /** Age in months (fractional). */
  x: number
  y: number
}

/** One measurement over age, oldest first. Records before birth are skipped. */
export function growthSeries(growth: GrowthRecord[], birth: ISODate, field: GrowthField): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (const g of growth) {
    const y = g[field]
    if (typeof y !== 'number' || !Number.isFinite(y) || g.date < birth) continue
    out.push({ id: g.id, date: g.date, x: ageInMonths(birth, g.date), y })
  }
  return out.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
}

export interface Scale {
  min: number
  max: number
  step: number
  ticks: number[]
}

function niceStep(rough: number): number {
  const exp = Math.floor(Math.log10(rough))
  const base = 10 ** exp
  const f = rough / base
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * base
}

/**
 * Clean axis bounds around [lo, hi] with about `count` intervals.
 * A flat range (one point, or equal values) is padded so the mark sits mid-axis.
 */
export function niceScale(lo: number, hi: number, count = 4): Scale {
  let a = Math.min(lo, hi)
  let b = Math.max(lo, hi)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { min: 0, max: 1, step: 1, ticks: [0, 1] }
  if (a === b) {
    const pad = Math.abs(a) * 0.1 || 1
    a -= pad
    b += pad
  }
  const step = niceStep((b - a) / Math.max(1, count))
  const min = Math.floor(a / step + 1e-9) * step
  const max = Math.ceil(b / step - 1e-9) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { min: ticks[0]!, max: ticks[ticks.length - 1]!, step, ticks }
}

/**
 * X axis in whole months from birth (ticks every 1/2/3/6/12개월), at least
 * 0–3개월 so early points aren't stretched.
 */
export function monthScale(maxX: number): Scale {
  const hi = Math.max(3, Math.ceil(maxX - 1e-9))
  const step = hi <= 4 ? 1 : hi <= 8 ? 2 : hi <= 12 ? 3 : hi <= 24 ? 6 : 12
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { min: 0, max, step, ticks }
}

/** Smallest y-range per measure, so two close records don't look like a cliff. */
const MIN_SPAN: Record<GrowthField, number> = { weightKg: 2, heightCm: 10, headCm: 4 }

export function growthYScale(values: number[], field: GrowthField): Scale {
  if (values.length === 0) return niceScale(0, 1)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const span = MIN_SPAN[field]
  if (hi - lo < span) {
    const mid = (lo + hi) / 2
    lo = mid - span / 2
    hi = mid + span / 2
  }
  const pad = (hi - lo) * 0.08
  return niceScale(Math.max(0, lo - pad), hi + pad, 4)
}

// ── 지원 제도 마감 ───────────────────────────────────────────

/** Shared tick: "we applied through 정부24 행복출산" (covers 부모급여·아동수당). */
export const CLAIM_KEY = 'claim:happy-birth'

export interface ClaimDeadline {
  /** 0 on the last day. */
  daysLeft: number
  /** Last day to apply, inclusive. */
  deadline: ISODate
  /** 'D-12', 'D-day' */
  d: string
}

/**
 * 부모급여·아동수당: "출생 후 60일 안에 신청". Counted the Korean way (태어난 날 =
 * 1일, as in "태어난 지 N일째"), the last day is the 60th day of life, birth + 59.
 * That is the earlier of the two possible readings, so nobody misses the window
 * by a day. Null before birth and once the window has passed.
 */
export function claimDeadline(birth: ISODate, today: ISODate): ClaimDeadline | null {
  const deadline = addDays(birth, CLAIM_WINDOW_DAYS - 1)
  if (today < birth || today > deadline) return null
  return { daysLeft: diffDays(today, deadline), deadline, d: dLabel(deadline, today) }
}

/** When the couple marked the 행복출산 application as done (for this baby). */
export function claimAppliedAt(state: Pick<AppState, 'milestones'>, birth: ISODate): ISODate | undefined {
  return tickedAt(state, CLAIM_KEY, birth)
}

/** Mark (dated today) or unmark "we applied". */
export function toggleClaimApplied(state: AppState, birth: ISODate, today: ISODate): AppState {
  const milestones = state.milestones.filter((m) => m.key !== CLAIM_KEY)
  if (!claimAppliedAt(state, birth)) milestones.push({ key: CLAIM_KEY, date: today })
  return { ...state, milestones }
}

/** Last day of "출생일로부터 1년 안에 사용" — the day before the first birthday. */
export function firstYearLastDay(birth: ISODate): ISODate {
  return addDays(addMonths(birth, 12), -1)
}

export interface ProgramDeadline {
  /** Still applies to this baby (emphasize it). */
  active: boolean
  d?: string
  /** The couple marked it as applied. */
  done?: boolean
}

/**
 * Whether a program's deadline still applies to this baby, with a D-label when
 * it is date-bound: 60-day claims (부모급여·아동수당) and 첫만남이용권 (use
 * within a year of birth). Other deadlines are shown as plain, always-on text.
 */
export function programDeadline(
  programId: string,
  birth: ISODate,
  today: ISODate,
  applied = false,
): ProgramDeadline {
  if (CLAIM_60_PROGRAM_IDS.includes(programId)) {
    if (applied) return { active: false, done: true }
    const c = claimDeadline(birth, today)
    return c ? { active: true, d: c.d } : { active: false }
  }
  if (programId === FIRST_MEETING_PROGRAM_ID) {
    const last = firstYearLastDay(birth)
    return today >= birth && today <= last ? { active: true, d: dLabel(last, today) } : { active: false }
  }
  return { active: true }
}

// ── 날짜 표시 ───────────────────────────────────────────────

/** '5.1', or '2027.5.1' when the year isn't this year. */
export function shortDate(date: ISODate, today: ISODate): string {
  const p = parts(date)
  return date.slice(0, 4) === today.slice(0, 4) ? `${p.month}.${p.day}` : `${p.year}.${p.month}.${p.day}`
}

/** '5.1 ~ 7.31', '11.30 ~ 2027.2.27' */
export function formatSpan(start: ISODate, end: ISODate, today: ISODate): string {
  return `${shortDate(start, today)} ~ ${shortDate(end, today)}`
}
