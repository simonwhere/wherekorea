// 같이 챙길 것 — the privacy / logic review (founder request 2026-10-09:
// "여자가 챙겨야 할 것들을 남자에게도 계속 보여줘야해 같이 하는거야").
//
// Adversarial property tests across both orientations of the couple (the cycle
// owner is 'b' or 'a'), the three stages, random plans and random days:
//  1. his views — the app (togetherRow / togetherItems / the focus card rule)
//     and every one of the seven link days — never show HER item as overdue,
//     lapsed, '안 했어요' or with a pressure word; the link carries roadmap ids
//     only, no custom item, no time / place / title / note of her appointments,
//     and no date while preparing;
//  2. [같이 할게요] round-trips through 'support' events exactly like the app's
//     own button, is idempotent per event id and per answer, and never touches
//     anything else of hers;
//  3. the pregnant '이번 주 우리 둘' never offers a medical, timing or banned word;
//  4. his day-before heads-up follows his alert style, the stage and the quiet
//     after a loss, keeps one key per appointment, and the lock screen masks it;
//  5. nothing she logs privately moves any of it (the preparing leak property
//     on the new surfaces, and the pregnant ones too);
//  6. scripts/validate-content.mjs rejects bad support lines;
//  7. old saves load and read cleanly.

import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { focusItemsFor, ownOverdue } from '@/components/today/model'
import { ROADMAP, templateById } from '@/lib/content/roadmap'
import { addDays, diffDays, isISODate } from '@/lib/dates'
import { mondayOf } from '@/lib/logic/checks'
import { createInitialState } from '@/lib/initial'
import { addAppointment } from '@/lib/logic/appointments'
import { addLHTest, addPregnancyTest, logPeriodStart } from '@/lib/logic/logs'
import { myPrep } from '@/lib/logic/myPrep'
import { appliedEventKey, applyPartnerEvent, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { LINK_TOGETHER_ELSEWHERE, applyReceivedEvents, buildPartnerSnapshot, linkStageCard } from '@/lib/logic/partnerSnapshot'
import { FERTILITY_APPLY_ID, setFertilityApplied } from '@/lib/logic/partnerTrack'
import { setFeel, setPrivateNote } from '@/lib/logic/personalLog'
import { planItems, tickItem } from '@/lib/logic/plan'
import { TOGETHER_TASK_LINE, TOGETHER_VISIT_LINE, appointmentReminders, planDeadlineNotices, togetherTaskKey } from '@/lib/logic/planNotices'
import { discreetFor, setPersonalPref, setShareLevel } from '@/lib/logic/prefs'
import { gestationalAge, recordBirth, startPregnancy } from '@/lib/logic/pregnancy'
import { STAGE_PHASES, addCustomTask } from '@/lib/logic/roadmap'
import { setAlertStyle } from '@/lib/logic/settings'
import { signalsFor } from '@/lib/logic/signals'
import { endPregnancy, noticeTarget } from '@/lib/logic/today'
import {
  LINK_TOGETHER_MAX,
  canSupportItem,
  carrierOf,
  isSupported,
  linkTogether,
  partnerSupportLines,
  supportItem,
  supportKey,
  togetherItems,
  togetherRow,
  unsupportItem,
  type TogetherItem,
} from '@/lib/logic/together'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import {
  CHECKUP_DAY_OPTION,
  PREGNANT_WEEK_OPTIONS,
  THIRD_TRIMESTER_OPTIONS,
  markWeekDone,
  partnerWeekSummary,
  pickWeek,
  sharedCheckupInWeek,
  weekOf,
  weekOptions,
} from '@/lib/logic/weekTogether'
import { parseState } from '@/lib/storage'
import { SCHEMA_VERSION } from '@/lib/sync/migrations'
import type { AlertStyle, AppState, Appointment, AppointmentKind, ISODate, MemberId, Stage } from '@/lib/types'

// Long synchronous property walks back to back keep the vitest worker from
// answering its runner (a 60 s RPC timeout → 'Timeout calling onTaskUpdate').
beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)))
const breathe = () => new Promise<void>((resolve) => setImmediate(resolve))

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TODAY: ISODate = '2026-10-09'

const NEUTRAL = new Set(['upcoming', 'this-week', 'done'])
/** Her item on his screen never says any of these. */
const PRESSURE = /기한 지남|지났어요|안 했어요|마감|놓쳤|늦었|서둘|빨리/
/** The only status words his side of her items may carry. */
const NEUTRAL_LABEL = /^(예정|이번 주|했어요 ✓)( · .+)?$/
const BANNED = /숙제|실패|노력|오늘 꼭|관계를 가져야/
const MEDICAL = /효과|예방|위험|낮춰|높여|줄여|좋아져|개선|치료|진단|처방|복용|확률|가능성|%|영양제|약 /
/** integrationNow3's TIMING_WORDS (the N21 catalogue rule) — the pregnant catalogue keeps it too. */
const TIMING = /가임|배란|우리의 주간|LH|배테기|테스트|임테기|생리|관계|시도|타이밍|횟수|숙제|노력|실패|오늘 꼭|임신|주기/
const FERTILE_WORDS = /가임|배란|LH|배테기|임테기/

/** Strings planted in what is hers alone — none of them may reach the link. */
const SECRET = {
  apptTitle: 'HER_APPT_TITLE_Z9',
  apptNote: 'HER_APPT_NOTE_Z9',
  apptPlace: 'HER_PLACE_Z9',
  apptTime: '06:17',
  custom: 'HER_CUSTOM_Z9',
  privateNote: 'PRIVATE_NOTE_Z9',
}

// ── Builders ────────────────────────────────────────────────

/** A couple; `carrier` is the member whose cycle it is (both orientations are walked). */
function couple(carrier: MemberId = 'b'): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: carrier,
      lastPeriodStart: '2026-09-20',
      ttcStart: '2026-06-01',
    },
    new Date(2026, 5, 1, 9, 0),
  )
  return { ...s, createdAt: '2026-06-01T09:00:00+09:00', periods: [{ start: '2026-07-26' }, { start: '2026-08-23' }, { start: '2026-09-20' }] }
}

const otherOf = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a')
const herOf = (s: AppState): MemberId => carrierOf(s)
const himOf = (s: AppState): MemberId => otherOf(carrierOf(s))

function pregnantOn(carrier: MemberId, lmp: ISODate): AppState {
  return startPregnancy(couple(carrier), lmp, addDays(lmp, 35))
}

function parentingOn(carrier: MemberId, birth: ISODate): AppState {
  const p = startPregnancy(couple(carrier), addDays(birth, -275), addDays(birth, -240))
  return recordBirth(p, { name: '하늘', birthDate: birth, sex: 'unknown' })
}

