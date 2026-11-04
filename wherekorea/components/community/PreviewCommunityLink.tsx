'use client'

import { useRouter } from 'next/navigation'
import { communityHref } from '@/lib/community'
import { track } from '@/lib/analytics'

export default function PreviewCommunityLink({ slug, name }: { slug: string; name: string }) {
  const router = useRouter()
  return <button type="button" onClick={() => {
    track('community_opened', { source: 'preview', city: slug })
    router.push(communityHref('/community', window.location.search, { city: slug, type: 'questions' }))
  }} style={{ minHeight: 44, padding: '10px 0', background: 'transparent', border: 0, color: '#ffb595', fontSize: 13, lineHeight: 1.5, textDecoration: 'underline', textUnderlineOffset: 4, textAlign: 'left', cursor: 'pointer' }}>
    Community in {name} →
  </button>
}
