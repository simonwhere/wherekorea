'use client'

import { useId, useState } from 'react'
import { withTicked } from '@/components/today/model'
import { Card, cx } from '@/components/ui'
import { recentlyEnded } from '@/lib/logic/pregnancy'
import { useApp } from '@/lib/store'
import ItemRow, { type ItemActions } from './ItemRow'
import { calmSuggestions, planFocus, type PlanItem } from './model'

const SHOWN = 3

/**
 * "이번 주 챙길 것": overdue deadlines first, then what's open now, then what
 * opens within two weeks. When nothing is due, a calm "여유 있을 때" list.
 * Rows ticked here stay (as done) until the tab is left, so the list doesn't
 * jump under the finger and keyboard focus stays on the checkbox.
 */
export default function FocusCard({ items, actions }: { items: PlanItem[]; actions: ItemActions }) {
  const { state, today } = useApp()
  const [more, setMore] = useState(false)
  const [ticked, setTicked] = useState<Array<{ id: string; index: number }>>([])
  const moreId = useId()
  const focus = withTicked(planFocus(items), items, ticked)
  // Right after a pregnancy ended, no "임신 준비" suggestions (as on 오늘).
  const resting = recentlyEnded(state, today)
  const calm = focus.length || resting ? [] : withTicked(calmSuggestions(items, state.stage), items, ticked)
  const overdue = focus.some((i) => i.status === 'overdue')
  const rows = focus.length ? focus : calm
  const allDone = rows.length > 0 && rows.every((i) => i.status === 'done')
  const extra = rows.length - SHOWN
  const subtitle = allDone
    ? '여기 있는 건 모두 챙겼어요. 수고했어요 👏'
    : overdue
      ? '기한이 지난 일이 있어요. 지금이라도 할 수 있는지 확인해 봐요.'
      : focus.length
        ? '지금 할 수 있는 것과 곧 시작되는 것만 모았어요.'
        : rows.length
          ? '급한 건 없어요. 여유 있을 때 하나씩 살펴봐요.'
          : resting
            ? '지금 챙길 건 없어요. 천천히 쉬어 가도 괜찮아요.'
            : '지금 챙길 건 모두 챙겼어요. 수고했어요 👏'

  const cardActions: ItemActions = {
    ...actions,
    onToggle: (item) => {
      if (item.status !== 'done') {
        const index = rows.findIndex((r) => r.id === item.id)
        setTicked((t) => [...t.filter((x) => x.id !== item.id), { id: item.id, index }])
      } else {
        setTicked((t) => t.filter((x) => x.id !== item.id))
      }
      actions.onToggle(item)
    },
  }

  return (
    <Card tone={overdue ? 'warn' : 'brand'} className="px-3 pb-2 pt-3.5">
      <div className="px-1">
        <h2 className="text-[15px] font-bold text-ink">이번 주 챙길 것</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          {subtitle}
        </p>
      </div>
      {rows.length ? (
        <ul className="mt-1.5 divide-y divide-line/60">
          {rows.slice(0, SHOWN).map((it) => (
            <ItemRow key={it.id} item={it} compact actions={cardActions} />
          ))}
        </ul>
      ) : null}
      {extra > 0 ? (
        <>
          <ul id={moreId} hidden={!more} className="divide-y divide-line/60 border-t border-line/60">
            {rows.slice(SHOWN).map((it) => (
              <ItemRow key={it.id} item={it} compact actions={cardActions} />
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            aria-controls={moreId}
            className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl text-xs font-semibold text-ink-2 hover:bg-surface/60"
          >
            {more ? '접기' : `${extra}개 더 보기`}
            <span aria-hidden className={cx('transition-transform', more && 'rotate-180')}>
              ▾
            </span>
          </button>
        </>
      ) : null}
    </Card>
  )
}
