// '나만 보기' appointments (founder decision 2026-10-17, "추천대로 1~3번 다
// 진행해줘" ②): her own appointments reach his screens only when she shares
// them — a choice per appointment, shared by default.
//
// The inference rule (AGENTS.md 공유 범위: 알리지 않은 기록은 상대 화면을 바꾸지
// 않아요): a '나만 보기' appointment never changes the other member's screen —
// every output computed for him must be exactly what it would be if the
// appointment did not exist (not a hole, not a changed status, count or 다음 병원
// 일정), in the app and on every day of the link. Her own outputs still show it.
//
//  1. the property — demo states in every stage (preparing, its 자세히 lens,
//     clinic mode, pregnant, parenting, 1 day and 60 days after a loss) over
//     several days × her '나만 보기' appointment (hospital / test / 약, today /
//     tomorrow / next week, with time, place and note, without a task or
//     linked to her item, a shared item or his own test row): his 오늘 할 일 /
//     다가오는 일정, 챙길 것 rows (togetherRow) and his together list, the
//     upcoming / past lists, every notice to him, the whole seven-day link
//     snapshot, '이번 주 우리 둘' options, 내 준비, his month task, his .ics,
//     the clinic summary (and its export), the moment card, the cover line —
//     identical; her side shows it;
//  2. the same for HIS '나만 보기' booking on her side (the data rule is symmetric);
//  3. storage: normalize / sanitizeBackup / parseState keep a valid mark and
//     drop one where who !== privateTo; add / update / 복제 keep or clear it;
//  4. events: a join-appointment or task event on it is refused / changes nothing of it;
//  5. 'N년 전 오늘': her private clinic day takes no memory away from him;
//  6. [다녀왔어요] on it (PlanTab's markAppointment → markAppointmentDone) ticks
//     no linked item by itself — the tick's date would show on his 챙길 것 row
//     ('✓ 10.12 지은 챙김'); only her yes to '챙길 것에도 체크할까요?' does;
//  7. stateForViewer (the state as his phone / a link / an export may hold it)
//     leaves it out;
//  8. made 나만 보기 after his day-before heads-up went out: the heads-up
//     leaves his 🔔 (read or not); hers stay; shared again, it may come back.

import { beforeEach, describe, expect, it } from 'vitest'
import { focusItemsFor, homeAppointments, soonAppointments, upcomingForToday } from '@/components/today/model'
import { addDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import {
  addAppointment,
  appointmentIcsEvent,
  appointmentNotices,
  appointmentsFor,
  canSeeAppointment,
  cleanPrivateTo,
  hasAppointmentNotice,
  pastAppointments,
  privateOwner,
  removeAppointment,
  sharedAppointments,
  upcomingAppointments,
  updateAppointment,
  withAppointmentsFor,
  withoutHiddenAppointmentNotices,
  type AppointmentInput,
} from '@/lib/logic/appointments'
import { startClinicMode } from '@/lib/logic/clinic'
import { clinicSummary } from '@/lib/logic/clinicSummary'
import { buildClinicSummaryHtml, buildClinicSummaryText } from '@/lib/logic/clinicSummaryExport'
import { heroLine, memoryFor } from '@/lib/logic/cover'
import { addEntry } from '@/lib/logic/diary'
import { buildIcs } from '@/lib/logic/ics'
import { myPrep } from '@/lib/logic/myPrep'
import { mergeNotices, scheduledNotices } from '@/lib/logic/notifications'
import { applyPartnerEvent, joinAppointment, joinableAppointment, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import {
  FERTILITY_CARRIER_TEST_ID,
  FERTILITY_TEST_ID,
  markAppointmentDone,
  monthlyTask,
  testIdFor,
  tickForAppointment,
} from '@/lib/logic/partnerTrack'
import { stateForViewer } from '@/lib/logic/personalLog'
import { linkedAppointment, planItems, usableAppointments } from '@/lib/logic/plan'
import { appointmentReminders, isForEndedPregnancy, planDeadlineNotices } from '@/lib/logic/planNotices'
import { discreetFor, setShareLevel } from '@/lib/logic/prefs'
import { STAGE_PHASES } from '@/lib/logic/roadmap'
import { sanitizeBackup } from '@/lib/logic/settings'
import { endPregnancy } from '@/lib/logic/today'
import { linkTogether, togetherItems, togetherRow } from '@/lib/logic/together'
import { cycleOwnerId, ttcMoment, vaccineRestHint } from '@/lib/logic/ttcFlow'
import { bellInbox, bellUnread, partnerProgressLine } from '@/lib/logic/usView'
import { weekOptions } from '@/lib/logic/weekTogether'
import { normalize, parseState } from '@/lib/storage'
import type { AppState, Appointment, AppointmentKind, ISODate, MemberId } from '@/lib/types'

// Long synchronous property walks back to back keep the vitest worker from
// answering its runner (a 60 s RPC timeout → 'Timeout calling onTaskUpdate').
beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)))
const breathe = () => new Promise<void>((resolve) => setImmediate(resolve))

