import { describe, expect, it } from 'vitest'
import { DATE_IDEAS } from '@/lib/content/dateIdeas'
import { addDays, range } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { createInitialState } from '@/lib/initial'
import { setCoupleDates } from '@/lib/logic/anniversary'
import { addAppointment } from '@/lib/logic/appointments'
import { activeItems, addCheckItem, isDone, nudgeableItem, toggleCheck, weeklyDone } from '@/lib/logic/checks'
import { startClinicMode } from '@/lib/logic/clinic'
import { coverView, setCover } from '@/lib/logic/cover'
import { fertileHintsAllowed, pickIdeas, recentlyPlannedIdeaIds } from '@/lib/logic/dateIdeas'
import { addEntry } from '@/lib/logic/diary'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { canNudge, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { FERTILITY_TEST_ID, completeMonthlyTask, monthlyTask, setFertilityApplied } from '@/lib/logic/partnerTrack'
import {
  LINK_DATE_IDEAS,
  PARTNER_SNAPSHOT_VERSION,
  SNAPSHOT_VALID_DAYS,
  buildPartnerSnapshot,
  linkIdeas,
  linkState,
  snapshotUsable,
  type PartnerSnapshot,
} from '@/lib/logic/partnerSnapshot'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { coverOnLink, setPersonalPref, setShareCycleDetails } from '@/lib/logic/prefs'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, sendSignal, signalsFor, signalsSentToday } from '@/lib/logic/signals'
import { rowProgress } from '@/lib/logic/today'
import { startLossRest, startRestCycle } from '@/lib/logic/ttc'
import {
  VEIL_COPY,
  cycleStrip,
  skipTellPartnerPeriod,
  tellPartnerBleeding,
  tellPartnerPeriod,
  tellPartnerPositive,
  ttcMoment,
  type Moment,
} from '@/lib/logic/ttcFlow'
import { addTreatment } from '@/lib/logic/treatments'
import type { AlertStyle, AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner). Three 28-day cycles, then the
// period 2026-09-01: window 09-10…09-15, peak 09-13…09-15, next period 09-29.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const NOW = '2026-09-01T09:00:00+09:00'
const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
const stamp = (day: ISODate, hour = 9) => `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`

// ── Owner-only markers the link must never carry ────────────
const PRIVATE_LINE = 'PRIVATE_LINE_9f3a'
const SECRET_ENTRY = 'SECRET_ENTRY_7c21'
const TREATMENT_NOTE = 'TREATMENT_NOTE_4e88'
const APPT_NOTE = 'APPT_NOTE_5d1c'
const HIS_APPT_NOTE = 'HIS_NOTE_2b7e'
const OWNER_ITEM = 'OWNER_ITEM_8a2f'
const LH_TIME = '06:17'
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야|진단|무월경|유산|자궁외|착상|성공률|정확한 배란|확률/
const FERTILE = /가임기|배란|LH|가능성 높/
/** State keys and model fields that must never appear as JSON keys or words. */
const FORBIDDEN_KEYS = [
  'intimacy',
  'personalLog',
  'bleedingSince',
  'positivePending',
  'lhTests',
  'pregnancyTests',
  '"periods"',
  'restCycle',
  'cycleNotes',
  'treatments',
  'leaveDays',
  'metDate',
  'marriedDate',
  'birthYear',
  'inviteCode',
  'linkedAt',
  'cycleDay',
  'cycleStart',
  'testDate',
  'daysLate',
  'todayLH',
  'retest',
  'todayFeel',
  'lastFeels',
  'guidance',
  'askTell',
  'offerTell',
  '"due"',
  'ovulation',
  '"peak"',
  'peakLabel',
  'confidenceLabel',
  'notifications',
  'checkLog',
  'datePlans',
  '"diary"',
  '"sync"',
]

function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-06-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, periods: REGULAR, ...over }
}

const withStyle = (s: AppState, member: MemberId, style: AlertStyle): AppState => ({
  ...s,
  settings: { ...s.settings, alertStyle: { ...s.settings.alertStyle, [member]: style } },
})
const share = (s: AppState): AppState => setShareCycleDetails(s, OWNER, true)
/** `settings.coverOnLink` is not in the types yet (the sync model adds it): set it the way an older save would carry it. */
const withCoverOnLink = (s: AppState, on: boolean): AppState => ({ ...s, settings: { ...s.settings, ...({ coverOnLink: on } as object) } })

/**
 * Everything owner-only, with markers: her chips and private lines, a '나만
 * 보기' entry, 관계일, a treatment note, her appointment note, LH strips with
 * times, her own check item — plus his chain (applied 08-24, test booked
 * 09-25 with a note of his own), the cover and the met day.
 */
