// The home screen's "moment" for couples trying to conceive (pure, tested).
//
// One place decides where the couple is in the cycle today and what each
// person sees about it (docs/review-preconception.md, "임신 준비 중심 화면
// 구조 제안"):
//   • the cycle owner sees her own details and ONE action (LH 기록, 생리 시작
//     기록, 테스트 결과 기록, 병원 일정 넣기 …)
//   • the partner sees period days / LH / test results only when she shares
//     them (canSeeCycleDetails); otherwise the shared "우리의 주간" and a
//     gentle line — plus what she chose to tell (period started, a positive test)
//   • soft / off alert styles and low-pressure mode keep 가임기·배란·LH wording
//     off that person's screen (moment card and strip); a partner without the
//     shared details gets "우리의 주간" wording even if he chose explicit
//     (homeVoice — the calendar's cycleLens rule)
//   • a rest cycle and a positive test awaiting the clinic pause every fertile
//     display; an ended pregnancy gets a quiet support card instead — and the
//     42-day 'loss' quiet (ttc.startLossRest) keeps it first, with one
//     body-guidance line from docs/research/after-loss.json for the owner
//   • bleeding after a positive test (positivePending.bleedingSince, Next B)
//     is its own card: the lines come from docs/research/early-pregnancy-
//     bleeding.json (positiveBleeding.bleedingAdvice), the partner hears of it
//     only when she tells him, and nothing here says what it means
//   • 잠금화면 숨김을 홈 카드까지 (homeDiscreetFor): the card is veiled behind
//     '오늘의 우리' until that person taps it (VEIL_COPY)
// Predictions are always "예상"; nothing here is contraception or diagnosis.
// The marker "(예상)" appears at most ONCE per card (review D-1): the eyebrow
// carries it when it names a date or range; otherwise the title or the body
// does, once — never twice on one card (estimateMarks / oneEstimate).

import { FEEL_CHIPS, waitingWeekLine } from '../content/fertility'
import { addDays, addMonths, diffDays, formatKo, formatShort, isBetween, isISODate } from '../dates'
import type { LogKind } from '../logLauncher'
import { decide, decided, decisionDay, liveOnly } from '../sync/model'
import type {
  AppState,
  Appointment,
  ISODate,
  LHResult,
  MemberId,
  PersonalFeel,
  PositivePending,
  PregnancyTest,
  PregnancyTestResult,
  RestCycle,
} from '../types'
import { CLINIC_KIND_WORD, upcomingAppointments } from './appointments'
import {
  CLINIC_LABEL,
  LH_LABEL,
  confidenceLabel,
  cycleLens,
  peakLabel,
  showsLH,
  showsPeak,
  windowLabel,
  type FertilityView,
} from './calendarView'
import { mondayOf } from './checks'
import { sharedBandBefore, sharedWeek } from './cycleRing'
import { fertileHintsAllowed, partnerHintState } from './dateIdeas'
import { logPeriodStart } from './logs'
import {
  LH_LEAD_DAYS,
  LONG_LATE_DAYS,
  cycleAt,
  cycleStats,
  dayInfo,
  fertilityStatus,
  isSurge,
  noSurgeWait,
  ourWeekSoon,
  sortedStarts,
  strongestLH,
  type CycleConfidence,
  type CycleWindow,
  type ExpectedPeriod,
  type FertilityStatus,
  type NoSurgeWait,
} from './cycle'
import { PROMPTS } from './diary'
import { mergeNotices } from './notifications'
import { LATE_TEST_DAYS, PERIOD_DUE_COPY, dueRange } from './periodDue'
import { FEEL_LABEL, lastCycleFeels, personalDay } from './personalLog'
import { bleedingAdvice, isBleedingDuringPositive, type BleedingLineId } from './positiveBleeding'
import { canLogCycle, canSeeCycleDetails, canSeeWeekBand, lowPressureFor, settingsFor } from './prefs'
import { recentlyEnded } from './pregnancy'
import { sayForTold, sentSince, type SayLines, type ToldMoment } from './signals'
import { homeDiscreetFor } from './settings'
import { fertilityVoice, type FertilityVoice } from './today'
import { LIVE_VACCINE_REST_DAYS, activePositivePending, activeRest, endRestCycle, startRestCycle } from './ttc'
import { weekQuiet, weekTogetherOn } from './weekTogether'

// ── Where are we today (viewer-independent) ────────────────

export type MomentKind =
  | 'no-data'
  | 'period-early'
  | 'period'
  | 'before-fertile'
  | 'fertile'
  | 'tww'
  | 'late'
  | 'positive-pending'
  /** A positive test waiting for the clinic, and bleeding has started (positivePending.bleedingSince). */
  | 'positive-bleeding'
  | 'rest'
  /** A pregnancy ended: the quiet days (pregnancy.recentlyEnded) and/or the 'loss' rest (ttc.startLossRest). */
  | 'after-loss'

/** Period days 1–3: "수고했어요" first, next-window talk only from day 4. */
export const PERIOD_EARLY_DAYS = 3
/**
 * A period logged late (up to this day) still gets "수고했어요" and the one
 * question about telling the partner, until she answers it.
 */
export const PERIOD_ASK_DAYS = 7
/** The same lead as the log sheet's default chip (cycle.LH_LEAD_DAYS). */
export { LH_LEAD_DAYS }
/** After a negative test, try again 2–3 days later. */
export const RETEST_AFTER_DAYS: readonly [number, number] = [2, 3]

export interface RetestHint {
  /** The last test of this cycle (negative / faint). */
  tested: ISODate
  result: Exclude<PregnancyTestResult, 'positive'>
  from: ISODate
  to: ISODate
  /** today is on/after `from`. */
  due: boolean
}

export interface TtcPhase {
  kind: MomentKind
  status: FertilityStatus
  /** First day of the current cycle (latest logged period start on/before today). */
  cycleStart?: ISODate
  cycleDay?: number
  /** The expected period, a range (cycle.expectedPeriod) — tww and late. */
  due?: ExpectedPeriod
  /** today is inside the expected range (tww): the period may start any day. */
  dueNow?: boolean
  /** The first day of that range — the day a home test can tell (예상). */
  testDate?: ISODate
  /** today < testDate (a test may still read negative too early). */
  early?: boolean
  /** This cycle's estimated ovulation (tww: '배란 뒤 N일째'). */
  ovulation?: ISODate
  /** LH strips this cycle but no surge yet, within the wait past the window (cycle.noSurgeWait). */
  noSurge?: NoSurgeWait
  /** How far the calendar estimate can be trusted this cycle (cycle.CycleConfidence). */
  confidence?: CycleConfidence
  /** What it rests on, in words (calendarView.confidenceLabel) — may name LH. */
  basis?: string
  peak?: boolean
  fertileStart?: ISODate
  fertileEnd?: ISODate
  daysUntilFertile?: number
  daysLate?: number
  /** no-data because a pregnancy ended and no period has been logged since (past the quiet days). */
  paused?: boolean
  rest?: RestCycle
  pending?: PositivePending
  lastTest?: PregnancyTest
  retest?: RetestHint
  /** Strongest LH result logged today. */
  todayLH?: LHResult
  /** A surge (양성·가장 진함) today or yesterday: the best days (first positive + next). */
  recentSurge?: boolean
}

function lastStartOnOrBefore(state: Pick<AppState, 'periods'>, today: ISODate): ISODate | undefined {
  return [...sortedStarts(state.periods)].reverse().find((d) => d <= today)
}

/** The latest home test from `from` to `today` (by date, then time). */
export function latestTest(tests: readonly PregnancyTest[], from: ISODate | undefined, today: ISODate): PregnancyTest | undefined {
  const list = tests
    .filter((t) => (!from || t.date >= from) && t.date <= today)
    .sort((a, b) => (a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date < b.date ? -1 : 1))
  return list[list.length - 1]
}

/**
 * "다시 해 볼 날" after a negative (or faint) test: 2–3 days later — or the
 * expected period day if that comes first.
 */
export function retestHint(last: PregnancyTest | undefined, expected: ISODate | undefined, today: ISODate): RetestHint | undefined {
  if (!last || last.result === 'positive') return undefined
  let from = addDays(last.date, RETEST_AFTER_DAYS[0])
  let to = addDays(last.date, RETEST_AFTER_DAYS[1])
  if (expected && expected > last.date && expected < from) {
    from = expected
    to = expected
  }
  return { tested: last.date, result: last.result, from, to, due: today >= from }
}

export function ttcPhase(state: AppState, today: ISODate): TtcPhase | null {
  if (state.stage !== 'preparing') return null
  const status = fertilityStatus(state, today)
  const cycleStart = lastStartOnOrBefore(state, today)
  const cycleDay = cycleStart ? diffDays(cycleStart, today) + 1 : undefined
  const todayLH = strongestLH(state.lhTests.filter((t) => t.date === today).map((t) => t.result))
  const recentSurge = state.lhTests.some((t) => isSurge(t.result) && (t.date === today || t.date === addDays(today, -1)))
  const stats = cycleStats(state.periods, state.cycle, state.lhTests, today, state.pregnancy)
  const base = {
    status,
    cycleStart,
    cycleDay,
    todayLH,
    recentSurge,
    confidence: stats.confidence,
    basis: confidenceLabel(stats.confidence, stats.count),
  }

  const pending = activePositivePending(state)
  if (pending) return { ...base, kind: pending.bleedingSince ? 'positive-bleeding' : 'positive-pending', pending }
  // The quiet after a pregnancy ended (a 'loss' rest with its last day, ttc.ts):
  // the support card stays first for the whole of it, a period logged inside
  // it included — and it ends on its own after `until`, or when she turns it off.
  const rest = activeRest(state, today)
  if (rest?.reason === 'loss') return { ...base, kind: 'after-loss', rest }
  if (status.kind === 'after-pregnancy') {
    return recentlyEnded(state, today) ? { ...base, kind: 'after-loss' } : { ...base, kind: 'no-data', paused: true }
  }
  if (status.kind === 'no-data') return { ...base, kind: 'no-data' }

  // Only a test taken after this cycle's estimated ovulation says anything about
  // this cycle (one taken during the period or before the window doesn't make
  // "다시 해 볼 날" due).
  const current = cycleStart ? cycleAt(state, cycleStart) : null
  const testsFrom = current ? addDays(current.ovulation, 1) : cycleStart
  const lastTest = latestTest(state.pregnancyTests ?? [], testsFrom, today)
  // A rest cycle pauses every date, the late day included: no "예정일이 지났어요"
  // (and no late / period-due notice — notifications.ts) until she logs a period.
  if (rest) return { ...base, kind: 'rest', rest }
  if (status.kind === 'late') {
    return {
      ...base,
      kind: 'late',
      daysLate: status.daysLate,
      due: status.due,
      testDate: status.due.from,
      early: false,
      lastTest,
      retest: retestHint(lastTest, status.due.from, today),
    }
  }

  switch (status.kind) {
    case 'period': {
      // Days 1–3, and a start logged late (up to day 7) while "알릴까요?" is unanswered.
      const early =
        status.cycleDay <= PERIOD_EARLY_DAYS ||
        (status.cycleDay <= PERIOD_ASK_DAYS && !!cycleStart && periodTellState(state, cycleStart) === 'ask')
      return {
        ...base,
        kind: early ? 'period-early' : 'period',
        cycleDay: status.cycleDay,
        fertileStart: status.nextFertileStart,
        fertileEnd: status.fertileEnd,
        daysUntilFertile: status.daysUntilFertile,
      }
    }
    case 'before-fertile':
      return {
        ...base,
        kind: 'before-fertile',
        cycleDay: status.cycleDay,
        fertileStart: status.fertileStart,
        daysUntilFertile: status.daysUntil,
      }
    case 'fertile':
      return { ...base, kind: 'fertile', cycleDay: status.cycleDay, peak: status.peak, fertileEnd: status.fertileEnd }
    case 'after-fertile':
      return {
        ...base,
        kind: 'tww',
        cycleDay: status.cycleDay,
        due: status.due,
        dueNow: status.dueNow,
        testDate: status.due.from,
        early: today < status.due.from,
        lastTest,
        retest: retestHint(lastTest, status.due.from, today),
        ...(current ? { ovulation: current.ovulation } : {}),
        ...(cycleStart ? { noSurge: noSurgeWait(state, cycleStart, today) } : {}),
      }
  }
}

