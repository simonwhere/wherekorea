import type { Destination } from '@/data/types'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
}

/** Info-only signature spots. No links, no sub-pages — the destination stays the unit. */
export default function DontMiss({ destination: d }: Props) {
  if (!d.hotspots || d.hotspots.length === 0) return null
  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-4">Places to see</SectionTitle>
      <ul className="space-y-2.5">
        {d.hotspots.map((h, i) => (
          <li key={h.name} className="flex gap-3 text-sm leading-relaxed">
            <span
              aria-hidden
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-bold mt-0.5"
              style={{ background: 'rgba(255,106,61,0.15)', color: '#FF8E6B' }}
            >
              {i + 1}
            </span>
            <span>
              <span className="font-semibold text-white/95">{h.name}</span>
              <span className="text-white/65"> — {h.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
