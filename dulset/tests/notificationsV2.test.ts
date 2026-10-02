// N1 polish: one "우리의 주간" notice per cycle (LH-shifted windows don't send a
// second one), the 난임치료휴가 amendment in programs and the roadmap, and the
// on-device record helpers (storage.persist, 홈 화면 설치, 주 1회 백업).

import { afterEach, describe, expect, it } from 'vitest'
import { programById } from '@/lib/content/programs'
import { templateById } from '@/lib/content/roadmap'
import { range } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addPeriod, cycleAt, setLHTest } from '@/lib/logic/cycle'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import {
  clearNotifications,
  deliveredUnderOldKey,
  doctorKey,
  doctorTold,
  fertileKey,
  inbox,
  mergeNotices,
  peakKey,
  scheduledNotices,
  sendCheer,
  softFertileBody,
  type Notice,
} from '@/lib/logic/notifications'
import { alertPreview, sanitizeBackup } from '@/lib/logic/settings'
import { noticeTarget } from '@/lib/logic/today'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import {
  dismissVaccineRest,
  periodTellState,
  skipTellPartnerPeriod,
  tellPartnerPeriod,
  tellPartnerPositive,
  vaccineRestHint,
} from '@/lib/logic/ttcFlow'
import { parseState } from '@/lib/storage'
import {
  BACKUP_NUDGE_DAYS,
  INSTALL_STEPS,
  LAST_BACKUP_KEY,
  backupNudge,
  installPlatform,
  isStandalone,
  lastBackupAt,
  markBackedUp,
  parseBackupStamp,
  requestPersist,
  resetPersistRequest,
  standaloneFrom,
} from '@/lib/persist'
import type { AppNotification, AppState, Settings } from '@/lib/types'

// b (지은) tracks the cycle and hears it plainly; a (민수) gets the soft wording.
// Three regular 28-day cycles, then the period 2026-09-01 → estimated window
// 09-10…09-15 (ovulation 09-15, peak 09-13…09-15), next period expected 09-29
// (a one-day range: the three cycles were identical), late from 09-30.
const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
function fresh(settings: Partial<Settings> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, periods: REGULAR, settings: { ...s.settings, ...settings } }
}

const at = (d: string) => `${d}T09:00:00+09:00`
const fertileTo = (n: Notice[], to: 'a' | 'b') => n.filter((x) => x.kind === 'fertile-start' && x.to === to)
const peakTo = (n: Notice[], to: 'a' | 'b') => n.filter((x) => x.kind === 'peak' && x.to === to)

/** Deliver whatever the rules want to say on each day in order (the engine, day by day). */
function run(state: AppState, days: string[]): { state: AppState; added: AppNotification[] } {
  let s = state
  const added: AppNotification[] = []
  for (const d of days) {
    const r = mergeNotices(s, scheduledNotices(s, d), at(d))
    s = r.state
    added.push(...r.added)
  }
  return { state: s, added }
}

function legacy(key: string, to: 'a' | 'b', kind: AppNotification['kind']): AppNotification {
  return { id: key, to, kind, title: 'old', body: 'old', createdAt: at('2026-09-09'), key, read: true }
}

