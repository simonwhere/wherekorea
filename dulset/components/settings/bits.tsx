'use client'

// Small building blocks shared by the settings sections.

import { Button, SectionTitle, cx } from '@/components/ui'

export function SettingsSection({
  title,
  sub,
  action,
  children,
}: {
  title: string
  sub?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="mt-7 first:mt-0">
      <SectionTitle sub={sub} action={action}>
        {title}
      </SectionTitle>
      {children}
    </section>
  )
}

/** Row of equal-width, 44px-tall choice buttons (role, sex…). */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold text-ink-2">{legend}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={cx(
                'h-11 truncate rounded-xl border px-2 text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * One option of a radio group, drawn as a card. A real (visually hidden)
 * `<input type="radio">` does the work, so arrow keys, Tab and screen readers
 * behave as they do for any radio group. Wrap a set in a fieldset/legend or a
 * `role="radiogroup"` with a label, and give every option the same `name`.
 */
export function RadioCard({
  name,
  checked,
  onSelect,
  children,
  className,
  selectedClassName = 'border-brand bg-brand-soft',
  idleClassName = 'border-line bg-surface hover:bg-surface-2',
}: {
  name: string
  checked: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
  selectedClassName?: string
  idleClassName?: string
}) {
  return (
    <label
      className={cx(
        'relative flex min-h-[44px] cursor-pointer items-center rounded-xl border transition-colors',
        checked ? selectedClassName : idleClassName,
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[3px] rounded-[15px] peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
      />
    </label>
  )
}

/** Primary + "keep as is" buttons at the bottom of a confirm sheet. */
export function ConfirmActions({
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = '그대로 둘게요',
  variant = 'primary',
  busy,
}: {
  confirmLabel: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
  cancelLabel?: string
  variant?: 'primary' | 'secondary' | 'danger'
  busy?: boolean
}) {
  return (
    <div className="mt-5 grid gap-2">
      <Button full size="lg" variant={variant} onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
      <Button full variant="ghost" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
    </div>
  )
}

/** Official-site link styled as a compact button (opens in a new tab). */
export function ExternalLinkButton({
  href,
  children,
  label,
  className,
}: {
  href: string
  children: React.ReactNode
  /** Accessible name, e.g. "난임부부 시술비 지원 — 정부24에서 보기 (새 창)". */
  label?: string
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cx(
        'inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 text-xs font-semibold text-brand-ink transition-colors hover:bg-line/60',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  )
}

/** Tiny status pill. */
export function Pill({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'ok' | 'warn' | 'brand' | 'period'
}) {
  const tones = {
    muted: 'bg-surface-2 text-ink-2',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    brand: 'bg-brand-soft text-brand-ink',
    period: 'bg-period-soft text-period',
  } as const
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', tones[tone])}>
      {children}
    </span>
  )
}
