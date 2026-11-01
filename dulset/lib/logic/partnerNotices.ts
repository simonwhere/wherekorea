// His check-point notices (founder 2026-11-01, '12개 전부') and her weekly
// '이번 주 민수님' — pure. lib/useNotificationEngine runs allRuleNotices.
//
// What goes out, to whom, keyed how (no date of her cycle in any key — a key
// travels with the notice; the pregnancy is named by the day it was recorded
// (pregnancyTag), the baby by its birth day, a season by its 절기):
//   ① 'deadline:task-apply:<m>'                 his 신청 step still open 14 days
//      after his first run (the Monday on or after) — once. After [접수가
//      끝났대요] ('apply-closed:<year>:<m>', partnerTrack) instead:
//      'deadline:task-apply-new-year:<year+1>:<m>' from the first Monday of
//      January. Research kr-programs.json 'fertility-check-intake-2026'.
//   ② 'flu-season:<절기>:<m>'                    the flu row open and unticked —
//      once per 절기 ('medical-checklist.json partner-flu-season-2026-27').
//   ③ 'deadline:task-prep:<appointment id>:<m>'  his booked 정액검사 7 days ahead,
//      or at booking when it is sooner (medical.json 'male-semen-test-abstinence').
//   ⑥ 'partner-leave-open:<pregnancy>:<m>'       배우자 출산휴가 opens (예정일 −50);
//      'partner-leave:<birth>:<30|7|1>:<m>'        D-30 · D-7 · D-1 before 출생일 + 119
//      (admin-timeline.json 'spouse-birth-leave-120-days').
//   ⑦ 'tdap:<pregnancy>:<60|21>:<m>'             예정일 −60 and −21, nothing after
//      예정일 −14 ('partner-tdap-once').
//   ⑩ 'postnatal-open:<pregnancy>:<m>'           산후도우미 신청 opens (예정일 −40) —
//      to both ('postnatal-care-spouse-apply').
//   ⑪ 'program:infertility-leave-paid-4:<m>'     2026-11-27 ~ 12-10, 병원과 함께 only
//      (kr-programs.json 'infertility-leave-paid-4-days-2026-11-27').
//   ⑫ 'dad-mind:<birth>:<m>'                     출생일 + 90 (until + 364), once, while his home asks
//      (dadMind.dadMindDue; not after 'dad-mind-asked:<birth>:<m>')
//      (medical.json 'paternal-perinatal-depression').
//   'week-digest:<monday>:<her>'                 her week line about him (below).
//
// The rules (docs/positioning.md §4, the burden rule of 2026-11-01):
//  • Catch-up. The rules run only while an app is open (no server push yet),
//    so a dated notice fires on the first open on or after its day, once,
//    saying the real days left (partnerDates.catchUpStep); a 'window open'
//    notice fires on the first open inside its window — joining mid-window
//    still gets it.
//  • Two a week for him. At most PARTNER_WEEKLY_CAP rule-made notices reach
//    him in a week (Mon–Sun), counted per recipient across both phones (the
//    notices are shared state). Every rule-made one counts (countsTowardCap:
//    his chain and roadmap deadlines, the week notice while pregnant, his
//    우리의 주간 and appointment reminders, 🩺, 기념일 …); the ones outside these
//    rules are never held, they only leave less room. A check point over the
//    cap waits for the next week's first open (still due then → it goes; the
//    rules re-run). Never held: the legal 배우자 출산휴가 D-1 / 당일, and the
//    검사 준비 check when its booking comes before next Monday (held, it would
//    never go). What a person sent (signals, 응원, [고마워요], [같이 갈게요]) and
//    the day-before heads-up for her items do not count.
//  • Deadlines go to their owner only: his never reach her.
//  • None in the 42 quiet days after a loss (weekTogether.weekQuiet).
//  • The lock screen: every notice goes through settings.lockScreenText in
//    the engine — '둘셋 · 새 알림이 있어요' under 잠금화면 숨김.

