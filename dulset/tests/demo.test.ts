import { describe, expect, it } from 'vitest'
import {
  dayLabel,
  homeAppointments,
  todaysAnniversaries,
  togetherDays,
  upcomingForToday,
  whoLabel,
  withTicked,
} from '@/components/today/model'
import { DATE_IDEAS } from '@/lib/content/dateIdeas'
import { ROADMAP } from '@/lib/content/roadmap'
import { addDays, addMonths, diffDays, isISODate, weekdayIndex } from '@/lib/dates'
import {
  DEMO_COUPLE_DAYS,
  DEMO_START_VIEWER,
  PREP_APPLIED_DAYS_AGO,
  PREP_APPOINTMENTS,
  applyPrefs,
  birthYearOptions,
  cleanBirthYear,
  coupleDatesNote,
  createDemoState,
  demoCoupleDays,
  defaultAlertStyles,
  defaultCycleOwner,
  displayName,
  doctorPlan,
  draftNames,
  draftOwner,
  draftOwnerBirthYear,
  draftRoles,
  draftStyles,
  draftToChoices,
  draftTtcStart,
  initialDraft,
  periodDateNote,
  sampleWindow,
  stateFromOnboarding,
  stepProblem,
  suggestPartnerRole,
  withRo,
  type OnboardingChoices,
} from '@/lib/demo'
import { nextAnniversaries } from '@/lib/logic/anniversary'
import { addAppointment, isValidTime, upcomingAppointments } from '@/lib/logic/appointments'
import { nextKoreanDay } from '@/lib/logic/baby'
import { CLAIM_KEY } from '@/lib/logic/babyView'
import { activeItems, coupleStreak, firstCheckedDate, isDone, itemsFor, progress, streak } from '@/lib/logic/checks'
import { cycleAt, cycleStats, dayInfo, fertilityStatus, isSurge, sortedStarts } from '@/lib/logic/cycle'
import { lhTestsOn } from '@/lib/logic/logs'
import { FERTILITY_TEST_ID, completeMonthlyTask, fertilityChain, monthlyTask } from '@/lib/logic/partnerTrack'
import { canLogCycle, canSeeCycleDetails, discreetFor, lowPressureFor } from '@/lib/logic/prefs'
import { inbox, scheduledNotices } from '@/lib/logic/notifications'
import { backToPreparing, gestationalAge } from '@/lib/logic/pregnancy'
import { buildItems, focusItems } from '@/lib/logic/roadmap'
import { sanitizeBackup } from '@/lib/logic/settings'
import { chapterContext, entryChapter, receivedReactions } from '@/lib/logic/usView'
import { isAppState, parseState } from '@/lib/storage'
import type { AppState, CheckItem, LHResult, Stage } from '@/lib/types'

const STAGES: Stage[] = ['preparing', 'pregnant', 'parenting']
const TODAYS = ['2026-09-26', '2026-01-31', '2026-02-28', '2028-02-29', '2026-03-01', '2026-12-31', '2027-01-01', '2026-04-30']
const NOW = new Date(2026, 8, 26, 14, 30)

/** Everything but random ids / invite code, for determinism checks. */
function fingerprint(s: AppState) {
  const label = new Map(s.checkItems.map((i) => [i.id, `${i.owner}:${i.label}`]))
  // Generated notice keys carry appointment / anniversary ids ('appt:<id>:…').
  const named = new Map<string, string>([
    ...s.anniversaries.map((a) => [a.id, `anniv=${a.title}`] as const),
    ...s.appointments.map((a) => [a.id, `appt=${a.title}`] as const),
    ...s.customTasks.map((c) => [c.id, `task=${c.title}`] as const),
  ])
  const unId = (key?: string) => (key === undefined ? key : [...named].reduce((k, [id, name]) => k.split(id).join(name), key))
  return {
    ...s,
    couple: { ...s.couple, inviteCode: '' },
    anniversaries: s.anniversaries.map(({ id: _id, ...rest }) => rest),
    appointments: s.appointments.map(({ id: _id, ...rest }) => rest),
    customTasks: s.customTasks.map(({ id: _id, ...rest }) => rest),
    checkItems: s.checkItems.map(({ id: _id, ...rest }) => rest),
    checkLog: Object.fromEntries(
      Object.entries(s.checkLog).map(([d, day]) => [
        d,
        Object.fromEntries(Object.entries(day).map(([m, ids]) => [m, (ids ?? []).map((id) => label.get(id)).sort()])),
      ]),
    ),
    notifications: s.notifications.map(({ id: _id, key, ...rest }) => ({ ...rest, key: unId(key) })),
    diary: s.diary.map(({ id: _id, ...rest }) => rest),
    datePlans: s.datePlans.map(({ id: _id, ...rest }) => rest),
    pregnancyTests: s.pregnancyTests.map(({ id: _id, ...rest }) => rest),
    growth: s.growth.map(({ id: _id, ...rest }) => rest),
  }
}

describe('createDemoState — every stage', () => {
  for (const stage of STAGES) {
    it(`${stage}: is a valid, JSON round-trippable state`, () => {
      const s = createDemoState('2026-09-26', NOW, stage)
      expect(isAppState(s)).toBe(true)
      expect(s.stage).toBe(stage)
      expect(s.onboarded).toBe(true)
      const raw = JSON.stringify(s)
      const parsed = parseState(raw)
      expect(parsed).not.toBeNull()
      expect(parsed).toEqual(JSON.parse(raw))
    })

    it(`${stage}: is deterministic apart from ids`, () => {
      const a = createDemoState('2026-09-26', NOW, stage)
      const b = createDemoState('2026-09-26', NOW, stage)
      expect(fingerprint(a)).toEqual(fingerprint(b))
    })

    it(`${stage}: has the demo couple and no future-dated records`, () => {
      const today = '2026-09-26'
      const s = createDemoState(today, NOW, stage)
      const [a, b] = s.couple.members
      expect(a).toMatchObject({ id: 'a', name: '민수', role: 'husband', birthYear: 1992, tracksCycle: false })
      expect(b).toMatchObject({ id: 'b', name: '지은', role: 'wife', birthYear: 1994, tracksCycle: true })
      expect(s.settings.alertStyle).toEqual({ a: 'soft', b: 'explicit' })
      expect(s.diary.every((e) => e.date <= today)).toBe(true)
      expect(s.periods.every((p) => p.start <= today)).toBe(true)
      expect(s.growth.every((g) => g.date <= today)).toBe(true)
      expect(Object.keys(s.checkLog).every((d) => d <= today)).toBe(true)
      expect(s.notifications.every((n) => n.createdAt.slice(0, 10) <= today)).toBe(true)
      // Items existed on every logged day, so history counts.
      const earliestLog = Object.keys(s.checkLog).sort()[0]!
      expect(s.checkItems.every((i) => i.createdAt <= earliestLog)).toBe(true)
    })
  }
})

