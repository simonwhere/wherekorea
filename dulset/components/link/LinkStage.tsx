'use client'

// The pregnant stage's card on the partner page (2026-10-09) — the app's
// StageHero on his side, in the place the moment card has while preparing:
// '임신 12주 3일', the trimester, a bar through 40 weeks, '예정일 … (예상)' and
// D-N (pregnancy weeks and the due date are known to both once she switched
// the stage), and his next shared checkup within two weeks with what he does
// that day ('다음 병원 일정' — a checkup, a test or a shot) — a visit of hers:
// the day only and '같이 갈 수 있으면 시간 비워 두기';
// one they go to together: the day, the time and the place. The name is the
// catalogue's for the item it is for, or a kind word — never the appointment's
// own title or note (lib/logic/partnerSnapshot linkStageCard). When that visit
// is booked for one of the items in 같이 챙길 것 (`item`), its [같이 할게요]
// sits here and LinkBody leaves the row out of the list — the visit shows once.

import { Badge, ProgressBar } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SnapshotStageCard } from '@/lib/logic/partnerSnapshot'
import type { LinkTogetherItem } from '@/lib/logic/together'
import type { ISODate } from '@/lib/types'
import { SupportToggle } from './LinkTogether'
import { clinicWhen } from './model'

export default function LinkStage({
  card,
  ownerName,
  today,
  item,
  onSupport,
  className,
}: {
  card: SnapshotStageCard
  /** '지은' — whose checkup a 'hers' one is. */
  ownerName: string
  today: ISODate
  /** The 같이 챙길 것 item the next visit is booked for (his marks applied), if the list carries it. */
  item?: LinkTogetherItem
  onSupport?: (item: LinkTogetherItem, on: boolean) => void
  className?: string
}) {
  const k = card.checkup
  return (
    <section
      aria-label="우리의 임신 주수"
      data-stage-card
      className={cx(
        'rounded-card bg-surface px-[18px] pb-[18px] pt-4 shadow-warm dark:border dark:border-line/70 dark:shadow-none',
        className,
      )}
    >
      <p className="flex min-h-[22px] items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
        <Icon name="bump" className="h-4 w-4 shrink-0" />
        {card.eyebrow}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[23px] font-extrabold leading-[1.3] tracking-[-0.04em] text-ink">{card.title}</h2>
        <Badge tone="brand" className="text-[12px]">
          {card.dday}
        </Badge>
      </div>
      <div className="mt-3">
        <ProgressBar value={card.progress} label="40주 중 진행" />
        <div className="mt-1.5 flex justify-between gap-2 text-[11.5px] font-medium text-ink-3">
          <span className="tabular-nums">{card.weeks}주 / 40주</span>
          <span className="min-w-0 truncate">{card.dueLabel}</span>
        </div>
      </div>
      {k ? (
        <div className="mt-3.5 rounded-[18px] bg-surface-2 p-3.5" data-stage-checkup>
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
            <Icon name="cal" className="h-4 w-4 shrink-0 text-brand-ink" />
            다음 병원 일정 · {clinicWhen(k.date, k.time, today)}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-3">
            {k.label}
            {k.place ? ` · ${k.place}` : ''} · {k.with === 'both' ? '둘이 함께' : `${ownerName}님`}
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-2">
            <b className="font-bold text-ink">내가 할 것</b> · {k.role}
          </p>
          {item && onSupport ? <SupportToggle item={item} onSupport={onSupport} /> : null}
        </div>
      ) : null}
    </section>
  )
}
