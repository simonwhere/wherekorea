'use client'

// '이번 주 우리 둘' on the partner's in-app home (Now 3 N21, his side) — the
// same block his no-install link shows, drawn by the link's own component
// (components/link/LinkWeek) from the same data (partnerSnapshot.linkWeek):
// three relationship-side picks for the week → [이번 주 이걸로] → [했어요],
// 내 준비 (his habit timer · this week's N/7 · his 검사 chain step — the short
// form of the timers in 더 보기), and '지은님이 고마워했어요 (화)' for the
// rest of the week once she said [고마워요]. Here the taps change the state
// directly (weekTogether.pickWeek / markWeekDone — the link sends the same as
// 'week-pick' / 'week-done' events), and [했어요] can be taken back for 5 s.
// Nothing shows for the cycle owner, outside the preparing stage or in the
// quiet after a loss (linkWeek is undefined then).

import { useCallback, useMemo, useState } from 'react'
import LinkWeek from '@/components/link/LinkWeek'
import UndoToast, { type UndoMessage } from '@/components/log/UndoToast'
import { useToast } from '@/components/ui'
import { linkWeek } from '@/lib/logic/partnerSnapshot'
import { markWeekDone, pickWeek, unmarkWeekDone, type WeekOptionId } from '@/lib/logic/weekTogether'
import { useApp } from '@/lib/store'

export default function WeekTogether({ withChain, className }: { withChain: boolean; className?: string }) {
  const { state, update, today, me, cycleOwner } = useApp()
  const toast = useToast()
  const week = useMemo(() => linkWeek(state, today, me.id, withChain), [state, today, me.id, withChain])
  const [undo, setUndo] = useState<UndoMessage | null>(null)
  const expire = useCallback(() => setUndo(null), [])

  const pick = useCallback(
    (id: WeekOptionId) => {
      update((s) => pickWeek(s, me.id, id, today))
      toast.show('이번 주는 이걸로 해요')
    },
    [update, me.id, today, toast],
  )
  const done = useCallback(() => {
    update((s) => markWeekDone(s, me.id, today))
    setUndo({ id: Date.now(), text: `했어요 · ${cycleOwner.name}님에게 전해져요` })
  }, [update, me.id, today, cycleOwner.name])
  const undoDone = useCallback(() => {
    update((s) => unmarkWeekDone(s, me.id, today))
    setUndo(null)
  }, [update, me.id, today])

  if (!week) return null
  return (
    <>
      <LinkWeek week={week} ownerName={cycleOwner.name} onPick={pick} onDone={done} className={className} />
      <UndoToast message={undo} onUndo={undoDone} onExpire={expire} />
    </>
  )
}
