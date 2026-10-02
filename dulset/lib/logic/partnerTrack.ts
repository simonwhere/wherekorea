// The partner's track (남편 트랙, N7 · N14) — pure.
//
// • "이번 달 할 일" — one meaningful task a month instead of many daily chores
//   (research: partner features alone don't engage men; a clear, bounded task
//   does — docs/review-preconception.md). While preparing it follows the
//   가임력 검사 chain: 신청 → 신청 후 3개월 안에 검사 → 검사 후 1개월 안에 청구
//   (임신 사전건강관리, lib/content/programs 'fertility-check'). Support needs the
//   application first; testing first and claiming later isn't covered (소급 불가).
//   When the cycle owner is 35 or older the check goes to the top (ASRM: see a
//   doctor after 6 months of trying at 35+). A test after the 3-month window
//   isn't covered by that application either, so it has nothing to claim.
// • The chain is PER PERSON (N14): the support counts per person (research
//   kr-programs.json '부부 각각 나이 주기별'), so her application never moves
//   his card to 검사. Each person's steps live under `<id>:<member>` keys in
//   planDone; the couple's shared 챙길 것 row (planDone[FERTILITY_APPLY_ID],
//   '둘이 함께') reads as "both applied" and is kept in step by
//   setFertilityApplied. Whether e보건소 takes one application for two people
//   is still to be confirmed by a person (docs/STATUS.md N18).
// • The card is a staged state machine (N14): 예약 전 (what · where · bring ·
//   cost · [일정 잡기]) → 예약됨 → '다녀왔어요?' → 청구 (four papers) → done.
//   Completing a step takes the date it happened ('언제 했어요?'), never just
//   "today": the claim deadline counts from the real test day.
// • Every stage carries '오늘 해 줄 수 있는 것' — one small thing for the
//   partner to do today, read off ttcMoment for this viewer, so it never says
//   more about the cycle than that person's alert style and sharing allow.
//   Wording follows the viewer's fertilityVoice: "가임력 검사" only for an
//   explicit viewer; soft / calm viewers read "임신 전 검사" (the roadmap's own
//   name for the 임신 사전건강관리 check), so no fertility word reaches them.
// • Handing the cycle over (handOverCycle). What the partner may see of it
//   (shareCycleDetails) is set in prefs.setShareCycleDetails — only the person
//   whose cycle it is changes it.

import { FERTILITY_CHECK_GUIDE, type ClaimDocId } from '../content/programs'
import { diffDays, formatKo } from '../dates'
import type { Appointment, AppState, ISODate, MemberId } from '../types'
import { setAppointmentDone } from './appointments'
import { isClinicMode } from './clinic'
import { ageFromBirthYear } from './notifications'
import {
  OVERDUE_GRACE_DAYS,
  monthsEnd,
  planItems,
  stepAppointment,
  tickItem,
  type AppointmentDraft,
  type PlanItem,
} from './plan'
import { canLogCycle } from './prefs'
import { setCycleOwner } from './settings'
import { fertilityVoice, isSpermSide } from './today'
import { ttcMoment, type MomentCopyKey } from './ttcFlow'

// ── 가임력 검사 chain ───────────────────────────────────────

/** 임신 사전건강관리 검사 지원 신청 (roadmap template, who: both — the couple's row). */
export const FERTILITY_APPLY_ID = 'pre-health-check-support'
/** 임신 전 검사 (정액·감염병) (roadmap template, who: partner). */
export const FERTILITY_TEST_ID = 'pre-checkup-partner'
/** 임신 전 기본 검사 (roadmap template, who: carrier) — the cycle owner's test row. */
export const FERTILITY_CARRIER_TEST_ID = 'pre-checkup-carrier'
/** planDone key for "검사비 청구했어요" — a step with no roadmap row of its own. */
export const FERTILITY_CLAIM_ID = 'pre-health-check-claim'
/** 신청 후 3개월 안에 검사, 검사 후 1개월 안에 청구 (e보건소, research kr-programs.json). */
export const TEST_WITHIN_MONTHS = 3
export const CLAIM_WITHIN_MONTHS = 1

/** One person's step of the chain: `pre-health-check-support:a`. */
export const chainKey = (id: string, member: MemberId): string => `${id}:${member}`

const otherOf = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a')

/** The member whose cycle isn't tracked (남편 트랙), 'b' when nobody tracks it. */
export function partnerId(state: Pick<AppState, 'couple'>): MemberId {
  const owner = state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
  return otherOf(owner)
}

