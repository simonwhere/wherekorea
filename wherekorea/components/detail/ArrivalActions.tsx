'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'
import { arrivalPath } from '@/lib/arrival-routes'
import type { ArrivalCard } from '@/data/arrival/types'
import { useSaved } from '@/lib/saved-context'

export default function ArrivalActions({ slug, city, place }: { slug: ArrivalCard['slug']; city: string; place: string }) {
  const { savedList, toggleSaved } = useSaved()
  const saved = savedList.includes(slug)
  const [status, setStatus] = useState('')
  const [url, setUrl] = useState('')
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      track('copy_link_clicked', { slug })
      setStatus('Card link copied.')
    } catch {
      setStatus('Select the card link above to copy it.')
    }
  }
  return <div className="arr-actions">
    <button type="button" aria-expanded={Boolean(url)} onClick={() => {
      setStatus('')
      setUrl(url ? '' : new URL(arrivalPath(slug), window.location.origin).href)
    }}>Share card</button>
    <button type="button" aria-pressed={saved} onClick={() => {
      if (!saved) track('destination_saved', { slug })
      toggleSaved(slug)
      setStatus(saved ? `${city} removed from Saved places.` : 'Find this card in Saved on this browser.')
    }}>{saved ? '♥ Saved' : '♡ Save city & card'}</button>
    {url && <div className="arr-share">
      <label>Card link<input readOnly value={url} onFocus={e => e.target.select()} /></label>
      <button type="button" onClick={copyLink}>Copy link</button>
      {typeof navigator.share === 'function' && <button type="button" onClick={async () => {
        try {
          await navigator.share({ title: `${city} arrival card · WhereKorea`, text: `From Seoul to ${place} and back without a car.`, url })
          track('share_clicked', { slug })
        } catch (err) {
          if (!(err instanceof Error && err.name === 'AbortError')) setStatus('Use Copy link to share this card.')
        }
      }}>More sharing options</button>}
    </div>}
    <span role="status">{status}</span>
  </div>
}
