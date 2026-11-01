// His check-point notices and her week line (founder 2026-11-01, '12개 전부'):
// lib/logic/partnerNotices.ts. When each one fires and to whom, the catch-up
// rule (first open on or after its day, once, with the real days left), his
// two-a-week cap, the quiet after a loss, the lock screen, where a tap opens,
// key safety, and the property that nothing of hers reaches him.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { addCheckItem, toggleCheck } from '@/lib/logic/checks'
import { startClinicMode } from '@/lib/logic/clinic'
import { addLHTest, addPregnancyTest, logPeriodStart } from '@/lib/logic/logs'
import { LAST_WEEK_THANKS_BODY, WEEK_THANKS_BODY, mergeNotices, type Notice } from '@/lib/logic/notifications'
import { DAD_MIND_LAST_OFFSET, PARTNER_FLU_ID, partnerLeaveLastDay } from '@/lib/logic/partnerDates'
import {
  PARTNER_NOTICE_COPY,
  PARTNER_NOTICE_PREFIXES,
  PARTNER_WEEKLY_CAP,
  allRuleNotices,
  canThankFromDigest,
  checkpointCandidates,
  countsTowardCap,
  digestWeek,
  firstMondayOfJanuary,
  mondayOnOrAfter,
  partnerCheckpointNotices,
  partnerFirstRunDay,
  pregnancyTag,
  thankFromDigest,
  thankedForDigest,
  weekDigestNotices,
} from '@/lib/logic/partnerNotices'
import { FERTILITY_TEST_ID, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { MONTHLY_TASK_KEY_SAFE } from '@/lib/logic/planNotices'
import { tickItem } from '@/lib/logic/plan'
import { setAlertStyle, lockScreenText } from '@/lib/logic/settings'
import { recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { endPregnancy, noticeTarget } from '@/lib/logic/today'
import { bellInbox, bellUnread } from '@/lib/logic/usView'
import { canThankWeek, markWeekDone, pickWeek, weekOptions, weekThanked } from '@/lib/logic/weekTogether'
import { decide } from '@/lib/sync/model'
import type { AppNotification, AppState, ISODate, MemberId, Stage } from '@/lib/types'

const ROOT = join(__dirname, '..')

/** components/AppShell.tsx TAB_SETS, by key (a source check below keeps them in step). */
const TAB_KEYS_BY_STAGE: Record<Stage, string[]> = {
  preparing: ['today', 'cycle', 'plan', 'diary'],
  pregnant: ['today', 'pregnancy', 'plan', 'diary'],
  parenting: ['today', 'baby', 'diary', 'plan'],
}
const HIM: MemberId = 'a' // 민수
const HER: MemberId = 'b' // 지은, records the cycle

function base(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: HER, lastPeriodStart: '2026-01-01' },
    new Date(2026, 0, 2, 9),
  )
}

/** Due 2026-12-06 (LMP 2026-03-01), recorded 2026-04-10. */
const LMP: ISODate = '2026-03-01'
const DUE: ISODate = '2026-12-06'
const CONFIRMED: ISODate = '2026-04-10'
const pregnant = (): AppState => startPregnancy(base(), LMP, CONFIRMED)
const parenting = (birth: ISODate): AppState => recordBirth(pregnant(), { name: '콩이', birthDate: birth, sex: 'unknown' })

const stamp = (d: ISODate) => `${d}T09:00:00+09:00`
/** One app open on `d`: every rule, merged by key (useNotificationEngine). */
const open = (s: AppState, d: ISODate): AppState => mergeNotices(s, allRuleNotices(s, d), stamp(d)).state

function days(from: ISODate, to: ISODate, step = 1): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, step)) out.push(d)
  return out
}

const isOurs = (key: string | undefined) => !!key && PARTNER_NOTICE_PREFIXES.some((p) => key.startsWith(p))
const ours = <T extends { key?: string }>(list: readonly T[]) => list.filter((n) => isOurs(n.key))
const withPrefix = <T extends { key?: string }>(list: readonly T[], prefix: string) => list.filter((n) => n.key?.startsWith(prefix))
/** What one rule says on its own (before his weekly cap). */
const due = (s: AppState, d: ISODate, prefix: string) => withPrefix(checkpointCandidates(s, d), prefix)

function note(key: string, to: MemberId, at: ISODate): AppNotification {
  return { id: key, key, to, kind: 'system', title: 't', body: '', createdAt: stamp(at), read: true }
}

// ── each rule ───────────────────────────────────────────────

describe('② 올해 독감 접종: once per 절기, while the row is open and unticked', () => {
  it('preparing 10/1–12/31, pregnant 10/1–4/30, never parenting; ticked or outside → nothing', () => {
    expect(due(base(), '2026-09-30', 'flu-season:')).toEqual([])
    const n = due(base(), '2026-10-01', 'flu-season:')
    expect(n).toEqual([{ key: 'flu-season:2026-27:a', to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.flu }])
    expect(due(base(), '2026-12-31', 'flu-season:')).toHaveLength(1)
    expect(due(base(), '2027-01-02', 'flu-season:')).toEqual([])
    // Pregnant: January–April still inside (KDCA 2026-27), May not.
    expect(due(pregnant(), '2027-01-15', 'flu-season:').map((x) => x.key)).toEqual(['flu-season:2026-27:a'])
    const lateDue = startPregnancy(base(), '2026-12-01', '2027-01-10')
    expect(due(lateDue, '2027-02-01', 'flu-season:').map((x) => x.key)).toEqual(['flu-season:2026-27:a'])
    expect(due(lateDue, '2027-05-01', 'flu-season:')).toEqual([])
    expect(due(parenting('2026-11-20'), '2026-12-01', 'flu-season:')).toEqual([])
    // Ticked this 절기 (any stage) → nothing; the next 절기 opens again.
    const ticked = tickItem(PARTNER_FLU_ID, true, '2026-10-20', HIM)(base())
    expect(due(ticked, '2026-11-01', 'flu-season:')).toEqual([])
    expect(due(ticked, '2027-10-01', 'flu-season:').map((x) => x.key)).toEqual(['flu-season:2027-28:a'])
  })

  it('once a season: delivered while preparing, the pregnancy in the same 절기 does not send it again', () => {
    let s = open(base(), '2026-10-12')
    expect(withPrefix(s.notifications, 'flu-season:')).toHaveLength(1)
    s = startPregnancy(s, '2026-09-20', '2026-10-25')
    for (const d of days('2026-10-25', '2027-04-30', 9)) s = open(s, d)
    expect(withPrefix(s.notifications, 'flu-season:')).toHaveLength(1)
  })
})

