import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { SCHEMA_VERSION } from '@/lib/sync/migrations'
import {
  CORRUPT_KEY,
  STORAGE_KEY,
  SYNC_KEY,
  VIEWER_KEY,
  loadState,
  loadViewer,
  normalize,
  parseState,
  parseSyncMarks,
  readSyncMarks,
  saveState,
  saveViewer,
  writeSyncMarks,
} from '@/lib/storage'

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
  createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b' },
    new Date(2026, 8, 1, 9),
  )

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

describe('viewer: the device remembers whose phone it is (N15)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the tab’s own choice first, then the device’s answer (localStorage), else a', () => {
    const ls = fakeStorage()
    const ss = fakeStorage()
    vi.stubGlobal('window', { localStorage: ls, sessionStorage: ss })
    expect(loadViewer()).toBe('a')
    ls.setItem(VIEWER_KEY, 'b') // '이 폰은 누구 거예요?' → 민수 (components/onboarding/deviceViewer.ts writes this key)
    expect(loadViewer()).toBe('b')
    saveViewer('a') // ⇄ in this tab is a quick peek: the tab wins while it lives…
    expect(loadViewer()).toBe('a')
    expect(ls.getItem(VIEWER_KEY)).toBe('b') // …and never overwrites the device's answer
    ss.setItem(VIEWER_KEY, 'x')
    expect(loadViewer()).toBe('b') // junk in the tab → the device answer
    ss.removeItem(VIEWER_KEY)
    ls.setItem(VIEWER_KEY, 'zzz')
    expect(loadViewer()).toBe('a')
  })

  it('never throws when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError')
      },
      get sessionStorage(): Storage {
        throw new Error('SecurityError')
      },
    })
    expect(loadViewer()).toBe('a')
  })
})

describe('normalize: fields added for Now 2 ride along', () => {
  it('keeps longCycles, usesLH, lhTestTime, the personal log, cycle notes and 나만 보기 — and drops a bad lhTestTime / hideCover', () => {
    const s = fresh()
    const saved = {
      ...s,
      cycle: { ...s.cycle, longCycles: true },
      settings: {
        ...s.settings,
        usesLH: 'later' as const,
        personal: { a: { hideCover: true, lhTestTime: '21:00' }, b: { lhTestTime: '8pm', discreet: true } },
      },
      personalLog: { b: { '2026-09-01': { feel: 'tired' as const } } },
      cycleNotes: { '2026-08-20': { stillWaiting: '2026-09-01' } },
      diary: [
        {
          id: 'e1',
          date: '2026-09-01',
          author: 'b' as const,
          stage: 'preparing' as const,
          text: '나만',
          createdAt: '2026-09-01T20:00:00+09:00',
          privateTo: 'b' as const,
        },
      ],
    }
    const out = normalize(JSON.parse(JSON.stringify(saved)))
    expect(out.cycle).toEqual({ cycleLength: 28, periodLength: 5, longCycles: true })
    expect(out.settings.usesLH).toBe('later')
    expect(out.settings.personal).toEqual({ a: { hideCover: true, lhTestTime: '21:00' }, b: { discreet: true } })
    expect(out.personalLog).toEqual(saved.personalLog)
    expect(out.cycleNotes).toEqual(saved.cycleNotes)
    expect(out.diary[0]!.privateTo).toBe('b')
    // An unknown usesLH is treated as "not asked".
    expect('usesLH' in normalize({ ...s, settings: { ...s.settings, usesLH: 'maybe' as never } }).settings).toBe(false)
    expect('longCycles' in normalize({ ...s, cycle: { ...s.cycle, longCycles: 'yes' as never } }).cycle).toBe(false)
  })

  it('loads an older save without the fields exactly as before', () => {
    const s = fresh()
    const out = normalize(JSON.parse(JSON.stringify(s)))
    expect(out).toEqual(JSON.parse(JSON.stringify(s)))
    expect('usesLH' in out.settings).toBe(false)
    expect('longCycles' in out.cycle).toBe(false)
    expect('personalLog' in out).toBe(false)
    expect('cycleNotes' in out).toBe(false)
  })
})

