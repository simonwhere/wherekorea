'use client'

import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'

/** 44px tap target with a 24px visual box. */
export function CheckBox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  /** Accessible name, e.g. "정밀 초음파 완료". */
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <CheckMark checked={checked} />
    </button>
  )
}

export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors',
        checked ? 'border-ok bg-ok text-white' : 'border-line bg-surface text-transparent',
      )}
    >
      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
}

/** Whole-row checkbox for simple lists (출산 가방). */
export function CheckRow({
  checked,
  onToggle,
  label,
  note,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  note?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <CheckMark checked={checked} />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm', checked ? 'text-ink-3 line-through' : 'text-ink')}>{label}</span>
        {note ? <span className="block text-[11px] text-ink-3">{note}</span> : null}
      </span>
    </button>
  )
}
