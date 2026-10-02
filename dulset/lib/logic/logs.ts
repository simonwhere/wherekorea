// "+ 기록" — the one log sheet's state changes (pure).
//
// Only the cycle owner logs periods, LH and pregnancy tests (prefs.canLogCycle);
// the UI enforces that, these functions just record who did (`by`). Every
// change can be undone for a few seconds (되돌리기): `logUndo` captures what an
// action is about to touch from the state it runs on, `undoLog` puts it back.

import { uid } from '../id'
import type { LogKind } from '../logLauncher'
import { LH_SLOTS } from '../types'
import type {
  AppState,
  ISODate,
  LHResult,
  LHSlot,
  LHTest,
  MemberId,
  PeriodLog,
  PositivePending,
  PregnancyTest,
  PregnancyTestResult,
  RestCycle,
} from '../types'
import {
  FERTILE_DAYS_BEFORE,
  LH_LEAD_DAYS,
  addPeriod,
  cycleAt,
  dayInfo,
  fertilityStatus,
  noSurgeWait,
  removePeriod,
  setPeriodEnd,
  sortedStarts,
  type CycleInput,
} from './cycle'
import { addEntry, removeEntry } from './diary'
import { lhPrompting } from './prefs'
import { activePositivePending, activeRest, clearPositivePending, markPositivePending, onPeriodLogged } from './ttc'

// ── Time ────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** 'HH:MM' (24h). */
export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

function minutesOf(time: string | undefined): number | undefined {
  return isTime(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : undefined
}

const NOON = 12 * 60

/** Where a slot sits among the day's times: 아침 before any clock time, 저녁 after. */
const SLOT_ORDER: Record<LHSlot, number> = { morning: 0, evening: 24 * 60 }

function orderOf(t: { time?: string; slot?: LHSlot }): number {
  return minutesOf(t.time) ?? (t.slot ? SLOT_ORDER[t.slot] : -1)
}

/** Untimed first, then 아침, clock times, 저녁. */
function byTime<T extends { time?: string; slot?: LHSlot }>(a: T, b: T): number {
  return orderOf(a) - orderOf(b)
}

// ── LH (배테기) ─────────────────────────────────────────────

/** Morning and evening — more than two a day adds little and clutters the record. */
export const MAX_LH_PER_DAY = 2

export const LH_SLOT_LABEL: Record<LHSlot, string> = { morning: '아침', evening: '저녁' }

export function isLHSlot(value: unknown): value is LHSlot {
  return typeof value === 'string' && (LH_SLOTS as readonly string[]).includes(value)
}

/**
 * What tells one of a day's tests from the other: the clock time ('08:10') of
 * a test logged on the day itself, the slot ('morning' / 'evening') of one
 * entered for a past day, or '' for an untimed test from before slots existed.
 * removeLHTest and the sheet's rows go by it.
 */
export function lhKey(test: Pick<LHTest, 'time' | 'slot'>): string {
  return test.time ?? test.slot ?? ''
}

/** '08:10' · '아침' · '시각 없음' — when the test was taken, in the record's own words. */
export function lhWhen(test: Pick<LHTest, 'time' | 'slot'>): string {
  return test.time ?? (test.slot ? LH_SLOT_LABEL[test.slot] : '시각 없음')
}

/**
 * The half of the day a test belongs to: its slot, or — for a timed test — 아침
 * before noon and 저녁 from noon. A past day's slot chips show the test taken in
 * that half, whichever way it was logged; an untimed legacy test has none.
 */
export function lhSlotOf(test: Pick<LHTest, 'time' | 'slot'>): LHSlot | undefined {
  if (test.slot) return test.slot
  const m = minutesOf(test.time)
  return m === undefined ? undefined : m < NOON ? 'morning' : 'evening'
}

/** The first of 아침 / 저녁 with no test yet on the day (undefined when both have one). */
export function freeLHSlot(day: readonly LHTest[]): LHSlot | undefined {
  return LH_SLOTS.find((slot) => !day.some((t) => lhSlotOf(t) === slot))
}

/** The day's LH tests in time order. */
export function lhTestsOn(tests: LHTest[], date: ISODate): LHTest[] {
  return tests.filter((t) => t.date === date).sort(byTime)
}

function sortLH(tests: LHTest[]): LHTest[] {
  return [...tests].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : byTime(a, b)))
}

