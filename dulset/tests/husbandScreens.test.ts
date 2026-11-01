// His check points on screen (founder 2026-11-01, '12개 전부'), the logic the
// screens read: the 신청 card's intake line and [접수가 끝났대요], the 검사 card's
// booking question and medicines line, 내 준비's 올해 독감 접종 line and the
// once-a-pregnancy sauna / laptop question, the 금연 row's words, 배우자 출산휴가
// before and after the birth, Tdap's late note, 아빠 마음 — and that none of it
// reaches her side.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { focusItemsFor } from '@/components/today/model'
import { addDays } from '@/lib/dates'
import { DRINK_CHECK_LABELS, SMOKE_CHECK_LABELS, createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import {
  LAPTOP_CHECK_LABEL,
  QUIT_SMOKING_CLINIC,
  SAUNA_CHECK_LABELS,
  SMOKE_LABELS,
  SMOKE_PREGNANT_NOTE,
  activeItems,
  addCheckItem,
  checkHelp,
  heatChecks,
  heatChecksQuestion,
} from '@/lib/logic/checks'
import { DAD_MIND_LINES, dadMindDue, dadMindKey, markDadMindAsked, telHref } from '@/lib/logic/dadMind'
import {
  keepHeatChecks,
  myPrep,
  pregnantPrepItems,
  pregnantPrepLine,
  prepRetire,
  retireAskedKey,
  retireHeatChecks,
  setPrepSeasonDone,
} from '@/lib/logic/myPrep'
import { DAD_MIND_OFFSET, PARTNER_FLU_ID, PARTNER_LEAVE_LAST_OFFSET, fluDone } from '@/lib/logic/partnerDates'
import { buildPartnerDay, buildPartnerSnapshot, calmTitle, clinicLeaveLine } from '@/lib/logic/partnerSnapshot'
import {
  APPLY_INTAKE_LINE,
  BOOK_TEST_LINE,
  FERTILITY_TEST_ID,
  LEAVE_TICK_LABEL,
  TDAP_LATE_NOTE,
  TEST_MEDS_LINE,
  applyClosed,
  applyClosedKey,
  monthlyTask,
  partnerRowNote,
  setApplyClosed,
  setFertilityApplied,
  tickLabel,
} from '@/lib/logic/partnerTrack'
import { planItems, tickItem } from '@/lib/logic/plan'
import { addLHTest, addPregnancyTest, logPeriodStart } from '@/lib/logic/logs'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy } from '@/lib/logic/today'
import { partnerProgressLine } from '@/lib/logic/usView'
import type { AppState, ISODate } from '@/lib/types'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PARTNER = 'a' as const
const OWNER = 'b' as const
const T: ISODate = '2026-11-01'

/** 민수 (a) is the partner; 지은 (b) tracks the cycle. */
function fresh(
  habits?: { smokes: boolean; drinks: 'rarely' | 'sometimes' | 'often' },
  partnerRole: 'husband' | 'wife' = 'husband',
): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: partnerRole },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-10-20',
      ...(habits ? { habits: { ...habits, exercises: false, takesSupplements: false } } : {}),
    },
    new Date(2026, 9, 20, 9),
  )
}

/** Research files: every on-screen line stands on an entry's `ui` or `notes`. */
function research(file: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk)
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>
      if (typeof r.id === 'string') out.push(r)
      Object.values(r).forEach(walk)
    }
  }
  walk(JSON.parse(readFileSync(`${ROOT}docs/research/${file}`, 'utf8')))
  return out
}
const entry = (file: string, id: string) => research(file).find((e) => e.id === id)!
const words = (e: Record<string, unknown>) => `${e.ui ?? ''} ${e.notes ?? ''}`

// ── 1 · 신청 card ───────────────────────────────────────────

