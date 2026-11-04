'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { COMMUNITY_DESTINATIONS, communityHref } from '@/lib/community'
import { withBrowseContext } from '@/lib/browse-state'
import type { TeamPost } from '@/data/community-posts'
import styles from './Community.module.css'

export default function CommunityPost({ post }: { post: TeamPost }) {
  const params = useSearchParams()
  const destination = COMMUNITY_DESTINATIONS.find(item => item.slug === post.city)?.name
  return <div className={styles.content}>
    <div className={styles.meta}><span className={styles.badge}>{destination}</span><span>{post.author} · Team guide</span><span>Published {post.publishedAt}</span></div>
    <h1 className={styles.title}>{post.title}</h1>
    <p className={styles.intro}>{post.excerpt}</p>
    <article className={styles.article}>
      {post.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      {post.links.length > 0 && <><h2>Official information</h2><ul>{post.links.map(link => <li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a><p className={styles.help}>{link.provider} · {link.language}. {link.scope}</p></li>)}</ul></>}
    </article>
    <div className={styles.actions} style={{ marginTop: 28 }}><Link className={styles.button} href={withBrowseContext(`/destination/${post.city}`, params.toString())}>Explore {destination}</Link><Link className={styles.primary} href={communityHref('/community/new', params.toString(), { type: 'questions', city: post.city })}>Draft a question about {destination}</Link></div>
    <p className={styles.notice}>This is a WhereKorea team guide, not a traveller review. Ask a separate question to start a conversation; comments are not added to team guides.</p>
  </div>
}
