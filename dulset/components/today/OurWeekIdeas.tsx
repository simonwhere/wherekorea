'use client'

// 2 date ideas inside the "우리의 주간" card (the 데이트 tab's place on the
// home screen). Only ideas and map links — no date is picked for anyone here.
// The pick is lib/logic/partnerSnapshot.linkIdeas, the same two the partner's
// no-install page shows (so the two screens never drift): same-day ideas
// only, the recently planned ones left out, and nothing at all when the
// 둘만의 시간 gate says so (dateIdeas.fertileHintsAllowed: low-pressure mode,
// alerts off, resting, waiting for the clinic).

import { cx } from '@/components/ui'
import { linkIdeas } from '@/lib/logic/partnerSnapshot'
import { useApp } from '@/lib/store'

/** `className` sets the box's margin and fill (surface-2 on a surface card). */
export default function OurWeekIdeas({ className = 'mt-3.5 bg-surface-2' }: { className?: string }) {
  const { state, today, me } = useApp()
  const picks = linkIdeas(state, today, me.id)
  if (picks.length === 0) return null
  return (
    <ul aria-label="이번 주 둘만의 시간 아이디어" className={cx('divide-y divide-line/80 rounded-[18px] py-0.5 pl-3 pr-1.5', className)}>
      {picks.map((idea) => (
        <li key={idea.id} className="flex min-h-14 items-center gap-2.5">
          <span aria-hidden className="w-7 shrink-0 text-center text-[22px]">
            {idea.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-bold tracking-[-0.02em] text-ink">{idea.title}</span>
            <span className="mt-px block truncate text-xs text-ink-3">
              {idea.duration} · <span aria-hidden>{idea.budget}</span>
              <span className="sr-only">예산 {idea.budget.length}단계</span>
            </span>
          </span>
          <a
            href={idea.kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center px-[5px] text-xs font-bold text-brand-ink hover:underline"
          >
            카카오맵<span className="sr-only">에서 {idea.title} 찾기 (새 창)</span>
          </a>
          <a
            href={idea.naver}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center px-[5px] text-xs font-bold text-brand-ink hover:underline"
          >
            네이버<span className="sr-only">지도에서 {idea.title} 찾기 (새 창)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
