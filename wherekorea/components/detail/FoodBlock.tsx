import type { Destination } from '@/data/types'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
}

export default function FoodBlock({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-3">Food</SectionTitle>
      <p className="text-sm text-white/85 leading-relaxed">{d.food}</p>
    </div>
  )
}
