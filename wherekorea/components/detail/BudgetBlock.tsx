import type { Destination } from '@/data/types'

interface Props {
  destination: Destination
}

export default function BudgetBlock({ destination: d }: Props) {
  const { detail_budget: b } = d

  return (
    <div className="py-6 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Budget
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">Budget</p>
          <p className="text-sm text-gray-700">{b.low}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">Mid-range</p>
          <p className="text-sm text-gray-700">{b.mid}</p>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-400 mb-1">Comfortable</p>
          <p className="text-sm text-gray-700">{b.high}</p>
        </div>
      </div>

      {b.notes && (
        <p className="text-xs text-gray-500 leading-relaxed">{b.notes}</p>
      )}
    </div>
  )
}