describe('① 검사 지원 신청: 14 days after his first run (the Monday on or after), or January after [접수가 끝났대요]', () => {
  const firstRun = (d: ISODate) => decide(base(), 'partner-setup', d)

  it('reads his first run from the link answer, else the in-app first run (linkedAt)', () => {
    expect(partnerFirstRunDay(base())).toBeUndefined()
    expect(partnerFirstRunDay(firstRun('2026-10-01'))).toBe('2026-10-01')
    const linked = { ...base(), couple: { ...base().couple, linkedAt: '2026-10-03T21:00:00+09:00' } }
    expect(partnerFirstRunDay(linked)).toBe('2026-10-03')
  })

  it('fires from the Monday after first run + 14, once, until he applies; never without a first run', () => {
    // 2026-10-01 (Thu) + 14 = 10-15 (Thu) → Monday 10-19.
    expect(mondayOnOrAfter('2026-10-15')).toBe('2026-10-19')
    expect(mondayOnOrAfter('2026-10-19')).toBe('2026-10-19')
    const s = firstRun('2026-10-01')
    expect(due(s, '2026-10-18', 'deadline:task-apply')).toEqual([])
    const n = due(s, '2026-10-19', 'deadline:task-apply')
    expect(n).toEqual([
      { key: 'deadline:task-apply:a', to: HIM, kind: 'system', title: '📝 임신 전 검사 지원 신청', body: PARTNER_NOTICE_COPY.apply.body },
    ])
    // Catch-up: a first open weeks later still gets it.
    expect(due(s, '2026-11-20', 'deadline:task-apply').map((x) => x.key)).toEqual(['deadline:task-apply:a'])
    expect(due(setFertilityApplied(s, HIM, true, '2026-10-10'), '2026-10-19', 'deadline:task-apply')).toEqual([])
    expect(due(base(), '2026-12-01', 'deadline:task-apply')).toEqual([])
    // Her application never stands in for his.
    expect(due(setFertilityApplied(s, HER, true, '2026-10-10'), '2026-10-19', 'deadline:task-apply')).toHaveLength(1)
    // "가임력" only for an explicit voice.
    expect(due(setAlertStyle(s, HIM, 'explicit'), '2026-10-19', 'deadline:task-apply')[0]!.title).toBe('📝 가임력 검사 지원 신청')
    // The body hedges (보건소마다 달라요).
    expect(n[0]!.body).toContain('보건소마다 달라')
    // Not while pregnant.
    expect(due({ ...s, stage: 'pregnant' }, '2026-10-19', 'deadline:task-apply')).toEqual([])
  })

  it('after [접수가 끝났대요] the reminder rests; the first Monday of January brings one check-the-new-year notice', () => {
    expect(firstMondayOfJanuary(2027)).toBe('2027-01-04')
    const closed = decide(firstRun('2026-10-01'), 'apply-closed:2026:a', '2026-10-20')
    expect(due(closed, '2026-11-02', 'deadline:task-apply')).toEqual([])
    expect(due(closed, '2026-12-31', 'deadline:task-apply')).toEqual([])
    expect(due(closed, '2027-01-03', 'deadline:task-apply')).toEqual([])
    const jan = due(closed, '2027-01-04', 'deadline:task-apply')
    expect(jan.map((x) => x.key)).toEqual(['deadline:task-apply-new-year:2027:a'])
    expect(jan[0]!.title).toBe(PARTNER_NOTICE_COPY.applyNewYear.title)
    expect(jan[0]!.body).toContain('보건소마다 달라요')
    // Catch-up later in January; not in the year after; not if he applied or said 'closed' again.
    expect(due(closed, '2027-02-15', 'deadline:task-apply')).toHaveLength(1)
    expect(due(closed, '2028-01-03', 'deadline:task-apply')).toEqual([])
    expect(due(setFertilityApplied(closed, HIM, true, '2027-01-02'), '2027-01-04', 'deadline:task-apply')).toEqual([])
    expect(due(decide(closed, 'apply-closed:2027:a', '2027-01-04'), '2027-01-05', 'deadline:task-apply')).toEqual([])
    // Her 'closed' is not his.
    const hers = decide(firstRun('2026-10-01'), 'apply-closed:2026:b', '2026-10-20')
    expect(due(hers, '2026-11-02', 'deadline:task-apply').map((x) => x.key)).toEqual(['deadline:task-apply:a'])
  })
})

describe('③ 정액검사 준비: 7 days before his booking, or at booking when sooner', () => {
  const booked = (date: ISODate, privateTo?: MemberId) =>
    addAppointment(
      setFertilityApplied(base(), HIM, true, '2026-10-01'),
      { date, title: '정액검사', who: HIM, kind: 'test', taskId: FERTILITY_TEST_ID, ...(privateTo ? { privateTo } : {}) },
      HIM,
    )

  it('fires from 7 days before through the day, keyed by the booking, to him only', () => {
    const s = booked('2026-10-20')
    const id = s.appointments[0]!.id
    expect(due(s, '2026-10-12', 'deadline:task-prep:')).toEqual([])
    const n = due(s, '2026-10-13', 'deadline:task-prep:')
    expect(n).toEqual([{ key: `deadline:task-prep:${id}:a`, to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.testPrep }])
    expect(due(s, '2026-10-20', 'deadline:task-prep:')).toHaveLength(1)
    expect(due(s, '2026-10-21', 'deadline:task-prep:')).toEqual([])
    // Booked 2 days ahead: at booking.
    expect(due(booked('2026-10-15'), '2026-10-13', 'deadline:task-prep:')).toHaveLength(1)
    // His own 나만 보기 booking still reminds him.
    expect(due(booked('2026-10-20', HIM), '2026-10-14', 'deadline:task-prep:')).toHaveLength(1)
    // No words about the test's preparation itself, no day counts (research 'male-semen-test-abstinence').
    expect(`${n[0]!.title} ${n[0]!.body}`).not.toMatch(/\d+일|금욕|관계|사정/)
  })
})