// ── '아직 안 왔어요' (15 days or more past the range) ─────────

/** The day she answered '아직 안 왔어요' for the cycle starting on `cycleStart`, if she did. */
export function stillWaitingSince(state: Pick<AppState, 'cycleNotes'>, cycleStart: ISODate): ISODate | undefined {
  return state.cycleNotes?.[cycleStart]?.stillWaiting
}

/**
 * [아직 안 왔어요]: remember it on the cycle (cycleNotes[cycleStart].stillWaiting),
 * so the home keeps counting the day ('주기 N일째 · 길어지고 있어요') instead of
 * asking about a missed log. Same object when already answered or on a bad date.
 */
export function markStillWaiting(state: AppState, cycleStart: ISODate, today: ISODate): AppState {
  if (!isISODate(cycleStart) || !isISODate(today) || stillWaitingSince(state, cycleStart)) return state
  const note = { ...(state.cycleNotes?.[cycleStart] ?? {}), stillWaiting: today }
  return { ...state, cycleNotes: { ...(state.cycleNotes ?? {}), [cycleStart]: note } }
}

// ── What this viewer sees ───────────────────────────────────

export type MomentAction =
  | { type: 'log'; kind: LogKind; label: string }
  | { type: 'nav'; to: 'plan' | 'cycle' | 'date' | 'settings'; label: string }
  | { type: 'end-rest'; label: string }
  | { type: 'confirm-pregnancy'; label: string }
  /** [아직 안 왔어요] on the long-late card (markStillWaiting). */
  | { type: 'still-waiting'; label: string }
  /** [생리로 기록할게요] on the bleeding card: the bleeding day becomes a period start (settleBleedingAsPeriod). */
  | { type: 'period-settle'; label: string }

export type MomentCopyKey =
  | 'owner.no-data'
  | 'owner.paused'
  | 'owner.after-loss'
  | 'owner.positive-pending'
  | 'owner.positive-bleeding'
  | 'owner.late'
  | 'owner.late-long'
  | 'owner.late-waiting'
  | 'owner.period-due'
  | 'owner.rest'
  | 'owner.period-early'
  | 'owner.period'
  | 'owner.before-fertile'
  | 'owner.lh-start'
  | 'owner.fertile'
  | 'owner.calm'
  | 'owner.tww'
  | 'owner.tww-no-surge'
  | 'owner.retest'
  | 'owner.clinic'
  | 'partner.clinic'
  /** @deprecated Retired (N19): without her records the partner gets the '평소 주' card ('partner.neutral'). Kept so old snapshots still type-check. */
  | 'partner.no-data'
  /** The '평소 주' card (N19): the one card a partner without her details sees outside the shared window. */
  | 'partner.neutral'
  | 'partner.after-loss'
  | 'partner.positive-told'
  | 'partner.bleeding-told'
  | 'partner.period-told'
  | 'partner.period-shared'
  | 'partner.our-week-soon'
  | 'partner.our-week'
  | 'partner.tww'
  | 'partner.late-shared'

export type MomentTone = 'default' | 'brand' | 'fert' | 'muted'

export interface Moment {
  kind: MomentKind
  role: 'owner' | 'partner'
  copy: MomentCopyKey
  voice: FertilityVoice
  /** canSeeCycleDetails for this viewer. */
  details: boolean
  tone: MomentTone
  eyebrow?: string
  title: string
  body: string
  /** A quieter second line (evidence, a caveat). */
  note?: string
  primary?: MomentAction
  secondary?: MomentAction
  cycleDay?: number
  /** First day of the current cycle (for actions that write to it, e.g. still-waiting). */
  cycleStart?: ISODate
  /** The expected period range this card talks about (tww / late). */
  due?: ExpectedPeriod
  confidence?: CycleConfidence
  peak?: boolean
  testDate?: ISODate
  early?: boolean
  retest?: RetestHint
  daysLate?: number
  restReason?: RestCycle['reason']
  todayLH?: LHResult
  /** period-early, owner: ask once per cycle whether to tell the partner. */
  askTell?: { start: ISODate }
  /** positive-pending, owner: offer to tell the partner until told. */
  offerTellPositive?: { since: ISODate }
  /** positive-bleeding, owner: offer to tell the partner bleeding started, until told (tellPartnerBleeding). */
  offerTellBleeding?: { since: ISODate }
  /**
   * positive-bleeding, owner: the day bleeding started and the rest of the
   * evidence lines after the body (positiveBleeding.bleedingAdvice without
   * signs; the card re-reads it with the signs she ticks). Never set for the partner.
   */
  bleeding?: { since: ISODate; days: number; lines: string[]; lineIds: BleedingLineId[] }
  /** period-early, owner: this period settled a positive test that never reached the clinic (settledPositive). */
  afterPositive?: boolean
  /** after-loss, owner: the one body-guidance line with its source (afterLossGuidance). Never for the partner. */
  guidance?: AfterLossGuidance
  /** after-loss: the quiet's last day (restCycle.until) while the 'loss' rest is on. */
  restUntil?: ISODate
  /**
   * 잠금화면 숨김을 홈 카드까지 (settings.homeDiscreetFor): this person's card
   * shows VEIL_COPY until they tap it — everything else here is what sits behind.
   */
  veiled?: boolean
  /** Partner's "우리의 주간" card: show 2–3 date ideas inside it. */
  dateIdeas?: boolean
  /** Partner: the card may feature "이번 달 할 일" (lib/logic/partnerTrack). */
  monthlyTask?: boolean
  /**
   * Partner, the '평소 주' card (N21/N23): '이번 주 우리 둘' leads it — the
   * screen draws this week's pick (lib/logic/weekTogether: weekOptions /
   * weekPick / weekDone / thanksThisWeek) inside or right under the card. Set
   * only while the week runs (weekTogether.weekTogetherOn).
   */
  weekTogether?: boolean
  /** Quiet support after a pregnancy ended (LOSS_SUPPORT). */
  support?: boolean
  /** One thing the partner can do today. */
  partnerTip?: string
  /**
   * Partner, on a moment SHE SENT with [알리기] (her period, a positive test,
   * bleeding — N30): 해 줄 말 · 아껴 둘 말 and two one-tap answers
   * (signals.sayForTold), the day she told him (`since`) and the answer he
   * already sent since then (`sent`, a signal id — his own action). Never on
   * a card his screen could only read from her records.
   */
  say?: SayLines & { since: ISODate; sent?: string }
  /** Owner only: how she said today felt (오늘 컨디션, lib/logic/personalLog). Never set for the partner. */
  todayFeel?: PersonalFeel
  /** Owner only, period days 1–3: her feel chips from the cycle that just ended ('지난 주기 컨디션 N개'). */
  lastFeels?: LastFeels
}

export interface LastFeels {
  count: number
  /** The cycle they belong to (its logged start — the 주기 tab's row). */
  cycleStart: ISODate
}

// ── 기다리는 주: 오늘 컨디션 (N11) ──────────────────────────

/** The six chips of the 오늘 컨디션 panel (lib/content/fertility.ts FEEL_CHIPS). */
export { FEEL_CHIPS }

/** A feel as the owner's screen names it: the chip's wording, else personalLog's label. */
export function feelLabel(feel: PersonalFeel): string {
  return FEEL_CHIPS.find((c) => c.feel === feel)?.label ?? FEEL_LABEL[feel]
}

/**
 * Does the owner use LH strips — '써요' answered (settings.usesLH === true)?
 * Only then is 'LH 기록' the home card's action, and only inside the window
 * (N29, docs/positioning.md §5: 'LH 상세'). Unanswered, '나중에' and '안 써요'
 * get no LH action — and 오늘 컨디션 is never the action (it sits in the
 * 메모 panel's '자세히', components/log/NotePanel).
 */
export function usesLHNow(state: Pick<AppState, 'settings'>): boolean {
  return state.settings.usesLH === true
}

/**
 * '지난 주기 컨디션 N개' for the owner's period-day card: her feel chips from
 * the previous logged start up to the day before this one. Undefined without
 * a previous logged cycle or without any chip in it.
 */
export function lastFeelsFor(
  state: Pick<AppState, 'periods' | 'personalLog'>,
  owner: MemberId,
  cycleStart: ISODate,
): LastFeels | undefined {
  const prev = sortedStarts(state.periods)
    .filter((d) => d < cycleStart)
    .pop()
  if (!prev) return undefined
  const count = lastCycleFeels(state, owner, prev, addDays(cycleStart, -1)).length
  return count ? { count, cycleStart: prev } : undefined
}

// ── 병원과 함께 준비 중 (N13) ───────────────────────────────

/** The next appointment (not done, today or later) — what the clinic card leads with. */
export function nextClinicAppointment(state: Pick<AppState, 'appointments'>, today: ISODate): Appointment | undefined {
  return upcomingAppointments(liveOnly(state.appointments), today)[0]
}

/**
 * The next appointment the partner's side may name (N32): his own or one
 * they both go to ('둘이 함께') — never one of hers alone. The partner's
 * clinic card and the link's clinic week (partnerSnapshot.linkClinic) read
 * the same rule.
 */
export function nextPartnerClinicAppointment(state: Pick<AppState, 'appointments'>, today: ISODate, partner: MemberId): Appointment | undefined {
  return upcomingAppointments(
    liveOnly(state.appointments).filter((a) => a.who === 'both' || a.who === partner),
    today,
  )[0]
}

/** '오늘 08:00' · '내일' · '10월 8일 09:30' */
export function appointmentWhen(a: Pick<Appointment, 'date' | 'time'>, today: ISODate): string {
  const n = diffDays(today, a.date)
  const d = n === 0 ? '오늘' : n === 1 ? '내일' : formatKo(a.date, { weekday: false })
  return a.time ? `${d} ${a.time}` : d
}

/** The first ultrasound is usually from about 5 weeks after the last period's first day. */
export const ULTRASOUND_FROM_DAYS = 35

