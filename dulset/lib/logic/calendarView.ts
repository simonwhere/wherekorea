// View-model helpers for the 달력 (cycle) tab. Pure functions only: they turn
// cycle.ts results into labels, class names and actions, applying the viewer's
// fertility-wording preference (settings.lowPressure / settings.alertStyle).
//
// Class names live here (not in the component) so the wording/visibility rules
// can be unit-tested; tailwind.config scans lib/** so they are compiled.

import { addDays, addMonths, diffDays, dLabel, formatKo, formatShort, parts, startOfMonth } from '../dates'
import type { AppState, ISODate, LHResult, MemberId, PeriodLog, PregnancyTestResult, Settings } from '../types'
import {
  LONG_LATE_DAYS,
  MAX_CYCLE,
  MIN_CYCLE,
  chanceLevel,
  cycleAt,
  cycleStats,
  fertilityStatus,
  firstSurge,
  sortedStarts,
  upcomingWindows,
  type ChanceLevel,
  type CycleInput,
  type CycleStats,
  type CycleWindow,
  type DayInfo,
  type DayPhase,
  type FertilityStatus,
} from './cycle'
import { canSeeCycleDetails, settingsFor } from './prefs'
import { alertStyleLabel } from './settings'
import { activePositivePending, activeRest } from './ttc'

// ── Who sees what ───────────────────────────────────────────

/**
 * How fertility estimates are shown to the current viewer.
 * - explicit: 가임기 / 배란 wording, peak days and ovulation marker
 * - soft:     "우리의 주간" wording, no 배란 marker
 * - hidden:   only periods and predicted periods (low-pressure mode, or a
 *             partner who turned fertile-day info off)
 */
export type FertilityView = 'explicit' | 'soft' | 'hidden'

export function fertilityView(
  settings: Pick<Settings, 'lowPressure' | 'alertStyle'>,
  viewer: MemberId,
  cycleOwnerId: MemberId,
): FertilityView {
  if (settings.lowPressure) return 'hidden'
  const isOwner = viewer === cycleOwnerId
  const style = settings.alertStyle?.[viewer] ?? (isOwner ? 'explicit' : 'soft')
  // 'off' only silences alerts for the person whose cycle it is — the calendar is
  // their own record. For the partner it also hides the estimates here.
  if (style === 'off') return isOwner ? 'explicit' : 'hidden'
  return style
}

/** Why estimates are hidden — drives the explanation line. */
export function hiddenReason(settings: Pick<Settings, 'lowPressure'>): 'low-pressure' | 'off' {
  return settings.lowPressure ? 'low-pressure' : 'off'
}

/**
 * One-line notice above the calendar explaining the current view, or null for
 * the plain explicit view. Never uses 가임기/배란 itself — the whole point of
 * the soft and hidden views is to keep that wording off this viewer's screen.
 * Names match the settings screen (알림 › 부담 없이 모드 / 받지 않을래요).
 */
export function viewNotice(view: FertilityView, settings: Pick<Settings, 'lowPressure'>): { icon: string; text: string } | null {
  if (view === 'explicit') return null
  if (view === 'soft') return { icon: '💞', text: '‘우리의 주간’처럼 부드러운 표현으로 보고 있어요.' }
  if (hiddenReason(settings) === 'low-pressure')
    return { icon: '🌿', text: '부담 없이 모드예요 · 날짜 예측 없이 생리 기록만 보여요.' }
  return { icon: '🔕', text: `알림 방식을 ‘${alertStyleLabel('off')}’로 골라서 날짜 예측을 숨겼어요.` }
}

/** Fertile phases are dropped entirely in the hidden view. */
export function visiblePhase(phase: DayPhase, view: FertilityView): DayPhase {
  if (view === 'hidden' && (phase === 'peak' || phase === 'fertile' || phase === 'possible')) return 'none'
  return phase
}

// ── Whose calendar, and what may this viewer see ────────────

/**
 * Fertile-day display pauses while resting this cycle ("이번 주기는 쉬어요",
 * after a live vaccine or a loss) and while a positive home test waits for
 * the clinic — no windows, no countdowns, no alerts.
 */
export type CyclePause = 'rest' | 'positive'

/** Uses ttc.activeRest / activePositivePending, so a period logged anywhere settles both. */
export function cyclePause(state: PauseState): CyclePause | undefined {
  if (activePositivePending(state)) return 'positive'
  if (activeRest(state)) return 'rest'
  return undefined
}

type PauseState = Pick<AppState, 'restCycle' | 'positivePending' | 'periods' | 'stage'>

/**
 * Everything that decides what one viewer sees on the cycle screens:
 * - view: their wording (explicit / soft / hidden)
 * - details: period days, LH and pregnancy-test results (the cycle owner, or a
 *   partner the owner shared them with — prefs.canSeeCycleDetails). Without
 *   them only the shared "우리의 주간" band is left, always in soft wording.
 * - owner: the viewer is the person whose cycle it is
 * - pause: see CyclePause
 */
export interface Lens {
  view: FertilityView
  details: boolean
  owner: boolean
  pause?: CyclePause
  /** When the positive test awaiting the clinic was logged. */
  pendingSince?: ISODate
}

export const OWNER_LENS = (view: FertilityView): Lens => ({ view, details: true, owner: true })

export function cycleLens(state: Pick<AppState, 'couple' | 'settings'> & PauseState, viewer: MemberId): Lens {
  const ownerId = state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
  const details = canSeeCycleDetails(state, viewer)
  const own = fertilityView(settingsFor(state.settings, viewer), viewer, ownerId)
  const pause = cyclePause(state)
  const pending = activePositivePending(state)
  return {
    view: !details && own === 'explicit' ? 'soft' : own,
    details,
    owner: viewer === ownerId,
    ...(pause ? { pause } : {}),
    ...(pending ? { pendingSince: pending.since } : {}),
  }
}

