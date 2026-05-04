'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

interface Props {
  slug: string
}

export default function DetailPageTracker({ slug }: Props) {
  useEffect(() => {
    track('detail_page_viewed', { slug })
  }, [slug])

  return null
}
