'use client'

// The 오늘 컨디션 chips (N11): six plain words for how the day felt, one at a
// time, saved to her own log (lib/logic/personalLog.ts — 본인만 보기). Pure
// UI: the panel that owns the state (components/log/FeelPanel.tsx) decides
// who may see it. Tapping the chosen chip again clears it.

import { cx } from '@/components/ui'
import { FEEL_CHIPS } from '@/lib/content/fertility'
import type { PersonalFeel } from '@/lib/types'

export default function FeelChips({
  value,
  onChange,
  className,
}: {
  value?: PersonalFeel
  onChange: (feel: PersonalFeel | undefined) => void
  className?: string
}) {
  return (
    <div role="group" aria-label="오늘 컨디션" className={cx('flex flex-wrap gap-2', className)}>
      {FEEL_CHIPS.map((c) => {
        const on = value === c.feel
        return (
          <button
            key={c.feel}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : c.feel)}
            className={cx(
              'inline-flex min-h-[44px] items-center rounded-full border px-4 text-[13.5px] font-semibold transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