describe('fertile notices are keyed by the cycle, not the window', () => {
  it('uses the cycle start in both keys', () => {
    expect(fertileKey('2026-09-01', 'a')).toBe('fertile:2026-09-01:a')
    expect(peakKey('2026-09-01', 'b')).toBe('peak:2026-09-01:b')
    const n = scheduledNotices(fresh(), '2026-09-13')
    expect(fertileTo(n, 'a').map((x) => x.key)).toEqual(['fertile:2026-09-01:a'])
    expect(fertileTo(n, 'b').map((x) => x.key)).toEqual(['fertile:2026-09-01:b'])
    expect(peakTo(n, 'b').map((x) => x.key)).toEqual(['peak:2026-09-01:b'])
    expect(peakTo(n, 'a')).toEqual([]) // soft style: one gentle notice only
  })

  it('does not send a second 우리의 주간 notice when an LH positive moves the window earlier', () => {
    let { state: s, added } = run(fresh(), ['2026-09-09'])
    expect(added.filter((x) => x.kind === 'fertile-start').map((x) => x.to).sort()).toEqual(['a', 'b'])
    // Surge on 09-11 → ovulation 09-12, window 09-07…09-12 (it started "before" the notice).
    s = setLHTest(s, '2026-09-11', 'positive')
    expect(cycleAt(s, '2026-09-11')!.fertileStart).toBe('2026-09-07')
    const again = run(s, ['2026-09-11', '2026-09-12'])
    expect(again.added.filter((x) => x.kind === 'fertile-start')).toEqual([])
    // The peak notice (explicit style) still goes out once for this cycle.
    expect(again.added.filter((x) => x.kind === 'peak').map((x) => [x.to, x.key])).toEqual([['b', 'peak:2026-09-01:b']])
  })

  it('does not repeat either notice when a late surge moves the window later', () => {
    let { state: s } = run(fresh(), ['2026-09-09', '2026-09-13'])
    expect(s.notifications.filter((x) => x.kind === 'peak')).toHaveLength(1)
    // Surge on 09-17 → ovulation 09-18, window 09-13…09-18, peak 09-16…09-18.
    s = setLHTest(s, '2026-09-17', 'peak')
    expect(cycleAt(s, '2026-09-17')!.peakStart).toBe('2026-09-16')
    const again = run(s, ['2026-09-16', '2026-09-17', '2026-09-18'])
    expect(again.added.filter((x) => x.kind === 'fertile-start' || x.kind === 'peak')).toEqual([])
  })

  it('announces the next cycle once its period is logged', () => {
    let { state: s } = run(fresh(), ['2026-09-09', '2026-09-13'])
    s = addPeriod(s, '2026-09-29', '2026-10-03', 'b')
    const next = run(s, ['2026-10-07', '2026-10-08', '2026-10-11'])
    expect(next.added.filter((x) => x.kind === 'fertile-start').map((x) => x.key).sort()).toEqual([
      'fertile:2026-09-29:a',
      'fertile:2026-09-29:b',
    ])
    expect(next.added.filter((x) => x.kind === 'peak').map((x) => x.key)).toEqual(['peak:2026-09-29:b'])
  })

  it('still counts notices delivered under the old keys (fertile-start:<window>, peak:<peak start>)', () => {
    const s: AppState = {
      ...fresh(),
      notifications: [legacy('fertile-start:2026-09-10:a', 'a', 'fertile-start'), legacy('peak:2026-09-13:b', 'b', 'peak')],
    }
    const n = scheduledNotices(s, '2026-09-13')
    expect(fertileTo(n, 'a')).toEqual([])
    expect(peakTo(n, 'b')).toEqual([])
    // b's heads-up was never delivered under any key, so it still goes out.
    expect(fertileTo(n, 'b').map((x) => x.key)).toEqual(['fertile:2026-09-01:b'])
    // An old key from the LH-shifted window of the same cycle counts too.
    const shifted: AppState = { ...fresh(), notifications: [legacy('fertile-start:2026-09-07:b', 'b', 'fertile-start')] }
    expect(fertileTo(scheduledNotices(shifted, '2026-09-13'), 'b')).toEqual([])
  })

  it("never treats another cycle's key (old or new) as this cycle's", () => {
    const w = { start: '2026-09-01', nextPeriod: '2026-09-29' }
    const keys = (...k: string[]) => k.map((key) => ({ key }))
    // Previous cycle's old keys, the new-style key of this cycle, the next cycle's.
    expect(deliveredUnderOldKey(keys('fertile-start:2026-08-13:a'), w, 'a', 'fertile')).toBe(false)
    expect(deliveredUnderOldKey(keys('peak:2026-08-16:b'), w, 'b', 'peak')).toBe(false)
    expect(deliveredUnderOldKey(keys('peak:2026-09-01:b'), w, 'b', 'peak')).toBe(false)
    expect(deliveredUnderOldKey(keys('peak:2026-09-29:b'), w, 'b', 'peak')).toBe(false)
    // Someone else's, or a key without a member.
    expect(deliveredUnderOldKey(keys('fertile-start:2026-09-10:b'), w, 'a', 'fertile')).toBe(false)
    expect(deliveredUnderOldKey(keys('fertile-start:2026-09-10'), w, 'a', 'fertile')).toBe(false)
    expect(deliveredUnderOldKey(keys('fertile-start:2026-09-10:a'), w, 'a', 'fertile')).toBe(true)
    expect(deliveredUnderOldKey([{}], w, 'a', 'fertile')).toBe(false)
  })

  it('keeps fertility words out of the soft notice (and points nowhere that no longer exists)', () => {
    const [soft] = fertileTo(scheduledNotices(fresh(), '2026-09-11'), 'a')
    expect(`${soft!.title} ${soft!.body}`).not.toMatch(/가임|배란|가능성|데이트 탭|숙제|노력|실패|오늘 꼭/)
    const [plain] = fertileTo(scheduledNotices(fresh(), '2026-09-11'), 'b')
    expect(plain!.body).toContain('예상')
  })
})