describe('preparing demo', () => {
  for (const today of TODAYS) {
    it(`is fertile today and peak starts tomorrow (today=${today})`, () => {
      const s = createDemoState(today, NOW, 'preparing')
      const status = fertilityStatus(s, today)
      expect(status.kind).toBe('fertile')
      if (status.kind === 'fertile') expect(status.peak).toBe(false)
      const w = cycleAt(s, today)!
      expect(w.peakStart).toBe(addDays(today, 1))
      expect(w.ovulation).toBe(addDays(today, 3))
      expect(dayInfo(s, addDays(today, 1)).phase).toBe('peak')
      expect(dayInfo(s, today).phase).toBe('fertile')
      const stats = cycleStats(s.periods, s.cycle)
      expect(stats.average).toBe(28)
      expect(stats.irregular).toBe(false)
      expect(s.periods).toHaveLength(4)
    })
  }

  it('has a couple streak ending yesterday, 민수 half done and 지은 not started today', () => {
    const today = '2026-09-26'
    const s = createDemoState(today, NOW, 'preparing')
    expect(coupleStreak(s, today)).toBeGreaterThanOrEqual(2)
    expect(streak(s, 'a', today)).toBeGreaterThanOrEqual(2)
    const pa = progress(s, 'a', today)
    expect(pa.done).toBeGreaterThan(0)
    expect(pa.complete).toBe(false)
    expect(progress(s, 'b', today).done).toBe(0)
    const logged = Object.keys(s.checkLog).filter((d) => d >= addDays(today, -10) && d < today)
    expect(logged).toHaveLength(10)
  })

  it('sets ttcStart four months back and two date plans (one done, one in 2 days)', () => {
    const today = '2026-09-26'
    const s = createDemoState(today, NOW, 'preparing')
    expect(s.settings.ttcStart).toBe('2026-05-26')
    expect(s.datePlans).toHaveLength(2)
    expect(s.datePlans.some((p) => p.done && p.date < today)).toBe(true)
    expect(s.datePlans.some((p) => !p.done && p.date === addDays(today, 2))).toBe(true)
    // Linked ideas must exist in the catalogue.
    for (const p of s.datePlans) if (p.ideaId) expect(DATE_IDEAS.some((i) => i.id === p.ideaId)).toBe(true)
    // 준비 기록 since the start (the 우리 둘 memories before it are checked below).
    const entries = s.diary.filter((e) => e.stage === 'preparing' && e.date >= s.settings.ttcStart!)
    expect(entries.length).toBeGreaterThanOrEqual(3)
    expect(entries.length).toBeLessThanOrEqual(4)
  })

  it('has an unread nudge 지은→민수 and cheer 민수→지은 from today, plus today’s generated notices', () => {
    const today = '2026-09-26'
    const s = createDemoState(today, NOW, 'preparing')
    const nudge = inbox(s, 'a').find((n) => n.kind === 'nudge')
    expect(nudge).toMatchObject({ from: 'b', read: false })
    expect(nudge!.createdAt.startsWith(today)).toBe(true)
    const cheer = inbox(s, 'b').find((n) => n.kind === 'cheer' && !n.key)
    expect(cheer).toMatchObject({ from: 'a', read: false })
    expect(cheer!.createdAt.startsWith(today)).toBe(true)
    // Everything the rules want to say today has already been delivered.
    const keys = new Set(s.notifications.map((n) => n.key))
    const due = scheduledNotices(s, today)
    expect(due.length).toBeGreaterThan(0)
    expect(due.every((n) => keys.has(n.key))).toBe(true)
    // Soft wording for 민수, explicit for 지은.
    const fa = s.notifications.find((n) => n.to === 'a' && n.kind === 'fertile-start')!
    const fb = s.notifications.find((n) => n.to === 'b' && n.kind === 'fertile-start')!
    expect(fa.title).toContain('우리의 주간')
    expect(fb.body).toContain('예상')
  })

  it('pins timestamps to the given today even when the device clock differs', () => {
    const s = createDemoState('2027-01-01', NOW, 'preparing')
    // The space was "created" when the couple started (local-date prefixed).
    expect(s.createdAt.slice(0, 10)).toBe(s.settings.ttcStart)
    expect(s.couple.linkedAt!.slice(0, 10)).toBe(s.settings.ttcStart)
    expect(s.notifications.filter((n) => n.kind === 'nudge')[0]!.createdAt.startsWith('2027-01-01')).toBe(true)
  })

  it('nudges 민수 about the item he has not done yet', () => {
    const today = '2026-09-26'
    const s = createDemoState(today, NOW, 'preparing')
    const nudge = inbox(s, 'a').find((n) => n.kind === 'nudge')!
    expect(nudge.body).toContain('걷기')
  })
})

