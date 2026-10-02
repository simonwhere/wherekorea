'use client'

import { useMemo, useState } from 'react'
import { CHAPTER_BADGE_TONE } from '@/components/diary/EntryCard'
import { Avatar, Sheet, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { formatKo } from '@/lib/dates'
import { moodLabel } from '@/lib/logic/diaryExport'
import { chapterContext, chapterLabel, entryChapter, excerpt } from '@/lib/logic/usView'
import { useApp } from '@/lib/store'
import type { DiaryEntry, Member } from '@/lib/types'
import { usePhotoURL } from './usePhotoURL'

const navClass =
  'inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-surface-2 px-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * Full view of one album photo with its date, author, chapter and a bit of
 * the story. 최근 / 지난 step through the album (newest first). `onClose` must be stable.
 */
export default function PhotoViewer({
  list,
  openId,
  onMove,
  onClose,
  authorOf,
}: {
  list: DiaryEntry[]
  openId: string | null
  onMove: (id: string) => void
  onClose: () => void
  authorOf: (e: DiaryEntry) => Member
}) {
  const index = openId ? list.findIndex((e) => e.id === openId) : -1
  // A photo deleted on the other phone closes the viewer.
  const entry = index >= 0 ? list[index]! : null
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry ? formatKo(entry.date, { year: true }) : '사진'}>
      {entry ? (
        <ViewerBody
          entry={entry}
          author={authorOf(entry)}
          position={`${index + 1} / ${list.length}`}
          newer={index > 0 ? list[index - 1]!.id : null}
          older={index < list.length - 1 ? list[index + 1]!.id : null}
          onMove={onMove}
        />
      ) : null}
    </Sheet>
  )
}

function ViewerBody({
  entry,
  author,
  position,
  newer,
  older,
  onMove,
}: {
  entry: DiaryEntry
  author: Member
  position: string
  newer: string | null
  older: string | null
  onMove: (id: string) => void
}) {
  const { state } = useApp()
  const { settings, pregnancy, baby, createdAt } = state
  const ctx = useMemo(
    () => chapterContext({ settings, pregnancy, baby, createdAt }),
    [settings, pregnancy, baby, createdAt],
  )
  const { url, status } = usePhotoURL(entry.photoId)
  const [broken, setBroken] = useState<string | null>(null)
  const shown = url && broken !== url ? url : null
  const missing = status === 'missing' || (url !== null && broken === url)
  const chapter = entryChapter(entry, ctx)
  const mood = entry.mood ? moodLabel(entry.mood) ?? '기분' : undefined
  const alt = `${author.name}의 사진 · ${formatKo(entry.date, { year: true, weekday: false })}`

  return (
    <div>
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-surface-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: URL
          <img
            src={shown}
            alt={alt}
            className="h-full w-full object-contain"
            onError={() => setBroken(shown)}
          />
        ) : missing ? (
          <p className="flex items-center gap-1.5 px-4 text-center text-xs text-ink-3">
            <Icon name="cam" className="h-4 w-4" />
            이 기기에서 사진을 찾을 수 없어요.
          </p>
        ) : (
          <div className="h-full w-full animate-pulse bg-surface-2" role="img" aria-label="사진 불러오는 중" />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        <Avatar member={author} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{author.name}</p>
        {entry.mood ? (
          <span className="text-lg leading-none" role="img" aria-label={`기분: ${mood}`} title={mood}>
            {entry.mood}
          </span>
        ) : null}
        <span
          className={cx(
            'whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
            CHAPTER_BADGE_TONE[chapter],
          )}
        >
          {chapterLabel(entry, ctx)}
        </span>
      </div>

      {entry.text ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{excerpt(entry.text)}</p>
      ) : null}

      {/* aria-disabled (not disabled) so focus stays put when the end of the album is reached. */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          aria-disabled={!newer}
          onClick={() => newer && onMove(newer)}
          className={cx(navClass, !newer && 'cursor-default opacity-40')}
        >
          <span aria-hidden>←</span> 최근 사진
        </button>
        <span className="text-xs tabular-nums text-ink-3" aria-live="polite">
          {position}
        </span>
        <button
          type="button"
          aria-disabled={!older}
          onClick={() => older && onMove(older)}
          className={cx(navClass, !older && 'cursor-default opacity-40')}
        >
          지난 사진 <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  )
}