/** A small deterministic PRNG (xorshift32). */
function rng(seed: number): () => number {
  let x = seed >>> 0 || 0x9e3779b9
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 0x1_0000_0000
  }
}
const pickOf = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

const KINDS: readonly AppointmentKind[] = ['hospital', 'test', 'vaccine', 'injection', 'admin', 'other']

/**
 * Random plan activity on a stage base: ticks (by either), bookings of hers /
 * his / both for roadmap items (some carrying her secret words, some done,
 * some deleted as tombstones), the couple's own items, and his [같이 할게요]s.
 */
function scramble(base: AppState, seed: number, around: ISODate): AppState {
  const r = rng(seed)
  const her = herOf(base)
  const him = himOf(base)
  let s = base
  const phases = STAGE_PHASES[s.stage]
  const pool = ROADMAP.filter((t) => phases.includes(t.phase) || r() < 0.15)
  for (let i = 0; i < 6; i++) {
    const t = pickOf(r, pool)
    s = tickItem(t.id, true, addDays(around, -Math.floor(r() * 40)), r() < 0.5 ? her : him)(s)
  }
  for (let i = 0; i < 7; i++) {
    const t = pickOf(r, pool)
    const who = pickOf(r, [her, her, him, 'both'] as const)
    const mine = who === her
    s = addAppointment(
      s,
      {
        date: addDays(around, Math.floor(r() * 30) - 8),
        time: mine ? SECRET.apptTime : '10:00',
        title: mine ? SECRET.apptTitle : '같이 가는 날',
        place: mine ? SECRET.apptPlace : '병원',
        note: mine ? SECRET.apptNote : undefined,
        who,
        kind: pickOf(r, KINDS),
        ...(r() < 0.8 ? { taskId: t.id } : {}),
      },
      who === 'both' ? her : who,
    )
    const last = s.appointments[s.appointments.length - 1]!
    if (r() < 0.15) s = { ...s, appointments: s.appointments.map((a) => (a.id === last.id ? { ...a, done: true } : a)) }
    else if (r() < 0.15) s = { ...s, appointments: s.appointments.map((a) => (a.id === last.id ? { ...a, deletedAt: `${around}T09:00:00+09:00` } : a)) }
  }
  for (let i = 0; i < 2; i++) {
    const who = pickOf(r, [her, him, 'both'] as const)
    s = addCustomTask(
      s,
      { title: who === her ? SECRET.custom : '우리 할 일', phase: pickOf(r, phases), who, due: r() < 0.7 ? addDays(around, Math.floor(r() * 20) - 5) : undefined },
      her,
    )
  }
  for (const it of planItems(s, around)) if (r() < 0.25) s = supportItem(s, him, it.id, around)
  return s
}

/** Her private records on `d` (never told): they must not move anything on his side. */
const UNTOLD: ReadonlyArray<{ name: string; add: (s: AppState, d: ISODate) => AppState }> = [
  { name: 'period start', add: (s, d) => logPeriodStart(s, d, herOf(s), d) },
  { name: 'LH positive', add: (s, d) => addLHTest(s, { date: d, result: 'positive' }, d) },
  {
    name: 'positive test',
    add: (s, d) => {
      const { state, test } = addPregnancyTest(s, { date: d, result: 'positive', by: herOf(s) }, d)
      return markPositivePending(state, d, test?.id)
    },
  },
  { name: 'rest', add: (s, d) => startRestCycle(s, d, 'rest') },
  { name: 'feel', add: (s, d) => setFeel(s, herOf(s), d, 'tired') },
  { name: '나만 보기', add: (s, d) => setPrivateNote(s, herOf(s), d, SECRET.privateNote) },
  { name: 'share level none', add: (s) => setShareLevel(s, herOf(s), 'none') },
  { name: 'share level details', add: (s) => setShareLevel(s, herOf(s), 'details') },
  {
    name: 'her appointment (no item)',
    add: (s, d) => addAppointment(s, { date: addDays(d, 2), time: '07:40', title: SECRET.apptTitle, note: SECRET.apptNote, who: herOf(s), kind: 'injection' }, herOf(s)),
  },
]

// ── 1. Her items on his screens: neutral, never overdue ──────

function sceneList(): Array<{ name: string; state: AppState; days: ISODate[] }> {
  const out: Array<{ name: string; state: AppState; days: ISODate[] }> = []
  for (const carrier of ['b', 'a'] as const) {
    for (let k = 0; k < 4; k++) {
      const seed = (carrier === 'b' ? 1000 : 2000) + k
      out.push({ name: `${carrier} preparing #${k}`, state: scramble(couple(carrier), seed, TODAY), days: [-20, -3, 0, 4, 11, 30].map((n) => addDays(TODAY, n)) })
      // Pregnant from 5주 to 40주 at TODAY; and a pregnancy ~ 30주 to reach the 3rd trimester items.
      const lmp = addDays(TODAY, -(35 + k * 60))
      const preg = pregnantOn(carrier, lmp)
      out.push({ name: `${carrier} pregnant #${k}`, state: scramble(preg, seed + 7, TODAY), days: [-30, -6, 0, 3, 9, 25, 60].map((n) => addDays(TODAY, n)) })
      const birth = addDays(TODAY, -(k * 25 + 5))
      out.push({ name: `${carrier} parenting #${k}`, state: scramble(parentingOn(carrier, birth), seed + 13, TODAY), days: [0, 10, 40, 75].map((n) => addDays(TODAY, n)) })
    }
  }
  return out
}

function expectNeutral(row: Pick<TogetherItem, 'status' | 'label'>, where: string, mayBeNull: boolean): void {
  expect(NEUTRAL.has(row.status), `${where} status ${row.status}`).toBe(true)
  if (row.label === null) {
    expect(mayBeNull, `${where} label null in a list`).toBe(true)
    return
  }
  expect(row.label, where).toMatch(NEUTRAL_LABEL)
  expect(row.label, where).not.toMatch(PRESSURE)
}

