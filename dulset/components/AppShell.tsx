'use client'

import dynamic from 'next/dynamic'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import CoverAsk from '@/components/cover/CoverAsk'
import LHHowTo from '@/components/log/LHHowTo'
import LogSheet from '@/components/log/LogSheet'
import PartnerFirstRunSheet from '@/components/onboarding/PartnerFirstRunSheet'
import { goToSettings, isSettingsAnchor } from '@/components/settings/anchors'
import NotificationsSheet from '@/components/NotificationsSheet'
import CycleTab from '@/components/tabs/CycleTab'
import PlanTab from '@/components/tabs/PlanTab'
import TodayTab from '@/components/tabs/TodayTab'
import UsTab from '@/components/tabs/UsTab'
import { useFirstPeriodMarker } from '@/components/system/BackupBanner'
import { Avatar, ToastProvider, cx, focusMainHeading } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { formatKo, isISODate } from '@/lib/dates'
import { canLogCycle } from '@/lib/logic/prefs'
import { bellUnread } from '@/lib/logic/usView'
import { useLinkSync } from '@/lib/useLinkSync'
import { useNotificationEngine } from '@/lib/useNotificationEngine'
import { OPEN_LOG_EVENT, openLog, type LogRequest } from '@/lib/logLauncher'
import { useApp, useStore } from '@/lib/store'
import type { ISODate, Stage } from '@/lib/types'

export type TabKey = 'today' | 'cycle' | 'pregnancy' | 'baby' | 'plan' | 'date' | 'diary' | 'settings'

/**
 * Screens that most sessions never open load as their own chunks (local files
 * under _next/static, so nothing needs the network): the other stages' tabs,
 * #date, 설정 and the first run (which carries the demo couple's data). The
 * preparing couple's daily tabs stay in the first load for instant switching.
 */
function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-ink-3" aria-busy="true">
      <span className="animate-pulse text-sm">불러오는 중…</span>
    </div>
  )
}
/** Tab placeholders are blank (a local chunk arrives within a frame or two; a spinner would only flash). */
function TabLoading() {
  return <div className="min-h-[50vh]" aria-busy="true" />
}
const Onboarding = dynamic(() => import('@/components/Onboarding'), { ssr: false, loading: Loading })
const PregnancyTab = dynamic(() => import('@/components/tabs/PregnancyTab'), { ssr: false, loading: TabLoading })
const BabyTab = dynamic(() => import('@/components/tabs/BabyTab'), { ssr: false, loading: TabLoading })
const DateTab = dynamic(() => import('@/components/tabs/DateTab'), { ssr: false, loading: TabLoading })
const SettingsTab = dynamic(() => import('@/components/tabs/SettingsTab'), { ssr: false, loading: TabLoading })

interface TabDef {
  key: TabKey
  label: string
  icon: IconName
}

// Settings lives behind the header gear. Preparing is the core stage: its bar
// has a center "+ 기록" action (not a tab). 데이트 moved into the 우리의 주간 card
// and stays reachable at #date. 'diary' is the 우리 tab (key kept for old links).
const TAB_SETS: Record<Stage, TabDef[]> = {
  preparing: [
    { key: 'today', label: '오늘', icon: 'home' },
    { key: 'cycle', label: '주기', icon: 'cycle' },
    { key: 'plan', label: '챙길 것', icon: 'list' },
    { key: 'diary', label: '우리', icon: 'heart' },
  ],
  pregnant: [
    { key: 'today', label: '오늘', icon: 'home' },
    { key: 'pregnancy', label: '임신', icon: 'bump' },
    { key: 'plan', label: '챙길 것', icon: 'list' },
    { key: 'diary', label: '우리', icon: 'heart' },
  ],
  parenting: [
    { key: 'today', label: '오늘', icon: 'home' },
    { key: 'baby', label: '아기', icon: 'baby' },
    { key: 'diary', label: '우리', icon: 'heart' },
    { key: 'plan', label: '챙길 것', icon: 'list' },
  ],
}

