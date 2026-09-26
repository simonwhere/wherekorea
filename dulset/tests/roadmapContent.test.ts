import { describe, expect, it } from 'vitest'
import {
  calmSuggestions,
  canSchedule,
  countdown,
  currentPhase,
  draftForItem,
  linkedAppointment,
  monthsEnd,
  OVERDUE_GRACE_DAYS,
  phaseGroups,
  planFocus,
  planItems,
  statusPill,
  tickItem,
  usableAppointments,
  validateDraft,
  type PlanItem,
} from '@/lib/logic/plan'
import { CHECKUPS } from '@/lib/content/baby'
import { BAG_ITEMS, PRENATAL_CHECKS } from '@/lib/content/pregnancy'
import { PROGRAMS } from '@/lib/content/programs'
import { MONTH_DEADLINES, NOT_ONE_APPOINTMENT, ROADMAP, ROADMAP_PROGRAMS, planKey, templateById } from '@/lib/content/roadmap'
import { addDays, diffDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { CLAIM_KEY, checkupKey } from '@/lib/logic/babyView'
import { recordBirth, startPregnancy, backToPreparing, gestationalAge } from '@/lib/logic/pregnancy'
import { bagKey, checkedAt, checksSince, prenatalKey } from '@/lib/logic/pregnancyView'
import { PHASES, addCustomTask } from '@/lib/logic/roadmap'
import type { AppState } from '@/lib/types'

// ── Content ─────────────────────────────────────────────────

describe('ROADMAP content', () => {
  it('has 45–60 templates with unique kebab-case ids across all six phases', () => {
    expect(ROADMAP.length).toBeGreaterThanOrEqual(45)
    expect(ROADMAP.length).toBeLessThanOrEqual(60)
    const ids = ROADMAP.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    for (const p of PHASES) expect(ROADMAP.some((t) => t.phase === p)).toBe(true)
  })

  it('every template cites at least one https source, and every source is a real URL', () => {
    for (const t of ROADMAP) {
      expect(t.sources.length, t.id).toBeGreaterThan(0)
      expect(t.sources.some((s) => s.url.startsWith('https://')), t.id).toBe(true)
      for (const s of t.sources) {
        expect(s.name.trim(), t.id).not.toBe('')
        expect(() => new URL(s.url), `${t.id} ${s.url}`).not.toThrow()
      }
      if (t.link) expect(() => new URL(t.link!.url), t.id).not.toThrow()
    }
  })

  it('has short, complete text (title, when, 1–3 sentence detail)', () => {
    for (const t of ROADMAP) {
      expect(t.title.trim(), t.id).not.toBe('')
      expect(t.title.length, t.id).toBeLessThanOrEqual(40)
      expect(t.when.trim(), t.id).not.toBe('')
      const sentences = t.detail.split(/(?<=[요다])\.(?:\s|$)/).filter((x) => x.trim())
      expect(sentences.length, t.id).toBeGreaterThanOrEqual(1)
      expect(sentences.length, t.id).toBeLessThanOrEqual(3)
    }
  })

  it('uses no pressure, fertility-window or gendered-role wording', () => {
    const banned = ['숙제', '실패', '노력', '꼭 해야', '반드시', '가임기', '배란', '아내', '남편', '엄마', '아빠']
    for (const t of ROADMAP) {
      const text = `${t.title} ${t.when} ${t.detail}`
      for (const w of banned) expect(text.includes(w), `${t.id}: ${w}`).toBe(false)
    }
  })

  it('has valid windows: start ≤ end, none before pregnancy, birth anchors only after birth', () => {
    for (const t of ROADMAP) {
      if (t.phase === 'preconception') {
        expect(t.window, t.id).toBeUndefined()
        continue
      }
      if (!t.window) continue
      const { anchor, start, end } = t.window
      if (end !== undefined) expect(start, t.id).toBeLessThanOrEqual(end)
      if (anchor === 'birth') expect(['birth', 'postpartum'], t.id).toContain(t.phase)
      if (anchor === 'lmp') expect(start, t.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('deadlines are dated legal/admin items', () => {
    const deadlines = ROADMAP.filter((t) => t.deadline)
    expect(deadlines.map((t) => t.id).sort()).toEqual(['birth-happy-birth', 'birth-postnatal-care', 'birth-registration'])
    for (const t of deadlines) {
      expect(t.window, t.id).toBeDefined()
      expect(t.window!.end, t.id).toBeDefined()
      expect(t.kind, t.id).toBe('admin')
    }
  })

  it('uses the research windows for time-bound items', () => {
    const w = (id: string) => templateById(id)?.window
    expect(w('p1-nt')).toEqual({ anchor: 'lmp', start: 77, end: 97 })
    expect(w('p2-anatomy')).toEqual({ anchor: 'lmp', start: 140, end: 167 })
    expect(w('p2-gdm')).toEqual({ anchor: 'lmp', start: 168, end: 195 })
    expect(w('p3-tdap')).toEqual({ anchor: 'lmp', start: 189, end: 251 })
    expect(w('p3-partner-tdap')).toEqual({ anchor: 'edd', start: -60, end: -14 })
    expect(w('p1-care-center')).toEqual({ anchor: 'lmp', start: 56, end: 84 })
    expect(w('p1-work-hours')).toEqual({ anchor: 'lmp', start: 0, end: 83 }) // 12주(84일) 이내
    expect(w('p3-work-hours')?.start).toBe(217) // 임신 218일째
    expect(w('p3-maternity-leave')?.start).toBe(-44)
    expect(w('p3-postnatal-care')?.start).toBe(-40)
    expect(w('birth-partner-leave')).toEqual({ anchor: 'edd', start: -50, end: 120 })
    // Shortest "1개월" (Feb 1 → Feb 28 in a common year); the view computes the exact day.
    expect(w('birth-registration')).toEqual({ anchor: 'birth', start: 0, end: 27 })
    expect(w('birth-happy-birth')).toEqual({ anchor: 'birth', start: 0, end: 59 }) // 출생일 포함 60일
    expect(w('birth-postnatal-care')).toEqual({ anchor: 'birth', start: 0, end: 59 })
    expect(w('birth-bcg')).toEqual({ anchor: 'birth', start: 0, end: 27 })
    expect(w('birth-metabolic')).toEqual({ anchor: 'birth', start: 2, end: 7 })
    expect(w('birth-hearing')).toEqual({ anchor: 'birth', start: 0, end: 30 })
    expect(w('pp-infant-checkup-1')).toEqual({ anchor: 'birth', start: 14, end: 35 })
    expect(w('pp-mother-checkup')).toEqual({ anchor: 'birth', start: 28, end: 42 })
  })

  it('keeps things that are still needed later open (no "지났어요" before the birth)', () => {
    const openEnded = [
      'p1-voucher', // can still be applied for later (or after the birth)
      'p1-health-center',
      'p1-birth-hospital',
      'p3-weekly',
      'p3-warning-signs',
      'p3-hospital-bag',
      'p3-car-seat', // needed from the day of discharge
      'p3-work-hours', // usable until the birth
      'p3-maternity-leave', // starts any time from 44 days before the due date
      'p3-parental-leave', // "30일 전" counts from the leave's own start
      'p3-postnatal-care', // open until the birth, then the 60-day item takes over
    ]
    for (const id of openEnded) {
      const t = templateById(id)
      expect(t?.window, id).toBeDefined()
      expect(t!.window!.end, id).toBeUndefined()
    }
  })

  it('names only real templates as "not one appointment"', () => {
    for (const id of NOT_ONE_APPOINTMENT) expect(templateById(id), id).toBeDefined()
  })

  it('month-based legal deadlines have a shortest-reading fallback window', () => {
    for (const [id, months] of Object.entries(MONTH_DEADLINES)) {
      const t = templateById(id)
      expect(t?.deadline, id).toBe(true)
      expect(t?.window?.end, id).toBe(months * 28 - 1)
    }
  })

  it('shares completion with the 임신/아기 tabs through their exact keys', () => {
    const known = new Set([
      ...PRENATAL_CHECKS.map((c) => prenatalKey(c.id)),
      ...BAG_ITEMS.map((b) => bagKey(b.id)),
      ...CHECKUPS.map((c) => checkupKey(c.id)),
      CLAIM_KEY,
    ])
    const keyed = ROADMAP.filter((t) => t.milestoneKey)
    for (const t of keyed) {
      const key = t.milestoneKey!
      if (key.startsWith('plan:')) {
        // A roadmap-internal pair (before / after the birth) — never a lone key.
        expect(keyed.filter((x) => x.milestoneKey === key).length, key).toBe(2)
      } else {
        expect(known.has(key), `${t.id} → ${key}`).toBe(true)
        expect(keyed.filter((x) => x.milestoneKey === key).length, key).toBe(1)
      }
    }
    // The ones the 임신/아기 tabs already track.
    const byKey = (k: string) => keyed.find((t) => t.milestoneKey === k)?.id
    expect(byKey(prenatalKey('nt'))).toBe('p1-nt')
    expect(byKey(prenatalKey('voucher'))).toBe('p1-voucher')
    expect(byKey(prenatalKey('health-center'))).toBe('p1-health-center')
    expect(byKey(prenatalKey('anatomy'))).toBe('p2-anatomy')
    expect(byKey(prenatalKey('gdm'))).toBe('p2-gdm')
    expect(byKey(prenatalKey('gbs'))).toBe('p3-gbs')
    expect(byKey(bagKey('car-seat'))).toBe('p3-car-seat')
    expect(byKey(checkupKey('1'))).toBe('pp-infant-checkup-1')
    expect(byKey(CLAIM_KEY)).toBe('birth-happy-birth')
    expect(templateById('p3-postnatal-care')?.milestoneKey).toBe(planKey('postnatal-care'))
  })

  it('links program items to the program cards', () => {
    for (const [itemId, programId] of Object.entries(ROADMAP_PROGRAMS)) {
      const t = templateById(itemId)
      const p = PROGRAMS.find((x) => x.id === programId)
      expect(t, itemId).toBeDefined()
      expect(p, programId).toBeDefined()
      expect(t!.link).toEqual({ label: p!.urlLabel, url: p!.url })
    }
  })
})

// ── View model ──────────────────────────────────────────────

function fresh(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-07-01',
    },
    new Date(2026, 6, 1, 9),
  )
}

const find = (items: PlanItem[], id: string) => items.find((i) => i.id === id)!

describe('챙길 것 view model', () => {
  it('while preparing, pregnancy phases are previews — even after a pregnancy ended', () => {
    let s = startPregnancy(fresh(), '2026-05-01', '2026-06-10')
    s = backToPreparing(s, '2026-07-20')
    const today = '2026-09-26'
    const items = planItems(s, today)
    const nt = find(items, 'p1-nt')
    expect(nt.start).toBeUndefined()
    expect(nt.pending).toBe(true)
    expect(nt.status).toBe('undated')
    expect(items.some((i) => i.status === 'overdue')).toBe(false)
    expect(planFocus(items)).toEqual([])
    // Calm suggestions come from 임신 준비.
    const calm = calmSuggestions(items, 'preparing')
    expect(calm.length).toBe(3)
    expect(calm.every((i) => i.phase === 'preconception')).toBe(true)
    const [prep, first] = phaseGroups(items, 'all', s)
    expect(prep!.hint).toBeUndefined()
    expect(first!.hint).toBe('임신을 기록하면 날짜가 자동으로 계산돼요')
    expect(currentPhase(s, today)).toBe('preconception')
  })

  it('while pregnant, LMP/EDD windows resolve and birth items wait for the birth', () => {
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    const today = '2026-09-26' // 12주 3일
    const items = planItems(s, today)
    const nt = find(items, 'p1-nt')
    expect([nt.start, nt.end]).toEqual(['2026-09-16', '2026-10-06'])
    expect(nt.status).toBe('now')
    expect(nt.owners).toEqual(['b']) // carrier = the member whose cycle is tracked
    expect(find(items, 'p1-first-visit').lapsed).toBe(true)
    expect(statusPill(find(items, 'p1-first-visit'), 'pregnant')).toEqual({ label: '지났어요', tone: 'muted' })
    const reg = find(items, 'birth-registration')
    expect(reg.pending).toBe(true)
    // Birth is one of the pregnant stage's phases, so the row says so.
    expect(statusPill(reg, 'pregnant')).toEqual({ label: '날짜 미정', tone: 'muted' })
    const birth = phaseGroups(items, 'stage', s).find((g) => g.phase === 'birth')!
    expect(birth.hint).toBe('아기가 태어난 날을 기록하면 날짜가 자동으로 계산돼요')
    // 배우자 출산휴가 opens 50 days before the due date (2027-04-07).
    const leave = find(items, 'birth-partner-leave')
    expect([leave.start, leave.end]).toEqual([addDays('2027-04-07', -50), addDays('2027-04-07', 120)])
    expect(currentPhase(s, today)).toBe('pregnancy-1st')
  })

  it('reads ticks the way the 임신 tab does (an earlier pregnancy’s ticks stay with it)', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = { ...s, milestones: [{ key: prenatalKey('nt'), date: '2026-01-10' }] }
    const today = '2026-09-26'
    expect(find(planItems(s, today), 'p1-nt').status).toBe('now')
    s = tickItem('p1-nt', true, today, 'a')(s)
    expect(find(planItems(s, today), 'p1-nt').status).toBe('done')
    // Same key, same answer on the 임신 tab.
    expect(checkedAt(s, prenatalKey('nt'), checksSince(s.pregnancy!))).toBe(today)
    // Ticking again doesn't re-date it; unticking clears it.
    expect(tickItem('p1-nt', true, '2026-09-30', 'b')(s)).toBe(s)
    s = tickItem('p1-nt', false, today, 'a')(s)
    expect(s.milestones.some((m) => m.key === prenatalKey('nt'))).toBe(false)
  })

  it('shares one tick between the before- and after-birth 산후도우미 items', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = tickItem('p3-postnatal-care', true, '2027-03-01', 'b')(s)
    s = recordBirth(s, { name: '콩이', birthDate: '2027-04-01', sex: 'unknown' })
    const items = planItems(s, '2027-04-10')
    expect(find(items, 'birth-postnatal-care').status).toBe('done')
    expect(find(items, 'p3-postnatal-care').status).toBe('done')
  })

  it('after the birth: real-birth windows, overdue deadlines, and the pregnancy behind us', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = recordBirth(s, { name: '콩이', birthDate: '2027-03-25', sex: 'girl' })
    const today = '2027-04-25' // day 31
    const items = planItems(s, today)
    // 배우자 출산휴가 counts from the real birth day, not the due date.
    expect(find(items, 'birth-partner-leave').end).toBe(addDays('2027-03-25', 120))
    const reg = find(items, 'birth-registration')
    expect(reg.status).toBe('overdue')
    expect(statusPill(reg, 'parenting')).toEqual({ label: '기한 지남', tone: 'warn' })
    expect(countdown(reg, today)).toBeUndefined()
    // Nothing from the pregnancy is "지금" or overdue any more.
    const pregnancyItems = items.filter((i) => i.phase.startsWith('pregnancy-'))
    expect(pregnancyItems.every((i) => i.status === 'later' || i.status === 'done')).toBe(true)
    // Focus: overdue first, then the legal deadline that is still open.
    const focus = planFocus(items)
    expect(focus[0]!.id).toBe('birth-registration')
    expect(focus[1]!.deadline).toBe(true)
    expect(countdown(focus[1]!, today)).toMatch(/^마감 D-\d+$/)
    expect(currentPhase(s, today)).toBe('birth')
  })

  it('treats an older child’s checkup ticks as open while a new pregnancy is on', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = { ...s, baby: { name: '첫째', birthDate: '2024-01-01', sex: 'boy' }, milestones: [{ key: checkupKey('1'), date: '2024-01-20' }] }
    const items = planItems(s, '2026-09-26')
    const checkup = find(items, 'pp-infant-checkup-1')
    expect(checkup.status).toBe('undated')
    expect(items.some((i) => i.status === 'overdue')).toBe(false)
  })

  it('custom tasks: dated ones reach the focus card, and can be ticked', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = addCustomTask(s, { title: '회사에 알리기', phase: 'pregnancy-1st', who: 'a', due: '2026-09-26' }, 'a')
    const id = s.customTasks[0]!.id
    const today = '2026-09-26'
    let items = planItems(s, today)
    expect(find(items, id).status).toBe('now')
    expect(planFocus(items).some((i) => i.id === id)).toBe(true)
    s = tickItem(id, true, today, 'b')(s)
    items = planItems(s, today)
    expect(find(items, id).doneBy).toBe('b')
  })

  it('"일정 잡기" prefills from the item', () => {
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    const today = '2026-09-26'
    const items = planItems(s, today)
    const anatomy = draftForItem(find(items, 'p2-anatomy'), today)
    expect(anatomy).toMatchObject({ date: '2026-11-18', title: '정밀초음파', who: 'both', kind: 'test', taskId: 'p2-anatomy' })
    const nt = draftForItem(find(items, 'p1-nt'), today)
    expect(nt).toMatchObject({ date: today, who: 'b', kind: 'test' })
    expect(draftForItem(find(items, 'p1-work-hours'), today).kind).toBe('admin')
    // Not for habits, previews without dates, or windows that have closed.
    expect(canSchedule(find(items, 'p2-anatomy'))).toBe(true)
    expect(canSchedule(find(items, 'pre-folic'))).toBe(false)
    expect(canSchedule(find(items, 'birth-registration'))).toBe(false)
    expect(canSchedule(find(items, 'p1-first-visit'))).toBe(false)
    // Things to know / keep doing aren't one visit.
    expect(canSchedule(find(items, 'p1-visit-schedule'))).toBe(false)
    expect(canSchedule(find(items, 'p1-checkup-time'))).toBe(false)
    expect(canSchedule(find(items, 'p1-flu'))).toBe(true)
  })

  it('validates the appointment form', () => {
    const today = '2026-09-26'
    const ok = { date: today, time: '', title: '검진', place: '', who: 'both' as const, kind: 'hospital' as const, note: '' }
    expect(validateDraft(ok, today)).toBeNull()
    expect(validateDraft({ ...ok, date: '2026-09-25' }, today)).toBe('date')
    // Editing an appointment that is already past keeps its own date.
    expect(validateDraft({ ...ok, date: '2026-09-25' }, '2026-09-25')).toBeNull()
    expect(validateDraft({ ...ok, date: '' }, today)).toBe('date')
    expect(validateDraft({ ...ok, time: '25:00' }, today)).toBe('time')
    expect(validateDraft({ ...ok, time: '09:30' }, today)).toBeNull()
    expect(validateDraft({ ...ok, title: '  ' }, today)).toBe('title')
  })
})

