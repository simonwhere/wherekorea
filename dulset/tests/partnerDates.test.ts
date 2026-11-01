// lib/logic/partnerDates — the days his check points read (founder 2026-11-01,
// '12개 전부'): the flu season by stage, the due-date / birth offsets, the
// catch-up rule, and that they agree with the roadmap and the research.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { templateById } from '@/lib/content/roadmap'
import { addDays } from '@/lib/dates'
import {
  DAD_MIND_LAST_OFFSET,
  DAD_MIND_OFFSET,
  FLU_WINDOWS,
  INFERTILITY_LEAVE_NOTICE,
  PARTNER_FLU_ID,
  PARTNER_LEAVE_LAST_OFFSET,
  PARTNER_LEAVE_OPEN_OFFSET,
  PARTNER_LEAVE_REMINDER_DAYS,
  POSTNATAL_CARE_OPEN_OFFSET,
  SEASON_KINDS,
  TDAP_NOTICE_OFFSETS,
  TEST_PREP_NOTICE_DAYS,
  catchUpStep,
  dadMindDay,
  dadMindLastDay,
  daysUntil,
  firstMondayOfJanuary,
  fluDone,
  fluSeasonOf,
  fluWindow,
  fromBirth,
  fromDue,
  mondayOnOrAfter,
  insideWindow,
  isFluDoneKey,
  openFluWindow,
  openSeasonWindow,
  partnerLeaveLastDay,
  partnerLeaveOpens,
  postnatalCareOpens,
  seasonDoneKey,
  seasonOf,
  tdapNoticeDays,
} from '@/lib/logic/partnerDates'
import { PAID_LEAVE_CHANGE } from '@/lib/logic/treatments'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('flu season (절기)', () => {
  it('a 절기 runs September → August', () => {
    expect(fluSeasonOf('2026-09-01')).toBe('2026-27')
    expect(fluSeasonOf('2026-11-01')).toBe('2026-27')
    expect(fluSeasonOf('2027-04-30')).toBe('2026-27')
    expect(fluSeasonOf('2027-08-31')).toBe('2026-27')
    expect(fluSeasonOf('2027-09-01')).toBe('2027-28')
    expect(fluSeasonOf('2099-12-31')).toBe('2099-00')
    expect(fluSeasonOf('nope')).toBe('')
    expect(seasonOf('flu', '2026-10-15')).toBe('2026-27')
  })

  it('windows by stage: preparing 10/1–12/31, pregnant 10/1–4/30, none while parenting', () => {
    expect(fluWindow('preparing', '2026-27')).toEqual({ season: '2026-27', start: '2026-10-01', end: '2026-12-31' })
    expect(fluWindow('pregnant', '2026-27')).toEqual({ season: '2026-27', start: '2026-10-01', end: '2027-04-30' })
    expect(fluWindow('parenting', '2026-27')).toBeUndefined()
    expect(fluWindow('preparing', '2026-28')).toBeUndefined()
    expect(fluWindow('preparing', '')).toBeUndefined()
    expect(FLU_WINDOWS.parenting).toBeUndefined()
  })

  it('open on its first and last day, closed the day around it', () => {
    expect(openFluWindow('preparing', '2026-09-30')).toBeUndefined()
    expect(openFluWindow('preparing', '2026-10-01')?.season).toBe('2026-27')
    expect(openFluWindow('preparing', '2026-12-31')?.end).toBe('2026-12-31')
    expect(openFluWindow('preparing', '2027-01-01')).toBeUndefined()
    expect(openFluWindow('pregnant', '2027-01-15')).toEqual({ season: '2026-27', start: '2026-10-01', end: '2027-04-30' })
    expect(openFluWindow('pregnant', '2027-04-30')?.season).toBe('2026-27')
    expect(openFluWindow('pregnant', '2027-05-01')).toBeUndefined()
    expect(openFluWindow('parenting', '2026-11-01')).toBeUndefined()
    expect(openFluWindow('preparing', 'broken')).toBeUndefined()
    expect(openSeasonWindow('flu', 'pregnant', '2026-11-01')).toEqual(openFluWindow('pregnant', '2026-11-01'))
  })

  it('one planDone key per season, so a new season starts open', () => {
    expect(seasonDoneKey(PARTNER_FLU_ID, '2026-27')).toBe('partner-flu:2026-27')
    expect(isFluDoneKey('partner-flu:2026-27')).toBe(true)
    expect(isFluDoneKey('partner-flu')).toBe(false)
    expect(isFluDoneKey('partner-flu:2026')).toBe(false)
    expect(isFluDoneKey('pre-partner-vaccines')).toBe(false)
    const planDone = { 'partner-flu:2026-27': { at: '2026-11-05', by: 'a' as const } }
    expect(fluDone(planDone, '2026-12-01')).toEqual({ at: '2026-11-05', by: 'a' })
    expect(fluDone(planDone, '2027-03-01')).toEqual({ at: '2026-11-05', by: 'a' }) // pregnant in March: same 절기
    expect(fluDone(planDone, '2027-10-02')).toBeUndefined()
    expect(fluDone(planDone, 'broken')).toBeUndefined()
  })

  it('the validator knows the same seasons', () => {
    const script = readFileSync(join(ROOT, 'scripts/validate-content.mjs'), 'utf8')
    const m = /const SEASON_KINDS = \[([^\]]*)\]/.exec(script)
    expect(m).not.toBeNull()
    const listed = m![1]!
      .split(',')
      .map((x) => x.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
    expect(listed).toEqual([...SEASON_KINDS])
  })
})