describe('1. her items on his screens — neutral only, in the app and on every day of the link', () => {
  const scenes = sceneList()

  it('the app: every row of hers (togetherRow), every list (togetherItems), the focus card rule — both orientations, every stage', async () => {
    let rows = 0
    for (const { name, state: s, days } of scenes) {
      const him = himOf(s)
      const her = herOf(s)
      for (const d of days) {
        const items = planItems(s, d)
        for (const item of items) {
          const row = togetherRow(s, d, him, item)
          if (row.whose !== 'theirs') continue
          rows++
          expectNeutral(row, `${name} ${d} ${item.id}`, true)
          // Overdue or lapsed reads as nothing — never a word about it.
          if (item.status === 'overdue' || (item.lapsed && item.status !== 'done')) expect(row.label, `${name} ${d} ${item.id}`).toBeNull()
          // Support lines are his; her own screen never gets one.
          expect(togetherRow(s, d, her, item).support, `${name} ${d} ${item.id} on her screen`).toBeUndefined()
        }
        for (const whose of [undefined, ['theirs'], ['theirs', 'ours']] as const) {
          for (const row of togetherItems(s, d, him, whose ? { whose } : {})) {
            // Every row on a home card says where it stands ('예정' when it has no day yet).
            expect(row.label, `${name} ${d} list ${row.id}`).not.toBeNull()
            if (row.whose === 'theirs') expectNeutral(row, `${name} ${d} list ${row.id}`, false)
            expect(row.whose === 'theirs' && row.status === 'overdue').toBe(false)
          }
        }
        // The 이번 주 챙길 것 card rule (components/today/model): her overdue / lapsed open items are not on his card,
        // and the card's warning is never about her.
        const focus = focusItemsFor(s, d, him, items)
        for (const f of focus) {
          if (f.status === 'done') continue
          const theirs = f.owners.length === 1 && f.owners[0] === her
          if (theirs) expect(f.status === 'overdue' || f.lapsed, `${name} ${d} focus ${f.id}`).toBe(false)
        }
        const onlyHersOverdue = items.filter((i) => i.status === 'overdue').every((i) => i.owners.length === 1 && i.owners[0] === her)
        if (onlyHersOverdue) expect(ownOverdue(items, him), `${name} ${d}`).toBe(false)
      }
      await breathe()
    }
    expect(rows).toBeGreaterThan(1000)
  }, 60_000)

  it('the link: all seven days — neutral rows of hers / shared only, no date while preparing, nothing of hers alone travels', async () => {
    let listed = 0
    for (const { name, state: s, days } of scenes) {
      const him = himOf(s)
      for (const d of days.slice(0, 4)) {
        const snap = buildPartnerSnapshot(s, d, him)!
        snap.days.forEach((day, k) => {
          const where = `${name} ${d} +${k}`
          const plan = day.togetherPlan
          if (!plan) return
          expect(plan.items.length, where).toBeLessThanOrEqual(LINK_TOGETHER_MAX)
          const elsewhere = new Set([...LINK_TOGETHER_ELSEWHERE, ...(day.task ? [day.task.id] : []), ...(day.myPrep?.items ?? []).map((i) => i.id)])
          for (const it of plan.items) {
            listed++
            expectNeutral({ status: it.status, label: it.label }, `${where} ${it.id}`, false)
            expect(templateById(it.id), `${where} ${it.id} is a roadmap item`).toBeDefined()
            expect(['theirs', 'ours']).toContain(it.whose)
            expect(it.support.length, where).toBeGreaterThan(0)
            expect(elsewhere.has(it.id), `${where} ${it.id} is on another card`).toBe(false)
            if (s.stage === 'preparing') {
              expect(it.label, `${where} ${it.id}: no date while preparing`).toMatch(/^(예정|이번 주|했어요 ✓)$/)
              expect(it.date, where).toBeUndefined()
            }
          }
          const json = JSON.stringify({ plan, stage: day.stageCard ?? null })
          for (const secret of Object.values(SECRET)) expect(json.includes(secret), `${where}: ${secret}`).toBe(false)
          // The words about her item (not the catalogue's own title, e.g. '산후도우미 바우처 신청 마감'): never pressure.
          for (const it of plan.items) expect(`${it.label} ${it.support} ${it.supportNote ?? ''}`, `${where} ${it.id}`).not.toMatch(PRESSURE)
          if (day.stageCard) expect(JSON.stringify(day.stageCard), where).not.toMatch(PRESSURE)
          if (day.stageCard?.checkup?.with === 'hers') {
            expect(day.stageCard.checkup.time, where).toBeUndefined()
            expect(day.stageCard.checkup.place, where).toBeUndefined()
          }
        })
      }
      await breathe()
    }
    expect(listed).toBeGreaterThan(300)
  }, 60_000)

  it("the link's leave-outs never move the other rows (exclude before the cut)", () => {
    for (const { name, state: s, days } of scenes) {
      const him = himOf(s)
      for (const d of days) {
        const all = linkTogether(s, d, him)
        if (!all) continue
        const ex = all.items.filter((_, i) => i % 2 === 0).map((i) => i.id)
        const cut = linkTogether(s, d, him, { exclude: ex })
        const kept = all.items.filter((i) => !ex.includes(i.id)).map((i) => i.id)
        const got = (cut?.items ?? []).map((i) => i.id)
        expect(got.some((id) => ex.includes(id)), `${name} ${d}`).toBe(false)
        // What stayed keeps its order, and the freed places go to the next rows.
        expect(got.slice(0, kept.length), `${name} ${d}`).toEqual(kept)
        expect(got.length, `${name} ${d}`).toBeGreaterThanOrEqual(kept.length)
      }
    }
  })

  it('a deleted appointment (a tombstone) gives no day — not in the app, not on the link, not in his 🔔', () => {
    for (const carrier of ['b', 'a'] as const) {
      const s0 = pregnantOn(carrier, '2026-07-20') // NT open on TODAY
      const her = herOf(s0)
      const him = himOf(s0)
      const s1 = addAppointment(s0, { date: addDays(TODAY, 1), time: '09:00', title: 'NT', who: her, kind: 'test', taskId: 'p1-nt' }, her)
      const id = s1.appointments[s1.appointments.length - 1]!.id
      const gone: AppState = { ...s1, appointments: s1.appointments.map((a) => (a.id === id ? { ...a, deletedAt: `${TODAY}T08:00:00+09:00` } : a)) }
      const nt = (st: AppState) => togetherItems(st, TODAY, him).find((r) => r.id === 'p1-nt')
      expect(nt(s1)?.date).toBe(addDays(TODAY, 1))
      expect(nt(gone)).toEqual(nt(s0))
      expect(linkTogether(gone, TODAY, him)).toEqual(linkTogether(s0, TODAY, him))
      expect(appointmentReminders(gone, TODAY).filter((n) => n.key?.includes(id))).toEqual([])
    }
  })
})

// ── 2. [같이 할게요] through events ─────────────────────────

