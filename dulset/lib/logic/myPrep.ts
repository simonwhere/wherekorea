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
//
// While pregnant (founder request 2026-10-09: 같이 하는 거야) his 내 준비 is
// his own pregnancy-stage items from 챙길 것 (PREGNANT_PREP_IDS: 배우자 지원
// 제도, Tdap 접종, 배우자 출산휴가 20일, 육아휴직 계획, 카시트) — `items` with
// each one's state, and the same compact line in `chainStep` (so the bar
// already drawn on his app home and on the link shows it as it is): '다음은
// 배우자 지원 제도 살펴보기', '2/5 ✓ · 다음은 Tdap 접종 (12월 1일부터)', '5개 모두
// 챙겼어요 ✓'. Never a 0: before the first one is done the line names the next
// one, not a count. The habit timer is a preparing thing (sperm formation) and
// does not show then; his daily checks' N/7 still does.

import { diffDays, formatKo, isISODate } from '../dates'
import type { AppState, ISODate, MemberId } from '../types'
import { weekCount, weekCountLabel } from './checks'
import { fertilityChain, testIdFor, type FertilityChain, type TaskStage } from './partnerTrack'
import { OVERDUE_GRACE_DAYS, planItems, stepAppointment, type PlanItem } from './plan'
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
  /**
   * Pregnant stage: his own items (PREGNANT_PREP_IDS) in order, each with its
   * state — 'done', 'now' (its time has come), 'next' (the first one still
   * ahead) or 'later'. The summary line is chainStep.
   */
  items?: PrepItem[]
}

export interface PrepItem {
  /** The roadmap template id. */
  id: string
  /** '배우자 지원 제도 살펴보기' */
  label: string
  state: 'done' | 'now' | 'next' | 'later'
  /** The day its window opens, when that is ahead. */
  from?: ISODate
  /** The day an open window closes. */
  until?: ISODate
}

/**
 * His own pregnancy-stage items in 챙길 것 — the ones that are his alone
 * ('partner') and the shared ones he usually takes on — with the short label
 * his 내 준비 uses. Their order here is the order when no date tells otherwise.
 */
export const PREGNANT_PREP: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'p1-partner-support', label: '배우자 지원 제도 살펴보기' },
  { id: 'p3-parental-leave', label: '육아휴직 계획 세우기' },
  { id: 'p3-car-seat', label: '카시트 설치하기' },
  { id: 'p3-partner-tdap', label: 'Tdap 접종' },
  { id: 'birth-partner-leave', label: '배우자 출산휴가 20일' },
]
export const PREGNANT_PREP_IDS: readonly string[] = PREGNANT_PREP.map((p) => p.id)

const STEP_LABEL: Record<PrepStepId, string> = { apply: '신청', test: '검사', claim: '청구' }

/** Is there anything to draw (any part set)? */
export function hasMyPrep(p: MyPrep): boolean {
  return !!(p.timerLabel || p.weekCount || p.chainStep || p.items?.length)
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

// ── Pregnant: his own items ────────────────────────────────

const ITEM_RANK: Record<PlanItem['status'], number> = { overdue: 0, now: 0, soon: 1, later: 2, undated: 0, done: 3 }

/** His pregnancy-stage items as 내 준비 shows them (PREGNANT_PREP), done ones first in their own order. */
export function pregnantPrepItems(state: AppState, today: ISODate): PrepItem[] {
  const byId = new Map(planItems(state, today).map((i) => [i.id, i]))
  const rows = PREGNANT_PREP.map((p, idx) => ({ p, it: byId.get(p.id), idx })).filter(
    (x): x is { p: (typeof PREGNANT_PREP)[number]; it: PlanItem; idx: number } => !!x.it,
  )
  // Open ones by when they come up: what is open now (or has no date), then by the day it opens.
  const openDay = (it: PlanItem): string => (it.status === 'soon' || it.status === 'later' ? (it.start ?? '9999-12-31') : '0000-00-00')
  const open = rows
    .filter((x) => x.it.status !== 'done')
    .sort((a, b) => ITEM_RANK[a.it.status] - ITEM_RANK[b.it.status] || openDay(a.it).localeCompare(openDay(b.it)) || a.idx - b.idx)
  let nextGiven = false
  const out: PrepItem[] = rows
    .filter((x) => x.it.status === 'done')
    .map((x) => ({ id: x.p.id, label: x.p.label, state: 'done' as const }))
  for (const { p, it } of open) {
    const ahead = !!it.start && it.start > today
    const state: PrepItem['state'] = !ahead ? 'now' : nextGiven ? 'later' : 'next'
    if (state === 'next') nextGiven = true
    const until = !ahead && it.status !== 'undated' && it.end && !it.lapsed && it.end >= today ? it.end : undefined
    out.push({ id: p.id, label: p.label, state, ...(ahead ? { from: it.start } : {}), ...(until ? { until } : {}) })
  }
  return out
}

/** The 내 준비 line while pregnant: what is next, with a count only once something is done (never 0). */
export function pregnantPrepLine(items: readonly PrepItem[], today: ISODate): string | undefined {
  if (!items.length) return undefined
  const done = items.filter((i) => i.state === 'done').length
  if (done === items.length) return `${items.length}개 모두 챙겼어요 ✓`
  const next = items.find((i) => i.state === 'now') ?? items.find((i) => i.state === 'next') ?? items.find((i) => i.state !== 'done')!
  const when = next.from
    ? ` (${formatKo(next.from, { weekday: false })}부터)`
    : next.until
      ? ` (${formatKo(next.until, { weekday: false })}까지)`
      : ''
  const head = done > 0 ? `${done}/${items.length} ✓ · ` : ''
  return `${head}다음은 ${next.label}${when}`
}

/**
 * 내 준비 for `member` on `today`. While preparing: the habit timer, this
 * week's N/7 and his 검사 chain step — each only when it has something to
 * say. While pregnant: this week's N/7 and his own pregnancy-stage items
 * (`items`, summed up in `chainStep`). Empty ({}) for the person whose cycle
 * it is, in the parenting stage and through the quiet after a pregnancy
 * ended. Reads only his own records and the shared plan.
 */
export function myPrep(state: AppState, today: ISODate, member: MemberId): MyPrep {
  if (!isISODate(today) || canLogCycle(state, member) || weekQuiet(state, today)) return {}
  const n = weekCount(state, member, today)
  const week = n > 0 ? { weekCount: weekCountLabel(n) } : {}
  if (state.stage === 'pregnant') {
    const items = pregnantPrepItems(state, today)
    const line = pregnantPrepLine(items, today)
    return { ...week, ...(line ? { chainStep: line, items } : {}) }
  }
  if (state.stage !== 'preparing') return {}
  return {
    ...timerPart(state, member, today),
    ...week,
    ...chainPart(state, member, today),
  }
}
