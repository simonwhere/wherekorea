'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Saved shortlist ("hearts") — localStorage only, no accounts, no cap.
// Distinct from compare (max-3 working set): saved is the longer wishlist
// travelers build up over the weeks of planning a trip.

interface SavedContextValue {
  savedList: string[]
  toggleSaved: (slug: string) => void
}

const SavedContext = createContext<SavedContextValue | null>(null)

const STORAGE_KEY = 'wk_saved'

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [savedList, setSavedList] = useState<string[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Restore from localStorage on mount — must run before persist effect writes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setSavedList(parsed)
      }
    } catch {
      // ignore malformed storage
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedList))
  }, [savedList, isHydrated])

  const toggleSaved = useCallback((slug: string) => {
    setSavedList((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }, [])

  return (
    <SavedContext.Provider value={{ savedList, toggleSaved }}>
      {children}
    </SavedContext.Provider>
  )
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used within SavedProvider')
  return ctx
}
