// His check points (founder 2026-11-01, '12개 전부'), the data layer: the
// seasonal flu row, 배우자 출산휴가 counted from the real birth, the copy that
// moved, the research entries every number stands on, and the validator.

import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DRINK_QUESTION, SMOKE_OPTIONS, SMOKE_QUESTION } from '@/components/onboarding/partnerChoices'
import { ROADMAP, ROADMAP_AUDIT, templateById } from '@/lib/content/roadmap'
import { addDays } from '@/lib/dates'
import { SMOKE_CHECK_LABELS, createInitialState } from '@/lib/initial'
import { clinicSummary } from '@/lib/logic/clinicSummary'
import { pregnantPrepItems } from '@/lib/logic/myPrep'
import { TEST_MEDS_LINE, monthlyTask, partnerDetailNote } from '@/lib/logic/partnerTrack'
import { PARTNER_FLU_ID, fluDone, partnerLeaveLastDay } from '@/lib/logic/partnerDates'
import { countdown, dateText, planItems, roadmapState, statusPill, tickItem, type PlanItem } from '@/lib/logic/plan'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { buildItems, doneInfo, planDoneKey, setTemplateDone } from '@/lib/logic/roadmap'
import type { AppState } from '@/lib/types'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** 민수 (a) is the partner; 지은 (b) tracks the cycle. */
function fresh(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-20',
    },
    new Date(2026, 8, 20, 9),
  )
}

const find = (items: PlanItem[], id: string) => items.find((i) => i.id === id)

// ── 독감: a seasonal row ────────────────────────────────────

