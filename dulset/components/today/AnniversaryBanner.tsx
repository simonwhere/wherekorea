'use client'

import type { TabKey } from '@/components/AppShell'
import { Card } from '@/components/ui'
import { useApp } from '@/lib/store'
import { LinkButton } from './bits'
import { todaysAnniversaries } from './model'

/** "오늘은 우리의 날" — only on the day itself (100일 단위, N주년, 결혼 N주년, our own days). */
export default function AnniversaryBanner({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { state, today } = useApp()
  const events = todaysAnniversaries(state, today)
  if (events.length === 0) return null
  return (
    // A soft brand → fert wash, so it stands apart from the (solid) stage hero below it.
    <Card tone="brand" className="bg-gradient-to-br from-brand-soft via-surface to-fert-soft py-3.5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-2xl"
        >
          {events[0]!.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-2">오늘은 우리의 날</p>
          <h2 className="text-base font-extrabold leading-snug text-ink">{events.map((e) => e.title).join(' · ')}</h2>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-brand/15 pt-1">
        <p className="min-w-0 text-xs text-ink-2">오늘 이야기를 우리 기록에 남겨 볼까요?</p>
        <LinkButton onClick={() => onNavigate('diary')} arrow className="shrink-0">
          기록하기
        </LinkButton>
      </div>
    </Card>
  )
}
