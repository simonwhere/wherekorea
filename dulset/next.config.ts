import type { NextConfig } from 'next'

// Static export: the whole app is client-side (local-first), so `next build`
// emits a plain `out/` folder that can be hosted anywhere or wrapped with
// Capacitor into iOS/Android apps later.
const nextConfig: NextConfig = {
  output: 'export',
  // `/link/` is a folder with an index.html (not `link.html`), so the partner
  // page opens on any static host without a rewrite rule — the address she
  // sends is `…/link/#t=…` (lib/logic/partnerLink.ts LINK_PATH).
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default nextConfig
