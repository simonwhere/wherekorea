// Shared with the offline reader. Each walk has its own localStorage record.
export const SAVED_WALKS_KEY = 'wherekorea.saved-walks.v1'
export const SAVED_WALKS_EVENT = 'wherekorea:saved-walks-changed'

export function subscribeSavedWalks(refresh: () => void): () => void {
  function storageChanged(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(SAVED_WALKS_KEY + '.')) refresh()
  }
  window.addEventListener('storage', storageChanged)
  window.addEventListener(SAVED_WALKS_EVENT, refresh)
  window.addEventListener('pageshow', refresh)
  return () => {
    window.removeEventListener('storage', storageChanged)
    window.removeEventListener(SAVED_WALKS_EVENT, refresh)
    window.removeEventListener('pageshow', refresh)
  }
}
