import { describe, expect, it } from 'vitest'
import { DATE_IDEAS } from '@/lib/content/dateIdeas'
import { addDays, diffDays } from '@/lib/dates'
import {
  applyPrefs,
  birthYearOptions,
  cleanBirthYear,
  createDemoState,
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
import { nextKoreanDay } from '@/lib/logic/baby'
import { activeItems, coupleStreak, itemsFor, progress, streak } from '@/lib/logic/checks'
import { cycleAt, cycleStats, dayInfo, fertilityStatus } from '@/lib/logic/cycle'
import { inbox, scheduledNotices } from '@/lib/logic/notifications'
import { gestationalAge } from '@/lib/logic/pregnancy'
import { isAppState, parseState } from '@/lib/storage'
import type { AppState, Stage } from '@/lib/types'

const STAGES: Stage[] = ['preparing', 'pregnant', 'parenting']
const TODAYS = ['2026-09-26', '2026-01-31', '2026-02-28', '2028-02-29', '2026-03-01', '2026-12-31', '2027-01-01', '2026-04-30']
const NOW = new Date(2026, 8, 26, 14, 30)

/** Everything but random ids / invite code, for determinism checks. */
function fingerprint(s: AppState) {
  const label = new Map(s.checkItems.map((i) => [i.id, `${i.owner}:${i.label}`]))
  return {
    ...s,
    couple: { ...s.couple, inviteCode: '' },
    checkItems: s.checkItems.map(({ id: _id, ...rest }) => rest),
    checkLog: Object.fromEntries(
      Object.entries(s.checkLog).map(([d, day]) => [
        d,
        Object.fromEntries(Object.entries(day).map(([m, ids]) => [m, (ids ?? []).map((id) => label.get(id)).sort()])),
      ]),
    ),
    notifications: s.notifications.map(({ id: _id, ...rest }) => rest),
    diary: s.diary.map(({ id: _id, ...rest }) => rest),
    datePlans: s.datePlans.map(({ id: _id, ...rest }) => rest),
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
    const entries = s.diary.filter((e) => e.stage === 'preparing')
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
