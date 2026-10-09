import { describe, expect, it } from 'vitest'
import { addDays, weekdayIndex } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { addCheckItem, toggleCheck } from '@/lib/logic/checks'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { setFertilityApplied, setClaimDocDone } from '@/lib/logic/partnerTrack'
import { setShareLevel } from '@/lib/logic/prefs'
import { backToPreparing, startPregnancy } from '@/lib/logic/pregnancy'
import { sanitizeBackup } from '@/lib/logic/settings'
import { sendSignal } from '@/lib/logic/signals'
import { markPositivePending, startLossRest, startRestCycle } from '@/lib/logic/ttc'
import {
  CLINIC_DAY_OPTION,
  WEEK_OPTIONS,
  WEEK_OPTION_COUNT,
  WEEK_SUMMARY_MAX,
  canThankWeek,
  markWeekDone,
  partnerWeekSummary,
  pickWeek,
  sharedAppointmentInWeek,
  shortCheckLabel,
  thankWeek,
  thanksThisWeek,
  unmarkWeekDone,
  weekDaysSoFar,
  weekDone,
  weekDoneKey,
  weekOf,
  weekOptionById,
  weekOptions,
  weekPick,
  weekPickKey,
  weekQuiet,
  weekThanked,
  weekThanksKey,
  weekTogetherOn,
} from '@/lib/logic/weekTogether'
import { parseState } from '@/lib/storage'
import { DECISION_KEY_MAX } from '@/lib/sync/model'
import type { AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner).
const OWNER: MemberId = 'b'
const PARTNER: MemberId = 'a'
const TODAY: ISODate = '2026-10-03' // a Saturday
const MONDAY: ISODate = '2026-09-28'
const stamp = (day: ISODate, hour = 9) => `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`

/** `space` stands for the couple: it is the space's createdAt, which seeds the weekly rotation. */
function fresh(space = 'A'): AppState {
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
  // A fixed space (createdAt) so the rotation is reproducible; the invite code stays random.
  const createdAt = space === 'A' ? '2026-06-01T09:00:00+09:00' : `2026-06-01T09:00:00+09:00#${space}`
  return {
    ...s,
    createdAt,
    periods: [{ start: '2026-08-23' }, { start: '2026-09-20' }],
    checkItems: [
      { id: 'walk', owner: 'a', label: '걷기 30분', kind: 'habit', active: true, createdAt: '2026-06-01' },
      { id: 'vit', owner: 'a', label: '먹던 영양제', kind: 'supplement', active: true, createdAt: '2026-06-01' },
      { id: 'nodrink', owner: 'a', label: '금주', kind: 'habit', note: '주 1회 체크인', active: true, createdAt: '2026-06-01', cadence: 'weekly' },
      { id: 'folic', owner: 'b', label: '엽산', kind: 'supplement', active: true, createdAt: '2026-06-01' },
    ],
  }
}

/** A state that went through a pregnancy which ended on `endedAt` (the 'loss' quiet starts on its own). */
function afterLoss(endedAt: ISODate): AppState {
  const pregnant = startPregnancy(fresh(), '2026-08-01', '2026-09-05')
  return backToPreparing(pregnant, endedAt)
}

const BANNED = /숙제|실패|노력|오늘 꼭|관계를|관계|가임|배란|임신|테스트|검사|LH|임테기|배테기|생리|타이밍/

