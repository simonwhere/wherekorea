import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function FoodBlock({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Food
      </h2>
      <p className="text-sm text-gray-700 leading-relaxed">{d.food}</p>
    </div>
  )
}
