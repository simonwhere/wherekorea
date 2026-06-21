import { MAP_POS } from '@/data/destinations-meta'

// Image dimensions: 398×494 — aspect ratio 1.240
const IMG_RATIO = 494 / 398

// Ulleungdo — not a destination card, just a dot on the map
const ULLEUNG = { x: 95, y: 14 }

const ACCENT = '#FF6A3D'

interface Props {
  slug: string
  size?: number
  showAll?: boolean
}

export default function KoreaMiniMap({ slug, size = 38, showAll = false }: Props) {
  const pos = MAP_POS[slug]
  const w = size
  const h = Math.round(size * IMG_RATIO)

  const pinOuter = size < 50 ? 14 : 18
  const pinInner = size < 50 ? 6 : 8

  return (
    <div style={{ position: 'relative', width: w, height: h, flexShrink: 0, display: 'block' }}>
      {/* Korea map image — white background removed, filtered to match dark theme */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/korea-map.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'top center',
          filter: 'brightness(10) saturate(0)',
          opacity: 0.38,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Ulleungdo dot */}
      <div style={{
        position: 'absolute',
        left: `${ULLEUNG.x}%`,
        top: `${ULLEUNG.y}%`,
        width: size < 50 ? 2 : 3,
        height: size < 50 ? 2 : 3,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.40)',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
      }} />

      {/* Other destination dots (showAll mode) */}
      {showAll && Object.keys(MAP_POS).map((s) => {
        if (s === slug) return null
        const p = MAP_POS[s]
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: size < 50 ? 2.5 : 3.5,
              height: size < 50 ? 2.5 : 3.5,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.40)',
              transform: 'translate(-50%,-50%)',
              pointerEvents: 'none',
            }}
          />
        )
      })}

      {/* Selected destination pin */}
      {pos && (
        <>
          {/* glow */}
          <div style={{
            position: 'absolute',
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: pinOuter,
            height: pinOuter,
            borderRadius: '50%',
            background: `${ACCENT}38`,
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }} />
          {/* dot */}
          <div style={{
            position: 'absolute',
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: pinInner,
            height: pinInner,
            borderRadius: '50%',
            background: ACCENT,
            border: '1.5px solid #fff',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }} />
        </>
      )}
    </div>
  )
}