const T: ISODate = '2026-10-17'
const NOW = new Date(2026, 9, 17, 10, 0)
/** A fixed DTSTAMP so two .ics files of the same list are byte for byte the same. */
const STAMP = new Date(Date.UTC(2026, 9, 17, 1, 0, 0))

/** Planted in her '나만 보기' appointment — none of it may reach him. */
const SECRET = { title: 'PRIV_TITLE_Q7', place: 'PRIV_PLACE_Q7', note: 'PRIV_NOTE_Q7', time: '05:43' }

const demo = (stage: 'preparing' | 'pregnant' | 'parenting' = 'preparing') => createDemoState(T, NOW, stage)
const herOf = (s: AppState): MemberId => cycleOwnerId(s)
const himOf = (s: AppState): MemberId => (cycleOwnerId(s) === 'a' ? 'b' : 'a')

/** A base without the demo's own '나만 보기' appointment, so "without it" really means none. */
function shared(s: AppState): AppState {
  return { ...s, appointments: sharedAppointments(s.appointments) }
}

interface Base {
  name: string
  state: AppState
  days: ISODate[]
}

function bases(): Base[] {
  const prep = shared(demo())
  const her = herOf(prep)
  const lost = endPregnancy(shared(demo('pregnant')), T)
  expect(lost.stage).toBe('preparing')
  return [
    { name: 'preparing', state: prep, days: [T, addDays(T, 1), addDays(T, 3), addDays(T, 7), addDays(T, 13)] },
    { name: 'preparing · 자세히', state: setShareLevel(prep, her, 'details'), days: [T, addDays(T, 3), addDays(T, 7)] },
    { name: 'clinic mode on', state: startClinicMode(prep, addDays(T, -3)), days: [T, addDays(T, 1), addDays(T, 5)] },
    { name: 'pregnant', state: shared(demo('pregnant')), days: [T, addDays(T, 1), addDays(T, 3), addDays(T, 7), addDays(T, 13)] },
    { name: 'parenting', state: shared(demo('parenting')), days: [T, addDays(T, 1), addDays(T, 7)] },
    { name: '1 day after a loss', state: lost, days: [addDays(T, 1), addDays(T, 2), addDays(T, 8)] },
    { name: '60 days after a loss', state: lost, days: [addDays(T, 60), addDays(T, 61), addDays(T, 67)] },
  ]
}

type TaskLink = 'none' | 'hers' | 'shared' | 'his'

/** The roadmap item a variant links to, from the current stage (undefined when the stage has none). */
function taskFor(s: AppState, day: ISODate, link: TaskLink): string | undefined {
  if (link === 'none') return undefined
  const her = herOf(s)
  const him = himOf(s)
  const items = planItems(s, day).filter((i) => i.template && i.status !== 'done' && STAGE_PHASES[s.stage].includes(i.phase))
  if (link === 'his')
    return s.stage === 'preparing' ? testIdFor(s, him) : items.find((i) => i.owners.length === 1 && i.owners[0] === him)?.id
  if (link === 'shared') return items.find((i) => i.owners.length > 1)?.id
  return items.find((i) => i.owners.length === 1 && i.owners[0] === her)?.id
}

interface Variant {
  kind: AppointmentKind
  offset: number
  link: TaskLink
}

/** Every task link × every offset; the kinds rotate so each kind meets each link and offset somewhere. */
const VARIANTS: Variant[] = (['none', 'hers', 'shared', 'his'] as const).flatMap((link, li) =>
  [0, 1, 7].map((offset, oi) => ({ link, offset, kind: (['hospital', 'test', 'medication'] as const)[(li + oi) % 3]! })),
)

function withPrivate(s: AppState, day: ISODate, v: Variant, owner: MemberId = herOf(s)): { state: AppState; appt: Appointment } {
  const taskId = taskFor(s, day, v.link)
  const input: AppointmentInput = {
    date: addDays(day, v.offset),
    time: SECRET.time,
    title: SECRET.title,
    place: SECRET.place,
    note: SECRET.note,
    who: owner,
    kind: v.kind,
    privateTo: owner,
    ...(taskId ? { taskId } : {}),
  }
  const next = addAppointment(s, input, owner)
  const appt = next.appointments[next.appointments.length - 1]!
  expect(appt.privateTo).toBe(owner)
  return { state: next, appt }
}

