'use client'

// "주기 띠" — the earlier linear strip (the home now draws CycleRing /
// WeekRow; this stays for any other screen that wants a straight strip).
// This cycle at a glance (day 1 … length), today marked, the
// estimated window as a gradient with the 2–3 peak days darker, logged period
// days and LH marks. A partner without shared details sees two calendar weeks
// with only the shared "우리의 주간" band (lib/logic/ttcFlow.cycleStrip).
// Peak days and LH marks follow the calendar's rule (calendarView.showsPeak /
// showsLH): the peak for anyone with details — "특히 좋은 때 (예상)" in soft
// wording — and LH only in explicit wording.

import { cx } from '@/components/ui'
import { weekdayKo } from '@/lib/dates'
import { describeStrip } from '@/lib/logic/cycleRing'
import type { CycleStrip as Strip, StripDay } from '@/lib/logic/ttcFlow'

/** Literal class names (Tailwind only compiles what it can see). */
function fill(d: StripDay): string {
  switch (d.tone) {
    case 'period':
      return 'bg-period'
    case 'period-predicted':
      return 'bg-period/30'
    case 'peak':
      return 'bg-fert'
    case 'fertile':
      return d.level >= 0.6 ? 'bg-fert/60' : d.level >= 0.5 ? 'bg-fert/50' : d.level >= 0.4 ? 'bg-fert/40' : 'bg-fert/30'
    default:
      return 'bg-surface-2'
  }
}

/** Keep an edge label inside the strip. */
function labelPos(index: number, count: number): React.CSSProperties {
  const pct = ((index + 0.5) / count) * 100
  if (pct < 12) return { left: 0 }
  if (pct > 88) return { right: 0 }
  return { left: `${pct}%`, transform: 'translateX(-50%)' }
}

/** The strip / ring / week row as a sentence (their role="img" label). */
export function describe(strip: Strip, opts: { quietWindow?: boolean } = {}): string {
  return describeStrip(strip, { quietWindow: !!opts.quietWindow })
}

export default function CycleStrip({ strip }: { strip: Strip }) {
  const n = strip.days.length
  const hasPeriod = strip.days.some((d) => d.tone === 'period' || d.tone === 'period-predicted')
  const hasSurge = strip.days.some((d) => d.lh === 'surge')
  const hasLow = strip.days.some((d) => d.lh === 'low')
  const hasBand = strip.days.some((d) => d.tone === 'fertile' || d.tone === 'peak')
  const hasPeak = strip.days.some((d) => d.tone === 'peak') && !!strip.peakLabel
  const today = strip.days[strip.todayIndex]

  return (
    <div>
      <div role="img" aria-label={describe(strip)} className="relative pt-1">
        <div className={cx('flex items-end', n > 35 ? 'gap-px' : 'gap-[2px]')}>
          {strip.days.map((d) => (
            <div key={d.date} className="relative flex min-w-0 flex-1 flex-col items-center">
              <div
                className={cx(
                  'w-full rounded-[3px]',
                  fill(d),
                  d.today ? 'h-8 ring-2 ring-ink ring-offset-1 ring-offset-surface' : 'h-6',
                )}
              />
              {/* LH mark under the day: filled for a surge, hollow otherwise. */}
              <span
                aria-hidden
                className={cx(
                  'mt-1 h-1.5 w-1.5 rounded-full',
                  d.lh === 'surge' ? 'bg-fert' : d.lh === 'low' ? 'border border-ink-3' : 'bg-transparent',
                )}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="relative mt-0.5 h-4 text-[11px] font-medium leading-4 text-ink-3">
          {strip.mode === 'weeks' ? (
            <div className="flex gap-[2px]">
              {strip.days.map((d) => (
                <span key={d.date} className={cx('min-w-0 flex-1 text-center', d.today && 'font-bold text-ink')}>
                  {weekdayKo(d.date)}
                </span>
              ))}
            </div>
          ) : (
            <>
              {strip.todayIndex > 2 ? <span className="absolute left-0">{strip.startLabel}</span> : null}
              {strip.todayIndex < n - 3 ? <span className="absolute right-0">{strip.endLabel}</span> : null}
              {today ? (
                <span className="absolute whitespace-nowrap font-bold text-ink" style={labelPos(strip.todayIndex, n)}>
                  오늘
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      {hasPeriod || hasBand || hasSurge || hasLow ? (
        <ul aria-hidden className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
          {hasPeriod ? (
            <li className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-period" />
              생리
            </li>
          ) : null}
          {hasBand && strip.windowLabel ? (
            <li className="inline-flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm bg-gradient-to-r from-fert/30 to-fert/60" />
              {strip.windowLabel}
            </li>
          ) : null}
          {hasPeak ? (
            <li className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-fert" />
              {strip.peakLabel}
            </li>
          ) : null}
          {hasSurge || hasLow ? (
            <li className="inline-flex items-center gap-1">
              {hasSurge ? <span className="h-1.5 w-1.5 rounded-full bg-fert" /> : null}
              {hasLow ? <span className="h-1.5 w-1.5 rounded-full border border-ink-3" /> : null}
              {hasSurge && hasLow ? 'LH 양성 · 기록' : hasSurge ? 'LH 양성' : 'LH 기록'}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