describe('days from the due date and the birth', () => {
  const due = '2027-02-11'
  const birth = '2027-01-28' // two weeks early

  it('Tdap at −60 and −21, leave from −50, 산후도우미 from −40', () => {
    expect(TDAP_NOTICE_OFFSETS).toEqual([-60, -21])
    expect(tdapNoticeDays(due)).toEqual([addDays(due, -60), addDays(due, -21)])
    expect(partnerLeaveOpens(due)).toBe('2026-12-23')
    expect(postnatalCareOpens(due)).toBe('2027-01-02')
    expect(fromDue(due, -21)).toBe('2027-01-21')
  })

  it('배우자 출산휴가 ends 출생일 + 119 (the birth day is day 1) — from the real birth, never the due date', () => {
    expect(partnerLeaveLastDay(birth)).toBe(addDays(birth, 119))
    expect(partnerLeaveLastDay('2026-11-01')).toBe('2027-02-28')
    expect(partnerLeaveLastDay(birth) < addDays(due, 119)).toBe(true)
    expect(PARTNER_LEAVE_REMINDER_DAYS).toEqual([30, 7, 1])
  })

  it('아빠 마음 at 출생일 + 90; the test-prep check 7 days ahead', () => {
    expect(dadMindDay(birth)).toBe(addDays(birth, 90))
    expect(fromBirth(birth, DAD_MIND_OFFSET)).toBe(dadMindDay(birth))
    expect(TEST_PREP_NOTICE_DAYS).toBe(7)
  })

  it('the offsets are the roadmap windows (one source of truth)', () => {
    expect(templateById('p3-partner-tdap')?.window?.start).toBe(TDAP_NOTICE_OFFSETS[0])
    expect(templateById('birth-partner-leave')?.window).toEqual({
      anchor: 'edd',
      start: PARTNER_LEAVE_OPEN_OFFSET,
      endAnchor: 'birth',
      end: PARTNER_LEAVE_LAST_OFFSET,
    })
    expect(templateById('p3-postnatal-care')?.window?.start).toBe(POSTNATAL_CARE_OPEN_OFFSET)
    expect(templateById(PARTNER_FLU_ID)?.season).toBe('flu')
  })

  it('the 난임치료휴가 notice opens the day the paid 4 days start', () => {
    expect(INFERTILITY_LEAVE_NOTICE.from).toBe(PAID_LEAVE_CHANGE)
    expect(INFERTILITY_LEAVE_NOTICE.until > INFERTILITY_LEAVE_NOTICE.from).toBe(true)
  })
})

describe('catch-up: the first open on or after the day, once, with the real days left', () => {
  it('picks the smallest step still at or above the days left', () => {
    const steps = PARTNER_LEAVE_REMINDER_DAYS
    expect(catchUpStep(steps, 45)).toBeUndefined()
    expect(catchUpStep(steps, 30)).toBe(30)
    expect(catchUpStep(steps, 20)).toBe(30) // missed D-30, opened at D-20 → the D-30 one, saying 20일
    expect(catchUpStep(steps, 7)).toBe(7)
    expect(catchUpStep(steps, 5)).toBe(7)
    expect(catchUpStep(steps, 1)).toBe(1)
    expect(catchUpStep(steps, 0)).toBe(1) // the last day still gets the D-1 step
    expect(catchUpStep(steps, -1)).toBeUndefined()
    expect(catchUpStep([7, 1, 0], 0)).toBe(0)
    expect(catchUpStep([TEST_PREP_NOTICE_DAYS], 3)).toBe(7) // booked 3 days ahead → at booking
    expect(catchUpStep([], 3)).toBeUndefined()
    expect(catchUpStep(steps, Number.NaN)).toBeUndefined()
  })

  it('daysUntil and insideWindow', () => {
    expect(daysUntil('2026-11-01', '2026-11-08')).toBe(7)
    expect(daysUntil('2026-11-09', '2026-11-08')).toBe(-1)
    expect(daysUntil('x', '2026-11-08')).toBeUndefined()
    expect(insideWindow('2026-12-23', '2026-12-23')).toBe(true)
    expect(insideWindow('2026-12-22', '2026-12-23')).toBe(false)
    expect(insideWindow('2027-05-01', '2026-10-01', '2027-04-30')).toBe(false)
    expect(insideWindow('2027-04-30', '2026-10-01', '2027-04-30')).toBe(true)
    expect(insideWindow('bad', '2026-10-01')).toBe(false)
  })

  it('Mondays: on or after a day, and the first Monday of January (A6 — the 신청 step rests until it)', () => {
    expect(mondayOnOrAfter('2026-10-19')).toBe('2026-10-19') // a Monday
    expect(mondayOnOrAfter('2026-10-20')).toBe('2026-10-26')
    expect(mondayOnOrAfter('2026-10-25')).toBe('2026-10-26') // a Sunday
    expect(mondayOnOrAfter('2026-10-24')).toBe('2026-10-26')
    expect(firstMondayOfJanuary(2027)).toBe('2027-01-04')
    expect(firstMondayOfJanuary(2029)).toBe('2029-01-01') // January 1 is a Monday
    expect(firstMondayOfJanuary(2028)).toBe('2028-01-03')
  })

  it('아빠 마음: birth + 90 through birth + 364 (A5)', () => {
    expect(DAD_MIND_LAST_OFFSET).toBe(364)
    expect(dadMindLastDay('2026-12-06')).toBe(addDays('2026-12-06', 364))
    expect(dadMindLastDay('2026-12-06') > dadMindDay('2026-12-06')).toBe(true)
    expect(DAD_MIND_LAST_OFFSET).toBeGreaterThan(DAD_MIND_OFFSET)
  })
})