/** Everything computed for `viewer` that could carry an appointment, a date or a count from one. */
function viewOf(s: AppState, day: ISODate, viewer: MemberId) {
  const items = planItems(s, day)
  const home = homeAppointments(s, viewer)
  const list = usableAppointments(appointmentsFor(s.appointments, viewer))
  const upcoming = upcomingAppointments(list, day)
  const summary = clinicSummary(s, viewer, day)
  return {
    // 오늘: 오늘 할 일 (today / tomorrow) and the 다가오는 일정 card, the 이번 주 챙길 것 rows.
    soon: soonAppointments(home, day),
    upcomingCard: upcomingForToday(home, day),
    focus: focusItemsFor(s, day, viewer, items).map((i) => i.id),
    // 챙길 것: every row as the viewer sees it, and the near-term together list.
    rows: items.map((i) => togetherRow(s, day, viewer, i)),
    together: togetherItems(s, day, viewer),
    linkTogether: linkTogether(s, day, viewer) ?? null,
    // 다가오는 · 지난 일정.
    upcoming,
    past: pastAppointments(list, day),
    // 🔔 — every rule the engine runs (useNotificationEngine), to this viewer.
    notices: [...scheduledNotices(s, day), ...appointmentReminders(s, day), ...planDeadlineNotices(s, day)].filter((n) => n.to === viewer),
    // The whole seven-day link page (null for her).
    snapshot: JSON.stringify(buildPartnerSnapshot(s, day, viewer)),
    week: weekOptions(s, day, viewer),
    prep: myPrep(s, day, viewer),
    task: monthlyTask(s, day, viewer) ?? null,
    ics: buildIcs(
      upcoming.map((a) => appointmentIcsEvent(a, discreetFor(s.settings, viewer))),
      STAMP,
    ),
    clinic: summary,
    clinicText: summary ? buildClinicSummaryText(summary) : '',
    clinicHtml: summary ? buildClinicSummaryHtml(summary) : '',
    moment: ttcMoment(s, day, viewer) ?? null,
    hero: heroLine(s, day, viewer, 12),
    vaccine: vaccineRestHint(s, day, viewer),
    progress: partnerProgressLine(s, day, viewer) ?? null,
  }
}

function leaks(view: unknown): string[] {
  const text = JSON.stringify(view)
  return [SECRET.title, SECRET.place, SECRET.note].filter((w) => text.includes(w))
}

describe('the helper: canSeeAppointment / appointmentsFor', () => {
  const a = (who: Appointment['who'], privateTo?: MemberId) => ({ who, ...(privateTo ? { privateTo } : {}) })
  it('a shared appointment is everyone’s; a 나만 보기 one is its owner’s alone', () => {
    expect(canSeeAppointment(a('b'), 'a')).toBe(true)
    expect(canSeeAppointment(a('b', 'b'), 'b')).toBe(true)
    expect(canSeeAppointment(a('b', 'b'), 'a')).toBe(false)
    expect(canSeeAppointment(a('a', 'a'), 'b')).toBe(false)
  })
  it('a mark that does not hold (on 둘이 함께 or the other person’s visit) reads as shared, as storage drops it', () => {
    expect(privateOwner(a('both', 'b'))).toBeUndefined()
    expect(privateOwner(a('a', 'b'))).toBeUndefined()
    expect(canSeeAppointment(a('both', 'b'), 'a')).toBe(true)
  })
  it('appointmentsFor / sharedAppointments / withAppointmentsFor return the same list or state when nothing is hidden', () => {
    const s = shared(demo())
    expect(appointmentsFor(s.appointments, 'a')).toBe(s.appointments)
    expect(sharedAppointments(s.appointments)).toBe(s.appointments)
    expect(withAppointmentsFor(s, 'a')).toBe(s)
    const { state } = withPrivate(s, T, { kind: 'hospital', offset: 1, link: 'none' })
    expect(withAppointmentsFor(state, 'b')).toBe(state)
    expect(withAppointmentsFor(state, 'a').appointments).toEqual(s.appointments)
  })
})

