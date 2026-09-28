'use client'

import { useCallback, useState } from 'react'
import DateBanner from '@/components/date/DateBanner'
import IdeaBrowser from '@/components/date/IdeaBrowser'
import PlanList from '@/components/date/PlanList'
import PlanSheet from '@/components/date/PlanSheet'
import WeeklyPicks from '@/components/date/WeeklyPicks'
import type { DateIdea } from '@/lib/content/dateIdeas'

/**
 * 둘만의 시간 아이디어 (#date). Not a bottom tab any more: it opens from the
 * 우리의 주간 card and 더 보기 on 오늘, so it carries its own title and a way
 * back. A gentle context line, this week's picks (with map links), our shared
 * plans, then every idea with filters. Adding a plan sends the partner a
 * proposal notice; the suggested day is the coming Saturday, never the window.
 */
export default function DateTab() {
  // null = closed; { idea: undefined } = a plan without an idea (직접 추가).
  const [draft, setDraft] = useState<{ idea?: DateIdea } | null>(null)
  const open = useCallback((idea?: DateIdea) => setDraft({ idea }), [])
  // Stable identity: the Sheet re-focuses its panel whenever onClose changes.
  const close = useCallback(() => setDraft(null), [])

  const back = () => {
    // AppShell follows the hash (#today); start the home screen at its top.
    window.location.hash = 'today'
    window.scrollTo({ top: 0 })
  }

  return (
    <div>
      <header className="mb-4 flex items-start gap-1">
        <button
          type="button"
          onClick={back}
          aria-label="오늘로 돌아가기"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span aria-hidden>←</span>
        </button>
        <div className="min-w-0 pt-1.5">
          {/* Focused by AppShell on arrival (tabIndex -1): no ring on a heading nobody tabs to. */}
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink outline-none">둘만의 시간 아이디어</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            가볍게 둘러보고, 마음에 들면 날짜를 골라 제안해요. 언제 할지는 둘이 편한 날로 정해요.
          </p>
        </div>
      </header>
      <DateBanner />
      <WeeklyPicks onPlan={open} />
      <PlanList onAdd={() => open()} />
      <IdeaBrowser onPlan={open} />
      {draft ? <PlanSheet idea={draft.idea} onClose={close} /> : null}
    </div>
  )
}
