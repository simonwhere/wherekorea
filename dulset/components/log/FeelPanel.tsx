'use client'

// 오늘 컨디션 (N11) in the 메모 panel's '자세히' (N29 — an optional input:
// the home no longer asks for it): six chips saved straight to the viewer's
// own log (personalLog — never the partner's screen, never in anything
// shared). Saving keeps the sheet open, so a line can follow in the 메모 field.

import { useToast } from '@/components/ui'
import FeelChips from '@/components/today/FeelChips'
import { FEEL_PANEL_NOTE } from '@/lib/content/fertility'
import { personalDay, setFeel } from '@/lib/logic/personalLog'
import { useApp } from '@/lib/store'
import type { ISODate, PersonalFeel } from '@/lib/types'

export default function FeelPanel({ date }: { date: ISODate }) {
  const { state, update, today, viewer } = useApp()
  const toast = useToast()
  const current = personalDay(state, viewer, date)?.feel

  const pick = (feel: PersonalFeel | undefined) => {
    update((s) => setFeel(s, viewer, date, feel))
    toast.show(feel ? '오늘 컨디션을 남겼어요 · 나만 볼 수 있어요' : '컨디션 기록을 지웠어요')
  }

  return (
    <section aria-label="오늘 컨디션" className="rounded-xl2 border border-line bg-surface p-3">
      <p className="text-xs font-semibold text-ink-2">{date === today ? '오늘 컨디션' : '이 날 컨디션'}</p>
      <FeelChips value={current} onChange={pick} className="mt-2" />
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{FEEL_PANEL_NOTE}</p>
    </section>
  )
}