describe("2. [같이 할게요]: 'support' events round-trip like the app's button, once per id, a set not a toggle", () => {
  /** Everything of hers (and his records) that a support answer must never touch. */
  const untouched = (s: AppState) => ({
    periods: s.periods,
    lhTests: s.lhTests,
    pregnancyTests: s.pregnancyTests,
    personalLog: s.personalLog,
    planDone: s.planDone,
    milestones: s.milestones,
    appointments: s.appointments,
    customTasks: s.customTasks,
    checkLog: s.checkLog,
    notifications: s.notifications,
    settings: s.settings,
    stage: s.stage,
  })
  const supportKeys = (s: AppState) =>
    Object.fromEntries(Object.entries(s.decisions ?? {}).filter(([k]) => k.startsWith('support:')))

  it('random event streams (forged senders, unknown ids, replays) — independent acceptance rule, app equivalence, nothing else moves', async () => {
    let accepted = 0
    let rejected = 0
    for (let seed = 1; seed <= 36; seed++) {
      const r = rng(seed * 7919)
      const carrier = seed % 2 ? 'b' : 'a'
      const stage: Stage = pickOf(r, ['preparing', 'pregnant', 'parenting'] as const)
      const base =
        stage === 'preparing'
          ? couple(carrier)
          : stage === 'pregnant'
            ? pregnantOn(carrier, addDays(TODAY, -Math.floor(40 + r() * 220)))
            : parentingOn(carrier, addDays(TODAY, -Math.floor(r() * 120)))
      let s = scramble(base, seed, TODAY)
      let viaApp = s
      const him = himOf(s)
      const her = herOf(s)
      const ids = [...ROADMAP.map((t) => t.id), ...s.customTasks.map((c) => c.id), 'nope', 'p9-made-up']
      const eventIds = Array.from({ length: 10 }, (_, i) => `ev-${seed}-${i}`)
      for (let step = 0; step < 30; step++) {
        const day = addDays(TODAY, Math.floor(r() * 3))
        const ev: PartnerEvent = {
          id: pickOf(r, eventIds),
          ...(r() < 0.85 ? { from: r() < 0.88 ? him : her } : {}),
          kind: 'support',
          itemId: pickOf(r, ids),
          on: r() < 0.6,
        }
        const before = s
        const replay = (s.decisions ?? {})[appliedEventKey(ev.id)] !== undefined
        const item = planItems(s, day).find((i) => i.id === ev.itemId)
        const t = templateById(ev.itemId)
        // The rule, derived again here (not from partnerEventProblem).
        const mayOn =
          !!t &&
          !!item &&
          !!t.support &&
          item.status !== 'done' &&
          STAGE_PHASES[s.stage].includes(item.phase) &&
          !(item.owners.length === 1 && item.owners[0] === him)
        const ok = !replay && ev.from !== her && !!t && (!ev.on || mayOn)
        expect(partnerEventProblem(s, ev, day) === null, `seed ${seed} step ${step} ${ev.itemId} on=${ev.on} from=${ev.from}`).toBe(ok)
        s = applyPartnerEvent(s, ev, day)
        if (!ok) {
          expect(s, `seed ${seed} step ${step}: rejected is the same object`).toBe(before)
          rejected++
          continue
        }
        accepted++
        expect(isSupported(s, ev.itemId, him)).toBe(ev.on)
        expect(isSupported(s, ev.itemId, her)).toBe(isSupported(before, ev.itemId, her))
        expect(s.decisions[appliedEventKey(ev.id)]).toBe(day)
        expect(untouched(s)).toEqual(untouched(before))
        // A set: an answer already given keeps its first day.
        if (ev.on && isSupported(before, ev.itemId, him)) expect(s.decisions[supportKey(ev.itemId, him)]).toBe(before.decisions[supportKey(ev.itemId, him)])
        // The same id again: nothing at all.
        expect(applyPartnerEvent(s, ev, day)).toBe(s)
        // The app's own button, for the same answer, writes the same thing.
        viaApp = ev.on ? supportItem(viaApp, him, ev.itemId, day) : unsupportItem(viaApp, him, ev.itemId)
        expect(supportKeys(s), `seed ${seed} step ${step}`).toEqual(supportKeys(viaApp))
        // Only his own keys, only roadmap / own items.
        for (const k of Object.keys(supportKeys(s))) expect(k.endsWith(`:${him}`) || supportKeys(base)[k] !== undefined, k).toBe(true)
      }
      await breathe()
    }
    expect(accepted).toBeGreaterThan(150)
    expect(rejected).toBeGreaterThan(150)
  }, 60_000)

  it('her phone opening late: a tap judged on its own day; a tap before a loss waits out the quiet, taking one back never waits', () => {
    for (const carrier of ['b', 'a'] as const) {
      const s0 = pregnantOn(carrier, '2026-07-20')
      const him = himOf(s0)
      const on: PartnerEvent = { id: 'late-on', from: him, kind: 'support', itemId: 'p1-voucher', on: true }
      const s1 = applyReceivedEvents(s0, [{ event: on, receivedAt: `${addDays(TODAY, -2)}T21:00:00+09:00` }], TODAY)
      expect(s1.decisions[supportKey('p1-voucher', him)]).toBe(addDays(TODAY, -2))
      // A loss in between: on:true waits (not applied, not remembered), off goes through.
      const lost = endPregnancy(s1, TODAY)
      const again: PartnerEvent = { id: 'late-on-2', from: him, kind: 'support', itemId: 'pre-folic', on: true }
      const waited = applyReceivedEvents(lost, [{ event: again, receivedAt: `${TODAY}T08:00:00+09:00` }], addDays(TODAY, 3))
      expect(waited).toBe(lost)
      const off: PartnerEvent = { id: 'late-off', from: him, kind: 'support', itemId: 'p1-voucher', on: false }
      const undone = applyReceivedEvents(lost, [{ event: off, receivedAt: `${TODAY}T08:00:00+09:00` }], addDays(TODAY, 3))
      // (An answer from the ended pregnancy no longer counts at all — taking it back is accepted and changes nothing.)
      expect(isSupported(lost, 'p1-voucher', him)).toBe(false)
      expect(isSupported(undone, 'p1-voucher', him)).toBe(false)
      expect(undone.decisions[appliedEventKey('late-off')]).toBe(TODAY)
      // After the 42 days a tap sent INSIDE the quiet is still judged on its own day — never applied.
      const after = applyReceivedEvents(lost, [{ event: again, receivedAt: `${TODAY}T08:00:00+09:00` }], addDays(TODAY, 43))
      expect(after).toBe(lost)
      // A tap of the day after the quiet applies on its day.
      const fresh: PartnerEvent = { id: 'late-on-3', from: him, kind: 'support', itemId: 'pre-folic', on: true }
      const later = applyReceivedEvents(lost, [{ event: fresh, receivedAt: `${addDays(TODAY, 42)}T08:00:00+09:00` }], addDays(TODAY, 43))
      expect(later.decisions[supportKey('pre-folic', him)]).toBe(addDays(TODAY, 42))
    }
  })

  it("her 우리 한 줄 reads only his answers, of this week, on her open items — and nothing during the quiet", () => {
    for (const carrier of ['b', 'a'] as const) {
      let s = pregnantOn(carrier, '2026-07-20')
      const him = himOf(s)
      const her = herOf(s)
      s = supportItem(s, him, 'p1-nt', addDays(TODAY, -2))
      s = supportItem(s, him, 'p1-voucher', addDays(TODAY, -9))
      // Stray keys: hers (she can't), an unknown id, a broken day — never a line.
      s = { ...s, decisions: { ...s.decisions, [supportKey('p1-flu', her)]: TODAY, 'support:nope:x': TODAY, [supportKey('nope', him)]: TODAY } }
      const lines = partnerSupportLines(s, TODAY, her)
      expect(lines.map((l) => l.itemId)).toEqual(['p1-nt'])
      expect(lines[0]!.text).toMatch(/^민수님이 ‘.+’ 같이 챙긴대요$|^지은님이 ‘.+’ 같이 챙긴대요$/)
      expect(partnerSupportLines(s, TODAY, him)).toEqual([])
      expect(partnerSupportLines(endPregnancy(s, TODAY), addDays(TODAY, 10), her)).toEqual([])
    }
  })
})

