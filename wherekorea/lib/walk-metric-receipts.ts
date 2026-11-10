// A record represents one browser, walk and action. The browser makes a fresh
// random ID for each combination; no visitor identifier is shared across walks.
import { createHash } from 'node:crypto'

export const walkMetricSources = ['save', 'share', 'shared_link'] as const
type Source = typeof walkMetricSources[number]
export type WalkMetric = {
  version: 1
  id: string
  walk: string
  source: Source
  event: 'start' | 'return'
  cohortDay: string
  day: string
}

export function koreaDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export function isCalendarDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const date = new Date(day + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(day)
}

export function validWalkMetric(value: unknown, walkSlugs: ReadonlySet<string>, today: string): value is WalkMetric {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  if (Object.keys(v).length !== 7 || v.version !== 1) return false
  if (typeof v.walk !== 'string' || !walkSlugs.has(v.walk)) return false
  if (typeof v.id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v.id)) return false
  if (!walkMetricSources.some(s => s === v.source)) return false
  if (!isCalendarDay(v.cohortDay) || !isCalendarDay(v.day) || v.day > today) return false
  return (v.event === 'start' && v.cohortDay === v.day)
    || (v.event === 'return' && v.cohortDay < v.day)
}

export function receiptPrefix(qa: boolean) {
  return 'walk-metrics/v1/' + (qa ? 'qa/' : 'live/')
}

export function receiptPath(metric: WalkMetric, qa: boolean) {
  const opaque = createHash('sha256').update([metric.walk, metric.source, metric.id.toLowerCase()].join('/')).digest('hex')
  // All later days for the same action have the same return path. Concurrent
  // writes and offline retries overwrite the same empty marker.
  return receiptPrefix(qa) + [metric.cohortDay, metric.source, metric.walk, opaque, metric.event].join('/')
}

export function summarizeReceipts(paths: Iterable<string>, qa: boolean, today: string) {
  const prefix = receiptPrefix(qa)
  const byDay = new Map<string, Map<Source, { starts: Set<string>; returns: Set<string> }>>()
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue
    const [day, source, slug, opaque, event, extra] = path.slice(prefix.length).split('/')
    if (!isCalendarDay(day) || day > today || !walkMetricSources.some(s => s === source)
      || !slug || !opaque || extra !== undefined || (event !== 'start' && event !== 'return')) continue
    const sourceKey = source as Source
    let dayData = byDay.get(day)
    if (!dayData) { dayData = new Map(); byDay.set(day, dayData) }
    let group = dayData.get(sourceKey)
    if (!group) { group = { starts: new Set(), returns: new Set() }; dayData.set(sourceKey, group) }
    group[event === 'start' ? 'starts' : 'returns'].add(slug + '/' + opaque)
  }
  return [...byDay.keys()].sort().flatMap(day => walkMetricSources.map(source => {
    const group = byDay.get(day)?.get(source)
    const starts = group?.starts.size ?? 0
    const returned = group ? [...group.returns].filter(key => group.starts.has(key)).length : 0
    return { day, source, starts, returned, eligible: day < today }
  }))
}
