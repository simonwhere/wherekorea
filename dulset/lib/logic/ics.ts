// iCalendar (.ics) export — the zero-backend way to get real alarms on BOTH
// partners' phones: each imports the file into Google/Apple/Samsung Calendar.

import { addDays, isISODate, weekdayIndex } from '../dates'
import type { ISODate } from '../types'
import type { CycleConfidence } from './cycle'

export interface IcsEvent {
  uid: string
  /** All-day event start (inclusive). */
  start: ISODate
  /** All-day event end (inclusive). */
  end: ISODate
  title: string
  description?: string
  /** Alarm this many minutes before the event starts (all-day → midnight). */
  alarmMinutesBefore?: number
  /**
   * A timed event instead of an all-day one: local wall-clock 'HH:MM' on
   * `start` (floating — no time zone, so it rings at that hour wherever the
   * phone is) lasting `minutes`. `end` is ignored then.
   */
  time?: { at: string; minutes: number }
  /** RFC 5545 recurrence rule without the 'RRULE:' prefix, e.g. 'FREQ=WEEKLY;BYDAY=TH'. */
  rrule?: string
  /** A link the calendar can open from the event. */
  url?: string
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 'YYYYMMDDTHHMMSS' (floating local time) for `date` at 'HH:MM' plus `plusMinutes`. */
function icsLocalTime(date: ISODate, hhmm: string, plusMinutes = 0): string {
  const m = HHMM.exec(hhmm)
  const base = (m ? Number(m[1]) * 60 + Number(m[2]) : 0) + Math.max(0, Math.round(plusMinutes))
  const day = addDays(date, Math.floor(base / 1440))
  const mins = base % 1440
  const hh = String(Math.floor(mins / 60)).padStart(2, '0')
  const mm = String(mins % 60).padStart(2, '0')
  return `${icsDate(day)}T${hh}${mm}00`
}

function icsDate(iso: ISODate): string {
  return iso.replace(/-/g, '')
}

/** RFC 5545 text escaping. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1), UTF-8 aware. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let curBytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (curBytes + b > limit) {
      out.push(cur)
      cur = ''
      curBytes = 0
    }
    cur += ch
    curBytes += b
  }
  out.push(cur)
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n')
}

export function buildIcs(events: IcsEvent[], stamp: Date = new Date(), calName = '둘셋'): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const sequence = Math.max(0, Math.floor(stamp.getTime() / 1000))
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dulset//prototype//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      // A newer export of the same UID replaces the event instead of adding a copy.
      `SEQUENCE:${sequence}`,
      ...(e.time
        ? [`DTSTART:${icsLocalTime(e.start, e.time.at)}`, `DTEND:${icsLocalTime(e.start, e.time.at, e.time.minutes)}`]
        : // DTEND is exclusive for all-day events.
          [`DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(addDays(e.end, 1))}`]),
      ...(e.rrule ? [`RRULE:${e.rrule}`] : []),
      `SUMMARY:${escapeText(e.title)}`,
      'TRANSP:TRANSPARENT',
    )
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    if (e.alarmMinutesBefore !== undefined) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.title)}`,
        `TRIGGER:-PT${Math.max(0, Math.round(e.alarmMinutesBefore))}M`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export interface FertileExportOptions {
  /** Keep health wording out of the calendar (lock screens, shared calendars). */
  discreet: boolean
  /**
   * Also add the peak days with their own alarm. Only for the explicit view —
   * a soft viewer gets the one window heads-up the app promises, no disguised
   * "D-day" alarm. A window the calendar alone can't narrow (confidence 'low',
   * N12) gets no peak event either way: no such day exists on any screen.
   */
  peak: boolean
  /** Couple id (invite code) so UIDs never collide with another couple's export. */
  id?: string
}

/**
 * Fertile windows for the next cycles as calendar events. UIDs name the slot
 * (1st/2nd/3rd upcoming window), not the predicted date, so importing a newer
 * export after predictions moved replaces the earlier events and alarms
 * instead of leaving stale copies on both phones.
 */
export function fertileWindowEvents(
  windows: Array<{
    start: ISODate
    fertileStart: ISODate
    fertileEnd: ISODate
    peakStart: ISODate
    peakEnd: ISODate
    confidence?: CycleConfidence
  }>,
  opts: FertileExportOptions,
): IcsEvent[] {
  const { discreet, peak } = opts
  const ns = opts.id ? `${opts.id.replace(/[^A-Za-z0-9-]/g, '')}-` : ''
  const events: IcsEvent[] = []
  for (const [i, w] of windows.entries()) {
    events.push({
      uid: `${ns}fertile-${i + 1}@dulset`,
      start: w.fertileStart,
      end: w.fertileEnd,
      title: discreet ? '💞 우리의 주간' : '💞 가임기 (예상)',
      description: discreet
        ? '둘셋에서 보낸 일정이에요.'
        : '둘셋 예상치예요. 실제 배란일은 주기마다 달라질 수 있어요. 피임 목적으로 사용하지 마세요.',
      // 9:00 on the day before (all-day events start at 00:00 → 15 h before).
      alarmMinutesBefore: 15 * 60,
    })
    // Per window: a low-confidence projection names no best days (calendarView.legendItems, cycle.dayInfo).
    if (!peak || w.confidence === 'low') continue
    events.push({
      uid: `${ns}peak-${i + 1}@dulset`,
      start: w.peakStart,
      end: w.peakEnd,
      title: discreet ? '🌙 둘만의 저녁' : '🌟 가능성 가장 높은 날 (예상)',
      alarmMinutesBefore: 15 * 60,
    })
  }
  return events
}

