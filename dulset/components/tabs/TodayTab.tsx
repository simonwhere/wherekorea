'use client'

// 오늘 — the home screen both partners open every day.
//
// Preparing (the core stage) opens with the couple's photo, then three blocks
// and a folded "더 보기":
//   0. 우리 표지 — date · 함께한 지 D+N, one line, the cover photo (never the cycle)
//   1. today's moment — ring / week row, one title, one sentence, one action
//   2. 오늘 할 일 — my checks, a weekly check-in when due, today's/tomorrow's appointment
//   3. 우리 한 줄 — the partner's month task, the other's progress, a signal to answer
//   + 기록 지키기 (BackupBanner): a compact line under ③ while the app isn't on
//     the home screen or the backup is over a week old, and on the first period's day
// The partner's "이번 달 할 일" goes right under the cover when it's urgent
// (`top`: a live 검사·청구 deadline, or the owner is 35+), else inside the
// moment card when that has nothing else to say, else in 우리 한 줄.
// The moment's title and action stay above the tab bar on a 375×667 phone
// (useFoldFit trims the photo a little when a moment runs long; a leading
// 이번 달 할 일 card folds to one row there — MonthlyTaskCard compactOnShort).
// Pregnant / parenting open with the same cover (the line over it is the
// greeting or the partner's doings — never the week count or anything about
// health, lib/logic/cover.heroLine), then their stage hero (+ 기록 지키기 at the bottom).

import { useMemo } from 'react'
import type { TabKey } from '@/components/AppShell'
import { SectionTitle } from '@/components/ui'
import { monthlyTask } from '@/lib/logic/partnerTrack'
import { canLogCycle } from '@/lib/logic/prefs'
import { ttcMoment } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import BackupBanner from '@/components/system/BackupBanner'
import InstallBackupCard from '@/components/system/InstallBackupCard'
import AnniversaryBanner from '@/components/today/AnniversaryBanner'
import { CoupleStreak, MyChecks, PartnerChecks } from '@/components/today/CheckCards'
import CoverHero from '@/components/today/CoverHero'
import CycleBlock from '@/components/today/CycleBlock'
import { DateCard, DiaryPromptCard } from '@/components/today/ExtraCards'
import MoreSection from '@/components/today/MoreSection'
import SetupCard from '@/components/today/SetupCard'
import { MonthlyTaskCard, useMonthlyTaskDone } from '@/components/today/MonthlyTask'
import { PlanFocusCard, UpcomingCard } from '@/components/today/PlanCards'
import StageHero from '@/components/today/StageHero'
import TodayTasks from '@/components/today/TodayTasks'
import UsLine from '@/components/today/UsLine'
import { useFoldFit } from '@/components/today/useFoldFit'
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
  // Urgent: the partner's first line — unless today's moment has an action of
  // its own (병원 일정 보기), which keeps the first screen; then right after it.
  // Otherwise featured inside the moment card when that card has nothing else
  // to say, else in 우리 한 줄.
  const where = !task ? null : task.top ? (moment?.primary ? 'after' : 'top') : moment?.monthlyTask ? 'card' : 'us'
  // The photo gives way (a little) when a long moment would push its action under the tab bar.
  const foldKey = moment
    ? `${moment.copy}|${moment.title}|${moment.body}|${moment.note}|${moment.todayLH}|${!!moment.askTell}|${!!moment.veiled}|${where}`
    : `none|${where}`
  const fitRef = useFoldFit(foldKey)

  return (
    <div
      ref={fitRef}
      className="[&_.cover-photo-h-quiet]:max-h-[var(--cover-fit,none)] [&_.cover-photo-h]:max-h-[var(--cover-fit,none)]"
    >
      <CoverHero onNavigate={onNavigate} />
      {/* Leading card: its [받았어요]/[신청했어요] row is what stays above the tab bar — and on a
          375×667 phone it folds to one row (title · due ›) so the moment's title stays there too. */}
      {task && where === 'top' ? <MonthlyTaskCard task={task} onDone={done} fold compactOnShort className="mt-[18px]" /> : null}
      {moment ? (
        <CycleBlock
          moment={moment}
          task={where === 'card' ? task : undefined}
          onTaskDone={done}
          onNavigate={onNavigate}
          className="mt-[18px] [@media(max-height:700px)]:mt-3.5"
        />
      ) : null}
      {task && where === 'after' ? <MonthlyTaskCard task={task} onDone={done} className="mt-3.5" /> : null}
      <TodayTasks onNavigate={onNavigate} className="mt-7" />
      <UsLine task={where === 'us' ? task : undefined} onTaskDone={done} onNavigate={onNavigate} className="mt-7" />
      {/* 설정 마저 하기: what the short onboarding left for later (N15). */}
      <SetupCard className="mt-4" />
      {/* 기록 지키기: outside 더 보기, so a browser-tab couple sees it (N16). */}
      <BackupBanner className="mt-4" />
      <MoreSection moment={moment} onNavigate={onNavigate} className="mt-[18px]" />
      <p className="mt-1 text-center text-[11.5px] text-ink-3">사진과 기록은 이 폰에만 저장돼요</p>
      {toast}
    </div>
  )
}

function StageHome({ onNavigate }: { onNavigate: Nav }) {
  return (
    <div>
      {/* 우리 표지: date · 함께한 지 D+N, one line, the photo — the same cover as the preparing home.
          The line never says 임신 N주 or anything about health (cover.heroLine); the hero card below does the counting. */}
      <CoverHero onNavigate={onNavigate} />

      <div className="mt-[18px] space-y-3">
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
