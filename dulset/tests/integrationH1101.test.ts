// The seams of the 12 husband check points (founder 2026-11-01, '12개 전부'),
// where the data, notices and screens tracks meet:
//  • the decision keys the screens write and the notices read
//    ('apply-closed:<year>:<m>', 'dad-mind-asked:<birth>:<m>', 'retire-asked:'),
//  • each notice key → today.noticeTarget → the card or row that tab shows,
//  • link parity: the link's four new events change exactly what the app's own
//    buttons change, and the snapshot follows,
//  • the flu row's per-절기 planDone key, read the same by 내 준비, the row,
//    the notice, the digest and the link,
//  • 배우자 출산휴가's end counted from the real birth, the same for the row
//    and the D-30 / D-7 / D-1 notices,
//  • her side never names his smoking, drinking or medicines; exports leave
//    아빠 마음 out.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { activeItems, addCheckItem, toggleCheck } from '@/lib/logic/checks'
import { startClinicMode } from '@/lib/logic/clinic'
import { DAD_MIND_LINES, dadMindDue, dadMindKey, markDadMindAsked, rawWithoutDadMind, withoutDadMind } from '@/lib/logic/dadMind'
import { myPrep, prepRetire, retireAskedKey, retireHeatChecks, setPrepSeasonDone } from '@/lib/logic/myPrep'
import { PARTNER_FLU_ID, dadMindDay, fluDone, partnerLeaveLastDay, postnatalCareOpens, tdapNoticeDays } from '@/lib/logic/partnerDates'
import { applyPartnerEvent, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import {
  PARTNER_NOTICE_COPY,
  allRuleNotices,
  applyNewYearKey,
  applyReminderKey,
  checkpointCandidates,
  dadMindNoticeKey,
  firstMondayOfJanuary,
  leaveLeftKey,
  weekDigestNotices,
} from '@/lib/logic/partnerNotices'
import { buildPartnerDay } from '@/lib/logic/partnerSnapshot'
import {
  FERTILITY_TEST_ID,
  TEST_MEDS_LINE,
  applyClosed,
  applyClosedKey,
  monthlyTask,
  setApplyClosed,
  setFertilityApplied,
} from '@/lib/logic/partnerTrack'
import { dateText, planItems } from '@/lib/logic/plan'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { togetherItems } from '@/lib/logic/together'
import { noticeTarget } from '@/lib/logic/today'
import {
  UNNAMED_DAILY_TEXT,
  UNNAMED_WEEKLY_TEXT,
  isSensitiveCheck,
  nudgeTargetLabel,
  ownerViewOfCheck,
  partnerWeekSummary,
} from '@/lib/logic/weekTogether'
import { mergeNotices } from '@/lib/logic/notifications'
import { decide } from '@/lib/sync/model'
import type { AppState, ISODate, MemberId } from '@/lib/types'

const ROOT = join(__dirname, '..')
const HIM: MemberId = 'a' // 민수
const HER: MemberId = 'b' // 지은, records the cycle
const T: ISODate = '2026-11-01' // a Sunday

function base(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: HER, lastPeriodStart: '2026-01-01' },
    new Date(2026, 0, 2, 9),
  )
}
/** Due 2026-12-06 (LMP 2026-03-01), recorded 2026-04-10. */
const DUE: ISODate = '2026-12-06'
const pregnant = (): AppState => startPregnancy(base(), '2026-03-01', '2026-04-10')
const parenting = (birth: ISODate): AppState => recordBirth(pregnant(), { name: '콩이', birthDate: birth, sex: 'unknown' })

/** What one rule says on its own (before his weekly cap). */
const due = (s: AppState, d: ISODate, prefix: string) => checkpointCandidates(s, d).filter((n) => n.key?.startsWith(prefix))
const keys = (list: readonly { key?: string }[]) => list.map((n) => n.key)

let seq = 0
const ev = <E extends Record<string, unknown>>(e: E) => ({ id: `h1101-${++seq}`, from: HIM, ...e }) as unknown as PartnerEvent
/** The decision keys `next` has that `prev` did not, without the link's applied-once marks. */
const newDecisions = (prev: AppState, next: AppState) =>
  Object.keys(next.decisions).filter((k) => !(k in prev.decisions) && !k.startsWith('partner-event:'))

