// Deep links into 설정. A hash like #share opens the settings screen (AppShell
// routes these to the settings tab, the way #days opens 우리 › 기념일) and
// scrolls to the section with that id (SettingsTab).

/** Section ids inside 설정 that other screens link to. */
export const SETTINGS_ANCHORS = ['share', 'alerts', 'data'] as const

export type SettingsAnchor = (typeof SETTINGS_ANCHORS)[number]

export function isSettingsAnchor(hash: string): hash is SettingsAnchor {
  return (SETTINGS_ANCHORS as readonly string[]).includes(hash)
}

/**
 * Open 설정 at a section: 공유 범위 (#share), 내 알림 (#alerts) or 데이터와
 * 개인정보 (#data, 백업 파일 내보내기). Setting the hash switches the tab; the
 * settings screen then brings the section into view.
 */
export function goToSettings(anchor?: SettingsAnchor): void {
  if (typeof window === 'undefined') return
  const target = anchor ?? 'settings'
  if (window.location.hash.replace(/^#/, '') === target) {
    // Same hash again: no hashchange fires, so scroll here.
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
    else window.scrollTo({ top: 0 })
    return
  }
  window.scrollTo({ top: 0 })
  window.location.hash = target
}
