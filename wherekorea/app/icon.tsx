import { ImageResponse } from 'next/og'

// S1 — generated favicon (brand dot on dark). Replace with a real asset at rebrand time.
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#16181f', borderRadius: 7,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 99, background: '#FF6A3D', display: 'flex' }} />
      </div>
    ),
    size
  )
}
