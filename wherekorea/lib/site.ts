// Brand & site constants — single place to change when the brand/domain changes.
import { canonicalOrigin, telegramUrl } from './site-config'

export const SITE_NAME = 'WhereKorea'
export const SITE_TAGLINE = 'Choose the next stop on your Korea trip.'
export const SITE_DESCRIPTION =
  'Explore 15 Korean destinations. Compare sights, local food, recommended stays, travel times and approximate daily costs.'

// Canonical origin for sitemap/OG/canonical URLs. Set NEXT_PUBLIC_SITE_URL at deploy time.
export const SITE_URL = canonicalOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? 'https://wherekorea.vercel.app'

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined
export const TELEGRAM_URL = telegramUrl(process.env.NEXT_PUBLIC_TELEGRAM_URL)

export function absUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
