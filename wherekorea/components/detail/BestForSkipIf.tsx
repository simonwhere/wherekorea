import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function BestForSkipIf({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-2">
          Best for
        </h2>
        <p className="text-sm text-white/85 leading-relaxed">{d.best_for}</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-2">
          Skip if
        </h2>
        <p className="text-sm text-white/85 leading-relaxed">{d.skip_if}</p>
      </div>
    </div>
  )
}
