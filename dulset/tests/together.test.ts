// 같이 챙길 것 (founder request 2026-10-09: "여자가 챙겨야 할 것들을 남자에게도
// 계속 보여줘야해 같이 하는거야.") — lib/logic/together.ts, the support lines in
// lib/content/data/roadmap.json, the pregnant '이번 주 우리 둘' catalogue
// (weekTogether), his pregnant 내 준비 (myPrep), the link's 'support' event
// (partnerEvents) and his heads-up the day before her appointment (planNotices).

import { describe, expect, it } from 'vitest'
import { ROADMAP, SUPPORT_MAX, SUPPORT_NOTE_MAX, templateById } from '@/lib/content/roadmap'
import { addDays, weekdayIndex } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { addLHTest, addPregnancyTest, logPeriodStart } from '@/lib/logic/logs'
import { PREGNANT_PREP_IDS, myPrep, pregnantPrepItems, pregnantPrepLine } from '@/lib/logic/myPrep'
import { applyPartnerEvent, cleanPartnerEvent, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { TOGETHER_VISIT_LINE, appointmentReminders, planDeadlineNotices, togetherTaskKey, togetherTaskNotices } from '@/lib/logic/planNotices'
import { planItems, tickItem } from '@/lib/logic/plan'
import { setShareLevel } from '@/lib/logic/prefs'
import { backToPreparing, recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { addCustomTask, STAGE_PHASES } from '@/lib/logic/roadmap'
import { endPregnancy, noticeTarget } from '@/lib/logic/today'
import {
  CUSTOM_SUPPORT,
  LINK_TOGETHER_MAX,
  NEUTRAL_DONE_LABEL,
  SUPPORT_LINES_MAX,
  WHEN_NEEDED,
  canSupportItem,
  carrierOf,
  isSupported,
  linkTogether,
  neutralStatus,
  partnerSupportLines,
  shortTitle,
  supportItem,
  supportKey,
  supportsFor,
  togetherItems,
  togetherRow,
  unsupportItem,
} from '@/lib/logic/together'
import {
  CHECKUP_DAY_OPTION,
  CLINIC_DAY_OPTION,
  PREGNANT_WEEK_OPTIONS,
  THIRD_TRIMESTER_OPTIONS,
  WEEK_OPTIONS,
  canThankWeek,
  markWeekDone,
  partnerWeekSummary,
  pickWeek,
  sharedCheckupInWeek,
  thankWeek,
  thanksThisWeek,
  thirdTrimesterWeek,
  weekOf,
  weekOptionById,
  weekOptions,
  weekTogetherOn,
} from '@/lib/logic/weekTogether'
import type { AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (함께하는 사람), 'b' = 지은 (기록하는 사람, carrier).
const OWNER: MemberId = 'b'
const PARTNER: MemberId = 'a'
const TODAY: ISODate = '2026-10-09' // a Friday

function fresh(): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-20',
      ttcStart: '2026-06-01',
    },
    new Date(2026, 5, 1, 9, 0),
  )
  return { ...s, createdAt: '2026-06-01T09:00:00+09:00', periods: [{ start: '2026-08-23' }, { start: '2026-09-20' }] }
}

/** Pregnant, 11주 4일 on TODAY (lmp 2026-07-20 → due 2027-04-26): NT is open now. */
function pregnant(lmp: ISODate = '2026-07-20'): AppState {
  return startPregnancy(fresh(), lmp, '2026-08-25')
}

/** Parenting: the baby came on `birth`. */
function parenting(birth: ISODate): AppState {
  const p = startPregnancy(fresh(), addDays(birth, -275), addDays(birth, -230))
  return recordBirth(p, { name: '하늘', birthDate: birth, sex: 'unknown' })
}

const NEUTRAL = new Set(['upcoming', 'this-week', 'done'])
/** What her item never says on his screen. */
const PRESSURE = /기한 지남|지났어요|안 했어요|마감|놓쳤|늦었/
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야/
const MEDICAL = /효과|예방|위험|낮춰|높여|줄여|좋아져|개선|치료|진단|처방|복용|확률|가능성|%/

const days = (from: ISODate, n: number, step = 1): ISODate[] => Array.from({ length: n }, (_, i) => addDays(from, i * step))

// ── Content ─────────────────────────────────────────────────

describe('support lines in the roadmap (lib/content/data/roadmap.json)', () => {
  it('every carrier item has one; partner items never do; short, a "~하기" phrase, no medical claim, no banned word', () => {
    for (const t of ROADMAP) {
      if (t.who === 'carrier') expect(t.support, t.id).toBeTruthy()
      if (t.who === 'partner') expect(t.support, t.id).toBeUndefined()
      if (!t.support) {
        expect(t.supportNote, t.id).toBeUndefined()
        continue
      }
      expect(t.support.length, t.id).toBeLessThanOrEqual(SUPPORT_MAX)
      expect(t.support, t.id).toMatch(/기$/)
      expect(t.support, t.id).not.toMatch(/요[.!]?$/)
      for (const text of [t.support, t.supportNote ?? '']) {
        expect(text, t.id).not.toMatch(MEDICAL)
        expect(text, t.id).not.toMatch(BANNED)
      }
      if (t.supportNote) {
        expect(t.supportNote.length, t.id).toBeLessThanOrEqual(SUPPORT_NOTE_MAX)
        expect(t.supportNote, t.id).toMatch(/요[.!]?$/)
      }
    }
    // About forty lines, written for this request.
    expect(ROADMAP.filter((t) => t.support).length).toBeGreaterThanOrEqual(40)
  })

  it('carries the lines the request names', () => {
    expect(templateById('p1-first-visit')?.support).toBe('같이 가기 · 확인서 받을 때 옆에 있기')
    expect(templateById('p1-voucher')?.support).toBe('신청 서류 같이 챙기기')
    expect(templateById('p1-nt')?.support).toBe('예약 시간 비워 두기')
    expect(templateById('pre-folic')?.support).toBe('떨어지기 전에 사 두기')
    // A shared item says who takes which half.
    expect(templateById('p3-hospital-bag')?.supportNote).toMatch(/각자.*내가/)
  })

  it('never recommends or finds a hospital, a product or an insurer', () => {
    for (const t of ROADMAP) expect(`${t.support ?? ''} ${t.supportNote ?? ''}`, t.id).not.toMatch(/추천|좋은 병원|병원 찾|상품|업체/)
  })
})

