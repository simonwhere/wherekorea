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
import { PARTNER_EVENT_KINDS, appliedEventKey, applyPartnerEvent, hasAppliedEvent, type PartnerEvent } from '@/lib/logic/partnerEvents'
import {
  LINK_DATE_IDEAS,
  LINK_FIRST_WEEKS_DAYS,
  PARTNER_SNAPSHOT_VERSION,
  SNAPSHOT_DAYS,
  SNAPSHOT_VALID_DAYS,
  applyReceivedEvents,
  buildPartnerDay,
  judgedDay,
  buildPartnerSnapshot,
  eventDay,
  forecastHold,
  holdStrip,
  linkFirstWeeks,
  linkIdeas,
  linkState,
  linkTaskVisible,
  prepChainText,
  snapshotDay,
  snapshotUsable,
  type PartnerDay,
  type PartnerSnapshot,
} from '@/lib/logic/partnerSnapshot'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { canSeeWeekBand, coverOnLink, setPersonalPref, setShareLevel, shareLevelOf } from '@/lib/logic/prefs'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, sendSignal, signalIdOf, signalsFor, signalsSentToday } from '@/lib/logic/signals'
import { habitTimer, rowProgress } from '@/lib/logic/today'
import { startLossRest, startRestCycle } from '@/lib/logic/ttc'
import { markWeekDone, pickWeek, thankWeek, thanksThisWeek, weekDone, weekOf, weekOptions, weekPick } from '@/lib/logic/weekTogether'
import type { ReceivedEvent } from '@/lib/sync/transport'
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
import type { AlertStyle, AppState, ISODate, MemberId, ShareLevel } from '@/lib/types'

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
const share = (s: AppState): AppState => setShareLevel(s, OWNER, 'details')
const noDates = (s: AppState): AppState => setShareLevel(s, OWNER, 'none')
/** The page for `day` as a snapshot built that day carries it. */
const day0 = (s: AppState, day: ISODate): PartnerDay => buildPartnerSnapshot(s, day, PARTNER)!.days[0]!
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
  share: ShareLevel
}

const STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off']
const LEVELS: readonly ShareLevel[] = ['none', 'week', 'details']

function lenses(): Lens[] {
  const out: Lens[] = []
  for (const style of STYLES)
    for (const lowPressure of [false, true])
      for (const homeDiscreet of [false, true]) for (const share of LEVELS) out.push({ style, lowPressure, homeDiscreet, share })
  return out
}

