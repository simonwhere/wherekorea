import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { activeItems, toggleCheck } from '@/lib/logic/checks'
import { MIN_CYCLE, cycleStats } from '@/lib/logic/cycle'
import {
  JOINING_MEMBER,
  PARTNER_DEFAULT_HABITS,
  PAST_STARTS_MAX,
  PAST_START_ERROR_TEXT,
  QUICK_START_CHIPS,
  aboutWeeksAgo,
  addPastStart,
  applyOnboardingCycle,
  applyPartnerDefaults,
  cleanPastStarts,
  completePartnerFirstRun,
  needsPartnerFirstRun,
  nonOwner,
  parseDeviceViewer,
  pastStartProblem,
  periodStartsFrom,
  quickStartDate,
  removePastStart,
  starterItemsFor,
  suggestPastStart,
} from '@/lib/logic/onboarding'
import { sanitizeBackup } from '@/lib/logic/settings'
import { isAppState, normalize } from '@/lib/storage'
import type { AppState } from '@/lib/types'

const TODAY = '2026-10-02'
const LAST = '2026-09-20'

// 'a' = 지은 (onboarded, tracks the cycle), 'b' = 민수 (joins later).
function fresh(over: Partial<AppState> = {}, cycleOwner: 'a' | 'b' = 'a'): AppState {
  const s = createInitialState(
    {
      me: { name: cycleOwner === 'a' ? '지은' : '민수', role: cycleOwner === 'a' ? 'wife' : 'husband' },
      partner: { name: cycleOwner === 'a' ? '민수' : '지은', role: cycleOwner === 'a' ? 'husband' : 'wife' },
      cycleOwner,
      lastPeriodStart: LAST,
      cycleLength: 28,
    },
    new Date(2026, 9, 2, 9),
  )
  return { ...s, ...over }
}

const ctx = (pastStarts: string[] = []) => ({ lastStart: LAST, pastStarts, today: TODAY })

describe('quick start chips', () => {
  it('offers today, yesterday and 1–3 weeks ago, as past-or-today dates', () => {
    expect(QUICK_START_CHIPS.map((c) => c.label)).toEqual(['오늘', '어제', '1주 전', '2주 전', '3주 전'])
    expect(QUICK_START_CHIPS.map((c) => quickStartDate(TODAY, c.daysAgo))).toEqual([
      '2026-10-02',
      '2026-10-01',
      '2026-09-25',
      '2026-09-18',
      '2026-09-11',
    ])
  })
})

