'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

interface Props {
  slugs: string[]
}

export default function ComparePageTracker({ slugs }: Props) {
  const slugsRef = useRef(slugs)

  useEffect(() => {
    track('compare_view_opened', { slugs: slugsRef.current })
  }, [])

  return null
}
