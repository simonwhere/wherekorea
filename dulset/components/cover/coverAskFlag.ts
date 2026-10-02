'use client'

// A one-time flag between the onboarding's 시작하기 and the first home render:
// "첫 화면에 우리 사진을 걸어 볼까요?" (components/cover/CoverAsk). Kept in
// this module (the onboarding and the home live in the same page) with a
// sessionStorage copy, so a reload in between still asks once. Never
// persisted with the state: it is a question, not a record.

const KEY = 'dulset:ask-cover'

let pending = false

export function requestCoverAsk(): void {
  pending = true
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // Private mode or storage off: the in-memory flag still covers this page.
  }
}

/** True once: the first caller after a request takes the question with it. */
export function takeCoverAsk(): boolean {
  let stored = false
  try {
    stored = window.sessionStorage.getItem(KEY) === '1'
    if (stored) window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  const asked = pending || stored
  pending = false
  return asked
}
