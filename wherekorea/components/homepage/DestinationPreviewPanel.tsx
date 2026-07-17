'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Destination } from '@/data/types'
import { DAILY_AVG, KOREAN_NAMES, REGIONS } from '@/data/destinations-meta'
import KoreaMiniMap from '@/components/shared/KoreaMiniMap'
import { track } from '@/lib/analytics'
import { useCompare } from '@/lib/compare-context'
import { isPeakNow } from '@/lib/crowd'
import { usdApprox } from '@/lib/currency'

const ACCENT = '#FF6A3D'

function crowdDot(level: string): string {
  if (level === 'Low') return '#4ade80'
  if (level === 'Medium') return '#facc15'
  return '#f87171'
}

function noCarDot(level: string): string {
  if (level === 'Easy') return '#4ade80'
  if (level === 'Okay') return '#facc15'
  return '#f87171'
}

interface MetricProps {
  value: string
  label: string
  sub?: string
}
function PreviewMetric({ value, label, sub }: MetricProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{
        fontSize: 20, fontWeight: 800,
        color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.05,
      }}>{value}</span>
      <span style={{
        fontSize: 10, fontWeight: 600,
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
      }}>{label}{sub ? ` · ${sub}` : ''}</span>
    </div>
  )
}

interface Props {
  destination: Destination
  onClose: () => void
}

