import { Suspense } from 'react'
import type { Metadata } from 'next'
import CommunityBlocked from '@/components/community/CommunityBlocked'
export const metadata: Metadata = { title: 'Blocked accounts', robots: { index: false, follow: false } }
export default function CommunityBlockedPage() { return <Suspense fallback={<p role="status">Loading browser profile…</p>}><CommunityBlocked /></Suspense> }