describe('the expected period is a range: 내일 예정 · 늦음 · 임신 테스트 (N10)', () => {
  const owner = (n: Notice[], prefix: string) => n.filter((x) => x.to === 'b' && x.key.startsWith(prefix))

  it('says 내일부터 생리 예정 무렵 the day before the range starts, once per cycle', () => {
    // 지은's real case: 29…34-day cycles (average 31) → range 10-03…10-08 from the 09-04 period.
    const jieun = {
      ...fresh(),
      periods: [{ start: '2026-04-01' }, { start: '2026-05-01' }, { start: '2026-06-04' }, { start: '2026-07-03' }, { start: '2026-08-06' }, { start: '2026-09-04' }],
    }
    expect(owner(scheduledNotices(jieun, '2026-10-01'), 'period-due:')).toEqual([])
    const [due] = owner(scheduledNotices(jieun, '2026-10-02'), 'period-due:')
    expect(due).toMatchObject({ key: 'period-due:2026-09-04:b', kind: 'period-due', title: '🗓️ 내일부터 생리 예정 무렵이에요' })
    expect(due!.body).toContain('10월 3일~8일 무렵 (예상)')
    expect(owner(scheduledNotices(jieun, '2026-10-03'), 'period-due:')).toEqual([])
    // Settings only: the range is average ± 2 → 09-27…10-01, so the heads-up is on 09-26.
    const one = { ...fresh(), periods: [{ start: '2026-09-01' }] }
    expect(owner(scheduledNotices(one, '2026-09-26'), 'period-due:')[0]!.body).toContain('9월 27일~10월 1일 무렵')
    expect(owner(scheduledNotices(one, '2026-09-28'), 'period-due:')).toEqual([])
  })

  it('calls the period late only the day after the range, and brings up the test only from day 3', () => {
    const jieun = {
      ...fresh(),
      periods: [{ start: '2026-04-01' }, { start: '2026-05-01' }, { start: '2026-06-04' }, { start: '2026-07-03' }, { start: '2026-08-06' }, { start: '2026-09-04' }],
    }
    // Days 32 and 33 (10-05, 10-06) and the range's last day: no late notice (review D1).
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-08']) expect(owner(scheduledNotices(jieun, d), 'late'), d).toEqual([])
    const late = owner(scheduledNotices(jieun, '2026-10-09'), 'late')
    expect(late.map((x) => x.key)).toEqual(['late:2026-09-04:b'])
    expect(late[0]!.title).toBe('🗓️ 생리 예정일이 지났어요')
    expect(late[0]!.body).toContain('10월 3일~8일')
    expect(late[0]!.body).not.toMatch(/임신 테스트/)
    expect(owner(scheduledNotices(jieun, '2026-10-10'), 'late-test:')).toEqual([])
    const test = owner(scheduledNotices(jieun, '2026-10-11'), 'late-test:')
    expect(test.map((x) => x.key)).toEqual(['late-test:2026-09-04:b'])
    expect(test[0]!.title).toContain('임신 테스트')
    expect(test[0]!.body).toContain('3일 지났어요')
    // Delivered day by day: each goes out once.
    const { added } = run(jieun, range('2026-10-01', '2026-10-20'))
    expect(added.filter((n) => n.key?.startsWith('late:'))).toHaveLength(1)
    expect(added.filter((n) => n.key?.startsWith('late-test:'))).toHaveLength(1)
    expect(added.filter((n) => n.key?.startsWith('period-due:'))).toHaveLength(1)
    // Past LONG_LATE_DAYS nothing more goes out (the home asks about a missed log instead).
    expect(owner(scheduledNotices(jieun, '2026-10-24'), 'late')).toEqual([])
  })

  it('an LH surge moves the range (max of start + average and ovulation + 12), and the notices follow', () => {
    // Surge 09-25 → ovulation 09-26 → range 10-08…10-10 (start + 31 = 10-05 is earlier).
    const s = addLHTest(fresh(), { date: '2026-09-25', time: '08:00', result: 'positive', by: 'b' })
    const jieun = {
      ...s,
      periods: [{ start: '2026-04-01' }, { start: '2026-05-01' }, { start: '2026-06-04' }, { start: '2026-07-03' }, { start: '2026-08-06' }, { start: '2026-09-04' }],
    }
    expect(owner(scheduledNotices(jieun, '2026-10-07'), 'period-due:')).toHaveLength(1)
    expect(owner(scheduledNotices(jieun, '2026-10-09'), 'late')).toEqual([])
    expect(owner(scheduledNotices(jieun, '2026-10-11'), 'late').map((x) => x.key)).toEqual(['late:2026-09-04:b'])
  })

  it('names no best days (🌟) and words the window as a wide range while the calendar alone is all there is', () => {
    const one = { ...fresh({ alertStyle: { a: 'explicit', b: 'explicit' }, shareCycleDetails: true }), periods: [{ start: '2026-09-01' }] }
    const days = range('2026-09-01', '2026-09-29')
    const all = days.flatMap((d) => scheduledNotices(one, d))
    expect(all.filter((x) => x.kind === 'peak')).toEqual([])
    const [heads] = fertileTo(scheduledNotices(one, '2026-09-11'), 'b')
    expect(heads!.body).toContain('예상 범위예요 (넓음 · 달력 기준)')
    expect(heads!.body).not.toMatch(/더 정확해요|가능성/)
    // Three regular cycles: the 🌟 notice is back.
    expect(peakTo(scheduledNotices(fresh(), '2026-09-13'), 'b')).toHaveLength(1)
    expect(fertileTo(scheduledNotices(fresh(), '2026-09-11'), 'b')[0]!.body).not.toContain('넓음')
    // An LH surge this cycle pins it even with one logged period.
    const lh = addLHTest(one, { date: '2026-09-12', time: '08:00', result: 'positive', by: 'b' })
    expect(peakTo(scheduledNotices(lh, '2026-09-13'), 'b').map((x) => x.key)).toEqual(['peak:2026-09-01:b'])
  })
})

