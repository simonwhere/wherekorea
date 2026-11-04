'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { destinations } from '@/data/destinations'
import { sanitizeCompareList } from '@/lib/compare-state'

interface CompareContextValue {
  compareList: string[]
  isHydrated: boolean
  toggleCompare: (slug: string) => void
  replaceCompareList: (slugs: string[]) => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

const STORAGE_KEY = 'wk_compare'
const VALID_SLUGS = destinations.map((d) => d.slug)

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareList, setCompareList] = useState<string[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Restore from localStorage on mount — must run before persist effect writes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setCompareList(sanitizeCompareList(parsed, VALID_SLUGS))
      }
    } catch {
      // ignore malformed storage
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage only after hydration to avoid overwriting stored data
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compareList))
    } catch {
      // Private browsing or blocked storage must not break this session's selection.
    }
  }, [compareList, isHydrated])

  const toggleCompare = useCallback((slug: string) => {
    if (!VALID_SLUGS.includes(slug)) return
    setCompareList((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      if (prev.length >= 3) return prev
      return [...prev, slug]
    })
  }, [])

  // Replaces the list with sanitized input: deduped, order preserved, capped at 3
  const replaceCompareList = useCallback((slugs: string[]) => {
    const next = sanitizeCompareList(slugs, VALID_SLUGS)
    setCompareList((prev) => prev.join(',') === next.join(',') ? prev : next)
  }, [])

  return (
    <CompareContext.Provider value={{ compareList, isHydrated, toggleCompare, replaceCompareList }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareProvider')
  return ctx
}
