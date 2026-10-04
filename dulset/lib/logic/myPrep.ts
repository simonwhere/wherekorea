// 내 준비 (Now 3 N30) — the partner's own progress in one compact bar, on his
// app home (out of 더 보기) and on his no-install link. Pure.
//
// docs/positioning.md §4 #5: '생활 습관 D+40(약 3개월 중) · 이번 주 걷기 N/7 ·
// 검사 신청 ✓ → 검사 → 청구' — he is not only the one who helps, he has a
// preparation of his own. Every part reads HIS records only (his checks, his
// 검사 chain, his booking): nothing here changes with her cycle, so the bar
// can sit on every day of his screen (규칙 1). Each part shows only when it
// has something to say — never a 0, never '안 했어요', never '다시 시작 전'
// (규칙 2) — and the whole bar rests through the quiet after a pregnancy
// ended, like the rest of his week (weekTogether.weekQuiet).
//
// The link track renders the same object (lib/logic/partnerSnapshot →
// components/link): keep the name `myPrep` and the field names.

import { diffDays, formatKo, isISODate } from '../dates'
import type { AppState, ISODate, MemberId } from '../types'
import { weekCount, weekCountLabel } from './checks'
import { fertilityChain, testIdFor, type FertilityChain, type TaskStage } from './partnerTrack'
import { OVERDUE_GRACE_DAYS, stepAppointment } from './plan'
import { canLogCycle } from './prefs'
import { habitTimer, isSpermSide } from './today'
import { partnerTaskVisible } from './ttcFlow'
import { weekQuiet } from './weekTogether'

export type PrepStepId = 'apply' | 'test' | 'claim'

export interface PrepStep {
  id: PrepStepId
  /** 신청 · 검사 · 청구 */
  label: string
  state: 'done' | 'now' | 'next'
}

export interface MyPrep {
  /**
   * The ~3-month habit timer while it counts ('생활 습관 D+40 · 약 3개월 중'),
   * or once it has passed ('생활 습관 약 3개월을 채웠어요'). Undefined before his
   * first habit check, after a long gap (no '다시 시작 전' here — 더 보기's
   * timer card explains a restart), and for a partner who is not the sperm
   * side (today.isSpermSide: the timer is about sperm formation).
   */
  timerLabel?: string
  /** The timer's progress, 0–1 (set with timerLabel). */
  timerProgress?: number
  /** '이번 주 N/7' — days this week his daily checks were all done; only when N > 0. */
  weekCount?: string
  /**
   * His 이번 달 할 일 step in a few words, once a step is done: '신청 ✓ · 다음은
   * 검사 예약', '신청 ✓ · 검사 예약 10월 8일', '신청 ✓ · 검사 다녀왔어요?',
   * '검사 ✓ · 다음은 청구', '신청·검사·청구 ✓'. Undefined before the first
   * step, while his month task rests (ttcFlow.partnerTaskVisible), and once a
   * lapsed step has gone quiet.
   */
  chainStep?: string
  /** 신청 → 검사 → 청구 with what is done, set with chainStep (after an application). */
  chainSteps?: PrepStep[]
}

const STEP_LABEL: Record<PrepStepId, string> = { apply: '신청', test: '검사', claim: '청구' }

/** Is there anything to draw (any part set)? */
export function hasMyPrep(p: MyPrep): boolean {
  return !!(p.timerLabel || p.weekCount || p.chainStep)
}

function timerPart(state: AppState, member: MemberId, today: ISODate): Pick<MyPrep, 'timerLabel' | 'timerProgress'> {
  const me = state.couple.members.find((m) => m.id === member)
  if (!me || !isSpermSide(me)) return {}
  const t = habitTimer(state, member, today)
  if (t.state === 'reached') return { timerLabel: '생활 습관 약 3개월을 채웠어요', timerProgress: 1 }
  if (t.state === 'not-started' || t.day === undefined) return {}
  return { timerLabel: `생활 습관 ${t.label} · 약 3개월 중`, timerProgress: t.progress }
}

/** The test step's stage, as the month task card reads it (partnerTrack chainTask). */
function testStage(state: AppState, member: MemberId, today: ISODate): { stage: TaskStage; date?: ISODate } {
  const a = stepAppointment(state.appointments, testIdFor(state, member), today)
  if (!a) return { stage: 'book' }
  return a.date > today ? { stage: 'booked', date: a.date } : { stage: 'visited', date: a.date }
}

/** A lapsed step stops being his month task a month after its deadline (partnerTrack.monthlyTask's rule). */
function stale(chain: FertilityChain, today: ISODate): boolean {
  if (!chain.lapsed) return false
  const due = chain.step === 'test' ? chain.testBy : chain.claimBy
  return !!due && diffDays(due, today) > OVERDUE_GRACE_DAYS
}

function steps(chain: FertilityChain): PrepStep[] {
  const done: Record<PrepStepId, boolean> = { apply: !!chain.appliedAt, test: !!chain.testedAt, claim: !!chain.claimedAt }
  const ids: PrepStepId[] = ['apply', 'test', 'claim']
  return ids.map((id) => ({ id, label: STEP_LABEL[id], state: done[id] ? 'done' : chain.step === id ? 'now' : 'next' }))
}

function chainPart(state: AppState, member: MemberId, today: ISODate): Pick<MyPrep, 'chainStep' | 'chainSteps'> {
  if (!partnerTaskVisible(state, today, member)) return {}
  const chain = fertilityChain(state, today, member)
  if (chain.step === 'apply' || stale(chain, today)) return {}
  const day = (d: ISODate) => formatKo(d, { weekday: false })
  let text: string | undefined
  if (chain.step === 'test') {
    if (chain.lapsed) text = '신청 ✓ · 보건소에 다시 확인해요'
    else {
      const t = testStage(state, member, today)
      text =
        t.stage === 'book'
          ? '신청 ✓ · 다음은 검사 예약'
          : t.stage === 'booked'
            ? `신청 ✓ · 검사 예약 ${day(t.date!)}`
            : '신청 ✓ · 검사 다녀왔어요?'
    }
  } else if (chain.step === 'claim') {
    text = chain.lapsed ? '검사 ✓ · 보건소에 확인해요' : '검사 ✓ · 다음은 청구'
  } else if (chain.appliedAt && chain.testedAt && chain.claimedAt) text = '신청·검사·청구 ✓'
  else if (chain.appliedAt && chain.testedAt) text = '신청·검사 ✓'
  else if (chain.testedAt) text = '검사 ✓'
  if (!text) return {}
  return { chainStep: text, ...(chain.appliedAt ? { chainSteps: steps(chain) } : {}) }
}

/**
 * 내 준비 for `member` on `today`: the habit timer, this week's N/7 and his 검사
 * chain step — each only when it has something to say. Empty ({}) for the
 * person whose cycle it is, outside the preparing stage and through the quiet
 * after a pregnancy ended. Reads only his own records.
 */
export function myPrep(state: AppState, today: ISODate, member: MemberId): MyPrep {
  if (state.stage !== 'preparing' || !isISODate(today) || canLogCycle(state, member) || weekQuiet(state, today)) return {}
  const n = weekCount(state, member, today)
  return {
    ...timerPart(state, member, today),
    ...(n > 0 ? { weekCount: weekCountLabel(n) } : {}),
    ...chainPart(state, member, today),
  }
}
