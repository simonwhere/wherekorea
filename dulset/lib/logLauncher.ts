'use client'

// Opens the one "+ 기록" sheet from anywhere (home primary action, calendar day,
// bottom-bar button) without prop-drilling: AppShell listens for this event.

import type { ISODate } from './types'

export type LogKind = 'period' | 'lh' | 'ptest' | 'note'

export interface LogRequest {
  date?: ISODate
  kind?: LogKind
  /**
   * Where the sheet was opened from. From 오늘, the 되돌리기 toast moves to the
   * top after the sheet closes so it never covers the moment card's buttons
   * (알리기, 병원 일정 넣기) that the log just revealed.
   */
  from?: 'today' | 'cycle'
}

export const OPEN_LOG_EVENT = 'dulset:open-log'

export function openLog(req: LogRequest = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<LogRequest>(OPEN_LOG_EVENT, { detail: req }))
}
