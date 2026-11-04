import type { MetadataRoute } from 'next'
import { absUrl } from '@/lib/site'

// S1 — everything public is crawlable, including AI crawlers (we want to be cited: GEO).
// /saved is per-device state; /api is machine output.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/saved', '/community/new', '/community/drafts', '/community/account', '/community/moderation', '/community/questions/', '/community/mine', '/community/notifications'] },
      { userAgent: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Google-Extended'], allow: '/', disallow: ['/api/', '/saved', '/community/new', '/community/drafts', '/community/account', '/community/moderation', '/community/questions/', '/community/mine', '/community/notifications'] },
    ],
    sitemap: absUrl('/sitemap.xml'),
  }
}
