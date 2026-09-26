import { describe, expect, it } from 'vitest'
import { babyAge, dayOfLife, formatBabyAge, koreanDays, nextKoreanDay } from '@/lib/logic/baby'
import {
  activeItems,
  addCheckItem,
  archiveCheckItem,
  coupleStreak,
  itemsFor,
  progress,
  streak,
  toggleCheck,
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
import { createInitialState } from '@/lib/initial'
import type { AppState } from '@/lib/types'

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
    expect(toB.map((x) => x.kind).sort()).toEqual(['fertile-start', 'peak'])
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

  it('sends no fertile-day alerts in low-pressure mode but still tells the owner about her period', () => {
    const s = fresh({ settings: { ...fresh().settings, lowPressure: true } })
    expect(scheduledNotices(s, '2026-09-14').some((x) => x.kind === 'peak' || x.kind === 'fertile-start')).toBe(false)
    expect(scheduledNotices(s, '2026-09-28').some((x) => x.kind === 'period-due' && x.to === 'b')).toBe(true)
  })

  it('only tells the cycle owner about period timing', () => {
    const n = scheduledNotices(fresh(), '2026-09-28')
    const due = n.filter((x) => x.kind === 'period-due')
    expect(due.map((x) => x.to)).toEqual(['b'])
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
