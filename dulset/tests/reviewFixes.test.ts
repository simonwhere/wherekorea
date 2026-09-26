// Regression tests for the integrated-app review (flows, dates, content, a11y).
import { describe, expect, it } from 'vitest'
import { dayChanceLabel, cycleSummary, icsAvailability } from '@/lib/logic/calendarView'
import { rowProgress } from '@/lib/logic/today'
import { isSignal, pendingSignal, sendSignal } from '@/lib/logic/signals'
import {
  LONG_LATE_DAYS,
  addPeriod,
  dayInfo,
  fertilityStatus,
  forecastLimit,
  upcomingWindows,
} from '@/lib/logic/cycle'
import {
  clearNotifications,
  mergeNotices,
  monthsBetween,
  nudgesSentToday,
  scheduledNotices,
  sendNudge,
  ttcClockStart,
} from '@/lib/logic/notifications'
import { backToPreparing, recordBirth, startPregnancy, updatePregnancy } from '@/lib/logic/pregnancy'
import { markPregnant } from '@/lib/logic/settings'
import { confirmPregnancy, doctorAdvice } from '@/lib/logic/today'
import { acceptDatePlan, isPlanAccepted, proposeDatePlan, suggestPlanDate } from '@/lib/logic/dateIdeas'
import { buildIcs, fertileWindowEvents } from '@/lib/logic/ics'
import { createDemoState, sampleWindow } from '@/lib/demo'
import { createInitialState } from '@/lib/initial'
import { parseState } from '@/lib/storage'
import { addDays } from '@/lib/dates'
import type { AppState } from '@/lib/types'

const NOW = '2026-09-26T10:00:00+09:00'

function preparing(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-15',
      ttcStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over }
}

/** Advance `days` days of ordinary use: 3 read nudges each way per day. */
function chatter(s: AppState, from: string, days: number): AppState {
  let st = s
  for (let d = 0; d < days; d++) {
    const day = addDays(from, d)
    for (let i = 0; i < 3; i++) {
      st = sendNudge(st, 'a', 'b', day, `${day}T0${i + 1}:00:00+09:00`)
      st = sendNudge(st, 'b', 'a', day, `${day}T0${i + 1}:30:00+09:00`)
    }
    st = { ...st, notifications: st.notifications.map((n) => ({ ...n, read: true })) }
  }
  return st
}

describe('backup import can never crash the screens', () => {
  it('repairs checkLog values and drops notifications with a non-string key', () => {
    const s = createDemoState('2026-09-26', new Date(NOW), 'preparing')
    const bad = {
      ...s,
      checkLog: { '2026-09-26': { a: 1, b: 'x' }, '2026-09-25': { a: { 0: 'y' }, b: ['ok', 3] } },
      notifications: [
        { ...s.notifications[0], id: 'k', key: 5 },
        { ...s.notifications[0], id: 'f', from: 'z' },
        { ...s.notifications[0], id: 'r', key: 'x:1', read: 'yes', kind: 'weird' },
      ],
    }
    const p = parseState(JSON.stringify(bad))!
    expect(p).not.toBeNull()
    expect(p.checkLog['2026-09-26']).toEqual({})
    expect(p.checkLog['2026-09-25']).toEqual({ b: ['ok'] })
    expect(() => rowProgress(p, 'a', '2026-09-26')).not.toThrow()
    expect(p.notifications.map((n) => n.id)).toEqual(['r'])
    expect(p.notifications[0]).toMatchObject({ read: false, kind: 'system' })
    expect(() => p.notifications.forEach(isSignal)).not.toThrow()
  })
})

