'use client'

// '내 준비' (Now 3 N30) — his own progress as one compact bar on his app home,
// right under '이번 주 우리 둘' (out of 더 보기): the ~3-month habit timer with
// its bar, this week's N/7 and his 검사 chain step. lib/logic/myPrep decides
// every part from HIS records only (no part ever reads her cycle) and leaves a
// part out when it has nothing to say — no 0, no '안 했어요'. Nothing shows
// for the person whose cycle it is, nor in the quiet after a loss. The link
// draws the same object (lib/logic/partnerSnapshot → components/link).

import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { hasMyPrep, myPrep, type MyPrep } from '@/lib/logic/myPrep'
import { useApp } from '@/lib/store'
import { ProgressBar } from './bits'

/** The bar for a given 내 준비 (also what a preview can draw). */
export function MyPrepView({ prep, className }: { prep: MyPrep; className?: string }) {
  if (!hasMyPrep(prep)) return null
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
      {/* Each on its own line: the chain step carries its own '·' ('신청 ✓ · 검사 예약 10월 16일'). */}
      {prep.weekCount || prep.chainStep ? (
        <div className={cx('space-y-0.5 text-[13px] leading-[1.5] text-ink-2', prep.timerLabel ? 'mt-2' : 'mt-1')}>
          {prep.weekCount ? <p className="font-semibold tabular-nums text-ink">{prep.weekCount}</p> : null}
          {prep.chainStep ? <p data-my-prep-chain>{prep.chainStep}</p> : null}
        </div>
      ) : null}
    </section>
  )
}

/** His 내 준비 on today's home (nothing for the cycle owner or in the quiet — myPrep is empty then). */
export default function MyPrepBar({ className }: { className?: string }) {
  const { state, today, me } = useApp()
  return <MyPrepView prep={myPrep(state, today, me.id)} className={className} />
}
