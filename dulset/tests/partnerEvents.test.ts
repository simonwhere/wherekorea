import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import {
  activeDailyItems,
  activeItems,
  addCheckItem,
  archiveCheckItem,
  isDone,
  toggleCheck,
  weeklyCheckDays,
  weeklyDone,
} from '@/lib/logic/checks'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { NUDGES_PER_DAY, inbox, sendCheer } from '@/lib/logic/notifications'
import {
  CHECK_BACK_DAYS,
  CHEERS_PER_DAY,
  EVENT_ID_MAX,
  PARTNER_EVENT_KINDS,
  SETUP_ALERT_STYLES,
  SETUP_DRINKS,
  appliedEventIds,
  appliedEventKey,
  applyPartnerEvent,
  applyPartnerEvents,
  appointmentJoinKey,
  appointmentJoinNoticeKey,
  appointmentJoinedBy,
  cleanPartnerEvent,
  earliestCheckDate,
  earliestDoneAt,
  hasAppliedEvent,
  hasJoinedAppointment,
  joinAppointment,
  joinableAppointment,
  partnerEventProblem,
  taskLocked,
  type PartnerEvent,
} from '@/lib/logic/partnerEvents'
import { noticeTarget } from '@/lib/logic/today'
import { FERTILITY_CLAIM_ID, FERTILITY_TEST_ID, chainKey, fertilityChain, monthlyTask, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { setPersonalPref } from '@/lib/logic/prefs'
import { SIGNALS_PER_DAY, pendingSignal, sendSignal, signalIdOf, signalsSentToday } from '@/lib/logic/signals'
import { startRestCycle } from '@/lib/logic/ttc'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { WEEK_OPTIONS, weekDone, weekOf, weekOptions, weekPick, weekPickKey } from '@/lib/logic/weekTogether'
import type { AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner).
const OWNER = 'b' as const
const PARTNER = 'a' as const
const TODAY: ISODate = '2026-09-10' // a Thursday
const NOW = '2026-09-10T09:00:00+09:00'
const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
const stamp = (day: ISODate, hour = 9) => `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`

function fresh(): AppState {
  let s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-06-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  s = { ...s, periods: REGULAR }
  // His items: two daily, one weekly. Her own daily item.
  s = addCheckItem(s, PARTNER, '30분 걷기', 'habit', '2026-08-01')
  s = addCheckItem(s, PARTNER, '7시간 자기', 'habit', '2026-08-01')
  s = addCheckItem(s, PARTNER, '금주', 'habit', '2026-08-01', '주 1회', 'weekly')
  s = addCheckItem(s, OWNER, '엽산', 'supplement', '2026-08-01', '400µg')
  // Her owner-only records.
  s = setFeel(s, OWNER, '2026-09-08', 'tired')
  s = setPrivateNote(s, OWNER, '2026-09-08', '나만 보는 줄')
  s = giveIntimacyConsent(s, OWNER, '2026-09-01')
  s = toggleIntimacyDay(s, OWNER, '2026-09-08')
  s = addLHTest(s, { date: '2026-09-09', result: 'faint', time: '07:00', by: OWNER }, TODAY)
  // His chain: applied 08-24 → the test is this month's task.
  s = setFertilityApplied(s, PARTNER, true, '2026-08-24')
  return s
}

const item = (s: AppState, label: string) => activeItems(s, PARTNER).find((i) => i.label === label)!
const ownerItem = (s: AppState) => activeItems(s, OWNER)[0]!
const check = (id: string, itemId: string, done = true, date: ISODate = TODAY): PartnerEvent => ({ id, kind: 'check', itemId, date, done })

/** The fields the partner may never touch, by reference. */
const CYCLE_FIELDS = [
  'periods',
  'lhTests',
  'pregnancyTests',
  'positivePending',
  'restCycle',
  'cycleNotes',
  'intimacy',
  'personalLog',
  'treatments',
  'leaveDays',
  'settings',
  'couple',
  'diary',
  'pregnancy',
  'cycle',
  'stage',
] as const

function sameCycleData(before: AppState, after: AppState, tag = '') {
  for (const k of CYCLE_FIELDS) expect(after[k], `${tag} ${k}`).toBe(before[k])
}

describe('check events', () => {
  it('ticks his daily item for today, remembers the event, and the same event changes nothing twice', () => {
    const s = fresh()
    const walk = item(s, '30분 걷기')
    const ev = check('e1', walk.id)
    expect(partnerEventProblem(s, ev, TODAY)).toBeNull()
    const next = applyPartnerEvent(s, ev, TODAY, NOW)
    expect(isDone(next, PARTNER, TODAY, walk.id)).toBe(true)
    expect(hasAppliedEvent(next, 'e1')).toBe(true)
    expect(partnerEventProblem(next, ev, TODAY)).toBe('applied')
    expect(applyPartnerEvent(next, ev, TODAY, NOW)).toBe(next)
    // The mark is a decision (lib/sync/model.ts), dated by `today`: never in an inbox, never a count.
    expect(next.decisions[appliedEventKey('e1')]).toBe(TODAY)
    expect(next.notifications.some((n) => n.key === appliedEventKey('e1'))).toBe(false)
    expect(inbox(next, OWNER).some((n) => n.key === appliedEventKey('e1'))).toBe(false)
    sameCycleData(s, next)
  })

  it('is a "set", not a toggle: the same answer under a new id is a no-op, the opposite answer undoes', () => {
    const s = fresh()
    const walk = item(s, '30분 걷기')
    const done = applyPartnerEvent(s, check('e1', walk.id), TODAY, NOW)
    expect(applyPartnerEvent(done, check('e2', walk.id, true), TODAY, NOW)).toBe(done)
    const undone = applyPartnerEvent(done, check('e3', walk.id, false), TODAY, NOW)
    expect(isDone(undone, PARTNER, TODAY, walk.id)).toBe(false)
    expect(hasAppliedEvent(undone, 'e3')).toBe(true)
  })

  it('tells her once when the last daily item is done, like the app’s own row', () => {
    let s = fresh()
    // The starter items plus his two: every daily row but the last leaves the day open.
    const daily = activeDailyItems(s, PARTNER)
    expect(daily.length).toBeGreaterThanOrEqual(2)
    const key = `complete:${PARTNER}:${TODAY}`
    daily.slice(0, -1).forEach((d, i) => {
      s = applyPartnerEvent(s, check(`e${i}`, d.id), TODAY, NOW)
      expect(s.notifications.some((n) => n.key === key)).toBe(false)
    })
    const both = applyPartnerEvent(s, check('last', daily[daily.length - 1]!.id), TODAY, NOW)
    const told = both.notifications.find((n) => n.key === key)!
    expect(told).toMatchObject({ to: OWNER, from: PARTNER, kind: 'cheer' })
    expect(told.title).toContain('민수')
  })

  it('checks a weekly item in for the week and clears the week when undone', () => {
    const s = fresh()
    const weekly = item(s, '금주')
    const done = applyPartnerEvent(s, check('e1', weekly.id, true, '2026-09-08'), TODAY, NOW)
    expect(weeklyDone(done, PARTNER, weekly.id, TODAY)).toBe(true)
    expect(weeklyCheckDays(done, PARTNER, weekly.id, TODAY)).toEqual(['2026-09-08'])
    // Already done this week: the same answer is a no-op even on another day.
    expect(applyPartnerEvent(done, check('e2', weekly.id, true), TODAY, NOW)).toBe(done)
    const undone = applyPartnerEvent(done, check('e3', weekly.id, false), TODAY, NOW)
    expect(weeklyDone(undone, PARTNER, weekly.id, TODAY)).toBe(false)
  })

  it('rejects her items, archived and unknown items, and dates out of range', () => {
    const s = fresh()
    const walk = item(s, '30분 걷기')
    expect(partnerEventProblem(s, check('e1', ownerItem(s).id), TODAY)).toBe('item')
    expect(partnerEventProblem(archiveCheckItem(s, walk.id, TODAY), check('e1', walk.id), TODAY)).toBe('item')
    expect(partnerEventProblem(s, check('e1', 'nope'), TODAY)).toBe('item')
    expect(partnerEventProblem(s, check('e1', walk.id, true, addDays(TODAY, 1)), TODAY)).toBe('date')
    expect(partnerEventProblem(s, check('e1', walk.id, true, addDays(TODAY, -CHECK_BACK_DAYS)), TODAY)).toBeNull()
    expect(partnerEventProblem(s, check('e1', walk.id, true, addDays(TODAY, -CHECK_BACK_DAYS - 1)), TODAY)).toBe('date')
    expect(earliestCheckDate(TODAY)).toBe(addDays(TODAY, -CHECK_BACK_DAYS))
    // Before the item existed.
    const late = addCheckItem(s, PARTNER, '새 항목', 'habit', TODAY)
    expect(partnerEventProblem(late, check('e1', item(late, '새 항목').id, true, addDays(TODAY, -1)), TODAY)).toBe('date')
    for (const ev of [check('e1', ownerItem(s).id), check('e1', walk.id, true, addDays(TODAY, 1))]) {
      expect(applyPartnerEvent(s, ev, TODAY, NOW)).toBe(s)
    }
  })

  it('never acts for the cycle owner: a `from` that is not the partner is dropped', () => {
    const s = fresh()
    const walk = item(s, '30분 걷기')
    expect(partnerEventProblem(s, { ...check('e1', walk.id), from: OWNER }, TODAY)).toBe('actor')
    expect(applyPartnerEvent(s, { ...check('e1', walk.id), from: OWNER }, TODAY, NOW)).toBe(s)
    expect(partnerEventProblem(s, { ...check('e1', walk.id), from: PARTNER }, TODAY)).toBeNull()
  })
})

describe('signal events', () => {
  const withSignal = () => sendSignal(fresh(), OWNER, PARTNER, 'comfort', TODAY, stamp(TODAY, 8))

  it('answers her signal with a reply that fits it, once', () => {
    const s = withSignal()
    expect(signalIdOf(pendingSignal(s, PARTNER, TODAY)!)).toBe('comfort')
    const ev: PartnerEvent = { id: 'r1', kind: 'reply', signalId: 'comfort', replyId: 'here' }
    const next = applyPartnerEvent(s, ev, TODAY, NOW)
    expect(pendingSignal(next, PARTNER, TODAY)).toBeUndefined()
    const sent = inbox(next, OWNER)[0]!
    expect(sent).toMatchObject({ from: PARTNER, kind: 'cheer' })
    expect(sent.title).toBe('🫂 민수님: 옆에 있을게요')
    expect(applyPartnerEvent(next, ev, TODAY, NOW)).toBe(next)
    sameCycleData(s, next)
  })

  it('rejects a reply that does not fit, a reply to nothing, and a reply to another signal', () => {
    const s = withSignal()
    expect(partnerEventProblem(s, { id: 'r1', kind: 'reply', signalId: 'comfort', replyId: 'yes' }, TODAY)).toBe('reply')
    expect(partnerEventProblem(s, { id: 'r1', kind: 'reply', signalId: 'clinic', replyId: 'yes' }, TODAY)).toBe('signal')
    expect(partnerEventProblem(fresh(), { id: 'r1', kind: 'reply', signalId: 'comfort', replyId: 'here' }, TODAY)).toBe('signal')
    expect(partnerEventProblem(s, { id: 'r1', kind: 'reply', signalId: 'comfort', replyId: 'nope' }, TODAY)).toBe('reply')
  })

  it('sends a signal of his own from his list only — never hers, never a demoted one', () => {
    const s = fresh()
    const next = applyPartnerEvent(s, { id: 's1', kind: 'signal', signalId: 'clinic' }, TODAY, NOW)
    expect(inbox(next, OWNER)[0]!.title).toBe('🏥 민수님: 병원 같이 가 줄래요?')
    expect(signalIdOf(pendingSignal(next, OWNER, TODAY)!)).toBe('clinic')
    for (const id of ['not-this-month', 'dinner', 'date', 'miss', 'yes', 'nope']) {
      expect(partnerEventProblem(s, { id: 's1', kind: 'signal', signalId: id }, TODAY), id).toBe('signal')
    }
  })

  it('keeps the day’s limit: replies and signals together, five a day', () => {
    let s = withSignal()
    for (let i = 0; i < SIGNALS_PER_DAY; i++)
      s = applyPartnerEvent(s, { id: `s${i}`, kind: 'signal', signalId: 'thanks' }, TODAY, stamp(TODAY, 10 + i))
    expect(signalsSentToday(s, PARTNER, TODAY)).toBe(SIGNALS_PER_DAY)
    expect(partnerEventProblem(s, { id: 'more', kind: 'signal', signalId: 'rest' }, TODAY)).toBe('limit')
    expect(partnerEventProblem(s, { id: 'reply', kind: 'reply', signalId: 'comfort', replyId: 'here' }, TODAY)).toBe('limit')
    expect(applyPartnerEvent(s, { id: 'more', kind: 'signal', signalId: 'rest' }, TODAY, NOW)).toBe(s)
    // Tomorrow is a new day.
    expect(partnerEventProblem(s, { id: 'more', kind: 'signal', signalId: 'rest' }, addDays(TODAY, 1))).toBeNull()
  })
})

describe('콕 and 응원', () => {
  it('nudges her about her first unchecked item — the label comes from her phone, not the page', () => {
    const s = fresh()
    const next = applyPartnerEvent(s, { id: 'n1', kind: 'nudge' }, TODAY, NOW)
    const n = inbox(next, OWNER)[0]!
    expect(n).toMatchObject({ kind: 'nudge', from: PARTNER })
    expect(n.body).toContain('엽산')
    expect(applyPartnerEvent(next, { id: 'n1', kind: 'nudge' }, TODAY, NOW)).toBe(next)
  })

  it('respects 콕 받기, the day’s three, and needs something left to point at', () => {
    const s = fresh()
    expect(partnerEventProblem(setPersonalPref(s, OWNER, 'acceptNudges', false), { id: 'n1', kind: 'nudge' }, TODAY)).toBe('nudge')
    let allDone = s
    for (const i of activeDailyItems(s, OWNER)) allDone = toggleCheck(allDone, OWNER, TODAY, i.id)
    expect(partnerEventProblem(allDone, { id: 'n1', kind: 'nudge' }, TODAY)).toBe('nudge')
    let used = s
    for (let i = 0; i < NUDGES_PER_DAY; i++) used = applyPartnerEvent(used, { id: `n${i}`, kind: 'nudge' }, TODAY, stamp(TODAY, 10 + i))
    expect(inbox(used, OWNER).filter((n) => n.kind === 'nudge')).toHaveLength(NUDGES_PER_DAY)
    expect(partnerEventProblem(used, { id: 'n9', kind: 'nudge' }, TODAY)).toBe('nudge')
    expect(applyPartnerEvent(used, { id: 'n9', kind: 'nudge' }, TODAY, NOW)).toBe(used)
  })

  it('sends the app’s own cheer line, with the link’s cap per day', () => {
    let s = fresh()
    const next = applyPartnerEvent(s, { id: 'c1', kind: 'cheer' }, TODAY, NOW)
    expect(inbox(next, OWNER)[0]).toMatchObject({
      kind: 'cheer',
      from: PARTNER,
      title: '👏 민수님이 응원을 보냈어요',
      body: '오늘도 고마워요. 우리 잘하고 있어요!',
    })
    expect(applyPartnerEvent(next, { id: 'c1', kind: 'cheer' }, TODAY, NOW)).toBe(next)
    for (let i = 0; i < CHEERS_PER_DAY; i++) s = applyPartnerEvent(s, { id: `c${i}`, kind: 'cheer' }, TODAY, stamp(TODAY, 10 + i))
    expect(partnerEventProblem(s, { id: 'c9', kind: 'cheer' }, TODAY)).toBe('limit')
    // Her cheers and the 'complete' notice (kind cheer, keyed) don't count against him.
    const hers = sendCheer(fresh(), OWNER, PARTNER, NOW)
    expect(partnerEventProblem(hers, { id: 'c1', kind: 'cheer' }, TODAY)).toBeNull()
  })
})

describe('task-done events', () => {
  it('completes his current month task on the day it happened, and the chain moves on', () => {
    const s = fresh()
    const task = monthlyTask(s, TODAY, PARTNER)!
    expect(task).toMatchObject({ id: FERTILITY_TEST_ID, step: 'test', minDoneAt: '2026-08-24' })
    const ev: PartnerEvent = { id: 't1', kind: 'task-done', taskId: task.id, date: '2026-09-08' }
    const next = applyPartnerEvent(s, ev, TODAY, NOW)
    expect(next.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-09-08', by: PARTNER })
    expect(fertilityChain(next, TODAY).step).toBe('claim')
    expect(applyPartnerEvent(next, ev, TODAY, NOW)).toBe(next)
    // The old task id is no longer his task.
    expect(partnerEventProblem(next, { ...ev, id: 't2' }, TODAY)).toBe('task')
    // The claim, later.
    const claim = monthlyTask(next, '2026-09-20', PARTNER)!
    expect(claim.id).toBe(FERTILITY_CLAIM_ID)
    const claimed = applyPartnerEvent(
      next,
      { id: 't3', kind: 'task-done', taskId: claim.id, date: '2026-09-18' },
      '2026-09-20',
      stamp('2026-09-20'),
    )
    expect(claimed.planDone[chainKey(FERTILITY_CLAIM_ID, PARTNER)]).toEqual({ at: '2026-09-18', by: PARTNER })
    sameCycleData(s, claimed)
  })

  it('marks the booked test as 다녀왔어요 with it', () => {
    let s = fresh()
    s = addAppointment(
      s,
      { date: '2026-09-08', time: '10:00', title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID },
      PARTNER,
    )
    const task = monthlyTask(s, TODAY, PARTNER)!
    expect(task.stage).toBe('visited')
    const next = applyPartnerEvent(s, { id: 't1', kind: 'task-done', taskId: task.id, date: '2026-09-08' }, TODAY, NOW)
    expect(next.appointments[0]!.done).toBe(true)
  })

  it('never records the booked test before its day: ‘예약됨’ is locked, ‘예약일 지남’ starts on the booked day (N14 leftover)', () => {
    let s = fresh()
    s = addAppointment(
      s,
      { date: '2026-09-15', time: '10:00', title: '정액검사', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID },
      PARTNER,
    )
    const booked = monthlyTask(s, TODAY, PARTNER)!
    expect(booked.stage).toBe('booked')
    expect(earliestDoneAt(booked)).toBe('2026-09-15')
    expect(taskLocked(booked, TODAY)).toBe(true)
    // [받았어요] today (the page's defaultDoneAt) and any day before the booking are refused.
    expect(partnerEventProblem(s, { id: 'b1', kind: 'task-done', taskId: booked.id, date: TODAY }, TODAY)).toBe('date')
    expect(applyPartnerEvent(s, { id: 'b1', kind: 'task-done', taskId: booked.id, date: TODAY }, TODAY, NOW)).toBe(s)
    // On the booked day it is '예약일 지남' and opens.
    const visited = monthlyTask(s, '2026-09-15', PARTNER)!
    expect(visited.stage).toBe('visited')
    expect(taskLocked(visited, '2026-09-15')).toBe(false)
    expect(partnerEventProblem(s, { id: 'b2', kind: 'task-done', taskId: visited.id, date: '2026-09-14' }, '2026-09-16')).toBe('date')
    const next = applyPartnerEvent(s, { id: 'b2', kind: 'task-done', taskId: visited.id, date: '2026-09-15' }, '2026-09-16', stamp('2026-09-16'))
    expect(next.planDone[FERTILITY_TEST_ID]).toEqual({ at: '2026-09-15', by: PARTNER })
    // Without a booking, the step before still bounds it; a later own minDoneAt wins over an earlier booking.
    expect(earliestDoneAt({ stage: 'book', minDoneAt: '2026-08-24' })).toBe('2026-08-24')
    expect(earliestDoneAt({ stage: 'visited', minDoneAt: '2026-09-20', appointment: { ...visited.appointment!, date: '2026-09-15' } })).toBe('2026-09-20')
    expect(earliestDoneAt({ stage: 'claim' })).toBeUndefined()
  })

  it('rejects a wrong task, a future day and a day before the application', () => {
    const s = fresh()
    const task = monthlyTask(s, TODAY, PARTNER)!
    expect(partnerEventProblem(s, { id: 't1', kind: 'task-done', taskId: 'pre-folic', date: TODAY }, TODAY)).toBe('task')
    expect(partnerEventProblem(s, { id: 't1', kind: 'task-done', taskId: task.id, date: addDays(TODAY, 1) }, TODAY)).toBe('date')
    expect(partnerEventProblem(s, { id: 't1', kind: 'task-done', taskId: task.id, date: '2026-08-20' }, TODAY)).toBe('date')
    expect(partnerEventProblem(s, { id: 't1', kind: 'task-done', taskId: task.id, date: '2026-08-24' }, TODAY)).toBeNull()
  })
})

describe('what the partner can never do', () => {
  it('has no event for a period, an LH strip, a test, a rest cycle or a share switch — forged ones are dropped unread', () => {
    const s = fresh()
    expect(PARTNER_EVENT_KINDS).toEqual([
      'check',
      'reply',
      'signal',
      'nudge',
      'cheer',
      'task-done',
      'week-pick',
      'week-done',
      'setup',
      'join-appointment',
    ])
    const forged = [
      { id: 'f1', kind: 'period', date: '2026-09-10' },
      { id: 'f2', kind: 'lh', date: '2026-09-10', result: 'positive' },
      { id: 'f3', kind: 'ptest', date: '2026-09-10', result: 'positive' },
      { id: 'f4', kind: 'rest', since: '2026-09-10' },
      { id: 'f5', kind: 'share', value: true },
      { id: 'f6', kind: 'intimacy', date: '2026-09-10' },
    ]
    for (const raw of forged) {
      expect(cleanPartnerEvent(raw), raw.kind).toBeUndefined()
      const ev = raw as unknown as PartnerEvent
      expect(partnerEventProblem(s, ev, TODAY), raw.kind).toBe('kind')
      expect(applyPartnerEvent(s, ev, TODAY, NOW), raw.kind).toBe(s)
    }
  })

  it('cleanPartnerEvent keeps only the fields a kind has — no free text rides along', () => {
    const raw = { id: 'e1', kind: 'check', itemId: 'i1', date: TODAY, done: true, message: '자유 텍스트', from: 'a', extra: { x: 1 } }
    expect(cleanPartnerEvent(raw)).toEqual({ id: 'e1', from: 'a', kind: 'check', itemId: 'i1', date: TODAY, done: true })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'cheer', message: '<script>' })).toEqual({ id: 'e1', kind: 'cheer' })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'reply', signalId: 'comfort', replyId: 'here', text: 'x' })).toEqual({
      id: 'e1',
      kind: 'reply',
      signalId: 'comfort',
      replyId: 'here',
    })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'task-done', taskId: 't', date: TODAY })).toEqual({
      id: 'e1',
      kind: 'task-done',
      taskId: 't',
      date: TODAY,
    })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'nudge', from: 'c' })).toEqual({ id: 'e1', kind: 'nudge' })
    // Bad shapes.
    for (const bad of [
      null,
      'check',
      [],
      { kind: 'cheer' },
      { id: '', kind: 'cheer' },
      { id: 'a'.repeat(EVENT_ID_MAX + 1), kind: 'cheer' },
      { id: 'has space', kind: 'cheer' },
      { id: 'e1', kind: 'check', itemId: 'i', date: '2026/09/10', done: true },
      { id: 'e1', kind: 'check', itemId: 'i', date: TODAY, done: 'yes' },
      { id: 'e1', kind: 'check', itemId: '', date: TODAY, done: true },
      { id: 'e1', kind: 'reply', signalId: 'comfort' },
      { id: 'e1', kind: 'signal' },
      { id: 'e1', kind: 'task-done', taskId: 't' },
      { id: 'e1' },
    ]) {
      expect(cleanPartnerEvent(bad), JSON.stringify(bad)).toBeUndefined()
    }
  })

  it('leaves every cycle, personal and settings field untouched under any sequence of events', () => {
    const base = addPregnancyTest(fresh(), { id: 'pt', date: '2026-09-09', result: 'negative', by: OWNER }, TODAY).state
    const s = startRestCycle(base, '2026-09-05')
    const withSignal = sendSignal(s, OWNER, PARTNER, 'clinic', TODAY, stamp(TODAY, 8))
    const walk = item(s, '30분 걷기')
    const task = monthlyTask(s, TODAY, PARTNER)!
    const events: PartnerEvent[] = [
      check('a1', walk.id),
      { id: 'a2', kind: 'reply', signalId: 'clinic', replyId: 'yes' },
      { id: 'a3', kind: 'signal', signalId: 'rest' },
      { id: 'a4', kind: 'nudge' },
      { id: 'a5', kind: 'cheer' },
      { id: 'a6', kind: 'task-done', taskId: task.id, date: '2026-09-09' },
      check('a7', walk.id, false),
      { id: 'a1', kind: 'check', itemId: walk.id, date: TODAY, done: true },
      { id: 'a8', kind: 'period', date: TODAY } as unknown as PartnerEvent,
    ]
    const next = applyPartnerEvents(withSignal, events, TODAY, NOW)
    sameCycleData(withSignal, next)
    expect(
      Object.keys(next.decisions)
        .filter((k) => k.startsWith('partner-event:'))
        .sort(),
    ).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map(appliedEventKey))
    expect(next.notifications.some((n) => n.key?.startsWith('partner-event:'))).toBe(false)
    expect(appliedEventIds(next, events)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a1'])
    expect(isDone(next, PARTNER, TODAY, walk.id)).toBe(false)
    expect(next.planDone[FERTILITY_TEST_ID]?.at).toBe('2026-09-09')
  })

  it('applies a batch in order, a duplicate once, and ignores an empty batch', () => {
    const s = fresh()
    const walk = item(s, '30분 걷기')
    expect(applyPartnerEvents(s, [], TODAY, NOW)).toBe(s)
    const next = applyPartnerEvents(
      s,
      [check('e1', walk.id), check('e1', walk.id), { id: 'c1', kind: 'cheer' }, { id: 'c1', kind: 'cheer' }],
      TODAY,
      NOW,
    )
    expect(isDone(next, PARTNER, TODAY, walk.id)).toBe(true)
    expect(inbox(next, OWNER).filter((n) => n.kind === 'cheer' && !n.key)).toHaveLength(1)
    expect(appliedEventIds(next, [{ id: 'e1' }, { id: 'c1' }, { id: 'zz' }])).toEqual(['e1', 'c1'])
  })

  it('stamps what it creates with the owner’s clock on `today` when no time is given', () => {
    const s = fresh()
    const next = applyPartnerEvent(s, { id: 'c1', kind: 'cheer' }, TODAY)
    expect(inbox(next, OWNER)[0]!.createdAt.startsWith(TODAY)).toBe(true)
    const partner: MemberId = PARTNER
    expect(next.decisions[appliedEventKey('c1')]).toBe(TODAY)
    expect(partner).toBe('a')
  })
})

