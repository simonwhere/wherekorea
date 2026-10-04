// Next A integration — the adversarial pass over the whole chain:
// a random state through random lenses → the partner snapshot (never a
// private thing, never a lens-forbidden word), random and forged events back
// (rejected or applied once, never touching her data), migrations on random
// v1 / v2 saves (idempotent, every record kept), malformed snapshots / events
// / links (rejected, never a crash), two couples on one mock transport (no
// leak), the Supabase request shaping (never the AppState), the content
// loaders (shapes kept) and the content validator (passes). Seeded, so a
// failure reproduces.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCachedView } from '@/components/link/model'
import { BABY_CHECKED_AT, CHECKUPS, MILESTONES, VACCINE_ANCHORS } from '@/lib/content/baby'
import { DATE_IDEAS, DATE_IDEA_AUDIT } from '@/lib/content/dateIdeas'
import { GUIDE_AUDIT, GUIDE_SECTIONS, SOURCES, guideSections } from '@/lib/content/fertility'
import { PREGNANCY_AUDIT, PRENATAL_CHECKS, WEEKS } from '@/lib/content/pregnancy'
import { FERTILITY_CHECK_GUIDE, PROGRAMS, PROGRAM_AUDIT, programById } from '@/lib/content/programs'
import { MONTH_DEADLINES, ROADMAP, ROADMAP_AUDIT, ROADMAP_PROGRAMS, templateById } from '@/lib/content/roadmap'
import { SUGGESTIONS, SUGGESTION_AUDIT } from '@/lib/content/supplements'
import { addDays, diffDays, isISODate } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { createInitialState } from '@/lib/initial'
import { setCoupleDates } from '@/lib/logic/anniversary'
import { addAppointment, updateAppointment } from '@/lib/logic/appointments'
import { activeItems, addCheckItem, isDone, nudgeableItem, weeklyDone } from '@/lib/logic/checks'
import { startClinicMode } from '@/lib/logic/clinic'
import { coverView, setCover, setHideCover } from '@/lib/logic/cover'
import { addPeriod, setPeriodEnd } from '@/lib/logic/cycle'
import { addEntry, updateEntry } from '@/lib/logic/diary'
import { giveIntimacyConsent, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { addLHTest, addPregnancyTest } from '@/lib/logic/logs'
import { canNudge, inbox, sendCheer, sendNudge } from '@/lib/logic/notifications'
import {
  CHEERS_PER_DAY,
  EVENT_MEMORY_DAYS,
  PARTNER_EVENT_KINDS,
  appointmentJoinKey,
  appointmentJoinNoticeKey,
  appliedEventIds,
  appliedEventKey,
  applyPartnerEvent,
  applyPartnerEvents,
  cleanPartnerEvent,
  forgetOldEvents,
  hasAppliedEvent,
  partnerEventProblem,
  type PartnerEvent,
} from '@/lib/logic/partnerEvents'
import {
  LINK_DAYS,
  cleanCoupleLink,
  coupleLinkOf,
  isLinkStamp,
  linkMatches,
  linkStatus,
  makeLink,
  parseLinkRecord,
  randomToken,
  revokeLinkRecord,
  setCoupleLink,
  sha256Hex,
  tokenFromHash,
} from '@/lib/logic/partnerLink'
import {
  applyReceivedEvents,
  buildPartnerDay,
  buildPartnerSnapshot,
  forecastHold,
  linkState,
  snapshotDay,
  snapshotUsable,
  type PartnerDay,
  type PartnerSnapshot,
} from '@/lib/logic/partnerSnapshot'
import { FERTILITY_TEST_ID, monthlyTask, partnerId, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote, stateForViewer } from '@/lib/logic/personalLog'
import { markBleeding } from '@/lib/logic/positiveBleeding'
import { canSeeWeekBand, coverOnLink, setCoverOnLink, setPersonalPref, setShareLevel, shareLevelOf, setUsesLH } from '@/lib/logic/prefs'
import { addCustomTask } from '@/lib/logic/roadmap'
import { sanitizeBackup } from '@/lib/logic/settings'
import { SIGNALS, pendingSignal, repliesFor, sendSignal, signalById, signalIdOf } from '@/lib/logic/signals'
import { rowProgress } from '@/lib/logic/today'
import { weekOptions } from '@/lib/logic/weekTogether'
import { addTreatment } from '@/lib/logic/treatments'
import { startLossRest, startRestCycle } from '@/lib/logic/ttc'
import {
  bleedingToldKey,
  cycleStrip,
  periodTellState,
  periodToldKey,
  positiveToldKey,
  skipTellPartnerPeriod,
  tellPartnerBleeding,
  tellPartnerPeriod,
  tellPartnerPositive,
  ttcMoment,
  type Moment,
} from '@/lib/logic/ttcFlow'
import { normalize, parseState } from '@/lib/storage'
import { MIGRATIONS, SCHEMA_VERSION, migrate, schemaVersionOf } from '@/lib/sync/migrations'
import {
  DECISION_KEY_RE,
  SYNCED_LISTS,
  cleanDecisions,
  decide,
  decided,
  isDecisionStub,
  lhId,
  periodId,
  stampChanges,
} from '@/lib/sync/model'
import {
  MOCK_SYNC_KEY,
  MockTransportError,
  createMockTransport,
  memoryChannel,
  memoryStorage,
  parseMockStore,
} from '@/lib/sync/mockTransport'
import { createSupabaseTransport, type FetchLike } from '@/lib/sync/supabaseTransport'
import type { AlertStyle, AppNotification, AppState, ISODate, MemberId, ShareLevel } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner).
const OWNER: MemberId = 'b'
const PARTNER: MemberId = 'a'
const stamp = (day: ISODate, hour = 9, minute = 0) => `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`

// ── Owner-only markers: if any of these ever shows up on the link, the lens leaked ──
const PRIVATE_LINE = 'PRIVATE_LINE_9f3a'
const SECRET_ENTRY = 'SECRET_ENTRY_7c21'
const SHARED_ENTRY = 'SHARED_ENTRY_1a11'
const TREATMENT_NOTE = 'TREATMENT_NOTE_4e88'
const APPT_NOTE = 'APPT_NOTE_5d1c'
const HIS_APPT_NOTE = 'HIS_NOTE_2b7e'
/** A '둘이 함께' clinic appointment's title — his clinic week (N32) carries a kind word, never this. */
const CLINIC_TITLE = 'CLINIC_TITLE_3f9e'
const OWNER_ITEM = 'OWNER_ITEM_8a2f'
const CUSTOM_TASK = 'CUSTOM_TASK_3c3c'
const LH_TIME = '04:43'
const TOKEN_HASH_MARK = 'f00d'.repeat(16)
const COUPLE_ID_MARK = 'couple-mark-77aa'
const MARKERS = [
  PRIVATE_LINE,
  SECRET_ENTRY,
  TREATMENT_NOTE,
  APPT_NOTE,
  HIS_APPT_NOTE,
  OWNER_ITEM,
  CUSTOM_TASK,
  LH_TIME,
  TOKEN_HASH_MARK,
  COUPLE_ID_MARK,
]
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야|진단|무월경|유산|자궁외|착상|성공률|정확한 배란|확률/
const FERTILE = /가임기|배란|LH|가능성 높/
/** State keys and model fields that must never appear as JSON keys or words on the link. */
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
  'tokenHash',
  'coupleId',
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
  'decisions',
  'schemaVersion',
  'customTasks',
  'planDone',
  'privateTo',
  'shareCycleDetails',
  'coverOnLink',
  'alertStyle',
  'lowPressure',
]
/** Fields of the owner's that no partner event may touch, by reference. */
const OWNER_FIELDS = [
  'periods',
  'lhTests',
  'pregnancyTests',
  'positivePending',
  'restCycle',
  'cycleNotes',
  'intimacy',
  'personalLog',
  'treatments',
  'leaveDays',
  'settings',
  'couple',
  'diary',
  'pregnancy',
  'cycle',
  'stage',
  'customTasks',
  'anniversaries',
] as const

// ── A seeded generator (mulberry32) ─────────────────────────

type Rng = () => number

function rng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const pick = <T>(r: Rng, list: readonly T[]): T => list[int(r, 0, list.length - 1)]!
const chance = (r: Rng, p: number) => r() < p

function base(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: OWNER,
      ttcStart: '2026-05-01',
    },
    new Date(2026, 7, 1, 9, 0),
  )
}

interface Made {
  state: AppState
  day: ISODate
  lastStart: ISODate
  toldPositive: boolean
  toldBleeding: boolean
  seed: number
}

/**
 * A random couple space: 2–5 cycles, strips, tests (a positive one waits for
 * the clinic now and then, sometimes with bleeding), every owner-only thing
 * with a marker in it, his chain and items, a cover, dates, rests, a
 * pregnancy now and then — and every lens switch thrown at random.
 */
