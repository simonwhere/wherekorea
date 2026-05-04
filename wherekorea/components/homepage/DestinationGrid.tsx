import type { Destination } from '@/data/types'
import DestinationCard from '@/components/cards/DestinationCard'

interface Props {
  destinations: Destination[]
}

export default function DestinationGrid({ destinations }: Props) {
  if (destinations.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-gray-400">
        No destinations match the active filters.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {destinations.map((d) => (
        <DestinationCard key={d.slug} destination={d} />
      ))}
    </div>
  )
}
