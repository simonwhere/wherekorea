'use client'

// 같이 챙길 것 on the partner page (founder request 2026-10-09: "여자가 챙겨야
// 할 것들을 남자에게도 계속 보여줘야해 같이 하는거야"). Her roadmap items of the
// near term and the ones they share — tests, checkups, vaccines, vouchers,
// admin, work programs — each with what HE can do to share it, drawn from the
// snapshot as her phone computed it (lib/logic/partnerSnapshot togetherPlan →
// together.linkTogether): the catalogue title, a NEUTRAL status ('예정 · 10월
// 21일' / '이번 주' / '했어요 ✓' — never '기한 지남', never a warning about her;
// a passed one is simply not here), his support line, and [같이 할게요]. A tap
// is a 'support' event (an item id and on / off); her phone keeps it and her
// screen reads '민수님이 같이 챙긴대요'. He can take it back. Nothing here is a
// record of hers: no result, no note, no time or place of her appointments.
// The first TOGETHER_FOLD rows show; the rest open with 'N개 더 보기', so the
// rest of his page stays within reach.

import { useState } from 'react'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ROADMAP_KIND_ICON } from '@/components/ui/kindIcons'
import type { SnapshotTogetherPlan } from '@/lib/logic/partnerSnapshot'
import type { LinkTogetherItem } from '@/lib/logic/together'
import { Pill } from './bits'
import { TOGETHER_BLOCK_TITLE, TOGETHER_FOLD, togetherBlockSub, togetherFoldLabel, togetherShort } from './model'

/** Neutral tones only — the brand for this week, quiet for later, ok once done. Never warn. */
const STATUS_TONE: Record<LinkTogetherItem['status'], string> = {
  'this-week': 'text-brand-ink',
  upcoming: 'text-ink-3',
  done: 'text-ok',
}

/**
 * [같이 할게요] for one item — or, once said, '같이 하기로 했어요' with 취소. Also
 * drawn by the stage card for the item its next visit is booked for
 * (LinkStage), whose row then leaves this list. Nothing when it can't be said.
 */
export function SupportToggle({ item, onSupport }: { item: LinkTogetherItem; onSupport: (item: LinkTogetherItem, on: boolean) => void }) {
  const short = togetherShort(item.title)
  if (item.supported) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1">
        <span role="status" className="inline-flex min-h-10 items-center gap-1 text-[13.5px] font-bold text-ok" data-together-supported>
          <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
          같이 하기로 했어요
        </span>
        <button
          type="button"
          onClick={() => onSupport(item, false)}
          aria-label={`‘${short}’ 같이 하기 취소`}
          className="inline-flex min-h-[44px] items-center px-2 text-[12.5px] font-bold text-ink-3 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          취소
        </button>
      </div>
    )
  }
  if (!item.canSupport) return null
  return (
    <div className="mt-2">
      <Pill tone="outline" icon="plus" onClick={() => onSupport(item, true)} ariaLabel={`‘${short}’ 같이 할게요`}>
        같이 할게요
      </Pill>
    </div>
  )
}

function Row({
  item,
  ownerName,
  onSupport,
}: {
  item: LinkTogetherItem
  ownerName: string
  onSupport: (item: LinkTogetherItem, on: boolean) => void
}) {
  const open = item.status !== 'done'
  return (
    <li className="flex items-start gap-3 py-3" data-together-item={item.id} data-status={item.status}>
      <span
        aria-hidden
        className={cx(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          item.whose === 'theirs' ? 'bg-her-soft text-her' : 'bg-brand-soft text-brand-ink',
        )}
      >
        <Icon name={ROADMAP_KIND_ICON[item.kind]} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">{item.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-3">
          {item.whose === 'theirs' ? ownerName : '둘이 함께'} ·{' '}
          <span data-together-label className={cx('font-semibold', STATUS_TONE[item.status])}>
            {item.label}
          </span>
        </p>
        {open ? (
          <div className="mt-2 rounded-[14px] bg-surface-2 px-3 py-2.5">
            <p className="text-[13px] leading-[1.5] text-ink-2" data-together-support>
              <b className="font-bold text-ink">내가 할 수 있는 것</b> · {item.support}
            </p>
            {item.supportNote ? <p className="mt-1 text-[12px] leading-[1.5] text-ink-3">{item.supportNote}</p> : null}
            <SupportToggle item={item} onSupport={onSupport} />
          </div>
        ) : null}
      </div>
    </li>
  )
}

export default function LinkTogether({
  plan,
  onSupport,
  className,
}: {
  /** The list with his local marks applied (model.viewTogetherPlan). */
  plan: SnapshotTogetherPlan
  onSupport: (item: LinkTogetherItem, on: boolean) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const hidden = Math.max(0, plan.items.length - TOGETHER_FOLD)
  const rows = open || !hidden ? plan.items : plan.items.slice(0, TOGETHER_FOLD)
  return (
    <section
      aria-label={TOGETHER_BLOCK_TITLE}
      data-together
      className={cx(
        'rounded-card bg-surface px-[18px] pt-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none',
        hidden ? 'pb-2' : 'pb-1.5',
        className,
      )}
    >
      <p className="text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">{TOGETHER_BLOCK_TITLE}</p>
      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-3">{togetherBlockSub(plan.ownerName)}</p>
      <ul id="together-rows" aria-label={TOGETHER_BLOCK_TITLE} className="mt-1 divide-y divide-line/70">
        {rows.map((item) => (
          <Row key={item.id} item={item} ownerName={plan.ownerName} onSupport={onSupport} />
        ))}
      </ul>
      {hidden ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="together-rows"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 border-t border-line/70 text-[13px] font-bold text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {togetherFoldLabel(hidden, open)}
          <Icon name="chev" className={cx('h-4 w-4 transition-transform', open ? 'rotate-180' : '')} />
        </button>
      ) : null}
    </section>
  )
}
