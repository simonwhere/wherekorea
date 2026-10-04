import { describe, expect, it } from 'vitest'
import {
  SUGGESTIONS,
  availableSuggestions,
  infoNotes,
  isSuggestionAdded,
  normalizeLabel,
  suggestionsForRole,
} from '@/lib/content/supplements'
import {
  DRINK_LABELS,
  activeItems,
  addCheckItem,
  archiveCheckItem,
  checkInLabel,
  restoreWeekly,
  toggleCheck,
  toggleWeekly,
  toggleWeeklyUndoable,
  weeklyCheckInName,
  weeklyDone,
} from '@/lib/logic/checks'
import { DRINK_CHECK_LABELS } from '@/lib/initial'
import { fertilityStatus } from '@/lib/logic/cycle'
import { NUDGES_PER_DAY, inbox, nudgesSentToday, sendNudge } from '@/lib/logic/notifications'
import { fertilityView } from '@/lib/logic/calendarView'
import {
  FOLIC_GOAL_DAYS,
  LMP_MAX_DAYS,
  SPERM_GOAL_DAYS,
  SPERM_GOAL_TEXT,
  TIMER_BREAK_DAYS,
  confirmPregnancy,
  currentRun,
  dayCount,
  doctorAdvice,
  endPregnancy,
  fertilityVoice,
  firstUnchecked,
  folicTimer,
  greetingFor,
  groupByDay,
  habitTimer,
  isSpermSide,
  isValidLmp,
  lastPeriodStart,
  laterOf,
  noticeTarget,
  nowOn,
  relativeTimeKo,
  rowProgress,
  showDateTeaser,
  splitTitleIcon,
  stampOn,
  toggleWithCompletion,
} from '@/lib/logic/today'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { QUIET_DAYS_AFTER_END, startPregnancy } from '@/lib/logic/pregnancy'
import { activeRest } from '@/lib/logic/ttc'
import type { AppState } from '@/lib/types'

// 'a' = 민수 (does not track the cycle), 'b' = 지은 (tracks the cycle).
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

describe('greeting', () => {
  it('picks morning / afternoon / evening', () => {
    expect(greetingFor(7)).toBe('좋은 아침이에요')
    expect(greetingFor(13)).toBe('좋은 오후예요')
    expect(greetingFor(21)).toBe('좋은 저녁이에요')
    expect(greetingFor(2)).toBe('좋은 저녁이에요')
  })
})

describe('fertility voice', () => {
  const base = { lowPressure: false, alertStyle: { a: 'soft', b: 'explicit' } as const }

  it('is explicit for the cycle owner and soft for a soft partner', () => {
    expect(fertilityVoice(base, 'b', true)).toBe('explicit')
    expect(fertilityVoice(base, 'a', false)).toBe('soft')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'explicit', b: 'explicit' } }, 'a', false)).toBe('explicit')
  })

  it("respects an owner who chose the soft wording (same rule as the calendar)", () => {
    const soft = { lowPressure: false, alertStyle: { a: 'soft', b: 'soft' } as const }
    expect(fertilityVoice(soft, 'b', true)).toBe('soft')
    expect(fertilityView(soft, 'b', 'b')).toBe('soft')
    // Nothing stored: the owner defaults to explicit, the partner to soft.
    const none = { lowPressure: false, alertStyle: undefined as never }
    expect(fertilityVoice(none, 'b', true)).toBe('explicit')
    expect(fertilityVoice(none, 'a', false)).toBe('soft')
  })

  it('reads each person’s own low-pressure choice', () => {
    const personal = { ...base, personal: { a: { lowPressure: true } } }
    expect(fertilityVoice(personal, 'a', false)).toBe('calm')
    expect(fertilityVoice(personal, 'b', true)).toBe('explicit')
    // A personal "off" overrides a couple-wide leftover.
    expect(fertilityVoice({ ...base, lowPressure: true, personal: { b: { lowPressure: false } } }, 'b', true)).toBe('explicit')
  })

  it('goes calm with low-pressure mode or alerts off — even for the owner', () => {
    expect(fertilityVoice({ ...base, lowPressure: true }, 'b', true)).toBe('calm')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'off', b: 'explicit' } }, 'a', false)).toBe('calm')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'soft', b: 'off' } }, 'b', true)).toBe('calm')
  })

  it('shows the date teaser only near the window and never when calm', () => {
    const s = fresh()
    const fertile = fertilityStatus(s, '2026-09-12')
    expect(fertile.kind).toBe('fertile')
    expect(showDateTeaser(fertile, 'soft')).toBe(true)
    expect(showDateTeaser(fertile, 'calm')).toBe(false)
    const early = fertilityStatus(s, '2026-09-06')
    expect(early).toMatchObject({ kind: 'before-fertile', daysUntil: 4 })
    expect(showDateTeaser(early, 'explicit')).toBe(false)
    expect(showDateTeaser(fertilityStatus(s, '2026-09-07'), 'explicit')).toBe(true)
  })
})

