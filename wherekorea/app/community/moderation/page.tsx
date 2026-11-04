import { Suspense } from 'react'
import type { Metadata } from 'next'
import CommunityModeration from '@/components/community/CommunityModeration'
export const metadata: Metadata = { title: 'Community moderation', robots: { index: false, follow: false } }
export default function CommunityModerationPage() { return <Suspense fallback={<p role="status">Loading reports…</p>}><CommunityModeration /></Suspense> }
