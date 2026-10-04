'use client'

// The partner page's content for one date (a PartnerPage — one entry of the
// seven-day snapshot with its shared fields), drawn from props only: no
// transport, no storage. LinkPage feeds it the live snapshot, his local marks
// and the taps that become events; LinkPreview feeds it a snapshot built on
// her phone with nothing to send (설정 › 연결 '민수님 화면 미리보기', N23).
//
// Order, as his in-app home orders itself (components/tabs/TodayTab): a live
// deadline of his month task (`top`) goes before the moment card, or right
// after it when the card ends in a button; else inside the card when the card
// features it; else in 우리 한 줄. His clinic week (N32) sits inside the
// moment card while clinic mode is on. Then '이번 주 우리 둘' (N21) with his
// '내 준비' bar under it (N30), his checks, 우리 한 줄, 우리 신호, and
// '매주 이 시간에 알려 받기' (N31).

import { useMemo } from 'react'
import { CHEERS_PER_DAY } from '@/lib/logic/partnerEvents'
import type { WeeklyDay } from '@/lib/logic/ics'
import type { PartnerPage, SnapshotAppointment, SnapshotCheck, SnapshotTask } from '@/lib/logic/partnerSnapshot'
import type { Signal } from '@/lib/logic/signals'
import type { WeekOptionId } from '@/lib/logic/weekTogether'
import type { ISODate } from '@/lib/types'
import { Heading } from './bits'
import LinkChecks from './LinkChecks'
import LinkClinic from './LinkClinic'
import LinkCover from './LinkCover'
import LinkMoment from './LinkMoment'
import LinkPrep from './LinkPrep'
import LinkSignals from './LinkSignals'
import LinkTaskCard from './LinkTask'
import LinkUsLine from './LinkUsLine'
import LinkWeek from './LinkWeek'
import LinkWeekly from './LinkWeekly'
import {
  ownerOf,
  viewCanNudge,
  viewChecks,
  viewClinic,
  viewerOf,
  viewSignal,
  viewSignalsLeft,
  viewTask,
  viewTold,
  viewWeek,
  type LocalMarks,
} from './model'

/** Every tap the page can make (LinkPage turns each into an event; a preview does nothing). */
export interface LinkActions {
  onToggle: (item: SnapshotCheck) => void
  onTaskDone: (task: SnapshotTask) => void
  onReply: (reply: Signal) => void
  onSignal: (signal: Signal) => void
  onNudge: () => void
  onCheer: () => void
  onWeekPick: (id: WeekOptionId) => void
  onWeekDone: () => void
  /** [같이 갈게요] on a '둘이 함께' appointment of his clinic week (N32). */
  onJoin: (a: SnapshotAppointment) => void
  /** '캘린더에 넣기' — the weekly reminder file for `day` (N31; nothing is sent). */
  onWeekly: (day: WeeklyDay) => void
  /** One of the two answers on a card she told him about (해 줄 말, N30) — a 'signal' event. */
  onTold: (signal: Signal) => void
}

export const NO_ACTIONS: LinkActions = {
  onToggle: () => {},
  onTaskDone: () => {},
  onReply: () => {},
  onSignal: () => {},
  onNudge: () => {},
  onCheer: () => {},
  onWeekPick: () => {},
  onWeekDone: () => {},
  onJoin: () => {},
  onWeekly: () => {},
  onTold: () => {},
}

export default function LinkBody({
  page,
  today,
  marks,
  actions,
  top,
  bottom,
  footer,
}: {
  page: PartnerPage
  today: ISODate
  marks: LocalMarks
  actions: LinkActions
  /** Above the cover (the first-run card, the in-app browser hint). */
  top?: React.ReactNode
  /** After 우리 신호 (the home-screen card). */
  bottom?: React.ReactNode
  footer?: React.ReactNode
}) {
  const me = viewerOf(page)
  const owner = ownerOf(page)
  const checks = useMemo(() => viewChecks(page.checks, marks), [page.checks, marks])
  const signalsLeft = viewSignalsLeft(page, marks)
  const cheersLeft = Math.max(0, CHEERS_PER_DAY - marks.cheers.length)
  const pending = viewSignal(page, marks)
  const canNudge = viewCanNudge(page, marks)
  const task = viewTask(page, marks)
  const week = viewWeek(page, marks)
  const clinic = viewClinic(page, marks)
  const told = viewTold(page, marks)

  const goToUsLine = () => {
    const el = document.getElementById('us-line')
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el?.querySelector<HTMLElement>('[data-reply]:not([disabled])')?.focus({ preventScroll: true })
  }

  const m = page.moment
  const where: 'top' | 'after' | 'card' | 'us' | null = !task
    ? null
    : task.task.top
      ? m?.primary
        ? 'after'
        : 'top'
      : m?.monthlyTask
        ? 'card'
        : 'us'

  return (
    <>
      {top ? <div className="mb-4 space-y-3">{top}</div> : null}
      <LinkCover snapshot={page} today={today} onLine={pending ? goToUsLine : undefined} />

      <div className="mt-4 space-y-3">
        {where === 'top' && task ? <LinkTaskCard task={task.task} done={task.done} onDone={actions.onTaskDone} today={today} /> : null}
        {page.moment ? (
          <LinkMoment
            snapshot={page}
            task={where === 'card' && task ? task : undefined}
            onTaskDone={actions.onTaskDone}
            clinic={clinic}
            today={today}
            onJoin={actions.onJoin}
            weekBelow={!!week && where !== 'after'}
            say={told}
            ownerName={owner.name}
            signalsLeft={signalsLeft}
            onTold={actions.onTold}
          />
        ) : clinic ? (
          <section
            aria-label="병원과 함께"
            className="rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none"
          >
            <LinkClinic clinic={clinic} today={today} onJoin={actions.onJoin} />
          </section>
        ) : null}
        {where === 'after' && task ? <LinkTaskCard task={task.task} done={task.done} onDone={actions.onTaskDone} today={today} /> : null}
        {week ? (
          <LinkWeek week={week} ownerName={owner.name} onPick={actions.onWeekPick} onDone={actions.onWeekDone} showPrep={!page.myPrep} />
        ) : null}
        {page.myPrep ? <LinkPrep prep={page.myPrep} /> : null}
      </div>

      <Heading>오늘 할 일</Heading>
      <LinkChecks me={me} her={me.id === page.cycleOwner} checks={checks} onToggle={actions.onToggle} />

      <Heading sub={pending ? `${owner.name}님의 신호에 답해 보세요` : undefined}>우리 한 줄</Heading>
      {where === 'us' && task ? <LinkTaskCard task={task.task} done={task.done} onDone={actions.onTaskDone} today={today} className="mb-3" /> : null}
      <LinkUsLine
        snapshot={page}
        signal={pending}
        canNudge={canNudge}
        cheersLeft={cheersLeft}
        signalsLeft={signalsLeft}
        onNudge={actions.onNudge}
        onCheer={actions.onCheer}
        onReply={actions.onReply}
      />

      <Heading sub="말로 꺼내기 어려운 건 버튼 하나로">우리 신호</Heading>
      <LinkSignals snapshot={page} left={signalsLeft} onSend={actions.onSignal} />

      {page.stage === 'preparing' && !page.moment?.support ? (
        <LinkWeekly today={today} onDownload={actions.onWeekly} className="mt-6" />
      ) : null}

      {bottom ? <div className="mt-6">{bottom}</div> : null}
      {footer}
    </>
  )
}
