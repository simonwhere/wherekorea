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
import { BACKUP_FILENAME, BACKUP_MAX_BYTES } from './logic/settings'
import { buildZip, bytesText, looksLikeZip, readZip, textBytes, type ZipEntry, type ZipReadError } from './logic/zip'
import { isBuiltinPhoto } from './photos'
import { BACKUP_ERROR_TEXT, parseState, readBackupFile } from './storage'
import type { AppState, ISODate } from './types'

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

// ── Backup banner (홈 ③블록 아래, N16) ───────────────────────
//
// The compact "기록 지키기" line on the preparing home. Pure rule here; the
// component reads the device (installed? last backup? dismissed? first period?)
// and renders. Per-device keys start with 'dulset:' so a wipe clears them.

/**
 * The cycle (its start date) in which '나중에' answered 배란테스트기 써요? on
 * this device — the LH panel asks again in the next cycle (logs.lhAskDue).
 */
export const LH_ASK_DEFERRED_KEY = 'dulset:lhAskDeferredCycle'

/** The day the banner was closed on this device (hidden for BANNER_DISMISS_DAYS). */
export const BANNER_DISMISSED_KEY = 'dulset:backupBannerDismissedOn'
/** The day this device first saw a period logged while the app was open. */
export const FIRST_PERIOD_KEY = 'dulset:firstPeriodLoggedOn'
/** Closing the banner hides it for this many days. */
export const BANNER_DISMISS_DAYS = 7

export type BackupBannerReason =
  /** Today is the day the first period was logged — one reminder, installed or not. */
  | 'first-period'
  /** Running in a browser tab (Safari drops a tab's storage after 7 days without a visit). */
  | 'not-installed'
  /** A backup exists but is older than BACKUP_NUDGE_DAYS. */
  | 'stale'
  /** Never backed up on this device, and the space is older than a week. */
  | 'never'

export interface BackupBanner {
  reason: BackupBannerReason
  /** The weekly nudge, when there is one (also set with 'not-installed' / 'first-period'). */
  nudge: BackupNudge | null
  installed: boolean
}

export interface BackupBannerInput {
  installed: boolean
  lastBackup: string | null
  createdAt: string | undefined
  today: ISODate
  /** Stored BANNER_DISMISSED_KEY, as read. */
  dismissedOn: string | null
  /** Stored FIRST_PERIOD_KEY, as read. Only the cycle owner's screen passes it. */
  firstPeriodOn: string | null
}

/** Closed within the last BANNER_DISMISS_DAYS days (a stamp from the future doesn't count). */
export function bannerDismissed(dismissedOn: string | null, today: ISODate): boolean {
  const day = parseBackupStamp(dismissedOn)?.slice(0, 10)
  if (!day) return false
  const days = diffDays(day, today)
  return days >= 0 && days < BANNER_DISMISS_DAYS
}

/**
 * Which banner to show today, or null:
 *  1. the day the first period is logged → once, even when installed and backed up
 *     (until it is closed, after the log);
 *  2. closed in the last 7 days → nothing;
 *  3. not installed → 홈 화면에 추가 (with the backup nudge when that is due too);
 *  4. installed but the backup is older than a week (or never) → 백업하기.
 */
export function backupBanner(input: BackupBannerInput): BackupBanner | null {
  const nudge = backupNudge(input.lastBackup, input.createdAt, input.today)
  const dismissed = parseBackupStamp(input.dismissedOn)
  const first = parseBackupStamp(input.firstPeriodOn)
  // Stamps carry the time (stampOn), so a banner closed before the period was
  // logged doesn't swallow the reminder; closing it after does.
  if (first && first.slice(0, 10) === input.today && !(dismissed && dismissed > first)) {
    return { reason: 'first-period', nudge, installed: input.installed }
  }
  if (bannerDismissed(input.dismissedOn, input.today)) return null
  if (!input.installed) return { reason: 'not-installed', nudge, installed: false }
  if (nudge) return { reason: nudge.kind, nudge, installed: true }
  return null
}

/**
 * The first-period marker: set when a period is logged while this device has
 * the app open (count goes up), once per device, never overwritten. Returns
 * the stamp to store (`now`, from stampOn(today)), or null when nothing changes.
 */
