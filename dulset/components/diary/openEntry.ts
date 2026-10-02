'use client'

// Landing on one story entry from another tab ('1년 전 오늘의 이야기 ›' on the
// cover): the caller leaves the entry id as a one-shot in sessionStorage and
// moves to 우리, where DiaryTab scrolls to that card on mount — the
// openClinicSummary pattern. This phone, this session; nothing is shared.

const KEY = 'dulset:open-entry'

/** The DOM id of an entry's card in the story list. */
export const entryDomId = (id: string): string => `entry-${id}`

export function requestOpenEntry(id: string): void {
  try {
    window.sessionStorage.setItem(KEY, id)
  } catch {
    /* blocked storage: 우리 opens at the top */
  }
}

/** Read (and clear) the request. */
export function takeOpenEntry(): string | null {
  try {
    const v = window.sessionStorage.getItem(KEY)
    if (v) window.sessionStorage.removeItem(KEY)
    return v
  } catch {
    return null
  }
}
