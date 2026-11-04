'use client'

import { FormEvent, useRef, useState } from 'react'
import type { CommunityReportReason } from '@/lib/community-live'
import { communityRequest, useCommunitySession } from './CommunitySession'
import styles from './Community.module.css'

export default function CommunityContentActions({ questionId, commentId, authorId, owned, onRemoved, onBlocked }: {
  questionId: string; commentId?: string; authorId: string; owned: boolean; onRemoved: () => void; onBlocked: () => void
}) {
  const { session } = useCommunitySession()
  const [mode, setMode] = useState<'remove' | 'report' | 'block' | null>(null)
  const [reason, setReason] = useState<CommunityReportReason>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const pending = useRef(false)
  const reportRequest = useRef<{ id: string; signature: string } | null>(null)
  if (!session?.user) return null
  async function perform(event: FormEvent) {
    event.preventDefault(); if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try {
      if (mode === 'remove') {
        await communityRequest(`/questions/${questionId}${commentId ? `/comments/${commentId}` : ''}`, { method: 'DELETE', body: {} }); onRemoved()
      } else if (mode === 'block') {
        await communityRequest('/blocks', { method: 'POST', body: { userId: authorId } }); setStatus('Account blocked. Their content is hidden for you. Manage blocked accounts in Browser profile.'); onBlocked()
      } else if (mode === 'report') {
        const signature = `${reason}:${details}`
        if (reportRequest.current?.signature !== signature) reportRequest.current = { id: crypto.randomUUID(), signature }
        await communityRequest('/reports', { method: 'POST', body: { id: reportRequest.current.id, ...(commentId ? { commentId } : { questionId }), reason, details } })
        setStatus('Report received. It does not automatically remove the content.'); reportRequest.current = null
      }
      setMode(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <div>
    <div className={styles.actions}>{owned ? <button disabled={busy} className={`${styles.quiet} ${styles.danger}`} onClick={() => { setMode('remove'); setError(''); setStatus('') }}>Remove {commentId ? 'comment' : 'question'}</button> : <><button disabled={busy} className={styles.quiet} onClick={() => { setMode('report'); setError(''); setStatus('') }}>Report</button><button disabled={busy} className={styles.quiet} onClick={() => { setMode('block'); setError(''); setStatus('') }}>Block account</button></>}</div>
    {status && <p className={styles.status} role="status">{status}</p>}
    {mode && <form className={styles.compactForm} onSubmit={perform}>
      {mode === 'remove' ? <p className={styles.help}>Remove this {commentId ? 'comment' : 'post and its replies'} from the community? It will no longer be publicly visible. Browser drafts are not removed.</p> : mode === 'block' ? <p className={styles.help}>Hide this person’s posts and replies from your view? Blocking also prevents comments between your accounts. You can unblock them in Browser profile.</p> : <>
        <label className={styles.field}>Reason<select value={reason} disabled={busy} onChange={event => setReason(event.target.value as CommunityReportReason)}><option value="spam">Spam or advertising</option><option value="harassment">Harassment or discrimination</option><option value="personal_information">Personal information</option><option value="unsafe">Unsafe content</option><option value="other">Other</option></select></label>
        <label className={styles.field}>Details (optional)<textarea value={details} disabled={busy} onChange={event => setDetails(event.target.value)} maxLength={1000} rows={3} /><span className={styles.help}>Do not add contact details. Reports are sent to the site’s moderators, not the author.</span></label>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Saving…' : mode === 'remove' ? 'Remove from community' : mode === 'block' ? 'Block this account' : 'Send report'}</button><button className={styles.button} disabled={busy} type="button" onClick={() => setMode(null)}>Cancel</button></div>
    </form>}
  </div>
}