describe('preparing demo: the preconception model', () => {
  const today = '2026-09-26'
  const weekly = (i: Pick<CheckItem, 'cadence'>) => i.cadence === 'weekly'
  const mondayOf = (d: string) => addDays(d, -((weekdayIndex(d) + 6) % 7))

  it('opens on 지은’s screen: the person whose cycle it is', () => {
    const s = createDemoState(today, NOW, 'preparing')
    expect(s.couple.members.find((m) => m.id === DEMO_START_VIEWER)!.tracksCycle).toBe(true)
  })

  it('keeps cycle details with 지은 (shareCycleDetails off) — she logs everything herself', () => {
    const s = createDemoState(today, NOW, 'preparing')
    expect(s.settings.shareCycleDetails).toBe(false)
    expect(canSeeCycleDetails(s, 'b')).toBe(true)
    expect(canSeeCycleDetails(s, 'a')).toBe(false)
    expect(canLogCycle(s, 'b')).toBe(true)
    expect(canLogCycle(s, 'a')).toBe(false)
    expect(s.periods.every((p) => p.by === 'b')).toBe(true)
    expect(s.lhTests.every((t) => t.by === 'b')).toBe(true)
    expect(s.pregnancyTests.every((t) => t.by === 'b')).toBe(true)
    // Survives a reload and a backup file.
    expect(parseState(JSON.stringify(s))!.settings.shareCycleDetails).toBe(false)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(s)))!.settings.shareCycleDetails).toBe(false)
  })

  it('has each person’s own preferences: 민수 soft and discreet, 지은 plain', () => {
    const s = createDemoState(today, NOW, 'preparing')
    expect(s.settings.alertStyle).toEqual({ a: 'soft', b: 'explicit' })
    expect(discreetFor(s.settings, 'a')).toBe(true)
    expect(discreetFor(s.settings, 'b')).toBe(false)
    expect(lowPressureFor(s.settings, 'a')).toBe(false)
    expect(lowPressureFor(s.settings, 'b')).toBe(false)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(s)))!.settings.personal).toEqual(s.settings.personal)
  })

  for (const day of TODAYS) {
    it(`logs LH strips with times: earlier cycles rise 희미 → 양성 → 가장 진함, this one has no surge yet (today=${day})`, () => {
      const s = createDemoState(day, NOW, 'preparing')
      const [first, before, prev, last] = sortedStarts(s.periods)
      expect(first).toBeDefined()
      expect(s.lhTests.length).toBeGreaterThanOrEqual(10)
      for (const t of s.lhTests) {
        expect(t.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
        expect(t.date <= day).toBe(true)
        expect(lhTestsOn(s.lhTests, t.date).length).toBeLessThanOrEqual(2)
      }
      const inCycle = (from: string, to: string) =>
        s.lhTests
          .filter((t) => t.date >= from && t.date < to)
          .sort((x, y) => (x.date + x.time < y.date + y.time ? -1 : 1))
          .map((t) => t.result)
      const rising = (list: LHResult[]) => {
        const at = (r: LHResult) => list.indexOf(r)
        return at('faint') >= 0 && at('faint') < at('positive') && at('positive') < at('peak')
      }
      for (const [from, to] of [
        [before!, prev!],
        [prev!, last!],
      ] as const) {
        expect(rising(inCycle(from, to))).toBe(true)
        // The surge pins that finished cycle's ovulation.
        expect(cycleAt(s, from)!.basis).toBe('lh')
      }
      expect(cycleAt(s, prev!)!.ovulation).toBe(addDays(prev!, 13))
      expect(cycleAt(s, before!)!.ovulation).toBe(addDays(before!, 14))
      // This cycle: strips logged, still a calendar estimate (fertile today, peak tomorrow).
      const now = s.lhTests.filter((t) => t.date >= last!)
      expect(now.length).toBeGreaterThan(0)
      expect(now.some((t) => isSurge(t.result))).toBe(false)
      expect(cycleAt(s, day)!.basis).toBe('calendar')
      expect(s.lhTests.some((t) => t.date === day)).toBe(false) // today's strip is still to do
    })
  }

  it('has negative home tests in last cycle’s 기다리는 주, and no pending or rest state', () => {
    const s = createDemoState(today, NOW, 'preparing')
    const [, , prev, last] = sortedStarts(s.periods)
    const ovulation = cycleAt(s, prev!)!.ovulation
    expect(s.pregnancyTests).toHaveLength(2)
    for (const t of s.pregnancyTests) {
      expect(t.result).toBe('negative')
      expect(t.date > ovulation && t.date < last!).toBe(true)
      expect(t.time).toMatch(/^\d{2}:\d{2}$/)
    }
    // The early one came 11 days after ovulation; the retest the day before the period.
    expect(s.pregnancyTests.map((t) => diffDays(ovulation, t.date))).toEqual([11, 14])
    expect(s.positivePending).toBeUndefined()
    expect(s.restCycle).toBeUndefined()
  })

  for (const day of TODAYS) {
    it(`gives 민수 two daily habits and two weekly check-ins, once per week, open this week (today=${day})`, () => {
      const s = createDemoState(day, NOW, 'preparing')
      const mine = activeItems(s, 'a')
      expect(mine.filter((i) => !weekly(i)).map((i) => i.label)).toEqual(['30분 걷기·운동', '7시간 이상 자기'])
      // Named like the onboarding starter list (initial.defaultCheckItems with habits).
      expect(mine.filter(weekly).map((i) => i.label)).toEqual(['사우나·뜨거운 탕 쉬기', '금주'])
      expect(mine.filter(weekly).every((i) => i.note?.includes('주 1회 체크인'))).toBe(true)
      expect(mine.some((i) => i.label.includes('담배'))).toBe(false) // he doesn't smoke
      expect(activeItems(s, 'b').every((i) => !weekly(i))).toBe(true)
      const start = s.settings.ttcStart!
      const thisMonday = mondayOf(day)
      for (const item of mine.filter(weekly)) {
        const days = Object.keys(s.checkLog)
          .filter((d) => isDone(s, 'a', d, item.id))
          .sort()
        // At most once per Mon–Sun week…
        const weeks = days.map(mondayOf)
        expect(new Set(weeks).size).toBe(weeks.length)
        // …every week since they started, except this one (still open today).
        for (let w = mondayOf(start); w < thisMonday; w = addDays(w, 7)) expect(weeks).toContain(w)
        expect(weeks).not.toContain(thisMonday)
      }
    })
  }

  for (const day of TODAYS) {
    it(`gives 민수 the 정액검사 step of the 임신 사전건강관리 chain as this month’s task, with its deadline (today=${day})`, () => {
      const s = createDemoState(day, NOW, 'preparing')
      const applied = addDays(day, -PREP_APPLIED_DAYS_AGO)
      expect(fertilityChain(s, day)).toMatchObject({ step: 'test', appliedAt: applied, lapsed: false })
      const task = monthlyTask(s, day, 'a')!
      expect(task).toMatchObject({ step: 'test', title: '정액검사 받기', top: true, status: 'now', id: FERTILITY_TEST_ID })
      // 3 months from the application, counting that day as day 1.
      expect(task.dueBy).toBe(addDays(addMonths(applied, 3), -1))
      expect(task.dueText).toContain('검사 마감')
      expect(task.dueText).toContain('신청 후 3개월')
      // Booked inside the window.
      const semen = s.appointments.find((a) => a.taskId === FERTILITY_TEST_ID)!
      expect(semen.date > day && semen.date <= task.dueBy!).toBe(true)
      // 민수 hears the soft wording: no fertility words in his task.
      expect(`${task.title} ${task.dueText} ${task.why}`).not.toMatch(/가임|배란|LH/)
      // Doing it moves the chain on to 청구.
      const tested = completeMonthlyTask(s, task, day, 'a')
      expect(fertilityChain(tested, day).step).toBe('claim')
    })
  }

  it('dates every first check, so the timers count real days', () => {
    const s = createDemoState(today, NOW, 'preparing')
    const start = s.settings.ttcStart!
    // 민수's habits (the 3-month timer) and 지은's 엽산 were first checked the day they started.
    for (const item of activeItems(s, 'a')) expect(firstCheckedDate(s, 'a', item.id)).toBe(start)
    const folic = activeItems(s, 'b').find((i) => i.label === '엽산')!
    expect(firstCheckedDate(s, 'b', folic.id)).toBe(start)
    // Nothing is ever ticked before the item existed.
    for (const i of s.checkItems) {
      const first = firstCheckedDate(s, i.owner, i.id)
      if (first) expect(first >= i.createdAt).toBe(true)
    }
  })

  it('never makes a weekly check-in part of "done for the day"', () => {
    const s = createDemoState(today, NOW, 'preparing')
    // 민수 did both daily habits on each of the last three days, with or without a check-in.
    for (let back = 1; back <= 3; back++) {
      const d = addDays(today, -back)
      const daily = itemsFor(s, 'a', d).filter((i) => !weekly(i))
      expect(daily.every((i) => isDone(s, 'a', d, i.id))).toBe(true)
    }
  })
})

describe('pregnant demo', () => {
  for (const today of TODAYS) {
    it(`is 12 weeks today (today=${today})`, () => {
      const s = createDemoState(today, NOW, 'pregnant')
      const ga = gestationalAge(s.pregnancy!, today)
      expect(ga.weeks).toBe(12)
      expect(ga.days).toBe(3)
    })
  }

  it('keeps preparing history and has 태교일기 entries', () => {
    const s = createDemoState('2026-09-26', NOW, 'pregnant')
    expect(s.diary.filter((e) => e.stage === 'pregnant').length).toBeGreaterThanOrEqual(3)
    expect(s.diary.some((e) => e.stage === 'preparing')).toBe(true)
    expect(s.periods.at(-1)!.start).toBe(s.pregnancy!.lmp)
    expect(s.notifications.some((n) => n.key?.startsWith(`week:${s.pregnancy!.lmp}:12`))).toBe(true)
  })
})

