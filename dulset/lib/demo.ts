// "예시로 둘러보기" demo data (pure). The onboarding form's helpers live in
// lib/onboardingDraft.ts (re-exported below) so this file — and the example
// couple's data — loads only when a demo button is pressed.
//
// The demo couple is 민수 (a, husband, 1992) & 지은 (b, wife, 1994, cycle owner).
// They met on 2021-05-14 and married on 2024-10-19, so their story (우리 탭)
// starts well before the prep chapter. Every demo state is built with the same
// pure helpers the app itself uses, so the demo exercises real logic instead of
// hand-written JSON. Content is deterministic for a given (today, now); only ids
// and the invite code are random.
//
// It shows the preconception-first model: 지은 logs her own cycle (LH strips at
// 희미 → 양성 → 가장 진함 with times, negative home tests in a past 기다리는 주)
// and keeps the details to herself (shareCycleDetails: false), 민수 hears the
// soft "우리의 주간" wording, checks two daily habits and two once-a-week
// check-ins (금주 · 사우나 쉬기, the starter list's labels — N7), and every timer
// counts from a real first check. They applied for 임신 사전건강관리 at 보건소
// nine days ago, so 민수's 이번 달 할 일 is the next step of that chain: his
// 정액검사, due within 3 months of applying (partnerTrack.monthlyTask).

import { addDays, addMonths, formatShort, range, weekdayIndex } from './dates'
import { uid } from './id'
import { createInitialState } from './initial'
import { DATE_IDEAS } from './content/dateIdeas'
import { ROADMAP } from './content/roadmap'
import { addAnniversary, setCoupleDates } from './logic/anniversary'
import { addAppointment, setAppointmentDone, type AppointmentInput } from './logic/appointments'
import { addGrowth, setMilestone } from './logic/baby'
import { checkupKey, milestoneKey } from './logic/babyView'
import { activeItems, archiveCheckItem, isDone, isWeekly, itemsFor, mondayOf, toggleCheck, weeklyDone } from './logic/checks'
import { setCover } from './logic/cover'
import { addPeriod } from './logic/cycle'
import { addEntry } from './logic/diary'
import { addLHTest, addPregnancyTest } from './logic/logs'
import { setFeel, setPrivateNote } from './logic/personalLog'
import { localNowISO, mergeNotices, notifyCompleted, scheduledNotices, sendCheer, sendNudge } from './logic/notifications'
import { recordBirth, startPregnancy } from './logic/pregnancy'
import { prenatalKey } from './logic/pregnancyView'
import { addCustomTask, setTemplateDone } from './logic/roadmap'
import { sendSignal } from './logic/signals'
import { addLeaveDay, addTreatment } from './logic/treatments'
import { periodToldKey, tellPartnerPeriod } from './logic/ttcFlow'
import { setReaction } from './logic/usView'
import { decide, lhId, periodId } from './sync/model'
import type {
  AppState,
  CheckItem,
  DatePlan,
  ISODate,
  LHResult,
  MemberId,
  PersonalFeel,
  PregnancyTestResult,
  Stage,
  SyncMarks,
} from './types'

// The onboarding helpers moved to lib/onboardingDraft.ts; re-exported so
// `import … from '@/lib/demo'` keeps working while screens switch over.
import { anchorOn, atLocal } from './onboardingDraft'
export * from './onboardingDraft'

// ── Demo data ───────────────────────────────────────────────

const DEMO_ME = { name: '민수', role: 'husband', birthYear: 1992 } as const
const DEMO_PARTNER = { name: '지은', role: 'wife', birthYear: 1994 } as const

/**
 * Whose screen "예시로 둘러보기" opens on: 지은's, the person whose cycle the app
 * follows — she is the one who logs, so her screen shows the app at its fullest.
 * (Onboarding sets the viewer to this and starts at the top.)
 */
export const DEMO_START_VIEWER: MemberId = 'b'

type DemoItem = Pick<CheckItem, 'label' | 'kind'> & Partial<Pick<CheckItem, 'note' | 'cadence'>>

/**
 * The demo's check items. 지은: 엽산 first (the one supplement with strong
 * evidence), 비타민 D, and two habits. 민수 doesn't smoke, so there's no 금연
 * item: two daily habits, and the "keep not doing it" ones (금주 · 사우나) as a
 * once-a-week check-in instead of a daily tap, labelled the way the onboarding
 * starter list names them (initial.defaultCheckItems with habits — N7).
 */