/** Replace every LH test on `date` with `tests` (used by 되돌리기). */
export function replaceLHDay<S extends Pick<AppState, 'lhTests'>>(state: S, date: ISODate, tests: LHTest[]): S {
  return { ...state, lhTests: sortLH([...state.lhTests.filter((t) => t.date !== date), ...tests.filter((t) => t.date === date)]) }
}

export interface LHInput {
  date: ISODate
  /** 'HH:MM' — a test logged on the day itself (the sheet's clock). */
  time?: string
  /** 아침 / 저녁 — a test entered for a past day (no clock). Ignored when `time` is valid. */
  slot?: LHSlot
  result: LHResult
  by?: MemberId
}

/** Where a result goes on its day: a new row, or in place of one already there (the sheet asks first). */
export type LHPlan = { action: 'add'; test: LHTest } | { action: 'replace'; test: LHTest; target: LHTest }

/**
 * Where a new result goes among the day's tests (at most MAX_LH_PER_DAY):
 *   • a test with the same key (time / slot) → in its place;
 *   • for a slot (a past day), the test already in that half of the day — a
 *     timed '08:10' counts as 아침 — → in its place ("08:10 기록을 바꿀까요?"),
 *     keeping its clock time;
 *   • otherwise a free row → added. Without a time or a slot, the first free
 *     half of the day is taken (아침, then 저녁);
 *   • a full day → in place of the closest one: by clock time for a timed test
 *     (untimed ones count as farthest, ties go to the later one), the first row
 *     for 아침 and the last for 저녁.
 * Only the 'add' case is silent — addLHTest refuses a 'replace' unless told so.
 */
export function planLHTest(day: readonly LHTest[], input: LHInput): LHPlan {
  const time = isTime(input.time) ? input.time : undefined
  const slot: LHSlot | undefined = time ? undefined : isLHSlot(input.slot) ? input.slot : (freeLHSlot(day) ?? 'morning')
  const test: LHTest = {
    date: input.date,
    result: input.result,
    ...(time ? { time } : slot ? { slot } : {}),
    ...(input.by ? { by: input.by } : {}),
  }
  const same = day.find((t) => lhKey(t) === lhKey(test)) ?? (slot ? day.find((t) => lhSlotOf(t) === slot) : undefined)
  if (same) {
    // A slot in place of a timed test keeps that clock time: '08:10 희미' becomes '08:10 양성'.
    if (slot && same.time)
      return { action: 'replace', test: { date: test.date, result: test.result, time: same.time, ...(test.by ? { by: test.by } : {}) }, target: same }
    return { action: 'replace', test, target: same }
  }
  if (day.length < MAX_LH_PER_DAY) return { action: 'add', test }
  const sorted = [...day].sort(byTime)
  if (time) {
    const m = minutesOf(time)!
    const distance = (t: LHTest) => {
      const n = minutesOf(t.time)
      return n === undefined ? Number.POSITIVE_INFINITY : Math.abs(n - m)
    }
    const target = [...sorted].reverse().reduce((best, t) => (distance(t) < distance(best) ? t : best))
    return { action: 'replace', test, target }
  }
  return { action: 'replace', test, target: slot === 'evening' ? sorted[sorted.length - 1]! : sorted[0]! }
}

/**
 * Log an LH result (planLHTest). A result that would take another test's
 * place is a no-op unless `opts.replace` says the person agreed — the sheet
 * asks "…기록을 바꿀까요?" first, so nothing is ever overwritten quietly. A
 * date after `today` is ignored (the sheet never offers one, but a re-applied
 * change or a pinned date must not log the future either).
 */
export function addLHTest<S extends Pick<AppState, 'lhTests'>>(
  state: S,
  input: LHInput,
  today?: ISODate,
  opts?: { replace?: boolean },
): S {
  if (today && input.date > today) return state
  const day = lhTestsOn(state.lhTests, input.date)
  const plan = planLHTest(day, input)
  if (plan.action === 'replace' && !opts?.replace) return state
  const keep = plan.action === 'replace' ? day.filter((t) => t !== plan.target) : day
  return replaceLHDay(state, input.date, [...keep, plan.test])
}

/**
 * Does logging this result move the estimated ovulation of that day's cycle?
 * (Only the cycle's first surge does — the sheet says "다시 계산했어요" then.)
 * Judged as if the person agreed to replace, so the answer fits either path.
 */
