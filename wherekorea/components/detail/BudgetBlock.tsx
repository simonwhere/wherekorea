import type { Destination } from '@/data/types'
import { DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox, usdifyRange } from '@/lib/currency'
import SectionTitle from '@/components/detail/SectionTitle'
import { BUDGET_ASSUMPTIONS, metricEvidence } from '@/lib/trust'
import { getBudgetEvidence } from '@/data/budget-evidence'
import { getFoodPriceReference } from '@/data/food-price-reference'

interface Props {
  destination: Destination
}

export default function BudgetBlock({ destination: d }: Props) {
  const { detail_budget: b } = d
  const avg = DAILY_AVG[d.slug]
  const usd = avg ? usdApprox(avg) : null
  const evidence = getBudgetEvidence(d.slug)
  const parts = evidence?.legacyComponents
  const food = getFoodPriceReference(d.slug)
  const mealPrice = (amount: number) => `₩${(Math.round(amount / 100) * 100).toLocaleString('en-US')}`

  return (
    <div className="py-6 border-b border-white/10">
      <SectionTitle className="mb-2">Approximate daily cost</SectionTitle>
      <p className="text-xs text-white/60 leading-relaxed mb-2">
        {BUDGET_ASSUMPTIONS}
      </p>
      {avg && (
        <p className="text-sm text-white/85 mb-4">
          Mid-range: <span className="font-semibold">{usd ? `${usd}/day` : `${avg}/day`}</span>
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
      {parts && <details className="text-xs text-white/75 mt-4 rounded-lg border border-white/15 px-3">
        <summary className="cursor-pointer min-h-11 py-3 text-white/90">Cost breakdown · per person</summary>
        <p className="leading-relaxed mb-3">Approximate amounts for a shared-room stay, not current prices. Daily totals are rounded.</p>
        <dl className="space-y-2 pb-3">
          {([
            ['Room · half of a two-person room', parts.lodgingPerPersonKrw],
            ['Meals and cafés', parts.foodKrw],
            ['Local transport', parts.localTransportKrw],
            ['Admission fees and activities', parts.admissionsKrw],
          ] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt><dd className="shrink-0 tabular-nums">≈₩{amount.toLocaleString('en-US')}</dd>
          </div>)}
        </dl>
        <p className="text-white/60 leading-relaxed pb-3">Room cost for two: about ₩{(parts.lodgingPerPersonKrw * 2).toLocaleString('en-US')} per night. Intercity travel is extra.</p>
      </details>}
      {food && <details className="text-xs text-white/75 mt-3 rounded-lg border border-white/15 px-3">
        <summary className="cursor-pointer min-h-11 py-3 text-white/90">Meal prices · {food.sourceMonthLabel}</summary>
        <p className="leading-relaxed mb-3">Regional averages for {food.regionLabels.join(', ')}. Prices at individual restaurants differ.</p>
        <dl className="space-y-2 pb-3">
          {food.meals.map((meal) => <div key={meal.id} className="flex justify-between gap-4">
            <dt>{meal.label}</dt>
            <dd className="shrink-0 tabular-nums">≈{mealPrice(meal.minimumKrw)}{meal.minimumKrw !== meal.maximumKrw ? `–${mealPrice(meal.maximumKrw)}` : ''}</dd>
          </div>)}
        </dl>
        <p className="text-white/60 leading-relaxed pb-3">Per serving, rounded to ₩100. {food.regionLabels.length > 1 && 'Ranges cover the regions listed above. '}Provisional figures from the{' '}
          <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/80 hover:text-white">Korea Consumer Agency</a>.
        </p>
      </details>}
      {d.trust?.budget && (
        <details className="text-[11px] text-white/55 mt-3">
          <summary className="cursor-pointer">About the estimate</summary>
          <p className="mt-2">{metricEvidence(d.trust.budget)} Actual room prices vary by date.</p>
        </details>
      )}
    </div>
  )
}