describe('checks on the home screen', () => {
  it('notifies the partner exactly when the list is completed', () => {
    let s = fresh()
    const items = activeItems(s, 'a')
    const day = '2026-09-02'
    const now = '2026-09-02T09:00:00+09:00'
    for (const [i, item] of items.entries()) {
      const r = toggleWithCompletion(s, 'a', 'b', day, item.id, now)
      s = r.state
      expect(r.completed).toBe(i === items.length - 1)
    }
    expect(rowProgress(s, 'a', day)).toEqual({ done: items.length, total: items.length, complete: true })
    const done = inbox(s, 'b').filter((n) => n.kind === 'cheer')
    expect(done).toHaveLength(1)
    expect(done[0]!.title).toContain('민수')
    // Un-check and re-check: still only one notice that day.
    s = toggleWithCompletion(s, 'a', 'b', day, items[0]!.id, now).state
    const again = toggleWithCompletion(s, 'a', 'b', day, items[0]!.id, now)
    expect(again.completed).toBe(true)
    expect(inbox(again.state, 'b').filter((n) => n.kind === 'cheer')).toHaveLength(1)
  })

  it('finds the first unchecked item for a nudge', () => {
    // Her starter list is 엽산 only since N29; add a second row of her own.
    let s = addCheckItem(fresh(), 'b', '비타민 D', 'supplement', '2026-09-01')
    const [first, second] = activeItems(s, 'b')
    expect(second).toBeDefined()
    expect(firstUnchecked(s, 'b', '2026-09-02')?.id).toBe(first!.id)
    s = toggleCheck(s, 'b', '2026-09-02', first!.id)
    expect(firstUnchecked(s, 'b', '2026-09-02')?.id).toBe(second!.id)
    s = toggleCheck(s, 'b', '2026-09-02', second!.id)
    expect(firstUnchecked(s, 'b', '2026-09-02')).toBeUndefined()
  })

  it('leaves weekly check-ins out of the day: no completion, no 콕', () => {
    let s = fresh({ checkItems: [] })
    s = addCheckItem(s, 'a', '금연', 'habit', '2026-09-01', '주 1회 체크인', 'weekly')
    s = addCheckItem(s, 'a', '걷기 30분', 'habit', '2026-09-01')
    const [weekly, walk] = activeItems(s, 'a')
    const day = '2026-09-02'
    const now = '2026-09-02T09:00:00+09:00'
    expect(firstUnchecked(s, 'a', day)?.id).toBe(walk!.id)
    expect(rowProgress(s, 'a', day)).toEqual({ done: 0, total: 1, complete: false })
    // The weekly check-in alone never "finishes the day" or tells the partner.
    let r = toggleWithCompletion(s, 'a', 'b', day, weekly!.id, now)
    expect(r.completed).toBe(false)
    expect(rowProgress(r.state, 'a', day).complete).toBe(false)
    expect(inbox(r.state, 'b')).toHaveLength(0)
    // The daily row does.
    r = toggleWithCompletion(r.state, 'a', 'b', day, walk!.id, now)
    expect(r.completed).toBe(true)
    expect(firstUnchecked(r.state, 'a', day)).toBeUndefined()
    // Tapping the done weekly row later that week clears the week's check-in…
    const undoable = toggleWithCompletion(r.state, 'a', 'b', '2026-09-04', weekly!.id, now)
    const cleared = undoable.state
    expect(cleared.checkLog[day]?.a).toEqual([walk!.id])
    // …and says which days, so 되돌리기 can put it back exactly (N24).
    expect(undoable.cleared).toEqual([day])
    const restored = restoreWeekly(cleared, 'a', weekly!.id, undoable.cleared!)
    expect([...(restored.checkLog[day]?.a ?? [])].sort()).toEqual([...(r.state.checkLog[day]?.a ?? [])].sort())
    expect(weeklyDone(restored, 'a', weekly!.id, '2026-09-04')).toBe(true)
    // Checking in reports nothing to undo.
    expect(toggleWithCompletion(s, 'a', 'b', day, weekly!.id, now).cleared).toBeUndefined()
  })
})