function randomState(seed: number): Made {
  const r = rng(seed)
  let s = base()
  // Cycles: the last one starts 2026-08-20 … 09-25.
  const n = int(r, 2, 5)
  const lastStart = addDays('2026-08-20', int(r, 0, 36))
  const starts: ISODate[] = [lastStart]
  for (let i = 1; i < n; i++) starts.unshift(addDays(starts[0]!, -int(r, 24, 34)))
  for (const st of starts) {
    s = addPeriod(s, st, chance(r, 0.6) ? addDays(st, int(r, 3, 6)) : undefined, OWNER)
  }
  const day = addDays(lastStart, int(r, 0, 40))
  // Her strips, one with the marker time, always in the past.
  for (let i = 0, k = int(r, 0, 4); i < k; i++) {
    const d = addDays(lastStart, int(r, 8, 16))
    if (d > day) continue
    s = addLHTest(
      s,
      {
        date: d,
        result: pick(r, ['negative', 'faint', 'positive', 'peak'] as const),
        time: i === 0 ? LH_TIME : `0${int(r, 6, 9)}:1${int(r, 0, 9)}`,
        by: OWNER,
      },
      day,
    )
  }
  // Tests.
  let toldPositive = false
  let toldBleeding = false
  if (chance(r, 0.3)) {
    const d = addDays(lastStart, int(r, 18, 22))
    if (d <= day) s = addPregnancyTest(s, { id: `neg-${seed}`, date: d, result: 'negative', by: OWNER }, day).state
  }
  if (chance(r, 0.3)) {
    const d = addDays(lastStart, int(r, 22, 30))
    if (d <= day) {
      s = addPregnancyTest(s, { id: `pos-${seed}`, date: d, result: 'positive', by: OWNER }, day).state
      if (chance(r, 0.5)) {
        s = tellPartnerPositive(s, stamp(d, 20))
        toldPositive = true
      }
      const b = addDays(d, int(r, 1, 3))
      if (chance(r, 0.5) && b <= day) {
        s = markBleeding(s, b)
        if (chance(r, 0.5)) {
          s = tellPartnerBleeding(s, stamp(b, 21))
          toldBleeding = true
          toldPositive = true
        }
      }
    }
  }
  // Her answer about the period (told / 괜찮아요 / not yet).
  const answer = int(r, 0, 2)
  if (answer === 1) s = tellPartnerPeriod(s, lastStart, stamp(lastStart, 8))
  if (answer === 2) s = skipTellPartnerPeriod(s, lastStart, stamp(lastStart, 8))
  // Owner-only things, each with a marker.
  for (let i = 0; i < 3; i++) {
    const d = addDays(lastStart, int(r, 0, 20))
    s = setFeel(s, OWNER, d, pick(r, ['tired', 'sensitive', 'breast', 'cramps', 'spotting', 'nausea'] as const))
    s = setPrivateNote(s, OWNER, d, PRIVATE_LINE)
  }
  s = addEntry(
    s,
    { id: `secret-${seed}`, date: addDays(lastStart, 2), author: OWNER, text: SECRET_ENTRY },
    stamp(addDays(lastStart, 2), 20),
  )
  s = setEntryPrivacy(s, `secret-${seed}`, OWNER, true)
  s = addEntry(
    s,
    { id: `shared-${seed}`, date: addDays(lastStart, 3), author: PARTNER, text: SHARED_ENTRY },
    stamp(addDays(lastStart, 3), 21),
  )
  if (chance(r, 0.5)) {
    s = giveIntimacyConsent(s, OWNER, starts[0]!)
    for (let i = 0; i < 3; i++) s = toggleIntimacyDay(s, OWNER, addDays(lastStart, int(r, 5, 18)))
  }
  if (chance(r, 0.4)) {
    s = addTreatment(s, {
      id: `t-${seed}`,
      kind: pick(r, ['iui', 'ivf-fresh', 'ovulation-induction'] as const),
      startDate: starts[0]!,
      endDate: addDays(starts[0]!, 14),
      outcome: 'negative',
      supported: chance(r, 0.5),
      note: TREATMENT_NOTE,
    })
  }
  s = addAppointment(
    s,
    { date: addDays(lastStart, int(r, 1, 30)), time: '09:30', title: '검사', place: '○○병원', who: OWNER, kind: 'test', note: APPT_NOTE },
    OWNER,
  )
  s = addCustomTask(s, { title: CUSTOM_TASK, phase: 'preconception', who: OWNER, due: addDays(day, 3) }, OWNER)
  s = addCheckItem(s, OWNER, OWNER_ITEM, 'medication', starts[0]!, '아침')
  // His side: items, his chain, his booked test with a note of his own.
  s = addCheckItem(s, PARTNER, '30분 걷기', 'habit', starts[0]!)
  s = addCheckItem(s, PARTNER, '금주', 'habit', starts[0]!, '주 1회', 'weekly')
  if (chance(r, 0.7)) {
    s = setFertilityApplied(s, PARTNER, true, addDays(starts[0]!, 2))
    if (chance(r, 0.6)) {
      s = addAppointment(
        s,
        {
          date: addDays(lastStart, int(r, 5, 30)),
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
    }
  }
  // A clinic appointment they both go to (his clinic week shows it with a kind word; the title and note stay home).
  if (chance(r, 0.5)) {
    s = addAppointment(
      s,
      { date: addDays(day, int(r, -2, 8)), time: '08:30', title: CLINIC_TITLE, place: '○○의원', who: 'both', kind: 'hospital', note: APPT_NOTE },
      OWNER,
    )
  }
  if (chance(r, 0.6)) s = setCover(s, { photoId: 'builtin:hangang', focusY: int(r, 0, 100), caption: '우리 둘' }, OWNER, starts[0]!)
  if (chance(r, 0.6)) s = setCoupleDates(s, { metDate: '2021-05-14', ...(chance(r, 0.5) ? { marriedDate: '2024-10-12' } : {}) })
  // Rests / clinic / after a loss / pregnant — now and then.
  const mode = r()
  if (mode < 0.08) s = startRestCycle(s, addDays(lastStart, 2), 'rest')
  else if (mode < 0.14) s = startRestCycle(s, addDays(lastStart, 2), 'vaccine')
  else if (mode < 0.2) s = startClinicMode(s, addDays(lastStart, 1))
  else if (mode < 0.26)
    s = startLossRest(
      { ...s, pregnancy: { lmp: starts[0]!, confirmedAt: addDays(starts[0]!, 30), endedAt: addDays(lastStart, -3) } },
      addDays(lastStart, -3),
    )
  else if (mode < 0.32) s = { ...s, stage: 'pregnant', pregnancy: { lmp: lastStart, confirmedAt: addDays(lastStart, 20) } }
  // Signals, cheers, a 콕 — today or yesterday.
  if (chance(r, 0.35))
    s = sendSignal(s, OWNER, PARTNER, pick(r, ['comfort', 'clinic', 'rest', 'thanks', 'not-this-month']), day, stamp(day, 8))
  if (chance(r, 0.3)) s = sendCheer(s, OWNER, PARTNER, stamp(day, 8, 30))
  if (chance(r, 0.2)) s = sendNudge(s, PARTNER, OWNER, day, stamp(day, 8, 40), OWNER_ITEM)
  if (chance(r, 0.3)) s = sendSignal(s, PARTNER, OWNER, 'thanks', addDays(day, -1), stamp(addDays(day, -1), 19))
  // The lens switches, at random.
  const styles: AlertStyle[] = ['explicit', 'soft', 'off']
  s = {
    ...s,
    settings: {
      ...s.settings,
      alertStyle: { a: pick(r, styles), b: pick(r, styles) },
      lowPressure: chance(r, 0.3),
      discreet: chance(r, 0.3),
    },
  }
  if (chance(r, 0.5)) s = setPersonalPref(s, PARTNER, 'lowPressure', chance(r, 0.5))
  if (chance(r, 0.5)) s = setPersonalPref(s, PARTNER, 'homeDiscreet', chance(r, 0.5))
  if (chance(r, 0.5)) s = setPersonalPref(s, PARTNER, 'discreet', chance(r, 0.5))
  if (chance(r, 0.5)) s = setPersonalPref(s, OWNER, 'acceptNudges', chance(r, 0.5))
  if (chance(r, 0.3)) s = setHideCover(s, PARTNER, chance(r, 0.5))
  s = setShareLevel(s, OWNER, pick(r, ['none', 'week', 'details'] as const))
  s = setCoverOnLink(s, OWNER, chance(r, 0.5))
  if (chance(r, 0.5)) s = setUsesLH(s, pick(r, [true, false, 'later'] as const), OWNER)
  s = {
    ...s,
    settings: { ...s.settings, ...(chance(r, 0.3) ? { memories: true } : {}), ...(chance(r, 0.3) ? { showTryCount: true } : {}) },
  }
  // The link's own record in the state: its facts, never on the link itself.
  s = setCoupleLink(s, {
    coupleId: COUPLE_ID_MARK,
    tokenHash: TOKEN_HASH_MARK,
    createdAt: stamp(day, 7),
    expiresAt: stamp(addDays(day, LINK_DAYS), 7),
  })
  return { state: s, day, lastStart, toldPositive, toldBleeding, seed }
}

// ── The snapshot, checked against every rule ────────────────

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
        // 해 줄 말 (N30): only a card she told him about carries it; the answers as catalogue signals.
        ...(m.say
          ? {
              say: {
                say: m.say.say,
                save: m.say.save,
                replies: m.say.replies.map((id) => ({ ...signalById(id)! })),
                ...(m.say.sent ? { sent: m.say.sent } : {}),
              },
            }
          : {}),
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
  // His clinic week (N32): the couple's own appointment days — not cycle dates.
  const clinic = copy.clinic as { appointments: Array<Record<string, unknown>> } | undefined
  if (clinic) for (const a of clinic.appointments) delete a.date
  return JSON.stringify(copy)
}

const calm = (s: AppState) =>
  s.settings.alertStyle[PARTNER] !== 'explicit' ||
  (s.settings.personal?.[PARTNER]?.lowPressure ?? s.settings.lowPressure) ||
  shareLevelOf(s) === 'none'

/** One date's page: nothing owner-only, nothing beyond the lens, nothing she did not tell. */
function checkDayPrivacy(m: Made, s: AppState, d: PartnerDay, tag: string): void {
  const json = JSON.stringify(d)
  for (const w of [...MARKERS, s.couple.inviteCode, ...FORBIDDEN_KEYS]) expect(json.includes(w), `${tag}: ${w}`).toBe(false)
  const personal = JSON.stringify({ ...d, signal: undefined })
  for (const w of Object.values(FEEL_LABEL)) expect(personal.includes(w), `${tag}: ${w}`).toBe(false)
  expect(json, tag).not.toMatch(BANNED)
  expect(json, tag).not.toMatch(/관계|LH/)
  expect(redacted(d), tag).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  if (calm(s)) expect(json, tag).not.toMatch(FERTILE)
  if (shareLevelOf(s) !== 'details') {
    expect(json, tag).not.toMatch(/생리/)
    expect(json, tag).not.toMatch(/\d+일째/)
  }
  if (!canSeeWeekBand(s, PARTNER)) {
    expect(d.strip, tag).toBeNull()
    expect(d.ideas, tag).toEqual([])
  }
  if (!m.toldPositive) expect(json, tag).not.toMatch(/양성/)
  if (!m.toldBleeding) expect(json, tag).not.toMatch(/출혈/)
  if (d.strip) {
    expect(d.strip.view, tag).not.toBe('explicit')
    for (const x of d.strip.days) {
      expect(x.lh, tag).toBeUndefined()
      expect(['none', 'fertile'], tag).toContain(x.tone)
    }
  }
  if (d.moment?.support) {
    expect(d.task, tag).toBeUndefined()
    expect(d.week, tag).toBeUndefined()
    expect(d.clinic, tag).toBeUndefined()
    expect(d.myPrep, tag).toBeUndefined()
  }
  // His clinic week (N32): only his and '둘이 함께' appointments, as day · time · place · kind word — never a title or a note.
  if (d.clinic) {
    const cj = JSON.stringify(d.clinic)
    for (const w of [CLINIC_TITLE, APPT_NOTE, HIS_APPT_NOTE, TREATMENT_NOTE, '정액검사', '"title"']) expect(cj.includes(w), `${tag}: clinic ${w}`).toBe(false)
    for (const a of d.clinic.appointments) {
      const src = s.appointments.find((x) => x.id === a.id)!
      expect(src, tag).toBeDefined()
      expect(src.who === 'both' || src.who === PARTNER, tag).toBe(true)
      expect(Object.keys(a).every((k) => ['id', 'date', 'time', 'place', 'label', 'with', 'joined'].includes(k)), tag).toBe(true)
    }
    expect(d.clinic.leave.source.url, tag).toMatch(/^https:\/\//)
  }
}

/**
 * The seven-day snapshot: the first page as the app has it that day, every
 * later page the same as that date's own page (or, for a phase only a
 * prediction brings, the day before held), and every page private.
 * `full`: also compare every future page with its same-day page and the
 * partner-side state (slower — the random walk does it, the switch table
 * samples it).
 */
function checkSnapshot(m: Made, tag: string, full = true): PartnerSnapshot {
  const { state: s, day } = m
  const snap = buildPartnerSnapshot(s, day, PARTNER)
  expect(snap, tag).not.toBeNull()
  const json = JSON.stringify(snap)
  expect(JSON.parse(json), tag).toEqual(snap)
  expect(snapshotUsable(snap, day), tag).toBe(true)
  expect(snapshotUsable(snap, addDays(day, 6)), tag).toBe(true)
  expect(snapshotUsable(snap, addDays(day, 7)), tag).toBe(false)
  expect(snap!.days.map((d) => d.date), tag).toEqual(Array.from({ length: 7 }, (_, k) => addDays(day, k)))
  // Her view is never published.
  expect(buildPartnerSnapshot(s, day, OWNER), tag).toBeNull()
  for (const w of [...MARKERS, s.couple.inviteCode, ...FORBIDDEN_KEYS, 'shareLevel']) expect(json.includes(w), `${tag}: ${w}`).toBe(false)

  // Today's page: the card is ttcMoment's, word for word; the strip the shared band or nothing.
  const d0 = snap!.days[0]!
  expect(d0.moment, tag).toEqual(projected(ttcMoment(s, day, PARTNER, { surface: 'link' })))
  const expectedStrip = canSeeWeekBand(s, PARTNER) ? cycleStrip(linkState(s), day, PARTNER) : null
  if (expectedStrip && expectedStrip.mode === 'weeks') expect(d0.strip, tag).toMatchObject(expectedStrip)
  else expect(d0.strip, tag).toBeNull()
  // The cover: her opt-in AND his own phone would show the photo.
  const view = coverView(s, PARTNER, day)
  if (coverOnLink(s.settings) && view.mode === 'photo') expect(d0.cover, tag).toEqual(view.photo)
  else expect(d0.cover, tag).toBeUndefined()
  // His checks, her numbers, the signal and his task as the app has them.
  const items = activeItems(s, PARTNER)
  expect(
    d0.checks.items.map((i) => i.id),
    tag,
  ).toEqual(items.map((i) => i.id))
  for (const row of d0.checks.items) {
    const item = items.find((i) => i.id === row.id)!
    expect(row.done, tag).toBe(row.weekly ? weeklyDone(s, PARTNER, item.id, day) : isDone(s, PARTNER, day, item.id))
  }
  const ownerProg = rowProgress(s, OWNER, day)
  expect(d0.owner, tag).toEqual({
    name: '지은',
    done: ownerProg.done,
    total: ownerProg.total,
    complete: ownerProg.complete,
    canNudge: !!nudgeableItem(s, OWNER, day) && canNudge(s, PARTNER, OWNER, day),
  })
  const pending = pendingSignal(s, PARTNER, day)
  if (pending) expect(d0.signal, tag).toMatchObject({ from: OWNER, at: pending.createdAt })
  else expect(d0.signal, tag).toBeUndefined()
  const task = monthlyTask(s, day, PARTNER)
  if (d0.task) {
    expect(task, tag).toBeDefined()
    expect(d0.task, tag).toMatchObject({ id: task!.id, title: task!.title })
    if (task!.appointment) expect('note' in d0.task.appointment!, tag).toBe(false)
  }
  expect(d0.week?.options.map((o) => o.id), tag).toEqual(weekOptions(s, day, PARTNER).length ? weekOptions(s, day, PARTNER).map((o) => o.id) : undefined)

  const todayKind = ttcMoment(s, day, PARTNER)?.kind
  snap!.days.forEach((d, k) => {
    const t = `${tag} +${k}`
    checkDayPrivacy(m, s, d, t)
    if (!full || k === 0) return
    const held = forecastHold(todayKind, ttcMoment(s, d.date, PARTNER)?.kind)
    const same = buildPartnerDay(s, d.date, PARTNER)!
    if (held) {
      expect({ ...d, moment: null, strip: null, ideas: [] }, t).toEqual({ ...same, moment: null, strip: null, ideas: [] })
      expect(d.moment?.copy, t).not.toBe('partner.late-shared')
    } else expect(d, t).toEqual(same)
  })
  // Everything on the link is something the partner's own phone may hold: the
  // same snapshot comes out of the state the partner's screens read.
  if (full) expect(buildPartnerSnapshot(stateForViewer(s, PARTNER), day, PARTNER), tag).toEqual(snap)
  return snap!
}

describe('the partner snapshot never carries owner-only or lens-forbidden data — random states × random lenses × seven days', () => {
  it('for 160 random couple spaces (seeded)', { timeout: 300_000 }, () => {
    let covers = 0
    let told = 0
    let strips = 0
    let weeks = 0
    const copies = new Set<string>()
    const levels = new Set<ShareLevel>()
    for (let seed = 1; seed <= 160; seed++) {
      const m = randomState(seed)
      const snap = checkSnapshot(m, `seed ${seed} (${m.day})`)
      const d0 = snap.days[0]!
      if (d0.cover) covers++
      if (m.toldPositive || m.toldBleeding) told++
      strips += snap.days.filter((d) => d.strip).length
      if (d0.week) weeks++
      if (d0.moment) copies.add(d0.moment.copy)
      levels.add(shareLevelOf(m.state))
    }
    expect([...levels].sort()).toEqual(['details', 'none', 'week'])
    expect(weeks).toBeGreaterThan(20)
    // The random walk really went places.
    expect(covers).toBeGreaterThan(5)
    expect(told).toBeGreaterThan(5)
    expect(strips).toBeGreaterThan(30)
    expect(copies.size).toBeGreaterThanOrEqual(7)
  })

  it('for every combination of the lens switches on four moments of one space', { timeout: 300_000 }, () => {
    const switches: Array<(s: AppState, on: boolean) => AppState> = [
      (s, on) => setPersonalPref(s, PARTNER, 'lowPressure', on),
      (s, on) => setPersonalPref(s, PARTNER, 'homeDiscreet', on),
      (s, on) => setPersonalPref(s, PARTNER, 'discreet', on),
      (s, on) => setCoverOnLink(s, OWNER, on),
      (s, on) => setPersonalPref(s, OWNER, 'acceptNudges', on),
      (s, on) => ({ ...s, settings: { ...s.settings, lowPressure: on } }),
    ]
    const made = [randomState(7), randomState(23), randomState(41), randomState(58)]
    let count = 0
    for (const style of ['explicit', 'soft', 'off'] as const) {
      for (const level of ['none', 'week', 'details'] as const) {
        for (let bits = 0; bits < 1 << switches.length; bits++) {
          for (const m of made) {
            let s = { ...m.state, settings: { ...m.state.settings, alertStyle: { ...m.state.settings.alertStyle, [PARTNER]: style } } }
            s = setShareLevel(s, OWNER, level)
            switches.forEach((f, i) => {
              s = f(s, !!(bits & (1 << i)))
            })
            // Every page private; the full same-day comparison on a sample (the random walk does all of it).
            checkSnapshot({ ...m, state: s }, `seed ${m.seed} ${style} ${level} bits ${bits.toString(2)}`, count % 9 === 0)
            count++
          }
        }
      }
    }
    expect(count).toBe(3 * 3 * 64 * 4)
  })
})

// ── Events back: forged ones dropped, real ones once, her data untouched ──

/**
 * Her data is untouched by reference — except that a 'setup' event may set
 * HIS alert style (settings.alertStyle[partner], his own choice): then the
 * settings may be a new object, equal to the old one but for that one value.
 */
function sameOwnerData(before: AppState, after: AppState, tag: string, ev?: PartnerEvent) {
  for (const k of OWNER_FIELDS) {
    if (k === 'settings' && ev?.kind === 'setup' && after.settings !== before.settings) {
      const { alertStyle: a, ...restAfter } = after.settings
      const { alertStyle: b, ...restBefore } = before.settings
      expect(restAfter, `${tag} settings`).toEqual(restBefore)
      expect(a[OWNER], `${tag} her alert style`).toBe(b[OWNER])
      expect(a[PARTNER], `${tag} his alert style`).toBe(ev.alertStyle)
      continue
    }
    expect(after[k], `${tag} ${k}`).toBe(before[k])
  }
}

/** A raw event as a transport might hand it over — right, slightly off, or forged. */
function randomRawEvent(r: Rng, s: AppState, day: ISODate): Record<string, unknown> {
  const his = activeItems(s, PARTNER)
  const hers = activeItems(s, OWNER)
  const pending = pendingSignal(s, PARTNER, day)
  const task = monthlyTask(s, day, PARTNER)
  const kind = pick(r, [
    ...PARTNER_EVENT_KINDS,
    ...PARTNER_EVENT_KINDS,
    'period',
    'lh',
    'test',
    'rest',
    'share',
    'intimacy',
    'note',
    'cover',
    'settings',
    'delete',
    'CHECK',
    '',
    42,
    undefined,
  ])
  const id = pick(r, [`e${int(r, 1, 999)}`, `e${int(r, 1, 999)}`, 'a'.repeat(65), 'has space', '한글', 7, '', `ok:${int(r, 1, 9)}`])
  const ev: Record<string, unknown> = { id, kind }
  const from = pick(r, [undefined, undefined, PARTNER, OWNER, 'x', 1])
  if (from !== undefined) ev.from = from
  const date = pick(r, [day, day, addDays(day, -int(r, 1, 6)), addDays(day, 1), addDays(day, -12), 'bad', 20261002])
  switch (kind) {
    case 'check':
      ev.itemId = pick(r, [his[0]?.id, his[1]?.id, hers[0]?.id, 'nope', 9])
      ev.date = date
      ev.done = pick(r, [true, false, 'yes', 1])
      break
    case 'reply':
      ev.signalId = pick(r, [pending ? signalIdOf(pending) : 'thanks', 'thanks', 'not-this-month', 'nope'])
      ev.replyId = pick(r, [repliesFor(ev.signalId as string)[0]?.id ?? 'ok', 'rest', 'nope', ''])
      break
    case 'signal':
      ev.signalId = pick(r, [...SIGNALS.map((x) => x.id), 'not-this-month', 'comfort', 'nope'])
      break
    case 'task-done':
      ev.taskId = pick(r, [task?.id ?? 'none', FERTILITY_TEST_ID, 'x'])
      ev.date = date
      break
    case 'week-pick': {
      const offered = weekOptions(s, day, PARTNER).map((o) => o.id)
      ev.optionId = pick(r, [...offered, ...offered, 'clinic-day', 'chore', 'nope', 7])
      ev.date = date
      break
    }
    case 'week-done':
      ev.date = date
      break
    case 'setup':
      ev.habits = pick(r, [
        { smokes: false, drinks: 'no' },
        { smokes: true },
        { drinks: 'often' },
        {},
        { smokes: 'yes' },
        { drinks: 'daily' },
        'habits',
        { smokes: false, extra: PRIVATE_LINE },
      ])
      if (chance(r, 0.7)) ev.alertStyle = pick(r, ['explicit', 'soft', 'off', 'loud', 3])
      break
    case 'join-appointment':
      ev.appointmentId = pick(r, [...s.appointments.map((a) => a.id), ...s.appointments.map((a) => a.id), 'nope', 'has space', 9, undefined])
      break
    case 'period':
    case 'lh':
    case 'test':
      ev.date = date
      ev.result = 'positive'
      ev.start = date
      break
    default:
      break
  }
  if (chance(r, 0.3)) ev.text = 'free text 🙂'
  if (chance(r, 0.2)) ev.note = PRIVATE_LINE
  if (chance(r, 0.1)) ev.shareCycleDetails = true
  return ev
}

const ALLOWED_KEYS: Record<PartnerEvent['kind'], string[]> = {
  check: ['id', 'from', 'kind', 'itemId', 'date', 'done'],
  reply: ['id', 'from', 'kind', 'signalId', 'replyId'],
  signal: ['id', 'from', 'kind', 'signalId'],
  nudge: ['id', 'from', 'kind'],
  cheer: ['id', 'from', 'kind'],
  'task-done': ['id', 'from', 'kind', 'taskId', 'date'],
  'week-pick': ['id', 'from', 'kind', 'optionId', 'date'],
  'week-done': ['id', 'from', 'kind', 'date'],
  setup: ['id', 'from', 'kind', 'habits', 'alertStyle'],
  'join-appointment': ['id', 'from', 'kind', 'appointmentId'],
}

describe('partner events: everything outside the allowed kinds is rejected, everything else applies once and never touches her data', () => {
  it('for 60 random spaces × 24 random or forged events each (seeded)', () => {
    let applied = 0
    let dropped = 0
    let rejected = 0
    for (let seed = 1000; seed < 1060; seed++) {
      const r = rng(seed)
      const m = randomState(seed)
      const { day } = m
      let s = m.state
      const cleaned: PartnerEvent[] = []
      for (let i = 0; i < 24; i++) {
        const raw = randomRawEvent(r, s, day)
        const tag = `seed ${seed} #${i} ${JSON.stringify(raw)}`
        const ev = cleanPartnerEvent(raw)
        if (!(PARTNER_EVENT_KINDS as readonly unknown[]).includes(raw.kind)) {
          expect(ev, tag).toBeUndefined()
        }
        if (!ev) {
          dropped++
          continue
        }
        // Only that kind's fields survive the parser; free text never does.
        expect(
          Object.keys(ev).every((k) => ALLOWED_KEYS[ev.kind].includes(k)),
          tag,
        ).toBe(true)
        expect(JSON.stringify(ev), tag).not.toMatch(/free text|PRIVATE_LINE|shareCycleDetails|extra/)
        cleaned.push(ev)
        const problem = partnerEventProblem(s, ev, day)
        const next = applyPartnerEvent(s, ev, day)
        sameOwnerData(s, next, tag, ev)
        if (ev.from === OWNER) {
          expect(problem, tag).toBe('actor')
          expect(next, tag).toBe(s)
        }
        if (problem !== null) {
          expect(next, tag).toBe(s)
          rejected++
        } else if (next === s) {
          // A 'check' that sets what is already there: one answer, nothing to remember (partnerEvents: a set, not a toggle).
          expect(ev.kind, tag).toBe('check')
          rejected++
        } else {
          applied++
          expect(hasAppliedEvent(next, ev.id), tag).toBe(true)
          expect(next.decisions[appliedEventKey(ev.id)], tag).toBe(day)
          expect(partnerEventProblem(next, ev, day), tag).toBe('applied')
          // Once: the same event again (and under a fresh batch) changes nothing.
          expect(applyPartnerEvent(next, ev, day), tag).toBe(next)
          expect(applyPartnerEvents(next, [ev, ev], day), tag).toBe(next)
          // The only new decisions are the event's own mark (and, for 이번 주 우리 둘, its week key;
          // for 'setup', that the first run was answered on the link — onboarding.PARTNER_SETUP_KEY;
          // for [같이 갈게요], his answer to that one appointment — partnerEvents.appointmentJoinKey).
          const newKeys = Object.keys(next.decisions).filter((k) => !(k in s.decisions))
          const weekKeys = newKeys.filter((k) => k.startsWith('week-pick:') || k.startsWith('week-done:'))
          const joinKey = ev.kind === 'join-appointment' ? appointmentJoinKey(ev.appointmentId, PARTNER) : undefined
          expect(
            newKeys.filter((k) => !weekKeys.includes(k) && !(ev.kind === 'setup' && k === 'partner-setup') && k !== joinKey),
            tag,
          ).toEqual([appliedEventKey(ev.id)])
          if (joinKey) {
            expect(next.decisions[joinKey], tag).toBe(day)
            const a = s.appointments.find((x) => x.id === (ev as { appointmentId: string }).appointmentId)!
            expect(a.who, tag).toBe('both')
            expect(a.date >= day, tag).toBe(true)
            // Her one 🔔: day, time, place — never the title or the note.
            const bell = next.notifications.find((n) => n.key === appointmentJoinNoticeKey(a.id, PARTNER))!
            expect(bell, tag).toMatchObject({ to: OWNER, from: PARTNER, kind: 'system' })
            expect(`${bell.title} ${bell.body}`, tag).not.toMatch(new RegExp(`${CLINIC_TITLE}|${APPT_NOTE}`))
            expect(next.appointments, tag).toBe(s.appointments)
          }
          if (ev.kind === 'week-pick') expect(weekKeys.every((k) => k.startsWith(`week-pick:`) && k.endsWith(`:${PARTNER}:${ev.optionId}`)), tag).toBe(true)
          else if (ev.kind === 'week-done') expect(weekKeys.every((k) => k.endsWith(`:${PARTNER}`)), tag).toBe(true)
          else expect(weekKeys, tag).toEqual([])
          // Notifications it created (a reply, a 콕, an 응원, 'done') are to her or him — never a stub.
          for (const n of next.notifications.filter((x) => !s.notifications.includes(x))) {
            expect(isDecisionStub(n), tag).toBe(false)
            expect(n.title.length > 0 || n.body.length > 0, tag).toBe(true)
          }
        }
        s = next
      }
      // The applied ones again are a no-op (once per id); the ids it holds are exactly the applied ones.
      // (A rejected one may apply on a replay when an earlier refusal was about order — [했어요] before the
      // pick — which is the transport's re-delivery working, not a repeat.)
      expect(applyPartnerEvents(s, cleaned.filter((e) => hasAppliedEvent(s, e.id)), day)).toBe(s)
      expect(appliedEventIds(s, cleaned).every((id) => hasAppliedEvent(s, id))).toBe(true)
      if (!cleaned.some((e) => e.kind === 'setup' && e.alertStyle)) sameOwnerData(m.state, s, `seed ${seed} end`)
      // Her screen of her own data is untouched too.
      expect(stateForViewer(s, OWNER).personalLog).toEqual(m.state.personalLog)
    }
    expect(applied).toBeGreaterThan(50)
    expect(rejected).toBeGreaterThan(100)
    expect(dropped).toBeGreaterThan(100)
  })

  it('the applied-once marks are decisions, bounded by EVENT_MEMORY_DAYS, and the daily caps hold on the link', () => {
    const m = randomState(5)
    let s = m.state
    const day = m.day
    // 응원 is capped on the link (the app has no cap).
    for (let i = 0; i < CHEERS_PER_DAY + 3; i++) s = applyPartnerEvent(s, { id: `cheer-${i}`, kind: 'cheer' }, day)
    expect(inbox(s, OWNER).filter((n) => n.kind === 'cheer' && !n.key && n.createdAt.startsWith(day))).toHaveLength(CHEERS_PER_DAY)
    expect(Object.keys(s.decisions).filter((k) => k.startsWith('partner-event:'))).toHaveLength(CHEERS_PER_DAY)
    // Old marks are forgotten once something new is applied; recent ones stay.
    const old = addDays(day, -EVENT_MEMORY_DAYS - 1)
    const recent = addDays(day, -EVENT_MEMORY_DAYS + 1)
    const aged = {
      ...s,
      decisions: {
        ...s.decisions,
        [appliedEventKey('old')]: old,
        [appliedEventKey('recent')]: recent,
        'period-told:2020-01-01': '2020-01-02',
      },
    }
    expect(forgetOldEvents(aged, day).decisions[appliedEventKey('old')]).toBeUndefined()
    expect(forgetOldEvents(aged, day).decisions[appliedEventKey('recent')]).toBe(recent)
    // Other decision families are never touched by the sweep.
    expect(forgetOldEvents(aged, day).decisions['period-told:2020-01-01']).toBe('2020-01-02')
    expect(forgetOldEvents(s, day)).toBe(s)
    const later = applyPartnerEvents(aged, [{ id: 'new', kind: 'signal', signalId: 'thanks' }], addDays(day, 1))
    expect(later.decisions[appliedEventKey('old')]).toBeUndefined()
    expect(later.decisions[appliedEventKey('new')]).toBe(addDays(day, 1))
    // A legacy stub (a v2 save) still counts as applied through decided()'s fallback.
    const stub: AppNotification = {
      id: 'n',
      to: OWNER,
      kind: 'system',
      title: '',
      body: '',
      createdAt: stamp(day),
      key: appliedEventKey('legacy'),
      read: true,
      dismissed: true,
    }
    const legacy = { ...s, notifications: [stub, ...s.notifications] }
    expect(hasAppliedEvent(legacy, 'legacy')).toBe(true)
    expect(applyPartnerEvent(legacy, { id: 'legacy', kind: 'cheer' }, day)).toBe(legacy)
  })
})

// ── Migrations: idempotent, every record kept, v1 and v2 saves round-trip ──

/** A save exactly as the app wrote it before Next A: no schemaVersion, no decisions, no ids / stamps, decisions as stubs, the rebase marks inside. */
function v1Blob(s: AppState): Record<string, unknown> {
  const stripMarks = <R extends { id?: string; updatedAt?: string; deletedAt?: string }>(r: R) => {
    const { updatedAt: _u, deletedAt: _d, ...rest } = r
    return rest
  }
  const dropId = <R extends { id?: string }>(r: R) => {
    const { id: _i, ...rest } = r
    return rest
  }
  const stubs: AppNotification[] = Object.entries(s.decisions).map(([key, day], i) => ({
    id: `stub-${i}`,
    to: OWNER,
    kind: 'system',
    title: '',
    body: '',
    createdAt: stamp(day, 9),
    key,
    read: true,
    dismissed: true,
  }))
  const { schemaVersion: _v, decisions: _d, ...rest } = s
  return JSON.parse(
    JSON.stringify({
      ...rest,
      periods: s.periods.map((p) => dropId(stripMarks(p))),
      lhTests: s.lhTests.map((t) => dropId(stripMarks(t))),
      pregnancyTests: s.pregnancyTests.map(stripMarks),
      appointments: s.appointments.map(stripMarks),
      diary: s.diary.map(stripMarks),
      customTasks: s.customTasks.map(stripMarks),
      ...(s.treatments ? { treatments: s.treatments.map(stripMarks) } : {}),
      notifications: [...stubs, ...s.notifications],
      sync: { tab1: 3, tab2: 9 },
    }),
  )
}

const noMarks = <R extends { id?: string; updatedAt?: string; deletedAt?: string }>(r: R) => {
  const { id: _i, updatedAt: _u, deletedAt: _d, ...rest } = r
  return rest
}

describe('migrations are idempotent and a v1 / v2 save round-trips with every record', () => {
  it('for 40 random spaces (seeded): v1 → current keeps every record, fills ids and stamps, moves the stubs, drops the marks', () => {
    expect(MIGRATIONS.map((m) => [m.from, m.to])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ])
    expect(SCHEMA_VERSION).toBe(4)
    for (let seed = 2000; seed < 2040; seed++) {
      const m = randomState(seed)
      const s = m.state
      const tag = `seed ${seed}`
      const blob = v1Blob(s)
      const raw = JSON.stringify(blob)
      const out = parseState(raw)!
      expect(out, tag).not.toBeNull()
      expect(out.schemaVersion, tag).toBe(SCHEMA_VERSION)
      expect('sync' in out, tag).toBe(false)
      // Every record, in order, with its content; ids and a stamp on each.
      expect(out.periods.map(noMarks), tag).toEqual(s.periods.map(noMarks))
      expect(
        out.periods.map((p) => p.id),
        tag,
      ).toEqual(s.periods.map((p) => periodId(p.start)))
      expect(out.lhTests.map(noMarks), tag).toEqual(s.lhTests.map(noMarks))
      expect(
        out.lhTests.map((t) => t.id),
        tag,
      ).toEqual(s.lhTests.map((t) => lhId(t)))
      for (const key of SYNCED_LISTS) {
        const list = out[key] ?? []
        const before = s[key] ?? []
        expect(list.length, `${tag} ${key}`).toBe(before.length)
        for (const r of list) {
          expect(typeof r.id, `${tag} ${key}`).toBe('string')
          expect(r.updatedAt, `${tag} ${key}`).toBe(s.createdAt)
          expect('deletedAt' in r, `${tag} ${key}`).toBe(false)
        }
      }
      expect(out.pregnancyTests.map(noMarks), tag).toEqual(s.pregnancyTests.map(noMarks))
      expect(out.appointments.map(noMarks), tag).toEqual(s.appointments.map(noMarks))
      expect(out.diary.map(noMarks), tag).toEqual(s.diary.map(noMarks))
      expect(out.customTasks.map(noMarks), tag).toEqual(s.customTasks.map(noMarks))
      // Decisions came back from the stubs (same keys, their days); the stubs are gone; the real notices stay.
      expect(out.decisions, tag).toEqual(s.decisions)
      expect(out.notifications.some(isDecisionStub), tag).toBe(false)
      expect(
        out.notifications.map((n) => n.id),
        tag,
      ).toEqual(s.notifications.map((n) => n.id))
      expect(periodTellState(out, m.lastStart), tag).toBe(periodTellState(s, m.lastStart))
      // The owner-only fields survive a backup intact.
      expect(out.personalLog, tag).toEqual(s.personalLog)
      expect(out.intimacy, tag).toEqual(s.intimacy)
      expect(out.couple.link, tag).toEqual(s.couple.link)
      expect(out.settings, tag).toEqual(s.settings)
      // Idempotent: the second pass is byte-identical; the chain on its own too.
      const again = parseState(JSON.stringify(out))!
      expect(JSON.stringify(again), tag).toBe(JSON.stringify(out))
      expect(migrate(out), tag).toBe(out)
      expect(sanitizeBackup(JSON.parse(JSON.stringify(out))), tag).toEqual(out)
      // The partner link reads the same page off the migrated state.
      expect(buildPartnerSnapshot(out, m.day, PARTNER), tag).toEqual(buildPartnerSnapshot(s, m.day, PARTNER))
    }
  })

  it('a v2 save (ids and stamps in place, stubs and marks still there) goes to v3 the same way; a current save is the identity', () => {
    for (let seed = 2100; seed < 2110; seed++) {
      const m = randomState(seed)
      const s = m.state
      const v2 = { ...migrate(v1Blob(s) as unknown as AppState, MIGRATIONS.slice(0, 1)), decisions: {} }
      expect(v2.schemaVersion).toBe(2)
      const out = parseState(JSON.stringify(v2))!
      expect(out.schemaVersion).toBe(SCHEMA_VERSION)
      expect(out.decisions).toEqual(s.decisions)
      expect('sync' in out).toBe(false)
      expect(out.notifications.some(isDecisionStub)).toBe(false)
      expect(JSON.stringify(parseState(JSON.stringify(out)))).toBe(JSON.stringify(out))
      // A state the app builds today is canonical as it is.
      expect(parseState(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
    }
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      const demo = createDemoState('2026-10-02', new Date('2026-10-02T09:00:00+09:00'), stage)
      expect(demo.schemaVersion).toBe(SCHEMA_VERSION)
      expect(parseState(JSON.stringify(demo))).toEqual(JSON.parse(JSON.stringify(demo)))
      expect('sync' in demo).toBe(false)
      expect(demo.notifications.some(isDecisionStub)).toBe(false)
    }
  })

  it('the migration never reads a record it does not understand into a crash: junk lists and odd versions', () => {
    const s = randomState(3).state
    const odd = {
      ...v1Blob(s),
      schemaVersion: 'three',
      periods: [{ start: 'nope' }, 7, null, { start: '2026-09-01', id: 5 }],
      lhTests: 'x',
      notifications: [
        null,
        {
          id: 'n',
          to: 'b',
          kind: 'system',
          title: '',
          body: '',
          createdAt: 'bad',
          key: 'period-told:2026-09-01:skip',
          read: true,
          dismissed: true,
        },
      ],
    }
    const out = parseState(JSON.stringify(odd))
    expect(out).not.toBeNull()
    expect(out!.schemaVersion).toBe(SCHEMA_VERSION)
    expect(out!.periods).toEqual([{ id: 'period:2026-09-01', start: '2026-09-01', updatedAt: s.createdAt }])
    expect(out!.lhTests).toEqual([])
    // A stub without a readable day gives no decision and is dropped as a stub anyway.
    expect(out!.decisions['period-told:2026-09-01:skip']).toBeUndefined()
    expect(out!.notifications.some((n) => n.key === 'period-told:2026-09-01:skip')).toBe(false)
    expect(schemaVersionOf({ schemaVersion: -1 })).toBe(1)
  })
})

// ── Sanitize: malformed snapshots, events, links and settings ──

describe('sanitize rejects malformed snapshots, events, links and settings — never a crash', () => {
  const junk: unknown[] = [
    null,
    undefined,
    0,
    1,
    -1,
    NaN,
    '',
    'x',
    'a'.repeat(300),
    [],
    [1],
    {},
    { kind: 'check' },
    { id: 'e1' },
    () => 1,
    Symbol.for('x'),
    true,
    new Date(),
    /re/,
  ]

  it('cleanPartnerEvent: junk and near-misses read as nothing; a good event comes back with its fields only', () => {
    for (const j of junk) expect(cleanPartnerEvent(j)).toBeUndefined()
    const near = [
      { id: 'e1', kind: 'check', itemId: 'i', date: '2026-10-02', done: 'true' },
      { id: 'e1', kind: 'check', itemId: 'i', date: '2026-13-02', done: true },
      { id: 'e1', kind: 'check', itemId: '', date: '2026-10-02', done: true },
      { id: 'e 1', kind: 'cheer' },
      { id: 'a'.repeat(65), kind: 'cheer' },
      { id: 'e1', kind: 'Cheer' },
      { id: 'e1', kind: ['cheer'] },
      { id: 'e1', kind: 'reply', signalId: 'thanks' },
      { id: 'e1', kind: 'reply', signalId: 'thanks', replyId: 3 },
      { id: 'e1', kind: 'signal', signalId: { id: 'thanks' } },
      { id: 'e1', kind: 'task-done', taskId: 't', date: 20261002 },
      { id: 'e1', kind: 'period', date: '2026-10-02' },
      { id: 'e1', kind: 'lh', date: '2026-10-02', result: 'peak' },
      { id: 'e1', kind: 'intimacy', date: '2026-10-02' },
    ]
    for (const n of near) expect(cleanPartnerEvent(n), JSON.stringify(n)).toBeUndefined()
    expect(cleanPartnerEvent({ id: 'e1', kind: 'cheer', from: 'a', text: 'hi', note: 'x', date: '2026-10-02' })).toEqual({
      id: 'e1',
      kind: 'cheer',
      from: 'a',
    })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'cheer', from: 'z' })).toEqual({ id: 'e1', kind: 'cheer' })
    expect(cleanPartnerEvent({ id: 'e1', kind: 'check', itemId: 'i', date: '2026-10-02', done: false, extra: 1 })).toEqual({
      id: 'e1',
      kind: 'check',
      itemId: 'i',
      date: '2026-10-02',
      done: false,
    })
  })

  it('parseLinkRecord / cleanCoupleLink / parseCachedView / parseMockStore / cleanDecisions: junk reads as nothing, extras never ride along', () => {
    const now = '2026-10-02T14:03:00+09:00'
    const link = makeLink(null, now, (n) => Uint8Array.from({ length: n }, (_, i) => (i * 29 + 5) % 256))
    for (const j of junk) {
      const raw = typeof j === 'string' ? j : j === undefined ? null : (JSON.stringify(j) ?? 'undefined')
      expect(parseLinkRecord(raw), String(raw)).toBeNull()
      expect(parseCachedView(raw), String(raw)).toBeNull()
      expect(parseMockStore(raw), String(raw)).toEqual({ snapshots: {}, tokens: {}, events: {}, opens: {} })
      expect(cleanCoupleLink(j), String(raw)).toBeUndefined()
      expect(cleanDecisions(j), String(raw)).toEqual({})
    }
    const good = coupleLinkOf(link)
    expect(cleanCoupleLink(good)).toEqual(good)
    expect(cleanCoupleLink({ ...good, extra: 1, token: link.token })).toEqual(good)
    for (const bad of [
      { ...good, tokenHash: good.tokenHash.toUpperCase() },
      { ...good, tokenHash: good.tokenHash.slice(1) },
      { ...good, tokenHash: link.token },
      { ...good, coupleId: '' },
      { ...good, coupleId: 'has space' },
      { ...good, coupleId: 'x'.repeat(65) },
      { ...good, createdAt: '2026-10-02' },
      { ...good, expiresAt: '2026-10-01T14:03:00+09:00' },
      { ...good, createdAt: 5 },
    ]) {
      expect(cleanCoupleLink(bad), JSON.stringify(bad)).toBeUndefined()
    }
    expect(cleanCoupleLink({ ...good, revokedAt: 'later' })).toEqual(good)
    expect(cleanCoupleLink({ ...good, revokedAt: now })).toEqual({ ...good, revokedAt: now })
    expect(parseLinkRecord(JSON.stringify({ ...link, coupleId: 'x'.repeat(65) }))).toBeNull()
    expect(parseLinkRecord(JSON.stringify({ ...link, token: link.token + '!' }))).toBeNull()
    expect(tokenFromHash('#t=%E2%82')).toBeNull()
    expect(isLinkStamp('2026-10-02T14:03:00+09:00')).toBe(true)
    expect(isLinkStamp('2026-10-02T14:03')).toBe(false)
    expect(isLinkStamp('2026-02-30T14:03:00+09:00')).toBe(false)
  })

  it('normalize / sanitizeBackup / parseState keep a good couple.link and coverOnLink, drop bad ones, and never carry the token', () => {
    const now = '2026-10-02T14:03:00+09:00'
    const link = makeLink(null, now)
    const s = setCoverOnLink(setCoupleLink(base(), coupleLinkOf(link)), OWNER, true)
    const json = JSON.stringify(s)
    expect(json).not.toContain(link.token)
    expect(json).toContain(sha256Hex(link.token))
    expect(parseState(json)).toEqual(JSON.parse(json))
    expect(normalize(JSON.parse(json))).toEqual(JSON.parse(json))
    for (const bad of [{ coupleId: 'c', tokenHash: 'short', createdAt: now, expiresAt: now }, 'x', 1, [], { coupleId: 'c' }]) {
      const broken = { ...JSON.parse(json), couple: { ...s.couple, link: bad } }
      expect(parseState(JSON.stringify(broken))!.couple.link, JSON.stringify(bad)).toBeUndefined()
      expect(sanitizeBackup(broken)!.couple.link, JSON.stringify(bad)).toBeUndefined()
      expect('link' in normalize(broken).couple, JSON.stringify(bad)).toBe(false)
    }
    for (const bad of ['true', 1, 'yes', false, null, {}]) {
      const broken = { ...JSON.parse(json), settings: { ...s.settings, coverOnLink: bad } }
      expect('coverOnLink' in parseState(JSON.stringify(broken))!.settings, String(bad)).toBe(false)
      expect('coverOnLink' in sanitizeBackup(broken)!.settings, String(bad)).toBe(false)
      expect('coverOnLink' in normalize(broken).settings, String(bad)).toBe(false)
    }
    // An old `sync` map in a backup is dropped at any version.
    const withSync = { ...JSON.parse(json), sync: { t: 1 } }
    expect('sync' in parseState(JSON.stringify(withSync))!).toBe(false)
    expect('sync' in sanitizeBackup(withSync)!).toBe(false)
  })

  it('coverOnLink and couple.link are the owner’s to set, idempotent, and the demo leaves both unset', () => {
    const s = base()
    expect(coverOnLink(s.settings)).toBe(false)
    expect(setCoverOnLink(s, PARTNER, true)).toBe(s)
    const on = setCoverOnLink(s, OWNER, true)
    expect(on.settings.coverOnLink).toBe(true)
    expect(setCoverOnLink(on, OWNER, true)).toBe(on)
    expect('coverOnLink' in setCoverOnLink(on, OWNER, false).settings).toBe(false)
    expect(setCoverOnLink(on, OWNER, false)).toEqual(s)
    const link = makeLink(null, '2026-10-02T14:03:00+09:00')
    const withLink = setCoupleLink(s, coupleLinkOf(link))
    expect(setCoupleLink(withLink, coupleLinkOf(link))).toBe(withLink)
    expect(linkMatches(withLink, link)).toBe(true)
    expect(linkMatches(withLink, makeLink(link, '2026-10-03T14:03:00+09:00'))).toBe(false)
    expect(linkMatches(s, link)).toBe(false)
    const revoked = setCoupleLink(withLink, coupleLinkOf(revokeLinkRecord(link, '2026-10-05T10:00:00+09:00')))
    expect(revoked.couple.link?.revokedAt).toBe('2026-10-05T10:00:00+09:00')
    expect(linkStatus(revoked.couple.link, '2026-10-06T10:00:00+09:00')).toBe('revoked')
    expect(setCoupleLink(withLink, undefined).couple.link).toBeUndefined()
    expect(setCoupleLink(withLink, { coupleId: 'c', tokenHash: 'bad' } as never).couple.link).toBeUndefined()
    const demo = createDemoState('2026-10-02', new Date('2026-10-02T09:00:00+09:00'))
    expect('coverOnLink' in demo.settings).toBe(false)
    expect('link' in demo.couple).toBe(false)
  })

  it('sha256Hex matches node:crypto (vectors and random tokens)', () => {
    const ref = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    )
    for (const t of [
      'a'.repeat(55),
      'a'.repeat(56),
      'a'.repeat(64),
      'a'.repeat(119),
      'a'.repeat(120),
      '둘셋 · 한글 🙂',
      randomToken(),
      randomToken(),
      'x'.repeat(1000),
    ]) {
      expect(sha256Hex(t), t.slice(0, 20)).toBe(ref(t))
    }
  })
})

