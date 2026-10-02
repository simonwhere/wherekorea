import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { CORRUPT_KEY, STORAGE_KEY, loadState, saveState } from '@/lib/storage'

/** A localStorage stand-in; `failing` makes every write throw like a full quota does. */
function fakeStorage(failing = false) {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failing) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    keys: () => [...map.keys()],
  }
}

const fresh = () =>
  createInitialState({ me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b' }, new Date(2026, 8, 1, 9))

describe('storage: the one corrupt copy', () => {
  let ls: ReturnType<typeof fakeStorage>
  beforeEach(() => {
    ls = fakeStorage()
    vi.stubGlobal('window', { localStorage: ls })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the first unreadable state once, however many times it is loaded', () => {
    ls.setItem(STORAGE_KEY, '{"version":1,"stage":"preparing","broken":true')
    expect(loadState()).toBeNull()
    expect(loadState()).toBeNull()
    expect(loadState()).toBeNull()
    expect(ls.keys().filter((k) => k.startsWith(`${STORAGE_KEY}:corrupt`))).toEqual([CORRUPT_KEY])
    expect(ls.getItem(CORRUPT_KEY)).toBe('{"version":1,"stage":"preparing","broken":true')
    // A later, different broken blob never overwrites the first copy.
    ls.setItem(STORAGE_KEY, 'not json at all')
    expect(loadState()).toBeNull()
    expect(ls.getItem(CORRUPT_KEY)).toBe('{"version":1,"stage":"preparing","broken":true')
  })

  it('a good save clears the copy; a readable state keeps none', () => {
    ls.setItem(STORAGE_KEY, 'nope')
    loadState()
    expect(ls.getItem(CORRUPT_KEY)).toBe('nope')
    expect(saveState(fresh())).toBe(true)
    expect(ls.getItem(CORRUPT_KEY)).toBeNull()
    expect(loadState()?.couple.members[0].name).toBe('민수')
    expect(ls.keys().some((k) => k.includes('corrupt'))).toBe(false)
  })

  it('reports a failed save instead of throwing (quota, blocked storage)', () => {
    const full = fakeStorage(true)
    vi.stubGlobal('window', { localStorage: full })
    expect(saveState(fresh())).toBe(false)
    expect(full.getItem(STORAGE_KEY)).toBeNull()
    // No storage at all (SSR, a denied origin): also false, never a throw.
    vi.stubGlobal('window', undefined)
    expect(saveState(fresh())).toBe(false)
    expect(loadState()).toBeNull()
  })
})
