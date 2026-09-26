// Onboarding helpers + "예시로 둘러보기" demo data (pure).
//
// The demo couple is 민수 (a, husband, 1992) & 지은 (b, wife, 1994, cycle owner).
// Every demo state is built with the same pure helpers the app itself uses, so
// the demo exercises real logic instead of hand-written JSON. Content is
// deterministic for a given (today, now); only ids and the invite code are random.

import { addDays, addMonths, diffDays, isISODate, parts, range } from './dates'
import { uid } from './id'
import { ROLE_LABEL, createInitialState, type OnboardingInput } from './initial'
import { DATE_IDEAS } from './content/dateIdeas'
import { addGrowth, setMilestone } from './logic/baby'
import { checkupKey, milestoneKey } from './logic/babyView'
import { activeItems, archiveCheckItem, isDone, itemsFor, toggleCheck } from './logic/checks'
import { addPeriod, setLHTest, upcomingWindows, type CycleWindow } from './logic/cycle'
import { addEntry } from './logic/diary'
import {
  ageFromBirthYear,
  doctorThresholdMonths,
  localNowISO,
  mergeNotices,
  monthsBetween,
  notifyCompleted,
  scheduledNotices,
  sendCheer,
  sendNudge,
} from './logic/notifications'
import { recordBirth, startPregnancy } from './logic/pregnancy'
import { prenatalKey } from './logic/pregnancyView'
import type { AlertStyle, AppState, DatePlan, ISODate, MemberId, Role, Stage } from './types'

// ── Onboarding ──────────────────────────────────────────────

export const CYCLE_RANGE = { min: 21, max: 45, fallback: 28 } as const
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

export interface OnboardingPrefs {
  alertStyle: Record<MemberId, AlertStyle>
  lowPressure: boolean
}

export type OnboardingChoices = OnboardingInput & OnboardingPrefs

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
      cycleLength: clampInt(choices.cycleLength, CYCLE_RANGE.min, CYCLE_RANGE.max, CYCLE_RANGE.fallback),
      periodLength: clampInt(choices.periodLength, PERIOD_RANGE.min, PERIOD_RANGE.max, PERIOD_RANGE.fallback),
      ttcStart: pastDate(choices.ttcStart, today) ?? today,
    },
    at,
  )
  // Local-date-prefixed like every other timestamp, so `createdAt.slice(0, 10)`
  // is the day the couple started (a UTC string reads as yesterday before 9am in Korea).
  const state = { ...applyPrefs(base, choices), createdAt: localNowISO(at) }
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
 * Gentle, non-blocking note under the last-period date: a start more than one
 * average cycle ago makes the app read the next period as already late (and
 * suggest a test), which is usually just an older date picked by mistake.
 */