/**
 * The phase this viewer sees. On top of visiblePhase: a pause drops the fertile
 * band (and, while a positive test waits, the projected period); a partner
 * without details sees only the band, with no 가장 좋은 때 / 가능 범위; a soft
 * partner sees no 가장 좋은 때.
 */
export function lensPhase(phase: DayPhase, lens: Lens): DayPhase {
  const p = visiblePhase(phase, lens.view)
  const fertile = p === 'peak' || p === 'fertile' || p === 'possible'
  if (lens.pause && fertile) return 'none'
  if (lens.pause === 'positive' && p === 'period-predicted') return 'none'
  if (!lens.details) return p === 'peak' || p === 'fertile' ? 'fertile' : 'none'
  if (!lens.owner && lens.view !== 'explicit' && p === 'peak') return 'fertile'
  return p
}

/** LH marks: details, not hidden, and (own record or explicit wording). */
export function showsLH(lens: Lens): boolean {
  return lens.details && lens.view !== 'hidden' && (lens.owner || lens.view === 'explicit')
}

/** Pregnancy-test marks: the owner always; a partner with details and explicit wording. */
export function showsTests(lens: Lens): boolean {
  return lens.details && (lens.owner || lens.view === 'explicit')
}

export function phaseLabel(phase: DayPhase, view: FertilityView): string {
  const p = visiblePhase(phase, view)
  switch (p) {
    case 'period':
      return '생리'
    case 'period-predicted':
      return '생리 예정'
    case 'peak':
      return view === 'soft' ? '우리의 주간 예상, 가장 좋은 때' : '가임기 예상, 가능성 높음'
    case 'fertile':
      return view === 'soft' ? '우리의 주간 예상' : '가임기 예상'
    case 'possible':
      return '가능 범위'
    default:
      return ''
  }
}

export const CHANCE_LABEL: Record<ChanceLevel, string> = { high: '높음', medium: '보통', low: '낮음' }

// ── Month navigation ────────────────────────────────────────

/** The calendar can move this many months either side of today. */
export const MONTH_NAV_LIMIT = 12

function monthIndex(iso: ISODate): number {
  const { year, month } = parts(iso)
  return year * 12 + month - 1
}

/** Months from today's month to `month` (negative = past). */
export function monthOffset(month: ISODate, today: ISODate): number {
  return monthIndex(month) - monthIndex(today)
}

export function canShiftMonth(month: ISODate, delta: number, today: ISODate): boolean {
  return Math.abs(monthOffset(month, today) + delta) <= MONTH_NAV_LIMIT
}

/** First day of the month `delta` months away, clamped to ±MONTH_NAV_LIMIT. */
export function shiftMonth(month: ISODate, delta: number, today: ISODate): ISODate {
  const off = Math.max(-MONTH_NAV_LIMIT, Math.min(MONTH_NAV_LIMIT, monthOffset(month, today) + delta))
  return startOfMonth(addMonths(startOfMonth(today), off))
}

export function monthTitle(month: ISODate): string {
  const { year, month: m } = parts(month)
  return `${year}년 ${m}월`
}

// ── Calendar cells ──────────────────────────────────────────

/** A small text mark on a calendar day (LH strength, 임테기). */
export interface Badge {
  text: string
  className: string
}

export const LH_LABEL: Record<LHResult, string> = { negative: '음성', faint: '희미', positive: '양성', peak: '가장 진함' }
export const PTEST_LABEL: Record<PregnancyTestResult, string> = { negative: '음성', faint: '희미', positive: '양성' }

const PILL = 'rounded px-0.5 text-[8px] font-bold leading-[11px]'

/** LH strength under the day number: a dot for 음성, then 희미 → 양성 → 진함 (가장 진함). */
export function lhBadge(result: LHResult): Badge {
  switch (result) {
    case 'negative':
      return { text: '', className: 'h-1.5 w-1.5 rounded-full bg-ink-3' }
    case 'faint':
      return { text: '희미', className: `${PILL} border border-ok/70 bg-surface text-ok` }
    case 'positive':
      return { text: '양성', className: `${PILL} bg-ok text-surface` }
    case 'peak':
      return { text: '진함', className: `${PILL} bg-ok text-surface ring-1 ring-ink` }
  }
}

/** 임테기 mark at the day's top-left corner. */
export function ptestBadge(result: PregnancyTestResult): Badge {
  const base = 'flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold leading-none'
  switch (result) {
    case 'negative':
      return { text: '임', className: `${base} border border-line bg-surface text-ink-3` }
    case 'faint':
      return { text: '임', className: `${base} border border-brand/70 bg-surface text-brand-ink` }
    case 'positive':
      return { text: '임', className: `${base} bg-brand text-surface` }
  }
}

export interface CellView {
  date: ISODate
  day: number
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  phase: DayPhase
  /** Ovulation marker (explicit view only). */
  star: boolean
  /** Strongest LH result that day, when this viewer may see it. */
  lh?: LHResult
  lhBadge?: Badge
  /** Strongest pregnancy-test result that day, when this viewer may see it. */
  ptest?: PregnancyTestResult
  ptestBadge?: Badge
  /** Classes for the round day marker inside the button. */
  className: string
  ariaLabel: string
}

const HATCH = 'bg-[repeating-linear-gradient(135deg,rgb(var(--fert)/0.16)_0_3px,transparent_3px_7px)]'

export const PHASE_CLASS: Record<DayPhase, string> = {
  // text-surface = white in light mode, near-black in dark mode, where the
  // fills get lighter (white on dark-mode fert is ~2.6:1).
  period: 'bg-period text-surface font-semibold',
  'period-predicted': 'border-2 border-dashed border-period/70 text-period',
  peak: 'bg-fert text-surface font-semibold',
  fertile: 'bg-fert-soft text-fert font-semibold',
  possible: `border border-dashed border-fert/40 text-ink ${HATCH}`,
  none: 'text-ink',
}

