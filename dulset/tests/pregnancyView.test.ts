import { describe, expect, it } from 'vitest'
import {
  BAG_ITEMS,
  DUE_DATE_NOTE,
  ONE_STOP,
  PARTNER_IDEAS,
  PRENATAL_CHECKS,
  WEEK_INFO_NOTE,
  WEEKS,
} from '@/lib/content/pregnancy'
import { programById } from '@/lib/content/programs'
import { createInitialState } from '@/lib/initial'
import { setMilestone } from '@/lib/logic/baby'
import { gestationalAge, startPregnancy, updatePregnancy } from '@/lib/logic/pregnancy'
import { confirmPregnancy } from '@/lib/logic/today'
import {
  bagKey,
  bagProgress,
  bagProminent,
  checkedAt,
  checksSince,
  defaultLmp,
  dueDateBounds,
  lmpBounds,
  milestoneDate,
  overrideShiftDays,
  prenatalKey,
  prenatalTimeline,
  shareCheckWithPartner,
  splitTimeline,
  toBaby,
  toggleMilestone,
  validateBirth,
  validateDueDate,
  validateLmp,
  weekBadgeLabel,
  weekInfoFor,
  weekPercent,
  weekRangeLabel,
} from '@/lib/logic/pregnancyView'
import type { AppState } from '@/lib/types'

function pregnant(): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return startPregnancy(s, '2026-09-01', '2026-10-05')
}

describe('week content', () => {
  it('covers every week from 4 to 40 exactly once', () => {
    for (let w = 4; w <= 40; w++) {
      const hits = WEEKS.filter((e) => w >= e.from && w <= e.to)
      expect(hits, `week ${w}`).toHaveLength(1)
    }
    for (const e of WEEKS) {
      expect(e.highlights.length).toBeGreaterThanOrEqual(1)
      expect(e.highlights.length).toBeLessThanOrEqual(2)
      expect(e.mom && e.partner && e.size).toBeTruthy()
    }
  })

  it('clamps before 4주 and after 40주', () => {
    expect(weekInfoFor(2).from).toBe(4)
    expect(weekInfoFor(12).size).toBe('라임')
    expect(weekInfoFor(20).size).toBe('바나나')
    expect(weekInfoFor(40).size).toBe('수박')
    expect(weekInfoFor(42).size).toBe('수박')
    expect(weekRangeLabel({ from: 17, to: 18 })).toBe('17~18주')
    expect(weekRangeLabel({ from: 20, to: 20 })).toBe('20주')
  })

  it('never uses pressure wording', () => {
    const texts = [
      ...WEEKS.flatMap((w) => [w.mom, w.partner, ...w.highlights]),
      ...PRENATAL_CHECKS.flatMap((c) => [c.title, c.why]),
      ...Object.values(PARTNER_IDEAS).flatMap((l) => l.flatMap((i) => [i.title, i.body])),
      ...BAG_ITEMS.map((i) => `${i.label} ${i.note ?? ''}`),
      ...Object.values(ONE_STOP).flatMap((o) => [o.title, o.body]),
      DUE_DATE_NOTE,
      WEEK_INFO_NOTE,
    ]
    for (const t of texts) expect(t).not.toMatch(/숙제|실패|노력 부족|관계를 가져야|오늘 꼭|반드시/)
  })

  it('labels the week badge honestly outside the covered weeks', () => {
    expect(weekBadgeLabel(3, weekInfoFor(3))).toBe('4주 무렵')
    expect(weekBadgeLabel(0, weekInfoFor(0))).toBe('4주 무렵')
    expect(weekBadgeLabel(4, weekInfoFor(4))).toBe('4주')
    expect(weekBadgeLabel(18, weekInfoFor(18))).toBe('17~18주')
    expect(weekBadgeLabel(40, weekInfoFor(40))).toBe('39~40주')
    expect(weekBadgeLabel(41, weekInfoFor(41))).toBe('40주 이후')
  })

  it('places trimester markers on the 40-week bar', () => {
    expect(weekPercent(14)).toBe(35)
    expect(weekPercent(28)).toBe(70)
    expect(weekPercent(45)).toBe(100)
  })
})

