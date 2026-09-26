'use client'

/** Tabs the 임신 tab links to. AppShell picks the tab up from the hash. */
export type LinkedTab = 'today' | 'baby' | 'date' | 'diary'

/**
 * Switch tabs the way the bottom nav does: set the hash (AppShell listens for
 * hashchange) and start the new tab at the top instead of at the scroll
 * position of the long 임신 page.
 */
export function goToTab(tab: LinkedTab): void {
  if (window.location.hash.replace(/^#/, '') !== tab) window.location.hash = tab
  window.scrollTo({ top: 0 })
}
