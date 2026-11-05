'use client'

import { useEffect, useState } from 'react'
import { readSavedWalk, saveWalkStop, subscribeSavedWalks } from '@/lib/saved-walks'
import { prepareOfflineWalks } from '@/lib/walk-offline'
import { walkStopPath } from '@/lib/walk-links'
import { track } from '@/lib/analytics'
import styles from './Walk.module.css'

export default function WalkActions({ slug, walkName, stopNumber, stopName, savedHref }: {
  slug: string; walkName: string; stopNumber: number; stopName: string; savedHref: string
}) {
  const [savedStop, setSavedStop] = useState<number>()
  const [storageError, setStorageError] = useState('')
  const [offline, setOffline] = useState<'pending' | 'ready' | 'failed'>('pending')
  const [retry, setRetry] = useState(0)
  const [shareUrl, setShareUrl] = useState('')
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
    prepareOfflineWalks().then(() => {
      if (active) setOffline('ready')
    }).catch(() => {
      if (active) setOffline('failed')
    })
    return () => { active = false }
  }, [saved, retry])

  function save() {
    try {
      saveWalkStop(slug, stopNumber)
      setSavedStop(stopNumber)
      setStorageError('')
    } catch {
      setStorageError('This browser couldn’t save the walk. You can still copy the link.')
    }
  }

  const path = walkStopPath(slug, stopNumber)
  async function share() {
    const url = new URL(path, window.location.origin).href
    setShareNotice('')
    setShareUrl(url)
    if (!navigator.share) return
    try {
      await navigator.share({ title: walkName + ' · ' + stopName, url })
      track('share_clicked', { slug })
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) setShareNotice('Use the link below to share this stop.')
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      track('copy_link_clicked', { slug })
      setShareNotice('Link copied.')
    } catch {
      setShareNotice('Select the link and copy it.')
    }
  }

  const showLink = shareUrl.endsWith(path)
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
      <label>Link to {stopName}<input readOnly value={shareUrl} onFocus={e => e.target.select()} /></label>
      <button type="button" onClick={copy}>Copy link</button>
      <button type="button" onClick={() => setShareUrl('')}>Close</button>
      <span role="status">{shareNotice}</span>
    </div>}
  </div>
}
