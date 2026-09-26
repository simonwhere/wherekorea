import { describe, expect, it } from 'vitest'
import {
  CHECKUPS,
  HAPPY_BIRTH,
  KOREAN_DAYS_NOTE,
  MILESTONES,
  MILESTONE_NOTE,
  VACCINE_ALERT_TIP,
  VACCINE_NOTE,
} from '@/lib/content/baby'
import { addDays, range } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { babyAge, dayOfLife, setMilestone } from '@/lib/logic/baby'
import { recordBirth } from '@/lib/logic/pregnancy'
import {
  ageAt,
  ageInMonths,
  birthBounds,
  checkupFocus,
  checkupKey,
  checkupTimeline,
  checkupWindow,
  checkupWindows,
  CLAIM_KEY,
  claimAppliedAt,
  claimDeadline,
  firstYearLastDay,
  formatMeasure,
  formatSpan,
  growthNewestFirst,
  growthSeries,
  growthYScale,
  koreanDayRows,
  milestoneKey,
  milestoneRows,
  monthScale,
  niceScale,
  parseMeasure,
  programDeadline,
  saveBabyInfo,
  shortDate,
  toBabyInfo,
  toggleCheckup,
  toggleClaimApplied,
  validateBabyInfo,
  validateGrowth,
  validateMilestoneDate,
} from '@/lib/logic/babyView'
import type { AppState, GrowthRecord } from '@/lib/types'

function parenting(birthDate = '2026-01-01'): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
    },
    new Date(2025, 3, 1, 9, 0),
  )
  return recordBirth(s, { name: '튼튼이', birthDate, sex: 'girl' })
}

const spec = (id: string) => CHECKUPS.find((c) => c.id === id)!

describe('baby info', () => {
  it('validates the birth date', () => {
    const today = '2026-09-26'
    expect(validateBabyInfo({ name: '', birthDate: '', sex: 'unknown' }, today)).toMatch(/선택/)
    expect(validateBabyInfo({ name: '', birthDate: '2026-09-27', sex: 'unknown' }, today)).toMatch(/오늘 이후/)
    expect(validateBabyInfo({ name: '', birthDate: '2016-09-25', sex: 'unknown' }, today)).toMatch(/이전 날짜/)
    expect(validateBabyInfo({ name: '', birthDate: birthBounds(today).min, sex: 'unknown' }, today)).toBeNull()
    expect(validateBabyInfo({ name: '', birthDate: today, sex: 'boy' }, today)).toBeNull()
  })

  it('trims the name and falls back to 아기', () => {
    expect(toBabyInfo({ name: '  ', birthDate: '2026-01-01', sex: 'boy' }).name).toBe('아기')
    expect(toBabyInfo({ name: ' 튼튼이 ', birthDate: '2026-01-01', sex: 'boy' }).name).toBe('튼튼이')
    expect(toBabyInfo({ name: 'ㄱ'.repeat(30), birthDate: '2026-01-01', sex: 'boy' }).name).toHaveLength(20)
  })

  it('edits baby info without touching stage or records', () => {
    let s = parenting()
    s = { ...s, growth: [{ id: 'g1', date: '2026-02-01', weightKg: 4.1 }] }
    const next = saveBabyInfo(s, { name: '콩이', birthDate: '2026-01-02', sex: 'boy' })
    expect(next.baby).toEqual({ name: '콩이', birthDate: '2026-01-02', sex: 'boy' })
    expect(next.stage).toBe('parenting')
    expect(next.growth).toBe(s.growth)
    expect(s.baby?.name).toBe('튼튼이')
  })

  it('formats age on a given date', () => {
    expect(ageAt('2026-01-01', '2026-01-01')).toBe('태어난 날')
    expect(ageAt('2026-01-01', '2026-01-13')).toBe('생후 12일')
    expect(ageAt('2026-01-01', '2026-06-15')).toBe('생후 5개월')
  })
})