const DEMO_ITEMS: Record<MemberId, readonly DemoItem[]> = {
  a: [
    { label: '30분 걷기·운동', kind: 'habit' },
    { label: '7시간 이상 자기', kind: 'habit' },
    { label: '사우나·뜨거운 탕 쉬기', kind: 'habit', note: '고환 온도 · 주 1회 체크인', cadence: 'weekly' },
    { label: '금주', kind: 'habit', note: '주 1회 체크인', cadence: 'weekly' },
  ],
  b: [
    { label: '엽산', kind: 'supplement', note: '400µg' },
    { label: '비타민 D', kind: 'supplement', note: '선택' },
    { label: '술 안 마시기', kind: 'habit' },
    { label: '30분 걷기·운동', kind: 'habit' },
  ],
}

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
  // The space (and its items) has existed since the couple started, so past days count.
  const checkItems: CheckItem[] = (['a', 'b'] as const).flatMap((owner) =>
    DEMO_ITEMS[owner].map((item) => ({
      id: uid(),
      owner,
      label: item.label,
      kind: item.kind,
      ...(item.note ? { note: item.note } : {}),
      active: true,
      createdAt: ttcStart,
      ...(item.cadence === 'weekly' ? { cadence: 'weekly' as const } : {}),
    })),
  )
  return {
    ...s,
    createdAt: stamp(ttcStart, 21, 0),
    checkItems,
    couple: { ...s.couple, linkedAt: stamp(ttcStart, 21, 10) },
    settings: {
      ...s.settings,
      // 지은 keeps her period days, LH and test results to herself; 민수 sees the
      // shared 우리의 주간 and gentle status only (privacy by default).
      shareCycleDetails: false,
      // Each person's own choices: 민수 hides health words on his lock screen.
      // 민수 hides health words on the lock screen, but his home card is readable on first tap in the demo.
      personal: { a: { lowPressure: false, discreet: true, homeDiscreet: false }, b: { lowPressure: false, discreet: false } },
      // 지은 uses LH strips (she logs them below), so the app never asks her.
      usesLH: true,
    },
  }
}

/** Log periods (start + end) from [start, days] pairs — 지은 logs her own. */
function logPeriods(state: AppState, list: Array<[ISODate, number]>): AppState {
  let s = state
  for (const [start, days] of list) s = addPeriod(s, start, addDays(start, days - 1), 'b')
  return s
}

/** 지은's LH strips as she logged them: [date, 'HH:MM', result] (up to two a day). */
function logLH(state: AppState, list: ReadonlyArray<readonly [ISODate, string, LHResult]>): AppState {
  let s = state
  for (const [date, time, result] of list) s = addLHTest(s, { date, time, result, by: 'b' })
  return s
}

/** 지은's home pregnancy tests: [date, 'HH:MM', result]. */
function logPregnancyTests(state: AppState, list: ReadonlyArray<readonly [ISODate, string, PregnancyTestResult]>): AppState {
  let s = state
  for (const [date, time, result] of list) s = addPregnancyTest(s, { date, time, result, by: 'b' }).state
  return s
}

/** 지은's own feel chips (본인만 보기 — 민수 never sees them): [date, feel]. */
function logFeels(state: AppState, list: ReadonlyArray<readonly [ISODate, PersonalFeel]>): AppState {
  let s = state
  for (const [date, feel] of list) s = setFeel(s, 'b', date, feel)
  return s
}

/** Days after `prev`'s start of 지은's feel chips in last cycle's 기다리는 주 (ovulation was day 13). */
export const DEMO_FEEL_DAYS: ReadonlyArray<readonly [dayOffset: number, feel: PersonalFeel]> = [
  [18, 'normal'],
  [20, 'tired'],
  [22, 'breast'],
  [24, 'sensitive'],
  [26, 'spotting'],
  [27, 'cramps'],
] as const

/**
 * Tick the daily items that counted on `date` (itemsFor, so an item archived
 * earlier is never ticked afterwards): those whose label contains an `only`
 * word (every one when omitted), minus those containing a `skip` word.
 */
function checkDaily(
  state: AppState,
  member: MemberId,
  date: ISODate,
  opts: { only?: readonly string[]; skip?: readonly string[] } = {},
): AppState {
  let s = state
  for (const item of itemsFor(s, member, date)) {
    if (isWeekly(item)) continue
    if (opts.only && !opts.only.some((w) => item.label.includes(w))) continue
    if (opts.skip?.some((w) => item.label.includes(w))) continue
    if (!isDone(s, member, date, item.id)) s = toggleCheck(s, member, date, item.id)
  }
  return s
}

/**
 * The once-a-week check-ins: tick each weekly item that counted on `date`,
 * unless it was already ticked earlier in the same Mon–Sun week (checks.weeklyDone,
 * the rule the home's weekly row uses).
 */
function checkWeekly(state: AppState, member: MemberId, date: ISODate): AppState {
  let s = state
  for (const item of itemsFor(s, member, date).filter(isWeekly)) {
    if (!weeklyDone(s, member, item.id, date)) s = toggleCheck(s, member, date, item.id)
  }
  return s
}

