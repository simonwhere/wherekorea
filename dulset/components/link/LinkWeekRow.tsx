'use client'

// The "우리의 주간" week row on the partner page — components/today/WeekRow
// without the store: the snapshot's strip is already in 'weeks' mode with
// only the shared band (lib/logic/partnerSnapshot.linkState), and the band's
// left end is drawn round (the page has no earlier window to continue).
// "(예상)" once per card, as in the app: when the card's copy already carries
// it, the band's legend goes plain (cycleRing.plainLegendLabel).

import { cx } from '@/components/ui'
import { plainLegendLabel, weekRows, type WeekBand } from '@/lib/logic/cycleRing'
import type { SnapshotStrip } from '@/lib/logic/partnerSnapshot'

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

export default function LinkWeekRow({
  strip,
  estimate = 'one',
  className,
}: {
  strip: SnapshotStrip
  /** 'none' when the card's copy already says "(예상)": the legend drops its own. */
  estimate?: 'none' | 'one'
  className?: string
}) {
  // Square left end when the same shared window ran on the Sunday before (strip.bandBefore), like the app.
  const rows = weekRows(strip, { bandBefore: !!strip.bandBefore })
  if (!rows[0]) return null
  const bandLabel = strip.windowLabel && estimate === 'none' ? plainLegendLabel(strip.windowLabel) : strip.windowLabel
  return (
    <div role="img" aria-label={strip.label} className={cx('mt-3.5', className)}>
      <div aria-hidden className="grid grid-cols-7 text-center">
        {rows[0].cells.map((c) => (
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
