'use client'

import { useEffect, useState } from 'react'
import { SAVED_WALKS_KEY, subscribeSavedWalks } from '@/lib/saved-walk-events'

// Keep guide text and photo credits out of the header on ordinary city visits.
// Only a browser with a bookmark needs to load the full walk validator.
export function useSavedWalkCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    function refresh() {
      try {
        const keys = Object.keys(window.localStorage)
        if (!keys.some(key => key.startsWith(SAVED_WALKS_KEY + '.'))) {
          setCount(0)
          return
        }
      } catch { setCount(0); return }
      void import('@/lib/saved-walks').then(({ readSavedWalks }) => {
        if (active) setCount(readSavedWalks(() => {}).length)
      }).catch(() => { if (active) setCount(0) })
    }
    const unsubscribe = subscribeSavedWalks(refresh)
    refresh()
    return () => { active = false; unsubscribe() }
  }, [])
  return count
}