describe('prenatal timeline', () => {
  it('links to real support programs', () => {
    for (const c of PRENATAL_CHECKS) if (c.programId) expect(programById(c.programId)).toBeDefined()
  })

  it('highlights the current window and the next one', () => {
    const s = pregnant()
    const rows = prenatalTimeline(s, 12)
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]))
    expect(byId['first-visit']).toBe('past')
    expect(byId['voucher']).toBe('now')
    expect(byId['nt']).toBe('now')
    expect(byId['quad']).toBe('next')
    expect(byId['anatomy']).toBe('upcoming')
  })

  it('keeps each window in line with its week label', () => {
    for (const c of PRENATAL_CHECKS) {
      expect(c.from).toBeLessThanOrEqual(c.to)
      const m = /^(\d+)(?:~(\d+))?주(~)?$/.exec(c.weekLabel)
      if (!m) continue // '확인 후', '28주 전후'
      expect(c.from, c.id).toBe(Number(m[1]))
      if (m[2]) expect(c.to, c.id).toBe(Number(m[2]))
    }
  })

  it('does not call the first visit current before its 6~8주 window', () => {
    for (const w of [3, 4, 5]) {
      const rows = prenatalTimeline(pregnant(), w)
      expect(rows.filter((r) => r.status === 'now'), `week ${w}`).toHaveLength(0)
      expect(rows[0]).toMatchObject({ id: 'first-visit', status: 'next' })
    }
    const at6 = prenatalTimeline(pregnant(), 6)
    expect(at6.filter((r) => r.status === 'now').map((r) => r.id)).toEqual(['first-visit', 'voucher', 'health-center'])
  })

  it('marks ticked checks done with the date, and unticks', () => {
    let s = pregnant()
    s = toggleMilestone(s, prenatalKey('nt'), '2026-11-20')
    expect(milestoneDate(s, 'prenatal:nt')).toBe('2026-11-20')
    const nt = prenatalTimeline(s, 12).find((r) => r.id === 'nt')!
    expect(nt).toMatchObject({ status: 'done', doneAt: '2026-11-20' })
    s = toggleMilestone(s, prenatalKey('nt'), '2026-11-21')
    expect(milestoneDate(s, 'prenatal:nt')).toBeUndefined()
  })

  it('ignores ticks from an earlier pregnancy (before the current LMP)', () => {
    let s = pregnant()
    s = toggleMilestone(s, prenatalKey('nt'), '2025-11-20')
    s = toggleMilestone(s, bagKey('mom-book'), '2025-11-20')
    const lmp = s.pregnancy!.lmp
    expect(checkedAt(s, prenatalKey('nt'), lmp)).toBeUndefined()
    expect(prenatalTimeline(s, 12, lmp).find((r) => r.id === 'nt')?.status).toBe('now')
    expect(bagProgress(s, lmp).done).toBe(0)
    // Toggling a stale tick re-ticks it for this pregnancy.
    s = toggleMilestone(s, prenatalKey('nt'), '2026-11-20', lmp)
    expect(checkedAt(s, prenatalKey('nt'), lmp)).toBe('2026-11-20')
    expect(s.milestones.filter((m) => m.key === 'prenatal:nt')).toHaveLength(1)
  })

  it('keeps this pregnancy\'s ticks when the LMP is corrected to a later date', () => {
    expect(checksSince({ lmp: '2026-09-01', confirmedAt: '2026-10-05' })).toBe('2026-09-01')
    // LMP moved after the record date (a correction) → the record date still counts.
    expect(checksSince({ lmp: '2026-10-10', confirmedAt: '2026-10-05' })).toBe('2026-10-05')
    let s = pregnant() // confirmedAt 2026-10-05
    s = toggleMilestone(s, prenatalKey('first-visit'), '2026-10-06', checksSince(s.pregnancy!))
    s = { ...s, pregnancy: { ...s.pregnancy!, lmp: '2026-10-08' } }
    expect(checkedAt(s, prenatalKey('first-visit'), checksSince(s.pregnancy!))).toBe('2026-10-06')
    // A tick from before this record (an earlier pregnancy) still reads as open.
    s = setMilestone(s, prenatalKey('nt'), '2026-01-10')
    expect(checkedAt(s, prenatalKey('nt'), checksSince(s.pregnancy!))).toBeUndefined()
  })

  it('folds finished rows before the current one', () => {
    let s = pregnant()
    const lmp = s.pregnancy!.lmp
    // Unclaimed support (국민행복카드, 보건소 등록) stays in view; missed scans fold.
    const at33 = splitTimeline(prenatalTimeline(s, 33, lmp))
    expect(at33.earlier.map((r) => r.id)).toEqual(['first-visit', 'nt', 'quad', 'anatomy', 'gdm', 'anemia'])
    expect(at33.rest.map((r) => r.id)).toEqual(['voucher', 'health-center', 'gbs', 'weekly'])
    expect(at33.rest.find((r) => r.id === 'gbs')?.status).toBe('next')
    // Once claimed, they fold like everything else.
    s = toggleMilestone(s, prenatalKey('voucher'), '2026-10-20', lmp)
    s = toggleMilestone(s, prenatalKey('health-center'), '2026-10-20', lmp)
    const ticked = splitTimeline(prenatalTimeline(s, 33, lmp))
    expect(ticked.earlier.map((r) => r.id)).toEqual(['first-visit', 'voucher', 'health-center', 'nt', 'quad', 'anatomy', 'gdm', 'anemia'])
    expect(ticked.rest[0]).toMatchObject({ id: 'gbs', status: 'next' })
    // Every row shows exactly once.
    expect(at33.earlier.length + at33.rest.length).toBe(PRENATAL_CHECKS.length)
    // At 4주 the first row is current: nothing folds.
    expect(splitTimeline(prenatalTimeline(s, 4)).earlier).toHaveLength(0)
    // All ticked: nothing is now/next, so everything shows.
    let all = s
    for (const c of PRENATAL_CHECKS) all = toggleMilestone(all, prenatalKey(c.id), '2027-06-01')
    expect(splitTimeline(prenatalTimeline(all, 41)).rest).toHaveLength(PRENATAL_CHECKS.length)
  })

  it('assigns next to the first open future row when nothing is current', () => {
    const rows = prenatalTimeline(pregnant(), 14)
    expect(rows.filter((r) => r.status === 'now')).toHaveLength(0)
    expect(rows.find((r) => r.status === 'next')?.id).toBe('quad')
  })
})