describe('after a pregnancy ends', () => {
  // Trying since 2025-08-01, conceived after 9 months (LMP 2026-05-01), loss recorded 2026-09-26.
  function afterLoss(): AppState {
    let s = createDemoState('2026-05-15', new Date('2026-05-15T10:00:00+09:00'), 'preparing')
    s = { ...s, settings: { ...s.settings, ttcStart: '2025-08-01' }, periods: [{ start: '2026-04-03' }, { start: '2026-05-01' }] }
    s = confirmPregnancy(s, '2026-05-01', '2026-05-15', 'b', 'a', '2026-05-15T10:00:00+09:00')
    s = mergeNotices(s, scheduledNotices(s, '2026-06-20'), '2026-06-20T09:00:00+09:00').state // "임신 7주" notices
    return backToPreparing(s, '2026-09-26')
  }

  it('sends no specialist notice and shows no DoctorCard right away, and restarts the trying clock', () => {
    const s = afterLoss()
    expect(s.pregnancy?.endedAt).toBe('2026-09-26')
    expect(ttcClockStart(s)).toBe('2026-09-26')
    expect(scheduledNotices(s, '2026-09-26').filter((n) => n.kind === 'doctor')).toEqual([])
    expect(doctorAdvice(s, '2026-09-26')).toBeNull()
    // Months are counted from the end, not from 2025-08: nothing a year later minus a day.
    expect(scheduledNotices(s, '2027-09-25').filter((n) => n.kind === 'doctor')).toEqual([])
    expect(scheduledNotices(s, '2027-09-26').filter((n) => n.kind === 'doctor')).toHaveLength(2)
  })

  it('settles the pregnancy notices for both members (kept as dismissed stubs)', () => {
    const s = afterLoss()
    const tied = s.notifications.filter((n) => n.key?.startsWith('pregnant:2026-05-01') || n.key?.startsWith('week:2026-05-01'))
    expect(tied.length).toBeGreaterThanOrEqual(3)
    for (const n of tied) expect(n).toMatchObject({ read: true, dismissed: true })
  })

  it('pauses predictions (no late / test prompt, no windows) until a new period is logged', () => {
    const s = afterLoss()
    expect(fertilityStatus(s, '2026-09-26')).toEqual({ kind: 'after-pregnancy', endedAt: '2026-09-26', daysSince: 0 })
    expect(scheduledNotices(s, '2026-09-27').filter((n) => n.kind === 'period-due')).toEqual([])
    expect(upcomingWindows(s, '2026-09-26')).toEqual([])
    // A date inside the pregnancy is not labelled fertile / ovulation.
    const d = dayInfo(s, '2026-09-12', '2026-09-26')
    expect(d).toMatchObject({ phase: 'none', isOvulation: false, unpredicted: 'paused' })
    expect(dayChanceLabel(d, 'explicit')).toBeNull()
    expect(cycleSummary(s, '2026-09-26', 'explicit').headline.title).toBe('몸과 마음을 먼저 챙겨요')
    expect(icsAvailability(s, '2026-09-26', s.settings, 'explicit').enabled).toBe(false)
    // Logging a period afterwards resumes normal predictions.
    const next = addPeriod(s, '2026-10-20')
    expect(fertilityStatus(next, '2026-10-22').kind).toBe('period')
  })

  it('treats a same-day revert as a correction, not an ended pregnancy', () => {
    let s = preparing()
    s = confirmPregnancy(s, '2026-09-15', '2026-09-26', 'b', 'a', NOW)
    s = backToPreparing(s, '2026-09-26')
    expect(fertilityStatus(s, '2026-09-26').kind).not.toBe('after-pregnancy')
    expect(ttcClockStart(s)).toBe('2026-09-01')
  })
})

describe('stage transitions only apply from their own stage', () => {
  it('a stale 임신했어요 form cannot overwrite a recorded pregnancy (or re-notify)', () => {
    let s = preparing()
    s = markPregnant(s, { lmp: '2026-08-20' }, '2026-09-26', 'b', NOW)
    s = updatePregnancy(s, { dueDateOverride: '2027-05-30' })
    const count = s.notifications.length
    const stale = markPregnant(s, { lmp: '2026-08-22' }, '2026-09-26', 'a', NOW)
    expect(stale).toBe(s)
    expect(confirmPregnancy(s, '2026-08-22', '2026-09-26', 'a', 'b', NOW)).toBe(s)
    expect(startPregnancy(s, '2026-08-22', '2026-09-26')).toBe(s)
    expect(stale.pregnancy).toMatchObject({ lmp: '2026-08-20', dueDateOverride: '2027-05-30' })
    expect(stale.notifications).toHaveLength(count)
  })

  it('a stale 아기가 태어났어요 form cannot overwrite the baby', () => {
    let s = startPregnancy(preparing(), '2026-01-01', '2026-02-01')
    s = recordBirth(s, { name: '콩이', birthDate: '2026-09-24', sex: 'girl' })
    expect(recordBirth(s, { name: '아기', birthDate: '2026-09-26', sex: 'unknown' })).toBe(s)
    // Parenting without a baby record can still add one (아기 탭 › 정보 입력).
    const noBaby = { ...s, baby: undefined }
    expect(recordBirth(noBaby, { name: '콩이', birthDate: '2026-09-24', sex: 'girl' }).baby?.name).toBe('콩이')
    expect(backToPreparing(s, '2026-09-26')).toBe(s)
  })
})

