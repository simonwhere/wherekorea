'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isISODate, todayISO } from './dates'
import { otherMember } from './initial'
import { baseForUpdate } from './logic/sync'
import { stampOn } from './logic/today'
import { STORAGE_KEY, loadState, loadViewer, parseState, readSyncMarks, saveState, saveViewer, writeSyncMarks } from './storage'
import { stampChanges } from './sync/model'
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
  /** The last save to this device failed (storage full or blocked) — until one succeeds. */
  saveFailed: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

interface PendingUpdate {
  seq: number
  at: number
  fn: Updater
}

/** Past this, the other tab has certainly seen our write — nothing left to rebase. */
const REBASE_WINDOW_MS = 5_000
/** Tabs remembered in the rebase marks (older entries are dropped). */
const SYNC_TABS = 6

/**
 * Record, in the sidecar (lib/storage.ts SYNC_KEY — never in the state, so a
 * backup holds records only), that the state about to be saved includes this
 * tab's updates up to `seq`. Written before saveState: the other tab's
 * 'storage' event for the state arrives after both writes.
 */
function markSync(tabId: string, seq: number): void {
  const entries = Object.entries(readSyncMarks()).filter(([id]) => id !== tabId)
  writeSyncMarks(Object.fromEntries([...entries.slice(-(SYNC_TABS - 1)), [tabId, seq]]))
}

/**
 * A pure change, then the sync marks on what it touched (lib/sync/model.ts
 * stampChanges: `updatedAt` = this moment on `today`, an id for a new record
 * that has none) — the one place every writer's records get stamped.
 */
function applyChange(base: AppState, fn: Updater, today: ISODate): AppState {
  return stampChanges(base, fn(base), stampOn(today))
}

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
  const [saveFailed, setSaveFailed] = useState(false)
  /** The state this tab last read from / wrote to storage — no need to save it again. */
  const persisted = useRef<AppState | null | undefined>(undefined)
  /** Latest state, including updates not rendered yet (for update's fallback). */
  const latest = useRef<AppState | null>(null)
  /** This tab's id in the rebase marks, and its recent updates (see rebase below). */
  const tab = useRef({ id: '', seq: 0, pending: [] as PendingUpdate[] })
  /** The app's "today" for update() (a stable callback; the state's date pin or the clock). */
  const todayRef = useRef<ISODate>(today)
  todayRef.current = today

  useEffect(() => {
    tab.current.id = Math.random().toString(36).slice(2, 10)
    const loaded = loadState()
    persisted.current = loaded
    latest.current = loaded
    setState(loaded)
    setViewerState(loadViewer())
    const override = readTodayOverride()
    if (override) setToday(override)
    setHydrated(true)

    // Another tab (= the partner's "phone" in the prototype) changed the data.
    // Tabs are separate processes and storage reaches each of them a moment
    // later, so two taps at nearly the same time can each be based on a state
    // without the other's change. The sidecar records the last update of each
    // tab the saved state includes (lib/storage.ts SYNC_KEY); if it is missing
    // some of ours, re-apply them on top (they are pure, and each is applied
    // once to a state that lacks it) and save — so both edits survive and
    // both tabs converge.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      // The freshest value this tab can see (it may already hold our own newer write).
      let remote: AppState | null
      try {
        remote = parseState(window.localStorage.getItem(STORAGE_KEY))
      } catch {
        remote = parseState(e.newValue)
      }
      const t = tab.current
      const now = Date.now()
      const seen = readSyncMarks()[t.id] ?? 0
      t.pending = t.pending.filter((p) => p.seq > seen && now - p.at < REBASE_WINDOW_MS)
      let next = remote
      // What storage holds after this handler: the rebased state if it saved, else what we read.
      let saved = remote
      if (remote && t.pending.length > 0) {
        let rebased = remote
        for (const p of t.pending) rebased = applyChange(rebased, p.fn, todayRef.current)
        next = rebased
        markSync(t.id, t.seq)
        const ok = saveState(next)
        if (ok) saved = next
        setSaveFailed(!ok)
      } else if (!remote) {
        t.pending = []
      }
      persisted.current = saved
      latest.current = next
      setState(next)
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

  // replace() (onboarding, backup import, wipe) is saved here; update() saves itself.
  useEffect(() => {
    if (!hydrated || state === persisted.current) return
    const ok = saveState(state)
    if (ok) persisted.current = state
    setSaveFailed(!ok)
  }, [state, hydrated])

  /**
   * Read-modify-write against storage, synchronously: the change is applied to
   * the freshest saved state (the other tab may have saved an edit a moment
   * ago that this tab hasn't heard about yet), then saved right away. Updaters
   * are pure, so re-applying one to newer data keeps both people's edits.
   */
  const update = useCallback((fn: Updater) => {
    let stored: AppState | null = null
    try {
      stored = parseState(window.localStorage.getItem(STORAGE_KEY))
    } catch {
      stored = null
    }
    // After a failed save, memory is ahead of storage: build on it (logic/sync).
    const base = baseForUpdate(stored, latest.current, persisted.current)
    if (!base) return
    const t = tab.current
    t.seq += 1
    t.pending.push({ seq: t.seq, at: Date.now(), fn })
    const next = applyChange(base, fn, todayRef.current)
    latest.current = next
    markSync(t.id, t.seq)
    const ok = saveState(next)
    if (ok) persisted.current = next
    setSaveFailed(!ok)
    setState(next)
  }, [])

  const replace = useCallback((next: AppState | null) => {
    latest.current = next
    setState(next)
  }, [])

  const setViewer = useCallback((id: MemberId) => {
    setViewerState(id)
    saveViewer(id)
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ hydrated, state, update, replace, viewer, setViewer, today, saveFailed }),
    [hydrated, state, update, replace, viewer, setViewer, today, saveFailed],
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