describe('the soft 우리의 주간 notice: what it promises and where it opens', () => {
  const soft = () => fresh({ alertStyle: { a: 'soft', b: 'soft' } })

  it('points the partner at the 우리의 주간 card on 오늘, and promises the owner no ideas', () => {
    const n = scheduledNotices(soft(), '2026-09-11')
    const [toA] = fertileTo(n, 'a') // 민수, the partner
    const [toB] = fertileTo(n, 'b') // 지은, whose cycle it is (soft by choice)
    expect(toA!.body).toBe(softFertileBody(false))
    expect(toA!.body).toContain('오늘 화면의 ‘우리의 주간’ 카드')
    expect(toB!.body).toBe(softFertileBody(true))
    expect(toB!.body).not.toContain('아이디어')
    for (const x of [toA!, toB!]) {
      expect(`${x.title} ${x.body}`).not.toMatch(/가임|배란|LH|가능성|데이트|숙제|노력|실패|오늘 꼭|관계를 가져야/)
      // Opens the home card, where the ideas are.
      expect(noticeTarget(x.kind, 'preparing', x.key)).toBe('today')
    }
  })

  it('reads the same in the 설정 preview, per person', () => {
    const n = scheduledNotices(soft(), '2026-09-11')
    const msg = (x?: Notice) => ({ title: x!.title, body: x!.body })
    expect(alertPreview('soft', { lowPressure: false, isCycleOwner: false }).message).toEqual(msg(fertileTo(n, 'a')[0]))
    expect(alertPreview('soft', { lowPressure: false, isCycleOwner: true }).message).toEqual(msg(fertileTo(n, 'b')[0]))
  })

  it('says low-pressure is my own choice, not the couple’s', () => {
    const { message, note } = alertPreview('explicit', { lowPressure: true, isCycleOwner: false })
    expect(message).toBeNull()
    expect(note).toContain('내 화면과 알림에만 적용돼요')
    expect(note).not.toContain('두 사람 모두')
  })
})

describe('the partner hears nothing about period, LH or tests without the details', () => {
  // A whole cycle and past the expected period: LH strips rising to a surge, a
  // negative test, then late. 민수 (a) picked the explicit style; 지은 (b) keeps
  // her details (the default).
  function eventful(settings: Partial<Settings> = {}): AppState {
    let s = fresh({ alertStyle: { a: 'explicit', b: 'explicit' }, ttcStart: '2025-01-01', ...settings })
    for (const [date, result] of [
      ['2026-09-10', 'negative'],
      ['2026-09-11', 'faint'],
      ['2026-09-12', 'positive'],
      ['2026-09-13', 'peak'],
    ] as const)
      s = addLHTest(s, { date, time: '08:30', result, by: 'b' })
    return addPregnancyTest(s, { date: '2026-09-27', time: '07:00', result: 'negative', by: 'b' }).state
  }
  const toPartner = (s: AppState) => run(s, range('2026-09-01', '2026-10-06')).added.filter((n) => n.to === 'a')

  it('gets only the shared 우리의 주간 and couple-wide notices', () => {
    const got = toPartner(eventful())
    expect(got.map((n) => n.kind).sort()).toEqual(['doctor', 'fertile-start'])
    for (const n of got) expect(`${n.title} ${n.body}`).not.toMatch(/생리|LH|배란|가임|양성|음성|테스트|예정일|\d+월 \d+일/)
    // The owner still gets her own: window, peak, 내일 생리 예정일, and the late notice.
    const own = run(eventful(), range('2026-09-01', '2026-10-06')).added.filter((n) => n.to === 'b')
    expect(own.map((n) => n.kind)).toEqual(expect.arrayContaining(['fertile-start', 'peak', 'period-due']))
  })

  it('once she shares the details, gets the dated window and peak — still never the period or tests', () => {
    const got = toPartner(eventful({ shareCycleDetails: true }))
    expect(got.map((n) => n.kind).sort()).toEqual(['doctor', 'fertile-start', 'peak'])
    expect(got.some((n) => n.kind === 'period-due' || n.key?.startsWith('late:'))).toBe(false)
  })

  it('hears what she chose to tell, and it opens his card on 오늘', () => {
    let s = tellPartnerPeriod(fresh(), '2026-09-01', at('2026-09-01'))
    s = tellPartnerPositive(markPositivePending(s, '2026-09-26'), at('2026-09-26'))
    const told = inbox(s, 'a')
    expect(told.map((n) => n.key).sort()).toEqual(['period-told:2026-09-01', 'positive-told:2026-09-26'])
    for (const n of told) {
      expect(noticeTarget(n.kind, 'preparing', n.key)).toBe('today')
      expect(`${n.title} ${n.body}`).not.toContain('🎉')
    }
  })
})

