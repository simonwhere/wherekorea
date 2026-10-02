'use client'

import { Card } from '@/components/ui'
import { Icon, IconTile } from '@/components/ui/icons'
import { promptFor } from '@/lib/logic/diary'
import { useApp } from '@/lib/store'
import { goDiary } from './bits'

/**
 * "사진 한 장 + 한 줄" nudge → 육아일기 tab. Shows the same daily prompt the
 * diary composer opens with, and whether either of us already wrote today.
 */
export default function DiaryQuick() {
  const { state, today, me, partner } = useApp()
  const prompt = promptFor(state.stage, today)
  const todays = state.diary.filter((d) => d.date === today)
  const mine = todays.some((d) => d.author === me.id)
  const theirs = todays.some((d) => d.author === partner.id)
  const title = mine
    ? '오늘 기록을 남겼어요 · 더 쓰기'
    : theirs
      ? `${partner.name}님이 오늘 기록을 남겼어요 · 나도 쓰기`
      : '사진 한 장 + 한 줄'

  return (
    <Card as="div" className="py-3">
      <button type="button" onClick={goDiary} className="flex min-h-[48px] w-full items-center gap-3 text-left">
        <IconTile name="cam" tone="bg-brand-soft" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{title}</span>
          <span className="block truncate text-xs text-ink-3">{prompt}</span>
        </span>
        <Icon name="right" className="h-5 w-5 text-ink-3" />
      </button>
    </Card>
  )
}
