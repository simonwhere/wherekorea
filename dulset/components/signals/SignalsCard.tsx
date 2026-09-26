'use client'

import { Card, SectionTitle, cx, useToast } from '@/components/ui'
import { localNowISO } from '@/lib/logic/notifications'
import { REPLIES, SIGNALS, SIGNALS_PER_DAY, pendingSignal, sendSignal, signalsSentToday } from '@/lib/logic/signals'
import { useApp } from '@/lib/store'

/**
 * "우리 신호" — one tap to say what's awkward to say. Includes easy, guilt-free
 * "not today" options so the app never pushes anyone.
 */
export default function SignalsCard() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const pending = pendingSignal(state, me.id, today)
  const left = SIGNALS_PER_DAY - signalsSentToday(state, me.id, today)

  const send = (id: string, label: string) => {
    if (left <= 0) return
    update((s) => sendSignal(s, me.id, partner.id, id, today, localNowISO()))
    toast.show(`${partner.name}님에게 “${label}” 보냈어요`)
  }

  return (
    <>
      <SectionTitle sub="말로 꺼내기 어려운 건 버튼 하나로">우리 신호</SectionTitle>
      <Card>
        {pending ? (
          <div className="mb-3 rounded-xl bg-brand-soft p-3">
            <p className="text-sm font-semibold text-brand-ink">{pending.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REPLIES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => send(r.id, r.text)}
                  disabled={left <= 0}
                  className="h-9 rounded-full bg-surface px-3 text-xs font-medium text-ink shadow-sm hover:bg-surface-2 disabled:opacity-40"
                >
                  {r.emoji} {r.text}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {SIGNALS.map((s) => (
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
