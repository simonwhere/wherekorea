import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addEntry } from '@/lib/logic/diary'
import {
  FEEL_LABEL,
  PERSONAL_FEELS,
  PERSONAL_NOTE_MAX,
  canSeeEntry,
  cleanPersonalLog,
  countFeels,
  lastCycleFeels,
  personalDay,
  personalDays,
  setEntryPrivacy,
  setFeel,
  setPrivateNote,
  stateForViewer,
  visibleEntries,
} from '@/lib/logic/personalLog'
import { sanitizeBackup } from '@/lib/logic/settings'
import { parseState } from '@/lib/storage'
import type { AppState } from '@/lib/types'

const TODAY = '2026-10-02'

// 'a' = 민수, 'b' = 지은 (tracks the cycle).
function fresh(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-21',
    },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

describe('setFeel / setPrivateNote', () => {
  it('stores one member’s own day and leaves the other member untouched', () => {
    const s = setFeel(fresh(), 'b', TODAY, 'tired')
    expect(s.personalLog).toEqual({ b: { [TODAY]: { feel: 'tired' } } })
    expect(personalDay(s, 'b', TODAY)).toEqual({ feel: 'tired' })
    expect(personalDay(s, 'a', TODAY)).toBeUndefined()
    // Pure: the input state is not changed.
    expect(fresh().personalLog).toBeUndefined()
  })

  it('replaces a feel, keeps the note, and clears to no empty containers', () => {
    let s = setFeel(fresh(), 'b', TODAY, 'tired')
    s = setPrivateNote(s, 'b', TODAY, '  오늘은 좀 피곤해요  ')
    s = setFeel(s, 'b', TODAY, 'breast')
    expect(s.personalLog).toEqual({ b: { [TODAY]: { feel: 'breast', note: '오늘은 좀 피곤해요' } } })
    s = setFeel(s, 'b', TODAY, undefined)
    expect(s.personalLog).toEqual({ b: { [TODAY]: { note: '오늘은 좀 피곤해요' } } })
    s = setPrivateNote(s, 'b', TODAY, '')
    // Nothing left for the day → the day, the member and the log are gone.
    expect('personalLog' in s).toBe(false)
  })

  it('cuts a private line to the limit and ignores unknown feels and bad dates', () => {
    const s = setPrivateNote(fresh(), 'b', TODAY, '가'.repeat(PERSONAL_NOTE_MAX + 20))
    expect(personalDay(s, 'b', TODAY)!.note).toHaveLength(PERSONAL_NOTE_MAX)
    const base = fresh()
    expect(setFeel(base, 'b', TODAY, 'happy' as never)).toBe(base)
    expect(setFeel(base, 'b', '2026-13-40', 'tired')).toBe(base)
    expect(setPrivateNote(base, 'b', 'today', '메모')).toBe(base)
    expect(setPrivateNote(base, 'b', TODAY, '   ')).toBe(base)
    // Setting what is already there is a no-op too (the store can skip a save).
    const tired = setFeel(base, 'b', TODAY, 'tired')
    expect(setFeel(tired, 'b', TODAY, 'tired')).toBe(tired)
    expect(setPrivateNote(setPrivateNote(tired, 'b', TODAY, '메모'), 'b', TODAY, ' 메모 ')).toEqual(
      setPrivateNote(tired, 'b', TODAY, '메모'),
    )
  })

  it('has a label for every feel chip', () => {
    for (const f of PERSONAL_FEELS) expect(FEEL_LABEL[f]).toBeTruthy()
    expect(PERSONAL_FEELS).toEqual(['normal', 'tired', 'sensitive', 'breast', 'cramps', 'spotting', 'nausea'])
  })
})

describe('personalDays / lastCycleFeels / countFeels', () => {
  const logged = () => {
    let s = fresh()
    s = setFeel(s, 'b', '2026-09-10', 'tired') // last cycle
    s = setFeel(s, 'b', '2026-09-14', 'breast')
    s = setPrivateNote(s, 'b', '2026-09-16', '테스트는 음성')
    s = setFeel(s, 'b', '2026-09-19', 'spotting')
    s = setFeel(s, 'b', '2026-09-25', 'normal') // this cycle
    s = setFeel(s, 'a', '2026-09-14', 'tired') // 민수's own
    return s
  }

  it('lists one member’s days in a range, oldest first', () => {
    const days = personalDays(logged(), 'b', '2026-09-01', '2026-09-20')
    expect(days.map((d) => d.date)).toEqual(['2026-09-10', '2026-09-14', '2026-09-16', '2026-09-19'])
    expect(days[2]).toEqual({ date: '2026-09-16', note: '테스트는 음성' })
    expect(personalDays(logged(), 'a', '2026-09-01', '2026-09-30')).toEqual([{ date: '2026-09-14', feel: 'tired' }])
    expect(personalDays(fresh(), 'b', '2026-09-01', '2026-09-30')).toEqual([])
  })

  it('counts last cycle’s feel chips (a note alone does not count)', () => {
    const feels = lastCycleFeels(logged(), 'b', '2026-08-24', '2026-09-20')
    expect(feels.map((d) => d.feel)).toEqual(['tired', 'breast', 'spotting'])
    expect(countFeels(feels)).toEqual({ tired: 1, breast: 1, spotting: 1 })
    expect(countFeels([])).toEqual({})
  })
})