// ── decision keys: the screens write, the notices read ──────

describe('[접수가 끝났대요]: the key the 신청 card writes is the key the reminder reads (app and link alike)', () => {
  const firstRun = () => decide(base(), 'partner-setup', '2026-10-01')

  it('the 신청 reminder rests for the rest of the year, then the January line goes out once', () => {
    expect(keys(due(firstRun(), '2026-11-09', 'deadline:task-apply:'))).toEqual([applyReminderKey(HIM)])
    const closed = setApplyClosed(firstRun(), '2026-11-05', HIM, true)
    expect(closed.decisions[applyClosedKey('2026', HIM)]).toBe('2026-11-05')
    for (const d of ['2026-11-09', '2026-12-28', '2027-01-03']) {
      expect(due(closed, d, 'deadline:task-apply:'), d).toEqual([])
      expect(due(closed, d, 'deadline:task-apply-new-year:'), d).toEqual([])
    }
    const jan = firstMondayOfJanuary(2027)
    expect(jan).toBe('2027-01-04')
    expect(keys(due(closed, jan, 'deadline:task-apply-new-year:'))).toEqual([applyNewYearKey(2027, HIM)])
    // The card's slot moved on in 2026 and is his again in January (partnerTrack.monthlyTask reads the same key).
    expect(monthlyTask(closed, '2026-11-05', HIM)?.step).not.toBe('apply')
    expect(monthlyTask(closed, jan, HIM)?.step).toBe('apply')
  })

  it('the link’s apply-closed event writes the same key, and its 되돌리기 takes it back', () => {
    const app = setApplyClosed(firstRun(), '2026-11-05', HIM, true)
    const link = applyPartnerEvent(firstRun(), ev({ kind: 'apply-closed', date: '2026-11-05', closed: true }), '2026-11-05')
    expect(newDecisions(firstRun(), link)).toEqual(newDecisions(firstRun(), app))
    expect(applyClosed(link, '2026-11-05', HIM)).toBe(true)
    const undone = applyPartnerEvent(link, ev({ kind: 'apply-closed', date: '2026-11-05', closed: false }), '2026-11-05')
    expect(applyClosed(undone, '2026-11-05', HIM)).toBe(false)
    expect(keys(due(undone, '2026-11-09', 'deadline:task-apply:'))).toEqual([applyReminderKey(HIM)])
  })

  it('the snapshot offers the chip on the 신청 card only, and the next item once it is said', () => {
    const day = buildPartnerDay(firstRun(), '2026-11-05', HIM)!
    expect(day.task).toMatchObject({ step: 'apply', canSayClosed: true })
    const after = buildPartnerDay(setApplyClosed(firstRun(), '2026-11-05', HIM, true), '2026-11-05', HIM)!
    expect(after.task?.canSayClosed).toBeUndefined()
    // Off the 신청 step (or not preparing) the link cannot say it.
    const applied = setFertilityApplied(firstRun(), HIM, true, '2026-10-02')
    expect(buildPartnerDay(applied, '2026-11-05', HIM)!.task?.canSayClosed).toBeUndefined()
    expect(partnerEventProblem(applied, ev({ kind: 'apply-closed', date: '2026-11-05', closed: true }), '2026-11-05')).toBe('checkpoint')
    expect(partnerEventProblem(pregnant(), ev({ kind: 'apply-closed', date: T, closed: true }), T)).toBe('checkpoint')
    // Never in her name, never dated ahead or too far back.
    expect(partnerEventProblem(firstRun(), { ...ev({ kind: 'apply-closed', date: T, closed: true }), from: HER }, T)).toBe('actor')
    expect(partnerEventProblem(firstRun(), ev({ kind: 'apply-closed', date: addDays(T, 1), closed: true }), T)).toBe('date')
  })
})