// ── Neutral statuses on his screen ──────────────────────────

describe('her items on his screen: neutral status only, never overdue', () => {
  const scenes: Array<[string, AppState, ISODate[]]> = [
    ['preparing', fresh(), days('2026-09-01', 20, 7)],
    ['pregnant', pregnant('2026-05-01'), days('2026-06-01', 40, 7)],
    ['parenting', parenting('2026-08-01'), days('2026-08-01', 30, 4)],
  ]

  it('property: every row of hers on his screen (togetherRow and togetherItems) is upcoming / this-week / done, with no pressure word', () => {
    for (const [name, s0, ds] of scenes) {
      // Tick a few of her items and book a few, so done / booked rows exist too.
      let s = s0
      const hers = ROADMAP.filter((t) => t.who === 'carrier' && STAGE_PHASES[s.stage].includes(t.phase))
      hers.slice(0, 3).forEach((t, i) => (s = tickItem(t.id, true, addDays(ds[0]!, i), OWNER)(s)))
      hers.slice(3, 6).forEach((t, i) => {
        s = addAppointment(s, { date: addDays(ds[3] ?? ds[0]!, i * 9), time: '10:30', title: t.title, place: '병원', who: OWNER, kind: 'hospital', note: '메모', taskId: t.id }, OWNER)
      })
      for (const d of ds) {
        for (const item of planItems(s, d)) {
          const row = togetherRow(s, d, PARTNER, item)
          if (row.whose !== 'theirs') continue
          const tag = `${name} ${d} ${item.id}`
          expect(NEUTRAL.has(row.status), tag).toBe(true)
          expect(row.status, tag).not.toBe('overdue')
          if (row.label) expect(row.label, tag).not.toMatch(PRESSURE)
        }
        for (const row of togetherItems(s, d, PARTNER)) {
          const tag = `${name} ${d} ${row.id}`
          if (row.whose === 'theirs') {
            expect(NEUTRAL.has(row.status), tag).toBe(true)
            expect(row.label, tag).not.toBeNull()
            expect(row.label!, tag).not.toMatch(PRESSURE)
          }
        }
      }
    }
  })

  it('her own screen keeps the plan’s normal status (a missed deadline still reads 기한 지남 to her)', () => {
    // 산후도우미 바우처 마감: birth + 59 days. Eleven days past it, unticked.
    const s = parenting('2026-08-01')
    const item = planItems(s, TODAY).find((i) => i.id === 'birth-postnatal-care')!
    expect(item.status).toBe('overdue')
    const hers = togetherRow(s, TODAY, OWNER, item)
    expect(hers.whose).toBe('mine')
    expect(hers.status).toBe('overdue')
    expect(hers.label).toBe('기한 지남')
    const his = togetherRow(s, TODAY, PARTNER, item)
    expect(his.whose).toBe('theirs')
    expect(his.label).toBeNull()
    // …and it leaves his near-term list instead of warning about her.
    expect(togetherItems(s, TODAY, PARTNER).some((r) => r.id === 'birth-postnatal-care')).toBe(false)
    expect(togetherItems(s, TODAY, OWNER).some((r) => r.id === 'birth-postnatal-care')).toBe(true)
  })

  it('neutralStatus: done, a booked day this week or later, an open window, an opening day, undated', () => {
    expect(neutralStatus({ status: 'done', lapsed: false }, TODAY)).toEqual({ status: 'done' })
    expect(neutralStatus({ status: 'overdue', lapsed: false }, TODAY)).toBeNull()
    expect(neutralStatus({ status: 'later', lapsed: true, start: '2026-08-01' }, TODAY)).toBeNull()
    expect(neutralStatus({ status: 'now', lapsed: false, start: '2026-10-01' }, TODAY, '2026-10-10')).toEqual({ status: 'this-week', date: '2026-10-10' })
    expect(neutralStatus({ status: 'now', lapsed: false, start: '2026-10-01' }, TODAY, '2026-10-21')).toEqual({ status: 'upcoming', date: '2026-10-21' })
    expect(neutralStatus({ status: 'now', lapsed: false, start: '2026-10-01' }, TODAY)).toEqual({ status: 'this-week' })
    expect(neutralStatus({ status: 'soon', lapsed: false, start: '2026-10-11' }, TODAY)).toEqual({ status: 'this-week', date: '2026-10-11' })
    expect(neutralStatus({ status: 'soon', lapsed: false, start: '2026-10-20' }, TODAY)).toEqual({ status: 'upcoming', date: '2026-10-20' })
    expect(neutralStatus({ status: 'undated', lapsed: false }, TODAY)).toEqual({ status: 'upcoming' })
  })

  it('labels read as the request asks: 예정 · 10월 21일 / 이번 주 / 했어요 ✓', () => {
    let s = pregnant()
    s = addAppointment(s, { date: '2026-10-21', title: 'NT 검사', who: OWNER, kind: 'test', taskId: 'p1-nt' }, OWNER)
    const nt = togetherItems(s, TODAY, PARTNER).find((r) => r.id === 'p1-nt')!
    expect(nt).toMatchObject({ whose: 'theirs', status: 'upcoming', label: '예정 · 10월 21일', date: '2026-10-21', ownerName: '지은님' })
    expect(nt.support).toBe('예약 시간 비워 두기')
    const voucher = togetherItems(s, TODAY, PARTNER).find((r) => r.id === 'p1-voucher')!
    expect(voucher).toMatchObject({ status: 'this-week', label: '이번 주', support: '신청 서류 같이 챙기기' })
    s = tickItem('p1-voucher', true, TODAY, OWNER)(s)
    const done = togetherItems(s, TODAY, PARTNER).find((r) => r.id === 'p1-voucher')!
    expect(done).toMatchObject({ status: 'done', label: NEUTRAL_DONE_LABEL })
  })
})

