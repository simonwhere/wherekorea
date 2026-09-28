'use client'

// 오늘 — the home screen both partners open every day.
//
// Preparing (the core stage): three blocks and a folded "더 보기"
//   1. 주기 띠 + today's moment (one title, one sentence, one action)
//   2. 오늘 할 일 — my checks, a weekly check-in when due, today's/tomorrow's appointment
//   3. 우리 한 줄 — the partner's month task, the other's progress, a signal to answer
// Pregnant / parenting keep their existing home.

import { useMemo } from 'react'
import type { TabKey } from '@/components/AppShell'
import { SectionTitle } from '@/components/ui'
import { monthlyTask } from '@/lib/logic/partnerTrack'
import { canLogCycle } from '@/lib/logic/prefs'
import { ttcMoment } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import AnniversaryBanner from '@/components/today/AnniversaryBanner'
import { CoupleStreak, MyChecks, PartnerChecks } from '@/components/today/CheckCards'
import CycleBlock from '@/components/today/CycleBlock'
import { DateCard, DiaryPromptCard } from '@/components/today/ExtraCards'
import Greeting from '@/components/today/Greeting'
import MoreSection from '@/components/today/MoreSection'
import { PlanFocusCard, UpcomingCard } from '@/components/today/PlanCards'
import StageHero from '@/components/today/StageHero'
import TodayTasks from '@/components/today/TodayTasks'
import UsLine from '@/components/today/UsLine'
import SignalsCard from '@/components/signals/SignalsCard'

type Nav = (tab: TabKey) => void

export default function TodayTab({ onNavigate }: { onNavigate: Nav }) {
  const { state } = useApp()
  return state.stage === 'preparing' ? <PreparingHome onNavigate={onNavigate} /> : <StageHome onNavigate={onNavigate} />
}

function PreparingHome({ onNavigate }: { onNavigate: Nav }) {
  const { state, today, me } = useApp()
  const moment = ttcMoment(state, today, me.id)
  // The partner's one meaningful task this month (not the cycle owner's).
  // Not right after a loss — that time is for each other, not for tasks.
  const showTask = !canLogCycle(state, me.id) && moment?.kind !== 'after-loss'
  const task = useMemo(() => (showTask ? monthlyTask(state, today, me.id) : undefined), [showTask, state, today, me.id])
  // Featured inside the moment card when that card has nothing else to say.
  const taskInCard = !!moment?.monthlyTask && !!task

  return (
    <div>
      <Greeting onNavigate={onNavigate} showTogether={false} />
      <div className="mt-3 space-y-4">
        {moment ? <CycleBlock moment={moment} task={task} onNavigate={onNavigate} /> : null}
        <TodayTasks onNavigate={onNavigate} />
        <UsLine task={taskInCard ? undefined : task} onNavigate={onNavigate} />
        <MoreSection moment={moment} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function StageHome({ onNavigate }: { onNavigate: Nav }) {
  return (
    <div>
      <Greeting onNavigate={onNavigate} />

      <div className="mt-3 space-y-3">
        <AnniversaryBanner onNavigate={onNavigate} />
        <StageHero onNavigate={onNavigate} />
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

      <SectionTitle>우리 둘의 기록</SectionTitle>
      <div className="space-y-3">
        <DiaryPromptCard onNavigate={onNavigate} />
        <DateCard onNavigate={onNavigate} />
      </div>
    </div>
  )
}