describe('partner-flu: 올해 독감 접종 맞기 (seasonal)', () => {
  it('is his own row with a season and no window, sourced and unverified', () => {
    const t = templateById(PARTNER_FLU_ID)!
    expect(t).toMatchObject({ who: 'partner', kind: 'vaccine', title: '올해 독감 접종 맞기', season: 'flu', phase: 'preconception' })
    expect(t.window).toBeUndefined()
    expect(t.detail).toBe('독감은 매년 가을에 맞아요. 비용은 병원마다 달라요.')
    expect(t.support).toBeUndefined()
    expect(`${t.title} ${t.detail}`).not.toMatch(/무료|\d\s*원|만 원|지켜|막아/)
    expect(ROADMAP_AUDIT[PARTNER_FLU_ID]).toMatchObject({ verified: false })
    expect(ROADMAP_AUDIT[PARTNER_FLU_ID]!.checkNote).toContain('partner-flu-season-2026-27')
  })

  it('preparing: shown 10/1–12/31 only, as 지금 for him; gone before and after (never 지났어요)', () => {
    const s = fresh()
    expect(find(planItems(s, '2026-09-30'), PARTNER_FLU_ID)).toBeUndefined()
    const row = find(planItems(s, '2026-11-01'), PARTNER_FLU_ID)!
    expect(row).toMatchObject({
      phase: 'preconception',
      start: '2026-10-01',
      end: '2026-12-31',
      status: 'now',
      owners: ['a'],
      lapsed: false,
      pending: false,
    })
    expect(dateText(row, '2026-11-01')).toBe('10.1 ~ 12.31')
    expect(statusPill(row, 'preparing')).toEqual({ label: '지금', tone: 'brand' })
    // No '61일 남음': the season's end is not a deadline.
    expect(countdown(row, '2026-11-01')).toBeUndefined()
    expect(find(planItems(s, '2026-12-31'), PARTNER_FLU_ID)?.status).toBe('now')
    expect(find(planItems(s, '2027-01-01'), PARTNER_FLU_ID)).toBeUndefined()
    expect(find(planItems(s, '2027-10-01'), PARTNER_FLU_ID)?.start).toBe('2027-10-01')
  })

  it('pregnant: shown 10/1–4/30 in the phase she is in; parenting: not at all', () => {
    let s = startPregnancy(fresh(), '2026-11-10', '2026-12-15') // due 2027-08-17
    const jan = find(planItems(s, '2027-01-15'), PARTNER_FLU_ID)!
    expect(jan).toMatchObject({ phase: 'pregnancy-1st', start: '2026-10-01', end: '2027-04-30', status: 'now' })
    expect(find(planItems(s, '2027-03-20'), PARTNER_FLU_ID)?.phase).toBe('pregnancy-2nd')
    expect(find(planItems(s, '2027-05-01'), PARTNER_FLU_ID)).toBeUndefined()
    s = recordBirth(s, { name: '콩이', birthDate: '2027-08-10', sex: 'unknown' })
    expect(find(planItems(s, '2027-11-01'), PARTNER_FLU_ID)).toBeUndefined()
  })

  it('a tick goes under its season: done for the rest of the 절기 (into the pregnancy), open again next autumn', () => {
    let s = tickItem(PARTNER_FLU_ID, true, '2026-11-05', 'a')(fresh())
    expect(s.planDone['partner-flu:2026-27']).toEqual({ at: '2026-11-05', by: 'a' })
    expect(s.planDone[PARTNER_FLU_ID]).toBeUndefined()
    expect(find(planItems(s, '2026-12-01'), PARTNER_FLU_ID)).toMatchObject({ status: 'done', doneAt: '2026-11-05', doneBy: 'a' })
    expect(fluDone(s.planDone, '2026-12-01')).toEqual({ at: '2026-11-05', by: 'a' })
    // Ticking again keeps the first day; a pregnancy in January reads the same 절기's tick.
    expect(tickItem(PARTNER_FLU_ID, true, '2026-11-20', 'a')(s)).toBe(s)
    const pregnant = startPregnancy(s, '2026-12-10', '2027-01-12')
    expect(find(planItems(pregnant, '2027-01-15'), PARTNER_FLU_ID)?.status).toBe('done')
    // Next season: a new key, the row is open again; last season's tick stays where it was.
    const next = find(planItems(s, '2027-10-03'), PARTNER_FLU_ID)!
    expect(next.status).toBe('now')
    s = tickItem(PARTNER_FLU_ID, true, '2027-10-03', 'a')(s)
    expect(Object.keys(s.planDone).filter((k) => k.startsWith('partner-flu'))).toEqual(['partner-flu:2026-27', 'partner-flu:2027-28'])
    // Unticking clears only this season.
    s = tickItem(PARTNER_FLU_ID, false, '2027-10-04', 'a')(s)
    expect(s.planDone['partner-flu:2027-28']).toBeUndefined()
    expect(s.planDone['partner-flu:2026-27']).toBeDefined()
  })

  it('needs a day to know its season: without one it reads open and writes nothing', () => {
    const t = templateById(PARTNER_FLU_ID)!
    const s = tickItem(PARTNER_FLU_ID, true, '2026-11-05', 'a')(fresh())
    expect(planDoneKey(t, '2026-11-05')).toBe('partner-flu:2026-27')
    expect(planDoneKey(t)).toBeUndefined()
    expect(doneInfo(s, t)).toBeUndefined()
    expect(doneInfo(s, t, '2026-12-01')).toEqual({ at: '2026-11-05', by: 'a' })
    expect(setTemplateDone(s, { ...t }, true, 'broken', 'a')).toBe(s)
    // buildItems without a stage has no window to place it in.
    const { stage: _stage, ...noStage } = roadmapState(s)
    expect(buildItems(noStage, ROADMAP, '2026-11-01').some((i) => i.id === PARTNER_FLU_ID)).toBe(false)
  })

  it('the clinic summary for the doctor lists this 절기’s flu shot, not last season’s (A3)', () => {
    const s = tickItem(PARTNER_FLU_ID, true, '2026-11-05', 'a')(fresh())
    // Ticked this 절기 → listed, dated and by him (the summary's day decides the 절기).
    const sum = clinicSummary(s, 'b', '2026-11-10')!
    expect(sum).not.toBeNull()
    expect(sum.checkups.filter((c) => c.id === PARTNER_FLU_ID)).toEqual([
      { id: PARTNER_FLU_ID, title: templateById(PARTNER_FLU_ID)!.title, kind: 'vaccine', doneAt: '2026-11-05', member: 'a' },
    ])
    // Still this 절기 in the spring.
    expect(clinicSummary(s, 'b', '2027-06-01')!.checkups.some((c) => c.id === PARTNER_FLU_ID)).toBe(true)
    // Last season's tick reads open in the next 절기 — '올해' stays true.
    expect(clinicSummary(s, 'b', '2027-10-10')!.checkups.some((c) => c.id === PARTNER_FLU_ID)).toBe(false)
  })

  it('is never his 이번 달 할 일 (it is a part of 내 준비), preparing or pregnant', () => {
    const pregnant = startPregnancy(fresh(), '2026-07-20', '2026-08-30')
    for (const day of ['2026-10-01', '2026-11-01', '2026-12-31']) {
      expect(find(planItems(pregnant, day), PARTNER_FLU_ID)?.status, day).toBe('now')
      expect(monthlyTask(pregnant, day, 'a')?.id, day).not.toBe(PARTNER_FLU_ID)
    }
    // Preparing with the 검사 chain finished: his own open rows, never the flu one.
    let s = fresh()
    for (const id of [
      'pre-health-check-support',
      'pre-checkup-partner',
      'pre-partner-vaccines',
      'pre-hepb',
      'pre-dental',
      'pre-work-rules',
    ])
      s = tickItem(id, true, '2026-10-01', 'a')(s)
    s = { ...s, planDone: { ...s.planDone, 'pre-health-check-claim:a': { at: '2026-10-02', by: 'a' } } }
    expect(monthlyTask(s, '2026-11-01', 'a')?.id).not.toBe(PARTNER_FLU_ID)
  })

  it('pre-partner-vaccines no longer carries 독감', () => {
    const t = templateById('pre-partner-vaccines')!
    expect(t.title).toBe('예방접종 점검 (MMR·수두·A·B형간염)')
    expect(`${t.title} ${t.detail}`).not.toContain('독감')
  })
})