describe('the property: her 나만 보기 appointment never changes anything computed for him', () => {
  for (const base of bases()) {
    it(`${base.name}: every day × kind × day ahead × task link — his views identical, hers show it`, async () => {
      const s0 = base.state
      const her = herOf(s0)
      const him = himOf(s0)
      let checked = 0
      for (const day of base.days) {
        const his0 = viewOf(s0, day, him)
        expect(leaks(his0), `${base.name} ${day} base`).toEqual([])
        for (const v of VARIANTS) {
          const tag = `${base.name} · ${day} · ${v.kind} +${v.offset} · ${v.link}`
          const { state, appt } = withPrivate(s0, day, v)
          const his = viewOf(state, day, him)
          expect(his, tag).toEqual(his0)
          expect(leaks(his), tag).toEqual([])
          // Never a heads-up for him about it.
          expect(
            appointmentNotices(state, day).some((n) => n.to === him && n.key?.startsWith(`appt:${appt.id}:`)),
            tag,
          ).toBe(false)

          // Her side: the list, the home rows, her reminder, the dated row, the summary.
          const hers = viewOf(state, day, her)
          expect(
            appointmentsFor(state.appointments, her).some((a) => a.id === appt.id),
            tag,
          ).toBe(true)
          expect(
            hers.upcoming.some((a) => a.id === appt.id),
            tag,
          ).toBe(true)
          const homeHidden = state.stage === 'preparing' && !homeAppointments(state, her).some((a) => a.id === appt.id)
          if (v.offset <= 1 && !homeHidden)
            expect(
              hers.soon.some((a) => a.id === appt.id),
              tag,
            ).toBe(true)
          if (v.offset === 1 && !isForEndedPregnancy(state, appt)) {
            expect(
              hers.notices.some((n) => n.key === `appt:${appt.id}:${appt.date}:1:${her}`),
              tag,
            ).toBe(true)
          }
          if (appt.taskId) {
            const first = linkedAppointment(appointmentsFor(state.appointments, her), appt.taskId, day)
            const item = planItems(state, day).find((i) => i.id === appt.taskId)!
            const row = togetherRow(state, day, her, item)
            if (first?.id === appt.id && row.whose !== 'theirs') expect(row.date, tag).toBe(appt.date)
          }
          if (v.offset === 0 && hers.clinic)
            expect(
              hers.clinic.appointments.some((a) => a.title === SECRET.title),
              tag,
            ).toBe(true)
          checked++
        }
        await breathe()
      }
      expect(checked).toBe(base.days.length * VARIANTS.length)
    })
  }

  it('clinic mode: her card leads with it when it is next; his card and link never do', () => {
    const s0 = startClinicMode(shared(demo()), addDays(T, -3))
    const { state } = withPrivate(s0, T, { kind: 'test', offset: 0, link: 'none' })
    const hers = ttcMoment(state, T, herOf(state))!
    expect(`${hers.title} ${hers.body}`).toContain(SECRET.title)
    expect(ttcMoment(state, T, himOf(state))).toEqual(ttcMoment(s0, T, himOf(s0)))
  })
})

describe('the same for him: his 나만 보기 booking never changes her side', () => {
  it('his test booked only for himself: her progress line, home, lists, notices and summary read as before', () => {
    const demoState = shared(demo())
    const him = himOf(demoState)
    const her = herOf(demoState)
    // Without his shared 정액검사 booking, so his own private one is the only one.
    const semen = demoState.appointments.find((a) => a.taskId === testIdFor(demoState, him))!
    const s0 = removeAppointment(demoState, semen.id)
    const { state, appt } = withPrivate(s0, T, { kind: 'test', offset: 2, link: 'his' }, him)
    expect(appt.taskId).toBe(FERTILITY_TEST_ID)
    for (const day of [T, addDays(T, 1), addDays(T, 3)]) {
      expect(viewOf(state, day, her), day).toEqual(viewOf(s0, day, her))
    }
    // His own month task is booked by it (his screens show it).
    expect(monthlyTask(state, T, him)!.stage).toBe('booked')
    expect(monthlyTask(s0, T, him)!.stage).toBe('book')
    expect(partnerProgressLine(state, T, her)).toEqual(partnerProgressLine(s0, T, her))
  })

  it('clinic mode: his own 나만 보기 visit tomorrow never leads her clinic card (or anything else of hers)', () => {
    const s0 = startClinicMode(shared(demo()), addDays(T, -3))
    const him = himOf(s0)
    const her = herOf(s0)
    for (const v of VARIANTS) {
      const { state } = withPrivate(s0, T, v, him)
      expect(viewOf(state, T, her), `${v.kind} +${v.offset} · ${v.link}`).toEqual(viewOf(s0, T, her))
    }
    // His own card names it (day · kind word), as his link does — it is his.
    const { state } = withPrivate(s0, T, { kind: 'hospital', offset: 1, link: 'none' }, him)
    expect(ttcMoment(state, T, him)!.body).not.toEqual(ttcMoment(s0, T, him)!.body)
  })
})

