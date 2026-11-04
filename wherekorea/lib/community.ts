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

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
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
    const dateValid = isCalendarDate(draft.meetupDate)
    if (!dateValid) errors.meetupDate = 'Choose a valid meetup date.'
    else if (draft.meetupDate < koreaToday(now)) errors.meetupDate = 'Choose today or a later date in Korea.'
    if (!isClockTime(draft.startTime)) errors.startTime = 'Enter a start time in Korea Standard Time.'
    if (!isClockTime(draft.endTime)) errors.endTime = 'Enter an end time in Korea Standard Time.'
    if (isClockTime(draft.startTime) && isClockTime(draft.endTime) && draft.endTime <= draft.startTime) {
      errors.endTime = 'The end time must be later on the same day.'
    }
    if (dateValid && isClockTime(draft.startTime)) {
      const start = new Date(`${draft.meetupDate}T${draft.startTime}:00+09:00`)
      const latest = new Date(now)
      latest.setUTCFullYear(latest.getUTCFullYear() + 1)
      if (start.getTime() <= now.getTime()) errors.startTime = 'Choose a start time that has not passed in Korea.'
      if (start.getTime() > latest.getTime()) errors.meetupDate = 'Choose a date within the next year.'
    }
    if (!/^[1-8]$/.test(draft.places)) errors.places = 'Choose 1 to 8 available places.'
  }
  return errors
}
