'use client'

// Small building blocks shared by the onboarding steps (and the two places
// that reuse their chips: FirstPeriodCard and the empty 생리 log panel).

import { useId, useState } from 'react'
import { cx } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { QUICK_START_CHIPS, quickStartDate } from '@/lib/logic/onboarding'
import type { ISODate } from '@/lib/types'

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
  columns?: 1 | 2 | 3
  disabled?: boolean
  tone?: 'brand' | 'fert'
}) {
  const on = tone === 'fert' ? 'border-fert bg-fert-soft text-ink' : 'border-brand bg-brand-soft text-brand-ink'
  return (
    <div
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx(
        'grid gap-2',
        columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3',
        disabled && 'opacity-50',
      )}
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

/** Progress dots; the current one is a wider pill. Decorative — the count is read out separately. */
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

/**
 * [오늘][어제][1주 전][2주 전][3주 전] — one tap picks a start date (the date
 * itself is read out, e.g. "1주 전, 9월 25일"). `value` marks the chip that
 * matches the current date, if any.
 */
export function QuickDateChips({
  today,
  value,
  onPick,
  label = '빠른 선택',
  skip,
}: {
  today: ISODate
  value?: string
  onPick: (date: ISODate) => void
  label?: string
  /** Chips to leave out (e.g. 오늘 when today is already covered). */
  skip?: ReadonlyArray<number>
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {QUICK_START_CHIPS.filter((c) => !skip?.includes(c.daysAgo)).map((c) => {
        const date = quickStartDate(today, c.daysAgo)
        const on = value === date
        return (
          <button
            key={c.daysAgo}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(date)}
            className={cx(
              'inline-flex h-11 items-center gap-1 rounded-full border px-3.5 text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {c.label}
            <span className="sr-only">, {formatKo(date, { weekday: false })}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * "자세히 ▾" — a folded block (consent notices, install steps). A real button,
 * 44px tall, with aria-expanded; the content is simply not rendered while folded.
 */
export function Disclosure({
  label = '자세히',
  closeLabel = '접기',
  children,
  className,
  defaultOpen = false,
}: {
  label?: string
  closeLabel?: string
  children: React.ReactNode
  className?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        {open ? closeLabel : label}
        <span aria-hidden className={cx('transition-transform', open && 'rotate-180')}>
          ▾
        </span>
      </button>
      {open ? (
        <div id={id} className="pb-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}