describe('⑥ 배우자 출산휴가: window open at 예정일 −50; D-30 · D-7 · D-1 before 출생일 + 119', () => {
  it('window open on the first open from 예정일 −50 while pregnant, once, unless done', () => {
    // DUE 12-06 → opens 10-17.
    expect(due(pregnant(), '2026-10-16', 'partner-leave-open:')).toEqual([])
    const n = due(pregnant(), '2026-10-17', 'partner-leave-open:')
    expect(n).toEqual([{ key: `partner-leave-open:${CONFIRMED}:a`, to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.leaveOpen }])
    expect(due(pregnant(), '2026-11-30', 'partner-leave-open:')).toHaveLength(1)
    expect(due(tickItem('birth-partner-leave', true, '2026-10-20', HIM)(pregnant()), '2026-11-01', 'partner-leave-open:')).toEqual([])
    expect(due(parenting('2026-11-20'), '2026-11-25', 'partner-leave-open:')).toEqual([])
  })

  it('counts the last day from the real birth: a birth two weeks early moves every reminder earlier', () => {
    const early = parenting('2026-11-22') // two weeks before DUE
    const last = partnerLeaveLastDay('2026-11-22')
    expect(last).toBe('2027-03-21')
    expect(due(early, addDays(last, -31), 'partner-leave:')).toEqual([])
    const d30 = due(early, addDays(last, -30), 'partner-leave:')
    expect(d30).toEqual([
      {
        key: 'partner-leave:2026-11-22:30:a',
        to: HIM,
        kind: 'system',
        title: '📝 배우자 출산휴가 D-30',
        body: PARTNER_NOTICE_COPY.leaveLeft.body,
      },
    ])
    // Over the day after the birth's last day — though 예정일 + 119 (2027-04-04) is still ahead.
    expect(due(early, addDays(last, 1), 'partner-leave:')).toEqual([])
    const late = parenting('2026-12-13')
    expect(due(late, addDays(partnerLeaveLastDay('2026-12-13'), -7), 'partner-leave:').map((x) => x.key)).toEqual([
      'partner-leave:2026-12-13:7:a',
    ])
  })

  it('catch-up: a later first open says the real days left under the step’s key; the last day reads 오늘까지예요; nothing after', () => {
    const s = parenting('2026-11-20')
    const last = partnerLeaveLastDay('2026-11-20') // 2027-03-19
    const at = (d: ISODate) => due(s, d, 'partner-leave:')
    expect(at(addDays(last, -20))).toMatchObject([{ key: 'partner-leave:2026-11-20:30:a', title: '📝 배우자 출산휴가 D-20' }])
    expect(at(addDays(last, -5))).toMatchObject([{ key: 'partner-leave:2026-11-20:7:a', title: '📝 배우자 출산휴가 D-5' }])
    expect(at(addDays(last, -1))).toMatchObject([{ key: 'partner-leave:2026-11-20:1:a', title: '📝 배우자 출산휴가 D-1' }])
    expect(at(last)).toMatchObject([{ key: 'partner-leave:2026-11-20:1:a', title: '📝 배우자 출산휴가 오늘까지예요' }])
    expect(at(addDays(last, 1))).toEqual([])
    expect(due(tickItem('birth-partner-leave', true, '2027-01-02', HIM)(s), addDays(last, -1), 'partner-leave:')).toEqual([])
    // The hedge: the exact last day is for the company or 고용센터(1350).
    expect(PARTNER_NOTICE_COPY.leaveLeft.body).toContain('고용센터(1350)')
  })
})

describe('⑦ Tdap: 예정일 −60 and −21, nothing after 예정일 −14 (no 기한 지남)', () => {
  it('two steps, the later one replaces a missed earlier one, ticked → nothing', () => {
    const at = (d: ISODate) => due(pregnant(), d, 'tdap:')
    expect(at(addDays(DUE, -61))).toEqual([])
    expect(at(addDays(DUE, -60))).toEqual([{ key: `tdap:${CONFIRMED}:60:a`, to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.tdap }])
    expect(at(addDays(DUE, -22)).map((n) => n.key)).toEqual([`tdap:${CONFIRMED}:60:a`])
    expect(at(addDays(DUE, -21)).map((n) => n.key)).toEqual([`tdap:${CONFIRMED}:21:a`])
    expect(at(addDays(DUE, -14)).map((n) => n.key)).toEqual([`tdap:${CONFIRMED}:21:a`])
    expect(at(addDays(DUE, -13))).toEqual([])
    expect(due(tickItem('p3-partner-tdap', true, '2026-10-10', HIM)(pregnant()), addDays(DUE, -21), 'tdap:')).toEqual([])
    expect(PARTNER_NOTICE_COPY.tdap.body).toContain('맞은 적이 없다면')
    expect(PARTNER_NOTICE_COPY.tdap.title).not.toMatch(/D-/)
  })
})

describe('⑩ 산후도우미 신청: 예정일 −40, to both, once', () => {
  it('to both from 예정일 −40 while pregnant, unless either 산후도우미 row is done', () => {
    expect(due(pregnant(), addDays(DUE, -41), 'postnatal-open:')).toEqual([])
    const n = due(pregnant(), addDays(DUE, -40), 'postnatal-open:')
    expect(n.map((x) => [x.key, x.to])).toEqual([
      [`postnatal-open:${CONFIRMED}:a`, 'a'],
      [`postnatal-open:${CONFIRMED}:b`, 'b'],
    ])
    expect(n[0]!.body).toContain('보건소마다 달라요')
    expect(due(tickItem('p3-postnatal-care', true, '2026-10-30', HER)(pregnant()), addDays(DUE, -30), 'postnatal-open:')).toEqual([])
  })
})

describe('⑪ 난임치료휴가 유급 4일: 2026-11-27 ~ 12-10, 병원과 함께 only', () => {
  it('once inside its two weeks, only in clinic mode, only for him', () => {
    const clinic = startClinicMode(base(), '2026-10-01')
    expect(due(clinic, '2026-11-26', 'program:')).toEqual([])
    expect(due(clinic, '2026-11-27', 'program:')).toEqual([
      { key: 'program:infertility-leave-paid-4:a', to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.infertilityLeave },
    ])
    expect(due(clinic, '2026-12-10', 'program:')).toHaveLength(1)
    expect(due(clinic, '2026-12-11', 'program:')).toEqual([])
    expect(due(base(), '2026-11-27', 'program:')).toEqual([])
    // The days are the law's; only the procedure differs by company.
    expect(PARTNER_NOTICE_COPY.infertilityLeave.body).toContain('처음 4일')
    expect(PARTNER_NOTICE_COPY.infertilityLeave.body).toContain('신청 방법은 회사마다 달라서')
  })
})

describe('⑫ 아빠 마음: 출생일 + 90, once, until he was asked', () => {
  it('fires from birth + 90 for him only; the asked decision ends it', () => {
    const s = parenting('2026-08-01') // + 90 = 10-30
    expect(due(s, '2026-10-29', 'dad-mind:')).toEqual([])
    expect(due(s, '2026-10-30', 'dad-mind:')).toEqual([
      { key: 'dad-mind:2026-08-01:a', to: HIM, kind: 'system', ...PARTNER_NOTICE_COPY.dadMind },
    ])
    expect(due(decide(s, 'dad-mind-asked:2026-08-01:a', '2026-10-30'), '2026-11-02', 'dad-mind:')).toEqual([])
    expect(PARTNER_NOTICE_COPY.dadMind.body).not.toMatch(/우울|%|\d/)
  })
})