// ── The mock transport: two couples on one storage never meet ──

describe('mock transport: two couples, two tokens — nothing crosses', () => {
  function world() {
    const storage = memoryStorage()
    const channel = memoryChannel()
    let tick = 0
    const now = () => `2026-10-02T09:00:${String(tick++).padStart(2, '0')}+09:00`
    const owner1 = createMockTransport({ storage, channel, now })
    const owner2 = createMockTransport({ storage, channel, now })
    const page = createMockTransport({ storage, channel, now })
    const m1 = randomState(301)
    const m2 = randomState(302)
    const snap1 = buildPartnerSnapshot(m1.state, m1.day, PARTNER)!
    const snap2 = buildPartnerSnapshot(m2.state, m2.day, PARTNER)!
    const link1 = makeLink(null, '2026-10-02T09:00:00+09:00')
    const link2 = makeLink(null, '2026-10-02T09:00:00+09:00')
    return { storage, owner1, owner2, page, snap1, snap2, link1, link2 }
  }

  it('reads, events, revokes and re-issues stay with their own couple; a foreign token is refused', async () => {
    const { storage, owner1, owner2, page, snap1, snap2, link1, link2 } = world()
    expect(link1.token).not.toBe(link2.token)
    expect(link1.coupleId).not.toBe(link2.coupleId)
    await owner1.publishSnapshot(link1.coupleId, link1.token, snap1)
    await owner2.publishSnapshot(link2.coupleId, link2.token, snap2)
    expect(await page.fetchSnapshot(link1.token)).toEqual(snap1)
    expect(await page.fetchSnapshot(link2.token)).toEqual(snap2)
    // Events sent with one link land only in that couple's queue.
    await page.sendEvent(link1.token, { id: 'c1-e1', kind: 'cheer' })
    await page.sendEvent(link2.token, { id: 'c2-e1', kind: 'nudge' })
    await page.sendEvent(link2.token, { id: 'c1-e1', kind: 'cheer' }) // the same id in another couple is another event
    expect((await owner1.pullEvents(link1.coupleId, '')).map((e) => e.id)).toEqual(['c1-e1'])
    expect((await owner2.pullEvents(link2.coupleId, '')).map((e) => [e.id, e.kind])).toEqual([
      ['c2-e1', 'nudge'],
      ['c1-e1', 'cheer'],
    ])
    // Couple 2 cannot publish, issue or revoke under couple 1's token; couple 1 is untouched.
    await expect(owner2.publishSnapshot(link2.coupleId, link1.token, snap2)).rejects.toMatchObject({ code: 'foreign-token' })
    await expect(owner2.issueToken!(link2.coupleId, link1.token)).rejects.toMatchObject({ code: 'foreign-token' })
    await expect(owner2.revokeToken!(link2.coupleId, link1.token)).rejects.toMatchObject({ code: 'foreign-token' })
    expect(await page.fetchSnapshot(link1.token)).toEqual(snap1)
    const store = parseMockStore(storage.getItem(MOCK_SYNC_KEY))
    expect(store.tokens[link1.token]!.coupleId).toBe(link1.coupleId)
    expect(store.snapshots[link1.coupleId]!.snapshot).toEqual(snap1)
    expect(store.snapshots[link2.coupleId]!.snapshot).toEqual(snap2)
    // The store never holds a state, only snapshots and events.
    const storeJson = storage.getItem(MOCK_SYNC_KEY)!
    for (const w of [
      ...MARKERS.filter((x) => x !== COUPLE_ID_MARK),
      '"periods"',
      'lhTests',
      'pregnancyTests',
      'personalLog',
      'intimacy',
      'decisions',
      'notifications',
      'tokenHash',
      'checkLog',
    ]) {
      expect(storeJson.includes(w), w).toBe(false)
    }
    // Revoking couple 1's token leaves couple 2 reading; a dead token can neither read nor send.
    await owner1.revokeToken!(link1.coupleId, link1.token)
    expect(await page.fetchSnapshot(link1.token)).toBeNull()
    expect(await page.fetchSnapshot(link2.token)).toEqual(snap2)
    await expect(page.sendEvent(link1.token, { id: 'c1-e2', kind: 'cheer' })).rejects.toBeInstanceOf(MockTransportError)
    await owner1.revokeToken!(link1.coupleId, link1.token) // twice is fine
    // A rotation: a new token for couple 1, issued before the first publish; the old one stays dead.
    const rotated = makeLink(link1, '2026-10-03T09:00:00+09:00')
    const expires = await owner1.issueToken!(rotated.coupleId, rotated.token)
    expect(expires.startsWith('2026-11-01T')).toBe(true)
    expect(await page.fetchSnapshot(rotated.token)).toEqual(snap1)
    expect(await page.fetchSnapshot(link1.token)).toBeNull()
    // Couple 2's events never reach couple 1's pull, whatever the window.
    expect(await owner1.pullEvents(link1.coupleId, '')).toEqual([{ id: 'c1-e1', kind: 'cheer' }])
    expect(await owner1.pullEvents(link2.coupleId, '')).toHaveLength(2) // the couple id is not a secret on the mock: the owner key is what the server checks
    // watch: couple 1 hears only its own traffic.
    const heard: string[] = []
    const off = owner1.watch!(link1.coupleId, () => heard.push('1'))
    await page.sendEvent(link2.token, { id: 'c2-e2', kind: 'cheer' })
    await owner2.publishSnapshot(link2.coupleId, link2.token, snap2)
    expect(heard).toEqual([])
    await page.sendEvent(rotated.token, { id: 'c1-e3', kind: 'cheer' })
    expect(heard).toEqual(['1'])
    off()
  })
})

