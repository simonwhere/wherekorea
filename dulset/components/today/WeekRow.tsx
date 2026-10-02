'use client'

// The partner's week on the "우리의 주간" card (strip.mode 'weeks' — no shared
// details): this week Monday–Sunday, plus next week only when the band runs
// into it. A soft violet band sits behind the shared window's days; today is an
// ink ring (never violet — violet means the window). Nothing here says when
// her period started: cycleStrip only hands over the shared window.

import { cx } from '@/components/ui'
import { addDays } from '@/lib/dates'
import { upcomingWindows } from '@/lib/logic/cycle'
import { plainLegendLabel, weekRows, type WeekBand } from '@/lib/logic/cycleRing'
import type { CycleStrip } from '@/lib/logic/ttcFlow'
import { useApp } from '@/lib/store'
import { describe } from './CycleStrip'

const pct = (n: number) => `${(n / 7) * 100}%`

function Band({ band }: { band: WeekBand }) {
  return (
    <span
      aria-hidden
      className={cx(
        'absolute inset-y-0 bg-gradient-to-r from-fert/10 to-fert/[.22]',
        band.roundStart && 'rounded-l-full',
        band.roundEnd && 'rounded-r-full',
      )}
      style={{ left: pct(band.from), width: pct(band.to - band.from + 1) }}
    />
  )
}

export default function WeekRow({
  strip,
  estimate,
}: {
  strip: CycleStrip
  /** "(예상)" once per card: 'none' when the card's copy carries it (the band label goes plain). */
  estimate?: 'none' | 'one'
}) {
  const { state } = useApp()
  const bandLabel = strip.windowLabel && estimate === 'none' ? plainLegendLabel(strip.windowLabel) : strip.windowLabel
  const monday = strip.days[0]?.date
  // Did the same shared window already run on the Sunday before? Then the band's
  // left end is square (it continues), like the mockup's cut strip.
  const bandBefore =
    !!monday &&
    (strip.days[0]?.tone === 'fertile' || strip.days[0]?.tone === 'peak') &&
    upcomingWindows(state, addDays(monday, -1), 1).some((w) => w.fertileStart < monday)
  const rows = weekRows(strip, { bandBefore })

  return (
    <div role="img" aria-label={describe(strip)} className="mt-3.5">
      <div aria-hidden className="grid grid-cols-7 text-center">
        {rows[0]!.cells.map((c) => (
          <span
            key={c.date}
            className={cx('h-5 text-[11.5px] leading-5', c.today ? 'font-extrabold text-ink' : 'font-semibold text-ink-3')}
          >
            {c.weekday}
          </span>
        ))}
      </div>
      {rows.map((row, r) => (
        <div key={row.cells[0]!.date} aria-hidden className={cx('relative', r > 0 && 'mt-1')}>
          {row.bands.map((b) => (
            <Band key={b.from} band={b} />
          ))}
          <div className="relative grid grid-cols-7">
            {row.cells.map((c) => (
              <span key={c.date} className="flex h-10 items-center justify-center">
                <span
                  className={cx(
                    'flex h-9 w-9 items-center justify-center rounded-full text-base font-bold tabular-nums text-ink',
                    c.today && 'bg-surface shadow-[inset_0_0_0_2px_rgb(var(--ink))]',
                  )}
                >
                  {c.day}
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
      {strip.windowLabel && rows.some((r) => r.bands.length) ? (
        <p aria-hidden className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span className="h-[9px] w-4 rounded-full bg-gradient-to-r from-fert/[.12] to-fert/[.26]" />
          {bandLabel}
        </p>
      ) : null}
    </div>
  )
}