// ── 3. The pregnant catalogue ───────────────────────────────

describe("3. pregnant '이번 주 우리 둘': no medical, timing or banned word — ever", () => {
  it('every week of whole pregnancies, three couples, both orientations: the picks, done lines, the checkup rule, the 3rd-trimester rule', async () => {
    const created = ['2026-08-01T09:00:00+09:00', '2025-01-15T22:10:00+09:00', '2026-03-03T07:00:00Z']
    const allowed = new Set([...PREGNANT_WEEK_OPTIONS, ...THIRD_TRIMESTER_OPTIONS, CHECKUP_DAY_OPTION].map((o) => o.id))
    const third = new Set(THIRD_TRIMESTER_OPTIONS.map((o) => o.id))
    let weeks = 0
    for (const carrier of ['b', 'a'] as const) {
      for (const createdAt of created) {
        const lmp: ISODate = '2026-01-05'
        let s: AppState = { ...pregnantOn(carrier, lmp), createdAt }
        const him = himOf(s)
        const her = herOf(s)
        // A checkup of hers every 4th week, one of his every 5th, an admin errand every 3rd.
        for (let w = 6; w < 41; w++) {
          const mon = addDays(mondayOf(lmp), w * 7)
          if (w % 4 === 0) s = addAppointment(s, { date: addDays(mon, 2), title: '정기 검진', who: her, kind: 'hospital' }, her)
          if (w % 5 === 0) s = addAppointment(s, { date: addDays(mon, 3), title: '내 접종', who: him, kind: 'vaccine' }, him)
          if (w % 3 === 0) s = addAppointment(s, { date: addDays(mon, 1), title: '서류', who: her, kind: 'admin' }, her)
        }
        for (let w = 5; w < 41; w++) {
          const mon = addDays(mondayOf(lmp), w * 7)
          const opts = weekOptions(s, mon, him)
          expect(opts, `${createdAt} w${w}`).toHaveLength(3)
          expect(weekOptions(s, mon, her)).toEqual([])
          for (const o of opts) {
            expect(allowed.has(o.id), o.id).toBe(true)
            for (const text of [o.text, o.doneText]) {
              expect(text, o.id).not.toMatch(TIMING)
              expect(text, o.id).not.toMatch(MEDICAL)
              expect(text, o.id).not.toMatch(BANNED)
            }
          }
          // The same picks all week (read on the Monday).
          for (let k = 1; k < 7; k++) expect(weekOptions(s, addDays(mon, k), him), `${createdAt} w${w} +${k}`).toEqual(opts)
          // 검진 날 같이 가기: only in a week with a checkup of hers / of both (not his own, not admin).
          expect(opts.some((o) => o.id === CHECKUP_DAY_OPTION.id), `w${w}`).toBe(sharedCheckupInWeek(s, weekOf(mon)))
          if (sharedCheckupInWeek(s, weekOf(mon))) expect(opts[2]!.id).toBe(CHECKUP_DAY_OPTION.id)
          // 3rd-trimester picks only from 28주 on the Monday.
          if (opts.some((o) => third.has(o.id))) expect(gestationalAge(s.pregnancy!, mon).weeks, `w${w}`).toBeGreaterThanOrEqual(28)
          // His done line on her side never says anything else.
          const done = markWeekDone(pickWeek(s, him, opts[0]!.id, mon), him, addDays(mon, 2))
          for (const deed of partnerWeekSummary(done, addDays(mon, 3), him)) {
            expect(JSON.stringify(deed)).not.toMatch(MEDICAL)
            expect(JSON.stringify(deed)).not.toMatch(BANNED)
          }
          weeks++
        }
        await breathe()
      }
    }
    expect(weeks).toBeGreaterThan(200)
  }, 60_000)

  it("his signals while pregnant open with his offers; hers stay hers; parenting keeps its calm set", () => {
    const his = signalsFor('pregnant', false).map((x) => x.id)
    expect(his.slice(0, 2)).toEqual(['dinner-mine', 'clinic-together'])
    expect(his).not.toContain('not-this-month')
    expect(signalsFor('pregnant', true).map((x) => x.id)).not.toContain('clinic-together')
    expect(signalsFor('parenting', false)).toEqual(signalsFor('parenting', true))
    for (const sig of signalsFor('pregnant', false)) expect(sig.text).not.toMatch(MEDICAL)
  })
})

// ── 4. His heads-up the day before ──────────────────────────

