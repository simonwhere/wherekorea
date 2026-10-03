'use client'

// 되돌리기 for a weekly check-in taken back (Now 3 N24). Un-checking a weekly
// row clears it from every day of this week it was on (checks.
// toggleWeeklyUndoable → `cleared`), so a mis-tap would quietly erase the
// week; for 5 s the toast puts it back on exactly those days
// (checks.restoreWeekly).

import { useCallback, useState } from 'react'
import UndoToast, { type UndoMessage } from '@/components/log/UndoToast'
import { restoreWeekly, weeklyCheckInName } from '@/lib/logic/checks'
import { useApp } from '@/lib/store'
import type { CheckItem, ISODate, MemberId } from '@/lib/types'

export function useWeeklyUndo(): {
  /** Offer 되돌리기 for `item`, cleared from `days` (no-op for an empty list). */
  offer: (item: CheckItem, days: readonly ISODate[] | undefined) => void
  /** The toast — render it once in the screen. */
  toast: React.ReactNode
} {
  const { update, me } = useApp()
  // The member is kept with the offer: ⇄ during the 5 s must not restore it on the other person.
  const [undo, setUndo] = useState<(UndoMessage & { member: MemberId; itemId: string; days: readonly ISODate[] }) | null>(null)
  const expire = useCallback(() => setUndo(null), [])

  const offer = useCallback(
    (item: CheckItem, days: readonly ISODate[] | undefined) => {
      if (!days?.length) return
      setUndo({ id: Date.now(), text: `‘${weeklyCheckInName(item)}’ 이번 주 체크를 지웠어요`, member: me.id, itemId: item.id, days })
    },
    [me.id],
  )

  const onUndo = useCallback(() => {
    if (!undo) return
    const { member, itemId, days } = undo
    update((s) => restoreWeekly(s, member, itemId, days))
    setUndo(null)
  }, [undo, update])

  return { offer, toast: <UndoToast message={undo} onUndo={onUndo} onExpire={expire} /> }
}