/** Which test row is this person's: the partner's 정액·감염병 row or the owner's 기본 검사 row. */
export function testIdFor(state: Pick<AppState, 'couple'>, member: MemberId): string {
  return canLogCycle(state, member) ? FERTILITY_CARRIER_TEST_ID : FERTILITY_TEST_ID
}

type Done = { at: ISODate; by?: MemberId }
type PlanDone = AppState['planDone']

/**
 * When this person applied: their own key first, else the couple's shared row
 * (ticked as '둘이 함께' — both applied, as the demo's 보건소 visit together).
 */
export function appliedInfo(planDone: PlanDone, member: MemberId): Done | undefined {
  return planDone[chainKey(FERTILITY_APPLY_ID, member)] ?? planDone[FERTILITY_APPLY_ID]
}

/** Who has applied (own key or the shared row). */
export function appliedMembers(planDone: PlanDone): MemberId[] {
  return (['a', 'b'] as const).filter((m) => !!appliedInfo(planDone, m))
}

/**
 * When this person claimed: their own key, else the one claim mark older data
 * holds (made from the partner's card: it belongs to whoever `by` says, or to
 * the partner when nobody was recorded).
 */
export function claimInfo(state: Pick<AppState, 'planDone' | 'couple'>, member: MemberId): Done | undefined {
  const own = state.planDone[chainKey(FERTILITY_CLAIM_ID, member)]
  if (own) return own
  const legacy = state.planDone[FERTILITY_CLAIM_ID]
  if (!legacy) return undefined
  const owner = legacy.by ?? partnerId(state)
  return owner === member ? legacy : undefined
}

export type FertilityStep = 'apply' | 'test' | 'claim' | 'done'

export interface FertilityChain {
  member: MemberId
  step: FertilityStep
  appliedAt?: ISODate
  testedAt?: ISODate
  claimedAt?: ISODate
  /** Last day to get tested (신청 후 3개월, counting the application day as day 1). */
  testBy?: ISODate
  /**
   * Last day to claim (검사 후 1개월). Only when the test fell inside the
   * application's window (신청일 ~ testBy): before it or after it isn't covered.
   */
  claimBy?: ISODate
  /** The current step's deadline has passed. */
  lapsed: boolean
}

/**
 * Where `member` is in 신청 → 검사 → 청구 (the partner by default), read from
 * their own ticks: her application never advances his chain.
 */
export function fertilityChain(
  state: Pick<AppState, 'planDone' | 'couple'>,
  today: ISODate,
  member: MemberId = partnerId(state),
): FertilityChain {
  const appliedAt = appliedInfo(state.planDone, member)?.at
  const testedAt = state.planDone[testIdFor(state, member)]?.at
  const claimedAt = claimInfo(state, member)?.at
  const testBy = appliedAt ? monthsEnd(appliedAt, TEST_WITHIN_MONTHS) : undefined
  // Tested before applying (소급 불가) or after the 3-month window: not covered,
  // so there's nothing to claim.
  const covered = !!appliedAt && !!testedAt && !!testBy && testedAt >= appliedAt && testedAt <= testBy
  const claimBy = covered ? monthsEnd(testedAt!, CLAIM_WITHIN_MONTHS) : undefined
  const base = { member, appliedAt, testedAt, claimedAt, testBy, claimBy }
  if (!appliedAt) return { ...base, step: testedAt ? 'done' : 'apply', lapsed: false }
  if (!testedAt) return { ...base, step: 'test', lapsed: !!testBy && today > testBy }
  if (claimBy && !claimedAt) return { ...base, step: 'claim', lapsed: today > claimBy }
  return { ...base, step: 'done', lapsed: false }
}

/**
 * Mark one person's application (or undo it). Their own key is written; the
 * couple's shared 챙길 것 row follows: ticked once both have applied, cleared
 * when one of them undoes (the other's application is kept under their own
 * key first, so nothing is lost). Idempotent: applying twice keeps the first date.
 */
export function setFertilityApplied(state: AppState, member: MemberId, done: boolean, at: ISODate, by: MemberId = member): AppState {
  const has = !!appliedInfo(state.planDone, member)
  if (has === done) return state
  const planDone = { ...state.planDone }
  const other = otherOf(member)
  if (done) {
    planDone[chainKey(FERTILITY_APPLY_ID, member)] = { at, by }
    if (appliedInfo(planDone, other) && !planDone[FERTILITY_APPLY_ID]) planDone[FERTILITY_APPLY_ID] = { at, by }
  } else {
    const shared = planDone[FERTILITY_APPLY_ID]
    if (shared && !planDone[chainKey(FERTILITY_APPLY_ID, other)]) planDone[chainKey(FERTILITY_APPLY_ID, other)] = shared
    delete planDone[chainKey(FERTILITY_APPLY_ID, member)]
    delete planDone[FERTILITY_APPLY_ID]
  }
  return { ...state, planDone }
}