// ── Review fixes: legal timing, dating, per-pregnancy ticks ─────────────

describe('출생신고: exact "1개월" (birth day counted as day 1)', () => {
  it('ends the day before the same date a month on, or on that month’s last day', () => {
    expect(monthsEnd('2027-01-15', 1)).toBe('2027-02-14')
    expect(monthsEnd('2027-02-01', 1)).toBe('2027-02-28') // shortest: 27 days on
    expect(monthsEnd('2028-02-01', 1)).toBe('2028-02-29') // leap year
    expect(monthsEnd('2027-01-31', 1)).toBe('2027-02-28') // no Feb 31 → last day
    expect(monthsEnd('2027-01-29', 1)).toBe('2027-02-28')
    expect(monthsEnd('2027-03-30', 1)).toBe('2027-04-29')
    expect(monthsEnd('2027-03-31', 1)).toBe('2027-04-30')
    expect(monthsEnd('2026-12-15', 1)).toBe('2027-01-14')
  })

  it('is never earlier than the template fallback and never more than 30 days on', () => {
    const fallback = templateById('birth-registration')!.window!.end!
    for (let d = '2026-01-01'; d < '2030-01-01'; d = addDays(d, 1)) {
      const n = diffDays(d, monthsEnd(d, 1))
      expect(n, d).toBeGreaterThanOrEqual(fallback)
      expect(n, d).toBeLessThanOrEqual(30)
    }
  })

  it('the view shows the exact last day and is not overdue before it', () => {
    let s = startPregnancy(fresh(), '2026-04-10', '2026-05-20')
    s = recordBirth(s, { name: '콩이', birthDate: '2027-01-15', sex: 'unknown' })
    const reg = (today: string) => find(planItems(s, today), 'birth-registration')
    expect(reg('2027-01-20').end).toBe('2027-02-14')
    // The shortest reading (Feb 11) has passed, the law's day hasn't.
    expect(reg('2027-02-13').status).toBe('now')
    expect(countdown(reg('2027-02-13'), '2027-02-13')).toBe('마감 D-1')
    expect(reg('2027-02-14').status).toBe('now')
    expect(reg('2027-02-15').status).toBe('overdue')
  })
})

