'use client'

import Link from 'next/link'
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
  const current = COMMUNITY_TYPES.find(item => item.value === type)!
  const cityName = COMMUNITY_DESTINATIONS.find(item => item.slug === city)?.name
  const posts = getCommunityPosts(type, city)
  const newHref = communityHref('/community/new', params.toString(), { type, city })

  return <>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>Beyond the destination guide</p><h1>Community</h1><p className={styles.intro}>Questions about getting around, notes from a trip, and plans to meet other travellers.</p></div>
      <Link href={newHref} className={styles.primary}>{type === 'questions' ? session?.postingEnabled ? 'Ask a question' : 'Draft a question' : type === 'notes' ? 'Draft a trip note' : 'Draft a meetup'}</Link>
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
          <p className={styles.muted}>{type === 'questions' ? 'Traveller questions and team guides are listed separately' : type === 'notes' ? 'Trip notes include the month of the visit' : 'Meetup dates use Korea time (KST)'}</p>
        </div>
        {type === 'questions' && <CommunityQuestions key={city} city={city} />}
        {posts.length > 0 ? <><h2 className={styles.sectionTitle}>Team guides</h2><ul className={styles.list}>{posts.map(post => <li className={styles.row} key={post.id}>
          <div className={styles.meta}><span className={styles.badge}>{COMMUNITY_DESTINATIONS.find(item => item.slug === post.city)?.name}</span><span>{post.author} · Team guide</span></div>
          <h2><Link href={communityHref(`/community/posts/${post.id}`, params.toString(), { type, city })}>{post.title}</Link></h2>
          <p>{post.excerpt}</p>
          <p className={styles.muted}>Published {post.publishedAt}</p>
        </li>)}</ul></> : type !== 'questions' ? <div className={styles.empty}>
          <p className={styles.eyebrow}>{cityName || 'Across Korea'}</p>
          <h2>{type === 'notes' ? 'No trip notes here yet' : 'No meetups here yet'}</h2>
          <p>{type === 'notes' ? 'Keep the places you visited and what happened on the trip in a draft on this browser. It will not be posted.' : 'You can draft a date, activity and meeting area. Nothing is listed publicly, and no requests can be sent yet.'}</p>
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