export function firstPeriodMarker(prevCount: number, nextCount: number, stored: string | null, now: string): string | null {
  if (nextCount <= prevCount) return null
  if (parseBackupStamp(stored)) return null
  return parseBackupStamp(now)
}

/** Read a per-device stamp (BANNER_DISMISSED_KEY / FIRST_PERIOD_KEY). */
export function readDeviceStamp(key: string): string | null {
  try {
    return parseBackupStamp(safeLocal()?.getItem(key))
  } catch {
    return null
  }
}

/** Store a per-device stamp (a date or stampOn(today)); never throws (storage full → the banner simply stays). */
export function writeDeviceStamp(key: string, value: string): void {
  if (!parseBackupStamp(value)) return
  try {
    safeLocal()?.setItem(key, value)
  } catch {
    /* storage full or blocked */
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BACKED_UP_EVENT, { detail: key }))
  } catch {
    /* no window events */
  }
}

// ── Full backup: 기록 + 사진 as one .zip ────────────────────
//
// `dulset-backup-YYYYMMDD.zip` holds the same JSON as the plain backup plus
// `photos/<id>.<ext>` for every photo the state refers to and this device
// still has (lib/photos.ts). Built with the in-house STORE zip (lib/logic/zip.ts):
// no network, no dependency. Restoring puts the photos back under the same ids,
// so diary entries and the cover find them again.

/** Folder of the photos inside the archive. */
export const PHOTO_DIR = 'photos/'
/** A full backup can hold a year of downscaled photos; anything bigger is not ours. */
export const FULL_BACKUP_MAX_BYTES = 256 * 1024 * 1024

export interface PhotoFile {
  id: string
  /** MIME type ('image/jpeg' …). */
  type: string
  data: Uint8Array
}

/** `dulset-backup-20261002.zip` — the date keeps two backups apart in a Downloads folder. */
export function fullBackupFilename(today: ISODate): string {
  return `dulset-backup-${today.replace(/-/g, '')}.zip`
}

const PHOTO_ID_RE = /^[A-Za-z0-9_-]{1,100}$/

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]))

/** Photo ids the state points to (diary entries and the cover), without the built-in demo pictures. */
export function photoIdsInState(state: AppState): string[] {
  const ids = new Set<string>()
  for (const e of state.diary) if (e.photoId && !isBuiltinPhoto(e.photoId)) ids.add(e.photoId)
  const cover = state.couple.cover?.photoId
  if (cover && !isBuiltinPhoto(cover)) ids.add(cover)
  return [...ids].filter((id) => PHOTO_ID_RE.test(id))
}

/** `photos/<id>.<ext>` (an unknown type is kept as .bin and read back as application/octet-stream). */
export function photoEntryName(id: string, type: string): string {
  return `${PHOTO_DIR}${id}.${EXT_BY_MIME[type.toLowerCase()] ?? 'bin'}`
}

/** The id and type an entry name encodes, or null for anything that isn't one of ours. */
export function parsePhotoEntryName(name: string): { id: string; type: string } | null {
  if (!name.startsWith(PHOTO_DIR)) return null
  const file = name.slice(PHOTO_DIR.length)
  const dot = file.lastIndexOf('.')
  if (dot <= 0) return null
  const id = file.slice(0, dot)
  const ext = file.slice(dot + 1).toLowerCase()
  if (!PHOTO_ID_RE.test(id) || isBuiltinPhoto(id)) return null
  return { id, type: MIME_BY_EXT[ext] ?? 'application/octet-stream' }
}

/**
 * The archive bytes: the JSON first (BACKUP_FILENAME), then the photos. Photos
 * whose id the state doesn't mention are left out — the archive is a picture of
 * the record, not of the whole IndexedDB.
 */
export function buildFullBackup(state: AppState, photos: readonly PhotoFile[], modified?: Date): Uint8Array {
  const wanted = new Set(photoIdsInState(state))
  const entries: ZipEntry[] = [{ name: BACKUP_FILENAME, data: textBytes(JSON.stringify(state)) }]
  const seen = new Set<string>()
  for (const p of photos) {
    if (!wanted.has(p.id) || seen.has(p.id)) continue
    seen.add(p.id)
    entries.push({ name: photoEntryName(p.id, p.type), data: p.data })
  }
  return buildZip(entries, modified)
}

