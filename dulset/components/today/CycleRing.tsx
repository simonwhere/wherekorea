'use client'

// The cycle ring on the home's moment card (owner, and a partner she shares
// details with): one arc per day of this cycle, day 1 at 12 o'clock running
// clockwise; today's arc thicker with an ink dot just outside; LH records as
// small dots outside (explicit wording only — cycleStrip decides). The day
// count sits in the middle. Colours come from the theme tokens, so dark mode
// and the red-period / violet-window roles hold everywhere.

import { cx } from '@/components/ui'
import { arcAngles, ringArcs, type RingArc } from '@/lib/logic/cycleRing'
import type { CycleStrip } from '@/lib/logic/ttcFlow'
import { describe } from './CycleStrip'

const SIZE = 92
const C = SIZE / 2
const R = 35
const STROKE = 7

function arcColor(a: RingArc): string {
  switch (a.tone) {
    case 'period':
      return 'rgb(var(--period))'
    case 'period-predicted':
      return 'rgb(var(--period) / .3)'
    case 'peak':
      return 'rgb(var(--fert))'
    case 'fertile':
      return `rgb(var(--fert) / ${a.alpha})`
    default:
      return 'rgb(var(--line))'
  }
}

const pt = (deg: number, radius: number): [number, number] => {
  const rad = (deg * Math.PI) / 180
  return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)]
}
const f = (n: number) => n.toFixed(2)

export default function CycleRing({
  strip,
  quietWindow = false,
  className,
}: {
  strip: CycleStrip
  quietWindow?: boolean
  className?: string
}) {
  const arcs = ringArcs(strip, { quietWindow })
  const n = arcs.length
  const todayIndex = Math.max(0, Math.min(n - 1, strip.todayIndex))
  const [tx, ty] = pt(arcAngles(todayIndex, n).mid, R + STROKE / 2 + 6.5)

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="img"
      aria-label={describe(strip, { quietWindow })}
      className={cx('h-[92px] w-[92px] shrink-0 overflow-visible', className)}
    >
      {arcs.map((a, i) => {
        const { start, end } = arcAngles(i, n)
        const [x0, y0] = pt(start, R)
        const [x1, y1] = pt(end, R)
        return (
          <path
            key={a.date}
            d={`M${f(x0)} ${f(y0)} A${R} ${R} 0 0 1 ${f(x1)} ${f(y1)}`}
            fill="none"
            style={{ stroke: arcColor(a) }}
            strokeWidth={a.today ? STROKE + 4 : STROKE}
          />
        )
      })}
      {arcs.map((a, i) => {
        if (!a.lh) return null
        // Today's own dot sits at +6.5, so today's LH mark steps further out.
        const out = a.today ? STROKE / 2 + 13 : STROKE / 2 + 5.5
        const [x, y] = pt(arcAngles(i, n).mid, R + out)
        return a.lh === 'surge' ? (
          <circle key={`lh-${a.date}`} cx={f(x)} cy={f(y)} r="2.4" style={{ fill: 'rgb(var(--fert))' }} />
        ) : (
          <circle
            key={`lh-${a.date}`}
            cx={f(x)}
            cy={f(y)}
            r="2.2"
            style={{ fill: 'rgb(var(--surface))', stroke: 'rgb(var(--ink-3))' }}
            strokeWidth="1.4"
          />
        )
      })}
      <circle cx={f(tx)} cy={f(ty)} r="3.4" className="fill-ink" />
      <g aria-hidden="true" textAnchor="middle" className="tabular-nums">
        <text x={C} y={C - 11} fontSize="10" fontWeight="700" className="fill-ink-3">
          주기
        </text>
        <text x={C} y={C + 9} fontSize="24" fontWeight="800" letterSpacing="-1" className="fill-ink">
          {strip.cycleDay ?? todayIndex + 1}
        </text>
        <text x={C} y={C + 22} fontSize="10" fontWeight="700" className="fill-ink-3">
          일째
        </text>
      </g>
    </svg>
  )
}