function filled(base: AppState = fresh()): AppState {
  let s = base
  for (const d of ['2026-09-03', '2026-09-12', '2026-09-20', '2026-09-26']) {
    s = setFeel(s, OWNER, d, 'tired')
    s = setPrivateNote(s, OWNER, d, PRIVATE_LINE)
  }
  s = addEntry(s, { id: 'secret', date: '2026-09-10', author: OWNER, text: SECRET_ENTRY }, stamp('2026-09-10', 20))
  s = setEntryPrivacy(s, 'secret', OWNER, true)
  s = addEntry(s, { id: 'shared', date: '2026-09-10', author: PARTNER, text: '산책했어요' }, stamp('2026-09-10', 21))
  s = giveIntimacyConsent(s, OWNER, '2026-09-01')
  for (const d of ['2026-09-10', '2026-09-12', '2026-09-14']) s = toggleIntimacyDay(s, OWNER, d)
  s = addTreatment(s, {
    id: 't1',
    kind: 'iui',
    startDate: '2026-08-10',
    endDate: '2026-08-25',
    outcome: 'negative',
    supported: true,
    note: TREATMENT_NOTE,
  })
  s = addAppointment(
    s,
    { date: '2026-09-05', time: '09:30', title: '검사', place: '○○병원', who: OWNER, kind: 'test', note: APPT_NOTE },
    OWNER,
  )
  for (const [d, result] of [
    ['2026-09-11', 'faint'],
    ['2026-09-12', 'positive'],
    ['2026-09-13', 'peak'],
  ] as const) {
    s = addLHTest(s, { date: d, result, time: LH_TIME, by: OWNER }, '2026-09-30')
  }
  s = addCheckItem(s, OWNER, OWNER_ITEM, 'medication', '2026-08-01', '아침')
  s = addCheckItem(s, PARTNER, '30분 걷기', 'habit', '2026-08-01')
  s = addCheckItem(s, PARTNER, '금주', 'habit', '2026-08-01', '주 1회', 'weekly')
  s = setFertilityApplied(s, PARTNER, true, '2026-08-24')
  s = addAppointment(
    s,
    {
      date: '2026-09-25',
      time: '10:00',
      title: '정액검사',
      place: '보건소',
      who: PARTNER,
      kind: 'test',
      note: HIS_APPT_NOTE,
      taskId: FERTILITY_TEST_ID,
    },
    PARTNER,
  )
  s = setCover(s, { photoId: 'builtin:test', focusY: 40, caption: '우리 둘' }, OWNER, '2026-08-20')
  s = setCoupleDates(s, { metDate: '2021-05-14' })
  return s
}

interface Scenario {
  name: string
  day: ISODate
  state: AppState
  /** She told him (a period, a positive test, bleeding). */
  told?: boolean
}

