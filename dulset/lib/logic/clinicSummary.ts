// 병원에 보여 줄 한 장 요약 (Next B — B1), the pure model.
//
// What the couple recorded, gathered for a clinic visit: how long they have
// been preparing, both ages, the last cycles (start, length, first LH 양성 day,
// 임테기 results), the average and its range, what she is taking, which
// 임신 전 검사·접종 were ticked, the clinic appointments of the last six months,
// the 시술 attempts and 난임치료휴가 days, and since when the couple prepares
// with a clinic. Nothing here reads or interprets: no 가임기·배란 estimate, no
// 'irregular', no diagnosis word — a doctor reads the numbers themselves.
//
// Who may build it: the cycle owner, and only a partner the owner shared the
// details with (prefs.canSeeCycleDetails). The model never touches
// personalLog, intimacy, the diary, cycleNotes or any free-text note: those
// belong to the person who wrote them, not to a file.

import { addDays, addMonths, diffDays, isISODate } from '../dates'
import { ROADMAP } from '../content/roadmap'
import { ROLE_LABEL } from '../initial'
import type {
  AppState,
  Appointment,
  CheckItem,
  ISODate,
  Member,
  MemberId,
  PregnancyTestResult,
  Treatment,
  TreatmentKind,
  TreatmentOutcome,
} from '../types'
import { APPOINTMENT_KIND_LABEL } from './appointments'
import { confidenceLabel, cycleHistory, type CycleHistoryRow } from './calendarView'
import { activeItems } from './checks'
import { clinicSince } from './clinic'
import { cycleStats, type CycleConfidence } from './cycle'
import { ageFromBirthYear, monthsBetween, ttcClockStart } from './notifications'
import { FERTILITY_APPLY_ID, appliedInfo } from './partnerTrack'
import { canSeeCycleDetails } from './prefs'
import { doneInfo, type RoadmapTemplate } from './roadmap'
import { leaveDaysOf, leaveSummary, supportCounts, treatmentsOf, type SupportCounts } from './treatments'

// ── Constants ───────────────────────────────────────────────

/** The first line of the file, the text and the preview — never a diagnosis, never a promise. */
export const CLINIC_SUMMARY_HEADER = '둘셋 기록 요약 · 병원에 보여 주는 용도 · 예상은 참고용'

/**
 * The sheet's title and the 주기 tab's card label (components/clinic
 * ClinicSummarySheet). Kept here so a screen can name the sheet without
 * importing the component (which is then free to load lazily).
 */
export const CLINIC_SUMMARY_SHEET_TITLE = '병원에 보여 줄 요약'

/** How many of the latest logged cycles the table holds (the brief: 6–12). */
export const CLINIC_SUMMARY_CYCLES = 12

/** Appointments from this many months back are listed. */
export const CLINIC_APPOINTMENT_MONTHS = 6

/** The caveat lines every rendering ends with (file, text, preview). */
export const CLINIC_SUMMARY_NOTES: readonly string[] = [
  '모든 날짜와 결과는 본인이 둘셋에 직접 기록한 값이에요.',
  '평균·범위는 기록으로 계산한 예상이라 참고용이에요. 진료와 판단은 담당 의료진이 해요.',
  '지원 횟수·휴가는 기록한 회차 기준이에요. 실제 기준은 병원·보건소·회사마다 달라요.',
]

/** The one-line warning the sheet shows before any button (the file carries health data). */
export const CLINIC_SUMMARY_PRIVACY_NOTE =
  '이 파일에는 생리·LH·임신 테스트 같은 건강 기록이 들어 있어요. 보여 줄 사람을 정해서 신중하게 나눠 주세요.'

export const PREGNANCY_TEST_LABEL: Record<PregnancyTestResult, string> = {
  negative: '음성',
  faint: '희미',
  positive: '양성',
}

// ── Types ───────────────────────────────────────────────────

export interface SummaryPerson {
  id: MemberId
  name: string
  /** 아내 / 남편 / 배우자. */
  role: string
  birthYear?: number
  /** Years from the birth year to this year (undefined without a birth year). */
  age?: number
  cycleOwner: boolean
}

export interface SummaryCycleTest {
  date: ISODate
  /** 1-based day of that cycle. */
  cycleDay: number
  result: PregnancyTestResult
}

