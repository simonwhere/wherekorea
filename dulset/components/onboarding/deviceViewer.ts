// "이 폰은 누구 거예요?" — remembered per device (localStorage), not per tab:
// a home-screen app closed and reopened should still open on the same
// person's screen. The tab-scoped viewer (lib/storage.ts VIEWER_KEY, in
// sessionStorage) keeps letting two tabs play two phones; this is the
// device's answer behind it. Same key name, the other storage.

import { parseDeviceViewer } from '@/lib/logic/onboarding'
import type { MemberId } from '@/lib/types'

export const DEVICE_VIEWER_KEY = 'dulset:viewer'

export function readDeviceViewer(): MemberId | null {
  try {
    return parseDeviceViewer(window.localStorage.getItem(DEVICE_VIEWER_KEY))
  } catch {
    return null
  }
}

export function rememberDeviceViewer(id: MemberId): void {
  try {
    window.localStorage.setItem(DEVICE_VIEWER_KEY, id)
  } catch {
    /* storage blocked — the tab still knows */
  }
}
