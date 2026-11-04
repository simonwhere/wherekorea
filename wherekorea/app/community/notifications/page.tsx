import { Suspense } from 'react'
import type { Metadata } from 'next'
import CommunityInbox from '@/components/community/CommunityInbox'

export const metadata: Metadata = { title: 'Replies to your posts', robots: { index: false, follow: false } }
export default function CommunityNotificationsPage() {
  return <Suspense fallback={<p role="status">Loading replies…</p>}><CommunityInbox mode="replies" /></Suspense>
}