/** Where the center "+ 기록" button sits (after this many tabs), per stage. */
const LOG_BUTTON_AFTER: Partial<Record<Stage, number>> = { preparing: 2 }
/**
 * While pregnant the button is the 함께하는 사람's only: his '했어요' sheet (this
 * week's one thing, today's checks, signals — the same loop as preparing,
 * founder request 2026-10-09). Her bar stays four tabs (her '+ 기록' would be a
 * memo alone then; the 임신 tab has her own records).
 */
const PARTNER_LOG_BUTTON_AFTER: Partial<Record<Stage, number>> = { pregnant: 2 }

/** Routes reachable without a bottom-bar button. */
const EXTRA_ROUTES: TabKey[] = ['settings', 'date']

export const STAGE_LABEL: Record<Stage, string> = {
  preparing: '임신 준비 중',
  pregnant: '임신 중',
  parenting: '육아 중',
}

function readHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')
}

/** The `?today=YYYY-MM-DD` pin (lib/store reads the same parameter), or null. */
function readPinnedToday(): ISODate | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('today')
  return isISODate(v) ? v : null
}

/** Drop the `today` parameter and reload, so the app follows the real date again. */
function unpinToday(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('today')
  window.location.replace(url.toString())
}

/**
 * A thin line under the header while the date is pinned, so a demo link never
 * passes for real use without anyone noticing (review P-5). 해제 reloads on the real date.
 */
function PinnedTodayBanner() {
  const [pinned, setPinned] = useState<ISODate | null>(null)
  useEffect(() => setPinned(readPinnedToday()), [])
  if (!pinned) return null
  return (
    <p
      role="status"
      className="flex items-center justify-between gap-3 border-t border-line/70 bg-surface-2 px-4 py-1 text-[12px] leading-snug text-ink-2"
    >
      <span>데모: 오늘을 {formatKo(pinned, { weekday: false })}로 고정</span>
      <button
        type="button"
        onClick={unpinToday}
        // 44px tall (the line stays thin: the extra height hangs over the rows above and below).
        className="-my-[9px] h-11 shrink-0 rounded-full px-2 text-[12px] font-bold text-brand-ink underline underline-offset-2 hover:bg-bg/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        해제
      </button>
    </p>
  )
}

export default function AppShell() {
  const { hydrated, state } = useStore()
  if (!hydrated) return <Loading />
  // (The two branches are different trees, so a wipe or a first onboarding
  // remounts the boundary; a restore resets it from the recovery screen.)
  if (!state || !state.onboarded)
    return (
      <AppErrorBoundary>
        <Onboarding />
      </AppErrorBoundary>
    )
  return (
    <ToastProvider>
      <AppErrorBoundary>
        <MainApp />
      </AppErrorBoundary>
    </ToastProvider>
  )
}

