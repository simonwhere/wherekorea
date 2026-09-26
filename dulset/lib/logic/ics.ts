// iCalendar (.ics) export — the zero-backend way to get real alarms on BOTH
// partners' phones: each imports the file into Google/Apple/Samsung Calendar.

import { addDays } from '../dates'
import type { ISODate } from '../types'

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
      `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
      // DTEND is exclusive for all-day events.
      `DTEND;VALUE=DATE:${icsDate(addDays(e.end, 1))}`,
      `SUMMARY:${escapeText(e.title)}`,
      'TRANSP:TRANSPARENT',
    )
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
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
   * "D-day" alarm.
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
  windows: Array<{ start: ISODate; fertileStart: ISODate; fertileEnd: ISODate; peakStart: ISODate; peakEnd: ISODate }>,
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
    if (!peak) continue
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