// ── The Supabase transport: what goes over the wire ─────────

describe('supabase transport (fake fetch): the wire carries the lens-built snapshot and small events, never the AppState', () => {
  interface Call {
    url: string
    method: string
    headers: Record<string, string>
    body: string
  }
  const ENV = { url: 'https://abc.supabase.co', anonKey: 'anon-key' }
  const OWNER_KEY = 'o'.repeat(40)

  function fake() {
    const calls: Call[] = []
    const fetch: FetchLike = async (input, init) => {
      calls.push({ url: input, method: init.method, headers: init.headers, body: init.body ?? '' })
      const fn = input.split('/rpc/')[1]
      // create_couple echoes the id her phone made (the app's way); without one, a fresh id.
      const asked = fn === 'create_couple' ? ((JSON.parse(init.body ?? '{}') as { p_couple_id?: string }).p_couple_id ?? null) : null
      const body =
        fn === 'create_couple'
          ? JSON.stringify(asked ?? 'c0ffee00-0000-4000-8000-000000000001')
          : fn === 'issue_token'
            ? '"2026-11-01T00:00:00+00:00"'
            : fn === 'publish_snapshot'
              ? '1'
              : fn === 'pull_events'
                ? '[]'
                : fn === 'snapshot_by_token'
                  ? '[]'
                  : fn === 'mark_events_read'
                    ? '0'
                    : ''
      return { ok: true, status: 200, text: async () => body }
    }
    return { calls, fetch }
  }

  it('for 20 random spaces: every owner call carries the owner key, every partner call only the token; no URL or header ever holds a secret; nothing of the state leaks', async () => {
    for (let seed = 4000; seed < 4020; seed++) {
      const m = randomState(seed)
      const link = makeLink(null, stamp(m.day, 9))
      const snap = buildPartnerSnapshot(m.state, m.day, PARTNER)!
      const { calls, fetch } = fake()
      const t = createSupabaseTransport({ ...ENV, ownerKey: OWNER_KEY, fetch, now: () => stamp(m.day, 9, 5) })
      await t.createCouple()
      await t.issueToken(link.coupleId, link.token)
      await t.publishSnapshot(link.coupleId, link.token, snap)
      await t.pullEvents(link.coupleId, stamp(addDays(m.day, -7), 9))
      await t.markEventsRead(link.coupleId, ['e1'])
      await t.revokeToken(link.coupleId, link.token)
      await t.fetchSnapshot(link.token)
      await t.sendEvent(link.token, { id: 'e1', kind: 'check', itemId: 'i', date: m.day, done: true })
      expect(calls.map((c) => c.url.split('/rpc/')[1])).toEqual([
        'create_couple',
        // Her phone's own couple id is registered once before the first issue / publish / pull (ensureCouple).
        'create_couple',
        'issue_token',
        'publish_snapshot',
        'pull_events',
        'mark_events_read',
        'revoke_token',
        'snapshot_by_token',
        'send_event',
      ])
      expect(JSON.parse(calls[1]!.body)).toEqual({ p_owner_key: OWNER_KEY, p_couple_id: link.coupleId })
      const stateJson = JSON.stringify(m.state)
      for (const c of calls) {
        const fn = c.url.split('/rpc/')[1]!
        const tag = `seed ${seed} ${fn}`
        // The address and headers: the project, the anon key — never a secret, never a token.
        expect(c.url.startsWith(`${ENV.url}/rest/v1/rpc/`), tag).toBe(true)
        expect(c.url.includes(link.token) || c.url.includes(OWNER_KEY), tag).toBe(false)
        expect(c.method, tag).toBe('POST')
        expect(
          Object.values(c.headers).some((v) => v.includes(link.token) || v.includes(OWNER_KEY)),
          tag,
        ).toBe(false)
        expect(c.headers.apikey, tag).toBe(ENV.anonKey)
        // The body: never the state, never a marker, never a forbidden key.
        expect(c.body, tag).not.toBe(stateJson)
        for (const w of [...MARKERS, m.state.couple.inviteCode, ...FORBIDDEN_KEYS]) expect(c.body.includes(w), `${tag}: ${w}`).toBe(false)
        const body = JSON.parse(c.body) as Record<string, unknown>
        const ownerSide = ['create_couple', 'issue_token', 'publish_snapshot', 'pull_events', 'mark_events_read', 'revoke_token'].includes(
          fn,
        )
        expect(body.p_owner_key, tag).toBe(ownerSide ? OWNER_KEY : undefined)
        if (fn === 'create_couple' || fn === 'pull_events' || fn === 'mark_events_read') expect('p_token' in body, tag).toBe(false)
        else expect(body.p_token, tag).toBe(link.token)
        if (fn === 'publish_snapshot') {
          // Exactly the lens-built page, nothing else.
          expect(body.p_payload, tag).toEqual(snap)
          expect(Object.keys(body).sort(), tag).toEqual(['p_couple_id', 'p_owner_key', 'p_payload', 'p_published_at', 'p_token'])
        }
        if (fn === 'send_event') {
          expect(body.p_payload, tag).toEqual({ id: 'e1', kind: 'check', itemId: 'i', date: m.day, done: true })
          expect(Object.keys(body).sort(), tag).toEqual(['p_event_id', 'p_kind', 'p_payload', 'p_token'])
        }
      }
    }
  })

  it('without an owner key the owner calls refuse before any request; the partner calls still go', async () => {
    const { calls, fetch } = fake()
    const t = createSupabaseTransport({ ...ENV, fetch, storage: null })
    await expect(
      t.publishSnapshot('c', 'tok-0123456789abcdef', buildPartnerSnapshot(randomState(1).state, '2026-10-02', PARTNER)!),
    ).rejects.toThrow()
    await expect(t.revokeToken('c', 'tok-0123456789abcdef')).rejects.toThrow()
    expect(calls).toEqual([])
    await t.fetchSnapshot('tok-0123456789abcdef')
    expect(calls).toHaveLength(1)
  })
})