describe('1 · the 신청 card: is the 보건소 taking applications?', () => {
  it('carries the intake line and offers [접수가 끝났대요]', () => {
    const t = monthlyTask(fresh(), T, PARTNER)!
    expect(t).toMatchObject({ step: 'apply', ask: APPLY_INTAKE_LINE, canSayClosed: true })
    expect(APPLY_INTAKE_LINE).toBe('신청하기 전에 우리 보건소가 접수 중인지 먼저 확인해요. 보건소마다 달라요.')
    expect(words(entry('kr-programs.json', 'fertility-check-intake-2026'))).toContain(APPLY_INTAKE_LINE)
  })

  it('[접수가 끝났대요] gives the slot to the next item until the first Monday of January; that Monday brings the card back', () => {
    const s = setApplyClosed(fresh(), T, PARTNER, true)
    expect(s.decisions[applyClosedKey('2026', PARTNER)]).toBe(T)
    expect(applyClosed(s, T, PARTNER)).toBe(true)
    const next = monthlyTask(s, T, PARTNER)!
    expect(next.step).toBeUndefined()
    expect(next.id).not.toBe('pre-health-check-support')
    expect(monthlyTask(s, '2026-12-31', PARTNER)?.step).toBeUndefined()
    // January 1–3 (2027-01-04 is the first Monday): still resting, as the approved line says (A6).
    for (const d of ['2027-01-01', '2027-01-02', '2027-01-03']) {
      expect(applyClosed(s, d, PARTNER), d).toBe(true)
      expect(monthlyTask(s, d, PARTNER)?.step, d).toBeUndefined()
    }
    // The first Monday of the new year: his card again, the same day as the one '새해 접수' notice.
    expect(applyClosed(s, '2027-01-04', PARTNER)).toBe(false)
    expect(monthlyTask(s, '2027-01-04', PARTNER)).toMatchObject({ step: 'apply', canSayClosed: true })
    // 되돌리기 in those first days takes back last year's answer too.
    const undone = setApplyClosed(s, '2027-01-02', PARTNER, false)
    expect(undone.decisions[applyClosedKey('2026', PARTNER)]).toBeUndefined()
    expect(monthlyTask(undone, '2027-01-02', PARTNER)?.step).toBe('apply')
    // …but not once January's Monday has passed (last year's answer no longer rests anything).
    expect(setApplyClosed(s, '2027-01-05', PARTNER, false)).toBe(s)
    // 되돌리기.
    const back = setApplyClosed(s, T, PARTNER, false)
    expect(back.decisions[applyClosedKey('2026', PARTNER)]).toBeUndefined()
    expect(monthlyTask(back, T, PARTNER)?.step).toBe('apply')
  })

  it('is his alone: her application never reads it, and once he applied the chain goes on as before', () => {
    const s = setApplyClosed(fresh(), T, PARTNER, true)
    expect(applyClosed(s, T, OWNER)).toBe(false)
    // Nothing on her preparing home moves: no step, no line.
    expect(partnerProgressLine(s, T, OWNER)).toEqual(partnerProgressLine(fresh(), T, OWNER))
    const applied = setFertilityApplied(s, PARTNER, true, T)
    expect(monthlyTask(applied, T, PARTNER)?.step).toBe('test')
  })

  it('his link follows: the snapshot carries the intake line and the closed chip (an apply-closed event, integrate 2026-11-01), then the next item', () => {
    const day = buildPartnerDay(fresh(), T, PARTNER)!
    expect(day.task).toMatchObject({ step: 'apply', ask: APPLY_INTAKE_LINE, canSayClosed: true })
    const closed = buildPartnerDay(setApplyClosed(fresh(), T, PARTNER, true), T, PARTNER)!
    expect(closed.task?.step).toBeUndefined()
  })
})

// ── 3 · 4 · the 검사 card ───────────────────────────────────