// ── catch-up across opens ───────────────────────────────────

describe('catch-up: opening every few days still gets each notice once, never twice', () => {
  it('a pregnancy opened every 4 days and the months after the birth every 2', () => {
    let s = pregnant()
    for (const d of days('2026-09-01', '2026-11-19', 4)) s = open(s, d)
    s = recordBirth(s, { name: '콩이', birthDate: '2026-11-20', sex: 'unknown' })
    for (const d of days('2026-11-20', '2027-04-30', 2)) s = open(s, d)
    const keys = ours(s.notifications).map((n) => n.key!)
    expect(new Set(keys).size).toBe(keys.length)
    for (const prefix of ['tdap:', 'partner-leave-open:', 'partner-leave:', 'postnatal-open:', 'flu-season:', 'dad-mind:']) {
      expect(
        keys.some((k) => k.startsWith(prefix)),
        prefix,
      ).toBe(true)
    }
    // Each leave step once, with the days left on the day it went out.
    const leave = withPrefix(s.notifications, 'partner-leave:')
    expect(leave.map((n) => n.key!.split(':')[2]).sort()).toEqual(['1', '30', '7'])
    for (const n of leave) {
      const left = diffDays(n.createdAt.slice(0, 10), partnerLeaveLastDay('2026-11-20'))
      expect(n.title).toBe(PARTNER_NOTICE_COPY.leaveLeft.title(left))
    }
  })

  it('a husband who joins mid-window still gets the window-open notices, the most time-bound first, the rest as his weeks allow', () => {
    // First open at 예정일 −30 (Fri 11-06): the week notice and Tdap fill that week's two.
    let s = open(pregnant(), addDays(DUE, -30))
    expect(ours(s.notifications.filter((n) => n.to === HIM)).map((n) => n.key)).toEqual([`tdap:${CONFIRMED}:60:a`])
    // Hers is never held.
    expect(withPrefix(s.notifications, 'postnatal-open:').filter((n) => n.to === HER)).toHaveLength(1)
    for (const d of days(addDays(DUE, -29), addDays(DUE, -14))) s = open(s, d)
    for (const prefix of ['partner-leave-open:', 'postnatal-open:', 'tdap:'])
      expect(withPrefix(s.notifications, prefix).filter((n) => n.to === HIM).length, prefix).toBeGreaterThan(0)
    // Tdap's second step still went out before 예정일 −14.
    const tdap21 = s.notifications.find((n) => n.key === `tdap:${CONFIRMED}:21:a`)
    expect(tdap21 && tdap21.createdAt.slice(0, 10) <= addDays(DUE, -14)).toBe(true)
  })
})

// ── his weekly cap ──────────────────────────────────────────

describe(`at most ${PARTNER_WEEKLY_CAP} rule-made reminders to him a week; the legal last day is never held`, () => {
  it('four due at once: what fits this week, the rest on the next Mondays’ first opens; hers are never held', () => {
    // Wednesday 11-18: Tdap (21), leave open, flu (pregnant window), 산후도우미 (him and her) are all due;
    // the week notice (임신 37주) uses one of his two, so only the most time-bound goes: Tdap.
    let s = open(pregnant(), '2026-11-18')
    const toHim = () => ours(s.notifications).filter((n) => n.to === HIM)
    const kinds = () =>
      toHim()
        .map((n) => n.key!.split(':')[0])
        .sort()
    expect(kinds()).toEqual(['tdap'])
    expect(withPrefix(s.notifications, 'postnatal-open:').filter((n) => n.to === HER)).toHaveLength(1)
    s = open(s, '2026-11-20')
    s = open(s, '2026-11-22')
    expect(kinds()).toEqual(['tdap'])
    s = open(s, '2026-11-23') // Monday: two more
    expect(kinds()).toEqual(['flu-season', 'partner-leave-open', 'tdap'])
    s = open(s, '2026-11-29') // Sunday: 임신 39주 fills the week; nothing more
    expect(kinds()).toEqual(['flu-season', 'partner-leave-open', 'tdap'])
    s = open(s, '2026-11-30') // Monday
    expect(kinds()).toEqual(['flu-season', 'partner-leave-open', 'postnatal-open', 'tdap'])
  })

  it('his chain and roadmap reminders already sent this week count; last week’s do not', () => {
    const s0 = pregnant()
    const thisWeek = {
      ...s0,
      notifications: [
        note('deadline:task-test:2026-12-01:7:a', HIM, '2026-11-16'),
        note('deadline:birth-registration:2026-12-01:7:a', HIM, '2026-11-17'),
      ],
    }
    expect(ours(partnerCheckpointNotices(thisWeek, '2026-11-18')).filter((n) => n.to === HIM)).toEqual([])
    const lastWeek = {
      ...s0,
      notifications: [note('deadline:task-test:2026-12-01:7:a', HIM, '2026-11-15'), note('flu-season:2025-26:a', HIM, '2026-11-14')],
    }
    expect(ours(partnerCheckpointNotices(lastWeek, '2026-11-18')).filter((n) => n.to === HIM)).toHaveLength(2)
    // What the other rules send in the same run counts too.
    const others: Notice[] = [{ key: 'deadline:task-claim:2026-12-01:1:a', to: HIM, kind: 'system', title: 't', body: '' }]
    expect(ours(partnerCheckpointNotices(s0, '2026-11-18', others)).filter((n) => n.to === HIM)).toHaveLength(1)
    // What a person sent (it carries `from`), the heads-up for her items and her week line do not count.
    for (const n of [
      { key: 'appt:x:2026-11-19:fyi:a' },
      { key: 'deadline:together:t1:2026-11-19:a' },
      { key: 'thanks:2026-11-16:b', from: HER },
      { key: 'nudge:b:2026-11-17:0', from: HER, kind: 'nudge' as const },
      { key: 'period-told:2026-11-02', from: HER },
      { key: 'thanks:2026-11-16:b' },
      { key: 'week-digest:2026-11-09:b' },
      { key: undefined },
    ]) {
      expect(countsTowardCap(n), n.key).toBe(false)
    }
    // Every rule-made one does (P3): the check points, his chain and roadmap deadlines, a '기한' item,
    // the week notice while pregnant, his 우리의 주간, his own appointment reminder, 🩺, 기념일, the baby's days.
    for (const key of [
      'deadline:task-apply:a',
      'notice-expiry:2027-01-15:7:a',
      'deadline:birth-registration:2026-12-20:7:a',
      'deadline:c-123:2026-11-20:1:a',
      'tdap:x:21:a',
      'flu-season:2026-27:a',
      'week:2026-03-01:37:a',
      'fertile-week:2026-11-02:a',
      'appt:x:2026-11-19:1:a',
      'doctor:2026-01-01:a',
      'anniv:met-days:100:2026-11-20:0:a',
      'kday:2026-08-01:day100:0:a',
    ]) {
      expect(countsTowardCap({ key }), key).toBe(true)
    }
  })

  it('a pregnant week that already has its week notice leaves room for one check point (P3)', () => {
    // Wednesday 11-18: the week notice (임신 37주) goes to him in the same run and uses one of the two.
    const s = open(pregnant(), '2026-11-18')
    const toHim = s.notifications.filter((n) => n.to === HIM && countsTowardCap(n) && n.createdAt.startsWith('2026-11-18'))
    expect(withPrefix(toHim, 'week:')).toHaveLength(1)
    expect(ours(toHim)).toHaveLength(PARTNER_WEEKLY_CAP - 1)
    expect(toHim).toHaveLength(PARTNER_WEEKLY_CAP)
    // Opened every day of that Mon–Sun week (11-16 … 11-22): Monday's 임신 37주 and one check point fill
    // the two; no other check point that week. (Sunday's 임신 38주 is never held — it only uses budget.)
    let d = pregnant()
    for (const day of days('2026-11-16', '2026-11-22')) d = open(d, day)
    const week = d.notifications.filter((n) => n.to === HIM && countsTowardCap(n) && n.createdAt.slice(0, 10) >= '2026-11-16')
    expect(
      withPrefix(week, 'week:')
        .map((n) => n.key)
        .sort(),
    ).toEqual(['week:2026-03-01:37:a', 'week:2026-03-01:38:a'])
    expect(ours(week)).toHaveLength(1)
    expect(ours(week)[0]!.createdAt.slice(0, 10)).toBe('2026-11-16')
  })

  it('배우자 출산휴가 D-1 goes out over a full week; the rest waits', () => {
    const birth: ISODate = '2026-11-20'
    const last = partnerLeaveLastDay(birth) // 2027-03-19 (Fri)
    const d1 = addDays(last, -1)
    const full = {
      ...parenting(birth),
      notifications: [note('deadline:task-test:x:7:a', HIM, addDays(d1, -2)), note('tdap:x:21:a', HIM, addDays(d1, -1))],
    }
    const out = ours(partnerCheckpointNotices(full, d1)).filter((n) => n.to === HIM)
    // 아빠 마음 (due since 2027-02-18) waits; the legal D-1 does not.
    expect(out.map((n) => n.key)).toEqual([`partner-leave:${birth}:1:a`])
    expect(ours(partnerCheckpointNotices(full, '2027-03-22')).map((n) => n.key)).toEqual([`dad-mind:${birth}:a`])
  })
})