describe('parenting demo', () => {
  for (const today of TODAYS) {
    it(`백일 is in 5 days (today=${today})`, () => {
      const s = createDemoState(today, NOW, 'parenting')
      const next = nextKoreanDay(s.baby!.birthDate, today)!
      expect(next.label).toBe('백일')
      expect(diffDays(today, next.date)).toBe(5)
    })
  }

  it('tells the whole story: growth, milestones, and entries from every stage', () => {
    const today = '2026-09-26'
    const s = createDemoState(today, NOW, 'parenting')
    expect(s.baby).toMatchObject({ name: '콩이' })
    expect(s.pregnancy).toBeDefined()
    expect(s.growth).toHaveLength(4)
    expect(s.growth[0]).toMatchObject({ date: s.baby!.birthDate, weightKg: 3.2, heightCm: 50 })
    const weights = s.growth.map((g) => g.weightKg!)
    expect([...weights].sort((x, y) => x - y)).toEqual(weights)
    expect(s.milestones.filter((m) => m.key.startsWith('ms:')).length).toBeGreaterThanOrEqual(2)
    expect(s.milestones.every((m) => m.date >= s.pregnancy!.lmp && m.date <= today)).toBe(true)
    for (const stage of STAGES) expect(s.diary.some((e) => e.stage === stage)).toBe(true)
  })
})

describe('demo check history', () => {
  for (const stage of STAGES) {
    it(`${stage}: only ticks items that counted on that day`, () => {
      const s = createDemoState('2026-09-26', NOW, stage)
      for (const [date, day] of Object.entries(s.checkLog)) {
        for (const m of ['a', 'b'] as const) {
          const allowed = new Set(itemsFor(s, m, date).map((i) => i.id))
          for (const id of day[m] ?? []) expect(allowed.has(id)).toBe(true)
        }
      }
    })

    it(`${stage}: couple streak ending yesterday, 민수 part-way today, 지은 not started`, () => {
      const today = '2026-09-26'
      const s = createDemoState(today, NOW, stage)
      expect(coupleStreak(s, today)).toBe(3)
      const pa = progress(s, 'a', today)
      expect(pa.done).toBeGreaterThan(0)
      expect(pa.complete).toBe(false)
      expect(progress(s, 'b', today).done).toBe(0)
    })
  }

  it('retires the sperm-health habit once pregnant, keeping its history', () => {
    const today = '2026-09-26'
    const prep = createDemoState(today, NOW, 'preparing')
    expect(activeItems(prep, 'a').some((i) => i.label.includes('사우나'))).toBe(true)
    for (const stage of ['pregnant', 'parenting'] as const) {
      const s = createDemoState(today, NOW, stage)
      const sauna = s.checkItems.find((i) => i.owner === 'a' && i.label.includes('사우나'))!
      expect(sauna.active).toBe(false)
      expect(sauna.archivedAt).toBe(s.pregnancy!.confirmedAt)
      expect(activeItems(s, 'a')).toHaveLength(3)
      expect(activeItems(s, 'b')).toHaveLength(4)
    }
    // Before the pregnancy it was part of 민수's days.
    const preg = createDemoState(today, NOW, 'pregnant')
    const sauna = preg.checkItems.find((i) => i.owner === 'a' && i.label.includes('사우나'))!
    expect(Object.values(preg.checkLog).some((d) => (d.a ?? []).includes(sauna.id))).toBe(true)
  })
})

