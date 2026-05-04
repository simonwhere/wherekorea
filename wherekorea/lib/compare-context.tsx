'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface CompareContextValue {
  compareList: string[]
  toggleCompare: (slug: string) => void
  replaceCompareList: (slugs: string[]) => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

const STORAGE_KEY = 'wk_compare'

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareList, setCompareList] = useState<string[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Restore from localStorage on mount — must run before persist effect writes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setCompareList(parsed.slice(0, 3))
      }
    } catch {
      // ignore malformed storage
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage only after hydration to avoid overwriting stored data
  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareList))
  }, [compareList, isHydrated])

  const toggleCompare = useCallback((slug: string) => {
    setCompareList((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      if (prev.length >= 3) return prev
      return [...prev, slug]
    })
  }, [])

  // Replaces the list with sanitized input: deduped, order preserved, capped at 3
  const replaceCompareList = useCallback((slugs: string[]) => {
    setCompareList([...new Set(slugs)].slice(0, 3))
  }, [])

  return (
    <CompareContext.Provider value={{ compareList, toggleCompare, replaceCompareList }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareProvider')
  return ctx
}
