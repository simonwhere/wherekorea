'use client'

// Home block 3 "우리 한 줄": the partner's month task (first, for the partner),
// the other person's progress with 콕 / 응원, and a received signal to answer.

import type { TabKey } from '@/components/AppShell'
import { cx, useToast } from '@/components/ui'
import type { MonthlyTask } from '@/lib/logic/partnerTrack'
import { canNudge as nudgeAllowed, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { pendingSignal, signalIdOf } from '@/lib/logic/signals'
import { stampOn } from '@/lib/logic/today'
import { PERIOD_PARTNER_TIP } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import { PendingSignal } from '@/components/signals/SignalsCard'
import { dailyProgress, nudgeTarget } from './model'
import { MonthlyTaskBody } from './MonthlyTask'
import { MemberBubble } from './bits'

const small =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"

/** Up to this many progress segments; more items read better as the number alone. */
const DOTS_MAX = 6

export default function UsLine({
  task,
  onTaskDone,
  onNavigate,
  className,
}: {
  task?: MonthlyTask
  /** [했어요] for the month task (completeMonthlyTask, with 되돌리기). */
  onTaskDone: (task: MonthlyTask) => void
  onNavigate: (tab: TabKey) => void
  className?: string
}) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const prog = dailyProgress(state, partner.id, today)
  const target = nudgeTarget(state, partner.id, today)
  // No 콕 button once today's are used — or at all for a partner who turned 콕 받기 off (Next B).
  const canNudge = !!target && nudgeAllowed(state, me.id, partner.id, today)
  const pending = pendingSignal(state, me.id, today)
  // '이번 달은 아니었어요' is the month's hardest line: what to say (and not) goes with the reply.
  const notThisMonth = !!pending && signalIdOf(pending) === 'not-this-month'

  const nudge = () => {
    if (!canNudge) return
    update((s) => sendNudge(s, me.id, partner.id, today, stampOn(today), target?.label))
    toast.show(`${partner.name}님에게 콕! 보냈어요`)
  }
  const cheer = () => {
    update((s) => sendCheer(s, me.id, partner.id, stampOn(today)))
    toast.show(`${partner.name}님에게 응원을 보냈어요`)
  }

  const dot = partner.tracksCycle ? 'bg-her' : 'bg-him'

  return (
    // id="us-line": the cover's "답하기" scrolls here (html's scroll-padding clears the sticky header).
    <section id="us-line" aria-labelledby="us-line-title" className={className}>
      <h2 id="us-line-title" className="mb-1.5 px-0.5 text-[17px] font-extrabold tracking-[-0.03em] text-ink">
        우리 한 줄
      </h2>
      <div className="rounded-[22px] border border-transparent bg-surface px-3.5 pb-3.5 pt-3 shadow-warm dark:border-line/70 dark:shadow-none forced-colors:border-line">
        {task ? (
          <MonthlyTaskBody
            task={task}
            onDone={onTaskDone}
            onNavigate={onNavigate}
            className="mb-3 border-b border-line/75 pb-2"
          />
        ) : null}

        <div className="flex min-h-12 items-center gap-2.5">
          <MemberBubble member={partner} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink">{partner.name}님</p>
            {prog.total > 0 ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                <span className="tabular-nums">
                  오늘 {prog.done}/{prog.total}
                </span>
                {prog.complete ? <span className="text-ok">완료</span> : null}
                {prog.total <= DOTS_MAX ? (
                  <span aria-hidden className="inline-flex gap-[3px]">
                    {Array.from({ length: prog.total }, (_, i) => (
                      <i key={i} className={cx('h-[5px] w-3.5 rounded-full', i < prog.done ? dot : 'bg-line')} />
                    ))}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-0.5 text-[12.5px] text-ink-3">체크 항목 없음</p>
            )}
          </div>
          {canNudge ? (
            <button type="button" onClick={nudge} className={small} aria-label={`${partner.name}님에게 콕 찌르기 (${target!.label})`}>
              <span aria-hidden>👉</span> 콕
            </button>
          ) : null}
          <button type="button" onClick={cheer} className={small}>
            <span aria-hidden>👏</span> 응원
          </button>
        </div>

        {pending ? (
          <div className="mt-3 border-t border-line/75 pt-3">
            <PendingSignal />
            {notThisMonth ? (
              <p className="mt-2.5 rounded-[14px] bg-surface-2 px-3 py-2 text-[12.5px] leading-[1.5] text-ink-2">
                <b className="font-bold text-ink">해 줄 말</b> · {PERIOD_PARTNER_TIP}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