describe("weekly check-ins ask about the week (N24): '술 쉬기 · 이번 주 지켰어요?'", () => {
  it('the row reads as a question; the stored label and the id stay', () => {
    expect(checkInLabel({ label: '금주', cadence: 'weekly' })).toBe('술 쉬기 · 이번 주 지켰어요?')
    expect(checkInLabel({ label: '술 안 마시기', cadence: 'weekly' })).toBe('술 쉬기 · 이번 주 지켰어요?')
    expect(checkInLabel({ label: '술 쉬기', cadence: 'weekly' })).toBe('술 쉬기 · 이번 주 지켰어요?')
    expect(checkInLabel({ label: '금연', cadence: 'weekly' })).toBe('금연 · 이번 주 지켰어요?')
    expect(checkInLabel({ label: '사우나·뜨거운 탕 쉬기', cadence: 'weekly' })).toBe('사우나·뜨거운 탕 쉬기 · 이번 주 지켰어요?')
    // A daily item keeps its own label.
    expect(checkInLabel({ label: '금주' })).toBe('금주')
    expect(weeklyCheckInName({ label: ' 금주 ' })).toBe('술 쉬기')
    // The labels that mean 'keep not drinking' are the starter list's (lib/initial.ts).
    expect([...DRINK_LABELS].sort()).toEqual([...DRINK_CHECK_LABELS].sort())
    // The starter list's weekly 금주 row reads the new way, with its id untouched.
    let s = fresh({ checkItems: [] })
    s = addCheckItem(s, 'a', '금주', 'habit', '2026-09-01', '주 1회 체크인', 'weekly')
    const [row] = activeItems(s, 'a')
    expect(row!.label).toBe('금주')
    expect(checkInLabel(row!)).toBe('술 쉬기 · 이번 주 지켰어요?')
    expect(checkInLabel(row!)).not.toMatch(/숙제|실패|노력|오늘 꼭/)
  })

  it('taking a check-in back clears every day of this week it was on, and 되돌리기 restores exactly those', () => {
    let s = fresh({ checkItems: [] })
    s = addCheckItem(s, 'a', '금주', 'habit', '2026-09-01', '주 1회 체크인', 'weekly')
    const [row] = activeItems(s, 'a')
    // Checked on Monday and (a stray second tap from the link) on Wednesday of the same week.
    s = toggleCheck(toggleCheck(s, 'a', '2026-08-31', row!.id), 'a', '2026-09-02', row!.id)
    const t = toggleWeeklyUndoable(s, 'a', '2026-09-03', row!.id)
    expect(t.cleared).toEqual(['2026-08-31', '2026-09-02'])
    expect(weeklyDone(t.state, 'a', row!.id, '2026-09-03')).toBe(false)
    expect(restoreWeekly(t.state, 'a', row!.id, t.cleared)).toEqual(s)
    // Restoring twice changes nothing more; nothing to restore → the same object.
    const back = restoreWeekly(t.state, 'a', row!.id, t.cleared)
    expect(restoreWeekly(back, 'a', row!.id, t.cleared)).toBe(back)
    expect(restoreWeekly(s, 'a', row!.id, [])).toBe(s)
    // toggleWeekly is the same tap without the payload.
    expect(toggleWeekly(s, 'a', '2026-09-03', row!.id)).toEqual(t.state)
    // A daily item: an ordinary toggle, nothing to undo.
    s = addCheckItem(s, 'a', '걷기 30분', 'habit', '2026-09-01')
    const walk = activeItems(s, 'a').find((i) => i.label === '걷기 30분')!
    expect(toggleWeeklyUndoable(s, 'a', '2026-09-03', walk.id).cleared).toEqual([])
  })
})