describe('이번 주 우리 둘 events (week-pick / week-done, N21)', () => {
  const MONDAY = weekOf(TODAY) // 2026-09-07
  const pickEv = (id: string, optionId: string, date: ISODate = TODAY): PartnerEvent => ({ id, kind: 'week-pick', optionId, date })
  const doneEv = (id: string, date: ISODate = TODAY): PartnerEvent => ({ id, kind: 'week-done', date })

  it('takes one of the week’s three picks and its [했어요] — kept in decisions, nothing of hers touched', () => {
    const s = fresh()
    const [o1, o2] = weekOptions(s, TODAY, PARTNER)
    expect(partnerEventProblem(s, pickEv('w1', o1!.id), TODAY)).toBeNull()
    const picked = applyPartnerEvent(s, pickEv('w1', o1!.id, '2026-09-08'), TODAY, NOW)
    expect(weekPick(picked, MONDAY, PARTNER)).toBe(o1)
    expect(picked.decisions[weekPickKey(MONDAY, PARTNER, o1!.id)]).toBe('2026-09-08')
    expect(hasAppliedEvent(picked, 'w1')).toBe(true)
    expect(applyPartnerEvent(picked, pickEv('w1', o1!.id), TODAY, NOW)).toBe(picked)
    // Another pick before [했어요] replaces it.
    const repicked = applyPartnerEvent(picked, pickEv('w2', o2!.id), TODAY, NOW)
    expect(weekPick(repicked, MONDAY, PARTNER)).toBe(o2)
    const done = applyPartnerEvent(repicked, doneEv('w3'), TODAY, NOW)
    expect(weekDone(done, MONDAY, PARTNER)).toBe(TODAY)
    // A second [했어요] (new id) is a no-op apart from remembering it; the day stays.
    const again = applyPartnerEvent(done, doneEv('w4'), TODAY, NOW)
    expect(weekDone(again, MONDAY, PARTNER)).toBe(TODAY)
    expect(hasAppliedEvent(again, 'w4')).toBe(true)
    sameCycleData(s, again)
    expect(again.checkLog).toBe(s.checkLog)
    expect(again.notifications).toBe(s.notifications)
  })

  it('rejects a pick that is not offered, a pick after [했어요], [했어요] without a pick, and dates out of range', () => {
    const s = fresh()
    const offered = weekOptions(s, TODAY, PARTNER).map((o) => o.id)
    const other = WEEK_OPTIONS.find((o) => !offered.includes(o.id))!.id
    expect(partnerEventProblem(s, pickEv('x1', other), TODAY)).toBe('week')
    expect(partnerEventProblem(s, pickEv('x2', 'made-up'), TODAY)).toBe('week')
    expect(partnerEventProblem(s, doneEv('x3'), TODAY)).toBe('week')
    expect(partnerEventProblem(s, pickEv('x4', offered[0]!, addDays(TODAY, 1)), TODAY)).toBe('date')
    expect(partnerEventProblem(s, pickEv('x5', offered[0]!, addDays(TODAY, -CHECK_BACK_DAYS - 1)), TODAY)).toBe('date')
    expect(partnerEventProblem(s, doneEv('x6', addDays(TODAY, 1)), TODAY)).toBe('date')
    const done = applyPartnerEvents(s, [pickEv('p1', offered[0]!), doneEv('p2')], TODAY, NOW)
    expect(partnerEventProblem(done, pickEv('x7', offered[1]!), TODAY)).toBe('week')
    expect(applyPartnerEvent(done, pickEv('x7', offered[1]!), TODAY, NOW)).toBe(done)
    // Never as the cycle owner.
    expect(partnerEventProblem(s, { ...pickEv('x8', offered[0]!), from: OWNER }, TODAY)).toBe('actor')
  })

  it('a tap from Sunday night that arrives on Monday counts for the week it was made in', () => {
    const sunday = addDays(MONDAY, 6) // 2026-09-13
    const monday = addDays(MONDAY, 7)
    const s = fresh()
    const option = weekOptions(s, sunday, PARTNER)[0]!
    const next = applyPartnerEvents(s, [pickEv('s1', option.id, sunday), doneEv('s2', sunday)], monday, NOW)
    expect(weekPick(next, MONDAY, PARTNER)).toBe(option)
    expect(weekDone(next, MONDAY, PARTNER)).toBe(sunday)
    expect(weekPick(next, monday, PARTNER)).toBeUndefined()
  })

  it('rests in the 42 days after a pregnancy ended — even a tap made before the loss', () => {
    const s = fresh()
    const option = weekOptions(s, TODAY, PARTNER)[0]!
    const picked = applyPartnerEvent(s, pickEv('q0', option.id, '2026-09-08'), TODAY, NOW)
    const ended = backToPreparing(startPregnancy(picked, '2026-07-01', '2026-08-10'), TODAY)
    expect(partnerEventProblem(ended, pickEv('q1', option.id), TODAY)).toBe('week')
    expect(partnerEventProblem(ended, doneEv('q2', '2026-09-08'), TODAY)).toBe('week')
    expect(applyPartnerEvent(ended, doneEv('q2', '2026-09-08'), TODAY, NOW)).toBe(ended)
  })

  it('cleanPartnerEvent: an id-like option and a real date only; extra fields are dropped', () => {
    expect(cleanPartnerEvent({ id: 'w1', kind: 'week-pick', optionId: 'chore', date: TODAY, text: '내가 할게', from: 'a' })).toEqual({
      id: 'w1',
      from: 'a',
      kind: 'week-pick',
      optionId: 'chore',
      date: TODAY,
    })
    expect(cleanPartnerEvent({ id: 'w2', kind: 'week-done', date: TODAY, optionId: 'chore' })).toEqual({ id: 'w2', kind: 'week-done', date: TODAY })
    for (const bad of [
      { id: 'w', kind: 'week-pick', optionId: 'chore' },
      { id: 'w', kind: 'week-pick', date: TODAY },
      { id: 'w', kind: 'week-pick', optionId: '집안일 하나', date: TODAY },
      { id: 'w', kind: 'week-pick', optionId: 'chore', date: '2026-9-10' },
      { id: 'w', kind: 'week-done' },
      { id: 'w', kind: 'week-done', date: 20260910 },
    ]) {
      expect(cleanPartnerEvent(bad), JSON.stringify(bad)).toBeUndefined()
    }
  })
})