describe('3 · 4 · the 검사 card: what to ask when booking, and his medicines', () => {
  const applied = () => setFertilityApplied(fresh(), PARTNER, true, '2026-10-25')

  it('before booking: the booking question and the medicines line (sperm side)', () => {
    const t = monthlyTask(applied(), T, PARTNER)!
    expect(t).toMatchObject({ step: 'test', stage: 'book', ask: BOOK_TEST_LINE, meds: true })
    expect(words(entry('kr-programs.json', 'fertility-check-morphology-claim'))).toContain(BOOK_TEST_LINE)
    expect(words(entry('medical.json', 'male-medicines-testosterone'))).toContain(TEST_MEDS_LINE)
    expect(TEST_MEDS_LINE).not.toMatch(/테스토스테론|스테로이드|피나스테리드|개월|불임/)
  })

  it('booked: the medicines line only; on and after the day: neither', () => {
    let s = applied()
    s = addAppointment(
      s,
      { date: '2026-11-10', time: '09:00', title: '정액검사', place: '', who: PARTNER, kind: 'test', taskId: FERTILITY_TEST_ID },
      PARTNER,
    )
    const booked = monthlyTask(s, T, PARTNER)!
    expect(booked).toMatchObject({ stage: 'booked', meds: true })
    expect(booked.ask).toBeUndefined()
    const visited = monthlyTask(s, '2026-11-10', PARTNER)!
    expect(visited.stage).toBe('visited')
    expect(visited.meds).toBeUndefined()
    expect(visited.ask).toBeUndefined()
  })

  it('not for a partner who is not the sperm side, and not on a lapsed step', () => {
    const t = monthlyTask(setFertilityApplied(fresh(undefined, 'wife'), PARTNER, true, '2026-10-25'), T, PARTNER)!
    expect(t.step).toBe('test')
    expect(t.ask).toBeUndefined()
    expect(t.meds).toBeUndefined()
    const lapsed = monthlyTask(setFertilityApplied(fresh(), PARTNER, true, '2026-07-01'), '2026-10-05', PARTNER)!
    expect(lapsed.status).toBe('overdue')
    expect(lapsed.meds).toBeUndefined()
  })

  it('the snapshot carries a flag, never the medicines words (her preview reads the same snapshot)', () => {
    const snap = buildPartnerSnapshot(applied(), T, PARTNER)!
    expect(snap.days[0]!.task).toMatchObject({ meds: true, ask: BOOK_TEST_LINE })
    const json = JSON.stringify(snap)
    expect(json).not.toContain(TEST_MEDS_LINE)
    expect(json).not.toMatch(/먹는 약|근육 키우는 약/)
    // Her own month task never has it.
    expect(monthlyTask(applied(), T, OWNER)?.meds).toBeUndefined()
  })
})

// ── 2 · 내 준비: 올해 독감 접종 ──────────────────────────────

