'use client'

// "우리 한 줄" on the partner page: her progress (numbers only — her item
// names stay in the app), 콕 when the snapshot offers it, 응원 always, and
// the signal she sent with its replies.

import { cx } from '@/components/ui'
import type { PartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import type { Signal } from '@/lib/logic/signals'
import { Bubble, isHer } from './bits'
import { LinkPendingSignal } from './LinkSignals'
import { ownerOf } from './model'

const small =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"

const DOTS_MAX = 6

export default function LinkUsLine({
  snapshot,
  signal,
  canNudge,
  cheersLeft,
  signalsLeft,
  onNudge,
  onCheer,
  onReply,
  className,
}: {
  snapshot: PartnerSnapshot
  signal: PartnerSnapshot['signal'] | undefined
  canNudge: boolean
  cheersLeft: number
  signalsLeft: number
  onNudge: () => void
  onCheer: () => void
  onReply: (reply: Signal) => void
  className?: string
}) {
  const owner = ownerOf(snapshot)
  const her = isHer(owner.id, snapshot.cycleOwner)
  const prog = snapshot.owner
  const dot = her ? 'bg-her' : 'bg-him'

  return (
    <section
      id="us-line"
      aria-label="우리 한 줄"
      className={cx('rounded-card bg-surface px-[18px] py-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none', className)}
    >
      <div className="flex items-center gap-2.5">
        <Bubble member={owner} her={her} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold tracking-[-0.02em] text-ink">
            {owner.name}
            <span className="ml-1.5 text-[13px] font-semibold tabular-nums text-ink-3">
              {prog.total > 0 ? `${prog.done}/${prog.total}` : ''}
            </span>
          </p>
          {prog.total > 0 && prog.total <= DOTS_MAX ? (
            <p aria-hidden className="mt-1 flex gap-1">
              {Array.from({ length: prog.total }, (_, i) => (
                <span key={i} className={cx('h-1.5 w-5 rounded-full', i < prog.done ? dot : 'bg-line')} />
              ))}
            </p>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {prog.complete ? '오늘 체크를 모두 마쳤어요' : prog.total === 0 ? '오늘은 체크 항목이 없어요' : '오늘 체크 중이에요'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canNudge ? (
            <button type="button" onClick={onNudge} className={small} aria-label={`${owner.name}님에게 콕 찌르기`}>
              <span aria-hidden>👉</span> 콕
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCheer}
            disabled={cheersLeft <= 0}
            className={small}
            aria-label={`${owner.name}님에게 응원 보내기`}
          >
            <span aria-hidden>👏</span> 응원
          </button>
        </div>
      </div>
      {signal ? (
        <LinkPendingSignal
          signal={signal}
          sender={snapshot.members.find((m) => m.id === signal.from) ?? owner}
          senderIsHer={isHer(signal.from, snapshot.cycleOwner)}
          left={signalsLeft}
          onReply={onReply}
          className="mt-3 border-t border-line/75 pt-3"
        />
      ) : null}
    </section>
  )
}
