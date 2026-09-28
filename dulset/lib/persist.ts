// Keeping the on-device record safe while there is no server (review #1, N1 ⑩):
// • ask the browser not to evict our storage (navigator.storage.persist()),
// • know whether the app runs from the home screen (iOS only keeps a Safari
//   tab's storage 7 days without a visit; home-screen web apps count their own
//   days, and web push on iOS needs the home-screen app — WebKit, review [42]),
// • remember when this device last saved a backup file, for a weekly nudge.
//
// Browser access is guarded everywhere (SSR, private mode, old browsers); the
// date math is pure and tested (tests/notificationsV2.test.ts).

import { diffDays, isISODate } from './dates'
import type { ISODate } from './types'

/** localStorage key (per device) — starts with 'dulset:' so 모든 기록 지우기 clears it too. */
export const LAST_BACKUP_KEY = 'dulset:lastBackupAt'
/** Fired on window after markBackedUp, so a card on screen updates without a reload. */
export const BACKED_UP_EVENT = 'dulset:backed-up'
/** Suggest a new backup file after this many days. */
export const BACKUP_NUDGE_DAYS = 7

// ── storage.persist() ───────────────────────────────────────

export type PersistResult = 'persisted' | 'granted' | 'denied' | 'unsupported'

/** The part of StorageManager we use (injectable for tests). */
export interface PersistApi {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
}

let persistOnce: Promise<PersistResult> | null = null

function navigatorStorage(): PersistApi | undefined {
  try {
    return typeof navigator !== 'undefined' ? (navigator.storage as PersistApi | undefined) : undefined
  } catch {
    return undefined
  }
}

/**
 * Ask once per page load for persistent storage. Idempotent: every later call
 * gets the same answer without asking again. Skips the request when storage
 * is already persistent. Never throws.
 */
export function requestPersist(api: PersistApi | undefined = navigatorStorage()): Promise<PersistResult> {
  if (persistOnce) return persistOnce
  if (!api || typeof api.persist !== 'function') return Promise.resolve('unsupported')
  const persist = api.persist.bind(api)
  const persisted = typeof api.persisted === 'function' ? api.persisted.bind(api) : undefined
  persistOnce = (async (): Promise<PersistResult> => {
    try {
      if (persisted && (await persisted())) return 'persisted'
      return (await persist()) ? 'granted' : 'denied'
    } catch {
      return 'unsupported'
    }
  })()
  return persistOnce
}

/** Tests only: forget the cached request. */
export function resetPersistRequest(): void {
  persistOnce = null
}

// ── Installed (home screen) ─────────────────────────────────

/** Pure core of isStandalone: display-mode media query, or iOS Safari's navigator.standalone. */
export function standaloneFrom(displayModeStandalone: boolean, iosStandalone: unknown): boolean {
  return displayModeStandalone || iosStandalone === true
}

/** Running as an installed app (added to the home screen)? False outside a browser. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const mq = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
    return standaloneFrom(mq, (window.navigator as Navigator & { standalone?: unknown }).standalone)
  } catch {
    return false
  }
}

export type InstallPlatform = 'inapp' | 'ios' | 'android' | 'other'

/**
 * In-app browsers (a link opened inside 카카오톡, 네이버 앱, 인스타그램, 페이스북,
 * 라인) have no "add to home screen": the page has to be opened in Safari /
 * Chrome first. The couple most often shares the link over 카카오톡.
 */
const IN_APP_UA = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|\bLine\//i

/** Which "add to home screen" steps to show (iPadOS reports a Mac UA with touch). */
export function installPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (IN_APP_UA.test(userAgent)) return 'inapp'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

export function currentInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other'
  return installPlatform(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0)
}

/** Step-by-step line per platform (no brand names beyond the browser's own menu words). */
export const INSTALL_STEPS: Record<InstallPlatform, string> = {
  // Another browser has its own (empty) storage: carry the records over with a backup file.
  inapp:
    '카카오톡 같은 앱 안에서는 홈 화면에 추가할 수 없어요. 백업 파일을 먼저 받고, 메뉴의 ‘다른 브라우저로 열기’로 사파리·크롬에서 연 뒤 첫 화면에서 복원해요.',
  // The share button sits at the bottom on iPhone and at the top on iPad.
  ios: '사파리 공유 버튼 → ‘홈 화면에 추가’를 눌러요.',
  android: '크롬 오른쪽 위 메뉴(⋮) → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 눌러요.',
  other: 'iPhone은 공유 → 홈 화면에 추가, Android는 메뉴 → 앱 설치로 추가해요.',
}

// ── Last backup (per device) ────────────────────────────────

function safeLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** A stored value we can trust: an ISO date or a timestamp whose first 10 chars are one. */
export function parseBackupStamp(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  return isISODate(value.slice(0, 10)) ? value : null
}

/** When this device last saved a backup file (as stored), or null. */
export function lastBackupAt(): string | null {
  try {
    return parseBackupStamp(safeLocal()?.getItem(LAST_BACKUP_KEY))
  } catch {
    return null
  }
}

/**
 * Remember a backup made now. Pass the app's local-date-prefixed stamp
 * (`stampOn(today)` from lib/logic/today.ts) so a pinned ?today= stays
 * consistent. Settings → 백업 파일 내보내기 calls this after the download.
 */
export function markBackedUp(at: string): void {
  if (!parseBackupStamp(at)) return
  try {
    safeLocal()?.setItem(LAST_BACKUP_KEY, at)
  } catch {
    /* storage full or blocked — the nudge simply stays */
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BACKED_UP_EVENT, { detail: at }))
  } catch {
    /* no window events */
  }
}

export type BackupNudge =
  /** A backup exists but is older than BACKUP_NUDGE_DAYS. */
  | { kind: 'stale'; days: number }
  /** Never backed up on this device, and the space is older than a week. */
  | { kind: 'never'; days: number }

/**
 * Whether to suggest a new backup today. Counts whole days between local
 * dates: `last` (a stored stamp) or, with none, the day the space was created.
 * A brand-new space (under a week) isn't nagged.
 */
export function backupNudge(last: string | null, createdAt: string | undefined, today: ISODate): BackupNudge | null {
  const lastDay = parseBackupStamp(last)?.slice(0, 10)
  if (lastDay) {
    const days = diffDays(lastDay, today)
    return days > BACKUP_NUDGE_DAYS ? { kind: 'stale', days } : null
  }
  const created = parseBackupStamp(createdAt)?.slice(0, 10)
  if (!created) return null
  const days = diffDays(created, today)
  return days > BACKUP_NUDGE_DAYS ? { kind: 'never', days } : null
}