describe('answers kept as dismissed notice records (알릴까요? · 접종 뒤 쉬어 가기)', () => {
  const NOW_ = at('2026-09-25')
  function answered(): AppState {
    let s: AppState = { ...fresh(), planDone: { 'pre-rubella': { at: '2026-09-20', by: 'b' } } }
    s = skipTellPartnerPeriod(s, '2026-09-01', NOW_)
    s = tellPartnerPeriod(s, '2026-08-04', NOW_)
    return dismissVaccineRest(s, vaccineRestHint(s, '2026-09-25', 'b')!, NOW_)
  }

  it('survive 모두 지우기 on either phone, so the questions never come back', () => {
    const s = answered()
    expect(periodTellState(s, '2026-09-01')).toBe('skipped')
    const cleared = clearNotifications(clearNotifications(s, 'a'), 'b')
    expect(inbox(cleared, 'a')).toEqual([])
    expect(inbox(cleared, 'b')).toEqual([])
    expect(periodTellState(cleared, '2026-09-01')).toBe('skipped')
    expect(periodTellState(cleared, '2026-08-04')).toBe('told')
    expect(vaccineRestHint(cleared, '2026-09-25', 'b')).toBeNull()
  })

  it('outlive the inbox cap, however many notices come after', () => {
    let s = answered()
    for (let i = 0; i < 260; i++) s = sendCheer(s, i % 2 ? 'a' : 'b', i % 2 ? 'b' : 'a', `2026-09-26T09:${String(i % 60).padStart(2, '0')}:00+09:00`)
    expect(s.notifications.length).toBeLessThanOrEqual(200)
    expect(periodTellState(s, '2026-09-01')).toBe('skipped')
    expect(periodTellState(s, '2026-08-04')).toBe('told')
    expect(vaccineRestHint(s, '2026-09-25', 'b')).toBeNull()
  })

  it('survive a backup and a reload', () => {
    const s = clearNotifications(answered(), 'b')
    for (const back of [sanitizeBackup(JSON.parse(JSON.stringify(s)))!, parseState(JSON.stringify(s))!]) {
      expect(back.notifications).toEqual(s.notifications)
      expect(periodTellState(back, '2026-09-01')).toBe('skipped')
      expect(periodTellState(back, '2026-08-04')).toBe('told')
      expect(vaccineRestHint(back, '2026-09-25', 'b')).toBeNull()
    }
  })
})

describe("a partner without the owner's cycle details", () => {
  it('gets only the shared 우리의 주간 notice, even with the explicit style (no dates, no peak days)', () => {
    // 민수 (a) chose explicit, but 지은 (b, the owner) hasn't shared her details.
    const hidden = fresh({ alertStyle: { a: 'explicit', b: 'explicit' }, shareCycleDetails: false })
    const n = scheduledNotices(hidden, '2026-09-13')
    const [toA] = fertileTo(n, 'a')
    expect(toA!.title).toBe('💞 이번 주는 우리의 주간이에요')
    expect(`${toA!.title} ${toA!.body}`).not.toMatch(/가임|배란|가능성|\d+월 \d+일/)
    expect(peakTo(n, 'a')).toEqual([])
    // The owner keeps her own explicit notices.
    expect(fertileTo(n, 'b')[0]!.title).toBe('💞 가임기가 다가왔어요')
    expect(peakTo(n, 'b')).toHaveLength(1)
  })

  it('gets the explicit wording once the owner shares her details', () => {
    const shared = fresh({ alertStyle: { a: 'explicit', b: 'explicit' }, shareCycleDetails: true })
    const n = scheduledNotices(shared, '2026-09-13')
    expect(fertileTo(n, 'a')[0]!.title).toBe('💞 가임기가 다가왔어요')
    expect(peakTo(n, 'a').map((x) => x.key)).toEqual(['peak:2026-09-01:a'])
  })

  it('still hears nothing with the style off or in low-pressure mode', () => {
    const off = fresh({ alertStyle: { a: 'off', b: 'explicit' }, shareCycleDetails: true })
    expect(scheduledNotices(off, '2026-09-13').some((x) => x.to === 'a')).toBe(false)
    const calm = fresh({ personal: { a: { lowPressure: true } }, shareCycleDetails: true })
    expect(fertileTo(scheduledNotices(calm, '2026-09-13'), 'a')).toEqual([])
    expect(fertileTo(scheduledNotices(calm, '2026-09-13'), 'b')).toHaveLength(1)
  })
})