describe('weeks', () => {
  it('weekOf: Monday to Sunday, local dates; Sunday belongs to the week before Monday', () => {
    expect(weekOf('2026-10-03')).toBe('2026-09-28') // Sat
    expect(weekOf('2026-10-04')).toBe('2026-09-28') // Sun
    expect(weekOf('2026-10-05')).toBe('2026-10-05') // Mon
    expect(weekOf('2026-09-28')).toBe('2026-09-28')
    expect(weekdayIndex(weekOf('2026-12-31'))).toBe(1)
    // Across a year boundary.
    expect(weekOf('2027-01-01')).toBe('2026-12-28')
  })

  it('weekDaysSoFar: Monday up to today (or Sunday)', () => {
    expect(weekDaysSoFar(MONDAY, '2026-09-30')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30'])
    expect(weekDaysSoFar(MONDAY, '2026-10-20')).toHaveLength(7)
    expect(weekDaysSoFar('2026-10-05', TODAY)).toEqual([])
  })
})

describe('the catalogue', () => {
  it('is relationship-side: no timing, intercourse, test or cycle words, no banned words', () => {
    for (const o of [...WEEK_OPTIONS, CLINIC_DAY_OPTION]) {
      expect(o.text, o.id).not.toMatch(BANNED)
      expect(o.doneText, o.id).not.toMatch(BANNED)
      // 해요체 for the done line.
      expect(o.doneText.endsWith('요'), o.id).toBe(true)
      expect(weekOptionById(o.id)).toBe(o)
    }
    expect(new Set(WEEK_OPTIONS.map((o) => o.id)).size).toBe(WEEK_OPTIONS.length)
    expect(weekOptionById('nope')).toBeUndefined()
    expect(WEEK_OPTIONS.length).toBeGreaterThan(WEEK_OPTION_COUNT)
  })

  it('keys stay short enough for decisions and survive a backup and a reload', () => {
    let s = pickWeek(fresh(), PARTNER, weekOptions(fresh(), TODAY, PARTNER)[0]!.id, TODAY)
    s = markWeekDone(s, PARTNER, TODAY)
    s = thankWeek(s, OWNER, TODAY)
    const keys = Object.keys(s.decisions)
    expect(keys.length).toBe(3)
    for (const k of keys) expect(k.length).toBeLessThanOrEqual(DECISION_KEY_MAX)
    for (const id of [...WEEK_OPTIONS, CLINIC_DAY_OPTION].map((o) => o.id)) {
      expect(weekPickKey('2026-12-28', 'b', id).length).toBeLessThanOrEqual(DECISION_KEY_MAX)
    }
    expect(parseState(JSON.stringify(s))!.decisions).toEqual(s.decisions)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(s)))!.decisions).toEqual(s.decisions)
    expect(keys.sort()).toEqual([weekDoneKey(MONDAY, PARTNER), weekPickKey(MONDAY, PARTNER, weekPick(s, MONDAY, PARTNER)!.id), weekThanksKey(MONDAY, OWNER)].sort())
  })
})