describe('onboarding helpers', () => {
  it('suggests the opposite role and picks the cycle owner', () => {
    expect(suggestPartnerRole('wife')).toBe('husband')
    expect(suggestPartnerRole('husband')).toBe('wife')
    expect(suggestPartnerRole('partner')).toBe('partner')
    expect(defaultCycleOwner('wife', 'husband')).toBe('a')
    expect(defaultCycleOwner('husband', 'wife')).toBe('b')
    expect(defaultCycleOwner('partner', 'partner')).toBe('a')
    expect(defaultAlertStyles('b')).toEqual({ a: 'soft', b: 'explicit' })
  })

  it('falls back to the role label for empty names and validates birth years', () => {
    expect(displayName('  ', 'wife')).toBe('아내')
    expect(displayName(' 지은 ', 'wife')).toBe('지은')
    expect(cleanBirthYear(1959)).toBeUndefined()
    expect(cleanBirthYear(2009)).toBeUndefined()
    expect(cleanBirthYear(1994)).toBe(1994)
    const years = birthYearOptions()
    expect(years[0]).toBe(2008)
    expect(years.at(-1)).toBe(1960)
  })

  const choices: OnboardingChoices = {
    me: { name: '  ', role: 'husband', birthYear: 1990 },
    partner: { name: '지은', role: 'wife', birthYear: 1850 },
    cycleOwner: 'b',
    lastPeriodStart: '2026-09-10',
    cycleLength: 99,
    periodLength: 1,
    ttcStart: '2027-01-01',
    alertStyle: { a: 'off', b: 'explicit' },
    lowPressure: true,
  }

  it('builds a sanitized first state with the chosen alert styles', () => {
    const s = stateFromOnboarding(choices, '2026-09-26', NOW, 'ABC234')
    expect(isAppState(s)).toBe(true)
    expect(s.couple.members[0]).toMatchObject({ name: '남편', tracksCycle: false, birthYear: 1990 })
    expect(s.couple.members[1]).toMatchObject({ name: '지은', tracksCycle: true, birthYear: undefined })
    expect(s.cycle).toEqual({ cycleLength: 45, periodLength: 2 })
    expect(s.periods).toEqual([{ start: '2026-09-10' }])
    expect(s.settings.ttcStart).toBe('2026-09-26') // future → today
    expect(s.settings.alertStyle).toEqual({ a: 'off', b: 'explicit' })
    expect(s.settings.lowPressure).toBe(true)
    expect(s.couple.inviteCode).toBe('ABC234')
    expect(s.checkItems.every((i) => i.createdAt === '2026-09-26')).toBe(true)
  })

  it('stamps createdAt with the local date of `today`, even early in the morning', () => {
    const early = new Date(2026, 8, 26, 8, 0) // 08:00 local — still 9/25 in UTC for UTC+9
    const s = stateFromOnboarding(choices, '2026-09-26', early)
    expect(s.createdAt.slice(0, 10)).toBe('2026-09-26')
    expect(Date.parse(s.createdAt)).toBe(early.getTime())
    // Pinned ?today= wins over the device date.
    expect(stateFromOnboarding(choices, '2027-03-01', early).createdAt.slice(0, 10)).toBe('2027-03-01')
  })

  it('ignores a future last-period date', () => {
    const s = stateFromOnboarding({ ...choices, lastPeriodStart: '2026-10-01' }, '2026-09-26', NOW)
    expect(s.periods).toEqual([])
  })

  it('applyPrefs only touches notification settings', () => {
    const base = stateFromOnboarding(choices, '2026-09-26', NOW)
    const next = applyPrefs(base, { alertStyle: { a: 'soft', b: 'soft' }, lowPressure: false })
    expect(next.settings).toEqual({ ...base.settings, alertStyle: { a: 'soft', b: 'soft' }, lowPressure: false })
    expect(next.couple).toBe(base.couple)
  })

  it('drafts: suggested roles, owner and styles follow my role until chosen', () => {
    let d = initialDraft()
    expect(stepProblem(1, d, '2026-09-26')).toContain('역할')
    d = { ...d, myRole: 'husband', myName: '민수', partnerName: '지은' }
    expect(draftRoles(d)).toEqual({ a: 'husband', b: 'wife' })
    expect(draftOwner(d)).toBe('b')
    expect(draftStyles(d)).toEqual({ a: 'soft', b: 'explicit' })
    expect(stepProblem(1, d, '2026-09-26')).toBeNull()
    d = { ...d, partnerRole: 'partner' }
    expect(draftOwner(d)).toBe('a')
    d = { ...d, cycleOwner: 'b', alertStyle: { a: 'off' } }
    expect(draftStyles(d)).toEqual({ a: 'off', b: 'explicit' })
  })

  it('drafts: blocks same names, future dates and missing consent', () => {
    const today = '2026-09-26'
    const d = { ...initialDraft(), myRole: 'partner' as const }
    expect(draftNames(d)).toEqual({ a: '배우자', b: '배우자' })
    expect(stepProblem(1, d, today)).toContain('이름이 같아요')
    expect(stepProblem(2, { ...d, lastPeriodStart: '2026-09-27' }, today)).not.toBeNull()
    expect(stepProblem(2, { ...d, lastPeriodStart: '2026-09-27', periodUnknown: true }, today)).toBeNull()
    expect(stepProblem(2, { ...d, lastPeriodStart: '' }, today)).toBeNull()
    expect(stepProblem(3, { ...d, ttcMode: 'date', ttcDate: '' }, today)).not.toBeNull()
    expect(stepProblem(3, { ...d, ttcMode: 'date', ttcDate: '2026-03-01' }, today)).toBeNull()
    expect(stepProblem(5, d, today)).not.toBeNull()
    expect(stepProblem(5, { ...d, consent: true }, today)).toBeNull()
  })

  it('drafts: turn into onboarding choices', () => {
    const today = '2026-09-26'
    const d = {
      ...initialDraft(),
      myRole: 'wife' as const,
      myName: '지은',
      partnerName: '민수',
      lastPeriodStart: '2026-09-10',
      ttcMode: 'date' as const,
      ttcDate: '2026-06-01',
    }
    const c = draftToChoices(d, today)!
    expect(c.cycleOwner).toBe('a')
    expect(c.partner.role).toBe('husband')
    expect(c.lastPeriodStart).toBe('2026-09-10')
    expect(c.ttcStart).toBe('2026-06-01')
    expect(c.alertStyle).toEqual({ a: 'explicit', b: 'soft' })
    expect(draftToChoices({ ...d, periodUnknown: true }, today)!.lastPeriodStart).toBeUndefined()
    expect(draftToChoices({ ...d, ttcMode: 'now' }, today)!.ttcStart).toBe(today)
    expect(draftToChoices(initialDraft(), today)).toBeNull()
  })

  it('drafts: period and start dates must be recent enough', () => {
    const today = '2026-09-26'
    const d = { ...initialDraft(), myRole: 'wife' as const }
    expect(stepProblem(2, { ...d, lastPeriodStart: addDays(today, -365) }, today)).toBeNull()
    expect(stepProblem(2, { ...d, lastPeriodStart: addDays(today, -366) }, today)).toContain('1년')
    expect(stepProblem(2, { ...d, lastPeriodStart: addDays(today, -366), periodUnknown: true }, today)).toBeNull()
    expect(stepProblem(3, { ...d, ttcMode: 'date', ttcDate: '2016-09-26' }, today)).toBeNull()
    expect(stepProblem(3, { ...d, ttcMode: 'date', ttcDate: '2016-09-25' }, today)).toContain('10년')
    expect(stepProblem(3, { ...d, ttcMode: 'now', ttcDate: '2016-09-25' }, today)).toBeNull()
  })

  it('drafts: ttc start and the tracked person’s birth year', () => {
    const today = '2026-09-26'
    const d = { ...initialDraft(), myRole: 'husband' as const, myBirthYear: 1990, partnerBirthYear: 1989 }
    expect(draftOwnerBirthYear(d)).toBe(1989) // partner is the suggested '아내'
    expect(draftOwnerBirthYear({ ...d, cycleOwner: 'a' })).toBe(1990)
    expect(draftOwnerBirthYear({ ...d, partnerBirthYear: 1850 })).toBeUndefined()
    expect(draftTtcStart(d, today)).toBe(today)
    expect(draftTtcStart({ ...d, ttcMode: 'date', ttcDate: '2026-01-10' }, today)).toBe('2026-01-10')
    expect(draftTtcStart({ ...d, ttcMode: 'date', ttcDate: '2026-12-01' }, today)).toBe(today)
    expect(draftTtcStart({ ...d, ttcMode: 'date', ttcDate: '' }, today)).toBe(today)
  })

  it('notes a last-period date older than the average cycle (non-blocking)', () => {
    const today = '2026-09-26'
    expect(periodDateNote('', 28, today)).toBeNull()
    expect(periodDateNote('2026-10-01', 28, today)).toBeNull()
    expect(periodDateNote(addDays(today, -28), 28, today)).toBeNull() // today is the expected day
    expect(periodDateNote(addDays(today, -29), 28, today)).toContain('29일 전')
    expect(periodDateNote(addDays(today, -40), 45, today)).toBeNull()
    expect(periodDateNote(addDays(today, -400), 28, today)).toBeNull() // blocked by stepProblem instead
    // The note appears exactly when the app would call the period late.
    for (const ago of [28, 29, 35]) {
      const s = stateFromOnboarding(
        {
          me: { name: '지은', role: 'wife' },
          partner: { name: '민수', role: 'husband' },
          cycleOwner: 'a',
          lastPeriodStart: addDays(today, -ago),
          cycleLength: 28,
          alertStyle: { a: 'explicit', b: 'soft' },
          lowPressure: false,
        },
        today,
        NOW,
      )
      expect(fertilityStatus(s, today).kind === 'late').toBe(periodDateNote(addDays(today, -ago), 28, today) !== null)
    }
  })

  it('doctor plan mirrors the notification rule', () => {
    const today = '2026-09-26'
    expect(doctorPlan(undefined, today, today)).toEqual({ age: undefined, months: 12, elapsed: 0, due: false })
    expect(doctorPlan(1994, '2026-03-01', today)).toMatchObject({ age: 32, months: 12, elapsed: 6, due: false })
    expect(doctorPlan(1990, '2026-03-01', today)).toMatchObject({ age: 36, months: 6, due: true })
    expect(doctorPlan(1990, '2026-06-01', today)).toMatchObject({ months: 6, due: false })
    expect(doctorPlan(1985, today, today)).toMatchObject({ age: 41, months: 0, due: true })
    expect(doctorPlan(1994, '2025-08-01', today)).toMatchObject({ months: 12, due: true })
    // Same threshold the engine uses to send the 🩺 notice.
    const s = stateFromOnboarding(
      {
        me: { name: '민수', role: 'husband' },
        partner: { name: '지은', role: 'wife', birthYear: 1990 },
        cycleOwner: 'b',
        ttcStart: '2026-03-01',
        alertStyle: { a: 'soft', b: 'explicit' },
        lowPressure: false,
      },
      today,
      NOW,
    )
    expect(scheduledNotices(s, today).some((n) => n.kind === 'doctor')).toBe(doctorPlan(1990, '2026-03-01', today).due)
  })

  it('picks 로/으로', () => {
    expect(withRo('아내')).toBe('아내로')
    expect(withRo('남편')).toBe('남편으로')
    expect(withRo('서울')).toBe('서울로')
    expect(withRo('Jay')).toBe('Jay(으)로')
  })

  it('previews the next estimated window from a period date', () => {
    const w = sampleWindow('2026-09-20', 28, 5, '2026-09-26')!
    expect(w.fertileStart).toBe('2026-09-29')
    expect(w.fertileEnd).toBe('2026-10-04')
    expect(sampleWindow(undefined, 28, 5, '2026-09-26')).toBeNull()
    expect(sampleWindow('2026-10-01', 28, 5, '2026-09-26')).toBeNull()
  })
})

