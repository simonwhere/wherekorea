'use client'

// 오늘 — the home screen both partners open every day.

import type { TabKey } from '@/components/AppShell'
import { SectionTitle } from '@/components/ui'
import { fertilityStatus } from '@/lib/logic/cycle'
import { fertilityVoice, showDateTeaser } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { CoupleStreak, MyChecks, PartnerChecks } from '@/components/today/CheckCards'
import { DateCard, DiaryPromptCard, DoctorCard, SupportTips } from '@/components/today/ExtraCards'
import Greeting from '@/components/today/Greeting'
import HabitTimers from '@/components/today/HabitTimers'
import StageHero from '@/components/today/StageHero'

export default function TodayTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { state, today, me, cycleOwner } = useApp()
  const preparing = state.stage === 'preparing'
  // Prominent date teaser only near "우리의 주간" and only if the viewer wants fertile hints.
  const teaser =
    preparing &&
    showDateTeaser(fertilityStatus(state, today), fertilityVoice(state.settings, me.id, me.id === cycleOwner.id))

  return (
    <div>
      <Greeting />

      <div className="mt-3 space-y-3">
        <StageHero onNavigate={onNavigate} />
        {teaser ? <DateCard onNavigate={onNavigate} prominent /> : null}
      </div>

      <SectionTitle sub="서로의 체크가 두 사람 화면에 함께 보여요">오늘의 체크</SectionTitle>
      <div className="space-y-3">
        <MyChecks />
        <PartnerChecks />
        <CoupleStreak />
      </div>

      {preparing ? <HabitTimers /> : null}

      <SectionTitle>우리 둘의 기록</SectionTitle>
      <div className="space-y-3">
        <DiaryPromptCard onNavigate={onNavigate} />
        {teaser ? null : <DateCard onNavigate={onNavigate} prominent={false} />}
      </div>

      {preparing ? (
        <>
          <SectionTitle>함께 알아 두면 좋아요</SectionTitle>
          <div className="space-y-3">
            <DoctorCard />
            <SupportTips />
          </div>
        </>
      ) : null}
    </div>
  )
}
