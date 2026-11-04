/** A pending search may never outlive a newer navigation or browser Back. */
export function createBrowseCommitQueue(delay = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null
  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    cancel,
    schedule(commit: () => void) {
      cancel()
      timer = setTimeout(() => { timer = null; commit() }, delay)
    },
  }
}

export interface BrowseScrollSnapshot { key: string; y: number }

function validSnapshot(value: unknown): value is BrowseScrollSnapshot {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<BrowseScrollSnapshot>
  return typeof entry.key === 'string' && entry.key.length <= 2000
    && typeof entry.y === 'number' && Number.isFinite(entry.y) && entry.y >= 0
}

function snapshots(value: unknown): BrowseScrollSnapshot[] {
  // Accept the original single-entry format when upgrading an existing session.
  return (Array.isArray(value) ? value : [value]).filter(validSnapshot)
}

export function rememberedScroll(value: unknown, key: string): number | null {
  return snapshots(value).reverse().find((entry) => entry.key === key)?.y ?? null
}

export function rememberScroll(value: unknown, next: BrowseScrollSnapshot): BrowseScrollSnapshot[] {
  if (!validSnapshot(next)) return snapshots(value).slice(-12)
  return [...snapshots(value).filter((entry) => entry.key !== next.key), next].slice(-12)
}