describe('late period: nothing is projected past the missed expected date', () => {
  // Last period 09-15, 28 days → expected 10-13.
  const s = preparing()

  it('keeps counting the cycle and shows no fertile/ovulation days', () => {
    expect(forecastLimit(s, '2026-10-23')).toMatchObject({ from: '2026-10-13', reason: 'late' })
    const today = dayInfo(s, '2026-10-23', '2026-10-23')
    expect(today).toMatchObject({ phase: 'none', cycleDay: 39, unpredicted: 'late', isOvulation: false })
    expect(dayChanceLabel(today, 'explicit')).toBeNull()
    expect(dayInfo(s, '2026-10-27', '2026-10-27')).toMatchObject({ phase: 'none', isOvulation: false, cycleDay: 43 })
    expect(dayInfo(s, '2026-10-14', '2026-10-14')).toMatchObject({ phase: 'period-predicted', cycleDay: 30 })
    // Without `today` (pure projection) the old behaviour is still available.
    expect(dayInfo(s, '2026-10-27').phase).not.toBe('none')
  })

  it('has no upcoming window for alerts, previews or onboarding', () => {
    expect(upcomingWindows(s, '2026-10-14')).toEqual([])
    expect(sampleWindow('2026-08-20', 28, 5, '2026-09-26')).toBeNull()
    expect(sampleWindow('2026-09-10', 28, 5, '2026-09-26')).not.toBeNull()
  })

  it('agrees with the hero on the expected day itself', () => {
    const status = fertilityStatus(s, '2026-10-13')
    expect(status).toMatchObject({ kind: 'after-fertile', daysUntilPeriod: 0, cycleDay: 29 })
    expect(dayInfo(s, '2026-10-13', '2026-10-13')).toMatchObject({ phase: 'period-predicted', cycleDay: 29 })
  })

  it('uses one long-late threshold for the notice', () => {
    expect(LONG_LATE_DAYS).toBe(14)
    const at = (d: string) => scheduledNotices(s, d).filter((n) => n.key.startsWith('late:'))
    expect(at(addDays('2026-10-13', LONG_LATE_DAYS))).toHaveLength(1)
    expect(at(addDays('2026-10-13', LONG_LATE_DAYS + 1))).toHaveLength(0)
  })
})

describe('short cycles', () => {
  // 21-day average; the window 10-01…10-06 overlaps the logged period 09-29…10-03.
  const s = preparing({ periods: [{ start: '2026-08-18' }, { start: '2026-09-08' }, { start: '2026-09-29' }] })

  it('never calls a past date the "next" window', () => {
    const st = fertilityStatus(s, '2026-10-02')
    expect(st.kind).toBe('period')
    if (st.kind !== 'period') return
    expect(st.nextFertileStart).toBeUndefined()
    expect(st.fertileEnd).toBe('2026-10-06')
    expect(cycleSummary(s, '2026-10-02', 'explicit').headline.sub).not.toContain('다음 가임기는 10월 1일')
    // Before the window it still says when it starts.
    const before = fertilityStatus(s, '2026-09-29')
    expect(before.kind === 'period' && before.nextFertileStart).toBe('2026-10-01')
  })

  it('does not suggest a period day as 우리의 주간', () => {
    const plan = suggestPlanDate(s, '2026-09-30', 'a')
    expect(plan.reason).toBe('our-week')
    expect(plan.date).toBe('2026-10-04') // first day after the logged (default 5-day) period
  })
})

