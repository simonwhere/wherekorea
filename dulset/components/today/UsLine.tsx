'use client'

// Home block 3 "우리 한 줄": the partner's month task (first, for the partner),
// the other person's progress with 콕 / 응원, and a received signal to answer.

import type { TabKey } from '@/components/AppShell'
import { Avatar, cx, useToast } from '@/components/ui'
import type { MonthlyTask } from '@/lib/logic/partnerTrack'
import { NUDGES_PER_DAY, nudgesSentToday, sendCheer, sendNudge } from '@/lib/logic/notifications'
import { pendingSignal } from '@/lib/logic/signals'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { PendingSignal } from '@/components/signals/SignalsCard'
import { dailyProgress, nudgeTarget } from './model'
import { MonthlyTaskBody } from './MonthlyTask'

const small =
  'relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[\'\'] hover:bg-surface-2 disabled:opacity-40'

export default function UsLine({
  task,
  onTaskDone,
  onNavigate,
}: {
  task?: MonthlyTask
  /** [했어요] for the month task (completeMonthlyTask, with 되돌리기). */
  onTaskDone: (task: MonthlyTask) => void
  onNavigate: (tab: TabKey) => void
}) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const prog = dailyProgress(state, partner.id, today)
  const target = nudgeTarget(state, partner.id, today)
  const left = Math.max(0, NUDGES_PER_DAY - nudgesSentToday(state, me.id, today))
  const canNudge = !!target && left > 0

  const nudge = () => {
    if (!canNudge) return
    update((s) => sendNudge(s, me.id, partner.id, today, stampOn(today), target?.label))
    toast.show(`${partner.name}님에게 콕! 보냈어요`)
  }
  const cheer = () => {
    update((s) => sendCheer(s, me.id, partner.id, stampOn(today)))
    toast.show(`${partner.name}님에게 응원을 보냈어요`)
  }

  return (
    <section aria-labelledby="us-line">
      <h2 id="us-line" className="mb-1.5 px-1 text-[15px] font-bold text-ink">
        우리 한 줄
      </h2>
      <div className="divide-y divide-line/60 overflow-hidden rounded-xl2 border border-line bg-surface">
        {task ? <MonthlyTaskBody task={task} onDone={onTaskDone} onNavigate={onNavigate} className="px-3 pb-1 pt-2.5" /> : null}

        <div className="flex min-h-[52px] items-center gap-2.5 px-3 py-2">
          <Avatar member={partner} size="sm" />
          <p className="min-w-0 flex-1 truncate text-sm text-ink">
            <b className="font-semibold">{partner.name}</b>{' '}
            {prog.total > 0 ? (
              <span className={cx('tabular-nums', prog.complete ? 'font-semibold text-ok' : 'text-ink-2')}>
                {prog.done}/{prog.total}
                {prog.complete ? ' 완료' : ''}
              </span>
            ) : (
              <span className="text-xs text-ink-3">체크 항목 없음</span>
            )}
          </p>
          {canNudge ? (
            <button type="button" onClick={nudge} className={small} aria-label={`${partner.name}님에게 콕 찌르기 (${target!.label})`}>
              <span aria-hidden>👉</span> 콕
            </button>
          ) : null}
          <button type="button" onClick={cheer} className={small}>
            <span aria-hidden>👏</span> 응원
          </button>
        </div>

        {pendingSignal(state, me.id, today) ? (
          <div className="p-2">
            <PendingSignal className="rounded-lg" />
          </div>
        ) : null}
      </div>
    </section>
  )
}
