'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { Destination } from '@/data/types'
import { track } from '@/lib/analytics'
import { useCompare } from '@/lib/compare-context'

interface Props {
  destination: Destination
}

export default function DestinationCard({ destination: d }: Props) {
  const { compareList, toggleCompare } = useCompare()
  const inCompare = compareList.includes(d.slug)
  const compareDisabled = compareList.length >= 3 && !inCompare
  const [imgFailed, setImgFailed] = useState(false)

  function handleCompareToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (inCompare) {
      toggleCompare(d.slug)
    } else if (!compareDisabled) {
      track('compare_added', { slug: d.slug, compare_count: compareList.length + 1 })
      toggleCompare(d.slug)
    }
  }

  // Extract temp from "This week · 14–21°C · mostly dry"
  const weatherTemp = d.live_weather_snapshot.split('·')[1]?.trim() ?? ''

  return (
    <article className="relative rounded-2xl overflow-hidden aspect-[3/4] group bg-gray-800">
      {/* Background image */}
      {!imgFailed && (
        <Image
          src={d.image.src}
          alt={d.image.alt}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

      {/* Full-card navigation link */}
      <Link
        href={`/destination/${d.slug}`}
        onClick={() => track('card_clicked', { slug: d.slug })}
        className="absolute inset-0 z-0"
        aria-label={`View ${d.name} details`}
      />

      {/* Top row: primary tag (left) + budget (right) */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
        {d.tags[0] && (
          <span className="text-xs px-2.5 py-1 bg-black/55 backdrop-blur-sm text-white/75 rounded-full">
            {d.tags[0]}
          </span>
        )}
        <span className="shrink-0 text-xs px-2.5 py-1 bg-black/55 backdrop-blur-sm text-white font-bold rounded-full tracking-wide">
          {d.card_budget_level}
        </span>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h2 className="text-white text-3xl font-bold leading-none tracking-tight drop-shadow-md">
          {d.name}
        </h2>
        <p className="text-white/60 text-sm mt-1.5 leading-snug">
          {d.card_vibe}
        </p>

        {/* Info row: stay + weather prominently, compare secondary */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white font-medium">{d.recommended_stay}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/70">{weatherTemp}</span>
          </div>

          {/* Compare button — z-10 sits above the Link overlay */}
          <button
            onClick={handleCompareToggle}
            disabled={compareDisabled}
            className={`relative z-10 shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
              inCompare
                ? 'bg-white text-gray-900 border-white font-medium'
                : 'text-white/50 border-white/25 hover:border-white/60 hover:text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          >
            {inCompare ? '✓ Added' : '+ Compare'}
          </button>
        </div>
      </div>
    </article>
  )
}