/** Mark "검사비 청구했어요" for `member` (or undo it). */
export function setFertilityClaimed(state: AppState, done: boolean, at: ISODate, by: MemberId, member: MemberId = by): AppState {
  const has = !!claimInfo(state, member)
  if (has === done) return state
  const planDone = { ...state.planDone }
  if (done) planDone[chainKey(FERTILITY_CLAIM_ID, member)] = { at, by }
  else {
    delete planDone[chainKey(FERTILITY_CLAIM_ID, member)]
    // An older claim mark that belonged to this person goes too.
    if (planDone[FERTILITY_CLAIM_ID] && (planDone[FERTILITY_CLAIM_ID]!.by ?? partnerId(state)) === member) delete planDone[FERTILITY_CLAIM_ID]
  }
  return { ...state, planDone }
}

// ── 청구 서류 (four papers, per person) ────────────────────

export interface ClaimDocState {
  id: ClaimDocId
  label: string
  done: boolean
}

const claimDocKey = (member: MemberId, doc: ClaimDocId): string => `${chainKey(FERTILITY_CLAIM_ID, member)}:doc:${doc}`

/** 청구서 · 영수증 · 세부내역서 · 통장사본, with this person's ticks (research kr-programs.json). */
export function claimDocs(state: Pick<AppState, 'planDone'>, member: MemberId): ClaimDocState[] {
  return FERTILITY_CHECK_GUIDE.claimDocs.map((d) => ({ id: d.id, label: d.label, done: !!state.planDone[claimDocKey(member, d.id)] }))
}

export function setClaimDocDone(state: AppState, member: MemberId, doc: ClaimDocId, done: boolean, at: ISODate, by: MemberId = member): AppState {
  const key = claimDocKey(member, doc)
  if (!!state.planDone[key] === done) return state
  const planDone = { ...state.planDone }
  if (done) planDone[key] = { at, by }
  else delete planDone[key]
  return { ...state, planDone }
}

// ── 이번 달 할 일 ───────────────────────────────────────────

/**
 * Where the staged card is: before booking the test, booked, the booked day
 * has passed ('다녀왔어요?'), or claiming. The application has one stage.
 */
export type TaskStage = 'apply' | 'book' | 'booked' | 'visited' | 'claim'

/** What · where · bring · cost for the stage, from lib/content/programs (N14). */
export interface TaskGuide {
  what?: string
  where?: string
  bring?: string
  cost?: string
}

export interface MonthlyTask extends PlanItem {
  /** Set when the task is a step of the 가임력 검사 chain. */
  step?: Exclude<FertilityStep, 'done'>
  stage?: TaskStage
  /** The step's deadline. */
  dueBy?: ISODate
  /** '검사 마감 12월 27일 (일) · 신청 후 3개월 안' */
  dueText?: string
  /** One sentence: why this, now. */
  why?: string
  /** Put it first on the partner's home (a live deadline, or the owner is 35+). */
  top: boolean
  /** The booked test (stages 'booked' and 'visited'). */
  appointment?: Appointment
  guide?: TaskGuide
  /** The claim's four papers with this person's ticks (stage 'claim'). */
  docs?: ClaimDocState[]
  link?: { label: string; url: string }
  /** The date the '언제 했어요?' sheet starts on: the booked day once it has passed, else today. */
  defaultDoneAt: ISODate
  /** The earliest date that makes sense for '언제 했어요?' (a test after applying, a claim after the test). */
  minDoneAt?: ISODate
  /** '오늘 해 줄 수 있는 것' — one small thing for the partner today. */
  tip?: string
}

/** Roadmap rows that aren't a month's to-do (daily habits live in the checks; "when needed" items). */
const NOT_MONTHLY: ReadonlySet<string> = new Set(['pre-infertility-support', 'pre-folic', 'pre-habits-partner'])

/** The cycle owner's age this year (for the 35+ rule), if a birth year is known. */
export function ownerAge(state: Pick<AppState, 'couple'>, today: ISODate): number | undefined {
  const owner = state.couple.members.find((m) => m.tracksCycle)
  return ageFromBirthYear(owner?.birthYear, today)
}

