import { ImageResponse } from 'next/og'
import { getDestinationBySlug, destinations } from '@/data/destinations'
import { REGIONS, DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox } from '@/lib/currency'

export const alt = 'WhereKorea destination card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }))
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = getDestinationBySlug(slug)
  if (!d) return new ImageResponse(<div style={{ display: 'flex', background: '#16181f', width: '100%', height: '100%' }} />, size)

  const perDay = DAILY_AVG[d.slug] ?? d.card_budget_level
  const usd = usdApprox(perDay)
  const stats: [string, string][] = [
    ['STAY', d.recommended_stay],
    ['PER DAY', usd ?? perDay],
    ['FROM SEOUL', d.travel_time.from_seoul.replace(/^~/, '')],
    ['NO-CAR', d.no_car_friendliness],
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#16181f',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 99, background: '#FF6A3D', display: 'flex' }} />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', display: 'flex' }}>
              Where<span style={{ color: '#FF6A3D' }}>Korea</span>
            </div>
          </div>
          <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.55)', display: 'flex', textTransform: 'uppercase', letterSpacing: 4 }}>
            {REGIONS[d.slug] ?? ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 104, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-3px', display: 'flex' }}>
            {d.name}
          </div>
          <div style={{ fontSize: 34, color: '#FF8E6B', display: 'flex' }}>{d.card_vibe}</div>
        </div>

        <div style={{ display: 'flex', gap: 56 }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', display: 'flex' }}>{value}</div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)', display: 'flex', letterSpacing: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
