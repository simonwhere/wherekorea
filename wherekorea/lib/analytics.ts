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

export interface EventProperties {
  filter_used: { tag: string }
  card_clicked: { slug: string }
  compare_added: { slug: string; compare_count: number }
  compare_view_opened: { slugs: string[] }
  detail_page_viewed: { slug: string }
  similar_destination_clicked: { from_slug: string; to_slug: string }
  share_clicked: { slug?: string }
  copy_link_clicked: { slug?: string }
  homepage_view: Record<string, never>
}

// Stub — replace body with real provider call in Phase 5
export function track<E extends AnalyticsEvent>(
  event: E,
  properties?: E extends keyof EventProperties ? EventProperties[E] : never
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', event, properties ?? {})
  }
}