/** Weekly check-ins happen on Sunday evenings — and on the day they started. */
const isCheckInDay = (date: ISODate, first: boolean) => first || weekdayIndex(date) === 0

const WALK = '걷기'
const SLEEP = '7시간'
const FOLIC = '엽산'
const VITAMIN_D = '비타민 D'

/**
 * Daily items skipped per day in the last 10 days ([민수, 지은], by label). The
 * last three days are complete for both → couple streak 3. (Weekly check-ins
 * never decide whether a day is complete.)
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

/**
 * Sparse older history from the day they started (`from` = ttcStart, when every
 * item was first checked — so "엽산 D+N" and the habit timer count from a real
 * first check): 엽산 most days and 비타민 D every other day for 지은; 잠 most
 * days and 걷기 two days in three for 민수, plus his Sunday check-ins.
 */
function fillHistory(state: AppState, from: ISODate, to: ISODate): AppState {
  let s = state
  range(from, to).forEach((d, i) => {
    if (i % 9 !== 4) s = checkDaily(s, 'b', d, { only: i % 2 === 0 ? [FOLIC, VITAMIN_D] : [FOLIC] })
    const onlyA = [...(i % 11 !== 5 ? [SLEEP] : []), ...(i % 3 !== 2 ? [WALK] : [])]
    if (onlyA.length) s = checkDaily(s, 'a', d, { only: onlyA })
    if (isCheckInDay(d, i === 0)) s = checkWeekly(s, 'a', d)
  })
  return s
}

/**
 * The last 10 days (partial, streak ending yesterday) + today: 민수 slept well
 * but hasn't walked yet, 지은 not started. This week's check-ins are still open.
 */
function fillRecent(state: AppState, today: ISODate): AppState {
  let s = state
  for (let back = 10; back >= 1; back--) {
    const d = addDays(today, -back)
    const [skipA, skipB] = RECENT_SKIPS[back] ?? [[], []]
    s = checkDaily(s, 'a', d, { skip: skipA })
    s = checkDaily(s, 'b', d, { skip: skipB })
    // Sundays before this week only: this week's check-in is what 민수 sees today.
    if (isCheckInDay(d, false) && d < mondayOf(today)) s = checkWeekly(s, 'a', d)
  }
  return checkDaily(s, 'a', today, { only: [SLEEP] })
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
  photoId?: DemoPhotoId,
): AppState {
  return addEntry(state, { date, author, text, mood, stage, ...(photoId ? { photoId } : {}) }, stamp(date, 22, 10))
}

/**
 * The demo's pictures are built-in drawings (lib/content/demoPhotos.ts), so
 * the album and the cover work without IndexedDB. Diary photos go on
 * preparing-stage entries only — never on a pregnancy entry.
 */
type DemoPhotoId = 'builtin:cafe' | 'builtin:sea' | 'builtin:window'

/** Days before `today` of the 한강 walk on the demo cover, and when 지은 hung it. */
export const DEMO_COVER = { walkDaysAgo: 9, setDaysAgo: 30, focusY: 68 } as const

/** Add a date plan; `ideaId` is kept only if that idea exists in the catalogue. */
function plan(state: AppState, p: Omit<DatePlan, 'id'>): AppState {
  const { ideaId, ...rest } = p
  const known = ideaId && DATE_IDEAS.some((i) => i.id === ideaId) ? { ideaId } : {}
  const next: DatePlan = { id: uid(), ...known, ...rest }
  return { ...state, datePlans: [...state.datePlans, next].sort((x, y) => (x.date < y.date ? -1 : 1)) }
}

// ── 우리 둘 · 챙길 것 (demo) ────────────────────────────────

/** The demo couple's days before prep. */
export const DEMO_COUPLE_DAYS = {
  met: '2021-05-14',
  firstTrip: '2021-10-03',
  proposal: '2024-03-09',
  married: '2024-10-19',
} as const

export type DemoCoupleDays = Record<keyof typeof DEMO_COUPLE_DAYS, ISODate>

/**
 * The preparing demo's appointments: the 보건소 application they already went
 * to together (9 days ago, done), then three ahead in date order. No fertility
 * words in the titles — 민수 (soft wording) sees them on his home too.
 */
export const PREP_APPOINTMENTS = {
  healthCenter: '보건소 임신 사전건강관리 신청',
  carrierCheck: '산부인과 임신 전 검사',
  dentist: '치과 검진·스케일링',
  semen: '정액검사',
} as const

/** Days before `today` that the preparing couple applied at 보건소 (임신 사전건강관리). */
export const PREP_APPLIED_DAYS_AGO = 9