describe('4. his heads-up the day before her appointment — alert style, stage, quiet, one key, the lock screen', () => {
  const STYLES: readonly AlertStyle[] = ['explicit', 'soft', 'off']

  function withHerTomorrow(base: AppState, kind: AppointmentKind, taskId?: string): { s: AppState; a: Appointment } {
    const her = herOf(base)
    const s = addAppointment(base, { date: addDays(TODAY, 1), time: '11:00', title: '정기 검진', place: '동네 산부인과', who: her, kind, ...(taskId ? { taskId } : {}) }, her)
    return { s, a: s.appointments[s.appointments.length - 1]! }
  }

  it('every style × discreet × kind × linked or not × stage × orientation', () => {
    let reworded = 0
    for (const carrier of ['b', 'a'] as const) {
      const bases: Array<[string, AppState]> = [
        ['pregnant', pregnantOn(carrier, '2026-07-20')],
        ['preparing', couple(carrier)],
        ['parenting', parentingOn(carrier, '2026-08-01')],
        ['after a loss', endPregnancy(pregnantOn(carrier, '2026-07-20'), addDays(TODAY, -5))],
      ]
      for (const [stageName, b0] of bases) {
        const him = himOf(b0)
        const her = herOf(b0)
        for (const style of STYLES) {
          for (const discreet of [false, true]) {
            const b1 = setPersonalPref(setAlertStyle(b0, him, style), him, 'discreet', discreet)
            for (const kind of KINDS) {
              for (const taskId of [undefined, 'p1-nt', 'pre-dental']) {
                const { s, a } = withHerTomorrow(b1, kind, taskId)
                const notices = appointmentReminders(s, TODAY).filter((n) => n.key?.startsWith(`appt:${a.id}:`))
                const toHim = notices.filter((n) => n.to === him)
                const toHer = notices.filter((n) => n.to === her)
                const where = `${carrier} ${stageName} ${style} ${discreet} ${kind} ${taskId}`
                // A visit booked for the pregnancy that ended reminds nobody (planNotices.isForEndedPregnancy).
                if (stageName === 'after a loss' && taskId === 'p1-nt') {
                  expect(notices, where).toEqual([])
                  continue
                }
                // One notice each, with the same keys as ever (ids and the day only).
                expect(toHim.map((n) => n.key), where).toEqual([`appt:${a.id}:${a.date}:fyi:${him}`])
                expect(toHer.map((n) => n.key), where).toEqual([`appt:${a.id}:${a.date}:1:${her}`])
                expect(toHer[0]!.title, where).not.toContain(' 내일 민수님')
                const together = stageName === 'pregnant' && style !== 'off'
                const n = toHim[0]!
                if (together) {
                  reworded++
                  expect(n.title, where).toMatch(/^\S+ 내일 (지은|민수)님 정기 검진이에요$/)
                  const line = taskId ? (templateById(taskId)!.support ?? '') : ['hospital', 'test', 'vaccine', 'injection'].includes(kind) ? TOGETHER_VISIT_LINE : TOGETHER_TASK_LINE
                  expect(n.body, where).toBe(`${line} · ${n.body.split(' · ').slice(1).join(' · ')}`)
                  expect(n.body.startsWith(`${line} · `), where).toBe(true)
                } else {
                  expect(n.title, where).toContain('일정: 정기 검진')
                  expect(n.body, where).toBe('다녀오면 어땠는지 물어봐 주세요.')
                }
                // No timing words reach a soft / off person from our side; the key never carries words.
                expect(`${n.title} ${n.body}`, where).not.toMatch(FERTILE_WORDS)
                expect(n.key, where).not.toMatch(/검진|산부인과|11:00/)
                expect(noticeTarget(n.kind, s.stage, n.key), where).toBe('plan')
                // The lock screen: discreet is the person's own switch, read for every notice (useNotificationEngine).
                expect(discreetFor(s.settings, him), where).toBe(discreet)
              }
            }
          }
        }
      }
    }
    expect(reworded).toBeGreaterThan(50)
  })

  it('the engine masks every notice on the lock screen when 잠금화면 숨김 is on (source check)', () => {
    const src = readFileSync(join(ROOT, 'lib/useNotificationEngine.ts'), 'utf8')
    expect(src).toMatch(/const discreet = discreetFor\(settings, viewer\)/)
    expect(src).toMatch(/const title = discreet \? '둘셋' : n\.title/)
    expect(src).toMatch(/const body = discreet \? '[^']+' : n\.body/)
    // Both sources of his heads-up go through the engine.
    expect(src).toMatch(/appointmentReminders\(s, today\)/)
    expect(src).toMatch(/planDeadlineNotices\(s, today\)/)
  })

  it('her own dated item tomorrow: one line for him while pregnant only — never for her, never for a shared / his / done / deleted item, never in the quiet', () => {
    for (const carrier of ['b', 'a'] as const) {
      for (const style of STYLES) {
        const b0 = setAlertStyle(pregnantOn(carrier, '2026-07-20'), himOf(pregnantOn(carrier, '2026-07-20')), style)
        const him = himOf(b0)
        const her = herOf(b0)
        let s = addCustomTask(b0, { title: '서류 챙기기', phase: 'pregnancy-1st', who: her, due: addDays(TODAY, 1) }, her)
        const mine = s.customTasks[s.customTasks.length - 1]!
        s = addCustomTask(s, { title: '같이 할 일', phase: 'pregnancy-1st', who: 'both', due: addDays(TODAY, 1) }, her)
        s = addCustomTask(s, { title: '내 일', phase: 'pregnancy-1st', who: him, due: addDays(TODAY, 1) }, him)
        const together = (st: AppState, d: ISODate) => planDeadlineNotices(st, d).filter((n) => n.key?.startsWith('deadline:together:'))
        const got = together(s, TODAY)
        if (style === 'off') expect(got).toEqual([])
        else {
          expect(got.map((n) => [n.key, n.to])).toEqual([[togetherTaskKey(mine.id, addDays(TODAY, 1), him), him]])
          expect(got[0]!.body.startsWith(`${TOGETHER_TASK_LINE} · `)).toBe(true)
          expect(noticeTarget(got[0]!.kind, s.stage, got[0]!.key)).toBe('plan')
        }
        // Done, deleted, another day, after a loss: none.
        const done = tickItem(mine.id, true, TODAY, her)(s)
        expect(together(done, TODAY)).toEqual([])
        const deleted: AppState = { ...s, customTasks: s.customTasks.map((c) => (c.id === mine.id ? { ...c, deletedAt: `${TODAY}T08:00:00+09:00` } : c)) }
        expect(together(deleted, TODAY)).toEqual([])
        expect(together(s, addDays(TODAY, -1))).toEqual([])
        expect(together(endPregnancy(s, addDays(TODAY, -1)), TODAY)).toEqual([])
      }
    }
  })
})

// ── 5. Nothing she logs privately moves any of it ───────────

