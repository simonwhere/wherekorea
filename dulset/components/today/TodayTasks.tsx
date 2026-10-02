'use client'

// Home block 2: my daily checks as one-tap rows, a weekly check-in when it's
// due, and today's / tomorrow's appointment.

import { useCallback, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { doneIds, isWeekly } from '@/lib/logic/checks'
import { APPOINTMENT_KIND_EMOJI, APPOINTMENT_KIND_LABEL } from '@/lib/logic/appointments'
import { stampOn, toggleWithCompletion } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { CheckItem } from '@/lib/types'
import { KIND_ICON, KIND_LABEL, PillButton } from './bits'
import CheckEditor from './CheckEditor'
import { dailyItems, dailyProgress, dayLabel, homeAppointments, soonAppointments, weeklyRows, whoLabel } from './model'

export default function TodayTasks({ onNavigate, className }: { onNavigate: (tab: TabKey) => void; className?: string }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [editorOpen, setEditorOpen] = useState(false)
  // Stable, so the Sheet doesn't re-run its open effect (and steal focus) after each edit.
  const closeEditor = useCallback(() => setEditorOpen(false), [])
  const items = dailyItems(state, me.id)
  const weekly = weeklyRows(state, me.id, today)
  const done = doneIds(state, me.id, today)
  const prog = dailyProgress(state, me.id, today)
  // Every appointment today or tomorrow (a clinic day can have two or three).
  const appts = soonAppointments(homeAppointments(state), today)

  const toggle = (item: CheckItem) => {
    const now = stampOn(today)
    const alreadyTold = state.notifications.some((n) => n.key === `complete:${me.id}:${today}`)
    const preview = toggleWithCompletion(state, me.id, partner.id, today, item.id, now)
    update((s) => toggleWithCompletion(s, me.id, partner.id, today, item.id, now).state)
    if (preview.completed) toast.show(alreadyTold ? '오늘 체크 완료!' : `오늘 체크 완료! ${partner.name}님에게 알렸어요`)
    else if (isWeekly(item) && !done.includes(item.id)) toast.show('이번 주 체크인 완료!')
  }

  const empty = items.length === 0 && weekly.length === 0

  return (
    <section aria-labelledby="today-tasks" className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <h2 id="today-tasks" className="flex items-center gap-2 text-[17px] font-extrabold tracking-[-0.03em] text-ink">
          오늘 할 일
          {prog.total > 0 ? (
            <span className="inline-flex h-[22px] items-center rounded-full bg-ok-soft px-2 text-xs font-extrabold tabular-nums tracking-normal text-ok">
              <span className="sr-only">오늘 </span>
              {prog.done}/{prog.total}
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="-mr-1.5 flex min-h-[44px] items-center rounded-xl px-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          편집<span className="sr-only">: 나의 체크 항목</span>
        </button>
      </div>

      <ul className="divide-y divide-line/75 rounded-[22px] border border-transparent bg-surface px-3.5 py-0.5 shadow-warm dark:border-line/70 dark:shadow-none forced-colors:border-line">
        {items.map((item) => (
          <li key={item.id}>
            <Row item={item} checked={done.includes(item.id)} onToggle={() => toggle(item)} />
          </li>
        ))}
        {weekly.map(({ item, checked }) => (
          <li key={item.id}>
            <Row item={item} checked={checked} weekly onToggle={() => toggle(item)} />
          </li>
        ))}
        {empty ? (
          <li className="flex min-h-[62px] items-center gap-3 py-2">
            <p className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-ink-3">매일 챙길 영양제나 생활습관을 추가해 보세요.</p>
            <PillButton size="md" variant="soft" onClick={() => setEditorOpen(true)}>
              추가하기
            </PillButton>
          </li>
        ) : null}
        {appts.map((appt) => (
          <li key={appt.id}>
            <button
              type="button"
              onClick={() => onNavigate('plan')}
              className="flex min-h-[62px] w-full items-center gap-3 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg">
                {APPOINTMENT_KIND_EMOJI[appt.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-[1.3] tracking-[-0.025em] text-ink">
                  <span className="sr-only">{APPOINTMENT_KIND_LABEL[appt.kind]}: </span>
                  {appt.title}
                </span>
                <span className="mt-px block truncate text-[12.5px] text-ink-3">
                  {appt.time ? `${appt.time} · ` : ''}
                  {whoLabel(appt.who, state.couple.members, me.id)}
                  {appt.place ? ` · ${appt.place}` : ''}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-extrabold text-white">
                {dayLabel(appt.date, today)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {prog.complete && weekly.every((r) => r.checked) ? (
        <p className="mt-1.5 px-1 text-xs font-semibold text-ok" role="status">
          오늘 할 일을 모두 마쳤어요.
        </p>
      ) : null}
      <CheckEditor open={editorOpen} onClose={closeEditor} />
    </section>
  )
}

/** Sleep items get a moon on him-soft (by their label: 잠 · 수면 · 자기). */
const SLEEP = /잠|수면|자기/

function bubble(item: CheckItem): { emoji: string; tone: string } {
  if (SLEEP.test(item.label)) return { emoji: '🌙', tone: 'bg-him-soft' }
  if (item.kind === 'habit') return { emoji: KIND_ICON.habit, tone: 'bg-ok-soft' }
  return { emoji: KIND_ICON[item.kind], tone: 'bg-brand-soft' }
}

function Row({ item, checked, weekly = false, onToggle }: { item: CheckItem; checked: boolean; weekly?: boolean; onToggle: () => void }) {
  const b = bubble(item)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-[62px] w-full items-center gap-3 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
    >
      <span aria-hidden className={cx('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-lg', b.tone)}>
        {b.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate text-base font-bold leading-[1.3] tracking-[-0.025em]',
            checked ? 'text-ink-2' : 'text-ink',
          )}
        >
          {weekly ? <span className="mr-1 text-xs font-bold tracking-normal text-brand-ink">이번 주</span> : null}
          {item.label}
        </span>
        <span className="mt-px block truncate text-[12.5px] text-ink-3">
          {weekly ? '주 1회 체크인' : item.note ? `${KIND_LABEL[item.kind]} · ${item.note}` : KIND_LABEL[item.kind]}
        </span>
      </span>
      {/* 30px round check on the right: an inset control ring, filled with ok when done. */}
      <span
        aria-hidden
        className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_2px_rgb(var(--control))]"
      >
        <span
          className={cx(
            'absolute inset-0 flex items-center justify-center rounded-full bg-ok text-white transition duration-[120ms] ease-out',
            checked ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
          )}
        >
          <Icon name="check" className="h-[17px] w-[17px]" strokeWidth={2.8} />
        </span>
      </span>
    </button>
  )
}
