'use client'

// What this device knows about keeping the record safe: installed on the home
// screen? last backup file? Chrome's install prompt? Shared by the compact
// banner on the preparing home (BackupBanner) and the fuller card on the other
// stages' home (InstallBackupCard). Mounting asks once for persistent storage.

import { useCallback, useEffect, useState } from 'react'
import {
  BACKED_UP_EVENT,
  BANNER_DISMISSED_KEY,
  FIRST_PERIOD_KEY,
  LAST_BACKUP_KEY,
  currentInstallPlatform,
  isStandalone,
  lastBackupAt,
  readDeviceStamp,
  requestPersist,
  type InstallPlatform,
} from '@/lib/persist'

/** Chrome's install prompt (Android): kept so a button can open it later. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const PROMPT_CHANGED = 'dulset:install-prompt'
let deferredPrompt: InstallPromptEvent | null = null

// Registered when the app loads (this module is part of the home screen), since
// the browser fires beforeinstallprompt once, early. The browser's own install
// UI is left alone (no preventDefault); this only adds a button when possible.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    deferredPrompt = e as InstallPromptEvent
    window.dispatchEvent(new Event(PROMPT_CHANGED))
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new Event(PROMPT_CHANGED))
  })
}

export interface DeviceRecord {
  installed: boolean
  platform: InstallPlatform
  lastBackup: string | null
  canPrompt: boolean
  /** BANNER_DISMISSED_KEY, as stored. */
  dismissedOn: string | null
  /** FIRST_PERIOD_KEY, as stored. */
  firstPeriodOn: string | null
}

function readDevice(): DeviceRecord {
  return {
    installed: isStandalone(),
    platform: currentInstallPlatform(),
    lastBackup: lastBackupAt(),
    canPrompt: deferredPrompt !== null,
    dismissedOn: readDeviceStamp(BANNER_DISMISSED_KEY),
    firstPeriodOn: readDeviceStamp(FIRST_PERIOD_KEY),
  }
}

/** Keys whose change (in this or another tab) should refresh the device record. */
const WATCHED_KEYS: ReadonlySet<string> = new Set([LAST_BACKUP_KEY, BANNER_DISMISSED_KEY, FIRST_PERIOD_KEY])

/**
 * The device record, read after mount (display mode, storage and the install
 * prompt are browser-only) and kept fresh across backups, dismissals and the
 * other tab's writes. `null` until mounted. `install()` opens Chrome's prompt
 * when it offered one.
 */
export function useDeviceRecord(): { device: DeviceRecord | null; install: () => Promise<void> } {
  const [device, setDevice] = useState<DeviceRecord | null>(null)

  useEffect(() => {
    void requestPersist() // once per page load, however often this mounts
    const refresh = () => setDevice(readDevice())
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || WATCHED_KEYS.has(e.key)) refresh()
    }
    refresh()
    window.addEventListener(BACKED_UP_EVENT, refresh)
    window.addEventListener(PROMPT_CHANGED, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BACKED_UP_EVENT, refresh)
      window.removeEventListener(PROMPT_CHANGED, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const install = useCallback(async () => {
    const e = deferredPrompt
    if (!e) return
    try {
      await e.prompt()
      await e.userChoice
    } catch {
      /* already shown or not allowed — the written steps still apply */
    }
    deferredPrompt = null
    setDevice(readDevice())
  }, [])

  return { device, install }
}