/**
 * The preparing demo's one clinic attempt (Next B 난임 시술 지원 카운터): an
 * 인공수정 in the cycle before last, the day after that cycle's 가장 진함 strip,
 * with 보건소 지원 (인공수정 1/5) and a 지원결정통지서 valid to `noticeExpires`.
 * The period came, so the outcome was 음성. 민수 took one 난임치료휴가 day to go
 * with her (휴가 1/6). `cycleOffset` is days after that cycle's period start.
 */
export const DEMO_TREATMENT = { cycleOffset: 15, noticeExpires: '2027-01-15', note: '첫 회차 · 보건소 지원' } as const

/**
 * DEMO_COUPLE_DAYS, moved back whole years (every anniversary keeps its
 * calendar day) when a pinned ?today= would put the wedding on or after the
 * day prep began — the 우리 둘 chapter always comes first.
 */
export function demoCoupleDays(prepStart: ISODate): DemoCoupleDays {
  let years = 0
  while (addMonths(DEMO_COUPLE_DAYS.married, -12 * years) >= prepStart) years++
  const back = (d: ISODate) => addMonths(d, -12 * years)
  return {
    met: back(DEMO_COUPLE_DAYS.met),
    firstTrip: back(DEMO_COUPLE_DAYS.firstTrip),
    proposal: back(DEMO_COUPLE_DAYS.proposal),
    married: back(DEMO_COUPLE_DAYS.married),
  }
}

const other = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a')

/** The partner's small reaction on the entry just added (Between-style, no thread). */
function reactLast(state: AppState, emoji: string): AppState {
  const e = state.diary[state.diary.length - 1]
  return e ? setReaction(state, e.id, other(e.author), emoji) : state
}

/**
 * 우리 둘: when they met and married, their own days, and three memories from
 * before prep — written the evening they started 둘셋, dated to the day itself.
 */
function ourStory(state: AppState, prepStart: ISODate): AppState {
  const d = demoCoupleDays(prepStart)
  let s = setCoupleDates(state, { metDate: d.met, marriedDate: d.married })
  s = addAnniversary(s, { title: '첫 여행', date: d.firstTrip, yearly: true, emoji: '✈️' })
  s = addAnniversary(s, { title: '프러포즈', date: d.proposal, yearly: true, emoji: '💍' })
  const memory = (date: ISODate, author: MemberId, text: string, minute: number, photoId?: DemoPhotoId) =>
    addEntry(s, { date, author, text, mood: '🥰', stage: 'preparing', ...(photoId ? { photoId } : {}) }, stamp(prepStart, 21, minute))
  s = memory(
    d.firstTrip,
    'b',
    '첫 여행으로 강릉에 갔어요. 비 오는 바다 앞에서 우산 하나로 한참 걸었어요. 이 사람이랑 오래 함께하고 싶다고 생각한 날.',
    20,
    'builtin:sea',
  )
  s = reactLast(s, '❤️')
  s = memory(d.proposal, 'a', '한강에서 프러포즈했어요. 준비한 말은 반도 못 했는데 지은이가 먼저 웃으면서 울었어요. 대답은 “응, 좋아”.', 30)
  s = reactLast(s, '🥹')
  s = memory(d.married, 'b', '우리 결혼했어요! 정신없이 지나갔지만 입장할 때 민수 표정은 오래 기억날 것 같아요. 앞으로도 잘 부탁해요.', 40)
  return reactLast(s, '❤️')
}

const TEMPLATES = new Map(ROADMAP.map((t) => [t.id, t]))

/** Tick 챙길 것 templates the way the app does (planDone, or the milestone shared with 임신·아기 tabs). */
function tick(state: AppState, list: ReadonlyArray<readonly [id: string, date: ISODate, by: MemberId]>): AppState {
  let s = state
  for (const [id, date, by] of list) {
    const t = TEMPLATES.get(id)
    if (t) s = setTemplateDone(s, t, true, date, by)
  }
  return s
}

/** Add an appointment (optionally already done). */
function appointment(state: AppState, input: AppointmentInput, by: MemberId, done = false): AppState {
  const s = addAppointment(state, input, by)
  const added = s.appointments[s.appointments.length - 1]
  return done && added && s !== state ? setAppointmentDone(s, added.id, true) : s
}

