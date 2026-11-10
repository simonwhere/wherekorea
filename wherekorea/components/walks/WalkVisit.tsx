'use client'

import { useEffect } from 'react'
import { readSavedWalk } from '@/lib/saved-walks'
import { watchWalkOpening } from '@/public/walk-metrics.mjs'

export function WalkVisit({ slug, shared }: { slug: string; shared: boolean }) {
  useEffect(() => watchWalkOpening(slug, shared, () => Boolean(readSavedWalk(slug))), [slug, shared])
  return null
}
