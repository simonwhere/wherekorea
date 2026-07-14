'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Destination } from '@/data/types'
import { track } from '@/lib/analytics'
import TimingStrip from '@/components/shared/TimingStrip'

interface Props {
  destinations: Destination[]
  canonicalPath: string
}

const ROWS: { label: string; render: (d: Destination) => React.ReactNode }[] = [
  { label: 'Vibe', render: (d) => d.vibe },
  {
    label: 'When to go',
    render: (d) => (
      <TimingStrip destination={d} compact currentMonth={new Date().getMonth() + 1} />
    ),
  },
  { label: 'Recommended stay', render: (d) => d.recommended_stay },
  { label: 'Weather', render: (d) => d.live_weather_snapshot },
  { label: 'Budget', render: (d) => d.card_budget_level },
  { label: 'From Seoul', render: (d) => d.travel_time.from_seoul },
  { label: 'No-car', render: (d) => d.no_car_friendliness },
  { label: 'Crowds', render: (d) => d.crowd_friction },
  { label: 'Best for', render: (d) => d.best_for },
  { label: 'Skip if', render: (d) => d.skip_if },
  { label: 'Food', render: (d) => d.food },
]

export default function CompareView({ destinations, canonicalPath }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + canonicalPath)
      track('copy_link_clicked')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable (e.g. non-secure context) — fail silently
    }
  }

  return (
    <div>
      {/* Header row */}
      <div
        className="grid gap-4 mb-6"
        style={{ gridTemplateColumns: `160px repeat(${destinations.length}, 1fr)` }}
      >
        <div />
        {destinations.map((d) => (
          <div key={d.slug}>
            <Link
              href={`/destination/${d.slug}`}
              className="text-base font-semibold text-white hover:underline"
            >
              {d.name}
            </Link>
          </div>
        ))}
      </div>

      {/* Data rows */}
      <div className="divide-y divide-white/10">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="grid gap-4 py-3 items-start"
            style={{ gridTemplateColumns: `160px repeat(${destinations.length}, 1fr)` }}
          >
            <span className="text-xs font-medium text-white/50 uppercase tracking-wide pt-0.5">
              {row.label}
            </span>
            {destinations.map((d) => (
              <span key={d.slug} className="text-sm text-white/80 leading-snug">
                {row.render(d)}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={handleCopyLink}
          className="text-sm text-white/80 px-4 py-2 border border-white/20 rounded hover:border-white/50 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <Link
          href="/"
          className="text-sm text-white/50 hover:text-white"
        >
          ← Back to all destinations
        </Link>
      </div>
    </div>
  )
}