describe('missed deadlines', () => {
  it('stay "기한 지남" for a while, then read as a quiet "지났어요"', () => {
    let s = startPregnancy(fresh(), '2025-04-10', '2025-05-20')
    s = recordBirth(s, { name: '콩이', birthDate: '2026-01-10', sex: 'girl' })
    const end = '2026-02-09' // monthsEnd(2026-01-10, 1)
    const at = (today: string) => find(planItems(s, today), 'birth-registration')
    expect(at(addDays(end, OVERDUE_GRACE_DAYS)).status).toBe('overdue')
    const later = at(addDays(end, OVERDUE_GRACE_DAYS + 1))
    expect(later.status).toBe('later')
    expect(later.lapsed).toBe(true)
    expect(statusPill(later, 'parenting')).toEqual({ label: '지났어요', tone: 'muted' })
    // A couple joining with an 8-month-old sees no warnings at all.
    const items = planItems(s, '2026-09-26')
    expect(items.some((i) => i.status === 'overdue')).toBe(false)
    expect(planFocus(items).some((i) => i.deadline)).toBe(false)
    // Still tickable.
    s = tickItem('birth-registration', true, '2026-09-26', 'a')(s)
    expect(find(planItems(s, '2026-09-26'), 'birth-registration').status).toBe('done')
  })
})