describe('weekOptions: three picks, rotated per (week, couple)', () => {
  it('offers three distinct picks from the catalogue, the same every day of the week', () => {
    const s = fresh()
    const opts = weekOptions(s, MONDAY, PARTNER)
    expect(opts).toHaveLength(WEEK_OPTION_COUNT)
    expect(new Set(opts.map((o) => o.id)).size).toBe(WEEK_OPTION_COUNT)
    for (const o of opts) expect(WEEK_OPTIONS).toContain(o)
    for (let i = 0; i < 7; i++) expect(weekOptions(s, addDays(MONDAY, i), PARTNER)).toEqual(opts)
  })

  it('is deterministic: the same couple and week give the same picks; weeks and couples rotate', () => {
    expect(weekOptions(fresh(), TODAY, PARTNER)).toEqual(weekOptions(fresh(), TODAY, PARTNER))
    const weeks = Array.from({ length: 12 }, (_, i) => weekOptions(fresh(), addDays(MONDAY, 7 * i), PARTNER).map((o) => o.id).join(','))
    expect(new Set(weeks).size).toBeGreaterThan(3)
    // Every pick comes round over a few months.
    const seen = new Set(weeks.flatMap((w) => w.split(',')))
    expect(seen.size).toBe(WEEK_OPTIONS.length)
    const couples = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'].map((code) => weekOptions(fresh(code), TODAY, PARTNER).map((o) => o.id).join(','))
    expect(new Set(couples).size).toBeGreaterThan(1)
    // The invite code is not the seed: two copies of one space (two phones, a backup) agree whatever it says.
    const one = fresh()
    expect(weekOptions({ ...one, couple: { ...one.couple, inviteCode: 'OTHER' } }, TODAY, PARTNER)).toEqual(weekOptions(one, TODAY, PARTNER))
    // A state without a createdAt (damaged) still rotates, by the invite code.
    expect(weekOptions({ ...one, createdAt: undefined as never }, TODAY, PARTNER)).toHaveLength(WEEK_OPTION_COUNT)
  })

  it('never offers anything to the cycle owner, while parenting, or before a valid day', () => {
    expect(weekOptions(fresh(), TODAY, OWNER)).toEqual([])
    expect(weekOptions({ ...fresh(), stage: 'parenting' }, TODAY, PARTNER)).toEqual([])
    expect(weekOptions(fresh(), 'soon', PARTNER)).toEqual([])
  })

  it('carries nothing about the cycle: the same picks whatever she logged, told or shares (rule #1)', () => {
    const base = weekOptions(fresh(), TODAY, PARTNER)
    const variants: AppState[] = [
      { ...fresh(), periods: [] },
      { ...fresh(), periods: [{ start: '2026-09-01' }] },
      addLHTest(fresh(), { date: '2026-10-02', result: 'peak', by: OWNER }),
      addPregnancyTest(fresh(), { date: '2026-10-02', result: 'negative', by: OWNER }).state,
      addPregnancyTest(fresh(), { date: '2026-10-02', result: 'positive', by: OWNER }).state,
      markPositivePending(fresh(), '2026-10-02'),
      startRestCycle(fresh(), '2026-09-30', 'rest'),
      startRestCycle(fresh(), '2026-09-30', 'clinic'),
      setShareLevel(fresh(), OWNER, 'none'),
      setShareLevel(fresh(), OWNER, 'details'),
      { ...fresh(), settings: { ...fresh().settings, alertStyle: { a: 'off', b: 'explicit' } } },
    ]
    for (const v of variants) expect(weekOptions(v, TODAY, PARTNER)).toEqual(base)
  })

  it('puts 병원 일정 있는 날 시간 비워 두기 third in a week with an appointment both go to', () => {
    const base = weekOptions(fresh(), TODAY, PARTNER)
    const appt = (date: ISODate, who: 'a' | 'b' | 'both', kind: 'hospital' | 'test' | 'admin' | 'other' = 'hospital') =>
      addAppointment(fresh(), { date, title: '진료', who, kind }, OWNER)
    const both = appt('2026-10-01', 'both')
    expect(sharedAppointmentInWeek(both, MONDAY)).toBe(true)
    const opts = weekOptions(both, TODAY, PARTNER)
    expect(opts.map((o) => o.id)).toEqual([base[0]!.id, base[1]!.id, CLINIC_DAY_OPTION.id])
    // Sunday of the week counts; the next Monday does not.
    expect(weekOptions(appt('2026-10-04', 'both'), TODAY, PARTNER)[2]).toBe(CLINIC_DAY_OPTION)
    expect(weekOptions(appt('2026-10-05', 'both'), TODAY, PARTNER)).toEqual(base)
    // Only hers, only his, or a non-clinic kind: not a shared clinic day.
    expect(weekOptions(appt('2026-10-01', 'b'), TODAY, PARTNER)).toEqual(base)
    expect(weekOptions(appt('2026-10-01', 'a'), TODAY, PARTNER)).toEqual(base)
    expect(weekOptions(appt('2026-10-01', 'both', 'admin'), TODAY, PARTNER)).toEqual(base)
    expect(weekOptions(appt('2026-10-01', 'both', 'other'), TODAY, PARTNER)).toEqual(base)
    // A deleted one (tombstone) does not count.
    const gone = { ...both, appointments: both.appointments.map((a) => ({ ...a, deletedAt: stamp(MONDAY) })) }
    expect(weekOptions(gone, TODAY, PARTNER)).toEqual(base)
  })
})

describe('the 42-day quiet after a pregnancy ended', () => {
  const ended: ISODate = '2026-09-30'

  it('rests everything: no picks, no [했어요], no summary, no thanks', () => {
    let s = afterLoss(ended)
    expect(weekQuiet(s, TODAY)).toBe(true)
    expect(weekTogetherOn(s, TODAY)).toBe(false)
    expect(weekOptions(s, TODAY, PARTNER)).toEqual([])
    const id = weekOptions(fresh(), TODAY, PARTNER)[0]!.id
    expect(pickWeek(s, PARTNER, id, TODAY)).toBe(s)
    // A pick from before the loss can't be marked done in the quiet either.
    const before = pickWeek(fresh(), PARTNER, id, MONDAY)
    const lossAfterPick = backToPreparing(startPregnancy(before, '2026-08-01', '2026-09-05'), ended)
    expect(markWeekDone(lossAfterPick, PARTNER, TODAY)).toBe(lossAfterPick)
    // He did things this week — still nothing shown, nothing asked of her.
    s = toggleCheck(toggleCheck(s, PARTNER, '2026-10-01', 'walk'), PARTNER, '2026-10-02', 'walk')
    expect(partnerWeekSummary(s, TODAY, PARTNER)).toEqual([])
    expect(canThankWeek(s, OWNER, TODAY)).toBe(false)
    expect(thankWeek(s, OWNER, TODAY)).toBe(s)
    expect(thanksThisWeek({ ...s, decisions: { [weekThanksKey(MONDAY, OWNER)]: MONDAY } }, PARTNER, TODAY)).toBeUndefined()
  })

  it('stays quiet for the whole 42 days even if she turns the loss rest off, and comes back after', () => {
    const s = afterLoss(ended)
    const off = { ...s, restCycle: undefined }
    const day42 = addDays(ended, 41)
    expect(weekQuiet(off, day42)).toBe(true)
    expect(weekOptions(off, day42, PARTNER)).toEqual([])
    const day43 = addDays(ended, 42)
    expect(weekQuiet(s, day43)).toBe(false)
    expect(weekOptions(s, day43, PARTNER)).toHaveLength(WEEK_OPTION_COUNT)
  })

  it('a loss rest on its own (an older save) is the after-loss moment too', () => {
    const s = startLossRest(fresh(), '2026-09-29')
    expect(weekQuiet(s, TODAY)).toBe(true)
    expect(weekOptions(s, TODAY, PARTNER)).toEqual([])
  })
})

