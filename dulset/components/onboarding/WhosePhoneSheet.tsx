'use client'

// "이 폰은 누구 거예요?" — asked once after a backup lands on a phone (the
// welcome screen's restore, and 설정 › 데이터 after a restore there), and
// available any time from 설정 › 우리 둘. Two big choices, nothing else.

import { Avatar, Sheet, cx } from '@/components/ui'
import { ROLE_LABEL } from '@/lib/initial'
import type { Member, MemberId } from '@/lib/types'

export function WhosePhoneChooser({
  members,
  current,
  onPick,
  note,
}: {
  members: readonly Member[]
  /** The member this phone currently shows (marked, not preselected). */
  current?: MemberId
  onPick: (id: MemberId) => void
  note?: string
}) {
  return (
    <div>
      {note ? <p className="mb-4 text-sm leading-relaxed text-ink-2">{note}</p> : null}
      <div role="group" aria-label="이 폰의 주인" className="grid grid-cols-2 gap-2">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m.id)}
            className={cx(
              'flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl2 border px-2 py-3 transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              m.id === current ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2',
            )}
          >
            <Avatar member={m} size="lg" />
            <span className="max-w-full truncate text-sm font-bold text-ink">{m.name}</span>
            <span className="text-[11px] text-ink-3">
              {ROLE_LABEL[m.role]}
              {m.id === current ? ' · 지금 이 폰' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function WhosePhoneSheet({
  open,
  onClose,
  members,
  current,
  onPick,
}: {
  open: boolean
  onClose: () => void
  members: readonly Member[]
  current?: MemberId
  onPick: (id: MemberId) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="이 폰은 누구 거예요?">
      <WhosePhoneChooser members={members} current={current} onPick={onPick} />
    </Sheet>
  )
}
