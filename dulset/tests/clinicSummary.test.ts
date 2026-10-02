import { describe, expect, it } from 'vitest'
// The model first: it enters the lib graph through content/roadmap, so this
// file does not depend on the order lib/demo → lib/initial loads the rest.
import {
  CLINIC_APPOINTMENT_MONTHS,
  CLINIC_SUMMARY_CYCLES,
  CLINIC_SUMMARY_HEADER,
  CLINIC_SUMMARY_NOTES,
  CLINIC_SUMMARY_PRIVACY_NOTE,
  canBuildClinicSummary,
  clinicSummary,
  preconceptionCheckupTemplates,
  summaryWho,
  type ClinicSummary,
} from '@/lib/logic/clinicSummary'
import { addDays, addMonths } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { addCheckItem } from '@/lib/logic/checks'
import { startClinicMode } from '@/lib/logic/clinic'
import {
  CLINIC_SUMMARY_FILENAME,
  buildClinicSummaryHtml,
  buildClinicSummaryText,
  lengthText,
  lhText,
  summarySections,
  testsText,
} from '@/lib/logic/clinicSummaryExport'
import { addPeriod } from '@/lib/logic/cycle'
import { addEntry } from '@/lib/logic/diary'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { setShareCycleDetails } from '@/lib/logic/prefs'
import { addTreatment } from '@/lib/logic/treatments'
import type { AppState } from '@/lib/types'

const TODAY = '2026-10-02'
const NOW = new Date(2026, 9, 2, 14, 30)

/** The preparing demo as of 2026-10-02: 지은 (b) owns the cycle, 민수 (a) is the partner. */
function demo(): AppState {
  return createDemoState(TODAY, NOW, 'preparing')
}

function fresh(lastPeriodStart?: string): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart, ttcStart: '2026-06-02' },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

function own(s: AppState = demo()): ClinicSummary {
  const out = clinicSummary(s, 'b', TODAY)
  expect(out).not.toBeNull()
  return out!
}