/** Plain days spilling in from the adjacent months get lighter digits (still ≥4.5:1). */
const OUTSIDE_PLAIN = 'text-ink-3'

const PTEST_RANK: Record<PregnancyTestResult, number> = { negative: 0, faint: 1, positive: 2 }

/** The strongest of a day's pregnancy-test results. */
export function strongestTest(results: PregnancyTestResult[]): PregnancyTestResult | undefined {
  return results.reduce<PregnancyTestResult | undefined>(
    (best, r) => (!best || PTEST_RANK[r] > PTEST_RANK[best] ? r : best),
    undefined,
  )
}

export interface CellContext {
  month: ISODate
  today: ISODate
  view: FertilityView
  /** Defaults to the owner's own calendar in `view`. */
  lens?: Lens
  /** Strongest pregnancy-test result logged that day. */
  ptest?: PregnancyTestResult
}

export function cellView(info: DayInfo, ctx: CellContext): CellView {
  const { month, today } = ctx
  const lens = ctx.lens ?? OWNER_LENS(ctx.view)
  const view = lens.view
  const { day, month: m } = parts(info.date)
  const inMonth = m === parts(month).month
  const isToday = info.date === today
  const phase = lensPhase(info.phase, lens)
  const star = view === 'explicit' && lens.details && !lens.pause && info.isOvulation && phase !== 'period'
  const lh = showsLH(lens) ? info.hasLH : undefined
  const ptest = showsTests(lens) ? ctx.ptest : undefined

  const labels = [formatKo(info.date).replace(/ \((.)\)$/, ' $1요일')]
  if (isToday) labels.push('오늘')
  const pl = phaseLabel(phase, view)
  if (pl) labels.push(pl)
  if (star) labels.push('배란 예상일')
  if (lh) labels.push(`LH ${LH_LABEL[lh]}`)
  if (ptest) labels.push(`임테기 ${PTEST_LABEL[ptest]}`)

  // Next/previous-month days keep the same predicted colours as this month's
  // (a window running into next month must not look less likely).
  const className = [
    'relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums',
    !inMonth && phase === 'none' ? OUTSIDE_PLAIN : PHASE_CLASS[phase],
    isToday && 'ring-2 ring-brand ring-offset-2 ring-offset-surface font-bold',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    date: info.date,
    day,
    inMonth,
    isToday,
    isFuture: info.date > today,
    phase,
    star,
    ...(lh ? { lh, lhBadge: lhBadge(lh) } : {}),
    ...(ptest ? { ptest, ptestBadge: ptestBadge(ptest) } : {}),
    className,
    ariaLabel: labels.join(', '),
  }
}

export interface LegendItem {
  key: string
  label: string
  swatch: string
  /** A second swatch drawn next to the first (생리 · 예정). */
  swatch2?: string
  /** A glyph instead of a swatch (⭐ 배란 예상). */
  mark?: string
}

/** The legend never grows past this. */
export const LEGEND_MAX = 5

export function legendItems(view: FertilityView, lens?: Partial<Omit<Lens, 'view'>>): LegendItem[] {
  const details = lens?.details ?? true
  const owner = lens?.owner ?? true
  const v: FertilityView = !details && view === 'explicit' ? 'soft' : view
  const items: LegendItem[] = []
  if (details)
    items.push({ key: 'period', label: '생리 · 예정', swatch: PHASE_CLASS.period, swatch2: PHASE_CLASS['period-predicted'] })
  if (v === 'hidden' || lens?.pause) return items
  if (!details) return [{ key: 'fertile', label: '우리의 주간 (예상)', swatch: PHASE_CLASS.fertile }]
  const soft = v === 'soft'
  items.push({ key: 'fertile', label: soft ? '우리의 주간' : '가임기 예상', swatch: PHASE_CLASS.fertile })
  if (!soft || owner) items.push({ key: 'peak', label: soft ? '가장 좋은 때' : '가능성 높음', swatch: PHASE_CLASS.peak })
  items.push({ key: 'possible', label: '가능 범위', swatch: PHASE_CLASS.possible })
  if (v === 'explicit') items.push({ key: 'ovulation', label: '배란 예상', swatch: '', mark: '⭐' })
  return items
}

// ── Summary ─────────────────────────────────────────────────

/** cycle.ts averages this many recent cycles. */
const RECENT_CYCLES = 6

export function averageSourceLabel(stats: CycleStats): string {
  if (stats.source === 'settings') return '설정값 — 두 번 이상 기록하면 자동으로 계산해요'
  const n = Math.min(stats.lengths.length, RECENT_CYCLES)
  const spread = stats.min !== undefined && stats.max !== undefined && stats.min !== stats.max ? ` (${stats.min}~${stats.max}일)` : ''
  return `최근 ${n}주기 평균${spread}`
}

export interface Headline {
  title: string
  sub?: string
}

/** NICE NG257 framing, used wherever fertile-day estimates are hidden. */
export const NICE_LINE = '특정 날을 맞추기보다 2~3일에 한 번, 편한 리듬이면 좋아요.'

/** Shared with the 오늘 hero and the late-period notice (lib/logic/cycle.ts). */
export { LONG_LATE_DAYS }

/** After a pregnancy ended, before a new period is logged. */
export const AFTER_PREGNANCY_HEADLINE: Headline = {
  title: '몸과 마음을 먼저 챙겨요',
  sub: '생리가 다시 시작되면 그날을 눌러 기록해 주세요. 그때부터 다시 예상해 드릴게요.',
}

export interface HeadlineContext {
  today: ISODate
  cycleDay?: number
  nextPeriod?: ISODate
  /** Most recent logged period start. */
  lastStart?: ISODate
}