const LOG_PERIOD: MomentAction = { type: 'log', kind: 'period', label: '생리 시작 기록' }
const LOG_TEST: MomentAction = { type: 'log', kind: 'ptest', label: '테스트 결과 기록' }
const TO_CYCLE: MomentAction = { type: 'nav', to: 'cycle', label: '달력 보기' }

/** '10월 14일' */
const day = (d: ISODate) => formatKo(d, { weekday: false })

// ── "(예상)" once per card ───────────────────────────────────

/** The marker and its variants: '(예상)', '(예상 범위)', '(예상 범위, 넓음)'. */
export const ESTIMATE_MARK = /\s?\(예상[^)]*\)/g

/** How many "(예상)" markers a text carries. */
export function estimateMarks(text: string | undefined): number {
  return text ? (text.match(ESTIMATE_MARK) ?? []).length : 0
}

/** The text without its "(예상)" markers ('9월 29일 무렵이에요 (예상).' → '9월 29일 무렵이에요.'). */
export function withoutEstimate(text: string): string {
  return text.replace(ESTIMATE_MARK, '')
}

/** Every line a card shows, in reading order. */
const CARD_LINES = ['eyebrow', 'title', 'body', 'note', 'partnerTip'] as const

/**
 * Keep the first "(예상)" on the card (eyebrow → title → body → note → tip)
 * and drop the rest. The copy below is written to need no stripping; this is
 * the guard that keeps the rule when a shared line (periodDue.ts) carries
 * its own marker.
 */
function oneEstimate<M extends Partial<Pick<Moment, (typeof CARD_LINES)[number]>>>(m: M): M {
  let seen = 0
  let out: M | undefined
  for (const key of CARD_LINES) {
    const text = m[key]
    if (typeof text !== 'string') continue
    const n = estimateMarks(text)
    if (!n) continue
    if (seen === 0 && n === 1) {
      seen = 1
      continue
    }
    // A second marker (or two in one line): keep the first one only.
    const keep = seen === 0 ? 1 : 0
    let left = keep
    const stripped = text.replace(ESTIMATE_MARK, (mark) => (left-- > 0 ? mark : ''))
    seen = 1
    out = { ...(out ?? m), [key]: stripped }
  }
  return out ?? m
}

/** '10월 14일' or '10월 14일~15일'. */
export function retestRange(r: Pick<RetestHint, 'from' | 'to'>): string {
  if (r.from === r.to) return day(r.from)
  const sameMonth = r.from.slice(0, 7) === r.to.slice(0, 7)
  return `${day(r.from)}~${sameMonth ? `${Number(r.to.slice(8))}일` : day(r.to)}`
}

/** 음성 · 희미 · 양성 · 가장 진함 (the same labels as the calendar and the log sheet). */
export { LH_LABEL }

/** What to say (and not say) on the first days of a period — from the review. */
export const PERIOD_PARTNER_TIP = '‘고생했어’ 한마디면 충분해요. ‘다음 달엔 되겠지’ 같은 말은 잠시 아껴 둬요.'

export function cycleOwnerId(state: Pick<AppState, 'couple'>): MemberId {
  return (state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]).id
}

function nameOf(state: Pick<AppState, 'couple'>, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name ?? ''
}

/**
 * The wording this viewer gets on the home screen. Their own alert style and
 * low-pressure choice first; a partner without shared details never gets the
 * explicit 가임기 wording — only the shared "우리의 주간" (the same rule as the
 * calendar, calendarView.cycleLens) — and a partner she shares no dates with
 * ('날짜 없음', N23: prefs.canSeeWeekBand) gets no window wording at all.
 */
export function homeVoice(state: AppState, viewer: MemberId): FertilityVoice {
  const isOwner = viewer === cycleOwnerId(state)
  if (!isOwner && !canSeeWeekBand(state, viewer)) return 'calm'
  const own = fertilityVoice(settingsFor(state.settings, viewer), viewer, isOwner)
  return own === 'explicit' && !canSeeCycleDetails(state, viewer) ? 'soft' : own
}

/**
 * The quiet after a pregnancy ended, as the partner reads it: the whole 42
 * days (pregnancy.recentlyEnded) and the 'loss' rest (weekTogether.weekQuiet).
 * Both follow the stage change pregnant → preparing (today.endPregnancy is
 * the only place that starts the 'loss' rest), which both phones already
 * showed — so this changes his screen on nothing she did not tell. Her
 * turning the rest off early ends HER quiet; his card keeps it for the 42
 * days (otherwise that switch would show on his screen).
 */
export function partnerQuiet(state: AppState, today: ISODate): boolean {
  return state.stage === 'preparing' && weekQuiet(state, today)
}

/**
 * Does `partnerId`'s "이번 달 할 일" show (the home's card and the link's)?
 * Never for the person whose cycle it is, and never through the quiet after
 * a pregnancy ended (partnerQuiet) — that time is for each other, not for
 * tasks (docs/positioning.md §4 0번 B). The one rule for TodayTab and
 * partnerSnapshot.
 */
export function partnerTaskVisible(state: AppState, today: ISODate, partnerId: MemberId): boolean {
  if (canLogCycle(state, partnerId)) return false
  return !partnerQuiet(state, today)
}

/**
 * Where the card is drawn: the app's home ('app', the default) or the
 * partner's no-install link page ('link' — lib/logic/partnerSnapshot). The
 * words are the same except where the app's copy points to a screen the page
 * does not have (설정, the log sheet, a tab).
 */
export type MomentSurface = 'app' | 'link'

export function ttcMoment(state: AppState, today: ISODate, viewer: MemberId, opts: { surface?: MomentSurface } = {}): Moment | null {
  const phase = ttcPhase(state, today)
  if (!phase) return null
  const owner = cycleOwnerId(state)
  const isOwner = viewer === owner
  const voice = homeVoice(state, viewer)
  const details = canSeeCycleDetails(state, viewer)
  const ctx: Ctx = {
    state,
    today,
    phase,
    voice,
    details,
    lowPressure: lowPressureFor(state.settings, viewer),
    ownerName: nameOf(state, owner),
    partnerName: nameOf(state, owner === 'a' ? 'b' : 'a'),
    surface: opts.surface ?? 'app',
  }
  let m = isOwner ? ownerMoment(ctx) : partnerMoment(ctx)
  // The "우리의 주간" teaser and its date ideas follow the 둘만의 시간 rule too
  // (dateIdeas.fertileHintsAllowed: not in low-pressure mode or with alerts
  // off, not while resting or waiting for the clinic) — for a partner without
  // her details read through partnerHintState: his one window already stops
  // for a pause she started before it, and one she starts inside it must not
  // end it (cycleRing.sharedWeek).
  if (!fertileHintsAllowed(partnerHintState(state, viewer), viewer, today)) {
    if (m.copy === 'partner.our-week' || m.copy === 'partner.our-week-soon') m = partnerNeutral(ctx)
    else if (m.dateIdeas) m = { ...m, dateIdeas: false }
  }
  // 잠금화면 숨김을 홈 카드까지: the card waits behind VEIL_COPY for this person
  // (owner or partner), so the partner's month task goes to 우리 한 줄 instead.
  const veiled = homeDiscreetFor(state.settings, viewer)
  if (veiled && m.monthlyTask) m = { ...m, monthlyTask: false }
  m = oneEstimate(m)
  // Her cycle's day, first day and confidence are her records: only for her and
  // a partner she shares the details with (a partner's Moment carries nothing
  // the '평소 주' would not). `kind` stays the day's phase for the screens'
  // own branching (none of them renders it for a partner without details);
  // the partner's after-loss card reads as 'after-loss' (partnerQuiet).
  const internals = isOwner || details ? { cycleDay: phase.cycleDay, cycleStart: phase.cycleStart, confidence: phase.confidence } : {}
  return {
    kind: !isOwner && m.copy === 'partner.after-loss' ? 'after-loss' : phase.kind,
    voice,
    details,
    ...internals,
    ...m,
    ...(veiled ? { veiled: true } : {}),
  }
}

// partnerHintState — the state the 둘만의 시간 gate reads for a viewer — lives
// in ./dateIdeas (the #date banner and the link's ideas read it too, and
// dateIdeas cannot import this file); re-exported here for the screens.
export { partnerHintState } from './dateIdeas'

/**
 * What a veiled card shows (homeDiscreetFor): nothing about the cycle, the
 * test or the clinic — the same line for every moment, and one tap to see
 * what is behind it. Shared by both people's phones.
 */
export const VEIL_COPY = {
  eyebrow: '오늘의 우리',
  title: '오늘도 둘이 함께해요',
  body: '내용은 한 번 눌러서 볼 수 있어요.',
  action: '내용 보기',
} as const

interface Ctx {
  state: AppState
  today: ISODate
  phase: TtcPhase
  voice: FertilityVoice
  details: boolean
  lowPressure: boolean
  ownerName: string
  partnerName: string
  surface: MomentSurface
}

type MomentBody = Omit<Moment, 'kind' | 'voice' | 'details'>

