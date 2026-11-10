'use client'

import { CATEGORIES, type CategoryId } from '@/data/destinations-meta'
import CategoryIcon from '@/components/shared/CategoryIcon'

interface Props { active: CategoryId; onChange: (id: CategoryId) => void }

export default function CategoryRail({ active, onChange }: Props) {
  return (
    <nav id="destination-collections" className="wk-category-rail" aria-label="Destination collections">
      {CATEGORIES.map((cat) => <button key={cat.id} type="button" aria-pressed={active === cat.id}
        onClick={() => onChange(cat.id)}>
        <CategoryIcon name={cat.icon} size={16} />
        {cat.id === 'best-now' ? 'All places' : cat.id === 'low-crowd' ? 'Quieter places' : cat.label}
      </button>)}
    </nav>
  )
}
