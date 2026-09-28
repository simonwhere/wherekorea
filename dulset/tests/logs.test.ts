import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  MAX_LH_PER_DAY,
  addLHTest,
  addNote,
  addPregnancyTest,
  defaultLogKind,
  isTime,
  lhChangesEstimate,
  lhTestsOn,
  logPeriodEnd,
  logPeriodStart,
  logUndo,
  movePeriodStart,
  pregnancyTestsOn,
  removeLHTest,
  removePeriodLog,
  removePregnancyTest,
  replaceLHDay,
  undoLog,
  type LogTarget,
} from '@/lib/logic/logs'
import { startRestCycle } from '@/lib/logic/ttc'
import type { AppState } from '@/lib/types'

const NOW = '2026-09-28T09:00:00+09:00'

/** 지은 (b) tracks the cycle; last period 2026-09-01, 28-day cycles. */
function preparing(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-08-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over }
}

describe('LH tests (two a day)', () => {
  it('records time and who logged it, in time order', () => {
    let s = preparing()
    s = addLHTest(s, { date: '2026-09-14', time: '20:30', result: 'faint', by: 'b' })
    s = addLHTest(s, { date: '2026-09-14', time: '08:10', result: 'negative', by: 'b' })
    expect(lhTestsOn(s.lhTests, '2026-09-14')).toEqual([
      { date: '2026-09-14', time: '08:10', result: 'negative', by: 'b' },
      { date: '2026-09-14', time: '20:30', result: 'faint', by: 'b' },
    ])
  })

  it('replaces a test at the same time', () => {
    let s = addLHTest(preparing(), { date: '2026-09-14', time: '08:10', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '08:10', result: 'positive' })
    expect(s.lhTests).toEqual([{ date: '2026-09-14', time: '08:10', result: 'positive' }])
  })

  it(`keeps at most ${MAX_LH_PER_DAY} a day: a third replaces the one closest in time`, () => {
    let s = preparing()
    s = addLHTest(s, { date: '2026-09-14', time: '08:00', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '21:00', result: 'faint' })
    s = addLHTest(s, { date: '2026-09-14', time: '19:00', result: 'positive' })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => [t.time, t.result])).toEqual([
      ['08:00', 'negative'],
      ['19:00', 'positive'],
    ])
    s = addLHTest(s, { date: '2026-09-14', time: '07:00', result: 'faint' })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => t.time)).toEqual(['07:00', '19:00'])
    // Other days are untouched.
    s = addLHTest(s, { date: '2026-09-15', time: '07:00', result: 'peak' })
    expect(s.lhTests).toHaveLength(3)
  })

  it('handles untimed (legacy) tests: same slot replaces, a full day drops the later one', () => {
    let s = addLHTest(preparing(), { date: '2026-09-14', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', result: 'faint' })
    expect(s.lhTests).toEqual([{ date: '2026-09-14', result: 'faint' }])
    s = addLHTest(s, { date: '2026-09-14', time: '09:00', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '20:00', result: 'positive' })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => t.time ?? '-')).toEqual(['-', '20:00'])
  })

  it('ignores a malformed time', () => {
    expect(isTime('7:5')).toBe(false)
    expect(isTime('24:00')).toBe(false)
    expect(isTime('07:05')).toBe(true)
    const s = addLHTest(preparing(), { date: '2026-09-14', time: '7:5', result: 'negative' })
    expect(s.lhTests[0]).not.toHaveProperty('time')
  })

  it('removes one test by date and time', () => {
    let s = preparing()
    s = addLHTest(s, { date: '2026-09-14', time: '08:00', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '20:00', result: 'positive' })
    s = removeLHTest(s, '2026-09-14', '20:00')
    expect(s.lhTests).toEqual([{ date: '2026-09-14', time: '08:00', result: 'negative' }])
    const legacy = removeLHTest({ lhTests: [{ date: '2026-09-14', result: 'positive' }, ...s.lhTests] }, '2026-09-14')
    expect(legacy.lhTests).toEqual(s.lhTests)
  })

  it('says the estimate moved only for the cycle’s first surge', () => {
    // Period 09-01, 28 days: calendar ovulation 09-15.
    const s = preparing()
    expect(lhChangesEstimate(s, { date: '2026-09-12', result: 'negative' })).toBe(false)
    expect(lhChangesEstimate(s, { date: '2026-09-12', result: 'faint' })).toBe(false)
    expect(lhChangesEstimate(s, { date: '2026-09-12', result: 'positive' })).toBe(true)
    // A surge the day before calendar ovulation lands on the same estimate.
    expect(lhChangesEstimate(s, { date: '2026-09-14', result: 'peak' })).toBe(false)
    const surged = addLHTest(s, { date: '2026-09-12', time: '08:00', result: 'positive' })
    expect(lhChangesEstimate(surged, { date: '2026-09-13', result: 'peak' })).toBe(false)
    // No cycle yet: nothing to recalculate.
    expect(lhChangesEstimate(preparing({ periods: [] }), { date: '2026-09-12', result: 'positive' })).toBe(false)
  })

  it('replaceLHDay restores a whole day', () => {
    const s = addLHTest(preparing(), { date: '2026-09-14', time: '08:00', result: 'negative' })
    expect(replaceLHDay(s, '2026-09-14', []).lhTests).toEqual([])
  })
})