export function lhChangesEstimate(state: CycleInput, input: LHInput): boolean {
  const before = cycleAt(state, input.date)
  const after = cycleAt(addLHTest(state, input, undefined, { replace: true }), input.date)
  return !!before && !!after && before.ovulation !== after.ovulation
}

/** Remove the LH test on `date` with key `at` (lhKey: its time or slot; omit for an untimed test). */
export function removeLHTest<S extends Pick<AppState, 'lhTests'>>(state: S, date: ISODate, at?: string): S {
  return {
    ...state,
    lhTests: state.lhTests.filter((t) => !(t.date === date && lhKey(t) === (at ?? ''))),
  }
}

/**
 * 배란테스트기 써요? — the one question (settings.usesLH), asked in the LH panel
 * once the cycle reaches the 'LH 테스트 시작' moment (LH_LEAD_DAYS before the
 * estimated window) and until it is answered. '나중에' puts it off to the next
 * cycle: `deferredCycle` is the start of the cycle it was deferred in (kept per
 * device, lib/persist LH_ASK_DEFERRED_KEY). Never while a rest cycle or a
 * positive test waiting for the clinic pauses the dates.
 */
export function lhAskDue(
  state: CycleInput & Pick<AppState, 'settings' | 'restCycle' | 'positivePending' | 'stage'>,
  today: ISODate,
  deferredCycle?: ISODate | null,
): boolean {
  const uses = state.settings.usesLH
  if (uses === true || uses === false) return false
  if (state.stage !== 'preparing' || activeRest(state) || activePositivePending(state)) return false
  const st = fertilityStatus(state, today)
  const reached =
    (st.kind === 'before-fertile' && st.daysUntil <= LH_LEAD_DAYS) ||
    st.kind === 'fertile' ||
    st.kind === 'after-fertile' ||
    st.kind === 'late'
  if (!reached) return false
  if (uses === 'later' && deferredCycle) {
    const start = cycleAt(state, today)?.start
    if (start && start === deferredCycle) return false
  }
  return true
}

// ── Pregnancy tests (임테기) ────────────────────────────────

export interface PregnancyTestInput {
  date: ISODate
  time?: string
  result: PregnancyTestResult
  by?: MemberId
  /** Pass a stable id so the change can be re-applied (two-tab sync) and undone. */
  id?: string
}

export function pregnancyTestsOn(tests: PregnancyTest[], date: ISODate): PregnancyTest[] {
  return tests.filter((t) => t.date === date).sort(byTime)
}

function sortTests(tests: PregnancyTest[]): PregnancyTest[] {
  return [...tests].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : byTime(a, b)))
}

/**
 * A positive test dated on/before a logged period start is already settled by
 * that period (same rule as ttc.onPeriodLogged / activePositivePending): it is
 * kept as a record but doesn't start "병원 확인 전".
 */
function settledByPeriod(state: Pick<AppState, 'periods'>, date: ISODate): boolean {
  return state.periods.some((p) => p.start >= date)
}

/**
 * Log a home pregnancy test. A positive one while preparing starts the calm
 * "병원 확인 전" state (ttc.markPositivePending) — no celebration yet — unless
 * a period was logged on or after its date. A date after `today` is ignored
 * (`test` is then undefined and the state comes back as it was).
 */
export function addPregnancyTest(
  state: AppState,
  input: PregnancyTestInput,
  today?: ISODate,
): { state: AppState; test?: PregnancyTest } {
  if (today && input.date > today) return { state }
  const test: PregnancyTest = {
    id: input.id ?? uid(),
    date: input.date,
    result: input.result,
    ...(isTime(input.time) ? { time: input.time } : {}),
    ...(input.by ? { by: input.by } : {}),
  }
  const pregnancyTests = sortTests([...state.pregnancyTests.filter((t) => t.id !== test.id), test])
  let next: AppState = { ...state, pregnancyTests }
  if (test.result === 'positive' && !settledByPeriod(state, test.date)) {
    // An earlier positive entered afterwards becomes the start of the wait.
    const pending = next.positivePending
    if (pending && next.stage === 'preparing' && test.date < pending.since)
      next = { ...next, positivePending: { since: test.date, testId: test.id } }
    else next = markPositivePending(next, test.date, test.id)
  }
  return { state: next, test }
}

/**
 * Remove a test. Removing the positive test that started "병원 확인 전" hands
 * the state to the next positive test still waiting (no period logged since),
 * or clears it when there is none.
 */
