// Deep links into 설정. A hash like #share opens the settings screen (AppShell
// routes these to the settings tab, the way #days opens 우리 › 기념일) and
// scrolls to the section with that id (SettingsTab), opening it if it was
// folded. Every section has one, so the chip table of contents at the top of
// 설정 can jump anywhere. None of them may be a tab key (today, cycle, diary …)
// or one of 우리's hashes (days, album): AppShell checks these first.

import type { Stage } from '@/lib/types'

/**
 * Section ids inside 설정 that other screens link to, in the preparing
 * stage's screen order (settingsSections): 연결 and 공유 범위 right after
 * 우리 둘 — the partner's door and what he sees come first (N28) — and 우리
 * 둘의 날 near the bottom (N27).
 */
export const SETTINGS_ANCHORS = [
  'members',
  'link',
  'share',
  'alerts',
  'home',
  'cycle-numbers',
  'stage',
  'programs',
  'ourdays',
  'data',
  'about',
] as const

export type SettingsAnchor = (typeof SETTINGS_ANCHORS)[number]

/** Chip labels for the table of contents (short; the section carries the full title). */
export const SETTINGS_TOC_LABEL: Record<SettingsAnchor, string> = {
  members: '우리 둘',
  share: '공유',
  alerts: '알림',
  home: '첫 화면',
  ourdays: '기념일',
  'cycle-numbers': '주기',
  stage: '단계',
  link: '연결',
  programs: '지원',
  data: '데이터',
  about: '정보',
}

/**
 * The sections in screen order for a stage. Preparing: SETTINGS_ANCHORS as
 * listed. Later stages have no 공유 범위 or cycle numbers (nothing is
 * recorded then), and 우리 둘의 날 goes back up under 첫 화면.
 */
export function settingsSections(stage: Stage): SettingsAnchor[] {
  if (stage === 'preparing') return [...SETTINGS_ANCHORS]
  return ['members', 'link', 'alerts', 'home', 'ourdays', 'stage', 'programs', 'data', 'about']
}

export function isSettingsAnchor(hash: string): hash is SettingsAnchor {
  return (SETTINGS_ANCHORS as readonly string[]).includes(hash)
}

/**
 * Open 설정 at a section: 공유 범위 (#share), 내 알림 (#alerts), 첫 화면 (#home),
 * 데이터와 개인정보 (#data, 백업 파일 내보내기) … Setting the hash switches the
 * tab; the settings screen then opens the section and brings it into view.
 */
export function goToSettings(anchor?: SettingsAnchor): void {
  if (typeof window === 'undefined') return
  const target = anchor ?? 'settings'
  if (window.location.hash.replace(/^#/, '') === target) {
    // Same hash again: no hashchange fires, so tell the settings screen directly.
    if (anchor) window.dispatchEvent(new HashChangeEvent('hashchange'))
    else window.scrollTo({ top: 0 })
    return
  }
  window.scrollTo({ top: 0 })
  window.location.hash = target
}
