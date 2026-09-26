'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isISODate, todayISO } from './dates'
import { otherMember } from './initial'
import { STORAGE_KEY, loadState, loadViewer, parseState, saveState, saveViewer } from './storage'
import type { AppState, ISODate, Member, MemberId } from './types'

/**
 * State changes are pure functions `(state) => state` that live next to the
 * feature they belong to (lib/logic/*). Components call `update(fn)`.
 */
export type Updater = (state: AppState) => AppState

interface StoreValue {
  hydrated: boolean
  state: AppState | null
  update: (fn: Updater) => void
  replace: (next: AppState | null) => void
  viewer: MemberId
  setViewer: (id: MemberId) => void
  today: ISODate
}

const StoreContext = createContext<StoreValue | null>(null)

/** `?today=2026-10-01` pins the date — handy for demos and screenshots. */
function readTodayOverride(): ISODate | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('today')
  return isISODate(v) ? v : null
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [state, setState] = useState<AppState | null>(null)
  const [viewer, setViewerState] = useState<MemberId>('a')
  const [today, setToday] = useState<ISODate>(() => todayISO())
  const skipSave = useRef(true)

  useEffect(() => {
    setState(loadState())
    setViewerState(loadViewer())
    const override = readTodayOverride()
    if (override) setToday(override)
    setHydrated(true)

    // Another tab (= the partner's "phone" in the prototype) changed the data.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      skipSave.current = true
      setState(parseState(e.newValue))
    }
    // Roll the date over at midnight / when the app comes back to the foreground.
    const tick = () => {
      if (!readTodayOverride()) setToday(todayISO())
    }
    const timer = window.setInterval(tick, 60_000)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveState(state)
  }, [state, hydrated])

  const update = useCallback((fn: Updater) => {
    setState((prev) => (prev ? fn(prev) : prev))
  }, [])

  const replace = useCallback((next: AppState | null) => setState(next), [])

  const setViewer = useCallback((id: MemberId) => {
    setViewerState(id)
    saveViewer(id)
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ hydrated, state, update, replace, viewer, setViewer, today }),
    [hydrated, state, update, replace, viewer, setViewer, today],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export interface AppApi {
  state: AppState
  update: (fn: Updater) => void
  replace: (next: AppState | null) => void
  today: ISODate
  viewer: MemberId
  setViewer: (id: MemberId) => void
  /** The member whose "phone" this is. */
  me: Member
  /** The other member. */
  partner: Member
  /** The member whose cycle is tracked (may be me or partner). */
  cycleOwner: Member
}

/** For screens rendered after onboarding — state is guaranteed. */
export function useApp(): AppApi {
  const { state, update, replace, today, viewer, setViewer } = useStore()
  if (!state) throw new Error('useApp requires an onboarded state')
  const members = state.couple.members
  const me = members.find((m) => m.id === viewer) ?? members[0]
  const partner = members.find((m) => m.id === otherMember(me.id)) ?? members[1]
  const cycleOwner = members.find((m) => m.tracksCycle) ?? members[0]
  return { state, update, replace, today, viewer, setViewer, me, partner, cycleOwner }
}