describe('dating follows the 임신 tab', () => {
  it('a doctor-adjusted due date moves the LMP windows with it', () => {
    // LMP-based due date is 2027-04-07; the doctor says 2027-04-17 (+10 days).
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10', '2027-04-17')
    const today = '2026-09-26'
    const nt = find(planItems(s, today), 'p1-nt')
    expect(nt.start).toBe(addDays('2026-07-01', 77 + 10))
    // On that day the 임신 tab says 11주 0일, and on the last day 13주 6일.
    expect(gestationalAge(s.pregnancy!, nt.start!)).toMatchObject({ weeks: 11, days: 0 })
    expect(gestationalAge(s.pregnancy!, nt.end!)).toMatchObject({ weeks: 13, days: 6 })
    // Due-date items keep the doctor's date.
    expect(find(planItems(s, today), 'p3-maternity-leave').start).toBe(addDays('2027-04-17', -44))
  })

  it('an earlier shared tick still reads as this pregnancy’s if it came after the real LMP', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10', '2027-04-17')
    s = tickItem('p1-first-visit', true, '2026-08-10', 'b')(s)
    expect(find(planItems(s, '2026-09-26'), 'p1-first-visit').status).toBe('done')
  })
})

describe('roadmap ticks belong to one pregnancy', () => {
  it('a new pregnancy starts with open pregnancy / birth items; 임신 준비 ticks stay', () => {
    let s = startPregnancy(fresh(), '2024-01-01', '2024-02-10')
    s = tickItem('pre-hepb', true, '2023-10-01', 'a')(s)
    s = tickItem('p1-birth-hospital', true, '2024-03-01', 'a')(s)
    s = tickItem('birth-partner-leave', true, '2024-10-10', 'a')(s)
    s = recordBirth(s, { name: '첫째', birthDate: '2024-10-01', sex: 'boy' })
    expect(find(planItems(s, '2024-10-20'), 'birth-partner-leave').status).toBe('done')
    // Second pregnancy (recorded from 'preparing' again).
    s = { ...s, stage: 'preparing' }
    s = startPregnancy(s, '2026-07-01', '2026-08-10')
    const items = planItems(s, '2026-09-26')
    expect(find(items, 'p1-birth-hospital').status).not.toBe('done')
    expect(find(items, 'birth-partner-leave').status).not.toBe('done')
    expect(find(items, 'pre-hepb').status).toBe('done')
    // Ticking again records it for this pregnancy.
    s = tickItem('p1-birth-hospital', true, '2026-09-26', 'b')(s)
    expect(find(planItems(s, '2026-09-26'), 'p1-birth-hospital')).toMatchObject({ status: 'done', doneBy: 'b' })
  })
})

