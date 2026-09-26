'use client'

import AboutSection from '@/components/settings/AboutSection'
import AlertsSection from '@/components/settings/AlertsSection'
import CoupleDaysSection from '@/components/settings/CoupleDaysSection'
import CycleSection from '@/components/settings/CycleSection'
import DataSection from '@/components/settings/DataSection'
import LinkSection from '@/components/settings/LinkSection'
import MembersSection from '@/components/settings/MembersSection'
import ProgramsSection from '@/components/settings/ProgramsSection'
import StageSection from '@/components/settings/StageSection'
import { useApp } from '@/lib/store'

/** Opened from the header ⚙️ (not a bottom tab), so it carries its own page heading. */
export default function SettingsTab() {
  const { state } = useApp()
  return (
    <>
      <header className="mb-5 px-1">
        <h1 className="text-xl font-extrabold tracking-tight text-ink outline-none">설정</h1>
        <p className="mt-1 text-sm text-ink-2">우리 둘 정보, 알림, 기록 백업을 여기서 관리해요</p>
      </header>
      <div>
        <MembersSection />
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