// ── 배우자 출산휴가: the end counts from the real birth ──────

describe('birth-partner-leave: 예정일 −50 → 출생일 + 119', () => {
  const due = '2027-02-11'
  const pregnant = (): AppState => startPregnancy(fresh(), addDays(due, -280), '2026-07-01')

  it('before the birth: opens 50 days before the due date, no end date — "출생 후 120일 안"', () => {
    const s = pregnant()
    const leave = find(planItems(s, '2027-01-01'), 'birth-partner-leave')!
    expect(leave).toMatchObject({ start: addDays(due, -50), status: 'now', lapsed: false, pending: false })
    expect(leave.end).toBeUndefined()
    expect(leave.endWhen).toBe('출생 후 120일 안')
    expect(dateText(leave, '2027-01-01')).toBe('2026.12.23 ~ 출생 후 120일 안')
    expect(dateText(leave, '2026-12-25')).toBe('12.23 ~ 출생 후 120일 안')
    expect(countdown(leave, '2027-01-01')).toBeUndefined() // open, and no computed last day to count to
    // His pregnant 내 준비 never shows a computed last day before the birth.
    const prep = pregnantPrepItems(s, '2027-01-01').find((i) => i.id === 'birth-partner-leave')!
    expect(prep.until).toBeUndefined()
    // Preparing: no anchor at all — a dated item waiting for the pregnancy.
    const pre = find(planItems(fresh(), '2026-11-01'), 'birth-partner-leave')!
    expect([pre.start, pre.end, pre.endWhen, pre.pending]).toEqual([undefined, undefined, undefined, true])
  })

  it('born two weeks early: the last day is 출생일 + 119, before what the due date would give', () => {
    const birth = addDays(due, -14)
    const s = recordBirth(pregnant(), { name: '콩이', birthDate: birth, sex: 'girl' })
    const leave = find(planItems(s, addDays(birth, 10)), 'birth-partner-leave')!
    expect(leave.end).toBe(addDays(birth, 119))
    expect(leave.end).toBe(partnerLeaveLastDay(birth))
    expect(leave.end! < addDays(due, 119)).toBe(true)
    expect(leave.endWhen).toBeUndefined()
    expect(leave.status).toBe('now')
    expect(dateText(leave, addDays(birth, 10))).toMatch(/ ~ 5\.27$/)
  })

  it('born a week late: still 출생일 + 119; the day after it the row reads 지났어요, not 기한 지남', () => {
    const birth = addDays(due, 7)
    const s = recordBirth(pregnant(), { name: '콩이', birthDate: birth, sex: 'boy' })
    expect(find(planItems(s, addDays(birth, 1)), 'birth-partner-leave')?.end).toBe(addDays(birth, 119))
    const last = find(planItems(s, addDays(birth, 119)), 'birth-partner-leave')!
    expect(last.status).toBe('now')
    const after = find(planItems(s, addDays(birth, 120)), 'birth-partner-leave')!
    expect(after.lapsed).toBe(true)
    expect(statusPill(after, 'parenting')).toEqual({ label: '지났어요', tone: 'muted' })
    expect(templateById('birth-partner-leave')!.deadline).toBeUndefined()
  })

  it('says how to confirm the last day, and is honest that the count is unverified', () => {
    const t = templateById('birth-partner-leave')!
    expect(t.detail).toContain('출생 후 120일')
    expect(t.detail).toContain('고용센터(1350)')
    expect(t.detail).toContain('3번까지 나눠')
    expect(ROADMAP_AUDIT['birth-partner-leave']).toMatchObject({ verified: false })
    expect(ROADMAP_AUDIT['birth-partner-leave']!.checkNote).toContain('spouse-birth-leave-120-days')
  })
})

// ── Copy that moved ─────────────────────────────────────────