describe('demo 우리 둘 · 챙길 것', () => {
  const today = '2026-09-26'
  const templateIds = new Set(ROADMAP.map((t) => t.id))

  for (const stage of STAGES) {
    it(`${stage}: met / married days and two custom anniversaries`, () => {
      const s = createDemoState(today, NOW, stage)
      expect(s.couple.metDate).toBe('2021-05-14')
      expect(s.couple.marriedDate).toBe('2024-10-19')
      expect(s.anniversaries.map((a) => [a.title, a.date, a.yearly])).toEqual([
        ['첫 여행', '2021-10-03', true],
        ['프러포즈', '2024-03-09', true],
      ])
      for (const a of s.anniversaries) {
        expect(isISODate(a.date)).toBe(true)
        expect(a.date > s.couple.metDate! && a.date <= today).toBe(true)
      }
      expect(s.couple.marriedDate! < s.settings.ttcStart!).toBe(true)
    })

    it(`${stage}: the story starts before prep with 우리 둘 memories (and reactions)`, () => {
      const s = createDemoState(today, NOW, stage)
      const ctx = chapterContext(s)
      const couple = s.diary.filter((e) => entryChapter(e, ctx) === 'couple')
      expect(couple.map((e) => e.date)).toEqual(['2021-10-03', '2024-03-09', '2024-10-19'])
      for (const e of couple) {
        expect(e.date < s.settings.ttcStart!).toBe(true)
        // Written the evening they started 둘셋.
        expect(e.createdAt.slice(0, 10)).toBe(s.settings.ttcStart)
        expect(receivedReactions(e)).toHaveLength(1)
      }
      // The first 준비 기록 comes right after them.
      expect(s.diary.some((e) => e.date === s.settings.ttcStart && entryChapter(e, ctx) === 'preparing')).toBe(true)
    })

    it(`${stage}: appointments, ticks and custom tasks point at real things`, () => {
      const s = createDemoState(today, NOW, stage)
      const customIds = new Set(s.customTasks.map((c) => c.id))
      expect(s.appointments.length).toBeGreaterThanOrEqual(3)
      for (const a of s.appointments) {
        expect(isISODate(a.date)).toBe(true)
        expect(isValidTime(a.time)).toBe(true)
        expect(['a', 'b', 'both']).toContain(a.who)
        expect(['hospital', 'test', 'vaccine', 'admin', 'other']).toContain(a.kind)
        if (a.taskId) expect(templateIds.has(a.taskId) || customIds.has(a.taskId)).toBe(true)
        // Past visits are marked done; upcoming ones are open.
        expect(!!a.done).toBe(a.date < today)
      }
      expect(Object.keys(s.planDone).length).toBeGreaterThanOrEqual(3)
      for (const [id, v] of Object.entries(s.planDone)) {
        const t = ROADMAP.find((x) => x.id === id)
        expect(t).toBeDefined()
        // Templates with a shared milestone record their tick there, not in planDone.
        expect(t!.milestoneKey).toBeUndefined()
        expect(isISODate(v.at) && v.at <= today).toBe(true)
        expect(v.at >= s.settings.ttcStart!).toBe(true)
      }
      for (const c of s.customTasks) expect(c.due === undefined || isISODate(c.due)).toBe(true)
    })

    it(`${stage}: a backup round trip keeps 우리 둘 and 챙길 것`, () => {
      const s = createDemoState(today, NOW, stage)
      const json = JSON.parse(JSON.stringify(s)) as AppState
      const back = sanitizeBackup(json)!
      expect(back.couple.metDate).toBe(s.couple.metDate)
      expect(back.couple.marriedDate).toBe(s.couple.marriedDate)
      expect(back.anniversaries).toEqual(json.anniversaries)
      expect(back.appointments).toEqual(json.appointments)
      expect(back.planDone).toEqual(json.planDone)
      expect(back.customTasks).toEqual(json.customTasks)
      expect(back.milestones).toEqual(json.milestones)
      expect(back.diary.map((e) => e.reactions)).toEqual(json.diary.map((e) => e.reactions))
      expect(parseState(JSON.stringify(s))).toEqual(back)
    })
  }

  it('preparing: applied at 보건소 together, then 지은’s check, her dentist, 민수’s test, one task of their own', () => {
    const s = createDemoState(today, NOW, 'preparing')
    expect(upcomingAppointments(s.appointments, today).map((a) => [a.title, a.who, diffDays(today, a.date)])).toEqual([
      ['산부인과 임신 전 검사', 'b', 5],
      ['치과 검진·스케일링', 'b', 8],
      ['정액검사', 'a', 12],
    ])
    expect(Object.keys(s.planDone).sort()).toEqual(['pre-folic', 'pre-habits-partner', 'pre-health-check-support', 'pre-rubella'])
    // 임신 사전건강관리 is applied for at 보건소 *before* the test (no refund for a
    // test done first), and the test itself is at a clinic with the referral.
    const apply = s.appointments.find((a) => a.title === PREP_APPOINTMENTS.healthCenter)!
    expect(apply.kind).toBe('admin')
    expect(apply.who).toBe('both')
    expect(apply.done).toBe(true)
    expect(apply.taskId).toBe('pre-health-check-support')
    expect(apply.note).toContain('검사 전에')
    expect(apply.date).toBe(addDays(today, -PREP_APPLIED_DAYS_AGO))
    expect(s.planDone['pre-health-check-support']!.at).toBe(apply.date)
    const [carrier, , semen] = upcomingAppointments(s.appointments, today)
    for (const test of [carrier!, semen!]) {
      expect(test.date > apply.date).toBe(true)
      expect(test.place).not.toContain('보건소')
      expect(test.note).toContain('검사의뢰서')
    }
    expect(semen!.taskId).toBe('pre-checkup-partner')
    expect(carrier!.taskId).toBe('pre-checkup-carrier')
    // No fertility words in what 민수 (soft wording) sees on his home.
    for (const a of s.appointments) expect(`${a.title} ${a.note ?? ''}`).not.toMatch(/가임|배란|LH/)
    // MMR needs 4 weeks before trying: 풍진 is ticked as handled by the day they
    // started, never while they were already trying.
    expect(s.planDone['pre-rubella']!.at <= s.settings.ttcStart!).toBe(true)
    expect(s.customTasks).toHaveLength(1)
    // Preconception items have no dates, so this week's list is their own task.
    const focus = focusItems(buildItems(s, ROADMAP, today))
    expect(focus.map((i) => i.title)).toEqual(['검사 결과지 한곳에 모아 두기'])
    // 첫 여행 5주년 is a week away: both got the heads-up today.
    const notes = s.notifications.filter((n) => n.key?.startsWith('anniv:custom:'))
    expect(notes.map((n) => [n.to, n.title, n.read])).toEqual([
      ['a', '✈️ 첫 여행 5주년까지 일주일', false],
      ['b', '✈️ 첫 여행 5주년까지 일주일', false],
    ])
    expect(nextAnniversaries(s.couple, s.anniversaries, today, 2).map((e) => e.title)).toEqual(['첫 여행 5주년', '결혼 2주년'])
  })

  for (const day of TODAYS) {
    it(`pregnant: NT and 정밀초음파 are booked inside their windows (today=${day})`, () => {
      const s = createDemoState(day, NOW, 'pregnant')
      const items = new Map(buildItems(s, ROADMAP, day).map((i) => [i.id, i]))
      const open = s.appointments.filter((a) => a.taskId && !a.done)
      expect(open.length).toBeGreaterThanOrEqual(3)
      for (const a of open) {
        const it = items.get(a.taskId!)!
        expect(it.start).toBeDefined()
        expect(a.date >= it.start! && (!it.end || a.date <= it.end)).toBe(true)
      }
      const nt = s.appointments.find((a) => a.taskId === 'p1-nt')!
      expect(gestationalAge(s.pregnancy!, nt.date)).toMatchObject({ weeks: 12, days: 5 })
      const anatomy = s.appointments.find((a) => a.taskId === 'p2-anatomy')!
      expect(gestationalAge(s.pregnancy!, anatomy.date)).toMatchObject({ weeks: 21, days: 0 })
    })
  }

  it('pregnant: first-trimester items done, NT and 조리원 up next', () => {
    const s = createDemoState(today, NOW, 'pregnant')
    const items = buildItems(s, ROADMAP, today)
    const done = items.filter((i) => i.status === 'done').map((i) => i.id)
    expect(done).toEqual(
      expect.arrayContaining(['pre-folic', 'p1-first-visit', 'p1-voucher', 'p1-health-center', 'p1-prenatal-labs', 'p1-care-center']),
    )
    expect(upcomingForToday(s.appointments, today).map((a) => a.title)).toEqual(['정기검진 · NT 초음파', '산후조리원 상담'])
    expect(focusItems(items).map((i) => i.id)).toContain('p1-nt')
  })

  it('parenting: every 출산 직후 item done, 4개월 visits booked', () => {
    const s = createDemoState(today, NOW, 'parenting')
    const items = buildItems(s, ROADMAP, today)
    const birthItems = items.filter((i) => i.phase === 'birth')
    expect(birthItems.length).toBeGreaterThanOrEqual(5)
    expect(birthItems.filter((i) => i.status !== 'done').map((i) => i.id)).toEqual([])
    expect(s.milestones.some((m) => m.key === CLAIM_KEY)).toBe(true)
    expect(items.find((i) => i.id === 'pp-infant-checkup-1')!.status).toBe('done')
    const up = upcomingAppointments(s.appointments, today)
    expect(up.map((a) => a.title)).toEqual(['회사 면담 · 육아휴직 신청', '4개월 예방접종', '영유아 건강검진 2차'])
    expect(up[1]!.date).toBe(addMonths(s.baby!.birthDate, 4))
    expect(s.appointments.filter((a) => a.done).map((a) => a.title)).toEqual(
      expect.arrayContaining(['첫 산부인과 진료', '2개월 예방접종']),
    )
    // Ticks from the pregnancy stay with it.
    expect(items.filter((i) => i.phase === 'pregnancy-3rd' && i.status === 'done').length).toBeGreaterThanOrEqual(5)
  })

  it('moves the couple days back whole years when a pinned today is early', () => {
    expect(demoCoupleDays('2026-01-01')).toEqual(DEMO_COUPLE_DAYS)
    expect(demoCoupleDays('2024-10-20')).toEqual(DEMO_COUPLE_DAYS)
    expect(demoCoupleDays('2024-10-19')).toEqual({
      met: '2020-05-14',
      firstTrip: '2020-10-03',
      proposal: '2023-03-09',
      married: '2023-10-19',
    })
    for (const stage of STAGES) {
      const day = '2025-03-01'
      const s = createDemoState(day, NOW, stage)
      expect(s.couple.marriedDate! < s.settings.ttcStart!).toBe(true)
      expect(s.couple.metDate! < s.couple.marriedDate!).toBe(true)
      expect(s.diary.every((e) => e.date <= day)).toBe(true)
      expect(s.anniversaries.every((a) => a.date <= day)).toBe(true)
    }
  })
})

