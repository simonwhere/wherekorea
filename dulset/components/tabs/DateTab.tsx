'use client'

import { useCallback, useState } from 'react'
import DateBanner from '@/components/date/DateBanner'
import IdeaBrowser from '@/components/date/IdeaBrowser'
import PlanList from '@/components/date/PlanList'
import PlanSheet from '@/components/date/PlanSheet'
import WeeklyPicks from '@/components/date/WeeklyPicks'
import type { DateIdea } from '@/lib/content/dateIdeas'
import { useApp } from '@/lib/store'

/**
 * 데이트 (육아 중엔 "둘만의") tab: a gentle context line, this week's three
 * picks, our shared plans, then every idea with filters. Adding a plan sends
 * the partner a proposal notice.
 */
export default function DateTab() {
  // null = closed; { idea: undefined } = a plan without an idea (직접 추가).
  const [draft, setDraft] = useState<{ idea?: DateIdea } | null>(null)
  const open = useCallback((idea?: DateIdea) => setDraft({ idea }), [])
  // Stable identity: the Sheet re-focuses its panel whenever onClose changes.
  const close = useCallback(() => setDraft(null), [])

  const { state } = useApp()
  return (
    <div>
      {/* Every tab exposes an h1 for heading navigation; the banner carries the visible title. */}
      <h1 className="sr-only">{state.stage === 'parenting' ? '둘만의 시간' : '데이트'}</h1>
      <DateBanner />
      <WeeklyPicks onPlan={open} />
      <PlanList onAdd={() => open()} />
      <IdeaBrowser onPlan={open} />
      {draft ? <PlanSheet idea={draft.idea} onClose={close} /> : null}
    </div>
  )
}
