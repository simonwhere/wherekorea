'use client'

import { Card, Disclaimer, cx } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { WEEK_INFO_NOTE } from '@/lib/content/pregnancy'
import { weekBadgeLabel, weekInfoFor } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import type { Member } from '@/lib/types'

/** "아빠" for a husband, otherwise the neutral "파트너". */
export function supportLabel(m: Member): string {
  return m.role === 'husband' ? '아빠' : '파트너'
}

export default function WeekCard({ weeks }: { weeks: number }) {
  const { viewer, me, partner, cycleOwner: carrier } = useApp()
  const info = weekInfoFor(weeks)
  const supporter = carrier.id === me.id ? partner : me

  const tips: Array<{ who: Member; icon: IconName; heading: string; text: string; tone: string }> = [
    { who: carrier, icon: 'bump', heading: '엄마에게', text: info.mom, tone: 'bg-her-soft' },
    { who: supporter, icon: 'users', heading: `이번 주 ${supportLabel(supporter)} 할 일`, text: info.partner, tone: 'bg-him-soft' },
  ]
  // The viewer's own tip goes first.
  if (viewer === supporter.id) tips.reverse()

  return (
    <Card className="mt-3" as="section">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink">이번 주</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-2">
          {weekBadgeLabel(weeks, info)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-3xl"
        >
          {info.sizeEmoji}
        </span>
        <p className="min-w-0 text-sm text-ink-2">
          <span className="mr-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">대략</span>
          <b className="font-bold text-ink">{info.size}</b>만 한 크기예요
        </p>
      </div>

      <ul className="mt-3 space-y-1.5">
        {info.highlights.map((h) => (
          <li key={h} className="flex gap-2 text-sm leading-relaxed text-ink">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            {h}
          </li>
        ))}
      </ul>

      <div className="mt-3 grid gap-2">
        {tips.map((t) => (
          <div key={t.heading} className={cx('rounded-xl p-3', t.tone)}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
              <Icon name={t.icon} className="h-4 w-4" />
              {t.heading}
              {t.who.id === viewer ? (
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">나</span>
              ) : null}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{t.text}</p>
          </div>
        ))}
      </div>

      <Disclaimer>{WEEK_INFO_NOTE}</Disclaimer>
    </Card>
  )
}
