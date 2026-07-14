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

// Convert every ₩ amount inside a free-form string to USD:
// '~₩60,000–80,000/day' → '~$45–60/day' · '₩300,000+/day' → '$215+/day'
export function usdifyRange(s: string): string | null {
  if (!s.includes('₩')) return null
  const out = s.replace(/₩([\d,]+)/g, (_, num: string) => {
    const krw = Number(num.replace(/,/g, ''))
    if (!Number.isFinite(krw) || krw <= 0) return `₩${num}`
    const usd = Math.max(5, Math.round(krw / KRW_PER_USD / 5) * 5)
    return `$${usd}`
  })
  return out === s ? null : out
}
