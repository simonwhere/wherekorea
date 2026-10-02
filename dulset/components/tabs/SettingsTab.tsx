'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AboutSection from '@/components/settings/AboutSection'
import AlertsSection from '@/components/settings/AlertsSection'
import CoupleDaysSection from '@/components/settings/CoupleDaysSection'
import CycleSection from '@/components/settings/CycleSection'
import DataSection from '@/components/settings/DataSection'
import HomeSection from '@/components/settings/HomeSection'
import LinkSection from '@/components/settings/LinkSection'
import MembersSection from '@/components/settings/MembersSection'
import ProgramsSection from '@/components/settings/ProgramsSection'
import SharingSection from '@/components/settings/SharingSection'
import StageSection from '@/components/settings/StageSection'
import { SETTINGS_TOC_LABEL, isSettingsAnchor, type SettingsAnchor } from '@/components/settings/anchors'
import { SectionsContext, type SectionsApi } from '@/components/settings/bits'
import { cx } from '@/components/ui'
import { useApp } from '@/lib/store'

/** The section a deep link (#share, #alerts, #data …) asks for, if any. */
function anchorFromHash(): SettingsAnchor | null {
  const h = window.location.hash.replace(/^#/, '')
  return isSettingsAnchor(h) ? h : null
}

/** Opened from the header ⚙️ (not a bottom tab), so it carries its own page heading. */
export default function SettingsTab() {
  const { state } = useApp()
  const preparing = state.stage === 'preparing'

  // Sections in screen order (the ones people reach for most sit near the top — review D-4).
  const sections = useMemo<SettingsAnchor[]>(
    () =>
      [
        'members',
        preparing ? 'share' : null,
        'alerts',
        'home',
        'ourdays',
        preparing ? 'cycle-numbers' : null,
        'stage',
        'link',
        'programs',
        'data',
        'about',
      ].filter((s): s is SettingsAnchor => s !== null),
    [preparing],
  )

  // Everything but the first section opens folded to its heading; a deep link
  // or a chip opens that one. (Opening is additive: what you unfolded stays.)
  const [open, setOpen] = useState<ReadonlySet<SettingsAnchor>>(() => new Set<SettingsAnchor>(['members']))
  const [scrollTo, setScrollTo] = useState<SettingsAnchor | null>(null)

  const reveal = useCallback((id: SettingsAnchor) => {
    setOpen((prev) => (prev.has(id) ? prev : new Set([...prev, id])))
    setScrollTo(id)
  }, [])

  useEffect(() => {
    const onHash = () => {
      const a = anchorFromHash()
      if (a) reveal(a)
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [reveal])

  // After the section has rendered open (a missing section, e.g. 공유 범위 outside preparing, leaves the screen put).
  useEffect(() => {
    if (!scrollTo) return
    const el = document.getElementById(scrollTo)
    window.requestAnimationFrame(() => el?.scrollIntoView({ block: 'start' }))
    setScrollTo(null)
  }, [scrollTo])

  const api = useMemo<SectionsApi>(
    () => ({
      isOpen: (id) => open.has(id),
      toggle: (id) =>
        setOpen((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        }),
    }),
    [open],
  )

  // The chip row sticks right under the top bar, whatever rows the bar has (the
  // ?today= banner, the save-failed line, the safe area): measure it.
  const [stickyTop, setStickyTop] = useState(56)
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const measure = () => setStickyTop(Math.round(header.getBoundingClientRect().height))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  const jump = (id: SettingsAnchor) => {
    // Keep the address in step (a reload lands here) without a history entry per tap.
    window.history.replaceState(window.history.state, '', `#${id}`)
    reveal(id)
  }

  return (
    <SectionsContext.Provider value={api}>
      <header className="mb-3 px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink outline-none">설정</h1>
        <p className="mt-1 text-sm text-ink-2">
          {preparing ? '우리 둘 정보, 공유 범위, 내 알림, 첫 화면, 기록 백업을 여기서 관리해요' : '우리 둘 정보, 내 알림, 첫 화면, 기록 백업을 여기서 관리해요'}
        </p>
      </header>
      {/* Table of contents: one chip per section (sticky under the top bar while scrolling). */}
      <nav aria-label="설정 목차" style={{ top: stickyTop }} className="sticky z-20 -mx-4 mb-4 bg-bg/95 px-4 py-2 backdrop-blur">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max items-center gap-1.5">
            {sections.map((id) => (
              <li key={id}>
                {/* A jump link, not a toggle (so no aria-pressed): the unfolded sections are tinted. */}
                <button
                  type="button"
                  onClick={() => jump(id)}
                  className={cx(
                    'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    open.has(id) ? 'border-brand/40 bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                  )}
                >
                  {SETTINGS_TOC_LABEL[id]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div>
        <MembersSection />
        {/* What the partner sees of the cycle — only while preparing, where it's
            recorded. Near the top: the 주기 tab's 바꾸기 links here (#share). */}
        {preparing ? <SharingSection /> : null}
        <AlertsSection />
        <HomeSection />
        <CoupleDaysSection />
        {/* Cycle numbers only drive predictions while preparing. */}
        {preparing ? <CycleSection /> : null}
        <StageSection />
        <LinkSection />
        <ProgramsSection />
        <DataSection />
        <AboutSection />
      </div>
    </SectionsContext.Provider>
  )
}