describe('clock anchored to today', () => {
  it('keeps the device time but uses the app date', () => {
    const d = nowOn('2026-10-01', new Date(2026, 8, 26, 9, 5, 7))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2026, 9, 1, 9, 5, 7,
    ])
    expect(stampOn('2026-10-01', new Date(2026, 8, 26, 9, 5, 7))).toMatch(/^2026-10-01T09:05:07[+-]\d{2}:\d{2}$/)
    // Same day → identical to the plain clock.
    expect(stampOn('2026-09-26', new Date(2026, 8, 26, 23, 59, 0)).slice(0, 19)).toBe('2026-09-26T23:59:00')
  })

  it('makes the 3-a-day 콕 limit and 오늘 grouping work on a pinned date', () => {
    let s = fresh()
    const pinned = '2026-10-01'
    const realClock = new Date(2026, 8, 26, 9, 0)
    for (let i = 0; i < NUDGES_PER_DAY + 1; i++) s = sendNudge(s, 'a', 'b', pinned, stampOn(pinned, realClock), '엽산')
    expect(nudgesSentToday(s, 'a', pinned)).toBe(NUDGES_PER_DAY)
    expect(groupByDay(inbox(s, 'b'), pinned).today).toHaveLength(NUDGES_PER_DAY)
  })
})