describe('아빠 마음: the card, the notice and the link follow one rule and one key', () => {
  const birth: ISODate = '2026-12-01'
  const day = dadMindDay(birth)

  it('from 출생일 + 90: his card, his notice (to 오늘), his link flag — then nothing once he answered, in the app or on the link', () => {
    const s = parenting(birth)
    expect(day).toBe(addDays(birth, 90))
    expect(due(s, addDays(day, -1), 'dad-mind:')).toEqual([])
    expect(buildPartnerDay(s, addDays(day, -1), HIM)!.dadMind).toBeUndefined()
    const n = due(s, day, 'dad-mind:')
    expect(n).toEqual([{ key: dadMindNoticeKey(birth, HIM), to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.dadMind }])
    expect(noticeTarget('system', 'parenting', n[0]!.key)).toBe('today')
    expect(dadMindDue(s, day, HIM)).toBe(true) // the card on his parenting home (TodayTab ParentingHome)
    expect(dadMindDue(s, day, HER)).toBe(false)
    const page = buildPartnerDay(s, day, HIM)!
    expect(page.dadMind).toBe(true)
    // A flag only: no number, no line travels in the snapshot.
    for (const l of DAD_MIND_LINES) {
      expect(JSON.stringify(page)).not.toContain(l.name)
      if (l.number) expect(JSON.stringify(page)).not.toContain(l.number)
    }
    const app = markDadMindAsked(s, day, HIM)
    const link = applyPartnerEvent(s, ev({ kind: 'dad-mind-asked' }), day)
    for (const next of [app, link]) {
      expect(newDecisions(s, next)).toEqual([dadMindKey(birth, HIM)])
      expect(due(next, day, 'dad-mind:')).toEqual([])
      expect(dadMindDue(next, addDays(day, 30), HIM)).toBe(false)
      expect(buildPartnerDay(next, day, HIM)!.dadMind).toBeUndefined()
    }
  })

  it('the link cannot say it before day 90, twice, or in the preparing stage', () => {
    const s = parenting(birth)
    expect(partnerEventProblem(s, ev({ kind: 'dad-mind-asked' }), addDays(day, -1))).toBe('checkpoint')
    const once = applyPartnerEvent(s, ev({ kind: 'dad-mind-asked' }), day)
    expect(partnerEventProblem(once, ev({ kind: 'dad-mind-asked' }), day)).toBe('checkpoint')
    expect(partnerEventProblem(base(), ev({ kind: 'dad-mind-asked' }), T)).toBe('checkpoint')
  })
})

describe('the sauna / laptop question: app and link write the same answer', () => {
  const withSauna = () =>
    startPregnancy(addCheckItem(base(), HIM, '사우나·뜨거운 탕 쉬기', 'habit', '2026-01-02', undefined, 'weekly'), '2026-10-01', T)

  it('[내려놓기] archives the same rows; [그대로 두기] keeps them; either way it is not asked again', () => {
    const s = withSauna()
    expect(buildPartnerDay(s, T, HIM)!.myPrep?.retire?.question).toBe(prepRetire(s, T, HIM)!.question)
    const app = retireHeatChecks(s, T, HIM)
    const link = applyPartnerEvent(s, ev({ kind: 'retire-checks', keep: false }), T)
    expect(link.checkItems).toEqual(app.checkItems)
    expect(newDecisions(s, link)).toEqual([retireAskedKey('2026-10-01', HIM)])
    expect(buildPartnerDay(link, T, HIM)!.myPrep?.retire).toBeUndefined()
    const kept = applyPartnerEvent(s, ev({ kind: 'retire-checks', keep: true }), T)
    expect(activeItems(kept, HIM).map((i) => i.id)).toEqual(activeItems(s, HIM).map((i) => i.id))
    expect(newDecisions(s, kept)).toEqual([retireAskedKey('2026-10-01', HIM)])
    expect(partnerEventProblem(kept, ev({ kind: 'retire-checks', keep: false }), T)).toBe('checkpoint')
    // Nothing to ask while preparing.
    expect(partnerEventProblem(base(), ev({ kind: 'retire-checks', keep: false }), T)).toBe('checkpoint')
  })
})

// ── the flu row's season key ────────────────────────────────

