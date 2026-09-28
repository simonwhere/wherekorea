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
//     display; an ended pregnancy gets a quiet support card instead
// Predictions are always "예상"; nothing here is contraception or diagnosis.

import { addDays, addMonths, diffDays, formatKo, formatShort, isBetween } from '../dates'
import { uid } from '../id'
import type { LogKind } from '../logLauncher'
import type {
  AppNotification,
  AppState,
  ISODate,
  LHResult,
  MemberId,
  PositivePending,
  PregnancyTest,
  PregnancyTestResult,
  RestCycle,
} from '../types'
import { LH_LABEL, fertilityView, type FertilityView } from './calendarView'
import { mondayOf } from './checks'
import {
  LONG_LATE_DAYS,
  cycleAt,
  dayInfo,
  fertilityStatus,
  isSurge,
  ourWeekSoon,
  sortedStarts,
  strongestLH,
  upcomingWindows,
  type CycleWindow,
  type FertilityStatus,
} from './cycle'
import { PROMPTS } from './diary'
import { mergeNotices } from './notifications'
import { canLogCycle, canSeeCycleDetails, lowPressureFor, settingsFor } from './prefs'
import { recentlyEnded } from './pregnancy'
import { fertilityVoice, type FertilityVoice } from './today'
import { LIVE_VACCINE_REST_DAYS, activePositivePending, activeRest, endRestCycle, startRestCycle } from './ttc'

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
  | 'rest'
  | 'after-loss'

/** Period days 1–3: "수고했어요" first, next-window talk only from day 4. */
export const PERIOD_EARLY_DAYS = 3
/** LH testing starts this many days before the estimated window ("며칠 전부터"). */
export const LH_LEAD_DAYS = 2
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
  /** Expected next period — the day a home test can tell (예상). */
  testDate?: ISODate
  /** today < testDate (a test may still read negative too early). */
  early?: boolean
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
  const base = { status, cycleStart, cycleDay, todayLH, recentSurge }

  const pending = activePositivePending(state)
  if (pending) return { ...base, kind: 'positive-pending', pending }
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
  if (status.kind === 'late') {
    return {
      ...base,
      kind: 'late',
      daysLate: status.daysLate,
      testDate: status.expected,
      early: false,
      lastTest,
      retest: retestHint(lastTest, status.expected, today),
    }
  }
  const rest = activeRest(state)
  if (rest) return { ...base, kind: 'rest', rest }

  switch (status.kind) {
    case 'period':
      return {
        ...base,
        kind: status.cycleDay <= PERIOD_EARLY_DAYS ? 'period-early' : 'period',
        cycleDay: status.cycleDay,
        fertileStart: status.nextFertileStart,
        fertileEnd: status.fertileEnd,
        daysUntilFertile: status.daysUntilFertile,
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
        testDate: status.nextPeriod,
        early: today < status.nextPeriod,
        lastTest,
        retest: retestHint(lastTest, status.nextPeriod, today),
      }
  }
}

// ── What this viewer sees ───────────────────────────────────

export type MomentAction =
  | { type: 'log'; kind: LogKind; label: string }
  | { type: 'nav'; to: 'plan' | 'cycle' | 'date' | 'settings'; label: string }
  | { type: 'end-rest'; label: string }
  | { type: 'confirm-pregnancy'; label: string }

export type MomentCopyKey =
  | 'owner.no-data'
  | 'owner.paused'
  | 'owner.after-loss'
  | 'owner.positive-pending'
  | 'owner.late'
  | 'owner.late-long'
  | 'owner.rest'
  | 'owner.period-early'
  | 'owner.period'
  | 'owner.before-fertile'
  | 'owner.lh-start'
  | 'owner.fertile'
  | 'owner.calm'
  | 'owner.tww'
  | 'owner.retest'
  | 'partner.no-data'
  | 'partner.neutral'
  | 'partner.after-loss'
  | 'partner.positive-told'
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
  /** Partner's "우리의 주간" card: show 2–3 date ideas inside it. */
  dateIdeas?: boolean
  /** Partner: the card may feature "이번 달 할 일" (lib/logic/partnerTrack). */
  monthlyTask?: boolean
  /** Quiet support after a pregnancy ended (LOSS_SUPPORT). */
  support?: boolean
  /** One thing the partner can do today. */
  partnerTip?: string
}

