'use client'

import { useEffect, useRef } from 'react'
import { localNowISO, mergeNotices, scheduledNotices } from './logic/notifications'
import { useApp } from './store'
import type { AppNotification } from './types'

/**
 * Runs the notification rules whenever the date or relevant data changes, and
 * mirrors new notices for the current viewer as browser notifications (only
 * while the app is open — real push needs a server; see docs).
 */
export function useNotificationEngine(): void {
  const { state, update, today, viewer } = useApp()
  const shown = useRef(new Set<string>())

  const { stage, periods, lhTests, cycle, pregnancy, baby, settings, couple } = state
  useEffect(() => {
    // Preview against the current state to learn what's new; the updater re-derives
    // against the latest state, and key-dedup makes repeated application harmless.
    const now = localNowISO()
    const { added } = mergeNotices(state, scheduledNotices(state, today), now)
    if (added.length === 0) return
    update((s) => mergeNotices(s, scheduledNotices(s, today), now).state)
    deliver(added.filter((n) => n.to === viewer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, stage, periods, lhTests, cycle, pregnancy, baby, settings.lowPressure, settings.ttcStart, couple.members])

  // Also surface nudges/cheers written by the partner's "phone" (another tab).
  // Whatever is already unread when the app opens isn't re-announced.
  const incoming = state.notifications.filter((n) => n.to === viewer && !n.read && n.from !== undefined)
  const primed = useRef(false)
  useEffect(() => {
    if (!primed.current) {
      primed.current = true
      incoming.forEach((n) => shown.current.add(n.id))
      return
    }
    deliver(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming.map((n) => n.id).join(',')])

  function deliver(list: AppNotification[]) {
    if (!settings.browserNotifications) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    for (const n of list) {
      if (shown.current.has(n.id)) continue
      shown.current.add(n.id)
      try {
        // Discreet mode keeps anything health-related off the lock screen.
        const title = settings.discreet ? '둘셋' : n.title
        const body = settings.discreet ? '새 알림이 있어요 💌' : n.body
        new Notification(title, { body, tag: n.key ?? n.id, icon: './icon.svg' })
      } catch {
        /* Some mobile browsers only allow notifications via a service worker. */
      }
    }
  }
}