// ── Store-level stamping (lib/sync/model.ts stampChanges) ───

describe('stampChanges: what a change touched gets a stamp and an id; nothing else moves', () => {
  const NOW = '2026-10-02T10:00:00+09:00'
  const LATER = '2026-10-02T11:00:00+09:00'
  const ids = (prefix: string) => {
    let n = 0
    return () => `${prefix}${++n}`
  }

  it('a new period gets an id and the stamp; a re-log of the same day keeps the id; untouched records keep their object', () => {
    const s0 = randomState(11).state
    const s1 = addPeriod(s0, addDays(s0.periods[s0.periods.length - 1]!.start, 30), undefined, OWNER)
    const out1 = stampChanges(s0, s1, NOW, ids('new-'))
    const added = out1.periods.find((p) => !s0.periods.some((q) => q.start === p.start))!
    expect(added).toMatchObject({ id: 'new-1', updatedAt: NOW })
    for (const p of out1.periods) if (p !== added) expect(s0.periods).toContain(p)
    // Other lists are the same arrays.
    for (const key of SYNCED_LISTS) if (key !== 'periods') expect(out1[key]).toBe(s0[key])
    // Re-logging the same day (addPeriod rebuilds the record): the id stays, a new stamp.
    const s2 = setPeriodEnd(out1, added.start, addDays(added.start, 4))
    const out2 = stampChanges(out1, s2, LATER, ids('x-'))
    const again = out2.periods.find((p) => p.start === added.start)!
    expect(again).toMatchObject({ id: 'new-1', updatedAt: LATER, end: addDays(added.start, 4) })
    // A change that rebuilds a record without changing it keeps the old object.
    const s3 = { ...out2, periods: out2.periods.map((p) => ({ ...p })) }
    const out3 = stampChanges(out2, s3, '2026-10-02T12:00:00+09:00', ids('y-'))
    expect(out3.periods).toEqual(out2.periods)
    for (const p of out3.periods) expect(out2.periods).toContain(p)
    // No change at all: the same object comes back.
    expect(stampChanges(out2, out2, LATER)).toBe(out2)
    const untouched = { ...out2, checkLog: {} }
    expect(stampChanges(out2, untouched, LATER)).toBe(untouched)
  })

  it('LH strips match by (date, time | slot); every other synced list by id; a record with its own id keeps it', () => {
    const s0 = randomState(12).state
    const day = s0.periods[s0.periods.length - 1]!.start
    const s1 = addLHTest(s0, { date: addDays(day, 17), result: 'peak', slot: 'evening', by: OWNER })
    const out1 = stampChanges(s0, s1, NOW, ids('lh-'))
    const added = out1.lhTests.find((t) => t.date === addDays(day, 17) && t.slot === 'evening')!
    expect(added).toMatchObject({ id: 'lh-1', updatedAt: NOW })
    const s2 = addLHTest(out1, { date: addDays(day, 17), result: 'positive', slot: 'evening', by: OWNER }, undefined, { replace: true })
    const out2 = stampChanges(out1, s2, LATER, ids('z-'))
    expect(out2.lhTests.find((t) => t.date === addDays(day, 17) && t.slot === 'evening')).toMatchObject({
      id: 'lh-1',
      result: 'positive',
      updatedAt: LATER,
    })
    // Appointments, diary, custom tasks, treatments, tests: by id.
    let s3 = addAppointment(out2, { date: addDays(day, 5), title: '검진', who: OWNER, kind: 'hospital' }, OWNER)
    s3 = addEntry(s3, { id: 'd-new', date: day, author: PARTNER, text: '오늘' }, NOW)
    s3 = addCustomTask(s3, { title: '장보기', phase: 'preconception', who: 'both' }, PARTNER)
    s3 = addTreatment(s3, { id: 'tr-new', kind: 'iui', startDate: day })
    s3 = addPregnancyTest(s3, { id: 'pt-new', date: addDays(day, 20), result: 'negative', by: OWNER }).state
    const out3 = stampChanges(out2, s3, LATER)
    expect(out3.appointments.find((a) => a.title === '검진')).toMatchObject({ updatedAt: LATER })
    expect(out3.diary.find((e) => e.id === 'd-new')).toMatchObject({ updatedAt: LATER })
    expect(out3.customTasks.find((c) => c.title === '장보기')).toMatchObject({ updatedAt: LATER })
    expect(out3.treatments!.find((t) => t.id === 'tr-new')).toMatchObject({ updatedAt: LATER })
    expect(out3.pregnancyTests.find((t) => t.id === 'pt-new')).toMatchObject({ updatedAt: LATER })
    // Editing one appointment / entry stamps that one only.
    const appt = out3.appointments.find((a) => a.title === '검진')!
    const s4 = updateEntry(updateAppointment(out3, appt.id, { place: '새 병원' }), 'd-new', { text: '바뀜' })
    const out4 = stampChanges(out3, s4, '2026-10-02T12:00:00+09:00')
    expect(out4.appointments.find((a) => a.id === appt.id)).toMatchObject({ place: '새 병원', updatedAt: '2026-10-02T12:00:00+09:00' })
    expect(out4.diary.find((e) => e.id === 'd-new')).toMatchObject({ text: '바뀜', updatedAt: '2026-10-02T12:00:00+09:00' })
    for (const a of out4.appointments) if (a.id !== appt.id) expect(out3.appointments).toContain(a)
    for (const e of out4.diary) if (e.id !== 'd-new') expect(out3.diary).toContain(e)
    // The result is canonical through parseState.
    expect(parseState(JSON.stringify(out4))).toEqual(JSON.parse(JSON.stringify(out4)))
  })

  it('a partner event applied through the store stamps only what it touched', () => {
    const m = randomState(13)
    const s = m.state
    const task = monthlyTask(s, m.day, PARTNER)
    const his = activeItems(s, PARTNER)[0]!
    const next = applyPartnerEvents(
      s,
      [
        { id: 'ev1', kind: 'check', itemId: his.id, date: m.day, done: !isDone(s, PARTNER, m.day, his.id) },
        ...(task ? [{ id: 'ev2', kind: 'task-done' as const, taskId: task.id, date: m.day }] : []),
      ],
      m.day,
    )
    const out = stampChanges(s, next, NOW)
    for (const key of SYNCED_LISTS) {
      if (key === 'appointments') continue
      expect(out[key], key).toBe(s[key])
    }
    for (const a of out.appointments) {
      if (s.appointments.includes(a)) continue
      expect(a.updatedAt).toBe(NOW)
      expect(a.done).toBe(true)
    }
  })
})

