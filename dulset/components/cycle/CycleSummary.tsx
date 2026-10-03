'use client'

import { Button, Card, Disclaimer, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ESTIMATE_DISCLAIMER, NICE_GUIDANCE } from '@/lib/content/fertility'
import { formatKo } from '@/lib/dates'
import { irregularMessage, type CycleSummary as Summary, type Lens } from '@/lib/logic/calendarView'
import type { ISODate } from '@/lib/types'

export default function CycleSummary({
  summary,
  lens,
  today,
  onLog,
  onRest,
  onResume,
}: {
  summary: Summary
  lens: Lens
  today: ISODate
  /** Owner only: opens "+ 기록" on today. */
  onLog?: () => void
  /** Owner only: "이번 주기는 쉬어 갈래요". */
  onRest?: () => void
  /** Owner only: end the rest cycle (or, with a clinic pause, 병원 준비 마치기). */
  onResume?: () => void
}) {
  const { status, headline, rows, cycleDay, stats } = summary
  const { view, pause, details } = lens
  const fertileNow =
    view !== 'hidden' && !pause && (status.kind === 'fertile' || (!details && status.kind === 'period' && !!status.fertileEnd))
  const waitingForPeriod = details && !pause && (status.kind === 'late' || status.kind === 'after-pregnancy')
  const tone = fertileNow ? 'fert' : waitingForPeriod ? 'brand' : 'default'

  return (
    <div className="space-y-3">
      <Card tone={tone}>
        <p className="text-xs font-medium text-ink-3">
          오늘 {formatKo(today)}
          {cycleDay !== undefined ? ` · 주기 ${cycleDay}일째` : ''}
        </p>
        <h2 className={cx('mt-1 text-xl font-bold leading-snug', fertileNow ? 'text-fert' : 'text-ink')}>{headline.title}</h2>
        {headline.sub ? <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{headline.sub}</p> : null}

        {rows.length > 0 ? (
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
        ) : null}

        {onLog ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(pause === 'rest' || pause === 'clinic') && onResume ? (
              <Button variant="secondary" onClick={onResume}>
                {pause === 'clinic' ? '병원 준비 마치기' : '다시 켜기'}
              </Button>
            ) : null}
            {pause === 'positive' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.hash = 'plan'
                  window.scrollTo({ top: 0 })
                }}
              >
                병원 일정 넣기
              </Button>
            ) : null}
            <Button variant={waitingForPeriod ? 'primary' : 'secondary'} onClick={onLog}>
              {waitingForPeriod ? '생리 시작 기록하기' : '오늘 기록하기'}
            </Button>
          </div>
        ) : null}
        {/* A partner on 날짜 없음 is shown no estimate at all, so there is nothing to disclaim. */}
        {view === 'hidden' && !lens.owner ? null : <Disclaimer>{ESTIMATE_DISCLAIMER}</Disclaimer>}
        {onRest && !pause ? (
          <button
            type="button"
            onClick={onRest}
            className="mt-1 inline-flex min-h-[44px] items-center text-xs font-semibold text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            이번 주기는 쉬어 갈래요
          </button>
        ) : null}
      </Card>

      {details && !pause && stats.irregular ? (
        <Card tone="warn" as="div">
          <p className="flex gap-2 text-[13px] leading-relaxed text-ink">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-warn" strokeWidth={2} />
            <span>{irregularMessage(view)}</span>
          </p>
        </Card>
      ) : null}

      {/* NICE's '2~3일에 한 번' is a frequency line: hers to read in her own record tool, never pushed
          at the partner (docs/positioning.md §6 — on his side it reads as a quota; '날짜 없음' would
          otherwise put it on every partner's 주기 tab). */}
      {view === 'hidden' && lens.owner ? (
        <Card tone="muted" as="div">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Icon name="sprout" className="h-4 w-4 shrink-0 text-ink-2" />
            {NICE_GUIDANCE.title}
          </p>
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