describe('copy: medication line, 산후도우미 line, the smoking question', () => {
  it('pre-checkup-partner: the medicines line is his own row’s only — never in the shared detail her 챙길 것 reads (P6 / UI-1)', () => {
    const t = templateById('pre-checkup-partner')!
    expect(t.detail).not.toMatch(/먹는 약|근육 키우는 약|처방받은 약|주사/)
    expect(t.detail).not.toMatch(/테스토스테론|스테로이드|피나스테리드|발프로|개월 뒤/)
    // His row carries it through partnerDetailNote (drawn only on the viewer's own row).
    expect(partnerDetailNote({ id: 'pre-checkup-partner', custom: false })).toBe(TEST_MEDS_LINE)
    expect(partnerDetailNote({ id: 'pre-checkup-partner', custom: true })).toBeUndefined()
    expect(partnerDetailNote({ id: 'pre-checkup-carrier', custom: false })).toBeUndefined()
    expect(TEST_MEDS_LINE).not.toMatch(/테스토스테론|스테로이드|피나스테리드|발프로|개월/)
  })

  it('산후도우미: he may take the application (정부24 신청권자), with the 보건소 hedge', () => {
    const t = templateById('p3-postnatal-care')!
    expect(t.support).toBe('신청은 내가 맡기')
    expect(t.supportNote).toBe('배우자도 신청할 수 있고, 필요한 서류는 보건소마다 달라요.')
    expect(t.sources.map((x) => x.url)).toContain('https://www.gov.kr/portal/service/serviceInfo/PTR000050390')
  })

  it('the smoking question says 전자담배 포함; the check rows keep their names', () => {
    expect(SMOKE_QUESTION).toBe('담배를 피우나요? (전자담배 포함)')
    expect(DRINK_QUESTION).toBe('술은 얼마나 마시나요?')
    expect(SMOKE_OPTIONS.map((o) => o.label)).toEqual(['안 피워요', '피워요'])
    expect(SMOKE_CHECK_LABELS).toEqual(['금연', '담배 안 피우기'])
    const supplements = JSON.parse(readFileSync(join(ROOT, 'lib/content/data/supplements.json'), 'utf8')) as unknown
    expect(JSON.stringify(supplements)).not.toContain('전자담배')
    for (const f of ['components/onboarding/HabitQuestions.tsx', 'components/link/LinkIntro.tsx']) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      expect(src, f).toContain('SMOKE_QUESTION')
      expect(src, f).not.toContain('"담배를 피우나요?"')
    }
  })
})

// ── Research: every number has an entry ─────────────────────

type Finding = { id?: string; claim?: string; detail?: string; sources: string[]; checked?: string; verified?: boolean; notes?: string }

function findings(file: string): Finding[] {
  const json = JSON.parse(readFileSync(join(ROOT, 'docs/research', file), 'utf8')) as { findings?: Finding[]; items?: Finding[] }
  return json.findings ?? json.items ?? []
}

const RESEARCH: ReadonlyArray<[file: string, id: string, mustSay: readonly string[]]> = [
  ['kr-programs.json', 'fertility-check-intake-2026', ['예산 소진', '소급', '원주시']],
  ['kr-programs.json', 'fertility-check-morphology-claim', ['정자정밀형태검사']],
  ['kr-programs.json', 'infertility-leave-paid-4-days-2026-11-27', ['처음 4일', '2026년 11월 27일']],
  ['medical-checklist.json', 'partner-flu-season-2026-27', ['2026-09-11', '임신부와 함께 사는 사람', '2027-04-30']],
  ['medical-checklist.json', 'partner-tdap-once', ['맞은 적이 없으면', '최소 2주 전', '최근 10년']],
  ['medical.json', 'male-semen-test-abstinence', ['2~7일', 'WHO']],
  ['medical.json', 'male-medicines-testosterone', ['AUA/ASRM', 'NICE NG257', '2024 개정']],
  ['medical.json', 'male-e-cigarettes', ['ASRM 2024']],
  ['medical.json', 'secondhand-smoke-home-car', ['베란다', '영아돌연사']],
  ['medical.json', 'quit-smoking-clinic-kr', ['금연길라잡이', '1544-9030']],
  ['medical.json', 'heat-check-retire-pregnancy', ['노트북', '사우나']],
  ['medical.json', 'paternal-perinatal-depression', ['Paulson', 'Cameron', '3~6개월']],
  ['medical.json', 'mental-health-lines-kr', ['1577-0199', '109', '119', '난임·임산부심리상담센터', '24시간']],
  ['admin-timeline.json', 'spouse-birth-leave-120-days', ['출생일 + 119일', '+ 120일', '1350', '3번까지']],
  ['admin-timeline.json', 'postnatal-care-spouse-apply', ['40일 전', '친족(배우자 포함)']],
]

