'use client'

// 2–3 date ideas inside the "우리의 주간" card (the 데이트 tab's place on the
// home screen). Only ideas and map links — no date is picked for anyone here.
// Same gate as the 둘만의 시간 screen (dateIdeas.fertileHintsAllowed): nothing
// in low-pressure mode or with alerts off, while resting or waiting for the clinic.

import { BUDGET_META, DATE_IDEAS } from '@/lib/content/dateIdeas'
import { fertileHintsAllowed, mapLinks, pickIdeas, recentlyPlannedIdeaIds } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'

export default function OurWeekIdeas({ count = 2 }: { count?: number }) {
  const { state, today, me } = useApp()
  if (!fertileHintsAllowed(state, me.id)) return null
  const picks = pickIdeas(DATE_IDEAS, {
    today,
    stage: state.stage,
    excludeIds: recentlyPlannedIdeaIds(state.datePlans, today),
    count,
  })
  if (picks.length === 0) return null
  return (
    <ul aria-label="이번 주 둘만의 시간 아이디어" className="mt-3 divide-y divide-line/60 rounded-xl bg-surface/80 px-3">
      {picks.map((idea) => {
        const links = mapLinks(idea.mapQuery)
        const budget = BUDGET_META[idea.budget]
        return (
          <li key={idea.id} className="flex items-center gap-2.5 py-1">
            <span aria-hidden className="text-xl">
              {idea.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{idea.title}</span>
              <span className="block truncate text-[11px] text-ink-3">
                {idea.duration} · <span aria-hidden>{budget.symbol}</span>
                <span className="sr-only">예산 {budget.label}</span>
              </span>
            </span>
            <a
              href={links.kakao}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 text-[11px] font-semibold text-brand-ink hover:underline"
            >
              카카오맵<span className="sr-only">에서 {idea.title} 찾기 (새 창)</span>
            </a>
            <a
              href={links.naver}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 text-[11px] font-semibold text-brand-ink hover:underline"
            >
              네이버<span className="sr-only">지도에서 {idea.title} 찾기 (새 창)</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
