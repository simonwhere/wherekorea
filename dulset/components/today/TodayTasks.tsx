'use client'

// Home block 2: my daily checks as one-tap rows, a weekly check-in when it's
// due, and today's / tomorrow's appointment.

import { useCallback, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import { Button, cx, useToast } from '@/components/ui'
import { doneIds, isWeekly } from '@/lib/logic/checks'
import { APPOINTMENT_KIND_EMOJI, APPOINTMENT_KIND_LABEL } from '@/lib/logic/appointments'
import { stampOn, toggleWithCompletion } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { CheckItem } from '@/lib/types'
import { KIND_ICON, KIND_LABEL } from './bits'
import CheckEditor from './CheckEditor'
import { dailyItems, dailyProgress, dayLabel, homeAppointments, soonAppointment, weeklyRows, whoLabel } from './model'

export default function TodayTasks({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const [editorOpen, setEditorOpen] = useState(false)
  // Stable, so the Sheet doesn't re-run its open effect (and steal focus) after each edit.
  const closeEditor = useCallback(() => setEditorOpen(false), [])
  const items = dailyItems(state, me.id)
  const weekly = weeklyRows(state, me.id, today)
  const done = doneIds(state, me.id, today)
  const prog = dailyProgress(state, me.id, today)
  const appt = soonAppointment(homeAppointments(state), today)

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
    <section aria-labelledby="today-tasks">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <h2 id="today-tasks" className="text-[15px] font-bold text-ink">
          오늘 할 일
          {prog.total > 0 ? (
            <span className={cx('ml-1.5 text-xs font-bold tabular-nums', prog.complete ? 'text-ok' : 'text-ink-3')}>
              {prog.done}/{prog.total}
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="-mr-2 flex min-h-[44px] items-center rounded-xl px-3 text-xs font-semibold text-ink-2 hover:bg-surface-2"
        >
          편집<span className="sr-only">: 나의 체크 항목</span>
        </button>
      </div>

      <ul className="divide-y divide-line/60 overflow-hidden rounded-xl2 border border-line bg-surface">
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
          <li className="flex items-center gap-3 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-xs text-ink-3">매일 챙길 영양제나 생활습관을 추가해 보세요.</p>
            <Button variant="secondary" onClick={() => setEditorOpen(true)}>
              추가하기
            </Button>
          </li>
        ) : null}
        {appt ? (
          <li>
            <button
              type="button"
              onClick={() => onNavigate('plan')}
              className="flex min-h-[48px] w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center text-lg">
                {APPOINTMENT_KIND_EMOJI[appt.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  <span className="sr-only">{APPOINTMENT_KIND_LABEL[appt.kind]}: </span>
                  {appt.title}
                </span>
                <span className="block truncate text-xs text-ink-3">
                  {appt.time ? `${appt.time} · ` : ''}
                  {whoLabel(appt.who, state.couple.members, me.id)}
                  {appt.place ? ` · ${appt.place}` : ''}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                {dayLabel(appt.date, today)}
              </span>
            </button>
          </li>
        ) : null}
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

function Row({ item, checked, weekly = false, onToggle }: { item: CheckItem; checked: boolean; weekly?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cx(
        'flex min-h-[44px] w-full items-center gap-3 px-3 py-1 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
        checked ? 'bg-ok-soft/60' : 'hover:bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold transition-colors',
          checked ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
        )}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[15px] font-semibold leading-5', checked ? 'text-ink-2' : 'text-ink')}>
          {weekly ? <span className="mr-1 text-xs font-semibold text-brand-ink">이번 주</span> : null}
          {item.label}
        </span>
        <span className="block truncate text-[11px] leading-4 text-ink-3">
          <span aria-hidden>{KIND_ICON[item.kind]} </span>
          {weekly ? '주 1회 체크인' : item.note ? item.note : KIND_LABEL[item.kind]}
        </span>
      </span>
    </button>
  )
}