describe('rest cycles and a positive test awaiting the clinic', () => {
  it('pause fertile notices until the next period is logged', () => {
    const rest = startRestCycle(fresh(), '2026-09-05')
    expect(scheduledNotices(rest, '2026-09-11').filter((x) => x.kind === 'fertile-start' || x.kind === 'peak')).toEqual([])
    // A period after the rest began ends it (even if the flag wasn't cleared): notices resume.
    const after = addPeriod(rest, '2026-09-29', undefined, 'b')
    expect(fertileTo(scheduledNotices(after, '2026-10-07'), 'a')).toHaveLength(1)
  })

  it('a rest cycle also holds back the late and period-due notices (the card rests on those days too)', () => {
    const rest = startRestCycle(fresh(), '2026-09-05')
    // 09-28: the day before the expected period; 10-02: three days late.
    expect(scheduledNotices(rest, '2026-09-28').filter((x) => x.key.startsWith('period-due:'))).toEqual([])
    expect(scheduledNotices(rest, '2026-10-02').filter((x) => x.key.startsWith('late:'))).toEqual([])
    expect(scheduledNotices(rest, '2026-10-02').filter((x) => x.kind === 'period-due')).toEqual([])
    expect(scheduledNotices(fresh(), '2026-09-28').filter((x) => x.key.startsWith('period-due:'))).toHaveLength(1)
    // The next period ends the rest: the cycle after it gets its notices again.
    const after = addPeriod(rest, '2026-09-29', undefined, 'b')
    expect(scheduledNotices(after, '2026-10-26').filter((x) => x.key.startsWith('period-due:'))).toHaveLength(1)
  })

  it('send no fertile notice and no "take a test" prompt while a positive test awaits the clinic', () => {
    const pending = markPositivePending(fresh(), '2026-09-26')
    expect(scheduledNotices(pending, '2026-09-13').some((x) => x.kind === 'fertile-start')).toBe(false)
    // 10-01 is 2 days past the expected period: no late / test notice either.
    expect(scheduledNotices(pending, '2026-10-01').filter((x) => x.key.startsWith('late:'))).toEqual([])
    expect(scheduledNotices(fresh(), '2026-10-01').filter((x) => x.key.startsWith('late:'))).toHaveLength(1)
  })

  it('a clinic cycle (병원과 함께 준비 중) holds every date notice and the 🩺 notice, period logs or not', () => {
    const clinic = startRestCycle(fresh({ ttcStart: '2025-01-01' }), '2026-09-05', 'clinic')
    const dated = (s: AppState, d: string) =>
      scheduledNotices(s, d).filter((x) => x.kind === 'fertile-start' || x.kind === 'peak' || x.kind === 'period-due' || x.kind === 'doctor')
    expect(dated(clinic, '2026-09-11')).toEqual([])
    expect(dated(clinic, '2026-09-28')).toEqual([])
    expect(dated(clinic, '2026-10-02')).toEqual([])
    // A period logged for the clinic's 생리 2~3일째 visit does not end it: still quiet next cycle.
    const logged = addPeriod(clinic, '2026-09-29', undefined, 'b')
    expect(dated(logged, '2026-10-07')).toEqual([])
    expect(dated(logged, '2026-10-26')).toEqual([])
    // An ordinary rest with the same trying time still gets the 🩺 notice.
    expect(dated(startRestCycle(fresh({ ttcStart: '2025-01-01' }), '2026-09-05'), '2026-09-11').map((x) => x.kind)).toEqual(['doctor', 'doctor'])
  })

  it('holds back "내일이 생리 예정일" and the doctor notice while the positive test waits', () => {
    // 09-28 is the day before the expected period (09-29).
    const due = (s: AppState) => scheduledNotices(s, '2026-09-28').filter((x) => x.key.startsWith('period-due:'))
    expect(due(fresh())).toHaveLength(1)
    expect(due(markPositivePending(fresh(), '2026-09-26'))).toEqual([])
    // Trying since 2025-01 (20 months): the doctor notice is due for both…
    const long = fresh({ ttcStart: '2025-01-01' })
    const doctor = (s: AppState) => scheduledNotices(s, '2026-09-20').filter((x) => x.kind === 'doctor')
    expect(doctor(long).map((x) => x.to).sort()).toEqual(['a', 'b'])
    // …but not on top of a positive test awaiting the clinic.
    const waiting = markPositivePending(long, '2026-09-18')
    expect(doctor(waiting)).toEqual([])
    // A period after the test settles it: the notice comes back.
    const settled = addPeriod(waiting, '2026-09-19', undefined, 'b')
    expect(doctor(settled).map((x) => x.to).sort()).toEqual(['a', 'b'])
  })
})

