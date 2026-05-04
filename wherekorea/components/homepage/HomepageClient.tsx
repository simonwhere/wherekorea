'use client'

import { useState, useEffect } from 'react'
import type { Destination, FilterTag } from '@/data/types'
import { filterDestinations } from '@/lib/filters'
import { track } from '@/lib/analytics'
import Header from '@/components/layout/Header'
import FilterStrip from '@/components/homepage/FilterStrip'
import DestinationGrid from '@/components/homepage/DestinationGrid'

interface Props {
  destinations: Destination[]
}

export default function HomepageClient({ destinations }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterTag[]>([])

  useEffect(() => {
    track('homepage_view')
  }, [])

  const filtered = filterDestinations(destinations, activeFilters, searchQuery)

  function toggleFilter(tag: FilterTag) {
    setActiveFilters((prev) => {
      const next = prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
      if (!prev.includes(tag)) {
        track('filter_used', { tag })
      }
      return next
    })
  }

  function clearAllFilters() {
    setActiveFilters([])
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <FilterStrip activeFilters={activeFilters} onToggle={toggleFilter} onClearAll={clearAllFilters} />

      <main className="flex-1 px-4 py-6 pb-24">
        <div className="max-w-screen-xl mx-auto">
          <div className="mb-4 text-xs text-gray-500">
            {filtered.length} destination{filtered.length !== 1 ? 's' : ''}
            {activeFilters.length > 0 || searchQuery ? ' shown' : ''}
          </div>
          <DestinationGrid destinations={filtered} />
        </div>
      </main>
    </div>
  )
}