// ── The near-term list ──────────────────────────────────────

describe('togetherItems', () => {
  it('while preparing: her items show on his screen with what he can do', () => {
    const rows = togetherItems(fresh(), TODAY, PARTNER, { whose: ['theirs'] })
    const ids = rows.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['pre-checkup-carrier', 'pre-folic', 'pre-rubella', 'pre-varicella']))
    for (const r of rows) {
      expect(r.support, r.id).toBeTruthy()
      expect(r.canSupport, r.id).toBe(true)
      expect(r.label, r.id).toBe('예정')
    }
  })

  it('his own and shared items keep the plan’s status; support lines only for him, never for her', () => {
    const s = pregnant()
    for (const r of togetherItems(s, TODAY, PARTNER)) {
      if (r.whose === 'mine') expect(r.support, r.id).toBeUndefined()
    }
    for (const r of togetherItems(s, TODAY, OWNER)) {
      expect(r.support, r.id).toBeUndefined()
      expect(r.canSupport, r.id).toBe(false)
    }
    const first = togetherItems(s, TODAY, PARTNER).find((r) => r.id === 'p1-birth-hospital')!
    expect(first.whose).toBe('ours')
    expect(first.ownerName).toBe('둘이 함께')
    expect(first.support).toBe('상담 날 같이 가기 · 오가는 길 맡기')
  })

  it('sorted by date: what has a day first (by that day), then windows open now, then no date yet, done at the end', () => {
    let s = pregnant()
    s = addAppointment(s, { date: '2026-10-13', title: '보건소', who: OWNER, kind: 'admin', taskId: 'p1-health-center' }, OWNER)
    s = addAppointment(s, { date: '2026-10-12', title: 'NT', who: OWNER, kind: 'test', taskId: 'p1-nt' }, OWNER)
    s = tickItem('p1-flu', true, '2026-10-08', OWNER)(s)
    const rows = togetherItems(s, TODAY, PARTNER)
    const band = (r: (typeof rows)[number]) =>
      r.status === 'done' ? 3 : r.date ? 0 : r.status === 'this-week' || r.status === 'now' || r.status === 'overdue' ? 1 : 2
    const bands = rows.map(band)
    expect([...bands].sort((a, b) => a - b), JSON.stringify(rows.map((r) => [r.id, r.label]))).toEqual(bands)
    const dated = rows.filter((r) => r.date).map((r) => r.date!)
    expect([...dated].sort()).toEqual(dated)
    expect(rows.slice(0, 2).map((r) => r.id)).toEqual(['p1-nt', 'p1-health-center'])
    expect(rows[rows.length - 1]).toMatchObject({ id: 'p1-flu', status: 'done' })
  })

  it('leaves out what is "when it applies", previews of a later anchor and far-off days', () => {
    const s = pregnant()
    const ids = togetherItems(s, TODAY, PARTNER).map((r) => r.id)
    for (const id of WHEN_NEEDED) expect(ids).not.toContain(id)
    // Birth-day items wait for the birth (pending) and the third trimester is months away.
    expect(ids).not.toContain('birth-registration')
    expect(ids).not.toContain('p3-gbs')
    expect(togetherItems(s, TODAY, PARTNER, { limit: 2 })).toHaveLength(2)
    expect(togetherItems(s, TODAY, PARTNER, { whose: ['mine'] }).every((r) => r.whose === 'mine')).toBe(true)
  })

  it('her own items (직접 추가) show on his screen with a general line; a deleted one does not', () => {
    let s = addCustomTask(pregnant(), { title: '회사에 임신 소식 알리기', phase: 'pregnancy-1st', who: OWNER, due: '2026-10-15' }, OWNER)
    const id = s.customTasks[0]!.id
    const row = togetherItems(s, TODAY, PARTNER).find((r) => r.id === id)!
    expect(row).toMatchObject({ custom: true, whose: 'theirs', support: CUSTOM_SUPPORT, label: '예정 · 10월 15일', canSupport: true })
    s = { ...s, customTasks: s.customTasks.map((c) => ({ ...c, deletedAt: `${TODAY}T10:00:00+09:00` })) }
    expect(togetherItems(s, TODAY, PARTNER).some((r) => r.id === id)).toBe(false)
  })

  it('is the same whatever she logs privately: periods, LH, tests, personal days, 나만 보기, sharing level', () => {
    for (const base of [fresh(), pregnant()]) {
      const before = JSON.stringify([togetherItems(base, TODAY, PARTNER), linkTogether(base, TODAY, PARTNER)])
      const variants: AppState[] = [
        logPeriodStart(base, '2026-10-05', OWNER, TODAY),
        addLHTest(base, { date: '2026-10-08', result: 'positive' }, TODAY),
        addPregnancyTest(base, { date: '2026-10-08', result: 'positive' }, TODAY).state,
        setFeel(base, OWNER, TODAY, 'tired'),
        setPrivateNote(base, OWNER, TODAY, '나만 보는 메모'),
        setShareLevel(base, OWNER, 'none'),
        setShareLevel(base, OWNER, 'details'),
        { ...base, periods: [] },
      ]
      for (const v of variants) expect(JSON.stringify([togetherItems(v, TODAY, PARTNER), linkTogether(v, TODAY, PARTNER)])).toBe(before)
    }
  })
})

