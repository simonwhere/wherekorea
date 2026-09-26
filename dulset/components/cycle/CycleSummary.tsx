'use client'

import { Button, Card, Disclaimer, cx } from '@/components/ui'
import { ESTIMATE_DISCLAIMER, NICE_GUIDANCE } from '@/lib/content/fertility'
import { formatKo } from '@/lib/dates'
import { irregularMessage, type CycleSummary as Summary, type FertilityView } from '@/lib/logic/calendarView'
import type { ISODate } from '@/lib/types'

export default function CycleSummary({
  summary,
  view,
  today,
  onLogToday,
}: {
  summary: Summary
  view: FertilityView
  today: ISODate
  onLogToday: () => void
}) {
  const { status, headline, rows, cycleDay, stats } = summary
  const fertileNow = view !== 'hidden' && status.kind === 'fertile'
  const tone = fertileNow ? 'fert' : status.kind === 'late' ? 'brand' : 'default'

  return (
    <div className="space-y-3">
      <Card tone={tone}>
        <p className="text-xs font-medium text-ink-3">
          오늘 {formatKo(today)}
          {cycleDay !== undefined ? ` · 주기 ${cycleDay}일째` : ''}
        </p>
        <h2 className={cx('mt-1 text-xl font-bold leading-snug', fertileNow ? 'text-fert' : 'text-ink')}>{headline.title}</h2>
        {headline.sub ? <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{headline.sub}</p> : null}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-3">
          {rows.map((r) => (
            <div key={r.key} className={cx('min-w-0', r.wide && 'col-span-2')}>
              <dt className="text-[11px] font-medium text-ink-3">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink">
                {r.value}
                {r.sub ? <span className="ml-1.5 text-[11px] font-medium text-ink-3">{r.sub}</span> : null}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex">
          <Button variant={status.kind === 'late' ? 'primary' : 'secondary'} onClick={onLogToday}>
            {status.kind === 'late' ? '생리 시작 기록하기' : '오늘 기록하기'}
          </Button>
        </div>
        <Disclaimer>{ESTIMATE_DISCLAIMER}</Disclaimer>
      </Card>

      {stats.irregular ? (
        <Card tone="warn" as="div">
          <p className="flex gap-2 text-[13px] leading-relaxed text-ink">
            <span aria-hidden>🌀</span>
            <span>{irregularMessage(view)}</span>
          </p>
        </Card>
      ) : null}

      {view === 'hidden' ? (
        <Card tone="muted" as="div">
          <p className="text-sm font-bold text-ink">🌿 {NICE_GUIDANCE.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{NICE_GUIDANCE.body}</p>
          <a
            href={NICE_GUIDANCE.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-[44px] items-center text-xs font-medium text-brand-ink underline underline-offset-2"
          >
            출처: {NICE_GUIDANCE.source.name}
          </a>
        </Card>
      ) : null}
    </div>
  )
}
