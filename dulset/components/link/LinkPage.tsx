'use client'

// 남편용 설치 없는 웹 화면 (Next A ①) — the page behind the link she sends.
//
// It reads the share token from the URL hash (#t=…: a hash never reaches a
// server log), asks the transport for the PartnerSnapshot the token can see,
// and draws one warm page from it: greeting and cover, the moment card with
// the shared week row and two date ideas, his month task, his checks, the
// signal waiting for his answer, 콕 / 응원, and a footer that says what this
// is. Every tap becomes a small typed event (lib/logic/partnerEvents) sent
// through the same transport; her phone applies it and republishes, and the
// page polls the snapshot back. Nothing else is requested — no app state, no
// cycle data, no other origin.
//
// Offline-first after the first load: the last snapshot this browser saw is
// kept (components/link/model LINK_VIEW_KEY) and shown while the transport is
// unreachable. An unknown, expired or revoked token shows the calm notice;
// a snapshot older than its validUntil (her phone has not refreshed it)
// shows '잠시 쉬고 있어요'. The page has no store and no onboarding.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastProvider, useToast } from '@/components/ui'
import { isISODate, todayISO } from '@/lib/dates'
import { uid } from '@/lib/id'
import { CHEERS_PER_DAY, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { snapshotUsable, type PartnerSnapshot, type SnapshotCheck, type SnapshotTask } from '@/lib/logic/partnerSnapshot'
import type { Signal } from '@/lib/logic/signals'
import { transport } from '@/lib/sync/transport'
import type { ISODate } from '@/lib/types'
import { tokenFromHash } from '@/lib/useLinkSync'
import { clockKo, Heading } from './bits'
import LinkChecks from './LinkChecks'
import LinkCover from './LinkCover'
import LinkMoment from './LinkMoment'
import LinkNotice, { type NoticeKind } from './LinkNotice'
import LinkSignals from './LinkSignals'
import LinkTaskCard from './LinkTask'
import LinkUsLine from './LinkUsLine'
import {
  LINK_VIEW_KEY,
  NO_MARKS,
  ownerOf,
  parseCachedView,
  pruneMarks,
  viewCanNudge,
  viewChecks,
  viewerOf,
  viewSignal,
  viewSignalsLeft,
  viewTask,
  type CachedView,
  type LocalMarks,
} from './model'

/** The snapshot is fetched again this often while the page is visible. */
export const POLL_EVERY_MS = 5_000
/** After a tap: quick re-fetches so his action shows as hers confirms it. */
const AFTER_SEND_MS = [1_500, 3_500, 7_000] as const

type View =
  | { kind: 'loading' }
  | { kind: 'notice'; notice: NoticeKind; ownerName?: string }
  | { kind: 'ready'; snapshot: PartnerSnapshot; fetchedAt: number; fromCache: boolean }

function safeLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function readCache(token: string): CachedView | null {
  try {
    const c = parseCachedView(safeLocal()?.getItem(LINK_VIEW_KEY) ?? null)
    return c && c.token === token ? c : null
  } catch {
    return null
  }
}

function writeCache(view: CachedView | null): void {
  try {
    const ls = safeLocal()
    if (!ls) return
    if (view) ls.setItem(LINK_VIEW_KEY, JSON.stringify(view))
    else ls.removeItem(LINK_VIEW_KEY)
  } catch {
    /* storage full or blocked: the page still works from memory */
  }
}

/** `?today=YYYY-MM-DD` pins the date (demos, screenshots) — as lib/store does for the app. */
function readToday(): ISODate {
  if (typeof window !== 'undefined') {
    const v = new URLSearchParams(window.location.search).get('today')
    if (isISODate(v)) return v
  }
  return todayISO()
}

function useToday(): ISODate {
  const [today, setToday] = useState<ISODate>(() => todayISO())
  useEffect(() => {
    const tick = () => setToday(readToday())
    tick()
    const t = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

function useHashToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const read = () => setToken(tokenFromHash(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  return token
}

export default function LinkPage() {
  return (
    <ToastProvider>
      <LinkScreen />
    </ToastProvider>
  )
}

function LinkScreen() {
  const token = useHashToken()
  const today = useToday()
  const toast = useToast()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [marks, setMarks] = useState<LocalMarks>(NO_MARKS)
  const viewRef = useRef(view)
  viewRef.current = view
  const timers = useRef<number[]>([])

  const applySnapshot = useCallback(
    (snapshot: PartnerSnapshot | null, tok: string, fetched: boolean) => {
      const now = Date.now()
      if (!snapshot) {
        // Unknown, expired or revoked: the cached one is of no use any more (its
        // owner's name is — and a notice already on screen keeps the name it
        // found, since the cache is gone by the next poll).
        const prev = viewRef.current
        const cached = readCache(tok)
        const ownerName =
          prev.kind === 'ready'
            ? ownerOf(prev.snapshot).name
            : prev.kind === 'notice'
              ? prev.ownerName
              : cached
                ? ownerOf(cached.snapshot).name
                : undefined
        writeCache(null)
        if (prev.kind === 'notice' && prev.notice === 'expired' && prev.ownerName === ownerName) return
        setView({ kind: 'notice', notice: 'expired', ...(ownerName ? { ownerName } : {}) })
        setMarks(NO_MARKS)
        return
      }
      if (!snapshotUsable(snapshot, today)) {
        setView({ kind: 'notice', notice: 'stale', ownerName: ownerOf(snapshot).name })
        return
      }
      if (fetched) writeCache({ token: tok, snapshot, at: now })
      setMarks((m) => pruneMarks(m, snapshot, now))
      setView({ kind: 'ready', snapshot, fetchedAt: now, fromCache: !fetched })
    },
    [today],
  )

  const fetchNow = useCallback(
    async (tok: string) => {
      try {
        const t = await transport()
        const snapshot = await t.fetchSnapshot(tok)
        applySnapshot(snapshot, tok, true)
      } catch {
        // Unreachable: keep what is on screen; with nothing cached, say so.
        const prev = viewRef.current
        if (prev.kind === 'ready') setView({ ...prev, fromCache: true })
        else if (prev.kind !== 'notice' || prev.notice === 'offline') setView({ kind: 'notice', notice: 'offline' })
      }
    },
    [applySnapshot],
  )

  // Load: the cached snapshot first (offline-first), then the transport; poll while visible.
  useEffect(() => {
    if (token === undefined) return
    if (token === null) {
      setView({ kind: 'notice', notice: 'nolink' })
      return
    }
    const cached = readCache(token)
    if (cached) applySnapshot(cached.snapshot, token, false)
    let alive = true
    let busy = false
    const run = () => {
      if (!alive || busy || document.visibilityState === 'hidden') return
      busy = true
      void fetchNow(token).finally(() => {
        busy = false
      })
    }
    run()
    const timer = window.setInterval(run, POLL_EVERY_MS)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    // The mock transport writes to this origin's storage: hear the other tab right away.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || (e.key ?? '').startsWith('dulset:mock-sync')) run()
    }
    window.addEventListener('storage', onStorage)
    const held = timers.current
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('storage', onStorage)
      held.forEach((id) => window.clearTimeout(id))
      held.length = 0
    }
  }, [token, applySnapshot, fetchNow])

  // Send one event, then re-fetch a few times so her confirmation lands on screen.
  const send = useCallback(
    async (ev: PartnerEvent, done: string) => {
      if (!token) return
      try {
        const t = await transport()
        await t.sendEvent(token, ev)
        toast.show(done)
        for (const ms of AFTER_SEND_MS) timers.current.push(window.setTimeout(() => void fetchNow(token), ms))
      } catch {
        toast.show('지금은 보낼 수 없어요. 잠시 뒤 다시 눌러 주세요')
        setMarks(NO_MARKS)
      }
    },
    [token, toast, fetchNow],
  )

  const snapshot = view.kind === 'ready' ? view.snapshot : null
  const me = snapshot ? viewerOf(snapshot) : null
  const owner = snapshot ? ownerOf(snapshot) : null
  const checks = useMemo(() => (snapshot ? viewChecks(snapshot.checks, marks) : null), [snapshot, marks])
  const signalsLeft = snapshot ? viewSignalsLeft(snapshot, marks) : 0
  const cheersLeft = Math.max(0, CHEERS_PER_DAY - marks.cheers.length)
  const pending = snapshot ? viewSignal(snapshot, marks) : undefined
  const canNudge = snapshot ? viewCanNudge(snapshot, marks) : false
  const task = snapshot ? viewTask(snapshot, marks) : null

  const onToggle = (item: SnapshotCheck) => {
    if (!snapshot) return
    const done = !item.done
    setMarks((m) => ({ ...m, checks: { ...m.checks, [item.id]: { done, at: Date.now() } } }))
    void send(
      { id: uid(), from: snapshot.viewer, kind: 'check', itemId: item.id, date: today, done },
      done ? `‘${item.label}’ 체크했어요` : `‘${item.label}’ 체크를 풀었어요`,
    )
  }
  const onTaskDone = (t: SnapshotTask) => {
    if (!snapshot) return
    setMarks((m) => ({ ...m, task: { id: t.id, at: Date.now() } }))
    void send({ id: uid(), from: snapshot.viewer, kind: 'task-done', taskId: t.id, date: t.defaultDoneAt }, `‘${t.title}’ 완료했어요`)
  }
  const onReply = (r: Signal) => {
    if (!snapshot || !pending?.signalId) return
    setMarks((m) => ({ ...m, reply: { signalId: pending.signalId!, at: Date.now() } }))
    void send(
      { id: uid(), from: snapshot.viewer, kind: 'reply', signalId: pending.signalId, replyId: r.id },
      `${owner!.name}님에게 “${r.text}” 보냈어요`,
    )
  }
  const onSignal = (s: Signal) => {
    if (!snapshot) return
    setMarks((m) => ({ ...m, signals: [...m.signals, Date.now()] }))
    void send({ id: uid(), from: snapshot.viewer, kind: 'signal', signalId: s.id }, `${owner!.name}님에게 “${s.text}” 보냈어요`)
  }
  const onNudge = () => {
    if (!snapshot) return
    setMarks((m) => ({ ...m, nudge: { at: Date.now() } }))
    void send({ id: uid(), from: snapshot.viewer, kind: 'nudge' }, `${owner!.name}님에게 콕! 보냈어요`)
  }
  const onCheer = () => {
    if (!snapshot) return
    setMarks((m) => ({ ...m, cheers: [...m.cheers, Date.now()] }))
    void send({ id: uid(), from: snapshot.viewer, kind: 'cheer' }, `${owner!.name}님에게 응원을 보냈어요`)
  }
  const goToUsLine = () => {
    const el = document.getElementById('us-line')
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el?.querySelector<HTMLElement>('[data-reply]:not([disabled])')?.focus({ preventScroll: true })
  }

  // Where his month task sits — components/tabs/TodayTab's rule, so the page
  // orders itself the way his in-app home does: a live deadline (`top`) goes
  // before the moment card, or right after it when the card ends in a button;
  // else inside the card when the card features it; else in 우리 한 줄.
  const m = snapshot?.moment
  const where: 'top' | 'after' | 'card' | 'us' | null = !task
    ? null
    : task.task.top
      ? m?.primary
        ? 'after'
        : 'top'
      : m?.monthlyTask
        ? 'card'
        : 'us'
  const featured = where === 'card'
  const leads = where === 'top'
  const follows = where === 'after'
  const inUsLine = where === 'us'

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <header className="pt-safe sticky top-0 z-30 bg-bg/[.92] backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <span className="text-[20px] font-extrabold tracking-tight text-ink">둘셋</span>
          <span className="truncate text-[11px] font-medium text-ink-3">설치 없이 보는 화면</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 pt-4">
        {view.kind === 'loading' ? (
          <div className="flex min-h-[50vh] items-center justify-center text-ink-3" aria-busy="true">
            <span className="animate-pulse text-sm">불러오는 중…</span>
          </div>
        ) : view.kind === 'notice' ? (
          <LinkNotice
            kind={view.notice}
            ownerName={view.ownerName}
            onRetry={view.notice === 'offline' && token ? () => void fetchNow(token) : undefined}
          />
        ) : snapshot && me && owner && checks && task !== undefined ? (
          <>
            <LinkCover snapshot={snapshot} today={today} onLine={pending ? goToUsLine : undefined} />

            <div className="mt-4 space-y-3">
              {leads && task ? <LinkTaskCard task={task.task} done={task.done} onDone={onTaskDone} /> : null}
              {snapshot.moment ? (
                <LinkMoment snapshot={snapshot} task={featured && task ? task : undefined} onTaskDone={onTaskDone} />
              ) : null}
              {follows && task ? <LinkTaskCard task={task.task} done={task.done} onDone={onTaskDone} /> : null}
            </div>

            <Heading>오늘 할 일</Heading>
            <LinkChecks me={me} her={me.id === snapshot.cycleOwner} checks={checks} onToggle={onToggle} />

            <Heading sub={pending ? `${owner.name}님의 신호에 답해 보세요` : undefined}>우리 한 줄</Heading>
            {inUsLine && task ? <LinkTaskCard task={task.task} done={task.done} onDone={onTaskDone} className="mb-3" /> : null}
            <LinkUsLine
              snapshot={snapshot}
              signal={pending}
              canNudge={canNudge}
              cheersLeft={cheersLeft}
              signalsLeft={signalsLeft}
              onNudge={onNudge}
              onCheer={onCheer}
              onReply={onReply}
            />

            <Heading sub="말로 꺼내기 어려운 건 버튼 하나로">우리 신호</Heading>
            <LinkSignals snapshot={snapshot} left={signalsLeft} onSend={onSignal} />

            <footer className="mt-8 space-y-1.5 px-1 text-center text-[11.5px] leading-relaxed text-ink-3">
              <p>설치 없이 보는 화면이에요 · 앱으로 설치하면 알림을 받아요 (준비 중)</p>
              <p>
                {owner.name}님이 보낸 링크로만 열려요 · {view.fromCache ? '마지막으로 받은 화면이에요' : `${clockKo(view.fetchedAt)} 기준`}
              </p>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  )
}
