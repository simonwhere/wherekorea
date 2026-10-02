'use client'

// Small pieces the partner page shares: a member's bubble from the snapshot's
// member (no Member object here — only what the snapshot carries), the pill
// used for every action on the page, and the time labels.

import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SnapshotMember } from '@/lib/logic/partnerSnapshot'
import type { MemberId } from '@/lib/types'

/** A member's emoji on their soft colour; `her` is the cycle owner. */
export function Bubble({ member, her, size = 30 }: { member: SnapshotMember; her: boolean; size?: 30 | 40 }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        size === 30 ? 'h-[30px] w-[30px] text-base' : 'h-10 w-10 text-[21px]',
        her ? 'bg-her-soft' : 'bg-him-soft',
      )}
    >
      {member.emoji}
    </span>
  )
}

/** The soft fill of a member's bubble / bar: her colour for the cycle owner. */
export const isHer = (id: MemberId, cycleOwner: MemberId) => id === cycleOwner

/** A pill action (40px, 44px to tap) — the page's one kind of button. */
export function Pill({
  onClick,
  tone = 'soft',
  icon,
  disabled,
  children,
  className,
  ariaLabel,
}: {
  onClick: () => void
  tone?: 'primary' | 'soft' | 'outline'
  icon?: 'check' | 'plus'
  disabled?: boolean
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        "relative inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full px-3.5 text-[13.5px] font-bold transition-colors before:absolute before:-inset-y-0.5 before:inset-x-0 before:content-['']",
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40',
        tone === 'primary' && 'bg-brand text-white hover:bg-brand/90',
        tone === 'soft' && 'bg-surface-2 text-ink hover:bg-line/60',
        tone === 'outline' && 'border-[1.5px] border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {icon ? <Icon name={icon} className="h-4 w-4" strokeWidth={2.4} /> : null}
      {children}
    </button>
  )
}

/** '오후 6:12' from a local ISO time; '' when it has none. */
export function timeKo(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return ''
  const h = Number(m[1])
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m[2]}`
}

/** '오후 6:12' from a clock value (ms). */
export function clockKo(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A quiet section heading on the page. */
export function Heading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 px-1 first:mt-0">
      <h2 className="text-[15px] font-bold text-ink">{children}</h2>
      {sub ? <p className="mt-0.5 text-xs text-ink-3">{sub}</p> : null}
    </div>
  )
}
