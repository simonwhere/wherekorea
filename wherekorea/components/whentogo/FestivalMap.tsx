'use client'

import { useState } from 'react'
import type { FestivalMapPoint } from '@/data/signature-events'
import StopMap from '@/components/walks/StopMap'

export default function FestivalMap({ points }: { points: FestivalMapPoint[] }) {
  const [selected, setSelected] = useState(0)
  const point = points[selected]
  if (!point) return null

  return <div className="mt-4">
    <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Festival map stops">
      {points.map((item, index) =>
        <button key={item.name} type="button" onClick={() => setSelected(index)} aria-pressed={index === selected}
          className="min-h-11 rounded-lg border border-white/25 px-3 py-1 text-left text-xs leading-relaxed aria-pressed:border-[#ffad8c] aria-pressed:bg-[#382923]">
          <span className="block font-semibold">{index + 1}. {item.label} · {item.name}</span>
          <span lang="ko" className="text-white/70">{item.nameKo}</span>
        </button>
      )}
    </div>
    <StopMap stops={points} selected={selected} onSelect={setSelected} />
    <a href={`https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center text-xs text-[#ffb495] hover:underline">
      Open {point.name} in Google Maps ↗
    </a>
  </div>
}
