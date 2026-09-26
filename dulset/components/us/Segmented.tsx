'use client'

import { useRef } from 'react'
import { cx } from '@/components/ui'

export interface SegmentOption<K extends string> {
  key: K
  label: string
}

export const segmentTabId = (base: string, key: string) => `${base}-tab-${key}`
export const segmentPanelId = (base: string, key: string) => `${base}-panel-${key}`

/**
 * Segmented control with tab semantics (← → Home End move between segments).
 * Render the panel with `id={segmentPanelId(base, value)}` and
 * `aria-labelledby={segmentTabId(base, value)}`.
 */
export default function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  base,
}: {
  options: ReadonlyArray<SegmentOption<K>>
  value: K
  onChange: (next: K) => void
  label: string
  /** Unique id prefix (useId). */
  base: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = options.length - 1
    const to =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1
    if (to < 0) return
    e.preventDefault()
    onChange(options[to]!.key)
    refs.current[to]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="grid rounded-2xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o, i) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={segmentTabId(base, o.key)}
            aria-selected={on}
            // Only the shown panel exists, so only its tab points at it.
            aria-controls={on ? segmentPanelId(base, o.key) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'h-11 rounded-xl text-sm font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
              on ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