describe('2 · 올해 독감 접종 in his 내 준비', () => {
  it('preparing: from 10월 1일 to 12월 31일, never after; never for her', () => {
    const s = fresh()
    expect(myPrep(s, '2026-09-30', PARTNER).season).toBeUndefined()
    expect(myPrep(s, T, PARTNER).season).toEqual({
      id: PARTNER_FLU_ID,
      label: '올해 독감 접종 맞기',
      note: '독감은 매년 가을에 맞아요. 비용은 병원마다 달라요.',
      done: false,
    })
    expect(myPrep(s, '2026-12-31', PARTNER).season).toBeDefined()
    expect(myPrep(s, '2027-01-01', PARTNER).season).toBeUndefined()
    expect(myPrep(s, T, OWNER).season).toBeUndefined()
  })

  it('pregnant: until 4월 30일; parenting: none', () => {
    const p = startPregnancy(fresh(), '2026-10-01', '2026-10-30')
    expect(myPrep(p, '2027-02-10', PARTNER).season).toBeDefined()
    expect(myPrep(p, '2027-04-30', PARTNER).season).toBeDefined()
    expect(myPrep(p, '2027-05-01', PARTNER).season).toBeUndefined()
    const born = recordBirth(p, { name: '아기', birthDate: '2027-06-20', sex: 'unknown' })
    expect(myPrep(born, '2027-10-10', PARTNER)).toEqual({})
  })

  it('a tick from 내 준비 goes under this season’s key; the next season starts open', () => {
    const s = setPrepSeasonDone(fresh(), T, PARTNER, true)
    expect(s.planDone['partner-flu:2026-27']).toEqual({ at: T, by: PARTNER })
    expect(s.planDone[PARTNER_FLU_ID]).toBeUndefined()
    expect(fluDone(s.planDone, T)).toBeDefined()
    expect(myPrep(s, T, PARTNER).season?.done).toBe(true)
    expect(myPrep(s, '2027-10-01', PARTNER).season?.done).toBe(false)
    expect(setPrepSeasonDone(s, T, PARTNER, false).planDone['partner-flu:2026-27']).toBeUndefined()
  })

  it('no record of hers moves it: her period, LH or a test never changes the line (it follows the calendar and his tick)', () => {
    const s0 = fresh()
    for (let k = 0; k < 120; k += 3) {
      const d = addDays('2026-09-20', k)
      const base = myPrep(s0, d, PARTNER).season
      const records = [
        logPeriodStart(s0, d, OWNER, d),
        addLHTest(s0, { date: d, slot: 'morning', result: 'positive', by: OWNER }, d),
        addPregnancyTest(s0, { date: d, result: 'positive', by: OWNER }, d).state,
      ]
      for (const s1 of records) {
        expect(myPrep(s1, d, PARTNER).season, d).toEqual(base)
      }
    }
  })

  it('rests through the quiet after a loss', () => {
    const lost = endPregnancy(startPregnancy(fresh(), '2026-09-01', '2026-10-10'), '2026-10-20')
    expect(myPrep(lost, T, PARTNER).season).toBeUndefined()
  })

  it('is never on the 이번 주 챙길 것 card — hers or his — and stays in the 챙길 것 list', () => {
    const s = fresh()
    const items = planItems(s, T)
    expect(items.some((i) => i.id === PARTNER_FLU_ID)).toBe(true)
    for (const viewer of [PARTNER, OWNER]) expect(focusItemsFor(s, T, viewer, items).some((i) => i.id === PARTNER_FLU_ID)).toBe(false)
  })

  it('his link’s 내 준비 carries it read-only (title, note, done)', () => {
    const day = buildPartnerDay(fresh(), T, PARTNER)!
    expect(day.myPrep?.season).toEqual({
      label: '올해 독감 접종 맞기',
      note: '독감은 매년 가을에 맞아요. 비용은 병원마다 달라요.',
      done: false,
    })
  })
})

// ── 6 · 배우자 출산휴가 on screen ───────────────────────────

describe('6 · 배우자 출산휴가: 출생 후 120일 안 before the birth, the real last day after', () => {
  const due = '2027-04-10'
  const pregnant = () => startPregnancy(fresh(), addDays(due, -280), '2026-11-01')

  it('before the birth his 내 준비 says it in words, never a computed last day', () => {
    const day = addDays(due, -30)
    const items = pregnantPrepItems(pregnant(), day)
    const leave = items.find((i) => i.id === 'birth-partner-leave')!
    expect(leave).toMatchObject({ state: 'now', untilText: '출생 후 120일 안' })
    expect(leave.until).toBeUndefined()
    // When it is the line's next item, the words travel with it.
    expect(pregnantPrepLine([leave], day)).toBe('다음은 배우자 출산휴가 20일 (출생 후 120일 안)')
    expect(buildPartnerDay(pregnant(), day, PARTNER)!.myPrep?.items?.find((i) => i.id === 'birth-partner-leave')?.untilText).toBe(
      '출생 후 120일 안',
    )
  })

  it('after the birth the row ends on the real birth day + 119', () => {
    const early = recordBirth(pregnant(), { name: '아기', birthDate: addDays(due, -14), sex: 'unknown' })
    const row = planItems(early, addDays(due, -10)).find((i) => i.id === 'birth-partner-leave')!
    expect(row.end).toBe(addDays(addDays(due, -14), PARTNER_LEAVE_LAST_OFFSET))
    expect(row.endWhen).toBeUndefined()
  })

  it('its tick means every remaining day has a date', () => {
    expect(tickLabel({ id: 'birth-partner-leave', title: '배우자 출산휴가 20일', custom: false })).toBe(LEAVE_TICK_LABEL)
    expect(LEAVE_TICK_LABEL).toBe('남은 날까지 날짜를 다 정했어요')
    expect(tickLabel({ id: 'p1-nt', title: 'NT 검사', custom: false })).toBe('NT 검사 챙김')
    expect(tickLabel({ id: 'birth-partner-leave', title: '내 할 일', custom: true })).toBe('내 할 일 챙김')
  })
})

