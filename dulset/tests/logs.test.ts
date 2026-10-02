import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  LH_LEAD_DAYS,
  MAX_LH_PER_DAY,
  addLHTest,
  addNote,
  addPregnancyTest,
  defaultLogKind,
  freeLHSlot,
  isTime,
  lhAskDue,
  lhChangesEstimate,
  lhKey,
  lhSlotOf,
  lhTestsOn,
  lhWhen,
  logPeriodEnd,
  logPeriodStart,
  logUndo,
  movePeriodStart,
  planLHTest,
  pregnancyTestsOn,
  removeLHTest,
  removePeriodLog,
  removePregnancyTest,
  replaceLHDay,
  undoLog,
  type LogTarget,
} from '@/lib/logic/logs'
import { addEntry } from '@/lib/logic/diary'
import { mergeNotices, scheduledNotices } from '@/lib/logic/notifications'
import { USES_LH_OPTIONS, lhPrompting, lhTestTimeFor, setLHTestTime, setPersonalPref, setUsesLH } from '@/lib/logic/prefs'
import { sanitizeBackup } from '@/lib/logic/settings'
import { LH_LEAD_DAYS as HOME_LH_LEAD_DAYS } from '@/lib/logic/ttcFlow'
import { startRestCycle } from '@/lib/logic/ttc'
import type { AppState, LHTest } from '@/lib/types'

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

  it('never overwrites quietly: a test at the same time is replaced only when told so', () => {
    const s = addLHTest(preparing(), { date: '2026-09-14', time: '08:10', result: 'negative' })
    const plan = planLHTest(lhTestsOn(s.lhTests, '2026-09-14'), { date: '2026-09-14', time: '08:10', result: 'positive' })
    expect(plan).toMatchObject({ action: 'replace', target: { time: '08:10', result: 'negative' } })
    expect(addLHTest(s, { date: '2026-09-14', time: '08:10', result: 'positive' })).toBe(s)
    const replaced = addLHTest(s, { date: '2026-09-14', time: '08:10', result: 'positive' }, undefined, { replace: true })
    expect(replaced.lhTests).toEqual([{ date: '2026-09-14', time: '08:10', result: 'positive' }])
  })

  it(`keeps at most ${MAX_LH_PER_DAY} a day: a third goes in place of the one closest in time, and only when agreed`, () => {
    let s = preparing()
    s = addLHTest(s, { date: '2026-09-14', time: '08:00', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '21:00', result: 'faint' })
    const third = { date: '2026-09-14', time: '19:00', result: 'positive' } as const
    expect(planLHTest(lhTestsOn(s.lhTests, '2026-09-14'), third)).toMatchObject({ action: 'replace', target: { time: '21:00' } })
    expect(addLHTest(s, third)).toBe(s)
    s = addLHTest(s, third, undefined, { replace: true })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => [t.time, t.result])).toEqual([
      ['08:00', 'negative'],
      ['19:00', 'positive'],
    ])
    s = addLHTest(s, { date: '2026-09-14', time: '07:00', result: 'faint' }, undefined, { replace: true })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => t.time)).toEqual(['07:00', '19:00'])
    // Other days are untouched.
    s = addLHTest(s, { date: '2026-09-15', time: '07:00', result: 'peak' })
    expect(s.lhTests).toHaveLength(3)
  })

  it('a test without a time or a slot takes the first free half of the day', () => {
    let s = addLHTest(preparing(), { date: '2026-09-14', result: 'negative' })
    expect(s.lhTests).toEqual([{ date: '2026-09-14', slot: 'morning', result: 'negative' }])
    s = addLHTest(s, { date: '2026-09-14', result: 'faint' })
    expect(lhTestsOn(s.lhTests, '2026-09-14').map((t) => [t.slot, t.result])).toEqual([
      ['morning', 'negative'],
      ['evening', 'faint'],
    ])
    // Both halves taken: the third would replace 아침 — not without agreement.
    const third = { date: '2026-09-14', result: 'positive' } as const
    expect(planLHTest(lhTestsOn(s.lhTests, '2026-09-14'), third)).toMatchObject({ action: 'replace', target: { slot: 'morning' } })
    expect(addLHTest(s, third)).toBe(s)
    // An untimed test from before slots existed keeps its own key ('').
    const legacy: { lhTests: LHTest[] } = { lhTests: [{ date: '2026-09-14', result: 'positive' }] }
    expect(lhKey(legacy.lhTests[0]!)).toBe('')
    expect(lhSlotOf(legacy.lhTests[0]!)).toBeUndefined()
    expect(addLHTest(legacy, { date: '2026-09-14', result: 'negative' }).lhTests.map(lhKey)).toEqual(['', 'morning'])
  })

  it('ignores a malformed time', () => {
    expect(isTime('7:5')).toBe(false)
    expect(isTime('24:00')).toBe(false)
    expect(isTime('07:05')).toBe(true)
    const s = addLHTest(preparing(), { date: '2026-09-14', time: '7:5', result: 'negative' })
    expect(s.lhTests[0]).not.toHaveProperty('time')
    expect(s.lhTests[0]).toHaveProperty('slot', 'morning')
  })

  it('removes one test by date and key (time, slot, or none)', () => {
    let s = preparing()
    s = addLHTest(s, { date: '2026-09-14', time: '08:00', result: 'negative' })
    s = addLHTest(s, { date: '2026-09-14', time: '20:00', result: 'positive' })
    s = removeLHTest(s, '2026-09-14', '20:00')
    expect(s.lhTests).toEqual([{ date: '2026-09-14', time: '08:00', result: 'negative' }])
    const legacy = removeLHTest({ lhTests: [{ date: '2026-09-14', result: 'positive' }, ...s.lhTests] }, '2026-09-14')
    expect(legacy.lhTests).toEqual(s.lhTests)
    const slotted = addLHTest(s, { date: '2026-09-13', slot: 'evening', result: 'faint' })
    expect(removeLHTest(slotted, '2026-09-13', 'evening').lhTests).toEqual(s.lhTests)
    expect(removeLHTest(slotted, '2026-09-13', 'morning')).toEqual(slotted)
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
    // Judged as if the person agrees to replace: the same slot's negative turning positive moves it.
    const negative = addLHTest(s, { date: '2026-09-12', slot: 'morning', result: 'negative' })
    expect(lhChangesEstimate(negative, { date: '2026-09-12', slot: 'morning', result: 'positive' })).toBe(true)
    // No cycle yet: nothing to recalculate.
    expect(lhChangesEstimate(preparing({ periods: [] }), { date: '2026-09-12', result: 'positive' })).toBe(false)
  })

  it('replaceLHDay restores a whole day', () => {
    const s = addLHTest(preparing(), { date: '2026-09-14', time: '08:00', result: 'negative' })
    expect(replaceLHDay(s, '2026-09-14', []).lhTests).toEqual([])
  })
})