function ownerMoment(c: Ctx): MomentBody {
  const { phase: p, voice, today } = c
  const role = 'owner' as const
  const d = p.cycleDay ?? 1
  switch (p.kind) {
    case 'no-data':
      return p.paused
        ? {
            role,
            copy: 'owner.paused',
            tone: 'brand',
            eyebrow: '기록 확인',
            title: '최근 생리 기록이 없어요',
            body: '생리가 다시 시작되면 기록해 주세요. 그때부터 다시 예상해 드릴게요.',
            primary: LOG_PERIOD,
          }
        : {
            role,
            copy: 'owner.no-data',
            tone: 'brand',
            eyebrow: '시작해 볼까요',
            title: '마지막 생리 시작일을 알려 주세요',
            body:
              voice === 'calm'
                ? '기록해 두면 생리 예정일을 예상해 드려요.'
                : voice === 'explicit'
                  ? '하나만 기록해도 예정일과 가임기를 예상해 드려요.'
                  : '하나만 기록해도 예정일과 우리의 주간을 예상해 드려요.',
            primary: LOG_PERIOD,
            secondary: { type: 'nav', to: 'cycle', label: '달력에서 고르기' },
          }

    case 'after-loss': {
      // The support list first, one body-guidance line (owner only), and the
      // quiet's last day while the 'loss' rest is on — a period logged inside
      // it is kept, the dates come back after `until` (or when she turns it off).
      const rest = p.rest?.reason === 'loss' ? p.rest : undefined
      const until = rest?.until
      const endedAt = lossEndedAt(c.state)
      const periodSince = !!endedAt && c.state.periods.some((x) => x.start > endedAt)
      const guidance = afterLossGuidance(c.state, today)
      return {
        role,
        copy: 'owner.after-loss',
        tone: 'muted',
        eyebrow: '천천히 괜찮아요',
        title: '몸과 마음을 먼저 챙겨요',
        body: until
          ? periodSince
            ? `생리를 기록해 뒀어요. ${day(until)}까지는 날짜 예상과 알림을 쉬고, 그 뒤에 다시 예상해 드릴게요.`
            : `생리가 시작되면 기록해 주세요. ${day(until)}까지는 날짜 예상과 알림을 쉬어요.`
          : '생리가 다시 시작되면 기록해 주세요. 그때부터 다시 예상해 드릴게요.',
        note: until ? '먼저 켜고 싶으면 더 보기의 쉬어요 스위치로 끌 수 있어요.' : undefined,
        secondary: periodSince ? TO_CYCLE : LOG_PERIOD,
        support: true,
        ...(guidance ? { guidance } : {}),
        ...(rest ? { restReason: 'loss' as const, restUntil: until } : {}),
      }
    }

    case 'positive-pending': {
      const since = p.pending!.since
      const told = decided(c.state, positiveToldKey(since))
      // Where to stand next: the first scan is usually around 5–6 weeks from the
      // last period's first day (docs/research/medical-checklist.json, 첫 산부인과
      // 방문), and folic acid continues (medical.json, Folic acid).
      const scanFrom = p.cycleStart ? day(addDays(p.cycleStart, ULTRASOUND_FROM_DAYS)) : undefined
      return {
        role,
        copy: 'owner.positive-pending',
        tone: 'brand',
        eyebrow: '테스트 양성 · 병원 확인 전',
        title: '병원에서 확인해 봐요',
        body: scanFrom
          ? `확인 전까지는 조심스럽게 기다려요. 보통 마지막 생리 시작일로부터 5~6주 무렵(${scanFrom}부터) 초음파로 확인해요 — 병원마다 달라요. 엽산은 그대로 이어 가요.`
          : '확인 전까지는 조심스럽게 기다려요. 보통 마지막 생리 시작일로부터 5~6주 무렵 초음파로 확인해요 — 병원마다 달라요. 엽산은 그대로 이어 가요.',
        primary: { type: 'nav', to: 'plan', label: '병원 일정 넣기' },
        secondary: { type: 'confirm-pregnancy', label: '병원에서 확인했어요' },
        ...(told ? {} : { offerTellPositive: { since } }),
      }
    }

    case 'positive-bleeding': {
      // Bleeding after the positive test, before the clinic: every line is an
      // evidence line (early-pregnancy-bleeding.json) — the first one the body,
      // the rest under the actions, where she can also tick the 응급 signs.
      // No 🎉, no 유산: the clinic is the one to say what it means.
      const pending = p.pending!
      const since = pending.bleedingSince!
      const advice = bleedingAdvice(c.state, today)
      const told = decided(c.state, bleedingToldKey(pending.since))
      return {
        role,
        copy: 'owner.positive-bleeding',
        tone: 'brand',
        eyebrow: '병원 확인 전',
        title: '출혈이 시작됐어요',
        body: advice.lines[0] ?? '',
        primary: { type: 'nav', to: 'plan', label: '병원에 연락하기' },
        secondary: { type: 'period-settle', label: '생리로 기록할게요' },
        bleeding: { since, days: advice.days ?? 0, lines: advice.lines.slice(1), lineIds: advice.lineIds.slice(1) },
        ...(told ? {} : { offerTellBleeding: { since: pending.since } }),
      }
    }

    case 'late': {
      const n = p.daysLate ?? 0
      const due = p.due!
      const start = p.cycleStart!
      const copy = PERIOD_DUE_COPY
      if (n > LONG_LATE_DAYS) {
        // Fifteen days or more past the range: a missed log is the likelier
        // story, so ask — unless she already said '아직 안 왔어요', then keep
        // counting the cycle (no "기록 누락" framing, no number of days for
        // when to be seen — the evidence has none; periodDue.ts).
        if (stillWaitingSince(c.state, start)) {
          return {
            role,
            copy: 'owner.late-waiting',
            tone: 'brand',
            eyebrow: copy.stillWaiting.eyebrow(d),
            title: copy.stillWaiting.title,
            body: copy.stillWaiting.body,
            note: copy.stillWaiting.note,
            primary: LOG_PERIOD,
            secondary: LOG_TEST,
            daysLate: n,
            due,
          }
        }
        return {
          role,
          copy: 'owner.late-long',
          tone: 'brand',
          eyebrow: '기록 확인',
          title: copy.missedLog.title,
          body: copy.missedLog.body(start),
          primary: LOG_PERIOD,
          secondary: { type: 'still-waiting', label: copy.missedLog.stillWaiting },
          daysLate: n,
          due,
        }
      }
      const r = p.retest
      const eyebrow = `생리 예정 ${dueRange(due)} (예상)`
      // The first days past the range are still ordinary: log it if it started.
      // The pregnancy test is the action from the test day on (N11), but the
      // card doesn't talk about testing until LATE_TEST_DAYS (or once she tested herself).
      if (!r && n < LATE_TEST_DAYS) {
        return {
          role,
          copy: 'owner.late',
          tone: 'brand',
          eyebrow,
          title: copy.lateTitleShort(n),
          body: '조금 늦어질 수 있어요. 시작하면 기록해 주세요.',
          primary: LOG_TEST,
          secondary: LOG_PERIOD,
          daysLate: n,
          testDate: p.testDate,
          due,
        }
      }
      return {
        role,
        copy: r ? 'owner.retest' : 'owner.late',
        tone: 'brand',
        eyebrow,
        title: copy.lateTitleShort(n),
        body: r
          ? r.due
            ? '오늘 다시 테스트해 볼 수 있어요.'
            : `다시 해 볼 날: ${retestRange(r)}`
          : '테스트해 볼까요? 생리가 시작됐다면 기록해 주세요.',
        note: r ? '생리가 시작되면 기록해 주세요.' : undefined,
        primary: LOG_TEST,
        secondary: LOG_PERIOD,
        daysLate: n,
        testDate: p.testDate,
        retest: r,
        due,
      }
    }

    case 'rest': {
      const reason = p.rest!.reason
      const backOn = day(addDays(p.rest!.since, LIVE_VACCINE_REST_DAYS))
      if (reason === 'clinic') return clinicMoment(c, role)
      return {
        role,
        copy: 'owner.rest',
        tone: 'muted',
        eyebrow: reason === 'vaccine' ? '접종 뒤 쉬어 가요' : '쉬어 가는 주기',
        title: '이번 주기는 쉬어요',
        body:
          reason === 'vaccine'
            ? '생백신을 맞은 뒤에는 MMR은 4주, 수두는 접종마다 1개월 동안 임신을 미루도록 안내해요.'
            : '날짜 예상과 알림을 잠시 쉬어요. 다음 생리를 기록하면 다시 켜져요.',
        note:
          reason === 'vaccine'
            ? `질병관리청·CDC 안내예요. ${backOn} 이후 첫 생리를 기록하면 다시 켜져요. 자세한 건 담당의와 확인하세요.`
            : undefined,
        primary: { type: 'end-rest', label: '다시 켜기' },
        restReason: reason,
      }
    }

    case 'period-early': {
      const start = p.cycleStart!
      // Her own chips from the cycle that just ended: a look back, no reading of them.
      const lastFeels = lastFeelsFor(c.state, cycleOwnerId(c.state), start)
      // This period settled a positive test that never reached the clinic
      // (settledPositive): a gentler line and the clinic as a place to ask —
      // no reading of what happened, no 유산.
      const afterPositive = !!settledPositive(c.state, start)
      return {
        role,
        copy: 'owner.period-early',
        tone: 'default',
        eyebrow: `생리 ${d}일째`,
        title: '이번 주기도 수고했어요',
        body: afterPositive
          ? '양성 뒤에 시작된 생리라 마음이 복잡할 수 있어요. 오늘은 몸을 따뜻하게 하고 푹 쉬어요.'
          : '오늘은 몸을 따뜻하게 하고 푹 쉬어요.',
        note: afterPositive ? '궁금하거나 걱정되는 게 있으면 다니는 병원에 물어봐도 돼요.' : undefined,
        ...(periodTellState(c.state, start) === 'ask' ? { askTell: { start } } : {}),
        ...(lastFeels ? { lastFeels } : {}),
        ...(afterPositive ? { afterPositive } : {}),
      }
    }

    case 'period': {
      const eyebrow = `생리 ${d}일째`
      if (voice !== 'calm' && p.fertileStart) {
        return {
          role,
          copy: 'owner.period',
          tone: 'default',
          eyebrow,
          title:
            voice === 'explicit'
              ? p.confidence === 'low'
                ? `다음 가임기는 ${day(p.fertileStart)} 무렵부터예요 (예상)`
                : `다음 가임기는 ${day(p.fertileStart)}부터예요 (예상)`
              : `다음 우리의 주간은 ${day(p.fertileStart)} 무렵이에요 (예상)`,
          body: '따뜻하게 쉬어요. 무리하지 않아도 괜찮아요.',
          secondary: TO_CYCLE,
        }
      }
      if (voice !== 'calm' && p.fertileEnd) {
        return {
          role,
          copy: 'owner.period',
          tone: 'default',
          eyebrow,
          title: '주기가 짧은 편이에요',
          body:
            voice === 'explicit'
              ? `예상 가임기(${day(p.fertileEnd)}까지)와 생리 기간이 겹쳐요.`
              : `이번엔 우리의 주간(${day(p.fertileEnd)}까지, 예상)과 겹쳐요.`,
          secondary: TO_CYCLE,
        }
      }
      return {
        role,
        copy: 'owner.period',
        tone: 'default',
        eyebrow,
        title: `생리 ${d}일째예요`,
        body: '따뜻하게 쉬어요. 무리하지 않아도 괜찮아요.',
        secondary: TO_CYCLE,
      }
    }

    case 'before-fertile': {
      if (voice === 'calm') return ownerCalm(c)
      const start = p.fertileStart!
      const n = p.daysUntilFertile ?? diffDays(today, start)
      // N29: no action before the window. 'LH 기록' becomes the action only
      // inside it and only for '써요' (usesLHNow); a '써요' owner near it gets
      // one quiet line that the button comes with the window.
      const near = usesLHNow(c.state) && diffDays(today, addDays(start, -LH_LEAD_DAYS)) <= 0
      if (voice === 'explicit') {
        const low = p.confidence === 'low'
        return {
          role,
          copy: 'owner.before-fertile',
          tone: 'default',
          // The eyebrow carries the one "(예상)" (low confidence names the basis instead, and the body's range says it).
          eyebrow: low ? `다가오는 가임기 · ${p.basis}` : '다가오는 가임기 (예상)',
          title: low ? `가임기 무렵까지 D-${n}` : `가임기까지 D-${n}`,
          body: low
            ? `${day(start)} 무렵부터예요 (예상 범위, 넓음). 달력 기준 예상이에요.`
            : `${day(start)}부터예요. 달력 기준 예상이에요.`,
          ...(near ? { note: 'LH 결과는 가임기에 들어서면 여기서 바로 남길 수 있어요.' } : {}),
          secondary: TO_CYCLE,
          todayLH: p.todayLH,
        }
      }
      const soon = n <= 3
      return {
        role,
        copy: 'owner.before-fertile',
        tone: 'default',
        eyebrow: '다가오는 우리의 주간 (예상)',
        title: soon ? '곧 우리의 주간이에요' : `${day(start)} 무렵부터 우리의 주간이에요`,
        body: '둘만의 시간을 미리 계획해 볼까요?',
        secondary: TO_CYCLE,
        todayLH: p.todayLH,
      }
    }

    case 'fertile': {
      if (voice === 'calm') return ownerCalm(c)
      const end = p.fertileEnd!
      // N29: 'LH 기록' is the action inside the window for a '써요' owner only
      // (usesLHNow); anyone else gets no action, and the body names the
      // calendar as the basis instead of asking for a strip.
      const lhOn = usesLHNow(c.state)
      if (voice === 'explicit') {
        const low = p.confidence === 'low'
        return {
          role,
          copy: 'owner.fertile',
          tone: 'fert',
          // The eyebrow names the basis — 'LH 기준' once a surge pinned it, '달력
          // 기준 · 기록 N주기' when the calendar alone is all there is — and the
          // window's last day; it carries the card's one "(예상)".
          eyebrow:
            p.confidence === 'lh'
              ? `LH 기준 · ${day(end)}까지 (예상)`
              : low
                ? `${p.basis} · ${day(end)}까지 (예상)`
                : `가임기 · ${day(end)}까지 (예상)`,
          title: p.recentSurge ? 'LH 양성이 나왔어요' : low ? '가임기 범위예요 (넓음)' : p.peak ? '가능성 높은 날이에요' : '가임기예요',
          body: p.recentSurge
            ? '처음 양성이 나온 날과 그다음 날이 가장 좋은 때예요.'
            : low
              ? lhOn
                ? '달력으로만 계산한 범위라 넓게 잡았어요. 오늘 LH 결과를 기록하면 범위가 좁아져요.'
                : '달력으로만 계산한 범위라 넓게 잡았어요. 달력 기준 예상이에요.'
              : lhOn
                ? '오늘 LH 결과를 기록하면 예상을 다시 계산해요.'
                : '달력 기준 예상이에요.',
          note: '이 기간엔 하루나 이틀에 한 번이면 충분해요. 부담은 내려놓아요.',
          ...(lhOn ? { primary: { type: 'log', kind: 'lh', label: 'LH 기록' } as MomentAction } : {}),
          peak: p.peak,
          todayLH: p.todayLH,
        }
      }
      return {
        role,
        copy: 'owner.fertile',
        tone: 'fert',
        eyebrow: `${day(end)}까지 (예상)`,
        title: '이번 주는 우리의 주간이에요',
        body: '둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.',
        ...(lhOn ? { primary: { type: 'log', kind: 'lh', label: '오늘 기록' } as MomentAction } : {}),
        todayLH: p.todayLH,
      }
    }

    case 'tww': {
      const r = p.retest
      const due = p.due!
      // The card changes with the day (N11): '배란 뒤 N일째' in explicit wording
      // only (soft / calm never read 배란), today's own feel chip, a quiet line
      // that rotates daily — and the test only becomes the action on the test day.
      // Low confidence (one period, long cycles) names no ovulation day anywhere (N12).
      const sinceOv = p.ovulation && p.confidence !== 'low' && today > p.ovulation ? diffDays(p.ovulation, today) : undefined
      const eyebrow = voice === 'explicit' && sinceOv !== undefined ? `배란 뒤 ${sinceOv}일째 (예상)` : '기다리는 주'
      // The eyebrow's count carries the card's one "(예상)"; without it the body (or the title) does.
      const marked = estimateMarks(eyebrow) > 0
      const feel = personalDay(c.state, cycleOwnerId(c.state), today)?.feel
      const own = { testDate: p.testDate, due, ...(feel ? { todayFeel: feel } : {}) }
      if (r) {
        return {
          role,
          copy: 'owner.retest',
          tone: 'default',
          eyebrow,
          title: r.due ? '오늘 다시 테스트해 볼 수 있어요' : `다시 해 볼 날: ${retestRange(r)}`,
          body: '너무 이르면 음성일 수 있어요.',
          primary: LOG_TEST,
          early: p.early,
          retest: r,
          ...own,
        }
      }
      if (p.noSurge && voice !== 'calm' && usesLHNow(c.state)) {
        // LH strips this cycle but no surge by the window's end: ovulation may be
        // late, so keep testing for a week before moving on to the wait — the
        // window carried on, for a '써요' owner only (usesLHNow: the strips an
        // unanswered or '안 써요' owner logged are hers, the card asks for no more).
        const n = p.noSurge
        return {
          role,
          copy: 'owner.tww-no-surge',
          tone: 'default',
          eyebrow: voice === 'explicit' ? `LH ${n.tests}회 · 아직 양성이 없어요` : '기다리는 주',
          title: '며칠 더 테스트해 봐요',
          body:
            voice === 'explicit'
              ? `배란이 늦어질 수 있어요 (예상). ${day(n.until)}까지 LH 테스트를 이어 가 봐요.`
              : `이번 주기엔 아직 양성이 없었어요. 조금 늦어질 수 있으니 ${day(n.until)}까지 이어 가 봐요.`,
          primary: { type: 'log', kind: 'lh', label: voice === 'explicit' ? 'LH 기록' : '오늘 기록' },
          secondary: LOG_TEST,
          early: p.early,
          todayLH: p.todayLH,
          ...own,
        }
      }
      if (p.early) {
        // Too early for a test to say much: a countdown to the first day of the
        // expected range and one self-care line a day — no action (N29: 오늘
        // 컨디션 lives in the 메모 panel's '자세히'; the sheet logs a test any day).
        return {
          role,
          copy: 'owner.tww',
          tone: 'default',
          eyebrow,
          title: `테스트까지 D-${diffDays(today, due.from)}`,
          body: `생리 예정은 ${dueRange(due)} 무렵이에요${marked ? '' : ' (예상)'}. ${waitingWeekLine(sinceOv ?? d)}`,
          note: '너무 이르면 음성일 수 있어요.',
          secondary: TO_CYCLE,
          early: true,
          ...own,
        }
      }
      // From the test day (the range's first day): the test is the action; the
      // period may start any day too — log it when it does.
      return {
        role,
        copy: 'owner.period-due',
        tone: 'default',
        eyebrow,
        title: PERIOD_DUE_COPY.dueNow.title,
        body: marked ? withoutEstimate(PERIOD_DUE_COPY.dueNow.body(due)) : PERIOD_DUE_COPY.dueNow.body(due),
        primary: LOG_TEST,
        secondary: LOG_PERIOD,
        early: false,
        ...own,
      }
    }
  }
}

