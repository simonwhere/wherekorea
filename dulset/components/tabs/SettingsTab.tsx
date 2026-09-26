'use client'

import AboutSection from '@/components/settings/AboutSection'
import AlertsSection from '@/components/settings/AlertsSection'
import CycleSection from '@/components/settings/CycleSection'
import DataSection from '@/components/settings/DataSection'
import LinkSection from '@/components/settings/LinkSection'
import MembersSection from '@/components/settings/MembersSection'
import ProgramsSection from '@/components/settings/ProgramsSection'
import StageSection from '@/components/settings/StageSection'
import { useApp } from '@/lib/store'

export default function SettingsTab() {
  const { state } = useApp()
  return (
    <>
      <h1 className="sr-only">설정</h1>
      <div>
        <MembersSection />
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
