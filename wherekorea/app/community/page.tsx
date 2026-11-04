import type { Metadata } from 'next'
import { Suspense } from 'react'
import CommunityHub from '@/components/community/CommunityHub'

export const metadata: Metadata = {
  title: 'Community',
  description: 'Read practical Korea travel guides and keep drafts of questions, trip notes and meetup ideas on this browser.',
  alternates: { canonical: '/community' },
}

export default function CommunityPage() {
  return <Suspense fallback={<p role="status">Loading community…</p>}><CommunityHub /></Suspense>
}