describe('notification records that are also state', () => {
  it('a dismissed doctor notice is not re-delivered after 200+ newer notices', () => {
    let s = preparing({ settings: { ...preparing().settings, ttcStart: '2025-08-01' } })
    s = mergeNotices(s, scheduledNotices(s, '2026-09-26'), NOW).state
    expect(s.notifications.filter((n) => n.kind === 'doctor')).toHaveLength(2)
    s = clearNotifications(clearNotifications(s, 'a'), 'b')
    s = chatter(s, '2026-09-27', 40)
    expect(s.notifications.length).toBeLessThanOrEqual(200)
    const again = mergeNotices(s, scheduledNotices(s, '2026-11-06'), '2026-11-06T09:00:00+09:00')
    expect(again.added.filter((n) => n.kind === 'doctor')).toEqual([])
  })

  it('a 좋아요 on a date plan survives the inbox cap', () => {
    let s = proposeDatePlan(preparing(), { date: '2026-11-20', title: '산책', createdBy: 'a' }, NOW, 'p1')
    s = acceptDatePlan(s, 'p1', 'b', NOW)
    s = chatter(s, '2026-09-27', 40)
    expect(s.notifications.some((n) => n.key === 'date-ok:p1:b')).toBe(false) // trimmed away…
    expect(isPlanAccepted(s, 'p1', 'b')).toBe(true) // …but the plan remembers
    expect(acceptDatePlan(s, 'p1', 'b', NOW)).toBe(s)
  })

  it('clearing the inbox does not reset the sender’s daily 콕 limit', () => {
    let s = preparing()
    for (let i = 0; i < 3; i++) s = sendNudge(s, 'a', 'b', '2026-09-26', NOW)
    expect(nudgesSentToday(s, 'a', '2026-09-26')).toBe(3)
    s = clearNotifications(s, 'b')
    expect(nudgesSentToday(s, 'a', '2026-09-26')).toBe(3)
    expect(sendNudge(s, 'a', 'b', '2026-09-26', NOW)).toBe(s)
  })

  it('replying to a signal marks it read for the one replying', () => {
    let s = preparing()
    s = sendSignal(s, 'a', 'b', 'dinner', '2026-09-26', '2026-09-26T18:00:00+09:00')
    expect(pendingSignal(s, 'b', '2026-09-26')).toBeDefined()
    s = sendSignal(s, 'b', 'a', 'yes', '2026-09-26', '2026-09-26T18:05:00+09:00')
    expect(s.notifications.filter((n) => n.to === 'b' && !n.read)).toEqual([])
    expect(pendingSignal(s, 'b', '2026-09-26')).toBeUndefined()
  })

  it('never uses the banned word 숙제', () => {
    const s = preparing()
    for (let d = 0; d < 35; d++) {
      for (const n of scheduledNotices(s, addDays('2026-09-15', d))) expect(`${n.title} ${n.body}`).not.toContain('숙제')
    }
  })
})

describe('months of trying are calendar months', () => {
  it('counts 12 on the first anniversary', () => {
    expect(monthsBetween('2025-09-26', '2026-09-26')).toBe(12)
    expect(monthsBetween('2025-09-26', '2026-09-25')).toBe(11)
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1)
    expect(monthsBetween('2026-09-26', '2026-09-26')).toBe(0)
    expect(monthsBetween('2026-09-27', '2026-09-26')).toBe(0)
  })

  it('shows the doctor advice on the anniversary itself', () => {
    const s = preparing({ settings: { ...preparing().settings, ttcStart: '2025-09-26' } })
    expect(doctorAdvice(s, '2026-09-26')?.months).toBe(12)
    expect(scheduledNotices(s, '2026-09-26').filter((n) => n.kind === 'doctor')).toHaveLength(2)
  })
})

describe('.ics export', () => {
  const windows = upcomingWindows(preparing(), '2026-09-20', 3)

  it('gives a soft viewer the window only — no peak-day alarm', () => {
    const soft = fertileWindowEvents(windows, { discreet: true, peak: false })
    expect(soft).toHaveLength(windows.length)
    expect(soft.some((e) => e.title.includes('둘만의 저녁'))).toBe(false)
    expect(fertileWindowEvents(windows, { discreet: false, peak: true })).toHaveLength(windows.length * 2)
  })

  it('keeps UIDs stable when predictions move, and adds a SEQUENCE', () => {
    const before = fertileWindowEvents(windows, { discreet: false, peak: true, id: 'AB12' }).map((e) => e.uid)
    const moved = upcomingWindows(addPeriod(preparing(), '2026-10-09'), '2026-10-09', 3)
    const after = fertileWindowEvents(moved, { discreet: false, peak: true, id: 'AB12' }).map((e) => e.uid)
    expect(after).toEqual(before)
    expect(before[0]).toBe('AB12-fertile-1@dulset')
    expect(buildIcs(fertileWindowEvents(windows, { discreet: false, peak: true }), new Date(Date.UTC(2026, 8, 1)))).toMatch(
      /SEQUENCE:\d+/,
    )
  })
})
