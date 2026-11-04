import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function BestForSkipIf({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <h2
          className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider mb-2"
          style={{ color: '#f5f4ef' }}
        >
          At a glance
        </h2>
        <p className="text-sm text-white/90 leading-relaxed">{d.best_for}</p>
      </div>
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <h2
          className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider mb-2"
          style={{ color: '#f5f4ef' }}
        >
          Practical notes
        </h2>
        <p className="text-sm text-white/90 leading-relaxed">{d.skip_if}</p>
      </div>
    </div>
  )
}