describe('Korean days', () => {
  it('marks past, today and upcoming with D-labels', () => {
    const rows = koreanDayRows('2026-01-01', '2026-04-10')
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey.day50?.status).toBe('past')
    expect(byKey.day100?.date).toBe('2026-04-10')
    expect(byKey.day100?.status).toBe('today')
    expect(byKey.day100?.d).toBe('D-day')
    expect(byKey.day200?.status).toBe('upcoming')
    expect(byKey.day200?.d).toBe('D-100')
    expect(byKey.year1?.date).toBe('2027-01-01')
    expect(rows).toHaveLength(7)
  })
})

describe('checkup windows', () => {
  it('computes the day window for 1차', () => {
    const w = checkupWindow(spec('1'), '2026-01-31')
    expect(w.start).toBe('2026-02-14')
    expect(w.end).toBe('2026-03-07')
    expect(w.key).toBe('checkup:1')
  })

  it('handles month-end births (Jan 31 → Feb clamp)', () => {
    const w2 = checkupWindow(spec('2'), '2026-01-31')
    expect(w2.start).toBe('2026-05-31')
    expect(w2.end).toBe('2026-08-30')
    // 7개월 lands on Feb 28, so 6개월 ends on Feb 27.
    const w = checkupWindow(spec('2'), '2025-07-31')
    expect(w.start).toBe('2025-11-30')
    expect(w.end).toBe('2026-02-27')
    // Leap-day baby, and a window that ends in a leap / non-leap February.
    const leap = checkupWindow(spec('3'), '2024-02-29')
    expect(leap.start).toBe('2024-11-29')
    expect(leap.end).toBe('2025-03-28')
    expect(checkupWindow(spec('2'), '2023-07-29').end).toBe('2024-02-28')
    expect(checkupWindow(spec('2'), '2024-07-29').end).toBe('2025-02-27')
  })

  it('matches babyAge month math for every birthday of a leap year', () => {
    const monthSpecs = CHECKUPS.filter((c) => 'fromMonth' in c)
    for (const birth of range('2024-01-01', '2024-12-31')) {
      for (const s of monthSpecs) {
        if (!('fromMonth' in s)) continue
        const w = checkupWindow(s, birth)
        expect(babyAge(birth, w.start).months, `${birth} ${s.id} start`).toBe(s.fromMonth)
        expect(babyAge(birth, addDays(w.start, -1)).months, `${birth} ${s.id} before`).toBe(s.fromMonth - 1)
        expect(babyAge(birth, w.end).months, `${birth} ${s.id} end`).toBe(s.toMonth)
        expect(babyAge(birth, addDays(w.end, 1)).months, `${birth} ${s.id} after`).toBe(s.toMonth + 1)
      }
    }
  })

  it('has 8 checkups and 4 dental checkups, sorted by start', () => {
    const ws = checkupWindows('2026-01-01')
    expect(ws.filter((w) => w.kind === 'general')).toHaveLength(8)
    expect(ws.filter((w) => w.kind === 'dental')).toHaveLength(4)
    for (let i = 1; i < ws.length; i++) expect(ws[i]!.start >= ws[i - 1]!.start).toBe(true)
    // Same start (18개월): 건강검진 first.
    const i4 = ws.findIndex((w) => w.id === '4')
    expect(ws[i4 + 1]?.id).toBe('d1')
    expect(ws[ws.length - 1]?.end).toBe('2031-12-31') // day before 72개월
  })

  it('derives now / next / past / done', () => {
    let s = parenting('2026-01-01')
    let rows = checkupTimeline(s, '2026-01-01', '2026-05-10')
    const st = (id: string) => rows.find((r) => r.id === id)?.status
    expect(st('1')).toBe('past')
    expect(st('2')).toBe('now')
    expect(st('3')).toBe('next')
    expect(st('4')).toBe('upcoming')
    expect(checkupFocus(rows).map((r) => r.id)).toEqual(['2'])

    s = toggleCheckup(s, '1', '2026-01-01', '2026-05-10')
    rows = checkupTimeline(s, '2026-01-01', '2026-05-10')
    expect(st('1')).toBe('done')
    expect(rows.find((r) => r.id === '1')?.doneAt).toBe('2026-05-10')
    s = toggleCheckup(s, '1', '2026-01-01', '2026-05-11')
    expect(s.milestones.some((m) => m.key === checkupKey('1'))).toBe(false)
  })

  it('shows both checkups that open on the same day as next', () => {
    const rows = checkupTimeline(parenting('2026-01-01'), '2026-01-01', '2027-06-01')
    expect(checkupFocus(rows).map((r) => r.id)).toEqual(['4', 'd1'])
  })

  it('ignores ticks from before this baby was born', () => {
    let s = parenting('2026-01-01')
    s = setMilestone(s, checkupKey('1'), '2023-02-01')
    const rows = checkupTimeline(s, '2026-01-01', '2026-01-20')
    expect(rows.find((r) => r.id === '1')?.status).toBe('now')
    // Toggling replaces the stale tick instead of clearing it.
    s = toggleCheckup(s, '1', '2026-01-01', '2026-01-20')
    expect(s.milestones.find((m) => m.key === checkupKey('1'))?.date).toBe('2026-01-20')
  })
})

