// Next B integration review — adversarial checks across viewers, lenses and
// exports, plus the lib-level hand-offs the tracks left for the integrator:
//   • nothing owner-only (관계일, 컨디션 칩, '나만 보기' lines and entries,
//     the bleeding mark) ever reaches the partner through any screen model,
//     notice, export, album or shared state — for random states and days;
//   • treatments are couple-level clinic data, visible to both, while the
//     병원 요약 never carries a note, a chip or a diagnosis word;
//   • counters show only verified denominators; 통지서 reminders and routing;
//   • the 42-day quiet after a loss starts from every 준비로 돌아가기 path and
//     keeps the loss out of the average;
//   • "(예상)" once per card, memory exclusions, old saves unchanged;
//   • the module graph has no import cycle and notifications.ts never reads settings.ts.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays, addMonths } from '@/lib/dates'
import * as demo from '@/lib/demo'
import * as draft from '@/lib/onboardingDraft'
import { createDemoState } from '@/lib/demo'
import { PERSONAL_DEFAULTS, SETTINGS_DEFAULTS, createInitialState } from '@/lib/initial'
import { anniversaryNotices } from '@/lib/logic/anniversary'
import { addAppointment } from '@/lib/logic/appointments'
import { cycleHistory, cycleLens, cycleSummary } from '@/lib/logic/calendarView'
import { CLINIC_SUMMARY_SHEET_TITLE, clinicSummary } from '@/lib/logic/clinicSummary'
import { buildClinicSummaryHtml, buildClinicSummaryText } from '@/lib/logic/clinicSummaryExport'
import { COVER_WORDS, heroLine, memoryFor } from '@/lib/logic/cover'
import { cycleStats, spansEndedPregnancy, upcomingWindows } from '@/lib/logic/cycle'
import { ringLegend } from '@/lib/logic/cycleRing'
import { fertileHintsAllowed } from '@/lib/logic/dateIdeas'
import { addEntry } from '@/lib/logic/diary'
import { buildDiaryHtml } from '@/lib/logic/diaryExport'
import { fertileWindowEvents } from '@/lib/logic/ics'
import { giveIntimacyConsent, intimacyDays, toggleIntimacyDay } from '@/lib/logic/intimacy'
import { addLHTest, addPregnancyTest, defaultLogKind, lhAskDue, logPeriodStart, logUndo, undoLog } from '@/lib/logic/logs'
import { inbox, mergeNotices, scheduledNotices } from '@/lib/logic/notifications'
import { FEEL_LABEL, setEntryPrivacy, setFeel, setPrivateNote, stateForViewer } from '@/lib/logic/personalLog'
import { NOTICE_EXPIRY_REMINDER_DAYS, appointmentReminders, noticeExpiryNotices, planDeadlineNotices } from '@/lib/logic/planNotices'
import { isBleedingDuringPositive, markBleeding } from '@/lib/logic/positiveBleeding'
import { QUIET_DAYS_AFTER_END, backToPreparing, quietEndsOn, startPregnancy } from '@/lib/logic/pregnancy'
import { setPersonalPref, setShareCycleDetails, shareLevelOf } from '@/lib/logic/prefs'
import { anniversaryAlertsOn, memoriesOn, sanitizeBackup, setAnniversaryAlerts, setCoupleFlag, showTryCountOn } from '@/lib/logic/settings'
import { doctorAdvice, endPregnancy, noticeTarget } from '@/lib/logic/today'
import {
  SUPPORT_CHECK_LINE,
  SUPPORT_TOTALS,
  SUPPORT_TOTALS_VERIFIED,
  addTreatment,
  canEditTreatments,
  neutralTreatmentWords,
  showsTreatmentCounter,
  supportCounts,
  supportUsedLabel,
  treatmentLabel,
} from '@/lib/logic/treatments'
import { activeRest, lossRestUntil, startRestCycle } from '@/lib/logic/ttc'
import {
  AFTER_LOSS_LINES,
  estimateMarks,
  logPeriodOrBleeding,
  settleBleedingAsPeriod,
  tellPartnerBleeding,
  ttcMoment,
  cycleStrip,
  type Moment,
} from '@/lib/logic/ttcFlow'
import { albumFeed } from '@/lib/logic/usView'
import { normalize, parseState } from '@/lib/storage'
import type { AlertStyle, AppState, ISODate, MemberId } from '@/lib/types'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner). Three 28-day cycles, then
// the period 2026-09-01 (confidence 'cycles'): window 09-10…09-15, next period
// expected 09-29.
const OWNER = 'b' as const
const PARTNER = 'a' as const
const NOW = '2026-09-01T09:00:00+09:00'
const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]
const ROOT = join(__dirname, '..')

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
const stamp = (day: ISODate, hour = 9) => `${day}T${String(hour).padStart(2, '0')}:00:00+09:00`

/** Every string a viewer can read on the moment card. */
function words(m: Moment | null): string {
  if (!m) return ''
  return [m.eyebrow, m.title, m.body, m.note, m.partnerTip, m.primary?.label, m.secondary?.label, ...(m.bleeding?.lines ?? []), m.guidance?.text]
    .filter(Boolean)
    .join(' ')
}

// ── Owner-only markers the partner must never meet ──────────

const PRIVATE_LINE = 'PRIVATE_LINE_9f3a'
const SECRET_ENTRY = 'SECRET_ENTRY_7c21'
const TREATMENT_NOTE = 'TREATMENT_NOTE_4e88'
const FEELS = Object.values(FEEL_LABEL)
/** Diagnosis / banned words no model, export or notice may use (AGENTS.md + the review lists). */
const BANNED = ['숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '진단', '불규칙', '무월경', '유산', '자궁외', '착상', '성공률', '정확한 배란', '확률']

function hasSecret(text: string, extra: readonly string[] = []): string | undefined {
  for (const w of [PRIVATE_LINE, SECRET_ENTRY, ...FEELS, ...extra]) if (text.includes(w)) return w
  return undefined
}

// ── A small seeded generator (deterministic property tests) ──

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1
  return () => {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    return x / 0x100000000
  }
}

const STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off']

/**
 * A random preparing-stage state with everything owner-only filled in:
 * personal chips and lines, '나만 보기' entries (some with photos), 관계일
 * days, a treatment with a note, an appointment with a note, LH strips, a
 * pending positive test — and, for some, the bleeding mark on it.
 */
function randomState(seed: number): { state: AppState; day: ISODate; bleeding: boolean } {
  const r = rng(seed)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)]!
  let s = fresh()
  s = withStyle(s, PARTNER, pick(STYLES))
  s = withStyle(s, OWNER, pick(STYLES))
  if (r() < 0.5) s = share(s)
  if (r() < 0.3) s = setPersonalPref(s, PARTNER, 'lowPressure', true)
  if (r() < 0.3) s = setPersonalPref(s, OWNER, 'lowPressure', true)
  if (r() < 0.3) s = setPersonalPref(s, PARTNER, 'discreet', true)
  if (r() < 0.3) s = setPersonalPref(s, PARTNER, 'homeDiscreet', true)
  if (r() < 0.3) s = setPersonalPref(s, PARTNER, 'acceptNudges', false)
  // Owner-only records across the cycle.
  for (let i = 0; i < 6; i++) {
    const date = addDays('2026-09-01', Math.floor(r() * 30))
    s = setFeel(s, OWNER, date, pick(Object.keys(FEEL_LABEL) as Array<keyof typeof FEEL_LABEL>))
    if (r() < 0.6) s = setPrivateNote(s, OWNER, date, `${PRIVATE_LINE} ${i}`)
  }
  // Diary: shared and '나만 보기' entries, some with a photo (the album).
  for (let i = 0; i < 5; i++) {
    const date = addDays('2026-09-01', Math.floor(r() * 30))
    const id = `e${seed}-${i}`
    s = addEntry(s, { id, date, author: OWNER, text: `${SECRET_ENTRY} ${i}`, ...(r() < 0.6 ? { photoId: `p${i}` } : {}) }, stamp(date, 20))
    s = setEntryPrivacy(s, id, OWNER, true)
    s = addEntry(s, { id: `s${seed}-${i}`, date, author: pick(['a', 'b'] as const), text: `산책 ${i}`, ...(r() < 0.4 ? { photoId: `q${i}` } : {}) }, stamp(date, 21))
  }
  // 관계일.
  if (r() < 0.8) {
    s = giveIntimacyConsent(s, OWNER, '2026-09-01')
    for (let i = 0; i < 4; i++) s = toggleIntimacyDay(s, OWNER, addDays('2026-09-01', Math.floor(r() * 30)))
  }
  // Clinic data (couple-level) with free text that stays in the app.
  s = addTreatment(s, { id: `t${seed}`, kind: pick(['iui', 'ivf-fresh', 'ovulation-induction'] as const), startDate: '2026-08-10', endDate: '2026-08-25', outcome: 'negative', supported: true, noticeExpires: '2027-01-15', note: TREATMENT_NOTE })
  s = addAppointment(s, { date: '2026-09-05', title: '난임 검사', who: OWNER, kind: 'test', note: 'APPT_NOTE' }, OWNER)
  // LH strips in the window.
  for (const [d, result] of [['2026-09-11', 'faint'], ['2026-09-12', 'positive'], ['2026-09-13', 'peak']] as const) {
    s = addLHTest(s, { date: d, result, time: '08:10', by: OWNER }, '2026-09-30')
  }
  // A pending positive (and, for some, the bleeding mark on it).
  let bleeding = false
  const day: ISODate = pick(['2026-09-04', '2026-09-11', '2026-09-14', '2026-09-20', '2026-09-27', '2026-09-30', '2026-10-03'])
  if (r() < 0.6) {
    s = addPregnancyTest(s, { id: `pt${seed}`, date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-30').state
    if (r() < 0.6) {
      s = markBleeding(s, '2026-09-27')
      bleeding = true
    }
  }
  return { state: s, day, bleeding }
}

function viewerNotices(s: AppState, day: ISODate): AppState {
  const rules = [...scheduledNotices(s, day), ...appointmentReminders(s, day), ...planDeadlineNotices(s, day)]
  return mergeNotices(s, rules, stamp(day)).state
}

// ── 1. Privacy property across viewers, lenses, exports ─────

describe('privacy property (Next B): owner-only data never reaches the partner anywhere', () => {
  it('for 160 random states × the partner: card, strip, cover line, inbox, shared state, diary export, album, 병원 요약, .ics', () => {
    let withIntimacy = 0
    let withBleeding = 0
    let summaries = 0
    for (let seed = 1; seed <= 160; seed++) {
      const { state: base, day, bleeding } = randomState(seed)
      const s = viewerNotices(base, day)
      const tag = `seed ${seed} day ${day}`
      if (s.intimacy) withIntimacy++
      if (bleeding) withBleeding++

      // Home card, strip and cover line.
      const m = ttcMoment(s, day, PARTNER)
      expect(hasSecret(words(m), bleeding ? ['출혈'] : []), tag).toBeUndefined()
      expect(m?.bleeding, tag).toBeUndefined()
      expect(m?.todayFeel, tag).toBeUndefined()
      expect(m?.lastFeels, tag).toBeUndefined()
      expect(m?.guidance, tag).toBeUndefined()
      expect(hasSecret(JSON.stringify(cycleStrip(s, day, PARTNER) ?? {}), ['관계']), tag).toBeUndefined()
      expect(hasSecret(heroLine(s, day, PARTNER, 20).text, ['관계', '출혈']), tag).toBeUndefined()

      // The partner's inbox.
      for (const n of inbox(s, PARTNER)) {
        expect(hasSecret(`${n.title} ${n.body}`, ['관계', '출혈']), `${tag} ${n.key}`).toBeUndefined()
      }

      // What his phone may hold.
      const his = stateForViewer(s, PARTNER)
      expect('intimacy' in his, tag).toBe(false)
      expect(his.personalLog?.[OWNER], tag).toBeUndefined()
      expect(his.diary.some((e) => e.privateTo === OWNER), tag).toBe(false)
      expect(hasSecret(JSON.stringify(his)), tag).toBeUndefined()
      // …and hers stays hers.
      const hers = stateForViewer(s, OWNER)
      expect(hers.intimacy, tag).toEqual(s.intimacy)
      expect(hers.personalLog?.[OWNER], tag).toEqual(s.personalLog?.[OWNER])
      expect(intimacyDays(s, PARTNER), tag).toEqual([])

      // Diary export and the album for the partner.
      const html = buildDiaryHtml({ entries: s.diary, viewer: PARTNER, members: s.couple.members, title: '우리', photos: {}, generatedOn: day })
      expect(html, tag).not.toContain(SECRET_ENTRY)
      expect(albumFeed(s.diary, PARTNER).some((i) => i.entry.privateTo === OWNER), tag).toBe(false)
      expect(hasSecret(JSON.stringify(albumFeed(s.diary, PARTNER)), ['관계']), tag).toBeUndefined()

      // 병원 요약: only with her consent, and then only shared records.
      const summary = clinicSummary(s, PARTNER, day)
      if (shareLevelOf(s) !== 'details') expect(summary, tag).toBeNull()
      else {
        expect(summary, tag).not.toBeNull()
        summaries++
        for (const out of [JSON.stringify(summary), buildClinicSummaryText(summary!), buildClinicSummaryHtml(summary!)]) {
          expect(hasSecret(out, [TREATMENT_NOTE, 'APPT_NOTE', '관계', 'intimacy', 'personalLog', 'bleedingSince', ...BANNED]), tag).toBeUndefined()
        }
      }

      // Her own summary carries her records but never a diagnosis word, a chip or a line.
      const own = clinicSummary(s, OWNER, day)!
      for (const out of [buildClinicSummaryText(own), buildClinicSummaryHtml(own)]) {
        expect(hasSecret(out, [TREATMENT_NOTE, 'APPT_NOTE', '관계', ...BANNED]), tag).toBeUndefined()
      }

      // The .ics for his calendar: generic wording only.
      const discreet = s.settings.personal?.[PARTNER]?.discreet === true
      for (const ev of fertileWindowEvents(upcomingWindows(s, day, 2), { discreet, peak: false })) {
        expect(hasSecret(`${ev.title} ${ev.description ?? ''}`, ['관계', '출혈', ...(discreet ? ['가임기', '배란'] : [])]), tag).toBeUndefined()
      }
    }
    // The generator really exercised the branches.
    expect(withIntimacy).toBeGreaterThan(80)
    expect(withBleeding).toBeGreaterThan(30)
    expect(summaries).toBeGreaterThan(40)
  })

  it('soft / off / low-pressure partners meet no 가임기·배란·LH word on the card, the strip, the cover line or in the inbox', () => {
    const FERTILE = /가임기|배란|LH|가능성 높/
    for (let seed = 200; seed < 260; seed++) {
      const { state: base, day } = randomState(seed)
      const style = base.settings.alertStyle?.[PARTNER]
      const calm = style !== 'explicit' || base.settings.personal?.[PARTNER]?.lowPressure === true
      if (!calm) continue
      const s = viewerNotices(base, day)
      expect(words(ttcMoment(s, day, PARTNER)), `seed ${seed}`).not.toMatch(FERTILE)
      expect(JSON.stringify(cycleStrip(s, day, PARTNER) ?? {}), `seed ${seed}`).not.toMatch(FERTILE)
      expect(heroLine(s, day, PARTNER, 20).text, `seed ${seed}`).not.toMatch(COVER_WORDS)
      for (const n of inbox(s, PARTNER)) expect(`${n.title} ${n.body}`, `seed ${seed} ${n.key}`).not.toMatch(FERTILE)
      // The treatment word follows the same lens.
      expect(neutralTreatmentWords(s.settings, PARTNER)).toBe(true)
      expect(treatmentLabel('ovulation-induction', neutralTreatmentWords(s.settings, PARTNER))).not.toMatch(/배란/)
    }
  })
})

// ── 2. Bleeding after a positive test: logged from the logs layer ──

describe('양성 뒤 출혈 from the logs layer', () => {
  const pending = () => addPregnancyTest(fresh(), { id: 'pos', date: '2026-09-26', result: 'positive', by: OWNER }, '2026-09-28').state

  it('logs.logPeriodStart marks bleeding during a pending positive from any screen; asPeriod records the period', () => {
    const s = pending()
    expect(isBleedingDuringPositive(s, '2026-09-27')).toBe(true)
    const marked = logPeriodStart(s, '2026-09-27', OWNER, '2026-09-28')
    expect(marked.periods).toEqual(s.periods)
    expect(marked.positivePending).toMatchObject({ since: '2026-09-26', bleedingSince: '2026-09-27' })
    expect(logPeriodOrBleeding(s, '2026-09-27', OWNER, '2026-09-28')).toEqual(marked)
    // Marking again keeps the earlier day; a start before the test is an ordinary period.
    expect(logPeriodStart(marked, '2026-09-28', OWNER, '2026-09-28')).toBe(marked)
    expect(logPeriodStart(marked, '2026-09-20', OWNER, '2026-09-28').periods.some((p) => p.start === '2026-09-20')).toBe(true)
    // [생리로 기록할게요]
    const settled = settleBleedingAsPeriod(marked, '2026-09-28')
    expect(settled.periods.some((p) => p.start === '2026-09-27')).toBe(true)
    expect(settled.positivePending).toBeUndefined()
    expect(logPeriodStart(marked, '2026-09-27', OWNER, '2026-09-28', { asPeriod: true })).toEqual(settled)
    // 되돌리기 for the mark puts the plain pending test back.
    const undo = logUndo(s, { kind: 'period' })
    expect(undoLog(marked, undo)).toEqual(s)
  })

  it('the partner hears nothing until she tells — then one notice without a diagnosis word, routed to 오늘', () => {
    const marked = logPeriodStart(pending(), '2026-09-27', OWNER, '2026-09-28')
    for (const s of [marked, share(marked), withStyle(share(marked), PARTNER, 'explicit')]) {
      const n = viewerNotices(s, '2026-09-28')
      expect(words(ttcMoment(n, '2026-09-28', PARTNER))).not.toMatch(/출혈/)
      expect(inbox(n, PARTNER).some((x) => /출혈/.test(x.body))).toBe(false)
    }
    const told = tellPartnerBleeding(marked, stamp('2026-09-28', 10))
    const his = inbox(told, PARTNER)
    expect(his).toHaveLength(1)
    expect(his[0]!.body).toMatch(/출혈/)
    expect(`${his[0]!.title} ${his[0]!.body}`).not.toMatch(/유산|자궁외|착상|확률|🎉/)
    expect(noticeTarget('system', 'preparing', his[0]!.key)).toBe('today')
    expect(tellPartnerBleeding(told, stamp('2026-09-28', 11)).notifications).toHaveLength(told.notifications.length)
  })
})

// ── 3. Treatments: couple-level, the summary redacted ────────

describe('treatments are couple-level clinic data; the summary never carries owner-only data', () => {
  const withAttempt = (s: AppState) =>
    addTreatment(s, { id: 't1', kind: 'iui', startDate: '2026-08-10', endDate: '2026-08-25', outcome: 'negative', supported: true, noticeExpires: '2027-01-15', note: TREATMENT_NOTE })

  it('both people read the same counts; only the cycle owner edits; the partner’s summary needs her consent', () => {
    const s = withAttempt(fresh())
    expect(supportCounts(s)).toEqual(supportCounts(stateForViewer(s, PARTNER)))
    expect(canEditTreatments(s, OWNER)).toBe(true)
    expect(canEditTreatments(s, PARTNER)).toBe(false)
    expect(showsTreatmentCounter(s)).toBe(true)
    expect(showsTreatmentCounter({ ...s, stage: 'pregnant' })).toBe(false)
    expect(clinicSummary(s, PARTNER, '2026-09-20')).toBeNull()
    const shared = clinicSummary(share(s), PARTNER, '2026-09-20')!
    expect(shared.treatments).toEqual([{ kind: 'iui', startDate: '2026-08-10', endDate: '2026-08-25', outcome: 'negative', supported: true, noticeExpires: '2027-01-15' }])
    expect(JSON.stringify(shared)).not.toContain(TREATMENT_NOTE)
    expect(shared.support).toEqual(supportCounts(s))
  })

  it('the summary is identical with or without 관계일, chips, lines, 나만 보기 entries and cycle notes', () => {
    let s = withAttempt(share(fresh()))
    s = giveIntimacyConsent(s, OWNER, '2026-09-01')
    s = toggleIntimacyDay(s, OWNER, '2026-09-12')
    s = setFeel(s, OWNER, '2026-09-12', 'tired')
    s = setPrivateNote(s, OWNER, '2026-09-12', PRIVATE_LINE)
    s = addEntry(s, { id: 'x', date: '2026-09-12', author: OWNER, text: SECRET_ENTRY }, stamp('2026-09-12', 20))
    s = setEntryPrivacy(s, 'x', OWNER, true)
    const { intimacy: _i, personalLog: _p, cycleNotes: _c, ...bare } = s
    const stripped = { ...bare, diary: [] }
    for (const viewer of ['a', 'b'] as const) {
      expect(clinicSummary(s, viewer, '2026-09-20')).toEqual(clinicSummary(stripped as AppState, viewer, '2026-09-20'))
    }
  })
})

// ── 4. Counters: verified denominators only ─────────────────

describe('support counters use verified denominators only', () => {
  const programs = JSON.parse(readFileSync(join(ROOT, 'docs/research/kr-programs.json'), 'utf8')) as { findings: Array<{ id: string; claim: string; inUI?: boolean; sources: string[] }> }
  const finding = programs.findings.find((f) => f.id === 'ivf-count-merged-2024-02')!

  it('SUPPORT_TOTALS_VERIFIED is the finding’s inUI flag, and every denominator is in its claim with a URL', () => {
    expect(finding).toBeDefined()
    expect(SUPPORT_TOTALS_VERIFIED).toBe(finding.inUI === true)
    expect(finding.sources.some((u) => /^https?:\/\//.test(u))).toBe(true)
    expect(finding.claim).toContain(`인공수정 ${SUPPORT_TOTALS.iui}회`)
    expect(finding.claim).toContain(`체외수정 ${SUPPORT_TOTALS.ivf}회`)
    expect(finding.claim).toContain(`총 ${SUPPORT_TOTALS.all}회`)
  })

  it('unverified → no total anywhere and the 보건소 line; 배란유도 never has one; the summary follows the module flag', () => {
    const s = addTreatment(fresh(), { id: 't', kind: 'ovulation-induction', startDate: '2026-08-01', supported: true })
    const off = supportCounts(s, { verified: false })
    for (const c of [off.iui, off.ivf, off.all, off.ovulationInduction]) {
      expect(c.total).toBeUndefined()
      expect(c.denominatorUnknown).toBe(true)
      expect(supportUsedLabel(c)).toContain(SUPPORT_CHECK_LINE)
    }
    const on = supportCounts(s, { verified: true })
    expect(on.ovulationInduction).toEqual({ used: 1, denominatorUnknown: true })
    expect(on.all).toEqual({ used: 0, total: SUPPORT_TOTALS.all, denominatorUnknown: false })
    expect(clinicSummary(s, OWNER, '2026-09-20')!.support).toEqual(supportCounts(s))
  })
})

// ── 5. 지원결정통지서 reminders ──────────────────────────────

describe('notice-expiry reminders', () => {
  const s = addTreatment(fresh(), { id: 't', kind: 'iui', startDate: '2026-08-10', supported: true, noticeExpires: '2027-01-15' })

  it('D-30 / D-7 / D-1 to both people, keyed per step; routed to 챙길 것; none when pregnant or in the quiet; the engine watches treatments', () => {
    for (const d of NOTICE_EXPIRY_REMINDER_DAYS) {
      const day = addDays('2027-01-15', -d)
      const out = noticeExpiryNotices(s, day)
      expect(out.map((n) => n.to).sort()).toEqual(['a', 'b'])
      for (const n of out) {
        expect(n.key).toBe(`notice-expiry:2027-01-15:${d}:${n.to}`)
        expect(n.title).toContain(`D-${d}`)
        expect(noticeTarget(n.kind, 'preparing', n.key)).toBe('plan')
        expect(hasSecret(`${n.title} ${n.body}`, BANNED)).toBeUndefined()
      }
      expect(planDeadlineNotices(s, day).filter((n) => n.key.startsWith('notice-expiry:'))).toHaveLength(2)
    }
    expect(noticeExpiryNotices(s, '2026-12-10')).toEqual([])
    expect(noticeExpiryNotices(startPregnancy(s, '2026-11-01', '2026-12-01'), '2026-12-16')).toEqual([])
    expect(noticeExpiryNotices(endPregnancy(startPregnancy(s, '2026-11-01', '2026-12-01'), '2026-12-10'), '2026-12-16')).toEqual([])
    const engine = readFileSync(join(ROOT, 'lib/useNotificationEngine.ts'), 'utf8')
    const at = engine.indexOf('}, [today,')
    const deps = engine.slice(at, engine.indexOf('])', at))
    for (const dep of ['treatments', 'settings.anniversaryAlerts', 'settings.shareLevel', 'settings.personal', 'restCycle', 'positivePending']) {
      expect(deps, dep).toContain(dep)
    }
  })
})

// ── 6. The 42-day quiet after a loss ────────────────────────

describe('the quiet after a loss starts from every 준비로 돌아가기 path and keeps the loss out of the average', () => {
  const pregnant = () => startPregnancy(fresh(), '2026-09-01', '2026-09-20')
  const ENDED = '2026-10-05'

  it('backToPreparing and endPregnancy start the same loss rest; its last day is the 42nd day everywhere', () => {
    const p = pregnant()
    const a = backToPreparing(p, ENDED)
    const b = endPregnancy(p, ENDED)
    expect(a).toEqual(b)
    expect(a.restCycle).toEqual({ since: ENDED, reason: 'loss', until: quietEndsOn(ENDED) })
    expect(quietEndsOn(ENDED)).toBe(lossRestUntil(ENDED))
    expect(quietEndsOn(ENDED)).toBe(addDays(ENDED, QUIET_DAYS_AFTER_END - 1))
    // Only a real loss: not pregnant → the same state object.
    const notPregnant = fresh()
    expect(backToPreparing(notPregnant, ENDED)).toBe(notPregnant)
    // The sanitizer keeps `until`.
    expect(sanitizeBackup(a)?.restCycle).toEqual(a.restCycle)
  })

  it('the quiet holds through a period logged inside it, ends on its own after `until`, and every screen rule agrees', () => {
    const lost = backToPreparing(pregnant(), ENDED)
    const until = quietEndsOn(ENDED)
    const inside = logPeriodStart(lost, '2026-10-25', OWNER, '2026-10-25')
    expect(inside.periods.some((p) => p.start === '2026-10-25')).toBe(true)
    expect(activeRest(inside, '2026-10-26')).toEqual(lost.restCycle)
    expect(activeRest(inside, until)).toEqual(lost.restCycle)
    expect(activeRest(inside, addDays(until, 1))).toBeUndefined()
    expect(activeRest(inside)).toEqual(lost.restCycle) // no today: the quiet side
    // Screens with today: the home, the lens, the sheet, the date ideas.
    expect(ttcMoment(inside, until, OWNER)?.kind).toBe('after-loss')
    expect(ttcMoment(inside, addDays(until, 1), OWNER)?.kind).not.toBe('after-loss')
    expect(cycleLens(inside, OWNER, until).pause).toBe('rest')
    expect(cycleLens(inside, OWNER, addDays(until, 1)).pause).toBeUndefined()
    expect(defaultLogKind(inside, until, until)).toBe('period')
    expect(lhAskDue(inside, until)).toBe(false)
    expect(fertileHintsAllowed(inside, PARTNER, until)).toBe(false)
    expect(fertileHintsAllowed(inside, PARTNER, addDays(until, 1))).toBe(true)
    expect(fertileHintsAllowed(inside, PARTNER)).toBe(false) // without today: quiet until a period after `until`
    // No date notice through the quiet, a logged period included.
    for (const day of ['2026-10-10', '2026-10-25', '2026-11-10', until]) {
      const keys = scheduledNotices(inside, day).map((n) => n.key)
      expect(keys.filter((k) => /^(late|late-test|period-due|fertile|peak|amenorrhea)/.test(k)), day).toEqual([])
    }
    // The owner's guidance line is one of the evidenced lines; the partner never gets one.
    const m = ttcMoment(inside, '2026-10-10', OWNER)!
    expect(Object.values(AFTER_LOSS_LINES)).toContain(m.guidance?.text)
    expect(ttcMoment(inside, '2026-10-10', PARTNER)?.guidance).toBeUndefined()
    expect(words(ttcMoment(inside, '2026-10-10', PARTNER))).not.toMatch(/출혈|생리|LH|가임기/)
  })

  it('the gap that held the pregnancy never enters the average, the range, irregular, the summary or the history fill', () => {
    const lost = backToPreparing(pregnant(), ENDED)
    const after = logPeriodStart(lost, '2026-10-20', OWNER, '2026-10-20', { asPeriod: true })
    // 09-01 → 10-20 is 49 days: inside the plausible range, so only the exclusion keeps it out.
    expect(spansEndedPregnancy('2026-09-01', '2026-10-20', after.pregnancy)).toBe(true)
    expect(spansEndedPregnancy('2026-08-04', '2026-09-01', after.pregnancy)).toBe(false)
    expect(spansEndedPregnancy('2026-10-20', '2026-11-17', after.pregnancy)).toBe(false)
    const mixed = cycleStats(after.periods, after.cycle)
    expect(mixed.lengths).toEqual([28, 28, 28, 49])
    const clean = cycleStats(after.periods, after.cycle, undefined, undefined, after.pregnancy)
    expect(clean.lengths).toEqual([28, 28, 28])
    expect(clean).toMatchObject({ average: 28, min: 28, max: 28, irregular: false })
    // Every lib reader passes the record through.
    expect(doctorAdvice(after, '2026-12-20')?.reasons ?? []).not.toContain('irregular')
    const past = addDays(quietEndsOn(ENDED), 1)
    expect(cycleSummary(after, past, 'explicit').stats.lengths).toEqual([28, 28, 28])
    expect(clinicSummary(after, OWNER, past)!.stats).toMatchObject({ average: 28, min: 28, max: 28 })
    expect(cycleHistory(after, past).maxCycle).toBeGreaterThan(0)
    // A pregnancy still going on, or ended with a birth (no endedAt), excludes nothing.
    expect(spansEndedPregnancy('2026-09-01', '2026-10-20', { confirmedAt: '2026-09-20' })).toBe(false)
    expect(spansEndedPregnancy('2026-09-01', '2027-07-01', pregnant().pregnancy)).toBe(false)
  })
})

// ── 7. "(예상)" once per card: legend, headline, moments ──────

describe('"(예상)" at most once per card — home legend and 주기 headline', () => {
  it('ringLegend: no marker with estimate none, at most one with estimate one; cycleSummary headline ≤ 1 for every viewer and day', () => {
    const s = fresh()
    for (let i = 0; i < 40; i++) {
      const day = addDays('2026-09-01', i)
      for (const viewer of ['a', 'b'] as const) {
        const strip = cycleStrip(share(s), day, viewer)
        if (strip) {
          expect(ringLegend(strip, { quietWindow: false, estimate: 'none' }).reduce((n, l) => n + estimateMarks(l.label), 0), `${day} ${viewer}`).toBe(0)
          expect(ringLegend(strip, { quietWindow: false, estimate: 'one' }).reduce((n, l) => n + estimateMarks(l.label), 0), `${day} ${viewer}`).toBeLessThanOrEqual(1)
        }
        for (const st of [s, share(s)]) {
          const lens = cycleLens(st, viewer, day)
          const h = cycleSummary(st, day, lens.view, lens).headline
          expect(estimateMarks(h.title) + estimateMarks(h.sub), `${day} ${viewer} ${h.title}`).toBeLessThanOrEqual(1)
          const m = ttcMoment(st, day, viewer)
          expect(estimateMarks(words(m)), `${day} ${viewer} ${m?.copy}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

// ── 8. 'N년 전 오늘' exclusions ───────────────────────────────

describe("'N년 전 오늘' exclusions (설정 › 첫 화면 promises)", () => {
  const on = (s: AppState): AppState => setCoupleFlag(s, 'memories', true)
  const entry = (s: AppState, date: ISODate, text: string, author: MemberId = OWNER) => addEntry(s, { id: `m-${date}-${text}`, date, author, text }, stamp(date, 20))

  it('a positive test’s day shows only inside a pregnancy that went on; a settled positive, a faint line and a clinic day never do', () => {
    // A positive inside a pregnancy that went on (no endedAt): the entry the day of the test is a happy memory.
    const carried = on({
      ...startPregnancy(fresh({ periods: [{ start: '2025-08-20' }] }), '2025-08-20', '2025-09-25'),
      pregnancyTests: [{ id: 'p', date: '2025-09-15', result: 'positive', by: OWNER }],
    })
    const happy = addEntry(carried, { id: 'two-lines', date: '2025-09-15', author: OWNER, text: '두 줄!', stage: 'preparing' }, stamp('2025-09-15', 20))
    expect(memoryFor(happy, '2026-09-15', OWNER)).toBeDefined()
    // The same test with no pregnancy record covering it (settled by a period) is left alone.
    const settled = on(fresh({ periods: [{ start: '2025-08-20' }, { start: '2025-09-30' }], pregnancyTests: [{ id: 'p', date: '2025-09-15', result: 'positive', by: OWNER }] }))
    expect(memoryFor(entry(settled, '2025-09-15', '두 줄!'), '2026-09-15', OWNER)).toBeUndefined()
    expect(memoryFor(entry(settled, '2025-09-16', '산책'), '2026-09-16', OWNER)).toBeDefined()
    // A faint line's day, then and now.
    const faint = on(fresh({ pregnancyTests: [{ id: 'f', date: '2025-09-18', result: 'faint', by: OWNER }] }))
    expect(memoryFor(entry(faint, '2025-09-18', '산책'), '2026-09-18', OWNER)).toBeUndefined()
    // A clinic day (not an admin errand).
    let clinic = on(fresh())
    clinic = addAppointment(clinic, { date: '2025-09-18', title: '검사', who: OWNER, kind: 'test' }, OWNER)
    clinic = addAppointment(clinic, { date: '2025-09-19', title: '보건소 신청', who: OWNER, kind: 'admin' }, OWNER)
    expect(memoryFor(entry(clinic, '2025-09-18', '파스타'), '2026-09-18', OWNER)).toBeUndefined()
    expect(memoryFor(entry(clinic, '2025-09-19', '파스타'), '2026-09-19', OWNER)).toBeDefined()
    // '나만 보기' is nobody's shared memory.
    const mine = entry(on(fresh()), '2025-09-18', '혼자')
    const priv = setEntryPrivacy(mine, 'm-2025-09-18-혼자', OWNER, true)
    expect(memoryFor(priv, '2026-09-18', OWNER)).toBeUndefined()
    expect(memoryFor(priv, '2026-09-18', PARTNER)).toBeUndefined()
    // Off by default; unset after switching back; the demo never shows a health word on its line.
    expect(memoryFor(mine, '2026-09-18', OWNER)).toBeDefined()
    expect(memoryFor(setCoupleFlag(mine, 'memories', false), '2026-09-18', OWNER)).toBeUndefined()
  })
})

// ── 9. Couple-wide switches: unset = default, old saves unchanged ──

describe('settings switches and old saves', () => {
  it('setCoupleFlag leaves the default unset (byte-identical save), writes the other value, and the readers agree', () => {
    const s = fresh()
    const before = JSON.stringify(s)
    expect(setCoupleFlag(s, 'memories', false)).toBe(s)
    expect(setCoupleFlag(s, 'anniversaryAlerts', true)).toBe(s)
    expect(setCoupleFlag(s, 'showTryCount', false)).toBe(s)
    const flipped = setCoupleFlag(setCoupleFlag(setCoupleFlag(s, 'memories', true), 'anniversaryAlerts', false), 'showTryCount', true)
    expect(flipped.settings).toMatchObject({ memories: true, anniversaryAlerts: false, showTryCount: true })
    expect(memoriesOn(flipped.settings)).toBe(true)
    expect(anniversaryAlertsOn(flipped.settings)).toBe(false)
    expect(showTryCountOn(flipped.settings)).toBe(true)
    const back = setCoupleFlag(setCoupleFlag(setCoupleFlag(flipped, 'memories', false), 'anniversaryAlerts', true), 'showTryCount', false)
    expect(JSON.stringify(back)).toBe(before)
    expect(SETTINGS_DEFAULTS).toEqual({ memories: false, anniversaryAlerts: true, showTryCount: false })
    expect(PERSONAL_DEFAULTS).toEqual({ acceptNudges: true })
  })

  it('기념일 알림 off: no anniv: notice and no cover line; unset = off while preparing, on later (N27)', () => {
    const base = fresh({ couple: { ...fresh().couple, marriedDate: '2024-09-08' } })
    const off = setCoupleFlag(base, 'anniversaryAlerts', false)
    const on = setAnniversaryAlerts(base, true)
    const pregnant: AppState = { ...base, stage: 'pregnant' }
    for (const day of ['2026-09-01', '2026-09-08']) {
      // Preparing and never chosen: quiet (N27, positioning §3-3).
      expect(anniversaryNotices(base, day)).toEqual([])
      expect(anniversaryNotices(off, day)).toEqual([])
      expect(scheduledNotices(off, day).filter((n) => n.key.startsWith('anniv:'))).toEqual([])
      expect(heroLine(off, day, PARTNER, 20).kind).not.toBe('anniversary')
      // A later stage keeps the old default: on, with the week's heads-up.
      expect(anniversaryNotices(pregnant, day).length).toBeGreaterThan(0)
    }
    // Turned on while preparing: the day itself only, never the week before.
    expect(anniversaryNotices(on, '2026-09-01')).toEqual([])
    expect(anniversaryNotices(on, '2026-09-08').map((n) => n.key)).toEqual(['anniv:married-year:2:2026-09-08:0:a', 'anniv:married-year:2:2026-09-08:0:b'])
    expect(anniversaryNotices(pregnant, '2026-09-01').every((n) => n.key.includes(':7:'))).toBe(true)
    expect(anniversaryAlertsOn(on.settings, 'preparing')).toBe(true)
    expect(anniversaryAlertsOn(base.settings, 'preparing')).toBe(false)
    expect(anniversaryAlertsOn(base.settings, 'pregnant')).toBe(true)
  })

  it('a save from before Next B loads byte-identical, and garbage Next B fields are dropped', () => {
    let s = fresh()
    s = setFeel(s, OWNER, '2026-09-10', 'tired')
    s = addEntry(s, { id: 'e', date: '2026-09-10', author: OWNER, text: '산책' }, stamp('2026-09-10', 20))
    const json = JSON.stringify(s)
    for (const key of ['treatments', 'leaveDays', 'intimacy', 'memories', 'anniversaryAlerts', 'showTryCount', 'acceptNudges', 'homeDiscreet', 'until', 'bleedingSince']) {
      expect(json, key).not.toContain(`"${key}"`)
    }
    expect(JSON.stringify(parseState(json))).toBe(json)
    expect(JSON.stringify(normalize(JSON.parse(json)))).toBe(json)

    const dirty = {
      ...JSON.parse(json),
      treatments: 'x',
      leaveDays: [],
      intimacy: { by: 'b', days: ['2026-09-10'] },
      restCycle: { since: '2026-09-05', reason: 'rest', until: '2026-09-01' },
      positivePending: { since: '2026-09-26', bleedingSince: '2026-09-20' },
      settings: { ...JSON.parse(json).settings, memories: 'yes', anniversaryAlerts: 1, showTryCount: null, personal: { a: { acceptNudges: 'no', homeDiscreet: 0 } } },
    }
    const cleaned = parseState(JSON.stringify(dirty))!
    expect(cleaned.treatments).toBeUndefined()
    expect(cleaned.leaveDays).toBeUndefined()
    expect(cleaned.intimacy).toBeUndefined()
    expect(cleaned.restCycle).toEqual({ since: '2026-09-05', reason: 'rest' })
    expect(cleaned.positivePending).toEqual({ since: '2026-09-26' })
    expect(cleaned.settings.memories).toBeUndefined()
    expect(cleaned.settings.anniversaryAlerts).toBeUndefined()
    expect(cleaned.settings.showTryCount).toBeUndefined()
    expect(cleaned.settings.personal?.a?.acceptNudges).toBeUndefined()
    expect(cleaned.settings.personal?.a?.homeDiscreet).toBeUndefined()
  })

  it('the demo states round-trip through the sanitizer with their Next B records intact', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      const s = createDemoState('2026-10-02', new Date(2026, 9, 2, 9, 0), stage)
      const back = parseState(JSON.stringify(s))!
      expect(back.treatments).toEqual(s.treatments)
      expect(back.leaveDays).toEqual(s.leaveDays)
      expect(back.restCycle).toEqual(s.restCycle)
    }
  })
})

// ── 10. Module hygiene: graph, split, titles ─────────────────

describe('module hygiene', () => {
  /** Value imports between lib/logic modules (type-only imports don't load code). */
  function logicGraph(): Record<string, string[]> {
    const dir = join(ROOT, 'lib/logic')
    const graph: Record<string, string[]> = {}
    const STMT = /^import\s+([\s\S]*?)\s+from\s+'([^']+)'/gm
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      const deps = new Set<string>()
      for (const m of src.matchAll(STMT)) {
        const clause = m[1]!
        const from = m[2]!
        if (!from.startsWith('./')) continue
        if (/^type\s/.test(clause)) continue
        const inner = clause.replace(/^[^{]*\{/, '').replace(/\}[^}]*$/, '')
        const specs = inner.split(',').map((x) => x.trim()).filter(Boolean)
        const hasDefault = !clause.trim().startsWith('{')
        if (!hasDefault && specs.length && specs.every((x) => x.startsWith('type '))) continue
        deps.add(`${from.slice(2)}.ts`)
      }
      graph[f] = [...deps]
    }
    return graph
  }

  it('lib/logic has no value-import cycle, and the modules settings.ts imports never import it back', () => {
    const graph = logicGraph()
    const cycles = new Set<string>()
    const dfs = (start: string, node: string, path: string[]) => {
      for (const d of graph[node] ?? []) {
        if (d === start) cycles.add([...path, d].join(' → '))
        else if (!path.includes(d) && path.length < 10) dfs(start, d, [...path, d])
      }
    }
    for (const f of Object.keys(graph)) dfs(f, f, [f])
    expect([...cycles]).toEqual([])
    // The closure of settings.ts (it imports notifications, cover, today, …) must not contain settings.ts.
    const closure = new Set<string>()
    const walk = (f: string) => {
      for (const d of graph[f] ?? []) if (!closure.has(d)) { closure.add(d); walk(d) }
    }
    walk('settings.ts')
    expect(closure.has('settings.ts')).toBe(false)
    for (const f of ['notifications.ts', 'anniversary.ts', 'cover.ts', 'pregnancy.ts', 'ttc.ts', 'prefs.ts', 'cycle.ts', 'positiveBleeding.ts', 'intimacy.ts', 'treatments.ts', 'logs.ts']) {
      expect(graph[f], f).not.toContain('settings.ts')
    }
  })

  it('lib/onboardingDraft.ts holds the onboarding helpers; lib/demo.ts re-exports them and never the other way round', () => {
    for (const key of Object.keys(draft)) expect((demo as Record<string, unknown>)[key], key).toBe((draft as Record<string, unknown>)[key])
    expect(typeof draft.stateFromOnboarding).toBe('function')
    expect(typeof draft.initialDraft).toBe('function')
    expect('createDemoState' in draft).toBe(false)
    const src = readFileSync(join(ROOT, 'lib/onboardingDraft.ts'), 'utf8')
    expect(src).not.toMatch(/from '\.\/demo'/)
    expect(readFileSync(join(ROOT, 'lib/demo.ts'), 'utf8')).toContain("export * from './onboardingDraft'")
  })

  it('the clinic summary sheet title lives in lib (so the sheet can load lazily) and matches the component', () => {
    const sheet = readFileSync(join(ROOT, 'components/clinic/ClinicSummarySheet.tsx'), 'utf8')
    expect(sheet).toContain(`'${CLINIC_SUMMARY_SHEET_TITLE}'`)
  })

  it('today-aware readers: lhAskDue / defaultLogKind / fertileHintsAllowed take today; an ordinary rest still needs a period', () => {
    const rest = startRestCycle(fresh(), '2026-09-05', 'rest')
    expect(activeRest(rest, '2026-12-01')).toEqual(rest.restCycle) // no `until`: never expires on its own
    expect(lhAskDue(rest, '2026-09-12')).toBe(false)
    expect(defaultLogKind(rest, '2026-09-12', '2026-09-12')).toBe('period')
    expect(fertileHintsAllowed(rest, PARTNER, '2026-09-12')).toBe(false)
    const month = addMonths('2026-09-05', 1)
    expect(activeRest(logPeriodStart(rest, month, OWNER, month), month)).toBeUndefined()
  })
})