/**
 * 병원과 함께 준비 중 (lib/logic/clinic.ts): the clinic sets the timing, so the
 * card leads with the next appointment — or asks for one — and nothing here
 * estimates a date. A period does not end it; [병원 준비 마치기] does.
 */
function clinicMoment(c: Ctx, role: 'owner' | 'partner'): MomentBody {
  const members = c.state.couple.members
  const whoOf = (a: Appointment) => (a.who === 'both' ? '둘이 함께' : (members.find((m) => m.id === a.who)?.name ?? ''))
  if (role === 'partner') {
    // His side (N32): his own or a '둘이 함께' appointment only, as day · time
    // · place · a kind word (CLINIC_KIND_WORD) — never its title (a treatment
    // step like '난포 초음파' is hers to tell), never one of hers alone. This
    // card reaches the link word for word, beside its clinic week.
    const mine = nextPartnerClinicAppointment(c.state, c.today, otherOf(cycleOwnerId(c.state)))
    return {
      role,
      copy: 'partner.clinic',
      tone: 'brand',
      eyebrow: CLINIC_LABEL,
      title: '일정에 맞춰 함께해요',
      body: mine
        ? `${appointmentWhen(mine, c.today)} ${CLINIC_KIND_WORD[mine.kind] ?? '일정'}${mine.place ? ` · ${mine.place}` : ''} · ${whoOf(mine)}. 결과는 묻지 말고 일정만 함께 챙겨요.`
        : '결과는 묻지 말고 일정만 함께 챙겨요. 일정이 잡히면 여기서 알려 드려요.',
      primary: { type: 'nav', to: 'plan', label: '병원 일정 보기' },
    }
  }
  const next = nextClinicAppointment(c.state, c.today)
  const when = next ? appointmentWhen(next, c.today) : undefined
  const who = next ? whoOf(next) : ''
  return {
    role,
    copy: 'owner.clinic',
    tone: 'brand',
    eyebrow: CLINIC_LABEL,
    title: next ? `${when} ${next.title}` : '병원 일정에 맞춰 준비해요',
    body: next
      ? `${formatKo(next.date)}${next.time ? ` ${next.time}` : ''}${next.place ? ` · ${next.place}` : ''} · ${who}`
      : '다음 병원 일정을 넣어 두면 여기서 알려 드려요.',
    note: '날짜 예상과 알림은 쉬어요. 생리를 기록해도 꺼지지 않아요.',
    primary: { type: 'nav', to: 'plan', label: next ? '병원 일정 보기' : '일정 넣기' },
    secondary: { type: 'end-rest', label: '병원 준비 마치기' },
    restReason: 'clinic',
  }
}

function ownerCalm(c: Ctx): MomentBody {
  return c.lowPressure
    ? {
        role: 'owner',
        copy: 'owner.calm',
        tone: 'brand',
        eyebrow: '우리의 속도로',
        title: '날짜는 신경 쓰지 않아도 괜찮아요',
        body: '주기 내내 2~3일에 한 번이면 충분해요.',
        note: '영국 NICE 지침(NG257, 2026)의 권고예요.',
      }
    : {
        role: 'owner',
        copy: 'owner.calm',
        tone: 'brand',
        eyebrow: '오늘의 우리',
        title: '오늘도 둘이 함께해요',
        // 'off' only silences her alerts — her calendar still shows the estimates.
        body: '알림은 쉬고 있어요. 달력에서 예상은 볼 수 있어요.',
        secondary: { type: 'nav', to: 'settings', label: '설정에서 바꾸기' },
      }
}

/**
 * The '평소 주' card (N19): the ONE card a partner without her details sees
 * from the day after 우리의 주간 until the next '곧 우리의 주간' — through her
 * period, the waiting weeks, a late period, a rest, a positive test she has
 * not told and a negative one alike — and the card he sees all cycle long
 * when she shares no dates ('날짜 없음', N23) or his own alerts are off. It
 * reads nothing of hers: '이번 주 우리 둘' follows it (weekTogether flag — the
 * screen draws this week's pick right under it, so the card's own eyebrow is
 * '오늘의 우리', never that block's header again), and his month task can sit inside. With no
 * cycle records at all it is the same card (never a dead end that waits on
 * her, positioning §4: 기록 없이 도는 남편 화면).
 */
function partnerNeutral(c: Pick<Ctx, 'state' | 'today'>): MomentBody {
  const week = weekTogetherOn(c.state, c.today)
  return {
    role: 'partner',
    copy: 'partner.neutral',
    tone: 'default',
    eyebrow: '오늘의 우리',
    title: '이번 주도 둘이 함께해요',
    body: week ? '이번 주에 내가 맡을 것 하나면 충분해요.' : '서로의 하루를 챙겨 주세요.',
    monthlyTask: true,
    ...(week ? { weekTogether: true } : {}),
  }
}

/**
 * The partner's card. Order (docs/positioning.md §4, '남편 루프의 규칙 다섯'):
 *  1. what she TOLD with [알리기] — bleeding / a positive test (any sharing level);
 *  2. the quiet after a pregnancy ended (partnerQuiet: a stage change he saw);
 *  3. 병원과 함께 준비 중 — the couple's mode, its badge on both phones (N13)
 *     and its schedule shared by both; an untold positive test keeps it;
 *  4. a period she told (periodToldCard);
 *  5. with her details ('자세히'): the phase-by-phase cards as before;
 *  6. without them ('우리의 주간' / '날짜 없음'): the shared window
 *     (cycleRing.sharedWeek) or the '평소 주' card — nothing in between.
 */