export function statusHeadline(status: FertilityStatus, view: FertilityView, ctx: HeadlineContext): Headline {
  // Hidden view: no fertile wording or countdown — only the (neutral) period estimate.
  const neutral: Headline =
    ctx.nextPeriod && ctx.nextPeriod > ctx.today
      ? { title: `다음 생리까지 ${diffDays(ctx.today, ctx.nextPeriod)}일 (예상)`, sub: NICE_LINE }
      : { title: `주기 ${ctx.cycleDay ?? 1}일째`, sub: NICE_LINE }
  switch (status.kind) {
    case 'no-data':
      return { title: '마지막 생리 시작일을 알려 주세요', sub: '한 번만 기록해도 다음 예정일을 계산해요.' }
    case 'after-pregnancy':
      return AFTER_PREGNANCY_HEADLINE
    case 'late':
      if (status.daysLate > LONG_LATE_DAYS && ctx.lastStart)
        return {
          title: '최근 생리 기록이 없어요',
          sub: `마지막 기록은 ${formatKo(ctx.lastStart)}이에요. 그 뒤에 시작한 날을 달력에서 눌러 기록하면 예측을 다시 계산해요.`,
        }
      return {
        title: `생리 예정일이 ${status.daysLate}일 지났어요`,
        sub: '시작했다면 기록해 주세요. 주기는 원래 조금씩 달라져요. 며칠 더 늦어지면 임신 테스트를 해 봐도 좋아요.',
      }
    case 'period':
      // The end date only changes how the calendar colours this period — predictions use start dates.
      if (view !== 'hidden' && status.nextFertileStart)
        return {
          title: `생리 ${status.cycleDay}일째`,
          sub:
            view === 'soft'
              ? `다음 우리의 주간은 ${formatKo(status.nextFertileStart)}부터예요 (예상).`
              : `다음 가임기는 ${formatKo(status.nextFertileStart)}부터예요 (예상).`,
        }
      // Short cycle: the estimated window already started during the period.
      if (view !== 'hidden' && status.fertileEnd)
        return {
          title: `생리 ${status.cycleDay}일째`,
          sub:
            view === 'soft'
              ? `이번 우리의 주간은 ${formatKo(status.fertileEnd)}까지예요 (예상).`
              : `주기가 짧은 편이라 예상 가임기가 생리 기간과 겹쳐요. ${formatKo(status.fertileEnd)}까지예요 (예상).`,
        }
      return { title: `생리 ${status.cycleDay}일째`, sub: '끝나는 날도 기록해 두면 달력에 정확히 보여요.' }
    case 'before-fertile':
      if (view === 'hidden') return neutral
      if (view === 'soft')
        return {
          title: `다음 우리의 주간: ${formatKo(status.fertileStart)}부터`,
          sub: '예상이에요. 미리 데이트 계획을 세워 봐도 좋아요.',
        }
      return {
        title: `가임기까지 ${status.daysUntil}일 (예상)`,
        sub: `${formatKo(status.fertileStart)}부터예요. 며칠 전부터 LH 테스트를 해 보면 더 정확해요.`,
      }
    case 'fertile':
      if (view === 'hidden') return neutral
      if (view === 'soft')
        return {
          title: '지금은 우리의 주간이에요 (예상)',
          sub: `${formatKo(status.fertileEnd)}까지 · 둘만의 시간을 편하게 챙겨요.`,
        }
      return {
        title: status.isOvulation
          ? '오늘은 배란 예상일이에요'
          : status.peak
            ? '가능성이 높은 날이에요 (예상)'
            : '가임기 예상 기간이에요',
        // ASRM 2022: every 1–2 days is best, 2–3 times a week nearly as good.
        sub: `${formatKo(status.fertileEnd)}까지 · 매일이 아니어도 괜찮아요. 일주일에 2~3번도 거의 비슷해요.`,
      }
    case 'after-fertile':
      return status.daysUntilPeriod === 0
        ? { title: '오늘이 생리 예정일이에요 (예상)', sub: '시작하면 기록해 주세요. 다음 예측이 더 정확해져요.' }
        : {
            title: `다음 생리까지 ${status.daysUntilPeriod}일 (예상)`,
            sub: view === 'hidden' ? NICE_LINE : `${formatKo(status.nextPeriod)} 무렵이에요.`,
          }
  }
}

export interface SummaryRow {
  key: string
  label: string
  value: string
  sub?: string
  /** Spans both columns (long values). */
  wide?: boolean
}

export interface CycleSummary {
  status: FertilityStatus
  stats: CycleStats
  headline: Headline
  cycleDay?: number
  nextPeriod?: ISODate
  window?: CycleWindow
  rows: SummaryRow[]
}

/** What a viewer without details sees (only the shared 우리의 주간, soft wording). */
export function sharedHeadline(status: FertilityStatus, view: FertilityView, pause?: CyclePause): Headline {
  if (view === 'hidden') return { title: '우리 리듬대로 지내요', sub: NICE_LINE }
  if (status.kind === 'no-data') return { title: '아직 우리의 주간 예상이 없어요', sub: '주기 기록이 시작되면 여기에 보여요.' }
  if (!pause) {
    if (status.kind === 'fertile' || (status.kind === 'period' && status.fertileEnd)) {
      const end = status.kind === 'fertile' ? status.fertileEnd : status.fertileEnd!
      return { title: '지금은 우리의 주간이에요 (예상)', sub: `${formatKo(end)}까지 · 둘만의 시간을 편하게 챙겨요.` }
    }
    const next =
      status.kind === 'before-fertile' ? status.fertileStart : status.kind === 'period' ? status.nextFertileStart : undefined
    if (next) return { title: `다음 우리의 주간: ${formatKo(next)}부터 (예상)`, sub: '평소처럼 편하게 지내요.' }
  }
  return { title: '편안한 날들이에요', sub: '우리의 주간이 가까워지면 여기에 보여요.' }
}

