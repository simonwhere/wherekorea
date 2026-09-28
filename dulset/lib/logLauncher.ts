'use client'

// Opens the one "+ 기록" sheet from anywhere (home primary action, calendar day,
// bottom-bar button) without prop-drilling: AppShell listens for this event.

import type { ISODate } from './types'

export type LogKind = 'period' | 'lh' | 'ptest' | 'note'

export interface LogRequest {
  date?: ISODate
  kind?: LogKind
}

export const OPEN_LOG_EVENT = 'dulset:open-log'

export function openLog(req: LogRequest = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<LogRequest>(OPEN_LOG_EVENT, { detail: req }))
}