import { templateById } from '../content/roadmap'
import { addDays, isISODate } from '../dates'
import { MEMBER_IDS, type AppState, type ISODate, type MemberId } from '../types'
import { mondayOf } from './checks'
import { isClinicMode } from './clinic'
import { dadMindDue } from './dadMind'
import { scheduledNotices, sendWeekThanks, type Notice } from './notifications'
import { PARTNER_SETUP_KEY } from './onboarding'
import {
  INFERTILITY_LEAVE_NOTICE,
  PARTNER_LEAVE_REMINDER_DAYS,
  TDAP_NOTICE_OFFSETS,
  TEST_PREP_NOTICE_DAYS,
  catchUpStep,
  daysUntil,
  firstMondayOfJanuary,
  fluDone,
  insideWindow,
  mondayOnOrAfter,
  openFluWindow,
  partnerLeaveLastDay,
  partnerLeaveOpens,
  postnatalCareOpens,
} from './partnerDates'
import { fertilityChain, monthlyTask, partnerId } from './partnerTrack'
import { roadmapState, usableBaby, usablePregnancy } from './plan'
import { appointmentReminders, planDeadlineNotices } from './planNotices'
import { canLogCycle } from './prefs'
import { dueDate, pregnancyTag } from './pregnancy'
import { doneInfo } from './roadmap'
import { fertilityVoice } from './today'
import { canThankWeekOf, partnerWeekSummary, thankWeekOf, weekQuiet, weekThanked, type WeekKey } from './weekTogether'

// ── Ids and copy ────────────────────────────────────────────

const LEAVE_ID = 'birth-partner-leave'
const TDAP_ID = 'p3-partner-tdap'
const POSTNATAL_IDS = ['p3-postnatal-care', 'birth-postnatal-care'] as const

/** Rule-made reminders that may reach him in one week (Mon–Sun). */
export const PARTNER_WEEKLY_CAP = 2
/** Nothing about Tdap once fewer days than this are left to the due date (예정일 2주 전까지). */
export const TDAP_LAST_DAYS = 14
/** His first run + this many days (then the Monday on or after): the 신청 reminder. */
export const APPLY_REMINDER_DAYS = 14

/** Every title and body these rules write (tests read it: copy rules, research, the lock screen). */
export const PARTNER_NOTICE_COPY = {
  apply: {
    title: (checkName: string) => `📝 ${checkName} 지원 신청`,
    body: '검사 전에 신청해야 지원돼요. 접수 상황은 보건소마다 달라서 먼저 확인해요.',
  },
  applyNewYear: {
    title: '📝 새해 접수가 열렸는지 보건소에 확인해요',
    body: (checkName: string) => `${checkName} 지원은 접수 상황이 보건소마다 달라요.`,
  },
  flu: { title: '📝 올해 독감 접종을 챙길 때예요', body: '맞았다면 내 준비에서 체크해요.' },
  testPrep: { title: '📝 곧 검사예요', body: '병원에서 알려 준 검사 전 준비를 지금 확인해요. 병원마다 달라요.' },
  leaveOpen: {
    title: '📝 배우자 출산휴가를 쓸 수 있는 때예요',
    body: '20일을 3번까지 나눠 쓸 수 있어요. 신청 방법은 회사마다 달라요.',
  },
  leaveLeft: {
    title: (daysLeft: number) => `📝 배우자 출산휴가 ${daysLeft === 0 ? '오늘까지예요' : `D-${daysLeft}`}`,
    body: '출생 후 120일이 지나면 쓸 수 없어요. 남은 날이 있으면 회사와 날짜를 정해요. 정확한 마지막 날은 회사나 고용센터(1350)에 확인해요.',
  },
  tdap: {
    title: '📝 Tdap(백일해) 접종',
    body: '맞은 적이 없다면 예정일 2주 전까지 1번 맞아요. 맞았다면 챙길 것에서 체크해요.',
  },
  postnatal: {
    title: '📝 산후도우미 신청을 시작할 수 있어요',
    body: '예정일 40일 전부터 출산 후 60일까지 신청해요. 기준은 보건소마다 달라요.',
  },
  infertilityLeave: {
    title: '📝 난임치료휴가 유급이 4일로 늘었어요',
    body: '11월 27일부터 연 6일 중 처음 4일이 유급이에요. 신청 방법은 회사마다 달라서 회사에 물어봐요.',
  },
  dadMind: { title: '💬 요즘 나는 어때요?', body: '아기가 온 뒤 내 마음도 살펴봐요.' },
  digest: { title: (when: '이번 주' | '지난주', name: string) => `🗒️ ${when} ${name}` },
} as const