const LOG_PERIOD: MomentAction = { type: 'log', kind: 'period', label: '생리 시작 기록' }
const LOG_TEST: MomentAction = { type: 'log', kind: 'ptest', label: '테스트 결과 기록' }
const TO_CYCLE: MomentAction = { type: 'nav', to: 'cycle', label: '달력 보기' }

/** '10월 14일' */
const day = (d: ISODate) => formatKo(d, { weekday: false })

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
 * calendar, calendarView.cycleLens).
 */
export function homeVoice(state: AppState, viewer: MemberId): FertilityVoice {
  const isOwner = viewer === cycleOwnerId(state)
  const own = fertilityVoice(settingsFor(state.settings, viewer), viewer, isOwner)
  return own === 'explicit' && !canSeeCycleDetails(state, viewer) ? 'soft' : own
}

export function ttcMoment(state: AppState, today: ISODate, viewer: MemberId): Moment | null {
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
  }
  const m = isOwner ? ownerMoment(ctx) : partnerMoment(ctx)
  return {
    kind: phase.kind,
    voice,
    details,
    cycleDay: phase.cycleDay,
    ...m,
  }
}

interface Ctx {
  state: AppState
  today: ISODate
  phase: TtcPhase
  voice: FertilityVoice
  details: boolean
  lowPressure: boolean
  ownerName: string
  partnerName: string
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

    case 'after-loss':
      return {
        role,
        copy: 'owner.after-loss',
        tone: 'muted',
        eyebrow: '천천히 괜찮아요',
        title: '몸과 마음을 먼저 챙겨요',
        body: '생리가 다시 시작되면 기록해 주세요. 그때부터 다시 예상해 드릴게요.',
        secondary: LOG_PERIOD,
        support: true,
      }

    case 'positive-pending': {
      const since = p.pending!.since
      const told = hasKey(c.state, positiveToldKey(since))
      return {
        role,
        copy: 'owner.positive-pending',
        tone: 'brand',
        eyebrow: '테스트 양성 · 병원 확인 전',
        title: '병원에서 확인해 봐요',
        body: '확인 전까지는 조심스럽게 기다려요. 병원 일정을 넣어 두면 둘이 함께 챙길 수 있어요.',
        primary: { type: 'nav', to: 'plan', label: '병원 일정 넣기' },
        secondary: { type: 'confirm-pregnancy', label: '병원에서 확인했어요' },
        ...(told ? {} : { offerTellPositive: { since } }),
      }
    }

    case 'late': {
      const n = p.daysLate ?? 0
      if (n > LONG_LATE_DAYS) {
        return {
          role,
          copy: 'owner.late-long',
          tone: 'brand',
          eyebrow: '기록 확인',
          title: '최근 기록이 없어요',
          body: '생리 시작일을 기록해 주세요. 예상이 다시 정확해져요.',
          primary: LOG_PERIOD,
          secondary: LOG_TEST,
          daysLate: n,
        }
      }
      const r = p.retest
      return {
        role,
        copy: r ? 'owner.retest' : 'owner.late',
        tone: 'brand',
        eyebrow: `예정일 ${day(p.testDate!)} (예상)`,
        title: `예정일이 ${n}일 지났어요`,
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
      }
    }

