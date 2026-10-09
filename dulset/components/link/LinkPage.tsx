'use client'

// 남편용 설치 없는 웹 화면 (Next A ① · Now 3) — the page behind the link she sends.
//
// It reads the share token from the URL hash (#t=…: a hash never reaches a
// server log), asks the transport for the PartnerSnapshot the token can see
// — seven days of pages since v2 (N20) — and draws the entry for this
// device's own date (lib/logic/partnerSnapshot snapshotDay) with
// components/link/LinkBody: greeting and cover, the moment card with the
// shared week row and two date ideas, his month task, '이번 주 우리 둘', his
// checks, the signal waiting for his answer, 콕 / 응원. Every tap becomes a
// small typed event (lib/logic/partnerEvents) sent through the same
// transport; her phone applies it by the moment it was taken in and
// republishes, and the page polls the snapshot back. At midnight the page
// simply moves to the next entry — no fetch needed while the week lasts.
//
// When the week the snapshot covers is over (her phone has not opened since),
// the page says so calmly — '새 화면은 곧 채워져요 · 지은님 폰이 열리면 다시
// 채워져요' — and keeps what still works: 우리 신호 and 응원 (they wait for her
// phone like any event). An unknown, expired or revoked token shows the calm
// notice. Offline-first after the first load: the last snapshot this browser
// saw is kept (components/link/model LINK_VIEW_KEY).
//
// The first time this device opens it (N22): the three-line card with the
// short setup ('setup' event), a '사파리/크롬으로 열기' hint inside 카카오톡 and
// a '홈 화면에 두기' card elsewhere. Each open records '링크 연 날' once per day
// (transport.recordLinkOpen — the token only; research, never shown to her).
// Nothing else is requested — no app state, no cycle data, no other origin.
//
// 2026-10-09 adds 같이 챙길 것 — her items with what he can do and [같이 할게요]
// ('support' {itemId, on}) — and, while pregnant, the stage card in the moment
// card's place with '이번 주 우리 둘' and 내 준비 under it.
//
// Now 3 adds: his clinic week's [같이 갈게요] ('join-appointment', N32), the
// '내 준비' bar (N30), '매주 이 시간에 알려 받기' — a weekly .ics made right
// here that links to '/link/' WITHOUT the token (N31); a token-less open on
// this phone uses the token this browser remembers (model LINK_TOKEN_KEY) —
// and, when the transport cannot be reached while a page is on screen, a
// slim '지금은 불러올 수 없어요' line over the kept page (the mock transport
// can simulate it: ?mockOffline=1 or the 'dulset:mock-offline' flag).

