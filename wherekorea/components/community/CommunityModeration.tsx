'use client'

import { useEffect, useRef, useState } from 'react'
import { communityRequest, useCommunitySession } from './CommunitySession'
import { communityDate } from './CommunityQuestions'
import styles from './Community.module.css'

interface Report { id: string; questionId: string | null; commentId: string | null; reason: string; details: string; createdAt: string; status: 'open' | 'resolved'; title: string | null; body: string; authorId: string; authorName: string; contentStatus: 'published' | 'hidden' | 'deleted' }
export default function CommunityModeration() {
  const { session, loading: sessionLoading } = useCommunitySession()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<{ reportId: string; action: 'hide' | 'resolve' | 'ban' } | null>(null)
  const [reload, setReload] = useState(0)
  const pending = useRef(false)
  useEffect(() => {
    if (!session?.moderator) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    communityRequest<{ reports: Report[] }>('/moderation').then(result => { if (active) setReports(result.reports) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Reports could not be loaded.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.moderator, reload])
  async function review() {
    if (!selected || pending.current) return
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try { await communityRequest('/moderation', { method: 'POST', body: selected }); setSelected(null); setStatus('Review action saved.'); setReload(value => value + 1) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The review could not be saved.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className={styles.content}><p className={styles.eyebrow}>Community moderation</p><h1 className={styles.title}>Review reports</h1>
    {error && <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{error}</p><button className={styles.quiet} onClick={() => setReload(value => value + 1)}>Try again</button></div>}{status && <p className={styles.status} role="status" style={{ marginTop: 20 }}>{status}</p>}
    {sessionLoading || loading ? <p className={styles.skeleton} role="status">Loading reports…</p> : !session?.moderator ? <p className={styles.notice}>This page is available to the site’s appointed moderators. No reports have been loaded.</p> : !error && !reports.length ? <p className={styles.notice}>No reports are waiting for review.</p> : <ul className={styles.list}>{reports.map(report => <li key={report.id} className={styles.row}>
      <div className={styles.meta}><span className={styles.badge}>{report.reason.replace(/_/g, ' ')}</span><span>{report.status}</span><span>{communityDate(report.createdAt)}</span></div><h2>{report.title || 'Reported comment'}</h2><p>{report.authorName} · {report.contentStatus}</p><p className={styles.body}>{report.body}</p>{report.details && <p className={styles.body}>Report details: {report.details}</p>}
      {report.status === 'open' && <div className={styles.actions} style={{ marginTop: 12 }}><button className={styles.button} disabled={busy} onClick={() => setSelected({ reportId: report.id, action: 'hide' })}>Hide content</button><button className={styles.button} disabled={busy} onClick={() => setSelected({ reportId: report.id, action: 'resolve' })}>Resolve without hiding</button><button className={`${styles.button} ${styles.danger}`} disabled={busy} onClick={() => setSelected({ reportId: report.id, action: 'ban' })}>Restrict author</button></div>}
      {selected?.reportId === report.id && <div className={styles.confirm}><p>{selected.action === 'ban' ? 'Restrict this author from posting and hide all their community content? This does not delete their sign-in identity.' : selected.action === 'hide' ? 'Hide this content and resolve the report?' : 'Resolve this report without changing content visibility?'}</p><div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={() => void review()}>{busy ? 'Saving…' : 'Confirm review action'}</button><button className={styles.button} disabled={busy} onClick={() => setSelected(null)}>Cancel</button></div></div>}
    </li>)}</ul>}
  </div>
}
