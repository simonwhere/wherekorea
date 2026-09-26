'use client'

import { cx } from '@/components/ui'
import { REACTIONS, reactionLabel } from '@/lib/logic/usView'
import type { Member } from '@/lib/types'

/**
 * A small row of feelings on the partner's entry (Between-style: no comment
 * thread, no counts). Tapping the chosen one again takes it back.
 */
export function ReactionPicker({
  author,
  value,
  day,
  onChange,
}: {
  author: Member
  value: string | undefined
  /** '9월 3일 (목)' — tells screen-reader users which entry the row belongs to. */
  day: string
  onChange: (next: string | null) => void
}) {
  return (
    <div role="group" aria-label={`${author.name}님의 ${day} 기록에 마음 남기기`} className="flex items-center gap-0.5">
      {REACTIONS.map((r) => {
        const on = value === r.emoji
        return (
          <button
            key={r.emoji}
            type="button"
            aria-pressed={on}
            aria-label={r.label}
            title={r.label}
            onClick={() => onChange(on ? null : r.emoji)}
            className={cx(
              'flex h-11 w-11 items-center justify-center rounded-full border text-lg transition',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
              on
                ? 'scale-105 border-brand bg-brand-soft'
                : cx('border-transparent hover:bg-surface-2', value ? 'opacity-50 hover:opacity-100' : 'opacity-80'),
            )}
          >
            <span aria-hidden>{r.emoji}</span>
          </button>
        )
      })}
      <span aria-hidden className="ml-1 text-[11px] text-ink-3">
        {value ? '마음을 전했어요' : '마음 남기기'}
      </span>
    </div>
  )
}

/** Feelings the partner left on my entry. */
export function ReceivedReactions({ items }: { items: Array<{ member: Member; emoji: string }> }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap items-center gap-1" aria-label="받은 마음">
      {items.map(({ member, emoji }) => (
        <li
          key={member.id}
          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2"
        >
          <span aria-hidden className="text-sm leading-none">
            {emoji}
          </span>
          <span className="max-w-[7rem] truncate">{member.name}</span>
          <span className="sr-only">님이 ‘{reactionLabel(emoji) ?? emoji}’ 마음을 남겼어요</span>
        </li>
      ))}
    </ul>
  )
}
