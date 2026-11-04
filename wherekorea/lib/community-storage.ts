import { isCommunityCity, isCommunityType, type CommunityDraft } from '@/lib/community'

export const COMMUNITY_DRAFTS_KEY = 'wk_community_drafts_v1'
export const COMMUNITY_DRAFTS_EVENT = 'wk:community-drafts-changed'
export const MAX_COMMUNITY_DRAFTS = 20

export interface DraftLoadResult { drafts: CommunityDraft[]; error: string | null }
export interface DraftWriteResult extends DraftLoadResult { ok: boolean }

const fieldLimits = {
  id: 80, city: 40, title: 140, body: 3000, visitedMonth: 7,
  meetupDate: 10, startTime: 5, endTime: 5, places: 2, updatedAt: 30,
} as const

function validRevision(value: string): boolean {
  return value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
}

/** Drafts can be incomplete but never unbounded or mixed with arbitrary data. */
function validDraft(value: unknown, saved = false): value is CommunityDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const draft = value as Record<string, unknown>
  if (Object.keys(draft).length !== Object.keys(fieldLimits).length + 1 || !isCommunityType(draft.type)) return false
  for (const [field, limit] of Object.entries(fieldLimits)) {
    if (typeof draft[field] !== 'string' || draft[field].length > limit) return false
  }
  return /^[a-zA-Z0-9_-]{1,80}$/.test(draft.id as string)
    && (draft.city === '' || isCommunityCity(draft.city))
    && validRevision(draft.updatedAt as string)
    && (!saved || draft.updatedAt !== '')
}

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function read(storage: Storage): DraftLoadResult {
  const raw = storage.getItem(COMMUNITY_DRAFTS_KEY)
  if (raw === null) return { drafts: [], error: null }
  try {
    // Leave room for JSON escaping (up to six characters for a control byte).
    if (raw.length > 500000) throw new Error('Too large')
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid envelope')
    const record = value as Record<string, unknown>
    if (Object.keys(record).length !== 2 || record.version !== 1 || !Array.isArray(record.drafts)
      || record.drafts.length > MAX_COMMUNITY_DRAFTS || !record.drafts.every((draft) => validDraft(draft, true))) throw new Error('Invalid drafts')
    const drafts = record.drafts as CommunityDraft[]
    if (new Set(drafts.map(({ id }) => id)).size !== drafts.length) throw new Error('Duplicate ids')
    return { drafts: [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), error: null }
  } catch {
    return { drafts: [], error: 'Saved drafts could not be read. They have not been changed. Try another browser or keep a copy of your text.' }
  }
}

export function loadDrafts(): DraftLoadResult {
  try {
    const storage = browserStorage()
    return storage ? read(storage) : { drafts: [], error: 'Draft storage is not available in this browser.' }
  } catch {
    return { drafts: [], error: 'Draft storage is blocked in this browser. Keep a copy of your text.' }
  }
}

function notify(): void {
  // Failure to notify must not turn a successful local write into a failed save.
  try { window.dispatchEvent(new Event(COMMUNITY_DRAFTS_EVENT)) } catch { /* optional notification */ }
}

export function saveDraft(draft: CommunityDraft): DraftWriteResult {
  let current: DraftLoadResult = { drafts: [], error: null }
  try {
    const storage = browserStorage()
    if (!storage) return { ...current, ok: false, error: 'Draft storage is not available in this browser.' }
    current = read(storage)
    if (current.error) return { ...current, ok: false }
    if (!validDraft(draft)) return { ...current, ok: false, error: 'This draft could not be saved. Check the text lengths and destination.' }
    const existing = current.drafts.find(({ id }) => id === draft.id)
    if (existing ? existing.updatedAt !== draft.updatedAt : draft.updatedAt !== '') {
      return { ...current, ok: false, error: 'This draft changed or was deleted in another tab. Reopen the saved draft before saving again; keep a copy of your changes.' }
    }
    if (!existing && current.drafts.length >= MAX_COMMUNITY_DRAFTS) {
      return { ...current, ok: false, error: 'You have 20 saved drafts. Delete a draft before saving a new one.' }
    }
    // Monotonic revisions detect stale saves even when two edits occur in one millisecond.
    const updatedAt = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0)).toISOString()
    const saved = { ...draft, updatedAt }
    const drafts = [saved, ...current.drafts.filter(({ id }) => id !== draft.id)]
    storage.setItem(COMMUNITY_DRAFTS_KEY, JSON.stringify({ version: 1, drafts }))
    notify()
    return { drafts, error: null, ok: true }
  } catch {
    return { ...current, ok: false, error: 'The draft could not be saved on this device. Storage may be full or blocked. Keep a copy of your text.' }
  }
}

export function deleteDraft(id: string, expectedUpdatedAt?: string): DraftWriteResult {
  let current: DraftLoadResult = { drafts: [], error: null }
  try {
    const storage = browserStorage()
    if (!storage) return { ...current, ok: false, error: 'Draft storage is not available in this browser.' }
    current = read(storage)
    if (current.error) return { ...current, ok: false }
    const existing = current.drafts.find((draft) => draft.id === id)
    if (existing && existing.updatedAt !== expectedUpdatedAt) {
      return { ...current, ok: false, error: 'This draft changed in another tab. Reopen the saved draft before deleting it.' }
    }
    const drafts = current.drafts.filter((draft) => draft.id !== id)
    if (drafts.length === current.drafts.length) return { ...current, ok: true }
    storage.setItem(COMMUNITY_DRAFTS_KEY, JSON.stringify({ version: 1, drafts }))
    notify()
    return { drafts, error: null, ok: true }
  } catch {
    return { ...current, ok: false, error: 'The draft could not be deleted on this device. Storage may be blocked.' }
  }
}
