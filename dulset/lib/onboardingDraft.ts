// The onboarding form's pure helpers (ranges, defaults, the draft, the first
// state it builds) — what components/Onboarding.tsx and components/onboarding/*
// need on a brand-new phone. Kept apart from lib/demo.ts (the 민수·지은 example
// data) so the demo loads only when a '예시 보기' button is pressed; lib/demo.ts
// re-exports everything here, so older imports keep working.

import { addMonths, diffDays, isISODate, parts } from './dates'
import { CYCLE_RANGE_DEFAULT, DEFAULT_CYCLE_LENGTH, ROLE_LABEL, createInitialState, cycleLengthRange, type OnboardingInput } from './initial'
import { setCoupleDates } from './logic/anniversary'
import { DUE_SETTINGS_SPREAD, upcomingWindows, type CycleWindow } from './logic/cycle'
import { ageFromBirthYear, doctorThresholdMonths, localNowISO, monthsBetween } from './logic/notifications'
import type { AlertStyle, AppState, ISODate, MemberId, Role } from './types'

// ── Onboarding ──────────────────────────────────────────────

/**
 * The onboarding stepper's range — the same 15–60 as the settings and a backup
 * (lib/initial.ts CYCLE_RANGE_DEFAULT, one source). With "45일 이상·들쭉날쭉"
 * (longCycles) the clamp in stateFromOnboarding goes up to 90.
 */
export const CYCLE_RANGE = { ...CYCLE_RANGE_DEFAULT, fallback: DEFAULT_CYCLE_LENGTH } as const
export const PERIOD_RANGE = { min: 2, max: 10, fallback: 5 } as const
export const BIRTH_YEAR_RANGE = { min: 1960, max: 2008 } as const
export const NAME_MAX = 12

/** Opposite role as the first guess for the partner (배우자 stays 배우자). */
export function suggestPartnerRole(role: Role): Role {
  if (role === 'wife') return 'husband'
  if (role === 'husband') return 'wife'
  return 'partner'
}

/** The member whose cycle is tracked by default: whoever is '아내', else me. */
export function defaultCycleOwner(myRole: Role, partnerRole: Role): MemberId {
  if (myRole === 'wife') return 'a'
  if (partnerRole === 'wife') return 'b'
  return 'a'
}

/** Cycle owner hears it plainly; the partner gets the softer "우리의 주간" framing. */
export function defaultAlertStyles(cycleOwner: MemberId): Record<MemberId, AlertStyle> {
  return { a: cycleOwner === 'a' ? 'explicit' : 'soft', b: cycleOwner === 'b' ? 'explicit' : 'soft' }
}

export function cleanName(name: string): string {
  return name.trim().slice(0, NAME_MAX)
}

/** Name as the app will show it (empty → role label, like createInitialState). */
export function displayName(name: string, role: Role): string {
  return cleanName(name) || ROLE_LABEL[role]
}

/** Newest first, for the birth-year select. */
export function birthYearOptions(): number[] {
  const out: number[] = []
  for (let y = BIRTH_YEAR_RANGE.max; y >= BIRTH_YEAR_RANGE.min; y--) out.push(y)
  return out
}

export function cleanBirthYear(year: number | undefined): number | undefined {
  if (year === undefined || !Number.isInteger(year)) return undefined
  return year >= BIRTH_YEAR_RANGE.min && year <= BIRTH_YEAR_RANGE.max ? year : undefined
}

