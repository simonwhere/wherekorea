'use client'

// 오늘 → 챙길 것: the next appointments and what to look after this week.
// Rows read the same view model as the 챙길 것 tab, so both screens agree.

import { useMemo, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import ItemRow, { type ItemActions } from '@/components/plan/ItemRow'
import { calmSuggestions, planFocus, planItems, tickItem, type PlanItem } from '@/lib/logic/plan'
import { Card, cx, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { APPOINTMENT_KIND_EMOJI, APPOINTMENT_KIND_LABEL } from '@/lib/logic/appointments'
import { recentlyEnded } from '@/lib/logic/pregnancy'
import { useApp } from '@/lib/store'
import { LinkButton } from './bits'
import { FOCUS_MAX, dayLabel, homeAppointments, upcomingForToday, whoLabel, withTicked } from './model'

type Nav = (tab: TabKey) => void

function CardHead({ icon, title, sub, onMore }: { icon: string; title: string; sub?: string; onMore: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="min-w-0 pt-1">
        <h2 className="text-[15px] font-bold text-ink">
          <span aria-hidden>{icon} </span>
          {title}
        </h2>
        {sub ? <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{sub}</p> : null}
      </div>
      <LinkButton onClick={onMore} className="-mr-1 -mt-2 shrink-0">
        전체 보기 <span aria-hidden>→</span>
        <span className="sr-only">: 챙길 것 탭에서 {title}</span>
      </LinkButton>
    </div>
  )
}

// ── 다가오는 일정 ───────────────────────────────────────────

/** The next two appointments within two weeks (hidden when there are none). */
export function UpcomingCard({ onNavigate }: { onNavigate: Nav }) {
  const { state, today, me } = useApp()
  const list = upcomingForToday(homeAppointments(state), today)
  if (list.length === 0) return null
  const members = state.couple.members
  const openPlan = () => onNavigate('plan')

  return (
    <Card className="px-3 pb-1.5 pt-3">
      <CardHead icon="📅" title="다가오는 일정" onMore={openPlan} />
      <ul className="mt-1 divide-y divide-line/60">
        {list.map((a) => {
          const label = dayLabel(a.date, today)
          const close = label === '오늘' || label === '내일'
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={openPlan}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg"
                >
                  {APPOINTMENT_KIND_EMOJI[a.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    <span className="sr-only">{APPOINTMENT_KIND_LABEL[a.kind]}: </span>
                    {a.title}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium tabular-nums text-ink-2">
                    {formatKo(a.date)}
                    {a.time ? ` ${a.time}` : ''}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {whoLabel(a.who, members, me.id)}
                    {a.place ? ` · ${a.place}` : ''}
                  </span>
                </span>
                <span
                  className={cx(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                    close ? 'bg-brand text-white' : 'bg-brand-soft text-brand-ink',
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ── 이번 주 챙길 것 ─────────────────────────────────────────

/**
 * Up to three items that matter this week (overdue deadlines, open windows,
 * windows opening within two weeks), tickable here. With nothing due, a quiet
 * one-line link instead — and nothing at all right after a pregnancy ended.
 */
export function PlanFocusCard({ onNavigate }: { onNavigate: Nav }) {
  const { state, update, today, me } = useApp()
  const toast = useToast()
  const items = useMemo(() => planItems(state, today), [state, today])
  // Rows ticked here stay (as done) until the tab is left, so the list doesn't jump.
  const [ticked, setTicked] = useState<Array<{ id: string; index: number }>>([])
  const rows = withTicked(planFocus(items, FOCUS_MAX), items, ticked)
  const openPlan = () => onNavigate('plan')

  const actions: ItemActions = {
    onToggle: (item: PlanItem) => {
      const done = item.status !== 'done'
      update(tickItem(item.id, done, today, me.id))
      if (done) {
        const index = rows.findIndex((r) => r.id === item.id)
        setTicked((t) => [...t.filter((x) => x.id !== item.id), { id: item.id, index }])
        toast.show('챙겼어요 ✓')
      } else {
        setTicked((t) => t.filter((x) => x.id !== item.id))
      }
    },
    // Compact rows only tick; everything else lives on the 챙길 것 tab.
    onSchedule: openPlan,
    onOpenAppointment: openPlan,
    onDeleteCustom: openPlan,
  }

  if (rows.length === 0) {
    const calm = recentlyEnded(state, today) ? [] : calmSuggestions(items, state.stage)
    if (calm.length === 0) return null
    return (
      <button
        type="button"
        onClick={openPlan}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-xl bg-surface-2 px-4 py-2.5 text-left transition-colors hover:bg-line/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span aria-hidden>✅</span>
        <span className="min-w-0 flex-1 text-xs text-ink-2">
          <b className="font-semibold text-ink">챙길 것</b> · 급한 건 없어요. 여유 있을 때 둘이 같이 살펴봐요
        </span>
        <span aria-hidden className="text-ink-3">
          →
        </span>
      </button>
    )
  }

  const overdue = rows.some((r) => r.status === 'overdue')
  const allDone = rows.every((r) => r.status === 'done')
  return (
    <Card className="px-3 pb-2 pt-3">
      <CardHead
        icon="✅"
        title="이번 주 챙길 것"
        sub={
          allDone
            ? '이번 주 챙길 것을 모두 챙겼어요. 수고했어요 👏'
            : overdue
              ? '기한이 지난 일이 있어요. 지금이라도 할 수 있는지 같이 확인해 봐요.'
              : '지금 할 수 있는 것과 곧 시작되는 것만 모았어요.'
        }
        onMore={openPlan}
      />
      <ul className="mt-1 divide-y divide-line/60">
        {rows.map((it) => (
          <ItemRow key={it.id} item={it} compact actions={actions} />
        ))}
      </ul>
    </Card>
  )
}