describe('research entries (docs/research) for every number the check points use', () => {
  for (const [file, id, mustSay] of RESEARCH) {
    it(`${file} '${id}': URL sources, checked date, verified flag, and the numbers`, () => {
      const f = findings(file).find((x) => x.id === id)
      expect(f, `${file} ${id}`).toBeDefined()
      expect(f!.sources.length).toBeGreaterThan(0)
      for (const u of f!.sources) expect(() => new URL(u), u).not.toThrow()
      expect(f!.sources.every((u) => /^https?:\/\//.test(u))).toBe(true)
      expect(f!.checked).toMatch(/^2026-1[01]-\d{2}$/)
      // Snippet-only research stays '미확인' until a person opens the original.
      expect(f!.verified).toBe(false)
      const text = `${f!.claim ?? f!.detail ?? ''} ${f!.notes ?? ''}`
      for (const w of mustSay) expect(text, `${id}: ${w}`).toContain(w)
    })
  }

  it('the README lists every new id', () => {
    const readme = readFileSync(join(ROOT, 'docs/research/README.md'), 'utf8')
    for (const [, id] of RESEARCH) expect(readme, id).toContain(id)
  })

  it('the roadmap rows that changed point at their research', () => {
    for (const [row, id] of [
      ['partner-flu', 'partner-flu-season-2026-27'],
      ['pre-checkup-partner', 'male-medicines-testosterone'],
      ['birth-partner-leave', 'spouse-birth-leave-120-days'],
      ['p3-postnatal-care', 'postnatal-care-spouse-apply'],
    ] as const)
      expect(ROADMAP_AUDIT[row]!.checkNote, row).toContain(id)
  })
})

// ── The validator knows the new timing fields ───────────────

describe('scripts/validate-content.mjs: seasons and end anchors', () => {
  const script = join(ROOT, 'scripts/validate-content.mjs')
  const dataDir = join(ROOT, 'lib/content/data')

  function runOn(mutate: (items: Array<Record<string, unknown>>) => void): { code: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), 'dulset-timing-'))
    try {
      for (const f of readdirSync(dataDir)) if (f.endsWith('.json')) cpSync(join(dataDir, f), join(dir, f))
      const roadmap = JSON.parse(readFileSync(join(dir, 'roadmap.json'), 'utf8')) as { items: Array<Record<string, unknown>> }
      mutate(roadmap.items)
      writeFileSync(join(dir, 'roadmap.json'), JSON.stringify(roadmap, null, 2))
      try {
        const out = execFileSync(process.execPath, [script], {
          encoding: 'utf8',
          env: { ...process.env, CONTENT_DATA_DIR: dir },
          stdio: 'pipe',
          timeout: 30_000,
        })
        return { code: 0, out }
      } catch (e) {
        const err = e as { status?: number; stderr?: string; stdout?: string }
        return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const byId = (items: Array<Record<string, unknown>>, id: string) => items.find((i) => i.id === id)!

  it('passes the shipped data', () => {
    expect(runOn(() => {})).toMatchObject({ code: 0 })
  })

  const cases: Array<[string, (items: Array<Record<string, unknown>>) => void, RegExp]> = [
    ['an unknown season', (it) => (byId(it, PARTNER_FLU_ID).season = 'spring'), /unknown season/],
    ['a season with a window', (it) => (byId(it, PARTNER_FLU_ID).window = { anchor: 'edd', start: -10 }), /seasonal item has no window/],
    ['a preconception window', (it) => (byId(it, 'pre-dental').window = { anchor: 'lmp', start: 0 }), /preconception item has no window/],
    [
      'an end anchor without an end',
      (it) => (byId(it, 'birth-partner-leave').window = { anchor: 'edd', start: -50, endAnchor: 'birth' }),
      /needs an `end`/,
    ],
    [
      'an end anchor that is not the birth',
      (it) => (byId(it, 'birth-partner-leave').window = { anchor: 'edd', start: -50, endAnchor: 'lmp', end: 9 }),
      /only 'birth'/,
    ],
    ['start after end', (it) => (byId(it, 'p1-nt').window = { anchor: 'lmp', start: 97, end: 77 }), /is after end/],
  ]
  for (const [name, mutate, message] of cases) {
    it(`rejects ${name}`, () => {
      const { code, out } = runOn(mutate)
      expect(code).toBe(1)
      expect(out).toMatch(message)
    })
  }
})
