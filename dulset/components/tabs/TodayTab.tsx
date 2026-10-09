'use client'

// 오늘 — the home screen both partners open every day.
//
// Preparing (the core stage) opens with the couple's photo, then three blocks
// and a folded "더 보기":
//   0. 우리 표지 — date · 함께한 지 D+N, one line, the cover photo (never the cycle)
//   1. today's moment — ring / week row, one title, one sentence, one action
//   2. 오늘 할 일 — my checks, a weekly check-in when due, today's/tomorrow's appointment
//   (partner) 이번 주 우리 둘 — the same weekly block as his link (N21): three
//      picks → [했어요], her [고마워요] for the rest of the week; then '지은님 챙길
//      것 · 같이' (her items with what he can do + [같이 할게요], 2026-10-09) and
//      his 내 준비
//   3. 우리 한 줄 — the partner's month task, the other's progress, '이번 주 민수님'
//      + [고마워요] on her home (N21), a signal to answer, the reply to mine,
//      and '신호 보내기' as one row (out of 더 보기); under it on her home, his
//      이번 달 할 일 by stage in one line ('민수님 · 정액검사 예약했어요', N28)
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
// Pregnant runs the same loop as preparing (PregnantHome: his week block, 이번 주
// 같이 챙길 것, 내 준비; her 우리 한 줄 with [고마워요]); parenting is unchanged.

