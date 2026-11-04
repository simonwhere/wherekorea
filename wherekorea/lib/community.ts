import { destinations } from '@/data/destinations'
import { withBrowseContext } from '@/lib/browse-state'

export type CommunityType = 'questions' | 'notes' | 'meetups'

export const COMMUNITY_TYPES: readonly {
  value: CommunityType; label: string; action: string; empty: string; description: string
}[] = [
  { value: 'questions', label: 'Questions', action: 'Draft a question', empty: 'No questions here yet.', description: 'Transport, stays and practical questions about a destination.' },
  { value: 'notes', label: 'Trip notes', action: 'Draft a trip note', empty: 'No trip notes here yet.', description: 'What changed, what worked and what to check after a visit.' },
  { value: 'meetups', label: 'Meetups', action: 'Draft a meetup', empty: 'No meetups are open.', description: 'A walk, a meal or a short activity in one destination.' },
]

export const COMMUNITY_DESTINATIONS = destinations.map(({ slug, name }) => ({ slug, name }))

export function isCommunityType(value: unknown): value is CommunityType {
  return value === 'questions' || value === 'notes' || value === 'meetups'
}

export function isCommunityCity(value: unknown): value is string {
  return typeof value === 'string' && COMMUNITY_DESTINATIONS.some(({ slug }) => slug === value)
}

export function parseCommunityState(params: URLSearchParams): { type: CommunityType; city: string } {
  const type = params.get('type')
  const city = params.get('city')
  return { type: isCommunityType(type) ? type : 'questions', city: isCommunityCity(city) ? city : 'all' }
}

/** The community city is independent of the home preview and travel month. */
export function communityHref(path: string, search: string, overrides: { type?: CommunityType; city?: string } = {}): string {
  const source = new URLSearchParams(search)
  // withBrowseContext also rejects external/protocol-relative navigation targets.
  const target = new URL(withBrowseContext(path, search), 'https://wherekorea.local')
  for (const key of ['type', 'city'] as const) {
    if (!target.searchParams.has(key) && source.has(key)) target.searchParams.set(key, source.get(key)!)
  }
  if (overrides.type !== undefined) target.searchParams.set('type', overrides.type)
  if (overrides.city !== undefined) target.searchParams.set('city', overrides.city)
  const state = parseCommunityState(target.searchParams)
  target.searchParams.set('type', state.type)
  target.searchParams.set('city', state.city)
  return `${target.pathname}${target.search}${target.hash}`
}

export interface CommunityDraft {
  id: string
  type: CommunityType
  city: string
  title: string
  body: string
  visitedMonth: string
  meetupDate: string
  startTime: string
  endTime: string
  places: string
  /** Empty until saved; thereafter the storage revision, not an editable field. */
  updatedAt: string
}

export function emptyDraft(type: CommunityType, city: string): CommunityDraft {
  return {
    id: '', type: isCommunityType(type) ? type : 'questions', city: isCommunityCity(city) ? city : '',
    title: '', body: '', visitedMonth: '', meetupDate: '', startTime: '', endTime: '', places: '1', updatedAt: '',
  }
}

export function newDraftId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  // A local identifier only; never a credential or a public authorization token.
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function koreaToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function meetupDateError(value: string, now = new Date()): string {
  if (!isCalendarDate(value)) return 'Choose a valid meetup date.'
  const today = koreaToday(now)
  if (value < today) return 'Choose today or a later date in Korea.'
  const limit = new Date(today + 'T00:00:00Z')
  limit.setUTCDate(limit.getUTCDate() + 365)
  return value > limit.toISOString().slice(0, 10) ? 'Choose a date within the next 365 days.' : ''
}

/** Preview checks only. Passing these checks does not publish or reserve anything. */
export function validateDraft(draft: CommunityDraft, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!isCommunityType(draft.type)) errors.type = 'Choose a post type.'
  if (!isCommunityCity(draft.city)) errors.city = 'Choose a destination.'
  if (draft.title.trim().length < 5) errors.title = 'Add a title of at least 5 characters.'
  else if (draft.title.length > 140) errors.title = 'Keep the title to 140 characters.'
  if (draft.body.trim().length < 10) errors.body = 'Add at least 10 characters of detail.'
  else if (draft.body.length > 3000) errors.body = 'Keep the details to 3,000 characters.'

  if (draft.type === 'notes' && draft.visitedMonth) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(draft.visitedMonth) || draft.visitedMonth < '1900-01') {
      errors.visitedMonth = 'Enter a valid month.'
    } else if (draft.visitedMonth > koreaToday(now).slice(0, 7)) {
      errors.visitedMonth = 'The visit month cannot be in the future.'
    }
  }

  if (draft.type === 'meetups') {
    const message = meetupDateError(draft.meetupDate, now)
    if (message) errors.meetupDate = message
  }
  return errors
}
