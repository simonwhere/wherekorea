'use client'

// The moment card on the partner page — components/today/CycleBlock's partner
// card, word for word from the snapshot: eyebrow, title, body, note, the week
// row (the shared "우리의 주간" band only), the month task when the card
// features it, '오늘 해 줄 수 있는 것', two date ideas, and after a loss the
// quiet support list. 잠금화면 숨김 to the card: VEIL_COPY until he taps.
// The app's action labels (달력 보기, 아이디어 더 보기 …) lead to screens the
// page does not have, so they are not drawn here.

import { useState } from 'react'
import LossSupport from '@/components/today/LossSupport'
import { cx } from '@/components/ui'
import type { PartnerSnapshot, SnapshotIdea, SnapshotTask } from '@/lib/logic/partnerSnapshot'
import { VEIL_COPY, estimateMarks, type MomentTone } from '@/lib/logic/ttcFlow'
import { Pill } from './bits'
import { LinkTaskBody } from './LinkTask'
import LinkWeekRow from './LinkWeekRow'

const EYEBROW: Record<MomentTone, string> = {
  default: 'text-ink-2',
  brand: 'text-brand-ink',
  fert: 'text-fert',
  muted: 'text-ink-3',
}

function Ideas({ ideas, className }: { ideas: SnapshotIdea[]; className?: string }) {
  if (!ideas.length) return null
  return (
    <ul aria-label="이번 주 둘만의 시간 아이디어" className={cx('divide-y divide-line/80 rounded-[18px] py-0.5 pl-3 pr-1.5', className)}>
      {ideas.map((idea) => (
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

export default function LinkMoment({
  snapshot,
  task,
  onTaskDone,
  className,
}: {
  snapshot: PartnerSnapshot
  /** The month task when the card features it (moment.monthlyTask), with his local mark. */
  task?: { task: SnapshotTask; done: boolean }
  onTaskDone: (task: SnapshotTask) => void
  className?: string
}) {
  const m = snapshot.moment
  const [revealed, setRevealed] = useState(false)
  if (!m) return null
  const muted = m.tone === 'muted'
  const inner = cx('mt-3.5 rounded-[18px] p-3.5', muted ? 'bg-surface' : 'bg-surface-2')
  // "(예상)" once per card (components/today/CycleBlock): the band legend drops its own when the copy has it.
  const estimate = [m.eyebrow, m.title, m.body, m.note, m.partnerTip].some((t) => estimateMarks(t) > 0) ? 'none' : 'one'

  if (m.veiled && !revealed) {
    return (
      <section
        aria-label="오늘의 우리"
        className={cx(
          'rounded-card border border-transparent bg-surface px-[18px] pb-[18px] pt-4 shadow-warm dark:border-line/70 dark:shadow-none forced-colors:border-line',
          className,
        )}
      >
        <p className="min-h-[22px] text-[12.5px] font-bold tracking-[-0.01em] text-ink-2">{VEIL_COPY.eyebrow}</p>
        <h2 className="mt-1 text-[23px] font-extrabold leading-[1.3] tracking-[-0.04em] text-ink">{VEIL_COPY.title}</h2>
        <p className="mt-1 text-[14.5px] leading-[1.55] tracking-[-0.01em] text-ink-2">{VEIL_COPY.body}</p>
        <div className="mt-4">
          <Pill tone="outline" className="w-full" onClick={() => setRevealed(true)}>
            {VEIL_COPY.action}
          </Pill>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="오늘의 우리"
      className={cx(
        'rounded-card border px-[18px] pb-[18px] pt-4',
        'border-transparent dark:border-line/70 forced-colors:border-line',
        muted ? 'bg-surface-2' : 'bg-surface shadow-warm dark:shadow-none',
        className,
      )}
    >
      {m.eyebrow ? <p className={cx('min-h-[22px] text-[12.5px] font-bold tracking-[-0.01em]', EYEBROW[m.tone])}>{m.eyebrow}</p> : null}
      <h2 className="mt-1 text-[23px] font-extrabold leading-[1.3] tracking-[-0.04em] text-ink">{m.title}</h2>
      <div className="mt-1">
        <p className="text-[14.5px] leading-[1.55] tracking-[-0.01em] text-ink-2">{m.body}</p>
        {m.note ? <p className="mt-[5px] text-[12.5px] leading-[1.5] text-ink-3">{m.note}</p> : null}
      </div>

      {snapshot.strip ? <LinkWeekRow strip={snapshot.strip} estimate={estimate} /> : null}

      {task ? <LinkTaskBody task={task.task} done={task.done} onDone={onTaskDone} onSurface2={!muted} className={inner} /> : null}

      {m.partnerTip ? (
        <p className={cx(inner, 'text-[13px] leading-[1.55] text-ink-2')}>
          <b className="font-bold text-ink">오늘 해 줄 수 있는 것</b> · {m.partnerTip}
        </p>
      ) : null}

      <Ideas ideas={snapshot.ideas} className={cx('mt-3.5', muted ? 'bg-surface' : 'bg-surface-2')} />

      {m.support ? <LossSupport heading={false} className="mt-3" /> : null}
    </section>
  )
}