// ── Keys ────────────────────────────────────────────────────

/** Names the pregnancy in a key (pregnancy.pregnancyTag — there so backToPreparing can settle these notices). */
export { pregnancyTag }

export const applyReminderKey = (to: MemberId): string => `deadline:task-apply:${to}`
export const applyNewYearKey = (year: number, to: MemberId): string => `deadline:task-apply-new-year:${year}:${to}`
export const testPrepKey = (appointmentId: string, to: MemberId): string => `deadline:task-prep:${appointmentId}:${to}`
export const fluNoticeKey = (season: string, to: MemberId): string => `flu-season:${season}:${to}`
export const leaveOpenKey = (tag: string, to: MemberId): string => `partner-leave-open:${tag}:${to}`
export const leaveLeftKey = (birth: ISODate, step: number, to: MemberId): string => `partner-leave:${birth}:${step}:${to}`
export const tdapNoticeKey = (tag: string, step: number, to: MemberId): string => `tdap:${tag}:${step}:${to}`
export const postnatalOpenKey = (tag: string, to: MemberId): string => `postnatal-open:${tag}:${to}`
export const infertilityLeaveKey = (to: MemberId): string => `program:infertility-leave-paid-4:${to}`
export const dadMindNoticeKey = (birth: ISODate, to: MemberId): string => `dad-mind:${birth}:${to}`
export const weekDigestKey = (week: WeekKey, to: MemberId): string => `week-digest:${week}:${to}`

/** The key prefixes these rules write (today.noticeTarget routes each; tests check the list). */
export const PARTNER_NOTICE_PREFIXES = [
  'deadline:task-apply:',
  'deadline:task-apply-new-year:',
  'deadline:task-prep:',
  'flu-season:',
  'partner-leave-open:',
  'partner-leave:',
  'tdap:',
  'postnatal-open:',
  'program:',
  'dad-mind:',
  'week-digest:',
] as const

const APPLY_CLOSED = /^apply-closed:(\d{4}):([ab])$/
const DIGEST_KEY = /^week-digest:(\d{4}-\d{2}-\d{2}):([ab])$/

/** The week a digest key names ('week-digest:<monday>:<to>'), or undefined. */
export function digestWeek(key: string | undefined): WeekKey | undefined {
  const m = key ? DIGEST_KEY.exec(key) : null
  return m && isISODate(m[1]!) ? m[1]! : undefined
}

// ── Days ────────────────────────────────────────────────────

/** partnerDates' Mondays (there so partnerTrack.applyClosed reads the same January day). */
export { firstMondayOfJanuary, mondayOnOrAfter }

/**
 * The day his first run happened: the link's 'setup' answer (decisions
 * 'partner-setup'), else the in-app first run (couple.linkedAt). Undefined
 * before either.
 */
export function partnerFirstRunDay(state: Pick<AppState, 'decisions' | 'couple'>): ISODate | undefined {
  const fromLink = state.decisions?.[PARTNER_SETUP_KEY]
  if (isISODate(fromLink)) return fromLink
  const linked = state.couple.linkedAt?.slice(0, 10)
  return linked && isISODate(linked) ? linked : undefined
}