/** Words that would read as a diagnosis, a judgement or pressure — never in anything the clinic sees. */
const BANNED = ['진단', '불규칙', '무월경', '유산', '착상', '성공률', '숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '가임기', '배란일', '정확한']

describe('clinicSummary: who may build it', () => {
  it('the owner always; the partner only once the owner shared the details', () => {
    const s = demo()
    expect(canBuildClinicSummary(s, 'b')).toBe(true)
    expect(canBuildClinicSummary(s, 'a')).toBe(false)
    expect(clinicSummary(s, 'a', TODAY)).toBeNull()
    const shared = setShareCycleDetails(s, 'b', true)
    expect(canBuildClinicSummary(shared, 'a')).toBe(true)
    expect(clinicSummary(shared, 'a', TODAY)).toEqual(clinicSummary(shared, 'b', TODAY))
  })
})

describe('clinicSummary: the demo couple as of 2026-10-02', () => {
  it('header, people, 준비 기간', () => {
    const s = own()
    expect(s.header).toBe(CLINIC_SUMMARY_HEADER)
    expect(s.header).toBe('둘셋 기록 요약 · 병원에 보여 주는 용도 · 예상은 참고용')
    expect(s.generatedOn).toBe(TODAY)
    expect(s.owner).toEqual({ id: 'b', name: '지은', role: '아내', birthYear: 1994, age: 32, cycleOwner: true })
    expect(s.partner).toEqual({ id: 'a', name: '민수', role: '남편', birthYear: 1992, age: 34, cycleOwner: false })
    // Trying began in the (unlogged) cycle before the first logged start, so that one is #1 and the logs are #2–#5.
    expect(s.ttc).toEqual({ start: addMonths(TODAY, -4), months: 4, cycles: 5, cyclesEstimated: false })
    expect(s.clinicSince).toBeUndefined()
    expect(s.notes).toBe(CLINIC_SUMMARY_NOTES)
    expect(summaryWho(s, 'a')).toBe('민수')
    expect(summaryWho(s, 'b')).toBe('지은')
    expect(summaryWho(s, 'both')).toBe('둘이 함께')
  })

  it('cycle table: newest first, length, bleeding days, first LH 양성 day, 임테기 results', () => {
    const s = own()
    const last = addDays(TODAY, -11)
    const prev = addDays(last, -28)
    const before = addDays(last, -57)
    const first = addDays(last, -85)
    expect(s.totalCycles).toBe(4)
    expect(s.cycles.map((r) => r.start)).toEqual([last, prev, before, first])
    expect(s.cycles.map((r) => r.n)).toEqual([5, 4, 3, 2])
    // The running cycle: no length yet, day 12, strips but no surge yet.
    const cur = s.cycles[0]!
    expect(cur.length).toBeUndefined()
    expect(cur.runningDay).toBe(12)
    expect(cur.bleedDays).toBe(5)
    expect(cur.lh).toEqual({ tests: 3 })
    expect(cur.tests).toEqual([])
    expect(lhText(cur)).toBe('3회 · 아직 양성 없음')
    expect(lengthText(cur)).toBe('진행 중 · 12일째')
    // Last cycle: 28 days, surge on day 13, two negative tests on days 25 and 28.
    const p = s.cycles[1]!
    expect(p.length).toBe(28)
    expect(p.bleedDays).toBe(4)
    expect(p.lh).toEqual({ tests: 5, surgeDay: 13, surgeDate: addDays(prev, 12) })
    expect(p.tests).toEqual([
      { date: addDays(prev, 24), cycleDay: 25, result: 'negative' },
      { date: addDays(prev, 27), cycleDay: 28, result: 'negative' },
    ])
    expect(testsText(p)).toBe('음성 25일째 · 음성 28일째')
    expect(lhText(p)).toBe(`첫 양성 13일째 (${addDays(prev, 12)})`)
    // The cycle before: 29 days, surge on day 14.
    const b = s.cycles[2]!
    expect(b.length).toBe(29)
    expect(b.lh).toEqual({ tests: 5, surgeDay: 14, surgeDate: addDays(before, 13) })
    // The first cycle had no strips at all.
    expect(s.cycles[3]!.lh).toBeUndefined()
    expect(lhText(s.cycles[3]!)).toBe('—')
    expect(testsText(s.cycles[3]!)).toBe('—')
  })

  it('average and range with what they rest on — numbers only, no reading of them', () => {
    const s = own()
    expect(s.stats).toEqual({ average: 28, min: 28, max: 29, count: 3, source: 'logs', confidence: 'cycles', basis: '기록 3주기 기준' })
    expect(JSON.stringify(s)).not.toContain('irregular')
  })

  it('medications: active supplements and medications of both people, never habits', () => {
    const s = own()
    expect(s.medications.map((m) => [m.member, m.label, m.note])).toEqual([
      ['b', '엽산', '400µg'],
      ['b', '비타민 D', '선택'],
    ])
    expect(s.medications.every((m) => m.since === addMonths(TODAY, -4))).toBe(true)
    expect(JSON.stringify(s.medications)).not.toContain('걷기')
  })

  it('임신 전 검사·접종 ticked in 챙길 것, dated; the 지원 신청 once per person', () => {
    const s = own()
    const ids = preconceptionCheckupTemplates().map((t) => t.id)
    expect(ids).toContain('pre-checkup-carrier')
    expect(ids).toContain('pre-rubella')
    expect(ids).not.toContain('pre-folic')
    expect(ids).not.toContain('pre-dental')
    const applied = addDays(TODAY, -9)
    expect(s.checkups.map((c) => [c.id, c.doneAt, c.member])).toEqual([
      ['pre-rubella', addMonths(TODAY, -4), 'b'],
      ['pre-health-check-support', applied, 'b'],
      ['pre-health-check-support', applied, 'a'],
    ])
    expect(s.checkups[0]!.title).toBe('풍진(MMR) 항체 확인·접종')
    expect(s.checkups[0]!.kind).toBe('vaccine')
  })

  it('appointments of the last 6 months only (not the ones ahead, not older ones)', () => {
    let s = demo()
    s = addAppointment(s, { date: addMonths(TODAY, -7), title: '오래된 검진', who: 'b', kind: 'hospital' }, 'b')
    s = addAppointment(s, { date: addMonths(TODAY, -5), time: '10:00', title: '다섯 달 전 검사', who: 'b', kind: 'test', place: '동네 산부인과' }, 'b')
    const out = own(s)
    expect(out.appointments.map((a) => a.title)).toEqual(['보건소 임신 사전건강관리 신청', '다섯 달 전 검사'])
    expect(out.appointments[0]).toMatchObject({ date: addDays(TODAY, -9), time: '09:30', kindLabel: '신청·행정', who: 'both', done: true })
    expect(out.appointments[1]).toMatchObject({ time: '10:00', kindLabel: '검사', place: '동네 산부인과', who: 'b', done: false })
    expect(s.appointments.some((a) => a.date > TODAY)).toBe(true)
    expect(out.appointments.every((a) => a.date <= TODAY && a.date >= addMonths(TODAY, -CLINIC_APPOINTMENT_MONTHS))).toBe(true)
  })

  it('treatments without their note, the 지원 count, and 난임치료휴가 per person', () => {
    const s = own()
    const last = addDays(TODAY, -11)
    const before = addDays(last, -57)
    expect(s.treatments).toEqual([
      { kind: 'iui', startDate: addDays(before, 15), endDate: addDays(last, -28), outcome: 'negative', supported: true, noticeExpires: '2027-01-15' },
    ])
    expect(JSON.stringify(s)).not.toContain('첫 회차')
    expect(s.support!.iui).toEqual({ used: 1, total: 5, denominatorUnknown: false })
    expect(s.support!.all.used).toBe(1)
    expect(s.leave).toEqual([{ member: 'a', year: 2026, used: 1, total: 6 }])
  })

  it('병원과 함께 준비 중 since the day it was turned on', () => {
    const s = own(startClinicMode(demo(), '2026-09-25'))
    expect(s.clinicSince).toBe('2026-09-25')
    expect(buildClinicSummaryText(s)).toContain('병원과 함께 준비 중: 2026-09-25부터')
  })

  it('is deterministic', () => {
    const a = own()
    const b = own()
    expect(a).toEqual(b)
    expect(buildClinicSummaryHtml(a)).toBe(buildClinicSummaryHtml(b))
    expect(buildClinicSummaryText(a)).toBe(buildClinicSummaryText(b))
  })
})

describe('clinicSummary: edge cases', () => {
  it('a couple with no period yet: no cycles, no stats, still people and medications', () => {
    const s = own(fresh())
    expect(s.cycles).toEqual([])
    expect(s.totalCycles).toBe(0)
    expect(s.stats).toBeUndefined()
    expect(s.ttc).toEqual({ start: '2026-06-02', months: 4, cyclesEstimated: false })
    expect(s.owner.age).toBeUndefined()
    const text = buildClinicSummaryText(s)
    expect(text).toContain('아직 기록한 생리 시작일이 없어요')
    expect(text).toContain('나이 미입력')
    expect(buildClinicSummaryHtml(s)).toContain('아직 기록한 생리 시작일이 없어요')
  })

  it('a long gap between two starts is shown as a gap, never as a cycle length', () => {
    let s = fresh('2026-03-01')
    s = addPeriod(s, '2026-06-10', undefined, 'b') // 101 days later: not one cycle
    s = addPeriod(s, '2026-09-21', '2026-09-25', 'b')
    const out = own(s)
    const gap = out.cycles.find((r) => r.start === '2026-03-01')!
    expect(gap.length).toBeUndefined()
    expect(gap.gapDays).toBe(101)
    expect(lengthText(gap)).toBe('간격 101일 (기록 없는 기간일 수 있어요)')
    expect(out.ttc!.cyclesEstimated).toBe(true)
    expect(buildClinicSummaryText(out)).toContain('약 ')
  })

  it('keeps at most CLINIC_SUMMARY_CYCLES rows and says how many there are in all', () => {
    let s = fresh()
    for (let i = 0; i < 15; i++) s = addPeriod(s, addDays('2026-09-21', -28 * i), undefined, 'b')
    const out = own(s)
    expect(out.totalCycles).toBe(15)
    expect(out.cycles).toHaveLength(CLINIC_SUMMARY_CYCLES)
    expect(out.cycles[0]!.start).toBe('2026-09-21')
    expect(buildClinicSummaryText(out)).toContain(`기록된 주기 15개 중 최근 ${CLINIC_SUMMARY_CYCLES}개예요.`)
  })

  it('includeLH: false leaves every LH word and surge out — the basis too', () => {
    const s = clinicSummary(demo(), 'b', TODAY, { includeLH: false })!
    expect(s.includesLH).toBe(false)
    expect(s.cycles.every((r) => r.lh === undefined)).toBe(true)
    expect(s.stats!.confidence).not.toBe('lh')
    expect(JSON.stringify(s)).not.toContain('"lh"')
    expect(JSON.stringify(s)).not.toContain('surge')
    for (const out of [buildClinicSummaryText(s), buildClinicSummaryHtml(s)]) {
      expect(out).not.toContain('LH')
      expect(out).not.toContain('양성')
    }
  })

  it('a treatment of every kind reads with its own name and the outcome words', () => {
    let s = fresh('2026-09-21')
    s = addTreatment(s, { id: 'o', kind: 'ovulation-induction', startDate: '2026-04-01', endDate: '2026-04-28', outcome: 'negative', supported: true })
    s = addTreatment(s, { id: 'f', kind: 'ivf-fresh', startDate: '2026-06-01', outcome: 'cancelled', supported: true, note: '채취 전 중단 · 비밀' })
    s = addTreatment(s, { id: 'z', kind: 'ivf-frozen', startDate: '2026-08-01', outcome: 'ongoing', supported: false })
    const text = buildClinicSummaryText(own(s))
    expect(text).toContain('배란유도 · 2026-04-01 ~ 2026-04-28 · 음성 · 지원 회차')
    expect(text).toContain('체외수정 (신선배아) · 2026-06-01 · 중단 · 지원 회차')
    expect(text).toContain('체외수정 (동결배아) · 2026-08-01 · 진행 중 · 본인 부담')
    expect(text).toContain('인공수정 0/5 · 체외수정 0/20 · 합계 0/25 · 배란유도 1회')
    expect(text).not.toContain('비밀')
  })
})

describe('clinicSummary: nothing private ever reaches it', () => {
  function withPrivate(): AppState {
    let s = demo()
    s = setFeel(s, 'b', TODAY, 'nausea')
    s = setPrivateNote(s, 'b', TODAY, '오늘은 아무에게도 말하고 싶지 않아요')
    s = setFeel(s, 'a', TODAY, 'tired')
    s = addEntry(s, { date: TODAY, author: 'b', text: '나만 보는 글이에요', stage: 'preparing' }, '2026-10-02T10:00:00+09:00')
    s = setEntryPrivacy(s, s.diary[s.diary.length - 1]!.id, 'b', true)
    s = giveIntimacyConsent(s, 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-07-04')
    return s
  }

  it('the summary is the same with or without personalLog, 나만 보기 entries, intimacy and cycle notes', () => {
    const s = withPrivate()
    const { personalLog: _p, intimacy: _i, cycleNotes: _c, ...rest } = s
    const stripped: AppState = { ...rest, diary: [] }
    expect(clinicSummary(s, 'b', TODAY)).toEqual(clinicSummary(stripped, 'b', TODAY))
    expect(clinicSummary(setShareCycleDetails(s, 'b', true), 'a', TODAY)).toEqual(clinicSummary(stripped, 'b', TODAY))
  })

  it('no feel chip, private line, diary text or 관계일 in the model, the text or the file', () => {
    const s = withPrivate()
    const summary = clinicSummary(s, 'b', TODAY)!
    const outputs = [JSON.stringify(summary), buildClinicSummaryText(summary), buildClinicSummaryHtml(summary)]
    for (const out of outputs) {
      expect(out).not.toContain('말하고 싶지 않아요')
      expect(out).not.toContain('나만 보는 글')
      expect(out).not.toContain('아직 이를 수 있으니') // the demo's own private line
      expect(out).not.toContain('2026-07-04')
      for (const label of Object.values(FEEL_LABEL)) expect(out).not.toContain(label)
      for (const feel of ['nausea', 'tired', 'spotting', 'breast']) expect(out).not.toContain(`"${feel}"`)
      for (const e of s.diary) expect(out).not.toContain(e.text.slice(0, 12))
      expect(out).not.toContain('intimacy')
      expect(out).not.toContain('personalLog')
    }
  })

  it('treatment notes and appointment notes stay in the app', () => {
    let s = demo()
    s = addAppointment(s, { date: addDays(TODAY, -3), title: '초음파', who: 'b', kind: 'hospital', note: '메모는 비공개로 두고 싶어요' }, 'b')
    const summary = own(s)
    for (const out of [JSON.stringify(summary), buildClinicSummaryText(summary), buildClinicSummaryHtml(summary)]) {
      expect(out).toContain('초음파')
      expect(out).not.toContain('비공개로 두고')
      expect(out).not.toContain('첫 회차')
    }
  })
})

describe('clinicSummary: wording', () => {
  it('no diagnosis, judgement or pressure words anywhere (demo, clinic mode, every treatment kind)', () => {
    let s = startClinicMode(demo(), '2026-09-25')
    s = addTreatment(s, { id: 'o', kind: 'ovulation-induction', startDate: '2026-04-01', outcome: 'negative' })
    s = addTreatment(s, { id: 'f', kind: 'ivf-fresh', startDate: '2026-06-01', outcome: 'cancelled' })
    const summary = own(s)
    for (const out of [buildClinicSummaryText(summary), buildClinicSummaryHtml(summary), CLINIC_SUMMARY_PRIVACY_NOTE, CLINIC_SUMMARY_NOTES.join(' ')]) {
      for (const w of BANNED) expect(out).not.toContain(w)
    }
    // Every number is labelled as what it is: a record or an estimate ('예상').
    expect(CLINIC_SUMMARY_HEADER).toContain('예상은 참고용')
    expect(CLINIC_SUMMARY_NOTES.some((n) => n.includes('예상'))).toBe(true)
  })

  it('sections carry every part of the model in the preview order', () => {
    const sections = summarySections(own())
    expect(sections.map((x) => x.id)).toEqual(['people', 'cycles', 'medications', 'checkups', 'appointments', 'treatments', 'notes'])
    const people = sections[0]!.lines
    expect(people[0]).toBe('지은 · 아내 · 32세 (1994년생) · 주기 기록')
    expect(people[1]).toBe('민수 · 남편 · 34세 (1992년생)')
    expect(people[2]).toBe(`준비 기간: ${addMonths(TODAY, -4)}부터 · 4개월 · 그동안 5주기`)
    const cycles = sections[1]!.lines
    expect(cycles[0]).toBe(`주기 5 · ${addDays(TODAY, -11)} 시작 · 진행 중 · 12일째 · 생리 5일 · LH 3회 · 아직 양성 없음 · 임테기 —`)
    expect(cycles[cycles.length - 1]).toBe('평균 28일 · 범위 28~29일 · 기록 3주기 기준')
    expect(sections[2]!.lines).toEqual([`지은 · 엽산 (400µg) · ${addMonths(TODAY, -4)}부터`, `지은 · 비타민 D (선택) · ${addMonths(TODAY, -4)}부터`])
    const treatments = sections[5]!.lines
    expect(treatments[1]).toBe('지원 회차 (기록 기준) 인공수정 1/5 · 체외수정 0/20 · 합계 1/25')
    expect(treatments[2]).toBe('난임치료휴가 민수 · 2026년 1/6일')
  })
})

describe('buildClinicSummaryText', () => {
  it('starts with the header, one block per section, a dash per line', () => {
    const text = buildClinicSummaryText(own())
    expect(text.startsWith(`${CLINIC_SUMMARY_HEADER}\n만든 날 ${TODAY}\n\n[두 사람]\n- 지은`)).toBe(true)
    expect(text).toContain('\n[주기 기록]\n- 주기 5 ·')
    expect(text).toContain('\n[참고]\n- ')
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain('<')
  })
})

describe('buildClinicSummaryHtml', () => {
  it('is a complete standalone document: no scripts, no remote resources, print-ready', () => {
    const html = buildClinicSummaryHtml(own())
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="ko">')
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain("default-src 'none'")
    expect(html).toContain('<title>둘셋 기록 요약</title>')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/(src|href)="https?:/)
    expect(html).not.toContain('<a ')
    expect(html).toContain('@page{size:A4')
    expect(html).toContain('@media print')
    expect(html).toContain(CLINIC_SUMMARY_HEADER)
    expect(html).toContain('2026년 10월 2일')
    expect(html).toContain('<th>LH</th>')
    expect(html).toContain('<th>임테기</th>')
    expect(html).toContain('풍진(MMR) 항체 확인·접종')
    expect(html).toContain('인공수정 1/5')
    expect(html).toContain('보건복지부 보도자료')
    expect(CLINIC_SUMMARY_FILENAME.endsWith('.html')).toBe(true)
  })

  it('escapes everything people typed', () => {
    let s = demo()
    s = addCheckItem(s, 'b', '<b>철분</b> & "비타민"', 'medication', TODAY, "<script>alert('x')</script>")
    const html = buildClinicSummaryHtml(own(s))
    expect(html).not.toContain('<b>철분</b>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;b&gt;철분&lt;/b&gt; &amp; &quot;비타민&quot;')
    expect(html).toContain('&lt;script&gt;')
    const text = buildClinicSummaryText(own(s))
    expect(text).toContain('<b>철분</b> & "비타민"')
  })
})
