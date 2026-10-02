import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  canSeeIntimacy,
  cleanIntimacy,
  giveIntimacyConsent,
  hasIntimacyConsent,
  intimacyDays,
  intimacyHolder,
  isIntimacyDay,
  revokeIntimacy,
  stripIntimacy,
  toggleIntimacyDay,
} from '@/lib/logic/intimacy'
import { addEntry } from '@/lib/logic/diary'
import { buildDiaryHtml } from '@/lib/logic/diaryExport'
import { defaultLogKind } from '@/lib/logic/logs'
import { stateForViewer } from '@/lib/logic/personalLog'
import { sanitizeBackup, setCycleOwner } from '@/lib/logic/settings'
import { albumFeed, albumGroups, chapterContext, filterStory } from '@/lib/logic/usView'
import { parseState } from '@/lib/storage'
import type { AppState, MemberId } from '@/lib/types'

const TODAY = '2026-10-02'

// 'a' = 민수 (partner), 'b' = 지은 (cycle owner).
function fresh(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart: '2026-09-21' },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

describe('intimacy: consent', () => {
  it('only the cycle owner can consent; once; with a real date', () => {
    const s = fresh()
    expect(hasIntimacyConsent(s)).toBe(false)
    expect(giveIntimacyConsent(s, 'a', TODAY)).toBe(s) // the partner can't
    expect(giveIntimacyConsent(s, 'b', 'nope')).toBe(s)
    const yes = giveIntimacyConsent(s, 'b', TODAY)
    expect(yes.intimacy).toEqual({ consentAt: TODAY, by: 'b', days: [] })
    expect(intimacyHolder(yes)).toBe('b')
    expect(hasIntimacyConsent(yes)).toBe(true)
    expect(giveIntimacyConsent(yes, 'b', '2026-10-03')).toBe(yes) // already given
  })

  it('revoking deletes the record and every day in it', () => {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-28')
    s = toggleIntimacyDay(s, 'b', '2026-09-30')
    expect(intimacyDays(s, 'b')).toHaveLength(2)
    const gone = revokeIntimacy(s)
    expect('intimacy' in gone).toBe(false)
    expect(intimacyDays(gone, 'b')).toEqual([])
    expect(JSON.stringify(gone)).not.toContain('2026-09-28')
    expect(revokeIntimacy(gone)).toBe(gone)
  })
})

describe('intimacy: days', () => {
  it('the holder toggles; sorted, unique; a bad or future date is a no-op', () => {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-30', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-28', TODAY)
    expect(intimacyDays(s, 'b')).toEqual(['2026-09-28', '2026-09-30'])
    expect(isIntimacyDay(s, 'b', '2026-09-30')).toBe(true)
    s = toggleIntimacyDay(s, 'b', '2026-09-30', TODAY)
    expect(intimacyDays(s, 'b')).toEqual(['2026-09-28'])
    expect(toggleIntimacyDay(s, 'b', '2026-10-03', TODAY)).toBe(s) // future
    expect(toggleIntimacyDay(s, 'b', '2026-13-01')).toBe(s)
    // Without `today` the future isn't checked (a sheet that already validated it).
    expect(intimacyDays(toggleIntimacyDay(s, 'b', '2026-10-03'), 'b')).toContain('2026-10-03')
  })

  it('nobody but the holder can toggle — not the partner, not even the holder after handing the cycle over', () => {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    expect(toggleIntimacyDay(s, 'a', '2026-09-30')).toBe(s)
    const none = fresh()
    expect(toggleIntimacyDay(none, 'b', '2026-09-30')).toBe(none) // no consent → no-op
    const handed = setCycleOwner(s, 'a')
    expect(toggleIntimacyDay(handed, 'b', '2026-09-30')).toBe(handed)
    expect(toggleIntimacyDay(handed, 'a', '2026-09-30')).toBe(handed)
    // The record is still the old holder's: only they see it, and revoke still works.
    expect(intimacyDays(handed, 'b')).toEqual([])
    expect(canSeeIntimacy(handed, 'b')).toBe(true)
    s = revokeIntimacy(handed)
    expect('intimacy' in s).toBe(false)
  })
})