describe('올해 독감 접종: one planDone key per 절기, read the same everywhere', () => {
  it('a tick in 내 준비 or on the link writes partner-flu:<절기> — the row, the notice, the digest and the link all read it', () => {
    const app = setPrepSeasonDone(base(), T, HIM, true)
    const link = applyPartnerEvent(base(), ev({ kind: 'season-done', itemId: PARTNER_FLU_ID, date: T, done: true }), T)
    expect(keys(due(base(), T, 'flu-season:'))).toEqual(['flu-season:2026-27:a'])
    expect(noticeTarget('system', 'preparing', 'flu-season:2026-27:a')).toBe('today')
    expect(myPrep(base(), T, HIM).season).toMatchObject({ id: PARTNER_FLU_ID, done: false }) // what the notice says to tick, on 오늘
    for (const s of [app, link]) {
      expect(s.planDone['partner-flu:2026-27']).toEqual({ at: T, by: HIM })
      expect(s.planDone[PARTNER_FLU_ID]).toBeUndefined()
      expect(fluDone(s.planDone, T)).toBeTruthy()
      expect(due(s, T, 'flu-season:')).toEqual([])
      expect(planItems(s, T).find((i) => i.id === PARTNER_FLU_ID)?.status).toBe('done')
      expect(myPrep(s, T, HIM).season?.done).toBe(true)
      expect(buildPartnerDay(s, T, HIM)!.myPrep?.season?.done).toBe(true)
      expect(partnerWeekSummary(s, T, HIM).map((l) => l.text)).toContain('독감 접종을 했어요')
      const digest = weekDigestNotices(s, T)
      expect(digest).toHaveLength(1)
      expect(digest[0]).toMatchObject({ to: HER })
      expect(digest[0]!.body).toContain('독감 접종을 했어요')
      // The next 절기 opens again, unticked.
      expect(keys(due(s, '2027-10-01', 'flu-season:'))).toEqual(['flu-season:2027-28:a'])
      expect(myPrep(s, '2027-10-01', HIM).season?.done).toBe(false)
    }
  })

  it('the link’s untick takes it back; outside the window or for another row it is refused', () => {
    const ticked = setPrepSeasonDone(base(), T, HIM, true)
    const off = applyPartnerEvent(ticked, ev({ kind: 'season-done', itemId: PARTNER_FLU_ID, date: T, done: false }), T)
    expect(off.planDone['partner-flu:2026-27']).toBeUndefined()
    expect(
      partnerEventProblem(base(), ev({ kind: 'season-done', itemId: PARTNER_FLU_ID, date: '2027-01-05', done: true }), '2027-01-05'),
    ).toBe('checkpoint')
    expect(partnerEventProblem(base(), ev({ kind: 'season-done', itemId: 'pre-folic', date: T, done: true }), T)).toBe('item')
    expect(partnerEventProblem(parenting('2026-10-20'), ev({ kind: 'season-done', itemId: PARTNER_FLU_ID, date: T, done: true }), T)).toBe(
      'checkpoint',
    )
  })
})

// ── 배우자 출산휴가: the end counts from the real birth ──────

describe('배우자 출산휴가: the row and the D-30 / D-7 / D-1 notices share one last day (출생일 + 119)', () => {
  it('before the birth: no last day anywhere, only "출생 후 120일 안"', () => {
    const s = pregnant()
    const d = addDays(DUE, -40)
    const row = planItems(s, d).find((i) => i.id === 'birth-partner-leave')!
    expect(row.end).toBeUndefined()
    expect(dateText(row, d)).toMatch(/~ 출생 후 120일 안$/)
    expect(myPrep(s, d, HIM).items?.find((i) => i.id === 'birth-partner-leave')?.untilText).toBe('출생 후 120일 안')
    expect(buildPartnerDay(s, d, HIM)!.myPrep?.items?.find((i) => i.id === 'birth-partner-leave')?.untilText).toBe('출생 후 120일 안')
    expect(due(s, d, 'partner-leave:')).toEqual([])
  })

  for (const [label, offset] of [
    ['two weeks early', -14],
    ['on the due day', 0],
    ['a week late', 7],
  ] as const) {
    it(`a birth ${label}: every day the notice says exactly the days the row has left`, () => {
      const birth = addDays(DUE, offset)
      const s = parenting(birth)
      const last = partnerLeaveLastDay(birth)
      expect(last).toBe(addDays(birth, 119))
      for (let d = birth; d <= addDays(last, 2); d = addDays(d, 1)) {
        const row = planItems(s, d).find((i) => i.id === 'birth-partner-leave')
        if (row) expect(row.end, d).toBe(last)
        const n = due(s, d, 'partner-leave:')
        const left = diffDays(d, last)
        if (left < 0 || left > 30) {
          expect(n, d).toEqual([])
          continue
        }
        expect(n, d).toHaveLength(1)
        const step = left > 7 ? 30 : left > 1 ? 7 : 1
        expect(n[0]!.key, d).toBe(leaveLeftKey(birth, step, HIM))
        expect(n[0]!.title, d).toBe(PARTNER_NOTICE_COPY.leaveLeft.title(left))
        expect(noticeTarget('system', 'parenting', n[0]!.key)).toBe('plan')
        expect(row, d).toBeDefined()
      }
    })
  }
})

