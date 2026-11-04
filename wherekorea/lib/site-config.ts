/** Accept an origin, not a URL containing credentials, a path, or tracking data. */
export function canonicalOrigin(value?: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
    return url.origin
  } catch { return null }
}

export function telegramUrl(value?: string): string {
  try {
    const url = new URL(value?.trim() || 'https://t.me/wherekorea')
    if (url.protocol === 'https:' && url.hostname === 't.me' && !url.username && !url.password) return url.href
  } catch { /* Keep the existing public contact fallback. */ }
  return 'https://t.me/wherekorea'
}