describe('나만 보기 diary entries', () => {
  const withEntries = () => {
    let s = addEntry(fresh(), { id: 'e1', date: TODAY, author: 'b', text: '같이 보는 글' }, `${TODAY}T20:00:00+09:00`)
    s = addEntry(s, { id: 'e2', date: TODAY, author: 'b', text: '나만 보는 글' }, `${TODAY}T20:10:00+09:00`)
    return setEntryPrivacy(s, 'e2', 'b', true)
  }

  it('only the author can make an entry private, and only they see it', () => {
    const s = withEntries()
    expect(s.diary.find((e) => e.id === 'e2')!.privateTo).toBe('b')
    expect(canSeeEntry(s.diary[1]!, 'b')).toBe(true)
    expect(canSeeEntry(s.diary[1]!, 'a')).toBe(false)
    expect(visibleEntries(s.diary, 'a').map((e) => e.id)).toEqual(['e1'])
    expect(visibleEntries(s.diary, 'b').map((e) => e.id)).toEqual(['e1', 'e2'])
    // 민수 can't hide 지은's entry, nor unhide it; unknown ids are a no-op.
    expect(setEntryPrivacy(s, 'e1', 'a', true)).toBe(s)
    expect(setEntryPrivacy(s, 'e2', 'a', false)).toBe(s)
    expect(setEntryPrivacy(s, 'nope', 'b', true)).toBe(s)
    // Already in that state → same object.
    expect(setEntryPrivacy(s, 'e2', 'b', true)).toBe(s)
    expect(setEntryPrivacy(s, 'e1', 'b', false)).toBe(s)
    // Shared again: the field is gone, not false.
    const shared = setEntryPrivacy(s, 'e2', 'b', false)
    expect('privateTo' in shared.diary[1]!).toBe(false)
  })

  it('stateForViewer keeps only the viewer’s own log and visible entries', () => {
    let s = withEntries()
    s = setFeel(s, 'b', TODAY, 'tired')
    s = setFeel(s, 'a', TODAY, 'normal')
    const forMinsu = stateForViewer(s, 'a')
    expect(forMinsu.personalLog).toEqual({ a: { [TODAY]: { feel: 'normal' } } })
    expect(forMinsu.diary.map((e) => e.id)).toEqual(['e1'])
    expect(JSON.stringify(forMinsu)).not.toContain('나만 보는 글')
    expect(JSON.stringify(forMinsu)).not.toContain('tired')
    const forJieun = stateForViewer(s, 'b')
    expect(forJieun.personalLog).toEqual({ b: { [TODAY]: { feel: 'tired' } } })
    expect(forJieun.diary).toHaveLength(2)
    // No own log → no personalLog key at all.
    expect('personalLog' in stateForViewer(withEntries(), 'a')).toBe(false)
    // The source is untouched.
    expect(s.diary).toHaveLength(2)
    expect(Object.keys(s.personalLog!)).toEqual(['b', 'a'])
  })
})

describe('cleanPersonalLog (the backup check)', () => {
  it('passes a canonical log through unchanged and drops what is not valid', () => {
    let s = setFeel(fresh(), 'b', '2026-09-14', 'breast')
    s = setPrivateNote(s, 'b', '2026-09-16', '음성')
    expect(cleanPersonalLog(s.personalLog)).toEqual(s.personalLog)
    expect(
      cleanPersonalLog({
        a: { '2026-09-14': { feel: 'happy' }, 'yesterday': { feel: 'tired' }, '2026-09-15': { note: 7 } },
        b: { '2026-09-16': { feel: 'tired', note: '  ' + '가'.repeat(200) }, '2026-09-17': [] },
        c: { '2026-09-16': { feel: 'tired' } },
      }),
    ).toEqual({ b: { '2026-09-16': { feel: 'tired', note: '가'.repeat(PERSONAL_NOTE_MAX) } } })
    for (const bad of [undefined, null, 'log', [], 3, { a: null, b: 'x' }, { a: {} }]) {
      expect(cleanPersonalLog(bad)).toBeUndefined()
    }
  })

  it('survives a backup and a reload, member by member', () => {
    let s = setFeel(fresh(), 'b', '2026-09-14', 'spotting')
    s = setPrivateNote(s, 'b', '2026-09-14', '조금 비쳤어요')
    s = setFeel(s, 'a', '2026-09-14', 'tired')
    const raw = JSON.stringify(s)
    expect(parseState(raw)!.personalLog).toEqual(s.personalLog)
    expect(sanitizeBackup(JSON.parse(raw))!.personalLog).toEqual(s.personalLog)
    // A hand-edited file: bad days go, good ones stay.
    const edited = JSON.parse(raw) as AppState
    ;(edited.personalLog as Record<string, unknown>).b = { '2026-09-14': { feel: 'spotting', note: 1 }, bad: { feel: 'tired' } }
    expect(sanitizeBackup(edited)!.personalLog).toEqual({ a: { '2026-09-14': { feel: 'tired' } }, b: { '2026-09-14': { feel: 'spotting' } } })
    ;(edited as unknown as Record<string, unknown>).personalLog = 'nope'
    expect('personalLog' in sanitizeBackup(edited)!).toBe(false)
  })
})
