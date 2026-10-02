'use client'

// Reaching the 난임 시술 · 지원 counter (Next B — B2) from another tab (the
// clinic-mode home card): the card sits at the top of 챙길 것, so a caller
// leaves a one-shot request in sessionStorage and moves to #plan, where the
// card focuses its heading on mount — the openClinicSummary pattern. This
// phone, this session; nothing is shared.

const OPEN_KEY = 'dulset:open-treatments'

/** Go to 챙길 것 and put the counter card in focus. */
export function openTreatments(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(OPEN_KEY, '1')
  } catch {
    /* private mode / blocked storage: the tab opens, the card is at the top anyway */
  }
  window.location.hash = 'plan'
  window.scrollTo({ top: 0 })
}

/** Read (and clear) that request. */
export function takeOpenTreatments(): boolean {
  try {
    const v = window.sessionStorage.getItem(OPEN_KEY)
    if (v) window.sessionStorage.removeItem(OPEN_KEY)
    return !!v
  } catch {
    return false
  }
}
