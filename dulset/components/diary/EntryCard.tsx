'use client'

import { useState } from 'react'
import { Avatar, Card, cx } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { moodLabel } from '@/lib/logic/diaryExport'
import type { DiaryEntry, Member, Stage } from '@/lib/types'
import DiaryPhoto from './Photo'

// Stage hue on the background; text stays ink-2/brand-ink so 11px labels keep 4.5:1 contrast.
const BADGE_TONE: Record<Stage, string> = {
  preparing: 'bg-brand-soft text-brand-ink',
  pregnant: 'bg-fert-soft text-ink-2',
  parenting: 'bg-ok-soft text-ink-2',
}

/** Long entries start folded so the timeline stays scannable. */
const FOLD_CHARS = 240
const FOLD_LINES = 7

const actionClass =
  'flex h-11 items-center rounded-xl px-3 text-xs font-semibold hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export default function EntryCard({
  entry,
  author,
  mine,
  stageLabel,
  onEdit,
  onDelete,
}: {
  entry: DiaryEntry
  author: Member
  mine: boolean
  stageLabel: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const foldable = entry.text.length > FOLD_CHARS || entry.text.split('\n').length > FOLD_LINES
  const folded = foldable && !expanded
  const day = formatKo(entry.date)
  const mood = entry.mood ? moodLabel(entry.mood) ?? '기분' : undefined

  return (
    <Card as="article">
      <header className="flex items-center gap-2.5">
        <Avatar member={author} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="truncate">{author.name}</span>
            {mine ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] font-medium text-ink-3">나</span>
            ) : null}
          </p>
          <p className="text-xs text-ink-3">
            <time dateTime={entry.date}>{day}</time>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.mood ? (
            <span className="text-xl leading-none" role="img" aria-label={`기분: ${mood}`} title={mood}>
              {entry.mood}
            </span>
          ) : null}
          <span
            className={cx('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', BADGE_TONE[entry.stage])}
          >
            {stageLabel}
          </span>
        </div>
      </header>

      {entry.text ? (
        <>
          <p
            className={cx(
              'mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink',
              folded && 'line-clamp-6',
            )}
          >
            {entry.text}
          </p>
          {foldable ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={cx(actionClass, '-ml-3 text-ink-2')}
            >
              {expanded ? '접기' : '더 보기'}
            </button>
          ) : null}
        </>
      ) : null}

      {entry.photoId ? (
        <DiaryPhoto photoId={entry.photoId} alt={`${author.name}의 사진 · ${formatKo(entry.date, { weekday: false })}`} />
      ) : null}

      {mine ? (
        <div className="-mb-2 -mr-2 mt-1 flex justify-end">
          <button type="button" onClick={() => onEdit(entry.id)} className={cx(actionClass, 'text-ink-2')}>
            고치기<span className="sr-only"> ({day} 기록)</span>
          </button>
          <button type="button" onClick={() => onDelete(entry.id)} className={cx(actionClass, 'text-period')}>
            지우기<span className="sr-only"> ({day} 기록)</span>
          </button>
        </div>
      ) : null}
    </Card>
  )
}
