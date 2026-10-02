// 기록 안전 (N16): the home banner rule, the first-period marker, and the full
// backup (기록 + 사진 .zip) round trip. storage.persist(), the install platform
// and the weekly nudge are covered in tests/notificationsV2.test.ts.

import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addEntry } from '@/lib/logic/diary'
import { BACKUP_FILENAME } from '@/lib/logic/settings'
import { buildZip, readZip, textBytes } from '@/lib/logic/zip'
import {
  BANNER_DISMISS_DAYS,
  BANNER_DISMISSED_KEY,
  FIRST_PERIOD_KEY,
  LH_ASK_DEFERRED_KEY,
  FULL_BACKUP_MAX_BYTES,
  LAST_BACKUP_KEY,
  backupBanner,
  bannerDismissed,
  buildFullBackup,
  firstPeriodMarker,
  fullBackupFilename,
  parseFullBackup,
  parsePhotoEntryName,
  photoEntryName,
  photoIdsInState,
  prefersShare,
  readAnyBackup,
  type BackupBannerInput,
} from '@/lib/persist'
import { parseState } from '@/lib/storage'
import type { AppState } from '@/lib/types'

const TODAY = '2026-10-02'

const fresh = (createdAt = '2026-09-01T09:00:00+09:00'): AppState => ({
  ...createInitialState(
    { me: { name: '지은', role: 'wife' }, partner: { name: '민수', role: 'husband' }, cycleOwner: 'a', lastPeriodStart: '2026-09-20' },
    new Date(2026, 8, 1, 9),
  ),
  createdAt,
})

const base: BackupBannerInput = {
  installed: false,
  lastBackup: null,
  createdAt: '2026-08-01T09:00:00+09:00',
  today: TODAY,
  dismissedOn: null,
  firstPeriodOn: null,
}

describe('backup banner: when the home shows 기록 지키기', () => {
  it('not installed → 홈 화면에 추가, even on a brand-new space', () => {
    expect(backupBanner({ ...base, createdAt: '2026-10-01T09:00:00+09:00' })).toEqual({ reason: 'not-installed', nudge: null, installed: false })
    // With the weekly nudge due as well, the nudge rides along (one banner, both asks).
    expect(backupBanner(base)).toEqual({ reason: 'not-installed', nudge: { kind: 'never', days: 62 }, installed: false })
  })

  it('installed → only when the backup is older than a week (or never, after the first week)', () => {
    expect(backupBanner({ ...base, installed: true, lastBackup: '2026-09-30' })).toBeNull()
    expect(backupBanner({ ...base, installed: true, lastBackup: '2026-09-25' })).toBeNull() // 7 days exactly: not yet
    expect(backupBanner({ ...base, installed: true, lastBackup: '2026-09-24T21:00:00+09:00' })).toEqual({
      reason: 'stale',
      nudge: { kind: 'stale', days: 8 },
      installed: true,
    })
    expect(backupBanner({ ...base, installed: true })).toEqual({ reason: 'never', nudge: { kind: 'never', days: 62 }, installed: true })
    expect(backupBanner({ ...base, installed: true, createdAt: '2026-09-28T09:00:00+09:00' })).toBeNull() // new space, no nag
    expect(backupBanner({ ...base, installed: true, createdAt: undefined })).toBeNull()
  })

  it('closing it hides it for 7 days on this device, then it is back', () => {
    expect(backupBanner({ ...base, dismissedOn: TODAY })).toBeNull()
    expect(backupBanner({ ...base, dismissedOn: '2026-09-26' })).toBeNull() // 6 days ago
    expect(backupBanner({ ...base, dismissedOn: '2026-09-25' })?.reason).toBe('not-installed') // 7 days ago
    expect(backupBanner({ ...base, installed: true, dismissedOn: '2026-09-30' })).toBeNull()
    expect(backupBanner({ ...base, installed: true, dismissedOn: '2026-09-01' })?.reason).toBe('never')
    // Garbage or a stamp from the future never hides it.
    expect(backupBanner({ ...base, dismissedOn: 'yesterday' })?.reason).toBe('not-installed')
    expect(backupBanner({ ...base, dismissedOn: '2026-10-09' })?.reason).toBe('not-installed')
    expect(BANNER_DISMISS_DAYS).toBe(7)
    expect(bannerDismissed('2026-10-01T22:00:00+09:00', TODAY)).toBe(true)
    expect(bannerDismissed(null, TODAY)).toBe(false)
  })

  it('the day the first period is logged: once, whatever the install or backup state', () => {
    const installedAndFresh = { ...base, installed: true, lastBackup: '2026-10-01' }
    expect(backupBanner(installedAndFresh)).toBeNull()
    expect(backupBanner({ ...installedAndFresh, firstPeriodOn: TODAY })).toEqual({ reason: 'first-period', nudge: null, installed: true })
    expect(backupBanner({ ...base, firstPeriodOn: TODAY })).toEqual({ reason: 'first-period', nudge: { kind: 'never', days: 62 }, installed: false })
    // Yesterday's marker is spent. A dismissal from before the log (even the same
    // morning) does not stop the reminder; closing it after the log does.
    expect(backupBanner({ ...installedAndFresh, firstPeriodOn: '2026-10-01T22:00:00+09:00' })).toBeNull()
    expect(backupBanner({ ...installedAndFresh, firstPeriodOn: TODAY, dismissedOn: '2026-09-30' })?.reason).toBe('first-period')
    const logged = `${TODAY}T11:00:00+09:00`
    expect(backupBanner({ ...installedAndFresh, firstPeriodOn: logged, dismissedOn: `${TODAY}T09:30:00+09:00` })?.reason).toBe('first-period')
    expect(backupBanner({ ...installedAndFresh, firstPeriodOn: logged, dismissedOn: `${TODAY}T11:05:00+09:00` })).toBeNull()
    // Closed after the log, the ordinary rules still hold (dismissed → nothing).
    expect(backupBanner({ ...base, firstPeriodOn: logged, dismissedOn: `${TODAY}T11:05:00+09:00` })).toBeNull()
  })

  it('first-period marker: set once when the period count goes up, never overwritten', () => {
    const now = `${TODAY}T11:00:00+09:00`
    expect(firstPeriodMarker(1, 2, null, now)).toBe(now)
    expect(firstPeriodMarker(0, 1, null, now)).toBe(now)
    expect(firstPeriodMarker(2, 2, null, now)).toBeNull() // nothing logged
    expect(firstPeriodMarker(2, 1, null, now)).toBeNull() // a removal
    expect(firstPeriodMarker(1, 2, '2026-09-01', now)).toBeNull() // already marked on this device
    expect(firstPeriodMarker(1, 2, 'junk', now)).toBe(now) // an unreadable marker is replaced
    expect(firstPeriodMarker(1, 2, null, 'garbage')).toBeNull()
  })

  it('per-device keys start with dulset: so 모든 기록 지우기 clears them', () => {
    for (const k of [LAST_BACKUP_KEY, BANNER_DISMISSED_KEY, FIRST_PERIOD_KEY, LH_ASK_DEFERRED_KEY]) expect(k.startsWith('dulset:')).toBe(true)
  })
})