// ── Decisions in ttcFlow: the writers decide, the readers still see v2 data ──

describe('ttcFlow decisions', () => {
  it('writes decisions (the calm notice stays a notice) and still reads a legacy stub', () => {
    const m = randomState(21)
    const s = {
      ...m.state,
      decisions: {} as Record<string, ISODate>,
      notifications: m.state.notifications.filter((n) => !n.key?.startsWith('period-told')),
    }
    const told = tellPartnerPeriod(s, m.lastStart, stamp(m.lastStart, 8, 10))
    expect(told.decisions[periodToldKey(m.lastStart)]).toBe(m.lastStart)
    expect(told.notifications.find((n) => n.key === periodToldKey(m.lastStart))).toMatchObject({ to: PARTNER, from: OWNER })
    expect(told.notifications.some(isDecisionStub)).toBe(false)
    expect(periodTellState(told, m.lastStart)).toBe('told')
    expect(tellPartnerPeriod(told, m.lastStart, stamp(m.lastStart, 9))).toBe(told)
    expect(skipTellPartnerPeriod(told, m.lastStart, stamp(m.lastStart, 9))).toBe(told)
    // Even when his inbox drops the notice (the cap), the answer stands.
    const trimmed = { ...told, notifications: [] }
    expect(periodTellState(trimmed, m.lastStart)).toBe('told')
    // A v2 save: the answer only as a stub → still 'skipped' through decided()'s fallback; v3 then moves it.
    const stub: AppNotification = {
      id: 'n',
      to: OWNER,
      kind: 'system',
      title: '',
      body: '',
      createdAt: stamp(m.lastStart),
      key: `${periodToldKey(m.lastStart)}:skip`,
      read: true,
      dismissed: true,
    }
    const v2 = { ...s, schemaVersion: 2, notifications: [stub, ...s.notifications] }
    expect(periodTellState(v2, m.lastStart)).toBe('skipped')
    const v3 = migrate(v2)
    expect(v3.decisions[`${periodToldKey(m.lastStart)}:skip`]).toBe(m.lastStart)
    expect(v3.notifications.some(isDecisionStub)).toBe(false)
    expect(periodTellState(v3, m.lastStart)).toBe('skipped')
    // decide() keeps the first answer; decided() reads a real notice with the key as well.
    expect(
      decide(decide(s, 'rest-suggest:x:2026-09-01', '2026-09-02'), 'rest-suggest:x:2026-09-01', '2026-09-09').decisions[
        'rest-suggest:x:2026-09-01'
      ],
    ).toBe('2026-09-02')
    expect(
      decided(
        { decisions: {}, notifications: [{ ...stub, key: positiveToldKey('2026-09-20'), title: 't', body: 'b', dismissed: undefined }] },
        positiveToldKey('2026-09-20'),
      ),
    ).toBe(true)
    expect(DECISION_KEY_RE.test(bleedingToldKey('2026-09-20'))).toBe(true)
    expect(isDecisionStub({ key: positiveToldKey('2026-09-20'), title: '소식', body: '…', dismissed: true })).toBe(false)
  })
})