function clampInt(n: number | undefined, min: number, max: number, fallback: number): number {
  if (n === undefined || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** A past-or-today ISO date, or undefined. */
export function pastDate(value: string | undefined, today: ISODate): ISODate | undefined {
  return isISODate(value) && value <= today ? value : undefined
}

/** Oldest 처음 만난 날 / 결혼한 날 the onboarding form accepts. */
export const COUPLE_DATE_MIN = '1950-01-01'

/** 처음 만난 날 / 결혼한 날: a real day from 1950 up to today, or undefined. */
export function coupleDate(value: string | undefined, today: ISODate): ISODate | undefined {
  const d = pastDate(value, today)
  return d && d >= COUPLE_DATE_MIN ? d : undefined
}

export interface OnboardingPrefs {
  alertStyle: Record<MemberId, AlertStyle>
  lowPressure: boolean
}

/** Optional 우리의 날 from the 우리 둘 step. */
export interface OnboardingCoupleDays {
  metDate?: ISODate
  marriedDate?: ISODate
}

export type OnboardingChoices = OnboardingInput & OnboardingPrefs & OnboardingCoupleDays

/** Apply the notification choices on top of createInitialState's defaults. */
export function applyPrefs(state: AppState, prefs: OnboardingPrefs): AppState {
  return {
    ...state,
    settings: {
      ...state.settings,
      alertStyle: { a: prefs.alertStyle.a, b: prefs.alertStyle.b },
      lowPressure: prefs.lowPressure,
    },
  }
}

/**
 * A local Date on `date` at the given clock time. Used to anchor timestamps to
 * the app's `today` (which may be pinned with ?today=) instead of the device clock.
 */
export function atLocal(date: ISODate, hours: number, minutes = 0, seconds = 0): Date {
  const { year, month, day } = parts(date)
  return new Date(year, month - 1, day, hours, minutes, seconds)
}

/** `today` with the clock time of `now`. */
export function anchorOn(today: ISODate, now: Date): Date {
  return atLocal(today, now.getHours(), now.getMinutes(), now.getSeconds())
}

/** Build the first state from the onboarding answers (sanitized). */
export function stateFromOnboarding(choices: OnboardingChoices, today: ISODate, now: Date, code?: string): AppState {
  const at = anchorOn(today, now)
  const base = createInitialState(
    {
      me: { name: cleanName(choices.me.name), role: choices.me.role, birthYear: cleanBirthYear(choices.me.birthYear) },
      partner: {
        name: cleanName(choices.partner.name),
        role: choices.partner.role,
        birthYear: cleanBirthYear(choices.partner.birthYear),
      },
      cycleOwner: choices.cycleOwner === 'b' ? 'b' : 'a',
      lastPeriodStart: pastDate(choices.lastPeriodStart, today),
      cycleLength: clampInt(
        choices.cycleLength,
        cycleLengthRange(choices.longCycles).min,
        cycleLengthRange(choices.longCycles).max,
        CYCLE_RANGE.fallback,
      ),
      periodLength: clampInt(choices.periodLength, PERIOD_RANGE.min, PERIOD_RANGE.max, PERIOD_RANGE.fallback),
      ...(choices.longCycles === true ? { longCycles: true } : {}),
      ttcStart: pastDate(choices.ttcStart, today) ?? today,
    },
    at,
  )
  // Local-date-prefixed like every other timestamp, so `createdAt.slice(0, 10)`
  // is the day the couple started (a UTC string reads as yesterday before 9am in Korea).
  let state: AppState = { ...applyPrefs(base, choices), createdAt: localNowISO(at) }
  const metDate = coupleDate(choices.metDate, today)
  const marriedDate = coupleDate(choices.marriedDate, today)
  if (metDate || marriedDate) state = setCoupleDates(state, { metDate: metDate ?? null, marriedDate: marriedDate ?? null })
  return code ? { ...state, couple: { ...state.couple, inviteCode: code } } : state
}

/** The next estimated fertile window for a preview, or null without a period date. */
export function sampleWindow(
  lastPeriodStart: ISODate | undefined,
  cycleLength: number,
  periodLength: number,
  today: ISODate,
): CycleWindow | null {
  const start = pastDate(lastPeriodStart, today)
  if (!start) return null
  const [w] = upcomingWindows(
    { periods: [{ start }], lhTests: [], cycle: { cycleLength, periodLength } },
    today,
    1,
  )
  return w ?? null
}

/** Oldest last-period date the form accepts (matches the date input's `min`). */
export const PERIOD_MAX_AGE_DAYS = 365
/** Oldest "started trying" date the form accepts (matches the date input's `min`). */
export const TTC_MAX_AGE_MONTHS = 120

/**
 * Gentle, non-blocking note under the last-period date: a start older than the
 * expected range (average ± DUE_SETTINGS_SPREAD — lib/logic/cycle.ts
 * expectedPeriod, settings basis) makes the app read the next period as already
 * late, which is usually just an older date picked by mistake. The note appears
 * exactly when the home would say 늦었어요.
 */
export function periodDateNote(lastPeriodStart: string, cycleLength: number, today: ISODate): string | null {
  const start = pastDate(lastPeriodStart, today)
  if (!start) return null
  const ago = diffDays(start, today)
  if (ago <= cycleLength + DUE_SETTINGS_SPREAD || ago > PERIOD_MAX_AGE_DAYS) return null
  return `${ago}일 전이라, 평균 주기(${cycleLength}일)보다 오래됐어요. 그 뒤에 생리가 있었다면 가장 최근 시작일로 넣어 주세요.`
}

export interface DoctorPlan {
  /** Age of the person whose cycle is tracked (by birth year), if known. */
  age?: number
  /** Months of trying before both partners are encouraged to get checked (0 = right away). */
  months: number
  /** Whole months since the couple started trying. */
  elapsed: number
  /** The app will suggest a check-up as soon as it starts. */
  due: boolean
}

/**
 * Same rule the notification engine uses (ASRM: 12 months under 35, 6 at 35+,
 * right away at 40+), so the onboarding copy never promises something else.
 */
export function doctorPlan(ownerBirthYear: number | undefined, ttcStart: ISODate, today: ISODate): DoctorPlan {
  const age = ageFromBirthYear(ownerBirthYear, today)
  const months = doctorThresholdMonths(age)
  const elapsed = Math.max(0, monthsBetween(ttcStart, today))
  return { age, months, elapsed, due: months === 0 || elapsed >= months }
}

// ── Onboarding draft (what the form holds while the user answers) ──
// (The step list itself lives in components/Onboarding.tsx.)

export interface OnboardingDraft {
  myName: string
  myRole?: Role
  myBirthYear?: number
  partnerName: string
  /** undefined → suggested from my role. */
  partnerRole?: Role
  partnerBirthYear?: number
  /** undefined → whoever is '아내', else me. */
  cycleOwner?: MemberId
  /** '' when not entered. */
  lastPeriodStart: string
  periodUnknown: boolean
  cycleLength: number
  periodLength: number
  /** "주기가 45일 이상이거나 들쭉날쭉해요" (N12) — widens the stepper to 90 days. */
  longCycles?: boolean
  ttcMode: 'now' | 'date'
  ttcDate: string
  /** Only the styles the user picked; the rest follow the cycle owner. */
  alertStyle: Partial<Record<MemberId, AlertStyle>>
  lowPressure: boolean
  consent: boolean
  /** 처음 만난 날 — '' when skipped. */
  metDate: string
  /** 결혼한 날 — '' when skipped. */
  marriedDate: string
}

export function initialDraft(): OnboardingDraft {
  return {
    myName: '',
    partnerName: '',
    lastPeriodStart: '',
    periodUnknown: false,
    cycleLength: CYCLE_RANGE.fallback,
    periodLength: PERIOD_RANGE.fallback,
    ttcMode: 'now',
    ttcDate: '',
    alertStyle: {},
    lowPressure: false,
    consent: false,
    metDate: '',
    marriedDate: '',
  }
}

export function draftRoles(d: OnboardingDraft): { a?: Role; b?: Role } {
  return { a: d.myRole, b: d.partnerRole ?? (d.myRole ? suggestPartnerRole(d.myRole) : undefined) }
}

export function draftOwner(d: OnboardingDraft): MemberId {
  if (d.cycleOwner) return d.cycleOwner
  const r = draftRoles(d)
  return r.a && r.b ? defaultCycleOwner(r.a, r.b) : 'a'
}

export function draftStyles(d: OnboardingDraft): Record<MemberId, AlertStyle> {
  return { ...defaultAlertStyles(draftOwner(d)), ...d.alertStyle }
}

/** Names as they will appear (role label for an empty name). */
export function draftNames(d: OnboardingDraft): Record<MemberId, string> {
  const r = draftRoles(d)
  return {
    a: r.a ? displayName(d.myName, r.a) : cleanName(d.myName) || '나',
    b: r.b ? displayName(d.partnerName, r.b) : cleanName(d.partnerName) || '상대',
  }
}

/** Why the step can't continue yet (null = ok). Steps are 1-based; 0 is the welcome. */
export function stepProblem(step: number, d: OnboardingDraft, today: ISODate): string | null {
  if (step === 1) {
    const r = draftRoles(d)
    if (!r.a) return '나의 역할을 골라 주세요.'
    if (!r.b) return '함께하는 사람의 역할을 골라 주세요.'
    const n = draftNames(d)
    if (n.a === n.b) return '두 사람 이름이 같아요. 구분할 수 있게 바꿔 주세요.'
    const bad = coupleDateProblem('처음 만난 날', d.metDate, today) ?? coupleDateProblem('결혼한 날', d.marriedDate, today)
    if (bad) return bad
  }
  if (step === 2 && !d.periodUnknown && d.lastPeriodStart) {
    const start = pastDate(d.lastPeriodStart, today)
    if (!start) return '오늘 이후 날짜는 넣을 수 없어요.'
    if (diffDays(start, today) > PERIOD_MAX_AGE_DAYS) {
      return '1년 안의 날짜로 넣어 주세요. 잘 모르면 ‘잘 모르겠어요’를 눌러도 돼요.'
    }
  }
  if (step === 3 && d.ttcMode === 'date') {
    const start = pastDate(d.ttcDate, today)
    if (!start) return d.ttcDate ? '오늘 이후 날짜는 고를 수 없어요.' : '준비를 시작한 날을 골라 주세요.'
    if (start < addMonths(today, -TTC_MAX_AGE_MONTHS)) return '10년 안의 날짜로 골라 주세요.'
  }
  if (step === 5 && !d.consent) return '내용을 확인하고 동의해 주세요.'
  return null
}

/** Why an entered 처음 만난 날 / 결혼한 날 can't be saved (empty is fine — both are optional). */
function coupleDateProblem(label: string, value: string, today: ISODate): string | null {
  if (!value || coupleDate(value, today)) return null
  if (isISODate(value) && value > today) return `${label}은 오늘까지의 날짜로 넣어 주세요.`
  return `${label}을 한 번 더 확인해 주세요.`
}

/** Gentle, non-blocking note when the wedding comes before the day they met. */
export function coupleDatesNote(d: Pick<OnboardingDraft, 'metDate' | 'marriedDate'>, today: ISODate): string | null {
  const met = coupleDate(d.metDate, today)
  const married = coupleDate(d.marriedDate, today)
  return met && married && married < met ? '결혼한 날이 처음 만난 날보다 앞서요. 맞는지 한 번 확인해 주세요.' : null
}

/** When the couple started trying, as it will be saved ('이번 달부터' = today). */
export function draftTtcStart(d: OnboardingDraft, today: ISODate): ISODate {
  return d.ttcMode === 'date' ? (pastDate(d.ttcDate, today) ?? today) : today
}

/** The tracked person's birth year (for the "when to see a doctor" guidance). */
export function draftOwnerBirthYear(d: OnboardingDraft): number | undefined {
  return cleanBirthYear(draftOwner(d) === 'a' ? d.myBirthYear : d.partnerBirthYear)
}

export function draftToChoices(d: OnboardingDraft, today: ISODate): OnboardingChoices | null {
  const r = draftRoles(d)
  if (!r.a || !r.b) return null
  return {
    me: { name: d.myName, role: r.a, birthYear: d.myBirthYear },
    partner: { name: d.partnerName, role: r.b, birthYear: d.partnerBirthYear },
    cycleOwner: draftOwner(d),
    lastPeriodStart: d.periodUnknown ? undefined : pastDate(d.lastPeriodStart, today),
    cycleLength: d.cycleLength,
    periodLength: d.periodLength,
    ...(d.longCycles === true ? { longCycles: true } : {}),
    ttcStart: draftTtcStart(d, today),
    alertStyle: draftStyles(d),
    lowPressure: d.lowPressure,
    metDate: coupleDate(d.metDate, today),
    marriedDate: coupleDate(d.marriedDate, today),
  }
}

/** 로 / 으로 for the last syllable of `word` (ㄹ and open syllables take 로). */
export function roParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (Number.isNaN(code) || code < 0 || code > 11171) return '(으)로'
  const jong = code % 28
  return jong === 0 || jong === 8 ? '로' : '으로'
}

/** '아내로' / '남편으로'. */
export function withRo(word: string): string {
  return `${word}${roParticle(word)}`
}