export function periodDateNote(lastPeriodStart: string, cycleLength: number, today: ISODate): string | null {
  const start = pastDate(lastPeriodStart, today)
  if (!start) return null
  const ago = diffDays(start, today)
  if (ago <= cycleLength || ago > PERIOD_MAX_AGE_DAYS) return null
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

export const ONBOARDING_STEPS = 6

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
  ttcMode: 'now' | 'date'
  ttcDate: string
  /** Only the styles the user picked; the rest follow the cycle owner. */
  alertStyle: Partial<Record<MemberId, AlertStyle>>
  lowPressure: boolean
  consent: boolean
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
    ttcStart: draftTtcStart(d, today),
    alertStyle: draftStyles(d),
    lowPressure: d.lowPressure,
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

// ── Demo data ───────────────────────────────────────────────

const DEMO_ME = { name: '민수', role: 'husband', birthYear: 1992 } as const
const DEMO_PARTNER = { name: '지은', role: 'wife', birthYear: 1994 } as const

/** Local timestamp (local-date prefixed) at a fixed clock time on `date`. */
function stamp(date: ISODate, hours: number, minutes = 0): string {
  return localNowISO(atLocal(date, hours, minutes))
}

/** A moment earlier today: `minutesAgo` before now's clock time, never before 00:05. */
function earlierToday(today: ISODate, now: Date, minutesAgo: number): string {
  const mins = Math.max(5, now.getHours() * 60 + now.getMinutes() - minutesAgo)
  return stamp(today, Math.floor(mins / 60), mins % 60)
}

function demoBase(today: ISODate, now: Date, ttcStart: ISODate): AppState {
  const s = createInitialState(
    { me: DEMO_ME, partner: DEMO_PARTNER, cycleOwner: 'b', ttcStart, cycleLength: 28, periodLength: 5 },
    anchorOn(today, now),
  )
  return {
    ...s,
    // The space (and its items) has existed since the couple started, so past days count.
    createdAt: stamp(ttcStart, 21, 0),
    checkItems: s.checkItems.map((i) => ({ ...i, createdAt: ttcStart })),
    couple: { ...s.couple, linkedAt: stamp(ttcStart, 21, 10) },
  }
}

/** Log periods (start + end) from [start, days] pairs. */
function logPeriods(state: AppState, list: Array<[ISODate, number]>): AppState {
  let s = state
  for (const [start, days] of list) s = addPeriod(s, start, addDays(start, days - 1))
  return s
}

/**
 * Mark items done on `date`, by position in the list that counted that day
 * (itemsFor), so an item archived earlier is never ticked afterwards.
 */
function checkDay(state: AppState, member: MemberId, date: ISODate, indices: readonly number[]): AppState {
  let s = state
  const items = itemsFor(s, member, date)
  for (const i of indices) {
    const item = items[i]
    if (item && !isDone(s, member, date, item.id)) s = toggleCheck(s, member, date, item.id)
  }
  return s
}

/** Positions of every item that counted on `date` except those whose label contains a `skip` word. */
function allBut(state: AppState, member: MemberId, date: ISODate, skip: readonly string[]): number[] {
  return itemsFor(state, member, date)
    .map((item, i) => (skip.some((w) => item.label.includes(w)) ? -1 : i))
    .filter((i) => i >= 0)
}

const WALK = '걷기'
const VITAMIN_D = '비타민 D'

/**
 * Items skipped per day in the last 10 days ([민수, 지은], by label). The last
 * three days are complete for both → couple streak 3.
 */
const RECENT_SKIPS: Record<number, [string[], string[]]> = {
  10: [[WALK], [VITAMIN_D]],
  9: [[], [WALK]],
  8: [[WALK], []],
  7: [[WALK], [WALK]], // 회식 날 — 술 대신 사이다, 걷기는 못 함
  6: [[], [VITAMIN_D]],
  5: [[WALK], [VITAMIN_D]],
  4: [[WALK], []],
  3: [[], []],
  2: [[], []],
  1: [[], []],
}

/** Sparse older history: 엽산 for 지은, the two core habits for 민수, most days. */
function fillHistory(state: AppState, from: ISODate, to: ISODate): AppState {
  let s = state
  range(from, to).forEach((d, i) => {
    if (i % 9 !== 4) s = checkDay(s, 'b', d, i % 2 === 0 ? [0, 1] : [0])
    if (i % 11 !== 5) s = checkDay(s, 'a', d, [0, 1])
  })
  return s
}

/** The last 10 days (partial, streak ending yesterday) + today: 민수 half done, 지은 not started. */
function fillRecent(state: AppState, today: ISODate): AppState {
  let s = state
  for (let back = 10; back >= 1; back--) {
    const d = addDays(today, -back)
    const [skipA, skipB] = RECENT_SKIPS[back] ?? [[], []]
    s = checkDay(s, 'a', d, allBut(s, 'a', d, skipA))
    s = checkDay(s, 'b', d, allBut(s, 'b', d, skipB))
  }
  return checkDay(s, 'a', today, [0, 1])
}

/**
 * Once pregnant, the sperm-health habit (사우나 피하기) has done its job: archive
 * it so the pregnancy/parenting demos don't show it on 민수's list.
 */
function retirePreconceptionHabits(state: AppState, date: ISODate): AppState {
  const sauna = state.checkItems.find((i) => i.owner === 'a' && i.active && i.label.includes('사우나'))
  return sauna ? archiveCheckItem(state, sauna.id, date) : state
}

function diary(
  state: AppState,
  date: ISODate,
  author: MemberId,
  stage: Stage,
  text: string,
  mood?: string,
): AppState {
  return addEntry(state, { date, author, text, mood, stage }, stamp(date, 22, 10))
}

/** Add a date plan; `ideaId` is kept only if that idea exists in the catalogue. */
function plan(state: AppState, p: Omit<DatePlan, 'id'>): AppState {
  const { ideaId, ...rest } = p
  const known = ideaId && DATE_IDEAS.some((i) => i.id === ideaId) ? { ideaId } : {}
  const next: DatePlan = { id: uid(), ...known, ...rest }
  return { ...state, datePlans: [...state.datePlans, next].sort((x, y) => (x.date < y.date ? -1 : 1)) }
}

/**
 * Run the notification rules for each day in [from, today], as the app would
 * have if it had been opened daily.
 */
function runEngine(state: AppState, from: ISODate, today: ISODate, now: Date): AppState {
  let s = state
  for (const d of range(from, today)) {
    const at = d === today ? earlierToday(today, now, 150) : stamp(d, 8, 30)
    s = mergeNotices(s, scheduledNotices(s, d), at).state
  }
  return s
}

/**
 * Older things were already seen. Generated notices from the last 3 days and
 * anything from today stay unread so the bell shows what's new.
 */
function settleInbox(state: AppState, today: ISODate): AppState {
  const recent = addDays(today, -3)
  return {
    ...state,
    notifications: state.notifications.map((n) => {
      const day = n.createdAt.slice(0, 10)
      const generated = n.key !== undefined && !n.key.startsWith('complete:')
      const keepUnread = day === today || (generated && day >= recent)
      return keepUnread ? n : { ...n, read: true }
    }),
  }
}

/** 준비 기록 from the early months: the start day, plus (full) one 남산 date with its entry. */
function preparingHistory(state: AppState, ttcStart: ISODate, full: boolean): AppState {
  const dateDay = addDays(ttcStart, 26)
  let s = diary(
    state,
    ttcStart,
    'b',
    'preparing',
    '오늘부터 우리 둘이 함께 준비하기로 했어요. 엽산부터 시작! 서두르지 말고 재밌게 가 보자고 약속했어요.',
    '🥰',
  )
  if (!full) return s
  s = plan(s, {
    date: dateDay,
    ideaId: 'night-walk',
    title: '남산 야경 산책',
    place: '남산공원',
    note: '케이블카 말고 걸어서 올라가기',
    done: true,
    createdBy: 'a',
  })
  s = diary(
    s,
    dateDay,
    'a',
    'preparing',
    '남산까지 걸어 올라갔다가 다리가 후들후들. 그래도 야경 보면서 한참 이야기했어요. 준비하는 동안 이런 날을 더 자주 만들자고.',
    '😊',
  )
  return s
}

function demoPreparing(today: ISODate, now: Date): AppState {
  const ttcStart = addMonths(today, -4)
  let s = demoBase(today, now, ttcStart)

  // Cycles of 28 / 29 / 28 days → average 28. Last start = today − 11, so the
  // estimated ovulation is today + 3: today is inside the fertile window and the
  // peak (ovulation − 2 … ovulation) starts tomorrow.
  const last = addDays(today, -11)
  s = logPeriods(s, [
    [addDays(last, -85), 5],
    [addDays(last, -57), 5],
    [addDays(last, -28), 4],
    [last, 5],
  ])
  s = setLHTest(s, addDays(today, -2), 'negative')
  s = setLHTest(s, addDays(today, -1), 'negative')

  s = fillHistory(s, ttcStart, addDays(today, -11))
  s = fillRecent(s, today)

  s = preparingHistory(s, ttcStart, false)
  s = diary(
    s,
    addDays(today, -7),
    'a',
    'preparing',
    '회식에서 술 대신 사이다로 버텼어요. 걷기는 못 했지만 이 정도면 잘한 거죠? 😆',
    '😊',
  )
  s = plan(s, {
    date: addDays(today, -5),
    ideaId: 'brunch',
    title: '성수동 브런치 + 서울숲 산책',
    place: '서울숲',
    done: true,
    createdBy: 'b',
  })
  s = diary(
    s,
    addDays(today, -5),
    'b',
    'preparing',
    '서울숲 산책하고 브런치. 오랜만에 휴대폰 안 보고 둘이 수다만 떨었어요.',
    '😌',
  )
  s = diary(
    s,
    addDays(today, -1),
    'a',
    'preparing',
    '사흘 연속 우리 둘 다 체크 완료! 작은 거지만 같이 하니까 은근히 재밌어요.',
    '😊',
  )
  s = plan(s, {
    date: addDays(today, 2),
    ideaId: 'home-cooking',
    title: '집에서 파스타 만들어 먹기',
    place: '우리 집',
    note: '장보기는 같이, 요리는 민수 담당 🍝',
    done: false,
    createdBy: 'a',
  })

  s = runEngine(s, addDays(today, -10), today, now)
  const yesterday = addDays(today, -1)
  s = notifyCompleted(s, 'b', 'a', yesterday, stamp(yesterday, 20, 5))
  s = notifyCompleted(s, 'a', 'b', yesterday, stamp(yesterday, 21, 40))
  const walk = activeItems(s, 'a').find((i) => i.label.includes(WALK) && !isDone(s, 'a', today, i.id))?.label
  s = sendNudge(s, 'b', 'a', today, earlierToday(today, now, 95), walk)
  s = sendCheer(s, 'a', 'b', earlierToday(today, now, 40), '사흘 연속 우리 둘 다 완료! 오늘 저녁엔 같이 걸어요 🌙')
  return settleInbox(s, today)
}

function pregnancyHistory(state: AppState, lmp: ISODate): AppState {
  const confirmed = addDays(lmp, 35)
  let s = startPregnancy(state, lmp, confirmed)
  s = retirePreconceptionHabits(s, confirmed)
  s = setMilestone(s, prenatalKey('first-visit'), addDays(lmp, 50))
  s = setMilestone(s, prenatalKey('voucher'), addDays(lmp, 52))
  s = setMilestone(s, prenatalKey('health-center'), addDays(lmp, 55))
  s = diary(
    s,
    addDays(lmp, 35),
    'b',
    'pregnant',
    '두 줄! 떨리는 손으로 보여 줬더니 둘 다 한참 아무 말도 못 했어요. 우리한테 와 줘서 고마워.',
    '🥰',
  )
  s = diary(
    s,
    addDays(lmp, 50),
    'a',
    'pregnant',
    '처음으로 심장 소리를 들었어요. 생각보다 빠르고 씩씩한 소리. 태명은 콩이로 정했어요.',
    '🥰',
  )
  s = diary(
    s,
    addDays(lmp, 72),
    'b',
    'pregnant',
    '입덧 때문에 힘든 하루. 민수가 퇴근길에 귤이랑 크래커를 사 왔어요. 그것만 먹고 버텼어요.',
    '😴',
  )
  return s
}

function demoPregnant(today: ISODate, now: Date): AppState {
  // 12주 3일 today.
  const lmp = addDays(today, -(12 * 7 + 3))
  const ttcStart = addMonths(lmp, -3)
  let s = demoBase(today, now, ttcStart)
  s = logPeriods(s, [
    [addDays(lmp, -86), 5],
    [addDays(lmp, -57), 5],
    [addDays(lmp, -29), 4],
    [lmp, 5],
  ])
  s = preparingHistory(s, ttcStart, true)
  s = pregnancyHistory(s, lmp)
  s = fillHistory(s, ttcStart, addDays(today, -11))
  s = fillRecent(s, today)
  s = diary(
    s,
    addDays(today, -1),
    'a',
    'pregnant',
    '콩이야, 오늘은 아빠가 동화책 한 권 읽어 줬어. 곧 엄마랑 병원 가서 너 보러 갈게.',
    '😌',
  )
  s = plan(s, {
    date: addDays(today, 4),
    ideaId: 'exhibition',
    title: '주말 태교 나들이',
    place: '국립중앙박물관',
    note: '천천히 걷고, 중간중간 쉬어 가기',
    done: false,
    createdBy: 'a',
  })
  s = runEngine(s, addDays(today, -10), today, now) // from 11주 0일
  s = sendCheer(s, 'a', 'b', earlierToday(today, now, 40), '오늘 입덧은 좀 괜찮아요? 퇴근길에 귤 사 갈게요 🍊')
  return settleInbox(s, today)
}

function demoParenting(today: ISODate, now: Date): AppState {
  // Birth day counts as day 1 (Korean 백일 = birth + 99), so today is day 95
  // and 백일 is 5 days away.
  const birth = addDays(today, -94)
  const lmp = addDays(birth, -276) // born at 39주 3일
  const ttcStart = addMonths(lmp, -3)
  let s = demoBase(today, now, ttcStart)
  s = logPeriods(s, [
    [addDays(lmp, -85), 5],
    [addDays(lmp, -57), 5],
    [addDays(lmp, -28), 4],
    [lmp, 5],
  ])
  s = preparingHistory(s, ttcStart, true)
  s = pregnancyHistory(s, lmp)
  s = diary(
    s,
    addDays(birth, -10),
    'a',
    'pregnant',
    '출산 가방 최종 점검 완료. 콩이야, 언제든 나올 준비 됐어. 천천히 와도 괜찮아.',
    '😌',
  )

  s = recordBirth(s, { name: '콩이', birthDate: birth, sex: 'girl' })
  s = fillRecent(s, today)
  const months = (n: number) => addMonths(birth, n)
  s = addGrowth(s, { date: birth, weightKg: 3.2, heightCm: 50, headCm: 34 })
  s = addGrowth(s, { date: months(1), weightKg: 4.3, heightCm: 53.9, headCm: 36.8 })
  s = addGrowth(s, { date: months(2), weightKg: 5.3, heightCm: 57.4, headCm: 38.5 })
  s = addGrowth(s, { date: months(3), weightKg: 6.0, heightCm: 60.3, headCm: 39.8 })
  s = setMilestone(s, checkupKey('1'), addDays(birth, 28)) // 1차 영유아 건강검진 (생후 14~35일)
  s = setMilestone(s, milestoneKey('smile'), addDays(birth, 47))
  s = setMilestone(s, milestoneKey('head'), addDays(birth, 88))

  s = diary(
    s,
    birth,
    'a',
    'parenting',
    '콩이가 태어났어요. 3.2kg, 50cm. 지은이 정말 고생 많았어요. 우리 셋의 첫날.',
    '🥰',
  )
  s = diary(
    s,
    addDays(birth, 47),
    'b',
    'parenting',
    '눈 맞추고 처음으로 방긋 웃었어요! 민수는 출근해서 영상으로만 봤대요.',
    '😊',
  )
  s = diary(s, addDays(birth, 49), 'a', 'parenting', '50일 사진 찍는 날. 콩이는 내내 잠만 잤어요.', '😌')
  s = diary(
    s,
    addDays(today, -2),
    'b',
    'parenting',
    '새벽 수유를 민수가 바꿔 줘서 네 시간을 푹 잤어요. 고마워요.',
    '😴',
  )
  s = plan(s, {
    date: addDays(today, 5),
    title: '콩이 백일 — 셋이 가족사진',
    place: '우리 집',
    note: '백설기 주문하기',
    done: false,
    createdBy: 'b',
  })
  s = runEngine(s, addDays(birth, 40), today, now)
  s = sendCheer(s, 'a', 'b', earlierToday(today, now, 40), '어젯밤 수유 고생 많았어요. 오늘 밤은 내가 재울게요 🌙')
  return settleInbox(s, today)
}

/** A realistic couple space for "예시로 둘러보기". */
export function createDemoState(today: ISODate, now: Date, stage: Stage = 'preparing'): AppState {
  if (stage === 'pregnant') return demoPregnant(today, now)
  if (stage === 'parenting') return demoParenting(today, now)
  return demoPreparing(today, now)
}
