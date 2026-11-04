import type { MetricMeta } from '../data/types'

export const BUDGET_ASSUMPTIONS = 'Approximate cost per person, per day. Includes a mid-range room shared by two, meals, local transport and admission fees. Intercity travel, flights and shopping are extra. A room for one costs more per person.'
export const TRAVEL_SCOPE = 'Approximate travel times for the routes shown. Station access, waiting and local connections take additional time unless listed.'
export const CROWD_SAMPLE_NOTE = 'Visitor data: May 2025–Apr 2026, sampled on the second Wednesday and Saturday each month. Compared with the same destination’s average, not other cities. Not a live count.'

/** Describe the metadata we actually store; never manufacture a verification date. */
export function metricEvidence(meta?: MetricMeta): string {
  if (!meta) return 'Last checked: not recorded.'
  const source = { official: 'Official information', estimate: 'Approximate figure', api: 'Published data', seed: 'General guide' }[meta.source]
  const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.last_verified)
    && !Number.isNaN(Date.parse(meta.last_verified))
    && new Date(meta.last_verified).toISOString().slice(0, 10) === meta.last_verified
    ? `last checked ${meta.last_verified}` : 'last checked: not recorded'
  return `${source} · ${date}.`
}
