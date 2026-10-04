'use client'

// Signals on the partner page: the one she sent that waits for his answer
// (with the replies that fit it — the snapshot already picked them), and the
// ones he may send (components/signals/SignalsCard read from the snapshot).
// Her signal carries 해 줄 말 · 아껴 둘 말 (N30) when the catalogue has lines
// for it — the same two lines the app shows under it.
// Every tap is a 'reply' or 'signal' event; the words come from the catalogue
// on her phone, the page sends ids only.

import { Card, cx } from '@/components/ui'
import type { PartnerSnapshot, SnapshotMember, SnapshotSignal } from '@/lib/logic/partnerSnapshot'
import type { Signal } from '@/lib/logic/signals'
import { SayLines } from '@/components/signals/SayText'
import { SIGNAL_TONE_CLASS } from '@/components/signals/tone'
import { timeKo } from './bits'

export function LinkPendingSignal({
  signal,
  sender,
  senderIsHer,
  left,
  onReply,
  className,
}: {
  signal: SnapshotSignal
  sender: SnapshotMember
  senderIsHer: boolean
  left: number
  onReply: (reply: Signal) => void
  className?: string
}) {
  const at = timeKo(signal.at)
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-ink-3">
        {sender.name}님이 보냈어요{at ? ` · ${at}` : ''}
      </p>
      <p
        className={cx(
          'mt-1.5 inline-block rounded-[18px_18px_18px_6px] px-3.5 py-2.5 text-[15.5px] font-bold tracking-[-0.02em] text-ink',
          senderIsHer ? 'bg-her-soft' : 'bg-him-soft',
        )}
      >
        {signal.emoji ? <span aria-hidden>{signal.emoji} </span> : null}
        {signal.text}
      </p>
      {/* 해 줄 말 · 아껴 둘 말 for her signal (N30); an older snapshot carries only the one-line tip. */}
      {signal.say ? (
        <SayLines say={signal.say.say} save={signal.say.save} className="mt-2.5 rounded-[14px] bg-surface-2 px-3 py-2" />
      ) : signal.tip ? (
        <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-2">
          <b className="font-bold text-ink">해 줄 말</b> · {signal.tip}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {signal.replies.map((r) => (
          <button
            key={r.id}
            type="button"
            data-reply={r.id}
            onClick={() => onReply(r)}
            disabled={left <= 0}
            className="relative inline-flex h-10 items-center gap-[5px] rounded-full border-[1.5px] border-line bg-surface px-3.5 text-[13.5px] font-bold text-ink transition-colors before:absolute before:-inset-y-[3px] before:inset-x-0 before:content-[''] hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
          >
            <span aria-hidden>{r.emoji}</span> {r.text}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LinkSignals({
  snapshot,
  left,
  onSend,
}: {
  snapshot: Pick<PartnerSnapshot, 'signals'>
  left: number
  onSend: (signal: Signal) => void
}) {
  return (
    <Card aria-label="우리 신호">
      <div className="grid grid-cols-2 gap-2">
        {snapshot.signals.map((s) => (
          <button
            key={s.id}
            type="button"
            data-signal={s.id}
            onClick={() => onSend(s)}
            disabled={left <= 0}
            className={cx(
              'flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-40',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              SIGNAL_TONE_CLASS(s.tone),
            )}
          >
            <span aria-hidden className="text-base">
              {s.emoji}
            </span>
            <span className="min-w-0">{s.text}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        {left > 0 ? `‘쉬어요’도 똑같이 좋은 신호예요. 오늘 ${left}번 더 보낼 수 있어요.` : '오늘 신호는 다 보냈어요. 내일 또 보내요.'}
      </p>
    </Card>
  )
}
