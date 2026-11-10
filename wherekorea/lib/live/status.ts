import { getAnalyticsConfig } from '@/lib/analytics-config'
import { canonicalOrigin } from '@/lib/site-config'

/** Safe, serializable availability metadata. Availability is not content verification. */
export type LiveDataFailure =
  | 'http_error' | 'provider_error' | 'invalid_payload' | 'invalid_json'
  | 'network_error' | 'timeout' | 'invalid_items' | 'truncated'

export interface FestivalServiceStatus {
  state: 'available' | 'empty' | 'partial' | 'unavailable'
  reason?: LiveDataFailure
  httpStatus?: number
  reportedItems?: number
  returnedItems?: number
  rejectedItems?: number
}

export interface FestivalDataStatus {
  state: 'unconfigured' | 'unavailable' | 'partial' | 'empty' | 'available'
  /** Evaluation time only. Next's cache may supply a previously fetched response. */
  checkedAt: string
  cacheSeconds: 86400
  upstreamUpdatedAt: null
  scheduleVerified: false
  services: Partial<Record<'english' | 'korean', FestivalServiceStatus>>
  matchedDestinations: number
}

/** Never log errors, provider messages, request URLs, titles, or credentials. */
export function logFestivalFailure(source: 'english' | 'korean', status: FestivalServiceStatus): void {
  if (!status.reason) return
  console.warn('[live-data]', JSON.stringify({
    source: `tourapi_${source}`,
    state: status.state,
    reason: status.reason,
    ...(status.httpStatus === undefined ? {} : { httpStatus: status.httpStatus }),
  }))
}

/** Configuration validity only: no network probes and no environment values. */
export function runtimeReadiness(env: Record<string, string | undefined> = process.env) {
  const configured = (value: string | undefined) => Boolean(value?.trim())
  const analytics = getAnalyticsConfig(env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL, env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN)
  const canonical = canonicalOrigin(env.NEXT_PUBLIC_SITE_URL)
  const canonicalHost = canonical ? new URL(canonical).hostname : ''
  const publicCanonical = Boolean(canonical?.startsWith('https:'))
    && !['localhost', '127.0.0.1', '[::1]'].includes(canonicalHost)
    && !canonicalHost.endsWith('.localhost')
  return {
    kind: 'liveness' as const,
    status: 'responding' as const,
    upstreams: 'not-probed' as const,
    configuration: {
      festivalsConfigured: configured(env.TOUR_API_KEY),
      analyticsConfigured: analytics.mode !== 'disabled',
      walkMetricsConfigured: configured(env.BLOB_STORE_ID) || configured(env.BLOB_READ_WRITE_TOKEN),
      canonicalUrlConfigured: publicCanonical,
    },
    contentVerification: 'not-assessed' as const,
  }
}