export interface SummaryCycleRow {
  /** 주기 N since the couple started trying (cycleHistory's attempt), when known. */
  n?: number
  start: ISODate
  /** Last bleeding day, when logged. */
  end?: ISODate
  bleedDays?: number
  /** Measured length to the next logged start (plausible cycles only). */
  length?: number
  /** The running cycle: today's 1-based day. */
  runningDay?: number
  /** The gap to the next start was longer than any cycle — a period may not have been logged. */
  gapDays?: number
  /** LH strips in this cycle; absent when none were logged. */
  lh?: { tests: number; surgeDay?: number; surgeDate?: ISODate }
  /** 임테기 results in this cycle, oldest first. */
  tests: SummaryCycleTest[]
}

export interface SummaryStats {
  average: number
  min?: number
  max?: number
  /** Cycles the average uses. */
  count: number
  source: 'logs' | 'settings'
  confidence: CycleConfidence
  /** 'LH 기준' · '기록 N주기 기준' · '달력 기준 · …' (calendarView.confidenceLabel). */
  basis: string
}

export interface SummaryMedication {
  member: MemberId
  label: string
  kind: 'supplement' | 'medication'
  /** The item's own helper text (a dose such as '400µg'). */
  note?: string
  since: ISODate
}

export interface SummaryCheckup {
  id: string
  title: string
  kind: 'test' | 'vaccine'
  doneAt: ISODate
  /** The person it was ticked for (the 지원 신청 is per person). */
  member?: MemberId
}

export interface SummaryAppointment {
  date: ISODate
  time?: string
  title: string
  kindLabel: string
  place?: string
  who: MemberId | 'both'
  done: boolean
}

export interface SummaryTreatment {
  kind: TreatmentKind
  startDate: ISODate
  endDate?: ISODate
  outcome?: TreatmentOutcome
  supported?: boolean
  noticeExpires?: ISODate
}

export interface SummaryLeave {
  member: MemberId
  year: number
  used: number
  total: number
}

export interface ClinicSummary {
  header: string
  generatedOn: ISODate
  owner: SummaryPerson
  partner: SummaryPerson
  /** Since when the couple has been trying (ttcClockStart) — months, and logged cycles since. */
  ttc?: { start: ISODate; months: number; cycles?: number; cyclesEstimated: boolean }
  /** '병원과 함께 준비 중' since this day, when on. */
  clinicSince?: ISODate
  /** Newest first, at most CLINIC_SUMMARY_CYCLES. */
  cycles: SummaryCycleRow[]
  /** How many cycles were logged in all (the table may show fewer). */
  totalCycles: number
  stats?: SummaryStats
  /** Whether LH strips are part of this summary (the table column and the basis). */
  includesLH: boolean
  medications: SummaryMedication[]
  checkups: SummaryCheckup[]
  appointments: SummaryAppointment[]
  treatments: SummaryTreatment[]
  /** Only with at least one attempt logged. */
  support?: SupportCounts
  leave: SummaryLeave[]
  notes: readonly string[]
}

export interface ClinicSummaryOptions {
  /**
   * Include LH strips (the column, the surge days, the 'LH 기준' basis).
   * Default true — the clinic is what the strips were for. A screen that must
   * not show LH to its viewer passes false.
   */
  includeLH?: boolean
}

// ── Guard ───────────────────────────────────────────────────

/** The cycle owner always; the partner only with the owner's share consent. */
export function canBuildClinicSummary(state: Pick<AppState, 'couple' | 'settings'>, viewer: MemberId): boolean {
  return canSeeCycleDetails(state, viewer)
}

// ── Pieces ──────────────────────────────────────────────────

function person(m: Member, today: ISODate, ownerId: MemberId): SummaryPerson {
  const age = ageFromBirthYear(m.birthYear, today)
  return {
    id: m.id,
    name: m.name,
    role: ROLE_LABEL[m.role],
    ...(m.birthYear !== undefined ? { birthYear: m.birthYear } : {}),
    ...(age !== undefined ? { age } : {}),
    cycleOwner: m.id === ownerId,
  }
}

function byDateTime(a: Pick<Appointment, 'date' | 'time'>, b: Pick<Appointment, 'date' | 'time'>): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time ?? ''
  const tb = b.time ?? ''
  return ta < tb ? -1 : ta > tb ? 1 : 0
}

/** The last day the row covers — a finished cycle's last day, today for the running one (cycleHistory's rule). */
function rowLastDay(r: CycleHistoryRow, maxCycle: number, today: ISODate): ISODate {
  if (r.cycleLength !== undefined) return addDays(r.start, Math.min(maxCycle, r.cycleLength) - 1)
  return r.start <= today ? today : r.start
}