import { useCallback, useEffect, useRef, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import Polaroid from '@/components/cover/Polaroid'
import { ToastProvider, useToast } from '@/components/ui'
import { isISODate, todayISO } from '@/lib/dates'
import { uid } from '@/lib/id'
import { downloadText, weeklyLinkIcs, type WeeklyDay } from '@/lib/logic/ics'
import { isToken } from '@/lib/logic/partnerLink'
import { CHEERS_PER_DAY, type PartnerEvent } from '@/lib/logic/partnerEvents'
import {
  snapshotDay,
  type PartnerPage,
  type PartnerSnapshot,
  type SnapshotAppointment,
  type SnapshotCheck,
  type SnapshotTask,
} from '@/lib/logic/partnerSnapshot'
import { SIGNALS_PER_DAY, type Signal } from '@/lib/logic/signals'
import type { LinkTogetherItem } from '@/lib/logic/together'
import type { WeekOptionId } from '@/lib/logic/weekTogether'
import { transport } from '@/lib/sync/transport'
import type { ISODate } from '@/lib/types'
import { tokenFromHash } from '@/lib/useLinkSync'
import { clockKo, Heading, Pill } from './bits'
import LinkBody, { type LinkActions } from './LinkBody'
import { LinkInstallCard, LinkOutsideHint, useWhere } from './LinkInstall'
import LinkIntro from './LinkIntro'
import LinkNotice, { type NoticeKind } from './LinkNotice'
import LinkSignals from './LinkSignals'
import {
  LINK_INSTALL_KEY,
  LINK_INTRO_KEY,
  LINK_OUTSIDE_KEY,
  LINK_TOKEN_KEY,
  LINK_VIEW_KEY,
  NO_MARKS,
  OFFLINE_LINE,
  clinicWhen,
  noticeCopy,
  ownerOf,
  parseCachedView,
  parseDeviceMark,
  pickToken,
  pruneMarks,
  supportToast,
  viewerOf,
  weeklyLinkOrigin,
  type CachedView,
  type LocalMarks,
  type setupFields,
} from './model'

/** The snapshot is fetched again this often while the page is visible. */
export const POLL_EVERY_MS = 5_000
/** After a tap: quick re-fetches so his action shows as hers confirms it. */
const AFTER_SEND_MS = [1_500, 3_500, 7_000] as const

type View =
  | { kind: 'loading' }
  | { kind: 'notice'; notice: NoticeKind; ownerName?: string }
  | { kind: 'snapshot'; snapshot: PartnerSnapshot; fetchedAt: number; fromCache: boolean; offline?: boolean }

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

/** A per-device "done" mark (first-run card, install card, in-app hint). */
function readMark(key: string): boolean {
  try {
    return parseDeviceMark(safeLocal()?.getItem(key) ?? null) !== null
  } catch {
    return false
  }
}

function writeMark(key: string): void {
  try {
    safeLocal()?.setItem(key, JSON.stringify({ at: Date.now() }))
  } catch {
    /* blocked storage: the card closes for this visit only */
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

/**
 * The token to open with: the address's '#t=…'; on a token-less open (the
 * weekly calendar links to '/link/' without it) the one this browser
 * remembers. A token from the address is remembered for next time.
 */
function useHashToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const read = () => {
      const fromHash = tokenFromHash(window.location.hash)
      let remembered: string | null = null
      let cached: string | null = null
      try {
        const ls = safeLocal()
        if (fromHash) ls?.setItem(LINK_TOKEN_KEY, fromHash)
        remembered = ls?.getItem(LINK_TOKEN_KEY) ?? null
        cached = parseCachedView(ls?.getItem(LINK_VIEW_KEY) ?? null)?.token ?? null
      } catch {
        /* blocked storage: only the address counts */
      }
      setToken(pickToken(fromHash, remembered, cached, isToken))
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  return token
}

/** The three per-device marks, read once on the client (all "seen" during the static render, so nothing flashes). */
function useDeviceMarks() {
  const [marks, setMarks] = useState({ intro: true, install: true, outside: true })
  useEffect(() => {
    setMarks({ intro: readMark(LINK_INTRO_KEY), install: readMark(LINK_INSTALL_KEY), outside: readMark(LINK_OUTSIDE_KEY) })
  }, [])
  const close = useCallback((which: 'intro' | 'install' | 'outside') => {
    writeMark(which === 'intro' ? LINK_INTRO_KEY : which === 'install' ? LINK_INSTALL_KEY : LINK_OUTSIDE_KEY)
    setMarks((m) => ({ ...m, [which]: true }))
  }, [])
  return { seen: marks, close }
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
  const where = useWhere()
  const device = useDeviceMarks()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [marks, setMarks] = useState<LocalMarks>(NO_MARKS)
  const viewRef = useRef(view)
  viewRef.current = view
  const timers = useRef<number[]>([])
  const opened = useRef<Set<string>>(new Set())

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
          prev.kind === 'snapshot'
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
      if (!Array.isArray(snapshot.members) || !Array.isArray(snapshot.days)) {
        // A snapshot from another version of the app: nothing to draw yet.
        setView({ kind: 'notice', notice: 'stale', ...(Array.isArray(snapshot.members) ? { ownerName: ownerOf(snapshot).name } : {}) })
        return
      }
      if (fetched) writeCache({ token: tok, snapshot, at: now })
      setMarks((m) => pruneMarks(m, snapshotDay(snapshot, today), now))
      setView({ kind: 'snapshot', snapshot, fetchedAt: now, fromCache: !fetched })
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
        // Unreachable: keep what is on screen (with the slim offline line); with nothing kept, say so.
        const prev = viewRef.current
        if (prev.kind === 'snapshot') {
          if (!prev.offline || !prev.fromCache) setView({ ...prev, fromCache: true, offline: true })
        } else if (prev.kind !== 'notice' || prev.notice === 'offline') setView({ kind: 'notice', notice: 'offline' })
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

  // '링크 연 날' (research only): once per page load and day — the token goes, nothing else.
  useEffect(() => {
    if (!token) return
    const key = `${token}|${today}`
    if (opened.current.has(key)) return
    opened.current.add(key)
    void transport()
      .then((t) => t.recordLinkOpen(token, today))
      .catch(() => {})
  }, [token, today])

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

  const snapshot = view.kind === 'snapshot' ? view.snapshot : null
  const page: PartnerPage | null = snapshot ? snapshotDay(snapshot, today) : null

  const actionsFor = (p: PartnerPage): LinkActions => {
    const owner = ownerOf(p)
    return {
      onToggle: (item: SnapshotCheck) => {
        const done = !item.done
        setMarks((m) => ({ ...m, checks: { ...m.checks, [item.id]: { done, at: Date.now() } } }))
        void send(
          { id: uid(), from: p.viewer, kind: 'check', itemId: item.id, date: today, done },
          done ? `‘${item.label}’ 체크했어요` : `‘${item.label}’ 체크를 풀었어요`,
        )
      },
      onTaskDone: (t: SnapshotTask) => {
        setMarks((m) => ({ ...m, task: { id: t.id, at: Date.now() } }))
        void send({ id: uid(), from: p.viewer, kind: 'task-done', taskId: t.id, date: t.defaultDoneAt }, `‘${t.title}’ 완료했어요`)
      },
      onReply: (r: Signal) => {
        const signalId = p.signal?.signalId
        if (!signalId) return
        setMarks((m) => ({ ...m, reply: { signalId, at: Date.now() } }))
        void send({ id: uid(), from: p.viewer, kind: 'reply', signalId, replyId: r.id }, `${owner.name}님에게 “${r.text}” 보냈어요`)
      },
      onSignal: (s: Signal) => {
        setMarks((m) => ({ ...m, signals: [...m.signals, Date.now()] }))
        void send({ id: uid(), from: p.viewer, kind: 'signal', signalId: s.id }, `${owner.name}님에게 “${s.text}” 보냈어요`)
      },
      onNudge: () => {
        setMarks((m) => ({ ...m, nudge: { at: Date.now() } }))
        void send({ id: uid(), from: p.viewer, kind: 'nudge' }, `${owner.name}님에게 콕! 보냈어요`)
      },
      onCheer: () => {
        setMarks((m) => ({ ...m, cheers: [...m.cheers, Date.now()] }))
        void send({ id: uid(), from: p.viewer, kind: 'cheer' }, `${owner.name}님에게 응원을 보냈어요`)
      },
      onWeekPick: (optionId: WeekOptionId) => {
        const w = p.week
        if (!w) return
        const text = w.options.find((o) => o.id === optionId)?.text ?? ''
        setMarks((m) => ({ ...m, weekPick: { monday: w.monday, optionId, at: Date.now() } }))
        void send({ id: uid(), from: p.viewer, kind: 'week-pick', optionId, date: today }, `이번 주는 ‘${text}’로 골랐어요`)
      },
      onWeekDone: () => {
        const w = p.week
        if (!w) return
        setMarks((m) => ({ ...m, weekDone: { monday: w.monday, at: Date.now() } }))
        void send({ id: uid(), from: p.viewer, kind: 'week-done', date: today }, `했어요! ${owner.name}님에게 전해져요`)
      },
      onJoin: (a: SnapshotAppointment) => {
        if (a.with !== 'both') return
        setMarks((m) => ({ ...m, joins: { ...(m.joins ?? {}), [a.id]: Date.now() } }))
        void send(
          { id: uid(), from: p.viewer, kind: 'join-appointment', appointmentId: a.id },
          `${clinicWhen(a.date, a.time, today)} 같이 간다고 ${owner.name}님에게 전했어요`,
        )
      },
      onSupport: (item: LinkTogetherItem, on: boolean) => {
        setMarks((m) => ({ ...m, supports: { ...(m.supports ?? {}), [item.id]: { on, at: Date.now() } } }))
        void send({ id: uid(), from: p.viewer, kind: 'support', itemId: item.id, on }, supportToast(item.title, on, p.togetherPlan?.ownerName ?? `${owner.name}님`))
      },
      onTold: (s: Signal) => {
        setMarks((m) => ({ ...m, told: { signalId: s.id, at: Date.now() }, signals: [...m.signals, Date.now()] }))
        void send({ id: uid(), from: p.viewer, kind: 'signal', signalId: s.id }, `${owner.name}님에게 “${s.text}” 보냈어요`)
      },
      onWeekly: (day: WeeklyDay) => {
        try {
          const origin = weeklyLinkOrigin(window.location.origin, window.location.pathname)
          downloadText('dulset-weekly.ics', weeklyLinkIcs(day, today, { origin }))
          toast.show('캘린더 파일을 받았어요. 열어서 캘린더에 추가해 주세요')
        } catch {
          toast.show('이 브라우저에서는 파일을 받을 수 없어요')
        }
      },
    }
  }

  // The first-run card goes away: start his page from its top (the card was most of the first screen).
  const closeIntro = () => {
    device.close('intro')
    window.scrollTo({ top: 0 })
  }
  const onSetup = (p: PartnerPage, fields: NonNullable<ReturnType<typeof setupFields>>) => {
    closeIntro()
    void send({ id: uid(), from: p.viewer, kind: 'setup', ...fields }, `내 화면을 정했어요. ${ownerOf(p).name}님 폰이 열리면 반영돼요`)
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.show('주소를 복사했어요. 사파리나 크롬에 붙여 넣어 주세요')
    } catch {
      toast.show('주소창을 길게 눌러 복사해 주세요')
    }
  }

  const outsideHint =
    where?.inApp && !device.seen.outside ? (
      <LinkOutsideHint inApp={where.inApp} onCopy={() => void copyAddress()} onClose={() => device.close('outside')} />
    ) : null
  const installCard =
    where && !where.inApp && !where.standalone && !device.seen.install ? (
      <LinkInstallCard platform={where.platform} onClose={() => device.close('install')} />
    ) : null

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <header className="pt-safe sticky top-0 z-30 bg-bg/[.92] backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <span className="text-[20px] font-extrabold tracking-tight text-ink">둘셋</span>
          <span className="truncate text-[11px] font-medium text-ink-3">설치 없이 보는 화면</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 pt-4">
        {view.kind === 'snapshot' && view.offline ? (
          <div role="status" data-offline-line className="mb-3 flex items-center gap-3 rounded-2xl border border-warn/25 bg-warn-soft py-2 pl-3.5 pr-2">
            <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45] text-ink-2">
              <b className="font-bold text-ink">{OFFLINE_LINE.title}</b> · {OFFLINE_LINE.body}
            </span>
            {token ? (
              <button
                type="button"
                onClick={() => void fetchNow(token)}
                className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-[13px] font-bold text-brand-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                다시 시도
              </button>
            ) : null}
          </div>
        ) : null}
        {view.kind === 'loading' ? (
          <div className="flex min-h-[50vh] items-center justify-center text-ink-3" aria-busy="true">
            <span className="animate-pulse text-sm">불러오는 중…</span>
          </div>
        ) : view.kind === 'notice' ? (
          <>
            {outsideHint ? <div className="mb-4">{outsideHint}</div> : null}
            <LinkNotice
              kind={view.notice}
              ownerName={view.ownerName}
              onRetry={view.notice === 'offline' && token ? () => void fetchNow(token) : undefined}
            />
          </>
        ) : page ? (
          <LinkBody
            page={page}
            today={today}
            marks={marks}
            actions={actionsFor(page)}
            top={
              outsideHint || (!device.seen.intro && page.stage === 'preparing' && !page.moment?.support) ? (
                <>
                  {outsideHint}
                  {!device.seen.intro && page.stage === 'preparing' && !page.moment?.support ? (
                    <LinkIntro
                      myName={viewerOf(page).name}
                      ownerName={ownerOf(page).name}
                      onSetup={(fields) => onSetup(page, fields)}
                      onLater={closeIntro}
                    />
                  ) : null}
                </>
              ) : null
            }
            bottom={installCard}
            footer={
              <footer className="mt-8 space-y-1.5 px-1 text-center text-[11.5px] leading-relaxed text-ink-3">
                <p>설치 없이 보는 화면이에요</p>
                <p>
                  {ownerOf(page).name}님이 보낸 링크로만 열려요 ·{' '}
                  {view.fromCache ? '마지막으로 받은 화면이에요' : `${clockKo(view.fetchedAt)} 기준`}
                </p>
              </footer>
            }
          />
        ) : snapshot ? (
          <WaitingView
            snapshot={snapshot}
            marks={marks}
            top={outsideHint}
            onSignal={(s) => {
              setMarks((m) => ({ ...m, signals: [...m.signals, Date.now()] }))
              void send({ id: uid(), from: snapshot.viewer, kind: 'signal', signalId: s.id }, `${ownerOf(snapshot).name}님에게 “${s.text}” 보냈어요`)
            }}
            onCheer={() => {
              setMarks((m) => ({ ...m, cheers: [...m.cheers, Date.now()] }))
              void send({ id: uid(), from: snapshot.viewer, kind: 'cheer' }, `${ownerOf(snapshot).name}님에게 응원을 보냈어요`)
            }}
          />
        ) : null}
      </main>
    </div>
  )
}