describe('hospital bag', () => {
  it('counts ticked items and opens from 32주', () => {
    let s = pregnant()
    expect(bagProgress(s)).toEqual({ done: 0, total: BAG_ITEMS.length })
    s = toggleMilestone(s, bagKey('mom-book'), '2027-04-01')
    s = toggleMilestone(s, bagKey('car-seat'), '2027-04-01')
    expect(bagProgress(s).done).toBe(2)
    expect(bagProminent(31)).toBe(false)
    expect(bagProminent(32)).toBe(true)
    expect(BAG_ITEMS.length).toBeGreaterThanOrEqual(15)
    expect(new Set(BAG_ITEMS.map((i) => i.id)).size).toBe(BAG_ITEMS.length)
  })
})

describe('dates', () => {
  it('bounds and validates the LMP', () => {
    expect(lmpBounds('2026-10-05').max).toBe('2026-10-05')
    expect(validateLmp('2026-10-06', '2026-10-05')).toMatch(/오늘 이후/)
    expect(validateLmp('2026-09-01', '2026-10-05')).toBeNull()
    expect(validateLmp('2025-01-01', '2026-10-05')).not.toBeNull()
    expect(validateLmp('nope', '2026-10-05')).not.toBeNull()
  })

  it('keeps a due date within 0–44 weeks of today', () => {
    const b = dueDateBounds('2026-10-05')
    expect(b.min).toBe('2026-09-07')
    expect(b.max).toBe('2027-07-12')
    expect(validateDueDate('2027-06-15', '2026-10-05')).toBeNull()
    expect(validateDueDate('2027-08-01', '2026-10-05')).not.toBeNull()
    // Any due date inside the bounds gives a sane gestational age.
    for (const due of [b.min, b.max]) {
      const ga = gestationalAge({ lmp: '2026-09-01', dueDateOverride: due, confirmedAt: '2026-10-05' }, '2026-10-05')
      expect(ga.weeks).toBeGreaterThanOrEqual(0)
      expect(ga.weeks).toBeLessThanOrEqual(44)
    }
  })

  it('defaults the LMP to the latest logged period start', () => {
    expect(defaultLmp({ periods: [{ start: '2026-08-04' }, { start: '2026-09-01' }] }, '2026-10-05')).toBe('2026-09-01')
    expect(defaultLmp({ periods: [{ start: '2026-10-09' }] }, '2026-10-05')).toBe('2026-09-07')
    expect(defaultLmp({ periods: [] }, '2026-10-05')).toBe('2026-09-07')
  })

  it('measures the doctor date shift', () => {
    expect(overrideShiftDays('2026-09-01', '2027-06-15')).toBe(7)
    expect(overrideShiftDays('2026-09-01', '2027-06-08')).toBe(0)
  })
})

