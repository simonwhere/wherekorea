'use client'

// "기록 지키기" rows for 더 보기: add the app to the home screen (Safari keeps a
// tab's storage only 7 days without a visit; the home-screen app is exempt and
// can receive notifications — WebKit, review [42]) and a weekly backup nudge.
// Mounting also asks once for persistent storage (lib/persist.requestPersist).

import { useEffect, useState } from 'react'
import {
  BACKED_UP_EVENT,
  INSTALL_STEPS,
  LAST_BACKUP_KEY,
  backupNudge,
  currentInstallPlatform,
  isStandalone,
  lastBackupAt,
  requestPersist,
  type InstallPlatform,
} from '@/lib/persist'
import { goToSettings } from '@/components/settings/anchors'
import { useApp } from '@/lib/store'

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

interface DeviceInfo {
  installed: boolean
  platform: InstallPlatform
  lastBackup: string | null
  canPrompt: boolean
}

function readDevice(): DeviceInfo {
  return {
    installed: isStandalone(),
    platform: currentInstallPlatform(),
    lastBackup: lastBackupAt(),
    canPrompt: deferredPrompt !== null,
  }
}

const rowAction =
  'mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-brand-ink ' +
  'transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** Go to 설정 › 데이터와 개인정보 (#data, 백업 파일 내보내기). */
const goToBackup = () => goToSettings('data')

export default function InstallBackupCard() {
  const { state, today } = useApp()
  // Read after mount: display mode, storage and the install prompt are browser-only.
  const [device, setDevice] = useState<DeviceInfo | null>(null)

  useEffect(() => {
    void requestPersist() // once per page load, however often this mounts
    const refresh = () => setDevice(readDevice())
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_BACKUP_KEY || e.key === null) refresh()
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

  if (!device) return null
  const nudge = backupNudge(device.lastBackup, state.createdAt, today)
  if (device.installed && !nudge) return null

  const install = async () => {
    const e = deferredPrompt
    if (!e) return
    try {
      await e.prompt()
      await e.userChoice
    } catch {
      /* already shown or not allowed — the steps below still apply */
    }
    deferredPrompt = null
    setDevice(readDevice())
  }

  return (
    <section aria-label="기록 지키기" className="space-y-3">
      {device.installed ? null : (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <span aria-hidden className="pt-0.5">
            📲
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">홈 화면에 추가해 두세요</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              홈 화면에 추가하면 기록이 더 안전하게 남고 알림도 받을 수 있어요.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{INSTALL_STEPS[device.platform]}</p>
            {device.canPrompt ? (
              <button type="button" className={rowAction} onClick={install}>
                홈 화면에 추가하기
              </button>
            ) : device.platform === 'inapp' && !nudge ? (
              // Moving to Safari / Chrome starts from empty storage: back up first.
              <button type="button" className={rowAction} onClick={goToBackup}>
                백업 파일 받으러 가기
              </button>
            ) : null}
          </div>
        </div>
      )}
      {nudge ? (
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <span aria-hidden className="pt-0.5">
            💾
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">
              {nudge.kind === 'stale' ? `백업한 지 ${nudge.days}일 지났어요` : '아직 이 기기에서 받은 백업 파일이 없어요'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
              기록은 이 기기에만 있어요. 일주일에 한 번 백업 파일을 받아 두면 폰을 바꿔도 되살릴 수 있어요.
            </p>
            <button type="button" className={rowAction} onClick={goToBackup}>
              백업하기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