// ── [같이 할게요] ───────────────────────────────────────────

describe('[같이 할게요] round trip', () => {
  it('he says it, her screen reads it, he takes it back', () => {
    const s0 = pregnant()
    const s1 = supportItem(s0, PARTNER, 'p1-nt', TODAY)
    expect(s1.decisions[supportKey('p1-nt', PARTNER)]).toBe(TODAY)
    expect(isSupported(s1, 'p1-nt', PARTNER)).toBe(true)
    expect(supportsFor(s1, 'p1-nt')).toEqual([PARTNER])
    // Twice is one answer.
    expect(supportItem(s1, PARTNER, 'p1-nt', addDays(TODAY, 1))).toBe(s1)
    // His row.
    const his = togetherItems(s1, TODAY, PARTNER).find((r) => r.id === 'p1-nt')!
    expect(his.supported).toBe(true)
    // Her row and her 우리 한 줄.
    const hers = togetherItems(s1, TODAY, OWNER).find((r) => r.id === 'p1-nt')!
    expect(hers.supportedBy).toBe('민수님이 같이 챙긴대요')
    expect(partnerSupportLines(s1, TODAY, OWNER)).toEqual([{ itemId: 'p1-nt', day: TODAY, text: '민수님이 ‘NT(목덜미 투명대)’ 같이 챙긴대요' }])
    // He takes it back: gone everywhere, the decisions as they were.
    const s2 = unsupportItem(s1, PARTNER, 'p1-nt')
    expect(s2.decisions).toEqual(s0.decisions)
    expect(togetherItems(s2, TODAY, OWNER).find((r) => r.id === 'p1-nt')!.supportedBy).toBeUndefined()
    expect(partnerSupportLines(s2, TODAY, OWNER)).toEqual([])
    expect(unsupportItem(s2, PARTNER, 'p1-nt')).toBe(s2)
  })

  it('only him, only on her open items or shared ones of this stage, never his own', () => {
    const s = pregnant()
    // The carrier does not "support" her own item; his own item is his.
    expect(supportItem(s, OWNER, 'p1-nt', TODAY)).toBe(s)
    expect(supportItem(s, PARTNER, 'p1-partner-support', TODAY)).toBe(s)
    // Shared (both) with a support line: yes. Shared without one: no.
    expect(isSupported(supportItem(s, PARTNER, 'p1-birth-hospital', TODAY), 'p1-birth-hospital', PARTNER)).toBe(true)
    expect(supportItem(s, PARTNER, 'p1-visit-schedule', TODAY)).not.toBe(s)
    expect(supportItem(s, PARTNER, 'birth-metabolic', TODAY)).toBe(s)
    // Not a stage's item (임신 준비 while pregnant), not a done one, not a made-up one.
    expect(supportItem(s, PARTNER, 'pre-folic', TODAY)).toBe(s)
    expect(supportItem(tickItem('p1-voucher', true, TODAY, OWNER)(s), PARTNER, 'p1-voucher', TODAY)).toEqual(tickItem('p1-voucher', true, TODAY, OWNER)(s))
    expect(supportItem(s, PARTNER, 'nope', TODAY)).toBe(s)
    expect(supportItem(s, PARTNER, 'p1-nt', 'not-a-day')).toBe(s)
    // Keys stay short (lib/sync/model DECISION_KEY_MAX) and carry an id and a member only.
    expect(supportKey('p1-nt', PARTNER)).toBe('support:p1-nt:a')
  })

  it('her 우리 한 줄: at most two lines, newest first, last week only, open items only', () => {
    let s = pregnant()
    s = supportItem(s, PARTNER, 'p1-voucher', '2026-10-01')
    s = supportItem(s, PARTNER, 'p1-health-center', '2026-10-05')
    s = supportItem(s, PARTNER, 'p1-nt', '2026-10-08')
    s = supportItem(s, PARTNER, 'p1-prenatal-labs', TODAY)
    const lines = partnerSupportLines(s, TODAY, OWNER)
    expect(lines).toHaveLength(SUPPORT_LINES_MAX)
    expect(lines.map((l) => l.itemId)).toEqual(['p1-prenatal-labs', 'p1-nt'])
    s = tickItem('p1-prenatal-labs', true, TODAY, OWNER)(s)
    expect(partnerSupportLines(s, TODAY, OWNER).map((l) => l.itemId)).toEqual(['p1-nt', 'p1-health-center'])
    // His own 우리 한 줄 gets none of these (they are his).
    expect(partnerSupportLines(s, TODAY, PARTNER)).toEqual([])
    // Ten days later the week has passed.
    expect(partnerSupportLines(s, addDays(TODAY, 10), OWNER)).toEqual([])
  })

  it('an answer from an earlier pregnancy is not an answer for this one', () => {
    let s = supportItem(pregnant('2026-03-01'), PARTNER, 'p2-quad', '2026-06-20')
    expect(isSupported(s, 'p2-quad', PARTNER)).toBe(true)
    s = backToPreparing(s, '2026-07-01')
    s = startPregnancy({ ...s, stage: 'preparing' }, '2026-09-01', '2026-10-01')
    expect(isSupported(s, 'p2-quad', PARTNER)).toBe(false)
    expect(supportsFor(s, 'p2-quad')).toEqual([])
    // Saying it again starts it afresh.
    const again = supportItem(s, PARTNER, 'p1-nt', TODAY)
    expect(isSupported(again, 'p1-nt', PARTNER)).toBe(true)
  })

  it('parenting: the same lines appear on her postpartum items', () => {
    const s = parenting('2026-09-20')
    const rows = togetherItems(s, TODAY, PARTNER, { whose: ['theirs'] })
    const care = rows.find((r) => r.id === 'birth-postnatal-care')!
    expect(care.support).toBe('신청은 내가 마무리하기')
    expect(care.canSupport).toBe(true)
    expect(STAGE_PHASES.parenting).toContain(care.phase)
  })
})

