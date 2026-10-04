'use client'

// "첫 화면에 우리 사진을 걸어 볼까요?" waits until the partner's link has gone
// out (N27: it used to come right after 시작하기, before the link — the one
// thing the first day is for). Sending the link in the onboarding's last step
// asks it once on the first home; sending it later from 설정 › 연결 asks it
// the next time 오늘 opens (AppShell remounts components/cover/CoverAsk).
// Once per device (a dulset: key, so 모두 지우기 resets it), never when a cover
// is already hung; tapping the cover's '우리 사진 걸기' works any time.

import { requestCoverAsk } from '@/components/cover/coverAskFlag'

export const COVER_ASKED_KEY = 'dulset:cover-asked'

function askedBefore(): boolean {
  try {
    return window.localStorage.getItem(COVER_ASKED_KEY) === '1'
  } catch {
    return false
  }
}

/** After the link was shared or copied: queue the cover question once (CoverAsk still skips it on quiet days). */
export function askCoverAfterLink(hasCover: boolean): void {
  if (typeof window === 'undefined' || hasCover || askedBefore()) return
  try {
    window.localStorage.setItem(COVER_ASKED_KEY, '1')
  } catch {
    // Storage off: the question may come again on a later send — harmless.
  }
  requestCoverAsk()
}