describe('normalize: Next B fields (switches · 콕 받기 · 홈 카드 숨김 · 시술 · 휴가 · 관계일)', () => {
  it('keeps the couple-wide switches and per-person prefs only as a yes/no, and lets the new lists ride along', () => {
    const s = fresh()
    const saved = {
      ...s,
      settings: {
        ...s.settings,
        memories: true,
        anniversaryAlerts: false,
        showTryCount: 'yes',
        personal: { a: { acceptNudges: false, homeDiscreet: 'always' }, b: { homeDiscreet: true, acceptNudges: 1 } },
      },
      treatments: [{ id: 't1', kind: 'iui', startDate: '2026-08-10', supported: true }],
      leaveDays: { a: [{ date: '2026-08-11', kind: 'infertility' }] },
      intimacy: { consentAt: '2026-09-01', by: 'b', days: ['2026-09-03'] },
      restCycle: { since: '2026-08-20', reason: 'loss', until: '2026-10-01' },
      positivePending: { since: '2026-09-28', bleedingSince: '2026-09-30' },
    }
    const out = normalize(JSON.parse(JSON.stringify(saved)))
    expect(out.settings.memories).toBe(true)
    expect(out.settings.anniversaryAlerts).toBe(false)
    expect('showTryCount' in out.settings).toBe(false)
    expect(out.settings.personal).toEqual({ a: { acceptNudges: false }, b: { homeDiscreet: true } })
    expect(out.treatments).toEqual(saved.treatments)
    expect(out.leaveDays).toEqual(saved.leaveDays)
    expect(out.intimacy).toEqual(saved.intimacy)
    expect(out.restCycle).toEqual(saved.restCycle)
    expect(out.positivePending).toEqual(saved.positivePending)
  })

  it('never fills the switches in: an older save keeps its exact shape (unset = the default)', () => {
    const s = fresh()
    const out = normalize(JSON.parse(JSON.stringify(s)))
    expect(out).toEqual(JSON.parse(JSON.stringify(s)))
    for (const k of ['memories', 'anniversaryAlerts', 'showTryCount']) expect(k in out.settings).toBe(false)
    for (const k of ['treatments', 'leaveDays', 'intimacy']) expect(k in out).toBe(false)
  })
})

describe('parseState runs the schema migrations (Next A ③ prep)', () => {
  it('a save from before schemaVersion comes up as the current shape with ids, stamps and decisions; a current one is untouched', () => {
    const s = fresh()
    const { schemaVersion: _v, decisions: _d, ...legacy } = s
    const raw = JSON.stringify({
      ...legacy,
      periods: [{ start: '2026-08-20' }],
      notifications: [
        {
          id: 'n1',
          to: 'b',
          kind: 'system',
          title: '',
          body: '',
          createdAt: '2026-08-21T09:00:00+09:00',
          key: 'period-told:2026-08-20:skip',
          read: true,
          dismissed: true,
        },
      ],
    })
    const out = parseState(raw)!
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    expect(out.periods[0]).toEqual({ id: 'period:2026-08-20', start: '2026-08-20', updatedAt: s.createdAt })
    expect(out.decisions).toEqual({ 'period-told:2026-08-20:skip': '2026-08-21' })
    // The stub that only remembered the answer is gone at schema 3 (lib/sync/migrations.ts v2to3).
    expect(out.notifications).toHaveLength(0)
    // The second pass is the identity, byte for byte.
    expect(JSON.stringify(parseState(JSON.stringify(out)))).toBe(JSON.stringify(out))
    // A current save is the identity on the first pass.
    expect(parseState(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
    // normalize alone fills decisions but never the version (the migration must still run).
    const n = normalize(JSON.parse(raw))
    expect(n.decisions).toEqual({})
    expect('schemaVersion' in n).toBe(false)
  })
})

describe('two-tab rebase marks: the sidecar key the store can move AppState.sync to', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('parses only finite numbers, reads {} for junk or nothing, and writes before the state so the other tab sees both', () => {
    expect(parseSyncMarks(null)).toEqual({})
    expect(parseSyncMarks('nope')).toEqual({})
    expect(parseSyncMarks('[1,2]')).toEqual({})
    expect(parseSyncMarks('{"t1":3,"t2":"x","t3":null,"t4":1e400}')).toEqual({ t1: 3 })
    const ls = fakeStorage()
    vi.stubGlobal('window', { localStorage: ls })
    expect(readSyncMarks()).toEqual({})
    expect(writeSyncMarks({ t1: 3 })).toBe(true)
    expect(saveState(fresh())).toBe(true)
    expect(ls.keys()).toEqual([SYNC_KEY, STORAGE_KEY])
    expect(readSyncMarks()).toEqual({ t1: 3 })
    expect(SYNC_KEY.startsWith('dulset:')).toBe(true)
    vi.stubGlobal('window', { localStorage: fakeStorage(true) })
    expect(writeSyncMarks({ t1: 4 })).toBe(false)
    vi.stubGlobal('window', undefined)
    expect(writeSyncMarks({ t1: 4 })).toBe(false)
    expect(readSyncMarks()).toEqual({})
  })
})
