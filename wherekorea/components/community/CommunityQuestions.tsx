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

export default function CommunityQuestions({ city, type, date }: { city: string; type: 'questions' | 'meetups'; date: string }) {
  const params = useSearchParams()
  const { session, loading: sessionLoading, error: sessionError, refresh } = useCommunitySession()
  const meetup = type === 'meetups'
  const label = meetup ? 'meetups' : 'questions'
  const available = meetup ? session?.meetupsReady : session?.configured
  const open = meetup ? session?.meetupPostingEnabled : session?.postingEnabled
  const [questions, setQuestions] = useState<CommunityQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => { setPage(1); setQuestions([]) }, [city, session?.user?.id])
  useEffect(() => {
    if (!available) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    const query = new URLSearchParams({ type, city, page: String(page) })
    if (date) query.set('date', date)
    communityRequest<{ questions: CommunityQuestion[]; hasMore: boolean }>(`/questions?${query}`)
      .then(result => { if (active) { setQuestions(previous => page === 1 ? result.questions : [...previous, ...result.questions.filter(item => !previous.some(existing => existing.id === item.id))]); setMore(result.hasMore) } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Questions could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [city, page, reload, type, date, available, session?.user?.id])
  const newHref = communityHref('/community/new', params.toString(), { type, city })
  return <section aria-label={meetup ? 'Meet other travellers' : 'Traveller questions'}>
    <h2 className={styles.sectionTitle}>{meetup ? 'Upcoming meetups' : 'Traveller questions'}</h2>
    {sessionError ? <div className={styles.error} role="alert"><p>{sessionError}</p><button className={styles.quiet} onClick={() => void refresh()}>Try again</button></div> : sessionLoading ? <p className={styles.skeleton} role="status">Checking posts…</p> : !available ? <div className={styles.empty}><h2>{meetup ? 'Meetup posts are not open yet' : 'Questions are not open yet'}</h2><p>You can save a draft on this browser.</p></div> : <>
      {questions.length > 0 && <ul className={styles.list}>{questions.map(question => <li key={question.id} className={styles.row}>
        <div className={styles.meta}><span className={styles.badge}>{COMMUNITY_DESTINATIONS.find(item => item.slug === question.city)?.name || question.city}</span><span>{question.authorName}</span><time dateTime={question.createdAt}>{communityDate(question.createdAt)}</time></div>
        {question.meetupDate && <p className={styles.meetDate}>Meeting on {communityDate(question.meetupDate + 'T12:00:00+09:00')}</p>}
        <h3><Link href={communityHref(`/community/questions/${question.id}`, params.toString(), { city, type })}>{question.title}</Link></h3>
        <p>{question.body.length > 200 ? `${question.body.slice(0, 200)}…` : question.body}</p><p className={styles.muted}>{question.commentCount} {question.commentCount === 1 ? 'comment' : 'comments'}</p>
      </li>)}</ul>}
      {error && <div className={styles.error} role="alert" style={{ marginTop: 20 }}><p>{error}</p><button className={styles.quiet} onClick={() => setReload(value => value + 1)}>Try again</button></div>}
      {loading && <p className={styles.skeleton} role="status">Loading posts…</p>}
      {!loading && !error && questions.length === 0 && <div className={styles.empty}><h2>No {label} {date ? 'on this date' : 'here yet'}</h2><p>{meetup ? 'Post a date and a plan for a meal or a walk together.' : 'Ask about food, neighbourhoods or getting around.'}</p><Link className={styles.primary} href={newHref}>{open ? meetup ? 'Suggest a meetup' : 'Ask a question' : 'Save a draft'}</Link></div>}
      {!loading && !error && more && <button className={styles.button} style={{ marginTop: 20 }} onClick={() => setPage(value => value + 1)}>More {label}</button>}
    </>}
  </section>
}
