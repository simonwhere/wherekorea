'use client'

import { useEffect, useState } from 'react'
import { readSavedWalks, subscribeSavedWalks, type SavedWalk } from '@/lib/saved-walks'

export function useSavedWalks() {
  const [state, setState] = useState<{ entries: SavedWalk[]; readError: boolean; loaded: boolean }>({
    entries: [], readError: false, loaded: false,
  })
  useEffect(() => {
    function refresh() {
      let readError = false
      const entries = readSavedWalks(() => { readError = true })
      setState({ entries, readError, loaded: true })
    }
    const unsubscribe = subscribeSavedWalks(refresh)
    refresh()
    return unsubscribe
  }, [])
  return state
}