describe('after a loss, a new pregnancy starts fresh', () => {
  it('roadmap ticks from the ended pregnancy don’t carry over', () => {
    let s = startPregnancy(fresh(), '2026-03-01', '2026-04-10')
    s = tickItem('p1-care-center', true, '2026-05-01', 'a')(s)
    s = tickItem('p1-work-hours', true, '2026-04-12', 'b')(s)
    s = backToPreparing(s, '2026-06-01')
    s = startPregnancy(s, '2026-08-20', '2026-09-26')
    const items = planItems(s, '2026-09-26')
    expect(find(items, 'p1-care-center').status).not.toBe('done')
    expect(find(items, 'p1-work-hours').status).toBe('now') // 5주: usable again
    // The stored ticks are untouched (history stays), just not read as this pregnancy's.
    expect(Object.keys(s.planDone).sort()).toEqual(['p1-care-center', 'p1-work-hours'])
  })
})

describe('open-ended windows', () => {
  it('stay open past the due date while the baby hasn’t come yet', () => {
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10') // due 2027-04-07
    const items = planItems(s, '2027-04-12')
    for (const id of ['p3-car-seat', 'p3-hospital-bag', 'p3-postnatal-care', 'p3-maternity-leave', 'p3-weekly']) {
      expect(find(items, id).status, id).toBe('now')
      expect(find(items, id).lapsed, id).toBe(false)
    }
    expect(canSchedule(find(items, 'p3-car-seat'))).toBe(true)
    // What opened most recently comes before what opened at 6 weeks.
    const ids = planFocus(items).map((i) => i.id)
    expect(ids.indexOf('p3-postnatal-care')).toBeLessThan(ids.indexOf('p3-car-seat'))
    expect(ids.indexOf('p3-car-seat')).toBeLessThan(ids.indexOf('p1-voucher'))
  })

  it('come after windows that close in the focus card', () => {
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    const focus = planFocus(planItems(s, '2026-09-26')) // 12주 3일
    const ids = focus.map((i) => i.id)
    const firstOpenEnded = focus.findIndex((i) => !i.end)
    expect(firstOpenEnded).toBeGreaterThan(-1)
    expect(focus.slice(firstOpenEnded).every((i) => !i.end || i.status === 'soon')).toBe(true)
    expect(ids.indexOf('p1-nt')).toBeLessThan(ids.indexOf('p1-voucher'))
  })

  it('read as behind the couple once the baby is here', () => {
    let s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    s = recordBirth(s, { name: '콩이', birthDate: '2027-04-01', sex: 'girl' })
    const items = planItems(s, '2027-04-10')
    expect(find(items, 'p3-car-seat')).toMatchObject({ status: 'later', lapsed: true })
    expect(find(items, 'birth-postnatal-care').status).toBe('now')
  })
})

