'use client'

// '내 준비' (Now 3 N30) — his own progress as one compact bar on his app home,
// right under '이번 주 우리 둘' (out of 더 보기): the ~3-month habit timer with
// its bar, this week's N/7 and his 검사 chain step. lib/logic/myPrep decides
// every part from HIS records only (no part ever reads her cycle) and leaves a
// part out when it has nothing to say — no 0, no '안 했어요'. Nothing shows
// for the person whose cycle it is, nor in the quiet after a loss. The link
// draws the same object (lib/logic/partnerSnapshot → components/link).
//
// 2026-11-01 ('12개 전부'): two parts that live inside the bar, never as a
// card of their own (one home card at a time):
//  • 올해 독감 접종 맞기 while its season is open (myPrep `season`) — a tick
//    here writes this 절기's key (myPrep.setPrepSeasonDone); after the window
//    the line is simply gone (no '지났어요');
//  • once a pregnancy has started, the question about his sauna / laptop rows
//    (myPrep `retire`): [내려놓기] archives them, [그대로 두기] keeps them; either
//    way it is not asked again for this pregnancy.

import { cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import {
  hasMyPrep,
  keepHeatChecks,
  myPrep,
  retireHeatChecks,
  setPrepSeasonDone,
  type MyPrep,
  type PrepRetire,
  type PrepSeason,
} from '@/lib/logic/myPrep'
import { useApp } from '@/lib/store'
import { PillButton, ProgressBar } from './bits'

/** 올해 독감 접종 맞기 — one 44px tick row with the roadmap note under it. */
function SeasonRow({ season, onToggle }: { season: PrepSeason; onToggle?: () => void }) {
  const box = (
    <span
      aria-hidden
      className={cx(
        'mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors',
        season.done ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
      )}
    >
      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  )
  const words = (
    <span className="min-w-0 flex-1">
      <span className={cx('block text-[13.5px] font-semibold leading-[1.45]', season.done ? 'text-ink-3' : 'text-ink')}>
        {season.label}
      </span>
      {season.note && !season.done ? <span className="block text-[12px] leading-[1.45] text-ink-3">{season.note}</span> : null}
    </span>
  )
  if (!onToggle) {
    return (
      <div className="flex items-start gap-2.5 py-1.5" data-prep-season data-done={season.done}>
        {box}
        {words}
      </div>
    )
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={season.done}
      onClick={onToggle}
      data-prep-season
      className="-mx-1 flex min-h-[44px] w-[calc(100%+0.5rem)] items-start gap-2.5 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      {box}
      {words}
    </button>
  )
}

/** The once-a-pregnancy question about his sauna / laptop rows. */
function RetireAsk({ retire, onRetire, onKeep }: { retire: PrepRetire; onRetire: () => void; onKeep: () => void }) {
  return (
    <div className="mt-2.5 rounded-xl bg-surface-2 px-3 py-2.5" data-prep-retire>
      <p className="text-[13px] font-semibold leading-[1.5] text-ink">{retire.question}</p>
      <div className="mt-2 flex gap-2">
        <PillButton size="split" variant="primary" className="flex-1" onClick={onRetire}>
          내려놓기
        </PillButton>
        <PillButton size="split" variant="surface" className="flex-1" onClick={onKeep}>
          그대로 두기
        </PillButton>
      </div>
    </div>
  )
}

/** The bar for a given 내 준비 (also what a preview can draw — without the handlers it only reads). */
export function MyPrepView({
  prep,
  className,
  onSeason,
  onRetire,
  onKeep,
}: {
  prep: MyPrep
  className?: string
  onSeason?: () => void
  onRetire?: () => void
  onKeep?: () => void
}) {
  if (!hasMyPrep(prep)) return null
  const lines = !!(prep.weekCount || prep.chainStep)
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
      {lines ? (
        <div className={cx('space-y-0.5 text-[13px] leading-[1.5] text-ink-2', prep.timerLabel ? 'mt-2' : 'mt-1')}>
          {prep.weekCount ? <p className="font-semibold tabular-nums text-ink">{prep.weekCount}</p> : null}
          {prep.chainStep ? <p data-my-prep-chain>{prep.chainStep}</p> : null}
        </div>
      ) : null}
      {prep.season ? (
        <div className={cx(prep.timerLabel || lines ? 'mt-1.5 border-t border-line/70 pt-1' : 'mt-1')}>
          <SeasonRow season={prep.season} onToggle={onSeason} />
        </div>
      ) : null}
      {prep.retire && onRetire && onKeep ? <RetireAsk retire={prep.retire} onRetire={onRetire} onKeep={onKeep} /> : null}
    </section>
  )
}

/** His 내 준비 on today's home (nothing for the cycle owner or in the quiet — myPrep is empty then). */
export default function MyPrepBar({ className }: { className?: string }) {
  const { state, update, today, me } = useApp()
  const toast = useToast()
  const prep = myPrep(state, today, me.id)
  const onSeason = prep.season
    ? () => {
        const done = !prep.season!.done
        update((s) => setPrepSeasonDone(s, today, me.id, done))
        if (done) toast.show('챙겼어요')
      }
    : undefined
  const onRetire = () => {
    update((s) => retireHeatChecks(s, today, me.id))
    toast.show('내려놓았어요')
  }
  const onKeep = () => update((s) => keepHeatChecks(s, today, me.id))
  return <MyPrepView prep={prep} className={className} onSeason={onSeason} onRetire={onRetire} onKeep={onKeep} />
}
