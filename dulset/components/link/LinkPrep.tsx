'use client'

// '내 준비' on the partner page (Now 3 N30) — the same compact bar his app
// home shows under '이번 주 우리 둘' (components/today/MyPrepBar), drawn from
// the snapshot's myPrep (lib/logic/myPrep through partnerSnapshot.linkMyPrep:
// his habit timer with its bar, this week's N/7, his 검사 chain step — his
// own records only, each part only when it has something to say; no 0, no
// '안 했어요'). Read-only: nothing here sends anything.

import { ProgressBar } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SnapshotMyPrep } from '@/lib/logic/partnerSnapshot'

export default function LinkPrep({ prep, className }: { prep: SnapshotMyPrep; className?: string }) {
  const line = [prep.weekCount, prep.chainStep].filter(Boolean)
  if (!prep.timerLabel && !line.length) return null
  return (
    <section
      aria-label="내 준비"
      data-my-prep
      className={cx('rounded-card bg-surface px-[18px] py-3.5 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
        <Icon name="sprout" className="h-4 w-4 shrink-0 text-him" />내 준비
      </p>
      {prep.timerLabel ? (
        <div className="mt-1.5">
          <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">{prep.timerLabel}</p>
          <ProgressBar value={prep.timerProgress ?? 0} tone="him" label="생활 습관 약 3개월 중 진행" className="mt-1.5" />
        </div>
      ) : null}
      {/* Each on its own line, as on his app home (MyPrepView): the chain step carries its own '·'. */}
      {line.length ? (
        <div className={cx('space-y-0.5 text-[13px] leading-[1.5] text-ink-2', prep.timerLabel ? 'mt-2' : 'mt-1')}>
          {prep.weekCount ? <p className="font-semibold tabular-nums text-ink">{prep.weekCount}</p> : null}
          {prep.chainStep ? <p data-my-prep-chain>{prep.chainStep}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
