'use client'

// '해 줄 말 · 아껴 둘 말' (Now 3 N30) — only on a moment SHE SENT: one of her
// signals he has not answered yet (PendingSignal) or what she told with
// [알리기] (the partner's told card, components/today/CycleBlock). The lines
// come from lib/logic/signals (sayForSignal / sayForTold), never from her
// records; the two answers are signals he sends with one tap.

import { cx, useToast } from '@/components/ui'
import { SIGNALS_PER_DAY, sendSignal, signalById, signalsSentToday } from '@/lib/logic/signals'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'

// The two lines themselves live in ./SayText (pure — the partner page draws them too).
export { SayLines } from './SayText'

/**
 * The two one-tap answers to what she told ([알리기]) — a reply or one of his
 * offers ('오늘 저녁은 내가 할게요', '병원 같이 갈게요') — sent to her as a signal.
 * Once one went out since she told him (`sent`), the chips become '보냈어요'.
 */
export function ToldAnswers({ replies, sent, className }: { replies: readonly string[]; sent?: string; className?: string }) {
  const { state, update, today, me, cycleOwner } = useApp()
  const toast = useToast()
  const left = SIGNALS_PER_DAY - signalsSentToday(state, me.id, today)
  const done = sent ? signalById(sent) : undefined
  if (done) {
    return (
      <p data-told-sent className={cx('text-[12.5px] font-semibold text-ink-3', className)}>
        보냈어요 · <span aria-hidden>{done.emoji} </span>
        {done.text}
      </p>
    )
  }
  const send = (id: string) => {
    const s = signalById(id)
    if (!s || left <= 0) return
    update((st) => sendSignal(st, me.id, cycleOwner.id, id, today, stampOn(today)))
    toast.show(`${cycleOwner.name}님에게 “${s.text}” 보냈어요`)
  }
  return (
    <div role="group" aria-label={`${cycleOwner.name}님에게 답하기`} className={cx('flex flex-wrap gap-2', className)}>
      {replies.map((id) => {
        const s = signalById(id)
        if (!s) return null
        return (
          <button
            key={id}
            type="button"
            data-told-answer={id}
            onClick={() => send(id)}
            disabled={left <= 0}
            className="relative inline-flex min-h-[44px] items-center gap-[5px] rounded-full border-[1.5px] border-line bg-surface px-3.5 text-[13.5px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
          >
            <span aria-hidden>{s.emoji}</span> {s.text}
          </button>
        )
      })}
    </div>
  )
}