describe('earlier period starts (최근 시작일 더 넣기)', () => {
  it('accepts a real past day before the last start, newest first', () => {
    const one = addPastStart('2026-08-23', ctx())
    expect(one).toEqual({ list: ['2026-08-23'], error: null })
    const two = addPastStart('2026-07-27', ctx(one.list))
    expect(two.list).toEqual(['2026-08-23', '2026-07-27'])
    // Adding in the other order sorts the same way.
    expect(addPastStart('2026-08-23', ctx(['2026-07-27'])).list).toEqual(['2026-08-23', '2026-07-27'])
  })

  it('rejects what can’t be an earlier start, and leaves the list alone', () => {
    const list = ['2026-08-23']
    expect(pastStartProblem('nope', ctx(list))).toBe('invalid')
    expect(pastStartProblem('2026-10-03', ctx(list))).toBe('future')
    expect(pastStartProblem(LAST, ctx(list))).toBe('not-before-last')
    expect(pastStartProblem('2026-09-25', ctx(list))).toBe('not-before-last')
    expect(pastStartProblem(addDays(TODAY, -731), ctx(list))).toBe('too-old')
    expect(pastStartProblem(addDays(TODAY, -730), ctx(list))).toBeNull() // exactly two years back still counts
    expect(pastStartProblem('2026-08-23', ctx(list))).toBe('duplicate')
    expect(pastStartProblem(addDays(LAST, -MIN_CYCLE + 1), ctx(list))).toBe('too-close')
    expect(pastStartProblem(addDays('2026-08-23', -3), ctx(list))).toBe('too-close')
    expect(pastStartProblem(addDays(LAST, -MIN_CYCLE), ctx([]))).toBeNull()
    const r = addPastStart('2026-09-25', ctx(list))
    expect(r.list).toEqual(list)
    expect(r.error).toBe('not-before-last')
    for (const key of Object.keys(PAST_START_ERROR_TEXT)) expect(PAST_START_ERROR_TEXT[key as keyof typeof PAST_START_ERROR_TEXT]).toMatch(/요\.$/)
  })

  it('takes at most six earlier starts', () => {
    let list: string[] = []
    for (let i = 1; i <= PAST_STARTS_MAX; i++) {
      const r = addPastStart(addDays(LAST, -28 * i), ctx(list))
      expect(r.error).toBeNull()
      list = r.list
    }
    expect(list).toHaveLength(6)
    const seventh = addPastStart(addDays(LAST, -28 * 7), ctx(list))
    expect(seventh.error).toBe('full')
    expect(seventh.list).toHaveLength(6)
    expect(removePastStart(list, list[0]!)).toHaveLength(5)
    expect(removePastStart(list, '2000-01-01')).toEqual(list)
  })

  it('suggests one average cycle before the oldest date, until the list is full', () => {
    expect(suggestPastStart({ ...ctx(), cycleLength: 28 })).toBe('2026-08-23')
    expect(suggestPastStart({ ...ctx(['2026-08-23']), cycleLength: 28 })).toBe('2026-07-26')
    expect(suggestPastStart({ ...ctx(['2026-08-23']), cycleLength: 35 })).toBe('2026-07-19')
    // Never closer than MIN_CYCLE, even with a silly length.
    expect(suggestPastStart({ ...ctx(), cycleLength: 3 })).toBe(addDays(LAST, -MIN_CYCLE))
    const full = Array.from({ length: PAST_STARTS_MAX }, (_, i) => addDays(LAST, -28 * (i + 1)))
    expect(suggestPastStart({ ...ctx(full), cycleLength: 28 })).toBeNull()
    expect(aboutWeeksAgo(28)).toBe('약 4주 전')
    expect(aboutWeeksAgo(35)).toBe('약 5주 전')
    expect(aboutWeeksAgo(15)).toBe('약 2주 전')
  })

  it('drops earlier starts that no longer fit when the last start moves or is cleared', () => {
    const list = ['2026-08-23', '2026-07-27']
    expect(cleanPastStarts(list, LAST, TODAY)).toEqual(list)
    // The last start moved before 8/23: that chip is gone, 7/27 stays.
    expect(cleanPastStarts(list, '2026-08-20', TODAY)).toEqual(['2026-07-27'])
    // Too close to the new last start.
    expect(cleanPastStarts(list, '2026-09-01', TODAY)).toEqual(['2026-07-27'])
    expect(cleanPastStarts(list, '', TODAY)).toEqual([])
    expect(cleanPastStarts(list, undefined, TODAY)).toEqual([])
    expect(cleanPastStarts(list, '2026-10-03', TODAY)).toEqual([])
    expect(cleanPastStarts(['2026-07-27', '2026-08-23', '2026-08-23'], LAST, TODAY)).toEqual(['2026-08-23', '2026-07-27'])
  })

  it('lists every start oldest first for the first state', () => {
    expect(periodStartsFrom(LAST, ['2026-07-27', '2026-08-23'], TODAY)).toEqual(['2026-07-27', '2026-08-23', LAST])
    expect(periodStartsFrom(undefined, ['2026-08-23'], TODAY)).toEqual([])
    expect(periodStartsFrom(LAST, [], TODAY)).toEqual([LAST])
  })

  it('adds the earlier starts as the owner’s own periods, so the first month uses her cycles', () => {
    const s = applyOnboardingCycle(fresh(), { pastStarts: ['2026-07-27', '2026-08-23'], usesLH: true }, TODAY)
    expect(s.periods).toEqual([
      { start: '2026-07-27', by: 'a' },
      { start: '2026-08-23', by: 'a' },
      { start: LAST },
    ])
    const stats = cycleStats(s.periods, s.cycle)
    expect(stats.source).toBe('logs')
    expect(stats.lengths).toEqual([27, 28])
    expect(s.settings.usesLH).toBe(true)
    // Round trip: a valid, storable state.
    expect(isAppState(s)).toBe(true)
    expect(sanitizeBackup(normalize(JSON.parse(JSON.stringify(s))))).toEqual(s)
  })

  it('keeps 안 써요 / 나중에, and skips the LH answer when it wasn’t given', () => {
    expect(applyOnboardingCycle(fresh(), { usesLH: false }, TODAY).settings.usesLH).toBe(false)
    expect(applyOnboardingCycle(fresh(), { usesLH: 'later' }, TODAY).settings.usesLH).toBe('later')
    const s = applyOnboardingCycle(fresh(), {}, TODAY)
    expect('usesLH' in s.settings).toBe(false)
    expect(s.periods).toEqual([{ start: LAST }])
  })

  it('adds no earlier start without a last start (잘 모르겠어요) or when it doesn’t fit', () => {
    const none = fresh({ periods: [] })
    expect(applyOnboardingCycle(none, { pastStarts: ['2026-08-23'] }, TODAY).periods).toEqual([])
    const s = applyOnboardingCycle(fresh(), { pastStarts: ['2026-09-25', '2026-09-10', 'bad', '2026-08-23'] }, TODAY)
    expect(s.periods.map((p) => p.start)).toEqual(['2026-08-23', LAST])
  })
})