function partnerMoment(c: Ctx): MomentBody {
  const { phase: p, ownerName: owner } = c
  const role = 'partner' as const
  if (p.kind === 'positive-pending' || p.kind === 'positive-bleeding') {
    // The partner hears about a positive test only when she tells them — and
    // about bleeding only when she tells them that too (never through shared
    // details: it is hers to say). Without either, the ordinary card.
    const since = p.pending!.since
    if (p.kind === 'positive-bleeding' && decided(c.state, bleedingToldKey(since))) {
      return {
        role,
        copy: 'partner.bleeding-told',
        tone: 'brand',
        eyebrow: `${owner}님이 알려 줬어요`,
        title: '병원에 같이 가 줄 수 있어요',
        body: '출혈이 있어 병원에서 확인하기로 했어요. 결과를 묻기보다 곁에 있어 주세요. 결과가 어떻든 한 팀이에요.',
        primary: { type: 'nav', to: 'plan', label: '병원 일정 보기' },
        ...toldSay(c, 'bleeding', bleedingToldKey(since)),
      }
    }
    if (decided(c.state, positiveToldKey(since))) {
      return {
        role,
        copy: 'partner.positive-told',
        tone: 'brand',
        eyebrow: `${owner}님이 알려 줬어요`,
        title: '병원 확인을 기다리고 있어요',
        body: '결과가 어떻든 한 팀이에요. 병원에 같이 갈 수 있는지 이야기해 봐요.',
        primary: { type: 'nav', to: 'plan', label: '병원 일정 보기' },
        ...toldSay(c, 'positive', positiveToldKey(since)),
      }
    }
  }
  if (p.kind === 'after-loss' || partnerQuiet(c.state, c.today)) {
    return {
      role,
      copy: 'partner.after-loss',
      tone: 'muted',
      eyebrow: '함께예요',
      title: '서로를 천천히 챙겨요',
      body: '지금은 곁에 있어 주는 것만으로 충분해요.',
      support: true,
    }
  }
  if (c.state.restCycle?.reason === 'clinic' && activeRest(c.state, c.today)) return clinicMoment(c, role)
  const told = periodToldCard(c)
  if (told) return told
  return c.details ? partnerWithDetails(c) : partnerSharedWeek(c)
}

/**
 * A period she told ([알리기]): '이번 달은 쉬어 가요' on days 1–3 of it — a
 * fixed span, so a period end she logs later says nothing — and, when she
 * told later than that (the home asks until day 7), on the day she told and
 * the day after.
 */
function periodToldCard(c: Ctx): MomentBody | undefined {
  const start = c.phase.cycleStart
  if (!start) return undefined
  const toldOn = decisionDay(c.state, periodToldKey(start))
  if (!toldOn) return undefined
  const cycleDay = diffDays(start, c.today) + 1
  const fresh = toldOn <= c.today && diffDays(toldOn, c.today) <= 1 && cycleDay <= PERIOD_ASK_DAYS + 1
  if (cycleDay > PERIOD_EARLY_DAYS && !fresh) return undefined
  return {
    role: 'partner',
    copy: 'partner.period-told',
    tone: 'default',
    eyebrow: `${c.ownerName}님이 알려 줬어요`,
    title: '이번 달은 쉬어 가요',
    body: '따뜻한 차 한 잔, 컨디션을 챙겨 주세요.',
    // The same two lines as `say` in one sentence — kept for screens that read only this (the link, until it draws `say`).
    partnerTip: PERIOD_PARTNER_TIP,
    ...toldSay(c, 'period', periodToldKey(start)),
  }
}

/**
 * 해 줄 말 · 아껴 둘 말 and two answers for what she told (signals.sayForTold),
 * with the day she told and the answer he sent since (his own action) — only
 * ever called for a card that exists because she told him.
 */
function toldSay(c: Pick<Ctx, 'state'>, moment: ToldMoment, key: string): Pick<MomentBody, 'say'> {
  const since = decisionDay(c.state, key)
  if (!since) return {}
  const lines = sayForTold(moment)
  const partner = otherOf(cycleOwnerId(c.state))
  const sent = sentSince(c.state, partner, since, lines.replies)?.id
  return { say: { ...lines, since, ...(sent ? { sent } : {}) } }
}

/** '자세히' (N23): she shares her period, LH and test records, so the card follows the phase — as before N19. */
function partnerWithDetails(c: Ctx): MomentBody {
  const { phase: p, voice, ownerName: owner } = c
  const role = 'partner' as const
  const calm = voice === 'calm'
  switch (p.kind) {
    case 'period-early':
    case 'period':
      return {
        role,
        copy: 'partner.period-shared',
        tone: 'default',
        eyebrow: voice === 'explicit' ? `${owner}님 생리 ${p.cycleDay ?? 1}일째` : `${owner}님의 하루`,
        title: `${owner}님 컨디션을 챙겨 주세요`,
        body: '따뜻한 말 한마디가 힘이 돼요.',
        // No 해 줄 말 here (N30): her shared details are not a moment she sent —
        // those lines come with [알리기] (periodToldCard) and her signals only.
      }

    case 'before-fertile':
      if (!calm && ourWeekSoon(p.status)) {
        return {
          role,
          copy: 'partner.our-week-soon',
          tone: 'default',
          eyebrow: voice === 'explicit' ? `가임기 예상 · ${day(p.fertileStart!)}부터` : '다가오는 우리의 주간',
          title: '곧 우리의 주간이에요',
          body: '둘만의 시간을 미리 계획해 볼까요?',
          dateIdeas: true,
          secondary: { type: 'nav', to: 'date', label: '아이디어 더 보기' },
        }
      }
      return partnerNeutral(c)

    case 'fertile': {
      if (calm) return partnerNeutral(c)
      const end = p.fertileEnd!
      // Which days exactly (peak): she shares the details.
      const peak = !!p.peak
      const lastDay = end === c.today
      return {
        role,
        copy: 'partner.our-week',
        tone: 'fert',
        // The eyebrow carries the one "(예상)"; the peak line below doesn't repeat it.
        eyebrow: voice === 'explicit' ? `가임기 · ${day(end)}까지 (예상)` : `${day(end)}까지 (예상)`,
        title: '이번 주는 우리의 주간이에요',
        body: peak
          ? voice === 'explicit'
            ? '특히 오늘은 가능성 높은 날이에요. 부담은 내려놓아요.'
            : lastDay
              ? '오늘까지예요. 부담은 내려놓아요.'
              : '특히 오늘·내일이에요. 부담은 내려놓아요.'
          : '둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.',
        dateIdeas: true,
        secondary: { type: 'nav', to: 'date', label: '아이디어 더 보기' },
        peak,
      }
    }

    case 'tww':
      return calm ? partnerNeutral(c) : partnerTww()

    case 'late':
      // He can see the period is late — still no questions, no pushing for a test.
      return {
        role,
        copy: 'partner.late-shared',
        tone: 'default',
        eyebrow: '함께예요',
        title: '기다리는 시간이에요',
        body: `재촉하지 말고, ${owner}님이 이야기하고 싶을 때 곁에 있어 주세요.`,
        monthlyTask: true,
      }

    // No records yet, a rest, a positive test she has not told (details never
    // include it), the paused days after a pregnancy: the '평소 주' card.
    default:
      return partnerNeutral(c)
  }
}

/**
 * '우리의 주간' / '날짜 없음' (N19, N23): the shared window when it is on
 * (cycleRing.sharedWeek — from her logged starts only, never on period days
 * 1–3, never through a pause) and the '평소 주' card every other day. A
 * partner with no window wording (alerts off, 부담 없이, or '날짜 없음' — calm
 * voice) gets the '평소 주' card all cycle long.
 */
function partnerSharedWeek(c: Ctx): MomentBody {
  if (c.voice === 'calm') return partnerNeutral(c)
  const shared = sharedWeek(c.state, c.today)
  if (!shared) return partnerNeutral(c)
  const role = 'partner' as const
  if (shared.kind === 'soon') {
    return {
      role,
      copy: 'partner.our-week-soon',
      tone: 'default',
      eyebrow: '다가오는 우리의 주간',
      title: '곧 우리의 주간이에요',
      body: '둘만의 시간을 미리 계획해 볼까요?',
      dateIdeas: true,
      secondary: { type: 'nav', to: 'date', label: '아이디어 더 보기' },
    }
  }
  return {
    role,
    copy: 'partner.our-week',
    tone: 'fert',
    // The eyebrow carries the one "(예상)". No peak days without her details.
    eyebrow: `${day(shared.fertileEnd)}까지 (예상)`,
    title: '이번 주는 우리의 주간이에요',
    body: '둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.',
    dateIdeas: true,
    secondary: { type: 'nav', to: 'date', label: '아이디어 더 보기' },
    peak: false,
  }
}

/** The waiting weeks, for a partner she shares the details with ('기다리는' only where he can know it). */
function partnerTww(): MomentBody {
  return {
    role: 'partner',
    copy: 'partner.tww',
    tone: 'default',
    eyebrow: '이번 주의 우리',
    title: '기다리는 시간이에요',
    body: '증상은 묻지 말고 평소처럼 보내요.',
    monthlyTask: true,
  }
}

// ── Telling the partner (owner's choice) ────────────────────
//
// Her answers are not records: they live in `decisions` (lib/sync/model.ts
// decided / decide — keyed, first answer stands, the day she decided). The
// calm notice the partner gets is a normal inbox notice on top. `nowISO` is
// the moment of the tap (stampOn(today)); its day is what is remembered.

/** The gentle notice the partner gets when she tells them the period started. */
export const periodToldKey = (start: ISODate) => `period-told:${start}`
const periodSkipKey = (start: ISODate) => `period-told:${start}:skip`
export const positiveToldKey = (since: ISODate) => `positive-told:${since}`
/** The quiet notice about bleeding after that positive test (tellPartnerBleeding) — keyed by the test's day. */
export const bleedingToldKey = (since: ISODate) => `bleeding-told:${since}`
export const vaccineHintKey = (hint: Pick<VaccineRestHint, 'itemId' | 'at'>) => `rest-suggest:${hint.itemId}:${hint.at}`

type Decisions = Pick<AppState, 'decisions' | 'notifications'>

/** 'ask' until she answers "{partner}님에게 알릴까요?" once for this period. */
export function periodTellState(state: Decisions, start: ISODate): 'ask' | 'told' | 'skipped' {
  if (decided(state, periodToldKey(start))) return 'told'
  if (decided(state, periodSkipKey(start))) return 'skipped'
  return 'ask'
}

/** The day of a tap's stamp (a local-date-prefixed timestamp). */
const dayOf = (nowISO: string): ISODate => nowISO.slice(0, 10)

function otherOf(id: MemberId): MemberId {
  return id === 'a' ? 'b' : 'a'
}

