import type { MetadataRoute } from 'next'
import { destinations } from '@/data/destinations'
import { arrivalCards } from '@/data/arrival'
import { arrivalPath } from '@/lib/arrival-routes'
import { absUrl } from '@/lib/site'
import { COMMUNITY_POSTS } from '@/data/community-posts'

// S1 — static routes + one entry per destination. lastModified = latest trust verification date.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const statics: MetadataRoute.Sitemap = [
    { url: absUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absUrl('/when-to-go'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: absUrl('/compare'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: absUrl('/community'), changeFrequency: 'weekly', priority: 0.5 },
    { url: absUrl('/community/guidelines'), changeFrequency: 'monthly', priority: 0.3 },
  ]
  const dests: MetadataRoute.Sitemap = destinations.map((d) => {
    const dates = [d.trust?.budget?.last_verified, d.trust?.crowd?.last_verified, d.trust?.travel_time?.last_verified]
      .filter((x): x is string => !!x)
      .sort()
    return {
      url: absUrl(`/destination/${d.slug}`),
      lastModified: dates.length ? new Date(dates[dates.length - 1]) : now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }
  })
  const community: MetadataRoute.Sitemap = COMMUNITY_POSTS.map(post => ({ url: absUrl(`/community/posts/${post.id}`), lastModified: new Date(post.publishedAt), changeFrequency: 'monthly', priority: 0.4 }))
  return [...statics, { url: absUrl('/from-seoul'), changeFrequency: 'monthly' }, ...arrivalCards.map(card => ({ url: absUrl(arrivalPath(card.slug)), lastModified: new Date(card.checked) })), ...dests, ...community]
}