/** Headline while fertile display is paused (the viewer can see details). */
export function pauseHeadline(pause: CyclePause, view: FertilityView, owner: boolean): Headline {
  if (pause === 'positive')
    return owner
      ? {
          title: '병원에서 확인해 봐요',
          sub: '임테기 양성으로 기록했어요. 병원에서 확인하기 전까지 날짜 예상은 잠시 멈춰요.',
        }
      : {
          title: '병원 확인을 기다리고 있어요',
          // Test results by name only in explicit wording (like the calendar's showsTests).
          sub: view === 'explicit' ? '임테기 양성이 기록됐어요. 확인 전이니 차분히 함께 기다려요.' : '확인 전이니 차분히 함께 기다려요.',
        }
  if (!owner) return { title: '이번 주기는 쉬어 가요', sub: '평소처럼 편하게 지내요.' }
  return {
    title: '이번 주기는 쉬어요',
    sub:
      view === 'explicit'
        ? '가임기 표시와 알림을 잠시 껐어요. 다음 생리를 기록하면 다시 켜져요.'
        : '날짜 표시와 알림을 잠시 껐어요. 다음 생리를 기록하면 다시 켜져요.',
  }
}

export type SummaryOptions = Partial<Omit<Lens, 'view'>>

/**
 * The 주기 tab's first card. `opts` narrows it for the viewer (see Lens): a
 * partner without details gets only the shared band, a pause replaces the
 * fertile rows with a calm headline.
 */
export function cycleSummary(input: CycleInput, today: ISODate, view: FertilityView, opts: SummaryOptions = {}): CycleSummary {
  const details = opts.details ?? true
  const owner = opts.owner ?? true
  const pause = opts.pause
  const status = fertilityStatus(input, today)
  const stats = cycleStats(input.periods, input.cycle)
  const starts = sortedStarts(input.periods)
  const last = starts[starts.length - 1]

  if (!details) {
    const v: FertilityView = view === 'explicit' ? 'soft' : view
    const window = pause || v === 'hidden' ? undefined : upcomingWindows(input, today, 1)[0]
    return {
      status,
      stats,
      headline: sharedHeadline(status, v, pause),
      window,
      rows: window
        ? [{ key: 'window', label: '우리의 주간 (예상)', value: `${formatKo(window.fertileStart)} ~ ${formatKo(window.fertileEnd)}`, wide: true }]
        : [],
    }
  }

  let cycleDay: number | undefined
  let nextPeriod: ISODate | undefined
  if (status.kind === 'late') {
    const sinceLast = last ? diffDays(last, today) + 1 : undefined
    cycleDay = sinceLast !== undefined ? knownCycleDay({ cycleDay: sinceLast }) : undefined
    nextPeriod = status.expected
  } else if (status.kind !== 'no-data' && status.kind !== 'after-pregnancy') {
    cycleDay = status.cycleDay
    nextPeriod = status.kind === 'after-fertile' ? status.nextPeriod : cycleAt(input, today)?.nextPeriod
  }

  // While a period is late the next window depends on when it actually starts,
  // so don't show a confident-looking range (the calendar still shows the rough projection).
  const late = status.kind === 'late'
  const longLate = late && status.daysLate > LONG_LATE_DAYS
  const avgRow: SummaryRow = { key: 'avg', label: '평균 주기', value: `${stats.average}일`, sub: averageSourceLabel(stats) }
  const periodRow: SummaryRow | undefined =
    nextPeriod && !longLate
      ? {
          key: 'period',
          label: status.kind === 'late' ? '생리 예정일 (지남)' : '다음 생리 (예상)',
          value: formatKo(nextPeriod),
          sub: dLabel(nextPeriod, today),
        }
      : undefined

  if (pause === 'positive') {
    return {
      status,
      stats,
      headline: pauseHeadline(pause, view, owner),
      cycleDay,
      rows:
        opts.pendingSince && (owner || view === 'explicit')
          ? [{ key: 'ptest', label: '임테기 양성', value: formatKo(opts.pendingSince), sub: '병원 확인 전', wide: true }]
          : [],
    }
  }
  if (pause === 'rest') {
    return {
      status,
      stats,
      headline: pauseHeadline(pause, view, owner),
      cycleDay,
      nextPeriod,
      rows: [...(periodRow ? [periodRow] : []), avgRow],
    }
  }

  const window = upcomingWindows(input, today, 1)[0]
  const rows: SummaryRow[] = []
  if (periodRow) rows.push(periodRow)
  if (window && view !== 'hidden') {
    const range = `${formatKo(window.fertileStart)} ~ ${formatKo(window.fertileEnd)}`
    if (view === 'soft') {
      rows.push({ key: 'window', label: '우리의 주간 (예상)', value: range, wide: true })
    } else {
      rows.push({ key: 'window', label: '가임기 (예상)', value: range, wide: true })
      rows.push({
        key: 'ovulation',
        label: '배란 (예상)',
        value: formatKo(window.ovulation),
        sub: window.basis === 'lh' ? 'LH 테스트 기준' : '달력 계산',
      })
    }
  }
  rows.push(avgRow)

  const own = statusHeadline(status, view, { today, cycleDay, nextPeriod, lastStart: last })
  return {
    status,
    stats,
    headline: owner ? own : partnerHeadline(status, view, own),
    cycleDay,
    nextPeriod,
    window,
    rows,
  }
}

/**
 * The partner (who shared details) reads the same status, minus what only the
 * cycle owner can act on — "기록해 주세요", "LH 테스트를 해 보면", "임신
 * 테스트를 해 봐도" — and with a calm "don't ask, don't rush" line instead
 * (review: 배란 뒤 남편 화면 '증상은 묻지 말고 평소처럼').
 */
