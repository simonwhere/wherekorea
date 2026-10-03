import { describe, expect, it } from 'vitest'
import { babyAge, dayOfLife, formatBabyAge, koreanDays, nextKoreanDay } from '@/lib/logic/baby'
import {
  activeDailyItems,
  activeItems,
  activeWeeklyItems,
  addCheckItem,
  archiveCheckItem,
  coupleStreak,
  coupleWeekCount,
  firstCheckOf,
  isDueThisWeek,
  itemsFor,
  mondayOf,
  nudgeableItem,
  progress,
  streak,
  toggleCheck,
  toggleWeekly,
  updateCheckItem,
  weekCount,
  weekCountLabel,
  weekDays,
  weeklyDone,
  weeklyDue,
} from '@/lib/logic/checks'
import { buildIcs, foldLine } from '@/lib/logic/ics'
import {
  doctorThresholdMonths,
  inbox,
  markRead,
  mergeNotices,
  scheduledNotices,
  sendNudge,
  NUDGES_PER_DAY,
  clearNotifications,
} from '@/lib/logic/notifications'
import { dueDate, formatGA, gestationalAge, startPregnancy } from '@/lib/logic/pregnancy'
import { applyOnboardingExtras, createInitialState, defaultCheckItems, type HabitAnswers } from '@/lib/initial'
import type { AppState, Member } from '@/lib/types'

function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over }
}

describe('checks', () => {
  it('creates role-aware defaults for both members', () => {
    const s = fresh()
    const wife = activeItems(s, 'b').map((i) => i.label)
    const husband = activeItems(s, 'a').map((i) => i.label)
    expect(wife).toContain('엽산')
    expect(husband).not.toContain('엽산')
    expect(husband.length).toBeGreaterThan(0)
  })

  it('toggles and measures progress', () => {
    let s = fresh()
    const items = activeItems(s, 'a')
    for (const i of items) s = toggleCheck(s, 'a', '2026-09-02', i.id)
    expect(progress(s, 'a', '2026-09-02')).toEqual({ done: items.length, total: items.length, complete: true })
    s = toggleCheck(s, 'a', '2026-09-02', items[0]!.id)
    expect(progress(s, 'a', '2026-09-02').complete).toBe(false)
  })

  it('counts streaks without resetting on an unfinished today', () => {
    let s = fresh()
    const doAll = (m: 'a' | 'b', d: string) => {
      for (const i of itemsFor(s, m, d)) if (!(s.checkLog[d]?.[m] ?? []).includes(i.id)) s = toggleCheck(s, m, d, i.id)
    }
    doAll('a', '2026-09-02')
    doAll('a', '2026-09-03')
    doAll('b', '2026-09-03')
    expect(streak(s, 'a', '2026-09-04')).toBe(2) // today (4th) not done yet
    doAll('a', '2026-09-04')
    expect(streak(s, 'a', '2026-09-04')).toBe(3)
    expect(coupleStreak(s, '2026-09-04')).toBe(1) // only the 3rd had both
  })

  it('keeps history when an item is archived, and new items do not rewrite the past', () => {
    let s = fresh()
    const [first] = activeItems(s, 'a')
    s = archiveCheckItem(s, first!.id, '2026-09-10')
    expect(itemsFor(s, 'a', '2026-09-09').some((i) => i.id === first!.id)).toBe(true)
    expect(itemsFor(s, 'a', '2026-09-10').some((i) => i.id === first!.id)).toBe(false)
    s = addCheckItem(s, 'a', '  코엔자임Q10 ', 'supplement', '2026-09-10')
    expect(itemsFor(s, 'a', '2026-09-09').some((i) => i.label === '코엔자임Q10')).toBe(false)
    expect(activeItems(s, 'a').some((i) => i.label === '코엔자임Q10')).toBe(true)
    expect(addCheckItem(s, 'a', '   ', 'habit', '2026-09-10')).toBe(s)
  })
})

// ── Weekly cadence (N7) ─────────────────────────────────────

/** 민수 with one daily row (걷기) and one weekly check-in (금주); 지은 with 엽산. */
function withCadence(): AppState {
  let s = fresh({ checkItems: [], checkLog: {} })
  s = addCheckItem(s, 'a', '걷기 30분', 'habit', '2026-09-01')
  s = addCheckItem(s, 'a', '금주', 'habit', '2026-09-01', '주 1회 체크인', 'weekly')
  s = addCheckItem(s, 'b', '엽산', 'supplement', '2026-09-01', '400µg')
  return s
}
const walk = (s: AppState) => activeItems(s, 'a').find((i) => i.label === '걷기 30분')!
const noDrink = (s: AppState) => activeItems(s, 'a').find((i) => i.label === '금주')!
const folic = (s: AppState) => activeItems(s, 'b')[0]!

