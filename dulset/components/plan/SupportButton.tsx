'use client'

// [같이 할게요] — the 함께하는 사람's answer to one of her items (founder request
// 2026-10-09: "여자가 챙겨야 할 것들을 남자에게도 계속 보여줘야해 같이 하는거야").
// One toggle for every place her items show on his screens (오늘's 같이 챙길 것,
// 챙길 것 rows, 임신 tab's 검사 일정): lib/logic/together supportItem /
// unsupportItem keep it in `decisions` ('support:<itemId>:<member>'), her
// screen reads it as '민수님이 같이 챙긴대요'. He can take it back any time.
// Nothing shows when the item has no support line for him, is done, or in the
// quiet after a loss (togetherRow.canSupport) — unless he already said it, so
// he can still take it back.

import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { supportItem, unsupportItem } from '@/lib/logic/together'
import { useApp } from '@/lib/store'

const base =
  "relative inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[13px] font-bold tracking-[-0.01em] transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

export default function SupportButton({
  itemId,
  title,
  supported,
  canSupport,
  done = false,
  className,
}: {
  itemId: string
  /** For the accessible name ('NT(목덜미 투명대) 같이 할게요'). */
  title: string
  /** He already said [같이 할게요]. */
  supported: boolean
  /** [같이 할게요] is possible now (lib/logic/together canSupportItem). */
  canSupport: boolean
  /** A done item: nothing left to offer. */
  done?: boolean
  className?: string
}) {
  const { update, today, me, cycleOwner } = useApp()
  const toast = useToast()
  if (done || (!supported && !canSupport)) return null

  const toggle = () => {
    if (supported) {
      update((s) => unsupportItem(s, me.id, itemId))
      toast.show('같이 할게요를 거뒀어요')
    } else {
      update((s) => supportItem(s, me.id, itemId, today))
      toast.show(`같이 챙길게요 · ${cycleOwner.name}님 화면에도 보여요`)
    }
  }

  return (
    <button
      type="button"
      aria-pressed={supported}
      aria-label={`${title} 같이 할게요`}
      data-support-button={itemId}
      onClick={toggle}
      className={cx(
        base,
        supported ? 'bg-him-soft text-ink hover:bg-him-soft/80' : 'border border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {supported ? <Icon name="check" className="h-3.5 w-3.5 text-ok" strokeWidth={2.8} /> : null}
      같이 할게요
    </button>
  )
}