// ── every new notice key → a tab → the card or row it opens ─

describe('every check-point notice opens a tab that shows what it is about', () => {
  it('신청 and 검사 준비 → 오늘 (the month task card); Tdap · 출산휴가 · 산후도우미 · 난임치료휴가 → 챙길 것 (their rows)', () => {
    const firstRun = decide(base(), 'partner-setup', '2026-10-01')
    const apply = due(firstRun, '2026-11-09', 'deadline:task-apply:')[0]!
    expect(noticeTarget('system', 'preparing', apply.key)).toBe('today')
    expect(monthlyTask(firstRun, '2026-11-09', HIM)).toMatchObject({ step: 'apply', canSayClosed: true })

    const booked = addAppointment(
      setFertilityApplied(base(), HIM, true, '2026-10-01'),
      { date: '2026-11-10', title: '정액검사', who: HIM, kind: 'test', taskId: FERTILITY_TEST_ID },
      HIM,
    )
    const prep = due(booked, '2026-11-05', 'deadline:task-prep:')[0]!
    expect(noticeTarget('system', 'preparing', prep.key)).toBe('today')
    expect(monthlyTask(booked, '2026-11-05', HIM)).toMatchObject({ step: 'test', stage: 'booked', meds: true })
    // The medicines words stay on his card: never in the notice.
    expect(`${prep.title} ${prep.body}`).not.toContain(TEST_MEDS_LINE)
    expect(`${prep.title} ${prep.body}`).not.toMatch(/약|주사/)

    const p = pregnant()
    for (const [d, prefix, row, to] of [
      [tdapNoticeDays(DUE)[0]!, 'tdap:', 'p3-partner-tdap', HIM],
      [addDays(DUE, -50), 'partner-leave-open:', 'birth-partner-leave', HIM],
      [postnatalCareOpens(DUE), 'postnatal-open:', 'p3-postnatal-care', HER],
      [postnatalCareOpens(DUE), 'postnatal-open:', 'p3-postnatal-care', HIM],
    ] as const) {
      const n = due(p, d, prefix).find((x) => x.to === to)
      expect(n, `${prefix} ${to}`).toBeDefined()
      expect(noticeTarget('system', 'pregnant', n!.key)).toBe('plan')
      // His own rows; her 산후도우미 row reaches his 챙길 것 as 같이 챙길 것 (together.togetherItems).
      const own = planItems(p, d).some((i) => i.id === row && i.owners.includes(to))
      const shared = togetherItems(p, d, to).some((i) => i.id === row)
      expect(own || shared, `${row} for ${to}`).toBe(true)
    }

    const clinic = startClinicMode(base(), '2026-10-01')
    const leave = due(clinic, '2026-11-27', 'program:')[0]!
    expect(noticeTarget('system', 'preparing', leave.key)).toBe('plan')
    expect(planItems(clinic, '2026-11-27').some((i) => i.id === 'pre-infertility-support')).toBe(true)
  })

  it('her week line → 오늘, where 우리 한 줄 draws the same summary', () => {
    const s = setPrepSeasonDone(base(), T, HIM, true)
    const n = weekDigestNotices(s, T)[0]!
    expect(noticeTarget('system', 'preparing', n.key)).toBe('today')
    expect(n.body).toBe(
      partnerWeekSummary(s, T, HIM)
        .map((l) => l.text)
        .join(' · '),
    )
  })
})

// ── her side never names his smoking, drinking or medicines ─