describe('5. an untold record never moves the new surfaces — preparing (the leak property) and pregnant', () => {
  function surfaces(s: AppState, d: ISODate) {
    const him = himOf(s)
    const snap = buildPartnerSnapshot(s, d, him)!
    return {
      card: togetherItems(s, d, him, { whose: s.stage === 'pregnant' ? ['theirs', 'ours'] : ['theirs'], limit: 3 }),
      rows: planItems(s, d).map((i) => togetherRow(s, d, him, i)),
      link: snap.days.map((day) => ({ plan: day.togetherPlan ?? null, stage: day.stageCard ?? null, week: day.week ?? null, prep: day.myPrep ?? null })),
      week: weekOptions(s, d, him),
      prep: myPrep(s, d, him),
      lines: partnerSupportLines(s, d, herOf(s)),
      stageCard: linkStageCard(s, d, him) ?? null,
    }
  }

  for (const carrier of ['b', 'a'] as const) {
    it(`${carrier === 'b' ? 'her = b' : 'her = a'}: every untold record × every lens × days through a cycle and a pregnancy`, async () => {
      let compared = 0
      const prep = scramble(couple(carrier), carrier === 'b' ? 77 : 78, TODAY)
      const preg = scramble(pregnantOn(carrier, '2026-06-20'), carrier === 'b' ? 79 : 80, TODAY)
      for (const [name, base, days] of [
        ['preparing', prep, [-14, -6, 0, 5, 12].map((n) => addDays(TODAY, n))],
        ['pregnant', preg, [-10, 0, 9].map((n) => addDays(TODAY, n))],
      ] as const) {
        for (const share of ['none', 'week', 'details'] as const) {
          for (const style of ['explicit', 'soft', 'off'] as const) {
            const s0 = setAlertStyle(setShareLevel(base, herOf(base), share), himOf(base), style)
            for (const d of days) {
              const before = surfaces(s0, d)
              for (const r of UNTOLD) {
                const s1 = r.add(s0, d)
                if (s1 === s0) continue
                expect(surfaces(s1, d), `${name} ${share} ${style} ${d} ${r.name}`).toEqual(before)
                compared++
              }
            }
            await breathe()
          }
        }
      }
      expect(compared).toBeGreaterThan(300)
    }, 120_000)
  }

  it("her own 검사 applied: his home card and the link hold still; only 챙길 것's shared row (as before this change) may turn done", () => {
    for (const carrier of ['b', 'a'] as const) {
      const s0 = setFertilityApplied(couple(carrier), himOf(couple(carrier)), true, addDays(TODAY, -3))
      const him = himOf(s0)
      const s1 = setFertilityApplied(s0, herOf(s0), true, TODAY)
      expect(togetherItems(s1, TODAY, him, { whose: ['theirs'] })).toEqual(togetherItems(s0, TODAY, him, { whose: ['theirs'] }))
      expect(buildPartnerSnapshot(s1, TODAY, him)!.days.map((d) => d.togetherPlan ?? null)).toEqual(
        buildPartnerSnapshot(s0, TODAY, him)!.days.map((d) => d.togetherPlan ?? null),
      )
      const diff = planItems(s1, TODAY)
        .map((i) => togetherRow(s1, TODAY, him, i))
        .filter((row, k) => JSON.stringify(row) !== JSON.stringify(togetherRow(s0, TODAY, him, planItems(s0, TODAY)[k]!)))
      expect(diff.map((r) => r.id).every((id) => id === FERTILITY_APPLY_ID)).toBe(true)
    }
  })
})

// ── Quiet after a loss, whole span ──────────────────────────

describe('quiet after a loss: none of it for 42 days, on any surface or any link day; back afterwards', () => {
  it('day by day from the loss to day 44, both orientations', () => {
    for (const carrier of ['b', 'a'] as const) {
      let preg = pregnantOn(carrier, '2026-07-20')
      const him = himOf(preg)
      const her = herOf(preg)
      preg = supportItem(preg, him, 'p1-nt', TODAY)
      const lost = endPregnancy(preg, TODAY)
      for (let k = 0; k <= 44; k++) {
        const d = addDays(TODAY, k)
        const quiet = k < 42
        const where = `${carrier} +${k}`
        if (quiet) {
          expect(togetherItems(lost, d, him), where).toEqual([])
          expect(linkTogether(lost, d, him), where).toBeUndefined()
          expect(partnerSupportLines(lost, d, her), where).toEqual([])
          expect(weekOptions(lost, d, him), where).toEqual([])
          expect(myPrep(lost, d, him), where).toEqual({})
          for (const it of planItems(lost, d)) expect(canSupportItem(lost, him, it, d), `${where} ${it.id}`).toBe(false)
          expect(supportItem(lost, him, 'pre-folic', d), where).toBe(lost)
        }
        // Each link day agrees with the day itself (a page built earlier never shows it early).
        const snap = buildPartnerSnapshot(lost, d, him)!
        snap.days.forEach((day, j) => {
          if (j + k < 42) expect(day.togetherPlan, `${where} link +${j}`).toBeUndefined()
          expect(day.stageCard, `${where} link +${j}`).toBeUndefined()
        })
      }
      // Day 43: the preparing plan is back on his side.
      expect(togetherItems(lost, addDays(TODAY, 43), him).length).toBeGreaterThan(0)
    }
  })
})

// ── 6. The content validator ────────────────────────────────

describe('6. scripts/validate-content.mjs rejects bad support lines (and passes the shipped data)', () => {
  const script = join(ROOT, 'scripts/validate-content.mjs')
  const dataDir = join(ROOT, 'lib/content/data')

  function runOn(mutate: (items: Array<Record<string, unknown>>) => void): { code: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), 'dulset-content-'))
    try {
      for (const f of readdirSync(dataDir)) if (f.endsWith('.json')) cpSync(join(dataDir, f), join(dir, f))
      const roadmap = JSON.parse(readFileSync(join(dir, 'roadmap.json'), 'utf8')) as { items: Array<Record<string, unknown>> }
      mutate(roadmap.items)
      writeFileSync(join(dir, 'roadmap.json'), JSON.stringify(roadmap, null, 2))
      try {
        const out = execFileSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, CONTENT_DATA_DIR: dir }, stdio: 'pipe', timeout: 30_000 })
        return { code: 0, out }
      } catch (e) {
        const err = e as { status?: number; stderr?: string; stdout?: string }
        return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const byId = (items: Array<Record<string, unknown>>, id: string) => items.find((i) => i.id === id)!

  it('a copy of the shipped data passes', () => {
    expect(runOn(() => {})).toMatchObject({ code: 0 })
  })

  const cases: Array<[string, (items: Array<Record<string, unknown>>) => void, RegExp]> = [
    ["a 'carrier' item without a line", (it) => delete byId(it, 'p1-nt').support, /needs a `support` line/],
    ["a 'partner' item with one", (it) => (byId(it, 'p1-partner-support').support = '같이 알아보기'), /his own/],
    ['a sentence (해요체) instead of a phrase', (it) => (byId(it, 'p1-voucher').support = '서류를 같이 챙겨요'), /'~하기' phrase/],
    ['a medical claim', (it) => (byId(it, 'pre-folic').support = '기형 예방에 좋은 엽산 사 두기'), /medical claim/],
    ['a timing word', (it) => (byId(it, 'pre-folic').support = '배란일 맞춰 같이 있기'), /never goes in a support line/],
    ['a recommendation', (it) => (byId(it, 'p1-birth-hospital').support = '추천 병원 같이 알아보기'), /never goes in a support line/],
    ['a pressure word', (it) => (byId(it, 'p1-voucher').supportNote = '기한 지남이면 내가 대신 해요.'), /never goes in a support line/],
    ['a note that is not 해요체', (it) => (byId(it, 'p1-voucher').supportNote = '서류는 내가 챙김'), /해요체/],
    ['too long', (it) => (byId(it, 'p1-voucher').support = `${'서류 '.repeat(20)}챙기기`), /at most 40/],
  ]
  for (const [name, mutate, message] of cases) {
    it(`rejects ${name}`, () => {
      const { code, out } = runOn(mutate)
      expect(code).toBe(1)
      expect(out).toMatch(message)
    })
  }
})