export type FullBackupError = ZipReadError | 'no-state' | 'too-big'

/**
 * Read an archive back: the JSON text (still to be checked by lib/storage
 * parseState) and the photos it holds. Unknown entries are ignored.
 */
export function parseFullBackup(bytes: Uint8Array): { stateJson: string; photos: PhotoFile[] } | { error: FullBackupError } {
  if (bytes.length > FULL_BACKUP_MAX_BYTES) return { error: 'too-big' }
  const zip = readZip(bytes)
  if ('error' in zip) return zip
  const json = zip.entries.find((e) => e.name === BACKUP_FILENAME)
  if (!json || json.data.length > BACKUP_MAX_BYTES) return { error: 'no-state' }
  const photos: PhotoFile[] = []
  for (const e of zip.entries) {
    const meta = parsePhotoEntryName(e.name)
    if (meta) photos.push({ id: meta.id, type: meta.type, data: e.data })
  }
  return { stateJson: bytesText(json.data), photos }
}

export type BackupReadError = 'too-big' | 'invalid' | 'not-ours'

export const BACKUP_READ_ERROR_TEXT: Record<BackupReadError, string> = {
  ...BACKUP_ERROR_TEXT,
  'not-ours': '둘셋 백업 파일이 아니에요 (.zip 안에 기록 파일이 없어요)',
}

export interface AnyBackup {
  state: AppState
  /** Photos from a full backup (.zip); empty for a plain .json. */
  photos: PhotoFile[]
  kind: 'zip' | 'json'
}

/**
 * Read a picked backup — a full .zip or a plain .json — into a checked state
 * plus the photos to put back. The file's bytes decide (not its name), so a
 * renamed file still works.
 */
export async function readAnyBackup(file: Blob): Promise<AnyBackup | { error: BackupReadError }> {
  if (file.size > FULL_BACKUP_MAX_BYTES) return { error: 'too-big' }
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { error: 'invalid' }
  }
  if (!looksLikeZip(bytes)) {
    const plain = await readBackupFile(file)
    return 'error' in plain ? plain : { state: plain.state, photos: [], kind: 'json' }
  }
  const parsed = parseFullBackup(bytes)
  if ('error' in parsed) {
    if (parsed.error === 'too-big') return { error: 'too-big' }
    if (parsed.error === 'no-state') return { error: 'not-ours' }
    return { error: 'invalid' }
  }
  const state = parseState(parsed.stateJson)
  return state ? { state, photos: parsed.photos, kind: 'zip' } : { error: 'invalid' }
}

// ── Handing the file over (iOS share sheet first) ───────────

export type DeliverResult =
  /** navigator.share resolved — the person put it somewhere (파일, 카카오톡 …). */
  | 'shared'
  /** A download link was clicked (the browser takes it from here). */
  | 'downloaded'
  /** The share sheet was closed without choosing anything. */
  | 'cancelled'
  /** Neither worked. */
  | 'failed'

/** Pure core of deliverFile: the share sheet only where a download is unreliable (iOS, review P-8). */
export function prefersShare(platform: InstallPlatform, canShareFiles: boolean): boolean {
  return platform === 'ios' && canShareFiles
}

function downloadBlob(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}

/**
 * Give the person a file. On iOS, a home-screen app can't be trusted to
 * download a blob, so the share sheet goes first and the caller marks the
 * backup done only once that promise resolves; elsewhere (and when sharing
 * fails for a reason other than the person closing it) it's a download.
 */
export async function deliverFile(blob: Blob, filename: string, platform: InstallPlatform = currentInstallPlatform()): Promise<DeliverResult> {
  if (typeof window === 'undefined') return 'failed'
  let file: File | null = null
  try {
    file = new File([blob], filename, { type: blob.type })
  } catch {
    file = null
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  let canShare = false
  try {
    canShare = !!file && !!nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
  } catch {
    canShare = false
  }
  if (file && nav && prefersShare(platform, canShare)) {
    try {
      await nav.share({ files: [file], title: '둘셋 백업' })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      /* NotAllowedError (activation spent), TypeError — fall back to a download */
    }
  }
  return downloadBlob(blob, filename) ? 'downloaded' : 'failed'
}
