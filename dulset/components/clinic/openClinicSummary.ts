'use client'

// Opening '병원에 보여 줄 요약' from another tab (the clinic-mode home card):
// the sheet is mounted in the 주기 tab only, so a caller leaves a one-shot
// request in sessionStorage and moves to #cycle — the same hand-off the
// home's '지난 주기 컨디션 N개 · 보기' uses (components/cycle/CycleHistory
// requestOpenFeels). This phone, this session; nothing is shared.

const OPEN_KEY = 'dulset:open-clinic-summary'

/** Ask the 주기 tab to open the summary sheet on its next mount, then go there. */
export function openClinicSummary(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(OPEN_KEY, '1')
  } catch {
    /* private mode / blocked storage: the tab opens without the sheet */
  }
  window.location.hash = 'cycle'
  window.scrollTo({ top: 0 })
}

/** Read (and clear) that request. */
export function takeOpenClinicSummary(): boolean {
  try {
    const v = window.sessionStorage.getItem(OPEN_KEY)
    if (v) window.sessionStorage.removeItem(OPEN_KEY)
    return !!v
  } catch {
    return false
  }
}
