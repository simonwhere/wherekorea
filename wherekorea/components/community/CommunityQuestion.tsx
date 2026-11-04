'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, communityHref } from '@/lib/community'
import { withBrowseContext } from '@/lib/browse-state'
import type { CommunityQuestion as Question, CommunityComment } from '@/lib/community-live'
import { communityRequest, CommunityRequestError, useCommunitySession } from './CommunitySession'
import { communityDate } from './CommunityQuestions'
import CommunityContentActions from './CommunityContentActions'
import CommunityGuestSetup from './CommunityGuestSetup'
import { claimCommentHandoff, clearCommentHandoff, saveCommentHandoff } from '@/lib/community-comment-draft'
import styles from './Community.module.css'

const unsentComments = new Map<string, { body: string; id: string }>()

export default function CommunityQuestion({ id }: { id: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const { session, loading: sessionLoading, refresh } = useCommunitySession()
  const commentKey = `${id}:${session?.user?.id || 'signed-out'}`
  const returnToReview = params.get('review') === '1'
  const [question, setQuestion] = useState<Question | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [body, setBody] = useState('')
  const [commentError, setCommentError] = useState('')
  const [accountRecovery, setAccountRecovery] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryBody, setRecoveryBody] = useState('')
  const pending = useRef(false)
  const requestId = useRef('')
  const bodyRef = useRef(body)
  const preparingGuest = useRef<{ body: string; id: string; context: string; prepared: boolean } | null>(null)
  const activeContext = useRef(commentKey)
  activeContext.current = commentKey
  bodyRef.current = body
  useEffect(() => { setPage(1); setQuestion(null); setComments([]) }, [id, session?.user?.id])
  useEffect(() => {
    if (sessionLoading) return
    const saved = unsentComments.get(commentKey)
    let handoff = null
    if (returnToReview) {
      try { handoff = claimCommentHandoff(window.sessionStorage, id, session?.user?.id || null) } catch { /* Browser storage can be disabled. */ }
    }
    if (!preparingGuest.current) { setBody(saved?.body || handoff?.body || ''); requestId.current = saved?.id || handoff?.requestId || '' }
    if (handoff && !saved) setStatus('Your comment is ready to review. Nothing has been posted.')
    if (saved || handoff) { setCommentError(''); setAccountRecovery(false) }
    return () => { if (bodyRef.current) { if (unsentComments.size >= 20) unsentComments.delete(unsentComments.keys().next().value!); unsentComments.set(commentKey, { body: bodyRef.current, id: requestId.current }) } }
  }, [commentKey, id, returnToReview, sessionLoading, session?.user?.id])
  useEffect(() => {
    const beforeLeave = (event: BeforeUnloadEvent) => { if (bodyRef.current.trim()) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeLeave)
    return () => window.removeEventListener('beforeunload', beforeLeave)
  }, [])
  useEffect(() => {
    if (sessionLoading) return
    let active = true
    setLoading(true); setError('')
    communityRequest<{ question: Question; comments: CommunityComment[]; hasMore: boolean }>(`/questions/${encodeURIComponent(id)}?page=${page}`)
      .then(result => { if (active) { setQuestion(result.question); setComments(previous => page === 1 ? result.comments : [...previous, ...result.comments.filter(item => !previous.some(existing => existing.id === item.id))]); setMore(result.hasMore) } })
      .catch(cause => { if (active) { if (page === 1) { setQuestion(null); setComments([]) } setError(cause instanceof Error ? cause.message : 'The question could not be loaded.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, page, reload, sessionLoading, session?.user?.id])

  async function comment(event: FormEvent) {
    event.preventDefault(); if (pending.current || !question || !session?.user || !session.profileReady || !canReply) return
    if (body.trim().length < 2 || body.length > 2000) { setCommentError('Write a comment of 2 to 2,000 characters.'); return }
    pending.current = true; setBusy(true); setCommentError(''); setStatus('')
    const submittedContext = commentKey
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      const result = await communityRequest<{ comment: CommunityComment }>(`/questions/${id}/comments`, { method: 'POST', body: { id: requestId.current, body, expectedUserId: session.user.id } })
      unsentComments.delete(submittedContext)
      try { clearCommentHandoff(window.sessionStorage, id) } catch { /* Posted content does not depend on browser cleanup. */ }
      if (activeContext.current !== submittedContext) return
      setComments(previous => previous.some(item => item.id === result.comment.id) ? previous : [...previous, result.comment]); setBody(''); bodyRef.current = ''; requestId.current = ''; setStatus('Your comment is posted publicly.')
    } catch (cause) {
      if (activeContext.current === submittedContext) {
        if (cause instanceof CommunityRequestError && (cause.code === 'session_changed' || cause.code === 'sign_in_required')) {
          // Keep this unsent text under the original identity; never carry it into the new account.
          if (unsentComments.size >= 20 && !unsentComments.has(submittedContext)) unsentComments.delete(unsentComments.keys().next().value!)
          unsentComments.set(submittedContext, { body, id: requestId.current })
          let keptForSignIn = false
          try {
            if (session?.user?.id) {
              saveCommentHandoff(window.sessionStorage, id, { body, requestId: requestId.current, ownerId: session.user.id, savedAt: Date.now() })
              keptForSignIn = true
            }
          } catch { /* Preserve the original account's in-memory text even if tab storage is blocked. */ }
          setBody(''); bodyRef.current = ''; requestId.current = ''
          await refresh()
          setAccountRecovery(true)
          setCommentError(keptForSignIn
            ? 'Your browser profile changed or its cookies expired. Nothing was posted. A copy is kept in this tab for the original profile for one hour. A lost guest profile cannot be recovered by signing in.'
            : 'Your browser profile changed or its cookies expired. Nothing was posted. The comment remains only in memory for the original profile in this tab; reloading will lose it.')
        } else setCommentError(cause instanceof Error ? cause.message : 'Your comment was not confirmed. Your text is still here. Try again.')
      }
    }
    finally { pending.current = false; setBusy(false) }
  }
  function refreshConversation() { setPage(1); setReload(value => value + 1) }
  const destination = COMMUNITY_DESTINATIONS.find(item => item.slug === question?.city)?.name
  const type = question?.type === 'meetups' ? 'meetups' : 'questions'
  const canReply = type === 'meetups' ? session?.meetupPostingEnabled && !question?.expired : session?.postingEnabled
  return <div className={styles.content}>
    <Link className={styles.quiet} href={communityHref('/community', params.toString(), { type })}>← All {type}</Link>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button className={styles.quiet} onClick={refreshConversation}>Try again</button></div>}
    {loading && !question && <p className={styles.skeleton} role="status">Loading question…</p>}
    {question && <>
      <div className={styles.meta} style={{ marginTop: 18 }}><span className={styles.badge}>{destination}</span><span>{question.authorName}</span><time dateTime={question.createdAt}>{communityDate(question.createdAt)}</time></div>
      <h1 className={styles.title}>{question.title}</h1>
      {question.meetupDate && <p className={styles.meetDate}>{question.expired ? 'This meetup has ended' : 'Meetup'} · {communityDate(question.meetupDate + 'T12:00:00+09:00')} (Korea time)</p>}<p className={`${styles.body} ${styles.article}`}>{question.body}</p>
      <CommunityContentActions questionId={question.id} authorId={question.authorId} owned={question.owned} onRemoved={() => router.replace(communityHref('/community', params.toString(), { city: question.city, type }))} onBlocked={refreshConversation} />
      <Link className={styles.button} style={{ marginTop: 16 }} href={withBrowseContext(`/destination/${question.city}`, params.toString())}>Explore {destination}</Link>
      <section aria-label="Comments"><h2 className={styles.sectionTitle}>Comments</h2>
        {comments.map(item => <article className={styles.comment} key={item.id}>
          <div className={styles.meta}><span>{item.authorName}</span><time dateTime={item.createdAt}>{communityDate(item.createdAt)}</time></div><p className={styles.body}>{item.body}</p>
          <CommunityContentActions questionId={question.id} commentId={item.id} authorId={item.authorId} owned={item.owned} onRemoved={() => setComments(previous => previous.filter(comment => comment.id !== item.id))} onBlocked={refreshConversation} />
        </article>)}
        {!comments.length && !loading && <p className={styles.help}>No comments yet.</p>}
        {loading && question && <p className={styles.skeleton} role="status">Loading comments…</p>}
        {more && !loading && !error && <button className={styles.button} onClick={() => setPage(value => value + 1)} style={{ marginTop: 18 }}>Load more comments</button>}
        {canReply && session ? <form onSubmit={comment} className={styles.form} style={{ marginTop: 28 }}>
          <label className={styles.field}>Add a comment<textarea value={body} onChange={event => { setBody(event.target.value); requestId.current = ''; setCommentError(''); setStatus('') }} disabled={busy} maxLength={2000} rows={5} /><span className={styles.help}>{body.length}/2,000 characters. Your nickname and comment will be public. Leave out contact and booking details.</span></label>
          {commentError && <p className={styles.error} role="alert">{commentError}</p>}{accountRecovery && <Link className={styles.button} href={communityHref(`/community/account?returnTo=${encodeURIComponent(communityHref(`/community/questions/${id}?review=1`, params.toString()))}`, params.toString())}>Check browser profile</Link>}{status && <p className={styles.status} role="status">{status}</p>}
          {recoveryBody && <label className={styles.field}>Unposted text from before the profile change<textarea readOnly value={recoveryBody} rows={4} /><span className={styles.help}>This copy stays in this tab only. Check the browser profile before copying it into a new comment.</span></label>}
          {session.user && session.profileReady ? <>
            <button className={styles.primary} type="submit" disabled={busy || body.trim().length < 2}>{busy ? 'Posting…' : `Reply as ${session.user.displayName}`}</button>
          </> : <CommunityGuestSetup beforePrepare={() => { preparingGuest.current = { body, id: requestId.current || crypto.randomUUID(), context: commentKey, prepared: false }; setBusy(true); return true }} onPrepared={userId => {
            const kept = preparingGuest.current
            if (!kept) return
            kept.prepared = true
            unsentComments.delete(kept.context)
            unsentComments.set(`${id}:${userId}`, { body: kept.body, id: kept.id })
            setBody(kept.body); bodyRef.current = kept.body; requestId.current = kept.id
            setStatus('Your nickname is ready. Review your comment before posting it.')
          }} onSettled={() => {
            const kept = preparingGuest.current
            if (kept && !kept.prepared && activeContext.current !== kept.context) { setRecoveryBody(kept.body); setBody(''); bodyRef.current = ''; requestId.current = '' }
            preparingGuest.current = null; setBusy(false)
          }} />}
        </form> : <p className={styles.notice}>{question.expired ? 'Replies are closed for this past meetup.' : 'New replies are closed for now.'}</p>}
      </section>
    </>}
  </div>
}
