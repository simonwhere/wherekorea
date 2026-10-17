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
//
// Once said, it reads the way the link draws it (founder decision 2026-10-17 —
// one wording, lib/content/supportCopy): a check + '같이 하기로 했어요' and a
// separate small [취소], not a pressed pill. That is wider than the button, so
// each row places the said state on its own (`saidClassName`: under the row's
// text, like the link). Focus follows the tap: [같이 할게요] → [취소] → back.

import { useEffect, useRef } from 'react'
import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import {
  SUPPORT_CANCEL,
  SUPPORT_LABEL,
  SUPPORT_PRESSED,
  SUPPORT_TOAST_OFF,
  supportAriaLabel,
  supportCancelAriaLabel,
  supportToastAppOn,
} from '@/lib/content/supportCopy'
import { supportItem, unsupportItem } from '@/lib/logic/together'
import { useApp } from '@/lib/store'

const ring = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** 36px to look at, 44px to tap: the ::before reaches 4px above and below (5px from inside a 1px border). */
const tall = "relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"

const button = cx(
  'inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[13px] font-bold tracking-[-0.01em] text-ink transition-colors hover:bg-surface-2',
  "relative before:absolute before:-inset-y-[5px] before:inset-x-0 before:content-['']",
  ring,
)

export default function SupportButton({
  itemId,
  short,
  supported,
  canSupport,
  done = false,
  className,
  saidClassName,
}: {
  itemId: string
  /** The item's short name, for the accessible names ('‘NT(목덜미 투명대)’ 같이 할게요' · '… 같이 하기 취소'). */
  short: string
  /** He already said [같이 할게요]. */
  supported: boolean
  /** [같이 할게요] is possible now (lib/logic/together canSupportItem). */
  canSupport: boolean
  /** A done item: nothing left to offer. */
  done?: boolean
  /** On [같이 할게요]. */
  className?: string
  /** On the said state ('같이 하기로 했어요' + [취소]) — where the row puts it. */
  saidClassName?: string
}) {
  const { update, today, me, cycleOwner } = useApp()
  const toast = useToast()
  const offerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Set by a tap here, so focus moves to what replaced the tapped button (and not on a change from elsewhere).
  const moveFocus = useRef(false)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(supported ? cancelRef : offerRef).current?.focus()
  }, [supported])

  if (done || (!supported && !canSupport)) return null

  if (supported) {
    return (
      <div data-support-button={itemId} data-support-said className={cx('flex flex-wrap items-center gap-x-0.5', saidClassName)}>
        <span role="status" className="inline-flex h-9 items-center gap-1 text-[13px] font-bold tracking-[-0.01em] text-ok">
          <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {SUPPORT_PRESSED}
        </span>
        <button
          ref={cancelRef}
          type="button"
          onClick={() => {
            moveFocus.current = true
            update((s) => unsupportItem(s, me.id, itemId))
            toast.show(SUPPORT_TOAST_OFF)
          }}
          aria-label={supportCancelAriaLabel(short)}
          data-support-cancel
          className={cx('inline-flex h-9 items-center rounded-lg px-2 text-[12.5px] font-bold text-ink-3 hover:underline', tall, ring)}
        >
          {SUPPORT_CANCEL}
        </button>
      </div>
    )
  }

  return (
    <button
      ref={offerRef}
      type="button"
      aria-label={supportAriaLabel(short)}
      data-support-button={itemId}
      onClick={() => {
        moveFocus.current = true
        update((s) => supportItem(s, me.id, itemId, today))
        toast.show(supportToastAppOn(cycleOwner.name))
      }}
      className={cx(button, className)}
    >
      <Icon name="plus" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />
      {SUPPORT_LABEL}
    </button>
  )
}