describe('storage: the mark holds only on the person’s own appointment', () => {
  const s = shared(demo())
  const her = herOf(s)
  const him = himOf(s)
  const own = { ...s.appointments.find((a) => a.who === her)!, privateTo: her }
  const onBoth = { ...s.appointments.find((a) => a.who === 'both')!, privateTo: her }
  const onHis = { ...s.appointments.find((a) => a.who === him)!, privateTo: her }
  const junk = { ...s.appointments.find((a) => a.who === her)!, id: 'junk', privateTo: 'everyone' as never }
  const loaded = { ...s, appointments: [own, onBoth, onHis, junk] }

  it('normalize keeps a valid mark and drops the rest (the appointments stay, shared)', () => {
    const n = normalize(loaded)
    expect(n.appointments.map((a) => a.privateTo)).toEqual([her, undefined, undefined, undefined])
    expect(n.appointments.filter((a) => 'privateTo' in a)).toHaveLength(1)
    expect(n.appointments).toHaveLength(4)
  })

  it('sanitizeBackup does the same, and parseState round-trips a valid mark', () => {
    const out = sanitizeBackup(loaded)!
    expect(out.appointments.map((a) => a.privateTo)).toEqual([her, undefined, undefined, undefined])
    expect(out.appointments.filter((a) => 'privateTo' in a)).toHaveLength(1)
    const back = parseState(JSON.stringify(loaded))!
    expect(back.appointments.map((a) => a.privateTo)).toEqual([her, undefined, undefined, undefined])
    expect(parseState(JSON.stringify(back))).toEqual(back)
  })

  it('cleanPrivateTo is the one rule (same object when there is nothing to drop)', () => {
    expect(cleanPrivateTo(own)).toBe(own)
    const plain = s.appointments[0]!
    expect(cleanPrivateTo(plain)).toBe(plain)
    expect('privateTo' in cleanPrivateTo(onBoth)).toBe(false)
  })

  it('add keeps it only on one’s own; update keeps it, clears it with undefined or when who changes; 복제 keeps it', () => {
    const base: AppointmentInput = { date: addDays(T, 2), title: '피부과', who: her, kind: 'hospital' }
    const added = addAppointment(s, { ...base, privateTo: her }, her)
    const a = added.appointments[added.appointments.length - 1]!
    expect(a.privateTo).toBe(her)
    const onShared = addAppointment(s, { ...base, who: 'both', privateTo: her }, her)
    expect('privateTo' in onShared.appointments[onShared.appointments.length - 1]!).toBe(false)
    // Editing other fields keeps it.
    expect(updateAppointment(added, a.id, { title: '피부과 진료' }).appointments.find((x) => x.id === a.id)!.privateTo).toBe(her)
    expect(updateAppointment(added, a.id, { title: '피부과', privateTo: her }).appointments.find((x) => x.id === a.id)!.privateTo).toBe(her)
    // Shared again: the sheet sends privateTo: undefined.
    const reshared = updateAppointment(added, a.id, { privateTo: undefined }).appointments.find((x) => x.id === a.id)!
    expect('privateTo' in reshared).toBe(false)
    // who → 둘이 함께 or → the other person: shared again.
    expect('privateTo' in updateAppointment(added, a.id, { who: 'both' }).appointments.find((x) => x.id === a.id)!).toBe(false)
    expect('privateTo' in updateAppointment(added, a.id, { who: him }).appointments.find((x) => x.id === a.id)!).toBe(false)
    // 같은 일정 복제 (the sheet adds the same input two days on).
    const copy = addAppointment(added, { ...base, date: addDays(base.date, 2), privateTo: her }, her)
    expect(copy.appointments[copy.appointments.length - 1]!.privateTo).toBe(her)
  })
})

describe('events: what the link sends back can never reach it', () => {
  it('a join-appointment event on her 나만 보기 appointment is refused and changes nothing', () => {
    const s0 = shared(demo())
    const him = himOf(s0)
    const { state, appt } = withPrivate(s0, T, { kind: 'hospital', offset: 2, link: 'none' })
    const ev: PartnerEvent = { id: 'ev-join-1', kind: 'join-appointment', appointmentId: appt.id }
    expect(partnerEventProblem(state, ev, T)).toBe('appointment')
    expect(applyPartnerEvent(state, ev, T)).toBe(state)
    expect(joinableAppointment(state, appt.id, T, him)).toBeUndefined()
    expect(joinAppointment(state, him, appt.id, T)).toBe(state)
  })

  it('a task event while her 나만 보기 appointment sits on his test row: applied exactly as without it, hers untouched', () => {
    const demoState = shared(demo())
    const him = himOf(demoState)
    const semen = demoState.appointments.find((a) => a.taskId === testIdFor(demoState, him))!
    const s0 = removeAppointment(demoState, semen.id)
    const { state, appt } = withPrivate(s0, T, { kind: 'test', offset: 3, link: 'his' })
    expect(appt.taskId).toBe(testIdFor(s0, him))
    // His task does not wait for her appointment's day (no minDoneAt from it) …
    expect(monthlyTask(state, T, him)).toEqual(monthlyTask(s0, T, him))
    const task = monthlyTask(state, T, him)!
    const ev: PartnerEvent = { id: 'ev-task-1', kind: 'task-done', taskId: task.id, date: T }
    expect(partnerEventProblem(state, ev, T)).toBe(partnerEventProblem(s0, ev, T))
    const after = applyPartnerEvent(state, ev, T, `${T}T12:00:00`)
    const after0 = applyPartnerEvent(s0, ev, T, `${T}T12:00:00`)
    // … and marks nothing of hers done.
    expect(after.appointments.find((a) => a.id === appt.id)).toBe(appt)
    expect({ ...after, appointments: after.appointments.filter((a) => a.id !== appt.id) }).toEqual(after0)
  })
})

