'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Destination, FilterTag } from '@/data/types'
import type { WalkGuide, WalkStop } from '@/data/walks/types'
import { searchedWalkStop, walkStopPath } from '@/lib/walk-links'
import { type CategoryId } from '@/data/destinations-meta'
import { track } from '@/lib/analytics'
import { type BrowseState, browseHref, browseQuery, parseBrowseState, homeHrefFromSearch } from '@/lib/browse-state'
import { rankDestinations } from '@/lib/recommendation'
import { createBrowseCommitQueue, rememberedScroll, rememberScroll, type BrowseScrollSnapshot } from '@/lib/browse-session'
import Header from '@/components/layout/Header'
import CategoryRail from '@/components/homepage/CategoryRail'
import FilterStrip, { FILTER_LABELS } from '@/components/homepage/FilterStrip'
import DestinationCard from '@/components/cards/DestinationCard'
import DestinationPreviewPanel from '@/components/homepage/DestinationPreviewPanel'
import LiveDataNotice from '@/components/shared/LiveDataNotice'
import type { FestivalDataStatus } from '@/lib/live/status'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SCROLL_KEY = 'wk_home_scroll'

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)')
    const update = () => setDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

interface Props {
  destinations: Destination[]
  cardWalks: Record<string, Pick<WalkGuide, 'slug' | 'name' | 'nameKo' | 'cardRoute'> & { stops: Pick<WalkStop, 'name' | 'nameKo'>[] }>
  selectedSlug: string | null
  month: number
  nowMonth: number
  browse: BrowseState
  festivalStatus?: FestivalDataStatus
}

