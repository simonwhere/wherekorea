import type { NextConfig } from 'next'

// Static export: the whole app is client-side (local-first), so `next build`
// emits a plain `out/` folder that can be hosted anywhere or wrapped with
// Capacitor into iOS/Android apps later.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default nextConfig