describe('habit timers', () => {
  it('counts Korean-style from the start day', () => {
    expect(dayCount('2026-09-01', '2026-09-01')).toBe(1)
    expect(dayCount('2026-09-01', '2026-09-10')).toBe(10)
    expect(dayCount('2026-09-11', '2026-09-10')).toBeUndefined()
    expect(dayCount(undefined, '2026-09-10')).toBeUndefined()
    expect(laterOf('2026-09-01', '2026-09-05')).toBe('2026-09-05')
    expect(laterOf(undefined, '2026-09-05')).toBe('2026-09-05')
    expect(laterOf('2026-09-01', undefined)).toBe('2026-09-01')
  })

  it('is "시작 전" until a habit is checked — never counting from ttcStart', () => {
    const s = fresh() // ttcStart 2026-09-01, nothing checked
    const t = habitTimer(s, 'a', '2026-12-31')
    expect(t).toMatchObject({ state: 'not-started', label: '시작 전', progress: 0, goal: SPERM_GOAL_DAYS })
    expect(t.day).toBeUndefined()
    expect(t.start).toBeUndefined()
    expect(t.note).toContain('시작 전')
  })

  it('counts from the first check of any habit item, in 약 3개월 (not "74일 채움")', () => {
    let s = fresh()
    const habits = activeItems(s, 'a').filter((i) => i.kind === 'habit')
    // The *second* habit was checked first: it still starts the clock.
    s = toggleCheck(s, 'a', '2026-09-07', habits[1]!.id)
    s = toggleCheck(s, 'a', '2026-09-10', habits[0]!.id)
    const t = habitTimer(s, 'a', '2026-09-16')
    expect(t).toMatchObject({ state: 'running', start: '2026-09-07', day: 10, label: 'D+10', goal: SPERM_GOAL_DAYS })
    expect(t.progress).toBeCloseTo(10 / SPERM_GOAL_DAYS)
    expect(t.goalText).toBe(SPERM_GOAL_TEXT)
    expect(SPERM_GOAL_TEXT).toBe('약 3개월(64~74일 + 성숙 1~2주)')
    expect(t.note).toContain('64~74일')
    expect(`${t.goalText} ${t.note}`).not.toMatch(/74일 채|한 바퀴/)
    // About 3 months of weekly check-ins later the span has passed.
    for (let d = '2026-09-17'; d <= '2026-12-31'; d = addDays(d, 7)) s = toggleCheck(s, 'a', d, habits[0]!.id)
    const done = habitTimer(s, 'a', '2026-12-31')
    expect(done).toMatchObject({ state: 'reached', start: '2026-09-07', progress: 1 })
    expect(done.note).toContain('약 3개월')
  })

  it('never says "이어 왔어요" about one tap months ago: a long gap stops the count', () => {
    let s = fresh()
    const habit = activeItems(s, 'a').find((i) => i.kind === 'habit')!
    s = toggleCheck(s, 'a', '2026-09-07', habit.id)
    // Still counting within 4 weeks of the last check…
    expect(habitTimer(s, 'a', addDays('2026-09-07', TIMER_BREAK_DAYS))).toMatchObject({ state: 'running', start: '2026-09-07' })
    // …then it stops, gently, instead of running on to 'reached'.
    const stopped = habitTimer(s, 'a', '2026-12-31')
    expect(stopped).toMatchObject({ state: 'not-started', label: '다시 시작 전', lastCheck: '2026-09-07', progress: 0 })
    expect(stopped.day).toBeUndefined()
    expect(stopped.note).toContain('다시 체크한 날부터')
    expect(stopped.note).not.toMatch(/실패|노력|숙제/)
    // The next check starts a new count from that day.
    s = toggleCheck(s, 'a', '2026-12-20', habit.id)
    expect(habitTimer(s, 'a', '2026-12-31')).toMatchObject({ state: 'running', start: '2026-12-20', day: 12 })
  })

  it('keeps one run through the gaps of weekly check-ins, and ignores future days', () => {
    // Monday of one week, Sunday of the next: 13 days apart, still one run.
    expect(currentRun(['2026-09-07', '2026-09-20'], '2026-09-25')).toEqual({ start: '2026-09-07' })
    expect(currentRun(['2026-08-01', '2026-09-20'], '2026-09-25')).toEqual({ start: '2026-09-20' })
    expect(currentRun([], '2026-09-25')).toEqual({})
    // A check logged for a later day doesn't start today's count.
    expect(currentRun(['2026-10-01'], '2026-09-25')).toEqual({})
    let s = fresh()
    const habit = activeItems(s, 'a').find((i) => i.kind === 'habit')!
    s = toggleCheck(s, 'a', '2026-10-01', habit.id)
    expect(habitTimer(s, 'a', '2026-09-25').state).toBe('not-started')
  })

  it('keeps counting from an archived habit’s checks, but not an earlier child’s', () => {
    let s = fresh()
    const habit = activeItems(s, 'a').find((i) => i.kind === 'habit')!
    s = toggleCheck(s, 'a', '2026-09-05', habit.id)
    s = archiveCheckItem(s, habit.id, '2026-09-20')
    expect(habitTimer(s, 'a', '2026-09-30').start).toBe('2026-09-05')
    // Preparing for a second child: checks before the birth don't count.
    const second = { ...s, baby: { name: '콩이', birthDate: '2026-09-10', sex: 'unknown' as const } }
    expect(habitTimer(second, 'a', '2026-09-30').state).toBe('not-started')
  })

  it('ignores supplements for the habit timer', () => {
    let s = fresh()
    s = addCheckItem(s, 'a', '코엔자임Q10', 'supplement', '2026-09-01')
    const pill = activeItems(s, 'a').find((i) => i.label === '코엔자임Q10')!
    s = toggleCheck(s, 'a', '2026-09-03', pill.id)
    expect(habitTimer(s, 'a', '2026-09-10').state).toBe('not-started')
  })

  it('only treats a non-owner who is not 아내 as the sperm side', () => {
    expect(isSpermSide({ tracksCycle: false, role: 'husband' })).toBe(true)
    expect(isSpermSide({ tracksCycle: false, role: 'partner' })).toBe(true)
    expect(isSpermSide({ tracksCycle: false, role: 'wife' })).toBe(false)
    expect(isSpermSide({ tracksCycle: true, role: 'wife' })).toBe(false)
  })

  it('tracks folic acid from its first check', () => {
    let s = fresh()
    expect(folicTimer(s, 'a', '2026-09-10')).toBeNull() // 민수 has no 엽산 item
    const t0 = folicTimer(s, 'b', '2026-09-10')
    expect(t0?.item.label).toBe('엽산')
    expect(t0).toMatchObject({ state: 'not-started', label: '시작 전', progress: 0 })
    expect(t0?.day).toBeUndefined()
    s = toggleCheck(s, 'b', '2026-09-03', t0!.item.id)
    expect(folicTimer(s, 'b', '2026-09-10')).toMatchObject({ state: 'running', day: 8, label: 'D+8', goal: FOLIC_GOAL_DAYS })
    // A single check months ago isn't 3 months of 엽산.
    expect(folicTimer(s, 'b', '2026-12-31')).toMatchObject({ state: 'not-started', label: '다시 시작 전' })
    for (let d = '2026-09-04'; d <= '2026-12-01'; d = addDays(d, 1)) s = toggleCheck(s, 'b', d, t0!.item.id)
    expect(folicTimer(s, 'b', '2026-12-01')).toMatchObject({ state: 'reached', start: '2026-09-03', progress: 1 })
  })
})