/** [알리기] — the partner gets a calm "이번 달은 쉬어 가요" notice (once per period). */
export function tellPartnerPeriod(state: AppState, start: ISODate, nowISO: string): AppState {
  const owner = cycleOwnerId(state)
  if (periodTellState(state, start) !== 'ask') return state
  const told = mergeNotices(
    state,
    [
      {
        key: periodToldKey(start),
        to: otherOf(owner),
        from: owner,
        kind: 'system',
        title: `${nameOf(state, owner)}님이 알려 왔어요`,
        body: `이번 달은 쉬어 가요. ${PERIOD_PARTNER_TIP}`,
      },
    ],
    nowISO,
  ).state
  return decide(told, periodToldKey(start), dayOf(nowISO))
}

/** [괜찮아요] — remember the answer, tell nobody. */
export function skipTellPartnerPeriod(state: AppState, start: ISODate, nowISO: string): AppState {
  if (periodTellState(state, start) !== 'ask') return state
  return decide(state, periodSkipKey(start), dayOf(nowISO))
}

/** A calm note to the partner about a positive test — no celebration before the clinic. */
export function tellPartnerPositive(state: AppState, nowISO: string): AppState {
  const p = state.positivePending
  if (!p || decided(state, positiveToldKey(p.since))) return state
  const owner = cycleOwnerId(state)
  const told = mergeNotices(
    state,
    [
      {
        key: positiveToldKey(p.since),
        to: otherOf(owner),
        from: owner,
        kind: 'system',
        title: `${nameOf(state, owner)}님이 소식을 전했어요`,
        body: '임신 테스트에서 양성이 나왔어요. 병원에서 확인할 때까지 차분히 함께 기다려요.',
      },
    ],
    nowISO,
  ).state
  return decide(told, positiveToldKey(p.since), dayOf(nowISO))
}

// ── 양성 뒤 출혈 (Next B) ────────────────────────────────────

/**
 * Is a period start on `date` really a bleeding mark? While a positive test
 * waits for the clinic, bleeding from that day on is not yet a period
 * (positiveBleeding.isBleedingDuringPositive): the log layer marks it and the
 * home card asks what to do with it. A screen may use it for its toast.
 */
export function periodStartDuringPositive(state: Pick<AppState, 'positivePending' | 'periods' | 'stage'>, date: ISODate): boolean {
  return isBleedingDuringPositive(state, date)
}

/**
 * A period start from any screen: logs.logPeriodStart itself marks bleeding
 * during a pending positive test (the card then offers 병원에 연락하기 /
 * 생리로 기록할게요) and logs the period otherwise (settling rests and the
 * test). Kept as the name the home flow reads by.
 */
export function logPeriodOrBleeding(state: AppState, date: ISODate, by?: MemberId, today?: ISODate): AppState {
  return logPeriodStart(state, date, by, today)
}

/**
 * [생리로 기록할게요]: the bleeding day becomes this period's first day and
 * the positive test is settled quietly (logs.logPeriodStart with `asPeriod` →
 * ttc.onPeriodLogged clears positivePending). Nothing to settle → the same state.
 */
export function settleBleedingAsPeriod(state: AppState, today: ISODate): AppState {
  const pending = activePositivePending(state)
  if (!pending?.bleedingSince) return state
  return logPeriodStart(state, pending.bleedingSince, cycleOwnerId(state), today, { asPeriod: true })
}

/**
 * A quiet note to the partner that bleeding started (only when she chooses
 * to): what to do (be there, go together), nothing about what it means. Also
 * counts as having told him about the positive test, so the two cards agree.
 */
export function tellPartnerBleeding(state: AppState, nowISO: string): AppState {
  const p = activePositivePending(state)
  if (!p?.bleedingSince || decided(state, bleedingToldKey(p.since))) return state
  const owner = cycleOwnerId(state)
  const told = mergeNotices(
    state,
    [
      {
        key: bleedingToldKey(p.since),
        to: otherOf(owner),
        from: owner,
        kind: 'system',
        title: `${nameOf(state, owner)}님이 알려 왔어요`,
        body: '병원 확인 전에 출혈이 시작됐어요. 병원에 같이 갈 수 있는지 이야기해 봐요. 결과가 어떻든 한 팀이에요.',
      },
    ],
    nowISO,
  ).state
  return decide(decide(told, bleedingToldKey(p.since), dayOf(nowISO)), positiveToldKey(p.since), dayOf(nowISO))
}

/**
 * The positive home test this period (starting on `cycleStart`) settled: the
 * latest positive before it with no period start in between — so the
 * period-day card can be gentler. Undefined when the period followed nothing.
 */
export function settledPositive(state: Pick<AppState, 'pregnancyTests' | 'periods'>, cycleStart: ISODate): PregnancyTest | undefined {
  const last = latestTest(
    (state.pregnancyTests ?? []).filter((t) => t.result === 'positive'),
    undefined,
    addDays(cycleStart, -1),
  )
  if (!last) return undefined
  return sortedStarts(state.periods).some((d) => d >= last.date && d < cycleStart) ? undefined : last
}

// ── 임신이 끝난 뒤: 몸 안내 한 줄 (Next B) ───────────────────

/** When the lines below were last checked against docs/research/after-loss.json. */
export const AFTER_LOSS_CHECKED_AT = '2026-10-02'

/**
 * docs/research/after-loss.json → findings[id].ui, character for character
 * (tests/ttcFlow.test.ts compares them). Owner only; the partner gets
 * LOSS_SUPPORT, never a line about her body. 'ovulation-2-weeks' is left out
 * on purpose (it reads as a warning), as are the lines with study numbers.
 */
export const AFTER_LOSS_LINES = {
  'see-doctor-after-loss': '열이 나거나 오한이 있거나, 통증이 심하거나 출혈이 많으면 바로 병원에 연락해요.',
  'period-return': '임신이 끝난 뒤 첫 생리는 보통 4~6주 뒤에 와요. 몇 달은 주기가 들쭉날쭉할 수 있어요.',
  'emotional-readiness': '몸보다 마음이 먼저예요. 준비됐다고 느낄 때까지 쉬어도 괜찮고, 상담센터의 도움을 받아도 돼요.',
} as const

export type AfterLossLineId = keyof typeof AFTER_LOSS_LINES

/** Each line's source (one of the finding's URLs in after-loss.json). */
export const AFTER_LOSS_SOURCES: Record<AfterLossLineId, SupportSource> = {
  'see-doctor-after-loss': { name: 'ACOG', url: 'https://www.acog.org/womens-health/faqs/early-pregnancy-loss' },
  'period-return': {
    name: "Tommy's",
    url: 'https://www.tommys.org/baby-loss-support/miscarriage-information-and-support/pregnancy-after-miscarriage/getting-pregnant-after-miscarriage',
  },
  'emotional-readiness': {
    name: "Tommy's",
    url: 'https://www.tommys.org/baby-loss-support/miscarriage-information-and-support/pregnancy-after-miscarriage/getting-pregnant-after-miscarriage',
  },
}

/** The first days: the 'call right away' signs (ACOG's 1–2 weeks of infection care, after-loss.json 'no-medical-wait'). */
export const AFTER_LOSS_CALL_DAYS = 14

export interface AfterLossGuidance {
  id: AfterLossLineId
  text: string
  source: SupportSource
}

/** The day the pregnancy ended: the record's endedAt, else the 'loss' rest's first day. */
export function lossEndedAt(state: Pick<AppState, 'stage' | 'pregnancy' | 'restCycle'>): ISODate | undefined {
  const p = state.pregnancy
  if (state.stage === 'preparing' && p?.endedAt && p.endedAt > p.confirmedAt) return p.endedAt
  return state.restCycle?.reason === 'loss' ? state.restCycle.since : undefined
}

/**
 * ONE line for the owner's after-loss card, by where she is: the first two
 * weeks say when to call the clinic; until the first period, when it usually
 * comes; after it, that the heart comes first. Undefined without an ended
 * pregnancy to count from.
 */
export function afterLossGuidance(
  state: Pick<AppState, 'stage' | 'pregnancy' | 'restCycle' | 'periods'>,
  today: ISODate,
): AfterLossGuidance | undefined {
  const endedAt = lossEndedAt(state)
  if (!endedAt || !isISODate(today) || today < endedAt) return undefined
  const periodSince = state.periods.some((x) => x.start > endedAt)
  const id: AfterLossLineId =
    diffDays(endedAt, today) < AFTER_LOSS_CALL_DAYS ? 'see-doctor-after-loss' : periodSince ? 'emotional-readiness' : 'period-return'
  return { id, text: AFTER_LOSS_LINES[id], source: AFTER_LOSS_SOURCES[id] }
}

// ── Live vaccine → suggest a rest cycle ─────────────────────

/** 챙길 것 items for live vaccines (lib/content/roadmap.ts) and how long to wait. */
export const LIVE_VACCINE_ITEMS: Readonly<Record<string, { label: string; wait: string; days?: number; months?: number }>> = {
  'pre-rubella': { label: 'MMR', wait: '4주', days: 28 },
  'pre-varicella': { label: '수두', wait: '1개월', months: 1 },
}

export interface VaccineRestHint {
  itemId: string
  label: string
  /** The 4주 / 1개월 of the guidance. */
  wait: string
  /** When it was ticked (or its appointment was done). */
  at: ISODate
  /** First day it no longer applies. */
  until: ISODate
}

/**
 * The cycle owner ticked MMR·수두 (or finished that appointment) recently and
 * isn't resting yet: suggest "이번 주기는 쉬어요" (reason 'vaccine').
 */
export function vaccineRestHint(state: AppState, today: ISODate, viewer: MemberId): VaccineRestHint | null {
  if (state.stage !== 'preparing' || !canLogCycle(state, viewer) || activeRest(state, today)) return null
  let best: VaccineRestHint | null = null
  for (const [itemId, v] of Object.entries(LIVE_VACCINE_ITEMS)) {
    const dates = [
      state.planDone[itemId]?.at,
      ...state.appointments.filter((a) => a.taskId === itemId && a.done && a.date <= today).map((a) => a.date),
    ].filter((d): d is ISODate => !!d && d <= today)
    for (const at of dates) {
      const until = v.months ? addMonths(at, v.months) : addDays(at, v.days ?? 28)
      if (today >= until) continue
      if (!best || at > best.at) best = { itemId, label: v.label, wait: v.wait, at, until }
    }
  }
  if (!best || decided(state, vaccineHintKey(best))) return null
  return best
}

/** [이번 주기는 쉬어요] — the rest counts from the shot (see LIVE_VACCINE_REST_DAYS). */
export function acceptVaccineRest(state: AppState, hint: Pick<VaccineRestHint, 'at'>): AppState {
  return startRestCycle(state, hint.at, 'vaccine')
}

export function dismissVaccineRest(state: AppState, hint: Pick<VaccineRestHint, 'itemId' | 'at'>, nowISO: string): AppState {
  return decide(state, vaccineHintKey(hint), dayOf(nowISO))
}

/**
 * [다시 켜기] from the home screen. Turning a vaccine rest off is an answer
 * too, so the same suggestion doesn't pop straight back.
 */