/**
 * Is a roadmap row done for this pregnancy or child? Read through
 * plan.roadmapState, as 챙길 것 reads it: a tick or milestone from an earlier
 * pregnancy or child (kept on purpose) does not silence this one's notices.
 */
function rowDone(state: AppState, id: string, today: ISODate): boolean {
  const t = templateById(id)
  return !!t && !!doneInfo(roadmapState(state), t, today)
}

function nameOf(state: Pick<AppState, 'couple'>, id: MemberId): string {
  const name = state.couple.members.find((m) => m.id === id)?.name?.trim()
  return name ? `${name}님` : '함께하는 사람'
}

function ownerOf(state: Pick<AppState, 'couple'>): MemberId {
  return partnerId(state) === 'a' ? 'b' : 'a'
}

/** The due date while pregnant, with the pregnancy it belongs to. */
function pregnantDue(state: AppState): { due: ISODate; tag: string } | undefined {
  if (state.stage !== 'pregnant') return undefined
  const p = usablePregnancy(state.pregnancy)
  return p ? { due: dueDate(p), tag: pregnancyTag(p) } : undefined
}

function birthDay(state: AppState): ISODate | undefined {
  return state.stage === 'parenting' ? usableBaby(state.baby)?.birthDate : undefined
}

// ── The rules ───────────────────────────────────────────────

/** A notice and whether the weekly cap may hold it (exempt: the legal last days, a 검사 준비 that cannot wait). */
interface Candidate {
  notice: Notice
  exempt?: boolean
}

const system = (key: string, to: MemberId, title: string, body: string): Notice => ({ key, to, kind: 'system', title, body })

/** ⑥ The legal last days of 배우자 출산휴가 (parenting): D-30 · D-7 · D-1, counted from the real birth. */
function leaveLeftNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  const birth = birthDay(state)
  if (!birth || rowDone(state, LEAVE_ID, today)) return []
  const left = daysUntil(today, partnerLeaveLastDay(birth))
  const step = left === undefined ? undefined : catchUpStep(PARTNER_LEAVE_REMINDER_DAYS, left)
  if (step === undefined || left === undefined) return []
  const c = PARTNER_NOTICE_COPY.leaveLeft
  return [{ notice: system(leaveLeftKey(birth, step, him), him, c.title(left), c.body), exempt: step === 1 }]
}

/** ③ His booked 정액검사: 7 days ahead, or at booking when it is sooner (preparing). */
function testPrepNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  if (state.stage !== 'preparing') return []
  const task = monthlyTask(state, today, him)
  const a = task?.step === 'test' ? task.appointment : undefined
  const left = a ? daysUntil(today, a.date) : undefined
  if (!a || left === undefined || left < 0 || left > TEST_PREP_NOTICE_DAYS) return []
  const c = PARTNER_NOTICE_COPY.testPrep
  // Held to next Monday, a booking before then would have passed: it goes over a full week.
  return [{ notice: system(testPrepKey(a.id, him), him, c.title, c.body), exempt: a.date < addDays(mondayOf(today), 7) }]
}

/** ⑦ Tdap at 예정일 −60 and −21 (pregnant), nothing once fewer than 14 days are left. */
function tdapNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  const p = pregnantDue(state)
  if (!p || rowDone(state, TDAP_ID, today)) return []
  const left = daysUntil(today, p.due)
  if (left === undefined || left < TDAP_LAST_DAYS) return []
  const step = catchUpStep(
    TDAP_NOTICE_OFFSETS.map((o) => -o),
    left,
  )
  if (step === undefined) return []
  const c = PARTNER_NOTICE_COPY.tdap
  return [{ notice: system(tdapNoticeKey(p.tag, step, him), him, c.title, c.body) }]
}

