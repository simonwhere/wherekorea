'use client'

import { SectionTitle } from '@/components/ui'
import { DATE_IDEAS, type DateIdea } from '@/lib/content/dateIdeas'
import { pickIdeas, recentlyPlannedIdeaIds, upcomingIdeaDates } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'
import IdeaCard from './IdeaCard'

/** "이번 주 추천" — three ideas that change every Monday. */
export default function WeeklyPicks({ onPlan }: { onPlan: (idea: DateIdea) => void }) {
  const { state, today } = useApp()
  const picks = pickIdeas(DATE_IDEAS, {
    today,
    stage: state.stage,
    excludeIds: recentlyPlannedIdeaIds(state.datePlans, today),
  })
  if (picks.length === 0) return null
  // Planned ideas only come back when nothing else is left; say so on the card.
  const planned = upcomingIdeaDates(state.datePlans, today)

  return (
    <section className="mt-6">
      <SectionTitle sub="매주 월요일에 새로 골라 드려요 · 옆으로 넘겨 보세요">이번 주 추천</SectionTitle>
      <ul
        aria-label="이번 주 추천 데이트"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {picks.map((idea) => (
          <li key={idea.id} className="w-[82%] max-w-[320px] shrink-0 snap-start">
            <IdeaCard idea={idea} featured onPlan={onPlan} plannedOn={planned.get(idea.id)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
