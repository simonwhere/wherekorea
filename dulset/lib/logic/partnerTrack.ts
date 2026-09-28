// The partner's track (남편 트랙, N7) — pure.
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
//   Wording follows the viewer's fertilityVoice: "가임력 검사" only for an
//   explicit viewer; soft / calm viewers read "임신 전 검사" (the roadmap's own
//   name for the 임신 사전건강관리 check), so no fertility word reaches them.
// • What the partner may see of the cycle (shareCycleDetails) — only the person
//   whose cycle it is changes it.

import { diffDays, formatKo } from '../dates'
import type { AppState, ISODate, MemberId } from '../types'
import { ageFromBirthYear } from './notifications'
import { OVERDUE_GRACE_DAYS, monthsEnd, planItems, tickItem, type PlanItem } from './plan'
import { canLogCycle } from './prefs'
import { setCycleOwner } from './settings'
import { fertilityVoice, isSpermSide } from './today'

// ── 가임력 검사 chain ───────────────────────────────────────

/** 임신 사전건강관리 검사 지원 신청 (roadmap template, who: both). */
export const FERTILITY_APPLY_ID = 'pre-health-check-support'
/** 임신 전 검사 (정액·감염병) (roadmap template, who: partner). */
export const FERTILITY_TEST_ID = 'pre-checkup-partner'
/** planDone key for "검사비 청구했어요" — a step with no roadmap row of its own. */
export const FERTILITY_CLAIM_ID = 'pre-health-check-claim'
/** 신청 후 3개월 안에 검사, 검사 후 1개월 안에 청구 (e보건소, research kr-programs.json). */
export const TEST_WITHIN_MONTHS = 3
export const CLAIM_WITHIN_MONTHS = 1

export type FertilityStep = 'apply' | 'test' | 'claim' | 'done'

