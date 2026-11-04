'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, communityHref } from '@/lib/community'
import type { CommunityQuestion } from '@/lib/community-live'
import { communityRequest, useCommunitySession } from './CommunitySession'
import styles from './Community.module.css'

export function communityDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Seoul' }) : ''
}

export default function CommunityQuestions({ city }: { city: string }) {
  const params = useSearchParams()
  const { session, loading: sessionLoading, error: sessionError, refresh } = useCommunitySession()
  const [questions, setQuestions] = useState<CommunityQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => { setPage(1); setQuestions([]) }, [city, session?.user?.id])
  useEffect(() => {
    if (!session?.configured) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    communityRequest<{ questions: CommunityQuestion[]; hasMore: boolean }>(`/questions?city=${encodeURIComponent(city)}&page=${page}`)
      .then(result => { if (active) { setQuestions(previous => page === 1 ? result.questions : [...previous, ...result.questions.filter(item => !previous.some(existing => existing.id === item.id))]); setMore(result.hasMore) } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Questions could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [city, page, reload, session?.configured, session?.user?.id])
  const newHref = communityHref('/community/new', params.toString(), { type: 'questions', city })
  return <section aria-label="Traveller questions">
    <h2 className={styles.sectionTitle}>Traveller questions</h2>
    {sessionError ? <div className={styles.error} role="alert"><p>{sessionError}</p><button className={styles.quiet} onClick={() => void refresh()}>Try again</button></div> : sessionLoading ? <p className={styles.skeleton} role="status">Checking questions…</p> : !session?.configured ? <div className={styles.empty}><h2>Questions are not open yet</h2><p>You can prepare a question and save it on this browser. It will not be posted.</p><Link className={styles.button} href={newHref}>Draft a question</Link></div> : <>
      {questions.length > 0 && <ul className={styles.list}>{questions.map(question => <li key={question.id} className={styles.row}>
        <div className={styles.meta}><span className={styles.badge}>{COMMUNITY_DESTINATIONS.find(item => item.slug === question.city)?.name || question.city}</span><span>{question.authorName}</span><time dateTime={question.createdAt}>{communityDate(question.createdAt)}</time></div>
        <h3><Link href={communityHref(`/community/questions/${question.id}`, params.toString(), { city })}>{question.title}</Link></h3>
        <p>{question.body.length > 200 ? `${question.body.slice(0, 200)}…` : question.body}</p><p className={styles.muted}>{question.commentCount} {question.commentCount === 1 ? 'comment' : 'comments'}</p>
      </li>)}</ul>}
      {error && <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{error}</p><button className={styles.quiet} onClick={() => setReload(value => value + 1)}>Try again</button></div>}
      {loading && <p className={styles.skeleton} role="status">Loading questions…</p>}
      {!loading && !error && questions.length === 0 && <div className={styles.empty}><h2>No questions here yet</h2><p>Ask about getting around, local routes or a visit to this destination.</p><Link className={styles.primary} href={newHref}>{session.postingEnabled ? 'Ask a question' : 'Draft a question'}</Link></div>}
      {!loading && !error && more && <button className={styles.button} style={{ marginTop: 20 }} onClick={() => setPage(value => value + 1)}>Load more questions</button>}
    </>}
  </section>
}
