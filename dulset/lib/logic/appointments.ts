// Shared appointments (병원·검사·접종·행정 일정) — pure helpers.

import { addDays, diffDays, formatKo } from '../dates'
import { uid } from '../id'
import { isLive } from '../sync/model'
import type { Appointment, AppointmentKind, AppState, ISODate, MemberId } from '../types'
import type { IcsEvent } from './ics'
import type { Notice } from './notifications'

export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  hospital: '병원 진료',
  test: '검사',
  vaccine: '예방접종',
  admin: '신청·행정',
  other: '기타',
  injection: '주사',
  medication: '약',
}

export const APPOINTMENT_KIND_EMOJI: Record<AppointmentKind, string> = {
  hospital: '🏥',
  test: '🔬',
  vaccine: '💉',
  admin: '📝',
  other: '📌',
  injection: '💉',
  medication: '💊',
}

/**
 * A kind word for what the partner sees of an appointment while the couple's
 * clinic mode is on (N32: his clinic week on the link, the partner's clinic
 * card) — a word, never the appointment's title. 주사·약 read as '병원 일정'
 * (they are steps of a treatment; his side names none).
 */
export const CLINIC_KIND_WORD: Record<AppointmentKind, string> = {
  hospital: '병원 진료',
  test: '검사',
  vaccine: '예방접종',
  admin: '신청·서류',
  other: '일정',
  injection: '병원 일정',
  medication: '병원 일정',
}

/** 주사·약 (the clinic-cycle kinds, N13) happen at a time of day, so the form asks for one. */
export function needsTime(kind: AppointmentKind): boolean {
  return kind === 'injection' || kind === 'medication'
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(t: string | undefined): boolean {
  return t === undefined || t === '' || TIME_RE.test(t)
}

export function attendees(a: Pick<Appointment, 'who'>): MemberId[] {
  return a.who === 'both' ? ['a', 'b'] : [a.who]
}

// ── '나만 보기' (2026-10-17) ─────────────────────────────────
//
// Founder decision ("추천대로 1~3번 다 진행해줘", 2026-10-17 ②): her own
// appointments reach his screens only when she shares them — a choice per
// appointment, shared by default (2026-10-09: her tasks keep showing on his
// screens). Appointment.privateTo works like DiaryEntry.privateTo: the person
// going marks their own appointment, and the other member never meets it —
// no row, no notice, no link day, no export, and nothing computed for them
// moves because of it (the output is exactly what it would be without the
// appointment: 화면이 바뀌는 것도 정보). The rule is the same for both members.
//
// EVERY read of the appointments on behalf of a viewer goes through
// appointmentsFor / withAppointmentsFor (tests/appointmentPrivacy.test.ts).

/**
 * The member an appointment is '나만 보기' for, or undefined (shared). The
 * mark holds only on the person's own appointment (`who === privateTo`): a
 * '둘이 함께' one is always shared, and a mark on the other person's one would
 * hide their own visit from them — storage.normalize and sanitizeBackup drop
 * such a mark, and this reads it the same way.
 */
export function privateOwner(a: Pick<Appointment, 'who' | 'privateTo'>): MemberId | undefined {
  return (a.privateTo === 'a' || a.privateTo === 'b') && a.privateTo === a.who ? a.privateTo : undefined
}

/** May `viewer` see this appointment? Shared ones: both. '나만 보기': only its owner. */
export function canSeeAppointment(a: Pick<Appointment, 'who' | 'privateTo'>, viewer: MemberId): boolean {
  const owner = privateOwner(a)
  return owner === undefined || owner === viewer
}

/** The appointments `viewer` may see — the same list (same array) when nothing is hidden from them. */
export function appointmentsFor<A extends Pick<Appointment, 'who' | 'privateTo'>>(list: readonly A[], viewer: MemberId): A[] {
  return list.every((a) => canSeeAppointment(a, viewer)) ? (list as A[]) : list.filter((a) => canSeeAppointment(a, viewer))
}

/** The appointments both members may see (no '나만 보기' one) — the same array when there is none. */
export function sharedAppointments<A extends Pick<Appointment, 'who' | 'privateTo'>>(list: readonly A[]): A[] {
  return list.every((a) => privateOwner(a) === undefined) ? (list as A[]) : list.filter((a) => privateOwner(a) === undefined)
}

/**
 * The state as `viewer` may read it for anything about appointments: the
 * same object when nothing is hidden from them, else a copy whose list leaves
 * out the other member's '나만 보기' ones. For read-only view models only —
 * never return it from an update (it would drop the hidden ones).
 */
export function withAppointmentsFor<S extends Pick<AppState, 'appointments'>>(state: S, viewer: MemberId): S {
  const list = appointmentsFor(state.appointments, viewer)
  return list === state.appointments ? state : { ...state, appointments: list }
}

/**
 * The record with its '나만 보기' mark only when the mark holds (privateOwner);
 * any other `privateTo` is dropped and the appointment stays, shared. The same
 * object when there is nothing to drop.
 */
export function cleanPrivateTo<A extends object>(a: A): A {
  if (!('privateTo' in a)) return a
  const r = a as unknown as Pick<Appointment, 'who' | 'privateTo'>
  if (privateOwner(r) !== undefined) return a
  const { privateTo: _dropped, ...rest } = a as A & { privateTo?: unknown }
  return rest as A
}

/** Date, then time (untimed first), then title. */
export function compareAppointments(a: Appointment, b: Appointment): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time ?? ''
  const tb = b.time ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
}

