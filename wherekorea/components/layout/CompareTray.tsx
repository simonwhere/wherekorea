'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCompare } from '@/lib/compare-context'
import { destinations } from '@/data/destinations'
import { comparisonAfterRemoval, comparisonHref } from '@/lib/compare-navigation'

const VALID_SLUGS = destinations.map((destination) => destination.slug)

export default function CompareTray() {
  const { compareList, toggleCompare, replaceCompareList } = useCompare()
  const pathname = usePathname()
  const router = useRouter()

  if (compareList.length === 0) return null

  const selected = compareList
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)

  const canCompare = selected.length >= 2

  function handleRemove(slug: string) {
    if (pathname === '/compare') {
      // A second click may arrive before the first server response or React
      // render. The synchronously published URL is the latest selection.
      const next = comparisonAfterRemoval(window.location.search, compareList, slug, VALID_SLUGS)
      window.history.replaceState(null, '', next.href)
      replaceCompareList(next.slugs)
      router.replace(next.href, { scroll: false })
    } else toggleCompare(slug)
  }

  function handleCompare() {
    if (canCompare) {
      router.push(comparisonHref(selected.map((d) => d.slug), window.location.search))
    }
  }

  return (
    <div role="region" aria-label="Comparison shortlist" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(29,37,48,0.98)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid #495362',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '8px 20px', minHeight: 52,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span className="hidden sm:inline" style={{
          fontSize: 11, fontWeight: 500,
          color: 'rgba(255,255,255,0.35)',
          flexShrink: 0,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Compare
        </span>
        <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}>
          {selected.map((d) => (
            <div key={d.slug} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '3px 8px 3px 10px',
              fontSize: 13, minWidth: 0,
            }}>
              <span style={{ fontWeight: 500, color: '#fff', whiteSpace: 'nowrap' }}>{d.name}</span>
              <button
                onClick={() => handleRemove(d.slug)}
                aria-label={`Remove ${d.name} from comparison`}
                style={{
                  background: 'none', border: 'none',
                  color: '#c8cdd6', cursor: 'pointer',
                  fontSize: 18, lineHeight: 1, padding: '4px', minWidth: 30, minHeight: 30,
                }}
              >×</button>
            </div>
          ))}
          {selected.length < 3 && (
            <span className="hidden sm:inline" style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
              + {3 - selected.length} more
            </span>
          )}
        </div>
        <button
          onClick={handleCompare}
          data-community-leave
          disabled={!canCompare}
          style={{
            flexShrink: 0, padding: '6px 14px',
            fontSize: 13, fontWeight: 600,
            background: canCompare ? '#ff936b' : 'rgba(255,255,255,0.15)',
            color: canCompare ? '#13171e' : '#adb5c0',
            border: 'none', borderRadius: 7,
            cursor: canCompare ? 'pointer' : 'not-allowed',
            transition: 'all 150ms',
          }}
        >
          {canCompare ? `Compare ${selected.length} →` : 'Add 1 more'}
        </button>
      </div>
    </div>
  )
}
