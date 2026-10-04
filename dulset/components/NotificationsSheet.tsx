'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, EmptyState, Sheet, cx } from '@/components/ui'
import { markRead } from '@/lib/logic/notifications'
import { groupByDay, noticeTarget, nowOn, relativeTimeKo, splitTitleIcon, type NoticeTab } from '@/lib/logic/today'
import { bellInbox, clearBell } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { AppNotification, Stage } from '@/lib/types'

/**
 * Open a tab the same way AppShell's own navigation does: AppShell listens to
 * `hashchange` (#today, #cycle, …) and switches to that tab if it exists.
 */
function openTab(tab: NoticeTab) {
  if (window.location.hash.replace(/^#/, '') !== tab) window.location.hash = tab
  window.scrollTo({ top: 0 })
}

/** In-app inbox for the current viewer (the prototype's stand-in for push). */
export default function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update, today, me, partner } = useApp()

  // AppShell passes a new arrow every render; the Sheet re-runs its open effect
  // (and moves focus to the panel) whenever onClose changes. Keep one stable callback.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  const close = useCallback(() => onCloseRef.current(), [])

  // Relative times are measured when the sheet opens, on the app's `today`.
  const [nowMs, setNowMs] = useState(() => nowOn(today).getTime())
  useEffect(() => {
    if (open) setNowMs(nowOn(today).getTime())
  }, [open, today])

  // Bulk actions disable their own button; keep focus inside the sheet (on the status line).
  const statusRef = useRef<HTMLParagraphElement>(null)
  const bulk = (fn: Parameters<typeof update>[0]) => {
    update(fn)
    statusRef.current?.focus({ preventScroll: true })
  }

  // While preparing, the reactions on her own entries live in the 기록장 ('새로 받은 마음',
  // N27), not here — the same list the 🔔 badge counts (usView bellInbox / bellUnread).
  const list = bellInbox(state, me.id)
  const groups = groupByDay(list, today)
  const unread = list.filter((n) => !n.read).length

  const tapOne = (n: AppNotification) => {
    if (!n.read) update((s) => markRead(s, me.id, n.id))
    const target = noticeTarget(n.kind, state.stage, n.key)
    if (target) {
      close()
      openTab(target)
    }
  }

  return (
    <Sheet open={open} onClose={close} title="알림">
      <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
        <p ref={statusRef} tabIndex={-1} className="text-xs text-ink-3 outline-none" aria-live="polite">
          {list.length === 0 ? (
            <span className="sr-only">알림함이 비었어요</span>
          ) : unread > 0 ? (
            `읽지 않은 알림 ${unread}개`
          ) : (
            '모두 읽었어요'
          )}
        </p>
        <div className="flex shrink-0 gap-1">
          {/* Only what this list shows (both buttons): the 기록장's own notes stay unread for the 기록장. */}
          <Button
            variant="ghost"
            onClick={() => bulk((s) => bellInbox(s, me.id).reduce((acc, n) => (n.read ? acc : markRead(acc, me.id, n.id)), s))}
            disabled={unread === 0}
          >
            모두 읽음
          </Button>
          <Button variant="ghost" onClick={() => bulk((s) => clearBell(s, me.id))} disabled={list.length === 0}>
            비우기
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="bell"
          title="새 알림이 없어요"
          body={`${partner.name}님이 콕 찌르거나 응원을 보내면 여기에 보여요.`}
        />
      ) : (
        <div className="space-y-4">
          {groups.today.length > 0 ? (
            <Group title="오늘" items={groups.today} nowMs={nowMs} stage={state.stage} onTap={tapOne} />
          ) : null}
          {groups.earlier.length > 0 ? (
            <Group title="이전" items={groups.earlier} nowMs={nowMs} stage={state.stage} onTap={tapOne} />
          ) : null}
        </div>
      )}

      <p className="mt-5 rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-ink-3">
        실제 앱에서는 푸시 알림으로 두 사람 폰에 동시에 가요. 지금은 프로토타입이라 앱 안 알림함과 (설정에서 켜면)
        브라우저 알림으로 보여 드려요.
      </p>
    </Sheet>
  )
}

function Group({
  title,
  items,
  nowMs,
  stage,
  onTap,
}: {
  title: string
  items: AppNotification[]
  nowMs: number
  stage: Stage
  onTap: (n: AppNotification) => void
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-xs font-bold text-ink-3">{title}</h3>
      <ul className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {items.map((n, i) => {
          const { icon, text } = splitTitleIcon(n.title, n.kind)
          const time = relativeTimeKo(n.createdAt, nowMs)
          const opens = noticeTarget(n.kind, stage, n.key) !== null
          return (
            <li key={n.id} className={cx(i > 0 && 'border-t border-line')}>
              <button
                type="button"
                onClick={() => onTap(n)}
                className={cx(
                  'flex min-h-[56px] w-full items-start gap-3 px-3 py-3 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                  n.read ? 'hover:bg-surface-2' : 'bg-brand-soft/40 hover:bg-brand-soft/70',
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg',
                    n.read ? 'bg-surface-2' : 'bg-brand-soft',
                  )}
                >
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2">
                    <span className={cx('min-w-0 flex-1 text-sm leading-snug', n.read ? 'font-medium text-ink-2' : 'font-bold text-ink')}>
                      {!n.read ? <span className="sr-only">읽지 않음: </span> : null}
                      {text}
                    </span>
                    {time ? <span className="shrink-0 pt-0.5 text-[11px] text-ink-3">{time}</span> : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{n.body}</span>
                </span>
                {!n.read ? (
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                ) : opens ? (
                  <span aria-hidden className="mt-0.5 shrink-0 text-ink-3">
                    ›
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
