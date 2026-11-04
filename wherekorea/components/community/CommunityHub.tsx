'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { COMMUNITY_TYPES, COMMUNITY_DESTINATIONS, communityHref, parseCommunityState } from '@/lib/community'
import { getCommunityPosts } from '@/data/community-posts'
import { track } from '@/lib/analytics'
import { CommunityNotice } from './CommunityNav'
import styles from './Community.module.css'
import CommunityQuestions from './CommunityQuestions'
import { useCommunitySession } from './CommunitySession'

export default function CommunityHub() {
  const params = useSearchParams()
  const router = useRouter()
  const { session } = useCommunitySession()
  const { type, city } = parseCommunityState(new URLSearchParams(params.toString()))
  const [meetupDate, setMeetupDate] = useState('')
  const current = COMMUNITY_TYPES.find(item => item.value === type)!
  const cityName = COMMUNITY_DESTINATIONS.find(item => item.slug === city)?.name
  const posts = getCommunityPosts(type, city)
  const newHref = communityHref('/community/new', params.toString(), { type, city })

  return <>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>WhereKorea</p><h1>Community</h1><p className={styles.intro}>Ask what to eat, share a favourite street or find someone to explore with.</p></div>
      <Link href={newHref} className={styles.primary}>{type === 'questions' ? session?.postingEnabled ? 'Ask a question' : 'Draft a question' : type === 'notes' ? 'Draft a trip note' : session?.meetupPostingEnabled ? 'Suggest a meetup' : 'Draft a meetup'}</Link>
    </div>
    <CommunityNotice />
    <div className={styles.layout}>
      <section aria-label="Community posts">
        <nav className={styles.tabs} aria-label="Post type">
          {COMMUNITY_TYPES.map(item => <Link key={item.value} href={communityHref('/community', params.toString(), { type: item.value, city })} aria-current={type === item.value ? 'page' : undefined} onClick={() => { if (type !== item.value) track('community_type_changed', { type: item.value }) }} scroll={false}>{item.label}</Link>)}
        </nav>
        <div className={styles.toolbar}>
          <label className={styles.field}>Destination<select value={city} onChange={event => router.replace(communityHref('/community', params.toString(), { type, city: event.target.value }), { scroll: false })}>
            <option value="all">All destinations</option>
            {COMMUNITY_DESTINATIONS.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select></label>
          {type === 'meetups' && <label className={styles.field}>Date in Korea (optional)
            <input type="date" value={meetupDate} onChange={event => setMeetupDate(event.target.value)} />
          </label>}
          <p className={styles.muted}>{type === 'questions' ? 'Traveller questions and team guides are listed separately' : type === 'notes' ? 'Trip notes include the month of the visit' : 'Meetup dates use Korea time (KST)'}</p>
        </div>
        {type !== 'notes' && <CommunityQuestions key={[type, city, type === 'meetups' && meetupDate].join(':')} city={city} type={type} date={type === 'meetups' ? meetupDate : ''} />}
        {posts.length > 0 ? <><h2 className={styles.sectionTitle}>Team guides</h2><ul className={styles.list}>{posts.map(post => <li className={styles.row} key={post.id}>
          <div className={styles.meta}><span className={styles.badge}>{COMMUNITY_DESTINATIONS.find(item => item.slug === post.city)?.name}</span><span>{post.author} · Team guide</span></div>
          <h2><Link href={communityHref(`/community/posts/${post.id}`, params.toString(), { type, city })}>{post.title}</Link></h2>
          <p>{post.excerpt}</p>
          <p className={styles.muted}>Published {post.publishedAt}</p>
        </li>)}</ul></> : type === 'notes' ? <div className={styles.empty}>
          <p className={styles.eyebrow}>{cityName || 'Across Korea'}</p>
          <h2>No trip notes here yet</h2>
          <p>Write down places and meals from your trip. Trip notes stay on this browser.</p>
          <Link className={styles.primary} href={newHref}>Prepare a draft</Link>
        </div> : null}
        <p className={styles.help} style={{ marginTop: 18 }}>{current.description}</p>
      </section>
      <aside className={styles.aside}>
        <section className={styles.box}><h2>My drafts</h2><p>Save a question, trip note or meetup idea on this browser only. It is not shared. No account needed.</p><Link className={styles.button} href={communityHref('/community/drafts', params.toString())}>Open my drafts</Link></section>
        <section className={styles.box}><h2>Before you share</h2><p>Leave out phone numbers, contact handles, booking details and the address of your accommodation.</p><Link href={communityHref('/community/guidelines', params.toString())}>Read the guidelines →</Link></section>
      </aside>
    </div>
  </>
}