describe("'N년 전 오늘': her private clinic day takes no memory away from him", () => {
  it('his memory stays; hers skips the clinic day (she knows it)', () => {
    const s = shared(demo())
    const her = herOf(s)
    const him = himOf(s)
    const yearAgo = addDays(T, -365)
    const withMemory = addEntry(
      { ...s, settings: { ...s.settings, memories: true } },
      { date: yearAgo, author: him, text: '바다 보며 오래 걸었어요', stage: 'preparing' },
      `${yearAgo}T21:00:00`,
    )
    expect(memoryFor(withMemory, T, him)).toBeDefined()
    const priv = addAppointment(withMemory, { date: yearAgo, title: SECRET.title, who: her, kind: 'hospital', privateTo: her }, her)
    expect(memoryFor(priv, T, him)).toEqual(memoryFor(withMemory, T, him))
    expect(heroLine(priv, T, him, 12)).toEqual(heroLine(withMemory, T, him, 12))
    expect(memoryFor(priv, T, her)).toBeUndefined()
  })
})

describe('the demo', () => {
  it('has one 나만 보기 appointment of 지은 — on her lists only', () => {
    const s = demo()
    const mine = s.appointments.filter((a) => privateOwner(a) !== undefined)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.who).toBe(herOf(s))
    expect(viewOf(s, T, himOf(s))).toEqual(viewOf(shared(s), T, himOf(s)))
    expect(upcomingAppointments(appointmentsFor(s.appointments, herOf(s)), T).some((a) => a.id === mine[0]!.id)).toBe(true)
  })
})

