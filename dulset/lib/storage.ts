// Versioned localStorage persistence. Everything stays on the device in the
// prototype — no server ever sees cycle or health data.

import { cleanCover } from './logic/cover'
import { cleanCoupleLink } from './logic/partnerLink'
import { BACKUP_MAX_BYTES, extraStorageKeys, sanitizeBackup } from './logic/settings'
import { clearAllPhotos } from './photos'
import { migrate, shareLevelFromSettings } from './sync/migrations'
import type { AppState, MemberId } from './types'

export const STORAGE_KEY = 'dulset:state:v1'
export const VIEWER_KEY = 'dulset:viewer'
/** Where an unreadable saved state is kept (one copy, the first one — never overwritten). */
export const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`
/**
 * Sidecar for the two-tab rebase bookkeeping: tab id → last update sequence
 * number. lib/store.tsx keeps its marks here (writeSyncMarks before
 * saveState, readSyncMarks in the storage handler) so the saved state and
 * backups hold records only (the v2 → v3 migration dropped the old
 * AppState.sync). Starts with 'dulset:' so 모든 기록 지우기 clears it too.
 */
export const SYNC_KEY = 'dulset:sync:v1'

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
  // The partner link's facts (no token): kept only when well-formed.
  const link = cleanCoupleLink(couple.link)
  if (link) couple.link = link
  else delete couple.link
  // Per-person prefs: hideCover / acceptNudges / homeDiscreet are a yes/no or
  // unset (automatic / default); lhTestTime is 'HH:MM' or unset.
  const personal = settings.personal
    ? Object.fromEntries(
        Object.entries(settings.personal).map(([id, p]) => {
          if (!p || typeof p !== 'object') return [id, p]
          const { hideCover, lhTestTime, acceptNudges, homeDiscreet, ...rest } = p as Record<string, unknown>
          return [
            id,
            {
              ...rest,
              ...(typeof hideCover === 'boolean' ? { hideCover } : {}),
              ...(typeof lhTestTime === 'string' && TIME_RE.test(lhTestTime) ? { lhTestTime } : {}),
              ...(typeof acceptNudges === 'boolean' ? { acceptNudges } : {}),
              ...(typeof homeDiscreet === 'boolean' ? { homeDiscreet } : {}),
            },
          ]
        }),
      )
    : undefined
  const usesLH = settings.usesLH
  // Couple-wide switches added in Next B: a yes/no, or unset = the default
  // (lib/initial.ts SETTINGS_DEFAULTS) — never written in, so an older save
  // keeps its exact shape.
  const flag = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
  // A list field that is not a list (a damaged save) reads as empty rather than
  // tripping the migrations; sanitizeBackup then checks each record.
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const memories = flag(settings.memories)
  const anniversaryAlerts = flag(settings.anniversaryAlerts)
  const showTryCount = flag(settings.showTryCount)
  // '링크에 표지 사진' (Next A ①): only an explicit yes is ever stored.
  const coverOnLink = settings.coverOnLink === true ? true : undefined
  return {
    ...s,
    couple,
    lhTests: arr(s.lhTests),
    datePlans: arr(s.datePlans),
    growth: arr(s.growth),
    milestones: arr(s.milestones),
    anniversaries: arr(s.anniversaries),
    appointments: arr(s.appointments),
    planDone: s.planDone ?? {},
    customTasks: arr(s.customTasks),
    pregnancyTests: arr(s.pregnancyTests),
    ...(s.treatments !== undefined ? { treatments: arr(s.treatments) } : {}),
    // Answers that are not records (lib/sync/model.ts decide). schemaVersion is
    // NOT filled here: lib/sync/migrations.ts migrate stamps it, after running
    // the v1 → v2 step that converts the old notification stubs into these.
    decisions: s.decisions ?? {},
    cycle: {
      cycleLength: cycle.cycleLength ?? 28,
      periodLength: cycle.periodLength ?? 5,
      ...(typeof cycle.longCycles === 'boolean' ? { longCycles: cycle.longCycles } : {}),
    },
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
      // 공유 범위 (N23): 날짜 없음 / 우리의 주간 / 자세히. A save from before
      // schema 4 holds the old yes/no instead — read the same way the v3 → v4
      // migration reads it (true → 자세히, false or never asked → 우리의 주간,
      // the privacy default a new couple and sanitizeBackup also get) — and
      // the old key is not carried on.
      shareLevel: shareLevelFromSettings(settings),
      // 써요 / 안 써요 / 나중에 — unset means not asked yet (N17).
      ...(typeof usesLH === 'boolean' || usesLH === 'later' ? { usesLH } : {}),
      ...(memories !== undefined ? { memories } : {}),
      ...(anniversaryAlerts !== undefined ? { anniversaryAlerts } : {}),
      ...(showTryCount !== undefined ? { showTryCount } : {}),
      ...(coverOnLink ? { coverOnLink } : {}),
    },
    // personalLog, cycleNotes, restCycle (+ until), positivePending
    // (+ bleedingSince), treatments, leaveDays, intimacy, diary[].privateTo,
    // lhTests[].slot, customTasks[].deadlineAlerts and the sync marks
    // (records' id / updatedAt / deletedAt) ride along in `...s`;
    // sanitizeBackup checks them (parseState always runs both).
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    // Outline check, fill newer fields, bring the shape up to date
    // (lib/sync/migrations.ts — ids, stamps, decisions), then deep
    // repair/reject (unknown stage, broken members, malformed lists) so bad
    // data can never crash the screens.
    return isAppState(parsed) ? sanitizeBackup(migrate(normalize(parsed))) : null
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
    // Keep the unreadable blob instead of silently destroying it — one copy:
    // every load of the same broken state would otherwise add another (and the
    // first copy is the one closest to the last good save).
    try {
      if (ls.getItem(CORRUPT_KEY) === null) ls.setItem(CORRUPT_KEY, raw)
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
  } catch {
    return false
  }
  // A good save means the data is readable again: the kept copy has done its job.
  try {
    ls.removeItem(CORRUPT_KEY)
  } catch {
    /* ignore */
  }
  return true
}

// ── Two-tab rebase marks (sidecar, see SYNC_KEY) ─────────────

/** The marks as stored: tab id → sequence number; {} when none or unreadable. */
export function parseSyncMarks(raw: string | null): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]),
      ),
    )
  } catch {
    return {}
  }
}

export function readSyncMarks(): Record<string, number> {
  try {
    return parseSyncMarks(safeLocal()?.getItem(SYNC_KEY) ?? null)
  } catch {
    return {}
  }
}

/**
 * Store the marks. Call it *before* saveState: both writes are synchronous,
 * and the other tab's 'storage' event for STORAGE_KEY is delivered after
 * both, so readSyncMarks there already sees the new marks. Only the last
 * SYNC_TABS tabs are kept (lib/store.tsx).
 */
export function writeSyncMarks(marks: Record<string, number>): boolean {
  const ls = safeLocal()
  if (!ls) return false
  try {
    ls.setItem(SYNC_KEY, JSON.stringify(marks))
    return true
  } catch {
    return false
  }
}

/**
 * Whose "phone" this is: the tab's own choice (sessionStorage — two browser
 * tabs act as two phones, ⇄ is a quick peek), else the device's answer to
 * '이 폰은 누구 거예요?' (the same key in localStorage, written by the chooser
 * after a restore — components/onboarding/deviceViewer.ts), else 'a'. The
 * device answer is what survives closing a home-screen app (N15).
 */
export function loadViewer(): MemberId {
  let v: string | null = null
  try {
    v = safeSession()?.getItem(VIEWER_KEY) ?? null
  } catch {
    v = null
  }
  if (v !== 'a' && v !== 'b') {
    try {
      v = safeLocal()?.getItem(VIEWER_KEY) ?? null
    } catch {
      v = null
    }
  }
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
