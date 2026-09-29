'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import LogSheet from '@/components/log/LogSheet'
import Onboarding from '@/components/Onboarding'
import { isSettingsAnchor } from '@/components/settings/anchors'
import NotificationsSheet from '@/components/NotificationsSheet'
import BabyTab from '@/components/tabs/BabyTab'
import CycleTab from '@/components/tabs/CycleTab'
import DateTab from '@/components/tabs/DateTab'
import PlanTab from '@/components/tabs/PlanTab'
import PregnancyTab from '@/components/tabs/PregnancyTab'
import SettingsTab from '@/components/tabs/SettingsTab'
import TodayTab from '@/components/tabs/TodayTab'
import UsTab from '@/components/tabs/UsTab'
import { Avatar, ToastProvider, cx, focusMainHeading } from '@/components/ui'
import { Icon, isIconName, type IconName } from '@/components/ui/icons'
import { useNotificationEngine } from '@/lib/useNotificationEngine'
import { OPEN_LOG_EVENT, openLog, type LogRequest } from '@/lib/logLauncher'
import { useApp, useStore } from '@/lib/store'
import type { Stage } from '@/lib/types'

export type TabKey = 'today' | 'cycle' | 'pregnancy' | 'baby' | 'plan' | 'date' | 'diary' | 'settings'

interface TabDef {
  key: TabKey
  label: string
  /** A line icon, or an emoji for the stage tabs that have no line icon yet. */
  icon: IconName | '🤰' | '👶'
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
    { key: 'pregnancy', label: '임신', icon: '🤰' },
    { key: 'plan', label: '챙길 것', icon: 'list' },
    { key: 'diary', label: '우리', icon: 'heart' },
  ],
  parenting: [
    { key: 'today', label: '오늘', icon: 'home' },
    { key: 'baby', label: '아기', icon: '👶' },
    { key: 'diary', label: '우리', icon: 'heart' },
    { key: 'plan', label: '챙길 것', icon: 'list' },
  ],
}

/** Where the center "+ 기록" button sits (after this many tabs), per stage. */
const LOG_BUTTON_AFTER: Partial<Record<Stage, number>> = { preparing: 2 }

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

export default function AppShell() {
  const { hydrated, state } = useStore()
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-3" aria-busy="true">
        <span className="animate-pulse text-sm">불러오는 중…</span>
      </div>
    )
  }
  // A new state (restore, the other tab's change) retries after an error.
  if (!state || !state.onboarded)
    return (
      <AppErrorBoundary resetKey={state}>
        <Onboarding />
      </AppErrorBoundary>
    )
  return (
    <ToastProvider>
      <AppErrorBoundary resetKey={state}>
        <MainApp />
      </AppErrorBoundary>
    </ToastProvider>
  )
}

function MainApp() {
  const { state, me, partner, setViewer } = useApp()
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
  const logAfter = LOG_BUTTON_AFTER[state.stage]
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

  // Hash routing (#today, #cycle, …) keeps the static export portable and the back button useful.
  useEffect(() => {
    const sync = () => {
      const h = readHash()
      if (h === 'days') setTab('diary') // 우리 → 기념일
      else if (isSettingsAnchor(h)) setTab('settings') // 설정 → 공유 범위 / 내 알림 / 데이터
      else if (tabs.some((t) => t.key === h) || EXTRA_ROUTES.includes(h as TabKey)) setTab(h as TabKey)
      else setTab('today')
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [tabs])

  // After a tab change that dropped focus (e.g. a stage change routed here from
  // a sheet), start keyboard / screen-reader users at the new tab's heading.
  const firstTab = useRef(true)
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false
      return
    }
    const a = document.activeElement
    if (!a || a === document.body) focusMainHeading()
  }, [tab])

  const go = (key: TabKey) => {
    if (readHash() !== key) window.location.hash = key
    setTab(key)
    window.scrollTo({ top: 0 })
  }

  const unread = useMemo(
    () => state.notifications.filter((n) => n.to === me.id && !n.read && !n.dismissed).length,
    [state.notifications, me.id],
  )

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
              {tab === 'today' ? null : (
                <span className="truncate text-[11px] font-medium text-ink-3">{STAGE_LABEL[state.stage]}</span>
              )}
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
            <span aria-hidden className="text-ink-3">⇄</span>
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
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{content}</main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/95 backdrop-blur"
        aria-label="주요 메뉴"
      >
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${navCount}, minmax(0, 1fr))` }}>
          {tabs.map((t, i) => {
            const active = t.key === tab
            return (
              <Fragment key={t.key}>
                {logAfter === i ? <LogButton /> : null}
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
                    {isIconName(t.icon) ? (
                      <Icon name={t.icon} className="h-6 w-6" strokeWidth={active ? 2 : 1.7} />
                    ) : (
                      <span aria-hidden className="flex h-6 items-center text-[20px] leading-none">
                        {t.icon}
                      </span>
                    )}
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
    </div>
  )
}

/** Center "+ 기록" action in the bottom bar (opens the one log sheet). */
function LogButton() {
  return (
    <li className="flex items-center justify-center">
      <button
        type="button"
        onClick={() => openLog()}
        aria-label="기록하기"
        className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_18px_-6px_rgb(var(--brand)/.5)] ring-[5px] ring-bg hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:shadow-none"
      >
        <Icon name="plus" className="h-[26px] w-[26px]" strokeWidth={2.2} />
      </button>
    </li>
  )
}