describe('[다녀왔어요] on a 나만 보기 appointment ticks nothing the other member sees (P1)', () => {
  /** The preparing demo with her shared carrier-test booking replaced by a 나만 보기 one, five days back. */
  function privateVisit(): { s0: AppState; state: AppState; appt: Appointment; her: MemberId; him: MemberId } {
    const base = shared(demo())
    const her = herOf(base)
    const him = himOf(base)
    const booked = base.appointments.find((a) => a.taskId === FERTILITY_CARRIER_TEST_ID)!
    const s0 = removeAppointment(base, booked.id)
    const state = addAppointment(
      s0,
      {
        date: addDays(T, -5),
        title: SECRET.title,
        place: SECRET.place,
        who: her,
        kind: 'test',
        taskId: FERTILITY_CARRIER_TEST_ID,
        privateTo: her,
      },
      her,
    )
    return { s0, state, appt: state.appointments[state.appointments.length - 1]!, her, him }
  }
  const itemOf = (s: AppState, day: ISODate, id: string) => planItems(s, day).find((i) => i.id === id)!

  it('her private visit in the past: done, the linked item untouched — his rows, together list, link and snapshot as without it', () => {
    const { s0, state, appt, her, him } = privateVisit()
    expect(itemOf(state, T, FERTILITY_CARRIER_TEST_ID).status).not.toBe('done')
    const after = markAppointmentDone(state, appt.id, true, T, her)
    expect(after.appointments.find((a) => a.id === appt.id)!.done).toBe(true)
    expect(after.planDone).toBe(state.planDone)
    expect(itemOf(after, T, FERTILITY_CARRIER_TEST_ID).doneAt).toBeUndefined()
    for (const day of [T, addDays(T, 1), addDays(T, 6)]) {
      expect(viewOf(after, day, him), day).toEqual(viewOf(s0, day, him))
      expect(itemOf(after, day, FERTILITY_CARRIER_TEST_ID).doneAt, day).toEqual(itemOf(s0, day, FERTILITY_CARRIER_TEST_ID).doneAt)
    }
    // Her own row is still open (she is asked — PlanTab's '챙길 것에도 체크할까요?').
    expect(togetherRow(after, T, her, itemOf(after, T, FERTILITY_CARRIER_TEST_ID)).status).not.toBe('done')
  })

  it('her yes (체크하기) ticks it dated to the visit — the claim window counts from the test day', () => {
    const { state, appt, her } = privateVisit()
    const after = tickForAppointment(markAppointmentDone(state, appt.id, true, T, her), appt.id, T, her)
    expect(itemOf(after, T, FERTILITY_CARRIER_TEST_ID).doneAt).toBe(appt.date)
    // Idempotent: a second yes never re-dates the tick.
    expect(tickForAppointment(after, appt.id, addDays(T, 3), her)).toBe(after)
  })

  it('a shared visit still ticks its item by itself, dated to the visit (as before)', () => {
    const { s0, her } = privateVisit()
    const s = addAppointment(
      s0,
      { date: addDays(T, -5), title: '산전 검사', who: her, kind: 'test', taskId: FERTILITY_CARRIER_TEST_ID },
      her,
    )
    const appt = s.appointments[s.appointments.length - 1]!
    const after = markAppointmentDone(s, appt.id, true, T, her)
    expect(itemOf(after, T, FERTILITY_CARRIER_TEST_ID).doneAt).toBe(appt.date)
    // A visit marked ahead of its day is dated today; undoing it leaves the tick.
    const ahead = addAppointment(
      s0,
      { date: addDays(T, 4), title: '산전 검사', who: her, kind: 'test', taskId: FERTILITY_CARRIER_TEST_ID },
      her,
    )
    const aheadId = ahead.appointments[ahead.appointments.length - 1]!.id
    const ticked = markAppointmentDone(ahead, aheadId, true, T, her)
    expect(itemOf(ticked, T, FERTILITY_CARRIER_TEST_ID).doneAt).toBe(T)
    expect(itemOf(markAppointmentDone(ticked, aheadId, false, T, her), T, FERTILITY_CARRIER_TEST_ID).doneAt).toBe(T)
  })

  it('every stage × her item / a shared item / his row, today and five days back: his views identical after 다녀왔어요', async () => {
    for (const base of bases()) {
      const s0 = base.state
      const day = base.days[0]!
      const her = herOf(s0)
      const him = himOf(s0)
      const his0 = viewOf(s0, day, him)
      for (const link of ['hers', 'shared', 'his'] as const) {
        for (const offset of [-5, 0]) {
          const tag = `${base.name} · ${day} · ${link} ${offset}`
          const { state, appt } = withPrivate(s0, day, { kind: 'test', offset, link })
          const after = markAppointmentDone(state, appt.id, true, day, her)
          expect(after.appointments.find((a) => a.id === appt.id)!.done, tag).toBe(true)
          expect(after.planDone, tag).toBe(state.planDone)
          expect(viewOf(after, day, him), tag).toEqual(his0)
        }
      }
      await breathe()
    }
  })

  it('the same for his 나만 보기 booking on his own test row: her side reads as without it', () => {
    const demoState = shared(demo())
    const him = himOf(demoState)
    const her = herOf(demoState)
    const semen = demoState.appointments.find((a) => a.taskId === testIdFor(demoState, him))!
    const s0 = removeAppointment(demoState, semen.id)
    const { state, appt } = withPrivate(s0, T, { kind: 'test', offset: -5, link: 'his' }, him)
    const after = markAppointmentDone(state, appt.id, true, T, him)
    expect(after.planDone).toBe(state.planDone)
    expect(viewOf(after, T, her)).toEqual(viewOf(s0, T, her))
  })
})

describe('stateForViewer leaves out the other member’s 나만 보기 appointments (RC-1)', () => {
  it('his view of the state holds none of hers; hers keeps them all; nothing hidden → the same list', () => {
    const s = demo()
    const her = herOf(s)
    const him = himOf(s)
    const { state } = withPrivate(s, T, { kind: 'hospital', offset: 2, link: 'none' })
    expect(state.appointments.filter((a) => privateOwner(a) === her).length).toBe(2)
    const his = stateForViewer(state, him)
    expect(his.appointments.some((a) => privateOwner(a) === her)).toBe(false)
    expect(his.appointments).toEqual(sharedAppointments(state.appointments))
    expect(leaks(his)).toEqual([])
    expect(stateForViewer(state, her).appointments).toEqual(state.appointments)
    // Built from his view or from the whole state, his link snapshot is the same.
    expect(buildPartnerSnapshot(his, T, him)).toEqual(buildPartnerSnapshot(state, T, him))
    const plain = shared(demo())
    expect(stateForViewer(plain, him).appointments).toBe(plain.appointments)
  })
})

