'use client'

import { useRouter, usePathname } from 'next/navigation'
import WKLogo from '@/components/shared/WKLogo'
import { useSavedWalkCount } from '@/lib/use-saved-walk-count'
import { useSaved } from '@/lib/saved-context'
import { useCompare } from '@/lib/compare-context'
import { withBrowseContext } from '@/lib/browse-state'
import { comparisonHref } from '@/lib/compare-navigation'
import { track } from '@/lib/analytics'
import { communityHref, parseCommunityState } from '@/lib/community'

interface Props {
  searchQuery?: string
  onSearchChange?: (value: string) => void
  onLogoClick?: () => void
}

export default function Header({ searchQuery = '', onSearchChange, onLogoClick }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { savedList } = useSaved()
  const savedWalkCount = useSavedWalkCount()
  const savedCount = savedList.length + savedWalkCount
  const { compareList } = useCompare()

  function navigate(path: string) {
    if (path === '/community') {
      const { city } = parseCommunityState(new URLSearchParams(window.location.search))
      track('community_opened', { source: 'navigation', city })
      router.push(communityHref(path, window.location.search))
    } else router.push(withBrowseContext(path, window.location.search))
  }

  const navItems = [
    { label: 'Explore', path: '/' },
    { label: 'Community', path: '/community' },
    { label: 'When to go', path: '/when-to-go' },
    { label: 'Compare', path: '/compare' },
  ]

  return (
    <header className="wk-header">
      <div className="header-inner">
        <button className="brand" onClick={onLogoClick ?? (() => navigate('/'))} aria-label="WhereKorea — explore destinations">
          <WKLogo size={26} />
          <span>Where<span className="accent">Korea</span></span>
        </button>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.path}
              aria-current={pathname === item.path || (item.path === '/community' && pathname.startsWith('/community/')) ? 'page' : undefined}
              onClick={() => item.path === '/compare'
                ? router.push(comparisonHref(compareList.length ? compareList : null, window.location.search))
                : navigate(item.path)}
            >
              {item.label}
              {item.path === '/compare' && compareList.length > 0 && <span className="count">{compareList.length}</span>}
            </button>
          ))}
        </nav>
        <div className="header-tools">
          {onSearchChange && (
            <input className="header-search" type="search" aria-label="Search destinations" placeholder="Search destinations…"
              value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
          )}
          <button className="saved" onClick={() => window.location.assign(withBrowseContext('/saved', window.location.search))} aria-label={`Saved places, ${savedCount} saved`} aria-current={pathname === '/saved' ? 'page' : undefined}>
            <span aria-hidden="true">{savedCount > 0 ? '♥' : '♡'}</span> Saved{savedCount > 0 && <span className="count">{savedCount}</span>}
          </button>
        </div>
      </div>
      <style jsx>{`
        .wk-header { position: sticky; top: 0; z-index: 40; background: rgba(19,23,30,.97); backdrop-filter: blur(14px); border-bottom: 1px solid #303b49; }
        .header-inner { max-width: 1400px; min-height: 66px; padding: 10px 24px; margin: auto; display: flex; align-items: center; gap: 30px; }
        button { cursor: pointer; color: #c8cdd6; border: 0; background: none; border-radius: 8px; }
        button:hover { color: #f5f4ef; background: #26303c; }
        button:focus-visible, input:focus-visible { outline: 2px solid #ff936b; outline-offset: 3px; }
        .brand { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding: 4px 0; color: #f5f4ef; font-size: 19px; font-weight: 800; letter-spacing: -.7px; }
        .brand:hover { background: none; }
        .accent { color: #ff936b; }
        nav { display: flex; align-items: center; gap: 4px; }
        nav button { min-height: 42px; padding: 9px 13px; display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 13px; font-weight: 600; }
        nav button[aria-current="page"] { color: #ffb496; background: #ff936b12; }
        .header-tools { display: flex; align-items: center; gap: 12px; margin-left: auto; }
        .saved { display: flex; align-items: center; gap: 6px; padding: 8px 10px; min-height: 42px; font-size: 12px; white-space: nowrap; border: 1px solid #36404e; }
        .count { display: inline-flex; justify-content: center; align-items: center; min-width: 19px; height: 19px; padding: 0 4px; color: #17202b; background: #ff936b; font-size: 11px; border-radius: 5px; font-weight: 800; }
        .header-search { width: 185px; padding: 8px 11px; background: #1d2530; border: 1px solid #36404e; border-radius: 8px; font-size: 12px; color: #f5f4ef; }
        @media (max-width: 760px) {
          .header-inner { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; padding: 9px 16px 5px; }
          .brand { font-size: 17px; }
          .header-tools { grid-column: 2; grid-row: 1; }
          .header-search { display: none; }
          nav { grid-column: 1 / -1; grid-row: 2; gap: 2px; flex-wrap: wrap; }
          nav button { min-height: 44px; padding: 7px 8px; font-size: 12px; }
          .saved { min-height: 36px; padding: 5px 8px; }
        }
      `}</style>
    </header>
  )
}
