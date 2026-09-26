'use client'

// Shared UI primitives. Feature screens should compose these instead of
// re-inventing card/button styles, so the app reads as one system.

import { useEffect, useId, useRef } from 'react'
import type { Member } from '@/lib/types'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function Card({
  children,
  className,
  tone = 'default',
  as: Tag = 'section',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'default' | 'brand' | 'fert' | 'ok' | 'warn' | 'muted'
  as?: 'section' | 'div' | 'article' | 'li'
}) {
  const tones = {
    default: 'bg-surface border-line',
    brand: 'bg-brand-soft border-brand/20',
    fert: 'bg-fert-soft border-fert/20',
    ok: 'bg-ok-soft border-ok/20',
    warn: 'bg-warn-soft border-warn/25',
    muted: 'bg-surface-2 border-transparent',
  } as const
  return <Tag className={cx('rounded-xl2 border p-4 shadow-card', tones[tone], className)}>{children}</Tag>
}

export function SectionTitle({
  children,
  action,
  sub,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-3 px-1 first:mt-0">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{children}</h2>
        {sub ? <p className="mt-0.5 text-xs text-ink-3">{sub}</p> : null}
      </div>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  className,
  full,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  full?: boolean
  ariaLabel?: string
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-white hover:bg-brand/90 active:bg-brand/80',
    secondary: 'bg-surface-2 text-ink hover:bg-line/60',
    ghost: 'bg-transparent text-ink-2 hover:bg-surface-2',
    danger: 'bg-period-soft text-period hover:bg-period/15',
  }
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-11 px-4 text-sm', lg: 'h-13 min-h-[52px] px-5 text-base' }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  selected,
  onClick,
  tone = 'brand',
  className,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  tone?: 'brand' | 'fert' | 'him' | 'her' | 'ok'
  className?: string
}) {
  const on = {
    brand: 'bg-brand text-white border-brand',
    fert: 'bg-fert text-white border-fert',
    him: 'bg-him text-white border-him',
    her: 'bg-her text-white border-her',
    ok: 'bg-ok text-white border-ok',
  }[tone]
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': !!selected } : {})}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
        selected ? on : 'border-line bg-surface text-ink-2',
        onClick && !selected && 'hover:bg-surface-2',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  description?: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-3">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'block h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export const textareaClass =
  'block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

/** Bottom sheet dialog. Closes on backdrop tap and Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="pb-safe relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-5 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: React.ReactNode
  body?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-line px-6 py-8 text-center">
      <div className="text-3xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Small colored avatar for a couple member. */
export function Avatar({ member, size = 'md' }: { member: Member; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-6 w-6 text-sm', md: 'h-9 w-9 text-lg', lg: 'h-12 w-12 text-2xl' }
  const tone = member.tracksCycle ? 'bg-her-soft' : 'bg-him-soft'
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full', sizes[size], tone)}
      aria-hidden
    >
      {member.emoji}
    </span>
  )
}

/** Small disclaimer line used under any health-related number. */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-ink-3">{children}</p>
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums text-ink">{value}</div>
      {sub ? <div className="text-[11px] text-ink-3">{sub}</div> : null}
    </div>
  )
}
