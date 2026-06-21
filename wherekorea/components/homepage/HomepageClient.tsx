'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Destination, FilterTag } from '@/data/types'
import {
  SECTION_COPY, matchesCategory,
  type CategoryId,
} from '@/data/destinations-meta'
import { track } from '@/lib/analytics'
import { filterDestinations } from '@/lib/filters'
import Header from '@/components/layout/Header'
import CategoryRail from '@/components/homepage/CategoryRail'
import FilterStrip from '@/components/homepage/FilterStrip'
import DestinationCard from '@/components/cards/DestinationCard'
import DestinationPreviewPanel from '@/components/homepage/DestinationPreviewPanel'

const PANEL_WIDTH = 480

function useIsDesktop(breakpoint = 1100) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true
  )
  useEffect(() => {
    function onResize() { setIsDesktop(window.innerWidth >= breakpoint) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isDesktop
}

interface Props {
  destinations: Destination[]
}

export default function HomepageClient({ destinations }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterTag[]>([])
  const [activeCategory, setActiveCategory] = useState<CategoryId>('best-now')

  const searchParams = useSearchParams()
  const router = useRouter()
  const selectedSlug = searchParams.get('destination')
  const isDesktop = useIsDesktop(1100)

  useEffect(() => { track('homepage_view') }, [])

  // Esc closes preview
  useEffect(() => {
    if (!selectedSlug) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') clearSelected() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSlug])

  const byCategory = destinations.filter((d) => matchesCategory(d, activeCategory))
  const filtered = filterDestinations(byCategory, activeFilters, searchQuery)

  const selectedDest = selectedSlug
    ? destinations.find((d) => d.slug === selectedSlug) ?? null
    : null

  function handleSelect(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedSlug === slug) {
      params.delete('destination')
    } else {
      params.set('destination', slug)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function clearSelected() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('destination')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function toggleFilter(tag: FilterTag) {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
    track('filter_used', { tag })
  }

  function handleCategoryChange(id: CategoryId) {
    setActiveCategory(id)
    clearSelected()
  }

  const panelOpenOnDesktop = isDesktop && !!selectedDest
  const copy = SECTION_COPY[activeCategory] ?? SECTION_COPY['best-now']

  return (
    <div style={{ minHeight: '100vh', background: '#16181f' }}>
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogoClick={clearSelected}
      />
      <CategoryRail active={activeCategory} onChange={handleCategoryChange} />

      <main style={{
        padding: '0 20px 100px',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {/* Editorial heading */}
        <div style={{ padding: '26px 0 4px', maxWidth: 680 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.035em', lineHeight: 1.08,
          }}>
            {copy.h}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
            {copy.s}
          </p>
        </div>

        {/* Filter strip — user-intent narrowing */}
        <FilterStrip
          activeFilters={activeFilters}
          onToggle={toggleFilter}
          onClearAll={() => setActiveFilters([])}
        />

        {/* Grid */}
        <div style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 14,
        }}>
          {filtered.map((d) => (
            <DestinationCard
              key={d.slug}
              destination={d}
              onSelect={() => handleSelect(d.slug)}
              isSelected={selectedSlug === d.slug}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            color: 'rgba(255,255,255,0.20)', fontSize: 14,
          }}>
            No places match this category and filter combination.
          </div>
        )}
      </main>

      {/* Desktop stuck right panel */}
      {panelOpenOnDesktop && selectedDest && (
        <aside style={{
          position: 'fixed',
          top: 56 + 56,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          background: '#1a1c24',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 25,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.30)',
          animation: 'slideInRight 220ms cubic-bezier(0.22,0.61,0.36,1) both',
        }}>
          <DestinationPreviewPanel
            destination={selectedDest}
            onClose={clearSelected}
          />
        </aside>
      )}

      {/* Mobile bottom sheet */}
      {!isDesktop && selectedDest && (
        <>
          <div
            onClick={clearSelected}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            height: '88vh', zIndex: 61,
            background: '#1a1c24',
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            boxShadow: '0 -20px 60px rgba(0,0,0,0.50)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUpSheet 260ms cubic-bezier(0.22,0.61,0.36,1) both',
          }}>
            <div style={{
              padding: '8px 0 4px',
              display: 'flex', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 40, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.25)',
              }} />
            </div>
            <DestinationPreviewPanel
              destination={selectedDest}
              onClose={clearSelected}
            />
          </div>
        </>
      )}

      {/* Hide compare tray when mobile bottom sheet is open */}
      {/* (CompareTray renders from layout — it's always present; the z-index of bottom sheet covers it) */}
    </div>
  )
}