/** ⑥ 배우자 출산휴가 opens at 예정일 −50: once, on the first open inside it (pregnant). */
function leaveOpenNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  const p = pregnantDue(state)
  if (!p || !insideWindow(today, partnerLeaveOpens(p.due)) || rowDone(state, LEAVE_ID, today)) return []
  const c = PARTNER_NOTICE_COPY.leaveOpen
  return [{ notice: system(leaveOpenKey(p.tag, him), him, c.title, c.body) }]
}

/** "가임력" is a fertility word: only an explicit viewer reads it (partnerTrack.testNameFor). */
function checkNameFor(state: AppState, him: MemberId): string {
  return fertilityVoice(state.settings, him, false) === 'explicit' ? '가임력 검사' : '임신 전 검사'
}

/** ① His 신청 step: the reminder 14 days after his first run, or the January one after [접수가 끝났대요]. */
function applyNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  if (state.stage !== 'preparing' || canLogCycle(state, him)) return []
  if (fertilityChain(state, today, him).step !== 'apply') return []
  const closedYears: number[] = []
  for (const key of Object.keys(state.decisions ?? {})) {
    const m = APPLY_CLOSED.exec(key)
    if (m && m[2] === him) closedYears.push(Number(m[1]))
  }
  const year = Number(today.slice(0, 4))
  const checkName = checkNameFor(state, him)
  if (closedYears.length) {
    // Closed again this year: the January line has nothing to say until next year.
    if (closedYears.includes(year) || !closedYears.includes(year - 1) || today < firstMondayOfJanuary(year)) return []
    const c = PARTNER_NOTICE_COPY.applyNewYear
    return [{ notice: system(applyNewYearKey(year, him), him, c.title, c.body(checkName)) }]
  }
  const first = partnerFirstRunDay(state)
  if (!first || today < mondayOnOrAfter(addDays(first, APPLY_REMINDER_DAYS))) return []
  const c = PARTNER_NOTICE_COPY.apply
  return [{ notice: system(applyReminderKey(him), him, c.title(checkName), c.body) }]
}

/** ② The flu row while it is open and unticked: once per 절기 (preparing, pregnant). */
function fluNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  if (state.stage !== 'preparing' && state.stage !== 'pregnant') return []
  const w = openFluWindow(state.stage, today)
  if (!w || fluDone(state.planDone, today)) return []
  const c = PARTNER_NOTICE_COPY.flu
  return [{ notice: system(fluNoticeKey(w.season, him), him, c.title, c.body) }]
}

/** ⑩ 산후도우미 신청 opens at 예정일 −40: once, to both (pregnant), unless it is already done. */
function postnatalNotices(state: AppState, today: ISODate): Candidate[] {
  const p = pregnantDue(state)
  if (!p || !insideWindow(today, postnatalCareOpens(p.due))) return []
  if (POSTNATAL_IDS.some((id) => rowDone(state, id, today))) return []
  const c = PARTNER_NOTICE_COPY.postnatal
  return MEMBER_IDS.map((to) => ({ notice: system(postnatalOpenKey(p.tag, to), to, c.title, c.body) }))
}

/** ⑪ 난임치료휴가 유급 4일: once inside its two weeks, 병원과 함께 only (preparing). */
function infertilityLeaveNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  if (state.stage !== 'preparing' || !isClinicMode(state)) return []
  if (!insideWindow(today, INFERTILITY_LEAVE_NOTICE.from, INFERTILITY_LEAVE_NOTICE.until)) return []
  const c = PARTNER_NOTICE_COPY.infertilityLeave
  return [{ notice: system(infertilityLeaveKey(him), him, c.title, c.body) }]
}

/**
 * ⑫ 아빠 마음 from 출생일 + 90 (parenting): once, on the days his home asks
 * (dadMind.dadMindDue — the same rule as the card, so it stops once he
 * answered: 'dad-mind-asked:<birth>:<m>').
 */