// ── Quiet ───────────────────────────────────────────────────

describe('quiet after a loss', () => {
  it('no list, no [같이 할게요], no line, no link for 42 days; back afterwards', () => {
    let s = supportItem(pregnant(), PARTNER, 'p1-nt', '2026-10-01')
    s = endPregnancy(s, '2026-10-05')
    for (const d of [TODAY, addDays('2026-10-05', 30), addDays('2026-10-05', 41)]) {
      expect(togetherItems(s, d, PARTNER)).toEqual([])
      expect(togetherItems(s, d, OWNER)).toEqual([])
      expect(linkTogether(s, d, PARTNER)).toBeUndefined()
      expect(partnerSupportLines(s, d, OWNER)).toEqual([])
      expect(supportItem(s, PARTNER, 'pre-folic', d)).toBe(s)
      expect(weekOptions(s, d, PARTNER)).toEqual([])
      expect(myPrep(s, d, PARTNER)).toEqual({})
    }
    // The loss rest ends with its 42nd day; then the preparing list is back.
    const after = addDays('2026-10-05', 60)
    expect(togetherItems({ ...s, restCycle: undefined }, after, PARTNER).length).toBeGreaterThan(0)
  })
})

// ── The link ────────────────────────────────────────────────

describe('linkTogether — exactly what the link may carry', () => {
  it('her items and shared ones with a support line; neutral statuses; never custom items, times, places, titles or notes of appointments', () => {
    let s = pregnant()
    s = addAppointment(s, { date: '2026-10-12', time: '14:20', title: '목덜미 검사 예약', place: '서울여성병원', who: OWNER, kind: 'test', note: '공복 메모', taskId: 'p1-nt' }, OWNER)
    s = addCustomTask(s, { title: '비밀 메모 할 일', phase: 'pregnancy-1st', who: OWNER, due: '2026-10-12' }, OWNER)
    const link = linkTogether(s, TODAY, PARTNER)!
    expect(link.ownerName).toBe('지은님')
    expect(link.items.length).toBeGreaterThan(0)
    expect(link.items.length).toBeLessThanOrEqual(LINK_TOGETHER_MAX)
    const json = JSON.stringify(link)
    for (const secret of ['14:20', '서울여성병원', '목덜미 검사 예약', '공복 메모', '비밀 메모']) expect(json).not.toContain(secret)
    for (const it of link.items) {
      expect(templateById(it.id), it.id).toBeTruthy()
      expect(NEUTRAL.has(it.status), it.id).toBe(true)
      expect(it.support, it.id).toBeTruthy()
      expect(it.label, it.id).not.toMatch(PRESSURE)
      expect(Object.keys(it).sort(), it.id).toEqual(
        expect.arrayContaining(['canSupport', 'id', 'kind', 'label', 'status', 'support', 'supported', 'title', 'whose']),
      )
      expect(Object.keys(it).every((k) => ['canSupport', 'date', 'id', 'kind', 'label', 'status', 'support', 'supportNote', 'supported', 'title', 'whose'].includes(k))).toBe(
        true,
      )
    }
    // Pregnant: the booked DAY travels (and only the day).
    expect(link.items.find((i) => i.id === 'p1-nt')).toMatchObject({ date: '2026-10-12', status: 'upcoming', label: '예정 · 10월 12일' })
  })

  it('while preparing her bookings stay in the app (N32: her own appointments never travel)', () => {
    const s = addAppointment(fresh(), { date: '2026-10-12', title: '풍진 검사', who: OWNER, kind: 'test', taskId: 'pre-rubella' }, OWNER)
    const app = togetherItems(s, TODAY, PARTNER).find((r) => r.id === 'pre-rubella')!
    expect(app.date).toBe('2026-10-12')
    const link = linkTogether(s, TODAY, PARTNER)!
    const row = link.items.find((i) => i.id === 'pre-rubella')
    if (row) expect(row.date).toBeUndefined()
    expect(JSON.stringify(link)).not.toContain('2026-10-12')
  })

  it('nothing for the carrier herself, nothing in the quiet', () => {
    expect(linkTogether(pregnant(), TODAY, OWNER)).toBeUndefined()
    expect(linkTogether(endPregnancy(pregnant(), '2026-10-01'), TODAY, PARTNER)).toBeUndefined()
    expect(carrierOf(fresh())).toBe(OWNER)
  })

  it('a support he sent shows as supported, and canSupport stays on for the undo', () => {
    const s = supportItem(pregnant(), PARTNER, 'p1-voucher', TODAY)
    const row = linkTogether(s, TODAY, PARTNER)!.items.find((i) => i.id === 'p1-voucher')!
    expect(row).toMatchObject({ supported: true, canSupport: true })
  })
})

// ── The 'support' event ─────────────────────────────────────

