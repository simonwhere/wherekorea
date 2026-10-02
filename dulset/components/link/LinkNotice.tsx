'use client'

// The calm full-page notices of the partner page: an expired or unknown
// link, a malformed address, a snapshot the owner's phone has not refreshed,
// and nothing loaded while offline. No health word, no detail — just what to
// do next.

import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import Polaroid from '@/components/cover/Polaroid'
import { Pill } from './bits'
import { noticeCopy, type NoticeKind } from './model'

export type { NoticeKind }

export default function LinkNotice({ kind, ownerName, onRetry }: { kind: NoticeKind; ownerName?: string; onRetry?: () => void }) {
  const copy = noticeCopy(kind, ownerName)
  return (
    <section aria-label={copy.title} className="pt-2">
      <Polaroid
        decorated={false}
        quiet
        caption={<span className="min-w-0 truncate text-[12.5px] font-medium text-ink-3">둘셋 · 설치 없이 보는 화면</span>}
      >
        <CoverArt tod={timeOfDay(new Date().getHours())} quiet className="absolute inset-0" />
      </Polaroid>
      <div className="mt-6 px-1 text-center">
        <h1 className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink">{copy.title}</h1>
        <p className="mt-2 text-[14.5px] leading-[1.55] text-ink-2">{copy.body}</p>
        {onRetry ? (
          <div className="mt-5">
            <Pill tone="outline" onClick={onRetry}>
              다시 시도
            </Pill>
          </div>
        ) : null}
      </div>
    </section>
  )
}