export function partnerHeadline(status: FertilityStatus, view: FertilityView, own: Headline): Headline {
  switch (status.kind) {
    case 'no-data':
      return { title: '아직 주기 기록이 없어요', sub: '기록이 시작되면 여기에 보여요.' }
    case 'after-pregnancy':
      return { title: AFTER_PREGNANCY_HEADLINE.title, sub: '서두르지 않아도 괜찮아요. 서로의 속도에 맞춰 천천히 가요.' }
    case 'late':
      if (status.daysLate > LONG_LATE_DAYS) return { title: '최근 생리 기록이 없어요', sub: '기록이 채워지면 다시 예상해요.' }
      return { title: own.title, sub: '주기는 원래 조금씩 달라져요. 묻거나 재촉하지 말고 평소처럼 지내요.' }
    case 'period':
      // Keep the next-window line; otherwise the owner's "끝나는 날도 기록해 두면…".
      return view !== 'hidden' && (status.nextFertileStart || status.fertileEnd)
        ? own
        : { title: own.title, sub: '평소보다 조금 더 챙겨 주면 좋아요.' }
    case 'before-fertile':
      return view === 'explicit' ? { title: own.title, sub: `${formatKo(status.fertileStart)}부터예요.` } : own
    case 'after-fertile':
      if (status.daysUntilPeriod === 0) return { title: own.title, sub: '평소처럼 편하게 지내요.' }
      // The hidden view keeps its neutral NICE line (no "waiting" framing).
      return view === 'hidden' ? own : { title: own.title, sub: '기다리는 시간이에요. 증상은 묻지 말고 평소처럼 보내요.' }
    default:
      return own
  }
}

export function irregularMessage(view: FertilityView): string {
  return view === 'hidden'
    ? '주기가 들쭉날쭉하면 생리 예정일 예측이 더 부정확해요. 이런 주기가 이어지면 전문의와 상담해 보세요.'
    : '주기가 들쭉날쭉하면 달력 예측이 더 부정확해요. LH 테스트를 쓰거나 전문의와 상담해 보세요.'
}

// ── Day sheet ───────────────────────────────────────────────

function periodEnd(p: PeriodLog, periodLength: number): ISODate {
  if (p.end && p.end >= p.start) return p.end
  return addDays(p.start, Math.max(1, periodLength) - 1)
}

/** The logged period whose (logged or default-length) bleeding days include `date`. */
export function periodCovering(periods: PeriodLog[], date: ISODate, periodLength: number): PeriodLog | undefined {
  return [...periods]
    .sort((a, b) => (a.start < b.start ? 1 : -1))
    .find((p) => date >= p.start && date <= periodEnd(p, periodLength))
}

/** Longest bleed we offer to extend a logged period to. */
export const MAX_PERIOD_DAYS = 10

export interface DayActions {
  /** Past or today — logging allowed. */
  canLog: boolean
  covering?: PeriodLog
  isStart: boolean
  isEnd: boolean
  /** A period that started a few days before and could end on this date. */
  extendable?: PeriodLog
  /** A logged start a few days AFTER this date — maybe it really began here. */
  moveable?: PeriodLog
  /** The closest other logged start nearer than a plausible cycle — likely the same period. */
  nearby?: PeriodLog
}

export function dayActions(periods: PeriodLog[], date: ISODate, today: ISODate, periodLength: number): DayActions {
  const canLog = date <= today
  const covering = periodCovering(periods, date, periodLength)
  if (covering) {
    return { canLog, covering, isStart: covering.start === date, isEnd: covering.end === date }
  }
  const byDistance = [...periods].sort(
    (a, b) => Math.abs(diffDays(a.start, date)) - Math.abs(diffDays(b.start, date)) || (a.start < b.start ? -1 : 1),
  )
  const before = byDistance.find((p) => p.start < date)
  const after = byDistance.find((p) => p.start > date)
  const extendable = before && diffDays(before.start, date) < MAX_PERIOD_DAYS ? before : undefined
  const moveable = after && diffDays(date, after.start) < MAX_PERIOD_DAYS ? after : undefined
  const closest = byDistance[0]
  const nearby = closest && Math.abs(diffDays(closest.start, date)) < MIN_CYCLE ? closest : undefined
  return { canLog, isStart: false, isEnd: false, extendable, moveable, nearby }
}

/**
 * Cycle day worth showing. cycle.ts keeps counting through a gap between two
 * logs that is longer than any plausible cycle (a missed log), which would read
 * as "주기 148일째" — treat those days as unknown instead.
 */
export function knownCycleDay(info: Pick<DayInfo, 'cycleDay'>): number | undefined {
  return info.cycleDay !== undefined && info.cycleDay <= MAX_CYCLE ? info.cycleDay : undefined
}

/** Sheet title: '10월 3일 (금)', with the year when it isn't this year. */
export function dayTitle(date: ISODate, today: ISODate): string {
  return formatKo(date, { year: date.slice(0, 4) !== today.slice(0, 4) })
}

/**
 * "임신 가능성(예상)" value for the day sheet, or null when it must not be shown.
 * Only days inside the estimated window or its wider "가능 범위" band get one:
 * a confident 낮음 elsewhere would read as a "safe day" (it isn't — Wilcox
 * 2000 found fertile women on every cycle day from 6 to 21), and the soft /
 * hidden views keep pregnancy-chance wording off the screen altogether.
 */
export function dayChanceLabel(info: DayInfo, view: FertilityView): string | null {
  if (view !== 'explicit' || info.unpredicted || knownCycleDay(info) === undefined) return null
  const phase = visiblePhase(info.phase, view)
  if (phase === 'possible') return `${CHANCE_LABEL.low}~${CHANCE_LABEL.medium}`
  if (phase !== 'peak' && phase !== 'fertile') return null
  return CHANCE_LABEL[chanceLevel(info.ovulationOffset)]
}

/** Shown on explicit-view days outside the estimated range (instead of a 낮음 rating). */
export const OUTSIDE_RANGE_NOTE = '예상 범위 밖이에요 · 예측은 주기마다 틀릴 수 있어요.'