function cycleRows(
  state: Pick<AppState, 'periods' | 'lhTests' | 'cycle' | 'pregnancyTests'>,
  today: ISODate,
  ttcStart: ISODate | undefined,
  includeLH: boolean,
): { rows: SummaryCycleRow[]; total: number; current?: number; estimated: boolean } {
  const input = { periods: state.periods, lhTests: includeLH ? state.lhTests : [], cycle: state.cycle }
  const history = cycleHistory(input, today, ttcStart)
  const tests = state.pregnancyTests.filter((t) => isISODate(t.date)).sort(byDateTime)
  const rows = history.rows.slice(0, CLINIC_SUMMARY_CYCLES).map((r): SummaryCycleRow => {
    const lastDay = rowLastDay(r, history.maxCycle, today)
    const measured = r.cycleLength !== undefined && r.cycleLength <= history.maxCycle ? r.cycleLength : undefined
    const row: SummaryCycleRow = {
      ...(r.attempt !== undefined ? { n: r.attempt } : {}),
      start: r.start,
      ...(r.end ? { end: r.end } : {}),
      ...(r.bleedDays !== undefined ? { bleedDays: r.bleedDays } : {}),
      ...(measured !== undefined ? { length: measured } : {}),
      ...(r.cycleLength === undefined && r.current && r.start <= today ? { runningDay: diffDays(r.start, today) + 1 } : {}),
      ...(r.hint === 'gap' && r.cycleLength !== undefined ? { gapDays: r.cycleLength } : {}),
      tests: tests
        .filter((t) => t.date >= r.start && t.date <= lastDay)
        .map((t) => ({ date: t.date, cycleDay: diffDays(r.start, t.date) + 1, result: t.result })),
    }
    if (includeLH && r.lhCount > 0) {
      row.lh = {
        tests: r.lhCount,
        ...(r.surge ? { surgeDay: r.surge.cycleDay, surgeDate: r.surge.date } : {}),
      }
    }
    return row
  })
  return {
    rows,
    total: history.rows.length,
    ...(history.current !== undefined ? { current: history.current } : {}),
    estimated: history.estimated,
  }
}

function statsOf(state: Pick<AppState, 'periods' | 'lhTests' | 'cycle' | 'pregnancy'>, today: ISODate, includeLH: boolean): SummaryStats | undefined {
  if (state.periods.length === 0) return undefined
  // The gap that held an ended pregnancy is not a cycle (cycle.spansEndedPregnancy): the average stays hers.
  const s = cycleStats(state.periods, state.cycle, includeLH ? state.lhTests : undefined, includeLH ? today : undefined, state.pregnancy)
  return {
    average: s.average,
    ...(s.min !== undefined ? { min: s.min } : {}),
    ...(s.max !== undefined ? { max: s.max } : {}),
    count: s.count,
    source: s.source,
    confidence: s.confidence,
    basis: confidenceLabel(s.confidence, s.count),
  }
}

function isMedication(i: CheckItem): i is CheckItem & { kind: 'supplement' | 'medication' } {
  return i.kind === 'supplement' || i.kind === 'medication'
}

function medicationsOf(state: Pick<AppState, 'checkItems'>, members: readonly MemberId[]): SummaryMedication[] {
  const out: SummaryMedication[] = []
  for (const member of members) {
    for (const i of activeItems(state, member).filter(isMedication)) {
      out.push({
        member,
        label: i.label,
        kind: i.kind,
        ...(i.note?.trim() ? { note: i.note.trim() } : {}),
        since: i.createdAt,
      })
    }
  }
  return out
}

/** 임신 준비 templates that are a test or a vaccine, in roadmap order. */
export function preconceptionCheckupTemplates(): RoadmapTemplate[] {
  return ROADMAP.filter((t): t is RoadmapTemplate & { kind: 'test' | 'vaccine' } => t.phase === 'preconception' && (t.kind === 'test' || t.kind === 'vaccine'))
}

function checkupsOf(state: Pick<AppState, 'planDone' | 'milestones'>, members: readonly MemberId[]): SummaryCheckup[] {
  const out: SummaryCheckup[] = []
  for (const t of preconceptionCheckupTemplates()) {
    const kind = t.kind as 'test' | 'vaccine'
    if (t.id === FERTILITY_APPLY_ID) {
      // The 지원 신청 is per person (partnerTrack chain keys) — one line each.
      for (const member of members) {
        const info = appliedInfo(state.planDone, member)
        if (info && isISODate(info.at)) out.push({ id: t.id, title: t.title, kind, doneAt: info.at, member })
      }
      continue
    }
    const info = doneInfo(state, t)
    if (info && isISODate(info.at)) out.push({ id: t.id, title: t.title, kind, doneAt: info.at, ...(info.by ? { member: info.by } : {}) })
  }
  return out.sort((x, y) => (x.doneAt < y.doneAt ? -1 : x.doneAt > y.doneAt ? 1 : 0))
}