describe('the partner’s defaults and first run', () => {
  it('starts the non-owner with 걷기 30분 only and 은근하게, whichever member that is', () => {
    const s = applyPartnerDefaults(fresh(), TODAY)
    expect(activeItems(s, 'b').map((i) => [i.label, i.cadence])).toEqual([['걷기 30분', undefined]])
    expect(activeItems(s, 'a').map((i) => i.label)).toEqual(['엽산'])
    expect(s.settings.alertStyle).toEqual({ a: 'explicit', b: 'soft' })
    expect(s.checkItems.every((i) => i.createdAt === TODAY)).toBe(true)
    // The husband onboarded: he is the non-owner, his own rows get the default too.
    const his = applyPartnerDefaults(fresh({}, 'b'), TODAY)
    expect(nonOwner(his)).toBe('a')
    expect(activeItems(his, 'a').map((i) => i.label)).toEqual(['걷기 30분'])
    expect(activeItems(his, 'b').map((i) => i.label)).toEqual(['엽산'])
    expect(his.settings.alertStyle).toEqual({ a: 'soft', b: 'explicit' })
    expect(PARTNER_DEFAULT_HABITS).toEqual({ smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false })
  })

  it('builds the full starter list only from the member’s own answers', () => {
    const s = fresh()
    expect(starterItemsFor(s, 'b', TODAY).map((i) => i.label)).toEqual(['걷기 30분'])
    expect(starterItemsFor(s, 'b', TODAY, { ...PARTNER_DEFAULT_HABITS, smokes: true, drinks: 'often' }).map((i) => i.label)).toEqual([
      '걷기 30분',
      '금연',
      '금주',
      '사우나·뜨거운 탕 쉬기',
    ])
    expect(starterItemsFor(s, 'a', TODAY).map((i) => i.label)).toEqual(['엽산'])
  })

  it('asks the joining member once: on their first visit, while preparing, until they joined or ticked something', () => {
    const s = applyPartnerDefaults(fresh(), TODAY)
    expect(JOINING_MEMBER).toBe('b')
    expect(needsPartnerFirstRun(s, 'b')).toBe(true)
    expect(needsPartnerFirstRun(s, 'a')).toBe(false)
    expect(needsPartnerFirstRun({ ...s, stage: 'pregnant' }, 'b')).toBe(false)
    expect(needsPartnerFirstRun({ ...s, couple: { ...s.couple, linkedAt: '2026-10-02T09:00:00+09:00' } }, 'b')).toBe(false)
    // Older data: he has been here (ticked a row) — don't greet him as new.
    const item = activeItems(s, 'b')[0]!
    expect(needsPartnerFirstRun(toggleCheck(s, 'b', TODAY, item.id), 'b')).toBe(false)
    // The owner's own ticks don't count as his.
    const hers = activeItems(s, 'a')[0]!
    expect(needsPartnerFirstRun(toggleCheck(s, 'a', TODAY, hers.id), 'b')).toBe(true)
  })

  it('rebuilds his rows from his answers, sets his alert style and records that he joined', () => {
    const s0 = applyPartnerDefaults(fresh(), TODAY)
    const at = '2026-10-02T21:10:00+09:00'
    const s = completePartnerFirstRun(s0, 'b', { habits: { ...PARTNER_DEFAULT_HABITS, smokes: true, exercises: true }, alertStyle: 'explicit' }, TODAY, at)
    expect(activeItems(s, 'b').map((i) => i.label)).toEqual(['운동 30분', '금연', '사우나·뜨거운 탕 쉬기'])
    expect(activeItems(s, 'a').map((i) => i.label)).toEqual(['엽산'])
    expect(s.settings.alertStyle.b).toBe('explicit')
    expect(s.couple.linkedAt).toBe(at)
    expect(needsPartnerFirstRun(s, 'b')).toBe(false)
    // '이대로 시작할게요': nothing changes but the join.
    const kept = completePartnerFirstRun(s0, 'b', null, TODAY, at)
    expect(kept.checkItems).toEqual(s0.checkItems)
    expect(kept.settings.alertStyle).toEqual(s0.settings.alertStyle)
    expect(kept.couple.linkedAt).toBe(at)
    // The cycle owner's rows are never rebuilt from habit answers.
    const owner = completePartnerFirstRun(applyPartnerDefaults(fresh({}, 'b'), TODAY), 'b', { habits: { ...PARTNER_DEFAULT_HABITS, smokes: true }, alertStyle: 'soft' }, TODAY, at)
    expect(activeItems(owner, 'b').map((i) => i.label)).toEqual(['엽산'])
    expect(activeItems(owner, 'a').map((i) => i.label)).toEqual(['걷기 30분'])
    expect(owner.settings.alertStyle.b).toBe('soft')
  })

  it('reads a stored "whose phone" value strictly', () => {
    expect(parseDeviceViewer('a')).toBe('a')
    expect(parseDeviceViewer('b')).toBe('b')
    expect(parseDeviceViewer('c')).toBeNull()
    expect(parseDeviceViewer(null)).toBeNull()
    expect(parseDeviceViewer(undefined)).toBeNull()
  })
})
