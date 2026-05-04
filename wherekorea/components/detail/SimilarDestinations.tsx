'use client'

import Link from 'next/link'
import type { Destination } from '@/data/types'
import { track } from '@/lib/analytics'

interface Props {
  destination: Destination
  allDestinations: Destination[]
}

export default function SimilarDestinations({ destination: d, allDestinations }: Props) {
  const similar = d.similar_destinations
    .map((slug) => allDestinations.find((x) => x.slug === slug))
    .filter((x): x is Destination => x !== undefined)

  if (similar.length === 0) return null

  return (
    <div className="py-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Similar destinations
      </h2>
      <div className="flex flex-col gap-2">
        {similar.map((s) => (
          <Link
            key={s.slug}
            href={`/destination/${s.slug}`}
            onClick={() => track('similar_destination_clicked', { from_slug: d.slug, to_slug: s.slug })}
            className="flex items-baseline justify-between gap-4 p-3 rounded-md border border-gray-100 hover:border-gray-300 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-gray-900">{s.name}</span>
              <span className="ml-2 text-xs text-gray-500">{s.vibe}</span>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{s.recommended_stay}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
