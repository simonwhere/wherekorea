// Versioned localStorage persistence. Everything stays on the device in the
// prototype — no server ever sees cycle or health data.

import type { AppState, MemberId } from './types'

export const STORAGE_KEY = 'dulset:state:v1'
const VIEWER_KEY = 'dulset:viewer'

function safeLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function safeSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

/** Minimal structural check so a corrupted blob never crashes the app. */
export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<AppState>
  return (
    s.version === 1 &&
    typeof s.stage === 'string' &&
    !!s.couple &&
    Array.isArray(s.couple.members) &&
    s.couple.members.length === 2 &&
    Array.isArray(s.checkItems) &&
    typeof s.checkLog === 'object' &&
    Array.isArray(s.periods) &&
    Array.isArray(s.notifications) &&
    Array.isArray(s.diary) &&
    !!s.settings
  )
}

/** Fill in fields added after a user's data was first saved. */
export function normalize(state: AppState): AppState {
  // Stored JSON may predate newer fields, so treat everything as optional here.
  const s = state as Partial<AppState> & AppState
  const cycle: Partial<AppState['cycle']> = s.cycle ?? {}
  const settings: Partial<AppState['settings']> = s.settings ?? {}
  return {
    ...s,
    lhTests: s.lhTests ?? [],
    datePlans: s.datePlans ?? [],
    growth: s.growth ?? [],
    milestones: s.milestones ?? [],
    cycle: { cycleLength: cycle.cycleLength ?? 28, periodLength: cycle.periodLength ?? 5 },
    settings: {
      discreet: settings.discreet ?? false,
      browserNotifications: settings.browserNotifications ?? false,
      lowPressure: settings.lowPressure ?? false,
      alertStyle: {
        a: settings.alertStyle?.a ?? 'soft',
        b: settings.alertStyle?.b ?? 'soft',
      },
      ttcStart: settings.ttcStart,
    },
  }
}

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAppState(parsed) ? normalize(parsed) : null
  } catch {
    return null
  }
}

export function loadState(): AppState | null {
  const ls = safeLocal()
  if (!ls) return null
  const raw = ls.getItem(STORAGE_KEY)
  const state = parseState(raw)
  if (raw && !state) {
    // Keep the unreadable blob instead of silently destroying it.
    try {
      ls.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw)
    } catch {
      /* quota — nothing else to do */
    }
  }
  return state
}

export function saveState(state: AppState | null): boolean {
  const ls = safeLocal()
  if (!ls) return false
  try {
    if (state) ls.setItem(STORAGE_KEY, JSON.stringify(state))
    else ls.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** Per-tab "whose phone is this" — lets two browser tabs act as two phones. */
export function loadViewer(): MemberId {
  const v = safeSession()?.getItem(VIEWER_KEY)
  return v === 'b' ? 'b' : 'a'
}

export function saveViewer(viewer: MemberId): void {
  try {
    safeSession()?.setItem(VIEWER_KEY, viewer)
  } catch {
    /* ignore */
  }
}