describe('pregnancy tests', () => {
  it('adds a test with a stable id', () => {
    const { state, test } = addPregnancyTest(preparing(), { id: 't1', date: '2026-09-27', time: '07:30', result: 'negative', by: 'b' })
    expect(test).toEqual({ id: 't1', date: '2026-09-27', time: '07:30', result: 'negative', by: 'b' })
    expect(pregnancyTestsOn(state.pregnancyTests, '2026-09-27')).toEqual([test])
    expect(state.positivePending).toBeUndefined()
  })

  it('a positive test while preparing waits for the clinic (no stage change)', () => {
    const { state, test } = addPregnancyTest(preparing(), { date: '2026-09-28', result: 'positive', by: 'b' })
    expect(state.positivePending).toEqual({ since: '2026-09-28', testId: test.id })
    expect(state.stage).toBe('preparing')
    // A faint line does not start it.
    expect(addPregnancyTest(preparing(), { date: '2026-09-28', result: 'faint' }).state.positivePending).toBeUndefined()
    // Not while pregnant already.
    expect(addPregnancyTest(preparing({ stage: 'pregnant' }), { date: '2026-09-28', result: 'positive' }).state.positivePending).toBeUndefined()
  })

  it('removing the positive test that started it clears the waiting state', () => {
    const first = addPregnancyTest(preparing(), { id: 'p1', date: '2026-09-28', result: 'positive' })
    const second = addPregnancyTest(first.state, { id: 'p2', date: '2026-09-29', result: 'positive' })
    expect(second.state.positivePending?.testId).toBe('p1')
    expect(removePregnancyTest(second.state, 'p2').positivePending?.testId).toBe('p1')
    // The only positive test goes: nothing is waiting any more.
    const cleared = removePregnancyTest(first.state, 'p1')
    expect(cleared.positivePending).toBeUndefined()
    expect(cleared.pregnancyTests).toEqual([])
    expect(removePregnancyTest(cleared, 'nope')).toBe(cleared)
    // Another positive is still there: it keeps the state (see the next test).
    const handed = removePregnancyTest(second.state, 'p1')
    expect(handed.pregnancyTests.map((t) => t.id)).toEqual(['p2'])
    expect(handed.positivePending?.testId).toBe('p2')
  })

  it('removing the first positive hands the waiting state to a later one still waiting', () => {
    let s = addPregnancyTest(preparing(), { id: 'p1', date: '2026-09-27', result: 'positive' }).state
    s = addPregnancyTest(s, { id: 'n1', date: '2026-09-28', result: 'negative' }).state
    s = addPregnancyTest(s, { id: 'p2', date: '2026-09-29', result: 'positive' }).state
    expect(removePregnancyTest(s, 'p1').positivePending).toEqual({ since: '2026-09-29', testId: 'p2' })
  })

  it('an earlier positive entered later starts the wait from its day', () => {
    let s = addPregnancyTest(preparing(), { id: 'p2', date: '2026-09-28', result: 'positive' }).state
    s = addPregnancyTest(s, { id: 'p1', date: '2026-09-26', result: 'positive' }).state
    expect(s.positivePending).toEqual({ since: '2026-09-26', testId: 'p1' })
    // A later one never moves it.
    s = addPregnancyTest(s, { id: 'p3', date: '2026-09-29', result: 'positive' }).state
    expect(s.positivePending).toEqual({ since: '2026-09-26', testId: 'p1' })
  })

  it('a past positive already followed by a logged period is a record only', () => {
    // Period logged 09-01; a positive from 08-20 entered late does not start "병원 확인 전".
    const { state } = addPregnancyTest(preparing(), { id: 'old', date: '2026-08-20', result: 'positive' })
    expect(state.pregnancyTests.map((t) => t.id)).toEqual(['old'])
    expect(state.positivePending).toBeUndefined()
    // A positive on a period's first day is settled by it too (same rule as ttc.onPeriodLogged).
    expect(addPregnancyTest(preparing(), { date: '2026-09-01', result: 'positive' }).state.positivePending).toBeUndefined()
    // …and never becomes the heir either.
    let s = addPregnancyTest(preparing(), { id: 'old', date: '2026-08-20', result: 'positive' }).state
    s = addPregnancyTest(s, { id: 'new', date: '2026-09-27', result: 'positive' }).state
    expect(removePregnancyTest(s, 'new').positivePending).toBeUndefined()
  })

  it('keeps tests in date and time order', () => {
    let s = addPregnancyTest(preparing(), { id: 'b', date: '2026-09-27', time: '21:00', result: 'negative' }).state
    s = addPregnancyTest(s, { id: 'a', date: '2026-09-27', time: '07:00', result: 'negative' }).state
    s = addPregnancyTest(s, { id: 'c', date: '2026-09-20', result: 'negative' }).state
    expect(s.pregnancyTests.map((t) => t.id)).toEqual(['c', 'a', 'b'])
    const undo = logUndo(s, { kind: 'ptest', id: 'a' })
    expect(undoLog(removePregnancyTest(s, 'a'), undo).pregnancyTests.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('periods', () => {
  it('logs a start with who logged it and keeps an existing end', () => {
    let s = logPeriodStart(preparing(), '2026-09-29', 'b')
    expect(s.periods.at(-1)).toEqual({ start: '2026-09-29', by: 'b' })
    s = logPeriodEnd(s, '2026-09-29', '2026-10-03')
    expect(s.periods.at(-1)).toEqual({ start: '2026-09-29', end: '2026-10-03', by: 'b' })
    expect(logPeriodStart(s, '2026-09-29', 'b').periods.at(-1)).toEqual({ start: '2026-09-29', end: '2026-10-03', by: 'b' })
    expect(logPeriodEnd(s, '2026-09-29', undefined).periods.at(-1)).toEqual({ start: '2026-09-29', by: 'b' })
    expect(logPeriodEnd(s, '2026-01-01', '2026-01-03')).toBe(s)
  })

  it('a new period ends a rest cycle and quietly clears an unconfirmed positive', () => {
    let s = startRestCycle(preparing(), '2026-09-10', 'rest')
    s = addPregnancyTest(s, { date: '2026-09-26', result: 'positive' }).state
    expect(s.restCycle).toBeDefined()
    expect(s.positivePending).toBeDefined()
    s = logPeriodStart(s, '2026-09-29', 'b')
    expect(s.restCycle).toBeUndefined()
    expect(s.positivePending).toBeUndefined()
    // A live-vaccine rest lasts until a period at least a month after the shot (ttc.ts).
    const vaccine = logPeriodStart(startRestCycle(preparing(), '2026-09-10', 'vaccine'), '2026-09-29', 'b')
    expect(vaccine.restCycle?.reason).toBe('vaccine')
  })

  it('moves a start (keeping its end and author) and removes one', () => {
    let s = logPeriodEnd(logPeriodStart(preparing(), '2026-09-29', 'b'), '2026-09-29', '2026-10-02')
    s = movePeriodStart(s, '2026-09-29', '2026-09-28')
    expect(s.periods.map((p) => p.start)).toEqual(['2026-09-01', '2026-09-28'])
    expect(s.periods.at(-1)).toEqual({ start: '2026-09-28', end: '2026-10-02', by: 'b' })
    expect(removePeriodLog(s, '2026-09-28').periods.map((p) => p.start)).toEqual(['2026-09-01'])
  })
})

describe('notes', () => {
  it('saves one line as a diary entry of the current stage', () => {
    const s = addNote(preparing(), { date: '2026-09-28', author: 'a', text: '  오늘은 푹 쉬었어요  ', id: 'n1' }, NOW)
    expect(s.diary).toHaveLength(1)
    expect(s.diary[0]).toMatchObject({ id: 'n1', date: '2026-09-28', author: 'a', stage: 'preparing', text: '오늘은 푹 쉬었어요' })
    expect(addNote(preparing(), { date: '2026-09-28', author: 'a', text: '   ' }, NOW).diary).toHaveLength(0)
  })

  it('is applied once per id (the two-tab sync may re-apply a change)', () => {
    const once = addNote(preparing(), { date: '2026-09-28', author: 'a', text: '메모', id: 'n1' }, NOW)
    expect(addNote(once, { date: '2026-09-28', author: 'a', text: '메모', id: 'n1' }, NOW)).toBe(once)
  })
})

describe('되돌리기', () => {
  const run = (s: AppState, target: LogTarget, change: (s: AppState) => AppState) => {
    const undo = logUndo(s, target)
    return { after: change(s), undo }
  }

  it('undoes an LH log without touching other days', () => {
    const s = addLHTest(preparing(), { date: '2026-09-13', time: '08:00', result: 'negative' })
    const { after, undo } = run(s, { kind: 'lh', date: '2026-09-14' }, (x) =>
      addLHTest(x, { date: '2026-09-14', time: '08:00', result: 'positive' }),
    )
    // Meanwhile another day changed (e.g. the other tab).
    const later = addLHTest(after, { date: '2026-09-15', time: '08:00', result: 'peak' })
    expect(undoLog(later, undo).lhTests.map((t) => t.date)).toEqual(['2026-09-13', '2026-09-15'])
  })

  it('undoes a period start, restoring the rest cycle and the waiting state it cleared', () => {
    let s = startRestCycle(preparing(), '2026-09-10')
    s = addPregnancyTest(s, { date: '2026-09-26', result: 'positive' }).state
    const { after, undo } = run(s, { kind: 'period' }, (x) => logPeriodStart(x, '2026-09-29', 'b'))
    const back = undoLog(after, undo)
    expect(back.periods).toEqual(s.periods)
    expect(back.restCycle).toEqual(s.restCycle)
    expect(back.positivePending).toEqual(s.positivePending)
    // Undoing when nothing was set leaves no stray keys.
    const plain = run(preparing(), { kind: 'period' }, (x) => logPeriodStart(x, '2026-09-29'))
    const b2 = undoLog(plain.after, plain.undo)
    expect('restCycle' in b2).toBe(false)
    expect('positivePending' in b2).toBe(false)
  })

  it('undoes a positive pregnancy test and its waiting state', () => {
    const s = preparing()
    const { after, undo } = run(s, { kind: 'ptest', id: 'x1' }, (x) =>
      addPregnancyTest(x, { id: 'x1', date: '2026-09-28', result: 'positive' }).state,
    )
    expect(after.positivePending).toBeDefined()
    const back = undoLog(after, undo)
    expect(back.pregnancyTests).toEqual([])
    expect(back.positivePending).toBeUndefined()
  })

  it('undoes removing a pregnancy test', () => {
    const s = addPregnancyTest(preparing(), { id: 'x1', date: '2026-09-28', result: 'positive' }).state
    const { after, undo } = run(s, { kind: 'ptest', id: 'x1' }, (x) => removePregnancyTest(x, 'x1'))
    expect(after.positivePending).toBeUndefined()
    const back = undoLog(after, undo)
    expect(back.pregnancyTests).toEqual(s.pregnancyTests)
    expect(back.positivePending).toEqual(s.positivePending)
  })

  it('undoes a note', () => {
    const { after, undo } = run(preparing(), { kind: 'note', id: 'n1' }, (x) =>
      addNote(x, { date: '2026-09-28', author: 'b', text: '메모', id: 'n1' }, NOW),
    )
    expect(undoLog(after, undo).diary).toEqual([])
  })
})

describe('which chip the sheet opens on', () => {
  // Period 09-01, 28 days: window 09-10…09-15 (예상), next period 09-29.
  const s = preparing()

  it('follows today’s place in the cycle', () => {
    expect(defaultLogKind(s, '2026-09-03', '2026-09-03')).toBe('period')
    expect(defaultLogKind(s, '2026-09-06', '2026-09-06')).toBe('period') // 4 days before the window
    expect(defaultLogKind(s, '2026-09-07', '2026-09-07')).toBe('lh') // 3 days before
    expect(defaultLogKind(s, '2026-09-12', '2026-09-12')).toBe('lh')
    expect(defaultLogKind(s, '2026-09-20', '2026-09-20')).toBe('ptest')
    expect(defaultLogKind(s, '2026-10-02', '2026-10-02')).toBe('ptest') // late
    expect(defaultLogKind(preparing({ periods: [] }), '2026-09-12', '2026-09-12')).toBe('period')
  })

  it('judges another day from that day', () => {
    expect(defaultLogKind(s, '2026-09-02', '2026-09-20')).toBe('period')
    expect(defaultLogKind(s, '2026-09-13', '2026-09-20')).toBe('lh')
    expect(defaultLogKind(s, '2026-09-18', '2026-09-20')).toBe('ptest')
  })

  it('a waiting positive test opens 임테기, a rest cycle opens 생리', () => {
    const pending = addPregnancyTest(s, { date: '2026-09-26', result: 'positive' }).state
    expect(defaultLogKind(pending, '2026-09-28', '2026-09-28')).toBe('ptest')
    expect(defaultLogKind(startRestCycle(s, '2026-09-05'), '2026-09-12', '2026-09-12')).toBe('period')
  })
})