describe('broken dates never crash the roadmap (the 오늘 tab reads it too)', () => {
  it('treats a blank / broken anchor as not recorded yet', () => {
    const base = fresh()
    const today = '2026-09-26'
    const cases: AppState[] = [
      { ...base, stage: 'pregnant', pregnancy: { lmp: '', confirmedAt: '' } },
      { ...base, stage: 'pregnant', pregnancy: { lmp: 'garbage', confirmedAt: '2026-01-01' } },
      { ...base, stage: 'parenting', baby: { name: '콩이', birthDate: '', sex: 'girl' } },
      { ...base, customTasks: [{ id: 'c1', title: '할 일', phase: 'birth', who: 'both', createdBy: 'a', due: 'bad' }] },
    ]
    for (const s of cases) {
      expect(() => planFocus(planItems(s, today))).not.toThrow()
      expect(() => currentPhase(s, today)).not.toThrow()
    }
    const broken = planItems(cases[0]!, today)
    expect(find(broken, 'p1-nt').pending).toBe(true)
    expect(find(planItems(cases[3]!, today), 'c1').start).toBeUndefined()
  })

  it('ignores a broken doctor’s due date and dates from the LMP', () => {
    const s = startPregnancy(fresh(), '2026-07-01', '2026-08-10')
    const bad = { ...s, pregnancy: { ...s.pregnancy!, dueDateOverride: 'x' } }
    expect(find(planItems(bad, '2026-09-26'), 'p1-nt').start).toBe('2026-09-16')
  })

  it('skips appointments without a real date', () => {
    const list = [
      { id: '1', date: '', title: 'a', who: 'both' as const, kind: 'other' as const, createdBy: 'a' as const },
      { id: '2', date: '2026-10-01', title: 'b', who: 'both' as const, kind: 'other' as const, createdBy: 'a' as const, taskId: 'p1-nt' },
    ]
    expect(usableAppointments(list).map((a) => a.id)).toEqual(['2'])
    expect(linkedAppointment(list, 'p1-nt', '2026-09-26')?.id).toBe('2')
  })
})
