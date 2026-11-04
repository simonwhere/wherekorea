import type { Metadata } from 'next'
import { Suspense } from 'react'
import CommunityComposer from '@/components/community/CommunityComposer'

export const metadata: Metadata = { title: 'Write a draft', robots: { index: false, follow: false } }

export default function NewCommunityPage() {
  return <Suspense fallback={<p role="status">Loading your draft…</p>}><CommunityComposer /></Suspense>
}