describe('birth', () => {
  it('validates and normalizes the baby', () => {
    expect(validateBirth({ name: '', birthDate: '2027-06-01', sex: 'unknown' }, '2027-06-01', '2026-09-01')).toBeNull()
    expect(validateBirth({ name: '', birthDate: '2027-06-02', sex: 'unknown' }, '2027-06-01')).toMatch(/오늘 이후/)
    expect(validateBirth({ name: '', birthDate: '2026-08-01', sex: 'girl' }, '2027-06-01', '2026-09-01')).not.toBeNull()
    expect(toBaby({ name: '  ', birthDate: '2027-06-01', sex: 'boy' })).toEqual({
      name: '아기',
      birthDate: '2027-06-01',
      sex: 'boy',
    })
    expect(toBaby({ name: ' 튼튼이 ', birthDate: '2027-06-01', sex: 'girl' }).name).toBe('튼튼이')
  })
})

describe('start from the 임신 tab', () => {
  it('tells the partner and keeps the doctor date', () => {
    const base = createInitialState(
      { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b' },
      new Date(2026, 8, 1, 9, 0),
    )
    const s = updatePregnancy(confirmPregnancy(base, '2026-09-01', '2026-10-05', 'a', 'b', '2026-10-05T09:00:00+09:00'), {
      dueDateOverride: '2027-06-10',
    })
    expect(s.stage).toBe('pregnant')
    expect(s.pregnancy).toEqual({ lmp: '2026-09-01', dueDateOverride: '2027-06-10', confirmedAt: '2026-10-05' })
    expect(s.notifications.filter((n) => n.to === 'b')).toHaveLength(1)
    // No doctor date: the override stays unset.
    const plain = updatePregnancy(confirmPregnancy(base, '2026-09-01', '2026-10-05', 'a', 'b', 'x'), { dueDateOverride: undefined })
    expect(plain.pregnancy?.dueDateOverride).toBeUndefined()
  })
})

describe('share with partner', () => {
  it('sends once per check per day', () => {
    const s0 = pregnant()
    const [a, b] = s0.couple.members
    const check = PRENATAL_CHECKS.find((c) => c.id === 'nt')!
    const r1 = shareCheckWithPartner(s0, b, a.id, check, '2026-11-20', '2026-11-20T09:00:00+09:00')
    expect(r1.sent).toBe(true)
    const n = r1.state.notifications[0]!
    expect(n).toMatchObject({ to: 'a', from: 'b', kind: 'milestone', read: false })
    expect(n.title).toContain('지은')
    const r2 = shareCheckWithPartner(r1.state, b, a.id, check, '2026-11-20', '2026-11-20T10:00:00+09:00')
    expect(r2.sent).toBe(false)
    expect(r2.state.notifications).toHaveLength(1)
    const r3 = shareCheckWithPartner(r2.state, b, a.id, check, '2026-11-21', '2026-11-21T10:00:00+09:00')
    expect(r3.sent).toBe(true)
  })
})