/** Preconception items they had looked after before the pregnancy (pregnant / parenting demos). */
function preparedTicks(state: AppState, ttcStart: ISODate): AppState {
  return tick(state, [
    ['pre-folic', ttcStart, 'b'],
    ['pre-habits-partner', ttcStart, 'a'],
    ['pre-health-check-support', addDays(ttcStart, 10), 'b'],
    ['pre-checkup-carrier', addDays(ttcStart, 20), 'b'],
    ['pre-checkup-partner', addDays(ttcStart, 20), 'a'],
    ['pre-dental', addDays(ttcStart, 30), 'b'],
  ])
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
    'builtin:window',
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
  const prev = addDays(last, -28) // the cycle before this one (28 days)
  const before = addDays(last, -57) // and the one before that (29 days)
  s = logPeriods(s, [
    [addDays(last, -85), 5],
    [before, 5],
    [prev, 4],
    [last, 5],
  ])
  // LH strips since the second cycle, morning and sometimes evening. Earlier
  // cycles rose 희미 → 양성 → 가장 진함 (the first surge pins that cycle's
  // ovulation: day 15 of 29, day 14 of 28). This cycle is still rising — no
  // surge yet, so today stays a calendar estimate and the home asks for today's strip.
  s = logLH(s, [
    [addDays(before, 11), '08:40', 'negative'],
    [addDays(before, 12), '08:30', 'faint'],
    [addDays(before, 13), '20:40', 'positive'],
    [addDays(before, 14), '08:30', 'peak'],
    [addDays(before, 15), '08:50', 'negative'],
    [addDays(prev, 10), '08:30', 'negative'],
    [addDays(prev, 11), '08:30', 'faint'],
    [addDays(prev, 12), '08:20', 'positive'],
    [addDays(prev, 12), '21:00', 'peak'],
    [addDays(prev, 13), '08:30', 'faint'],
    [addDays(today, -2), '08:30', 'negative'],
    [addDays(today, -1), '08:40', 'faint'],
    [addDays(today, -1), '20:50', 'faint'],
  ])
  // Last cycle's 기다리는 주: an early test 11 days after ovulation, one more the
  // day before the expected period — both negative, then the period came.
  s = logPregnancyTests(s, [
    [addDays(prev, 24), '06:50', 'negative'],
    [addDays(prev, 27), '06:40', 'negative'],
  ])
  // Her own log from that 기다리는 주 (본인만 보기): a few feel chips, one
  // 살짝 비침 two days before the period, and a private line the day of the
  // early test. These never reach 민수's screen (lib/logic/personalLog.ts).
  s = logFeels(
    s,
    DEMO_FEEL_DAYS.map(([offset, feel]) => [addDays(prev, offset), feel] as const),
  )
  s = setPrivateNote(s, 'b', addDays(prev, 24), '테스트는 음성. 아직 이를 수 있으니 며칠만 더 기다려 보기로 했어요.')
  // 난임 시술 지원 카운터 (Next B): one 인공수정 in the `before` cycle, right
  // after its surge, with the 보건소 지원 and a 통지서; it ended with the next
  // period (prev) — 음성. 민수's one 난임치료휴가 day is the day he went with her.
  const iuiDay = addDays(before, DEMO_TREATMENT.cycleOffset)
  s = addTreatment(s, {
    kind: 'iui',
    startDate: iuiDay,
    endDate: prev,
    outcome: 'negative',
    supported: true,
    noticeExpires: DEMO_TREATMENT.noticeExpires,
    note: DEMO_TREATMENT.note,
  })
  s = addLeaveDay(s, 'a', iuiDay)

  s = fillHistory(s, ttcStart, addDays(today, -11))
  s = fillRecent(s, today)

  s = preparingHistory(s, ttcStart, false)
  s = diary(s, addDays(today, -7), 'a', 'preparing', '회식에서 술 대신 사이다로 버텼어요. 걷기는 못 했지만 이 정도면 잘한 거죠? 😆', '😊')
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
    'builtin:cafe',
  )
  s = diary(
    s,
    addDays(today, -1),
    'a',
    'preparing',
    '이번 주는 둘 다 체크한 날이 벌써 사흘이에요. 작은 거지만 같이 하니까 은근히 재밌어요.',
    '😊',
  )
  s = reactLast(s, '👏')
  s = plan(s, {
    date: addDays(today, 2),
    ideaId: 'home-cooking',
    title: '집에서 파스타 만들어 먹기',
    place: '우리 집',
    note: '장보기는 같이, 요리는 민수 담당 🍝',
    done: false,
    createdBy: 'a',
  })

  // 우리 둘 + 챙길 것: a few items done, three appointments ahead, one of their own.
  s = ourStory(s, ttcStart)
  // 임신 사전건강관리: apply at 보건소 (or e보건소) first — tests done before
  // applying aren't covered — then take the referral to a clinic for the test
  // within 3 months. They applied together 9 days ago, so the chain is at 검사.
  const applied = addDays(today, -PREP_APPLIED_DAYS_AGO)
  s = tick(s, [
    ['pre-folic', ttcStart, 'b'],
    ['pre-habits-partner', ttcStart, 'a'],
    // 풍진 항체 was checked before they started trying (MMR needs 4 weeks before
    // trying), so the tick is dated to the day they started, not mid-way.
    ['pre-rubella', ttcStart, 'b'],
    ['pre-health-check-support', applied, 'b'],
  ])
  s = appointment(
    s,
    {
      date: applied,
      time: '09:30',
      title: PREP_APPOINTMENTS.healthCenter,
      place: '보건소',
      who: 'both',
      kind: 'admin',
      note: '검사 전에 먼저 신청해야 지원돼요. 검사의뢰서 받아 오기',
      taskId: 'pre-health-check-support',
    },
    'b',
    true,
  )
  s = appointment(
    s,
    {
      date: addDays(today, 5),
      time: '10:00',
      title: PREP_APPOINTMENTS.carrierCheck,
      place: '산부인과',
      who: 'b',
      kind: 'test',
      note: '보건소 검사의뢰서 챙기기 · 혈액·소변 검사',
      taskId: 'pre-checkup-carrier',
    },
    'b',
  )
  s = appointment(
    s,
    {
      date: addDays(today, 8),
      time: '19:00',
      title: PREP_APPOINTMENTS.dentist,
      place: '동네 치과',
      who: 'b',
      kind: 'hospital',
      taskId: 'pre-dental',
    },
    'b',
  )
  s = appointment(
    s,
    {
      date: addDays(today, 12),
      time: '08:30',
      title: PREP_APPOINTMENTS.semen,
      place: '비뇨의학과',
      who: 'a',
      kind: 'test',
      note: '보건소 검사의뢰서 챙기기 · 결과지 받아 오기',
      taskId: 'pre-checkup-partner',
    },
    'a',
  )
  s = addCustomTask(s, { title: '검사 결과지 한곳에 모아 두기', phase: 'preconception', who: 'both', due: addDays(today, 14) }, 'b')

  // On day 1 of this cycle 지은 told 민수 (the calm notice is long read by now):
  // the answer lives in `decisions` (lib/sync/model.ts), the notice in his inbox.
  s = decide(tellPartnerPeriod(s, last, stamp(last, 8, 10)), periodToldKey(last), last)

  s = runEngine(s, addDays(today, -10), today, now)
  const yesterday = addDays(today, -1)
  s = notifyCompleted(s, 'b', 'a', yesterday, stamp(yesterday, 20, 5))
  s = notifyCompleted(s, 'a', 'b', yesterday, stamp(yesterday, 21, 40))
  const walk = activeItems(s, 'a').find((i) => i.label.includes(WALK) && !isDone(s, 'a', today, i.id))?.label
  s = sendNudge(s, 'b', 'a', today, earlierToday(today, now, 95), walk)
  s = sendCheer(s, 'a', 'b', earlierToday(today, now, 40), '이번 주 벌써 사흘째 둘 다 체크했어요! 오늘 저녁엔 같이 걸어요 🌙')
  // …and a moment ago a "🙏 오늘 고마웠어요" signal that 지은 hasn't answered yet:
  // her cover line says "민수님이 신호를 보냈어요" and 우리 한 줄 holds the reply chips.
  s = sendSignal(s, 'a', 'b', 'thanks', today, earlierToday(today, now, 20))
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
  s = reactLast(s, '🥹')
  s = diary(
    s,
    addDays(lmp, 72),
    'b',
    'pregnant',
    '입덧 때문에 힘든 하루. 민수가 퇴근길에 귤이랑 크래커를 사 왔어요. 그것만 먹고 버텼어요.',
    '😴',
  )
  s = appointment(
    s,
    {
      date: addDays(lmp, 50),
      time: '10:00',
      title: '첫 산부인과 진료',
      place: '다니는 산부인과',
      who: 'both',
      kind: 'hospital',
      taskId: 'p1-first-visit',
    },
    'b',
    true,
  )
  return tick(s, [
    ['p1-work-hours', addDays(lmp, 45), 'b'],
    ['p1-prenatal-labs', addDays(lmp, 50), 'b'],
    ['p1-care-center', addDays(lmp, 70), 'a'],
  ])
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
  s = diary(s, addDays(today, -1), 'a', 'pregnant', '콩이야, 오늘은 아빠가 동화책 한 권 읽어 줬어. 곧 엄마랑 병원 가서 너 보러 갈게.', '😌')
  s = plan(s, {
    date: addDays(today, 4),
    ideaId: 'exhibition',
    title: '주말 태교 나들이',
    place: '국립중앙박물관',
    note: '천천히 걷고, 중간중간 쉬어 가기',
    done: false,
    createdBy: 'a',
  })

  s = ourStory(s, ttcStart)
  s = preparedTicks(s, ttcStart)
  // 12주 5일: NT is open until 13주 6일. 정밀초음파 at 21주 (20~24주).
  s = appointment(
    s,
    {
      date: addDays(lmp, 12 * 7 + 5),
      time: '10:00',
      title: '정기검진 · NT 초음파',
      place: '다니는 산부인과',
      who: 'both',
      kind: 'test',
      note: '1차 기형아 선별검사 채혈도 같이 해요',
      taskId: 'p1-nt',
    },
    'b',
  )
  s = appointment(
    s,
    {
      date: addDays(today, 5),
      time: '14:00',
      title: '산후조리원 상담',
      place: '투어했던 조리원',
      who: 'both',
      kind: 'other',
      note: '환불 기준 꼭 물어보기',
      taskId: 'p1-care-center-contract',
    },
    'a',
  )
  s = appointment(
    s,
    {
      date: addDays(lmp, 21 * 7),
      time: '11:00',
      title: '정밀초음파',
      place: '다니는 산부인과',
      who: 'both',
      kind: 'test',
      taskId: 'p2-anatomy',
    },
    'b',
  )
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
  s = diary(s, addDays(birth, -10), 'a', 'pregnant', '출산 가방 최종 점검 완료. 콩이야, 언제든 나올 준비 됐어. 천천히 와도 괜찮아.', '😌')

  s = ourStory(s, ttcStart)
  s = preparedTicks(s, ttcStart)
  const edd = addDays(lmp, 280)
  s = tick(s, [
    ['p1-birth-hospital', addDays(lmp, 80), 'a'],
    ['p1-nt', addDays(lmp, 89), 'b'],
    ['p1-care-center-contract', addDays(lmp, 92), 'a'],
    ['p2-quad', addDays(lmp, 112), 'b'],
    ['p2-anatomy', addDays(lmp, 147), 'b'],
    ['p2-gdm', addDays(lmp, 175), 'b'],
    ['p3-tdap', addDays(lmp, 200), 'b'],
    ['p3-partner-tdap', addDays(edd, -45), 'a'],
    ['p3-parental-leave', addDays(edd, -60), 'a'],
    ['p3-car-seat', addDays(lmp, 230), 'a'],
    ['p3-hospital-bag', addDays(lmp, 240), 'b'],
    ['p3-maternity-leave', addDays(edd, -40), 'b'],
    ['p3-postnatal-care', addDays(edd, -30), 'b'],
    ['p3-gbs', addDays(lmp, 252), 'b'],
  ])

  s = recordBirth(s, { name: '콩이', birthDate: birth, sex: 'girl' })
  s = fillRecent(s, today)
  const months = (n: number) => addMonths(birth, n)
  s = addGrowth(s, { date: birth, weightKg: 3.2, heightCm: 50, headCm: 34 })
  s = addGrowth(s, { date: months(1), weightKg: 4.3, heightCm: 53.9, headCm: 36.8 })
  s = addGrowth(s, { date: months(2), weightKg: 5.3, heightCm: 57.4, headCm: 38.5 })
  s = addGrowth(s, { date: months(3), weightKg: 6.0, heightCm: 60.3, headCm: 39.8 })
  s = setMilestone(s, checkupKey('1'), addDays(birth, 28)) // 1차 영유아 건강검진 (생후 14~35일)
  s = tick(s, [
    ['birth-partner-leave', birth, 'a'],
    ['birth-hepb', birth, 'b'],
    ['birth-hearing', addDays(birth, 2), 'b'],
    ['birth-metabolic', addDays(birth, 3), 'b'],
    ['birth-registration', addDays(birth, 7), 'a'],
    ['birth-happy-birth', addDays(birth, 7), 'a'],
    ['birth-insurance', addDays(birth, 10), 'a'],
    ['pp-vaccine-alerts', addDays(birth, 10), 'b'],
    ['birth-bcg', addDays(birth, 20), 'a'],
    ['pp-mother-checkup', addDays(birth, 35), 'b'],
  ])
  // Past: 2개월 접종 (done). Ahead: 민수's leave request, then the 4개월 visits.
  s = appointment(
    s,
    { date: months(2), time: '10:30', title: '2개월 예방접종', place: '동네 소아청소년과', who: 'both', kind: 'vaccine' },
    'b',
    true,
  )
  s = appointment(
    s,
    {
      date: addDays(today, 4),
      time: '14:00',
      title: '회사 면담 · 육아휴직 신청',
      place: '회사',
      who: 'a',
      kind: 'admin',
      note: '휴직 시작 30일 전까지 신청해요',
      taskId: 'pp-six-plus-six',
    },
    'a',
  )
  s = appointment(
    s,
    {
      date: months(4),
      time: '10:30',
      title: '4개월 예방접종',
      place: '동네 소아청소년과',
      who: 'both',
      kind: 'vaccine',
      note: '접종 종류는 예방접종도우미에서 확인',
    },
    'b',
  )
  s = appointment(
    s,
    {
      date: addDays(months(4), 10),
      time: '11:00',
      title: '영유아 건강검진 2차',
      place: '동네 소아청소년과',
      who: 'both',
      kind: 'hospital',
      note: '생후 4~6개월에 받아요',
    },
    'b',
  )
  s = setMilestone(s, milestoneKey('smile'), addDays(birth, 47))
  s = setMilestone(s, milestoneKey('head'), addDays(birth, 88))

  s = diary(s, birth, 'a', 'parenting', '콩이가 태어났어요. 3.2kg, 50cm. 지은이 정말 고생 많았어요. 우리 셋의 첫날.', '🥰')
  s = diary(s, addDays(birth, 47), 'b', 'parenting', '눈 맞추고 처음으로 방긋 웃었어요! 민수는 출근해서 영상으로만 봤대요.', '😊')
  s = diary(s, addDays(birth, 49), 'a', 'parenting', '50일 사진 찍는 날. 콩이는 내내 잠만 잤어요.', '😌')
  s = diary(s, addDays(today, -2), 'b', 'parenting', '새벽 수유를 민수가 바꿔 줘서 네 시간을 푹 잤어요. 고마워요.', '😴')
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

