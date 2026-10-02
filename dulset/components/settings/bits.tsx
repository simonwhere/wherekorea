'use client'

// Small building blocks shared by the settings sections.

import { createContext, useContext, useId } from 'react'
import { Button, SectionTitle, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SettingsAnchor } from './anchors'

/**
 * Which sections are unfolded (SettingsTab owns the set: the first one and
 * any section a deep link or the chip table of contents asked for). Without
 * a provider every section is open, as before.
 */
export interface SectionsApi {
  isOpen: (id: SettingsAnchor) => boolean
  toggle: (id: SettingsAnchor) => void
}

export const SectionsContext = createContext<SectionsApi | null>(null)

export function SettingsSection({
  id,
  title,
  sub,
  action,
  children,
}: {
  /** Stable anchor (SETTINGS_ANCHORS) that links like #share / #data land on. */
  id?: SettingsAnchor
  title: string
  sub?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const sections = useContext(SectionsContext)
  const headingId = useId()
  const bodyId = useId()
  const foldable = !!sections && !!id
  const open = !foldable || sections.isOpen(id)
  if (!foldable) {
    return (
      // globals.css scroll-padding-top keeps the heading clear of the sticky top bar when scrolled to.
      <section id={id} aria-label={title} className="mt-7 first:mt-0">
        <SectionTitle sub={sub} action={action}>
          {title}
        </SectionTitle>
        {children}
      </section>
    )
  }
  return (
    // Folded: the heading (a disclosure button) and its one-line sub stay; the body mounts when opened.
    // scroll-mt: the sticky chip row (SettingsTab) on top of html's scroll-padding-top (the top bar).
    <section id={id} aria-labelledby={headingId} className={cx('scroll-mt-24', open ? 'mt-7 first:mt-0' : 'mt-1 first:mt-0')}>
      <div className={cx('flex items-end justify-between gap-3 px-1', open ? 'mb-2' : 'border-b border-line/70 pb-1')}>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-[15px] font-bold text-ink">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? bodyId : undefined}
              onClick={() => sections.toggle(id)}
              className="-ml-1 flex min-h-[44px] w-full items-center gap-1.5 rounded-lg px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="min-w-0 flex-1">{title}</span>
              <Icon
                name="chev"
                className={cx('h-[18px] w-[18px] shrink-0 text-ink-3 transition-transform', open && 'rotate-180')}
                strokeWidth={2}
              />
            </button>
          </h2>
          {sub ? <p className={cx('text-xs text-ink-3', open ? '-mt-1' : '-mt-1.5 pb-1.5')}>{sub}</p> : null}
        </div>
        {open ? action : null}
      </div>
      {open ? <div id={bodyId}>{children}</div> : null}
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
  disabled,
}: {
  name: string
  checked: boolean
  onSelect: () => void
  children: React.ReactNode
  className?: string
  selectedClassName?: string
  idleClassName?: string
  /** Shown but not choosable (e.g. only the other person may change it). */
  disabled?: boolean
}) {
  return (
    <label
      className={cx(
        'relative flex min-h-[44px] items-center rounded-xl border transition-colors',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        checked ? selectedClassName : idleClassName,
        disabled && !checked && 'opacity-60',
        className,
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} disabled={disabled} className="peer sr-only" />
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
      <Icon name="ext" className="h-3.5 w-3.5" strokeWidth={2.2} />
    </a>
  )
}

/** Tiny status pill. */
export function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'brand' | 'period' }) {
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
