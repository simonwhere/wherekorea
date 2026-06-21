'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCompare } from '@/lib/compare-context'
import { destinations } from '@/data/destinations'

export default function CompareTray() {
  const { compareList, toggleCompare } = useCompare()
  const pathname = usePathname()
  const router = useRouter()

  if (compareList.length === 0) return null

  const selected = compareList
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)

  const canCompare = selected.length >= 2

  function handleRemove(slug: string) {
    toggleCompare(slug)
    if (pathname === '/compare') {
      const remaining = selected.filter((d) => d.slug !== slug)
      if (remaining.length >= 2) {
        router.replace(`/compare?destinations=${remaining.map((d) => d.slug).join(',')}`)
      } else {
        router.replace('/')
      }
    }
  }

  function handleCompare() {
    if (canCompare) {
      router.push(`/compare?destinations=${selected.map((d) => d.slug).join(',')}`)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(22,24,31,0.96)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.10)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0 20px', height: 52,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: 'rgba(255,255,255,0.35)',
          flexShrink: 0,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Compare
        </span>
        <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {selected.map((d) => (
            <div key={d.slug} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '3px 8px 3px 10px',
              fontSize: 13,
            }}>
              <span style={{ fontWeight: 500, color: '#fff' }}>{d.name}</span>
              <button
                onClick={() => handleRemove(d.slug)}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.40)', cursor: 'pointer',
                  fontSize: 14, lineHeight: 1, padding: '0 0 0 2px',
                }}
              >×</button>
            </div>
          ))}
          {selected.length < 3 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>
              + {3 - selected.length} more
            </span>
          )}
        </div>
        <button
          onClick={handleCompare}
          style={{
            flexShrink: 0, padding: '6px 18px',
            fontSize: 13, fontWeight: 600,
            background: canCompare ? '#fff' : 'rgba(255,255,255,0.15)',
            color: canCompare ? '#16181f' : 'rgba(255,255,255,0.30)',
            border: 'none', borderRadius: 7,
            cursor: canCompare ? 'pointer' : 'not-allowed',
            transition: 'all 150ms',
          }}
        >
          Compare →
        </button>
      </div>
    </div>
  )
}