describe('the 🩺 notice is keyed by the trying period, not the age threshold', () => {
  const born = (s: AppState, year: number): AppState => ({
    ...s,
    couple: { ...s.couple, members: [s.couple.members[0], { ...s.couple.members[1], birthYear: year }] as AppState['couple']['members'] },
  })
  const doctor = (s: AppState, today: string) => scheduledNotices(s, today).filter((x) => x.kind === 'doctor')

  it('keeps the same key when the threshold changes with her age (and at 40+)', () => {
    const long = fresh({ ttcStart: '2025-01-01' })
    expect(doctorKey('2025-01-01')).toBe('doctor:2025-01-01')
    // 34 in 2026 (12 months) → 35 in 2027 (6 months): the same notice, not a second one.
    const keys34 = doctor(born(long, 1992), '2026-09-20').map((x) => x.key).sort()
    const keys35 = doctor(born(long, 1992), '2027-01-02').map((x) => x.key).sort()
    expect(keys34).toEqual(['doctor:2025-01-01:a', 'doctor:2025-01-01:b'])
    expect(keys35).toEqual(keys34)
    // 40+: "준비 초기에" wording, same key.
    const forty = doctor(born(fresh({ ttcStart: '2026-09-01' }), 1986), '2026-09-02')
    expect(forty.map((x) => x.key).sort()).toEqual(['doctor:2026-09-01:a', 'doctor:2026-09-01:b'])
    expect(forty[0]!.title).toContain('준비 초기에')
  })

  it('counts a notice sent under the old threshold-bearing key as delivered', () => {
    const long = fresh({ ttcStart: '2025-01-01' })
    expect(doctorTold(long, '2025-01-01')).toBe(false)
    const old: AppNotification = {
      id: 'o',
      to: 'a',
      kind: 'doctor',
      title: '',
      body: '',
      createdAt: '2026-01-02T09:00:00+09:00',
      key: 'doctor:2025-01-01:12:a',
      read: true,
    }
    const told = { ...long, notifications: [old] }
    expect(doctorTold(told, '2025-01-01')).toBe(true)
    expect(doctor(told, '2026-09-20')).toEqual([])
    // A new trying period (after a loss) gets its own.
    expect(doctorTold(told, '2026-03-01')).toBe(false)
  })
})

describe('난임치료휴가: programs and the roadmap agree', () => {
  it('says 연 6일 and 유급 4일 from 2026-11-27 (유급 2일 before) in both places', () => {
    const p = programById('infertility-leave')!
    expect(p.benefit).toContain('연 6일')
    expect(p.benefit).toContain('2026-11-27부터 유급 4일')
    expect(p.benefit).toContain('유급 2일')
    expect(p.effective).toContain('2026-11-27')
    expect(p.who).toContain('남성')
    const t = templateById('pre-infertility-support')!
    expect(t.detail).toContain('연 6일(유급 2일)')
    expect(t.detail).toContain('2026-11-27부터는 유급이 4일')
    expect(t.sources.map((x) => x.url)).toContain('https://news.nate.com/view/20260423n35039')
  })

  it('gives the voucher its loss rule (유산 진단일부터 2년)', () => {
    expect(programById('pregnancy-voucher')!.deadline).toContain('유산이면 진단일부터 2년')
  })
})

describe('on-device record: storage.persist()', () => {
  afterEach(() => resetPersistRequest())

  it('asks once, however often it is called', async () => {
    let asked = 0
    const api = { persist: async () => (asked++, true), persisted: async () => false }
    expect(await requestPersist(api)).toBe('granted')
    expect(await requestPersist(api)).toBe('granted')
    expect(await requestPersist({ persist: async () => false })).toBe('granted') // cached answer
    expect(asked).toBe(1)
  })

  it('does not ask when storage is already persistent, and reports a refusal', async () => {
    let asked = 0
    expect(await requestPersist({ persist: async () => (asked++, true), persisted: async () => true })).toBe('persisted')
    expect(asked).toBe(0)
    resetPersistRequest()
    expect(await requestPersist({ persist: async () => false })).toBe('denied')
  })

  it('never throws: missing API or a failing call is "unsupported"', async () => {
    expect(await requestPersist(undefined)).toBe('unsupported')
    expect(await requestPersist({})).toBe('unsupported')
    const failing = {
      persist: async (): Promise<boolean> => {
        throw new Error('blocked')
      },
    }
    expect(await requestPersist(failing)).toBe('unsupported')
  })
})

