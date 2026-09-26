'use client'

import { Card, cx } from '@/components/ui'
import { PHASES, PHASE_LABEL } from '@/lib/logic/roadmap'
import { useApp } from '@/lib/store'
import { btnBrand } from './bits'
import ItemRow, { type ItemActions } from './ItemRow'
import { PHASE_SHORT, phaseGroups, type PhaseFilter, type PlanItem } from './model'

const FILTERS: Array<{ value: PhaseFilter; label: string }> = [
  { value: 'stage', label: '지금 단계' },
  ...PHASES.map((p) => ({ value: p as PhaseFilter, label: PHASE_SHORT[p] })),
  { value: 'all', label: '전체' },
]

/** Phase chips + one section per phase with progress and the item rows. */
export default function PhaseList({
  items,
  filter,
  onFilter,
  onAddCustom,
  actions,
}: {
  items: PlanItem[]
  filter: PhaseFilter
  onFilter: (f: PhaseFilter) => void
  onAddCustom: () => void
  actions: ItemActions
}) {
  const { state } = useApp()
  const groups = phaseGroups(items, filter, state)

  return (
    <section className="mt-6" aria-labelledby="plan-phases-title">
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 id="plan-phases-title" className="text-[15px] font-bold text-ink">
            단계별로 보기
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">체크하면 둘의 화면에 같이 표시돼요</p>
        </div>
        <button type="button" onClick={onAddCustom} className={btnBrand}>
          ＋ 직접 추가
        </button>
      </div>

      {/* Scrolls inside itself so the page never scrolls sideways. */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div role="group" aria-label="단계 고르기" className="flex w-max gap-1.5">
          {FILTERS.map((f) => {
            const on = f.value === filter
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={on}
                onClick={() => onFilter(f.value)}
                className="group inline-flex h-11 shrink-0 items-center rounded-full focus-visible:outline-none"
              >
                <span
                  className={cx(
                    'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                    'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand',
                    on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 group-hover:bg-surface-2',
                  )}
                >
                  {f.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2 space-y-4">
        {groups.map((g) => (
          <section key={g.phase} aria-labelledby={`plan-phase-${g.phase}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
              <h3 id={`plan-phase-${g.phase}`} className="text-sm font-bold text-ink-2">
                {PHASE_LABEL[g.phase]}
              </h3>
              <span className="text-xs font-semibold tabular-nums text-ink-3">
                <span aria-hidden>
                  {g.done}/{g.total}
                </span>
                <span className="sr-only">
                  {g.total}개 중 {g.done}개 챙김
                </span>
              </span>
            </div>
            {g.total > 0 ? (
              <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-ok" style={{ width: `${(g.done / g.total) * 100}%` }} />
              </div>
            ) : null}
            {g.hint ? (
              <p className="mb-1.5 px-1 text-[11px] text-ink-3">
                <span aria-hidden>🗓️ </span>
                {g.hint}
              </p>
            ) : null}
            {g.items.length ? (
              <Card className="px-2 py-1">
                <ul className="divide-y divide-line/60">
                  {g.items.map((it) => (
                    <ItemRow key={it.id} item={it} actions={actions} />
                  ))}
                </ul>
              </Card>
            ) : (
              <p className="px-1 text-xs text-ink-3">아직 항목이 없어요.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}
