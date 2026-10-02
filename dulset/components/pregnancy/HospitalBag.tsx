'use client'

import { useId, useState } from 'react'
import { Card, cx } from '@/components/ui'
import { Icon, IconTile } from '@/components/ui/icons'
import { BAG_GROUP_LABEL, BAG_ITEMS, BAG_PROMINENT_WEEK, type BagGroup } from '@/lib/content/pregnancy'
import { bagKey, bagProgress, bagProminent, checkedAt, toggleMilestone } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import { CheckRow } from './CheckBox'

const GROUPS: BagGroup[] = ['docs', 'mom', 'baby', 'partner']

export default function HospitalBag({ weeks, since }: { weeks: number; since: string }) {
  const { state, update, today } = useApp()
  const prominent = bagProminent(weeks)
  const [open, setOpen] = useState(prominent)
  const panelId = useId()
  const { done, total } = bagProgress(state, since)
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <Card className={prominent ? 'mt-3' : 'mt-6'} tone={prominent ? 'default' : 'muted'}>
      {/* Accordion pattern: the toggle lives inside the section heading. */}
      <h2 className="text-[15px] font-bold text-ink">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="-m-1 flex min-h-[44px] w-[calc(100%+0.5rem)] items-center gap-3 rounded-xl p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <IconTile name="bag" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block">출산 가방</span>
            <span className="block text-xs font-normal text-ink-3">
              {prominent
                ? done === total
                  ? '다 챙겼어요. 현관 가까이 두세요!'
                  : '조금씩 같이 싸 두면 든든해요'
                : `${BAG_PROMINENT_WEEK}주 무렵부터 싸기 시작하면 여유로워요`}
            </span>
          </span>
          <span className="text-xs font-semibold tabular-nums text-ink-2">
            <span aria-hidden>
              {done}/{total}
            </span>
            <span className="sr-only">
              {total}개 중 {done}개 챙김
            </span>
          </span>
          <Icon name="chev" className={cx('h-4 w-4 text-ink-3 transition-transform', open && 'rotate-180')} strokeWidth={2.2} />
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-line/60"
          role="progressbar"
          aria-label="출산 가방 준비"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
        </div>
        {GROUPS.map((g) => (
          <div key={g} className="mt-3">
            <h3 className="px-1 text-[11px] font-semibold text-ink-3">{BAG_GROUP_LABEL[g]}</h3>
            <ul className="mt-0.5">
              {BAG_ITEMS.filter((i) => i.group === g).map((item) => {
                const key = bagKey(item.id)
                return (
                  <li key={item.id}>
                    <CheckRow
                      checked={!!checkedAt(state, key, since)}
                      onToggle={() => update((s) => toggleMilestone(s, key, today, since))}
                      label={item.label}
                      note={item.note}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
          병원·조리원마다 챙겨 주는 물품이 달라요. 미리 확인하면 짐이 줄어요.
        </p>
      </div>
    </Card>
  )
}