/**
 * After the snapshot's last day: the calm '새 화면은 곧 채워져요' and what still
 * works without a page for today — 우리 신호 and 응원 (they wait for her phone
 * like any event and are judged on the day they arrived). Nothing dated: no
 * card, no band, no checks, no task.
 */
function WaitingView({
  snapshot,
  marks,
  top,
  onSignal,
  onCheer,
}: {
  snapshot: PartnerSnapshot
  marks: LocalMarks
  top?: React.ReactNode
  onSignal: (s: Signal) => void
  onCheer: () => void
}) {
  const owner = ownerOf(snapshot)
  const copy = noticeCopy('stale', owner.name)
  const left = Math.max(0, SIGNALS_PER_DAY - marks.signals.length)
  const cheersLeft = Math.max(0, CHEERS_PER_DAY - marks.cheers.length)
  return (
    <section aria-label={copy.title}>
      {top ? <div className="mb-4">{top}</div> : null}
      <Polaroid
        decorated={false}
        quiet
        caption={<span className="min-w-0 truncate text-[12.5px] font-medium text-ink-3">{owner.name}님의 둘셋에서 왔어요</span>}
      >
        <CoverArt tod={timeOfDay(new Date().getHours())} quiet className="absolute inset-0" />
      </Polaroid>
      <div className="mt-5 px-1 text-center">
        <h1 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink">{copy.title}</h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-2">{copy.body}</p>
        <div className="mt-4">
          <Pill tone="outline" onClick={onCheer} disabled={cheersLeft <= 0} ariaLabel={`${owner.name}님에게 응원 보내기`}>
            <span aria-hidden>👏</span> 응원 보내기
          </Pill>
        </div>
      </div>
      <Heading sub="말로 꺼내기 어려운 건 버튼 하나로">우리 신호</Heading>
      <LinkSignals snapshot={snapshot} left={left} onSend={onSignal} />
    </section>
  )
}
