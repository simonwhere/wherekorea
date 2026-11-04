import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'WhereKorea — where in Korea should I go right now?'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 99, background: '#FF6A3D', display: 'flex' }} />
          <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', display: 'flex' }}>
            Where<span style={{ color: '#FF6A3D' }}>Korea</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: '#fff', lineHeight: 1.05, letterSpacing: '-2px', display: 'flex' }}>
            Where in Korea should
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', display: 'flex' }}>
            <span style={{ color: '#FF6A3D' }}>I go right now?</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 99, background: '#4ade80', display: 'flex' }} />
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.65)', display: 'flex' }}>
            15 destinations · Sights, food, travel times and daily costs
          </div>
        </div>
      </div>
    ),
    size
  )
}
