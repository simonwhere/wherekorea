'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import Onboarding from '@/components/Onboarding'
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
import { useNotificationEngine } from '@/lib/useNotificationEngine'
import { useApp, useStore } from '@/lib/store'
import type { Stage } from '@/lib/types'

export type TabKey = 'today' | 'cycle' | 'pregnancy' | 'baby' | 'plan' | 'date' | 'diary' | 'settings'

interface TabDef {
  key: TabKey
  label: string
  icon: string
}

// Settings lives behind the header ⚙️ so the bottom bar keeps five everyday tabs.
// 'diary' is the 우리 tab (story · album · our days); the key stays for old links.
const TAB_SETS: Record<Stage, TabDef[]> = {
  preparing: [
    { key: 'today', label: '오늘', icon: '☀️' },
    { key: 'cycle', label: '달력', icon: '📅' },
    { key: 'plan', label: '챙길 것', icon: '✅' },
    { key: 'date', label: '데이트', icon: '💞' },
    { key: 'diary', label: '우리', icon: '💑' },
  ],
  pregnant: [
    { key: 'today', label: '오늘', icon: '☀️' },
    { key: 'pregnancy', label: '임신', icon: '🤰' },
    { key: 'plan', label: '챙길 것', icon: '✅' },
    { key: 'date', label: '데이트', icon: '💞' },
    { key: 'diary', label: '우리', icon: '💑' },
  ],
  parenting: [
    { key: 'today', label: '오늘', icon: '☀️' },
    { key: 'baby', label: '아기', icon: '👶' },
    { key: 'diary', label: '우리', icon: '💑' },
    { key: 'plan', label: '챙길 것', icon: '✅' },
    { key: 'date', label: '둘만의', icon: '💞' },
  ],
}

/** Routes reachable without a bottom-bar button. */
const EXTRA_ROUTES: TabKey[] = ['settings']

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

  useNotificationEngine()

  // Hash routing (#today, #cycle, …) keeps the static export portable and the back button useful.
  useEffect(() => {
    const sync = () => {
      const h = readHash()
      if (h === 'days') setTab('diary') // 우리 → 기념일
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
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-bg/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tracking-tight text-brand">둘셋</span>
              <span className="truncate text-[11px] font-medium text-ink-3">{STAGE_LABEL[state.stage]}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewer(partner.id)}
            className="relative flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-xs font-medium text-ink-2 before:absolute before:-inset-y-[6px] before:inset-x-0 before:content-[''] hover:bg-surface-2"
            title="프로토타입: 한 기기에서 두 사람의 화면을 바꿔 볼 수 있어요"
          >
            <Avatar member={me} size="sm" />
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
            <span aria-hidden className="text-lg">🔔</span>
            {unread > 0 ? (
              <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white">
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
            <span aria-hidden className="text-lg">⚙️</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{content}</main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/95 backdrop-blur"
        aria-label="주요 메뉴"
      >
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const active = t.key === tab
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => go(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                    active ? 'text-brand' : 'text-ink-3',
                  )}
                >
                  <span aria-hidden className={cx('text-lg transition-transform', active && 'scale-110')}>
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}