describe("partner event 'support' {itemId, on}", () => {
  const ev = (id: string, itemId: string, on: boolean, from?: MemberId): PartnerEvent => ({ id, kind: 'support', itemId, on, ...(from ? { from } : {}) })

  it('parses only its own fields', () => {
    expect(cleanPartnerEvent({ id: 's1', kind: 'support', itemId: 'p1-nt', on: true, note: 'free text' })).toEqual({ id: 's1', kind: 'support', itemId: 'p1-nt', on: true })
    expect(cleanPartnerEvent({ id: 's1', kind: 'support', itemId: 'p1-nt', on: 'yes' })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 's1', kind: 'support', itemId: 'has space', on: true })).toBeUndefined()
    expect(cleanPartnerEvent({ id: 's1', kind: 'support', on: true })).toBeUndefined()
  })

  it('round trip on her phone: on → the same decision the app writes; again → nothing; off → gone', () => {
    const s0 = pregnant()
    const s1 = applyPartnerEvent(s0, ev('s1', 'p1-nt', true, PARTNER), TODAY)
    expect(s1.decisions[supportKey('p1-nt', PARTNER)]).toBe(TODAY)
    expect(applyPartnerEvent(s1, ev('s1', 'p1-nt', true, PARTNER), TODAY)).toBe(s1)
    const s2 = applyPartnerEvent(s1, ev('s2', 'p1-nt', true), TODAY)
    expect(s2.decisions[supportKey('p1-nt', PARTNER)]).toBe(TODAY)
    const s3 = applyPartnerEvent(s2, ev('s3', 'p1-nt', false), TODAY)
    expect(s3.decisions[supportKey('p1-nt', PARTNER)]).toBeUndefined()
    expect(isSupported(s3, 'p1-nt', PARTNER)).toBe(false)
  })

  it('rejects the carrier as sender, his own items, the couple’s own items, unknown ids, and the quiet', () => {
    const s = pregnant()
    expect(partnerEventProblem(s, ev('x1', 'p1-nt', true, OWNER), TODAY)).toBe('actor')
    expect(partnerEventProblem(s, ev('x2', 'p1-partner-support', true), TODAY)).toBe('support')
    expect(partnerEventProblem(s, ev('x3', 'nope', true), TODAY)).toBe('support')
    const custom = addCustomTask(s, { title: '할 일', phase: 'pregnancy-1st', who: OWNER }, OWNER)
    expect(partnerEventProblem(custom, ev('x4', custom.customTasks[0]!.id, true), TODAY)).toBe('support')
    const lost = endPregnancy(s, '2026-10-01')
    expect(partnerEventProblem(lost, ev('x5', 'pre-folic', true), TODAY)).toBe('support')
    // Taking it back is always fine.
    expect(partnerEventProblem(lost, ev('x6', 'pre-folic', false), TODAY)).toBeNull()
    // Nothing of hers changes: no record, only the answer and the event mark.
    const after = applyPartnerEvent(s, ev('x7', 'p1-voucher', true), TODAY)
    for (const k of ['periods', 'lhTests', 'pregnancyTests', 'appointments', 'planDone', 'milestones', 'customTasks', 'personalLog', 'settings'] as const) {
      expect(after[k], k).toBe(s[k])
    }
    expect(Object.keys(after.decisions).filter((k) => !(k in s.decisions)).sort()).toEqual(['partner-event:x7', 'support:p1-voucher:a'])
  })
})

// ── '이번 주 우리 둘' while pregnant ────────────────────────

