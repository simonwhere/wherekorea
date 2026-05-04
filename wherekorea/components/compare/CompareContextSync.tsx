'use client'

import { useEffect } from 'react'
import { useCompare } from '@/lib/compare-context'

interface Props {
  slugs: string[]
}

// Syncs sanitized URL slugs into CompareContext whenever the slug set changes.
// URL is the source of truth on /compare — overrides localStorage/tray state.
export default function CompareContextSync({ slugs }: Props) {
  const { replaceCompareList } = useCompare()
  const slugKey = slugs.join(',')

  useEffect(() => {
    const currentSlugs = slugKey.length > 0 ? slugKey.split(',') : []
    replaceCompareList(currentSlugs)
  }, [slugKey, replaceCompareList])

  return null
}
