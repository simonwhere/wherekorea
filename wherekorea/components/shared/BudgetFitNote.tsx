import type { BrowseState } from '@/lib/browse-state'
import { isDailyBudgetLimit } from '@/lib/browse-state'
import { dailyEstimateKrw } from '@/lib/recommendation'

/** Saved comparison choices stay visible even when new conditions exclude them. */
export default function BudgetFitNote({ slug, browse }: { slug: string; browse: BrowseState }) {
  if (!isDailyBudgetLimit(browse.maxDailyKrw)) return null
  const amount = dailyEstimateKrw(slug)
  if (amount !== null && amount <= browse.maxDailyKrw) return null
  return <p className="wk-budget-warning">
    {amount === null ? 'Daily cost unavailable.' : `Above the selected ₩${browse.maxDailyKrw.toLocaleString('en-US')} daily budget.`}
  </p>
}
