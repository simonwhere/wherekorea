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
import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { completeMonthlyTask, type MonthlyTask } from '@/lib/logic/partnerTrack'
import { KIND_EMOJI } from '@/lib/logic/plan'
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

/** The [✓ 했어요] pill (40px, 44px to tap). */
function DoneButton({ onClick, tone }: { onClick: () => void; tone: 'soft' | 'surface' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13.5px] font-bold text-ink transition-colors before:absolute before:-inset-y-0.5 before:inset-x-0 before:content-['']",
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        tone === 'soft' ? 'bg-surface-2 hover:bg-line/60' : 'bg-surface hover:bg-line/40',
      )}
    >
      <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
      했어요
    </button>
  )
}

/** Title, deadline and why, then [했어요] and a link to 챙길 것. */
export function MonthlyTaskBody({
  task,
  onDone,
  onNavigate,
  className,
  onSurface2 = false,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate: Nav
  className?: string
  /** Sits on a surface-2 box (the moment card): the button takes the surface colour. */
  onSurface2?: boolean
}) {
  const overdue = task.status === 'overdue'
  return (
    <div className={className}>
      <p className="text-[11.5px] font-bold text-brand-ink">이번 달 할 일</p>
      <p className="mt-px text-base font-extrabold leading-snug tracking-[-0.03em] text-ink">{task.title}</p>
      {task.dueText ? (
        <p className={cx('mt-0.5 text-xs font-semibold', overdue ? 'text-warn' : 'text-ink-2')}>{task.dueText}</p>
      ) : null}
      {task.why ? <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-3">{task.why}</p> : null}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <DoneButton onClick={() => onDone(task)} tone={onSurface2 ? 'surface' : 'soft'} />
        <LinkButton size="md" arrow onClick={() => onNavigate('plan')} className="-mr-1 shrink-0 px-1">
          챙길 것
        </LinkButton>
      </div>
    </div>
  )
}

/** The tile on the compact card: the 가임력 검사 chain's own steps, else the roadmap kind. */
function taskEmoji(task: MonthlyTask): string {
  if (task.step === 'test') return '🧪'
  if (task.step === 'apply') return '📝'
  if (task.step === 'claim') return '🧾'
  return KIND_EMOJI[task.kind] ?? '📌'
}

/**
 * The partner's first line when the task is urgent (`top`: a live deadline, or
 * the owner is 35+) — COMPACT: what, by when, and [했어요]. The why and the
 * 챙길 것 link stay in 챙길 것 (and in MonthlyTaskBody elsewhere).
 */
export function MonthlyTaskCard({
  task,
  onDone,
  className,
}: {
  task: MonthlyTask
  onDone: (task: MonthlyTask) => void
  onNavigate?: Nav
  className?: string
}) {
  const overdue = task.status === 'overdue'
  // "검사 마감 12월 19일 (토) · 신청 후 3개월 안" → the deadline part only.
  const due = task.dueText?.split(' · ')[0]
  return (
    <section
      aria-label="이번 달 할 일"
      className={cx(
        'flex items-center gap-3 rounded-[20px] border py-3 pl-3.5 pr-3 shadow-warm dark:shadow-none',
        overdue
          ? 'border-warn/25 bg-warn-soft'
          : 'border-transparent bg-surface dark:border-line/70 forced-colors:border-line',
        className,
      )}
    >
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-[21px]">
        {taskEmoji(task)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold text-brand-ink">이번 달 할 일</p>
        <p className="mt-px text-base font-extrabold leading-snug tracking-[-0.03em] text-ink">{task.title}</p>
        {due ? <p className={cx('mt-px text-xs', overdue ? 'font-semibold text-warn' : 'text-ink-2')}>{due}</p> : null}
      </div>
      <DoneButton onClick={() => onDone(task)} tone={overdue ? 'surface' : 'soft'} />
    </section>
  )
}
