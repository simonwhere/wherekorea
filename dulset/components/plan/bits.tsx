'use client'

// Small building blocks for the 챙길 것 tab.

import { Avatar, cx } from '@/components/ui'
import type { Member, MemberId } from '@/lib/types'
import type { PillTone } from './model'

export const btn =
  'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
export const btnSecondary = cx(btn, 'bg-surface-2 text-ink-2 hover:bg-line/60')
export const btnGhost = cx(btn, 'text-ink-2 hover:bg-surface-2')
export const btnBrand = cx(btn, 'text-brand-ink hover:bg-brand-soft')
export const btnDanger = cx(btn, 'bg-period-soft text-period hover:bg-period/15')

/** 44px tap target with a 24px box. */
export function CheckBox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span
        aria-hidden
        className={cx(
          'flex h-6 w-6 items-center justify-center rounded-md border-2 text-[13px] font-bold leading-none transition-colors',
          checked ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
        )}
      >
        ✓
      </span>
    </button>
  )
}

const PILL_TONES: Record<PillTone, string> = {
  brand: 'bg-brand text-white',
  soft: 'bg-brand-soft text-brand-ink',
  ok: 'bg-ok-soft text-ink-2',
  warn: 'bg-warn-soft text-ink-2 ring-1 ring-warn/40',
  muted: 'bg-surface-2 text-ink-3',
}

export function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

/** Avatars of who looks after it + a short label ('지은' / '둘이 함께'). */
export function Owners({ owners, members, label }: { owners: MemberId[]; members: Member[]; label: string }) {
  const list = owners.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
      <span className="flex -space-x-1.5">
        {list.map((m) => (
          <span key={m.id} className="rounded-full ring-2 ring-surface">
            <Avatar member={m} size="sm" />
          </span>
        ))}
      </span>
      <span>{label}</span>
    </span>
  )
}

/**
 * A single choice among a few options, as pill buttons with a 44px tap
 * target (the visual pill is 32px).
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: React.ReactNode }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="-my-1.5 flex flex-wrap gap-x-1.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className="group inline-flex h-11 items-center rounded-full focus-visible:outline-none"
          >
            <span
              className={cx(
                'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
                'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand',
                on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 group-hover:bg-surface-2',
              )}
            >
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-ink underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
      <span aria-hidden> ↗</span>
      <span className="sr-only"> (새 창)</span>
    </a>
  )
}

/** Error line under a form field. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="-mt-2 text-xs font-medium text-period">
      {children}
    </p>
  )
}
