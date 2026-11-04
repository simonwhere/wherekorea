'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

interface Props {
  slugs: string[]
}

export default function ComparePageTracker({ slugs }: Props) {
  const lastTracked = useRef<string | null>(null)
  const slugKey = slugs.join(',')

  useEffect(() => {
    if (slugKey === lastTracked.current) return
    lastTracked.current = slugKey
    track('compare_view_opened', { slugs: slugKey.split(',') })
  }, [slugKey])

  return null
}