function rank(i: PlanItem, member: MemberId): number {
  const s = i.status === 'overdue' ? 0 : i.status === 'now' ? 1 : i.status === 'soon' ? 2 : i.status === 'undated' ? 3 : 5
  // Their own item before a shared one.
  return s + (i.owners.length === 1 && i.owners[0] === member ? 0 : 0.5)
}

const NOTE = '보건소·병원마다 조금씩 달라요.'
const GUIDE = FERTILITY_CHECK_GUIDE
const E_HEALTH = { label: GUIDE.urlLabel, url: GUIDE.url }

/** '정액검사' for the sperm side, else the (voice-aware) name of the check. */
function testNameFor(state: AppState, member: MemberId): { checkName: string; testName: string } {
  const me = state.couple.members.find((m) => m.id === member)
  // "가임력" is a fertility word: only an explicit viewer reads it.
  const explicit = fertilityVoice(state.settings, member, canLogCycle(state, member)) === 'explicit'
  const checkName = explicit ? '가임력 검사' : '임신 전 검사'
  const testName = me && isSpermSide(me) ? GUIDE.test.partner.what : checkName
  return { checkName, testName }
}

function chainTask(
  state: AppState,
  items: PlanItem[],
  chain: FertilityChain,
  member: MemberId,
  age35: boolean,
  today: ISODate,
): MonthlyTask | undefined {
  const apply = items.find((i) => i.id === FERTILITY_APPLY_ID)
  const test = items.find((i) => i.id === testIdFor(state, member))
  const me = state.couple.members.find((m) => m.id === member)
  const { checkName, testName } = testNameFor(state, member)
  const cost = me && isSpermSide(me) ? GUIDE.test.partner.cost : GUIDE.test.carrier.cost
  switch (chain.step) {
    case 'apply': {
      if (!apply) return undefined
      // ASRM 2023: at 35+, see a doctor after 6 months of trying (medical.json).
      const why35 = age35 ? '35세 이상은 6개월 동안 소식이 없으면 병원 상담을 권해요(ASRM). 검사를 미리 받아 두면 든든해요. ' : ''
      return {
        ...apply,
        // His own step of the couple's row: the per-person tick is his.
        doneAt: undefined,
        doneBy: undefined,
        owners: [member],
        title: `${checkName} 지원 신청하기`,
        step: 'apply',
        stage: 'apply',
        why: `${why35}검사 전에 e보건소나 보건소에서 먼저 신청해야 지원돼요. 먼저 검사하면 지원받을 수 없어요. ${NOTE}`,
        guide: { where: GUIDE.apply.where, bring: GUIDE.apply.gives, cost },
        link: E_HEALTH,
        top: age35,
        defaultDoneAt: today,
      }
    }
    case 'test': {
      const base = test ?? apply
      if (!base || !chain.testBy) return undefined
      const appointment = stepAppointment(state.appointments, testIdFor(state, member), today)
      const stage: TaskStage = !appointment ? 'book' : appointment.date > today ? 'booked' : 'visited'
      return {
        ...base,
        title: `${testName} 받기`,
        status: chain.lapsed ? 'overdue' : 'now',
        end: chain.testBy,
        deadline: true,
        lapsed: false,
        step: 'test',
        stage,
        dueBy: chain.testBy,
        dueText: chain.lapsed
          ? '신청 후 3개월이 지났어요 · 보건소에 다시 확인해요'
          : `검사 마감 ${formatKo(chain.testBy)} · 신청 후 3개월 안`,
        why: `신청 후 3개월 안에 참여 의료기관에서 검사해요. 검사 준비는 병원 안내를 따라요. ${NOTE}`,
        appointment,
        guide: { what: testName, where: GUIDE.where, bring: GUIDE.bring, cost },
        link: E_HEALTH,
        top: true,
        defaultDoneAt: stage === 'visited' ? appointment!.date : today,
        minDoneAt: chain.appliedAt,
      }
    }
    case 'claim': {
      const base = apply ?? test
      if (!base || !chain.claimBy) return undefined
      return {
        ...base,
        id: FERTILITY_CLAIM_ID,
        title: '검사비 청구하기',
        status: chain.lapsed ? 'overdue' : 'now',
        start: chain.testedAt,
        end: chain.claimBy,
        deadline: true,
        lapsed: false,
        doneAt: undefined,
        doneBy: undefined,
        owners: [member],
        step: 'claim',
        stage: 'claim',
        dueBy: chain.claimBy,
        dueText: chain.lapsed
          ? '검사 후 1개월이 지났어요 · 보건소에 확인해요'
          : `청구 마감 ${formatKo(chain.claimBy)} · 검사 후 1개월 안`,
        why: `검사 후 1개월 안에 ${GUIDE.claimWhere}에 청구해요. ${GUIDE.paidWithin}. ${NOTE}`,
        guide: { where: GUIDE.claimWhere },
        docs: claimDocs(state, member),
        link: E_HEALTH,
        top: true,
        defaultDoneAt: today,
        minDoneAt: chain.testedAt,
      }
    }
    default:
      return undefined
  }
}

