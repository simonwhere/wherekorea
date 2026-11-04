// Event names from measurement-plan.md
// Typed product events. Collection requires the configured provider below.

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
  | 'month_selected'
  | 'planning_mode_changed'
  | 'decision_recorded'
  | 'daily_budget_changed'
  | 'community_opened'
  | 'community_type_changed'
  | 'community_draft_saved'

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
  // Explicit mode, not an inference from choosing the current calendar month.
  month_selected: { month: number; is_now: boolean }
  planning_mode_changed: { mode: 'plan' | 'now'; month: number }
  decision_recorded: { outcome: 'chosen' | 'shortlisted' | 'need_more_info'; slug?: string; month: number; mode: 'plan' | 'now' }
  homepage_view: Record<string, never>
  daily_budget_changed: { max_daily_krw: number | 'any' }
  community_opened: { source: 'navigation' | 'destination' | 'preview'; city: string }
  community_type_changed: { type: 'questions' | 'notes' | 'meetups' }
  community_draft_saved: { type: 'questions' | 'notes' | 'meetups'; city: string }
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
    // Analytics must never prevent a filter, comparison or choice from working.
    try { window.plausible(event, properties ? { props: properties } : undefined) }
    catch { /* Provider failure is not product failure; no sensitive payload logging. */ }
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', event, properties ?? {})
  }
}
