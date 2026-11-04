import type { Metadata } from 'next'
import { Suspense } from 'react'
import CommunityComposer from '@/components/community/CommunityComposer'
import { findWalk } from '@/data/walks'

export const metadata: Metadata = { title: 'Write a draft', robots: { index: false, follow: false } }

export default async function NewCommunityPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const walk = typeof params.walk === 'string' ? findWalk(params.walk) : undefined
  const stopIndex = typeof params.stop === 'string' && /^[1-9]\d?$/.test(params.stop) ? Number(params.stop) - 1 : 0
  const stop = walk?.stops[stopIndex]
  const suggestion = walk && stop && params.type === 'meetups' && walk.city === params.city && !params.draft
    ? { key: walk.slug + '-' + stopIndex, title: 'Walk around ' + walk.name, body: 'Meet at ' + stop.name + ' (' + stop.nameKo + ').' }
    : undefined
  return <Suspense fallback={<p role="status">Loading your draft…</p>}><CommunityComposer suggestion={suggestion} /></Suspense>
}