describe('intimacy: the partner never sees it', () => {
  it('intimacyDays / canSeeIntimacy / isIntimacyDay are empty or false for anyone but the holder', () => {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-28')
    expect(intimacyDays(s, 'a')).toEqual([])
    expect(canSeeIntimacy(s, 'a')).toBe(false)
    expect(isIntimacyDay(s, 'a', '2026-09-28')).toBe(false)
    expect(intimacyDays(s, 'b')).toEqual(['2026-09-28'])
    // The holder's copy is a copy.
    intimacyDays(s, 'b').push('2026-01-01')
    expect(s.intimacy!.days).toEqual(['2026-09-28'])
  })

  it('stripIntimacy removes the whole record from what the partner’s phone may hold, keeps it for the holder', () => {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-28')
    const his = stripIntimacy(s, 'a')
    expect('intimacy' in his).toBe(false)
    expect(JSON.stringify(his)).not.toContain('consentAt')
    expect(JSON.stringify(his)).not.toContain('2026-09-28')
    expect(stripIntimacy(s, 'b')).toBe(s)
    const none = fresh()
    expect(stripIntimacy(none, 'a')).toBe(none)
    // stateForViewer (lib/logic/personalLog.ts) is the gate every shared state goes through:
    // it must apply the same rule (needs_from_others until it does).
    const shared = stateForViewer(s, 'a')
    const stripped = stripIntimacy(shared, 'a')
    expect('intimacy' in stripped).toBe(false)
    // A backup and a reload keep the holder's record (it is their own data).
    expect(parseState(JSON.stringify(s))!.intimacy).toEqual(s.intimacy)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(s)))!.intimacy).toEqual(s.intimacy)
  })
})

describe('intimacy: cleaning (a backup, an older save)', () => {
  it('needs a real consent date and a holder a|b; days are real, unique, sorted; else dropped', () => {
    expect(cleanIntimacy(undefined)).toBeUndefined()
    expect(cleanIntimacy({ by: 'b', days: ['2026-09-28'] })).toBeUndefined() // no consent → nothing
    expect(cleanIntimacy({ consentAt: '2026-10-02', by: 'c', days: [] })).toBeUndefined()
    expect(cleanIntimacy({ consentAt: '2026-10-02', by: 'b' })).toEqual({ consentAt: '2026-10-02', by: 'b', days: [] })
    expect(cleanIntimacy({ consentAt: '2026-10-02', by: 'b', days: ['2026-09-30', 'x', '2026-09-28', '2026-09-30', 7] })).toEqual({
      consentAt: '2026-10-02',
      by: 'b',
      days: ['2026-09-28', '2026-09-30'],
    })
    const s = { ...fresh(), intimacy: { by: 'b', days: ['2026-09-28'] } } as unknown as AppState
    expect('intimacy' in sanitizeBackup(JSON.parse(JSON.stringify(s)))!).toBe(false)
  })
})

// ── Next B (album-settings-ui): the record never reaches the partner anywhere ──

/** A small deterministic PRNG, so a failing case can be replayed from its seed. */
function rng(seed: number): () => number {
  let x = seed >>> 0 || 1
  return () => {
    x ^= x << 13
    x >>>= 0
    x ^= x >> 17
    x ^= x << 5
    x >>>= 0
    return x / 0x100000000
  }
}

/** Days in 2026-07 … 2026-10 that no diary entry below uses (so a leak is unmistakable). */
const DAY_POOL = ['2026-07-03', '2026-07-19', '2026-08-06', '2026-08-23', '2026-09-04', '2026-09-27', '2026-10-01']

function withHolder(holder: MemberId): AppState {
  const base = fresh()
  return holder === 'b' ? base : setCycleOwner(base, 'a')
}