describe('join-appointment events ([같이 갈게요], N32)', () => {
  /** Clinic mode is the couple's; the appointments are theirs: hers, his, and one they both go to. */
  function clinicCouple(): { s: AppState; both: string; his: string; hers: string } {
    let s = fresh()
    s = addAppointment(s, { date: '2026-09-12', time: '08:30', title: '난포 초음파', place: '○○의원', who: 'both', kind: 'hospital', note: '메모' }, OWNER)
    s = addAppointment(s, { date: '2026-09-13', time: '10:00', title: '정액검사', place: '보건소', who: PARTNER, kind: 'test' }, PARTNER)
    s = addAppointment(s, { date: '2026-09-14', time: '07:00', title: '주사', who: OWNER, kind: 'injection' }, OWNER)
    const id = (title: string) => s.appointments.find((a) => a.title === title)!.id
    return { s, both: id('난포 초음파'), his: id('정액검사'), hers: id('주사') }
  }

  it('keeps his answer in decisions and leaves her one 🔔 with the day, time and place — never the title or the note', () => {
    const { s, both } = clinicCouple()
    const ev: PartnerEvent = { id: 'j1', kind: 'join-appointment', appointmentId: both }
    expect(partnerEventProblem(s, ev, TODAY)).toBeNull()
    const next = applyPartnerEvent(s, ev, TODAY, NOW)
    expect(next.decisions[appointmentJoinKey(both, PARTNER)]).toBe(TODAY)
    expect(hasJoinedAppointment(next, both, PARTNER)).toBe(true)
    expect(appointmentJoinedBy(next, both)).toEqual([PARTNER])
    expect(next.decisions[appliedEventKey('j1')]).toBe(TODAY)
    // The appointment record itself is untouched (it stays the couple's).
    expect(next.appointments).toBe(s.appointments)
    const bell = next.notifications.find((n) => n.key === appointmentJoinNoticeKey(both, PARTNER))!
    expect(bell).toMatchObject({ to: OWNER, from: PARTNER, kind: 'system', read: false, createdAt: NOW })
    expect(bell.title).toBe('🤝 민수님이 병원에 같이 간대요')
    expect(bell.body).toBe('9월 12일 (토) 08:30 · ○○의원')
    expect(`${bell.title}${bell.body}`).not.toMatch(/난포|초음파|메모/)
    // Tapping it opens 챙길 것 (the 'appt:' prefix).
    expect(noticeTarget(bell.kind, 'preparing', bell.key)).toBe('plan')
    // Once: the same event, and a second [같이 갈게요] under a new id, change nothing.
    expect(applyPartnerEvent(next, ev, TODAY, NOW)).toBe(next)
    expect(partnerEventProblem(next, { ...ev, id: 'j2' }, TODAY)).toBe('appointment')
    sameCycleData(s, next)
  })

  it('only a live, not-done, not-past ‘둘이 함께’ appointment takes it — never hers, his own or an unknown id', () => {
    const { s, both, his, hers } = clinicCouple()
    const ev = (appointmentId: string, id = 'j'): PartnerEvent => ({ id, kind: 'join-appointment', appointmentId })
    expect(partnerEventProblem(s, ev(hers), TODAY)).toBe('appointment')
    expect(partnerEventProblem(s, ev(his), TODAY)).toBe('appointment')
    expect(partnerEventProblem(s, ev('nope'), TODAY)).toBe('appointment')
    // Past: the day after it.
    expect(partnerEventProblem(s, ev(both), '2026-09-13')).toBe('appointment')
    // On the day itself it still counts.
    expect(partnerEventProblem(s, ev(both), '2026-09-12')).toBeNull()
    // Done or deleted (a tombstone).
    const done = { ...s, appointments: s.appointments.map((a) => (a.id === both ? { ...a, done: true } : a)) }
    expect(partnerEventProblem(done, ev(both), TODAY)).toBe('appointment')
    const gone = { ...s, appointments: s.appointments.map((a) => (a.id === both ? { ...a, deletedAt: NOW } : a)) }
    expect(joinableAppointment(gone, both, TODAY)).toBeUndefined()
    // Never as the cycle owner.
    expect(partnerEventProblem(s, { ...ev(both), from: OWNER }, TODAY)).toBe('actor')
    // joinAppointment on its own (the app's row can call it) keeps the same rules.
    expect(joinAppointment(s, PARTNER, hers, TODAY)).toBe(s)
    expect(joinAppointment(s, PARTNER, both, '2026-09-13')).toBe(s)
  })

  it('cleanPartnerEvent: an id-like appointment id only; no title, note or date rides along', () => {
    expect(cleanPartnerEvent({ id: 'j1', kind: 'join-appointment', appointmentId: 'appt-1', title: '난포', note: 'x', date: TODAY })).toEqual({
      id: 'j1',
      kind: 'join-appointment',
      appointmentId: 'appt-1',
    })
    expect(cleanPartnerEvent({ id: 'j1', kind: 'join-appointment' })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'j1', kind: 'join-appointment', appointmentId: 'has space' })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'j1', kind: 'join-appointment', appointmentId: 'a'.repeat(65) })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'j1', kind: 'join-appointment', appointmentId: 7 })).toBeUndefined()
  })
})