describe('pickWeek / markWeekDone / unmarkWeekDone', () => {
  it('records one pick per week; another pick before [했어요] replaces it; the same pick is a no-op', () => {
    const s0 = fresh()
    const [o1, o2] = weekOptions(s0, TODAY, PARTNER)
    const s1 = pickWeek(s0, PARTNER, o1!.id, '2026-09-29')
    expect(weekPick(s1, MONDAY, PARTNER)).toBe(o1)
    expect(s1.decisions[weekPickKey(MONDAY, PARTNER, o1!.id)]).toBe('2026-09-29')
    expect(pickWeek(s1, PARTNER, o1!.id, TODAY)).toBe(s1)
    const s2 = pickWeek(s1, PARTNER, o2!.id, TODAY)
    expect(weekPick(s2, MONDAY, PARTNER)).toBe(o2)
    expect(Object.keys(s2.decisions).filter((k) => k.startsWith('week-pick:'))).toEqual([weekPickKey(MONDAY, PARTNER, o2!.id)])
    // Next week starts fresh.
    expect(weekPick(s2, '2026-10-05', PARTNER)).toBeUndefined()
  })

  it('ignores a pick that is not offered this week, the cycle owner, and a pick after [했어요]', () => {
    const s0 = fresh()
    const offered = weekOptions(s0, TODAY, PARTNER).map((o) => o.id)
    const notOffered = WEEK_OPTIONS.find((o) => !offered.includes(o.id))!.id
    expect(pickWeek(s0, PARTNER, notOffered, TODAY)).toBe(s0)
    expect(pickWeek(s0, PARTNER, CLINIC_DAY_OPTION.id, TODAY)).toBe(s0)
    expect(pickWeek(s0, PARTNER, 'free text', TODAY)).toBe(s0)
    expect(pickWeek(s0, OWNER, offered[0]!, TODAY)).toBe(s0)
    const done = markWeekDone(pickWeek(s0, PARTNER, offered[0]!, MONDAY), PARTNER, '2026-10-01')
    expect(pickWeek(done, PARTNER, offered[1]!, TODAY)).toBe(done)
  })

  it('[했어요] needs a pick, keeps its first day, and can be taken back', () => {
    const s0 = fresh()
    expect(markWeekDone(s0, PARTNER, TODAY)).toBe(s0)
    const picked = pickWeek(s0, PARTNER, weekOptions(s0, TODAY, PARTNER)[0]!.id, MONDAY)
    const done = markWeekDone(picked, PARTNER, '2026-10-01')
    expect(weekDone(done, MONDAY, PARTNER)).toBe('2026-10-01')
    expect(markWeekDone(done, PARTNER, TODAY)).toBe(done)
    expect(markWeekDone(picked, OWNER, TODAY)).toBe(picked)
    const undone = unmarkWeekDone(done, PARTNER, TODAY)
    expect(weekDone(undone, MONDAY, PARTNER)).toBeUndefined()
    expect(weekPick(undone, MONDAY, PARTNER)).toEqual(weekPick(done, MONDAY, PARTNER))
    expect(unmarkWeekDone(undone, PARTNER, TODAY)).toBe(undone)
  })
})

