'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, EmptyState, Sheet, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { weekdayKo } from '@/lib/dates'
import { markRead } from '@/lib/logic/notifications'
import { canThankFromDigest, digestWeek, thankFromDigest, thankedForDigest } from '@/lib/logic/partnerNotices'
import { groupByDay, noticeTarget, nowOn, relativeTimeKo, splitTitleIcon, stampOn, type NoticeTab } from '@/lib/logic/today'
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

  // Her week line about him ('이번 주 민수님', partnerNotices.weekDigestNotices) carries the
  // same once-a-week [고마워요] as 우리 한 줄 — the decision and the 💛 to him are one.
  const thank = (n: AppNotification) => {
    update((s) => thankFromDigest(s, me.id, partner.id, n.key, today, stampOn(today)))
    statusRef.current?.focus({ preventScroll: true })
  }
  const action = (n: AppNotification): ReactNode => {
    if (!digestWeek(n.key)) return null
    if (canThankFromDigest(state, me.id, n.key, today)) {
      return (
        <button type="button" onClick={() => thank(n)} className={THANK_BUTTON} aria-label={`${partner.name}님에게 고마워요`}>
          <Icon name="heart" className="h-4 w-4 text-her" strokeWidth={2.2} /> 고마워요
        </button>
      )
    }
    const on = thankedForDigest(state, me.id, n.key)
    return on ? (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3">
        <Icon name="heart" className="h-3.5 w-3.5 fill-current text-her" strokeWidth={1.5} />
        고맙다고 전했어요 ({weekdayKo(on)})
      </span>
    ) : null
  }

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
        <EmptyState icon="bell" title="새 알림이 없어요" />
      ) : (
        <div className="space-y-4">
          {groups.today.length > 0 ? (
            <Group title="오늘" items={groups.today} nowMs={nowMs} stage={state.stage} onTap={tapOne} action={action} />
          ) : null}
          {groups.earlier.length > 0 ? (
            <Group title="이전" items={groups.earlier} nowMs={nowMs} stage={state.stage} onTap={tapOne} action={action} />
          ) : null}
        </div>
      )}

    </Sheet>
  )
}

const THANK_BUTTON =
  "relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-bold text-ink-2 transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

function Group({
  title,
  items,
  nowMs,
  stage,
  onTap,
  action,
}: {
  title: string
  items: AppNotification[]
  nowMs: number
  stage: Stage
  onTap: (n: AppNotification) => void
  /** A button under one notice (her week line's [고마워요]); null for the rest. */
  action: (n: AppNotification) => ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-xs font-bold text-ink-3">{title}</h3>
      <ul className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {items.map((n, i) => {
          const { icon, text } = splitTitleIcon(n.title, n.kind)
          const time = relativeTimeKo(n.createdAt, nowMs)
          const opens = noticeTarget(n.kind, stage, n.key) !== null
          const extra = action(n)
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
                  {n.body ? <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{n.body}</span> : null}
                </span>
                {!n.read ? (
                  <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                ) : opens ? (
                  <span aria-hidden className="mt-0.5 shrink-0 text-ink-3">
                    ›
                  </span>
                ) : null}
              </button>
              {extra ? (
                <div className={cx('flex min-h-11 items-center pb-2.5 pl-[60px] pr-3', !n.read && 'bg-brand-soft/40')}>{extra}</div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
