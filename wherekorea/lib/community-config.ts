/** Server configuration. Never serialize this object into a client component. */
export function getCommunityConfig(env: Record<string, string | undefined> = process.env) {
  let url = ''
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || ''
  try {
    const parsed = new URL(env.SUPABASE_URL?.trim() || '')
    const hosted = parsed.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) && !parsed.port
    const local = env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
    if ((hosted || local) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash) url = parsed.origin
  } catch { /* Missing or malformed configuration fails closed. */ }
  let validKey = /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)
  if (!validKey && key.split('.').length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
      validKey = payload.role === 'anon' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)
    } catch { /* Service-role/secret keys are deliberately unsupported. */ }
  }
  const configured = Boolean(url && validKey)
  const moderationReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.COMMUNITY_MODERATION_CONTACT?.trim() || '')
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''
  // Fail closed without a real widget key. Provider-side CAPTCHA is a separate
  // launch check; merely supplying this public key does not enable verification.
  const guestEnabled = configured && env.COMMUNITY_GUEST_ENABLED === 'true' && /^0x[A-Za-z0-9_-]{10,}$/.test(siteKey)
  return { configured, guestEnabled, googleEnabled: configured && env.COMMUNITY_GOOGLE_ENABLED === 'true', postingEnabled: configured && moderationReady && env.COMMUNITY_POSTING_ENABLED === 'true', url, key: configured ? key : '' }
}