// ── 7 · Tdap's late note ────────────────────────────────────

describe('7 · Tdap: after 예정일 2주 전, still open → ‘아직이면 병원에 물어봐요.’', () => {
  it('only after its window, only while open', () => {
    const due = '2027-04-10'
    const s = startPregnancy(fresh(), addDays(due, -280), '2026-11-01')
    const row = (d: ISODate) => planItems(s, d).find((i) => i.id === 'p3-partner-tdap')!
    expect(partnerRowNote(row(addDays(due, -20)), addDays(due, -20))).toBeUndefined()
    expect(partnerRowNote(row(addDays(due, -14)), addDays(due, -14))).toBeUndefined()
    expect(partnerRowNote(row(addDays(due, -13)), addDays(due, -13))).toBe(TDAP_LATE_NOTE)
    const done = tickItem('p3-partner-tdap', true, addDays(due, -30), PARTNER)(s)
    const d = addDays(due, -10)
    expect(partnerRowNote(planItems(done, d).find((i) => i.id === 'p3-partner-tdap')!, d)).toBeUndefined()
  })
})

// ── 8 · the 금연 row ────────────────────────────────────────

describe('8 · the 금연 row: the 금연클리닉 link while preparing and pregnant, the line from the pregnant stage on', () => {
  it('labels stay in step with lib/initial', () => {
    expect([...SMOKE_LABELS]).toEqual([...SMOKE_CHECK_LABELS])
    expect(SMOKE_LABELS).not.toContain(DRINK_CHECK_LABELS[0])
  })

  it('preparing: the link only; pregnant and parenting: the line too — never for the person who is pregnant', () => {
    const row = { label: '금연' }
    expect(checkHelp(row, 'preparing', false)).toEqual({ link: { ...QUIT_SMOKING_CLINIC } })
    expect(checkHelp(row, 'pregnant', false)).toEqual({ note: SMOKE_PREGNANT_NOTE, link: { ...QUIT_SMOKING_CLINIC } })
    // Parenting: the line stays, the link does not (the approved fix line: 'Link line in preparing and pregnant', integrate 2026-11-01).
    expect(checkHelp({ label: '담배 안 피우기' }, 'parenting', false)).toEqual({ note: SMOKE_PREGNANT_NOTE })
    expect(checkHelp(row, 'parenting', true)).toBeUndefined()
    expect(checkHelp(row, 'pregnant', true)).toEqual({ link: { ...QUIT_SMOKING_CLINIC } })
    expect(checkHelp({ label: '금주' }, 'pregnant', false)).toBeUndefined()
    expect(checkHelp({ label: '걷기 30분' }, 'pregnant', false)).toBeUndefined()
  })

  it('stands on the research: the line, the link, no odds and no blame', () => {
    expect(words(entry('medical.json', 'secondhand-smoke-home-car'))).toContain(SMOKE_PREGNANT_NOTE)
    expect(words(entry('medical.json', 'quit-smoking-clinic-kr'))).toContain(QUIT_SMOKING_CLINIC.url)
    expect(SMOKE_PREGNANT_NOTE).not.toMatch(/배|%|그 전에도|탓/)
  })
})

