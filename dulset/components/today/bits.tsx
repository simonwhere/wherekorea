'use client'

// Small presentational pieces shared by the Today screen cards.

import { cx } from '@/components/ui'
import type { CheckKind } from '@/lib/types'

export const KIND_ICON: Record<CheckKind, string> = {
  supplement: '💊',
  medication: '💉',
  habit: '🌿',
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

/** Inline text button that moves to another tab ("달력 →"). */
export function LinkButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[44px] min-w-[44px] items-center gap-0.5 text-xs font-semibold text-brand-ink hover:underline',
        className,
      )}
    >
      {children}
    </button>
  )
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
      <span aria-hidden>↗</span>
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
