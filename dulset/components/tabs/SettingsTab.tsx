'use client'

import { useEffect } from 'react'
import AboutSection from '@/components/settings/AboutSection'
import AlertsSection from '@/components/settings/AlertsSection'
import CoupleDaysSection from '@/components/settings/CoupleDaysSection'
import CycleSection from '@/components/settings/CycleSection'
import DataSection from '@/components/settings/DataSection'
import LinkSection from '@/components/settings/LinkSection'
import MembersSection from '@/components/settings/MembersSection'
import ProgramsSection from '@/components/settings/ProgramsSection'
import SharingSection from '@/components/settings/SharingSection'
import StageSection from '@/components/settings/StageSection'
import { isSettingsAnchor } from '@/components/settings/anchors'
import { useApp } from '@/lib/store'

/** Bring the section a deep link (#share, #alerts, #data) asks for into view. */
function scrollToAnchor() {
  const h = window.location.hash.replace(/^#/, '')
  if (!isSettingsAnchor(h)) return
  // After this render has laid the sections out; a missing section (e.g. 공유 범위
  // outside preparing) leaves the screen at its top.
  window.requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView({ block: 'start' }))
}

/** Opened from the header ⚙️ (not a bottom tab), so it carries its own page heading. */
export default function SettingsTab() {
  const { state } = useApp()
  useEffect(() => {
    scrollToAnchor()
    window.addEventListener('hashchange', scrollToAnchor)
    return () => window.removeEventListener('hashchange', scrollToAnchor)
  }, [])
  return (
    <>
      <header className="mb-5 px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink outline-none">설정</h1>
        <p className="mt-1 text-sm text-ink-2">
          {state.stage === 'preparing'
            ? '우리 둘 정보, 공유 범위, 내 알림, 기록 백업을 여기서 관리해요'
            : '우리 둘 정보, 내 알림, 기록 백업을 여기서 관리해요'}
        </p>
      </header>
      <div>
        <MembersSection />
        {/* What the partner sees of the cycle — only while preparing, where it's
            recorded. Near the top: the 주기 tab's 바꾸기 links here (#share). */}
        {state.stage === 'preparing' ? <SharingSection /> : null}
        <CoupleDaysSection />
        <LinkSection />
        <StageSection />
        {/* Cycle numbers only drive predictions while preparing. */}
        {state.stage === 'preparing' ? <CycleSection /> : null}
        <AlertsSection />
        <ProgramsSection />
        <DataSection />
        <AboutSection />
      </div>
    </>
  )
}