// ── 9 · the sauna / laptop question ─────────────────────────

describe('9 · after a pregnancy starts: put the sauna / laptop rows down?', () => {
  const withRows = (labels: string[]) => {
    let s = fresh({ smokes: true, drinks: 'sometimes' })
    for (const l of labels) if (!activeItems(s, PARTNER).some((i) => i.label === l)) s = addCheckItem(s, PARTNER, l, 'habit', '2026-10-20')
    return s
  }

  it('asks once in the pregnant stage, naming only the rows he has (both labels of the sauna row)', () => {
    const weekly = startPregnancy(fresh({ smokes: false, drinks: 'rarely' }), '2026-10-01', T)
    expect(heatChecks(weekly, PARTNER).map((i) => i.label)).toEqual(['사우나·뜨거운 탕 쉬기'])
    expect(prepRetire(weekly, T, PARTNER)?.question).toBe('사우나 체크는 임신 준비용이었어요. 내려놓을까요?')
    const legacy = startPregnancy(fresh(), '2026-10-01', T)
    expect(heatChecks(legacy, PARTNER).map((i) => i.label)).toContain('사우나·뜨거운 탕 피하기')
    const both = startPregnancy(withRows([LAPTOP_CHECK_LABEL]), '2026-10-01', T)
    expect(prepRetire(both, T, PARTNER)?.question).toBe('사우나·노트북 체크는 임신 준비용이었어요. 내려놓을까요?')
    expect(heatChecksQuestion([{ label: LAPTOP_CHECK_LABEL }])).toBe('노트북 체크는 임신 준비용이었어요. 내려놓을까요?')
    expect([...SAUNA_CHECK_LABELS]).toEqual(['사우나·뜨거운 탕 쉬기', '사우나·뜨거운 탕 피하기'])
    // In 내 준비, not a card of its own.
    expect(myPrep(both, T, PARTNER).retire?.itemIds.length).toBe(2)
  })

  it('never 금연 or 금주, never while preparing, never for her', () => {
    const s = startPregnancy(withRows([]), '2026-10-01', T)
    const ask = prepRetire(s, T, PARTNER)!
    const labels = activeItems(s, PARTNER)
      .filter((i) => ask.itemIds.includes(i.id))
      .map((i) => i.label)
    expect(labels.some((l) => /금연|금주|담배|술/.test(l))).toBe(false)
    expect(prepRetire(withRows([]), T, PARTNER)).toBeUndefined()
    expect(prepRetire(s, T, OWNER)).toBeUndefined()
  })

  it('[내려놓기] archives them (history kept) and it is not asked again; [그대로 두기] keeps them, not asked again', () => {
    const s = startPregnancy(withRows([LAPTOP_CHECK_LABEL]), '2026-10-01', T)
    const ids = prepRetire(s, T, PARTNER)!.itemIds
    const retired = retireHeatChecks(s, T, PARTNER)
    for (const id of ids) expect(retired.checkItems.find((i) => i.id === id)).toMatchObject({ active: false, archivedAt: T })
    expect(retired.decisions[retireAskedKey('2026-10-01', PARTNER)]).toBe(T)
    expect(prepRetire(retired, T, PARTNER)).toBeUndefined()
    expect(activeItems(retired, PARTNER).some((i) => i.label === '금연')).toBe(true)
    const kept = keepHeatChecks(s, T, PARTNER)
    expect(heatChecks(kept, PARTNER).length).toBe(ids.length)
    expect(prepRetire(kept, '2026-12-01', PARTNER)).toBeUndefined()
    // Nothing to answer → the same state.
    expect(keepHeatChecks(kept, T, PARTNER)).toBe(kept)
  })

  it('stands on the research entry (no new medical claim)', () => {
    const e = entry('medical.json', 'heat-check-retire-pregnancy')
    expect(words(e)).toContain('사우나·뜨거운 탕 쉬기')
    expect(words(e)).toContain('사우나·뜨거운 탕 피하기')
    expect(words(e)).toContain(LAPTOP_CHECK_LABEL)
  })
})