describe('doctor advice', () => {
  it('follows the age threshold and irregular cycles', () => {
    expect(doctorAdvice(fresh(), '2026-09-20')).toBeNull()
    const long = fresh({ settings: { ...fresh().settings, ttcStart: '2025-08-01' } })
    expect(doctorAdvice(long, '2026-09-20')?.reasons).toEqual(['months'])
    // 지은 born 1990 → 36 in 2026 → 6 months.
    const older = fresh({
      couple: {
        ...fresh().couple,
        members: [fresh().couple.members[0], { ...fresh().couple.members[1], birthYear: 1990 }],
      },
      settings: { ...fresh().settings, ttcStart: '2026-03-01' },
    })
    expect(doctorAdvice(older, '2026-09-20')).toMatchObject({ reasons: ['months'], threshold: 6 })
    const irregular = fresh({
      periods: [{ start: '2026-05-01' }, { start: '2026-05-23' }, { start: '2026-06-30' }, { start: '2026-07-24' }],
    })
    expect(doctorAdvice(irregular, '2026-08-01')).toMatchObject({ irregularBy: 'variation' })
    expect(doctorAdvice(irregular, '2026-08-01')?.reasons).toContain('irregular')
    // Only an entered 40-day cycle (nothing measured yet): no 🩺 card from a guess.
    const longCycle = fresh({ cycle: { cycleLength: 40, periodLength: 5 } })
    expect(doctorAdvice(longCycle, '2026-09-20')).toBeNull()
    // Two measured 40-day cycles → "short or long", not "varies a lot".
    const measuredLong = fresh({ periods: [{ start: '2026-06-01' }, { start: '2026-07-11' }, { start: '2026-08-20' }] })
    expect(doctorAdvice(measuredLong, '2026-09-01')).toMatchObject({ reasons: ['irregular'], irregularBy: 'length' })
    expect(doctorAdvice(fresh(), '2026-09-20')?.irregularBy).toBeUndefined()
    // 40+ → right away, even on day one.
    const forty = fresh({
      couple: {
        ...fresh().couple,
        members: [fresh().couple.members[0], { ...fresh().couple.members[1], birthYear: 1986 }],
      },
    })
    expect(doctorAdvice(forty, '2026-09-01')).toMatchObject({ reasons: ['age'], threshold: 0 })
    expect(doctorAdvice({ ...long, stage: 'pregnant' }, '2026-09-20')).toBeNull()
  })
})

describe('pregnancy confirmation', () => {
  it('validates the LMP and tells the other member', () => {
    const s = fresh()
    expect(lastPeriodStart(s)).toBe('2026-09-01')
    expect(isValidLmp('2026-09-01', '2026-10-05')).toBe(true)
    expect(isValidLmp('2026-10-06', '2026-10-05')).toBe(false)
    expect(isValidLmp('2025-09-01', '2026-10-05')).toBe(false)
    expect(isValidLmp('2025-12-01', '2026-10-05')).toBe(true) // exactly LMP_MAX_DAYS back
    expect(isValidLmp('2025-11-30', '2026-10-05')).toBe(false)
    // Same 44 weeks as the 임신 tab / 설정 / 예정일 수정 (pregnancyView.validateLmp).
    expect(LMP_MAX_DAYS).toBe(308)
    expect(isValidLmp('nope', '2026-10-05')).toBe(false)
    const next = confirmPregnancy(s, '2026-09-01', '2026-10-05', 'b', 'a', '2026-10-05T08:00:00+09:00')
    expect(next.stage).toBe('pregnant')
    expect(next.pregnancy?.lmp).toBe('2026-09-01')
    const msg = inbox(next, 'a')
    expect(msg).toHaveLength(1)
    expect(msg[0]!.body).toContain('지은')
    expect(inbox(next, 'b')).toHaveLength(0)
  })

  it('settles a positive test awaiting the clinic, so it can’t come back after 준비로 돌아가기', () => {
    const s = fresh({ positivePending: { since: '2026-10-01' } })
    const next = confirmPregnancy(s, '2026-09-01', '2026-10-05', 'b', 'a', '2026-10-05T08:00:00+09:00')
    expect(next.stage).toBe('pregnant')
    expect('positivePending' in next).toBe(false)
    // Blocked (already pregnant): nothing changes.
    expect(confirmPregnancy(next, '2026-09-01', '2026-10-06', 'b', 'a', '2026-10-06T08:00:00+09:00')).toBe(next)
  })
})