// ── quiet after a loss ──────────────────────────────────────

describe('none of these in the 42 quiet days after a loss', () => {
  it('flu, the apply reminder, 난임치료휴가 and her week line rest; they come after the quiet', () => {
    let s = endPregnancy(pregnant(), '2026-10-05')
    s = decide(startClinicMode(s, '2026-10-05'), 'partner-setup', '2026-09-01')
    s = pickWeek(s, HIM, 'evening-free', '2026-10-05')
    for (const d of days('2026-10-05', '2026-11-15')) {
      expect(ours(partnerCheckpointNotices(s, d)), d).toEqual([])
      expect(weekDigestNotices(s, d), d).toEqual([])
    }
    expect(ours(partnerCheckpointNotices(s, '2026-11-16')).length).toBeGreaterThan(0)
  })

  it('a loss settles the check points about that pregnancy already sent: nothing unread about it in either 🔔 (P1)', () => {
    // Opened on 예정일 −35: Tdap and the 배우자 출산휴가 window reach him, 산후도우미 her.
    let s = open(pregnant(), addDays(DUE, -35))
    s = open(s, addDays(DUE, -34))
    s = open(s, addDays(DUE, -33))
    const tied = ['tdap:', 'partner-leave-open:', 'postnatal-open:']
    const unreadTied = (st: AppState, m: MemberId) => bellInbox(st, m).filter((n) => !n.read && tied.some((p) => n.key?.startsWith(p)))
    expect(unreadTied(s, HIM).length).toBeGreaterThan(0)
    expect(unreadTied(s, HER).map((n) => n.key)).toEqual([`postnatal-open:${CONFIRMED}:b`])
    const ended = endPregnancy(s, addDays(DUE, -33))
    for (const m of [HIM, HER]) {
      expect(unreadTied(ended, m), m).toEqual([])
      expect(
        bellInbox(ended, m).filter((n) => tied.some((p) => n.key?.startsWith(p))),
        m,
      ).toEqual([])
    }
    expect(bellUnread(ended, HER)).toBe(0)
    // Kept as dismissed stubs, so a later open never sends them again — and the flu notice is the 절기's, left as it was.
    for (const p of tied)
      expect(
        withPrefix(ended.notifications, p).every((n) => n.dismissed && n.read),
        p,
      ).toBe(true)
    const flu = (st: AppState) => withPrefix(st.notifications, 'flu-season:')
    expect(flu(ended)).toEqual(flu(s))
  })
})

// ── fix round (2026-11-01) ──────────────────────────────────

describe('an earlier pregnancy’s or child’s ticks do not silence this one’s notices (A1)', () => {
  it('old ticks for Tdap, 배우자 출산휴가 and 산후도우미 (before this pregnancy) leave every notice due, as 챙길 것 shows the rows open', () => {
    const OLD: ISODate = '2025-05-01'
    let s = tickItem('p3-partner-tdap', true, OLD, HIM)(pregnant())
    s = tickItem('birth-partner-leave', true, OLD, HIM)(s)
    s = { ...s, milestones: [...s.milestones, { key: 'plan:postnatal-care', date: OLD }] }
    expect(due(s, addDays(DUE, -60), 'tdap:').map((n) => n.key)).toEqual([`tdap:${CONFIRMED}:60:a`])
    expect(due(s, addDays(DUE, -50), 'partner-leave-open:').map((n) => n.key)).toEqual([`partner-leave-open:${CONFIRMED}:a`])
    expect(due(s, addDays(DUE, -40), 'postnatal-open:')).toHaveLength(2)
    // After the birth, the legal D-30 too.
    const born = recordBirth(s, { name: '콩이', birthDate: DUE, sex: 'unknown' })
    expect(due(born, addDays(partnerLeaveLastDay(DUE), -30), 'partner-leave:').map((n) => n.key)).toEqual([`partner-leave:${DUE}:30:a`])
    // A tick for this pregnancy still ends them.
    expect(due(tickItem('p3-partner-tdap', true, '2026-10-01', HIM)(s), addDays(DUE, -21), 'tdap:')).toEqual([])
    expect(
      due(tickItem('birth-partner-leave', true, '2026-12-10', HIM)(born), addDays(partnerLeaveLastDay(DUE), -7), 'partner-leave:'),
    ).toEqual([])
  })
})

