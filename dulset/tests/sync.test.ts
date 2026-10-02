import { describe, expect, it } from 'vitest'
import { baseForUpdate } from '@/lib/logic/sync'

interface S {
  n: number
  note?: string
}

describe('baseForUpdate: what a change builds on', () => {
  it('builds on the stored state while saves succeed (the other tab may have written)', () => {
    const loaded: S = { n: 0 }
    const stored: S = { n: 1, note: 'other tab' }
    expect(baseForUpdate(stored, loaded, loaded)).toBe(stored)
    expect(baseForUpdate(null, loaded, loaded)).toBe(loaded)
    expect(baseForUpdate(null, null, undefined)).toBeNull()
  })

  it('builds on memory after a failed save, so the change that did not save is not lost', () => {
    // A tab's life: load, then two updates while storage refuses every write.
    const loaded: S = { n: 0 }
    let persisted: S | undefined = loaded
    let latest: S = loaded
    const stored = loaded // storage never changes: saves fail
    const save = (): boolean => false

    const update = (fn: (s: S) => S) => {
      const base = baseForUpdate(stored, latest, persisted)!
      const next = fn(base)
      latest = next
      if (save()) persisted = next
      return next
    }
    update((s) => ({ ...s, n: s.n + 1 }))
    const after = update((s) => ({ ...s, note: 'second' }))
    // Both changes survive in memory (stored would have dropped the first).
    expect(after).toEqual({ n: 1, note: 'second' })
    expect(baseForUpdate(stored, latest, persisted)).toBe(latest)
    // Once a save succeeds, storage is the base again.
    persisted = latest
    expect(baseForUpdate(latest, latest, persisted)).toBe(latest)
  })
})
