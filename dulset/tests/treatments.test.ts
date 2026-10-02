import { describe, expect, it } from 'vitest'
import krPrograms from '@/docs/research/kr-programs.json'
import { createInitialState } from '@/lib/initial'
import { sanitizeBackup } from '@/lib/logic/settings'
import {
  LEAVE_DAYS_PER_YEAR,
  NOTICE_VALID_MONTHS,
  NOTICE_VALID_MONTHS_FROM,
  OUTCOME_LABEL,
  PAID_LEAVE_CHANGE,
  PAID_LEAVE_DAYS,
  SUPPORT_CHECK_LINE,
  SUPPORT_SOURCE,
  SUPPORT_TOTALS,
  SUPPORT_TOTALS_VERIFIED,
  TREATMENT_LABEL,
  TREATMENT_LABEL_NEUTRAL,
  TREATMENT_NOTE_MAX,
  addLeaveDay,
  addTreatment,
  canEditTreatments,
  cleanLeaveDays,
  cleanTreatment,
  cleanTreatments,
  countsTowardSupport,
  leaveDaysOf,
  leaveLine,
  leaveSummary,
  leaveUsed,
  neutralTreatmentWords,
  noticeExpiryFrom,
  noticeLine,
  noticeStatus,
  noticeValidMonths,
  ovulationInductionLabel,
  paidDaysFor,
  removeLeaveDay,
  removeTreatment,
  showsTreatmentCounter,
  supportCountLabel,
  supportCounts,
  supportUsedLabel,
  treatmentLabel,
  treatmentWhen,
  treatmentsOf,
  updateTreatment,
} from '@/lib/logic/treatments'
import { setClinicMode } from '@/lib/logic/clinic'
import { setPersonalPref } from '@/lib/logic/prefs'
import { setAlertStyle } from '@/lib/logic/settings'
import { parseState } from '@/lib/storage'
import { TREATMENT_KINDS, TREATMENT_OUTCOMES, type AppState, type Treatment } from '@/lib/types'

const TODAY = '2026-10-02'

function fresh(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart: '2026-09-21' },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

const iui = (over: Partial<Treatment> = {}): Treatment => ({ id: 't1', kind: 'iui', startDate: '2026-08-10', ...over })

interface Finding {
  id?: string
  topic: string
  claim: string
  sources: string[]
  confidence: string
  inUI?: boolean
}
const findings = (krPrograms as { findings: Finding[] }).findings
const byId = (id: string) => findings.find((f) => f.id === id)