/** A lapsed step stops being "this month's task" a month after its deadline. */
function chainStale(chain: FertilityChain, today: ISODate): boolean {
  if (!chain.lapsed) return false
  const due = chain.step === 'test' ? chain.testBy : chain.claimBy
  return !!due && diffDays(due, today) > OVERDUE_GRACE_DAYS
}

/**
 * The single most useful open task for `member` this month.
 *
 * Preparing, for the partner (not the cycle owner): their own 가임력 검사 chain
 * comes first — the application, then the test and the claim with their live
 * deadlines (`top`: a deadline, or the owner is 35+). An item of their own,
 * even a dated one, never outranks a chain step (review D-3). Once the chain
 * is done (or a lapsed step has gone quiet): their own open preparing items,
 * partner-only before shared. Other stages / the owner: open items, most
 * urgent first.
 */
export function monthlyTask(state: AppState, today: ISODate, member: MemberId): MonthlyTask | undefined {
  const items = planItems(state, today)
  const open = items.filter(
    (i) => i.status !== 'done' && !i.lapsed && !i.pending && i.owners.includes(member) && !NOT_MONTHLY.has(i.id),
  )
  const isPartner = !canLogCycle(state, member)
  if (state.stage !== 'preparing' || !isPartner) {
    const first = [...open].sort((a, b) => rank(a, member) - rank(b, member))[0]
    return first ? { ...first, top: false, defaultDoneAt: today } : undefined
  }

  const age = ownerAge(state, today)
  const age35 = age !== undefined && age >= 35
  const chain = fertilityChain(state, today, member)
  const task = chainStale(chain, today) ? undefined : chainTask(state, items, chain, member, age35, today)
  const tip = partnerTip(state, today, member)
  if (task) return { ...task, tip }

  // The chain's rows are finished or not applicable: their own items.
  const rest = open
    .filter((i) => i.id !== FERTILITY_APPLY_ID && i.id !== FERTILITY_TEST_ID)
    .sort((a, b) => rank(a, member) - rank(b, member))
  const first = rest[0]
  return first ? { ...first, top: false, defaultDoneAt: today, tip } : undefined
}

/**
 * Complete a month task the way its step is recorded (신청 → the person's own
 * tick, 검사 → roadmap tick, 청구 → claim mark), dated `at` — the day it
 * happened ('언제 했어요?'), which the next deadline counts from. A booked
 * test is marked 다녀왔어요 with it. `done = false` undoes it the same way (the
 * toast's 되돌리기). Idempotent: completing twice keeps the first date.
 */
export function completeMonthlyTask(
  state: AppState,
  task: Pick<MonthlyTask, 'id' | 'step'> & { appointment?: Pick<Appointment, 'id'> },
  at: ISODate,
  by: MemberId,
  done = true,
  member: MemberId = by,
): AppState {
  if (task.step === 'apply') return setFertilityApplied(state, member, done, at, by)
  if (task.step === 'test') {
    let s = tickItem(testIdFor(state, member), done, at, by)(state)
    if (task.appointment && s !== state) s = setAppointmentDone(s, task.appointment.id, done)
    return s
  }
  if (task.step === 'claim') return setFertilityClaimed(state, done, at, by, member)
  return tickItem(task.id, done, at, by)(state)
}

/** Prefill for [일정 잡기] on the test step: the test, for this person, linked to their test row. */
export function bookingDraft(state: AppState, member: MemberId, today: ISODate): AppointmentDraft {
  const { testName } = testNameFor(state, member)
  return {
    date: today,
    time: '',
    title: testName,
    place: '',
    who: member,
    kind: 'test',
    note: `보건소 ${GUIDE.bring} 챙기기`,
    taskId: testIdFor(state, member),
  }
}

// ── '오늘 해 줄 수 있는 것' ─────────────────────────────────

