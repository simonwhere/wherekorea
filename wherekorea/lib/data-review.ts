import type { Destination } from '../data/types'

export interface DataReviewIssue {
  slug: string
  field: string
  severity: 'error' | 'review'
  code: 'invalid' | 'missing-provenance' | 'review-due'
  message: string
}

function day(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : null
}

/** A maintenance queue, not a claim that old estimates are false or new ones verified. */
export function reviewDestinationData(destinations: Destination[], today: string): DataReviewIssue[] {
  const now = day(today)
  if (now === null) throw new Error('Data review requires a real YYYY-MM-DD date')
  const issues: DataReviewIssue[] = []
  const seen = new Set<string>()
  const slugs = new Set(destinations.map((d) => d.slug))
  for (const d of destinations) {
    const add = (field: string, severity: DataReviewIssue['severity'], code: DataReviewIssue['code'], message: string) => issues.push({slug:d.slug,field,severity,code,message})
    if (seen.has(d.slug)) add('slug', 'error', 'invalid', 'Duplicate destination identity.')
    seen.add(d.slug)
    if (!/^https:\/\//.test(d.image.src) || !d.image.alt.trim()) add('image', 'error', 'invalid', 'Photo needs an HTTPS source and descriptive alternative.')
    if (!d.image.sourceUrl || !d.image.licenseUrl || !d.image.credit) add('image', 'review', 'missing-provenance', 'Record the exact source page, creator and applicable licence; image loading alone is not rights verification.')
    for (const field of ['budget', 'travel_time', 'crowd'] as const) {
      const meta = d.trust?.[field]
      if (!meta) { add(field, 'review', 'missing-provenance', 'Metric provenance is missing.'); continue }
      const reviewed = day(meta.last_verified)
      if (reviewed === null || reviewed > now) { add(field, 'error', 'invalid', 'Review date is invalid or in the future.'); continue }
      // Quarterly price/transport review; twice-yearly editorial crowd review.
      // These are maintenance targets, not freshness guarantees.
      const target = field === 'crowd' ? 180 : 90
      if (now - reviewed > target) add(field, 'review', 'review-due', `Recorded review is ${Math.floor(now-reviewed)} days old; ${target}-day maintenance target exceeded.`)
    }
    if (d.similar_destinations.some((slug) => slug === d.slug || !slugs.has(slug))) add('similar_destinations', 'error', 'invalid', 'Related destinations must exist and exclude the destination itself.')
    for (const field of ['best_months', 'crowd_peak_months'] as const) {
      if (new Set(d[field]).size !== d[field].length || d[field].some((m) => !Number.isInteger(m) || m < 1 || m > 12)) add(field, 'error', 'invalid', 'Months must be distinct integers between 1 and 12.')
    }
  }
  return issues
}
