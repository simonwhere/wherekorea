import type { Destination } from '@/data/types'
import { DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox } from '@/lib/currency'

interface Props {
  destination: Destination
}

export default function BudgetBlock({ destination: d }: Props) {
  const { detail_budget: b } = d
  const avg = DAILY_AVG[d.slug]
  const usd = avg ? usdApprox(avg) : null

  return (
    <div className="py-6 border-b border-white/10">
      <h2 className="text-sm font-semibold text-white/55 uppercase tracking-wide mb-2">
        Budget
      </h2>
      <p className="text-xs text-white/60 leading-relaxed mb-2">
        Per person, 2 sharing one mid-range room — lodging, meals, local transport, and light activities. Excludes intercity travel, flights, and shopping.
      </p>
      {avg && (
        <p className="text-sm text-white/85 mb-4">
          Typical mid all-in: <span className="font-semibold">{avg}/day</span>
          {usd && <span className="text-white/60"> · ≈ {usd}/day</span>}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">Budget</p>
          <p className="text-sm text-white/85">{b.low}</p>
        </div>
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">Mid-range</p>
          <p className="text-sm text-white/85">{b.mid}</p>
        </div>
        <div className="bg-white/5 rounded-md p-3">
          <p className="text-xs text-white/55 mb-1">Comfortable</p>
          <p className="text-sm text-white/85">{b.high}</p>
        </div>
      </div>

      {b.notes && (
        <p className="text-xs text-white/60 leading-relaxed">{b.notes}</p>
      )}
    </div>
  )
}
