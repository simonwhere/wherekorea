// Static approximate FX for display context only — not a live rate.
// Basis noted for trust; refresh quarterly (see docs/data-policy.md).
export const KRW_PER_USD = 1380 // approx, 2026-07 basis

// '₩145k' → '$105'  (returns null if the string isn't the ₩###k shape)
export function usdApprox(krwK: string): string | null {
  const m = krwK.match(/^₩(\d+(?:\.\d+)?)k$/)
  if (!m) return null
  const krw = parseFloat(m[1]) * 1000
  const usd = Math.round(krw / KRW_PER_USD / 5) * 5 // round to $5 — it's an approximation
  return `$${usd}`
}
