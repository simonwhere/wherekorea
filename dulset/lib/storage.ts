// Versioned localStorage persistence. Everything stays on the device in the
// prototype — no server ever sees cycle or health data.

import { cleanCover } from './logic/cover'
import { BACKUP_MAX_BYTES, extraStorageKeys, sanitizeBackup } from './logic/settings'
import { clearAllPhotos } from './photos'
import type { AppState, MemberId } from './types'

export const STORAGE_KEY = 'dulset:state:v1'
export const VIEWER_KEY = 'dulset:viewer'

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
  // The cover photo id (no image) — kept only when it is usable; a bad caption is dropped alone.
  const couple = { ...s.couple }
  const cover = cleanCover(couple.cover)
  if (cover) couple.cover = cover
  else delete couple.cover
  // Per-person prefs: hideCover is a yes/no or unset (automatic).
  const personal = settings.personal
    ? Object.fromEntries(
        Object.entries(settings.personal).map(([id, p]) => {
          if (!p || typeof p !== 'object' || !('hideCover' in p) || typeof p.hideCover === 'boolean') return [id, p]
          const { hideCover: _bad, ...rest } = p
          return [id, rest]
        }),
      )
    : undefined
  return {
    ...s,
    couple,
    lhTests: s.lhTests ?? [],
    datePlans: s.datePlans ?? [],
    growth: s.growth ?? [],
    milestones: s.milestones ?? [],
    anniversaries: s.anniversaries ?? [],
    appointments: s.appointments ?? [],
    planDone: s.planDone ?? {},
    customTasks: s.customTasks ?? [],
    pregnancyTests: s.pregnancyTests ?? [],
    cycle: { cycleLength: cycle.cycleLength ?? 28, periodLength: cycle.periodLength ?? 5 },
    settings: {
      discreet: settings.discreet ?? false,
      browserNotifications: settings.browserNotifications ?? false,
      lowPressure: settings.lowPressure ?? false,
      // Default: the cycle owner hears it explicitly, the partner softly.
      alertStyle: {
        a: settings.alertStyle?.a ?? (s.couple.members[0]?.tracksCycle ? 'explicit' : 'soft'),
        b: settings.alertStyle?.b ?? (s.couple.members[1]?.tracksCycle ? 'explicit' : 'soft'),
      },
      ttcStart: settings.ttcStart,
      ...(personal ? { personal } : {}),
      // Privacy by default, same as a new couple and sanitizeBackup: until the
      // cycle owner opts in (설정 › 공유 범위), the partner sees only 우리의 주간.
      // Data saved before this setting existed never recorded that consent.
      shareCycleDetails: settings.shareCycleDetails ?? false,
    },
  }
}

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    // Outline check, fill newer fields, then deep repair/reject (unknown stage,
    // broken members, malformed lists) so bad data can never crash the screens.
    return isAppState(parsed) ? sanitizeBackup(normalize(parsed)) : null
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

export function clearViewer(): void {
  try {
    safeSession()?.removeItem(VIEWER_KEY)
  } catch {
    /* ignore */
  }
}

export function saveViewer(viewer: MemberId): void {
  try {
    safeSession()?.setItem(VIEWER_KEY, viewer)
  } catch {
    /* ignore */
  }
}

/**
 * Read a picked backup file: too big, not a 둘셋 backup (or damaged), or a
 * checked and repaired state ready to show in the import confirmation.
 */
export async function readBackupFile(file: Blob): Promise<{ state: AppState } | { error: 'too-big' | 'invalid' }> {
  if (file.size > BACKUP_MAX_BYTES) return { error: 'too-big' }
  try {
    const state = parseState(await file.text())
    return state ? { state } : { error: 'invalid' }
  } catch {
    return { error: 'invalid' }
  }
}

export const BACKUP_ERROR_TEXT: Record<'too-big' | 'invalid', string> = {
  'too-big': '둘셋 백업 파일이 아닌 것 같아요 (파일이 너무 커요)',
  invalid: '둘셋 백업 파일이 아니거나 손상된 파일이에요',
}

/** The raw saved data, as-is (for "지금 기록을 파일로 받기" when it can't be opened). */
export function rawStoredState(): string | null {
  try {
    return safeLocal()?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/**
 * Everything "모든 기록 지우기" removes besides the main state (the caller
 * clears that with replace(null), so the other tab follows via the storage
 * event): photos, other 둘셋 keys, this tab's viewer, the tab hash.
 */
export async function clearDeviceData(): Promise<void> {
  try {
    await clearAllPhotos()
  } catch {
    /* nothing stored */
  }
  try {
    const ls = window.localStorage
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k) keys.push(k)
    }
    extraStorageKeys(keys, STORAGE_KEY).forEach((k) => ls.removeItem(k))
  } catch {
    /* storage unavailable — nothing else to clear */
  }
  clearViewer()
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* ignore */
  }
}
