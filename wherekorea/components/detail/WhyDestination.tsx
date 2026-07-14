import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function WhyDestination({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10">
      <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-3">
        Why {d.name}
      </h2>
      <p className="text-base text-white/85 leading-relaxed">{d.why}</p>
    </div>
  )
}
