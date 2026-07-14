'use client'

import { useCompare } from '@/lib/compare-context'
import { useSaved } from '@/lib/saved-context'
import { track } from '@/lib/analytics'

const ACCENT = '#FF6A3D'

interface Props {
  slug: string
  name: string
}

export default function DetailActions({ slug, name }: Props) {
  const { compareList, toggleCompare } = useCompare()
  const { savedList, toggleSaved } = useSaved()
  const isSaved = savedList.includes(slug)
  const inCompare = compareList.includes(slug)
  const compareDisabled = compareList.length >= 3 && !inCompare

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          if (!isSaved) track('destination_saved', { slug })
          toggleSaved(slug)
        }}
        aria-pressed={isSaved}
        className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: isSaved ? ACCENT : 'rgba(255,255,255,0.22)',
          color: isSaved ? ACCENT : 'rgba(255,255,255,0.85)',
          background: 'rgba(255,255,255,0.04)',
        }}
      >
        {isSaved ? '♥ Saved' : '♡ Save'}
      </button>
      <button
        onClick={() => {
          if (inCompare) {
            toggleCompare(slug)
          } else if (!compareDisabled) {
            track('compare_added', { slug, compare_count: compareList.length + 1 })
            toggleCompare(slug)
          }
        }}
        disabled={compareDisabled}
        aria-label={inCompare ? `Remove ${name} from compare` : `Add ${name} to compare`}
        className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: inCompare ? ACCENT : 'rgba(255,255,255,0.22)',
          background: inCompare ? ACCENT : 'rgba(255,255,255,0.04)',
          color: '#fff',
          opacity: compareDisabled ? 0.35 : 1,
          cursor: compareDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {inCompare ? '✓ In compare' : '+ Compare'}
      </button>
    </div>
  )
}