describe('check cadence', () => {
  it('uses ISO weeks, Monday to Sunday', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28') // Monday
    expect(mondayOf('2026-10-04')).toBe('2026-09-28') // Sunday belongs to the week before it
    expect(mondayOf('2026-09-01')).toBe('2026-08-31')
    expect(weekDays('2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  it('treats items without a cadence as daily (older data)', () => {
    const s = fresh()
    expect(activeItems(s, 'a').every((i) => i.cadence === undefined)).toBe(true)
    expect(activeDailyItems(s, 'a')).toHaveLength(activeItems(s, 'a').length)
    expect(activeWeeklyItems(s, 'a')).toHaveLength(0)
  })

  it('counts a weekly check-in once per ISO week', () => {
    let s = withCadence()
    const item = noDrink(s)
    expect(item.cadence).toBe('weekly')
    expect(isDueThisWeek(s, 'a', item, '2026-09-29')).toBe(true)
    s = toggleCheck(s, 'a', '2026-09-29', item.id) // Tuesday
    for (const d of ['2026-09-29', '2026-10-01', '2026-10-04']) {
      expect(weeklyDone(s, 'a', item.id, d)).toBe(true)
      expect(isDueThisWeek(s, 'a', item, d)).toBe(false)
    }
    // Monday before the check: not done yet that week.
    expect(weeklyDone(s, 'a', item.id, '2026-09-28')).toBe(false)
    // Next Monday it's due again.
    expect(isDueThisWeek(s, 'a', item, '2026-10-05')).toBe(true)
    expect(weeklyDue(s, 'a', '2026-10-05').map((i) => i.id)).toEqual([item.id])
    expect(weeklyDue(s, 'a', '2026-10-01')).toEqual([])
    // A daily item is never "due this week".
    expect(isDueThisWeek(s, 'a', walk(s), '2026-10-01')).toBe(false)
  })

  it('un-checks a weekly check-in for the whole week from any day', () => {
    let s = withCadence()
    const id = noDrink(s).id
    s = toggleWeekly(s, 'a', '2026-09-29', id)
    expect(weeklyDone(s, 'a', id, '2026-10-02')).toBe(true)
    // Tapping the (done) row again on Friday clears Tuesday's check-in.
    s = toggleWeekly(s, 'a', '2026-10-02', id)
    expect(weeklyDone(s, 'a', id, '2026-10-02')).toBe(false)
    expect(s.checkLog['2026-09-29']?.a).toEqual([])
    // A daily item toggles just that day.
    s = toggleWeekly(s, 'a', '2026-10-02', walk(s).id)
    expect(s.checkLog['2026-10-02']?.a).toEqual([walk(s).id])
  })

  it('leaves weekly check-ins out of daily progress and the week count', () => {
    let s = withCadence()
    expect(progress(s, 'a', '2026-09-29')).toEqual({ done: 0, total: 1, complete: false })
    s = toggleCheck(s, 'a', '2026-09-29', walk(s).id)
    expect(progress(s, 'a', '2026-09-29')).toEqual({ done: 1, total: 1, complete: true })
    // Checking in the weekly item doesn't change the day.
    s = toggleCheck(s, 'a', '2026-09-30', noDrink(s).id)
    expect(progress(s, 'a', '2026-09-30').complete).toBe(false)
    expect(streak(s, 'a', '2026-09-30')).toBe(1)
  })

  it('shows "이번 주 N/7" instead of a streak that breaks on one missed day', () => {
    let s = withCadence()
    // Mon, Tue, Thu done — Wed missed.
    for (const d of ['2026-09-28', '2026-09-29', '2026-10-01']) s = toggleCheck(s, 'a', d, walk(s).id)
    expect(weekCount(s, 'a', '2026-10-01')).toBe(3)
    expect(weekCountLabel(weekCount(s, 'a', '2026-10-01'))).toBe('이번 주 3/7')
    expect(streak(s, 'a', '2026-10-01')).toBe(1) // the old streak would say 1
    // Days after `today` don't count; a new week starts from zero.
    expect(weekCount(s, 'a', '2026-09-28')).toBe(1)
    expect(weekCount(s, 'a', '2026-10-05')).toBe(0)
    // The week before is its own week.
    s = toggleCheck(s, 'a', '2026-09-27', walk(s).id)
    expect(weekCount(s, 'a', '2026-10-01')).toBe(3)
    // Both: only the days both finished.
    s = toggleCheck(s, 'b', '2026-09-29', folic(s).id)
    s = toggleCheck(s, 'b', '2026-09-30', folic(s).id)
    expect(coupleWeekCount(s, '2026-10-01')).toBe(1)
  })

  it('never points a 콕 at a weekly check-in', () => {
    let s = withCadence()
    // Weekly item first in the list: still skipped.
    s = { ...s, checkItems: [noDrink(s), ...s.checkItems.filter((i) => i.label !== '금주')] }
    expect(nudgeableItem(s, 'a', '2026-09-29')?.label).toBe('걷기 30분')
    s = toggleCheck(s, 'a', '2026-09-29', walk(s).id)
    // Only the weekly check-in is left: nothing to nudge about.
    expect(nudgeableItem(s, 'a', '2026-09-29')).toBeUndefined()
  })

  it('stores a cadence only when weekly and edits it', () => {
    let s = withCadence()
    expect('cadence' in walk(s)).toBe(false)
    s = updateCheckItem(s, walk(s).id, { cadence: 'weekly' })
    expect(walk(s).cadence).toBe('weekly')
    s = updateCheckItem(s, walk(s).id, { cadence: 'daily' })
    expect('cadence' in walk(s)).toBe(false)
  })

  it('finds the first check among several items', () => {
    let s = withCadence()
    const ids = [walk(s).id, noDrink(s).id]
    expect(firstCheckOf(s, 'a', ids)).toBeUndefined()
    s = toggleCheck(s, 'a', '2026-09-20', noDrink(s).id)
    s = toggleCheck(s, 'a', '2026-09-10', walk(s).id)
    expect(firstCheckOf(s, 'a', ids)).toBe('2026-09-10')
    expect(firstCheckOf(s, 'a', [])).toBeUndefined()
  })
})

// ── Starter items from the partner's answers (N7) ───────────

const members = (partnerRole: Member['role'] = 'husband'): [Member, Member] => [
  { id: 'a', name: '민수', role: partnerRole, tracksCycle: false, emoji: '👨' },
  { id: 'b', name: '지은', role: 'wife', tracksCycle: true, emoji: '👩' },
]
const NONE: HabitAnswers = { smokes: false, drinks: 'rarely', exercises: false, takesSupplements: false }

describe('starter check items', () => {
  const of = (list: ReturnType<typeof defaultCheckItems>, owner: 'a' | 'b') => list.filter((i) => i.owner === owner)

  it('gives the cycle owner 엽산 daily (+ optional 비타민 D)', () => {
    const owner = of(defaultCheckItems(members(), '2026-09-28', NONE), 'b')
    expect(owner.map((i) => [i.label, i.cadence ?? 'daily', i.note])).toEqual([
      ['엽산', 'daily', '400µg'],
      ['비타민 D', 'daily', '선택'],
    ])
  })

  it('gives a non-smoker who rarely drinks one daily row and only the sauna check-in', () => {
    const p = of(defaultCheckItems(members(), '2026-09-28', NONE), 'a')
    expect(p.map((i) => i.label)).toEqual(['걷기 30분', '사우나·뜨거운 탕 쉬기'])
    expect(p.find((i) => i.label.includes('사우나'))?.cadence).toBe('weekly')
    expect(p.some((i) => i.label.includes('금연') || i.label.includes('담배'))).toBe(false)
    expect(p.some((i) => i.label.includes('금주') || i.label.includes('술'))).toBe(false)
  })

  it('adds 금연 / 금주 as weekly check-ins only for smokers / drinkers', () => {
    const p = of(defaultCheckItems(members(), '2026-09-28', { ...NONE, smokes: true, drinks: 'often' }), 'a')
    const weekly = p.filter((i) => i.cadence === 'weekly').map((i) => i.label)
    expect(weekly).toEqual(['금연', '금주', '사우나·뜨거운 탕 쉬기'])
    expect(of(defaultCheckItems(members(), '2026-09-28', { ...NONE, drinks: 'sometimes' }), 'a').some((i) => i.label === '금주')).toBe(true)
  })

  it('keeps the daily list to 1–2 rows and never adds a men’s zinc/folate pill', () => {
    for (const smokes of [true, false])
      for (const drinks of ['rarely', 'sometimes', 'often'] as const)
        for (const exercises of [true, false])
          for (const takesSupplements of [true, false]) {
            const p = of(defaultCheckItems(members(), '2026-09-28', { smokes, drinks, exercises, takesSupplements }), 'a')
            const daily = p.filter((i) => i.cadence !== 'weekly')
            expect(daily.length).toBeGreaterThanOrEqual(1)
            expect(daily.length).toBeLessThanOrEqual(2)
            expect(p.some((i) => /아연|엽산/.test(i.label))).toBe(false)
          }
    const already = of(defaultCheckItems(members(), '2026-09-28', { ...NONE, exercises: true, takesSupplements: true }), 'a')
    expect(already.filter((i) => i.cadence !== 'weekly').map((i) => i.label)).toEqual(['운동 30분', '먹던 영양제'])
  })

  it('skips the sauna check-in for a partner who is 아내', () => {
    const p = of(defaultCheckItems(members('wife'), '2026-09-28', { ...NONE, smokes: true }), 'a')
    expect(p.map((i) => i.label)).toEqual(['걷기 30분', '금연'])
  })

  it('keeps the original list when nobody was asked', () => {
    const p = of(defaultCheckItems(members(), '2026-09-28'), 'a')
    expect(p.map((i) => i.label)).toEqual(['사우나·뜨거운 탕 피하기', '담배 안 피우기', '술 안 마시기', '30분 걷기·운동'])
    expect(p.every((i) => i.cadence === undefined)).toBe(true)
  })

  it('builds the list from answers through createInitialState too', () => {
    const s = createInitialState(
      {
        me: { name: '민수', role: 'husband' },
        partner: { name: '지은', role: 'wife' },
        cycleOwner: 'b',
        habits: { ...NONE, smokes: true },
      },
      new Date(2026, 8, 28, 9),
    )
    expect(activeItems(s, 'a').map((i) => i.label)).toEqual(['걷기 30분', '금연', '사우나·뜨거운 탕 쉬기'])
    expect(s.settings.shareLevel).toBe('week')
  })
})

describe('onboarding extras', () => {
  const base = (cycleOwner: 'a' | 'b') =>
    createInitialState(
      {
        me: { name: cycleOwner === 'a' ? '지은' : '민수', role: cycleOwner === 'a' ? 'wife' : 'husband' },
        partner: { name: cycleOwner === 'a' ? '민수' : '지은', role: cycleOwner === 'a' ? 'husband' : 'wife' },
        cycleOwner,
      },
      new Date(2026, 8, 28, 9),
    )

  it('rebuilds the starter list from the habit answers', () => {
    const s = applyOnboardingExtras(base('a'), { habits: { ...NONE, drinks: 'often' } }, '2026-09-28')
    expect(activeItems(s, 'b').map((i) => i.label)).toEqual(['걷기 30분', '금주', '사우나·뜨거운 탕 쉬기'])
    expect(activeItems(s, 'a').map((i) => i.label)).toEqual(['엽산', '비타민 D'])
    expect(s.checkItems.every((i) => i.createdAt === '2026-09-28')).toBe(true)
  })

  it('lets only the cycle owner share the cycle details (우리의 주간 by default, N23)', () => {
    expect(applyOnboardingExtras(base('a'), {}, '2026-09-28').settings.shareLevel).toBe('week')
    expect(applyOnboardingExtras(base('a'), { shareLevel: 'details' }, '2026-09-28').settings.shareLevel).toBe('details')
    expect(applyOnboardingExtras(base('a'), { shareLevel: 'none' }, '2026-09-28').settings.shareLevel).toBe('none')
    // The person onboarding isn't the cycle owner: the owner decides later.
    expect(applyOnboardingExtras(base('b'), { shareLevel: 'details' }, '2026-09-28').settings.shareLevel).toBe('week')
  })

  it('saves 부담 없이 / 잠금화면 숨김 for the person onboarding only', () => {
    const s = applyOnboardingExtras(base('a'), { myPrefs: { lowPressure: true, discreet: true } }, '2026-09-28')
    expect(s.settings.personal).toEqual({ a: { lowPressure: true, discreet: true } })
    expect(s.settings.lowPressure).toBe(false)
    expect(s.settings.discreet).toBe(false)
    expect(applyOnboardingExtras(base('a'), {}, '2026-09-28').settings.personal).toBeUndefined()
  })
})

describe('pregnancy', () => {
  it('uses Naegele’s rule and counts weeks', () => {
    const p = { lmp: '2026-09-01', confirmedAt: '2026-10-05' }
    expect(dueDate(p)).toBe('2027-06-08')
    const ga = gestationalAge(p, '2026-10-20')
    expect(ga).toMatchObject({ weeks: 7, days: 0, trimester: 1 })
    expect(formatGA(gestationalAge(p, '2026-10-23'))).toBe('7주 3일')
    expect(gestationalAge(p, '2027-06-08')).toMatchObject({ weeks: 40, days: 0, daysToDue: 0, progress: 1 })
  })

  it('lets a doctor-given due date override the LMP date', () => {
    const p = { lmp: '2026-09-01', dueDateOverride: '2027-06-15', confirmedAt: '2026-10-05' }
    expect(gestationalAge(p, '2026-10-20').weeks).toBe(6)
  })

  it('transitions stage', () => {
    const s = startPregnancy(fresh(), '2026-09-01', '2026-10-05')
    expect(s.stage).toBe('pregnant')
    expect(s.pregnancy?.lmp).toBe('2026-09-01')
  })
})

describe('baby', () => {
  it('counts Korean-style day of life and 백일', () => {
    expect(dayOfLife('2026-01-01', '2026-01-01')).toBe(1)
    const days = koreanDays('2026-01-01')
    expect(days.find((d) => d.key === 'day100')!.date).toBe('2026-04-10')
    expect(dayOfLife('2026-01-01', '2026-04-10')).toBe(100)
    expect(days.find((d) => d.key === 'year1')!.date).toBe('2027-01-01')
    expect(nextKoreanDay('2026-01-01', '2026-04-11')!.key).toBe('day200')
  })

  it('formats age', () => {
    expect(formatBabyAge(babyAge('2026-01-31', '2026-02-27'))).toBe('생후 27일')
    expect(babyAge('2026-01-31', '2026-02-28').months).toBe(1)
    expect(formatBabyAge(babyAge('2025-01-15', '2027-03-20'))).toBe('2살 2개월')
  })
})

describe('notifications', () => {
  it('respects each member’s alert style', () => {
    const s0 = fresh()
    expect(s0.settings.alertStyle).toEqual({ a: 'soft', b: 'explicit' }) // b tracks the cycle
    const n = scheduledNotices(s0, '2026-09-14')
    const toA = n.filter((x) => x.to === 'a')
    const toB = n.filter((x) => x.to === 'b')
    expect(toA.map((x) => x.kind)).toEqual(['fertile-start']) // soft: one gentle notice, no peak
    expect(toA[0]!.title).not.toMatch(/가임|가능성/)
    // One logged start = settings only (confidence 'low', N12): the owner gets the
    // wide-range heads-up but no 🌟 peak days — the calendar alone can't name them.
    expect(toB.map((x) => x.kind)).toEqual(['fertile-start'])
    expect(toB[0]!.body).toMatch(/넓음/)
    // Three regular logged cycles (confidence 'cycles'): the explicit owner also hears the peak days, the soft partner still doesn't.
    const regular = fresh({ periods: [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }] })
    const r = scheduledNotices(regular, '2026-09-14')
    expect(r.filter((x) => x.to === 'b').map((x) => x.kind).sort()).toEqual(['fertile-start', 'peak'])
    expect(r.filter((x) => x.to === 'a').map((x) => x.kind)).toEqual(['fertile-start'])
    const off = fresh({ settings: { ...s0.settings, alertStyle: { a: 'off', b: 'explicit' } } })
    expect(scheduledNotices(off, '2026-09-14').some((x) => x.to === 'a')).toBe(false)
  })

  it('sends fertile-window notices to both members once', () => {
    let s = fresh()
    const n = scheduledNotices(s, '2026-09-09') // day before fertile window (Sep 10)
    const fertile = n.filter((x) => x.kind === 'fertile-start')
    expect(fertile.map((x) => x.to).sort()).toEqual(['a', 'b'])
    const r = mergeNotices(s, n, '2026-09-09T09:00:00+09:00')
    s = r.state
    expect(r.added.length).toBe(n.length)
    expect(mergeNotices(s, scheduledNotices(s, '2026-09-10'), '2026-09-10T09:00:00+09:00').added.filter((x) => x.kind === 'fertile-start')).toHaveLength(0)
  })

  // The expected period is a range (N10): from a 9/1 start with the 28-day
  // setting it is 9/27–10/1, so the "내일부터" heads-up goes out on 9/26 and
  // "지났어요" from 10/2 — never on a day inside the range.
  it('sends no fertile-day alerts in low-pressure mode but still tells the owner about her period', () => {
    const s = fresh({ settings: { ...fresh().settings, lowPressure: true } })
    expect(scheduledNotices(s, '2026-09-14').some((x) => x.kind === 'peak' || x.kind === 'fertile-start')).toBe(false)
    expect(scheduledNotices(s, '2026-09-26').some((x) => x.kind === 'period-due' && x.to === 'b')).toBe(true)
    expect(scheduledNotices(s, '2026-09-28').some((x) => x.kind === 'period-due')).toBe(false)
  })

  it('only tells the cycle owner about period timing', () => {
    const n = scheduledNotices(fresh(), '2026-09-26')
    const due = n.filter((x) => x.kind === 'period-due')
    expect(due.map((x) => x.to)).toEqual(['b'])
    expect(due[0]!.title).toMatch(/내일부터/)
    expect(scheduledNotices(fresh(), '2026-10-02').filter((x) => x.kind === 'period-due').map((x) => x.to)).toEqual(['b'])
  })

  it('suppresses fertile notices when the period is late', () => {
    const n = scheduledNotices(fresh(), '2026-10-03')
    expect(n.some((x) => x.kind === 'fertile-start' || x.kind === 'peak')).toBe(false)
    expect(n.find((x) => x.kind === 'period-due')!.to).toBe('b')
  })

  it('suggests a doctor after the ASRM threshold', () => {
    expect(doctorThresholdMonths(30)).toBe(12)
    expect(doctorThresholdMonths(36)).toBe(6)
    expect(doctorThresholdMonths(41)).toBe(0)
    const s = fresh({ settings: { ...fresh().settings, ttcStart: '2025-08-01' } })
    expect(scheduledNotices(s, '2026-09-20').some((x) => x.kind === 'doctor')).toBe(true)
    expect(scheduledNotices(fresh(), '2026-09-20').some((x) => x.kind === 'doctor')).toBe(false)
  })

  it('rate-limits nudges and supports read/clear', () => {
    let s = fresh()
    for (let i = 0; i < NUDGES_PER_DAY + 2; i++) s = sendNudge(s, 'a', 'b', '2026-09-02', `2026-09-02T10:0${i}:00+09:00`, '엽산')
    expect(inbox(s, 'b')).toHaveLength(NUDGES_PER_DAY)
    s = markRead(s, 'b')
    expect(inbox(s, 'b').every((n) => n.read)).toBe(true)
    s = mergeNotices(s, scheduledNotices(s, '2026-09-10'), '2026-09-10T09:00:00+09:00').state
    s = clearNotifications(s, 'b')
    expect(inbox(s, 'b')).toHaveLength(0)
    // Cleared generated notices are not delivered again.
    expect(mergeNotices(s, scheduledNotices(s, '2026-09-10'), 'x').added.filter((n) => n.to === 'b')).toHaveLength(0)
  })

  it('notifies about 백일 a week ahead and on the day', () => {
    const s = fresh({ stage: 'parenting', baby: { name: '콩이', birthDate: '2026-01-01', sex: 'unknown' } })
    expect(scheduledNotices(s, '2026-04-03').some((n) => n.title.includes('백일'))).toBe(true)
    expect(scheduledNotices(s, '2026-04-10').some((n) => n.title.includes('오늘은 콩이의 백일'))).toBe(true)
    expect(scheduledNotices(s, '2026-04-05').some((n) => n.title.includes('백일'))).toBe(false)
  })
})

describe('ics', () => {
  it('builds all-day events with exclusive DTEND and alarms', () => {
    const ics = buildIcs(
      [{ uid: 'x@dulset', start: '2026-09-10', end: '2026-09-16', title: '우리의 주간, 둘만의 시간', alarmMinutesBefore: 60 }],
      new Date(Date.UTC(2026, 8, 1, 0, 0, 0)),
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20260910')
    expect(ics).toContain('DTEND;VALUE=DATE:20260917')
    expect(ics).toContain('SUMMARY:우리의 주간\\, 둘만의 시간')
    expect(ics).toContain('TRIGGER:-PT60M')
    expect(ics).toContain('DTSTAMP:20260901T000000Z')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('folds long UTF-8 lines under 75 octets', () => {
    const line = `DESCRIPTION:${'가'.repeat(60)}`
    const folded = foldLine(line)
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line)
  })
})
