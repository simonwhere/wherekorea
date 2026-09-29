'use client'

import { Card, SectionTitle, cx, useToast } from '@/components/ui'
import { canLogCycle } from '@/lib/logic/prefs'
import { stampOn } from '@/lib/logic/today'
import {
  SIGNALS_PER_DAY,
  pendingSignal,
  repliesFor,
  sendSignal,
  signalById,
  signalIdOf,
  signalsFor,
  signalsSentToday,
} from '@/lib/logic/signals'
import { useApp } from '@/lib/store'

function useSend() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const left = SIGNALS_PER_DAY - signalsSentToday(state, me.id, today)
  const send = (id: string, label: string) => {
    if (left <= 0) return
    update((s) => sendSignal(s, me.id, partner.id, id, today, stampOn(today)))
    toast.show(`${partner.name}님에게 “${label}” 보냈어요`)
  }
  return { send, left }
}

/** '오후 6:12' from a local ISO time ('2026-09-29T18:12:…'); '' when it has none. */
function timeKo(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return ''
  const h = Number(m[1])
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m[2]}`
}

/**
 * The signal the viewer received today and hasn't answered, with one-tap
 * replies that fit it (repliesFor: '위로가 필요해요' gets '옆에 있을게요', never
 * '다음에 해요') — or nothing. Used on its own in the home's "우리 한 줄": who
 * sent it and when, the message as a chat bubble in the sender's colour, and
 * the replies (`data-reply`, so the cover's "답하기" can focus the first one).
 */
export function PendingSignal({ className }: { className?: string }) {
  const { state, today, me } = useApp()
  const { send, left } = useSend()
  const pending = pendingSignal(state, me.id, today)
  if (!pending) return null
  const id = signalIdOf(pending)
  const signal = id ? signalById(id) : undefined
  const sender = state.couple.members.find((m) => m.id === pending.from)
  const replies = repliesFor(id)
  const at = timeKo(pending.createdAt)
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-ink-3">
        {sender ? `${sender.name}님이 보냈어요` : '받은 신호'}
        {at ? ` · ${at}` : ''}
      </p>
      <p
        className={cx(
          'mt-1.5 inline-block rounded-[18px_18px_18px_6px] px-3.5 py-2.5 text-[15.5px] font-bold tracking-[-0.02em] text-ink',
          sender?.tracksCycle ? 'bg-her-soft' : 'bg-him-soft',
        )}
      >
        {signal ? (
          <>
            <span aria-hidden>{signal.emoji} </span>
            {signal.text}
          </>
        ) : (
          pending.title
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {replies.map((r) => (
          <button
            key={r.id}
            type="button"
            data-reply
            onClick={() => send(r.id, r.text)}
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

/**
 * "우리 신호" — one tap to say what's awkward to say. Includes easy, guilt-free
 * "not today" options so the app never pushes anyone. `showPending={false}`
 * when the reply already sits elsewhere on the screen.
 */
export default function SignalsCard({ showPending = true, title = true }: { showPending?: boolean; title?: boolean }) {
  const { state, me } = useApp()
  const { send, left } = useSend()
  // While preparing: the trying-month set ('이번 달은 아니었어요' only for the person whose cycle it is).
  const signals = signalsFor(state.stage, canLogCycle(state, me.id))

  return (
    <>
      {title ? <SectionTitle sub="말로 꺼내기 어려운 건 버튼 하나로">우리 신호</SectionTitle> : null}
      <Card>
        {showPending ? <PendingSignal className="mb-3 border-b border-line/75 pb-3" /> : null}
        <div className="grid grid-cols-2 gap-2">
          {signals.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => send(s.id, s.text)}
              disabled={left <= 0}
              className={cx(
                'flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-40',
                s.tone === 'rest'
                  ? 'border-line bg-surface-2 text-ink-2 hover:bg-line/50'
                  : 'border-line bg-surface text-ink hover:bg-surface-2',
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
          {left > 0
            ? `‘쉬어요’도 똑같이 좋은 신호예요. 오늘 ${left}번 더 보낼 수 있어요.`
            : '오늘 신호는 다 보냈어요. 내일 또 보내요.'}
        </p>
      </Card>
    </>
  )
}
