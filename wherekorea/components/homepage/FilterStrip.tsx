import type { FilterTag } from '@/data/types'
import { DAILY_BUDGET_OPTIONS } from '@/lib/browse-state'

interface Props {
  activeFilters: FilterTag[]
  onToggle: (tag: FilterTag) => void
  onClearAll: () => void
  maxDailyKrw?: number
  onBudgetChange: (value: number | undefined) => void
}

// Transport is an independent requirement, not an alternative to solo/couple.
const GROUPS: { label: string; tags: FilterTag[] }[] = [
  { label: 'Experience', tags: ['coastal', 'history / traditional', 'city', 'nature', 'mountain / hiking'] },
  { label: 'Travelling with', tags: ['couple', 'solo'] },
  { label: 'Recommended stay', tags: ['1–2 days', '3 days', '4+ days'] },
]

export const FILTER_LABELS: Record<FilterTag, string> = {
  coastal: 'Coast', 'history / traditional': 'History & culture', city: 'City life',
  nature: 'Nature', 'mountain / hiking': 'Hiking', 'no-car friendly': 'Easy without a car',
  couple: 'Couple', solo: 'Solo', '1–2 days': '1–2 days', '3 days': '3 days', '4+ days': '4+ days',
}

export default function FilterStrip({ activeFilters, onToggle, onClearAll, maxDailyKrw, onBudgetChange }: Props) {
  return (
    <div className="wk-more-filters" id="destination-filters">
      {GROUPS.map(({ label, tags }) => <fieldset key={label} className="wk-filter-group">
        <legend>{label}</legend>
        <div>{tags.map((tag) => <button key={tag} type="button" className="wk-filter-pill"
          aria-pressed={activeFilters.includes(tag)} onClick={() => onToggle(tag)}>
          {activeFilters.includes(tag) && <span aria-hidden>✓ </span>}{FILTER_LABELS[tag]}
        </button>)}</div>
      </fieldset>)}
      <div className="wk-budget-filter">
        <label htmlFor="daily-budget">Daily budget · approx.</label>
        <select id="daily-budget" value={maxDailyKrw ?? ''}
          aria-describedby="daily-budget-help"
          onChange={(e) => onBudgetChange(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Any budget</option>
          {DAILY_BUDGET_OPTIONS.map((value) => <option key={value} value={value}>Up to ₩{value.toLocaleString('en-US')} / person</option>)}
        </select>
        <p id="daily-budget-help">Per person, including a mid-range room shared by two. Intercity travel is extra.</p>
      </div>
      <p className="wk-filter-help">Stay lengths are recommendations for each destination.</p>
      {(activeFilters.length > 0 || maxDailyKrw !== undefined) && <button type="button" className="wk-text-button" onClick={onClearAll}>Clear all filters</button>}
    </div>
  )
}
