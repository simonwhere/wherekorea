// View-model helpers for the 달력 (cycle) tab. Pure functions only: they turn
// cycle.ts results into labels, class names and actions, applying the viewer's
// fertility-wording preference (settings.lowPressure / settings.alertStyle).
//
// Class names live here (not in the component) so the wording/visibility rules
// can be unit-tested; tailwind.config scans lib/** so they are compiled.

import { addDays, addMonths, diffDays, dLabel, formatKo, formatShort, parts, startOfMonth } from '../dates'
import type { ISODate, MemberId, PeriodLog, Settings } from '../types'
import {
  MAX_CYCLE,
  MIN_CYCLE,
  chanceLevel,
  cycleAt,
  cycleStats,
  fertilityStatus,
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
import { alertStyleLabel } from './settings'

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

export interface CellView {
  date: ISODate
  day: number
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  phase: DayPhase
  /** Ovulation marker (explicit view only). */
  star: boolean
  lh?: 'positive' | 'negative'
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

export function cellView(info: DayInfo, ctx: { month: ISODate; today: ISODate; view: FertilityView }): CellView {
  const { month, today, view } = ctx
  const { day, month: m } = parts(info.date)
  const inMonth = m === parts(month).month
  const isToday = info.date === today
  const phase = visiblePhase(info.phase, view)
  const star = view === 'explicit' && info.isOvulation && phase !== 'period'
  const lh = view === 'hidden' ? undefined : info.hasLH

  const labels = [formatKo(info.date).replace(/ \((.)\)$/, ' $1요일')]
  if (isToday) labels.push('오늘')
  const pl = phaseLabel(phase, view)
  if (pl) labels.push(pl)
  if (star) labels.push('배란 예상일')
  if (lh) labels.push(lh === 'positive' ? 'LH 양성' : 'LH 음성')

  const className = [
    'relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] tabular-nums',
    PHASE_CLASS[phase],
    isToday && 'ring-2 ring-brand ring-offset-2 ring-offset-surface font-bold',
    !inMonth && 'opacity-35',
  ]
    .filter(Boolean)
    .join(' ')

  return { date: info.date, day, inMonth, isToday, isFuture: info.date > today, phase, star, lh, className, ariaLabel: labels.join(', ') }
}

export interface LegendItem {
  key: string
  label: string
  swatch: string
}

export function legendItems(view: FertilityView): LegendItem[] {
  const items: LegendItem[] = [
    { key: 'period', label: '생리', swatch: PHASE_CLASS.period },
    { key: 'period-predicted', label: '생리 예정', swatch: PHASE_CLASS['period-predicted'] },
  ]
  if (view === 'hidden') return items
  const soft = view === 'soft'
  items.push(
    { key: 'peak', label: soft ? '가장 좋은 때' : '가능성 높음', swatch: PHASE_CLASS.peak },
    { key: 'fertile', label: soft ? '우리의 주간' : '가임기 예상', swatch: PHASE_CLASS.fertile },
    { key: 'possible', label: '가능 범위', swatch: PHASE_CLASS.possible },
  )
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

/** Past this many days late, "N일 지났어요" reads oddly — more likely a missed log. */
export const LONG_LATE_DAYS = 14

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
      if (view === 'hidden') return { title: `생리 ${status.cycleDay}일째`, sub: '끝나는 날도 기록해 두면 달력에 정확히 보여요.' }
      return {
        title: `생리 ${status.cycleDay}일째`,
        sub:
          view === 'soft'
            ? `다음 우리의 주간은 ${formatKo(status.nextFertileStart)}부터예요 (예상).`
            : `다음 가임기는 ${formatKo(status.nextFertileStart)}부터예요 (예상).`,
      }
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

export function cycleSummary(input: CycleInput, today: ISODate, view: FertilityView): CycleSummary {
  const status = fertilityStatus(input, today)
  const stats = cycleStats(input.periods, input.cycle)
  const starts = sortedStarts(input.periods)
  const last = starts[starts.length - 1]

  let cycleDay: number | undefined
  let nextPeriod: ISODate | undefined
  if (status.kind === 'late') {
    const sinceLast = last ? diffDays(last, today) + 1 : undefined
    cycleDay = sinceLast !== undefined ? knownCycleDay({ cycleDay: sinceLast }) : undefined
    nextPeriod = status.expected
  } else if (status.kind !== 'no-data') {
    cycleDay = status.cycleDay
    nextPeriod = status.kind === 'after-fertile' ? status.nextPeriod : cycleAt(input, today)?.nextPeriod
  }

  // While a period is late the next window depends on when it actually starts,
  // so don't show a confident-looking range (the calendar still shows the rough projection).
  const late = status.kind === 'late'
  const longLate = late && status.daysLate > LONG_LATE_DAYS
  const window = status.kind === 'no-data' || late ? undefined : upcomingWindows(input, today, 1)[0]
  const rows: SummaryRow[] = []
  if (nextPeriod && !longLate)
    rows.push({
      key: 'period',
      label: status.kind === 'late' ? '생리 예정일 (지남)' : '다음 생리 (예상)',
      value: formatKo(nextPeriod),
      sub: dLabel(nextPeriod, today),
    })
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
  rows.push({ key: 'avg', label: '평균 주기', value: `${stats.average}일`, sub: averageSourceLabel(stats) })

  return {
    status,
    stats,
    headline: statusHeadline(status, view, { today, cycleDay, nextPeriod, lastStart: last }),
    cycleDay,
    nextPeriod,
    window,
    rows,
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
 * "임신 가능성(예상)" value for the day sheet, or null when it must not be shown
 * (hidden view, before any log, or a (predicted) period day). The wider
 * "가능 범위" band is calendar uncertainty, so it reads 낮음~보통 rather than a
 * confident 낮음.
 */
export function dayChanceLabel(info: DayInfo, view: FertilityView): string | null {
  const phase = visiblePhase(info.phase, view)
  if (view === 'hidden' || knownCycleDay(info) === undefined) return null
  if (phase === 'period' || phase === 'period-predicted') return null
  if (phase === 'possible') return `${CHANCE_LABEL.low}~${CHANCE_LABEL.medium}`
  return CHANCE_LABEL[chanceLevel(info.ovulationOffset)]
}

/** Shown instead of the logging buttons for days after today. */
export function futureDayNote(view: FertilityView): string {
  return view === 'hidden'
    ? '아직 오지 않은 날이라 예정일만 보여줘요. 그날이 되면 생리를 기록할 수 있어요.'
    : '아직 오지 않은 날이라 예측만 보여줘요. 그날이 되면 생리나 LH 테스트를 기록할 수 있어요.'
}

/** One or two sentences explaining a tapped day, worded for the view. */
export function explainDay(info: DayInfo, view: FertilityView, isPast: boolean): string {
  switch (visiblePhase(info.phase, view)) {
    case 'period':
      return '기록된 생리 기간이에요.'
    case 'period-predicted':
      return isPast
        ? '생리가 시작될 것으로 예상했던 날이에요. 시작했다면 아래에서 기록해 주세요.'
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
      if (info.cycleDay === undefined) return '첫 생리 기록 전의 날이라 예측이 없어요.'
      if (knownCycleDay(info) === undefined)
        return '앞뒤 기록 사이가 길어서 이 무렵은 예측하지 않았어요. 빠진 생리 기록이 있다면 여기서 추가해 주세요.'
      if (view === 'hidden') return NICE_LINE
      return view === 'soft' ? '평범한 하루예요. 둘만의 시간은 언제든 좋아요.' : '예상 가임기가 아닌 날이에요.'
  }
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

// ── Calendar export ─────────────────────────────────────────

export const ICS_CYCLES = 3

export interface IcsAvailability {
  enabled: boolean
  reason?: string
  windows: CycleWindow[]
}

export function icsAvailability(input: CycleInput, today: ISODate, settings: Pick<Settings, 'lowPressure'>, view: FertilityView): IcsAvailability {
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
  if (fertilityStatus(input, today).kind === 'late')
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