describe('partnerWeekSummary: what her home shows of his week', () => {
  it('a week with nothing is empty — no line, no 0, no 안 했어요 (rule #2)', () => {
    expect(partnerWeekSummary(fresh(), TODAY, PARTNER)).toEqual([])
    // A pick he has not done yet is not shown at all (the pick itself stays his).
    const picked = pickWeek(fresh(), PARTNER, weekOptions(fresh(), TODAY, PARTNER)[0]!.id, MONDAY)
    expect(partnerWeekSummary(picked, TODAY, PARTNER)).toEqual([])
    // Last week's checks don't count this week.
    const lastWeek = toggleCheck(fresh(), PARTNER, '2026-09-27', 'walk')
    expect(partnerWeekSummary(lastWeek, TODAY, PARTNER)).toEqual([])
    // Her own checks are not his.
    expect(partnerWeekSummary(toggleCheck(fresh(), OWNER, '2026-10-01', 'folic'), TODAY, PARTNER)).toEqual([])
  })

  it('counts the daily check he kept most as ‘걷기 3일’ and a weekly one without its name', () => {
    let s = fresh()
    for (const d of ['2026-09-28', '2026-09-30', '2026-10-02']) s = toggleCheck(s, PARTNER, d, 'walk')
    s = toggleCheck(s, PARTNER, '2026-10-01', 'vit')
    s = toggleCheck(s, PARTNER, '2026-09-29', 'nodrink')
    expect(partnerWeekSummary(s, TODAY, PARTNER)).toEqual([
      { kind: 'daily', text: '걷기 3일', count: 3 },
      { kind: 'checkin', text: '체크인 했어요', count: 1 },
    ])
    // Only days up to today count.
    expect(partnerWeekSummary(s, '2026-09-29', PARTNER)).toEqual([
      { kind: 'daily', text: '걷기 1일', count: 1 },
      { kind: 'checkin', text: '체크인 했어요', count: 1 },
    ])
  })

  it('puts the meaningful things first and stops at three: [했어요] · 할 일 · 답장 · 걷기 · 체크인 · 신호', () => {
    let s = fresh()
    const pick = weekOptions(s, TODAY, PARTNER)[0]!
    s = pickWeek(s, PARTNER, pick.id, MONDAY)
    s = markWeekDone(s, PARTNER, '2026-10-01')
    s = setFertilityApplied(s, PARTNER, true, '2026-09-30', PARTNER)
    s = sendSignal(s, OWNER, PARTNER, 'comfort', '2026-09-30', stamp('2026-09-30', 20))
    s = sendSignal(s, PARTNER, OWNER, 'here', '2026-09-30', stamp('2026-09-30', 21))
    s = sendSignal(s, PARTNER, OWNER, 'rest', '2026-10-02', stamp('2026-10-02', 21))
    s = toggleCheck(s, PARTNER, '2026-10-02', 'walk')
    s = toggleCheck(s, PARTNER, '2026-10-02', 'nodrink')
    const all = partnerWeekSummary(s, TODAY, PARTNER)
    expect(all).toHaveLength(WEEK_SUMMARY_MAX)
    expect(all).toEqual([
      { kind: 'week-done', text: pick.doneText },
      { kind: 'task', text: '할 일 하나를 마쳤어요', count: 1 },
      { kind: 'reply', text: '신호에 답했어요', count: 1 },
    ])
    // Without the meaningful ones the light ones show (still three at most).
    let light = fresh()
    light = toggleCheck(light, PARTNER, '2026-10-02', 'walk')
    light = toggleCheck(light, PARTNER, '2026-10-02', 'nodrink')
    light = sendSignal(light, PARTNER, OWNER, 'rest', '2026-10-02', stamp('2026-10-02', 21))
    expect(partnerWeekSummary(light, TODAY, PARTNER).map((d) => d.kind)).toEqual(['daily', 'checkin', 'signal'])
  })

  it('counts his own 할 일 steps — not the claim checklist’s sub-items, not hers', () => {
    let s = setClaimDocDone(fresh(), PARTNER, 'receipt', true, '2026-09-30', PARTNER)
    expect(partnerWeekSummary(s, TODAY, PARTNER)).toEqual([])
    s = setFertilityApplied(s, OWNER, true, '2026-09-30', OWNER)
    expect(partnerWeekSummary(s, TODAY, PARTNER)).toEqual([])
    s = setFertilityApplied(s, PARTNER, true, '2026-09-30', PARTNER)
    expect(partnerWeekSummary(s, TODAY, PARTNER).map((d) => d.kind)).toEqual(['task'])
    // A 할 일 dated last week is not this week's.
    const old = setFertilityApplied(fresh(), PARTNER, true, '2026-09-20', PARTNER)
    expect(partnerWeekSummary(old, TODAY, PARTNER)).toEqual([])
  })

  it('never shows a zero or ‘안 했어요’ — 200 random weeks (seeded)', () => {
    let seed = 7
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    const pickOf = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
    for (let run = 0; run < 200; run++) {
      let s = fresh(`C${run}`)
      const today = addDays(MONDAY, Math.floor(rnd() * 7))
      const days = weekDaysSoFar(MONDAY, today)
      for (const d of [...days, '2026-09-26', '2026-09-27']) {
        if (rnd() < 0.3) s = toggleCheck(s, PARTNER, d, pickOf(['walk', 'vit', 'nodrink']))
        if (rnd() < 0.1) s = sendSignal(s, PARTNER, OWNER, pickOf(['here', 'rest', 'thanks', 'yes']), d, stamp(d, 20))
      }
      if (rnd() < 0.4) s = pickWeek(s, PARTNER, pickOf(weekOptions(s, today, PARTNER)).id, today)
      if (rnd() < 0.5) s = markWeekDone(s, PARTNER, today)
      const summary = partnerWeekSummary(s, today, PARTNER)
      expect(summary.length).toBeLessThanOrEqual(WEEK_SUMMARY_MAX)
      for (const d of summary) {
        expect(d.text, `run ${run}`).not.toMatch(/(^|\D)0(\D|$)|안 했|못 했|0일|0번/)
        if (d.count !== undefined) expect(d.count).toBeGreaterThanOrEqual(1)
      }
      // Thanks is possible exactly when there is something to thank for.
      expect(canThankWeek(s, OWNER, today)).toBe(summary.length > 0)
    }
  })

  it('shortCheckLabel drops the minutes', () => {
    expect(shortCheckLabel('걷기 30분')).toBe('걷기')
    expect(shortCheckLabel('운동 30분')).toBe('운동')
    expect(shortCheckLabel('30분 걷기·운동')).toBe('걷기·운동')
    expect(shortCheckLabel('먹던 영양제')).toBe('먹던 영양제')
    expect(shortCheckLabel('30분')).toBe('30분')
  })
})