/** Shown instead of the logging buttons for days after today. */
export function futureDayNote(view: FertilityView): string {
  return view === 'hidden'
    ? '아직 오지 않은 날이라 예정일만 보여줘요. 그날이 되면 생리를 기록할 수 있어요.'
    : '아직 오지 않은 날이라 예측만 보여줘요. 그날이 되면 생리나 LH 테스트를 기록할 수 있어요.'
}

/**
 * One or two sentences explaining a tapped day, worded for the view. `canLog`
 * = false (the partner) drops the "기록해 주세요" asks.
 */
export function explainDay(info: DayInfo, view: FertilityView, isPast: boolean, canLog = true): string {
  switch (visiblePhase(info.phase, view)) {
    case 'period':
      return '기록된 생리 기간이에요.'
    case 'period-predicted':
      if (!canLog) return isPast ? '생리가 시작될 것으로 예상했던 날이에요.' : '생리가 시작될 것으로 예상되는 무렵이에요.'
      return isPast
        ? '생리가 시작될 것으로 예상했던 날이에요. 시작했다면 기록해 주세요.'
        : '생리가 시작될 것으로 예상되는 무렵이에요. 시작하면 기록해 주세요 — 다음 예측이 더 정확해져요.'
    case 'peak':
      return view === 'soft'
        ? '우리의 주간 한가운데예요 (예상). 둘만의 시간을 편하게 챙겨 보세요.'
        : '배란 예상일과 그 전 이틀이에요. 가임기 중에서도 가능성이 가장 높은 때예요 (예상).'
    case 'fertile':
      return view === 'soft'
        ? '우리의 주간이에요 (예상). 서로 컨디션을 살피며 편하게 보내요.'
        : '배란 예상일로 끝나는 6일, 가임기 예상 기간이에요.'
    case 'possible':
      return view === 'soft'
        ? '우리의 주간 앞뒤로 여유를 둔 날이에요. 주기마다 며칠씩 달라질 수 있어서요.'
        : '예측 오차를 고려한 가능 범위예요. 배란일은 주기마다 며칠씩 달라질 수 있어요.'
    default:
      if (info.unpredicted === 'paused')
        return canLog
          ? '임신 기록이 끝난 뒤라 이 무렵은 예측하지 않았어요. 생리가 다시 시작되면 그날을 기록해 주세요.'
          : '임신 기록이 끝난 뒤라 이 무렵은 예측하지 않았어요.'
      if (info.unpredicted === 'late')
        return canLog
          ? '생리 예정일이 지나서 이 무렵은 예측하지 않았어요. 생리가 시작됐다면 그날을 기록해 주세요.'
          : '생리 예정일이 지나서 이 무렵은 예측하지 않았어요.'
      if (info.cycleDay === undefined) return '첫 생리 기록 전의 날이라 예측이 없어요.'
      if (knownCycleDay(info) === undefined)
        return canLog
          ? '앞뒤 기록 사이가 길어서 이 무렵은 예측하지 않았어요. 빠진 생리 기록이 있다면 여기서 추가해 주세요.'
          : '앞뒤 기록 사이가 길어서 이 무렵은 예측하지 않았어요.'
      if (view === 'hidden') return NICE_LINE
      return view === 'soft' ? '평범한 하루예요. 둘만의 시간은 언제든 좋아요.' : OUTSIDE_RANGE_NOTE
  }
}

/** explainDay through the viewer's lens (details, pause, partner). */
export function explainDayFor(info: DayInfo, lens: Lens, isPast: boolean): string {
  const phase = lensPhase(info.phase, lens)
  if (!lens.details) {
    if (lens.view === 'hidden') return NICE_LINE
    return phase === 'fertile'
      ? '우리의 주간이에요 (예상). 서로 컨디션을 살피며 편하게 보내요.'
      : '평범한 하루예요. 둘만의 시간은 언제든 좋아요.'
  }
  if (lens.pause && phase === 'none' && visiblePhase(info.phase, lens.view) !== 'none')
    return lens.pause === 'rest'
      ? '이번 주기는 쉬는 중이라 날짜 예상을 보여 주지 않아요.'
      : '병원에서 확인하기 전이라 날짜 예상을 잠시 멈췄어요.'
  return explainDay({ ...info, phase }, lens.view, isPast, lens.owner)
}

/** dayChanceLabel through the viewer's lens: never while paused or without details. */
export function dayChanceFor(info: DayInfo, lens: Lens): string | null {
  if (lens.pause || !lens.details) return null
  return dayChanceLabel({ ...info, phase: lensPhase(info.phase, lens) }, lens.view)
}

/** Compact "주기 12일째 · 가임기 예상" line for the log sheet's date header. */
export function dayLine(info: DayInfo, lens: Lens): string {
  const out: string[] = []
  const day = lens.details && !info.unpredicted ? knownCycleDay(info) : undefined
  if (day !== undefined) out.push(`주기 ${day}일째`)
  const label = phaseLabel(lensPhase(info.phase, lens), lens.view)
  if (label) out.push(label)
  return out.join(' · ')
}

// ── History ─────────────────────────────────────────────────

export interface HistoryRow {
  start: ISODate
  end?: ISODate
  /** Logged bleeding days (only when an end date is logged). */
  bleedDays?: number
  /** Days from this start to the next logged start. */
  cycleLength?: number
  /** 'gap' = longer than a plausible cycle (missed log?), 'short' = likely a duplicate. */
  hint?: 'gap' | 'short'
  /** The most recent logged period. */
  current: boolean
}

/** Logged periods newest first, with the measured cycle length to the following one. */
export function periodHistory(periods: PeriodLog[]): HistoryRow[] {
  const byStart = new Map(periods.map((p) => [p.start, p]))
  const starts = sortedStarts(periods)
  const rows = starts.map((start, i): HistoryRow => {
    const p = byStart.get(start)
    const end = p?.end && p.end >= start ? p.end : undefined
    const next = starts[i + 1]
    const cycleLength = next ? diffDays(start, next) : undefined
    const hint = cycleLength === undefined ? undefined : cycleLength > MAX_CYCLE ? 'gap' : cycleLength < MIN_CYCLE ? 'short' : undefined
    return {
      start,
      end,
      bleedDays: end ? diffDays(start, end) + 1 : undefined,
      cycleLength,
      hint,
      current: i === starts.length - 1,
    }
  })
  return rows.reverse()
}

