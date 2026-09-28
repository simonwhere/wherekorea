'use client'

// "이번 달 할 일" — the partner's one meaningful task this month
// (lib/logic/partnerTrack.monthlyTask): its deadline (dueText), one line of
// why, a one-tap [했어요] with 되돌리기, and a way to 챙길 것.
//
// Done and undo both go through completeMonthlyTask — never tickItem: the
// claim step ('검사비 청구하기') has no roadmap row of its own.

import { useCallback, useMemo, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import UndoToast, { type UndoMessage } from '@/components/log/UndoToast'
import { Button, cx, useToast } from '@/components/ui'
import { completeMonthlyTask, type MonthlyTask } from '@/lib/logic/partnerTrack'
import { useApp } from '@/lib/store'
import { LinkButton } from './bits'

type Nav = (tab: TabKey) => void

/**
 * [했어요] for the month task, with a 5-second 되돌리기. Keep it in a parent
 * that outlives the row: once done, monthlyTask moves on to the next step.
 */
export function useMonthlyTaskDone(): { done: (task: MonthlyTask) => void; toast: React.ReactNode } {
  const { update, today, me } = useApp()
  const toast = useToast()
  const [undo, setUndo] = useState<(UndoMessage & { task: MonthlyTask }) | null>(null)
  const expire = useCallback(() => setUndo(null), [])

  const done = useCallback(
    (task: MonthlyTask) => {
      update((s) => completeMonthlyTask(s, task, today, me.id))
      setUndo({ id: Date.now(), text: `‘${task.title}’ 완료했어요`, task })
    },
    [update, today, me.id],
  )

  const revert = useCallback(() => {
    if (!undo) return
    const task = undo.task
    update((s) => completeMonthlyTask(s, task, today, me.id, false))
    setUndo(null)
    toast.show('되돌렸어요')
  }, [undo, update, today, me.id, toast])

  const el = useMemo(() => <UndoToast message={undo} onUndo={revert} onExpire={expire} />, [undo, revert, expire])
  return { done, toast: el }
}

/** Title, deadline and why, then [했어요] and a link to 챙길 것. */
export function MonthlyTaskBody({
  task,
  onDone,
  onNavigate,
  className,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate: Nav
  className?: string
}) {
  const overdue = task.status === 'overdue'
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold text-him">이번 달 할 일</p>
      <p className="text-[15px] font-bold leading-snug text-ink">{task.title}</p>
      {task.dueText ? (
        <p className={cx('mt-0.5 text-xs font-semibold', overdue ? 'text-warn' : 'text-ink-2')}>{task.dueText}</p>
      ) : null}
      {task.why ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{task.why}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <Button size="md" variant="secondary" className="min-w-[96px]" onClick={() => onDone(task)}>
          <span aria-hidden>✓</span> 했어요
        </Button>
        <LinkButton onClick={() => onNavigate('plan')} className="shrink-0 px-1">
          챙길 것 <span aria-hidden>→</span>
        </LinkButton>
      </div>
    </div>
  )
}

/** The partner's first line when the task is urgent (`top`: a live deadline, or the owner is 35+). */
export function MonthlyTaskCard({ task, onDone, onNavigate }: { task: MonthlyTask; onDone: (task: MonthlyTask) => void; onNavigate: Nav }) {
  return (
    <section
      aria-label="이번 달 할 일"
      className={cx(
        'rounded-xl2 border px-4 pb-2 pt-3 shadow-card',
        task.status === 'overdue' ? 'border-warn/25 bg-warn-soft' : 'border-line bg-surface',
      )}
    >
      <MonthlyTaskBody task={task} onDone={onDone} onNavigate={onNavigate} />
    </section>
  )
}