function MainApp() {
  const app = useApp()
  const { state, me, partner, setViewer } = app
  const { saveFailed } = useStore()
  const tabs = TAB_SETS[state.stage]
  const [tab, setTab] = useState<TabKey>('today')
  const [notifOpen, setNotifOpen] = useState(false)
  const [logRequest, setLogRequest] = useState<LogRequest | null>(null)
  const closeLog = useCallback(() => setLogRequest(null), [])
  useEffect(() => {
    const onOpen = (e: Event) => setLogRequest((e as CustomEvent<LogRequest>).detail ?? {})
    window.addEventListener(OPEN_LOG_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_LOG_EVENT, onOpen)
  }, [])
  const logAfter = LOG_BUTTON_AFTER[state.stage] ?? (canLogCycle(state, me.id) ? undefined : PARTNER_LOG_BUTTON_AFTER[state.stage])
  const navCount = tabs.length + (logAfter === undefined ? 0 : 1)

  // The header hairline only shows once the page has scrolled.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useNotificationEngine()
  // 기록 지키기: remember the day the first period gets logged (BackupBanner shows it once).
  useFirstPeriodMarker()
  // The partner link (Next A ①): on the cycle owner's phone, publish the
  // snapshot after each change and pull the partner page's events (lib/useLinkSync).
  useLinkSync(app)

  // The lazily split tabs (DateTab, SettingsTab, the album, the stage tab, the
  // clinic summary) are fetched once the home is idle, so they open offline
  // too — there is no service worker, and a chunk that was never fetched
  // cannot load without the network. First Load JS stays as small as before.
  useEffect(() => {
    const warm = () => {
      void import('@/components/tabs/DateTab')
      void import('@/components/tabs/SettingsTab')
      void import('@/components/us/AlbumPanel')
      if (state.stage === 'pregnant') void import('@/components/tabs/PregnancyTab')
      if (state.stage === 'parenting') void import('@/components/tabs/BabyTab')
      if (state.stage === 'preparing') void import('@/components/clinic/ClinicSummarySheet')
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 4000 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(warm, 2500)
    return () => window.clearTimeout(t)
  }, [state.stage])

  // Hash routing (#today, #cycle, …) keeps the static export portable and the back button useful.
  useEffect(() => {
    const sync = () => {
      const h = readHash()
      if (h === 'days' || h === 'album')
        setTab('diary') // 우리 → 기념일 / 앨범
      else if (isSettingsAnchor(h))
        setTab('settings') // 설정 → 공유 범위 / 내 알림 / 데이터
      else if (tabs.some((t) => t.key === h) || EXTRA_ROUTES.includes(h as TabKey)) setTab(h as TabKey)
      else setTab('today')
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [tabs])

  // After a tab change that dropped focus (e.g. a stage change routed here from
  // a sheet), start keyboard / screen-reader users at the new tab's heading.
  // A lazily loaded tab has no heading for a frame or two, so keep trying briefly.
  const firstTab = useRef(true)
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false
      return
    }
    let tries = 0
    let raf = 0
    const tryFocus = () => {
      const a = document.activeElement
      if (a && a !== document.body) return
      if (focusMainHeading()) return
      if (++tries < 60) raf = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(raf)
  }, [tab])

  // CoverAsk reads its one-time flag when it mounts: a new mount whenever 오늘 opens again
  // (not on the first render — that mount already read it, and a remount would close its sheet).
  const [coverAskKey, setCoverAskKey] = useState(0)
  const lastTab = useRef<TabKey>(tab)
  useEffect(() => {
    if (tab === 'today' && lastTab.current !== 'today') setCoverAskKey((k) => k + 1)
    lastTab.current = tab
  }, [tab])

  const go = (key: TabKey) => {
    if (readHash() !== key) window.location.hash = key
    setTab(key)
    window.scrollTo({ top: 0 })
  }

  // The 🔔 badge counts the bell's own notes: while preparing, a reaction on my record waits in the
  // 기록장 instead (usView.isRecordBookNotice, N27).
  const unread = useMemo(() => bellUnread(state, me.id), [state, me.id])

  const content = (() => {
    switch (tab) {
      case 'cycle':
        return <CycleTab />
      case 'pregnancy':
        return <PregnancyTab />
      case 'baby':
        return <BabyTab />
      case 'date':
        return <DateTab />
      case 'plan':
        return <PlanTab />
      case 'diary':
        return <UsTab />
      case 'settings':
        return <SettingsTab />
      default:
        return <TodayTab onNavigate={go} />
    }
  })()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header
        className={cx(
          'pt-safe sticky top-0 z-30 border-b bg-bg/[.92] backdrop-blur transition-colors duration-150',
          scrolled ? 'border-line/70' : 'border-transparent',
        )}
      >
        <div className="flex h-14 items-center gap-1 pl-4 pr-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[20px] font-extrabold tracking-tight text-ink">둘셋</span>
              {/* The home's cover already says whose day it is; other tabs name the stage. */}
              {tab === 'today' ? null : <span className="truncate text-[11px] font-medium text-ink-3">{STAGE_LABEL[state.stage]}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewer(partner.id)}
            className="relative mr-0.5 flex h-9 items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-3 text-[13px] font-semibold text-ink-2 before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            title="프로토타입: 한 기기에서 두 사람의 화면을 바꿔 볼 수 있어요"
          >
            <span className="flex [&>span]:h-7 [&>span]:w-7 [&>span]:text-[15px]">
              <Avatar member={me} size="sm" />
            </span>
            <span className="max-w-[5.5rem] truncate">{me.name}</span>
            <span aria-hidden className="text-ink-3">
              ⇄
            </span>
            <span className="sr-only">{partner.name}의 화면으로 전환</span>
          </button>
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2"
            aria-label={unread ? `알림 ${unread}개` : '알림'}
          >
            <Icon name="bell" className="h-[22px] w-[22px] text-ink-2" />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 h-[17px] min-w-[17px] rounded-full bg-brand px-1 text-center text-[10px] font-extrabold leading-[17px] text-white ring-2 ring-bg">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => go('settings')}
            aria-current={tab === 'settings' ? 'page' : undefined}
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2',
              tab === 'settings' && 'bg-surface-2',
            )}
            aria-label="설정"
          >
            <Icon name="gear" className="h-[22px] w-[22px] text-ink-2" />
          </button>
        </div>
        {/* Storage full or blocked: say so until a save succeeds (nothing is lost while the tab stays open). */}
        {saveFailed ? (
          <p
            role="alert"
            className="flex items-center justify-between gap-3 border-t border-warn/30 bg-warn-soft px-4 py-2 text-[12.5px] leading-snug text-ink"
          >
            <span>지금 기록이 저장되지 않고 있어요</span>
            <button
              type="button"
              onClick={() => goToSettings('data')}
              className="-my-[7px] h-11 shrink-0 rounded-full px-2 text-[12.5px] font-bold text-brand-ink underline underline-offset-2 hover:bg-bg/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              백업 받기
            </button>
          </p>
        ) : null}
        <PinnedTodayBanner />
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{content}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/95 backdrop-blur" aria-label="주요 메뉴">
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${navCount}, minmax(0, 1fr))` }}>
          {tabs.map((t, i) => {
            const active = t.key === tab
            return (
              <Fragment key={t.key}>
                {logAfter === i ? <LogButton fromToday={tab === 'today'} /> : null}
                <li>
                  <button
                    type="button"
                    onClick={() => go(t.key)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative flex h-14 w-full flex-col items-center justify-center gap-[3px] pb-1 text-[11px] leading-[14px]',
                      active
                        ? 'font-extrabold text-ink after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-glow'
                        : 'font-semibold text-ink-3',
                    )}
                  >
                    <Icon name={t.icon} className="h-6 w-6" strokeWidth={active ? 2 : 1.7} />
                    {t.label}
                  </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
      </nav>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      <LogSheet request={logRequest} onClose={closeLog} />
      {/* '배란테스트기, 이렇게 해요' — opened with openLHHowTo() from the LH panel, the guide and the home card. */}
      <LHHowTo />
      {/* "민수님, 처음이죠?" — the joining member's own first run (N15); it decides by itself when to open. */}
      <PartnerFirstRunSheet />
      {/* '첫 화면에 우리 사진을 걸어 볼까요?' — once, after the partner's link went out (N27: the
          onboarding's ④ or 설정 › 연결). Remounted each time 오늘 opens, so a send from 설정 asks there. */}
      <CoverAsk key={coverAskKey} />
    </div>
  )
}

/**
 * Center "+ 기록" action in the bottom bar (opens the one log sheet). From the
 * home it says so, so the 되돌리기 toast moves up and never covers the moment
 * card's new buttons (알리기 · 차분히 알리기 · 병원 일정 넣기) — QF6.
 */
function LogButton({ fromToday }: { fromToday: boolean }) {
  return (
    <li className="flex items-center justify-center">
      <button
        type="button"
        onClick={() => openLog(fromToday ? { from: 'today' } : {})}
        aria-label="기록하기"
        className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_18px_-6px_rgb(var(--brand)/.5)] ring-[5px] ring-bg hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:shadow-none"
      >
        <Icon name="plus" className="h-[26px] w-[26px]" strokeWidth={2.2} />
      </button>
    </li>
  )
}