describe('the 검사 준비 check is never held into a week its booking has passed (A2)', () => {
  const booked = (date: ISODate) =>
    addAppointment(
      setFertilityApplied(base(), HIM, true, '2026-10-01'),
      { date, title: '정액검사', who: HIM, kind: 'test', taskId: FERTILITY_TEST_ID },
      HIM,
    )
  const full = (s: AppState): AppState => ({
    ...s,
    notifications: [note('flu-season:2026-27:a', HIM, '2026-11-02'), note('deadline:task-test:2027-01-01:7:a', HIM, '2026-11-02')],
  })

  it('a booking before next Monday goes out over a full week', () => {
    const s = full(booked('2026-11-06')) // Friday of the week of Mon 11-02
    const id = s.appointments[0]!.id
    expect(withPrefix(partnerCheckpointNotices(s, '2026-11-03'), 'deadline:task-prep:').map((n) => n.key)).toEqual([
      `deadline:task-prep:${id}:a`,
    ])
  })

  it('a booking next week or later waits for Monday and still goes out on or before the day', () => {
    const s = full(booked('2026-11-10')) // Tuesday of next week
    expect(withPrefix(partnerCheckpointNotices(s, '2026-11-03'), 'deadline:task-prep:')).toEqual([])
    let st = s
    for (const d of days('2026-11-03', '2026-11-10')) st = open(st, d)
    const prep = withPrefix(st.notifications, 'deadline:task-prep:')
    expect(prep).toHaveLength(1)
    expect(prep[0]!.createdAt.slice(0, 10)).toBe('2026-11-09')
  })
})

describe('아빠 마음 stops after the first year (A5)', () => {
  it('birth + 90 is due, birth + 364 is the last day, the day after is not — card, notice and link flag alike', () => {
    const birth: ISODate = '2026-08-01'
    const s = parenting(birth)
    expect(DAD_MIND_LAST_OFFSET).toBe(364)
    expect(due(s, addDays(birth, 90), 'dad-mind:')).toHaveLength(1)
    expect(due(s, addDays(birth, 364), 'dad-mind:')).toHaveLength(1)
    expect(due(s, addDays(birth, 365), 'dad-mind:')).toEqual([])
    expect(due(s, addDays(birth, 1000), 'dad-mind:')).toEqual([])
  })
})

// ── her week line ───────────────────────────────────────────

describe('이번 주 민수님: her 🔔 on Sunday (or the week before, on a later first open), only with a line', () => {
  const SUNDAY: ISODate = '2026-11-01'
  const MONDAY: ISODate = '2026-10-26'
  const busy = () => {
    let s = base()
    const pick = weekOptions(s, '2026-10-27', HIM)[0]!
    s = pickWeek(s, HIM, pick.id, '2026-10-27')
    s = markWeekDone(s, HIM, '2026-10-29')
    s = tickItem(PARTNER_FLU_ID, true, '2026-10-30', HIM)(s)
    return { s, pick }
  }

  it('Sunday: to her only, the summary’s lines (named dated tasks), keyed by the week', () => {
    const { s, pick } = busy()
    const n = weekDigestNotices(s, SUNDAY)
    expect(n).toEqual([
      {
        key: `week-digest:${MONDAY}:b`,
        to: HER,
        kind: 'system',
        title: '🗒️ 이번 주 민수님',
        body: `${pick.doneText} · 독감 접종을 했어요`,
      },
    ])
    expect(digestWeek(n[0]!.key)).toBe(MONDAY)
    expect(noticeTarget('system', 'preparing', n[0]!.key)).toBe('today')
    // Not before Sunday, never to him, nothing for an empty week.
    expect(weekDigestNotices(s, '2026-10-31')).toEqual([])
    expect(weekDigestNotices(base(), SUNDAY)).toEqual([])
    expect(n[0]!.body).not.toMatch(/0|안 했어요/)
  })

  it('a later first open sends last week’s once, as 지난주; a week after that, nothing for it', () => {
    const { s } = busy()
    const mon = weekDigestNotices(s, '2026-11-02')
    expect(mon.map((x) => [x.key, x.title])).toEqual([[`week-digest:${MONDAY}:b`, '🗒️ 지난주 민수님']])
    let st = open(s, SUNDAY)
    st = open(st, '2026-11-02')
    expect(withPrefix(st.notifications, 'week-digest:')).toHaveLength(1)
    expect(weekDigestNotices(s, '2026-11-09')).toEqual([])
  })

  it('never names smoking, drinking or medicines — the daily line has no name then', () => {
    let s = addCheckItem(base(), HIM, '담배 안 피우기', 'habit', '2026-10-26')
    const id = s.checkItems.find((i) => i.owner === HIM && i.label === '담배 안 피우기')!.id
    for (const d of ['2026-10-27', '2026-10-28', '2026-10-29']) s = toggleCheck(s, HIM, d, id)
    const body = weekDigestNotices(s, SUNDAY)[0]!.body
    expect(body).toBe('매일 체크 3일')
    let t = addCheckItem(base(), HIM, '혈압약 챙기기', 'habit', '2026-10-26')
    const pill = t.checkItems.find((i) => i.label === '혈압약 챙기기')!.id
    t = toggleCheck(t, HIM, '2026-10-27', pill)
    expect(weekDigestNotices(t, SUNDAY)[0]!.body).not.toMatch(/약|담배|술/)
  })

  it('[고마워요] from it is the home’s once-a-week thanks: one decision, one 💛 to him', () => {
    const { s } = busy()
    const key = `week-digest:${MONDAY}:b`
    expect(canThankFromDigest(s, HER, key, SUNDAY)).toBe(true)
    const after = thankFromDigest(s, HER, HIM, key, SUNDAY, stamp(SUNDAY))
    expect(weekThanked(after, HER, MONDAY)).toBe(SUNDAY)
    expect(thankedForDigest(after, HER, key)).toBe(SUNDAY)
    const heart = after.notifications.filter((n) => n.key === `thanks:${MONDAY}:b`)
    expect(heart).toMatchObject([{ to: HIM, from: HER, kind: 'cheer', body: WEEK_THANKS_BODY }])
    // The home's button is spent too, and a second tap changes nothing.
    expect(canThankWeek(after, HER, SUNDAY)).toBe(false)
    expect(thankFromDigest(after, HER, HIM, key, SUNDAY, stamp(SUNDAY))).toBe(after)
  })

  it('[고마워요] from the digest marks the digest itself read — she acted on it (UI-4)', () => {
    const { s } = busy()
    const key = `week-digest:${MONDAY}:b`
    const delivered = open(s, SUNDAY)
    const digest = (st: AppState) => st.notifications.find((n) => n.key === key)
    expect(digest(delivered)).toMatchObject({ to: HER, read: false })
    const unread = bellUnread(delivered, HER)
    const after = thankFromDigest(delivered, HER, HIM, key, SUNDAY, stamp(SUNDAY))
    expect(digest(after)).toMatchObject({ read: true })
    expect(bellUnread(after, HER)).toBe(unread - 1)
    // His 💛 arrives unread; nothing else of hers changes.
    expect(after.notifications.find((n) => n.key === `thanks:${MONDAY}:b`)).toMatchObject({ to: HIM, read: false })
  })

  it('thanking last week from a later day: that week’s decision, ‘지난주 고마워요’; two weeks back is closed', () => {
    const { s } = busy()
    const key = `week-digest:${MONDAY}:b`
    const after = thankFromDigest(s, HER, HIM, key, '2026-11-03', stamp('2026-11-03'))
    expect(weekThanked(after, HER, MONDAY)).toBe('2026-11-03')
    expect(after.notifications.find((n) => n.key === `thanks:${MONDAY}:b`)?.body).toBe(LAST_WEEK_THANKS_BODY)
    expect(canThankFromDigest(s, HER, key, '2026-11-09')).toBe(false)
    expect(canThankFromDigest(s, HER, 'deadline:task-apply:a', SUNDAY)).toBe(false)
  })
})