/** Trigger a file download in the browser. */
export function downloadText(filename: string, text: string, mime = 'text/calendar;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── 매주 이 시간에 (N31) ────────────────────────────────────
//
// The partner picks a day of the week; his phone's own calendar reminds him
// once a week to open '이번 주 우리 둘' — the one weekly prompt that needs no
// server (docs/positioning.md §4 #7). Nothing in it is about her: the title
// is '둘셋 · 이번 주 우리', no health word, no date of her cycle (it repeats
// on HIS day, from the week he made it), and the link is the page itself
// without the share token (the browser that opened the link remembers it —
// components/link/model LINK_TOKEN_KEY, with the saved view LINK_VIEW_KEY as
// the fallback — so a calendar never holds the secret).

/** RFC 5545 weekday codes, Monday first (the week's order on every screen). */
export const WEEKLY_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type WeeklyDay = (typeof WEEKLY_DAYS)[number]

/** 월 … 일 for a picker. */
export const WEEKLY_DAY_LABEL: Record<WeeklyDay, string> = { MO: '월', TU: '화', WE: '수', TH: '목', FR: '금', SA: '토', SU: '일' }

export const WEEKLY_LINK_TITLE = '둘셋 · 이번 주 우리'
/** The link page without its '#t=' token. */
export const WEEKLY_LINK_PATH = '/link/'
/** The hour it rings when he picks no time (an evening, after work). */
export const WEEKLY_LINK_DEFAULT_TIME = '20:00'
export const WEEKLY_LINK_MINUTES = 15
const WEEKLY_LINK_UID = 'weekly-link@dulset'

export function isWeeklyDay(value: unknown): value is WeeklyDay {
  return typeof value === 'string' && (WEEKLY_DAYS as readonly string[]).includes(value)
}

/** The first `day` on or after `from` (the week he made the file in, or the next one). */
export function firstWeekly(day: WeeklyDay, from: ISODate): ISODate {
  // weekdayIndex: 0 = Sunday … 6 = Saturday; WEEKLY_DAYS: 0 = Monday … 6 = Sunday.
  const want = (WEEKLY_DAYS.indexOf(day) + 1) % 7
  const ahead = (want - weekdayIndex(from) + 7) % 7
  return addDays(from, ahead)
}

export interface WeeklyLinkOptions {
  /** The site's origin ('https://dulset.app') for an absolute link; without it the link is '/link/'. */
  origin?: string
  /** 'HH:MM', local time (default WEEKLY_LINK_DEFAULT_TIME). */
  time?: string
  /**
   * Where the event opens (default WEEKLY_LINK_PATH, the link page). The app's
   * 설정 › 내 알림 asks for '/#today' — that phone has the app. A path that is
   * not a plain same-site path, or that carries a share token ('#t='), falls
   * back to the default: a calendar never holds the secret.
   */
  path?: string
}

/** A same-site path without a token, or WEEKLY_LINK_PATH. */
function weeklyPath(path: string | undefined): string {
  return typeof path === 'string' && /^\/(?!\/)[A-Za-z0-9/_.#-]*$/.test(path) && !/[#&]t=/.test(path) ? path : WEEKLY_LINK_PATH
}

/** The weekly event: '둘셋 · 이번 주 우리' every `day` from the first one on or after `startDate`, ringing at its start. */
export function weeklyLinkEvent(day: WeeklyDay, startDate: ISODate, opts: WeeklyLinkOptions = {}): IcsEvent {
  const at = opts.time && HHMM.test(opts.time) ? opts.time : WEEKLY_LINK_DEFAULT_TIME
  const origin = (opts.origin ?? '').replace(/\/+$/, '')
  const url = `${origin}${weeklyPath(opts.path)}`
  const first = firstWeekly(day, startDate)
  return {
    // One UID whatever the day: importing a new file (another day) replaces the old event.
    uid: WEEKLY_LINK_UID,
    start: first,
    end: first,
    title: WEEKLY_LINK_TITLE,
    description: `이번 주 우리 둘을 열어 봐요. ${url}`,
    time: { at, minutes: WEEKLY_LINK_MINUTES },
    rrule: `FREQ=WEEKLY;BYDAY=${day}`,
    url,
    alarmMinutesBefore: 0,
  }
}

/**
 * The .ics text for [매주 이 시간에 알려 받기]: one weekly event on `day`
 * (RRULE FREQ=WEEKLY;BYDAY=<day>) from `startDate`, titled '둘셋 · 이번 주
 * 우리', linking '/link/' without the token. A bad day or date gives a file
 * with no event (never one on a guessed day).
 */
export function weeklyLinkIcs(day: WeeklyDay, startDate: ISODate, opts: WeeklyLinkOptions & { stamp?: Date } = {}): string {
  const events = isWeeklyDay(day) && isISODate(startDate) ? [weeklyLinkEvent(day, startDate, opts)] : []
  return buildIcs(events, opts.stamp, '둘셋')
}