// ── Content loaders keep their shapes; the validator passes ──

describe('content JSON loaders keep their shapes and the validator passes', () => {
  const ISO = /^\d{4}-\d{2}-\d{2}$/
  const checkAudit = (
    audit: Readonly<Record<string, { effectiveFrom: string; checkedAt: string; verified: boolean; checkNote?: string }>>,
    ids: string[],
    where: string,
  ) => {
    expect(Object.keys(audit).sort(), where).toEqual([...new Set(ids)].sort())
    for (const [id, a] of Object.entries(audit)) {
      expect(a.effectiveFrom, `${where} ${id}`).toMatch(ISO)
      expect(a.checkedAt, `${where} ${id}`).toMatch(ISO)
      expect(a.checkedAt >= a.effectiveFrom || a.effectiveFrom <= '2026-10-02', `${where} ${id}`).toBe(true)
      expect(typeof a.verified, `${where} ${id}`).toBe('boolean')
      if (!a.verified) expect(a.checkNote?.trim().length ?? 0, `${where} ${id}`).toBeGreaterThan(0)
    }
  }
  const noAuditFields = (items: readonly Record<string, unknown>[], where: string) => {
    for (const it of items)
      for (const k of ['effectiveFrom', 'checkedAt', 'verified', 'checkNote']) expect(k in it, `${where}.${k}`).toBe(false)
  }
  const unique = (ids: string[], where: string) => expect(new Set(ids).size, where).toBe(ids.length)

  it('roadmap: 60 items with ids, titles, phases, sources; side tables rebuilt; audit per id', () => {
    expect(ROADMAP).toHaveLength(60)
    unique(
      ROADMAP.map((t) => t.id),
      'roadmap',
    )
    for (const t of ROADMAP) {
      expect(typeof t.id).toBe('string')
      expect(t.title.length).toBeGreaterThan(0)
      expect(['preconception', 'pregnancy-1st', 'pregnancy-2nd', 'pregnancy-3rd', 'birth', 'postpartum']).toContain(t.phase)
      expect(Array.isArray(t.sources)).toBe(true)
      expect(t.sources.length).toBeGreaterThan(0)
      for (const src of t.sources) expect(src.url).toMatch(/^https?:\/\//)
    }
    noAuditFields(ROADMAP as unknown as Record<string, unknown>[], 'roadmap')
    checkAudit(
      ROADMAP_AUDIT,
      ROADMAP.map((t) => t.id),
      'roadmap',
    )
    expect(templateById(FERTILITY_TEST_ID)?.id).toBe(FERTILITY_TEST_ID)
    for (const [id, n] of Object.entries(MONTH_DEADLINES)) {
      expect(templateById(id), id).toBeDefined()
      expect(Number.isInteger(n) && n > 0, id).toBe(true)
    }
    for (const [id, program] of Object.entries(ROADMAP_PROGRAMS)) {
      expect(templateById(id), id).toBeDefined()
      expect(programById(program), `${id} → ${program}`).toBeDefined()
    }
  })

  it('programs, supplements, date ideas, fertility guide, pregnancy, baby', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(10)
    unique(
      PROGRAMS.map((p) => p.id),
      'programs',
    )
    for (const p of PROGRAMS) {
      expect(p.title.length, p.id).toBeGreaterThan(0)
      expect(p.url, p.id).toMatch(/^https?:\/\//)
    }
    noAuditFields(PROGRAMS as unknown as Record<string, unknown>[], 'programs')
    checkAudit(PROGRAM_AUDIT, [...PROGRAMS.map((p) => p.id), 'fertility-check-guide'], 'programs')
    expect(FERTILITY_CHECK_GUIDE.claimDocs.map((d) => d.id).sort()).toEqual(['bankbook', 'form', 'receipt', 'statement'])

    expect(SUGGESTIONS.length).toBeGreaterThanOrEqual(10)
    unique(
      SUGGESTIONS.map((s) => s.id),
      'supplements',
    )
    noAuditFields(SUGGESTIONS as unknown as Record<string, unknown>[], 'supplements')
    checkAudit(
      SUGGESTION_AUDIT,
      SUGGESTIONS.map((s) => s.id),
      'supplements',
    )

    expect(DATE_IDEAS.length).toBeGreaterThanOrEqual(40)
    unique(
      DATE_IDEAS.map((i) => i.id),
      'dateIdeas',
    )
    for (const i of DATE_IDEAS) {
      expect(i.title.length, i.id).toBeGreaterThan(0)
      expect([1, 2, 3], i.id).toContain(i.budget)
      expect(typeof i.mapQuery, i.id).toBe('string')
    }
    noAuditFields(DATE_IDEAS as unknown as Record<string, unknown>[], 'dateIdeas')
    checkAudit(
      DATE_IDEA_AUDIT,
      DATE_IDEAS.map((i) => i.id),
      'dateIdeas',
    )

    expect(GUIDE_SECTIONS.length).toBeGreaterThanOrEqual(5)
    unique(
      GUIDE_SECTIONS.map((s) => s.id),
      'fertility',
    )
    expect(guideSections(false).length).toBeLessThanOrEqual(GUIDE_SECTIONS.length)
    for (const src of Object.values(SOURCES)) expect(src.url).toMatch(/^https?:\/\//)
    checkAudit(GUIDE_AUDIT, [...GUIDE_SECTIONS.map((s) => s.id), 'nice'], 'fertility')

    expect(WEEKS.length).toBeGreaterThanOrEqual(20)
    for (const w of WEEKS) expect(w.from <= w.to, `${w.from}`).toBe(true)
    expect(PRENATAL_CHECKS.length).toBeGreaterThan(0)
    unique(
      PRENATAL_CHECKS.map((c) => c.id),
      'prenatal',
    )
    checkAudit(
      PREGNANCY_AUDIT,
      [
        ...WEEKS.map((w) => `week:${w.from}-${w.to}`),
        ...PRENATAL_CHECKS.map((c) => `check:${c.id}`),
        'one-stop:pregnancy',
        'one-stop:birth',
      ],
      'pregnancy',
    )

    expect(MILESTONES.length).toBeGreaterThanOrEqual(10)
    unique(
      MILESTONES.map((m) => m.key),
      'milestones',
    )
    expect(CHECKUPS.length).toBeGreaterThan(0)
    expect(VACCINE_ANCHORS.length).toBeGreaterThan(0)
    expect(BABY_CHECKED_AT).toMatch(ISO)
  })

  it('scripts/validate-content.mjs passes on the shipped data', () => {
    const script = fileURLToPath(new URL('../scripts/validate-content.mjs', import.meta.url))
    const out = execFileSync(process.execPath, [script, '--summary'], { encoding: 'utf8', timeout: 30_000 })
    expect(out).toMatch(/validate-content: \d+ files ok/)
    expect(out).toMatch(/roadmap\.json: 60 items/)
  })
})

// ── The whole chain on the demo, as the app runs it ─────────

describe('the demo couple through the whole chain', () => {
  it('owner publishes, the page sees it, a tap comes back once, the state stays canonical and private', async () => {
    const today: ISODate = '2026-10-02'
    let s = createDemoState(today, new Date(`${today}T10:00:00+09:00`))
    const storage = memoryStorage()
    const channel = memoryChannel()
    const t = createMockTransport({ storage, channel, now: () => stamp(today, 10, 1) })
    const link = makeLink(null, stamp(today, 10))
    s = setCoupleLink(s, coupleLinkOf(link))
    const snap = buildPartnerSnapshot(s, today, partnerId(s))!
    await t.publishSnapshot(link.coupleId, link.token, snap)
    const seen = (await t.fetchSnapshot(tokenFromHash(`#t=${link.token}`)!))!
    expect(seen).toEqual(snap)
    const json = JSON.stringify(seen)
    for (const w of ['periods', 'lhTests', 'pregnancyTests', 'personalLog', 'intimacy', 'tokenHash', 'coupleId', 'inviteCode', 'decisions'])
      expect(json.includes(`"${w}"`), w).toBe(false)
    expect(json).not.toMatch(/가임기|배란|LH|생리/)
    const his = activeItems(s, partnerId(s)).find((i) => !isDone(s, partnerId(s), today, i.id))!
    const ev: PartnerEvent = { id: 'demo-tap', kind: 'check', itemId: his.id, date: today, done: true }
    await t.sendEvent(link.token, ev)
    await t.sendEvent(link.token, ev)
    const events = await t.pullEvents(link.coupleId, '')
    const fresh = events.filter((e) => !hasAppliedEvent(s, e.id))
    expect(fresh).toEqual([ev])
    const next = stampChanges(s, applyPartnerEvents(s, fresh, today), stamp(today, 10, 2))
    expect(isDone(next, partnerId(s), today, his.id)).toBe(true)
    expect(next.decisions[appliedEventKey('demo-tap')]).toBe(today)
    expect(applyPartnerEvents(next, await t.pullEvents(link.coupleId, ''), today)).toBe(next)
    // Canonical and whole after a save; the owner's data untouched.
    expect(parseState(JSON.stringify(next))).toEqual(JSON.parse(JSON.stringify(next)))
    sameOwnerData(s, next, 'demo')
    expect(diffDays(today, next.couple.link!.expiresAt.slice(0, 10))).toBe(LINK_DAYS)
    expect(isISODate(next.decisions[appliedEventKey('demo-tap')])).toBe(true)
  })
})
