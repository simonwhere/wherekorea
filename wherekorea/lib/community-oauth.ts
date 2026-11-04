/** Shared, credential-free helpers for the OAuth handoff. */
export const COMMUNITY_OAUTH_COOKIE = 'wk-community-oauth'
export const COMMUNITY_OAUTH_TTL_SECONDS = 600

/** Only local community routes and known context keys can survive a sign-in redirect. */
export function accountReturnPath(value: string | null, fallback = '/community'): string {
  if (!value || value.length > 3000 || !value.startsWith('/community') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://wherekorea.local')
    if (url.origin !== 'https://wherekorea.local' || !/^\/community(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(url.pathname) || url.pathname === '/community/account') return fallback
    const allowed = new Set(['type', 'city', 'draft', 'review', 'destination', 'month', 'mode', 'q', 'filters', 'category', 'excludeSeoul', 'maxDailyKrw', 'from'])
    for (const key of Array.from(url.searchParams.keys())) if (!allowed.has(key)) url.searchParams.delete(key)
    if (url.searchParams.get('review') !== '1') url.searchParams.delete('review')
    return `${url.pathname}${url.search}`
  } catch { return fallback }
}

export function communityOAuthOrigin(requestUrl: string, env: Record<string, string | undefined> = process.env): string | null {
  try {
    const url = new URL(env.NODE_ENV === 'production' ? env.NEXT_PUBLIC_SITE_URL || '' : requestUrl)
    const local = ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null
    return url.origin
  } catch { return null }
}

export function readCommunityOAuthState(raw: string | undefined, now = Date.now()): { nonce: string; returnTo: string; expiresAt: number } | null {
  if (!raw || raw.length > 5000) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || typeof value.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(value.nonce) || typeof value.returnTo !== 'string' || !Number.isFinite(value.expiresAt) || value.expiresAt <= now || value.expiresAt > now + COMMUNITY_OAUTH_TTL_SECONDS * 1000) return null
    return { nonce: value.nonce, returnTo: accountReturnPath(value.returnTo), expiresAt: value.expiresAt }
  } catch { return null }
}

/** The auth service URL is never a caller-selected external redirect. */
export function isCommunityOAuthUrl(value: unknown, providerUrl: string): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.origin === providerUrl && url.pathname === '/auth/v1/authorize' && !url.username && !url.password && !url.hash && url.searchParams.get('provider') === 'google'
  } catch { return false }
}

export function communityAccountHandoff(returnTo: string, failed = false): string {
  const target = accountReturnPath(returnTo)
  const params = new URLSearchParams(new URL(target, 'https://wherekorea.local').search)
  params.delete('draft'); params.delete('review')
  params.set('returnTo', target)
  if (failed) params.set('signIn', 'retry')
  return `/community/account?${params}`
}