function applyLens(s: AppState, l: Lens, i: number): AppState {
  let out = withStyle(s, PARTNER, l.style)
  if (l.lowPressure) out = setPersonalPref(out, PARTNER, 'lowPressure', true)
  if (l.homeDiscreet) out = setPersonalPref(out, PARTNER, 'homeDiscreet', true)
  out = setShareLevel(out, OWNER, l.share)
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

/** A day without its calendar fields: what is left must hold no date at all. */
function redacted(day: PartnerDay): string {
  const copy = JSON.parse(JSON.stringify(day)) as Record<string, unknown>
  delete copy.date
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
  const week = copy.week as Record<string, unknown> | undefined
  if (week) {
    delete week.monday
    delete week.thanks
  }
  return JSON.stringify(copy)
}

/** No fertile word for this viewer: soft / off / 부담 없이, or no dates shared at all. */
function calm(s: AppState): boolean {
  return (
    s.settings.alertStyle[PARTNER] !== 'explicit' || s.settings.personal?.[PARTNER]?.lowPressure === true || shareLevelOf(s) === 'none'
  )
}

/** Every rule the link must keep, for one date's page of a snapshot. `held`: the forecast rule kept the day before's card. */
function checkDay(s: AppState, d: PartnerDay, day: ISODate, tag: string, sc?: Scenario, held = false): void {
  const json = JSON.stringify(d)
  expect(JSON.parse(json), tag).toEqual(d)
  expect(d.date, tag).toBe(day)

  // No copy drift: the card is ttcMoment's, word for word (unless held).
  if (!held) expect(d.moment, tag).toEqual(projected(ttcMoment(s, day, PARTNER, { surface: 'link' })))

  // The strip is cycleStrip's 'weeks' band (through linkState) or nothing — never the ring; none at all for 날짜 없음.
  if (!held) {
    const expectedStrip = canSeeWeekBand(s, PARTNER) ? cycleStrip(linkState(s), day, PARTNER) : null
    if (expectedStrip && expectedStrip.mode === 'weeks') {
      expect(d.strip, tag).toMatchObject(expectedStrip)
      expect(d.strip!.label, tag).toContain('이번 주와 다음 주')
    } else expect(d.strip, tag).toBeNull()
    if (shareLevelOf(s) === 'week') expect(expectedStrip, tag).toEqual(cycleStrip(s, day, PARTNER))
  }
  if (shareLevelOf(s) === 'none') {
    expect(d.strip, tag).toBeNull()
    expect(d.ideas, tag).toEqual([])
  }
  if (d.strip) {
    expect(d.strip.mode, tag).toBe('weeks')
    expect(d.strip.view, tag).not.toBe('explicit')
    expect('cycleDay' in d.strip, tag).toBe(false)
    expect('length' in d.strip, tag).toBe(false)
    for (const x of d.strip.days) {
      expect(x.lh, tag).toBeUndefined()
      expect(['none', 'fertile'], tag).toContain(x.tone)
    }
  }

  // Nothing owner-only, by marker, by key, by word.
  for (const w of [PRIVATE_LINE, SECRET_ENTRY, TREATMENT_NOTE, APPT_NOTE, HIS_APPT_NOTE, OWNER_ITEM, LH_TIME, ...FORBIDDEN_KEYS]) {
    expect(json.includes(w), `${tag}: ${w}`).toBe(false)
  }
  // Her feel chips: nowhere — the signal catalogue is static text ('오늘은 좀
  // 피곤해요, 내일 해요' is a signal, not her chip), so it is left out of this check.
  const personal = JSON.stringify({ ...d, signal: undefined })
  for (const w of Object.values(FEEL_LABEL)) expect(personal.includes(w), `${tag}: ${w}`).toBe(false)
  expect(json, tag).not.toMatch(BANNED)
  expect(json, tag).not.toMatch(/관계|LH/)
  // After the calendar fields are taken out, not one date is left (no period
  // date, no LH date, no test date, no 관계일 — none, anywhere).
  expect(redacted(d), tag).not.toMatch(/\d{4}-\d{2}-\d{2}/)

  // The lens: soft / off / 부담 없이 / 날짜 없음 never meet a fertility word;
  // without the shared details nothing says 생리 or counts her days (unless she told him).
  if (calm(s)) expect(json, tag).not.toMatch(FERTILE)
  if (shareLevelOf(s) !== 'details') {
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
  if (coverOnLink(s.settings) && view.mode === 'photo') expect(d.cover, tag).toEqual(view.photo)
  else expect(d.cover, tag).toBeUndefined()
  expect(d.together, tag).toBe(view.together)

  // His checks, her line, the signal — as the home shows them that day.
  const items = activeItems(s, PARTNER)
  expect(
    d.checks.items.map((i) => i.id),
    tag,
  ).toEqual(items.map((i) => i.id))
  for (const row of d.checks.items) {
    const item = items.find((i) => i.id === row.id)!
    expect(row.done, `${tag} ${row.label}`).toBe(row.weekly ? weeklyDone(s, PARTNER, item.id, day) : isDone(s, PARTNER, day, item.id))
    expect(row.weekly, tag).toBe(item.cadence === 'weekly')
  }
  expect(d.checks, tag).toMatchObject(rowProgress(s, PARTNER, day))
  const ownerProg = rowProgress(s, OWNER, day)
  expect(d.owner, tag).toEqual({
    name: '지은',
    done: ownerProg.done,
    total: ownerProg.total,
    complete: ownerProg.complete,
    canNudge: !!nudgeableItem(s, OWNER, day) && canNudge(s, PARTNER, OWNER, day),
  })
  const pending = pendingSignal(s, PARTNER, day)
  if (pending) {
    expect(d.signal, tag).toMatchObject({ from: OWNER, at: pending.createdAt })
    expect(
      d.signal!.replies.map((r) => r.id),
      tag,
    ).toEqual(repliesFor(d.signal!.signalId).map((r) => r.id))
    expect(d.line?.kind, tag).toBe('signal')
  } else expect(d.signal, tag).toBeUndefined()
  expect(d.signalsLeft, tag).toBe(SIGNALS_PER_DAY - signalsSentToday(s, PARTNER, day))
  if (d.line) expect(['signal', 'done', 'cheer', 'anniversary'], tag).toContain(d.line.kind)

  // His month task: the same one, with his booked day but never his note — and none while it rests (after a loss).
  const task = linkTaskVisible(s, day, PARTNER) ? monthlyTask(s, day, PARTNER) : undefined
  if (task) {
    expect(d.task, tag).toMatchObject({
      id: task.id,
      title: task.title,
      status: task.status,
      top: task.top || (task.step === 'apply' && linkFirstWeeks(s, day)),
      defaultDoneAt: task.defaultDoneAt,
    })
    expect(d.task!.stage, tag).toBe(task.stage)
    expect(d.task!.dueText, tag).toBe(task.dueText)
    expect(d.task!.tip, tag).toBe(task.tip)
    if (task.appointment) {
      const a = task.appointment
      expect(d.task!.appointment, tag).toEqual({
        id: a.id,
        date: a.date,
        ...(a.time ? { time: a.time } : {}),
        ...(a.place ? { place: a.place } : {}),
      })
      expect('note' in d.task!.appointment!, tag).toBe(false)
    } else expect(d.task!.appointment, tag).toBeUndefined()
  } else expect(d.task, tag).toBeUndefined()
  if (d.moment?.support) expect(d.task, tag).toBeUndefined()

  // Ideas only inside the 우리의 주간 card, and then the home's own two.
  if (!held) {
    if (d.moment?.copy === 'partner.our-week' || d.moment?.copy === 'partner.our-week-soon') {
      expect(d.ideas.length, tag).toBeGreaterThan(0)
    } else expect(d.ideas, tag).toEqual([])
  }

  // '이번 주 우리 둘': this week's three picks, his own pick and [했어요], her thanks — never a zero.
  const options = weekOptions(s, day, PARTNER)
  if (!options.length) expect(d.week, tag).toBeUndefined()
  else {
    const w = d.week!
    expect(w, tag).toBeDefined()
    expect(w.monday, tag).toBe(weekOf(day))
    expect(
      w.options.map((o) => o.id),
      tag,
    ).toEqual(options.map((o) => o.id))
    expect(w.pick, tag).toBe(weekPick(s, w.monday, PARTNER)?.id)
    const doneOn = weekDone(s, w.monday, PARTNER)
    expect(w.done, tag).toBe(!!w.pick && doneOn !== undefined && doneOn <= day)
    expect(w.thanks, tag).toBe(thanksThisWeek(s, PARTNER, day)?.day)
    if (w.prep) {
      expect(Object.keys(w.prep).length, tag).toBeGreaterThan(0)
      if (w.prep.week !== undefined) expect(w.prep.week, tag).toBeGreaterThan(0)
      if (w.prep.habit !== undefined) expect(habitTimer(s, PARTNER, day).state, tag).not.toBe('not-started')
    }
    expect(JSON.stringify(w), tag).not.toMatch(/\b0\/7|안 했어요/)
  }
  if (d.moment?.support) expect(d.week, tag).toBeUndefined()
}

/**
 * The whole snapshot for `today`: seven dates, each the page a snapshot built
 * on that date would carry from the same records (buildPartnerDay) — except
 * where the forecast rule holds the day before (a phase only a prediction
 * brings: 'late') — and every page through checkDay.
 */
function checkSnapshot(s: AppState, today: ISODate, tag: string, sc?: Scenario): PartnerSnapshot {
  const snap = buildPartnerSnapshot(s, today, PARTNER)
  expect(snap, tag).not.toBeNull()
  const json = JSON.stringify(snap)
  // Serialisable, versioned, dated.
  expect(JSON.parse(json), tag).toEqual(snap)
  expect(snap!.version, tag).toBe(PARTNER_SNAPSHOT_VERSION)
  expect(snap!.today, tag).toBe(today)
  expect(snap!.validUntil, tag).toBe(addDays(today, SNAPSHOT_VALID_DAYS))
  expect(snap!.viewer, tag).toBe(PARTNER)
  expect(snap!.cycleOwner, tag).toBe(OWNER)
  expect(
    snap!.members.map((m) => m.name),
    tag,
  ).toEqual(['민수', '지은'])
  expect(snap!.stage, tag).toBe(s.stage)
  expect(
    snap!.signals.map((x) => x.id),
    tag,
  ).toEqual(signalsFor(s.stage, false).map((x) => x.id))
  for (const w of [...FORBIDDEN_KEYS, 'shareLevel', 'coupleId', 'tokenHash']) expect(json.includes(w), `${tag}: ${w}`).toBe(false)
  expect(snap!.days, tag).toHaveLength(SNAPSHOT_DAYS)

  const todayKind = ttcMoment(s, today, PARTNER)?.kind
  snap!.days.forEach((d, k) => {
    const day = addDays(today, k)
    const t = `${tag} +${k}`
    const same = buildPartnerDay(s, day, PARTNER)!
    const held = k > 0 && forecastHold(todayKind, ttcMoment(s, day, PARTNER)?.kind)
    if (held) {
      const prev = snap!.days[k - 1]!
      if (prev.moment?.support) {
        // Right after the quiet: the day as a partner without her details reads it — never the support card carried on.
        expect(d.moment, t).toEqual(buildPartnerDay(linkState(s), day, PARTNER)!.moment)
        expect(d.moment?.support, t).toBe(false)
        expect(d.strip, t).toEqual(same.strip)
        expect(d.ideas, t).toEqual([])
      } else {
        expect(d.moment, t).toEqual(prev.moment)
        expect(d.ideas, t).toEqual(prev.ideas)
        expect(d.strip, t).toEqual(holdStrip(prev.strip, day))
        expect(!!d.strip, t).toBe(!!prev.strip)
      }
      // Everything else is that date's own page.
      expect({ ...d, moment: null, strip: null, ideas: [] }, t).toEqual({ ...same, moment: null, strip: null, ideas: [] })
    } else {
      // The property: a pre-computed day says exactly what that day's own snapshot would.
      expect(d, t).toEqual(same)
    }
    checkDay(s, d, day, t, sc, held)
    if (k > 0) {
      // Never a predicted period: no 'late' card ahead of time, no band that vanishes on the due day.
      if (snap!.days[0]!.moment?.copy !== 'partner.late-shared') expect(d.moment?.copy, t).not.toBe('partner.late-shared')
      if (held && !snap!.days[k - 1]!.moment?.support) expect(!!d.strip, t).toBe(!!snap!.days[k - 1]!.strip)
    }
  })
  return snap!
}

describe('buildPartnerSnapshot — every lens × every moment × seven days', () => {
  it('keeps every rule for 36 lenses × 24 scenarios, each future day equal to its own same-day page, and stays small', { timeout: 300_000 }, () => {
    let maxBytes = 0
    let covers = 0
    let veiled = 0
    let withIdeas = 0
    let withSignal = 0
    let weeks = 0
    let heldDays = 0
    const copies = new Set<string>()
    lenses().forEach((lens, i) => {
      for (const sc of scenarios()) {
        const s = applyLens(sc.state, lens, i)
        const snap = checkSnapshot(s, sc.day, `${sc.name} · ${JSON.stringify(lens)} #${i}`, sc)
        maxBytes = Math.max(maxBytes, JSON.stringify(snap).length)
        const d = snap.days[0]!
        if (d.cover) covers++
        if (d.moment?.veiled) veiled++
        if (d.ideas.length) withIdeas++
        if (d.signal) withSignal++
        if (d.week) weeks++
        if (d.moment) copies.add(d.moment.copy)
        const todayKind = ttcMoment(s, sc.day, PARTNER)?.kind
        heldDays += snap.days.filter((x, k) => k > 0 && forecastHold(todayKind, ttcMoment(s, x.date, PARTNER)?.kind)).length
      }
    })
    // The table really exercised the branches.
    expect(covers).toBeGreaterThan(50)
    expect(veiled).toBeGreaterThan(50)
    expect(withIdeas).toBeGreaterThan(20)
    expect(withSignal).toBeGreaterThan(20)
    expect(weeks).toBeGreaterThan(100)
    expect(heldDays).toBeGreaterThan(10)
    for (const copy of [
      'partner.neutral',
      'partner.our-week',
      'partner.our-week-soon',
      'partner.period-told',
      'partner.positive-told',
      'partner.bleeding-told',
      'partner.after-loss',
      'partner.clinic',
    ]) {
      expect([...copies]).toContain(copy)
    }
    // Pre-rendered and small: seven pages well under the server's 128 KB, and under the old 64 KB.
    expect(maxBytes).toBeLessThan(60_000)
  })

  it('a snapshot’s first page is exactly the same-day page (buildPartnerDay)', () => {
    const s = filled()
    for (const day of ['2026-09-02', '2026-09-11', '2026-09-20', '2026-10-02']) {
      expect(buildPartnerSnapshot(s, day, PARTNER)!.days[0]).toEqual(buildPartnerDay(s, day, PARTNER))
    }
    expect(buildPartnerDay(s, '2026-09-11', OWNER)).toBeNull()
  })

  it('is null for the cycle owner — her own view is never published', () => {
    const s = filled()
    expect(buildPartnerSnapshot(s, '2026-09-11', OWNER)).toBeNull()
    expect(buildPartnerSnapshot(share(s), '2026-09-11', OWNER)).toBeNull()
  })

  it('keeps the moment card in step with the app through a whole cycle, day by day', { timeout: 300_000 }, () => {
    for (const lens of lenses().filter((_, i) => i % 3 !== 2).slice(0, 8)) {
      const s = applyLens(filled(), lens, 1)
      for (const day of range('2026-09-01', '2026-10-05')) checkSnapshot(s, day, `${day} ${JSON.stringify(lens)}`)
    }
  })
})

describe('the seven days (N20)', () => {
  it('carries today … today+6, validUntil today+6; the page picks its own date, the first before, nothing after', () => {
    const s = filled()
    const snap = buildPartnerSnapshot(s, '2026-09-20', PARTNER)!
    expect(snap.days.map((d) => d.date)).toEqual(range('2026-09-20', '2026-09-26'))
    expect(snap.validUntil).toBe('2026-09-26')
    for (const d of snap.days) {
      const page = snapshotDay(snap, d.date)!
      expect(page.date).toBe(d.date)
      expect(page.members).toEqual(snap.members)
      expect(page.checks).toEqual(d.checks)
      expect('days' in page).toBe(false)
    }
    // His clock behind hers: the first page.
    expect(snapshotDay(snap, '2026-09-19')!.date).toBe('2026-09-20')
    // After the week: nothing (the page shows '새 화면은 곧 채워져요').
    expect(snapshotDay(snap, '2026-09-27')).toBeNull()
    expect(snapshotDay(null, '2026-09-20')).toBeNull()
    expect(snapshotDay({ ...snap, days: [] }, '2026-09-20')).toBeNull()
    expect(snapshotDay({ ...snap, version: 1 as unknown as 2 }, '2026-09-20')).toBeNull()
  })

  it('a partner she shares the details with never meets the late card ahead of time; on that day itself he does', () => {
    const s = share(withStyle(filled(), PARTNER, 'soft'))
    // 09-29 is the expected period; the late phase begins a few days later.
    const lateDay = range('2026-09-29', '2026-10-10').find((d) => ttcMoment(s, d, PARTNER)?.kind === 'late')!
    expect(lateDay).toBeDefined()
    const today = addDays(lateDay, -3)
    const snap = buildPartnerSnapshot(s, today, PARTNER)!
    const before = snap.days[2]!
    expect(ttcMoment(s, before.date, PARTNER)?.kind).not.toBe('late')
    for (const d of snap.days.slice(3)) {
      expect(d.moment).toEqual(before.moment)
      expect(d.moment?.copy).not.toBe('partner.late-shared')
    }
    // The same day, built that day: what she shares with him, as before.
    expect(buildPartnerSnapshot(s, lateDay, PARTNER)!.days[0]!.moment?.copy).toBe(ttcMoment(s, lateDay, PARTNER, { surface: 'link' })?.copy)
    // Already late today: nothing is held (the same on every day after).
    const late = buildPartnerSnapshot(s, lateDay, PARTNER)!
    late.days.forEach((d) => expect(d).toEqual(buildPartnerDay(s, d.date, PARTNER)))
  })

  it('the day the quiet after a loss ends never carries its support card on, even when her period is late then', () => {
    const base = filled(fresh({ periods: [{ start: '2026-07-18' }, { start: '2026-08-12' }, { start: '2026-09-15' }] }))
    const ended = startLossRest({ ...base, pregnancy: { lmp: '2026-07-18', confirmedAt: '2026-08-17', endedAt: '2026-09-12' } }, '2026-09-12')
    for (const s of [ended, share(ended)]) {
      const snap = buildPartnerSnapshot(s, '2026-10-20', PARTNER)!
      const quiet = snap.days.filter((d) => d.moment?.support)
      expect(quiet.length).toBeGreaterThan(0)
      const after = snap.days.slice(quiet.length)
      expect(after.length).toBeGreaterThan(0)
      for (const d of after) {
        expect(d.moment?.support).toBe(false)
        expect(d.moment?.copy).not.toBe('partner.late-shared')
      }
    }
  })

  it('holdStrip moves today within the week, and into a new week carries the band’s second week with nothing drawn after', () => {
    const s = filled()
    const strip = day0(s, '2026-09-08').strip!
    expect(strip).not.toBeNull()
    const sameWeek = holdStrip(strip, '2026-09-10')!
    expect(sameWeek.days.map((d) => d.date)).toEqual(strip.days.map((d) => d.date))
    expect(sameWeek.days.find((d) => d.today)!.date).toBe('2026-09-10')
    expect(sameWeek.todayIndex).toBe(strip.todayIndex + 2)
    expect(sameWeek.days.map((d) => d.tone)).toEqual(strip.days.map((d) => d.tone))
    const nextWeek = holdStrip(strip, '2026-09-15')!
    expect(nextWeek.days[0]!.date).toBe('2026-09-14')
    expect(nextWeek.days.slice(0, 7).map((d) => d.tone)).toEqual(strip.days.slice(7).map((d) => d.tone))
    expect(nextWeek.days.slice(7).every((d) => d.tone === 'none')).toBe(true)
    expect(nextWeek.startLabel).toBe('9.14')
    expect(nextWeek.label).toContain('이번 주와 다음 주')
    expect(holdStrip(null, '2026-09-15')).toBeNull()
    expect(forecastHold('tww', 'late')).toBe(true)
    expect(forecastHold('late', 'late')).toBe(false)
    expect(forecastHold('tww', 'tww')).toBe(false)
    expect(forecastHold(undefined, 'late')).toBe(true)
  })

  it('his month task rests on every day of the quiet after a loss (N19 ②), and returns once it is over', () => {
    const ended: AppState = {
      ...filled(fresh({ periods: [{ start: '2026-04-03' }, { start: '2026-05-01' }] })),
      pregnancy: { lmp: '2026-05-01', confirmedAt: '2026-06-10', endedAt: '2026-07-01' },
    }
    const quiet = buildPartnerSnapshot(ended, '2026-07-10', PARTNER)!
    for (const d of quiet.days) {
      expect(d.task).toBeUndefined()
      expect(d.week).toBeUndefined()
    }
    expect(monthlyTask(ended, '2026-07-10', PARTNER)).toBeDefined()
    const after = buildPartnerSnapshot(ended, '2026-09-20', PARTNER)!
    expect(after.days[0]!.task).toBeDefined()
  })

  it('the link’s first two weeks: his 신청 step leads the page, then sits where it always did', () => {
    const base = fresh()
    const link = { coupleId: 'c-1', tokenHash: 'a'.repeat(64), createdAt: '2026-09-05T10:00:00+09:00', expiresAt: '2026-10-05T10:00:00+09:00' }
    const s: AppState = { ...base, couple: { ...base.couple, link } }
    const t = monthlyTask(s, '2026-09-06', PARTNER)!
    expect(t.step).toBe('apply')
    expect(linkFirstWeeks(s, '2026-09-05')).toBe(true)
    expect(linkFirstWeeks(s, addDays('2026-09-05', LINK_FIRST_WEEKS_DAYS - 1))).toBe(true)
    expect(linkFirstWeeks(s, addDays('2026-09-05', LINK_FIRST_WEEKS_DAYS))).toBe(false)
    expect(linkFirstWeeks(s, '2026-09-04')).toBe(false)
    expect(linkFirstWeeks(base, '2026-09-06')).toBe(false)
    expect(day0(s, '2026-09-06').task!.top).toBe(true)
    const later = addDays('2026-09-05', LINK_FIRST_WEEKS_DAYS)
    expect(day0(s, later).task!.top).toBe(monthlyTask(s, later, PARTNER)!.top)
    // Without a link (a preview), the task keeps its own place.
    expect(day0(base, '2026-09-06').task!.top).toBe(t.top)
  })
})

describe('이번 주 우리 둘 on the link (N21)', () => {
  it('carries the week’s three picks, his pick and [했어요] (from the link’s own events), and her thanks for the rest of the week', () => {
    const today = '2026-09-21' // a Monday
    let s = filled()
    const w = day0(s, today).week!
    expect(w.options).toHaveLength(3)
    expect(w.options.map((o) => o.id)).toEqual(weekOptions(s, today, PARTNER).map((o) => o.id))
    expect(w.pick).toBeUndefined()
    expect(w.done).toBe(false)
    expect(JSON.stringify(w)).not.toMatch(/가임기|배란|생리|임신|테스트/)
    // His pick and [했어요] arrive as events.
    s = applyPartnerEvent(s, { id: 'p1', from: PARTNER, kind: 'week-pick', optionId: w.options[1]!.id, date: today }, today)
    expect(day0(s, today).week!.pick).toBe(w.options[1]!.id)
    s = applyPartnerEvent(s, { id: 'd1', from: PARTNER, kind: 'week-done', date: '2026-09-23' }, '2026-09-23')
    const done = day0(s, '2026-09-23').week!
    expect(done.done).toBe(true)
    expect(done.doneText).toBeDefined()
    // A future day of a snapshot built on Monday doesn't pretend it is done before it was.
    expect(buildPartnerSnapshot(s, today, PARTNER)!.days[0]!.week!.done).toBe(false)
    // Her [고마워요] on Wednesday stays on his card through Sunday, and is gone on Monday.
    s = thankWeek(s, OWNER, '2026-09-23')
    const snap = buildPartnerSnapshot(s, '2026-09-23', PARTNER)!
    expect(snap.days.filter((d) => d.date <= '2026-09-27').every((d) => d.week?.thanks === '2026-09-23')).toBe(true)
    const nextMonday = snap.days.find((d) => d.date === '2026-09-28')!
    expect(nextMonday.week!.thanks).toBeUndefined()
    expect(nextMonday.week!.pick).toBeUndefined()
    expect(nextMonday.week!.done).toBe(false)
    expect(nextMonday.week!.monday).toBe('2026-09-28')
  })

  it('내 준비 says only what is there: his timer while it counts, his complete days, his chain once a step is done', () => {
    const today = '2026-09-10'
    let s = fresh()
    expect(day0(s, today).week?.prep).toBeUndefined()
    for (const i of activeItems(s, PARTNER)) if (i.cadence !== 'weekly') s = toggleCheck(s, PARTNER, '2026-09-08', i.id)
    const prep = day0(s, today).week!.prep!
    expect(prep.habit).toBe(habitTimer(s, PARTNER, today).label)
    expect(prep.week).toBe(1)
    expect(prep.chain).toBeUndefined()
    s = setFertilityApplied(s, PARTNER, true, '2026-09-09')
    expect(prepChainText(s, today, PARTNER)).toBe('신청했어요, 다음은 검사')
    expect(day0(s, today).week!.prep!.chain).toBe('신청했어요, 다음은 검사')
  })

  it('rests outside the preparing stage and in the quiet after a loss', () => {
    const preg: AppState = { ...filled(), stage: 'pregnant', pregnancy: { lmp: '2026-09-01', confirmedAt: '2026-09-18' } }
    expect(day0(preg, '2026-09-20').week).toBeUndefined()
    const ended: AppState = {
      ...filled(fresh({ periods: [{ start: '2026-04-03' }, { start: '2026-05-01' }] })),
      pregnancy: { lmp: '2026-05-01', confirmedAt: '2026-06-10', endedAt: '2026-07-01' },
    }
    expect(day0(ended, '2026-07-10').week).toBeUndefined()
    expect(day0(startLossRest(ended, '2026-07-01'), '2026-07-20').week).toBeUndefined()
  })
})

describe('events back by the moment they were taken in (N20)', () => {
  it('a reply sent while her signal waited still counts when her phone opens three days later', () => {
    const sent = '2026-09-20'
    let s = sendSignal(filled(), OWNER, PARTNER, 'not-this-month', sent, stamp(sent, 8))
    const pending = pendingSignal(s, PARTNER, sent)!
    const reply: PartnerEvent = { id: 'r1', from: PARTNER, kind: 'reply', signalId: signalIdOf(pending)!, replyId: 'here' }
    const opens = '2026-09-23'
    // By her own day the signal is no longer waiting: the old rule dropped the reply.
    expect(applyPartnerEvent(s, reply, opens)).toBe(s)
    // By the day it was taken in, it counts — stamped then, on that day.
    const received: ReceivedEvent[] = [{ receivedAt: `${sent}T21:10:00+09:00`, event: reply }]
    const next = applyReceivedEvents(s, received, opens)
    expect(next).not.toBe(s)
    expect(hasAppliedEvent(next, 'r1')).toBe(true)
    expect(next.decisions[appliedEventKey('r1')]).toBe(sent)
    const answer = next.notifications.find((n) => n.from === PARTNER && !s.notifications.includes(n))!
    expect(answer.createdAt.startsWith(sent)).toBe(true)
    // Once: the same pull again changes nothing.
    expect(applyReceivedEvents(next, received, opens)).toBe(next)
    s = next
  })

  it('a check ticked on its day counts five days later; a stamp from a clock ahead of hers counts as her today', () => {
    const s = filled()
    const walk = activeItems(s, PARTNER).find((i) => i.cadence !== 'weekly')!
    const ev: PartnerEvent = { id: 'c1', from: PARTNER, kind: 'check', itemId: walk.id, date: '2026-09-14', done: true }
    const next = applyReceivedEvents(s, [{ receivedAt: '2026-09-14T08:00:00+09:00', event: ev }], '2026-09-19')
    expect(isDone(next, PARTNER, '2026-09-14', walk.id)).toBe(true)
    // A server clock in the future (or a stray stamp): judged on her today, never after it.
    expect(eventDay('2026-09-25T00:00:00Z', '2026-09-19')).toBe('2026-09-19')
    expect(eventDay('nonsense', '2026-09-19')).toBe('2026-09-19')
    // His clock ahead of the transport's: an event dated after its receipt is judged on its own date, never past her today.
    const ahead: PartnerEvent = { ...ev, id: 'c2', date: '2026-09-15' }
    expect(judgedDay({ receivedAt: '2026-09-14T23:50:00+09:00', event: ahead }, '2026-09-19')).toBe('2026-09-15')
    expect(judgedDay({ receivedAt: '2026-09-14T23:50:00+09:00', event: { ...ev, date: '2026-09-21' } }, '2026-09-19')).toBe('2026-09-14')
    expect(judgedDay({ receivedAt: '2026-09-14T23:50:00+09:00', event: { id: 'x', kind: 'cheer' } }, '2026-09-19')).toBe('2026-09-14')
  })

  it('eventDay reads the server’s UTC stamp as the local (Seoul) date and keeps it inside the pull window', () => {
    // 2026-09-14 23:30 UTC is 2026-09-15 08:30 in Seoul.
    expect(eventDay('2026-09-14T23:30:00+00:00', '2026-09-19')).toBe('2026-09-15')
    expect(eventDay('2026-09-14T23:30:00.123456+00:00', '2026-09-19')).toBe('2026-09-15')
    expect(eventDay('2026-09-15T08:30:00+09:00', '2026-09-19')).toBe('2026-09-15')
    expect(eventDay('2026-09-01T08:30:00+09:00', '2026-09-19')).toBe('2026-09-12')
    expect(eventDay('2026-09-01T08:30:00+09:00', '2026-09-19', 30)).toBe('2026-09-01')
    expect(eventDay('2026-09-15', '2026-09-19')).toBe('2026-09-15')
  })

  it('every kind keeps its own gates by the day it arrived; a week tap waits out the quiet', () => {
    expect(PARTNER_EVENT_KINDS).toContain('week-pick')
    const s = filled()
    const opts = weekOptions(s, '2026-09-21', PARTNER)
    const pick: PartnerEvent = { id: 'w1', from: PARTNER, kind: 'week-pick', optionId: opts[0]!.id, date: '2026-09-21' }
    const next = applyReceivedEvents(s, [{ receivedAt: '2026-09-21T09:00:00+09:00', event: pick }], '2026-09-24')
    expect(weekPick(next, '2026-09-21', PARTNER)?.id).toBe(opts[0]!.id)
    // A forged actor or a tap for her items is dropped as before.
    const hers = activeItems(s, OWNER)[0]!
    const forged: PartnerEvent = { id: 'f1', from: OWNER, kind: 'cheer' }
    const notHis: PartnerEvent = { id: 'f2', from: PARTNER, kind: 'check', itemId: hers.id, date: '2026-09-21', done: true }
    expect(
      applyReceivedEvents(
        s,
        [
          { receivedAt: '2026-09-21T09:00:00+09:00', event: forged },
          { receivedAt: '2026-09-21T09:00:01+09:00', event: notHis },
        ],
        '2026-09-24',
      ),
    ).toBe(s)
    // Inside the quiet after a loss, a week tap is not applied (and not remembered).
    const ended: AppState = {
      ...filled(fresh({ periods: [{ start: '2026-04-03' }, { start: '2026-05-01' }] })),
      pregnancy: { lmp: '2026-05-01', confirmedAt: '2026-06-10', endedAt: '2026-07-01' },
    }
    const quietTap: PartnerEvent = { id: 'w2', from: PARTNER, kind: 'week-done', date: '2026-07-08' }
    expect(applyReceivedEvents(ended, [{ receivedAt: '2026-07-08T09:00:00+09:00', event: quietTap }], '2026-07-10')).toBe(ended)
    // The pick helpers the link relies on.
    expect(markWeekDone(pickWeek(s, PARTNER, opts[0]!.id, '2026-09-21'), PARTNER, '2026-09-22').decisions).toBeDefined()
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
    const snap = day0(withStyle(s, PARTNER, 'explicit'), day)
    expect(snap.strip!.mode).toBe('weeks')
    expect(snap.strip!.days).toHaveLength(14)
    expect(snap.strip!.days.some((d) => d.tone === 'fertile')).toBe(true)
    expect(snap.strip!.days.every((d) => !d.lh && d.tone !== 'period')).toBe(true)
    // The band is the one a partner without her details gets (linkState), in soft words — never LH.
    const shared = cycleStrip(linkState(withStyle(s, PARTNER, 'explicit')), day, PARTNER)!
    expect(snap.strip).toMatchObject(shared)
    expect(snap.strip!.windowLabel).toBe('우리의 주간 (예상)')
    expect(snap.strip!.label).toMatch(/^이번 주와 다음 주\. 우리의 주간 \(예상\) 9월 \d+일부터 9월 \d+일까지$/)
    // The moment card itself keeps what she shares (that is in-app behaviour).
    expect(snap.moment!.eyebrow).toBe('가임기 · 9월 13일까지 (예상)')
  })

  it('linkState narrows 자세히 to 우리의 주간 and never widens 날짜 없음; the same object when nothing narrows', () => {
    const s = filled()
    expect(shareLevelOf(s)).toBe('week')
    expect(linkState(s)).toBe(s)
    const narrowed = linkState(share(s))
    expect(shareLevelOf(narrowed)).toBe('week')
    expect({ ...narrowed.settings, shareLevel: 'details' }).toEqual(share(s).settings)
    expect(narrowed.periods).toBe(s.periods)
    const none = noDates(s)
    expect(linkState(none)).toBe(none)
    expect(shareLevelOf(linkState(none))).toBe('none')
  })

  it('날짜 없음: no band and no ideas on any of the seven days, whatever his alert style', () => {
    for (const style of STYLES) {
      const s = noDates(withStyle(filled(), PARTNER, style))
      for (const today of ['2026-09-08', '2026-09-11', '2026-09-20']) {
        const snap = buildPartnerSnapshot(s, today, PARTNER)!
        for (const d of snap.days) {
          expect(d.strip, `${style} ${d.date}`).toBeNull()
          expect(d.ideas, `${style} ${d.date}`).toEqual([])
          expect(JSON.stringify(d), `${style} ${d.date}`).not.toMatch(FERTILE)
        }
      }
    }
  })

  it('is null while a positive test waits, in a rest cycle, in low-pressure mode and when his alerts are off', () => {
    const s = filled()
    const day = '2026-09-11'
    expect(day0(startRestCycle(s, '2026-09-05'), day).strip).toBeNull()
    expect(day0(setPersonalPref(s, PARTNER, 'lowPressure', true), day).strip).toBeNull()
    expect(day0(withStyle(s, PARTNER, 'off'), day).strip).toBeNull()
    const positive = addPregnancyTest(s, { id: 'p', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-27').state
    expect(day0(positive, '2026-09-27').strip).toBeNull()
    expect(day0(s, '2026-10-02').strip).toBeNull()
  })
})

describe('the moment card on the link', () => {
  it('carries labels, never actions, and the veil as his own choice with the words behind it', () => {
    const s = filled()
    const snap = day0(s, '2026-09-11')
    expect(snap.moment).toMatchObject({
      copy: 'partner.our-week',
      title: '이번 주는 우리의 주간이에요',
      secondary: '아이디어 더 보기',
      veiled: false,
    })
    expect('primary' in snap.moment!).toBe(false)
    expect(JSON.stringify(snap.moment)).not.toMatch(/"type"|"kind"|"to"/)
    const veiled = day0(setPersonalPref(s, PARTNER, 'homeDiscreet', true), '2026-09-11')
    expect(veiled.moment!.veiled).toBe(true)
    expect({ ...veiled.moment!, veiled: false }).toEqual(snap.moment)
    expect(VEIL_COPY.title).toBe('오늘도 둘이 함께해요')
  })

  it('says what she told him and nothing before that: period, positive test, bleeding', () => {
    const s = filled()
    expect(day0(s, '2026-09-02').moment!.copy).toBe('partner.neutral')
    expect(day0(tellPartnerPeriod(s, '2026-09-01', NOW), '2026-09-02').moment).toMatchObject({
      copy: 'partner.period-told',
      title: '이번 달은 쉬어 가요',
      partnerTip: expect.stringContaining('고생했어'),
    })
    const positive = addPregnancyTest(s, { id: 'p', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-27').state
    expect(day0(positive, '2026-09-27').moment!.copy).toBe('partner.neutral')
    expect(day0(tellPartnerPositive(positive, stamp('2026-09-26')), '2026-09-27').moment!.copy).toBe(
      'partner.positive-told',
    )
    const bleeding = markBleeding(positive, '2026-09-27')
    expect(day0(bleeding, '2026-09-28').moment!.copy).toBe('partner.neutral')
    expect(day0(tellPartnerBleeding(bleeding, stamp('2026-09-27')), '2026-09-28').moment!.copy).toBe(
      'partner.bleeding-told',
    )
  })

  it('is null outside the preparing stage, and the rest of the page still works', () => {
    const s: AppState = { ...filled(), stage: 'pregnant', pregnancy: { lmp: '2026-09-01', confirmedAt: '2026-09-18' } }
    const snap = day0(s, '2026-09-20')
    expect(snap.moment).toBeNull()
    expect(snap.strip).toBeNull()
    expect(snap.ideas).toEqual([])
    expect(snap.checks.items.length).toBeGreaterThan(0)
    expect(buildPartnerSnapshot(s, '2026-09-20', PARTNER)!.signals.map((x) => x.id)).toEqual(
      signalsFor('pregnant', false).map((x) => x.id),
    )
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
    expect(day0(s, day).ideas).toEqual(ideas)
    // The same gate as the 둘만의 시간 screen: none for a calm viewer or while resting.
    expect(fertileHintsAllowed(setPersonalPref(s, PARTNER, 'lowPressure', true), PARTNER, day)).toBe(false)
    expect(linkIdeas(setPersonalPref(s, PARTNER, 'lowPressure', true), day, PARTNER)).toEqual([])
    expect(day0(s, '2026-09-20').ideas).toEqual([])
  })

  it('carries the cover id only with her opt-in — undefined reads as off — and only when his phone would show it', () => {
    const s = filled()
    const day = '2026-09-11'
    expect(coverOnLink(s.settings)).toBe(false)
    expect(coverOnLink(withCoverOnLink(s, true).settings)).toBe(true)
    expect(coverOnLink({ ...s.settings, ...({ coverOnLink: 'yes' } as object) })).toBe(false)
    expect(day0(s, day).cover).toBeUndefined()
    expect(day0(withCoverOnLink(s, true), day).cover).toEqual({
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
    expect(day0(hidden, day).cover).toBeUndefined()
    expect(day0(withCoverOnLink(s, true), day).together).toBe(coverView(s, PARTNER, day).together)
    expect(day0(s, day).together).toBe(1947)
  })

  it('shows her signal with the replies that fit it, the 해 줄 말 under 이번 달은 아니었어요, and the cheer / done lines', () => {
    const day = '2026-09-20'
    let s = sendSignal(filled(), OWNER, PARTNER, 'not-this-month', day, stamp(day, 8))
    let snap = day0(s, day)
    expect(snap.signal).toMatchObject({ signalId: 'not-this-month', emoji: '🌧️', text: '이번 달은 아니었어요', from: OWNER })
    expect(snap.signal!.replies.map((r) => r.id)).toEqual(['here', 'hug'])
    expect(snap.signal!.tip).toContain('고생했어')
    expect(snap.line).toEqual({ kind: 'signal', text: '지은님이 신호를 보냈어요' })
    // Answered: gone from the page; the day's count went down.
    s = sendSignal(s, PARTNER, OWNER, 'here', day, stamp(day, 9))
    snap = day0(s, day)
    expect(snap.signal).toBeUndefined()
    expect(snap.signalsLeft).toBe(SIGNALS_PER_DAY - 1)
    expect(snap.line).toBeUndefined()
    // A cheer today is the line; the greeting never is (the page's clock makes it).
    expect(day0(sendCheer(filled(), OWNER, PARTNER, stamp(day, 8)), day).line).toEqual({
      kind: 'cheer',
      text: '지은님이 응원을 보냈어요',
    })
    expect(day0(filled(), day).line).toBeUndefined()
  })

  it('lists his checks with today’s state, and her line as numbers plus the 콕 gate', () => {
    const day = '2026-09-10'
    let s = filled()
    const daily = activeItems(s, PARTNER).find((i) => i.label === '30분 걷기')!
    const weekly = activeItems(s, PARTNER).find((i) => i.label === '금주')!
    s = toggleCheck(s, PARTNER, day, daily.id)
    s = toggleCheck(s, PARTNER, '2026-09-08', weekly.id)
    const snap = day0(s, day)
    expect(snap.checks.items.find((i) => i.id === daily.id)).toMatchObject({ label: '30분 걷기', kind: 'habit', weekly: false, done: true })
    expect(snap.checks.items.find((i) => i.id === weekly.id)).toMatchObject({ label: '금주', note: '주 1회', weekly: true, done: true })
    expect(snap.checks.week).toBe(0)
    expect(snap.owner.canNudge).toBe(true)
    expect(JSON.stringify(snap.owner)).not.toContain(OWNER_ITEM)
    // 콕 받기 off, the day's 콕 used up, or nothing left to point at: no button.
    expect(day0(setPersonalPref(s, OWNER, 'acceptNudges', false), day).owner.canNudge).toBe(false)
    let used = s
    for (let i = 0; i < 3; i++) used = sendNudge(used, PARTNER, OWNER, day, stamp(day, 10 + i))
    expect(day0(used, day).owner.canNudge).toBe(false)
    let done = s
    for (const i of activeItems(s, OWNER)) if (i.cadence !== 'weekly') done = toggleCheck(done, OWNER, day, i.id)
    expect(day0(done, day).owner).toMatchObject({ complete: true, canNudge: false })
  })

  it('carries his month task through the chain — applied, booked, visited, claim — never his appointment note', () => {
    let s = filled()
    const booked = day0(s, '2026-09-11').task!
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
    expect(day0(s, '2026-09-26').task!.stage).toBe('visited')
    s = completeMonthlyTask(s, monthlyTask(s, '2026-09-26', PARTNER)!, '2026-09-25', PARTNER)
    const claim = day0(s, '2026-09-26').task!
    expect(claim).toMatchObject({ step: 'claim', stage: 'claim', title: '검사비 청구하기', dueBy: '2026-10-24' })
    expect(claim.docs!.map((d) => d.done)).toEqual([false, false, false, false])
    expect(claim.tip).toBeDefined()
  })
})

describe('validity and the demo couple', () => {
  it('a snapshot is usable for the seven days it carries, not after, and only in its version', () => {
    const snap = buildPartnerSnapshot(filled(), '2026-09-11', PARTNER)!
    expect(snapshotUsable(snap, '2026-09-11')).toBe(true)
    expect(snapshotUsable(snap, '2026-09-12')).toBe(true)
    expect(snapshotUsable(snap, '2026-09-17')).toBe(true)
    expect(snapshotUsable(snap, '2026-09-18')).toBe(false)
    expect(snapshotUsable(snap, '2026-09-10')).toBe(true)
    expect(snapshotUsable({ ...snap, version: 1 as unknown as 2 }, '2026-09-11')).toBe(false)
    expect(snapshotUsable(null, '2026-09-11')).toBe(false)
    expect(snapshotUsable(undefined, '2026-09-11')).toBe(false)
  })

  it('works on the demo couple on 2026-10-02 for 민수, through every lens', { timeout: 120_000 }, () => {
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
      expect(snap.days[0]!.task).toBeDefined()
      expect(snap.days[0]!.checks.items.length).toBe(4)
      expect(snap.days[0]!.week).toBeDefined()
    })
  })
})