function appointmentsOf(state: Pick<AppState, 'appointments'>, today: ISODate): SummaryAppointment[] {
  const from = addMonths(today, -CLINIC_APPOINTMENT_MONTHS)
  return state.appointments
    .filter((a) => isISODate(a.date) && a.date <= today && a.date >= from)
    .sort((a, b) => -byDateTime(a, b))
    .map((a) => ({
      date: a.date,
      ...(a.time ? { time: a.time } : {}),
      title: a.title,
      kindLabel: APPOINTMENT_KIND_LABEL[a.kind],
      ...(a.place?.trim() ? { place: a.place.trim() } : {}),
      who: a.who,
      done: a.done === true,
    }))
}

/** An attempt without its note (the couple's own line stays in the app). */
function treatmentRow(t: Treatment): SummaryTreatment {
  return {
    kind: t.kind,
    startDate: t.startDate,
    ...(t.endDate ? { endDate: t.endDate } : {}),
    ...(t.outcome ? { outcome: t.outcome } : {}),
    ...(t.supported !== undefined ? { supported: t.supported } : {}),
    ...(t.noticeExpires ? { noticeExpires: t.noticeExpires } : {}),
  }
}

function leaveOf(state: Pick<AppState, 'leaveDays'>, members: readonly MemberId[], today: ISODate): SummaryLeave[] {
  const out: SummaryLeave[] = []
  for (const member of members) {
    if (leaveDaysOf(state, member).length === 0) continue
    const s = leaveSummary(state, member, today)
    out.push({ member, year: s.year, used: s.used, total: s.total })
  }
  return out
}

// ── The summary ─────────────────────────────────────────────

/**
 * The summary as of `today`, or null when `viewer` may not see the cycle
 * details (the partner without the owner's share consent). Deterministic for
 * a given state and day; reads only shared records (see the header comment).
 */
export function clinicSummary(state: AppState, viewer: MemberId, today: ISODate, opts: ClinicSummaryOptions = {}): ClinicSummary | null {
  if (!canBuildClinicSummary(state, viewer)) return null
  const includeLH = opts.includeLH !== false
  const ownerMember = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]
  const ownerId = ownerMember.id
  const partnerMember = state.couple.members.find((m) => m.id !== ownerId) ?? state.couple.members[1]
  const members: readonly MemberId[] = [ownerId, partnerMember.id]

  const ttcStart = ttcClockStart(state)
  const cycles = cycleRows(state, today, ttcStart, includeLH)
  const treatments = treatmentsOf(state)
  const clinic = clinicSince(state)
  const stats = statsOf(state, today, includeLH)

  return {
    header: CLINIC_SUMMARY_HEADER,
    generatedOn: today,
    owner: person(ownerMember, today, ownerId),
    partner: person(partnerMember, today, ownerId),
    ...(ttcStart && ttcStart <= today
      ? {
          ttc: {
            start: ttcStart,
            months: monthsBetween(ttcStart, today),
            ...(cycles.current !== undefined ? { cycles: cycles.current } : {}),
            cyclesEstimated: cycles.estimated,
          },
        }
      : {}),
    ...(clinic ? { clinicSince: clinic } : {}),
    cycles: cycles.rows,
    totalCycles: cycles.total,
    ...(stats ? { stats } : {}),
    includesLH: includeLH,
    medications: medicationsOf(state, members),
    checkups: checkupsOf(state, members),
    appointments: appointmentsOf(state, today),
    treatments: treatments.map(treatmentRow),
    ...(treatments.length ? { support: supportCounts(state) } : {}),
    leave: leaveOf(state, members, today),
    notes: CLINIC_SUMMARY_NOTES,
  }
}

/** Name for a member id, '둘이 함께' for both. */
export function summaryWho(summary: Pick<ClinicSummary, 'owner' | 'partner'>, who: MemberId | 'both'): string {
  if (who === 'both') return '둘이 함께'
  return who === summary.owner.id ? summary.owner.name : summary.partner.name
}