describe('milestones', () => {
  it('has ~10 unique milestones and gentle copy', () => {
    expect(MILESTONES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(MILESTONES.map((m) => m.key)).size).toBe(MILESTONES.length)
    const texts = [
      MILESTONE_NOTE,
      VACCINE_NOTE,
      VACCINE_ALERT_TIP,
      KOREAN_DAYS_NOTE.body,
      HAPPY_BIRTH.body,
      ...MILESTONES.flatMap((m) => [m.label, m.typical]),
    ]
    for (const t of texts) expect(t).not.toMatch(/숙제|실패|노력 부족|관계를 가져야|오늘 꼭|늦었|정상|비정상/)
  })

  it('reads achieved dates with the age on that day', () => {
    let s = parenting('2026-01-01')
    s = setMilestone(s, milestoneKey('roll'), '2026-05-20')
    s = setMilestone(s, milestoneKey('smile'), '2025-12-01') // before birth → ignored
    const rows = milestoneRows(s, '2026-01-01')
    const roll = rows.find((r) => r.key === 'roll')!
    expect(roll.date).toBe('2026-05-20')
    expect(roll.ageLabel).toBe('생후 4개월')
    expect(rows.find((r) => r.key === 'smile')?.date).toBeUndefined()
  })

  it('validates the achieved date', () => {
    expect(validateMilestoneDate('', '2026-01-01', '2026-09-26')).toMatch(/선택/)
    expect(validateMilestoneDate('2025-12-31', '2026-01-01', '2026-09-26')).toMatch(/태어난 날/)
    expect(validateMilestoneDate('2026-09-27', '2026-01-01', '2026-09-26')).toMatch(/오늘 이후/)
    expect(validateMilestoneDate('2026-01-01', '2026-01-01', '2026-09-26')).toBeNull()
  })
})