/** Live (not deleted — a tombstone is never an appointment) and not done, from today, within `withinDays` when given. */
export function upcomingAppointments(list: Appointment[], today: ISODate, withinDays?: number): Appointment[] {
  const until = withinDays === undefined ? undefined : addDays(today, withinDays)
  return list.filter((a) => isLive(a) && !a.done && a.date >= today && (until === undefined || a.date <= until)).sort(compareAppointments)
}

/** Live ones before today, or done — newest first. */
export function pastAppointments(list: Appointment[], today: ISODate): Appointment[] {
  return list.filter((a) => isLive(a) && (a.date < today || a.done)).sort((a, b) => -compareAppointments(a, b))
}

export interface AppointmentInput {
  date: ISODate
  time?: string
  title: string
  place?: string
  who: MemberId | 'both'
  kind: AppointmentKind
  note?: string
  taskId?: string
  /**
   * '나만 보기': the person going, on their own appointment only (privateOwner).
   * In an update, `privateTo: undefined` shares it again; leaving the key out
   * keeps it as it is.
   */
  privateTo?: MemberId
}

export function addAppointment(state: AppState, input: AppointmentInput, createdBy: MemberId): AppState {
  const title = input.title.trim()
  if (!title || !isValidTime(input.time)) return state
  const a: Appointment = {
    id: uid(),
    date: input.date,
    title,
    who: input.who,
    kind: input.kind,
    createdBy,
    ...(input.time ? { time: input.time } : {}),
    ...(input.place?.trim() ? { place: input.place.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.privateTo && input.privateTo === input.who ? { privateTo: input.privateTo } : {}),
  }
  return { ...state, appointments: [...state.appointments, a] }
}

export function updateAppointment(state: AppState, id: string, patch: Partial<AppointmentInput>): AppState {
  if (patch.time !== undefined && !isValidTime(patch.time)) return state
  const updated: AppState = {
    ...state,
    appointments: state.appointments.map((a) => {
      if (a.id !== id) return a
      const next: Appointment = { ...a, ...patch, title: patch.title !== undefined ? patch.title.trim() || a.title : a.title }
      if (!next.time) delete next.time
      if (!next.place?.trim()) delete next.place
      if (!next.note?.trim()) delete next.note
      // '나만 보기' holds only on the person's own appointment: switching who to
      // '둘이 함께' or to the other person shares it again (cleanPrivateTo).
      return cleanPrivateTo(next)
    }),
  }
  // Made '나만 보기': what the other member was already told about it goes too.
  return withoutHiddenAppointmentNotices(updated, id)
}

/**
 * The other member's notices about a '나만 보기' appointment — the day-before
 * heads-up ('🏥 내일 지은님 일정: …', 'appt:<id>:<date>:fyi:<member>') that went
 * out while it was still shared — leave the state, read and dismissed ones
 * too (the 🔔 list is a screen; the title would stay in it). Matched by
 * recipient and the 'appt:<id>:' prefix (not by date: the same edit may move
 * the day), so the owner's own reminders stay. The appointment's row leaves
 * the other member's screens at the same moment, so nothing new is told. If
 * it is shared again, mergeNotices may send the heads-up again. A phone
 * notification already shown cannot be taken back (AppointmentSheet says so).
 * The same state when there is nothing to drop.
 */
export function withoutHiddenAppointmentNotices(state: AppState, id: string): AppState {
  const a = state.appointments.find((x) => x.id === id)
  const owner = a ? privateOwner(a) : undefined
  if (owner === undefined) return state
  const prefix = `appt:${id}:`
  const kept = state.notifications.filter((n) => n.to === owner || !n.key?.startsWith(prefix))
  return kept.length === state.notifications.length ? state : { ...state, notifications: kept }
}

/** Whether `to` already holds a notice about appointment `id` (the sheet's '앞으로 …' line). */
export function hasAppointmentNotice(state: Pick<AppState, 'notifications'>, id: string, to: MemberId): boolean {
  const prefix = `appt:${id}:`
  return state.notifications.some((n) => n.to === to && !!n.key?.startsWith(prefix))
}

export function setAppointmentDone(state: AppState, id: string, done: boolean): AppState {
  return { ...state, appointments: state.appointments.map((a) => (a.id === id ? { ...a, done } : a)) }
}

export function removeAppointment(state: AppState, id: string): AppState {
  return { ...state, appointments: state.appointments.filter((a) => a.id !== id) }
}

function memberName(state: AppState, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name ?? ''
}

function whenLabel(a: Appointment): string {
  return a.time ? `${formatKo(a.date)} ${a.time}` : formatKo(a.date)
}

/**
 * Reminders the day before (and the morning of) an appointment. Attendees get a
 * reminder; when only one of the two goes, the other gets a gentle heads-up so
 * they can ask how it went. `skip` lets the caller drop appointments that no
 * longer apply (see planNotices: visits for a pregnancy that ended).
 */
export function appointmentNotices(
  state: AppState,
  today: ISODate,
  skip: (a: Appointment) => boolean = () => false,
): Notice[] {
  const out: Notice[] = []
  for (const a of state.appointments) {
    if (a.done || skip(a)) continue
    const until = diffDays(today, a.date)
    if (until !== 1 && until !== 0) continue
    const when = until === 1 ? '내일' : '오늘'
    const going = attendees(a)
    const place = a.place ? ` · ${a.place}` : ''
    // '나만 보기': only its owner hears about it — the other member gets no
    // heads-up at all (their notices are what they would be without it).
    for (const m of going) {
      if (!canSeeAppointment(a, m)) continue
      out.push({
        key: `appt:${a.id}:${a.date}:${until}:${m}`,
        to: m,
        kind: 'system',
        title: `${APPOINTMENT_KIND_EMOJI[a.kind]} ${when} ${a.title}`,
        body: `${whenLabel(a)}${place}${a.who === 'both' ? ' · 둘이 함께' : ''}`,
      })
    }
    const other: MemberId = a.who === 'a' ? 'b' : 'a'
    if (a.who !== 'both' && until === 1 && canSeeAppointment(a, other)) {
      out.push({
        key: `appt:${a.id}:${a.date}:fyi:${other}`,
        to: other,
        kind: 'system',
        title: `${APPOINTMENT_KIND_EMOJI[a.kind]} 내일 ${memberName(state, a.who)}님 일정: ${a.title}`,
        body: '다녀오면 어땠는지 물어봐 주세요.',
      })
    }
  }
  return out
}

/** All-day calendar event with a reminder at 9:00 the day before. */
export function appointmentIcsEvent(a: Appointment, discreet: boolean): IcsEvent {
  const title = discreet ? '📌 둘셋 일정' : `${APPOINTMENT_KIND_EMOJI[a.kind]} ${a.time ? `${a.time} ` : ''}${a.title}`
  return {
    uid: `appt-${a.id}@dulset`,
    start: a.date,
    end: a.date,
    title,
    description: discreet ? undefined : [a.place, a.note].filter(Boolean).join('\n') || undefined,
    alarmMinutesBefore: 15 * 60,
  }
}
