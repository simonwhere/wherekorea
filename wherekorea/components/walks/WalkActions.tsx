'use client'

import { useEffect, useState } from 'react'
import { readSavedWalk, saveWalkStop, subscribeSavedWalks } from '@/lib/saved-walks'
import { prepareOfflineWalks } from '@/lib/walk-offline'
import { walkStopPath } from '@/lib/walk-links'
import { track } from '@/lib/analytics'
import { recordWalkAction } from '@/public/walk-metrics.mjs'
import styles from './Walk.module.css'

export default function WalkActions({ slug, walkName, stopNumber, stopName, savedHref }: {
  slug: string; walkName: string; stopNumber: number; stopName: string; savedHref: string
}) {
  const [savedStop, setSavedStop] = useState<number>()
  const [storageError, setStorageError] = useState('')
  const [offline, setOffline] = useState<'pending' | 'ready' | 'failed'>('pending')
  const [retry, setRetry] = useState(0)
  const [shareLink, setShareLink] = useState<{ path: string; url: string }>()
  const [shareNotice, setShareNotice] = useState('')
  const saved = savedStop !== undefined
  useEffect(() => {
    function refresh() {
      try {
        setSavedStop(readSavedWalk(slug)?.stop)
        setStorageError('')
      } catch {
        setStorageError('Saved walks could not be read in this browser.')
      }
    }
    refresh()
    return subscribeSavedWalks(refresh)
  }, [slug])

  useEffect(() => {
    if (!saved) return
    let active = true
    setOffline('pending')
    prepareOfflineWalks(slug).then(() => {
      if (active) setOffline('ready')
    }).catch(() => {
      if (active) setOffline('failed')
    })
    return () => { active = false }
  }, [saved, retry, slug])

  function save() {
    try {
      let isNew = false
      try { isNew = !readSavedWalk(slug) } catch { /* Explicit saving can repair an unreadable bookmark. */ }
      saveWalkStop(slug, stopNumber)
      if (isNew) recordWalkAction(slug, 'save')
      setSavedStop(stopNumber)
      setStorageError('')
    } catch {
      setStorageError('This browser couldn’t save the walk. You can still copy the link.')
    }
  }

  const path = walkStopPath(slug, stopNumber)
  async function share() {
    const link = new URL(path, window.location.origin)
    link.searchParams.set('via', 'share')
    if (location.pathname === '/walks/' + slug && new URLSearchParams(location.search).get('view') === 'map') {
      link.searchParams.set('view', 'map')
      link.hash = 'walk-map'
    }
    const url = link.href
    setShareNotice('')
    setShareLink({ path, url })
    if (!navigator.share) return
    try {
      await navigator.share({ title: walkName + ' · ' + stopName, url })
      recordWalkAction(slug, 'share')
      track('share_clicked', { slug })
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) setShareNotice('Use the link below to share this stop.')
    }
  }

  async function copy() {
    if (!shareLink || shareLink.path !== path) return
    try {
      await navigator.clipboard.writeText(shareLink.url)
      recordWalkAction(slug, 'share')
      track('copy_link_clicked', { slug })
      setShareNotice('Link copied.')
    } catch {
      setShareNotice('Select the link and copy it.')
    }
  }

  const showLink = shareLink?.path === path
  return <div className={styles.actions}>
    <div className={styles.buttons}>
      {savedStop !== stopNumber && <button type="button" onClick={save}>{saved ? 'Save this stop' : 'Save walk'}</button>}
      {saved && <a href={savedHref}>View in Saved →</a>}
      <button type="button" onClick={share} aria-expanded={showLink}>Share this stop</button>
    </div>
    {storageError && <p role="alert">{storageError}</p>}
    {saved && <div className={styles.offlineStatus} role="status">
      {offline === 'ready' ? 'Walking directions saved for offline use.' : offline === 'pending' ? 'Saving directions for offline use…' : <>Walk saved. Offline directions aren’t ready. <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></>}
    </div>}
    {showLink && <div className={styles.shareBox}>
      <label>Link to {stopName}<input readOnly value={shareLink.url} onFocus={e => e.target.select()} onCopy={event => {
        const input = event.currentTarget
        if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
          event.clipboardData.setData('text/plain', input.value)
          event.preventDefault()
          recordWalkAction(slug, 'share')
        }
      }} /></label>
      <button type="button" onClick={copy}>Copy link</button>
      <button type="button" onClick={() => setShareLink(undefined)}>Close</button>
      <span role="status">{shareNotice}</span>
    </div>}
  </div>
}
