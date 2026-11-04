'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { communityHref } from '@/lib/community'
import type { CommunityBlock } from '@/lib/community-live'
import { communityRequest, useCommunitySession } from './CommunitySession'
import styles from './Community.module.css'

export default function CommunityBlocked() {
  const params = useSearchParams()
  const { session, loading: sessionLoading } = useCommunitySession()
  const [blocks, setBlocks] = useState<CommunityBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!session?.user) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    communityRequest<{ blocks: CommunityBlock[] }>('/blocks').then(result => { if (active) setBlocks(result.blocks) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Blocked accounts could not be loaded.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.user?.id, reload, session?.user])
  async function unblock(userId: string) {
    if (busy) return
    setBusy(userId); setError(''); setStatus('')
    try { await communityRequest('/blocks', { method: 'DELETE', body: { userId } }); setBlocks(previous => previous.filter(item => item.userId !== userId)); setStatus('Account unblocked. Their content can appear again, and comments between your accounts are allowed.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The account could not be unblocked.') }
    finally { setBusy('') }
  }
  return <div className={styles.content}><h1 className={styles.title}>Blocked accounts</h1><p className={styles.intro}>Blocking hides their questions and comments from your view and prevents comments between your accounts. Public content is still visible to visitors without this browser profile.</p>
    {error && <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{error}</p><button className={styles.quiet} onClick={() => setReload(value => value + 1)}>Try again</button></div>}{status && <p className={styles.status} role="status" style={{ marginTop: 20 }}>{status}</p>}
    {sessionLoading || loading ? <p className={styles.skeleton} role="status">Loading blocked accounts…</p> : !session?.user ? <p className={styles.notice}>Use the same browser profile that you used to block someone. Cleared cookies cannot recover guest blocks.</p> : !error && !blocks.length ? <p className={styles.notice}>You have not blocked any accounts.</p> : <ul className={styles.list}>{blocks.map(item => <li className={styles.row} key={item.userId}><div className={styles.draftHeading}><h2>{item.displayName || 'Community member'}</h2><button disabled={!!busy} className={styles.button} onClick={() => void unblock(item.userId)}>{busy === item.userId ? 'Unblocking…' : 'Unblock'}</button></div></li>)}</ul>}
    <Link className={styles.quiet} href={communityHref('/community/account', params.toString())}>← Back to browser profile</Link>
  </div>
}