describe('growth', () => {
  const birth = '2026-01-01'
  const today = '2026-09-26'
  const input = (p: Partial<{ date: string; heightCm: string; weightKg: string; headCm: string }>) => ({
    date: today,
    heightCm: '',
    weightKg: '',
    headCm: '',
    ...p,
  })

  it('parses decimals with dot or comma', () => {
    expect(parseMeasure('')).toBeUndefined()
    expect(parseMeasure(' 7,5 ')).toBe(7.5)
    expect(parseMeasure('68.25')).toBe(68.25)
    expect(parseMeasure('.5')).toBe(0.5)
    expect(parseMeasure('7kg')).toBeNaN()
    expect(parseMeasure('-3')).toBeNaN()
  })

  it('needs at least one value', () => {
    const r = validateGrowth(input({}), birth, today)
    expect(r.record).toBeUndefined()
    expect(r.errors.form).toMatch(/하나는/)
  })

  it('checks ranges with friendly messages', () => {
    expect(validateGrowth(input({ heightCm: '20' }), birth, today).errors.heightCm).toMatch(/30~130cm/)
    expect(validateGrowth(input({ heightCm: '131' }), birth, today).errors.heightCm).toMatch(/30~130cm/)
    expect(validateGrowth(input({ weightKg: '0.5' }), birth, today).errors.weightKg).toMatch(/1~30kg/)
    expect(validateGrowth(input({ weightKg: '3450' }), birth, today).errors.weightKg).toMatch(/그램/)
    expect(validateGrowth(input({ headCm: '61' }), birth, today).errors.headCm).toMatch(/25~60cm/)
    expect(validateGrowth(input({ headCm: 'abc' }), birth, today).errors.headCm).toMatch(/숫자/)
  })

  it('checks the date against birth and today', () => {
    expect(validateGrowth(input({ weightKg: '4', date: '2025-12-31' }), birth, today).errors.date).toMatch(/태어난 날/)
    expect(validateGrowth(input({ weightKg: '4', date: '2026-09-27' }), birth, today).errors.date).toMatch(/오늘 이후/)
    expect(validateGrowth(input({ weightKg: '4', date: '' }), birth, today).errors.date).toMatch(/선택/)
  })

  it('returns a record with only the filled, rounded values', () => {
    const r = validateGrowth(input({ weightKg: '7,456', headCm: '42.04' }), birth, today)
    expect(r.errors).toEqual({})
    expect(r.record).toEqual({ date: today, weightKg: 7.46, headCm: 42 })
    expect(formatMeasure(7.46, 'weightKg')).toBe('7.46kg')
    expect(formatMeasure(68, 'heightCm')).toBe('68cm')
  })

  it('lists newest first and plots oldest first', () => {
    const g: GrowthRecord[] = [
      { id: 'a', date: '2026-01-01', weightKg: 3.2, heightCm: 50 },
      { id: 'b', date: '2026-03-01', heightCm: 58 },
      { id: 'c', date: '2026-03-01', weightKg: 5.6 },
      { id: 'd', date: '2025-12-30', weightKg: 3 }, // before birth → not plotted
      { id: 'e', date: '2026-07-02', weightKg: 7.9 },
    ]
    expect(growthNewestFirst(g).map((x) => x.id)).toEqual(['e', 'c', 'b', 'a', 'd'])
    const w = growthSeries(g, birth, 'weightKg')
    expect(w.map((p) => p.id)).toEqual(['a', 'c', 'e'])
    expect(w[0]?.x).toBe(0)
    expect(w[2]?.x).toBeCloseTo(ageInMonths(birth, '2026-07-02'))
    expect(w[2]?.x).toBeCloseTo(6, 0)
    expect(growthSeries(g, birth, 'headCm')).toEqual([])
  })
})

describe('chart scales', () => {
  it('picks clean bounds', () => {
    expect(niceScale(3.2, 9.8)).toMatchObject({ min: 2, max: 10, step: 2, ticks: [2, 4, 6, 8, 10] })
    expect(niceScale(50, 76)).toMatchObject({ min: 50, max: 80, step: 10 })
    const flat = niceScale(5, 5)
    expect(flat.min).toBeLessThan(5)
    expect(flat.max).toBeGreaterThan(5)
  })

  it('starts the month axis at birth with whole-month ticks', () => {
    expect(monthScale(0.4).ticks).toEqual([0, 1, 2, 3])
    expect(monthScale(3).ticks).toEqual([0, 1, 2, 3])
    expect(monthScale(8.7).ticks).toEqual([0, 3, 6, 9])
    expect(monthScale(14.2).ticks).toEqual([0, 6, 12, 18])
    expect(monthScale(40).ticks).toEqual([0, 12, 24, 36, 48])
    for (const m of [0, 1.2, 5.5, 11, 23.9, 70]) {
      const sc = monthScale(m)
      expect(sc.ticks.every(Number.isInteger)).toBe(true)
      expect(sc.max).toBeGreaterThanOrEqual(m)
    }
  })

  it('keeps a minimum y-range so close records do not look like a cliff', () => {
    const nb = growthYScale([3.22, 3.71], 'weightKg')
    expect(nb.max - nb.min).toBeGreaterThanOrEqual(2)
    expect(nb.min).toBeLessThan(3.22)
    expect(nb.max).toBeGreaterThan(3.71)
    const wide = growthYScale([3.3, 8.6], 'weightKg')
    expect(wide).toMatchObject({ min: 2, max: 10 })
    const one = growthYScale([50], 'heightCm')
    expect(one.max - one.min).toBeGreaterThanOrEqual(10)
    expect(growthYScale([0.5], 'weightKg').min).toBeGreaterThanOrEqual(0)
  })
})