import { useMemo } from 'react'
import type { TabKey } from '@/components/AppShell'
import { SectionTitle, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { MemberBubble } from '@/components/today/bits'
import { partnerProgressLine } from '@/lib/logic/usView'
import { monthlyTask } from '@/lib/logic/partnerTrack'
import { myPrep } from '@/lib/logic/myPrep'
import { carrierOf } from '@/lib/logic/together'
import { partnerTaskVisible, ttcMoment } from '@/lib/logic/ttcFlow'
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
import MyPrepBar from '@/components/today/MyPrepBar'
import TogetherCard from '@/components/today/TogetherCard'
import UsLine from '@/components/today/UsLine'
import WeekTogether from '@/components/today/WeekTogether'
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
  // Not through the quiet after a loss — that time is for each other, not for
  // tasks. One rule for the home and the link (ttcFlow.partnerTaskVisible).
  const showTask = partnerTaskVisible(state, today, me.id)
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
      {/* His '이번 주 우리 둘' (N21) → '지은님 챙길 것 · 같이' (her items, each with what he can do, 2026-10-09)
          → his 내 준비 — nothing for the cycle owner, nor in the quiet after a loss. */}
      <WeekTogether withChain={showTask} withPrep={false} className="mt-3.5" />
      <TogetherCard stage="preparing" onNavigate={onNavigate} className="mt-2.5" />
      <MyPrepBar className="mt-2.5" />
      <TodayTasks onNavigate={onNavigate} className="mt-7" />
      <UsLine task={where === 'us' ? task : undefined} onTaskDone={done} onNavigate={onNavigate} className="mt-7" />
      {/* Her home: where his 이번 달 할 일 stands, one line by its stage (N28) — never a zero, not in the quiet. */}
      <PartnerProgress onNavigate={onNavigate} className="mt-3" />
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

/**
 * '민수님 · 정액검사 예약했어요' — the partner's month task as one line on the
 * cycle owner's preparing home (usView.partnerProgressLine: the stage name
 * only, nothing before his first step, nothing in the 42 quiet days). Taps
 * open 챙길 것, where the steps live.
 */
function PartnerProgress({ onNavigate, className }: { onNavigate: Nav; className?: string }) {
  const { state, today, me } = useApp()
  const line = partnerProgressLine(state, today, me.id)
  if (!line) return null
  const member = state.couple.members.find((m) => m.id === line.member)
  return (
    <button
      type="button"
      onClick={() => onNavigate('plan')}
      aria-label={`${line.text} · 챙길 것에서 보기`}
      data-partner-progress
      className={cx(
        'flex min-h-[48px] w-full items-center gap-2.5 rounded-xl bg-surface-2 py-2 pl-2.5 pr-3 text-left transition-colors hover:bg-line/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
        className,
      )}
    >
      {member ? <MemberBubble member={member} size={30} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-ink-3">이번 달 할 일</span>
        <span className="block truncate text-[13.5px] font-bold tracking-[-0.01em] text-ink">{line.text}</span>
      </span>
      <Icon name="right" className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
    </button>
  )
}

function StageHome({ onNavigate }: { onNavigate: Nav }) {
  const { state } = useApp()
  return state.stage === 'pregnant' ? <PregnantHome onNavigate={onNavigate} /> : <ParentingHome onNavigate={onNavigate} />
}

/**
 * The pregnant home (founder request 2026-10-09: "여자가 챙겨야 할 것들을
 * 남자에게도 계속 보여줘야해 같이 하는거야"): the same loop as the preparing home.
 *  • His: 임신 N주 (StageHero — weeks and the due date are known to both once
 *    she switched the stage) → 이번 주 우리 둘 (the pregnancy catalogue) → 이번 주
 *    같이 챙길 것 (her + shared items, each with his support line and [같이
 *    할게요]) → 내 준비 (his own items — the card leaves them out) → 오늘 할
 *    일 → 우리 한 줄 (his 이번 달 할 일 first, as on his link).
 *  • Hers: 임신 N주 → 다가오는 일정 · 이번 주 챙길 것 (her rows show '민수님이 같이
 *    챙긴대요') → 오늘 할 일 → 우리 한 줄 ('이번 주 민수님' + [고마워요], '민수님이
 *    ‘…’ 같이 챙긴대요', signals).
 * Nothing she logs privately reaches any of it (lib/logic/together reads the
 * shared plan only).
 */
function PregnantHome({ onNavigate }: { onNavigate: Nav }) {
  const { state, today, me } = useApp()
  const his = carrierOf(state) !== me.id
  // His 이번 달 할 일 (e.g. 분만 병원 정하기 — a shared item) sits in 우리 한 줄, as on his link; the
  // together card leaves it out so it never shows twice. Not for her, not in the quiet (partnerTaskVisible).
  const showTask = his && partnerTaskVisible(state, today, me.id)
  const task = useMemo(() => (showTask ? monthlyTask(state, today, me.id) : undefined), [showTask, state, today, me.id])
  const { done, toast } = useMonthlyTaskDone()
  // Rows another card on his home already carries leave the together card before its cut to three:
  // his month task, and his own 내 준비 items (육아휴직 계획, 카시트 … — the link's same rule).
  const exclude = useMemo(
    () => (his ? [...(task ? [task.id] : []), ...(myPrep(state, today, me.id).items ?? []).map((i) => i.id)] : []),
    [his, task, state, today, me.id],
  )
  return (
    <div data-pregnant-home={his ? 'partner' : 'owner'}>
      <CoverHero onNavigate={onNavigate} />

      <div className="mt-[18px] space-y-3">
        <AnniversaryBanner onNavigate={onNavigate} />
        <StageHero onNavigate={onNavigate} />
        {his ? null : (
          <>
            <UpcomingCard onNavigate={onNavigate} />
            <PlanFocusCard onNavigate={onNavigate} />
          </>
        )}
      </div>

      {his ? (
        <>
          <WeekTogether withChain={false} withPrep={false} className="mt-3.5" />
          <TogetherCard stage="pregnant" exclude={exclude} onNavigate={onNavigate} className="mt-2.5" />
          <MyPrepBar className="mt-2.5" />
        </>
      ) : null}

      <TodayTasks onNavigate={onNavigate} className="mt-7" />
      <CoupleStreak className="mt-3" />
      <UsLine task={task} onTaskDone={done} onNavigate={onNavigate} className="mt-7" />

      <SectionTitle>우리 둘의 기록</SectionTitle>
      <div className="space-y-3">
        <DiaryPromptCard onNavigate={onNavigate} />
        <DateCard onNavigate={onNavigate} />
      </div>

      {/* 기록 지키기: storage.persist() + install / weekly backup nudge, for every stage. */}
      <div className="mt-6">
        <InstallBackupCard />
      </div>
      {toast}
    </div>
  )
}

function ParentingHome({ onNavigate }: { onNavigate: Nav }) {
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