/**
 * 지은 hung their 한강 evening walk as the cover (a built-in drawing, so it
 * shows without IndexedDB) — the same in every stage: the cover never follows
 * the stage or the cycle.
 */
function withDemoCover(state: AppState, today: ISODate): AppState {
  const back = (days: number) => addDays(today, -days)
  return setCover(
    state,
    { photoId: 'builtin:hangang', focusY: DEMO_COVER.focusY, caption: `${formatShort(back(DEMO_COVER.walkDaysAgo))} · 한강 산책` },
    'b',
    back(DEMO_COVER.setDaysAgo),
  )
}

/**
 * Sync marks on the example records (lib/types.ts SyncMarks, Next A ③ prep):
 * the deterministic ids a legacy record gets (lib/sync/model.ts) and an
 * `updatedAt` on every record that will sync — the evening of its own day for
 * past records, yesterday evening for ones that point ahead (never a stamp in
 * the future), an LH strip's own clock time, a diary entry's createdAt. The
 * demo stays deterministic for a given (today, now) and canonical through
 * parseState (ids and stamps are kept as they are).
 */
function withSyncMarks(state: AppState, today: ISODate): AppState {
  const evening = (day: ISODate) => stamp(day < today ? day : addDays(today, -1), 21, 0)
  const mark = <R extends SyncMarks>(r: R, updatedAt: string): R => ({ ...r, updatedAt })
  const lhStamp = (date: ISODate, time: string | undefined, slot: 'morning' | 'evening' | undefined) => {
    if (time) return stamp(date, Number(time.slice(0, 2)), Number(time.slice(3, 5)))
    return stamp(date, slot === 'evening' ? 20 : 8, 0)
  }
  return {
    ...state,
    periods: state.periods.map((p) => mark({ id: periodId(p.start), ...p }, stamp(p.start, 7, 30))),
    lhTests: state.lhTests.map((t) => mark({ id: lhId(t), ...t }, lhStamp(t.date, t.time, t.slot))),
    pregnancyTests: state.pregnancyTests.map((t) =>
      mark(t, t.time ? stamp(t.date, Number(t.time.slice(0, 2)), Number(t.time.slice(3, 5))) : evening(t.date)),
    ),
    appointments: state.appointments.map((a) => mark(a, evening(a.date))),
    diary: state.diary.map((e) => mark(e, e.createdAt)),
    customTasks: state.customTasks.map((c) => mark(c, evening(c.doneAt ?? c.due ?? today))),
    ...(state.treatments ? { treatments: state.treatments.map((t) => mark(t, evening(t.endDate ?? t.startDate))) } : {}),
  }
}

/**
 * A realistic couple space for "예시로 둘러보기". Two Next A ① fields stay
 * unset on purpose: `settings.coverOnLink` (the link carries no photo until
 * the owner says yes — the privacy default a demo should show) and
 * `couple.link` (a link is made per device, with its token outside the
 * state; tests/integrationNextA.test.ts exercises both).
 */
export function createDemoState(today: ISODate, now: Date, stage: Stage = 'preparing'): AppState {
  const s = stage === 'pregnant' ? demoPregnant(today, now) : stage === 'parenting' ? demoParenting(today, now) : demoPreparing(today, now)
  return withSyncMarks(withDemoCover(s, today), today)
}
