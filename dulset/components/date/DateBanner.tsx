'use client'

import { cx } from '@/components/ui'
import { IconTile, type IconName } from '@/components/ui/icons'
import { dateBanner, type DateBanner as Banner } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'

/** The banner's line icon per kind (the logic's `emoji` stays for text surfaces). */
const KIND_ICON: Record<Exclude<Banner['kind'], 'our-week'>, IconName> = {
  'low-pressure': 'sprout',
  preparing: 'heart',
  pregnant: 'bump',
  parenting: 'moon',
}

/** One gentle line of context at the top of the date tab. */
export default function DateBanner() {
  const { state, today, viewer } = useApp()
  const b = dateBanner(state, today, viewer)
  const ourWeek = b.kind === 'our-week'
  return (
    <section
      aria-label="이번 주 둘만의 시간"
      className={cx(
        'rounded-xl2 border p-4 shadow-card',
        ourWeek ? 'border-fert/20 bg-fert-soft' : 'border-brand/20 bg-brand-soft',
      )}
    >
      <div className="flex items-start gap-3">
        {b.kind === 'our-week' ? null : <IconTile name={KIND_ICON[b.kind]} tone="bg-surface/70" />}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug text-ink">{b.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{b.body}</p>
        </div>
      </div>
      {b.note ? (
        <p className="mt-3 rounded-lg bg-surface/70 px-3 py-2 text-[11px] leading-relaxed text-ink-2">{b.note}</p>
      ) : null}
    </section>
  )
}
