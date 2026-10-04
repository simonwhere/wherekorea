'use client'

// "우리 한 줄" on the partner page: her progress (numbers only — her item
// names stay in the app), 콕 when the snapshot offers it, 응원 always, the
// signal she sent with its replies, and her answer to his last signal
// (snapshot.reply — the app's 우리 한 줄 ReplyLine, word for word).

import { cx } from '@/components/ui'
import { addDays, formatKo, isISODate } from '@/lib/dates'
import type { PartnerPage, SnapshotReply } from '@/lib/logic/partnerSnapshot'
import type { Signal } from '@/lib/logic/signals'
import type { ISODate } from '@/lib/types'
import { Bubble, isHer, timeKo } from './bits'
import { LinkPendingSignal } from './LinkSignals'
import { ownerOf } from './model'

const small =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"

const DOTS_MAX = 6

/** '오후 6:12' · '어제 오후 6:12' · '그저께' · '10월 5일 (월)' — when her answer came, as the app's 우리 한 줄 says it. */
function whenKo(at: string, today: ISODate): string {
  const day = at.slice(0, 10)
  if (day === today) return timeKo(at)
  if (day === addDays(today, -1)) return `어제 ${timeKo(at)}`.trim()
  if (day === addDays(today, -2)) return '그저께'
  return isISODate(day) ? formatKo(day) : ''
}

/** Her answer to his signal: who, when, to what, and the reply as a bubble in her colour. */
function ReplyLine({ reply, name, her, today, className }: { reply: SnapshotReply; name: string; her: boolean; today: ISODate; className?: string }) {
  const when = whenKo(reply.at, today)
  return (
    <div className={className} data-received-reply>
      <p className="text-xs font-semibold text-ink-3">
        {name}님이 답했어요{when ? ` · ${when}` : ''}
        {reply.answered ? <span className="font-normal"> · ‘{reply.answered}’에</span> : null}
      </p>
      <p
        className={cx(
          'mt-1.5 inline-block rounded-[18px_18px_18px_6px] px-3.5 py-2.5 text-[15px] font-bold tracking-[-0.02em] text-ink',
          her ? 'bg-her-soft' : 'bg-him-soft',
        )}
      >
        <span aria-hidden>{reply.emoji} </span>
        {reply.text}
      </p>
    </div>
  )
}

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
  snapshot: PartnerPage
  signal: PartnerPage['signal'] | undefined
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
              {/* No '0' about her (positioning §4 rule 2). */}
              {prog.total > 0 && prog.done > 0 ? `${prog.done}/${prog.total}` : ''}
            </span>
          </p>
          {prog.total > 0 && prog.done > 0 && prog.total <= DOTS_MAX ? (
            <p aria-hidden className="mt-1 flex gap-1">
              {Array.from({ length: prog.total }, (_, i) => (
                <span key={i} className={cx('h-1.5 w-5 rounded-full', i < prog.done ? dot : 'bg-line')} />
              ))}
            </p>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {prog.complete ? '오늘 체크를 모두 마쳤어요' : prog.total === 0 ? '오늘은 체크 항목이 없어요' : prog.done > 0 ? '오늘 체크 중이에요' : ''}
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
      {snapshot.reply ? (
        <ReplyLine
          reply={snapshot.reply}
          name={(snapshot.members.find((m) => m.id === snapshot.reply!.from) ?? owner).name}
          her={isHer(snapshot.reply.from, snapshot.cycleOwner)}
          today={snapshot.date}
          className="mt-3 border-t border-line/75 pt-3"
        />
      ) : null}
    </section>
  )
}