describe('오늘 · 우리 둘 / 챙길 것 cards', () => {
  const today = '2026-09-26'

  it('counts 함께한 지 from the day they met (day 1) and only for a past date', () => {
    expect(togetherDays({ metDate: '2026-09-26' }, today)).toBe(1)
    expect(togetherDays({ metDate: '2026-06-19' }, today)).toBe(100)
    expect(togetherDays({ metDate: '2026-09-27' }, today)).toBeNull()
    expect(togetherDays({}, today)).toBeNull()
    const s = createDemoState(today, NOW, 'preparing')
    expect(togetherDays(s.couple, today)).toBe(diffDays('2021-05-14', today) + 1)
  })

  it('shows the anniversary banner only on the day', () => {
    expect(todaysAnniversaries({ couple: { members: [] as never, inviteCode: '', metDate: '2026-06-19' }, anniversaries: [] }, today).map((e) => e.title)).toEqual([
      '만난 지 100일',
    ])
    const s = createDemoState('2026-10-03', NOW, 'preparing')
    expect(todaysAnniversaries(s, '2026-10-03').map((e) => e.title)).toEqual(['첫 여행 5주년'])
    expect(todaysAnniversaries(s, '2026-10-02')).toEqual([])
    expect(todaysAnniversaries(createDemoState('2026-10-19', NOW, 'parenting'), '2026-10-19').map((e) => e.title)).toEqual([
      '결혼 2주년',
    ])
  })

  it('lists the next two appointments within two weeks, with 오늘/내일/D-N and who goes', () => {
    const s = createDemoState(today, NOW, 'preparing')
    expect(upcomingForToday(s.appointments, today).map((a) => a.title)).toEqual(['산부인과 임신 전 검사', '치과 검진·스케일링'])
    // Two weeks later everything booked has passed.
    expect(upcomingForToday(s.appointments, addDays(today, 13)).map((a) => a.title)).toEqual([])
    expect(dayLabel(today, today)).toBe('오늘')
    expect(dayLabel(addDays(today, 1), today)).toBe('내일')
    expect(dayLabel(addDays(today, 3), today)).toBe('D-3')
    const members = s.couple.members
    expect(whoLabel('both', members, 'a')).toBe('둘이 함께')
    expect(whoLabel('a', members, 'a')).toBe('나')
    expect(whoLabel('b', members, 'a')).toBe('지은')
  })

  it('keeps a pregnancy’s visits off the home screen after going back to preparing', () => {
    const pregnant = createDemoState(today, NOW, 'pregnant')
    // While pregnant everything booked shows.
    expect(homeAppointments(pregnant)).toBe(pregnant.appointments)
    expect(upcomingForToday(homeAppointments(pregnant), today).map((a) => a.title)).toEqual([
      '정기검진 · NT 초음파',
      '산후조리원 상담',
    ])
    // After a loss: NT / 조리원 / 정밀초음파 stay in 챙길 것 but not on 오늘.
    let s = backToPreparing(pregnant, today)
    expect(upcomingForToday(homeAppointments(s), today)).toEqual([])
    // A visit of their own (or a preconception one) still shows.
    s = addAppointment(s, { date: addDays(today, 5), title: '산부인과 진료', who: 'b', kind: 'hospital' }, 'b')
    s = addAppointment(
      s,
      { date: addDays(today, 6), title: '치과', who: 'b', kind: 'hospital', taskId: 'pre-dental' },
      'b',
    )
    expect(upcomingForToday(homeAppointments(s), today).map((a) => a.title)).toEqual(['산부인과 진료', '치과'])
    expect(s.appointments.length).toBe(pregnant.appointments.length + 2)
  })

  it('still shows birth-day visits while preparing for a second child', () => {
    const parenting = createDemoState(today, NOW, 'parenting')
    let s: AppState = { ...parenting, stage: 'preparing' }
    s = addAppointment(
      s,
      { date: addDays(today, 3), title: '배우자 출산휴가 면담', who: 'a', kind: 'admin', taskId: 'birth-partner-leave' },
      'a',
    )
    s = addAppointment(s, { date: addDays(today, 4), title: '정밀초음파', who: 'both', kind: 'test', taskId: 'p2-anatomy' }, 'a')
    const titles = homeAppointments(s).map((a) => a.title)
    expect(titles).toContain('배우자 출산휴가 면담')
    expect(titles).not.toContain('정밀초음파')
    // …but not the birth-day ones of a pregnancy that ended without a birth.
    const ended = backToPreparing(
      addAppointment(
        createDemoState(today, NOW, 'pregnant'),
        { date: addDays(today, 3), title: '배우자 출산휴가 면담', who: 'a', kind: 'admin', taskId: 'birth-partner-leave' },
        'a',
      ),
      today,
    )
    expect(homeAppointments(ended).map((a) => a.title)).not.toContain('배우자 출산휴가 면담')
  })

  it('keeps rows ticked on the card in place (as done) until the tab is left', () => {
    const x = { id: 'x', status: 'now' }
    const y = { id: 'y', status: 'soon' }
    const z = { id: 'z', status: 'done' }
    const w = { id: 'w', status: 'now' }
    const items = [x, y, z, w]
    expect(withTicked([x, y], items, [{ id: 'z', index: 0 }]).map((r) => r.id)).toEqual(['z', 'x', 'y'])
    expect(withTicked([x, y], items, [{ id: 'z', index: 9 }]).map((r) => r.id)).toEqual(['x', 'y', 'z'])
    // Still in focus (e.g. un-ticked again) or not done: nothing extra.
    expect(withTicked([x, y], items, [{ id: 'x', index: 1 }, { id: 'w', index: 0 }]).map((r) => r.id)).toEqual(['x', 'y'])
  })
})