export function removePregnancyTest(state: AppState, id: string): AppState {
  if (!state.pregnancyTests.some((t) => t.id === id)) return state
  const next: AppState = { ...state, pregnancyTests: state.pregnancyTests.filter((t) => t.id !== id) }
  if (next.positivePending?.testId !== id) return next
  const cleared = clearPositivePending(next)
  const heir = sortTests(cleared.pregnancyTests).find((t) => t.result === 'positive' && !settledByPeriod(cleared, t.date))
  return heir ? markPositivePending(cleared, heir.date, heir.id) : cleared
}

// ── Periods ─────────────────────────────────────────────────

/**
 * Log a period start. Also ends a rest cycle begun before it and quietly
 * clears an unconfirmed positive test (ttc.onPeriodLogged). An existing record
 * on the same day keeps its end date. A date after `today` is ignored.
 */
export function logPeriodStart(state: AppState, date: ISODate, by?: MemberId, today?: ISODate): AppState {
  if (today && date > today) return state
  const prev = state.periods.find((p) => p.start === date)
  return onPeriodLogged(addPeriod(state, date, prev?.end, by ?? prev?.by), date)
}

/** Set (or clear, end = undefined) the last bleeding day of the period starting on `start`. */
export function logPeriodEnd(state: AppState, start: ISODate, end: ISODate | undefined): AppState {
  if (!state.periods.some((p) => p.start === start)) return state
  return setPeriodEnd(state, start, end)
}

/** "It actually started on this day": move a logged start, keeping its end and author. */
export function movePeriodStart(state: AppState, from: ISODate, to: ISODate): AppState {
  const p = state.periods.find((x) => x.start === from)
  if (!p || from === to) return state
  return onPeriodLogged(addPeriod(removePeriod(state, from), to, p.end, p.by), to)
}

export function removePeriodLog(state: AppState, start: ISODate): AppState {
  return removePeriod(state, start)
}

// ── Note (메모 → 우리의 기록) ───────────────────────────────

export const NOTE_MAX_LENGTH = 200

/** A one-line note, saved as a diary entry for that day. */
export function addNote(
  state: AppState,
  note: { date: ISODate; author: MemberId; text: string; id?: string },
  nowISO: string,
): AppState {
  // Re-applied with the same id (two-tab sync rebase): addEntry keeps the first.
  const text = note.text.trim().slice(0, NOTE_MAX_LENGTH)
  return addEntry(state, { id: note.id, date: note.date, author: note.author, text }, nowISO)
}

// ── 되돌리기 ────────────────────────────────────────────────

// An LH or period log can move this cycle's window, and the notification engine
// then sends the once-per-cycle "우리의 주간" / "가장 좋은 날" notice right away
// (keyed by cycle, notifications.fertileKey / peakKey). Undoing the log takes
// back such a notice sent since: its dates were wrong, and its key would block
// the right notice later in the same cycle. The engine re-sends whatever is
// still due for the restored records.
const WINDOW_NOTICE_KEY = /^(fertile|peak):/

function windowNoticeKeys(state: Pick<AppState, 'notifications'>): string[] {
  return state.notifications.flatMap((n) => (n.key && WINDOW_NOTICE_KEY.test(n.key) ? [n.key] : []))
}

function dropNewWindowNotices(state: AppState, before: string[] | undefined): AppState {
  if (!before) return state
  const keep = new Set(before)
  const notifications = state.notifications.filter((n) => !n.key || !WINDOW_NOTICE_KEY.test(n.key) || keep.has(n.key))
  return notifications.length === state.notifications.length ? state : { ...state, notifications }
}

export type LogUndo =
  | { kind: 'lh'; date: ISODate; tests: LHTest[]; notices?: string[] }
  | { kind: 'period'; periods: PeriodLog[]; restCycle?: RestCycle; positivePending?: PositivePending; notices?: string[] }
  | { kind: 'ptest'; id: string; before?: PregnancyTest; positivePending?: PositivePending }
  | { kind: 'note'; id: string }

export type LogTarget =
  | { kind: 'lh'; date: ISODate }
  | { kind: 'period' }
  | { kind: 'ptest'; id: string }
  | { kind: 'note'; id: string }

