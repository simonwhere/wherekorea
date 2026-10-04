// N31 — the partner's weekly calendar reminder (lib/logic/ics.ts weeklyLinkIcs):
// a recurring event on HIS chosen day, '둘셋 · 이번 주 우리', the link page
// without the share token, no health word and no date of her cycle.

import { describe, expect, it } from 'vitest'
import { weekdayIndex } from '@/lib/dates'
import {
  WEEKLY_DAYS,
  WEEKLY_DAY_LABEL,
  WEEKLY_LINK_PATH,
  WEEKLY_LINK_TITLE,
  buildIcs,
  firstWeekly,
  isWeeklyDay,
  weeklyLinkEvent,
  weeklyLinkIcs,
} from '@/lib/logic/ics'

const STAMP = new Date(Date.UTC(2026, 9, 4, 0, 0, 0))
/** Unfold RFC 5545 continuation lines. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('weeklyLinkIcs (N31)', () => {
  it('repeats every week on his day, from the first such day on or after the start', () => {
    const ics = unfold(weeklyLinkIcs('TH', '2026-10-04', { stamp: STAMP }))
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TH')
    // 2026-10-04 is a Sunday → the first Thursday is 10-08, 20:00 local (floating) for 15 minutes.
    expect(ics).toContain('DTSTART:20261008T200000')
    expect(ics).toContain('DTEND:20261008T201500')
    expect(ics).not.toMatch(/DTSTART;VALUE=DATE/)
    expect(ics).toContain(`SUMMARY:${WEEKLY_LINK_TITLE}`)
    expect(WEEKLY_LINK_TITLE).toBe('둘셋 · 이번 주 우리')
    // An alarm at the start.
    expect(ics).toContain('TRIGGER:-PT0M')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('links the page without the token — never a #t= fragment', () => {
    const rel = unfold(weeklyLinkIcs('MO', '2026-10-04', { stamp: STAMP }))
    expect(rel).toContain(`URL:${WEEKLY_LINK_PATH}`)
    expect(WEEKLY_LINK_PATH).toBe('/link/')
    const abs = unfold(weeklyLinkIcs('MO', '2026-10-04', { stamp: STAMP, origin: 'https://dulset.example/' }))
    expect(abs).toContain('URL:https://dulset.example/link/')
    for (const t of [rel, abs]) expect(t).not.toMatch(/#t=|token/i)
  })

  it('opens the app’s 오늘 when asked (설정 › 내 알림) — a token or another site falls back to the link page', () => {
    const app = weeklyLinkEvent('TU', '2026-10-04', { origin: 'https://dulset.example', path: '/#today' })
    expect(app.url).toBe('https://dulset.example/#today')
    expect(app.description).toContain('https://dulset.example/#today')
    // Same title, rule, time and UID as the link's file: only where it opens changes.
    const link = weeklyLinkEvent('TU', '2026-10-04', { origin: 'https://dulset.example' })
    expect({ ...app, url: '', description: '' }).toEqual({ ...link, url: '', description: '' })
    for (const bad of ['/link/#t=abc', '/#today&t=abc', '//evil.example/', 'https://evil.example/', 'link/', '/a b', 42 as never]) {
      const ev = weeklyLinkEvent('TU', '2026-10-04', { origin: 'https://dulset.example', path: bad })
      expect(ev.url, String(bad)).toBe(`https://dulset.example${WEEKLY_LINK_PATH}`)
    }
    expect(unfold(weeklyLinkIcs('TU', '2026-10-04', { stamp: STAMP, path: '/#today' }))).toContain('URL:/#today')
  })

  it('carries no health word and no date but his own weekly one', () => {
    for (const day of WEEKLY_DAYS) {
      const ics = unfold(weeklyLinkIcs(day, '2026-10-04', { stamp: new Date(Date.UTC(2026, 8, 30)) }))
      expect(ics).not.toMatch(/가임|배란|생리|LH|임신|테스트|병원|우리의 주간/)
      // The only dates are the stamp (DTSTAMP) and the first occurrence (and its end).
      const dates = new Set((ics.match(/\d{8}T\d{6}/g) ?? []).map((x) => x.slice(0, 8)))
      dates.delete('20260930')
      expect([...dates]).toEqual([firstWeekly(day, '2026-10-04').replace(/-/g, '')])
    }
  })

  it('one UID whatever the day, so a new file replaces the old event; a picked time is kept', () => {
    expect(weeklyLinkEvent('MO', '2026-10-04').uid).toBe(weeklyLinkEvent('SA', '2026-10-04').uid)
    expect(unfold(weeklyLinkIcs('SA', '2026-10-04', { stamp: STAMP, time: '09:30' }))).toContain('DTSTART:20261010T093000')
    // A malformed time falls back to the default evening.
    expect(weeklyLinkEvent('SA', '2026-10-04', { time: '25:99' }).time).toEqual({ at: '20:00', minutes: 15 })
  })

  it('finds the first day correctly for every weekday, the start day itself included', () => {
    for (const day of WEEKLY_DAYS) {
      const first = firstWeekly(day, '2026-10-04')
      expect(first >= '2026-10-04' && first <= '2026-10-10', day).toBe(true)
      expect(weekdayIndex(first), day).toBe((WEEKLY_DAYS.indexOf(day) + 1) % 7)
    }
    expect(firstWeekly('SU', '2026-10-04')).toBe('2026-10-04')
    expect(Object.keys(WEEKLY_DAY_LABEL)).toEqual([...WEEKLY_DAYS])
    expect(WEEKLY_DAY_LABEL.TH).toBe('목')
  })

  it('a bad day or date gives a calendar with no event (never a guessed day)', () => {
    expect(isWeeklyDay('TH')).toBe(true)
    expect(isWeeklyDay('XX')).toBe(false)
    expect(weeklyLinkIcs('XX' as never, '2026-10-04', { stamp: STAMP })).not.toContain('BEGIN:VEVENT')
    expect(weeklyLinkIcs('TH', 'soon', { stamp: STAMP })).not.toContain('BEGIN:VEVENT')
  })

  it('all-day events (the fertile-window export) are unchanged', () => {
    const ics = buildIcs([{ uid: 'x@dulset', start: '2026-10-08', end: '2026-10-10', title: 't' }], STAMP)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261008')
    expect(ics).toContain('DTEND;VALUE=DATE:20261011')
    expect(ics).not.toContain('RRULE')
    expect(ics).not.toContain('URL:')
  })
})
