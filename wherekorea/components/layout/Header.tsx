'use client'

import { useState } from 'react'
import WKLogo from '@/components/shared/WKLogo'

const NOW_MONTH = (() => {
  try { return new Date().toLocaleString('en-US', { month: 'long' }) }
  catch { return 'June' }
})()

const ACCENT = '#FF6A3D'
const ACCENT_SOFT = 'rgba(255,106,61,0.14)'

interface Props {
  searchQuery: string
  onSearchChange: (value: string) => void
  onLogoClick?: () => void
}

export default function Header({ searchQuery, onSearchChange, onLogoClick }: Props) {
  const [navHover, setNavHover] = useState<number | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const navItems = ['Explore', 'When to go', 'Compare']

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(20,22,28,0.96)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        {/* Logo */}
        <button
          onClick={onLogoClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none',
            cursor: 'pointer', flexShrink: 0, padding: 0,
          }}
        >
          <WKLogo size={25} />
          <span style={{
            fontSize: 17, fontWeight: 800,
            letterSpacing: '-0.04em', color: '#fff',
            lineHeight: 1,
          }}>
            Where<span style={{ color: ACCENT }}>Korea</span>
          </span>
        </button>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {navItems.map((item, i) => (
            <button
              key={item}
              onMouseEnter={() => setNavHover(i)}
              onMouseLeave={() => setNavHover(null)}
              style={{
                fontSize: 13, fontWeight: 500,
                padding: '6px 11px', borderRadius: 7,
                background: navHover === i ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: i === 0 ? '#fff' : 'rgba(255,255,255,0.62)',
                transition: 'all 120ms', whiteSpace: 'nowrap',
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Right cluster */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Now chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 8,
            background: ACCENT_SOFT,
            border: `1px solid rgba(255,106,61,0.30)`,
            flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#FF8E6B', whiteSpace: 'nowrap' }}>
              Now · {NOW_MONTH}
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <span style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="search"
              placeholder="Search cities, food, seasons…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: '100%', height: 36,
                paddingLeft: 30, paddingRight: 12,
                fontSize: 13,
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${searchFocused ? 'rgba(255,106,61,0.55)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 9,
                color: '#fff', outline: 'none',
                transition: 'border-color 150ms',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
