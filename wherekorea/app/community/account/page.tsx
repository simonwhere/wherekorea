import { Suspense } from 'react'
import type { Metadata } from 'next'
import CommunityAccount from '@/components/community/CommunityAccount'

export const metadata: Metadata = { title: 'Browser profile', robots: { index: false, follow: false } }
export default function CommunityAccountPage() { return <Suspense fallback={<p role="status">Loading browser profile…</p>}><CommunityAccount /></Suspense> }