export default function DestinationPreviewPanel({ destination: d, onClose }: Props) {
  const router = useRouter()
  const { compareList, toggleCompare } = useCompare()
  const inCompare = compareList.includes(d.slug)
  const compareDisabled = compareList.length >= 3 && !inCompare

  const koreanName = KOREAN_NAMES[d.slug]
  const region = REGIONS[d.slug]
  const perDay = DAILY_AVG[d.slug] ?? d.card_budget_level
  // fixed once per mount — hydration-safe
  const [month] = useState(() => new Date().getMonth() + 1)
  const peakNow = isPeakNow(d, month)
  const weatherRange = d.live_weather_snapshot.split('·')[1]?.trim() ?? '—'
  // Live current temp + condition emoji when available; else weekly range
  const nowVal = d.live_weather_current
    ? `${d.live_weather_icon ? d.live_weather_icon + ' ' : ''}${d.live_weather_current}°`
    : weatherRange.replace('°C', '°')
  const fromSeoul = d.travel_time.from_seoul.replace(/^~/, '')

  function handleCompareToggle() {
    if (inCompare) {
      toggleCompare(d.slug)
    } else if (!compareDisabled) {
      track('compare_added', { slug: d.slug, compare_count: compareList.length + 1 })
      toggleCompare(d.slug)
    }
  }

  function handleOpenFull() {
    track('detail_page_viewed', { slug: d.slug })
    router.push(`/destination/${d.slug}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Close button */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 5 }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 16, lineHeight: 1, cursor: 'pointer',
          }}
        >×</button>
      </div>

      {/* Scrollable inner */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Photo */}
        <div style={{
          position: 'relative',
          aspectRatio: '16/10',
          background: '#1c1d24',
          overflow: 'hidden',
        }}>
          <img
            src={d.image.src}
            alt={d.image.alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(22,24,31,0.72) 0%, rgba(22,24,31,0) 45%)',
          }} />
          {/* Single image for now — restore dots/counter when photos[] lands (G2) */}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 22px 28px' }}>

          {/* Header: title + map */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 14, marginBottom: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 600,
                color: 'rgba(255,255,255,0.50)',
                textTransform: 'uppercase', letterSpacing: '0.10em',
                marginBottom: 6,
              }}>
                {region}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 style={{
                  fontSize: 32, fontWeight: 800,
                  color: '#fff', letterSpacing: '-0.035em', lineHeight: 1,
                }}>{d.name}</h2>
                {koreanName && (
                  <span style={{
                    fontSize: 18, fontWeight: 500,
                    color: 'rgba(255,255,255,0.50)', letterSpacing: '-0.01em',
                  }}>{koreanName}</span>
                )}
              </div>
            </div>

            <div style={{
              flexShrink: 0,
              padding: 7,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10, lineHeight: 0,
            }}>
              <KoreaMiniMap slug={d.slug} size={52} showAll />
            </div>
          </div>

          {/* Vibe */}
          <p style={{
            fontSize: 15.5, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 500, letterSpacing: '-0.005em',
            marginBottom: 20,
          }}>
            {d.vibe || d.card_vibe}
          </p>

          {/* Metric strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            padding: '14px 0',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 18,
          }}>
            <PreviewMetric value={d.recommended_stay} label="Stay" />
            <PreviewMetric value={nowVal} label="Now" />
            <PreviewMetric
              value={usdApprox(perDay) ?? perDay}
              label="Per day"
              sub={usdApprox(perDay) ? perDay : undefined}
            />
            {d.slug === 'seoul' ? (
              <PreviewMetric
                value={d.travel_time.from_incheon_airport.replace(/^~/, '')}
                label="From Incheon"
              />
            ) : (
              <PreviewMetric value={fromSeoul || '—'} label="From Seoul" />
            )}
          </div>

          {/* Happening now — live festival signal (info only, never ranked) */}
          {d.live_festivals && d.live_festivals.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              {d.live_festivals.map((f) => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: 'rgba(255,255,255,0.90)',
                  padding: '7px 10px', marginBottom: 6,
                  background: 'rgba(255,106,61,0.10)',
                  border: '1px solid rgba(255,106,61,0.25)',
                  borderRadius: 8,
                }}>
                  <span aria-hidden>🎪</span>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{f.name}</span>
                  <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                    until {f.ends}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Why */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700,
              color: ACCENT,
              textTransform: 'uppercase', letterSpacing: '0.09em',
              marginBottom: 8,
            }}>Why go</div>
            <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.65, fontWeight: 400 }}>
              {d.why}
            </p>
          </div>

          {/* Best for / Skip if */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
            marginBottom: 18,
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '12px 12px 13px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600,
                color: '#4ade80',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 6,
              }}>Best for</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.55 }}>
                {d.best_for}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '12px 12px 13px',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600,
                color: '#f87171',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 6,
              }}>Skip if</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.55 }}>
                {d.skip_if}
              </div>
            </div>
          </div>

          {/* Access */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 8,
            }}>Access</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500,
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: noCarDot(d.no_car_friendliness),
                }} />
                No-car: {d.no_car_friendliness}
              </span>
              {d.car_recommended && (
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(250,204,21,0.10)',
                  border: '1px solid rgba(250,204,21,0.30)',
                  color: '#facc15',
                }}>Car recommended</span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500,
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.85)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: crowdDot(d.crowd_friction),
                }} />
                {d.crowd_friction} crowds{peakNow ? ' · peak season now' : ''}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              {d.local_movement}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div style={{
        flexShrink: 0,
        padding: '12px 18px',
        background: 'rgba(22,24,31,0.96)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={handleCompareToggle}
          disabled={compareDisabled && !inCompare}
          style={{
            flex: 1,
            padding: '11px 14px',
            fontSize: 13, fontWeight: 600,
            borderRadius: 8,
            border: inCompare ? '1px solid rgba(255,255,255,0.80)' : '1px solid rgba(255,255,255,0.18)',
            background: inCompare ? 'rgba(255,255,255,0.14)' : 'transparent',
            color: '#fff',
            cursor: (compareDisabled && !inCompare) ? 'not-allowed' : 'pointer',
            opacity: (compareDisabled && !inCompare) ? 0.35 : 1,
            transition: 'all 120ms',
          }}
        >
          {inCompare ? '✓ Added to compare' : '+ Add to compare'}
        </button>
        <button
          onClick={handleOpenFull}
          style={{
            flexShrink: 0,
            padding: '11px 16px',
            fontSize: 13, fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: '#fff',
            color: '#16181f',
            cursor: 'pointer',
            transition: 'all 120ms',
          }}
        >
          Open full page →
        </button>
      </div>
    </div>
  )
}