describe('inbox helpers', () => {
  it('uses the leading emoji as the icon', () => {
    expect(splitTitleIcon('👉 지은님이 콕 찔렀어요', 'nudge')).toEqual({ icon: '👉', text: '지은님이 콕 찔렀어요' })
    expect(splitTitleIcon('🗓️ 내일이 생리 예정일이에요', 'period-due')).toEqual({
      icon: '🗓️',
      text: '내일이 생리 예정일이에요',
    })
    expect(splitTitleIcon('알림', 'doctor')).toEqual({ icon: '🩺', text: '알림' })
  })

  it('formats relative time', () => {
    const now = Date.parse('2026-09-26T12:00:00+09:00')
    expect(relativeTimeKo('2026-09-26T11:59:30+09:00', now)).toBe('방금')
    expect(relativeTimeKo('2026-09-26T11:55:00+09:00', now)).toBe('5분 전')
    expect(relativeTimeKo('2026-09-26T09:00:00+09:00', now)).toBe('3시간 전')
    expect(relativeTimeKo('2026-09-24T09:00:00+09:00', now)).toBe('2일 전')
    expect(relativeTimeKo('2026-09-03T09:00:00+09:00', now)).toBe('9월 3일')
    expect(relativeTimeKo('garbage', now)).toBe('')
  })

  it('opens only tabs that exist in the current stage', () => {
    expect(noticeTarget('nudge', 'preparing')).toBe('today')
    expect(noticeTarget('cheer', 'parenting')).toBe('today')
    // 우리의 주간 opens the home card (its date ideas live there, not in a 데이트 tab).
    expect(noticeTarget('fertile-start', 'preparing', 'fertile:2026-09-10:a')).toBe('today')
    expect(noticeTarget('fertile-start', 'preparing')).toBe('today')
    expect(noticeTarget('fertile-start', 'pregnant')).toBeNull()
    expect(noticeTarget('peak', 'preparing', 'peak:2026-09-10:b')).toBe('cycle')
    expect(noticeTarget('period-due', 'preparing')).toBe('cycle')
    expect(noticeTarget('peak', 'pregnant')).toBeNull() // no 달력 tab while pregnant
    expect(noticeTarget('milestone', 'pregnant')).toBe('pregnancy')
    expect(noticeTarget('milestone', 'parenting')).toBe('baby')
    expect(noticeTarget('milestone', 'preparing')).toBeNull()
    expect(noticeTarget('milestone', 'pregnant', 'anniv:met-year:5:2026-05-14:0:a')).toBe('diary')
    expect(noticeTarget('system', 'preparing', 'appt:x:2026-09-10:1:a')).toBe('plan')
    expect(noticeTarget('system', 'parenting', 'deadline:birth-report:2026-10-28:7:a')).toBe('plan')
    expect(noticeTarget('system', 'preparing', 'reaction:e1:a')).toBe('diary')
    expect(noticeTarget('date-idea', 'parenting')).toBe('date')
    expect(noticeTarget('doctor', 'preparing')).toBe('today')
    expect(noticeTarget('system', 'preparing')).toBeNull()
  })

  it('opens the partner’s card on 오늘 for what the cycle owner chose to tell', () => {
    expect(noticeTarget('system', 'preparing', 'period-told:2026-09-20')).toBe('today')
    expect(noticeTarget('system', 'preparing', 'positive-told:2026-09-24')).toBe('today')
    // Confirmed at the clinic since: the pregnant home is still 오늘.
    expect(noticeTarget('system', 'pregnant', 'positive-told:2026-09-24')).toBe('today')
  })

  it('groups by the local date prefix', () => {
    const g = groupByDay(
      [{ createdAt: '2026-09-26T08:00:00+09:00' }, { createdAt: '2026-09-25T23:00:00+09:00' }],
      '2026-09-26',
    )
    expect(g.today).toHaveLength(1)
    expect(g.earlier).toHaveLength(1)
  })
})