describe('her side: his 금연 · 술 · medicine rows have no name', () => {
  it('ownerViewOfCheck: 금연 / 술 쉬기 / a medicine row read 매일 체크 or 체크인 with no note; other rows unchanged', () => {
    expect(ownerViewOfCheck({ label: '금연', kind: 'habit' as const, note: '주 1회 체크인' }, true)).toEqual({
      label: UNNAMED_WEEKLY_TEXT,
      kind: 'habit',
    })
    expect(ownerViewOfCheck({ label: '술 쉬기', kind: 'habit' as const }, true).label).toBe(UNNAMED_WEEKLY_TEXT)
    expect(ownerViewOfCheck({ label: '담배 안 피우기', kind: 'habit' as const }, false).label).toBe(UNNAMED_DAILY_TEXT)
    expect(ownerViewOfCheck({ label: 'Finasteride', kind: 'medication' as const, note: '아침' }, false)).toEqual({
      label: UNNAMED_DAILY_TEXT,
      kind: 'habit',
    })
    const walk = { label: '걷기 30분', kind: 'habit' as const }
    expect(ownerViewOfCheck(walk, false)).toBe(walk)
  })

  // P4: rows he added himself in his own words (fix round 2026-11-01).
  const HIS_OWN_WORDS = [
    '맥주 안 마시기',
    '와인 쉬기',
    '소주 줄이기',
    '막걸리 끊기',
    '알코올 끊기',
    '니코틴 패치',
    '전담 끊기',
    '전자담배 끊기',
    '아이코스 끊기',
    '테스토스테론 주사',
    '호르몬제',
    '혈압약',
    'Finasteride',
    'No beer',
    'vape free',
  ]

  it('ownerViewOfCheck and the digest leave his own words for drinking, smoking and medicines unnamed (P4)', () => {
    for (const label of HIS_OWN_WORDS) {
      expect(isSensitiveCheck({ label, kind: 'habit' }), label).toBe(true)
      expect(ownerViewOfCheck({ label, kind: 'habit' as const }, false).label, label).toBe(UNNAMED_DAILY_TEXT)
      let s = addCheckItem(base(), HIM, label, 'habit', '2026-10-01')
      const id = activeItems(s, HIM).find((i) => i.label === label)!.id
      for (const d of ['2026-10-27', '2026-10-28']) s = toggleCheck(s, HIM, d, id)
      const body = weekDigestNotices(s, T)[0]!.body
      expect(body, label).not.toContain(label)
      expect(body, label).toContain(`${UNNAMED_DAILY_TEXT} 2일`)
    }
    // Ordinary rows keep their names.
    for (const label of ['걷기 30분', '7시간 이상 자기', '물 2L 마시기', '스트레칭']) {
      expect(isSensitiveCheck({ label, kind: 'habit' }), label).toBe(false)
    }
  })

  it('the 콕 target’s name on her screen: unnamed for those rows, his own label on his (P2)', () => {
    expect(nudgeTargetLabel({ label: 'Finasteride', kind: 'medication' }, true)).toBe(UNNAMED_DAILY_TEXT)
    expect(nudgeTargetLabel({ label: '담배 안 피우기', kind: 'habit' }, true)).toBe(UNNAMED_DAILY_TEXT)
    expect(nudgeTargetLabel({ label: '걷기 30분', kind: 'habit' }, true)).toBe('걷기 30분')
    expect(nudgeTargetLabel({ label: 'Finasteride', kind: 'medication' }, false)).toBe('Finasteride')
  })

  it('her week line: a medicine row he kept reads 매일 체크, never its name', () => {
    let s = addCheckItem(base(), HIM, 'Finasteride', 'medication', '2026-10-01')
    const id = activeItems(s, HIM).find((i) => i.label === 'Finasteride')!.id
    // Only that row kept: the other rows unticked.
    for (const d of ['2026-10-27', '2026-10-28', '2026-10-29']) s = toggleCheck(s, HIM, d, id)
    const lines = partnerWeekSummary(s, T, HIM).map((l) => l.text)
    expect(lines.join(' ')).not.toContain('Finasteride')
    expect(lines).toContain(`${UNNAMED_DAILY_TEXT} 3일`)
  })
})

// ── exports leave 아빠 마음 out ──────────────────────────────

