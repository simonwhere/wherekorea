import type { Destination } from '@/data/types'
import { DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox, usdifyRange } from '@/lib/currency'
import SectionTitle from '@/components/detail/SectionTitle'

interface Props {
  destination: Destination
}

export default function BudgetBlock({ destination: d }: Props) {
  const { detail_budget: b } = d
  const avg = DAILY_AVG[d.slug]
  const usd = avg ? usdApprox(avg) : null

  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-2">Budget</SectionTitle>
      <p className="text-xs text-white/60 leading-relaxed mb-2">
        Per person, 2 sharing one mid-range room — lodging, meals, local transport, and light activities. Excludes intercity travel, flights, and shopping.
      </p>
      {avg && (
        <p className="text-sm text-white/85 mb-4">
          Typical mid all-in: <span className="font-semibold">{usd ? `${usd}/day` : `${avg}/day`}</span>
          {usd && <span className="text-white/60"> · {avg}/day</span>}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {([['Budget', b.low], ['Mid-range', b.mid], ['Comfortable', b.high]] as const).map(
          ([label, krw]) => {
            const usd = usdifyRange(krw)
            return (
              <div key={label} className="bg-white/5 rounded-md p-3">
                <p className="text-xs text-white/55 mb-1">{label}</p>
                <p className="text-sm text-white/85">{usd ?? krw}</p>
                {usd && <p className="text-[11px] text-white/45 mt-0.5">{krw}</p>}
              </div>
            )
          }
        )}
      </div>

      {b.notes && (
        <p className="text-xs text-white/60 leading-relaxed">{b.notes}</p>
      )}
      {d.trust?.budget && (
        <p className="text-[11px] text-white/45 mt-2">
          Editorial estimate · verified {d.trust.budget.last_verified}
        </p>
      )}
    </div>
  )
}
