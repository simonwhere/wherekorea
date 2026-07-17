import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function BestForSkipIf({ destination: d }: Props) {
  return (
    <div className="py-6 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.22)' }}
      >
        <h2
          className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider mb-2"
          style={{ color: '#86EFAC' }}
        >
          <span aria-hidden>✓</span> Best for
        </h2>
        <p className="text-sm text-white/90 leading-relaxed">{d.best_for}</p>
      </div>
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.22)' }}
      >
        <h2
          className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider mb-2"
          style={{ color: '#FCA5A5' }}
        >
          <span aria-hidden>✕</span> Skip if
        </h2>
        <p className="text-sm text-white/90 leading-relaxed">{d.skip_if}</p>
      </div>
    </div>
  )
}