describe('exports: the dad-mind-asked answer and his dad-mind notice never leave in a backup', () => {
  it('withoutDadMind drops both and nothing else; DataSection writes every backup through it', () => {
    const birth: ISODate = '2026-12-01'
    const day = dadMindDay(birth)
    let s = markDadMindAsked(parenting(birth), day, HIM)
    s = {
      ...s,
      notifications: [
        ...s.notifications,
        {
          id: 'n1',
          key: dadMindNoticeKey(birth, HIM),
          to: HIM,
          kind: 'system',
          title: 't',
          body: '',
          createdAt: `${day}T09:00:00+09:00`,
          read: false,
        },
      ],
    }
    const out = withoutDadMind(s)
    expect(Object.keys(out.decisions).some((k) => k.startsWith('dad-mind-asked:'))).toBe(false)
    expect(out.notifications.some((n) => n.key?.startsWith('dad-mind:'))).toBe(false)
    expect(Object.keys(out.decisions).length).toBe(Object.keys(s.decisions).length - 1)
    expect(out.notifications.length).toBe(s.notifications.length - 1)
    // The same object when there is nothing to drop.
    const plain = base()
    expect(withoutDadMind(plain)).toBe(plain)

    const src = readFileSync(join(ROOT, 'components/settings/DataSection.tsx'), 'utf8')
    expect(src).not.toMatch(/JSON\.stringify\(state\)/)
    expect(src).not.toMatch(/buildFullBackup\(state,/)
    expect(src.match(/withoutDadMind\(state\)/g)?.length).toBe(3)
  })

  it('the recovery screen’s raw download leaves them out too, and never throws on a broken shape (P7)', () => {
    const birth: ISODate = '2026-12-01'
    const day = dadMindDay(birth)
    const s = markDadMindAsked(
      mergeNotices(parenting(birth), allRuleNotices(parenting(birth), day), `${day}T09:00:00+09:00`).state,
      day,
      HIM,
    )
    expect(s.notifications.some((n) => n.key === dadMindNoticeKey(birth, HIM))).toBe(true)
    const raw = JSON.stringify(s)
    const out = JSON.parse(rawWithoutDadMind(raw)) as AppState
    expect(out).toEqual(withoutDadMind(s))
    // Nothing to leave out: the very same string back.
    const plain = JSON.stringify(base())
    expect(rawWithoutDadMind(plain)).toBe(plain)
    // Broken shapes come back unchanged.
    for (const broken of [
      '{not json',
      'null',
      '[]',
      '"text"',
      '{"decisions":{"dad-mind-asked:2026-12-01:a":"2027-03-01"}}',
      '{"notifications":"oops","decisions":{}}',
      '{"notifications":[],"decisions":"oops"}',
    ]) {
      expect(() => rawWithoutDadMind(broken), broken).not.toThrow()
      expect(rawWithoutDadMind(broken), broken).toBe(broken)
    }
    // A broken entry inside an otherwise fine list does not stop it.
    const mixed = JSON.stringify({ notifications: [null, 3, { key: 'dad-mind:2026-12-01:a' }, { key: 'x' }], decisions: null })
    expect(JSON.parse(rawWithoutDadMind(mixed))).toEqual({ notifications: [null, 3, { key: 'x' }], decisions: null })
    const src = readFileSync(join(ROOT, 'components/AppErrorBoundary.tsx'), 'utf8')
    expect(src).toMatch(/rawWithoutDadMind\(raw\)/)
    expect(src).not.toMatch(/downloadText\(BACKUP_FILENAME, raw,/)
  })
})

describe('answering 아빠 마음 marks his notice read (UI-3)', () => {
  it('either button: the decision, and his 💬 notice reads as read; her notices untouched', () => {
    const birth: ISODate = '2026-07-30'
    const day = '2026-11-01'
    const s = mergeNotices(parenting(birth), allRuleNotices(parenting(birth), day), `${day}T09:00:00+09:00`).state
    const notice = (st: AppState) => st.notifications.find((n) => n.key === dadMindNoticeKey(birth, HIM))
    expect(notice(s)).toMatchObject({ to: HIM, read: false })
    const after = markDadMindAsked(s, day, HIM)
    expect(after.decisions[dadMindKey(birth, HIM)]).toBe(day)
    expect(notice(after)).toMatchObject({ read: true })
    expect(after.notifications.filter((n) => n.key !== dadMindNoticeKey(birth, HIM))).toEqual(
      s.notifications.filter((n) => n.key !== dadMindNoticeKey(birth, HIM)),
    )
    // The link's 'dad-mind-asked' event goes through the same function.
    const viaLink = applyPartnerEvent(s, ev({ kind: 'dad-mind-asked' }), day)
    expect(viaLink).not.toBe(s)
    expect(notice(viaLink)).toMatchObject({ read: true })
  })
})