describe('LH slots for a past day (아침 · 저녁)', () => {
  const day = '2026-09-14'

  it('two slot entries on one past day both stay (아침 음성, 저녁 양성)', () => {
    let s = addLHTest(preparing(), { date: day, slot: 'morning', result: 'negative', by: 'b' })
    s = addLHTest(s, { date: day, slot: 'evening', result: 'positive', by: 'b' })
    expect(lhTestsOn(s.lhTests, day)).toEqual([
      { date: day, slot: 'morning', result: 'negative', by: 'b' },
      { date: day, slot: 'evening', result: 'positive', by: 'b' },
    ])
    expect(lhTestsOn(s.lhTests, day).map(lhWhen)).toEqual(['아침', '저녁'])
    expect(freeLHSlot(lhTestsOn(s.lhTests, day))).toBeUndefined()
  })

  it('a slot already taken asks before replacing; the other slot is free', () => {
    const s = addLHTest(preparing(), { date: day, slot: 'morning', result: 'negative' })
    const tests = lhTestsOn(s.lhTests, day)
    expect(freeLHSlot(tests)).toBe('evening')
    expect(planLHTest(tests, { date: day, slot: 'evening', result: 'faint' })).toMatchObject({ action: 'add', test: { slot: 'evening' } })
    expect(planLHTest(tests, { date: day, slot: 'morning', result: 'faint' })).toMatchObject({ action: 'replace', target: { slot: 'morning' } })
    expect(addLHTest(s, { date: day, slot: 'morning', result: 'faint' })).toBe(s)
    expect(addLHTest(s, { date: day, slot: 'morning', result: 'faint' }, undefined, { replace: true }).lhTests).toEqual([
      { date: day, slot: 'morning', result: 'faint' },
    ])
  })

  it('a timed test counts as the slot of its half of the day ("08:10 기록을 바꿀까요?")', () => {
    const s = addLHTest(preparing(), { date: day, time: '08:10', result: 'negative' })
    const tests = lhTestsOn(s.lhTests, day)
    expect(lhSlotOf(tests[0]!)).toBe('morning')
    expect(lhSlotOf({ time: '12:00' })).toBe('evening')
    expect(freeLHSlot(tests)).toBe('evening')
    const plan = planLHTest(tests, { date: day, slot: 'morning', result: 'positive', by: 'b' })
    expect(plan.action).toBe('replace')
    if (plan.action === 'replace') expect(lhWhen(plan.target)).toBe('08:10')
    // …and the replacement keeps that clock time ('08:10 희미' → '08:10 양성'), not a bare slot.
    expect(plan.test).toEqual({ date: day, time: '08:10', result: 'positive', by: 'b' })
    expect(addLHTest(s, { date: day, slot: 'morning', result: 'positive' }, undefined, { replace: true }).lhTests).toEqual([
      { date: day, time: '08:10', result: 'positive' },
    ])
    // A slot given with a valid time is ignored: the time is the key.
    expect(planLHTest(tests, { date: day, time: '20:00', slot: 'morning', result: 'positive' })).toMatchObject({
      action: 'add',
      test: { time: '20:00' },
    })
    expect(planLHTest(tests, { date: day, time: '20:00', slot: 'morning', result: 'positive' }).test).not.toHaveProperty('slot')
  })

  it('a full day of timed tests: 아침 stands for the first, 저녁 for the last', () => {
    let s = addLHTest(preparing(), { date: day, time: '13:00', result: 'negative' })
    s = addLHTest(s, { date: day, time: '20:00', result: 'faint' })
    const tests = lhTestsOn(s.lhTests, day)
    // Both are 저녁 by their times — 저녁 stands for the later one, 아침 (no morning test) for the first row.
    expect(planLHTest(tests, { date: day, slot: 'evening', result: 'positive' })).toMatchObject({ action: 'replace', target: { time: '13:00' } })
    expect(planLHTest(tests, { date: day, slot: 'morning', result: 'positive' })).toMatchObject({ action: 'replace', target: { time: '13:00' } })
    const s2 = addLHTest(preparing(), { date: day, time: '13:00', result: 'negative' })
    const s3 = addLHTest(s2, { date: day, time: '14:00', result: 'faint' })
    const t3 = lhTestsOn(s3.lhTests, day)
    expect(planLHTest(t3, { date: day, slot: 'evening', result: 'positive' })).toMatchObject({ action: 'replace', target: { time: '13:00' } })
    // Untimed legacy rows count as farthest for a timed test and are never the half-of-day match.
    const legacy = [{ date: day, result: 'negative' as const }, { date: day, time: '09:00', result: 'faint' as const }]
    expect(planLHTest(legacy, { date: day, time: '10:00', result: 'positive' })).toMatchObject({ action: 'replace', target: { time: '09:00' } })
  })

  it('orders 아침 before clock times and 저녁 after, and sorts across days', () => {
    let s = addLHTest(preparing(), { date: day, time: '09:00', result: 'negative' })
    s = addLHTest(s, { date: day, slot: 'evening', result: 'faint' }, undefined, { replace: true })
    s = replaceLHDay(s, day, [{ date: day, slot: 'evening', result: 'faint' }, { date: day, slot: 'morning', result: 'negative' }])
    s = addLHTest(s, { date: '2026-09-13', time: '21:00', result: 'negative' })
    expect(s.lhTests.map((t) => `${t.date} ${lhKey(t)}`)).toEqual([`2026-09-13 21:00`, `${day} morning`, `${day} evening`])
    const mixed = replaceLHDay(s, day, [{ date: day, slot: 'evening', result: 'faint' }, { date: day, time: '23:30', result: 'negative' }])
    expect(lhTestsOn(mixed.lhTests, day).map(lhKey)).toEqual(['23:30', 'evening'])
  })

  it('undo puts the replaced slot entry back', () => {
    const s = addLHTest(preparing(), { date: day, slot: 'morning', result: 'negative' })
    const undo = logUndo(s, { kind: 'lh', date: day })
    const after = addLHTest(s, { date: day, slot: 'morning', result: 'positive' }, undefined, { replace: true })
    expect(lhTestsOn(after.lhTests, day)).toEqual([{ date: day, slot: 'morning', result: 'positive' }])
    expect(undoLog(after, undo).lhTests).toEqual(s.lhTests)
  })

  it('the backup validator keeps slots and drops anything else', () => {
    const s = addLHTest(preparing(), { date: day, slot: 'evening', result: 'faint', by: 'b' })
    const raw = JSON.parse(JSON.stringify(s)) as AppState
    ;(raw.lhTests[0] as unknown as { slot: string }).slot = 'evening'
    raw.lhTests.push({ date: day, slot: 'noon' as never, result: 'negative' })
    const clean = sanitizeBackup(raw)
    expect(clean && clean.lhTests.map((t) => t.slot)).toEqual(['evening', undefined])
  })
})