// ── 7. Old saves ────────────────────────────────────────────

describe('7. old saves load and read cleanly', () => {
  /** A schema-3 save as an older phone kept it (no shareLevel, no support answers). */
  function v3(base: AppState, extra: Record<string, unknown> = {}): string {
    const { shareLevel: _l, ...settings } = base.settings
    return JSON.stringify({ ...base, schemaVersion: 3, settings, ...extra })
  }

  it('a pregnant schema-3 save: loads current, the together views and the link work, events apply', () => {
    for (const carrier of ['b', 'a'] as const) {
      const base = addAppointment(pregnantOn(carrier, '2026-07-20'), { date: addDays(TODAY, 2), title: 'NT', who: carrier, kind: 'test', taskId: 'p1-nt' }, carrier)
      const loaded = parseState(v3(base))!
      expect(loaded.schemaVersion).toBe(SCHEMA_VERSION)
      const him = himOf(loaded)
      expect(togetherItems(loaded, TODAY, him).some((r) => r.id === 'p1-nt' && r.date === addDays(TODAY, 2))).toBe(true)
      expect(buildPartnerSnapshot(loaded, TODAY, him)!.days[0]!.togetherPlan?.items.length).toBeGreaterThan(0)
      expect(weekOptions(loaded, TODAY, him)).toHaveLength(3)
      const s1 = applyPartnerEvent(loaded, { id: 'old-1', from: him, kind: 'support', itemId: 'p1-nt', on: true }, TODAY)
      expect(isSupported(s1, 'p1-nt', him)).toBe(true)
      // A save of that state round-trips unchanged.
      expect(parseState(JSON.stringify(s1))).toEqual(JSON.parse(JSON.stringify(s1)))
    }
  })

  it('junk support answers in a save are cleaned or inert: a broken day dropped, her own / unknown ids never a line', () => {
    const base = pregnantOn('b', '2026-07-20')
    const decisions = {
      [supportKey('p1-nt', 'a')]: 'yesterday',
      [supportKey('p1-voucher', 'a')]: addDays(TODAY, -1),
      [supportKey('p1-flu', 'b')]: addDays(TODAY, -1),
      [supportKey('p9-nope', 'a')]: addDays(TODAY, -1),
      [`support:${'x'.repeat(200)}:a`]: TODAY,
    }
    const loaded = parseState(v3(base, { decisions }))!
    expect(loaded.decisions[supportKey('p1-nt', 'a')]).toBeUndefined()
    expect(Object.keys(loaded.decisions).some((k) => k.length > 120)).toBe(false)
    expect(isSupported(loaded, 'p1-voucher', 'a')).toBe(true)
    expect(partnerSupportLines(loaded, TODAY, 'b').map((l) => l.itemId)).toEqual(['p1-voucher'])
    // Her stray key changes nothing on either screen.
    const clean = { ...loaded, decisions: Object.fromEntries(Object.entries(loaded.decisions).filter(([k]) => k !== supportKey('p1-flu', 'b'))) }
    expect(togetherItems(loaded, TODAY, 'a')).toEqual(togetherItems(clean, TODAY, 'a'))
    expect(linkTogether(loaded, TODAY, 'a')).toEqual(linkTogether(clean, TODAY, 'a'))
  })

  it('a pregnant save with a broken pregnancy record never crashes: no stage card, no 3rd-trimester guess, the rest still renders', () => {
    for (const lmp of ['', '2026-13-40', 'soon']) {
      const base = pregnantOn('b', '2026-07-20')
      const loaded = parseState(JSON.stringify({ ...base, pregnancy: { ...base.pregnancy, lmp } }))
      const s = loaded ?? ({ ...base, pregnancy: { ...base.pregnancy!, lmp } } as AppState)
      const him = himOf(s)
      expect(() => togetherItems(s, TODAY, him)).not.toThrow()
      expect(() => buildPartnerSnapshot(s, TODAY, him)).not.toThrow()
      expect(linkStageCard(s, TODAY, him)).toBeUndefined()
      expect(weekOptions(s, TODAY, him).some((o) => THIRD_TRIMESTER_OPTIONS.some((t) => t.id === o.id))).toBe(false)
      expect(() => myPrep(s, TODAY, him)).not.toThrow()
      expect(isISODate(TODAY)).toBe(true)
    }
  })

  it('the demo couple (every stage) builds a link whose 같이 챙길 것 holds the same rules', async () => {
    const { createDemoState } = await import('@/lib/demo')
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      const s = createDemoState(TODAY, new Date(`${TODAY}T10:00:00+09:00`), stage)
      const him = himOf(s)
      const snap = buildPartnerSnapshot(s, TODAY, him)!
      for (const day of snap.days) for (const it of day.togetherPlan?.items ?? []) expectNeutral({ status: it.status, label: it.label }, `${stage} ${it.id}`, false)
      if (stage === 'pregnant') {
        // The seeded examples: her flu shot tomorrow (his 🔔 says what he can do) and one answer of his her screens read.
        const fyi = appointmentReminders(s, TODAY).filter((n) => n.to === him && n.key?.includes(':fyi:'))
        expect(fyi.map((n) => n.title)).toEqual(['💉 내일 지은님 독감 접종이에요'])
        expect(fyi[0]!.body.startsWith(`${templateById('p1-flu')!.support} · `)).toBe(true)
        expect(partnerSupportLines(s, TODAY, herOf(s)).map((l) => l.text)).toEqual(['민수님이 ‘태아검진 시간’ 같이 챙긴대요'])
        expect(snap.days[0]!.stageCard?.checkup).toMatchObject({ date: addDays(TODAY, 1), with: 'hers' })
        expect(diffDays(TODAY, snap.days[0]!.stageCard!.checkup!.date)).toBe(1)
      }
    }
  })
})
