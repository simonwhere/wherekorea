import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function WhyDestination({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Why {d.name}
      </h2>
      <p className="text-base text-gray-700 leading-relaxed">{d.why}</p>
    </div>
  )
}
