import { getCommunityPosts } from '@/data/community-posts'
import { communityHref } from '@/lib/community'
import CommunityEntryLink from './CommunityEntryLink'
import styles from './DestinationCommunity.module.css'

export default function DestinationCommunity({ slug, name, contextSearch }: { slug: string; name: string; contextSearch: string }) {
  const posts = getCommunityPosts('questions', slug).slice(0, 2)
  const context = { city: slug, type: 'questions' as const }
  return (
    <section className={styles.section} aria-labelledby="destination-community-heading">
      <div className={styles.heading}>
        <div><h2 id="destination-community-heading">Community in {name}</h2></div>
        <CommunityEntryLink href={communityHref('/community', contextSearch, context)} city={slug} className={styles.link}>View community →</CommunityEntryLink>
      </div>
      <p className={styles.description}>Questions, trip notes and meetups about {name}.</p>
      {posts.length > 0 && <ul className={styles.posts}>{posts.map(post => <li key={post.id}>
        <span>WhereKorea team · Team guide</span>
        <CommunityEntryLink href={communityHref(`/community/posts/${post.id}`, contextSearch, context)} city={slug} className={styles.postTitle}>{post.title}</CommunityEntryLink>
      </li>)}</ul>}
      <p className={styles.note}>Read city questions in Community. You can also prepare a question and keep a draft in this browser.</p>
      <CommunityEntryLink href={communityHref('/community/new', contextSearch, context)} city={slug} className={styles.action}>Write a question about {name}</CommunityEntryLink>
    </section>
  )
}
