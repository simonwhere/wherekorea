'use client'

import { useState } from 'react'
import type { Destination } from '@/data/types'
import { DAILY_AVG, KOREAN_NAMES, REGIONS } from '@/data/destinations-meta'
import KoreaMiniMap from '@/components/shared/KoreaMiniMap'
import { track } from '@/lib/analytics'
import { useCompare } from '@/lib/compare-context'
import { useSaved } from '@/lib/saved-context'
import { isPeakNow } from '@/lib/crowd'
import { usdApprox } from '@/lib/currency'

const ACCENT = '#FF6A3D'

function crowdColor(level: string): string {
  if (level === 'Low') return '#4ade80'
  if (level === 'Medium') return '#facc15'
  return '#f87171'
}

interface Props {
  destination: Destination
  onSelect: () => void
  isSelected: boolean
  // "why it ranks here" one-liner — only passed in the Best now category
  bestNowReason?: string
}

export default function DestinationCard({ destination: d, onSelect, isSelected, bestNowReason }: Props) {
  const { compareList, toggleCompare } = useCompare()
  const { savedList, toggleSaved } = useSaved()
  const isSaved = savedList.includes(d.slug)
  const inCompare = compareList.includes(d.slug)
  const compareDisabled = compareList.length >= 3 && !inCompare
  const [imgErr, setImgErr] = useState(false)
  const [hov, setHov] = useState(false)
  const [hovCompare, setHovCompare] = useState(false)
  // fixed once per mount — hydration-safe (same pattern as best-now month)
  const [month] = useState(() => new Date().getMonth() + 1)
  const peakNow = isPeakNow(d, month)

  // "Now" = live current temp + condition emoji when available;
  // falls back to the weekly range parsed from snapshot ("This week · 13–21°C · …")
  const weatherRange = d.live_weather_snapshot.split('·')[1]?.trim() ?? '—'
  const nowVal = d.live_weather_current
    ? `${d.live_weather_icon ? d.live_weather_icon + ' ' : ''}${d.live_weather_current}°`
    : weatherRange.replace('°C', '°')
  const perDayKrw = DAILY_AVG[d.slug] ?? d.card_budget_level
  // USD leads for a global audience; ₩ stays visible as the label detail
  const perDay = usdApprox(perDayKrw) ?? perDayKrw
  const perDayLabel = perDay.startsWith('$') ? `Per day · ${perDayKrw}` : 'Per day'
  const koreanName = KOREAN_NAMES[d.slug]
  const region = REGIONS[d.slug]

  function handleCompareToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (inCompare) {
      toggleCompare(d.slug)
    } else if (!compareDisabled) {
      track('compare_added', { slug: d.slug, compare_count: compareList.length + 1 })
      toggleCompare(d.slug)
    }
  }

  return (
    <article
      onClick={() => {
        track('card_clicked', { slug: d.slug })
        onSelect()
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        aspectRatio: '3/4',
        background: '#1c1d24',
        cursor: 'pointer',
        transition: 'transform 200ms, box-shadow 200ms, outline-color 200ms',
        transform: (hov || isSelected) ? 'translateY(-2px)' : 'none',
        outline: isSelected ? '2px solid #fff' : '2px solid transparent',
        outlineOffset: 2,
        boxShadow: isSelected
          ? '0 10px 36px rgba(0,0,0,0.65)'
          : hov
            ? '0 8px 32px rgba(0,0,0,0.55)'
            : '0 2px 8px rgba(0,0,0,0.30)',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          track('card_clicked', { slug: d.slug })
          onSelect()
        }
      }}
      aria-label={`Preview ${d.name}`}
      aria-pressed={isSelected}
    >
      {/* Background image */}
      {!imgErr ? (
        <img
          src={d.image.src}
          alt={d.image.alt}
          onError={() => setImgErr(true)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            transform: hov ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 500ms ease',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1e2030, #0f1017)',
        }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.20) 100%)',
      }} />

      {/* Top-left: primary tag */}
      {d.tags[0] && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '3.5px 8px',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          color: '#fff',
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.22)',
        }}>
          {d.tags[0]}
        </div>
      )}

      {/* Top-right: Korea mini-map */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        padding: 5,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(8px)',
        borderRadius: 9,
        border: '1px solid rgba(255,255,255,0.16)',
        lineHeight: 0,
      }}>
        <KoreaMiniMap slug={d.slug} size={30} />
      </div>

      {/* Bottom content */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '0 12px 12px',
      }}>
        {/* Korean name + region eyebrow */}
        <div style={{
          fontSize: 11, fontWeight: 600,
          marginBottom: 5,
          letterSpacing: '0.01em',
          textShadow: '0 1px 4px rgba(0,0,0,0.85)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.95)' }}>{koreanName}</span>
          <span style={{ color: 'rgba(255,255,255,0.70)' }}> · {region}</span>
        </div>

        {/* Destination name */}
        <h2 style={{
          fontSize: 26, fontWeight: 700,
          color: '#fff', lineHeight: 1.02,
          letterSpacing: '-0.03em',
          marginBottom: 4,
          textShadow: '0 1px 6px rgba(0,0,0,0.5)',
        }}>
          {d.name}
        </h2>

        {/* Short vibe */}
        <p style={{
          fontSize: 12.5, color: 'rgba(255,255,255,0.95)',
          lineHeight: 1.3, marginBottom: 11,
          letterSpacing: '0.005em', fontWeight: 500,
          textShadow: '0 1px 4px rgba(0,0,0,0.80)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {d.card_vibe}
        </p>

        {/* Best-now reason — why this ranks here right now */}
        {bestNowReason && (
          <div style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            padding: '3px 8px', marginBottom: 10,
            background: 'rgba(255,106,61,0.16)',
            border: '1px solid rgba(255,106,61,0.35)',
            borderRadius: 5,
            letterSpacing: '0.02em',
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}>
            {bestNowReason}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 11 }} />

        {/* Metric row: Stay / Now / Per day */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 12,
        }}>
          {[
            { v: d.recommended_stay, l: 'Stay' },
            { v: nowVal,             l: 'Now' },
            { v: perDay,             l: perDayLabel },
          ].map((m) => (
            <div key={m.l} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{
                fontSize: 13.5, fontWeight: 700, color: '#fff',
                letterSpacing: '-0.03em', lineHeight: 1.05,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                textShadow: '0 1px 3px rgba(0,0,0,0.75)',
              }}>{m.v}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.78)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                textShadow: '0 1px 3px rgba(0,0,0,0.85)',
              }}>{m.l}</span>
            </div>
          ))}
        </div>

        {/* Bottom row: crowd + compare */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 6,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: crowdColor(d.crowd_friction), flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.92)', fontWeight: 500, textShadow: '0 1px 3px rgba(0,0,0,0.80)' }}>
              {d.crowd_friction} crowd{peakNow ? ' · peak now' : ''}
            </span>
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!isSaved) track('destination_saved', { slug: d.slug })
              toggleSaved(d.slug)
            }}
            aria-label={isSaved ? `Remove ${d.name} from saved` : `Save ${d.name}`}
            aria-pressed={isSaved}
            style={{
              flexShrink: 0, marginLeft: 'auto',
              width: 27, height: 27, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, lineHeight: 1,
              border: isSaved ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(0,0,0,0.30)',
              color: isSaved ? ACCENT : 'rgba(255,255,255,0.85)',
              cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'all 120ms',
            }}
          >
            {isSaved ? '♥' : '♡'}
          </button>

          <button
            onClick={handleCompareToggle}
            onMouseEnter={() => setHovCompare(true)}
            onMouseLeave={() => setHovCompare(false)}
            disabled={compareDisabled && !inCompare}
            style={{
              flexShrink: 0,
              fontSize: 11, fontWeight: 600,
              padding: '5px 11px',
              borderRadius: 7,
              border: inCompare
                ? `1px solid ${ACCENT}`
                : '1px solid rgba(255,255,255,0.22)',
              background: inCompare
                ? ACCENT
                : hovCompare ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.30)',
              color: '#fff',
              cursor: (compareDisabled && !inCompare) ? 'not-allowed' : 'pointer',
              opacity: (compareDisabled && !inCompare) ? 0.3 : 1,
              transition: 'all 120ms',
              backdropFilter: 'blur(4px)',
            }}
          >
            {inCompare ? '✓ Added' : '+ Compare'}
          </button>
        </div>
      </div>
    </article>
  )
}