// ── 11 · 난임치료휴가 on his clinic card ─────────────────────

describe('11 · 난임치료휴가 on his clinic card', () => {
  it('says ‘처음 4일’, hedges the procedure (not the days) and gives his support line', () => {
    const line = clinicLeaveLine('2026-11-01')
    expect(line.text).toContain('연 6일 중 처음 4일이 유급이에요.')
    expect(line.note).toBe('신청 방법은 회사마다 달라요.')
    expect(line.support).toBe('회사에 신청 방법 물어보기')
  })
})

// ── 12 · 아빠 마음 ─────────────────────────────────────────

describe('12 · 아빠 마음: asked once on his parenting home', () => {
  const born = (birth: ISODate) =>
    recordBirth(startPregnancy(fresh(), addDays(birth, -280), addDays(birth, -200)), { name: '아기', birthDate: birth, sex: 'unknown' })
  const birth = '2026-08-01'

  it('from 출생일 + 90, for him only, until either button', () => {
    const s = born(birth)
    expect(dadMindDue(s, addDays(birth, DAD_MIND_OFFSET - 1), PARTNER)).toBe(false)
    expect(dadMindDue(s, addDays(birth, DAD_MIND_OFFSET), PARTNER)).toBe(true)
    expect(dadMindDue(s, addDays(birth, 200), PARTNER)).toBe(true)
    expect(dadMindDue(s, addDays(birth, 120), OWNER)).toBe(false)
    expect(dadMindDue({ ...s, stage: 'pregnant' }, addDays(birth, 120), PARTNER)).toBe(false)
  })

  it('stores only that he was asked — one key, nothing else', () => {
    const s = born(birth)
    const day = addDays(birth, 100)
    const asked = markDadMindAsked(s, day, PARTNER)
    expect(asked.decisions).toEqual({ ...s.decisions, [dadMindKey(birth, PARTNER)]: day })
    expect(dadMindKey(birth, PARTNER)).toBe('dad-mind-asked:2026-08-01:a')
    expect(dadMindDue(asked, day, PARTNER)).toBe(false)
    // Every other part of the state is the same object.
    for (const k of Object.keys(s) as Array<keyof AppState>) if (k !== 'decisions') expect(asked[k]).toBe(s[k])
  })

  it('the lines: the crisis line, 109 only for thoughts of dying, 119, the centre — every number in the research', () => {
    expect(DAD_MIND_LINES.map((l) => [l.name, l.number ?? '', l.note ?? ''])).toEqual([
      ['정신건강위기상담', '1577-0199', '24시간'],
      ['죽고 싶은 생각이 들면', '109', '24시간'],
      ['위급하면', '119', ''],
      ['난임·임산부심리상담센터', '', '배우자도 상담받을 수 있어요'],
    ])
    const notes = words(entry('medical.json', 'mental-health-lines-kr'))
    for (const l of DAD_MIND_LINES) {
      expect(notes).toContain(l.name)
      if (l.number) expect(notes).toContain(l.number)
    }
    expect(telHref('1577-0199')).toBe('tel:15770199')
  })
})

// ── The stage card never presses about her items ───────────

describe('his stage card names a visit without ‘마감’', () => {
  it('calmTitle drops a closing 마감 only', () => {
    expect(calmTitle('산후도우미 바우처 신청 마감')).toBe('산후도우미 바우처 신청')
    expect(calmTitle('NT(목덜미 투명대) 검사')).toBe('NT(목덜미 투명대) 검사')
    expect(calmTitle('마감')).toBe('마감')
  })
})