describe('made 나만 보기 after his heads-up went out: it leaves his 🔔 (UI-2 / RC-3)', () => {
  const NOW_ISO = `${T}T10:00:00`
  const rules = (s: AppState, day: ISODate = T) => [
    ...scheduledNotices(s, day),
    ...appointmentReminders(s, day),
    ...planDeadlineNotices(s, day),
  ]
  const about = (s: AppState, id: string, to: MemberId) => s.notifications.filter((n) => n.to === to && n.key?.startsWith(`appt:${id}:`))

  /** Her shared appointment tomorrow, added and run through the engine (his heads-up is in his 🔔). */
  function sharedTomorrow(): { state: AppState; appt: Appointment; her: MemberId; him: MemberId } {
    const s0 = shared(demo())
    const her = herOf(s0)
    const him = himOf(s0)
    const added = addAppointment(s0, { date: addDays(T, 1), title: SECRET.title, place: SECRET.place, who: her, kind: 'hospital' }, her)
    const appt = added.appointments[added.appointments.length - 1]!
    const state = mergeNotices(added, rules(added), NOW_ISO).state
    return { state, appt, her, him }
  }

  it('flipped to 나만 보기: no notice about it is left for him (read or unread); hers are untouched', () => {
    const { state, appt, her, him } = sharedTomorrow()
    expect(about(state, appt.id, him).map((n) => n.key)).toEqual([`appt:${appt.id}:${appt.date}:fyi:${him}`])
    expect(about(state, appt.id, her).length).toBeGreaterThan(0)
    expect(hasAppointmentNotice(state, appt.id, him)).toBe(true)
    for (const read of [false, true]) {
      const mark = (n: AppState['notifications'][number]) =>
        n.to === him && n.key?.startsWith(`appt:${appt.id}:`) ? { ...n, read: true } : n
      const before = read ? { ...state, notifications: state.notifications.map(mark) } : state
      const flipped = updateAppointment(before, appt.id, { privateTo: her })
      expect(about(flipped, appt.id, him), `read ${read}`).toEqual([])
      expect(leaks(bellInbox(flipped, him)), `read ${read}`).toEqual([])
      expect(hasAppointmentNotice(flipped, appt.id, him)).toBe(false)
      // Her own reminder (and all her other notices) stay as they were.
      expect(flipped.notifications.filter((n) => n.to === her)).toEqual(before.notifications.filter((n) => n.to === her))
      // The engine never sends it again while it is 나만 보기.
      const again = mergeNotices(flipped, rules(flipped), NOW_ISO).state
      expect(about(again, appt.id, him)).toEqual([])
      // His 🔔 reads as if the appointment had never been there.
      const s0 = shared(demo())
      const plain = mergeNotices(s0, rules(s0), NOW_ISO).state
      expect(bellInbox(again, him).map((n) => n.key)).toEqual(bellInbox(plain, him).map((n) => n.key))
      expect(bellUnread(again, him)).toBe(bellUnread(plain, him))
    }
  })

  it('the same edit may move the day: still matched by the appointment id', () => {
    const { state, appt, her, him } = sharedTomorrow()
    const flipped = updateAppointment(state, appt.id, { privateTo: her, date: addDays(T, 4) })
    expect(about(flipped, appt.id, him)).toEqual([])
  })

  it('an edit that keeps it shared drops nothing (same notifications array); shared again, the heads-up may come back', () => {
    const { state, appt, her, him } = sharedTomorrow()
    expect(updateAppointment(state, appt.id, { title: '다른 제목' }).notifications).toBe(state.notifications)
    expect(withoutHiddenAppointmentNotices(state, appt.id)).toBe(state)
    const flipped = updateAppointment(state, appt.id, { privateTo: her })
    const reshared = updateAppointment(flipped, appt.id, { privateTo: undefined })
    const back = mergeNotices(reshared, rules(reshared), NOW_ISO).state
    expect(about(back, appt.id, him).map((n) => n.key)).toEqual([`appt:${appt.id}:${appt.date}:fyi:${him}`])
  })

  it('his own booking made 나만 보기: her heads-up about it goes, his reminders stay', () => {
    const s0 = shared(demo())
    const her = herOf(s0)
    const him = himOf(s0)
    const added = addAppointment(s0, { date: addDays(T, 1), title: SECRET.title, who: him, kind: 'test' }, him)
    const appt = added.appointments[added.appointments.length - 1]!
    const state = mergeNotices(added, rules(added), NOW_ISO).state
    expect(about(state, appt.id, her).length).toBe(1)
    const flipped = updateAppointment(state, appt.id, { privateTo: him })
    expect(about(flipped, appt.id, her)).toEqual([])
    expect(about(flipped, appt.id, him)).toEqual(about(state, appt.id, him))
  })
})