export default function HomepageClient({ destinations, cardWalks, nowMonth, browse, festivalStatus }: Props) {
  const router = useRouter()
  // Native search URL updates and router navigation share this one selection source.
  const selectedSlug = useSearchParams().get('destination')
  const isDesktop = useIsDesktop()
  // This is an optimistic view of the validated URL, not a second destination
  // selection state. Every committed control change is shareable in the URL.
  const [state, setState] = useState(browse)
  const stateRef = useRef(browse)
  const pendingQuery = useRef<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const searchCommit = useRef(createBrowseCommitQueue())
  const scrollSnapshot = useRef<BrowseScrollSnapshot>({ key: browseQuery(browse).toString(), y: 0 })
  const isRestoringScroll = useRef(false)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const selectedDest = destinations.find((d) => d.slug === selectedSlug) ?? null
  const hasSelectedDest = selectedDest !== null
  const panelOpen = isDesktop && !!selectedDest
  const incomingKey = browseQuery(browse).toString()
  const renderedKey = browseQuery(state).toString()

  useEffect(() => {
    if (!pendingQuery.current || pendingQuery.current === incomingKey) {
      // URL serialization trims search for sharing. An acknowledged response
      // must not remove the space a user just typed between two search words.
      const next = pendingQuery.current === incomingKey ? { ...browse, q: stateRef.current.q } : browse
      stateRef.current = next
      setState(next)
      pendingQuery.current = null
    }
  }, [browse, incomingKey])

  useEffect(() => {
    const onPop = () => {
      searchCommit.current.cancel()
      if (window.location.pathname !== '/') return
      const restored = parseBrowseState(new URLSearchParams(window.location.search), nowMonth)
      pendingQuery.current = browseQuery(restored).toString()
      stateRef.current = restored
      setState(restored)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [nowMonth])

  const navigate = useCallback((next: BrowseState, destination: string | null) => {
    searchCommit.current.cancel()
    pendingQuery.current = browseQuery(next).toString()
    const href = browseHref(next, '/', destination ? { destination } : {})
    startTransition(() => router.replace(href, { scroll: false }))
  }, [router])

  function update(patch: Partial<BrowseState>, closePreview = true) {
    searchCommit.current.cancel()
    const previousBudget = stateRef.current.maxDailyKrw
    const next = { ...stateRef.current, ...patch }
    stateRef.current = next
    setState(next)
    // Publish only the discovery conditions synchronously. Header / tray
    // navigation can now read the newest month, mode and filters even while a
    // Here now weather request is in flight. The router still commits preview
    // clearing and requests fresh server data below; native history is not a
    // replacement for that navigation.
    window.history.replaceState(null, '', homeHrefFromSearch(window.location.search, next))
    if (Object.prototype.hasOwnProperty.call(patch, 'maxDailyKrw') && previousBudget !== next.maxDailyKrw) {
      track('daily_budget_changed', { max_daily_krw: next.maxDailyKrw ?? 'any' })
    }
    navigate(next, closePreview ? null : selectedSlug)
  }

  const closePreview = useCallback(() => {
    navigate(stateRef.current, null)
  }, [navigate])

  useEffect(() => {
    track('homepage_view')
    const commitQueue = searchCommit.current
    let restoreFrame: number | null = null
    // Return to the same list position after a full detail/compare visit.
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? 'null')
      const y = rememberedScroll(saved, browseQuery(stateRef.current).toString())
      if (y !== null) {
        isRestoringScroll.current = true
        restoreFrame = requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'instant' })
          scrollSnapshot.current = { key: browseQuery(stateRef.current).toString(), y: window.scrollY }
          isRestoringScroll.current = false
        })
      }
    } catch { /* Browsing still works with storage blocked. */ }
    const persistScroll = () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? 'null')
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify(rememberScroll(saved, scrollSnapshot.current)))
      } catch { /* optional */ }
    }
    const saveScroll = () => {
      // Next may reset the new page's scroll before this component unmounts.
      // Do not relabel that position as the homepage's last observed position.
      if (window.location.pathname !== '/' || isRestoringScroll.current) return
      scrollSnapshot.current = { ...scrollSnapshot.current, y: window.scrollY }
      persistScroll()
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => {
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame)
      if (!isRestoringScroll.current) persistScroll()
      isRestoringScroll.current = false
      window.removeEventListener('scroll', saveScroll)
      commitQueue.cancel()
    }
  }, [])

  useEffect(() => {
    // Associate positions with the rendered result set, not an in-flight query.
    if (!isRestoringScroll.current) scrollSnapshot.current = { key: renderedKey, y: window.scrollY }
  }, [renderedKey])

  useEffect(() => {
    if (!selectedSlug) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePreview() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSlug, closePreview])

  useEffect(() => {
    if (isDesktop || !hasSelectedDest || !dialogRef.current) return
    const dialog = dialogRef.current
    const background = backgroundRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    background?.setAttribute('inert', '')
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0)
    ;(focusable()[0] ?? dialog).focus({ preventScroll: true })
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first) { e.preventDefault(); dialog.focus({ preventScroll: true }); return }
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault(); last.focus({ preventScroll: true })
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault(); first.focus({ preventScroll: true })
      }
    }
    function containFocus(e: FocusEvent) {
      if (!dialog.contains(e.target as Node)) (focusable()[0] ?? dialog).focus({ preventScroll: true })
    }
    document.addEventListener('keydown', trap)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', trap)
      document.removeEventListener('focusin', containFocus)
      document.body.style.overflow = previousOverflow
      background?.removeAttribute('inert')
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isDesktop, selectedSlug, hasSelectedDest])

  function toggleFilter(tag: FilterTag) {
    const filters = stateRef.current.filters
    update({ filters: filters.includes(tag) ? filters.filter((value) => value !== tag) : [...filters, tag] })
    track('filter_used', { tag })
  }

  function changeMonth(month: number) {
    update({ month, mode: 'plan' })
    track('month_selected', { month, is_now: false })
  }

  function changeMode(mode: 'plan' | 'now') {
    const month = mode === 'now' ? nowMonth : stateRef.current.month
    update({ mode, month })
    track('planning_mode_changed', { mode, month })
  }

  function search(q: string) {
    const next = { ...stateRef.current, q: q.slice(0, 200) }
    stateRef.current = next
    setState(next)
    pendingQuery.current = browseQuery(next).toString()
    // Next patches native history to retain its router metadata and update
    // useSearchParams. Passing an existing __NA state would bypass that patch.
    // Write synchronously so a fast header/tray click reads the latest search.
    window.history.replaceState(null, '', browseHref(next))
    searchCommit.current.schedule(() => navigate(stateRef.current, null))
  }

  const filtered = rankDestinations(destinations, state)
  const noCar = state.filters.includes('no-car friendly')
  const moreCount = state.filters.filter((tag) => tag !== 'no-car friendly').length + (state.maxDailyKrw === undefined ? 0 : 1)
  const narrowed = state.filters.length > 0 || !!state.q || state.excludeSeoul || state.category !== 'best-now' || state.maxDailyKrw !== undefined
  const liveCount = destinations.filter((d) => d.live_weather_is_live).length

  return (
    <div className="wk-explore">
      <div ref={backgroundRef}>
        <Header onLogoClick={() => update({ category: 'best-now', q: '', filters: [], excludeSeoul: false, maxDailyKrw: undefined })} />
        <main className={`wk-explore-main${panelOpen ? ' has-preview' : ''}`}>
          <section className="wk-intro" aria-labelledby="explore-title">
            <div>
              <p className="wk-eyebrow">Travel in Korea</p>
              <h1 id="explore-title">Where to go in Korea<span>.</span></h1>
              <p className="wk-intro-copy">Explore sights, local food, recommended stays and travel costs.</p>
              <Link className="wk-arrival-entry" href={browseHref(state, '/from-seoul', selectedSlug ? { destination: selectedSlug } : {})}>From Seoul without a car <span aria-hidden>→</span></Link>
            </div>
            <a className="wk-method-link" href={browseHref(state, '/about')}>About this guide <span aria-hidden>↗</span></a>
          </section>

          <section className="wk-trip-controls" aria-label="Your travel conditions">
            <div className="wk-condition-row">
              <div className="wk-mode-control" role="group" aria-label="Planning mode">
                <button type="button" aria-pressed={state.mode === 'plan'} onClick={() => changeMode('plan')}>By month</button>
                <button type="button" aria-pressed={state.mode === 'now'} onClick={() => changeMode('now')}>Here now</button>
              </div>
              <label className="wk-month-select">
                <span>Travel month</span>
                <select value={state.month} onChange={(e) => changeMonth(Number(e.target.value))}>
                  {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
              </label>
              <button type="button" className="wk-condition-chip" aria-pressed={noCar} onClick={() => toggleFilter('no-car friendly')}>
                <span aria-hidden>{noCar ? '✓' : '↔'}</span> Easy without a car
              </button>
              <button type="button" className="wk-condition-chip" aria-pressed={state.excludeSeoul}
                onClick={() => { update({ excludeSeoul: !state.excludeSeoul }); track('filter_used', { tag: 'beyond-seoul' }) }}>
                <span aria-hidden>{state.excludeSeoul ? '✓' : '+'}</span> Beyond Seoul
              </button>
              <button type="button" className="wk-more-button" aria-expanded={filtersOpen} aria-controls="destination-filters"
                onClick={() => setFiltersOpen(!filtersOpen)}>More filters{moreCount ? ` · ${moreCount}` : ''} <span aria-hidden>{filtersOpen ? '−' : '+'}</span></button>
            </div>
            {filtersOpen && <FilterStrip activeFilters={state.filters} onToggle={toggleFilter}
              maxDailyKrw={state.maxDailyKrw}
              onBudgetChange={(value) => update({ maxDailyKrw: value })}
              onClearAll={() => update({ filters: [], maxDailyKrw: undefined })} />}
            {moreCount > 0 && !filtersOpen && <div className="wk-active-filters" aria-label="Selected filters">
              {state.filters.filter((tag) => tag !== 'no-car friendly').map((tag) =>
                <button type="button" key={tag} onClick={() => toggleFilter(tag)} aria-label={`Remove ${FILTER_LABELS[tag]} filter`}>
                  {FILTER_LABELS[tag]} <span aria-hidden>×</span>
                </button>)}
              {state.maxDailyKrw !== undefined && <button type="button" onClick={() => update({ maxDailyKrw: undefined })}
                aria-label="Remove daily budget filter">Up to ₩{state.maxDailyKrw.toLocaleString('en-US')} / day, approx. <span aria-hidden>×</span></button>}
            </div>}
          </section>

          <CategoryRail active={state.category} onChange={(category: CategoryId) => update({ category })} />
          {state.mode === 'now' && <LiveDataNotice status={festivalStatus} />}

          <div className="wk-results-toolbar">
            <div>
              <h2>{filtered.length} {filtered.length === 1 ? 'place' : 'places'}{narrowed ? ' found' : ' to explore'}</h2>
              <p>{state.mode === 'plan' ? `${MONTHS[state.month - 1]} · usual seasonal conditions`
                : `Current weather · ${liveCount} of ${destinations.length} places`}</p>
            </div>
            <div className="wk-search"><span aria-hidden>⌕</span><label htmlFor="destination-search" className="sr-only">Search cities, neighbourhoods, food or experiences</label>
              <input id="destination-search" type="search" value={state.q} onChange={(e) => search(e.target.value)} onBlur={() => searchCommit.current.cancel()} placeholder="City, neighbourhood or food…" maxLength={200} />
              {state.q && <button type="button" onClick={() => update({ q: '' })} aria-label="Clear search">×</button>}
            </div>
          </div>

          <div className="wk-results-note">
            <span>Pick 2–3 places to compare.</span>
            <details><summary>About the order</summary><p>Places match the selected filters. Recommended months come first{state.mode === 'now' ? ', followed by current weather where comparable readings are available' : ''}, then the guide’s general recommendations.</p></details>
            <span className="sr-only" role="status">{isPending ? 'Updating your travel conditions' : `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} shown`}</span>
          </div>

          <div className="wk-destination-grid">
            {filtered.map((d) => {
              const walk = cardWalks[d.slug]
              const stop = walk && searchedWalkStop(walk, state.q)
              return <DestinationCard key={d.slug} destination={d} isSelected={selectedSlug === d.slug}
                walk={walk && {
                  name: walk.name,
                  route: stop ? `Stop ${stop} · ${walk.stops[stop - 1].name}` : walk.cardRoute,
                  href: browseHref(state, stop ? walkStopPath(walk.slug, stop) : '/walks/' + walk.slug, {
                    from: 'explore', ...(selectedSlug ? { destination: selectedSlug } : {}),
                  }),
                }}
                browse={state} month={state.month} onSelect={() => navigate(stateRef.current, selectedSlug === d.slug ? null : d.slug)} />
            })}
          </div>
          {filtered.length === 0 && <section className="wk-empty-state">
            <h3>No places match these filters.</h3>
            <p>Change a filter or clear the search to see more places.</p>
            {state.maxDailyKrw !== undefined && <button type="button" className="wk-condition-chip" onClick={() => update({ maxDailyKrw: undefined })}>Remove budget filter</button>}
            <button type="button" className="wk-condition-chip" onClick={() => update({ filters: [], q: '', category: 'best-now', excludeSeoul: false, maxDailyKrw: undefined })}>Reset filters and search</button>
          </section>}
          <p className="wk-budget-footnote">Approximate daily cost per person, including a mid-range room shared by two. Intercity travel is extra. <a href={`${browseHref(state, '/about')}#budget`}>What’s included</a>.</p>
        </main>
      </div>

      {panelOpen && selectedDest && <aside className="wk-desktop-preview" aria-label={`${selectedDest.name} preview`}>
        <DestinationPreviewPanel destination={selectedDest} onClose={closePreview} month={state.month} browse={state} />
      </aside>}
      {!isDesktop && selectedDest && <>
        <div className="wk-sheet-overlay" onClick={closePreview} aria-hidden="true" />
        <div ref={dialogRef} className="wk-mobile-sheet" role="dialog" aria-modal="true" tabIndex={-1} aria-label={`${selectedDest.name} preview`}>
          <div className="wk-sheet-handle" aria-hidden="true"><span /></div>
          <DestinationPreviewPanel destination={selectedDest} onClose={closePreview} month={state.month} browse={state} />
        </div>
      </>}
    </div>
  )
}