describe('on-device record: 홈 화면 설치', () => {
  it('knows when it runs from the home screen', () => {
    expect(standaloneFrom(true, undefined)).toBe(true)
    expect(standaloneFrom(false, true)).toBe(true) // iOS Safari
    expect(standaloneFrom(false, false)).toBe(false)
    expect(standaloneFrom(false, 'yes')).toBe(false)
    expect(isStandalone()).toBe(false) // no browser here
  })

  it('shows the steps for the phone in hand', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
    const android = 'Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36'
    expect(installPlatform(iphone)).toBe('ios')
    expect(installPlatform(ipad, 5)).toBe('ios')
    expect(installPlatform(ipad, 0)).toBe('other') // a real Mac
    expect(installPlatform(android)).toBe('android')
    expect(INSTALL_STEPS.ios).toContain('홈 화면에 추가')
    expect(INSTALL_STEPS.android).toContain('앱 설치')
  })

  it('knows a link opened inside 카카오톡 (or another app) cannot be installed from there', () => {
    const kakaoIos =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5'
    const kakaoAndroid =
      'Mozilla/5.0 (Linux; Android 15; SM-S928N; wv) AppleWebKit/537.36 Version/4.0 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.8.5'
    const naver =
      'Mozilla/5.0 (Linux; Android 15; SM-S928N; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.10.3)'
    const insta = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0'
    for (const ua of [kakaoIos, kakaoAndroid, naver, insta]) expect(installPlatform(ua)).toBe('inapp')
    // The steps say to back up first: another browser starts with empty storage.
    expect(INSTALL_STEPS.inapp).toContain('다른 브라우저로 열기')
    expect(INSTALL_STEPS.inapp).toContain('백업')
    // A plain browser mentioning "Line" in some other word isn't mistaken for LINE.
    expect(installPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Pipeline/2')).toBe('other')
  })
})

describe('on-device record: 주 1회 백업', () => {
  it('nudges after a week without a backup', () => {
    expect(BACKUP_NUDGE_DAYS).toBe(7)
    expect(backupNudge('2026-09-21T21:00:00+09:00', '2026-01-01', '2026-09-28')).toBeNull() // 7 days
    expect(backupNudge('2026-09-20T21:00:00+09:00', '2026-01-01', '2026-09-28')).toEqual({ kind: 'stale', days: 8 })
    expect(backupNudge('2026-09-28', '2026-01-01', '2026-09-28')).toBeNull()
  })

  it('counts from the day the space was created when there was never a backup', () => {
    expect(backupNudge(null, '2026-09-25T10:00:00+09:00', '2026-09-28')).toBeNull() // brand new
    expect(backupNudge(null, '2026-09-10T10:00:00+09:00', '2026-09-28')).toEqual({ kind: 'never', days: 18 })
    expect(backupNudge(null, undefined, '2026-09-28')).toBeNull()
    expect(backupNudge('garbage', 'also garbage', '2026-09-28')).toBeNull()
  })

  it('only trusts date-prefixed stamps', () => {
    expect(parseBackupStamp('2026-09-28T09:00:00+09:00')).toBe('2026-09-28T09:00:00+09:00')
    expect(parseBackupStamp('2026-09-28')).toBe('2026-09-28')
    expect(parseBackupStamp('2026-02-30T00:00:00Z')).toBeNull()
    expect(parseBackupStamp('')).toBeNull()
    expect(parseBackupStamp(null)).toBeNull()
  })

  it('remembers the last backup per device (and tells the screen)', () => {
    const store = new Map<string, string>()
    const events: string[] = []
    const g = globalThis as unknown as { window?: unknown }
    g.window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      dispatchEvent: (e: Event) => (events.push(e.type), true),
    }
    try {
      expect(lastBackupAt()).toBeNull()
      markBackedUp('2026-09-28T21:05:00+09:00')
      expect(store.get(LAST_BACKUP_KEY)).toBe('2026-09-28T21:05:00+09:00')
      expect(LAST_BACKUP_KEY.startsWith('dulset:')).toBe(true) // cleared by 모든 기록 지우기
      expect(lastBackupAt()).toBe('2026-09-28T21:05:00+09:00')
      expect(events).toEqual(['dulset:backed-up'])
      markBackedUp('not a date')
      expect(lastBackupAt()).toBe('2026-09-28T21:05:00+09:00')
    } finally {
      delete g.window
    }
    // Without a browser it quietly does nothing.
    expect(lastBackupAt()).toBeNull()
    expect(() => markBackedUp('2026-09-28')).not.toThrow()
  })
})