// ── the lock screen, where a tap goes, key shapes ───────────

/** Every check-point notice across many states and days (the rules alone). */
function sampleNotices(): Array<Notice & { stage: Stage }> {
  const states: AppState[] = [
    decide(startClinicMode(base(), '2026-09-01'), 'partner-setup', '2026-09-01'),
    decide(decide(base(), 'partner-setup', '2026-09-01'), 'apply-closed:2026:a', '2026-10-01'),
    addAppointment(
      setFertilityApplied(base(), HIM, true, '2026-10-01'),
      { date: '2026-11-10', title: '정액검사', who: HIM, kind: 'test', taskId: FERTILITY_TEST_ID },
      HIM,
    ),
    pregnant(),
    parenting('2026-11-20'),
    tickItem(
      PARTNER_FLU_ID,
      true,
      '2026-10-30',
      HIM,
    )(markWeekDone(pickWeek(base(), HIM, weekOptions(base(), '2026-10-27', HIM)[0]!.id, '2026-10-27'), HIM, '2026-10-28')),
  ]
  const out: Array<Notice & { stage: Stage }> = []
  for (const s of states)
    for (const d of days('2026-09-25', '2027-05-01', 3)) for (const n of partnerCheckpointNotices(s, d)) out.push({ ...n, stage: s.stage })
  return out
}

describe('the lock screen, where a tap opens, key shapes', () => {
  const sample = sampleNotices()
  const prefixes = new Set(sample.map((n) => PARTNER_NOTICE_PREFIXES.find((p) => n.key.startsWith(p))))

  it('covers every prefix the rules write', () => {
    for (const p of PARTNER_NOTICE_PREFIXES) expect(prefixes.has(p), p).toBe(true)
  })

  it('under 잠금화면 숨김 every new title collapses to 둘셋 · 새 알림이 있어요 (the engine’s one masking)', () => {
    for (const n of sample) {
      expect(lockScreenText(n, true), n.key).toEqual({ title: '둘셋', body: '새 알림이 있어요' })
      expect(lockScreenText(n, false)).toEqual(n)
    }
    const engine = readFileSync(join(ROOT, 'lib/useNotificationEngine.ts'), 'utf8')
    expect(engine).toMatch(/const \{ title, body \} = lockScreenText\(n, discreet\)/)
    expect(engine).toMatch(/allRuleNotices\(s, today\)/)
  })

  it('a tap opens a tab that exists in that stage', () => {
    const shell = readFileSync(join(ROOT, 'components/AppShell.tsx'), 'utf8')
    const sets = shell.slice(
      shell.indexOf('const TAB_SETS'),
      shell.indexOf('}', shell.indexOf('parenting: [', shell.indexOf('const TAB_SETS'))) + 200,
    )
    for (const [stage, keys] of Object.entries(TAB_KEYS_BY_STAGE)) {
      const block = sets.slice(sets.indexOf(`${stage}: [`), sets.indexOf('],', sets.indexOf(`${stage}: [`)))
      expect(
        [...block.matchAll(/key: '(\w+)'/g)].map((m) => m[1]),
        stage,
      ).toEqual(keys)
    }
    for (const n of sample) {
      const tab = noticeTarget(n.kind, n.stage, n.key)
      expect(tab, n.key).not.toBeNull()
      expect(TAB_KEYS_BY_STAGE[n.stage], `${n.key} → ${tab}`).toContain(tab)
    }
    expect(noticeTarget('system', 'preparing', 'flu-season:2026-27:a')).toBe('today')
    expect(noticeTarget('system', 'pregnant', 'flu-season:2026-27:a')).toBe('today')
    expect(noticeTarget('system', 'preparing', 'deadline:task-apply:a')).toBe('today')
    expect(noticeTarget('system', 'preparing', 'deadline:task-prep:x1:a')).toBe('today')
    expect(noticeTarget('system', 'pregnant', `tdap:${CONFIRMED}:60:a`)).toBe('plan')
    expect(noticeTarget('system', 'parenting', 'partner-leave:2026-11-20:7:a')).toBe('plan')
    expect(noticeTarget('system', 'pregnant', `partner-leave-open:${CONFIRMED}:a`)).toBe('plan')
    expect(noticeTarget('system', 'pregnant', `postnatal-open:${CONFIRMED}:b`)).toBe('plan')
    expect(noticeTarget('system', 'preparing', 'program:infertility-leave-paid-4:a')).toBe('plan')
    expect(noticeTarget('system', 'parenting', 'dad-mind:2026-08-01:a')).toBe('today')
    expect(noticeTarget('system', 'pregnant', 'week-digest:2026-10-26:b')).toBe('today')
  })

  it('keys: every deadline:task- key is MONTHLY_TASK_KEY_SAFE; the pregnancy is named by the day it was recorded, never the LMP or due date', () => {
    for (const n of sample) {
      if (n.key.startsWith('deadline:task-')) expect(n.key).toMatch(MONTHLY_TASK_KEY_SAFE)
      expect(n.key, n.key).toMatch(/:[ab]$/)
      expect(n.key).not.toContain(LMP)
      expect(n.key).not.toContain(DUE)
    }
    expect(pregnancyTag({ lmp: LMP, confirmedAt: CONFIRMED })).toBe(CONFIRMED)
    // A repaired backup copies the LMP into confirmedAt: the key then carries no date.
    expect(pregnancyTag({ lmp: LMP, confirmedAt: LMP })).toBe('0')
    expect(pregnancyTag({ lmp: LMP, confirmedAt: '' })).toBe('0')
  })

  it('copy rules: 해요체, no AI tone or banned words, no 무료 or prices, no exclamation marks; numbers carry a hedge', () => {
    const texts = sample.map((n) => `${n.title} ${n.body}`)
    for (const t of texts) {
      expect(t).not.toMatch(/여정|소중한|특별한|의미 있는|차근차근|놓치지|답니다|숙제|실패|노력|오늘 꼭|무료|원\b|!/)
      expect(t).not.toMatch(/가임|배란|LH|생리/)
    }
    const c = PARTNER_NOTICE_COPY
    for (const body of [
      c.apply.body,
      c.applyNewYear.body('임신 전 검사'),
      c.testPrep.body,
      c.leaveOpen.body,
      c.postnatal.body,
      c.infertilityLeave.body,
    ]) {
      expect(body, body).toMatch(/마다 달라/)
    }
    expect(c.leaveLeft.body).toContain('확인해요')
  })

  it('the research behind every number is in docs/research (verified:false entries with sources)', () => {
    const research = ['kr-programs.json', 'medical.json', 'medical-checklist.json', 'admin-timeline.json']
      .map((f) => readFileSync(join(ROOT, 'docs/research', f), 'utf8'))
      .join('\n')
    for (const id of [
      'fertility-check-intake-2026',
      'partner-flu-season-2026-27',
      'male-semen-test-abstinence',
      'spouse-birth-leave-120-days',
      'partner-tdap-once',
      'postnatal-care-spouse-apply',
      'infertility-leave-paid-4-days-2026-11-27',
      'paternal-perinatal-depression',
    ]) {
      expect(research, id).toContain(`"${id}"`)
    }
  })
})