describe('60-day claim window', () => {
  it('counts the birth day as day 1, so the 60th day of life is D-day', () => {
    const birth = '2026-01-01'
    expect(claimDeadline(birth, birth)).toEqual({ daysLeft: 59, deadline: '2026-03-01', d: 'D-59' })
    expect(dayOfLife(birth, '2026-03-01')).toBe(60)
    expect(claimDeadline(birth, '2026-02-28')).toMatchObject({ daysLeft: 1, d: 'D-1' })
    expect(claimDeadline(birth, '2026-03-01')).toMatchObject({ daysLeft: 0, d: 'D-day' })
    expect(claimDeadline(birth, '2026-03-02')).toBeNull()
    expect(claimDeadline(birth, '2025-12-31')).toBeNull()
    // Leap year: still 60 days of life.
    expect(claimDeadline('2024-01-15', '2024-01-15')?.deadline).toBe('2024-03-14')
  })

  it('lets either partner mark the application as done (for this baby only)', () => {
    const birth = '2026-01-01'
    let s = parenting(birth)
    expect(claimAppliedAt(s, birth)).toBeUndefined()
    s = toggleClaimApplied(s, birth, '2026-01-10')
    expect(claimAppliedAt(s, birth)).toBe('2026-01-10')
    expect(s.milestones.filter((m) => m.key === CLAIM_KEY)).toHaveLength(1)
    s = toggleClaimApplied(s, birth, '2026-01-11')
    expect(claimAppliedAt(s, birth)).toBeUndefined()
    // A tick from an earlier child doesn't count, and toggling replaces it.
    s = setMilestone(s, CLAIM_KEY, '2023-05-01')
    expect(claimAppliedAt(s, birth)).toBeUndefined()
    s = toggleClaimApplied(s, birth, '2026-01-12')
    expect(s.milestones.filter((m) => m.key === CLAIM_KEY)).toEqual([{ key: CLAIM_KEY, date: '2026-01-12' }])
  })

  it('knows which program deadlines still apply', () => {
    expect(programDeadline('parent-allowance', '2026-01-01', '2026-01-21')).toEqual({ active: true, d: 'D-39' })
    expect(programDeadline('parent-allowance', '2026-01-01', '2026-01-21', true)).toEqual({ active: false, done: true })
    expect(programDeadline('child-allowance', '2026-01-01', '2026-06-01')).toEqual({ active: false })
    expect(programDeadline('first-meeting', '2026-01-01', '2026-11-17')).toEqual({ active: true, d: 'D-44' })
    expect(programDeadline('first-meeting', '2026-01-01', '2026-12-31')).toEqual({ active: true, d: 'D-day' })
    expect(programDeadline('first-meeting', '2026-01-01', '2027-01-01')).toEqual({ active: false })
    expect(programDeadline('first-meeting', '2026-01-01', '2026-11-17', true)).toEqual({ active: true, d: 'D-44' })
    expect(programDeadline('infant-checkup', '2026-01-01', '2030-01-01')).toEqual({ active: true })
  })

  it('ends 첫만남이용권 the day before the first birthday', () => {
    expect(firstYearLastDay('2026-01-01')).toBe('2026-12-31')
    expect(firstYearLastDay('2024-02-29')).toBe('2025-02-27')
    expect(firstYearLastDay('2026-03-31')).toBe('2027-03-30')
  })
})

describe('date spans', () => {
  it('adds the year only when it is not this year', () => {
    expect(shortDate('2026-05-01', '2026-09-26')).toBe('5.1')
    expect(shortDate('2027-02-27', '2026-09-26')).toBe('2027.2.27')
    expect(formatSpan('2026-11-30', '2027-02-27', '2026-09-26')).toBe('11.30 ~ 2027.2.27')
    expect(formatSpan('2028-07-01', '2029-01-31', '2026-09-26')).toBe('2028.7.1 ~ 2029.1.31')
  })
})
