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
//
// 2026-11-01 (founder, '12개 전부'): two more parts, both inside the bar so his
// home never grows a second card — `season`, 올해 독감 접종 맞기 while its
// window is open (lib/logic/partnerDates: 10월–12월 preparing, 10월–4월
// pregnant; ticked here under this 절기's key, gone after the window, never
// '지났어요'), and `retire`, asked once per pregnancy: his sauna / laptop rows
// were for sperm formation — put them down? (checks.heatChecks; [내려놓기]
// archives them, [그대로 두기] keeps them; decisions 'retire-asked:<lmp>:<member>').
// 배우자 출산휴가 before the birth reads '출생 후 120일 안' (PrepItem.untilText):
// its last day counts from the real birth day, so no date is printed for it.

import { diffDays, formatKo, isISODate } from '../dates'
import { decide, decided } from '../sync/model'
import type { AppState, ISODate, MemberId } from '../types'
import { withAppointmentsFor } from './appointments'
import { archiveCheckItems, heatChecks, heatChecksQuestion, weekCount, weekCountLabel } from './checks'
import { PARTNER_FLU_ID, openFluWindow } from './partnerDates'
import { fertilityChain, testIdFor, type FertilityChain, type TaskStage } from './partnerTrack'
import { OVERDUE_GRACE_DAYS, planItems, stepAppointment, tickItem, usablePregnancy, type PlanItem } from './plan'
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
  /**
   * The seasonal row (2026-11-01): 올해 독감 접종 맞기, while its window is open
   * (10월–12월 preparing, 10월–4월 pregnant — lib/logic/partnerDates). At most
   * one such line; it never reads 0, '안 했어요' or '지났어요' — after the
   * window it is simply not there. Ticked with setPrepSeasonDone.
   */
  season?: PrepSeason
  /**
   * Pregnant stage, once (2026-11-01): his sauna / laptop rows were for
   * sperm formation — [내려놓기] retireHeatChecks · [그대로 두기] keepHeatChecks.
   * Lives inside 내 준비, never a card of its own.
   */
  retire?: PrepRetire
}

/** 내 준비's seasonal line (MyPrep.season). */
export interface PrepSeason {
  /** The roadmap row: 'partner-flu'. */
  id: string
  /** '올해 독감 접종 맞기' (the roadmap title). */
  label: string
  /** '독감은 매년 가을에 맞아요. 비용은 병원마다 달라요.' (the roadmap detail). */
  note: string
  /** Ticked this 절기 (planDone 'partner-flu:2026-27'). */
  done: boolean
}

/** The one-time question about his preparing-only rows (MyPrep.retire). */
export interface PrepRetire {
  /** '사우나·노트북 체크는 임신 준비용이었어요. 내려놓을까요?' (checks.heatChecksQuestion). */
  question: string
  /** The rows [내려놓기] archives. */
  itemIds: string[]
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
  /** An open window whose end waits on the birth: '출생 후 120일 안' (배우자 출산휴가 before the birth). */
  untilText?: string
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
  return !!(p.timerLabel || p.weekCount || p.chainStep || p.items?.length || p.season || p.retire)
}

function timerPart(state: AppState, member: MemberId, today: ISODate): Pick<MyPrep, 'timerLabel' | 'timerProgress'> {
  const me = state.couple.members.find((m) => m.id === member)
  if (!me || !isSpermSide(me)) return {}
  const t = habitTimer(state, member, today)
  if (t.state === 'reached') return { timerLabel: '생활 습관 3개월을 채웠어요', timerProgress: 1 }
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
    // 배우자 출산휴가 before the birth: its end counts from the real birth day, so it says so in words.
    const untilText = !ahead && !it.end && it.endWhen ? it.endWhen : undefined
    out.push({
      id: p.id,
      label: p.label,
      state,
      ...(ahead ? { from: it.start } : {}),
      ...(until ? { until } : {}),
      ...(untilText ? { untilText } : {}),
    })
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
      : next.untilText
        ? ` (${next.untilText})`
        : ''
  const head = done > 0 ? `${done}/${items.length} ✓ · ` : ''
  return `${head}다음은 ${next.label}${when}`
}

// ── The seasonal line and the one-time question (2026-11-01) ──

/** 올해 독감 접종 맞기 while its window is open in this stage, for the person it belongs to. */
export function prepSeason(state: AppState, today: ISODate, member: MemberId): PrepSeason | undefined {
  if (state.stage !== 'preparing' && state.stage !== 'pregnant') return undefined
  if (!openFluWindow(state.stage, today)) return undefined
  const it = planItems(state, today).find((i) => i.id === PARTNER_FLU_ID)
  if (!it || !it.owners.includes(member)) return undefined
  return { id: PARTNER_FLU_ID, label: it.title, note: it.detail ?? '', done: it.status === 'done' }
}

/** Tick (or untick) 올해 독감 접종 from 내 준비 — under this 절기's key (plan.tickItem → 'partner-flu:2026-27'). */
export function setPrepSeasonDone(state: AppState, today: ISODate, member: MemberId, done: boolean): AppState {
  return tickItem(PARTNER_FLU_ID, done, today, member)(state)
}

/** decisions key: he answered the sauna / laptop question for this pregnancy (its LMP). */
export const retireAskedKey = (lmp: ISODate, member: MemberId): string => `retire-asked:${lmp}:${member}`

/**
 * The question about his sauna / laptop rows: pregnant stage, a usable
 * pregnancy, the person who is not pregnant, at least one such active row,
 * and not answered for this pregnancy yet. (myPrep already rests for her
 * and in the quiet.)
 */
export function prepRetire(state: AppState, today: ISODate, member: MemberId): PrepRetire | undefined {
  if (state.stage !== 'pregnant' || !isISODate(today)) return undefined
  const p = usablePregnancy(state.pregnancy)
  if (!p || p.lmp > today || decided(state, retireAskedKey(p.lmp, member))) return undefined
  const rows = heatChecks(state, member)
  if (!rows.length) return undefined
  return { question: heatChecksQuestion(rows), itemIds: rows.map((r) => r.id) }
}

/** [내려놓기]: archive those rows (history kept) and remember the answer, so it is never asked again this pregnancy. */
export function retireHeatChecks(state: AppState, today: ISODate, member: MemberId): AppState {
  const ask = prepRetire(state, today, member)
  const p = usablePregnancy(state.pregnancy)
  if (!ask || !p) return state
  return decide(archiveCheckItems(state, ask.itemIds, today), retireAskedKey(p.lmp, member), today)
}

/** [그대로 두기]: the rows stay; the question does not come back this pregnancy. */
export function keepHeatChecks(state: AppState, today: ISODate, member: MemberId): AppState {
  const p = usablePregnancy(state.pregnancy)
  if (!p || !prepRetire(state, today, member)) return state
  return decide(state, retireAskedKey(p.lmp, member), today)
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
  // His own bar: only the bookings he may see (never her '나만 보기' one).
  state = withAppointmentsFor(state, member)
  const n = weekCount(state, member, today)
  const week = n > 0 ? { weekCount: weekCountLabel(n) } : {}
  const s = prepSeason(state, today, member)
  const season = s ? { season: s } : {}
  if (state.stage === 'pregnant') {
    const items = pregnantPrepItems(state, today)
    const line = pregnantPrepLine(items, today)
    const r = prepRetire(state, today, member)
    return { ...week, ...(line ? { chainStep: line, items } : {}), ...season, ...(r ? { retire: r } : {}) }
  }
  if (state.stage !== 'preparing') return {}
  return {
    ...timerPart(state, member, today),
    ...week,
    ...chainPart(state, member, today),
    ...season,
  }
}