    case 'rest': {
      const reason = p.rest!.reason
      const backOn = day(addDays(p.rest!.since, LIVE_VACCINE_REST_DAYS))
      return {
        role,
        copy: 'owner.rest',
        tone: 'muted',
        eyebrow: reason === 'vaccine' ? '접종 뒤 쉬어 가요' : reason === 'loss' ? '천천히 괜찮아요' : '쉬어 가는 주기',
        title: '이번 주기는 쉬어요',
        body:
          reason === 'vaccine'
            ? '생백신을 맞은 뒤에는 MMR은 4주, 수두는 접종마다 1개월 동안 임신을 미루도록 안내해요.'
            : reason === 'loss'
              ? '몸과 마음을 먼저 챙겨요. 다음 생리를 기록하면 다시 켜져요.'
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
      return {
        role,
        copy: 'owner.period-early',
        tone: 'default',
        eyebrow: `생리 ${d}일째`,
        title: '이번 주기도 수고했어요',
        body: '오늘은 몸을 따뜻하게 하고 푹 쉬어요.',
        ...(periodTellState(c.state, start) === 'ask' ? { askTell: { start } } : {}),
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
              ? `다음 가임기는 ${day(p.fertileStart)}부터예요 (예상)`
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
      const toLh = diffDays(today, addDays(start, -LH_LEAD_DAYS))
      const testing = toLh <= 0
      if (voice === 'explicit') {
        return {
          role,
          copy: testing ? 'owner.lh-start' : 'owner.before-fertile',
          tone: testing ? 'fert' : 'default',
          eyebrow: '다가오는 가임기',
          title: testing ? '오늘 LH 테스트해 봐요' : `LH 테스트 시작 D-${toLh}`,
          body: `가임기는 ${day(start)}부터예요 (예상).`,
          note: testing ? '결과를 기록하면 예상을 다시 계산해요.' : undefined,
          ...(testing ? { primary: { type: 'log', kind: 'lh', label: 'LH 기록' } as MomentAction } : { secondary: TO_CYCLE }),
          todayLH: p.todayLH,
        }
      }
      const soon = (p.daysUntilFertile ?? 99) <= 3
      return {
        role,
        copy: testing ? 'owner.lh-start' : 'owner.before-fertile',
        tone: testing ? 'fert' : 'default',
        eyebrow: '다가오는 우리의 주간',
        title: soon ? '곧 우리의 주간이에요' : `${day(start)} 무렵부터 우리의 주간이에요 (예상)`,
        body: testing ? '테스트를 시작해 볼까요? 결과를 기록하면 예상을 다시 계산해요.' : '둘만의 시간을 미리 계획해 볼까요?',
        ...(testing ? { primary: { type: 'log', kind: 'lh', label: '오늘 기록' } as MomentAction } : { secondary: TO_CYCLE }),
        todayLH: p.todayLH,
      }
    }

    case 'fertile': {
      if (voice === 'calm') return ownerCalm(c)
      const end = p.fertileEnd!
      if (voice === 'explicit') {
        return {
          role,
          copy: 'owner.fertile',
          tone: 'fert',
          eyebrow: `가임기 (예상) · ${day(end)}까지`,
          title: p.recentSurge ? 'LH 양성이 나왔어요' : p.peak ? '가능성 높은 날이에요 (예상)' : '가임기예요 (예상)',
          body: p.recentSurge
            ? '처음 양성이 나온 날과 그다음 날이 가장 좋은 때예요.'
            : '오늘 LH 결과를 기록하면 예상을 다시 계산해요.',
          note: '이 기간엔 하루나 이틀에 한 번이면 충분해요. 부담은 내려놓아요.',
          primary: { type: 'log', kind: 'lh', label: 'LH 기록' },
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
        primary: { type: 'log', kind: 'lh', label: '오늘 기록' },
        todayLH: p.todayLH,
      }
    }

    case 'tww': {
      const r = p.retest
      const eyebrow = '기다리는 주'
      if (r) {
        return {
          role,
          copy: 'owner.retest',
          tone: 'default',
          eyebrow,
          title: r.due ? '오늘 다시 테스트해 볼 수 있어요' : `다시 해 볼 날: ${retestRange(r)}`,
          body: '너무 이르면 음성일 수 있어요.',
          primary: LOG_TEST,
          testDate: p.testDate,
          early: p.early,
          retest: r,
        }
      }
      return {
        role,
        copy: 'owner.tww',
        tone: 'default',
        eyebrow,
        title: p.early ? `테스트해 볼 수 있는 날: ${day(p.testDate!)} (예상)` : '오늘부터 테스트해 볼 수 있어요',
        body: p.early ? '너무 이르면 음성일 수 있어요.' : '생리 예정일이에요 (예상). 결과를 기록해 두면 다음 할 일을 알려 드려요.',
        primary: LOG_TEST,
        testDate: p.testDate,
        early: p.early,
      }
    }
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

function partnerNeutral(): MomentBody {
  return {
    role: 'partner',
    copy: 'partner.neutral',
    tone: 'default',
    eyebrow: '오늘의 우리',
    title: '오늘도 둘이 함께해요',
    body: '서로의 하루를 챙겨 주세요.',
    monthlyTask: true,
  }
}

function partnerMoment(c: Ctx): MomentBody {
  const { phase: p, voice, details, ownerName: owner } = c
  const role = 'partner' as const
  const calm = voice === 'calm'
  switch (p.kind) {
    case 'no-data':
      return p.paused
        ? partnerNeutral()
        : {
            role,
            copy: 'partner.no-data',
            tone: 'default',
            eyebrow: '함께 준비해요',
            title: `${owner}님이 주기를 기록하면 함께 알려 드릴게요`,
            body: '알림 방식은 설정에서 각자 고를 수 있어요.',
            monthlyTask: true,
          }

    case 'after-loss':
      return {
        role,
        copy: 'partner.after-loss',
        tone: 'muted',
        eyebrow: '함께예요',
        title: '서로를 천천히 챙겨요',
        body: '지금은 곁에 있어 주는 것만으로 충분해요.',
        support: true,
      }

    case 'positive-pending':
      // The partner hears about a positive test only when she tells them.
      return hasKey(c.state, positiveToldKey(p.pending!.since))
        ? {
            role,
            copy: 'partner.positive-told',
            tone: 'brand',
            eyebrow: `${owner}님이 알려 줬어요`,
            title: '병원 확인을 기다리고 있어요',
            body: '결과가 어떻든 한 팀이에요. 병원에 같이 갈 수 있는지 이야기해 봐요.',
            primary: { type: 'nav', to: 'plan', label: '병원 일정 보기' },
          }
        : partnerNeutral()

    case 'rest':
      return partnerNeutral()

    case 'period-early':
    case 'period': {
      if (p.cycleStart && periodTellState(c.state, p.cycleStart) === 'told') {
        return {
          role,
          copy: 'partner.period-told',
          tone: 'default',
          eyebrow: `${owner}님이 알려 줬어요`,
          title: '이번 달은 쉬어 가요',
          body: '따뜻한 차 한 잔, 컨디션을 챙겨 주세요.',
          partnerTip: PERIOD_PARTNER_TIP,
        }
      }
      if (details) {
        return {
          role,
          copy: 'partner.period-shared',
          tone: 'default',
          eyebrow: voice === 'explicit' ? `${owner}님 생리 ${p.cycleDay ?? 1}일째` : `${owner}님의 하루`,
          title: `${owner}님 컨디션을 챙겨 주세요`,
          body: '따뜻한 말 한마디가 힘이 돼요.',
          ...(p.kind === 'period-early' ? { partnerTip: PERIOD_PARTNER_TIP } : {}),
        }
      }
      return partnerNeutral()
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
      return partnerNeutral()

    case 'fertile': {
      if (calm) return partnerNeutral()
      const end = p.fertileEnd!
      // Which days exactly (peak) only when she shares the details.
      const peak = details && !!p.peak
      const lastDay = end === c.today
      return {
        role,
        copy: 'partner.our-week',
        tone: 'fert',
        eyebrow: voice === 'explicit' ? `가임기 (예상) · ${day(end)}까지` : `${day(end)}까지 (예상)`,
        title: '이번 주는 우리의 주간이에요',
        body: peak
          ? voice === 'explicit'
            ? '특히 오늘은 가능성 높은 날이에요 (예상). 부담은 내려놓아요.'
            : lastDay
              ? '오늘까지예요 (예상). 부담은 내려놓아요.'
              : '특히 오늘·내일이에요 (예상). 부담은 내려놓아요.'
          : '둘만의 시간을 편하게 즐겨요. 부담은 내려놓아요.',
        dateIdeas: true,
        secondary: { type: 'nav', to: 'date', label: '아이디어 더 보기' },
        peak,
      }
    }

    case 'tww':
      return calm ? partnerNeutral() : partnerTww()

    case 'late':
      if (details) {
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
      }
      // Without the details a late period is hers to share — the waiting card stays.
      return calm ? partnerNeutral() : partnerTww()
  }
}

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

function hasKey(state: Pick<AppState, 'notifications'>, key: string): boolean {
  return state.notifications.some((n) => n.key === key)
}

/** The gentle notice the partner gets when she tells them the period started. */
export const periodToldKey = (start: ISODate) => `period-told:${start}`
const periodSkipKey = (start: ISODate) => `period-told:${start}:skip`
export const positiveToldKey = (since: ISODate) => `positive-told:${since}`
export const vaccineHintKey = (hint: Pick<VaccineRestHint, 'itemId' | 'at'>) => `rest-suggest:${hint.itemId}:${hint.at}`

/** 'ask' until she answers "{partner}님에게 알릴까요?" once for this period. */
export function periodTellState(state: Pick<AppState, 'notifications'>, start: ISODate): 'ask' | 'told' | 'skipped' {
  if (hasKey(state, periodToldKey(start))) return 'told'
  if (hasKey(state, periodSkipKey(start))) return 'skipped'
  return 'ask'
}

/**
 * A dismissed, read record that only remembers a decision (it never shows in
 * an inbox) — the same stub pattern the notice engine uses for dedup.
 */
function withStub(state: AppState, key: string, to: MemberId, nowISO: string): AppState {
  if (hasKey(state, key)) return state
  const stub: AppNotification = { id: uid(), to, kind: 'system', title: '', body: '', createdAt: nowISO, key, read: true, dismissed: true }
  return { ...state, notifications: [stub, ...state.notifications] }
}

function otherOf(id: MemberId): MemberId {
  return id === 'a' ? 'b' : 'a'
}

/** [알리기] — the partner gets a calm "이번 달은 쉬어 가요" notice (once per period). */
export function tellPartnerPeriod(state: AppState, start: ISODate, nowISO: string): AppState {
  const owner = cycleOwnerId(state)
  if (periodTellState(state, start) !== 'ask') return state
  return mergeNotices(
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
}

/** [괜찮아요] — remember the answer, tell nobody. */
export function skipTellPartnerPeriod(state: AppState, start: ISODate, nowISO: string): AppState {
  if (periodTellState(state, start) !== 'ask') return state
  return withStub(state, periodSkipKey(start), cycleOwnerId(state), nowISO)
}

/** A calm note to the partner about a positive test — no celebration before the clinic. */
export function tellPartnerPositive(state: AppState, nowISO: string): AppState {
  const p = state.positivePending
  if (!p) return state
  const owner = cycleOwnerId(state)
  return mergeNotices(
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
  if (state.stage !== 'preparing' || !canLogCycle(state, viewer) || activeRest(state)) return null
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
  if (!best || hasKey(state, vaccineHintKey(best))) return null
  return best
}

/** [이번 주기는 쉬어요] — the rest counts from the shot (see LIVE_VACCINE_REST_DAYS). */
export function acceptVaccineRest(state: AppState, hint: Pick<VaccineRestHint, 'at'>): AppState {
  return startRestCycle(state, hint.at, 'vaccine')
}

export function dismissVaccineRest(state: AppState, hint: Pick<VaccineRestHint, 'itemId' | 'at'>, nowISO: string): AppState {
  return withStub(state, vaccineHintKey(hint), cycleOwnerId(state), nowISO)
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
  /** LH mark (owner / shared details, explicit view only). */
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
  view: FertilityView
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
 * marks. Partner without details: this week and next with only the shared
 * "우리의 주간" band — nothing that shows when her period started.
 */
export function cycleStrip(state: AppState, today: ISODate, viewer: MemberId): CycleStrip | null {
  const phase = ttcPhase(state, today)
  if (!phase || phase.kind === 'no-data' || phase.kind === 'after-loss') return null
  const owner = cycleOwnerId(state)
  // The calendar's view (hidden for low-pressure / a partner who turned it off),
  // worded like the moment card: an owner with alerts off and a partner without
  // shared details see only "우리의 주간" — no 가임기, no LH marks.
  const own = fertilityView(settingsFor(state.settings, viewer), viewer, owner)
  const view: FertilityView = own === 'hidden' ? 'hidden' : homeVoice(state, viewer) === 'explicit' ? 'explicit' : 'soft'
  const details = canSeeCycleDetails(state, viewer)
  const paused = phase.kind === 'rest' || phase.kind === 'positive-pending'
  // Period days 1–3 are for "수고했어요" — the next window shows from day 4.
  // (The partner without details keeps the shared band, so its absence says nothing.)
  const showWindow = view !== 'hidden' && !paused && !(details && phase.kind === 'period-early')
  const windowLabel = showWindow ? (view === 'explicit' ? '가임기 (예상)' : '우리의 주간 (예상)') : undefined

  if (details) {
    let start: ISODate
    let length: number
    let w: CycleWindow | null
    if (phase.kind === 'late' || phase.kind === 'positive-pending') {
      if (!phase.cycleStart) return null
      start = phase.cycleStart
      w = cycleAt(state, start)
      length = Math.max(w?.length ?? 28, diffDays(start, today) + 1)
    } else {
      // On the expected day itself, stay in the current cycle (like fertilityStatus).
      const st = phase.status
      w = cycleAt(state, st.kind === 'after-fertile' && st.daysUntilPeriod === 0 ? addDays(today, -1) : today)
      if (!w) return null
      start = w.start
      length = Math.max(w.length, diffDays(start, today) + 1)
    }
    const days: StripDay[] = []
    for (let i = 0; i < length; i++) {
      const date = addDays(start, i)
      const info = dayInfo(state, date, today)
      let tone: StripTone = 'none'
      let level = 0
      if (info.phase === 'period') {
        tone = 'period'
        level = 1
      } else if (info.phase === 'period-predicted' && phase.kind !== 'positive-pending') {
        // (While a positive test waits for the clinic, no period is projected — like the calendar.)
        tone = 'period-predicted'
        level = 0.35
      } else if (showWindow && w) {
        const wt = windowTone(date, w, true)
        if (wt) ({ tone, level } = wt)
      }
      const lh = strongestLH(state.lhTests.filter((t) => t.date === date).map((t) => t.result))
      // LH marks use the test's own name, so only in the explicit view.
      const mark = lh && view === 'explicit' ? { lh: isSurge(lh) ? ('surge' as const) : ('low' as const) } : {}
      days.push({ date, tone, level, today: date === today, ...mark })
    }
    return {
      mode: 'cycle',
      days,
      todayIndex: Math.min(length - 1, diffDays(start, today)),
      cycleDay: diffDays(start, today) + 1,
      length,
      startLabel: '1일',
      endLabel: `${length}일`,
      hasWindow: showWindow && !!w,
      windowLabel,
      view,
    }
  }

  // Partner without details: only the shared window, two calendar weeks. A late
  // period leaves nothing to show (the next window is unknown until it starts).
  if (!showWindow || phase.kind === 'late') return null
  const start = mondayOf(today)
  const windows = upcomingWindows(state, start, 2)
  const days: StripDay[] = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(start, i)
    const w = windows.find((x) => isBetween(date, x.fertileStart, x.fertileEnd))
    const wt = w ? windowTone(date, w, false) : null
    return { date, tone: wt?.tone ?? 'none', level: wt?.level ?? 0, today: date === today }
  })
  return {
    mode: 'weeks',
    days,
    todayIndex: diffDays(start, today),
    startLabel: formatShort(start),
    endLabel: formatShort(addDays(start, 13)),
    hasWindow: days.some((d) => d.tone !== 'none'),
    windowLabel,
    view,
  }
}

// ── Other home helpers ──────────────────────────────────────

/**
 * The 준비 일기 prompt for the home screen, or null when none fits: no baby
 * talk on period days 1–3 or before the clinic confirms, and none right after
 * a loss.
 */
export function homeDiaryPrompt(state: AppState, today: ISODate): string | null {
  const phase = ttcPhase(state, today)
  if (phase?.kind === 'after-loss' || (state.stage === 'preparing' && recentlyEnded(state, today))) return null
  const avoidBaby = phase?.kind === 'period-early' || phase?.kind === 'positive-pending'
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
    sources: [
      { name: '인사이드피플 보도', url: 'https://www.insidepeople.co.kr/news/article.html?no=773455' },
      { name: '고용노동부', url: 'https://www.moel.go.kr' },
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