describe('setup events (the link’s first run, N22)', () => {
  /** Only his three rows (30분 걷기 · 7시간 자기 · 금주 weekly) and her 엽산 — no starter defaults. */
  function linkFresh(): AppState {
    const s = fresh()
    const keep = new Set(['30분 걷기', '7시간 자기', '금주', '엽산'])
    return { ...s, checkItems: s.checkItems.filter((i) => keep.has(i.label)) }
  }
  const setup = (id: string, habits: Record<string, unknown>, alertStyle?: string): PartnerEvent =>
    ({ id, kind: 'setup', habits, ...(alertStyle ? { alertStyle } : {}) }) as unknown as PartnerEvent
  const labels = (s: AppState, active = true) =>
    s.checkItems
      .filter((i) => i.owner === PARTNER && i.active === active)
      .map((i) => `${i.label}${i.cadence === 'weekly' ? '(주)' : ''}`)
      .sort()

  it('adds the weekly check-ins his answers call for and sets his own alert style — her rows and settings untouched', () => {
    const s = linkFresh()
    expect(labels(s)).toEqual(['30분 걷기', '7시간 자기', '금주(주)'])
    const next = applyPartnerEvent(s, setup('s1', { smokes: true, drinks: 'often' }, 'off'), TODAY, NOW)
    expect(labels(next)).toEqual(['30분 걷기', '7시간 자기', '금연(주)', '금주(주)'])
    const added = next.checkItems.find((i) => i.label === '금연')!
    expect(added).toMatchObject({ owner: PARTNER, kind: 'habit', cadence: 'weekly', active: true, createdAt: TODAY })
    expect(next.settings.alertStyle).toEqual({ ...s.settings.alertStyle, [PARTNER]: 'off' })
    expect(next.checkItems.filter((i) => i.owner === OWNER)).toEqual(s.checkItems.filter((i) => i.owner === OWNER))
    expect(next.settings.shareLevel).toBe(s.settings.shareLevel)
    expect(next.checkLog).toBe(s.checkLog)
    for (const k of ['periods', 'lhTests', 'pregnancyTests', 'intimacy', 'personalLog', 'couple', 'diary', 'cycle', 'stage'] as const) {
      expect(next[k], k).toBe(s[k])
    }
    expect(hasAppliedEvent(next, 's1')).toBe(true)
    expect(applyPartnerEvent(next, setup('s1', { smokes: true, drinks: 'often' }, 'off'), TODAY, NOW)).toBe(next)
    // The same answers again under a new id change nothing but the applied mark.
    const again = applyPartnerEvent(next, setup('s2', { smokes: true, drinks: 'sometimes' }, 'off'), TODAY, NOW)
    expect(again.checkItems).toBe(next.checkItems)
    expect(again.settings).toBe(next.settings)
  })

  it('‘거의 안 마셔요’ archives 금주 (history kept); a later ‘가끔’ brings the same row back', () => {
    let s = linkFresh()
    const drink = s.checkItems.find((i) => i.label === '금주')!
    s = applyPartnerEvent(s, check('c1', drink.id, true, '2026-09-08'), TODAY, NOW)
    const off = applyPartnerEvent(s, setup('s1', { drinks: 'no' }), TODAY, NOW)
    expect(labels(off)).toEqual(['30분 걷기', '7시간 자기'])
    expect(off.checkItems.find((i) => i.id === drink.id)).toMatchObject({ active: false, archivedAt: TODAY })
    expect(weeklyDone(off, PARTNER, drink.id, '2026-09-08')).toBe(true)
    const back = applyPartnerEvent(off, setup('s2', { drinks: 'sometimes' }), TODAY, NOW)
    expect(labels(back)).toEqual(['30분 걷기', '7시간 자기', '금주(주)'])
    expect(back.checkItems.filter((i) => i.label === '금주')).toHaveLength(1)
    expect(back.checkItems.find((i) => i.label === '금주')!.id).toBe(drink.id)
  })

  it('an unanswered question leaves its row alone; ‘안 피워요’ with no smoking row changes nothing', () => {
    const s = linkFresh()
    const next = applyPartnerEvent(s, setup('s1', {}), TODAY, NOW)
    expect(next.checkItems).toBe(s.checkItems)
    expect(next.settings).toBe(s.settings)
    expect(hasAppliedEvent(next, 's1')).toBe(true)
    expect(applyPartnerEvent(s, setup('s2', { smokes: false }), TODAY, NOW).checkItems).toBe(s.checkItems)
    // With the starter's daily '담배 안 피우기' (the original list), ‘안 피워요’ archives it.
    const starter = fresh()
    const archived = applyPartnerEvent(starter, setup('s3', { smokes: false }), TODAY, NOW)
    expect(archived.checkItems.find((i) => i.label === '담배 안 피우기')).toMatchObject({ active: false, archivedAt: TODAY })
  })

  it('cleanPartnerEvent: only the fixed values get through; unknown keys are dropped, a wrong value drops the event', () => {
    expect(SETUP_DRINKS).toEqual(['no', 'sometimes', 'often'])
    expect(SETUP_ALERT_STYLES).toEqual(['explicit', 'soft', 'off'])
    expect(
      cleanPartnerEvent({ id: 's1', kind: 'setup', habits: { smokes: false, drinks: 'no', exercises: true, note: '자유' }, alertStyle: 'soft', name: 'x' }),
    ).toEqual({ id: 's1', kind: 'setup', habits: { smokes: false, drinks: 'no' }, alertStyle: 'soft' })
    expect(cleanPartnerEvent({ id: 's1', kind: 'setup', habits: {} })).toEqual({ id: 's1', kind: 'setup', habits: {} })
    for (const bad of [
      { id: 's', kind: 'setup' },
      { id: 's', kind: 'setup', habits: null },
      { id: 's', kind: 'setup', habits: [] },
      { id: 's', kind: 'setup', habits: 'smokes' },
      { id: 's', kind: 'setup', habits: { smokes: 'yes' } },
      { id: 's', kind: 'setup', habits: { drinks: 'rarely' } },
      { id: 's', kind: 'setup', habits: { drinks: 'lots' } },
      { id: 's', kind: 'setup', habits: {}, alertStyle: 'loud' },
      { id: 's', kind: 'setup', habits: {}, alertStyle: null },
    ]) {
      expect(cleanPartnerEvent(bad), JSON.stringify(bad)).toBeUndefined()
    }
  })

  it('never acts as the cycle owner and never touches her alert style', () => {
    const s = linkFresh()
    expect(partnerEventProblem(s, { ...setup('s1', { smokes: true }, 'off'), from: OWNER }, TODAY)).toBe('actor')
    const next = applyPartnerEvent(s, setup('s2', { smokes: true }, 'explicit'), TODAY, NOW)
    expect(next.settings.alertStyle[OWNER]).toBe(s.settings.alertStyle[OWNER])
    expect(next.settings.alertStyle[PARTNER]).toBe('explicit')
  })
})
