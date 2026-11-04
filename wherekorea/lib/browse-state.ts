import { FILTER_TAGS, type FilterTag } from '@/data/types'
import { CATEGORIES, KOREAN_NAMES, type CategoryId } from '@/data/destinations-meta'

/** One shareable source of truth for destination discovery, across all pages. */
export interface BrowseState {
  month: number
  mode: 'plan' | 'now'
  q: string
  filters: FilterTag[]
  category: CategoryId
  excludeSeoul: boolean
  /** Indicative mid-range per-person daily basket, not a total-trip budget. */
  maxDailyKrw?: number
}

export const DAILY_BUDGET_OPTIONS = [100000, 125000, 150000, 200000] as const

export function isDailyBudgetLimit(value: unknown): value is number {
  return typeof value === 'number' && DAILY_BUDGET_OPTIONS.some((limit) => limit === value)
}

const BROWSE_KEYS = ['month', 'mode', 'q', 'filters', 'category', 'excludeSeoul', 'maxDailyKrw'] as const

export function pageSearch(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') params.set(key, value)
    else if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
  }
  return params.toString()
}

export function currentKoreaMonth(): number {
  return Number(new Date().toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' }))
}

function validMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12
}

export function parseBrowseState(params: URLSearchParams, fallbackMonth = currentKoreaMonth()): BrowseState {
  const nowMonth = validMonth(fallbackMonth) ? fallbackMonth : currentKoreaMonth()
  const rawMonth = params.get('month') ?? ''
  const requestedMonth = /^\d{1,2}$/.test(rawMonth) ? Number(rawMonth) : NaN
  const month = validMonth(requestedMonth) ? requestedMonth : nowMonth
  const requestedFilters = params.getAll('filters').flatMap((value) => value.split(','))
  const category = params.get('category')
  const rawBudget = params.get('maxDailyKrw') ?? ''
  const requestedBudget = /^\d+$/.test(rawBudget) ? Number(rawBudget) : NaN

  return {
    month,
    // A month in the future never inherits today's weather. Planning is the
    // default even when someone happens to choose the current calendar month.
    mode: params.get('mode') === 'now' && month === nowMonth ? 'now' : 'plan',
    q: (params.get('q') ?? '').trim().slice(0, 200),
    filters: FILTER_TAGS.filter((tag) => requestedFilters.includes(tag)),
    category: CATEGORIES.some((item) => item.id === category) ? category as CategoryId : 'best-now',
    excludeSeoul: ['1', 'true'].includes(params.get('excludeSeoul') ?? ''),
    ...(isDailyBudgetLimit(requestedBudget) ? { maxDailyKrw: requestedBudget } : {}),
  }
}

export function browseQuery(state: BrowseState): URLSearchParams {
  const params = new URLSearchParams()
  // Keep even the current month explicit: a saved plan must not change month
  // merely because the link is opened later.
  params.set('month', String(validMonth(state.month) ? state.month : currentKoreaMonth()))
  if (state.mode === 'now') params.set('mode', 'now')
  const q = state.q.trim().slice(0, 200)
  if (q) params.set('q', q)
  for (const tag of FILTER_TAGS) {
    if (state.filters.includes(tag)) params.append('filters', tag)
  }
  if (state.category !== 'best-now' && CATEGORIES.some((item) => item.id === state.category)) {
    params.set('category', state.category)
  }
  if (state.excludeSeoul) params.set('excludeSeoul', '1')
  if (isDailyBudgetLimit(state.maxDailyKrw)) params.set('maxDailyKrw', String(state.maxDailyKrw))
  return params
}

function localTarget(path: string): URL {
  // Only local absolute paths are supported, including when read from a URL.
  // Reject protocol-relative URLs and browser-normalized backslashes.
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
  const target = new URL(safe ? path : '/', 'https://wherekorea.local')
  return target.origin === 'https://wherekorea.local' ? target : new URL('/', 'https://wherekorea.local')
}

function localHref(target: URL): string {
  return `${target.pathname}${target.search}${target.hash}`
}

function validPreviewSlug(value: string | null): value is string {
  return value !== null && Object.prototype.hasOwnProperty.call(KOREAN_NAMES, value)
}

export function browseHref(state: BrowseState, path = '/', extras: Record<string, string> = {}): string {
  const target = localTarget(path)
  for (const key of BROWSE_KEYS) target.searchParams.delete(key)
  for (const [key, value] of browseQuery(state)) target.searchParams.append(key, value)
  for (const [key, value] of Object.entries(extras)) target.searchParams.set(key, value)
  return localHref(target)
}

export function withBrowseContext(path: string, search: string): string {
  const source = new URLSearchParams(search)
  const target = localTarget(path)
  // Target query parameters (for example comparison destinations or a preview)
  // take precedence; only the allowed discovery fields travel between pages.
  for (const key of BROWSE_KEYS) {
    if (target.searchParams.has(key)) continue
    for (const value of source.getAll(key)) target.searchParams.append(key, value)
  }
  // `destination` is the homepage preview to restore on return. A detail
  // page's /destination/[slug] path still independently identifies its content.
  // Explicit target previews (including an explicit cleared one) take priority.
  const returnPreview = source.get('destination')
  if (!target.searchParams.has('destination') && validPreviewSlug(returnPreview)) {
    target.searchParams.set('destination', returnPreview)
  }
  const state = parseBrowseState(target.searchParams)
  return browseHref(state, localHref(target))
}

export function homeHrefFromSearch(search: string, state?: BrowseState): string {
  const params = new URLSearchParams(search)
  const destination = params.get('destination')
  const extras = validPreviewSlug(destination) ? { destination } : undefined
  // An explicit state replaces every discovery condition while retaining the
  // current preview. Controls can publish their query before server navigation
  // finishes without inventing another destination-selection state.
  return browseHref(state ?? parseBrowseState(params), '/', extras)
}
