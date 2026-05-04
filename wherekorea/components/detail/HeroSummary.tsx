import type { Destination } from '@/data/types'
import Link from 'next/link'

interface Props {
  destination: Destination
}

export default function HeroSummary({ destination: d }: Props) {
  return (
    <div className="pb-6 border-b border-gray-200">
      <Link
        href="/"
        className="inline-block mb-6 text-xs text-gray-400 hover:text-gray-700"
      >
        ← All destinations
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 mb-2">{d.name}</h1>

      <p className="text-base text-gray-600 leading-relaxed mb-4">
        {d.hero_summary}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>{d.recommended_stay}</span>
        <span className="text-gray-300">·</span>
        <span>{d.card_budget_level}</span>
        <span className="text-gray-300">·</span>
        <span
          className={
            d.no_car_friendliness === 'Easy'
              ? 'text-gray-700'
              : d.no_car_friendliness === 'Hard'
              ? 'text-gray-700'
              : 'text-gray-700'
          }
        >
          No-car: {d.no_car_friendliness}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {d.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
