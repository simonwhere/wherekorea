import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CommunityQuestion from '@/components/community/CommunityQuestion'

export const metadata: Metadata = { title: 'Community question', robots: { index: false, follow: true } }
export default async function CommunityQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  return <Suspense fallback={<p role="status">Loading question…</p>}><CommunityQuestion id={id} /></Suspense>
}