describe('intimacy: viewer property — whoever looks, only the holder ever gets the days', () => {
  it('stateForViewer(other) carries no trace; stateForViewer(holder) keeps the record exactly', () => {
    const random = rng(20261002)
    for (let round = 0; round < 200; round++) {
      const holder: MemberId = random() < 0.5 ? 'a' : 'b'
      const other: MemberId = holder === 'a' ? 'b' : 'a'
      let s = giveIntimacyConsent(withHolder(holder), holder, TODAY)
      const picked = DAY_POOL.filter(() => random() < 0.5)
      for (const d of picked) s = toggleIntimacyDay(s, holder, d)
      expect(intimacyDays(s, holder)).toEqual([...picked].sort())

      const theirs = stateForViewer(s, other)
      const json = JSON.stringify(theirs)
      expect('intimacy' in theirs).toBe(false)
      expect(json).not.toContain('intimacy')
      expect(json).not.toContain('consentAt')
      for (const d of picked) expect(json).not.toContain(d)
      expect(intimacyDays(theirs, other)).toEqual([])
      expect(intimacyDays(theirs, holder)).toEqual([]) // stripped: not even the holder's name brings it back
      expect(canSeeIntimacy(theirs, other)).toBe(false)

      const own = stateForViewer(s, holder)
      expect(own.intimacy).toEqual(s.intimacy)
      // Stripping is idempotent and never touches the rest of the state.
      expect(stripIntimacy(theirs, other)).toBe(theirs)
      const { intimacy: _a, ...restOwn } = own
      const { intimacy: _b, ...restTheirs } = stripIntimacy(own, other)
      expect(restTheirs).toEqual(restOwn)
    }
  })

  it('the partner can never create, see or toggle it, whatever they try', () => {
    const random = rng(7)
    for (let round = 0; round < 50; round++) {
      const holder: MemberId = random() < 0.5 ? 'a' : 'b'
      const other: MemberId = holder === 'a' ? 'b' : 'a'
      const none = withHolder(holder)
      expect(giveIntimacyConsent(none, other, TODAY)).toBe(none)
      let s = giveIntimacyConsent(none, holder, TODAY)
      const d = DAY_POOL[Math.floor(random() * DAY_POOL.length)]!
      s = toggleIntimacyDay(s, holder, d)
      expect(toggleIntimacyDay(s, other, d)).toBe(s)
      expect(toggleIntimacyDay(s, other, '2026-09-01')).toBe(s)
      expect(isIntimacyDay(s, other, d)).toBe(false)
      expect(intimacyDays(s, other)).toEqual([])
    }
  })
})

describe('intimacy: never in an export, the album or the story', () => {
  function withRecord(): AppState {
    let s = giveIntimacyConsent(fresh(), 'b', TODAY)
    s = toggleIntimacyDay(s, 'b', '2026-09-27')
    s = toggleIntimacyDay(s, 'b', '2026-08-23')
    s = addEntry(s, { date: '2026-09-12', author: 'b', text: '아침 산책', photoId: 'p1' }, '2026-09-12T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-20', author: 'a', text: '저녁', mood: '😊' }, '2026-09-20T20:00:00+09:00')
    return s
  }

  it('the HTML story export (diaryExport) never contains the days or the record, for either reader', () => {
    const s = withRecord()
    for (const viewer of ['a', 'b'] as const) {
      const html = buildDiaryHtml({
        entries: s.diary,
        viewer,
        members: s.couple.members,
        title: '우리 이야기',
        photos: {},
        generatedOn: TODAY,
      })
      expect(html).not.toContain('2026-09-27')
      expect(html).not.toContain('2026-08-23')
      expect(html).not.toContain('intimacy')
      expect(html).not.toContain('관계')
      expect(html).toContain('아침 산책') // the diary itself is there
    }
  })

  it('usView (앨범 feed, album groups, story filter) is built from the diary alone', () => {
    const s = withRecord()
    const ctx = chapterContext(s)
    for (const viewer of ['a', 'b'] as const) {
      const outputs = [
        albumFeed(s.diary, viewer),
        albumGroups(s.diary, viewer),
        filterStory(s.diary, ctx, { chapter: 'all', author: 'all', viewer }),
      ]
      for (const out of outputs) {
        const json = JSON.stringify(out)
        expect(json).not.toContain('2026-09-27')
        expect(json).not.toContain('2026-08-23')
        expect(json).not.toContain('intimacy')
        expect(json).not.toContain('consentAt')
      }
    }
  })

  it("is never the sheet's default chip — it is only ever picked on purpose", () => {
    const s = withRecord()
    for (const date of ['2026-09-21', '2026-09-27', '2026-10-01', TODAY]) {
      expect(defaultLogKind(s, date, TODAY)).not.toBe('intimacy')
    }
  })
})
