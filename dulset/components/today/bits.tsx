'use client'

// Small presentational pieces shared by the Today screen cards.

import { cx } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { CHECK_KIND_ICON } from '@/components/ui/kindIcons'
import type { CheckKind, Member } from '@/lib/types'

/** The line icon of a check kind (components/ui/kindIcons). */
export const KIND_ICON: Record<CheckKind, IconName> = CHECK_KIND_ICON

/** A check kind's icon at the size of the text beside it. */
export function KindIcon({ kind, className }: { kind: CheckKind; className?: string }) {
  return <Icon name={KIND_ICON[kind]} className={cx('h-[18px] w-[18px] shrink-0', className)} />
}

export const KIND_LABEL: Record<CheckKind, string> = {
  supplement: '영양제',
  medication: '약',
  habit: '생활습관',
}

export function ProgressBar({
  value,
  label,
  tone = 'brand',
  track = 'surface-2',
  className,
}: {
  /** 0–1 */
  value: number
  label: string
  tone?: 'brand' | 'ok' | 'him' | 'her' | 'fert'
  /** Use 'surface' on tinted cards so the track stays visible. */
  track?: 'surface-2' | 'surface'
  className?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const fill = { brand: 'bg-brand', ok: 'bg-ok', him: 'bg-him', her: 'bg-her', fert: 'bg-fert' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx('h-2 w-full overflow-hidden rounded-full', track === 'surface' ? 'bg-surface' : 'bg-surface-2', className)}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * Inline text button that moves to another tab ("주기 보기 ›"). `arrow` adds
 * the 14px right chevron; `size="md"` is the 13/700 home-card size.
 */
export function LinkButton({
  children,
  onClick,
  className,
  arrow = false,
  size = 'sm',
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
  arrow?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] min-w-[44px] items-center gap-0.5 whitespace-nowrap text-brand-ink hover:underline',
        size === 'md' ? 'text-[13px] font-bold tracking-[-0.01em]' : 'text-xs font-semibold',
        className,
      )}
    >
      {children}
      {arrow ? <Icon name="right" className="h-3.5 w-3.5" strokeWidth={2.2} /> : null}
    </button>
  )
}

const PILL: Record<'primary' | 'soft' | 'outline' | 'surface', string> = {
  // Espresso in light, cream in dark (text-white flips to the bg colour there).
  primary: 'bg-brand text-white shadow-[0_6px_16px_-8px_rgb(var(--brand)/.55)] hover:bg-brand/90 dark:shadow-none',
  soft: 'bg-surface-2 text-ink hover:bg-line/60',
  outline: 'border-[1.5px] border-line bg-surface text-ink hover:bg-surface-2',
  surface: 'bg-surface text-ink hover:bg-line/40',
}

const PILL_SIZE: Record<'lg' | 'md' | 'split', string> = {
  lg: 'h-[50px] px-6 text-base',
  md: 'h-[46px] px-[18px] text-[15px]',
  // Two actions side by side (flex-1 each): same height as lg, tighter.
  split: 'h-[50px] min-w-0 flex-1 px-4 text-[15px]',
}

/**
 * The home's rounded action: `primary` (the moment's one action), `soft`
 * (a second choice), `outline` (a quiet full-width action), `surface` (a
 * second choice inside a surface-2 box). lg = 50px / 16px (a lone primary is
 * at least 156px wide), md = 46px / 15px, split = two pills sharing a row.
 */
export function PillButton({
  variant = 'primary',
  size = 'lg',
  full = false,
  icon,
  children,
  onClick,
  className,
}: {
  variant?: 'primary' | 'soft' | 'outline' | 'surface'
  size?: 'lg' | 'md' | 'split'
  full?: boolean
  /** A leading line icon (the primary's "+"). */
  icon?: 'plus' | 'check'
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-extrabold tracking-[-0.02em] transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        PILL_SIZE[size],
        size === 'lg' && variant === 'primary' && !full && 'min-w-[156px]',
        size !== 'split' && 'shrink-0',
        PILL[variant],
        full && 'w-full',
        className,
      )}
    >
      {icon ? <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={2.4} /> : null}
      {children}
    </button>
  )
}

/** A member's emoji on their soft colour, in the home's sizes (30px hero line, 40px 우리 한 줄). */
export function MemberBubble({ member, size }: { member: Member; size: 30 | 40 }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        size === 30 ? 'h-[30px] w-[30px] text-base' : 'h-10 w-10 text-[21px]',
        member.tracksCycle ? 'bg-her-soft' : 'bg-him-soft',
      )}
    >
      {member.emoji}
    </span>
  )
}

/** '과' after a final consonant, '와' after a vowel: 지은과 민수 · 민수와 지은. */
export function andParticle(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00
  if (code < 0 || code > 11171) return '와'
  return code % 28 === 0 ? '와' : '과'
}

/** External link that opens in a new tab, with a 44px tap target. */
export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
      <Icon name="ext" className="h-3 w-3 shrink-0" strokeWidth={2} />
      <span className="sr-only">(새 창)</span>
    </a>
  )
}

export function Badge({
  children,
  tone = 'brand',
  className,
}: {
  children: React.ReactNode
  tone?: 'brand' | 'fert' | 'ok' | 'warn' | 'period' | 'muted' | 'him' | 'her' | 'surface'
  className?: string
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    fert: 'bg-fert text-white',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    period: 'bg-period-soft text-period',
    muted: 'bg-surface-2 text-ink-2',
    him: 'bg-him-soft text-him',
    her: 'bg-her-soft text-her',
    surface: 'bg-surface text-brand-ink',
  } as const
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