/** Clinic cycles (N13): the clinic sets the timing, so the partner keeps to the schedule. */
export const CLINIC_PARTNER_TIP = '결과를 묻지 말고, 병원 일정만 같이 챙겨요.'

/**
 * Tips by what the partner's moment card already says (ttcMoment's copy key
 * encodes what this viewer may know: a soft / calm viewer, or one without
 * shared details, never gets a copy that names the cycle's timing). Keys that
 * aren't here fall back to the neutral tips.
 */
const TIP_BY_COPY: Partial<Record<MomentCopyKey, string>> = {
  // (The moment card's body already says '증상은 묻지 말고 평소처럼 보내요' — not twice on one screen.)
  'partner.tww': '좋아하는 간식을 하나 챙겨 봐요.',
  'partner.late-shared': '먼저 말을 꺼내지 않아요. 이야기하고 싶을 때 들어 주면 돼요.',
  'partner.our-week': '오늘 저녁은 둘만의 시간으로 비워 둬요.',
  'partner.our-week-soon': '이번 주말 계획을 먼저 물어봐요.',
  'partner.positive-told': '병원에 같이 갈 수 있는 날을 먼저 비워 둬요.',
  'partner.period-shared': '가벼운 산책을 제안해 봐요.',
}

/** Day-to-day things that fit any day of the cycle (rotated by date, so the card changes). */
export const NEUTRAL_PARTNER_TIPS: readonly string[] = [
  '오늘 저녁, 서로의 하루를 한 가지씩 물어봐요.',
  '집안일 하나를 먼저 맡아 봐요.',
  '같이 걷는 30분을 제안해 봐요.',
  '좋아하는 간식을 하나 사 가요.',
  '고마운 것 하나를 말로 전해요.',
  '휴대폰을 내려놓고 10분만 이야기해요.',
  '내일 아침 일정을 먼저 물어봐요.',
]

/** Rotates with the date, so the same tip doesn't sit on the card for weeks. */
export function neutralPartnerTip(today: ISODate): string {
  const n = NEUTRAL_PARTNER_TIPS.length
  const i = ((diffDays('2000-01-01', today) % n) + n) % n
  return NEUTRAL_PARTNER_TIPS[i]!
}

/**
 * One small thing the partner can do today, for the staged card. Read off
 * the partner's own moment (ttcMoment): the copy key already passes this
 * viewer's alert style, 부담 줄이기 and the sharing choice, so a calm viewer
 * only ever gets a neutral tip. None when the moment card carries its own
 * (period days 1–3: '‘고생했어’ 한마디면 충분해요'), so it isn't said twice.
 */
export function partnerTip(state: AppState, today: ISODate, member: MemberId): string | undefined {
  if (state.stage !== 'preparing' || canLogCycle(state, member)) return undefined
  if (isClinicMode(state)) return CLINIC_PARTNER_TIP
  const m = ttcMoment(state, today, member)
  if (!m || m.role !== 'partner') return undefined
  if (m.partnerTip) return undefined
  return TIP_BY_COPY[m.copy] ?? neutralPartnerTip(today)
}

// ── What the partner sees ───────────────────────────────────

// setShareCycleDetails lives in prefs.ts (with canSeeCycleDetails); re-exported
// here for callers that imported it from the partner track.
export { setShareCycleDetails } from './prefs'

/**
 * May `by` change who tracks the cycle? The person whose cycle it is always may.
 * The other person only while there are no cycle records yet (setting up, or the
 * wrong person picked at onboarding): taking the role over later would open the
 * owner's period, LH and test records to them without the owner's say.
 */
export function canHandOverCycle(
  state: Pick<AppState, 'couple' | 'periods' | 'lhTests' | 'pregnancyTests'>,
  by: MemberId,
): boolean {
  if (canLogCycle(state, by)) return true
  return state.periods.length === 0 && state.lhTests.length === 0 && state.pregnancyTests.length === 0
}

/**
 * Hand the cycle over to `id` (설정 › 두 사람), asked by `by`. The sharing choice
 * was the previous owner's, about their own records, so it starts private again
 * and the new owner decides (settings.setCycleOwner resets it). No-op when `id`
 * already tracks the cycle, or when `by` may not change it (canHandOverCycle).
 */
export function handOverCycle(state: AppState, id: MemberId, by: MemberId): AppState {
  if (state.couple.members.find((m) => m.tracksCycle)?.id === id) return state
  if (!canHandOverCycle(state, by)) return state
  return setCycleOwner(state, id)
}