// ── long-lived records ──────────────────────────────────────

describe('a window notice is not sent again after the inbox fills up', () => {
  it('its record outlives the 200-notice trim while the window is still open', () => {
    let s = open(base(), '2026-10-05')
    expect(withPrefix(s.notifications, 'flu-season:')).toHaveLength(1)
    s = { ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }
    const filler: AppNotification[] = days('2026-10-06', '2026-12-30').flatMap((d) => [
      note(`complete:a:${d}`, HER, d),
      note(`complete:b:${d}`, HIM, d),
    ])
    s = { ...s, notifications: [...filler, ...s.notifications] }
    s = mergeNotices(s, [{ key: 'x:1', to: HER, kind: 'system', title: 't', body: '' }], stamp('2026-12-30')).state
    expect(s.notifications.length).toBeLessThanOrEqual(200)
    expect(withPrefix(s.notifications, 'flu-season:')).toHaveLength(1)
    expect(ours(partnerCheckpointNotices(s, '2026-12-30')).filter((n) => n.key.startsWith('flu-season:'))).toEqual([])
  })
})

// ── nothing of hers reaches him ─────────────────────────────

/** A small seeded random. */
function rng(seed: number) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31
    return x / 2 ** 31
  }
}

describe('property: his check-point notices carry no date of her cycle and nothing she did not tell — 120 random spaces', () => {
  it('her periods, LH and pregnancy tests, notes and 나만 보기 visits never change or appear in his notices', () => {
    let checked = 0
    for (let seed = 1; seed <= 120; seed++) {
      const r = rng(seed)
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
      // His side: a stage and his own steps.
      let s0: AppState = pick([
        () => decide(base(), 'partner-setup', '2026-09-0' + (1 + Math.floor(r() * 8))),
        () => startClinicMode(decide(base(), 'partner-setup', '2026-09-01'), '2026-09-01'),
        () =>
          addAppointment(
            setFertilityApplied(base(), HIM, true, '2026-10-01'),
            { date: '2026-11-0' + (2 + Math.floor(r() * 7)), title: '정액검사', who: HIM, kind: 'test', taskId: FERTILITY_TEST_ID },
            HIM,
          ),
        () => pregnant(),
        () => parenting(pick(['2026-08-01', '2026-11-20', '2026-12-10'] as const)),
      ])()
      // Her untold records.
      let s1 = s0
      const herDates: string[] = []
      const nPeriods = 1 + Math.floor(r() * 3)
      for (let i = 0; i < nPeriods && s1.stage === 'preparing'; i++) {
        const d = addDays('2026-09-03', i * 28 + Math.floor(r() * 5))
        s1 = logPeriodStart(s1, d, HER, d)
        herDates.push(d)
        const lh = addDays(d, 12 + Math.floor(r() * 3))
        s1 = addLHTest(s1, { date: lh, slot: 'morning', result: pick(['negative', 'positive', 'peak'] as const), by: HER }, lh)
        herDates.push(lh)
      }
      if (s1.stage === 'preparing' && r() < 0.5) {
        const t = addDays('2026-10-20', Math.floor(r() * 10))
        s1 = addPregnancyTest(s1, { date: t, result: pick(['negative', 'positive'] as const), by: HER }, t).state
        herDates.push(t)
      }
      const privateDay = addDays('2026-10-10', Math.floor(r() * 60))
      s1 = addAppointment(
        s1,
        { date: privateDay, title: '지은 비밀 진료', place: '비밀의원', who: HER, kind: 'hospital', privateTo: HER },
        HER,
      )
      if (s1.stage !== 'preparing') herDates.push(LMP)
      for (const d of days('2026-09-20', '2027-05-10', 5)) {
        const his0 = partnerCheckpointNotices(s0, d).filter((n) => n.to === HIM)
        const his1 = partnerCheckpointNotices(s1, d).filter((n) => n.to === HIM)
        expect(his1, `seed ${seed} ${d}`).toEqual(his0)
        for (const n of his1) {
          checked++
          const text = `${n.key} ${n.title} ${n.body}`
          for (const h of herDates) expect(text, `seed ${seed} ${d} ${h}`).not.toContain(h)
          expect(text).not.toMatch(/비밀|지은 비밀 진료/)
        }
      }
    }
    expect(checked).toBeGreaterThan(200)
  })
})
