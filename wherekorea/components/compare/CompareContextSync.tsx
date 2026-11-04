'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCompare } from '@/lib/compare-context'
import { destinations } from '@/data/destinations'
import { comparisonFromSearch, comparisonHref, compareSyncAction } from '@/lib/compare-navigation'

interface Props {
  slugs: string[] | null
}

const VALID_SLUGS = destinations.map((destination) => destination.slug)

// Syncs sanitized URL slugs into CompareContext whenever the slug set changes.
// An explicit URL selection wins. A bare /compare restores the saved selection.
export default function CompareContextSync({ slugs }: Props) {
  const { compareList, isHydrated, replaceCompareList } = useCompare()
  const router = useRouter()
  const params = useSearchParams()
  const currentSlugs = params ? comparisonFromSearch(params.toString(), VALID_SLUGS) : slugs
  const slugKey = currentSlugs === null ? null : currentSlugs.join(',')
  const savedKey = compareList.join(',')
  const appliedUrlKey = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const selection = slugKey === null ? null : slugKey ? slugKey.split(',') : []
    const action = compareSyncAction(selection, appliedUrlKey.current, isHydrated, savedKey ? savedKey.split(',') : [])
    appliedUrlKey.current = action.key
    if (action.kind === 'replace') {
      replaceCompareList(action.slugs)
    } else if (action.kind === 'restore') {
      const href = comparisonHref(action.slugs, window.location.search)
      window.history.replaceState(null, '', href)
      router.replace(href, { scroll: false })
    }
  }, [slugKey, savedKey, isHydrated, replaceCompareList, router])

  return null
}