export interface CycleHistoryRow extends HistoryRow {
  /** 시도 N번째 주기, counted from when trying started (undefined before it). */
  attempt?: number
  /** The cycle's first LH surge (양성 / 가장 진함) and its cycle day. */
  surge?: { date: ISODate; cycleDay: number }
}

export interface CycleHistory {
  /** Newest first. */
  rows: CycleHistoryRow[]
  /** Attempt number of the latest logged cycle. */
  current?: number
  /**
   * Some numbers are estimates: trying started more than a cycle before the
   * first log, or a missed log left a long gap (counted with the average length).
   */
  estimated: boolean
}

/**
 * Logged cycles with "시도 N번째 주기" since `ttcStart` (the cycle it falls in
 * is #1) and each cycle's first LH surge. Unlogged cycles are filled in with
 * the average length and flagged as estimated.
 */
export function cycleHistory(input: Pick<CycleInput, 'periods' | 'lhTests' | 'cycle'>, today: ISODate, ttcStart?: ISODate): CycleHistory {
  const base = periodHistory(input.periods).reverse() // oldest first
  const avg = cycleStats(input.periods, input.cycle).average
  const attempts = new Map<ISODate, number>()
  let estimated = false
  // A start date still ahead (planning to begin next month) numbers nothing yet.
  if (ttcStart && ttcStart <= today && base.length > 0) {
    let anchor = -1
    base.forEach((r, i) => {
      if (r.start <= ttcStart) anchor = i
    })
    let n: number
    let from: number
    if (anchor >= 0) {
      n = 1
      from = anchor
    } else {
      // Trying began before the first log: its cycle is #1, then about one per average length.
      const gap = diffDays(ttcStart, base[0]!.start)
      const between = Math.max(1, Math.ceil(gap / avg))
      if (gap > avg) estimated = true
      n = 1 + between
      from = 0
    }
    for (let i = from; i < base.length; i++) {
      if (i > from) {
        const gap = diffDays(base[i - 1]!.start, base[i]!.start)
        if (gap > MAX_CYCLE) {
          n += Math.max(1, Math.round(gap / avg))
          estimated = true
        } else if (gap >= MIN_CYCLE) n += 1
        // A gap shorter than any cycle is likely a duplicate log (flagged 'short'
        // in the list): it doesn't count as another try.
      }
      attempts.set(base[i]!.start, n)
    }
  }
  const rows: CycleHistoryRow[] = base.map((r) => {
    const len = r.cycleLength !== undefined && r.cycleLength <= MAX_CYCLE ? r.cycleLength : undefined
    // A finished cycle ends at the next start; the current one runs to today.
    const surgeDate =
      len !== undefined
        ? firstSurge(r.start, len, input.lhTests, 0)
        : r.current && r.start <= today
          ? firstSurge(r.start, Math.min(MAX_CYCLE, diffDays(r.start, today) + 1), input.lhTests, 0)
          : undefined
    const attempt = attempts.get(r.start)
    return {
      ...r,
      ...(attempt !== undefined ? { attempt } : {}),
      ...(surgeDate ? { surge: { date: surgeDate, cycleDay: diffDays(r.start, surgeDate) + 1 } } : {}),
    }
  })
  const latest = rows[rows.length - 1]
  return { rows: rows.reverse(), current: latest?.attempt, estimated }
}

// ── Calendar export ─────────────────────────────────────────

export const ICS_CYCLES = 3

export interface IcsAvailability {
  enabled: boolean
  reason?: string
  windows: CycleWindow[]
}

export function icsAvailability(
  input: CycleInput,
  today: ISODate,
  settings: Pick<Settings, 'lowPressure'>,
  view: FertilityView,
  pause?: CyclePause,
): IcsAvailability {
  if (pause === 'rest')
    return { enabled: false, reason: '이번 주기는 쉬는 중이라 만들지 않아요. 다음 생리를 기록하면 다시 만들 수 있어요.', windows: [] }
  if (pause === 'positive')
    return { enabled: false, reason: '병원에서 확인하기 전이라 날짜 알림을 만들지 않아요.', windows: [] }
  if (settings.lowPressure)
    return { enabled: false, reason: '부담 없이 모드에서는 날짜 알림을 만들지 않아요.', windows: [] }
  if (view === 'hidden')
    return {
      enabled: false,
      reason: `내 알림 방식이 ‘${alertStyleLabel('off')}’로 되어 있어요. 설정 › 알림에서 바꿀 수 있어요.`,
      windows: [],
    }
  if (input.periods.length === 0)
    return { enabled: false, reason: '생리 시작일을 한 번 기록하면 만들 수 있어요.', windows: [] }
  // Don't put alarms for guessed dates on both phones while the period is late.
  const kind = fertilityStatus(input, today).kind
  if (kind === 'after-pregnancy')
    return { enabled: false, reason: '생리가 다시 시작되면 기록해 주세요. 그때부터 만들 수 있어요.', windows: [] }
  if (kind === 'late')
    return {
      enabled: false,
      reason: '생리 예정일이 지나서 다음 일정을 아직 알 수 없어요. 새 생리 시작일을 기록하면 만들 수 있어요.',
      windows: [],
    }
  const windows = upcomingWindows(input, today, ICS_CYCLES)
  if (windows.length === 0) return { enabled: false, reason: '다가오는 예상 일정이 없어요.', windows }
  return { enabled: true, windows }
}

export function windowRangeShort(w: Pick<CycleWindow, 'fertileStart' | 'fertileEnd'>): string {
  return `${formatShort(w.fertileStart)}~${formatShort(w.fertileEnd)}`
}