export interface FertilityChain {
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

/** Where the couple is in 신청 → 검사 → 청구, read from the roadmap ticks. */
export function fertilityChain(state: Pick<AppState, 'planDone'>, today: ISODate): FertilityChain {
  const appliedAt = state.planDone[FERTILITY_APPLY_ID]?.at
  const testedAt = state.planDone[FERTILITY_TEST_ID]?.at
  const claimedAt = state.planDone[FERTILITY_CLAIM_ID]?.at
  const testBy = appliedAt ? monthsEnd(appliedAt, TEST_WITHIN_MONTHS) : undefined
  // Tested before applying (소급 불가) or after the 3-month window: not covered,
  // so there's nothing to claim.
  const covered = !!appliedAt && !!testedAt && !!testBy && testedAt >= appliedAt && testedAt <= testBy
  const claimBy = covered ? monthsEnd(testedAt!, CLAIM_WITHIN_MONTHS) : undefined
  const base = { appliedAt, testedAt, claimedAt, testBy, claimBy }
  if (!appliedAt) return { ...base, step: testedAt ? 'done' : 'apply', lapsed: false }
  if (!testedAt) return { ...base, step: 'test', lapsed: !!testBy && today > testBy }
  if (claimBy && !claimedAt) return { ...base, step: 'claim', lapsed: today > claimBy }
  return { ...base, step: 'done', lapsed: false }
}

/** Mark "검사비 청구했어요" (or undo it). */
export function setFertilityClaimed(state: AppState, done: boolean, today: ISODate, by: MemberId): AppState {
  const has = !!state.planDone[FERTILITY_CLAIM_ID]
  if (has === done) return state
  const planDone = { ...state.planDone }
  if (done) planDone[FERTILITY_CLAIM_ID] = { at: today, by }
  else delete planDone[FERTILITY_CLAIM_ID]
  return { ...state, planDone }
}

// ── 이번 달 할 일 ───────────────────────────────────────────

export interface MonthlyTask extends PlanItem {
  /** Set when the task is a step of the 가임력 검사 chain. */
  step?: Exclude<FertilityStep, 'done'>
  /** The step's deadline. */
  dueBy?: ISODate
  /** '검사 마감 12월 27일 (일) · 신청 후 3개월 안' */
  dueText?: string
  /** One sentence: why this, now. */
  why?: string
  /** Put it first on the partner's home (a live deadline, or the owner is 35+). */
  top: boolean
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

function chainTask(
  state: AppState,
  items: PlanItem[],
  chain: FertilityChain,
  member: MemberId,
  age35: boolean,
): MonthlyTask | undefined {
  const apply = items.find((i) => i.id === FERTILITY_APPLY_ID)
  const test = items.find((i) => i.id === FERTILITY_TEST_ID)
  const me = state.couple.members.find((m) => m.id === member)
  // "가임력" is a fertility word: only an explicit viewer reads it.
  const explicit = fertilityVoice(state.settings, member, canLogCycle(state, member)) === 'explicit'
  const checkName = explicit ? '가임력 검사' : '임신 전 검사'
  const testName = me && isSpermSide(me) ? '정액검사' : checkName
  switch (chain.step) {
    case 'apply': {
      if (!apply) return undefined
      // ASRM 2023: at 35+, see a doctor after 6 months of trying (medical.json).
      const why35 = age35 ? '35세 이상은 6개월 동안 소식이 없으면 병원 상담을 권해요(ASRM). 검사를 미리 받아 두면 든든해요. ' : ''
      return {
        ...apply,
        title: `${checkName} 지원 신청하기`,
        step: 'apply',
        why: `${why35}검사 전에 e보건소나 보건소에서 먼저 신청해야 지원돼요. 먼저 검사하면 지원받을 수 없어요. ${NOTE}`,
        top: age35,
      }
    }
    case 'test': {
      const base = test ?? apply
      if (!base || !chain.testBy) return undefined
      return {
        ...base,
        title: `${testName} 받기`,
        status: chain.lapsed ? 'overdue' : 'now',
        end: chain.testBy,
        deadline: true,
        lapsed: false,
        step: 'test',
        dueBy: chain.testBy,
        dueText: chain.lapsed
          ? '신청 후 3개월이 지났어요 · 보건소에 다시 확인해요'
          : `검사 마감 ${formatKo(chain.testBy)} · 신청 후 3개월 안`,
        why: `신청 후 3개월 안에 참여 의료기관에서 검사해요. ${NOTE}`,
        top: true,
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
        step: 'claim',
        dueBy: chain.claimBy,
        dueText: chain.lapsed
          ? '검사 후 1개월이 지났어요 · 보건소에 확인해요'
          : `청구 마감 ${formatKo(chain.claimBy)} · 검사 후 1개월 안`,
        why: `검사 후 1개월 안에 e보건소나 보건소에 청구해요. ${NOTE}`,
        top: true,
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
 * Preparing, for the partner (not the cycle owner): the 가임력 검사 chain comes
 * first — a step with a live deadline (검사·청구) always, and the application
 * too when the owner is 35+ (then `top`). Otherwise their own open preparing
 * items (partner-only before shared), where the application stands in for the
 * 정액검사 row. Other stages / the owner: open items, most urgent first.
 */
export function monthlyTask(state: AppState, today: ISODate, member: MemberId): MonthlyTask | undefined {
  const items = planItems(state, today)
  const open = items.filter(
    (i) => i.status !== 'done' && !i.lapsed && !i.pending && i.owners.includes(member) && !NOT_MONTHLY.has(i.id),
  )
  const isPartner = !canLogCycle(state, member)
  if (state.stage !== 'preparing' || !isPartner) {
    const first = [...open].sort((a, b) => rank(a, member) - rank(b, member))[0]
    return first ? { ...first, top: false } : undefined
  }

  const age = ownerAge(state, today)
  const age35 = age !== undefined && age >= 35
  const chain = fertilityChain(state, today)
  const task = chainStale(chain, today) ? undefined : chainTask(state, items, chain, member, age35)
  if (task && (task.step !== 'apply' || age35)) return task

  // The chain's rows are represented by `task` (or finished / not applicable).
  const rest = open
    .filter((i) => i.id !== FERTILITY_APPLY_ID && i.id !== FERTILITY_TEST_ID)
    .sort((a, b) => rank(a, member) - rank(b, member))
  const first = rest[0]
  // The application stands in for the partner's own 정액검사 row (rank 3).
  if (task && (!first || rank(first, member) >= 3)) return task
  return first ? { ...first, top: false } : task
}

/**
 * Complete a month task the way its step is recorded (신청·검사 → roadmap tick,
 * 청구 → claim mark). `done = false` undoes it the same way (the toast's 되돌리기).
 * Idempotent: completing twice keeps the first date.
 */
export function completeMonthlyTask(
  state: AppState,
  task: Pick<MonthlyTask, 'id' | 'step'>,
  today: ISODate,
  by: MemberId,
  done = true,
): AppState {
  if (task.step === 'apply') return tickItem(FERTILITY_APPLY_ID, done, today, by)(state)
  if (task.step === 'test') return tickItem(FERTILITY_TEST_ID, done, today, by)(state)
  if (task.step === 'claim') return setFertilityClaimed(state, done, today, by)
  return tickItem(task.id, done, today, by)(state)
}

// ── What the partner sees ───────────────────────────────────

/**
 * Share the cycle details (생리일·배테기·임테기 결과) with the partner, or keep
 * to "우리의 주간" only. Only the person whose cycle it is can change it.
 */
export function setShareCycleDetails(state: AppState, by: MemberId, share: boolean): AppState {
  if (!canLogCycle(state, by) || state.settings.shareCycleDetails === share) return state
  return { ...state, settings: { ...state.settings, shareCycleDetails: share } }
}

/**
 * Hand the cycle over to `id` (설정 › 두 사람). The sharing choice was the
 * previous owner's, about their own records, so it starts private again and the
 * new owner decides. No-op when `id` already tracks the cycle.
 */
export function handOverCycle(state: AppState, id: MemberId): AppState {
  if (state.couple.members.find((m) => m.tracksCycle)?.id === id) return state
  const next = setCycleOwner(state, id)
  return { ...next, settings: { ...next.settings, shareCycleDetails: false } }
}