describe('[고마워요]: once a week per giver, only for a week with something in it', () => {
  const active = () => toggleCheck(fresh(), PARTNER, '2026-10-01', 'walk')

  it('is offered only when he did something this week', () => {
    expect(canThankWeek(fresh(), OWNER, TODAY)).toBe(false)
    const s = fresh()
    expect(thankWeek(s, OWNER, TODAY)).toBe(s)
    expect(canThankWeek(active(), OWNER, TODAY)).toBe(true)
  })

  it('is remembered once for the week; his card keeps it the rest of the week; next week starts again', () => {
    const s = thankWeek(active(), OWNER, '2026-10-01')
    expect(weekThanked(s, OWNER, MONDAY)).toBe('2026-10-01')
    expect(canThankWeek(s, OWNER, TODAY)).toBe(false)
    expect(thankWeek(s, OWNER, TODAY)).toBe(s)
    // His card: '지은님이 고마워했어요 (목)' through Sunday.
    expect(thanksThisWeek(s, PARTNER, TODAY)).toEqual({ from: OWNER, day: '2026-10-01' })
    expect(thanksThisWeek(s, PARTNER, '2026-10-04')).toEqual({ from: OWNER, day: '2026-10-01' })
    // Not before it was said, not next week, and not on her own card.
    expect(thanksThisWeek(s, PARTNER, '2026-09-30')).toBeUndefined()
    expect(thanksThisWeek(s, PARTNER, '2026-10-05')).toBeUndefined()
    expect(thanksThisWeek(s, OWNER, TODAY)).toBeUndefined()
    // Next week: only once he does something again.
    const next = '2026-10-06'
    expect(canThankWeek(s, OWNER, next)).toBe(false)
    const again = toggleCheck(s, PARTNER, next, 'walk')
    expect(canThankWeek(again, OWNER, next)).toBe(true)
    expect(weekThanked(thankWeek(again, OWNER, next), OWNER, '2026-10-05')).toBe(next)
  })

  it('each giver has their own once a week (he may thank her for her week too)', () => {
    let s = toggleCheck(active(), OWNER, '2026-10-01', 'folic')
    s = thankWeek(s, OWNER, TODAY)
    expect(canThankWeek(s, PARTNER, TODAY)).toBe(true)
    s = thankWeek(s, PARTNER, TODAY)
    expect(thanksThisWeek(s, OWNER, TODAY)).toEqual({ from: PARTNER, day: TODAY })
    expect(thanksThisWeek(s, PARTNER, TODAY)).toEqual({ from: OWNER, day: TODAY })
  })
})
