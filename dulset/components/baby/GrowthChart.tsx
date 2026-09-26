'use client'

import { useId, useRef, useState } from 'react'
import { GROWTH_LIMITS, type GrowthField } from '@/lib/content/baby'
import { formatKo } from '@/lib/dates'
import { ageAt, formatMeasure, growthYScale, monthScale, type SeriesPoint } from '@/lib/logic/babyView'

// Single-series line chart: one measurement over age in months. Colors come
// from theme tokens (stroke-/fill- classes), so dark mode just works. No
// percentile bands — the app doesn't make growth-norm claims.

const W = 320
const H = 168
const PAD = { top: 12, right: 14, bottom: 26, left: 36 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

export default function GrowthChart({
  points,
  field,
  birth,
}: {
  points: SeriesPoint[]
  field: GrowthField
  birth: string
}) {
  const titleId = useId()
  const descId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [sel, setSel] = useState<number | null>(null)
  const lim = GROWTH_LIMITS[field]

  if (points.length === 0) return null

  const xs = monthScale(Math.max(...points.map((p) => p.x)))
  const ys = growthYScale(points.map((p) => p.y), field)
  const px = (x: number) => PAD.left + ((x - xs.min) / (xs.max - xs.min)) * PLOT_W
  const py = (y: number) => PAD.top + (1 - (y - ys.min) / (ys.max - ys.min)) * PLOT_H

  // Default readout = the latest record (also after one is deleted).
  const activeIndex = sel !== null && sel < points.length ? sel : points.length - 1
  const active = points[activeIndex]!
  const first = points[0]!
  const last = points[points.length - 1]!

  const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')
  const areaPath =
    points.length > 1
      ? `${linePath} L${px(last.x).toFixed(1)},${PAD.top + PLOT_H} L${px(first.x).toFixed(1)},${PAD.top + PLOT_H} Z`
      : ''

  // Snap the crosshair to the nearest record along X.
  const pick = (clientX: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(px(p.x) - x)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setSel(best)
  }

  const fmtY = (v: number) => (Number.isInteger(ys.step) ? String(v) : v.toFixed(1))

  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-2" aria-live="polite">
        <span className="text-lg font-bold text-ink">{formatMeasure(active.y, field)}</span>
        <span className="text-[11px] text-ink-3">
          {ageAt(birth, active.date)} · {formatKo(active.date, { weekday: false })}
        </span>
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block h-auto w-full touch-pan-y select-none"
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setSel(null)
        }}
      >
        <title id={titleId}>
          {lim.label} ({lim.unit}) 성장 그래프
        </title>
        <desc id={descId}>
          {points.length === 1
            ? `${ageAt(birth, first.date)} ${formatMeasure(first.y, field)} 기록 1개`
            : `${ageAt(birth, first.date)} ${formatMeasure(first.y, field)}부터 ${ageAt(birth, last.date)} ${formatMeasure(last.y, field)}까지 기록 ${points.length}개`}
        </desc>

        {/* Recessive hairline grid + y ticks. */}
        {ys.ticks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(t)}
              y2={py(t)}
              className="stroke-line"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD.left - 6} y={py(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {xs.ticks.map((t, i) => (
          <text
            key={`x${t}`}
            x={px(t)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === xs.ticks.length - 1 ? 'end' : 'middle'}
            className="fill-ink-3 text-[11px] tabular-nums"
          >
            {i === xs.ticks.length - 1 ? `${t}개월` : t}
          </text>
        ))}

        {areaPath ? <path d={areaPath} className="fill-brand/10" /> : null}
        {points.length > 1 ? (
          <path
            d={linePath}
            fill="none"
            className="stroke-brand"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Crosshair on the selected record. */}
        <line
          x1={px(active.x)}
          x2={px(active.x)}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-ink-3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          opacity={sel === null || sel >= points.length ? 0 : 0.6}
        />

        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={px(p.x)}
            cy={py(p.y)}
            r={i === activeIndex ? 5.5 : 4}
            className="fill-brand stroke-surface"
            strokeWidth={2}
          />
        ))}
      </svg>
    </figure>
  )
}