describe('onboarding: 우리의 날', () => {
  const today = '2026-09-26'
  const base = { ...initialDraft(), myRole: 'husband' as const, myName: '민수', partnerName: '지은' }

  it('is optional, but an entered day must be real and not in the future', () => {
    expect(base.metDate).toBe('')
    expect(stepProblem(1, base, today)).toBeNull()
    expect(stepProblem(1, { ...base, metDate: '2021-05-14', marriedDate: '2024-10-19' }, today)).toBeNull()
    expect(stepProblem(1, { ...base, metDate: today }, today)).toBeNull()
    expect(stepProblem(1, { ...base, metDate: '2026-09-27' }, today)).toBe('처음 만난 날은 오늘까지의 날짜로 넣어 주세요.')
    expect(stepProblem(1, { ...base, marriedDate: '1949-12-31' }, today)).toBe('결혼한 날을 한 번 더 확인해 주세요.')
    expect(stepProblem(1, { ...base, marriedDate: '2026-02-30' }, today)).toContain('확인')
    // Names come first.
    expect(stepProblem(1, { ...initialDraft(), metDate: '2030-01-01' }, today)).toContain('역할')
  })

  it('notes (without blocking) a wedding before the day they met', () => {
    expect(coupleDatesNote({ metDate: '2024-10-19', marriedDate: '2021-05-14' }, today)).toContain('앞서요')
    expect(coupleDatesNote({ metDate: '2021-05-14', marriedDate: '2024-10-19' }, today)).toBeNull()
    expect(coupleDatesNote({ metDate: '2021-05-14', marriedDate: '' }, today)).toBeNull()
  })

  it('saves the days on the first state (and nothing when skipped)', () => {
    const c = draftToChoices({ ...base, metDate: '2021-05-14', marriedDate: '' }, today)!
    expect(c.metDate).toBe('2021-05-14')
    expect(c.marriedDate).toBeUndefined()
    const s = stateFromOnboarding(c, today, NOW)
    expect(isAppState(s)).toBe(true)
    expect(s.couple.metDate).toBe('2021-05-14')
    expect('marriedDate' in s.couple).toBe(false)
    const both = stateFromOnboarding({ ...c, marriedDate: '2024-10-19' }, today, NOW, 'ABC234')
    expect(both.couple).toMatchObject({ metDate: '2021-05-14', marriedDate: '2024-10-19', inviteCode: 'ABC234' })
    const skipped = stateFromOnboarding(draftToChoices(base, today)!, today, NOW)
    expect('metDate' in skipped.couple || 'marriedDate' in skipped.couple).toBe(false)
    // Sanitized again at save time.
    const bad = stateFromOnboarding({ ...c, metDate: '2027-01-01', marriedDate: 'nope' }, today, NOW)
    expect(bad.couple.metDate).toBeUndefined()
    expect(bad.couple.marriedDate).toBeUndefined()
  })
})
