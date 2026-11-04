'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, COMMUNITY_TYPES, communityHref, type CommunityDraft } from '@/lib/community'
import { COMMUNITY_DRAFTS_EVENT, COMMUNITY_DRAFTS_KEY, deleteDraft, loadDrafts } from '@/lib/community-storage'
import styles from './Community.module.css'

export default function CommunityDrafts() {
  const params = useSearchParams()
  const [drafts, setDrafts] = useState<CommunityDraft[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<{ id: string; updatedAt: string } | null>(null)
  const [status, setStatus] = useState('')

  function refresh() {
    const result = loadDrafts()
    setDrafts(result.drafts)
    setError(result.error || '')
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const onStorage = (event: StorageEvent) => { if (event.key === COMMUNITY_DRAFTS_KEY || event.key === null) refresh() }
    window.addEventListener('storage', onStorage)
    window.addEventListener(COMMUNITY_DRAFTS_EVENT, refresh)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(COMMUNITY_DRAFTS_EVENT, refresh) }
  }, [])

  useEffect(() => {
    if (!removing) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setRemoving(null) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [removing])

  function remove() {
    if (!removing) return
    const result = deleteDraft(removing.id, removing.updatedAt)
    if (!result.ok) { setError(result.error || 'This draft could not be removed.'); return }
    setDrafts(result.drafts)
    setError('')
    setRemoving(null)
    setStatus('Draft removed from this browser. This cannot be undone.')
  }

  return <div className={styles.content}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>Only on this browser</p><h1>My drafts</h1><p className={styles.intro}>Your saved questions, trip notes and meetup ideas. Publishing a question keeps its browser draft here; removing a draft does not remove a public question.</p></div><Link className={styles.primary} href={communityHref('/community/new', params.toString())}>New draft</Link></div>
    <p className={styles.notice}>Drafts are not synced across devices. Anyone using this browser profile may be able to read them. Clearing browser data can remove them.</p>
    {status && <p className={styles.status} role="status" style={{ marginBottom: 20 }}>{status}</p>}
    {loading ? <p role="status" className={styles.skeleton}>Loading your drafts…</p> : error ? <div className={styles.error} role="alert"><p>{error}</p><button className={styles.button} type="button" style={{ marginTop: 12 }} onClick={refresh}>Try again</button></div> : drafts.length === 0 ? <div className={styles.empty}><h2>No saved drafts</h2><p>Start a question, record a visit or outline a meetup. Use Save draft to keep it here.</p><Link href={communityHref('/community/new', params.toString())} className={styles.primary}>Write a draft</Link></div> : <ul className={styles.list}>{drafts.map(draft => <li key={draft.id} className={styles.row}>
      <div className={styles.meta}><span className={styles.badge}>{COMMUNITY_TYPES.find(item => item.value === draft.type)?.label}</span><span>{COMMUNITY_DESTINATIONS.find(item => item.slug === draft.city)?.name || 'Destination not chosen'}</span></div>
      <div className={styles.draftHeading}><div><h2><Link href={communityHref(`/community/new?draft=${encodeURIComponent(draft.id)}`, params.toString(), { type: draft.type, city: draft.city || 'all' })}>{draft.title.trim() || 'Untitled draft'}</Link></h2><p className={styles.muted}>Saved {new Date(draft.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' })} KST</p></div><div className={styles.actions}><Link className={styles.button} href={communityHref(`/community/new?draft=${encodeURIComponent(draft.id)}`, params.toString(), { type: draft.type, city: draft.city || 'all' })}>Resume</Link><button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => { setRemoving({ id: draft.id, updatedAt: draft.updatedAt }); setStatus('') }} aria-label={`Remove ${draft.title.trim() || 'untitled draft'}`}>Remove</button></div></div>
      {removing?.id === draft.id && <div className={styles.confirm} role="group" aria-label="Confirm draft removal"><p>Remove this draft from this browser? This cannot be undone.</p><div className={styles.actions}><button className={styles.button} type="button" onClick={() => setRemoving(null)}>Keep draft</button><button className={`${styles.button} ${styles.danger}`} type="button" onClick={remove}>Remove draft</button></div></div>}
    </li>)}</ul>}
  </div>
}
