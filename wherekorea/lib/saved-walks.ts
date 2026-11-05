import { walks, findWalk } from '@/data/walks'

import { SAVED_WALKS_KEY, SAVED_WALKS_EVENT } from '@/lib/saved-walk-events'

export { SAVED_WALKS_KEY, SAVED_WALKS_EVENT, subscribeSavedWalks } from '@/lib/saved-walk-events'

export type SavedWalk = { slug: string; stop: number; savedAt: number }

function keyFor(slug: string): string {
  return `${SAVED_WALKS_KEY}.${slug}`
}

export function readSavedWalk(slug: string): SavedWalk | null {
  const walk = findWalk(slug)
  if (!walk) return null
  const raw = window.localStorage.getItem(keyFor(slug))
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Invalid saved walk')
  const record = value as Partial<SavedWalk>
  if (record.slug !== slug || typeof record.stop !== 'number' || !Number.isInteger(record.stop)
    || record.stop < 1 || record.stop > walk.stops.length
    || typeof record.savedAt !== 'number' || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0) {
    throw new Error('Invalid saved walk')
  }
  return { slug, stop: record.stop, savedAt: record.savedAt }
}

/** Leave malformed records untouched and continue listing the other walks. */
export function readSavedWalks(onReadError?: () => void): SavedWalk[] {
  const entries: SavedWalk[] = []
  for (const walk of walks) {
    try {
      const entry = readSavedWalk(walk.slug)
      if (entry) entries.push(entry)
    } catch (error) {
      if (!onReadError) throw error
      onReadError()
    }
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt)
}

function notifyChange() {
  window.dispatchEvent(new Event(SAVED_WALKS_EVENT))
}

export function saveWalkStop(slug: string, stop: number): void {
  const walk = findWalk(slug)
  if (!walk || !Number.isInteger(stop) || stop < 1 || stop > walk.stops.length) {
    throw new Error('Choose a stop on this walk.')
  }
  const value: SavedWalk = { slug, stop, savedAt: Date.now() }
  window.localStorage.setItem(keyFor(slug), JSON.stringify(value))
  notifyChange()
}

/** Changing a stop only moves an existing bookmark, never creates one. */
export function updateSavedWalkStop(slug: string, stop: number): boolean {
  if (!readSavedWalk(slug)) return false
  saveWalkStop(slug, stop)
  return true
}

export function removeSavedWalk(slug: string): void {
  if (!findWalk(slug)) throw new Error('Unknown walk.')
  window.localStorage.removeItem(keyFor(slug))
  notifyChange()
}