/** Every moment kind the partner card can meet, each from the same filled state. */
function scenarios(): Scenario[] {
  const s = filled()
  const positive = addPregnancyTest(s, { id: 'pos', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-27').state
  const bleeding = markBleeding(positive, '2026-09-27')
  const endedPregnancy: AppState = {
    ...filled(fresh({ periods: [{ start: '2026-04-03' }, { start: '2026-05-01' }] })),
    pregnancy: { lmp: '2026-05-01', confirmedAt: '2026-06-10', endedAt: '2026-07-01' },
  }
  return [
    { name: 'no-data', day: '2026-09-05', state: filled(fresh({ periods: [] })) },
    { name: 'paused (pregnancy ended, quiet over)', day: '2026-09-20', state: endedPregnancy },
    { name: 'after-loss (quiet)', day: '2026-07-10', state: endedPregnancy },
    { name: 'after-loss (loss rest)', day: '2026-07-20', state: startLossRest(endedPregnancy, '2026-07-01') },
    { name: 'period-early (ask)', day: '2026-09-02', state: s },
    { name: 'period-early (told)', day: '2026-09-02', state: tellPartnerPeriod(s, '2026-09-01', NOW), told: true },
    { name: 'period (answered)', day: '2026-09-04', state: skipTellPartnerPeriod(s, '2026-09-01', NOW) },
    { name: 'before-fertile (far)', day: '2026-09-06', state: s },
    { name: 'before-fertile (soon)', day: '2026-09-08', state: s },
    { name: 'fertile', day: '2026-09-11', state: s },
    { name: 'fertile (peak)', day: '2026-09-14', state: s },
    { name: 'tww', day: '2026-09-20', state: s },
    { name: 'tww (test day)', day: '2026-09-29', state: s },
    { name: 'late', day: '2026-10-02', state: s },
    { name: 'late (long)', day: '2026-10-20', state: s },
    { name: 'positive-pending (untold)', day: '2026-09-27', state: positive },
    { name: 'positive-pending (told)', day: '2026-09-27', state: tellPartnerPositive(positive, stamp('2026-09-26')), told: true },
    { name: 'positive-bleeding (untold)', day: '2026-09-28', state: bleeding },
    { name: 'positive-bleeding (told)', day: '2026-09-28', state: tellPartnerBleeding(bleeding, stamp('2026-09-27')), told: true },
    { name: 'rest', day: '2026-09-11', state: startRestCycle(s, '2026-09-05', 'rest') },
    { name: 'rest (vaccine)', day: '2026-09-11', state: startRestCycle(s, '2026-09-05', 'vaccine') },
    { name: 'clinic', day: '2026-09-04', state: startClinicMode(s, '2026-09-02') },
    {
      name: 'signal + cheer today',
      day: '2026-09-20',
      state: sendCheer(
        sendSignal(s, OWNER, PARTNER, 'comfort', '2026-09-20', stamp('2026-09-20', 8)),
        OWNER,
        PARTNER,
        stamp('2026-09-20', 8),
      ),
    },
    {
      name: 'pregnant',
      day: '2026-09-20',
      state: { ...s, stage: 'pregnant', pregnancy: { lmp: '2026-09-01', confirmedAt: '2026-09-18' } },
    },
  ]
}

interface Lens {
  style: AlertStyle
  lowPressure: boolean
  homeDiscreet: boolean
  share: boolean
}

const STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off']

function lenses(): Lens[] {
  const out: Lens[] = []
  for (const style of STYLES)
    for (const lowPressure of [false, true])
      for (const homeDiscreet of [false, true]) for (const share of [false, true]) out.push({ style, lowPressure, homeDiscreet, share })
  return out
}

function applyLens(s: AppState, l: Lens, i: number): AppState {
  let out = withStyle(s, PARTNER, l.style)
  if (l.lowPressure) out = setPersonalPref(out, PARTNER, 'lowPressure', true)
  if (l.homeDiscreet) out = setPersonalPref(out, PARTNER, 'homeDiscreet', true)
  if (l.share) out = share(out)
  // The two couple-wide switches, varied across the table.
  if (i % 3 === 0) out = setPersonalPref(out, OWNER, 'acceptNudges', false)
  out = withCoverOnLink(out, i % 2 === 0)
  return out
}

/** The moment card's words as the snapshot carries them. */
function projected(m: Moment | null) {
  return m
    ? {
        copy: m.copy,
        tone: m.tone,
        ...(m.eyebrow ? { eyebrow: m.eyebrow } : {}),
        title: m.title,
        body: m.body,
        ...(m.note ? { note: m.note } : {}),
        ...(m.partnerTip ? { partnerTip: m.partnerTip } : {}),
        ...(m.primary ? { primary: m.primary.label } : {}),
        ...(m.secondary ? { secondary: m.secondary.label } : {}),
        veiled: !!m.veiled,
        support: !!m.support,
        monthlyTask: !!m.monthlyTask,
      }
    : null
}

/** The snapshot without its calendar fields: what is left must hold no date at all. */
function redacted(snap: PartnerSnapshot): string {
  const copy = JSON.parse(JSON.stringify(snap)) as Record<string, unknown>
  delete copy.today
  delete copy.validUntil
  const strip = copy.strip as { days: Array<Record<string, unknown>> } | null
  if (strip) strip.days = strip.days.map(({ date: _d, ...rest }) => rest)
  const task = copy.task as Record<string, unknown> | undefined
  if (task) {
    delete task.defaultDoneAt
    delete task.dueBy
    delete task.minDoneAt
    const a = task.appointment as Record<string, unknown> | undefined
    if (a) delete a.date
  }
  const signal = copy.signal as Record<string, unknown> | undefined
  if (signal) delete signal.at
  return JSON.stringify(copy)
}

function calm(s: AppState): boolean {
  return s.settings.alertStyle[PARTNER] !== 'explicit' || s.settings.personal?.[PARTNER]?.lowPressure === true
}

/** Every rule the link must keep, for one state on one day. */
function checkSnapshot(s: AppState, day: ISODate, tag: string, sc?: Scenario): PartnerSnapshot {
  const snap = buildPartnerSnapshot(s, day, PARTNER)
  expect(snap, tag).not.toBeNull()
  const json = JSON.stringify(snap)
  // Serialisable, versioned, dated.
  expect(JSON.parse(json), tag).toEqual(snap)
  expect(snap!.version, tag).toBe(PARTNER_SNAPSHOT_VERSION)
  expect(snap!.today, tag).toBe(day)
  expect(snap!.validUntil, tag).toBe(addDays(day, SNAPSHOT_VALID_DAYS))
  expect(snap!.viewer, tag).toBe(PARTNER)
  expect(snap!.cycleOwner, tag).toBe(OWNER)
  expect(
    snap!.members.map((m) => m.name),
    tag,
  ).toEqual(['민수', '지은'])
  expect(snap!.stage, tag).toBe(s.stage)

  // No copy drift: the card is ttcMoment's, word for word.
  expect(snap!.moment, tag).toEqual(projected(ttcMoment(s, day, PARTNER, { surface: 'link' })))

  // The strip is cycleStrip's 'weeks' band (through linkState) or nothing — never the ring.
  const expectedStrip = cycleStrip(linkState(s), day, PARTNER)
  if (expectedStrip && expectedStrip.mode === 'weeks') {
    expect(snap!.strip, tag).toMatchObject(expectedStrip)
    expect(snap!.strip!.label, tag).toContain('이번 주와 다음 주')
  } else expect(snap!.strip, tag).toBeNull()
  if (!s.settings.shareCycleDetails) expect(expectedStrip, tag).toEqual(cycleStrip(s, day, PARTNER))
  if (snap!.strip) {
    expect(snap!.strip.mode, tag).toBe('weeks')
    expect(snap!.strip.view, tag).not.toBe('explicit')
    expect('cycleDay' in snap!.strip, tag).toBe(false)
    expect('length' in snap!.strip, tag).toBe(false)
    for (const d of snap!.strip.days) {
      expect(d.lh, tag).toBeUndefined()
      expect(['none', 'fertile'], tag).toContain(d.tone)
    }
  }

  // Nothing owner-only, by marker, by key, by word.
  for (const w of [PRIVATE_LINE, SECRET_ENTRY, TREATMENT_NOTE, APPT_NOTE, HIS_APPT_NOTE, OWNER_ITEM, LH_TIME, ...FORBIDDEN_KEYS]) {
    expect(json.includes(w), `${tag}: ${w}`).toBe(false)
  }
  // Her feel chips: nowhere — the signal catalogue is static text ('오늘은 좀
  // 피곤해요, 내일 해요' is a signal, not her chip), so it is left out of this check.
  const personal = JSON.stringify({ ...snap, signals: undefined, signal: undefined })
  for (const w of Object.values(FEEL_LABEL)) expect(personal.includes(w), `${tag}: ${w}`).toBe(false)
  expect(json, tag).not.toMatch(BANNED)
  expect(json, tag).not.toMatch(/관계|LH/)
  // After the calendar fields are taken out, not one date is left (no period
  // date, no LH date, no test date, no 관계일 — none, anywhere).
  expect(redacted(snap!), tag).not.toMatch(/\d{4}-\d{2}-\d{2}/)

  // The lens: soft / off / 부담 없이 never meet a fertility word; without the
  // shared details nothing says 생리 or counts her days (unless she told him).
  if (calm(s)) expect(json, tag).not.toMatch(FERTILE)
  if (!s.settings.shareCycleDetails) {
    expect(json, tag).not.toMatch(/생리/)
    expect(json, tag).not.toMatch(/\d+일째/)
  }
  // A positive test and bleeding reach him only when she told him.
  if (sc && !sc.told) {
    expect(json, tag).not.toMatch(/양성/)
    expect(json, tag).not.toMatch(/출혈/)
  }

  // The cover: her opt-in AND his own phone would show the photo.
  const view = coverView(s, PARTNER, day)
  if (coverOnLink(s.settings) && view.mode === 'photo') expect(snap!.cover, tag).toEqual(view.photo)
  else expect(snap!.cover, tag).toBeUndefined()
  expect(snap!.together, tag).toBe(view.together)

  // His checks, her line, the signal — as the home shows them.
  const items = activeItems(s, PARTNER)
  expect(
    snap!.checks.items.map((i) => i.id),
    tag,
  ).toEqual(items.map((i) => i.id))
  for (const row of snap!.checks.items) {
    const item = items.find((i) => i.id === row.id)!
    expect(row.done, `${tag} ${row.label}`).toBe(row.weekly ? weeklyDone(s, PARTNER, item.id, day) : isDone(s, PARTNER, day, item.id))
    expect(row.weekly, tag).toBe(item.cadence === 'weekly')
  }
  expect(snap!.checks, tag).toMatchObject(rowProgress(s, PARTNER, day))
  const ownerProg = rowProgress(s, OWNER, day)
  expect(snap!.owner, tag).toEqual({
    name: '지은',
    done: ownerProg.done,
    total: ownerProg.total,
    complete: ownerProg.complete,
    canNudge: !!nudgeableItem(s, OWNER, day) && canNudge(s, PARTNER, OWNER, day),
  })
  const pending = pendingSignal(s, PARTNER, day)
  if (pending) {
    expect(snap!.signal, tag).toMatchObject({ from: OWNER, at: pending.createdAt })
    expect(
      snap!.signal!.replies.map((r) => r.id),
      tag,
    ).toEqual(repliesFor(snap!.signal!.signalId).map((r) => r.id))
    expect(snap!.line?.kind, tag).toBe('signal')
  } else expect(snap!.signal, tag).toBeUndefined()
  expect(
    snap!.signals.map((x) => x.id),
    tag,
  ).toEqual(signalsFor(s.stage, false).map((x) => x.id))
  expect(snap!.signalsLeft, tag).toBe(SIGNALS_PER_DAY - signalsSentToday(s, PARTNER, day))
  if (snap!.line) expect(['signal', 'done', 'cheer', 'anniversary'], tag).toContain(snap!.line.kind)

  // His month task: the same one, with his booked day but never his note.
  const task = monthlyTask(s, day, PARTNER)
  if (task) {
    expect(snap!.task, tag).toMatchObject({
      id: task.id,
      title: task.title,
      status: task.status,
      top: task.top,
      defaultDoneAt: task.defaultDoneAt,
    })
    expect(snap!.task!.stage, tag).toBe(task.stage)
    expect(snap!.task!.dueText, tag).toBe(task.dueText)
    expect(snap!.task!.tip, tag).toBe(task.tip)
    if (task.appointment) {
      const a = task.appointment
      expect(snap!.task!.appointment, tag).toEqual({
        id: a.id,
        date: a.date,
        ...(a.time ? { time: a.time } : {}),
        ...(a.place ? { place: a.place } : {}),
      })
      expect('note' in snap!.task!.appointment!, tag).toBe(false)
    } else expect(snap!.task!.appointment, tag).toBeUndefined()
  } else expect(snap!.task, tag).toBeUndefined()

  // Ideas only inside the 우리의 주간 card, and then the home's own two.
  if (snap!.moment?.copy === 'partner.our-week' || snap!.moment?.copy === 'partner.our-week-soon') {
    expect(snap!.ideas.length, tag).toBeGreaterThan(0)
  } else expect(snap!.ideas, tag).toEqual([])

  return snap!
}

describe('buildPartnerSnapshot — every lens × every moment', () => {
  it('keeps every rule for 24 lenses × 24 scenarios, and the pages stay small', () => {
    let maxBytes = 0
    let covers = 0
    let veiled = 0
    let withIdeas = 0
    let withSignal = 0
    const copies = new Set<string>()
    lenses().forEach((lens, i) => {
      for (const sc of scenarios()) {
        const s = applyLens(sc.state, lens, i)
        const snap = checkSnapshot(s, sc.day, `${sc.name} · ${JSON.stringify(lens)} #${i}`, sc)
        maxBytes = Math.max(maxBytes, JSON.stringify(snap).length)
        if (snap.cover) covers++
        if (snap.moment?.veiled) veiled++
        if (snap.ideas.length) withIdeas++
        if (snap.signal) withSignal++
        if (snap.moment) copies.add(snap.moment.copy)
      }
    })
    // The table really exercised the branches.
    expect(covers).toBeGreaterThan(50)
    expect(veiled).toBeGreaterThan(50)
    expect(withIdeas).toBeGreaterThan(20)
    expect(withSignal).toBeGreaterThan(20)
    for (const copy of [
      'partner.neutral',
      'partner.our-week',
      'partner.our-week-soon',
      'partner.tww',
      'partner.period-told',
      'partner.period-shared',
      'partner.late-shared',
      'partner.positive-told',
      'partner.bleeding-told',
      'partner.after-loss',
      'partner.clinic',
      'partner.no-data',
    ]) {
      expect([...copies]).toContain(copy)
    }
    // Pre-rendered and small: well under a few kilobytes even with a task and two ideas.
    expect(maxBytes).toBeLessThan(8_000)
  })

  it('is null for the cycle owner — her own view is never published', () => {
    const s = filled()
    expect(buildPartnerSnapshot(s, '2026-09-11', OWNER)).toBeNull()
    expect(buildPartnerSnapshot(share(s), '2026-09-11', OWNER)).toBeNull()
  })

  it('keeps the moment card in step with the app through a whole cycle, day by day', () => {
    for (const lens of lenses().slice(0, 8)) {
      const s = applyLens(filled(), lens, 1)
      for (const day of range('2026-09-01', '2026-10-05')) checkSnapshot(s, day, `${day} ${JSON.stringify(lens)}`)
    }
  })
})

describe('the strip on the link', () => {
  it('is the shared band in weeks mode even when she shares the details in the app', () => {
    const s = share(filled())
    const day = '2026-09-11'
    // In the app he gets the ring (period days, LH marks when explicit) …
    const inApp = cycleStrip(withStyle(s, PARTNER, 'explicit'), day, PARTNER)!
    expect(inApp.mode).toBe('cycle')
    expect(inApp.days.some((d) => d.tone === 'period')).toBe(true)
    expect(inApp.days.some((d) => d.lh)).toBe(true)
    // … the link gets the two weeks with only the band.
    const snap = buildPartnerSnapshot(withStyle(s, PARTNER, 'explicit'), day, PARTNER)!
    expect(snap.strip!.mode).toBe('weeks')
    expect(snap.strip!.days).toHaveLength(14)
    expect(snap.strip!.days.some((d) => d.tone === 'fertile')).toBe(true)
    expect(snap.strip!.days.every((d) => !d.lh && d.tone !== 'period')).toBe(true)
    // Her LH surge (09-12) pinned this cycle's window to 09-08…09-13 — the band
    // says so in soft words, and never that LH is behind it.
    expect(snap.strip!.confidence).toBe('lh')
    expect(snap.strip!.windowLabel).toBe('우리의 주간 (예상)')
    expect(snap.strip!.label).toBe('이번 주와 다음 주. 우리의 주간 (예상) 9월 8일부터 9월 13일까지')
    // The moment card itself keeps what she shares (that is in-app behaviour).
    expect(snap.moment!.eyebrow).toBe('가임기 · 9월 13일까지 (예상)')
  })

  it('linkState is the same object without shared details, and only flips that one switch', () => {
    const s = filled()
    expect(linkState(s)).toBe(s)
    const narrowed = linkState(share(s))
    expect(narrowed.settings.shareCycleDetails).toBe(false)
    expect({ ...narrowed.settings, shareCycleDetails: true }).toEqual(share(s).settings)
    expect(narrowed.periods).toBe(s.periods)
  })

  it('is null while a positive test waits, in a rest cycle, in low-pressure mode and when his alerts are off', () => {
    const s = filled()
    const day = '2026-09-11'
    expect(buildPartnerSnapshot(startRestCycle(s, '2026-09-05'), day, PARTNER)!.strip).toBeNull()
    expect(buildPartnerSnapshot(setPersonalPref(s, PARTNER, 'lowPressure', true), day, PARTNER)!.strip).toBeNull()
    expect(buildPartnerSnapshot(withStyle(s, PARTNER, 'off'), day, PARTNER)!.strip).toBeNull()
    const positive = addPregnancyTest(s, { id: 'p', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-27').state
    expect(buildPartnerSnapshot(positive, '2026-09-27', PARTNER)!.strip).toBeNull()
    expect(buildPartnerSnapshot(s, '2026-10-02', PARTNER)!.strip).toBeNull()
  })
})

describe('the moment card on the link', () => {
  it('carries labels, never actions, and the veil as his own choice with the words behind it', () => {
    const s = filled()
    const snap = buildPartnerSnapshot(s, '2026-09-11', PARTNER)!
    expect(snap.moment).toMatchObject({
      copy: 'partner.our-week',
      title: '이번 주는 우리의 주간이에요',
      secondary: '아이디어 더 보기',
      veiled: false,
    })
    expect('primary' in snap.moment!).toBe(false)
    expect(JSON.stringify(snap.moment)).not.toMatch(/"type"|"kind"|"to"/)
    const veiled = buildPartnerSnapshot(setPersonalPref(s, PARTNER, 'homeDiscreet', true), '2026-09-11', PARTNER)!
    expect(veiled.moment!.veiled).toBe(true)
    expect({ ...veiled.moment!, veiled: false }).toEqual(snap.moment)
    expect(VEIL_COPY.title).toBe('오늘도 둘이 함께해요')
  })

  it('says what she told him and nothing before that: period, positive test, bleeding', () => {
    const s = filled()
    expect(buildPartnerSnapshot(s, '2026-09-02', PARTNER)!.moment!.copy).toBe('partner.neutral')
    expect(buildPartnerSnapshot(tellPartnerPeriod(s, '2026-09-01', NOW), '2026-09-02', PARTNER)!.moment).toMatchObject({
      copy: 'partner.period-told',
      title: '이번 달은 쉬어 가요',
      partnerTip: expect.stringContaining('고생했어'),
    })
    const positive = addPregnancyTest(s, { id: 'p', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-27').state
    expect(buildPartnerSnapshot(positive, '2026-09-27', PARTNER)!.moment!.copy).toBe('partner.neutral')
    expect(buildPartnerSnapshot(tellPartnerPositive(positive, stamp('2026-09-26')), '2026-09-27', PARTNER)!.moment!.copy).toBe(
      'partner.positive-told',
    )
    const bleeding = markBleeding(positive, '2026-09-27')
    expect(buildPartnerSnapshot(bleeding, '2026-09-28', PARTNER)!.moment!.copy).toBe('partner.neutral')
    expect(buildPartnerSnapshot(tellPartnerBleeding(bleeding, stamp('2026-09-27')), '2026-09-28', PARTNER)!.moment!.copy).toBe(
      'partner.bleeding-told',
    )
  })

  it('is null outside the preparing stage, and the rest of the page still works', () => {
    const s: AppState = { ...filled(), stage: 'pregnant', pregnancy: { lmp: '2026-09-01', confirmedAt: '2026-09-18' } }
    const snap = buildPartnerSnapshot(s, '2026-09-20', PARTNER)!
    expect(snap.moment).toBeNull()
    expect(snap.strip).toBeNull()
    expect(snap.ideas).toEqual([])
    expect(snap.checks.items.length).toBeGreaterThan(0)
    expect(snap.signals.map((x) => x.id)).toEqual(signalsFor('pregnant', false).map((x) => x.id))
  })
})

describe('date ideas, cover, line, signal, checks', () => {
  it('picks the same two same-day ideas as the home card, with both map links', () => {
    const s = filled()
    const day = '2026-09-11'
    const expected = pickIdeas(
      DATE_IDEAS.filter((i) => !/박/.test(i.duration)),
      { today: day, stage: 'preparing', excludeIds: recentlyPlannedIdeaIds(s.datePlans, day), count: LINK_DATE_IDEAS },
    )
    const ideas = linkIdeas(s, day, PARTNER)
    expect(ideas.map((i) => i.id)).toEqual(expected.map((i) => i.id))
    expect(ideas).toHaveLength(LINK_DATE_IDEAS)
    for (const i of ideas) {
      expect(i.title.length).toBeGreaterThan(0)
      expect(i.kakao).toMatch(/^https:\/\/map\.kakao\.com\/link\/search\//)
      expect(i.naver).toMatch(/^https:\/\/map\.naver\.com\/p\/search\//)
      expect(i.duration).not.toMatch(/박/)
    }
    expect(buildPartnerSnapshot(s, day, PARTNER)!.ideas).toEqual(ideas)
    // The same gate as the 둘만의 시간 screen: none for a calm viewer or while resting.
    expect(fertileHintsAllowed(setPersonalPref(s, PARTNER, 'lowPressure', true), PARTNER, day)).toBe(false)
    expect(linkIdeas(setPersonalPref(s, PARTNER, 'lowPressure', true), day, PARTNER)).toEqual([])
    expect(buildPartnerSnapshot(s, '2026-09-20', PARTNER)!.ideas).toEqual([])
  })

  it('carries the cover id only with her opt-in — undefined reads as off — and only when his phone would show it', () => {
    const s = filled()
    const day = '2026-09-11'
    expect(coverOnLink(s.settings)).toBe(false)
    expect(coverOnLink(withCoverOnLink(s, true).settings)).toBe(true)
    expect(coverOnLink({ ...s.settings, ...({ coverOnLink: 'yes' } as object) })).toBe(false)
    expect(buildPartnerSnapshot(s, day, PARTNER)!.cover).toBeUndefined()
    expect(buildPartnerSnapshot(withCoverOnLink(s, true), day, PARTNER)!.cover).toEqual({
      photoId: 'builtin:test',
      focusY: 40,
      caption: '우리 둘',
    })
    // He hid the photo on his own phone: the link follows his phone.
    const hidden = {
      ...withCoverOnLink(s, true),
      settings: {
        ...withCoverOnLink(s, true).settings,
        personal: { ...s.settings.personal, a: { ...s.settings.personal?.a, hideCover: true } },
      },
    }
    expect(buildPartnerSnapshot(hidden, day, PARTNER)!.cover).toBeUndefined()
    expect(buildPartnerSnapshot(withCoverOnLink(s, true), day, PARTNER)!.together).toBe(coverView(s, PARTNER, day).together)
    expect(buildPartnerSnapshot(s, day, PARTNER)!.together).toBe(1947)
  })

  it('shows her signal with the replies that fit it, the 해 줄 말 under 이번 달은 아니었어요, and the cheer / done lines', () => {
    const day = '2026-09-20'
    let s = sendSignal(filled(), OWNER, PARTNER, 'not-this-month', day, stamp(day, 8))
    let snap = buildPartnerSnapshot(s, day, PARTNER)!
    expect(snap.signal).toMatchObject({ signalId: 'not-this-month', emoji: '🌧️', text: '이번 달은 아니었어요', from: OWNER })
    expect(snap.signal!.replies.map((r) => r.id)).toEqual(['here', 'hug'])
    expect(snap.signal!.tip).toContain('고생했어')
    expect(snap.line).toEqual({ kind: 'signal', text: '지은님이 신호를 보냈어요' })
    // Answered: gone from the page; the day's count went down.
    s = sendSignal(s, PARTNER, OWNER, 'here', day, stamp(day, 9))
    snap = buildPartnerSnapshot(s, day, PARTNER)!
    expect(snap.signal).toBeUndefined()
    expect(snap.signalsLeft).toBe(SIGNALS_PER_DAY - 1)
    expect(snap.line).toBeUndefined()
    // A cheer today is the line; the greeting never is (the page's clock makes it).
    expect(buildPartnerSnapshot(sendCheer(filled(), OWNER, PARTNER, stamp(day, 8)), day, PARTNER)!.line).toEqual({
      kind: 'cheer',
      text: '지은님이 응원을 보냈어요',
    })
    expect(buildPartnerSnapshot(filled(), day, PARTNER)!.line).toBeUndefined()
  })

  it('lists his checks with today’s state, and her line as numbers plus the 콕 gate', () => {
    const day = '2026-09-10'
    let s = filled()
    const daily = activeItems(s, PARTNER).find((i) => i.label === '30분 걷기')!
    const weekly = activeItems(s, PARTNER).find((i) => i.label === '금주')!
    s = toggleCheck(s, PARTNER, day, daily.id)
    s = toggleCheck(s, PARTNER, '2026-09-08', weekly.id)
    const snap = buildPartnerSnapshot(s, day, PARTNER)!
    expect(snap.checks.items.find((i) => i.id === daily.id)).toMatchObject({ label: '30분 걷기', kind: 'habit', weekly: false, done: true })
    expect(snap.checks.items.find((i) => i.id === weekly.id)).toMatchObject({ label: '금주', note: '주 1회', weekly: true, done: true })
    expect(snap.checks.week).toBe(0)
    expect(snap.owner.canNudge).toBe(true)
    expect(JSON.stringify(snap.owner)).not.toContain(OWNER_ITEM)
    // 콕 받기 off, the day's 콕 used up, or nothing left to point at: no button.
    expect(buildPartnerSnapshot(setPersonalPref(s, OWNER, 'acceptNudges', false), day, PARTNER)!.owner.canNudge).toBe(false)
    let used = s
    for (let i = 0; i < 3; i++) used = sendNudge(used, PARTNER, OWNER, day, stamp(day, 10 + i))
    expect(buildPartnerSnapshot(used, day, PARTNER)!.owner.canNudge).toBe(false)
    let done = s
    for (const i of activeItems(s, OWNER)) if (i.cadence !== 'weekly') done = toggleCheck(done, OWNER, day, i.id)
    expect(buildPartnerSnapshot(done, day, PARTNER)!.owner).toMatchObject({ complete: true, canNudge: false })
  })

  it('carries his month task through the chain — applied, booked, visited, claim — never his appointment note', () => {
    let s = filled()
    const booked = buildPartnerSnapshot(s, '2026-09-11', PARTNER)!.task!
    expect(booked).toMatchObject({
      id: FERTILITY_TEST_ID,
      step: 'test',
      stage: 'booked',
      dueBy: '2026-11-23',
      top: true,
      minDoneAt: '2026-08-24',
    })
    expect(booked.appointment).toEqual(expect.objectContaining({ date: '2026-09-25', time: '10:00', place: '보건소' }))
    expect('note' in booked.appointment!).toBe(false)
    expect(buildPartnerSnapshot(s, '2026-09-26', PARTNER)!.task!.stage).toBe('visited')
    s = completeMonthlyTask(s, monthlyTask(s, '2026-09-26', PARTNER)!, '2026-09-25', PARTNER)
    const claim = buildPartnerSnapshot(s, '2026-09-26', PARTNER)!.task!
    expect(claim).toMatchObject({ step: 'claim', stage: 'claim', title: '검사비 청구하기', dueBy: '2026-10-24' })
    expect(claim.docs!.map((d) => d.done)).toEqual([false, false, false, false])
    expect(claim.tip).toBeDefined()
  })
})

describe('validity and the demo couple', () => {
  it('a snapshot is usable today and tomorrow, not after, and only in its version', () => {
    const snap = buildPartnerSnapshot(filled(), '2026-09-11', PARTNER)!
    expect(snapshotUsable(snap, '2026-09-11')).toBe(true)
    expect(snapshotUsable(snap, '2026-09-12')).toBe(true)
    expect(snapshotUsable(snap, '2026-09-13')).toBe(false)
    expect(snapshotUsable(snap, '2026-09-10')).toBe(true)
    expect(snapshotUsable({ ...snap, version: 2 as unknown as 1 }, '2026-09-11')).toBe(false)
    expect(snapshotUsable(null, '2026-09-11')).toBe(false)
    expect(snapshotUsable(undefined, '2026-09-11')).toBe(false)
  })

  it('works on the demo couple on 2026-10-02 for 민수, through every lens', () => {
    const today = '2026-10-02'
    const base = createDemoState(today, new Date(2026, 9, 2, 9))
    const demoPrivate = Object.values(base.personalLog?.b ?? {})
      .map((d) => d.note)
      .filter((n): n is string => !!n)
    expect(demoPrivate.length).toBeGreaterThan(0)
    lenses().forEach((lens, i) => {
      const s = applyLens(base, lens, i)
      const snap = checkSnapshot(s, today, `demo ${JSON.stringify(lens)}`)
      const json = JSON.stringify(snap)
      for (const note of demoPrivate) expect(json.includes(note), note).toBe(false)
      expect(snap.task).toBeDefined()
      expect(snap.checks.items.length).toBe(4)
    })
  })
})
