'use client'

// 오늘 — the home screen both partners open every day.
//
// Preparing (the core stage): three blocks and a folded "더 보기"
//   1. 주기 띠 + today's moment (one title, one sentence, one action)
//   2. 오늘 할 일 — my checks, a weekly check-in when due, today's/tomorrow's appointment
//   3. 우리 한 줄 — the partner's month task, the other's progress, a signal to answer
// The partner's "이번 달 할 일" goes first on the page when it's urgent (`top`:
// a live 검사·청구 deadline, or the owner is 35+), else inside the moment card
// when that has nothing else to say, else in 우리 한 줄.
// Pregnant / parenting keep their existing home (+ 기록 지키기 at the bottom).

import { useMemo } from 'react'
import type { TabKey } from '@/components/AppShell'
import { SectionTitle } from '@/components/ui'
import { monthlyTask } from '@/lib/logic/partnerTrack'
import { canLogCycle } from '@/lib/logic/prefs'
import { ttcMoment } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import InstallBackupCard from '@/components/system/InstallBackupCard'
import AnniversaryBanner from '@/components/today/AnniversaryBanner'
import { CoupleStreak, MyChecks, PartnerChecks } from '@/components/today/CheckCards'
import CycleBlock from '@/components/today/CycleBlock'
import { DateCard, DiaryPromptCard } from '@/components/today/ExtraCards'
import Greeting from '@/components/today/Greeting'
import MoreSection from '@/components/today/MoreSection'
import { MonthlyTaskCard, useMonthlyTaskDone } from '@/components/today/MonthlyTask'
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
  const { done, toast } = useMonthlyTaskDone()
  // Urgent: the partner's first line. Otherwise featured inside the moment card
  // when that card has nothing else to say, else in 우리 한 줄.
  const where = !task ? null : task.top ? 'top' : moment?.monthlyTask ? 'card' : 'us'

  return (
    <div>
      <Greeting onNavigate={onNavigate} showTogether={false} />
      <div className="mt-3 space-y-4">
        {task && where === 'top' ? <MonthlyTaskCard task={task} onDone={done} onNavigate={onNavigate} /> : null}
        {moment ? (
          <CycleBlock moment={moment} task={where === 'card' ? task : undefined} onTaskDone={done} onNavigate={onNavigate} />
        ) : null}
        <TodayTasks onNavigate={onNavigate} />
        <UsLine task={where === 'us' ? task : undefined} onTaskDone={done} onNavigate={onNavigate} />
        <MoreSection moment={moment} onNavigate={onNavigate} />
      </div>
      {toast}
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

      {/* 기록 지키기: storage.persist() + install / weekly backup nudge, for every stage. */}
      <div className="mt-6">
        <InstallBackupCard />
      </div>
    </div>
  )
}
