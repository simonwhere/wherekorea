'use client'

// Small building blocks shared by the onboarding steps.

import { cx } from '@/components/ui'

export interface Option<T extends string> {
  value: T
  label: React.ReactNode
  emoji?: string
  /** Accessible name when `label` isn't plain text. */
  ariaLabel?: string
}

/**
 * A row of large (≥44px) toggle buttons where exactly one is selected.
 * Uses aria-pressed buttons inside a labelled group.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 3,
  disabled,
  tone = 'brand',
}: {
  label: string
  options: Option<T>[]
  value: T | undefined
  onChange: (next: T) => void
  columns?: 2 | 3
  disabled?: boolean
  tone?: 'brand' | 'fert'
}) {
  const on = tone === 'fert' ? 'border-fert bg-fert-soft text-ink' : 'border-brand bg-brand-soft text-brand-ink'
  return (
    <div
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx('grid gap-2', columns === 2 ? 'grid-cols-2' : 'grid-cols-3', disabled && 'opacity-50')}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            aria-label={o.ariaLabel}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              'disabled:cursor-not-allowed',
              selected ? on : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {o.emoji ? (
              <span aria-hidden className="text-base">
                {o.emoji}
              </span>
            ) : null}
            <span className="min-w-0 truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Six dots; the current one is a wider pill. Decorative — the count is read out separately. */
export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">
        {total}단계 중 {step}단계
      </span>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        return (
          <span
            key={n}
            aria-hidden
            className={cx(
              'h-2 rounded-full transition-all',
              n === step ? 'w-6 bg-brand' : n < step ? 'w-2 bg-brand/50' : 'w-2 bg-line',
            )}
          />
        )
      })}
    </div>
  )
}

/** Label + control stacked, for inputs that aren't wrapped by a <label>. */
export function Group({
  title,
  hint,
  children,
  id,
}: {
  title: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
  id?: string
}) {
  return (
    <div>
      <p id={id} className="mb-1.5 text-xs font-semibold text-ink-2">
        {title}
      </p>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  )
}

/** A phone-notification look-alike used to preview alert wording. */
export function NoticePreview({ title, body, muted }: { title: string; body: string; muted?: boolean }) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface-2 px-3 py-2.5', muted && 'opacity-60')}>
      <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <span className="font-bold text-brand">둘셋</span>
        <span aria-hidden>·</span>
        <span>미리보기</span>
      </div>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{body}</p> : null}
    </div>
  )
}

export function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center text-[11px] text-ink-3 underline underline-offset-2 hover:text-ink-2"
    >
      {children}
    </a>
  )
}
