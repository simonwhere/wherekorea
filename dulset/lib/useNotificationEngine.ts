'use client'

import { useEffect, useRef } from 'react'
import { mergeNotices } from './logic/notifications'
import { allRuleNotices } from './logic/partnerNotices'
import { stampOn } from './logic/today'
import { useApp } from './store'
import type { AppNotification } from './types'
import { discreetFor } from './logic/prefs'
import { lockScreenText } from './logic/settings'
import { isRecordBookNotice } from './logic/usView'

/**
 * Runs the notification rules whenever the date or relevant data changes, and
 * mirrors new notices for the current viewer as browser notifications (only
 * while the app is open — real push needs a server; see docs).
 */
export function useNotificationEngine(): void {
  const { state, update, today, viewer } = useApp()
  const shown = useRef(new Set<string>())

  const { stage, periods, lhTests, cycle, pregnancy, baby, settings, couple, appointments, anniversaries, planDone, milestones, customTasks, cycleNotes, restCycle, positivePending, treatments, decisions, checkLog, checkItems } = state
  useEffect(() => {
    // Preview against the current state to learn what's new; the updater re-derives
    // against the latest state, and key-dedup makes repeated application harmless.
    // Stamped on the app's `today` so a pinned ?today= groups them correctly.
    // allRuleNotices: scheduledNotices + appointmentReminders + planDeadlineNotices,
    // then his check points and her week line (partnerNotices — capped against the rest).
    const now = stampOn(today)
    const rules = (s: typeof state) => allRuleNotices(s, today)
    const { added } = mergeNotices(state, rules(state), now)
    if (added.length === 0) return
    update((s) => mergeNotices(s, rules(s), now).state)
    deliver(added.filter((n) => n.to === viewer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // customTasks: a '기한' item added today with D-7 / D-1 / 당일 falling on today (N13);
    // cycleNotes / restCycle / positivePending: '아직 안 왔어요', a clinic cycle or a test change what goes out;
    // treatments: a 지원결정통지서 written today that already sits at D-30 / D-7 / D-1 (Next B);
    // settings.anniversaryAlerts / shareLevel: the anniversary gate and the partner's cycle notices (N23);
    // decisions: his doctor notice waits until she has told him about a positive test (N19, positive-told);
    // [접수가 끝났대요], 아빠 마음 asked, his link first run and the week's picks / [했어요] (partnerNotices).
    // couple.linkedAt: his in-app first run starts the 신청 reminder's 14 days;
    // checkLog / checkItems: her week line about him reads the checks he kept (Sunday).
  }, [today, stage, periods, lhTests, cycle, pregnancy, baby, settings.lowPressure, settings.personal, settings.alertStyle, settings.ttcStart, settings.usesLH, settings.anniversaryAlerts, settings.shareLevel, couple.members, couple.metDate, couple.marriedDate, couple.linkedAt, appointments, anniversaries, planDone, milestones, customTasks, cycleNotes, restCycle, positivePending, treatments, decisions, checkLog, checkItems])

  // Also surface nudges/cheers written by the partner's "phone" (another tab).
  // Whatever is already unread when the app opens isn't re-announced. While
  // preparing, a reaction to a diary entry is a note for the 기록장 (usView
  // isRecordBookNotice, N27): never a browser notification, like the 🔔.
  const incoming = state.notifications.filter((n) => n.to === viewer && !n.read && n.from !== undefined && !isRecordBookNotice(n, stage))
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
      if (shown.current.has(n.id) || isRecordBookNotice(n, stage)) continue
      shown.current.add(n.id)
      try {
        // Discreet mode keeps anything health-related off the lock screen: every
        // notice, whatever its rule, reads '둘셋 · 새 알림이 있어요' (settings.lockScreenText).
        const discreet = discreetFor(settings, viewer)
        const { title, body } = lockScreenText(n, discreet)
        new Notification(title, { body, tag: n.key ?? n.id, icon: './icon.svg' })
      } catch {
        /* Some mobile browsers only allow notifications via a service worker. */
      }
    }
  }
}
