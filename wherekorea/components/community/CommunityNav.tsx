'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { homeHrefFromSearch } from '@/lib/browse-state'
import { communityHref } from '@/lib/community'
import styles from './Community.module.css'
import { communityRequest, useCommunitySession } from './CommunitySession'
import type { CommunityNotificationsResult } from '@/lib/community-inbox'

export function CommunityNotice() {
  const { session, loading, error } = useCommunitySession()
  const type = useSearchParams().get('type')
  if (type === 'notes') return <p className={styles.notice}>Trip notes stay in this browser.</p>
  const open = type === 'meetups' ? session?.meetupPostingEnabled : session?.postingEnabled
  return <p className={styles.notice}>{loading ? 'Checking posting availability…' : error ? 'Posting availability could not be checked. Browser drafts are still available.' : open ? 'Write with a nickname. Posts and replies are public.' : 'Posting is closed for now. Drafts stay on this browser.'}</p>
}

export default function CommunityNav() {
  const params = useSearchParams()
  const pathname = usePathname()
  const { session, refresh } = useCommunitySession()
  const userId = session?.user?.id || ''
  const [unread, setUnread] = useState<{ owner: string; count: number } | null>(null)
  useEffect(() => {
    if (!userId) { setUnread(null); return }
    let active = true
    let receivedUpdate = false
    // Refresh on community navigation, never poll in the background.
    communityRequest<CommunityNotificationsResult>('/notifications').then(result => {
      if (active && result.viewerId !== userId) { setUnread(null); void refresh(); return }
      if (active && !receivedUpdate) setUnread({ owner: userId, count: result.unreadCount })
    }).catch(() => { if (active && !receivedUpdate) setUnread(null) })
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; count: number }>).detail
      if (detail?.userId === userId && Number.isSafeInteger(detail.count) && detail.count >= 0) {
        receivedUpdate = true
        setUnread({ owner: userId, count: detail.count })
      }
    }
    window.addEventListener('wherekorea:reply-count', update)
    return () => { active = false; window.removeEventListener('wherekorea:reply-count', update) }
  }, [userId, pathname, refresh])
  const count = unread?.owner === userId ? unread.count : 0
  return <nav className={styles.nav} aria-label="Community navigation">
    <Link className={styles.back} href={homeHrefFromSearch(params.toString())}>← Back to your destinations</Link>
    <Link href={communityHref('/community', params.toString())} aria-current={pathname === '/community' ? 'page' : undefined}>Community</Link>
    <Link href={communityHref('/community/mine', params.toString())} aria-current={pathname === '/community/mine' ? 'page' : undefined}>My posts</Link>
    <Link href={communityHref('/community/notifications', params.toString())} aria-current={pathname === '/community/notifications' ? 'page' : undefined}>Replies{count > 0 && <span className={styles.badge} style={{ marginLeft: 7 }} aria-label={`${count} unread replies`}>{count > 99 ? '99+' : count}</span>}</Link>
    <details className={styles.navMore}><summary>More</summary><div>
    <Link href={communityHref('/community/drafts', params.toString())} aria-current={pathname === '/community/drafts' ? 'page' : undefined}>My drafts</Link>
    <Link href={communityHref('/community/guidelines', params.toString())} aria-current={pathname === '/community/guidelines' ? 'page' : undefined}>Guidelines</Link>
    <Link href={communityHref('/community/account', params.toString())} aria-current={pathname.startsWith('/community/account') ? 'page' : undefined}>Browser profile</Link>
    </div></details>
  </nav>
}