export function endRestFromHome(state: AppState, today: ISODate, nowISO: string): AppState {
  const wasVaccine = state.restCycle?.reason === 'vaccine'
  let next = endRestCycle(state)
  const hint = wasVaccine ? vaccineRestHint(next, today, cycleOwnerId(next)) : null
  if (hint) next = dismissVaccineRest(next, hint, nowISO)
  return next
}

// ── Cycle strip ("주기 띠") ──────────────────────────────────

export type StripTone = 'period' | 'period-predicted' | 'fertile' | 'peak' | 'none'

export interface StripDay {
  date: ISODate
  tone: StripTone
  /** 0–1 strength of the window gradient (fertile < peak). */
  level: number
  today: boolean
  /** LH mark (details + explicit wording only — calendarView.showsLH). */
  lh?: 'surge' | 'low'
}

export interface CycleStrip {
  /** cycle = day 1..length of this cycle; weeks = this week + next (partner without details). */
  mode: 'cycle' | 'weeks'
  days: StripDay[]
  todayIndex: number
  cycleDay?: number
  length?: number
  startLabel: string
  endLabel: string
  /** The window is drawn (not paused / hidden for this viewer). */
  hasWindow: boolean
  /** Legend for the window band, in this viewer's wording. */
  windowLabel?: string
  /** Legend for the darker peak days ('가능성 높음' / '특히 좋은 때 (예상)'), when drawn. */
  peakLabel?: string
  view: FertilityView
  /** The drawn window's confidence (low = a wide range: no peak days). */
  confidence?: CycleConfidence
  /**
   * weeks mode: the shared window already ran on the Sunday before this week,
   * so the band's left end is square (WeekRow reads this — never the cycle
   * itself, which would carry her LH-tuned window).
   */
  bandBefore?: boolean
}

function windowTone(date: ISODate, w: CycleWindow, withPeak: boolean): Pick<StripDay, 'tone' | 'level'> | null {
  if (!isBetween(date, w.fertileStart, w.fertileEnd)) return null
  if (withPeak && isBetween(date, w.peakStart, w.peakEnd)) return { tone: 'peak', level: 1 }
  const k = diffDays(w.fertileStart, date)
  return { tone: 'fertile', level: withPeak ? Math.min(0.7, 0.3 + k * 0.1) : 0.45 }
}

/**
 * The strip at the top of the home screen. Owner (and a partner she shares
 * details with): this cycle, day 1..length, with logged period days and LH
 * marks. Partner without details: this week and next with the shared
 * "우리의 주간" band ONLY while the shared window is on (cycleRing.sharedWeek:
 * from '곧 우리의 주간' to the window's last day, from her logged starts
 * alone) — the rest of the cycle, the '평소 주', there is no strip at all, so
 * nothing is drawn ahead and an untold period, a late one, a rest or a
 * positive test waiting for the clinic leave his screen exactly as it was.
 *
 * Peak days and LH marks follow the calendar's lens (calendarView.cycleLens):
 * the darker peak days for anyone with details (showsPeak — "특히 좋은 때
 * (예상)" in soft wording), LH marks only for explicit wording (showsLH).
 */
export function cycleStrip(state: AppState, today: ISODate, viewer: MemberId): CycleStrip | null {
  const phase = ttcPhase(state, today)
  if (!phase || phase.kind === 'no-data' || phase.kind === 'after-loss') return null
  const lens = cycleLens(state, viewer, today)
  // The calendar's view (hidden for low-pressure / a partner who turned it off),
  // worded like the moment card: an owner with alerts off and a partner without
  // shared details see only "우리의 주간" — no 가임기, no LH marks.
  const view: FertilityView = lens.view === 'hidden' ? 'hidden' : homeVoice(state, viewer) === 'explicit' ? 'explicit' : 'soft'
  if (!lens.details) return sharedStrip(state, today, viewer, view)

  const positive = phase.kind === 'positive-pending' || phase.kind === 'positive-bleeding'
  const paused = phase.kind === 'rest' || positive
  // With a clinic (or a positive test waiting) no period is projected — logged data only, like the calendar.
  const noProjection = positive || (phase.kind === 'rest' && phase.rest?.reason === 'clinic')
  // Period days 1–3 are for "수고했어요" — the next window shows from day 4.
  // Once she has told the partner (with details), his strip rests for those days too.
  const toldQuiet =
    viewer !== cycleOwnerId(state) &&
    (phase.kind === 'period-early' || phase.kind === 'period') &&
    !!phase.cycleStart &&
    (phase.cycleDay ?? 0) <= PERIOD_EARLY_DAYS &&
    periodTellState(state, phase.cycleStart) === 'told'
  const showWindow = view !== 'hidden' && !paused && phase.kind !== 'period-early' && !toldQuiet
  const withLH = showsLH(lens) && view === 'explicit'

  // Always this cycle (the latest logged start): inside the expected range,
  // past it (late), while resting or waiting for the clinic, the ring keeps
  // counting the real days and never starts a projected cycle.
  const start = phase.cycleStart
  if (!start) return null
  const w = cycleAt(state, start)
  if (!w) return null
  const length = Math.max(w.length, diffDays(start, today) + 1)
  const label = showWindow ? windowLabel(view, w.confidence) : undefined
  // No darker peak days when the calendar alone is all there is (low confidence).
  const withPeak = showWindow && showsPeak(lens) && w.confidence !== 'low'
  const days: StripDay[] = []
  for (let i = 0; i < length; i++) {
    const date = addDays(start, i)
    const info = dayInfo(state, date, today)
    let tone: StripTone = 'none'
    let level = 0
    if (info.phase === 'period') {
      tone = 'period'
      level = 1
    } else if (info.phase === 'period-predicted' && !noProjection) {
      tone = 'period-predicted'
      level = 0.35
    } else if (showWindow) {
      const wt = windowTone(date, w, withPeak)
      if (wt) ({ tone, level } = wt)
    }
    const lh = strongestLH(state.lhTests.filter((t) => t.date === date).map((t) => t.result))
    // LH marks use the test's own name, so only in the explicit view.
    const mark = lh && withLH ? { lh: isSurge(lh) ? ('surge' as const) : ('low' as const) } : {}
    days.push({ date, tone, level, today: date === today, ...mark })
  }
  const hasPeak = days.some((d) => d.tone === 'peak')
  return {
    mode: 'cycle',
    days,
    todayIndex: Math.min(length - 1, diffDays(start, today)),
    cycleDay: diffDays(start, today) + 1,
    length,
    startLabel: '1일',
    endLabel: `${length}일`,
    hasWindow: showWindow,
    windowLabel: label,
    ...(hasPeak ? { peakLabel: peakLabel(view) } : {}),
    view,
    confidence: w.confidence,
  }
}

/**
 * The partner without details: two calendar weeks with the shared window's
 * days and nothing else — or null on every '평소 주' day, with his view hidden
 * (alerts off, 부담 없이, '날짜 없음'), and before any record. Never a period
 * day, never a projected cycle, never a window other than the one on now.
 */
function sharedStrip(state: AppState, today: ISODate, viewer: MemberId, view: FertilityView): CycleStrip | null {
  if (view === 'hidden' || viewer === cycleOwnerId(state)) return null
  const shared = sharedWeek(state, today)
  if (!shared) return null
  const start = mondayOf(today)
  const days: StripDay[] = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(start, i)
    const inBand = isBetween(date, shared.fertileStart, shared.fertileEnd)
    return { date, tone: inBand ? ('fertile' as const) : ('none' as const), level: inBand ? 0.45 : 0, today: date === today }
  })
  return {
    mode: 'weeks',
    days,
    todayIndex: diffDays(start, today),
    startLabel: formatShort(start),
    endLabel: formatShort(addDays(start, 13)),
    hasWindow: days.some((d) => d.tone !== 'none'),
    windowLabel: windowLabel(view, shared.confidence),
    view,
    confidence: shared.confidence,
    ...(sharedBandBefore(shared, start) ? { bandBefore: true } : {}),
  }
}

// ── Other home helpers ──────────────────────────────────────

/**
 * The 준비 일기 prompt for the home screen, or null when none fits: no baby
 * talk on period days 1–3 or before the clinic confirms, and none right after
 * a loss. With `viewer`, a partner without her details reads only what she
 * told (a period, a positive test, bleeding — [알리기]) — otherwise the
 * prompt itself would change on the day of something she did not tell (N19).
 */
export function homeDiaryPrompt(state: AppState, today: ISODate, viewer?: MemberId): string | null {
  const phase = ttcPhase(state, today)
  if (phase?.kind === 'after-loss' || (state.stage === 'preparing' && recentlyEnded(state, today))) return null
  const partnerView = viewer !== undefined && viewer !== cycleOwnerId(state) && !canSeeCycleDetails(state, viewer)
  const pending = phase?.pending
  const avoidBaby = partnerView
    ? (!!phase?.cycleStart &&
        (phase.cycleDay ?? 0) <= PERIOD_EARLY_DAYS &&
        periodTellState(state, phase.cycleStart) === 'told') ||
      (!!pending && (decided(state, positiveToldKey(pending.since)) || decided(state, bleedingToldKey(pending.since))))
    : phase?.kind === 'period-early' || phase?.kind === 'positive-pending' || phase?.kind === 'positive-bleeding'
  const list = PROMPTS[state.stage].filter((q) => !avoidBaby || !/아이|아기|태교/.test(q))
  if (list.length === 0) return null
  return list[Number(today.replace(/-/g, '')) % list.length]!
}

export interface SupportSource {
  name: string
  url: string
}

export interface SupportItem {
  id: string
  title: string
  body: string
  sources: SupportSource[]
}

export const LOSS_SUPPORT_CHECKED_AT = '2026-09-26'

/**
 * What helps right after a pregnancy ends (docs/research/admin-timeline.json,
 * kr-programs.json; review [29][65][66]). Where the evidence has no official
 * page, the card links the ministry portal and says to check there.
 */
export const LOSS_SUPPORT: readonly SupportItem[] = [
  {
    id: 'spouse-leave',
    title: '배우자 유산·사산휴가 5일',
    body: '처음 3일은 유급이고, 유산·사산일부터 20일 안에 회사에 청구해요(2026-09-18 시행).',
    // Official source first, press second.
    sources: [
      { name: '고용노동부', url: 'https://www.moel.go.kr' },
      { name: '인사이드피플 보도', url: 'https://www.insidepeople.co.kr/news/article.html?no=773455' },
    ],
  },
  {
    id: 'voucher',
    title: '국민행복카드 진료비 바우처',
    body: '유산 진단일부터 2년 동안 쓸 수 있어요. 기한이 지나면 남은 금액은 사라져요.',
    sources: [{ name: '국민행복카드 바우처', url: 'http://www.voucher.go.kr/voucher/pregnancy.do' }],
  },
  {
    id: 'counseling',
    title: '난임·임산부 심리상담센터',
    body: '마음이 힘들 때 전문 상담을 받을 수 있어요. 가까운 센터는 공식 안내에서 확인하세요.',
    sources: [
      { name: '정책브리핑', url: 'https://www.korea.kr/news/policyNewsView.do?newsId=148956615' },
      { name: '보건복지부', url: 'https://www.mohw.go.kr' },
    ],
  },
]

export const LOSS_SUPPORT_NOTE = '자세한 건 공식 안내에서 확인하세요. 병원·회사·보건소마다 달라요.'
