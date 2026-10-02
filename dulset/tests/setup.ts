// Setup for the `components` vitest project (jsdom + @testing-library/react).
//
// Components read everything through useApp() / useStore(), and the real
// StoreProvider loads its state from localStorage, the viewer from
// sessionStorage and "today" from `?today=` — so a test seeds those three
// (seedApp) and renders inside the real provider (renderApp). Nothing in
// lib/store.tsx is mocked: what a test sees is what the browser would show.

import { cleanup, render, type RenderResult } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach } from 'vitest'
import { ToastProvider } from '@/components/ui'
import { createDemoState } from '@/lib/demo'
import { VIEWER_KEY, saveState } from '@/lib/storage'
import { StoreProvider, useStore } from '@/lib/store'
import type { AppState, ISODate, MemberId, Stage } from '@/lib/types'

// ── jsdom gaps the components touch ─────────────────────────

// jsdom logs "Not implemented" errors for these; the components only call them for comfort.
window.scrollTo = (() => {}) as typeof window.scrollTo
Element.prototype.scrollIntoView = () => {}
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  document.body.removeAttribute('data-toast-top')
})

// Without `globals: true`, testing-library doesn't register its own afterEach.
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

// ── Store seeding ───────────────────────────────────────────

export interface AppSeed {
  /** The saved state (null = nothing saved yet: the first run / onboarding). */
  state: AppState | null
  /** Whose "phone" this is (lib/store viewer). Default 'a'. */
  viewer?: MemberId
  /** Pins the app's "today" (`?today=`), as a demo link would. */
  today?: ISODate
}

/** Put the state, the viewer and the date pin where the real StoreProvider reads them. */
export function seedApp({ state, viewer = 'a', today }: AppSeed): void {
  window.localStorage.clear()
  window.sessionStorage.clear()
  if (state) saveState(state)
  window.sessionStorage.setItem(VIEWER_KEY, viewer)
  window.history.replaceState(null, '', today ? `/?today=${today}` : '/')
}

/** Renders children once the provider has loaded storage (the way AppShell gates on `hydrated`). */
function Hydrated({ children }: { children: ReactNode }) {
  const { hydrated } = useStore()
  return hydrated ? children : null
}

/** The app's providers around `ui` (StoreProvider → ToastProvider), the same order as app/page.tsx + AppShell. */
export function withProviders(ui: ReactElement): ReactElement {
  return createElement(StoreProvider, null, createElement(ToastProvider, null, createElement(Hydrated, null, ui)))
}

/** Seed the store, then render `ui` inside the real providers. */
export function renderApp(ui: ReactElement, seed: AppSeed): RenderResult {
  seedApp(seed)
  return render(withProviders(ui))
}

/**
 * A probe that mirrors the store's live state into a plain object the test
 * can read after interactions (`const probe = stateProbe(); render(<probe.Probe />)`).
 */
export function stateProbe(): { current: { hydrated: boolean; state: AppState | null; viewer: MemberId }; Probe: () => null } {
  const current = { hydrated: false, state: null as AppState | null, viewer: 'a' as MemberId }
  function Probe(): null {
    const s = useStore()
    current.hydrated = s.hydrated
    current.state = s.state
    current.viewer = s.viewer
    return null
  }
  return { current, Probe }
}

// ── Fixtures ────────────────────────────────────────────────

/** The demo couple (민수 a · 지은 b, cycle owner b) built for `today`, like 예시로 둘러보기. */
export function demoState(today: ISODate, stage: Stage = 'preparing'): AppState {
  return createDemoState(today, new Date(`${today}T10:00:00`), stage)
}

/** Everything the page shows right now, portals (sheets, toasts) included. */
export function pageText(): string {
  return document.body.textContent ?? ''
}

/** The words of `words` that appear in `text`, with a little context for the failure message. */
export function foundWords(text: string, words: readonly string[]): string[] {
  const hits: string[] = []
  for (const w of words) {
    const i = text.indexOf(w)
    if (i >= 0) hits.push(`'${w}' in …${text.slice(Math.max(0, i - 20), i + w.length + 20).replace(/\s+/g, ' ')}…`)
  }
  return hits
}
