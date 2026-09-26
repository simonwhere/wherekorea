'use client'

import { cx } from '@/components/ui'
import { MOODS } from '@/lib/logic/diaryExport'

/** Optional single-select mood. Tapping the selected mood clears it. */
export default function MoodPicker({
  value,
  onChange,
  label = '오늘의 기분 (선택)',
}: {
  value: string | undefined
  onChange: (next: string | undefined) => void
  label?: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {MOODS.map((m) => {
        const on = value === m.emoji
        return (
          <button
            key={m.emoji}
            type="button"
            aria-pressed={on}
            aria-label={m.label}
            title={m.label}
            onClick={() => onChange(on ? undefined : m.emoji)}
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-full border text-xl transition',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              on ? 'scale-105 border-brand bg-brand-soft' : 'border-transparent bg-surface-2 opacity-80 hover:opacity-100',
            )}
          >
            <span aria-hidden>{m.emoji}</span>
          </button>
        )
      })}
    </div>
  )
}
