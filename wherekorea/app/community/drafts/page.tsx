import type { Metadata } from 'next'
import { Suspense } from 'react'
import CommunityDrafts from '@/components/community/CommunityDrafts'

export const metadata: Metadata = { title: 'My drafts', robots: { index: false, follow: false } }

export default function CommunityDraftsPage() {
  return <Suspense fallback={<p role="status">Loading your drafts…</p>}><CommunityDrafts /></Suspense>
}
