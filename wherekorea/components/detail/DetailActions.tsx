'use client'

import { useState } from 'react'
import { useCompare } from '@/lib/compare-context'
import { useSaved } from '@/lib/saved-context'
import { track } from '@/lib/analytics'

const ACCENT = '#ff936b'

interface Props {
  slug: string
  name: string
  sharePath?: string
}

export default function DetailActions({ slug, name, sharePath }: Props) {
  const [copyStatus, setCopyStatus] = useState('')
  const { compareList, toggleCompare } = useCompare()
  const { savedList, toggleSaved } = useSaved()
  const isSaved = savedList.includes(slug)
  const inCompare = compareList.includes(slug)
  const compareDisabled = compareList.length >= 3 && !inCompare

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        aria-pressed={inCompare}
        title={compareDisabled ? 'Compare holds up to 3 places. Remove one to add another.' : undefined}
        aria-label={inCompare ? `Remove ${name} from compare` : `Add ${name} to compare`}
        className="text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: inCompare ? ACCENT : 'rgba(255,255,255,0.22)',
          background: inCompare ? ACCENT : 'rgba(255,255,255,0.04)',
          color: inCompare ? '#201b17' : '#fff',
          opacity: compareDisabled ? 0.35 : 1,
          cursor: compareDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {inCompare ? '✓ In compare' : '+ Compare'}
      </button>
      {compareDisabled && <p className="basis-full text-xs text-white/65">Compare holds up to 3 places. Remove one to add another.</p>}
      {sharePath && (
        <>
          <button className="text-sm px-4 py-2 rounded-lg border border-white/20" onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.origin + sharePath)
              track('copy_link_clicked', { slug })
              setCopyStatus('Link copied with your filters.')
            } catch {
              setCopyStatus('Could not copy. You can copy this page’s address from your browser.')
            }
          }}>Copy link</button>
          <span role="status" className="basis-full text-xs text-white/65">{copyStatus}</span>
        </>
      )}
    </div>
  )
}
