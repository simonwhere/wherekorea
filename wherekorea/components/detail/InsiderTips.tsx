import type { Destination } from '@/data/types'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
}

export default function InsiderTips({ destination: d }: Props) {
  if (!d.insider_tips || d.insider_tips.length === 0) return null
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-4">Insider tips</SectionTitle>
      <ul className="space-y-2">
        {d.insider_tips.map((tip, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm text-white/90 leading-relaxed rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2.5"
          >
            <span aria-hidden className="shrink-0 mt-0.5">💡</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
