'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { arrivalPath, hasArrivalCard } from '@/lib/arrival-routes'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseBrowseState, browseHref, withBrowseContext } from '@/lib/browse-state'
import { destinations } from '@/data/destinations'
import { findWalk } from '@/data/walks'
import { removeSavedWalk } from '@/lib/saved-walks'
import { useSavedWalks } from '@/lib/use-saved-walks'
import styles from './Saved.module.css'
import { useSaved } from '@/lib/saved-context'
import DestinationCard from '@/components/cards/DestinationCard'
import Header from '@/components/layout/Header'

export default function SavedPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading saved places…</div>}><SavedPlaces /></Suspense>
}

function SavedPlaces() {
  const { savedList } = useSaved()
  const bookmarks = useSavedWalks()
  const [message, setMessage] = useState('')
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
            Places and walks you saved in this browser.
          </p>
        </div>

        {bookmarks.readError && <p role="alert" className={styles.status}>Some saved walks couldn’t be read. Check this browser’s storage settings.</p>}
        {bookmarks.entries.length > 0 && <section className={styles.walks} aria-labelledby="saved-walks">
          <h2 id="saved-walks">Saved walks</h2>
          <ul>{bookmarks.entries.map(entry => {
            const walk = findWalk(entry.slug)!
            const stop = walk.stops[entry.stop - 1]
            return <li key={entry.slug}>
              <a href={withBrowseContext(`/walks/${entry.slug}?stop=${entry.stop}`, params.toString())}>
                <strong>{walk.name} <span aria-hidden="true">→</span></strong>
                <span>Stop {entry.stop} · {stop.name} <span lang="ko">{stop.nameKo}</span></span>
              </a>
              <button type="button" aria-label={'Remove ' + walk.name + ' from Saved'} onClick={() => {
                try {
                  removeSavedWalk(entry.slug)
                  setMessage(walk.name + ' removed from Saved.')
                } catch { setMessage('Couldn’t remove this walk. Try again in this browser.') }
              }}>Remove</button>
            </li>
          })}</ul>
        </section>}
        <p className={styles.status} role="status">{message}</p>
        {saved.some(d => hasArrivalCard(d.slug)) && <section aria-labelledby="saved-arrivals" className="mt-5">
          <h2 id="saved-arrivals" className="font-semibold text-white">Saved arrival cards</h2>
          <div className="flex flex-wrap gap-x-5">{saved.map(d => hasArrivalCard(d.slug) && <Link key={d.slug} className="wk-arrival-entry" href={withBrowseContext(arrivalPath(d.slug), params.toString())}>{d.name} arrival card →</Link>)}</div>
        </section>}
        {saved.length === 0 && bookmarks.loaded && !bookmarks.readError && bookmarks.entries.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            color: 'rgba(255,255,255,0.55)', fontSize: 14,
          }}>
            No saved places yet. Save a city or neighbourhood walk to find it here.
          </div>
        ) : saved.length > 0 ? (
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
        ) : null}
      </main>
    </div>
  )
}
