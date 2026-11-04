'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, communityHref } from '@/lib/community'
import type { CommunityNotificationsResult, CommunityOwnQuestion } from '@/lib/community-inbox'
import { communityRequest, useCommunitySession } from './CommunitySession'
import { communityDate } from './CommunityQuestions'
import styles from './Community.module.css'

type OwnQuestions = { viewerId: string; questions: CommunityOwnQuestion[]; hasMore: boolean }
type InboxData = { owner: string; page: number; questions: CommunityOwnQuestion[]; replies: CommunityNotificationsResult | null; hasMore: boolean }

/** No intervals, push registration, local persistence, or analytics of private inbox data. */
export default function CommunityInbox({ mode }: { mode: 'questions' | 'replies' }) {
  const params = useSearchParams()
  const { session, loading: sessionLoading, error: sessionError, refresh } = useCommunitySession()
  const userId = session?.user?.id || ''
  const [data, setData] = useState<InboxData | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  const pending = useRef(false)
  const currentOwner = useRef(userId)
  currentOwner.current = userId
  const isReplies = mode === 'replies'
  const path = isReplies ? '/community/notifications' : '/community/mine'
  const heading = isReplies ? 'Replies to your posts' : 'My posts'
  const returnPath = communityHref(path, params.toString())
  const accountHref = communityHref(`/community/account?returnTo=${encodeURIComponent(returnPath)}`, params.toString())
  const draftHref = communityHref('/community/new', params.toString(), { type: 'questions' })
  const current = data?.owner === userId && data?.page === page ? data : null

  useEffect(() => { setPage(1); setData(null); setError(''); setStatus('') }, [userId, mode])
  useEffect(() => {
    if (!userId || sessionLoading) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    const endpoint = isReplies ? '/notifications' : '/my-questions'
    communityRequest<CommunityNotificationsResult | OwnQuestions>(`${endpoint}?page=${page}`)
      .then(result => {
        if (!active) return
        if (result.viewerId !== userId) { setData(null); setError('The browser profile changed. Check the current profile before viewing your questions or replies.'); void refresh(); return }
        if ('notifications' in result) {
          setData({ owner: userId, page, questions: [], replies: result, hasMore: result.hasMore })
          window.dispatchEvent(new CustomEvent('wherekorea:reply-count', { detail: { userId, count: result.unreadCount } }))
        } else setData({ owner: userId, page, questions: result.questions, replies: null, hasMore: result.hasMore })
      })
      .catch(cause => { if (active) { setData(null); setError(cause instanceof Error ? cause.message : 'This page could not be loaded. Try again.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, sessionLoading, isReplies, page, reload, refresh])

  async function markRead(ids: string[]) {
    if (pending.current || !ids.length || !userId) return
    const owner = userId
    pending.current = true; setBusy(true); setError(''); setStatus('')
    try {
      const result = await communityRequest<{ ok: boolean; unreadCount: number; viewerId: string }>('/notifications', { method: 'POST', body: { ids, expectedUserId: owner } })
      if (currentOwner.current !== owner) return
      if (result.viewerId !== owner) { setData(null); await refresh(); return }
      // Reload after a receipt so newly hidden/blocked/deleted content is removed too.
      window.dispatchEvent(new CustomEvent('wherekorea:reply-count', { detail: { userId: owner, count: result.unreadCount } }))
      setStatus('Read status saved.')
      setReload(value => value + 1)
    } catch (cause) {
      if (currentOwner.current === owner) { setError(cause instanceof Error ? cause.message : 'The read status could not be saved. Try again.'); await refresh() }
    } finally { pending.current = false; setBusy(false) }
  }

  const unread = current?.replies?.notifications.filter(item => !item.readAt).map(item => item.id) || []
  const rows = isReplies ? current?.replies?.notifications.length || 0 : current?.questions.length || 0
  const cityName = (city: string) => COMMUNITY_DESTINATIONS.find(item => item.slug === city)?.name || city
  return <div className={styles.content}>
    <h1 className={styles.title}>{heading}</h1>
    <p className={styles.intro}>{isReplies
      ? 'Replies appear here when another person comments on your post. Check them here in this browser.'
      : 'Posts you shared with this nickname on this browser.'}</p>
    {session?.user?.isGuest && <p className={styles.help} style={{ marginTop: 12 }}>Return using the same browser and keep its cookies. A different browser or cleared cookies cannot recover this list. Use Refresh to check for new replies.</p>}
    {sessionError ? <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{sessionError}</p><button className={styles.quiet} onClick={() => void refresh()}>Try again</button></div>
      : sessionLoading ? <p className={styles.skeleton} role="status">Checking your browser profile…</p>
      : !session?.configured ? <div className={styles.empty}><h2>Guest posting is not connected yet</h2><p>You can write and save a question on this browser. It will not be posted.</p><Link className={styles.button} href={draftHref}>Draft a question</Link></div>
      : !session.user ? <div className={styles.empty}><h2>{isReplies ? 'Replies are linked to the browser used to post' : 'No posting profile on this browser'}</h2><p>Use the same browser where you posted and keep its cookies. Clearing cookies, closing a private browsing session or switching devices loses access to your guest questions and reply notifications. Public posts remain in Community.</p><div className={styles.actions}><Link className={styles.primary} href={draftHref}>Draft a question</Link><Link className={styles.button} href={accountHref}>Browser profile</Link></div></div>
      : <>
        <div className={styles.actions} style={{ marginTop: 20 }}><button className={styles.button} disabled={loading || busy} onClick={() => { setPage(1); setReload(value => value + 1) }}>Refresh</button>
          {isReplies && unread.length > 0 && <button className={styles.button} disabled={loading || busy} onClick={() => void markRead(unread)}>{busy ? 'Saving…' : 'Mark this page as read'}</button>}
          {!isReplies && <Link className={styles.primary} href={draftHref}>Ask a question</Link>}
        </div>
        {error && <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{error}</p><button className={styles.quiet} onClick={() => setReload(value => value + 1)}>Try again</button></div>}
        {status && <p className={styles.status} role="status">{status}</p>}
        {loading ? <p className={styles.skeleton} role="status">{isReplies ? 'Loading replies…' : 'Loading your posts…'}</p> : <>
          {!error && current && rows === 0 && <div className={styles.empty}><h2>{page > 1 ? 'No more items on this page' : isReplies ? 'No reply notifications yet' : 'No published posts yet'}</h2><p>{isReplies ? 'New replies to your posts will appear here. Replies removed by their author, hidden by moderation or from a blocked account are not shown.' : 'You can start with a draft and publish it after reviewing the text.'}</p></div>}
          {current && rows > 0 && <ul className={styles.list}>{isReplies ? current.replies?.notifications.map(item => <li key={item.id} className={styles.row}>
            <div className={styles.meta}>{!item.readAt && <span className={styles.badge}>Unread</span>}<span>{cityName(item.city)}</span><time dateTime={item.createdAt}>{communityDate(item.createdAt)}</time></div>
            <h2>{item.authorName} replied to your post</h2><p>{item.questionTitle}</p>
            <div className={styles.actions} style={{ marginTop: 12 }}><Link className={styles.button} href={communityHref(`/community/questions/${item.questionId}`, params.toString(), { type: 'questions', city: item.city })}>Read post</Link>
              {!item.readAt && <button className={styles.quiet} disabled={busy} onClick={() => void markRead([item.id])}>{busy ? 'Saving…' : 'Mark read'}</button>}
            </div>
          </li>) : current.questions.map(item => <li key={item.id} className={styles.row}>
            <div className={styles.meta}><span className={styles.badge}>{cityName(item.city)}</span><time dateTime={item.createdAt}>{communityDate(item.createdAt)}</time></div>
            <h2><Link href={communityHref(`/community/questions/${item.id}`, params.toString(), { type: 'questions', city: item.city })}>{item.title}</Link></h2>
            <p>{item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}</p>
          </li>)}</ul>}
          {current && (page > 1 || current.hasMore) && <nav className={styles.actions} aria-label={`${heading} pages`} style={{ marginTop: 20 }}><button className={styles.button} disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Previous</button><span className={styles.muted}>Page {page}</span><button className={styles.button} disabled={!current.hasMore || page >= 1000 || busy} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
        </>}
      </>}
    <div className={styles.actions} style={{ marginTop: 24 }}><Link className={styles.quiet} href={communityHref(isReplies ? '/community/mine' : '/community/notifications', params.toString())}>{isReplies ? 'My posts' : 'Replies to my posts'}</Link><Link className={styles.quiet} href={communityHref('/community/drafts', params.toString())}>My drafts</Link></div>
  </div>
}
