// Shared appointments (병원·검사·접종·행정 일정) — pure helpers.

import { addDays, diffDays, formatKo } from '../dates'
import { uid } from '../id'
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

/** Date, then time (untimed first), then title. */
export function compareAppointments(a: Appointment, b: Appointment): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.time ?? ''
  const tb = b.time ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0
}

export function upcomingAppointments(list: Appointment[], today: ISODate, withinDays?: number): Appointment[] {
  const until = withinDays === undefined ? undefined : addDays(today, withinDays)
  return list
    .filter((a) => !a.done && a.date >= today && (until === undefined || a.date <= until))
    .sort(compareAppointments)
}

export function pastAppointments(list: Appointment[], today: ISODate): Appointment[] {
  return list.filter((a) => a.date < today || a.done).sort((a, b) => -compareAppointments(a, b))
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
  }
  return { ...state, appointments: [...state.appointments, a] }
}

export function updateAppointment(state: AppState, id: string, patch: Partial<AppointmentInput>): AppState {
  if (patch.time !== undefined && !isValidTime(patch.time)) return state
  return {
    ...state,
    appointments: state.appointments.map((a) => {
      if (a.id !== id) return a
      const next: Appointment = { ...a, ...patch, title: patch.title !== undefined ? patch.title.trim() || a.title : a.title }
      if (!next.time) delete next.time
      if (!next.place?.trim()) delete next.place
      if (!next.note?.trim()) delete next.note
      return next
    }),
  }
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
    for (const m of going) {
      out.push({
        key: `appt:${a.id}:${a.date}:${until}:${m}`,
        to: m,
        kind: 'system',
        title: `${APPOINTMENT_KIND_EMOJI[a.kind]} ${when} ${a.title}`,
        body: `${whenLabel(a)}${place}${a.who === 'both' ? ' · 둘이 함께' : ''}`,
      })
    }
    if (a.who !== 'both' && until === 1) {
      const other: MemberId = a.who === 'a' ? 'b' : 'a'
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