describe('pregnant week loop', () => {
  const PREG_IDS = new Set([...PREGNANT_WEEK_OPTIONS, ...THIRD_TRIMESTER_OPTIONS, CHECKUP_DAY_OPTION].map((o) => o.id))
  const THIRD = new Set(THIRD_TRIMESTER_OPTIONS.map((o) => o.id))
  const RISKY = /가임|배란|LH|생리|테스트|타이밍|숙제|실패|노력|오늘 꼭|관계|태교|영양|체중|운동|약|증상/

  it('runs while pregnant, from its own catalogue — relationship-side, practical, no medical word', () => {
    const s = pregnant()
    expect(weekTogetherOn(s, TODAY)).toBe(true)
    for (const o of [...PREGNANT_WEEK_OPTIONS, ...THIRD_TRIMESTER_OPTIONS, CHECKUP_DAY_OPTION]) {
      expect(`${o.text} ${o.doneText}`, o.id).not.toMatch(RISKY)
      expect(weekOptionById(o.id)).toEqual(o)
    }
    for (const d of days('2026-08-03', 30, 7)) {
      const opts = weekOptions(s, d, PARTNER)
      expect(opts).toHaveLength(3)
      expect(new Set(opts.map((o) => o.id)).size).toBe(3)
      for (const o of opts) expect(PREG_IDS.has(o.id), `${d} ${o.id}`).toBe(true)
      // The same all week, and nothing for her.
      expect(weekOptions(s, addDays(weekOf(d), 6), PARTNER)).toEqual(opts)
      expect(weekOptions(s, d, OWNER)).toEqual([])
    }
    expect(weekOptions({ ...s, stage: 'parenting' }, TODAY, PARTNER)).toEqual([])
  })

  it('third-trimester picks come only from 28주 (read on the week’s Monday)', () => {
    const s = pregnant('2026-03-02') // 28주 on 2026-09-14 (a Monday)
    expect(thirdTrimesterWeek(s, '2026-09-07')).toBe(false)
    expect(thirdTrimesterWeek(s, '2026-09-14')).toBe(true)
    let seenThird = false
    for (const d of days('2026-06-01', 14, 7)) for (const o of weekOptions(s, d, PARTNER)) expect(THIRD.has(o.id), `${d} ${o.id}`).toBe(false)
    for (const d of days('2026-09-14', 16, 7)) if (weekOptions(s, d, PARTNER).some((o) => THIRD.has(o.id))) seenThird = true
    expect(seenThird).toBe(true)
  })

  it("'검진 날 같이 가기' only in a week with a checkup of hers or of both — not his own, not admin", () => {
    const s = pregnant()
    const plain = weekOptions(s, '2026-10-12', PARTNER)
    expect(plain.some((o) => o.id === 'checkup-day')).toBe(false)
    const his = addAppointment(s, { date: '2026-10-14', title: '내 검진', who: PARTNER, kind: 'hospital' }, PARTNER)
    expect(weekOptions(his, '2026-10-12', PARTNER)).toEqual(plain)
    const admin = addAppointment(s, { date: '2026-10-14', title: '서류', who: OWNER, kind: 'admin' }, OWNER)
    expect(weekOptions(admin, '2026-10-12', PARTNER)).toEqual(plain)
    const hers = addAppointment(s, { date: '2026-10-14', title: '정기 검진', who: OWNER, kind: 'hospital', note: '메모' }, OWNER)
    expect(sharedCheckupInWeek(hers, '2026-10-12')).toBe(true)
    const withCheckup = weekOptions(hers, '2026-10-12', PARTNER)
    expect(withCheckup[2]).toEqual(CHECKUP_DAY_OPTION)
    expect(withCheckup.slice(0, 2)).toEqual(plain.slice(0, 2))
    // The week before and after: no.
    expect(weekOptions(hers, '2026-10-05', PARTNER).some((o) => o.id === 'checkup-day')).toBe(false)
    expect(weekOptions(hers, '2026-10-19', PARTNER).some((o) => o.id === 'checkup-day')).toBe(false)
    const both = addAppointment(s, { date: '2026-10-18', title: '정밀초음파', who: 'both', kind: 'test' }, OWNER)
    expect(weekOptions(both, '2026-10-12', PARTNER)[2]).toEqual(CHECKUP_DAY_OPTION)
    // The clinic-day pick belongs to preparing only.
    expect(weekOptions(both, '2026-10-12', PARTNER)).not.toContainEqual(CLINIC_DAY_OPTION)
  })

  it('[했어요] and her weekly [고마워요] work while pregnant, with the same keys', () => {
    let s = pregnant()
    const pick = weekOptions(s, TODAY, PARTNER)[0]!
    s = pickWeek(s, PARTNER, pick.id, TODAY)
    s = markWeekDone(s, PARTNER, TODAY)
    expect(Object.keys(s.decisions)).toEqual(expect.arrayContaining([`week-pick:${weekOf(TODAY)}:${PARTNER}:${pick.id}`, `week-done:${weekOf(TODAY)}:${PARTNER}`]))
    expect(partnerWeekSummary(s, TODAY, PARTNER)[0]).toEqual({ kind: 'week-done', text: pick.doneText })
    expect(canThankWeek(s, OWNER, TODAY)).toBe(true)
    s = thankWeek(s, OWNER, TODAY)
    expect(thanksThisWeek(s, PARTNER, TODAY)).toEqual({ from: OWNER, day: TODAY })
  })

  it('preparing weeks offer exactly what they did before (the rotation is unchanged)', () => {
    // FNV-1a over `${createdAt}|${week}|${id}` — the preparing seed has no stage part.
    const hash = (text: string) => {
      let h = 0x811c9dc5
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return h >>> 0
    }
    const s = fresh()
    for (const d of days('2026-01-05', 52, 7)) {
      const seed = `${s.createdAt}|${weekOf(d)}|`
      const expected = [...WEEK_OPTIONS]
        .map((o) => ({ o, h: hash(seed + o.id) }))
        .sort((x, y) => x.h - y.h || (x.o.id < y.o.id ? -1 : 1))
        .slice(0, 3)
        .map((x) => x.o.id)
      expect(weekOptions(s, d, PARTNER).map((o) => o.id), d).toEqual(expected)
    }
  })
})

// ── His 내 준비 while pregnant ──────────────────────────────