function dadMindNotices(state: AppState, today: ISODate, him: MemberId): Candidate[] {
  const birth = birthDay(state)
  if (!birth || !dadMindDue(state, today, him)) return []
  const c = PARTNER_NOTICE_COPY.dadMind
  return [{ notice: system(dadMindNoticeKey(birth, him), him, c.title, c.body) }]
}

// ── The weekly cap ──────────────────────────────────────────

/** Rule-made notices to him that use none of his budget: the heads-up for her items, her week line. */
const NOT_COUNTED = /^(?:appt:[^:]+:[^:]+:fyi:|deadline:together:|week-digest:)/
/** What a person sent, even on an old record without `from`. */
const PERSON_SENT = /^(?:nudge:|thanks:|reaction:|complete:|period-told:|positive-told:|bleeding-told:|prenatal-share:|date-plan:)/

/**
 * Does this notice use up his weekly budget? Every rule-made one (no `from`):
 * these check points, his chain's and the roadmap's deadlines, the
 * 지원결정통지서 one, a '기한' on an item, his own appointment reminders
 * ('appt:<id>:<date>:<1|0>:<m>'), the week notice while pregnant ('week:'),
 * his 우리의 주간 notices, '🩺 상담', 기념일 and the baby's days. Not what a
 * person sent (signals, 콕, 응원, [고마워요], [같이 갈게요], [알리기] — they carry
 * `from`), not the day-before heads-up for her items ('appt:…:fyi:',
 * 'deadline:together:'), not her week line. The ones outside these rules are
 * never held — they only leave less room for the check points.
 */
export function countsTowardCap(n: { key?: string; from?: MemberId; kind?: Notice['kind'] } | undefined): boolean {
  const key = n?.key
  if (!key || n.from || n.kind === 'nudge' || n.kind === 'cheer') return false
  return !NOT_COUNTED.test(key) && !PERSON_SENT.test(key)
}

/**
 * Keep at most PARTNER_WEEKLY_CAP reminders to him this week: what was
 * already delivered this week (both phones) and what the other rules send
 * in this run (`others`) count first; then the candidates in order, the
 * exempt ones always. Notices to her pass untouched.
 */
function capForHim(state: AppState, today: ISODate, him: MemberId, candidates: Candidate[], others: readonly Notice[]): Notice[] {
  const delivered = new Set(state.notifications.map((n) => n.key).filter(Boolean))
  const monday = mondayOf(today)
  const inWeek = (at: unknown) => typeof at === 'string' && at.slice(0, 10) >= monday && at.slice(0, 10) <= today
  let used = state.notifications.filter((n) => n.to === him && countsTowardCap(n) && inWeek(n.createdAt)).length
  used += new Set(others.filter((n) => n.to === him && countsTowardCap(n) && !delivered.has(n.key)).map((n) => n.key)).size
  const out: Notice[] = []
  for (const { notice, exempt } of candidates) {
    if (delivered.has(notice.key)) continue
    if (notice.to !== him) {
      out.push(notice)
      continue
    }
    if (!exempt && used >= PARTNER_WEEKLY_CAP) continue
    out.push(notice)
    used++
  }
  return out
}

/**
 * Every check-point notice due on `today`, after the quiet and his weekly
 * cap. Pass the other rules' notices of the same run as `others`, so the cap
 * counts them (allRuleNotices does).
 */
export function partnerCheckpointNotices(state: AppState, today: ISODate, others: readonly Notice[] = []): Notice[] {
  if (!isISODate(today) || weekQuiet(state, today)) return []
  return [...capForHim(state, today, partnerId(state), candidates(state, today), others), ...weekDigestNotices(state, today)]
}

