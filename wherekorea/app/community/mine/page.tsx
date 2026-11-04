import { Suspense } from 'react'
import type { Metadata } from 'next'
import CommunityInbox from '@/components/community/CommunityInbox'

export const metadata: Metadata = { title: 'My questions', robots: { index: false, follow: false } }
export default function MyQuestionsPage() {
  return <Suspense fallback={<p role="status">Loading your questions…</p>}><CommunityInbox mode="questions" /></Suspense>
}