describe('full backup: photos in and out of the archive', () => {
  const withPhotos = (): AppState => {
    let s = fresh()
    s = addEntry(s, { id: 'e1', date: '2026-09-21', author: 'a', text: '첫 사진', photoId: 'p-one', stage: 'preparing' }, '2026-09-25T09:00:00+09:00')
    s = addEntry(s, { id: 'e2', date: '2026-09-22', author: 'b', text: '둘째', photoId: 'p-two', stage: 'preparing' }, '2026-09-25T09:00:00+09:00')
    s = addEntry(s, { id: 'e3', date: '2026-09-23', author: 'b', text: '같은 사진 다시', photoId: 'p-one', stage: 'preparing' }, '2026-09-25T09:00:00+09:00')
    s = addEntry(s, { id: 'e4', date: '2026-09-24', author: 'a', text: '예시 그림', photoId: 'builtin:sunset', stage: 'preparing' }, '2026-09-25T09:00:00+09:00')
    return { ...s, couple: { ...s.couple, cover: { photoId: 'p-cover', focusY: 50, setBy: 'a', setAt: '2026-09-21' } } }
  }

  it('lists each photo id once — diary and cover, never the built-in art', () => {
    expect(photoIdsInState(withPhotos())).toEqual(['p-one', 'p-two', 'p-cover'])
    expect(photoIdsInState(fresh())).toEqual([])
  })

  it('names photo entries by id and type, and reads them back', () => {
    expect(photoEntryName('p-one', 'image/jpeg')).toBe('photos/p-one.jpg')
    expect(photoEntryName('p-one', 'image/PNG')).toBe('photos/p-one.png')
    expect(photoEntryName('p-one', 'application/octet-stream')).toBe('photos/p-one.bin')
    expect(parsePhotoEntryName('photos/p-one.jpg')).toEqual({ id: 'p-one', type: 'image/jpeg' })
    expect(parsePhotoEntryName('photos/3f2a.webp')).toEqual({ id: '3f2a', type: 'image/webp' })
    expect(parsePhotoEntryName('photos/x.bin')).toEqual({ id: 'x', type: 'application/octet-stream' })
    expect(parsePhotoEntryName('dulset-backup.json')).toBeNull()
    expect(parsePhotoEntryName('photos/.jpg')).toBeNull()
    expect(parsePhotoEntryName('photos/no-ext')).toBeNull()
    expect(parsePhotoEntryName('photos/builtin:sunset.svg')).toBeNull()
    expect(parsePhotoEntryName('photos/../p.jpg')).toBeNull()
    expect(fullBackupFilename(TODAY)).toBe('dulset-backup-20261002.zip')
  })

  it('round-trips the record and the photos the state points to', () => {
    const state = withPhotos()
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9])
    const zip = buildFullBackup(
      state,
      [
        { id: 'p-one', type: 'image/jpeg', data: jpg },
        { id: 'p-two', type: 'image/png', data: png },
        { id: 'p-one', type: 'image/jpeg', data: jpg }, // a duplicate is written once
        { id: 'stray', type: 'image/jpeg', data: jpg }, // not in the state: left out
        // p-cover missing on this device: the archive simply lacks it
      ],
      new Date(2026, 9, 2, 9),
    )
    const raw = readZip(zip)
    if (!('entries' in raw)) throw new Error(raw.error)
    expect(raw.entries.map((e) => e.name)).toEqual([BACKUP_FILENAME, 'photos/p-one.jpg', 'photos/p-two.png'])

    const back = parseFullBackup(zip)
    if ('error' in back) throw new Error(back.error)
    expect(back.photos.map((p) => [p.id, p.type, [...p.data]])).toEqual([
      ['p-one', 'image/jpeg', [...jpg]],
      ['p-two', 'image/png', [...png]],
    ])
    const restored = parseState(back.stateJson)
    expect(restored).not.toBeNull()
    expect(restored!.diary.map((e) => e.photoId)).toEqual(['p-one', 'p-two', 'p-one', 'builtin:sunset'])
    expect(restored!.couple.cover?.photoId).toBe('p-cover')
    expect(restored!.couple.members.map((m) => m.name)).toEqual(['지은', '민수'])
  })

  it('refuses an archive without the record, a damaged one, or a plain non-zip', () => {
    const noState = parseFullBackup(readZipBytes([{ name: 'photos/p.jpg', data: new Uint8Array(3) }]))
    expect(noState).toEqual({ error: 'no-state' })
    expect(parseFullBackup(textBytes('{"version":1}'))).toEqual({ error: 'not-zip' })
    const zip = buildFullBackup(fresh(), [])
    const bad = zip.slice()
    bad[30 + BACKUP_FILENAME.length + 5]! ^= 0xff // inside the record's bytes
    expect(parseFullBackup(bad)).toEqual({ error: 'corrupt' })
    expect(FULL_BACKUP_MAX_BYTES).toBeGreaterThan(5 * 1024 * 1024)
  })

  it('readAnyBackup: a .zip or a .json file, told apart by its bytes', async () => {
    const state = withPhotos()
    const zip = buildFullBackup(state, [{ id: 'p-two', type: 'image/png', data: new Uint8Array([1, 2]) }])
    const fromZip = await readAnyBackup(new Blob([zip as BlobPart], { type: 'application/zip' }))
    if ('error' in fromZip) throw new Error(fromZip.error)
    expect(fromZip.kind).toBe('zip')
    expect(fromZip.photos.map((p) => p.id)).toEqual(['p-two'])
    expect(fromZip.state.diary.length).toBe(4)

    const fromJson = await readAnyBackup(new Blob([JSON.stringify(state)], { type: 'application/json' }))
    if ('error' in fromJson) throw new Error(fromJson.error)
    expect(fromJson.kind).toBe('json')
    expect(fromJson.photos).toEqual([])
    expect(fromJson.state.couple.members[1]!.name).toBe('민수')

    expect(await readAnyBackup(new Blob(['not a backup']))).toEqual({ error: 'invalid' })
    expect(await readAnyBackup(new Blob([readZipBytes([{ name: 'x.txt', data: new Uint8Array(1) }]) as BlobPart]))).toEqual({ error: 'not-ours' })
    const notState = buildZipWithJson('{"version":2}')
    expect(await readAnyBackup(new Blob([notState as BlobPart]))).toEqual({ error: 'invalid' })
  })

  it('the share sheet goes first on iOS only (a download is unreliable in a home-screen app)', () => {
    expect(prefersShare('ios', true)).toBe(true)
    expect(prefersShare('ios', false)).toBe(false)
    expect(prefersShare('android', true)).toBe(false)
    expect(prefersShare('other', true)).toBe(false)
    expect(prefersShare('inapp', true)).toBe(false)
  })
})

// ── helpers ─────────────────────────────────────────────────

function readZipBytes(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  return buildZip(entries)
}

function buildZipWithJson(json: string): Uint8Array {
  return buildZip([{ name: BACKUP_FILENAME, data: textBytes(json) }])
}
