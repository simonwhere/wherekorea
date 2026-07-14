import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function InsiderTips({ destination: d }: Props) {
  if (!d.insider_tips || d.insider_tips.length === 0) return null
  return (
    <div className="py-6 border-b border-white/10">
      <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-4">
        Insider tips
      </h2>
      <ul className="space-y-3">
        {d.insider_tips.map((tip, i) => (
          <li key={i} className="flex gap-3 text-sm text-white/85 leading-relaxed">
            <span aria-hidden className="shrink-0 mt-0.5">💡</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