describe('treatments: every number has evidence in docs/research/kr-programs.json', () => {
  it('인공수정 5 · 체외수정 20 (신선·동결 통합) · 합계 25 — the merged-count finding, with a government URL', () => {
    const f = byId('ivf-count-merged-2024-02')!
    expect(f).toBeDefined()
    expect(f.inUI).toBe(true)
    expect(f.claim).toContain('체외수정 20회')
    expect(f.claim).toContain('인공수정 5회')
    expect(f.claim).toContain('25회')
    expect(f.sources.some((u) => u.includes('mohw.go.kr') || u.includes('gov.kr'))).toBe(true)
    expect(SUPPORT_TOTALS).toEqual({ iui: 5, ivf: 20, all: 25 })
    expect(SUPPORT_TOTALS.iui + SUPPORT_TOTALS.ivf).toBe(SUPPORT_TOTALS.all)
    // The older '급여 구조와 성과' finding says the same split.
    const older = findings.find((x) => x.topic.includes('급여 구조와 성과'))!
    expect(older.claim).toContain('인공수정 5회, 체외수정 20회')
    expect(f.sources).toContain(SUPPORT_SOURCE.url)
  })

  it('지원결정통지서 6개월 from 2026-01 (3개월 before)', () => {
    const f = byId('notice-valid-6-months-2026')!
    expect(f.inUI).toBe(true)
    expect(f.claim).toContain('3개월에서 6개월')
    expect(f.sources.some((u) => u.includes('korea.kr'))).toBe(true)
    expect(NOTICE_VALID_MONTHS).toEqual({ before: 3, from: 6 })
    expect(NOTICE_VALID_MONTHS_FROM).toBe('2026-01-01')
    expect(noticeValidMonths('2025-12-31')).toBe(3)
    expect(noticeValidMonths('2026-01-01')).toBe(6)
    expect(noticeExpiryFrom('2026-07-16')).toBe('2027-01-15')
    expect(noticeExpiryFrom('2025-10-01')).toBe('2025-12-31')
    expect(noticeExpiryFrom('nope')).toBeUndefined()
  })

  it('난임치료휴가 연 6일, 유급 2일 → 4일 from 2026-11-27', () => {
    const six = findings.find((x) => x.topic.startsWith('난임치료휴가(고용노동부)'))!
    expect(six.claim).toContain('6일(유급 2일')
    const four = byId('infertility-leave-paid-4-days-2026-11-27')!
    expect(four.inUI).toBe(true)
    expect(four.claim).toContain('2026년 11월 27일')
    expect(four.claim).toContain('2일에서 최초 4일')
    expect(LEAVE_DAYS_PER_YEAR).toBe(6)
    expect(PAID_LEAVE_CHANGE).toBe('2026-11-27')
    expect(PAID_LEAVE_DAYS).toEqual({ before: 2, from: 4 })
    expect(paidDaysFor('2026-11-26')).toBe(2)
    expect(paidDaysFor('2026-11-27')).toBe(4)
    expect(paidDaysFor('2027-03-01')).toBe(4)
  })

  it('labels: no banned words, no 실패, a label for every kind and outcome', () => {
    for (const k of TREATMENT_KINDS) expect(TREATMENT_LABEL[k]).toBeTruthy()
    for (const o of TREATMENT_OUTCOMES) expect(OUTCOME_LABEL[o]).toBeTruthy()
    const all = [...Object.values(TREATMENT_LABEL), ...Object.values(OUTCOME_LABEL)].join(' ')
    for (const banned of ['숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '성공률']) expect(all).not.toContain(banned)
  })
})

describe('treatments: add / update / remove', () => {
  it('adds with a generated id, sorted oldest first, and never leaves an empty list', () => {
    let s = fresh()
    expect('treatments' in s).toBe(false)
    s = addTreatment(s, { kind: 'ivf-fresh', startDate: '2026-09-01', outcome: 'ongoing' })
    s = addTreatment(s, { kind: 'iui', startDate: '2026-07-01', endDate: '2026-07-28', outcome: 'negative', supported: true })
    expect(treatmentsOf(s).map((t) => t.kind)).toEqual(['iui', 'ivf-fresh'])
    expect(treatmentsOf(s).every((t) => typeof t.id === 'string' && t.id.length > 0)).toBe(true)
    const [first, second] = treatmentsOf(s)
    s = removeTreatment(s, first!.id)
    expect(treatmentsOf(s)).toHaveLength(1)
    s = removeTreatment(s, second!.id)
    expect('treatments' in s).toBe(false)
    expect(removeTreatment(s, 'nope')).toBe(s)
  })

  it('rejects an unknown kind, a bad start date, or a duplicate id (same state object)', () => {
    const s = fresh()
    expect(addTreatment(s, { kind: 'icsi' as never, startDate: '2026-09-01' })).toBe(s)
    expect(addTreatment(s, { kind: 'iui', startDate: '2026-02-30' })).toBe(s)
    const one = addTreatment(s, { id: 'x', kind: 'iui', startDate: '2026-09-01' })
    expect(addTreatment(one, { id: 'x', kind: 'ivf-frozen', startDate: '2026-09-02' })).toBe(one)
  })

  it('cleans optional fields on the way in (end before start, bad outcome, long note, non-boolean supported)', () => {
    const s = addTreatment(fresh(), {
      id: 't',
      kind: 'ivf-frozen',
      startDate: '2026-09-10',
      endDate: '2026-09-01',
      outcome: 'maybe' as never,
      supported: 'yes' as never,
      noticeExpires: '2026-13-01',
      note: `  ${'가'.repeat(200)}  `,
    })
    const t = treatmentsOf(s)[0]!
    expect(t).toEqual({ id: 't', kind: 'ivf-frozen', startDate: '2026-09-10', note: '가'.repeat(TREATMENT_NOTE_MAX) })
  })

  it('updates field by field: undefined clears, absent keeps, a bad value is ignored, no change → same object', () => {
    let s = addTreatment(fresh(), iui({ supported: true, note: '첫 회차' }))
    s = updateTreatment(s, 't1', { outcome: 'negative', endDate: '2026-09-05' })
    expect(treatmentsOf(s)[0]).toEqual(iui({ supported: true, note: '첫 회차', outcome: 'negative', endDate: '2026-09-05' }))
    const same = updateTreatment(s, 't1', { outcome: 'negative' })
    expect(same).toBe(s)
    s = updateTreatment(s, 't1', { note: undefined, supported: undefined })
    expect(treatmentsOf(s)[0]).toEqual(iui({ outcome: 'negative', endDate: '2026-09-05' }))
    // kind / startDate can't be cleared or broken.
    s = updateTreatment(s, 't1', { kind: undefined, startDate: 'nope' })
    expect(treatmentsOf(s)[0]!.kind).toBe('iui')
    expect(treatmentsOf(s)[0]!.startDate).toBe('2026-08-10')
    // Moving the start before the end drops the end (cleanTreatment rule) and re-sorts.
    s = addTreatment(s, { id: 't0', kind: 'iui', startDate: '2026-06-01' })
    s = updateTreatment(s, 't1', { startDate: '2026-05-01', endDate: '2026-04-01' })
    expect(treatmentsOf(s).map((t) => t.id)).toEqual(['t1', 't0'])
    expect(treatmentsOf(s)[0]!.endDate).toBeUndefined()
    expect(updateTreatment(s, 'missing', { outcome: 'positive' })).toBe(s)
  })
})

describe('supportCounts: used / total with the verified denominators only', () => {
  it('counts supported, not-cancelled attempts; 신선 + 동결 share the 20; 배란유도 has no denominator', () => {
    let s = fresh()
    s = addTreatment(s, { id: 'a', kind: 'iui', startDate: '2026-01-05', outcome: 'negative', supported: true })
    s = addTreatment(s, { id: 'b', kind: 'iui', startDate: '2026-02-05', outcome: 'negative', supported: false }) // 자비
    s = addTreatment(s, { id: 'c', kind: 'ivf-fresh', startDate: '2026-04-05', outcome: 'cancelled', supported: true }) // 미차감
    s = addTreatment(s, { id: 'd', kind: 'ivf-fresh', startDate: '2026-05-05', outcome: 'negative', supported: true })
    s = addTreatment(s, { id: 'e', kind: 'ivf-frozen', startDate: '2026-07-05', outcome: 'ongoing', supported: true })
    s = addTreatment(s, { id: 'f', kind: 'ovulation-induction', startDate: '2025-11-05', outcome: 'negative', supported: true })
    s = addTreatment(s, { id: 'g', kind: 'iui', startDate: '2026-09-05' }) // supported unknown → not counted
    const c = supportCounts(s)
    expect(c.iui).toEqual({ used: 1, total: 5, denominatorUnknown: false })
    expect(c.ivf).toEqual({ used: 2, total: 20, denominatorUnknown: false })
    expect(c.all).toEqual({ used: 3, total: 25, denominatorUnknown: false })
    expect(c.ovulationInduction).toEqual({ used: 1, denominatorUnknown: true })
    expect(c.byKind).toEqual({ 'ovulation-induction': 1, iui: 1, 'ivf-fresh': 1, 'ivf-frozen': 1 })
    expect(c.since).toBeUndefined()
    expect(supportCountLabel(c.iui)).toBe('1/5')
    expect(supportCountLabel(c.ovulationInduction)).toBe('1회')
    expect(countsTowardSupport({ supported: true, outcome: 'cancelled' })).toBe(false)
    expect(countsTowardSupport({ supported: true })).toBe(true)
    expect(countsTowardSupport({})).toBe(false)
  })

  it('starts over after a birth (출산당): only attempts after the birth count', () => {
    let s = fresh()
    s = addTreatment(s, { id: 'a', kind: 'ivf-fresh', startDate: '2024-03-01', outcome: 'positive', supported: true })
    s = addTreatment(s, { id: 'b', kind: 'ivf-frozen', startDate: '2026-08-01', outcome: 'negative', supported: true })
    const withBaby: AppState = { ...s, baby: { name: '콩이', birthDate: '2024-12-01', sex: 'girl' } }
    const c = supportCounts(withBaby)
    expect(c.ivf.used).toBe(1)
    expect(c.all.used).toBe(1)
    expect(c.since).toBe('2024-12-01')
    expect(supportCounts(s).ivf.used).toBe(2)
  })

  it('is all zeros without attempts', () => {
    const c = supportCounts(fresh())
    expect(c.all).toEqual({ used: 0, total: 25, denominatorUnknown: false })
    expect(c.byKind).toEqual({ 'ovulation-induction': 0, iui: 0, 'ivf-fresh': 0, 'ivf-frozen': 0 })
  })
})

describe('noticeStatus', () => {
  it('reports the newest notice with days left, expired when past, nothing without one', () => {
    let s = fresh()
    expect(noticeStatus(s, TODAY)).toBeUndefined()
    s = addTreatment(s, { id: 'a', kind: 'iui', startDate: '2026-03-01', noticeExpires: '2026-08-31' })
    expect(noticeStatus(s, TODAY)).toEqual({ treatmentId: 'a', expires: '2026-08-31', daysLeft: -32, expired: true })
    s = addTreatment(s, { id: 'b', kind: 'iui', startDate: '2026-09-01', noticeExpires: '2027-01-15' })
    expect(noticeStatus(s, TODAY)).toEqual({ treatmentId: 'b', expires: '2027-01-15', daysLeft: 105, expired: false })
    expect(noticeStatus(s, '2027-01-15')!.daysLeft).toBe(0)
    expect(noticeStatus(s, '2027-01-15')!.expired).toBe(false)
    s = addTreatment(s, { id: 'c', kind: 'ivf-fresh', startDate: '2026-09-20' }) // no notice → ignored
    expect(noticeStatus(s, TODAY)!.treatmentId).toBe('b')
  })
})

describe('난임치료휴가: per person, per year', () => {
  it('adds, dedupes, sorts, removes; counts by calendar year; summary with paid days', () => {
    let s = fresh()
    expect('leaveDays' in s).toBe(false)
    s = addLeaveDay(s, 'a', '2026-09-14')
    s = addLeaveDay(s, 'a', '2026-03-02')
    s = addLeaveDay(s, 'a', '2026-09-14') // again → no-op
    s = addLeaveDay(s, 'a', '2025-12-30')
    s = addLeaveDay(s, 'b', '2026-09-14')
    expect(leaveDaysOf(s, 'a').map((d) => d.date)).toEqual(['2025-12-30', '2026-03-02', '2026-09-14'])
    expect(leaveDaysOf(s, 'a').every((d) => d.kind === 'infertility')).toBe(true)
    expect(leaveUsed(s, 'a', 2026)).toBe(2)
    expect(leaveUsed(s, 'a', 2025)).toBe(1)
    expect(leaveUsed(s, 'b', 2026)).toBe(1)
    expect(leaveSummary(s, 'a', TODAY)).toEqual({ year: 2026, used: 2, total: 6, paid: 2, paidChangesOn: '2026-11-27' })
    expect(leaveSummary(s, 'a', '2026-12-01')).toEqual({ year: 2026, used: 2, total: 6, paid: 4 })
    expect(addLeaveDay(s, 'a', '2026-02-30')).toBe(s)
    expect(addLeaveDay(s, 'a', '2026-02-10', 'sick' as never)).toBe(s)
    s = removeLeaveDay(s, 'a', '2026-03-02')
    expect(leaveUsed(s, 'a', 2026)).toBe(1)
    expect(removeLeaveDay(s, 'a', '2026-03-02')).toBe(s)
    s = removeLeaveDay(s, 'b', '2026-09-14')
    expect(s.leaveDays!.b).toBeUndefined()
    s = removeLeaveDay(removeLeaveDay(s, 'a', '2025-12-30'), 'a', '2026-09-14')
    expect('leaveDays' in s).toBe(false)
  })
})

describe('cleaning (a backup, an older save)', () => {
  it('cleanTreatment: required id/kind/startDate, optional fields only when usable, unknown fields dropped', () => {
    expect(cleanTreatment(null)).toBeNull()
    expect(cleanTreatment({ id: '', kind: 'iui', startDate: '2026-01-01' })).toBeNull()
    expect(cleanTreatment({ id: 'x', kind: 'iui', startDate: '2026-01-32' })).toBeNull()
    expect(
      cleanTreatment({
        id: 'x',
        kind: 'ivf-fresh',
        startDate: '2026-01-10',
        endDate: '2026-01-09',
        outcome: 'negative',
        supported: 1,
        noticeExpires: '2026-05-05',
        note: 42,
        extra: true,
      }),
    ).toEqual({ id: 'x', kind: 'ivf-fresh', startDate: '2026-01-10', outcome: 'negative', noticeExpires: '2026-05-05' })
  })

  it('cleanTreatments: valid only, one per id, oldest first, undefined when empty', () => {
    expect(cleanTreatments(undefined)).toBeUndefined()
    expect(cleanTreatments('nope')).toBeUndefined()
    expect(cleanTreatments([])).toBeUndefined()
    expect(cleanTreatments([{ id: 'x', kind: 'nope', startDate: '2026-01-01' }])).toBeUndefined()
    const out = cleanTreatments([
      { id: 'b', kind: 'iui', startDate: '2026-03-01' },
      { id: 'a', kind: 'iui', startDate: '2026-01-01' },
      { id: 'b', kind: 'ivf-fresh', startDate: '2026-02-01' },
      null,
    ])!
    expect(out.map((t) => t.id)).toEqual(['a', 'b'])
    expect(out[1]!.kind).toBe('iui')
  })

  it('cleanLeaveDays: a/b only, real dates, known kind, unique, sorted; undefined when empty', () => {
    expect(cleanLeaveDays(undefined)).toBeUndefined()
    expect(cleanLeaveDays([])).toBeUndefined()
    expect(cleanLeaveDays({ a: [] })).toBeUndefined()
    expect(
      cleanLeaveDays({
        a: [
          { date: '2026-09-14', kind: 'infertility' },
          { date: '2026-03-02', kind: 'infertility' },
          { date: '2026-09-14', kind: 'infertility' },
          { date: '2026-02-30', kind: 'infertility' },
          { date: '2026-04-01', kind: 'sick' },
        ],
        c: [{ date: '2026-09-14', kind: 'infertility' }],
        b: 'nope',
      }),
    ).toEqual({ a: [{ date: '2026-03-02', kind: 'infertility' }, { date: '2026-09-14', kind: 'infertility' }] })
  })

  it('round-trips through a backup and a reload; broken lists are repaired, empty ones dropped', () => {
    let s = fresh()
    s = addTreatment(s, { id: 'a', kind: 'iui', startDate: '2026-07-01', endDate: '2026-07-28', outcome: 'negative', supported: true, noticeExpires: '2027-01-15', note: '첫 회차' })
    s = addLeaveDay(s, 'a', '2026-07-14')
    const raw = JSON.stringify(s)
    expect(sanitizeBackup(JSON.parse(raw))).toEqual(JSON.parse(raw))
    expect(parseState(raw)).toEqual(JSON.parse(raw))
    const broken = { ...JSON.parse(raw), treatments: [{ id: 'a', kind: 'icsi', startDate: '2026-07-01' }, 'x'], leaveDays: { a: [], z: [{ date: '2026-07-14', kind: 'infertility' }] } }
    const back = sanitizeBackup(broken)!
    expect('treatments' in back).toBe(false)
    expect('leaveDays' in back).toBe(false)
    // An older save without the fields is untouched.
    const legacy = JSON.parse(JSON.stringify(fresh()))
    expect(parseState(JSON.stringify(legacy))).toEqual(legacy)
  })
})

// ── Next B — B2: what the counter card may say ───────────────

const BANNED = ['숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '성공률', '정확한', '진단']

describe('counter screen: denominators only while treatments.ts says they are verified', () => {
  it('SUPPORT_TOTALS_VERIFIED follows the research finding that is inUI', () => {
    expect(SUPPORT_TOTALS_VERIFIED).toBe(byId('ivf-count-merged-2024-02')!.inUI === true)
  })

  it('with the flag on: N/5회 사용; with it off: N회 사용 + the 보건소 line, no number anywhere', () => {
    let s = fresh()
    s = addTreatment(s, { id: 'a', kind: 'iui', startDate: '2026-01-05', outcome: 'negative', supported: true })
    s = addTreatment(s, { id: 'b', kind: 'ivf-frozen', startDate: '2026-05-05', outcome: 'negative', supported: true })
    const on = supportCounts(s, { verified: true })
    expect(supportUsedLabel(on.iui)).toBe('1/5회 사용')
    expect(supportUsedLabel(on.ivf)).toBe('1/20회 사용')
    expect(supportUsedLabel(on.all)).toBe('2/25회 사용')
    const off = supportCounts(s, { verified: false })
    for (const c of [off.iui, off.ivf, off.all]) {
      expect(c.total).toBeUndefined()
      expect(c.denominatorUnknown).toBe(true)
    }
    expect(supportUsedLabel(off.iui)).toBe(`1회 사용 · ${SUPPORT_CHECK_LINE}`)
    expect(supportUsedLabel(off.all)).not.toMatch(/\/(5|20|25)/)
    expect(supportCountLabel(off.all)).toBe('2회')
    // The default is the flag.
    expect(supportCounts(s)).toEqual(supportCounts(s, { verified: SUPPORT_TOTALS_VERIFIED }))
  })

  it('배란유도 is counted but never against the 25', () => {
    const s = addTreatment(fresh(), { id: 'f', kind: 'ovulation-induction', startDate: '2026-02-01', supported: true })
    const c = supportCounts(s)
    expect(ovulationInductionLabel(c.ovulationInduction)).toBe('1회 · 지원 횟수 밖')
    expect(c.all.used).toBe(0)
  })
})

describe('counter screen: the lens on the labels', () => {
  it('neutral labels carry no 배란 / 가임기 / LH word; the explicit ones keep the procedure name', () => {
    for (const k of TREATMENT_KINDS) {
      expect(TREATMENT_LABEL_NEUTRAL[k]).toBeTruthy()
      for (const w of ['배란', '가임기', 'LH']) expect(TREATMENT_LABEL_NEUTRAL[k]).not.toContain(w)
      expect(treatmentLabel(k, true)).toBe(TREATMENT_LABEL_NEUTRAL[k])
      expect(treatmentLabel(k)).toBe(TREATMENT_LABEL[k])
    }
    expect(treatmentLabel('ovulation-induction')).toBe('배란유도')
    expect(treatmentLabel('iui', true)).toBe('인공수정')
  })

  it('explicit → the name; soft / off / 부담 줄이기 (mine or the couple\'s) → neutral; unknown → neutral', () => {
    let s = fresh()
    s = setAlertStyle(s, 'b', 'explicit')
    s = setAlertStyle(s, 'a', 'soft')
    expect(neutralTreatmentWords(s.settings, 'b')).toBe(false)
    expect(neutralTreatmentWords(s.settings, 'a')).toBe(true)
    expect(neutralTreatmentWords(setAlertStyle(s, 'b', 'off').settings, 'b')).toBe(true)
    expect(neutralTreatmentWords(setPersonalPref(s, 'b', 'lowPressure', true).settings, 'b')).toBe(true)
    expect(neutralTreatmentWords({ ...s.settings, lowPressure: true }, 'b')).toBe(true)
    expect(neutralTreatmentWords({ ...s.settings, alertStyle: undefined as never }, 'b')).toBe(true)
  })
})

describe('counter screen: the lines', () => {
  it('noticeLine: D-N while valid, 오늘까지 on the day, 만료 after', () => {
    expect(noticeLine({ expires: '2027-01-15', daysLeft: 105, expired: false })).toBe('1월 15일 (금)까지 · D-105')
    expect(noticeLine({ expires: '2026-10-02', daysLeft: 0, expired: false })).toBe('오늘까지예요')
    expect(noticeLine({ expires: '2026-08-31', daysLeft: -32, expired: true })).toBe('8월 31일 (월)에 만료됐어요')
  })

  it('treatmentWhen: both dates, start only, and the start alone when the end must stay out of sight', () => {
    const t = { startDate: '2026-08-10', endDate: '2026-08-25' }
    expect(treatmentWhen(t, TODAY)).toBe('8.10 ~ 8.25')
    expect(treatmentWhen({ startDate: '2026-08-10' }, TODAY)).toBe('8.10부터')
    expect(treatmentWhen(t, TODAY, false)).toBe('8.10')
    expect(treatmentWhen({ startDate: '2025-12-30', endDate: '2025-12-30' }, TODAY)).toBe('2025.12.30')
  })

  it('leaveLine: N/6일 · 유급 M일, with the 2026-11-27 change while it is still ahead', () => {
    let s = addLeaveDay(fresh(), 'a', '2026-09-14')
    expect(leaveLine(leaveSummary(s, 'a', TODAY))).toBe('1/6일 · 유급 2일 (2026년 11월 27일부터 4일)')
    expect(leaveLine(leaveSummary(s, 'a', '2026-11-27'))).toBe('1/6일 · 유급 4일')
    s = addLeaveDay(s, 'a', '2027-01-04')
    expect(leaveLine(leaveSummary(s, 'a', '2027-01-10'))).toBe('1/6일 · 유급 4일')
  })

  it('no banned words in any line', () => {
    const s = addTreatment(fresh(), { id: 'a', kind: 'iui', startDate: '2026-01-05', outcome: 'negative', supported: true })
    const c = supportCounts(s)
    const lines = [
      supportUsedLabel(c.iui),
      supportUsedLabel(supportCounts(s, { verified: false }).iui),
      ovulationInductionLabel(c.ovulationInduction),
      noticeLine({ expires: '2027-01-15', daysLeft: 105, expired: false }),
      noticeLine({ expires: '2026-08-31', daysLeft: -32, expired: true }),
      leaveLine(leaveSummary(s, 'a', TODAY)),
      SUPPORT_CHECK_LINE,
      ...Object.values(TREATMENT_LABEL_NEUTRAL),
    ].join(' ')
    for (const w of BANNED) expect(lines).not.toContain(w)
  })
})

describe('counter screen: when it shows and who edits', () => {
  it('preparing + clinic mode, or anything logged; never in another stage', () => {
    const s = fresh()
    expect(showsTreatmentCounter(s)).toBe(false)
    expect(showsTreatmentCounter(setClinicMode(s, true, TODAY))).toBe(true)
    expect(showsTreatmentCounter(addTreatment(s, { kind: 'iui', startDate: '2026-08-10' }))).toBe(true)
    expect(showsTreatmentCounter(addLeaveDay(s, 'a', '2026-08-10'))).toBe(true)
    const pregnant = { ...addTreatment(s, { kind: 'iui', startDate: '2026-08-10' }), stage: 'pregnant' as const }
    expect(showsTreatmentCounter(pregnant)).toBe(false)
  })

  it('only the cycle owner logs attempts', () => {
    const s = fresh()
    expect(canEditTreatments(s, 'b')).toBe(true)
    expect(canEditTreatments(s, 'a')).toBe(false)
  })
})