describe('supplement suggestions', () => {
  it('has the core evidence-backed items', () => {
    const folic = SUGGESTIONS.find((s) => s.id === 'folic-acid')!
    expect(folic).toMatchObject({ evidence: 'strong', audience: 'cycle-owner' })
    expect(SUGGESTIONS.find((s) => s.id === 'male-zinc-folate')).toMatchObject({
      evidence: 'not-recommended',
      infoOnly: true,
    })
    for (const s of SUGGESTIONS) expect(s.source.url).toMatch(/^https?:\/\//)
  })

  it('filters by who tracks the cycle', () => {
    const owner = suggestionsForRole('cycle-owner').map((s) => s.id)
    const partner = suggestionsForRole('partner').map((s) => s.id)
    expect(owner).toContain('folic-acid')
    expect(owner).not.toContain('no-sauna')
    expect(partner).toContain('no-sauna')
    expect(partner).not.toContain('folic-acid')
    expect(owner).toContain('no-alcohol')
    expect(partner).toContain('no-alcohol')
    // A non-owner who is 아내 gets no sperm-side advice (heat, men's supplements).
    const noSperm = suggestionsForRole('partner', { sperm: false }).map((s) => s.id)
    expect(noSperm).toContain('no-alcohol')
    expect(noSperm).not.toContain('no-sauna')
    expect(noSperm).not.toContain('no-laptop-lap')
    expect(noSperm).not.toContain('coq10')
    expect(infoNotes('partner', { sperm: false })).toHaveLength(0)
    // Conception-only advice disappears once pregnant / parenting.
    for (const stage of ['pregnant', 'parenting'] as const) {
      const ids = suggestionsForRole('partner', { stage }).map((s) => s.id)
      expect(ids).not.toContain('no-laptop-lap')
      expect(ids).not.toContain('no-sauna')
      expect(ids).not.toContain('coq10')
      expect(ids).not.toContain('male-zinc-folate')
      expect(ids).toContain('no-smoking')
    }
    expect(suggestionsForRole('partner', { stage: 'preparing' }).map((s) => s.id)).toContain('no-laptop-lap')
  })

  it('hides what is already on the list, matching loosely', () => {
    expect(normalizeLabel('비타민 D')).toBe('비타민d')
    const coq = SUGGESTIONS.find((s) => s.id === 'coq10')!
    expect(isSuggestionAdded(coq, [{ label: '코엔자임Q10' }])).toBe(true)
    const s = fresh()
    const partnerIds = availableSuggestions('partner', activeItems(s, 'a')).map((x) => x.id)
    // Defaults: sauna, no smoking, no alcohol, exercise.
    expect(partnerIds).not.toContain('no-sauna')
    expect(partnerIds).not.toContain('no-smoking')
    expect(partnerIds).not.toContain('exercise')
    expect(partnerIds).toContain('caffeine')
    expect(partnerIds).not.toContain('male-zinc-folate') // info-only, never offered
    expect(partnerIds).not.toContain('coq10') // low-certainty: a note, not a "추천 항목"
    expect(infoNotes('partner').map((x) => x.id)).toEqual(['coq10', 'male-zinc-folate'])
    expect(infoNotes('cycle-owner')).toHaveLength(0)
    const ownerIds = availableSuggestions('cycle-owner', activeItems(s, 'b')).map((x) => x.id)
    expect(ownerIds).not.toContain('folic-acid')
    // 비타민 D is a suggestion since N29 (her starter list is 엽산 only)…
    expect(ownerIds).toContain('vitamin-d')
    expect(ownerIds).toContain('multivitamin')
    // …and hides once it is on her list, matching loosely.
    const withD = addCheckItem(s, 'b', '비타민d', 'supplement', '2026-09-02')
    expect(availableSuggestions('cycle-owner', activeItems(withD, 'b')).map((x) => x.id)).not.toContain('vitamin-d')
    const added = addCheckItem(s, 'b', '커피 한 잔만', 'habit', '2026-09-02')
    expect(availableSuggestions('cycle-owner', activeItems(added, 'b')).map((x) => x.id)).not.toContain('caffeine')
  })
})

describe('endPregnancy (Next B): back to preparing with the 42-day quiet started', () => {
  it('records the end, starts a loss rest until the 42nd day, and leaves a non-pregnant state alone', () => {
    const pregnant = startPregnancy(fresh(), '2026-08-01', '2026-09-01')
    const ended = endPregnancy(pregnant, '2026-09-20')
    expect(ended.stage).toBe('preparing')
    expect(ended.pregnancy).toMatchObject({ lmp: '2026-08-01', confirmedAt: '2026-09-01', endedAt: '2026-09-20' })
    expect(ended.restCycle).toEqual({ since: '2026-09-20', reason: 'loss', until: addDays('2026-09-20', QUIET_DAYS_AFTER_END - 1) })
    expect(activeRest(ended, '2026-10-31')?.reason).toBe('loss')
    expect(activeRest(ended, '2026-11-01')).toBeUndefined()
    // No specialist card through the quiet.
    expect(doctorAdvice({ ...ended, settings: { ...ended.settings, ttcStart: '2024-01-01' } }, '2026-10-10')).toBeNull()
    const s = fresh()
    expect(endPregnancy(s, '2026-09-20')).toBe(s)
  })

  it('the bleeding notice opens 오늘 like the other things she chose to tell', () => {
    expect(noticeTarget('system', 'preparing', 'bleeding-told:2026-09-26')).toBe('today')
    expect(noticeTarget('system', 'pregnant', 'bleeding-told:2026-09-26')).toBe('today')
  })
})
