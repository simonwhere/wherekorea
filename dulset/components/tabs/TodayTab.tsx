'use client'

// 오늘 — the home screen both partners open every day.

import type { TabKey } from '@/components/AppShell'
import { SectionTitle } from '@/components/ui'
import { fertilityStatus } from '@/lib/logic/cycle'
import { doctorAdvice, fertilityVoice, showDateTeaser } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import AnniversaryBanner from '@/components/today/AnniversaryBanner'
import { CoupleStreak, MyChecks, PartnerChecks } from '@/components/today/CheckCards'
import { DateCard, DiaryPromptCard, DoctorCard } from '@/components/today/ExtraCards'
import Greeting from '@/components/today/Greeting'
import HabitTimers from '@/components/today/HabitTimers'
import { PlanFocusCard, UpcomingCard } from '@/components/today/PlanCards'
import StageHero from '@/components/today/StageHero'
import SignalsCard from '@/components/signals/SignalsCard'
import { settingsFor } from '@/lib/logic/prefs'

export default function TodayTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { state, today, me, cycleOwner } = useApp()
  const preparing = state.stage === 'preparing'
  // Prominent date teaser only near "우리의 주간" and only if the viewer wants fertile hints.
  const teaser =
    preparing &&
    showDateTeaser(fertilityStatus(state, today), fertilityVoice(settingsFor(state.settings, me.id), me.id, me.id === cycleOwner.id))
  // The public-support tips that used to sit here now live in 챙길 것 (with their links).
  const doctor = preparing && doctorAdvice(state, today) !== null

  return (
    <div>
      <Greeting onNavigate={onNavigate} />

      <div className="mt-3 space-y-3">
        <AnniversaryBanner onNavigate={onNavigate} />
        <StageHero onNavigate={onNavigate} />
        {teaser ? <DateCard onNavigate={onNavigate} prominent /> : null}
        <UpcomingCard onNavigate={onNavigate} />
        <PlanFocusCard onNavigate={onNavigate} />
      </div>

      <SectionTitle sub="서로의 체크가 두 사람 화면에 함께 보여요">오늘의 체크</SectionTitle>
      <div className="space-y-3">
        <MyChecks />
        <PartnerChecks />
        <CoupleStreak />
      </div>

      <SignalsCard />

      {preparing ? <HabitTimers /> : null}

      <SectionTitle>우리 둘의 기록</SectionTitle>
      <div className="space-y-3">
        <DiaryPromptCard onNavigate={onNavigate} />
        {teaser ? null : <DateCard onNavigate={onNavigate} prominent={false} />}
      </div>

      {doctor ? (
        <>
          <SectionTitle>함께 알아 두면 좋아요</SectionTitle>
          <DoctorCard />
        </>
      ) : null}
    </div>
  )
}
