'use client'

// Small building blocks shared by the 아기 tab sections.

import { cx } from '@/components/ui'

export const linkClass =
  'inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-ink underline-offset-2 hover:underline'

export const primaryLinkClass =
  'inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand/90 active:bg-brand/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export function ExternalLink({
  href,
  children,
  className,
  ariaLabel,
}: {
  href: string
  children: React.ReactNode
  className?: string
  ariaLabel?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={className ?? linkClass}>
      {children}
      <span aria-hidden> ↗</span>
      {ariaLabel ? null : <span className="sr-only"> (새 창)</span>}
    </a>
  )
}

/** Round 44px tick button ("받았어요" / "했어요"). */
export function TickButton({
  checked,
  onClick,
  label,
}: {
  checked: boolean
  onClick: () => void
  /** Accessible name, e.g. "2차 건강검진 받았어요". */
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span
        aria-hidden
        className={cx(
          'flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
          checked ? 'border-ok bg-ok text-white' : 'border-line bg-surface text-transparent',
        )}
      >
        ✓
      </span>
    </button>
  )
}

/** Opens the diary tab (육아일기). */
export function goDiary() {
  window.location.hash = 'diary'
}

/** Small status pill. Text stays in ink tokens; the tone is the background. */
export function Pill({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'brand' | 'ok' | 'warn' | 'muted'
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-ink',
    ok: 'bg-ok-soft text-ink-2',
    warn: 'bg-warn-soft text-ink-2',
    muted: 'bg-surface-2 text-ink-3',
  } as const
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', tones[tone])}>
      {children}
    </span>
  )
}