/** Every check point due on `today` before his weekly cap, most time-bound first (when the cap is full, the later ones wait a week). */
function candidates(state: AppState, today: ISODate): Candidate[] {
  const him = partnerId(state)
  return [
    ...leaveLeftNotices(state, today, him),
    ...testPrepNotices(state, today, him),
    ...tdapNotices(state, today, him),
    ...leaveOpenNotices(state, today, him),
    ...infertilityLeaveNotices(state, today, him),
    ...applyNotices(state, today, him),
    ...fluNotices(state, today, him),
    ...postnatalNotices(state, today),
    ...dadMindNotices(state, today, him),
  ]
}

/** The check points due on `today` before the cap (the quiet still applies) — what each rule says on its own. */
export function checkpointCandidates(state: AppState, today: ISODate): Notice[] {
  if (!isISODate(today) || weekQuiet(state, today)) return []
  return candidates(state, today).map((c) => c.notice)
}

// ── 이번 주 민수님 (her weekly line about him) ──────────────────

/**
 * Her week line about him, as a 🔔: on Sunday the week so far ('이번 주
 * 민수님'); on a first open later (Monday–Saturday) the week before ('지난주
 * 민수님') if it never went out. Only when his week has a line
 * (weekTogether.partnerWeekSummary — never a 0, never '안 했어요'), never in the
 * quiet, never to him. The body is the summary's lines (three at most).
 */
export function weekDigestNotices(state: AppState, today: ISODate): Notice[] {
  if (!isISODate(today) || weekQuiet(state, today)) return []
  const him = partnerId(state)
  const her = ownerOf(state)
  const monday = mondayOf(today)
  const sunday = addDays(monday, 6) === today
  const week = sunday ? monday : addDays(monday, -7)
  const lines = partnerWeekSummary(state, sunday ? today : addDays(week, 6), him)
  if (!lines.length) return []
  const title = PARTNER_NOTICE_COPY.digest.title(sunday ? '이번 주' : '지난주', nameOf(state, him))
  return [system(weekDigestKey(week, her), her, title, lines.map((l) => l.text).join(' · '))]
}

/** May `by` say [고마워요] from this digest notice (its week, this week or the last)? */
export function canThankFromDigest(state: AppState, by: MemberId, key: string | undefined, today: ISODate): boolean {
  const week = digestWeek(key)
  return !!week && canThankWeekOf(state, by, week, today)
}

/** The day `by` already said [고마워요] for the digest's week, if they did. */
export function thankedForDigest(state: Pick<AppState, 'decisions'>, by: MemberId, key: string | undefined): ISODate | undefined {
  const week = digestWeek(key)
  return week ? weekThanked(state, by, week) : undefined
}

/**
 * [고마워요] from the digest: the same once-a-week decision as her home's
 * button (weekTogether 'week-thanks:<monday>:<by>') plus the same 💛 to him
 * (notifications.sendWeekThanks, keyed by that week), and the digest notice
 * itself reads as read — she acted on it. The same state when it is not allowed.
 */
export function thankFromDigest(
  state: AppState,
  by: MemberId,
  to: MemberId,
  key: string | undefined,
  today: ISODate,
  nowISO: string,
): AppState {
  const week = digestWeek(key)
  if (!week) return state
  const next = thankWeekOf(state, by, week, today)
  if (next === state) return state
  const sent = sendWeekThanks(next, by, to, today, nowISO, week)
  return { ...sent, notifications: sent.notifications.map((n) => (n.key === key && n.to === by && !n.read ? { ...n, read: true } : n)) }
}

// ── Everything the engine runs ──────────────────────────────

/**
 * Every notification rule for `today`, in one list (useNotificationEngine
 * merges it by key): the scheduled ones, appointment reminders, the plan's
 * deadlines, then his check points and her week line — capped against the rest.
 */
export function allRuleNotices(state: AppState, today: ISODate): Notice[] {
  const base = [...scheduledNotices(state, today), ...appointmentReminders(state, today), ...planDeadlineNotices(state, today)]
  return [...base, ...partnerCheckpointNotices(state, today, base)]
}
