'use client'

// '내 준비' on the partner page (Now 3 N30) — the same compact bar his app
// home shows under '이번 주 우리 둘' (components/today/MyPrepBar), drawn from
// the snapshot's myPrep (lib/logic/myPrep through partnerSnapshot.linkMyPrep:
// his habit timer with its bar, this week's N/7, his 검사 chain step — his
// own records only, each part only when it has something to say; no 0, no
// '안 했어요'). Read-only: nothing here sends anything.
//
// While pregnant (2026-10-09) the bar lists his own pregnancy-stage items
// (myPrep `items`: 배우자 지원 제도 · 육아휴직 계획 · 카시트 · Tdap · 배우자 출산휴가
// 20일), each with '했어요' / '지금' / 'N월 N일부터' — the list says what the
// summary line would, so the line gives way to it.
//
// His check points (2026-11-01) make two parts answerable here, as in his app:
// 올해 독감 접종 (a tick → 'season-done') and, once a pregnancy, the sauna /
// laptop question ([내려놓기] / [그대로 두기] → 'retire-checks'). Her preview
// draws the flu row read-only and leaves the question out.

import { ProgressBar } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SnapshotMyPrep, SnapshotPrepItem } from '@/lib/logic/partnerSnapshot'
import { Pill } from './bits'
import { prepItemWhen } from './model'

function PrepItems({ items }: { items: SnapshotPrepItem[] }) {
  return (
    <ul aria-label="내 준비 항목" className="mt-1.5 space-y-0.5" data-my-prep-items>
      {items.map((i) => (
        <li key={i.id} className="flex min-h-7 items-center gap-2 text-[13px] leading-[1.45]" data-prep-item={i.id} data-state={i.state}>
          {i.state === 'done' ? (
            <Icon name="check" className="h-4 w-4 shrink-0 text-ok" strokeWidth={2.6} />
          ) : (
            <span aria-hidden className={cx('mx-[5px] h-1.5 w-1.5 shrink-0 rounded-full', i.state === 'now' ? 'bg-him' : 'bg-line')} />
          )}
          <span className={cx('min-w-0 flex-1', i.state === 'done' ? 'text-ink-3' : i.state === 'now' ? 'font-semibold text-ink' : 'text-ink-2')}>
            {i.label}
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{prepItemWhen(i)}</span>
        </li>
      ))}
    </ul>
  )
}

/** 올해 독감 접종 맞기 while its season is open: a 44px tick row on his page, read-only in her preview. */
function SeasonLine({ season, onToggle }: { season: NonNullable<SnapshotMyPrep['season']>; onToggle?: () => void }) {
  const words = (
    <span className="min-w-0 flex-1">
      <span className={cx('block', season.done ? 'text-ink-3' : 'font-semibold text-ink')}>{season.label}</span>
      {season.note && !season.done ? <span className="block text-[12px] text-ink-3">{season.note}</span> : null}
    </span>
  )
  if (onToggle) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={season.done}
        onClick={onToggle}
        data-prep-season
        data-done={season.done}
        className="-mx-1 flex min-h-[44px] w-[calc(100%+0.5rem)] items-start gap-2.5 rounded-xl px-1 py-1.5 text-left text-[13px] leading-[1.45] hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span
          aria-hidden
          className={cx(
            'mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors',
            season.done ? 'border-ok bg-ok text-white' : 'border-control bg-surface text-transparent',
          )}
        >
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {words}
      </button>
    )
  }
  return (
    <div className="flex items-start gap-2 text-[13px] leading-[1.45]" data-prep-season data-done={season.done}>
      {season.done ? (
        <Icon name="check" className="mt-px h-4 w-4 shrink-0 text-ok" strokeWidth={2.6} />
      ) : (
        <span aria-hidden className="mx-[5px] mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-him" />
      )}
      {words}
      <span className="shrink-0 text-[12px] text-ink-3">{season.done ? '했어요' : '지금'}</span>
    </div>
  )
}

/** The once-a-pregnancy question about his sauna / laptop rows (his app's RetireAsk). */
function RetireAsk({ question, onAnswer }: { question: string; onAnswer: (keep: boolean) => void }) {
  return (
    <div className="mt-2.5 rounded-xl bg-surface-2 px-3 py-2.5" data-prep-retire>
      <p className="text-[13px] font-semibold leading-[1.5] text-ink">{question}</p>
      <div className="mt-2 flex gap-2">
        <Pill tone="primary" className="flex-1" onClick={() => onAnswer(false)}>
          내려놓기
        </Pill>
        <Pill tone="outline" className="flex-1" onClick={() => onAnswer(true)}>
          그대로 두기
        </Pill>
      </div>
    </div>
  )
}

export default function LinkPrep({
  prep,
  onSeason,
  onRetire,
  preview = false,
  className,
}: {
  prep: SnapshotMyPrep
  /** The flu tick (a 'season-done' event); absent in her preview. */
  onSeason?: (done: boolean) => void
  /** [내려놓기] (keep false) / [그대로 두기] (keep true) — a 'retire-checks' event. */
  onRetire?: (keep: boolean) => void
  /** Her preview of his page: the question about his own rows stays out. */
  preview?: boolean
  className?: string
}) {
  const items = prep.items?.length ? prep.items : undefined
  // With the list drawn, its summary line would only repeat it.
  const line = [prep.weekCount, items ? undefined : prep.chainStep].filter(Boolean)
  const retire = prep.retire && onRetire && !preview ? prep.retire : undefined
  if (!prep.timerLabel && !line.length && !items && !prep.season && !retire) return null
  const done = items?.filter((i) => i.state === 'done').length ?? 0
  return (
    <section
      aria-label="내 준비"
      data-my-prep
      className={cx('rounded-card bg-surface px-[18px] py-3.5 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
        <Icon name="sprout" className="h-4 w-4 shrink-0 text-him" />내 준비
        {/* A count only once something is done (no zeros). */}
        {items && done > 0 ? <span className="ml-auto font-semibold tabular-nums text-ink-3">{done}/{items.length} ✓</span> : null}
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
          {prep.chainStep && !items ? <p data-my-prep-chain>{prep.chainStep}</p> : null}
        </div>
      ) : null}
      {items ? <PrepItems items={items} /> : null}
      {prep.season ? (
        <div className={cx(prep.timerLabel || line.length || items ? 'mt-1.5 border-t border-line/70 pt-1.5' : 'mt-1.5')}>
          <SeasonLine season={prep.season} onToggle={onSeason && !preview ? () => onSeason(!prep.season!.done) : undefined} />
        </div>
      ) : null}
      {retire && onRetire ? <RetireAsk question={retire.question} onAnswer={onRetire} /> : null}
    </section>
  )
}