describe('myPrep while pregnant', () => {
  it('lists his own items; the line names what is next and never says 0', () => {
    const s = pregnant()
    const p = myPrep(s, TODAY, PARTNER)
    expect(p.items?.map((i) => i.id).sort()).toEqual([...PREGNANT_PREP_IDS].sort())
    expect(p.chainStep).toBe('다음은 배우자 지원 제도 살펴보기')
    expect(p.chainStep).not.toMatch(/(^|\D)0\//)
    expect(p.timerLabel).toBeUndefined()
    const one = tickItem('p1-partner-support', true, TODAY, PARTNER)(s)
    const p1 = myPrep(one, TODAY, PARTNER)
    expect(p1.chainStep).toMatch(/^1\/5 ✓ · 다음은 육아휴직 계획 세우기 \(\d+월 \d+일부터\)$/)
    expect(p1.items?.[0]).toMatchObject({ id: 'p1-partner-support', state: 'done' })
    let all = one
    for (const id of PREGNANT_PREP_IDS) all = tickItem(id, true, TODAY, PARTNER)(all)
    expect(myPrep(all, TODAY, PARTNER).chainStep).toBe('5개 모두 챙겼어요 ✓')
  })

  it('the next item carries its day: from when it opens, until when an open one closes', () => {
    // 36주: Tdap (예정일 60일 전 ~ 14일 전) is open.
    const s = pregnant('2026-02-01')
    let t = s
    for (const id of ['p1-partner-support', 'p3-parental-leave', 'p3-car-seat']) t = tickItem(id, true, TODAY, PARTNER)(t)
    const items = pregnantPrepItems(t, TODAY)
    const tdap = items.find((i) => i.id === 'p3-partner-tdap')!
    expect(tdap.state).toBe('now')
    expect(pregnantPrepLine(items, TODAY)).toMatch(/^3\/5 ✓ · 다음은 Tdap 접종 \(\d+월 \d+일까지\)$/)
  })

  it('nothing for her; the same whatever she logs', () => {
    const s = pregnant()
    expect(myPrep(s, TODAY, OWNER)).toEqual({})
    const before = myPrep(s, TODAY, PARTNER)
    expect(myPrep(setFeel(s, OWNER, TODAY, 'tired'), TODAY, PARTNER)).toEqual(before)
    expect(myPrep(addLHTest(s, { date: TODAY, result: 'positive' }, TODAY), TODAY, PARTNER)).toEqual(before)
  })
})

// ── His heads-up the day before ─────────────────────────────

describe('planNotices: his heads-up the day before her appointment (pregnant)', () => {
  const WEEKDAY = weekdayIndex(TODAY)

  it('rewords the plain heads-up with what he can do — one notice, the same key', () => {
    let s = pregnant()
    s = addAppointment(s, { date: addDays(TODAY, 1), time: '10:00', title: '정기 검진', place: '병원', who: OWNER, kind: 'hospital', note: '메모' }, OWNER)
    const a = s.appointments[0]!
    const forHim = appointmentReminders(s, TODAY).filter((n) => n.to === PARTNER)
    expect(forHim).toHaveLength(1)
    expect(forHim[0]).toMatchObject({
      key: `appt:${a.id}:${a.date}:fyi:${PARTNER}`,
      title: '🏥 내일 지은님 정기 검진이에요',
      body: `${TOGETHER_VISIT_LINE} · 10월 10일 (토) 10:00 · 병원`,
    })
    expect(`${forHim[0]!.title} ${forHim[0]!.body}`).not.toContain('메모')
    expect(noticeTarget(forHim[0]!.kind, 'pregnant', forHim[0]!.key)).toBe('plan')
    expect(WEEKDAY).toBe(5)
  })

  it('uses the item’s own support line when the appointment is for a roadmap item', () => {
    let s = pregnant()
    s = addAppointment(s, { date: addDays(TODAY, 1), title: 'NT 검사', who: OWNER, kind: 'test', taskId: 'p1-nt' }, OWNER)
    const n = appointmentReminders(s, TODAY).find((x) => x.to === PARTNER)!
    expect(n.title).toBe('🔬 내일 지은님 NT 검사예요')
    expect(n.body.startsWith('예약 시간 비워 두기 · ')).toBe(true)
  })

  it('keeps the plain heads-up while preparing, for an alert style of off, and gives her nothing new', () => {
    const add = (s: AppState) =>
      addAppointment(s, { date: addDays(TODAY, 1), title: '정기 검진', who: OWNER, kind: 'hospital' }, OWNER)
    const prep = appointmentReminders(add(fresh()), TODAY).find((n) => n.to === PARTNER)!
    expect(prep.title).toContain('내일 지은님 일정')
    const off = add(pregnant())
    const quiet = { ...off, settings: { ...off.settings, alertStyle: { ...off.settings.alertStyle, [PARTNER]: 'off' as const } } }
    expect(appointmentReminders(quiet, TODAY).find((n) => n.to === PARTNER)!.title).toContain('내일 지은님 일정')
    const hers = appointmentReminders(add(pregnant()), TODAY).filter((n) => n.to === OWNER)
    expect(hers.every((n) => !n.body.includes(TOGETHER_VISIT_LINE))).toBe(true)
  })

  it('her own dated item tomorrow: one line for him, keyed by id and day, opening 챙길 것', () => {
    let s = addCustomTask(pregnant(), { title: '산모수첩 챙기기', phase: 'pregnancy-1st', who: OWNER, due: addDays(TODAY, 1) }, OWNER)
    const id = s.customTasks[0]!.id
    const notes = togetherTaskNotices(s, TODAY)
    expect(notes).toEqual([
      {
        key: togetherTaskKey(id, addDays(TODAY, 1), PARTNER),
        to: PARTNER,
        kind: 'system',
        title: '📝 내일 지은님 산모수첩 챙기기',
        body: '도울 게 있는지 물어보기 · 10월 10일 (토)',
      },
    ])
    expect(notes[0]!.key).toMatch(/^deadline:together:[\w-]+:\d{4}-\d{2}-\d{2}:[ab]$/)
    expect(noticeTarget('system', 'pregnant', notes[0]!.key)).toBe('plan')
    expect(planDeadlineNotices(s, TODAY).filter((n) => n.key === notes[0]!.key)).toHaveLength(1)
    // Not the day after, not once done, not while preparing, not in the quiet.
    expect(togetherTaskNotices(s, addDays(TODAY, 1))).toEqual([])
    s = tickItem(id, true, TODAY, OWNER)(s)
    expect(togetherTaskNotices(s, TODAY)).toEqual([])
    const prep = addCustomTask(fresh(), { title: '할 일', phase: 'preconception', who: OWNER, due: addDays(TODAY, 1) }, OWNER)
    expect(togetherTaskNotices(prep, TODAY)).toEqual([])
  })

  it('none in the quiet after a loss', () => {
    let s = addAppointment(pregnant(), { date: addDays(TODAY, 1), title: '정기 검진', who: OWNER, kind: 'hospital' }, OWNER)
    s = endPregnancy(s, '2026-10-05')
    expect(appointmentReminders(s, TODAY).some((n) => n.body.includes(TOGETHER_VISIT_LINE))).toBe(false)
    expect(togetherTaskNotices(s, TODAY)).toEqual([])
  })
})

describe('shortTitle', () => {
  it('keeps the head of a catalogue title', () => {
    expect(shortTitle('국민행복카드 (임신·출산 진료비) 신청')).toBe('국민행복카드')
    expect(shortTitle('첫 산부인과 진료 · 임신확인서')).toBe('첫 산부인과 진료')
    expect(shortTitle('정밀초음파')).toBe('정밀초음파')
    expect(shortTitle('아주 길고 긴 직접 추가한 할 일 제목이에요')).toHaveLength(18)
  })
})

describe('canSupportItem', () => {
  it('agrees with what togetherRow offers', () => {
    const s = pregnant()
    for (const item of planItems(s, TODAY)) {
      expect(togetherRow(s, TODAY, PARTNER, item).canSupport, item.id).toBe(canSupportItem(s, PARTNER, item, TODAY))
      expect(canSupportItem(s, OWNER, item, TODAY), item.id).toBe(false)
    }
  })
})