/** What an action on `target` may change, read from the state it is about to run on. */
export function logUndo(before: AppState, target: LogTarget): LogUndo {
  switch (target.kind) {
    case 'lh':
      return { kind: 'lh', date: target.date, tests: lhTestsOn(before.lhTests, target.date), notices: windowNoticeKeys(before) }
    case 'period':
      return {
        kind: 'period',
        periods: before.periods,
        notices: windowNoticeKeys(before),
        ...(before.restCycle ? { restCycle: before.restCycle } : {}),
        ...(before.positivePending ? { positivePending: before.positivePending } : {}),
      }
    case 'ptest': {
      const prev = before.pregnancyTests.find((t) => t.id === target.id)
      return {
        kind: 'ptest',
        id: target.id,
        ...(prev ? { before: prev } : {}),
        ...(before.positivePending ? { positivePending: before.positivePending } : {}),
      }
    }
    case 'note':
      return { kind: 'note', id: target.id }
  }
}

function withOptional<K extends 'restCycle' | 'positivePending'>(state: AppState, key: K, value: AppState[K]): AppState {
  if (value) return { ...state, [key]: value }
  if (!(key in state)) return state
  const next = { ...state }
  delete next[key]
  return next
}

export function undoLog(state: AppState, undo: LogUndo): AppState {
  switch (undo.kind) {
    case 'lh':
      return dropNewWindowNotices(replaceLHDay(state, undo.date, undo.tests), undo.notices)
    case 'period': {
      const s = withOptional({ ...state, periods: undo.periods }, 'restCycle', undo.restCycle)
      return dropNewWindowNotices(withOptional(s, 'positivePending', undo.positivePending), undo.notices)
    }
    case 'ptest': {
      const others = state.pregnancyTests.filter((t) => t.id !== undo.id)
      const pregnancyTests = undo.before ? sortTests([...others, undo.before]) : others
      return withOptional({ ...state, pregnancyTests }, 'positivePending', undo.positivePending)
    }
    case 'note':
      return removeEntry(state, undo.id)
  }
}

// ── Which chip opens first ──────────────────────────────────

export type { LogKind }

/** How many days before the estimated window LH testing is suggested (cycle.LH_LEAD_DAYS, shared with the home card). */
export { LH_LEAD_DAYS }

/**
 * The chip the sheet opens on for `date`, from where the cycle is: bleeding or
 * nothing logged → 생리; the estimated window or up to LH_LEAD_DAYS before it
 * → LH — and still LH while strips this cycle saw no surge yet (the week past
 * the window, cycle.noSurgeWait: the home card asks for more tests then too);
 * after it (or late) → 임테기. A positive test waiting for the clinic →
 * 임테기; a rest cycle → 생리. Someone who said '안 써요' to LH strips
 * (prefs.lhPrompting) gets 메모 where LH would have opened.
 */
export function defaultLogKind(
  state: CycleInput & Pick<AppState, 'restCycle' | 'positivePending' | 'stage'> & Partial<Pick<AppState, 'settings'>>,
  date: ISODate,
  today: ISODate,
): LogKind {
  const kind = cycleLogKind(state, date, today)
  return kind === 'lh' && state.settings && !lhPrompting({ settings: state.settings }) ? 'note' : kind
}

function cycleLogKind(
  state: CycleInput & Pick<AppState, 'restCycle' | 'positivePending' | 'stage'>,
  date: ISODate,
  today: ISODate,
): Exclude<LogKind, 'note'> {
  const pending = activePositivePending(state)
  if (pending && date >= pending.since) return 'ptest'
  if (activeRest(state)) return 'period'
  if (date === today) {
    const st = fertilityStatus(state, today)
    switch (st.kind) {
      case 'fertile':
        return 'lh'
      case 'before-fertile':
        return st.daysUntil <= LH_LEAD_DAYS ? 'lh' : 'period'
      case 'after-fertile': {
        const cur = [...sortedStarts(state.periods)].reverse().find((d) => d <= today)
        return cur && noSurgeWait(state, cur, today) ? 'lh' : 'ptest'
      }
      case 'late':
        return 'ptest'
      default:
        return 'period'
    }
  }
  // Another day: judge from that day's place in its cycle.
  const info = dayInfo(state, date, today)
  if (info.phase === 'period' || info.phase === 'period-predicted') return 'period'
  if (info.phase === 'peak' || info.phase === 'fertile' || info.phase === 'possible') return 'lh'
  const off = info.ovulationOffset
  if (off === undefined) return 'period'
  if (off > 0) return 'ptest'
  return off >= -(FERTILE_DAYS_BEFORE + LH_LEAD_DAYS) ? 'lh' : 'period'
}