describe('배란테스트기 써요? (settings.usesLH)', () => {
  // Period 09-01, 28 days: window 09-10…09-15 (예상); LH_LEAD_DAYS = 3 → the LH moment starts 09-07.
  const s = preparing()

  it('asks once the cycle reaches the LH moment and until answered', () => {
    expect(lhAskDue(s, '2026-09-03')).toBe(false)
    expect(lhAskDue(s, '2026-09-06')).toBe(false)
    expect(lhAskDue(s, '2026-09-07')).toBe(true)
    expect(lhAskDue(s, '2026-09-12')).toBe(true)
    expect(lhAskDue(s, '2026-09-20')).toBe(true)
    expect(lhAskDue(s, '2026-10-05')).toBe(true) // late
    expect(lhAskDue(preparing({ periods: [] }), '2026-09-12')).toBe(false)
  })

  it('is settled by an answer, and 나중에 waits for the next cycle', () => {
    expect(lhAskDue(setUsesLH(s, true), '2026-09-12')).toBe(false)
    expect(lhAskDue(setUsesLH(s, false), '2026-09-12')).toBe(false)
    const later = setUsesLH(s, 'later')
    expect(lhAskDue(later, '2026-09-12')).toBe(true)
    expect(lhAskDue(later, '2026-09-12', '2026-09-01')).toBe(false)
    expect(lhAskDue(later, '2026-09-12', '2026-08-04')).toBe(true)
    // The next cycle asks again.
    const next = logPeriodStart(later, '2026-09-29', 'b')
    expect(lhAskDue(next, '2026-10-06', '2026-09-01')).toBe(true)
  })

  it('stays quiet while the dates are paused and outside preparing', () => {
    expect(lhAskDue(startRestCycle(s, '2026-09-05'), '2026-09-12')).toBe(false)
    expect(lhAskDue(addPregnancyTest(s, { date: '2026-09-11', result: 'positive' }).state, '2026-09-12')).toBe(false)
    expect(lhAskDue(preparing({ stage: 'pregnant' }), '2026-09-12')).toBe(false)
  })

  it('lhPrompting is off only for an explicit 안 써요', () => {
    expect(lhPrompting(s)).toBe(true)
    expect(lhPrompting(setUsesLH(s, 'later'))).toBe(true)
    expect(lhPrompting(setUsesLH(s, true))).toBe(true)
    expect(lhPrompting(setUsesLH(s, false))).toBe(false)
    expect(USES_LH_OPTIONS.map((o) => o.value)).toEqual([true, false, 'later'])
  })

  it('only the cycle owner answers; clearing asks again', () => {
    expect(setUsesLH(s, false, 'a')).toBe(s) // 민수 is not the cycle owner
    const no = setUsesLH(s, false, 'b')
    expect(no.settings.usesLH).toBe(false)
    expect(setUsesLH(no, false, 'b')).toBe(no)
    const cleared = setUsesLH(no, undefined)
    expect('usesLH' in cleared.settings).toBe(false)
    expect(lhAskDue(cleared, '2026-09-12')).toBe(true)
  })

  it('the sheet opens on 메모 instead of LH for someone who said 안 써요', () => {
    expect(defaultLogKind(s, '2026-09-12', '2026-09-12')).toBe('lh')
    expect(defaultLogKind(setUsesLH(s, false), '2026-09-12', '2026-09-12')).toBe('note')
    expect(defaultLogKind(setUsesLH(s, false), '2026-09-20', '2026-09-20')).toBe('ptest')
    expect(defaultLogKind(setUsesLH(s, 'later'), '2026-09-12', '2026-09-12')).toBe('lh')
  })

  it('keeps a usual LH test time per person (HH:MM only)', () => {
    expect(lhTestTimeFor(s.settings, 'b')).toBeUndefined()
    const t = setLHTestTime(s, 'b', '19:30')
    expect(lhTestTimeFor(t.settings, 'b')).toBe('19:30')
    expect(lhTestTimeFor(t.settings, 'a')).toBeUndefined()
    expect(setLHTestTime(t, 'b', '19:30')).toBe(t)
    expect(lhTestTimeFor(setLHTestTime(t, 'b', '7:5').settings, 'b')).toBeUndefined()
    expect(lhTestTimeFor(setLHTestTime(t, 'b', undefined).settings, 'b')).toBeUndefined()
    expect(setLHTestTime(s, 'b', undefined)).toBe(s)
    // Other personal prefs on the same person survive.
    const both = setLHTestTime(setPersonalPref(s, 'b', 'discreet', true), 'b', '08:00')
    expect(both.settings.personal?.b).toEqual({ discreet: true, lhTestTime: '08:00' })
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
    expect(state.positivePending).toEqual({ since: '2026-09-28', testId: test!.id })
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

describe('nothing is logged in the future', () => {
  // The sheet never offers a day after today, but a change re-applied by the
  // two-tab sync or a pinned ?today must not slip one in either.
  it('period, LH and test logs dated after today leave the state as it is', () => {
    const s = preparing()
    expect(logPeriodStart(s, '2026-09-29', 'b', '2026-09-28')).toBe(s)
    expect(logPeriodStart(s, '2026-09-28', 'b', '2026-09-28').periods.map((p) => p.start)).toContain('2026-09-28')
    expect(addLHTest(s, { date: '2026-09-29', time: '08:00', result: 'positive', by: 'b' }, '2026-09-28')).toBe(s)
    expect(addLHTest(s, { date: '2026-09-28', time: '08:00', result: 'positive', by: 'b' }, '2026-09-28').lhTests).toHaveLength(1)
    const future = addPregnancyTest(s, { id: 'f', date: '2026-09-29', result: 'positive', by: 'b' }, '2026-09-28')
    expect(future).toEqual({ state: s })
    expect(future.state.positivePending).toBeUndefined()
    expect(addPregnancyTest(s, { id: 'f', date: '2026-09-28', result: 'positive', by: 'b' }, '2026-09-28').test?.id).toBe('f')
  })

  it('the home card and the sheet count LH lead days from the same constant', () => {
    expect(LH_LEAD_DAYS).toBe(HOME_LH_LEAD_DAYS)
    expect(LH_LEAD_DAYS).toBe(3)
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
    // Same for a diary entry written with the composer's own id.
    const entry = { id: 'd1', date: '2026-09-28', author: 'b' as const, text: '오늘의 기록', mood: '🥰' }
    const one = addEntry(preparing(), entry, NOW)
    expect(one.diary).toHaveLength(1)
    expect(one.diary[0]).toMatchObject({ id: 'd1', text: '오늘의 기록', mood: '🥰' })
    expect(addEntry(one, entry, NOW)).toBe(one)
    // Without an id each call still adds (demo data, older callers).
    const { id: _id, ...noId } = entry
    expect(addEntry(addEntry(preparing(), noId, NOW), noId, NOW).diary).toHaveLength(2)
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

  it('takes back the once-per-cycle window notice an undone LH log sent', () => {
    // The notification engine (useNotificationEngine) runs after every change.
    const today = '2026-09-10'
    const engine = (x: AppState) => mergeNotices(x, scheduledNotices(x, today), NOW).state
    const keys = (x: AppState) => x.notifications.map((n) => n.key)
    // Three regular cycles behind 09-01: a confirmed estimate (cycleStats.confidence
    // 'cycles'), which the peak notice needs (N12) — a lone period sends none.
    const regular = ['2026-06-09', '2026-07-07', '2026-08-04', '2026-09-01'].map((start) => ({ start, by: 'b' as const }))
    const s = engine(preparing({ periods: regular }))
    expect(keys(s).some((k) => k?.startsWith('peak:'))).toBe(false)
    const { after, undo } = run(s, { kind: 'lh', date: today }, (x) =>
      addLHTest(x, { date: today, time: '08:00', result: 'positive' }),
    )
    const sent = engine(after)
    expect(keys(sent).some((k) => k?.startsWith('peak:'))).toBe(true)
    const back = undoLog(sent, undo)
    expect(keys(back)).toEqual(keys(s))
    // Not due for the restored records — and still free to go out on the right day.
    expect(keys(engine(back))).toEqual(keys(s))
    expect(keys(mergeNotices(back, scheduledNotices(back, '2026-09-13'), NOW).state).some((k) => k?.startsWith('peak:'))).toBe(true)
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
