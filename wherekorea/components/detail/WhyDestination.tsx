import type { Destination } from '@/data/types'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
}

export default function WhyDestination({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-3">Why {d.name}</SectionTitle>
      <p className="text-base text-white/90 leading-relaxed">{d.why}</p>
    </div>
  )
}
