// Event names from measurement-plan.md
// All 9 primary events are defined here as a typed union.
// Call sites use track() throughout the app — the provider is wired in Phase 5.

export type AnalyticsEvent =
  | 'homepage_view'
  | 'filter_used'
  | 'card_clicked'
  | 'compare_added'
  | 'compare_view_opened'
  | 'detail_page_viewed'
  | 'similar_destination_clicked'
  | 'share_clicked'
  | 'copy_link_clicked'
  | 'destination_saved'

export interface EventProperties {
  filter_used: { tag: string }
  card_clicked: { slug: string }
  compare_added: { slug: string; compare_count: number }
  compare_view_opened: { slugs: string[] }
  detail_page_viewed: { slug: string }
  similar_destination_clicked: { from_slug: string; to_slug: string }
  share_clicked: { slug?: string }
  copy_link_clicked: { slug?: string }
  destination_saved: { slug: string }
  homepage_view: Record<string, never>
}

// Provider: Plausible custom events (script loaded in app/layout.tsx when
// NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set). No-ops silently when absent — S5.
declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void
  }
}

export function track<E extends AnalyticsEvent>(
  event: E,
  properties?: E extends keyof EventProperties ? EventProperties[E] : never
): void {
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    window.plausible(event, properties ? { props: properties } : undefined)
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', event, properties ?? {})
  }
}
