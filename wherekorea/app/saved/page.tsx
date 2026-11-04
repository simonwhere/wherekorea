'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { arrivalPath, hasArrivalCard } from '@/lib/arrival-routes'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseBrowseState, browseHref, withBrowseContext } from '@/lib/browse-state'
import { destinations } from '@/data/destinations'
import { useSaved } from '@/lib/saved-context'
import DestinationCard from '@/components/cards/DestinationCard'
import Header from '@/components/layout/Header'

export default function SavedPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading saved places…</div>}><SavedPlaces /></Suspense>
}

function SavedPlaces() {
  const { savedList } = useSaved()
  const router = useRouter()
  const params = useSearchParams()
  const browse = parseBrowseState(new URLSearchParams(params.toString()))

  const saved = savedList
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)

  return (
    <div style={{ minHeight: '100vh', background: '#16181f' }}>
      <Header />
      <main style={{ padding: '0 20px 100px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ padding: '26px 0 4px' }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.035em', lineHeight: 1.08,
          }}>
            Saved places
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            Your shortlist — stored on this device, no account needed.
          </p>
        </div>

        {saved.some(d => hasArrivalCard(d.slug)) && <section aria-labelledby="saved-arrivals" className="mt-5">
          <h2 id="saved-arrivals" className="font-semibold text-white">Saved arrival cards</h2>
          <div className="flex flex-wrap gap-x-5">{saved.map(d => hasArrivalCard(d.slug) && <Link key={d.slug} className="wk-arrival-entry" href={withBrowseContext(arrivalPath(d.slug), params.toString())}>{d.name} arrival card →</Link>)}</div>
        </section>}
        {saved.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            color: 'rgba(255,255,255,0.55)', fontSize: 14,
          }}>
            Nothing saved yet — tap ♡ on any card to keep it here.
          </div>
        ) : (
          <div className="wk-destination-grid" style={{ marginTop: 20 }}>
            {saved.map((d) => (
              <DestinationCard
                key={d.slug}
                destination={d}
                browse={browse}
                month={browse.month}
                onSelect={() => router.push(withBrowseContext(browseHref(browse, `/destination/${d.slug}`), params.toString()))}
                isSelected={false}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
