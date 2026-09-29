import { describe, expect, it } from 'vitest'
import { applyOnboardingExtras, createInitialState } from '@/lib/initial'
import { cycleStats } from '@/lib/logic/cycle'
import { inbox, scheduledNotices } from '@/lib/logic/notifications'
import { dueDate } from '@/lib/logic/pregnancy'
import {
  ALERT_STYLE_OPTIONS,
  BACKUP_FILENAME,
  CYCLE_LENGTH_RANGE,
  NAME_MAX,
  PERIOD_LENGTH_RANGE,
  STAGE_INFO,
  alertPreview,
  alertStyleOf,
  backupSummary,
  effectiveLabel,
  emojiChoices,
  MEMBER_EMOJIS,
  birthYearBounds,
  cycleSourceNote,
  extraStorageKeys,
  formatDot,
  isValidBirthYear,
  linkPartner,
  lockScreenText,
  markPregnant,
  membersViewerFirst,
  setAlertStyle,
  setCycle,
  setCycleOwner,
  setSetting,
  sanitizeBackup,
  setTtcStart,
  ttcBounds,
  unlinkPartner,
  updateMember,
  validateTtcStart,
} from '@/lib/logic/settings'
import { FERTILITY_CLAIM_ID, handOverCycle, setFertilityClaimed, setShareCycleDetails as viaPartnerTrack } from '@/lib/logic/partnerTrack'
import { canSeeCycleDetails, setShareCycleDetails } from '@/lib/logic/prefs'
import { setCover, setHideCover } from '@/lib/logic/cover'
import { normalize } from '@/lib/storage'
import { parseState } from '@/lib/storage'
import type { AppState } from '@/lib/types'

const TODAY = '2026-09-26'

// 'a' = 민수 (does not track the cycle), 'b' = 지은 (tracks the cycle).
function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-10',
      ttcStart: '2026-06-01',
    },
    new Date('2026-09-26T09:00:00+09:00'),
  )
  return { ...s, ...over }
}

const owners = (s: AppState) => s.couple.members.filter((m) => m.tracksCycle).map((m) => m.id)

describe('updateMember', () => {
  it('patches name, role, emoji and birth year of one member only', () => {
    const s = fresh()
    const next = updateMember(s, 'a', { name: '  민수씨 ', role: 'partner', emoji: '🐻', birthYear: 1990 })
    const a = next.couple.members[0]
    expect(a).toMatchObject({ id: 'a', name: '민수씨', role: 'partner', emoji: '🐻', birthYear: 1990, tracksCycle: false })
    expect(next.couple.members[1]).toEqual(s.couple.members[1])
    expect(s.couple.members[0].name).toBe('민수') // immutable
  })

  it('falls back to the role label for an empty name and trims long names', () => {
    const s = fresh()
    expect(updateMember(s, 'b', { name: '   ' }).couple.members[1].name).toBe('아내')
    expect(updateMember(s, 'b', { name: '가'.repeat(30) }).couple.members[1].name).toHaveLength(NAME_MAX)
  })

  it('clears birth year with undefined and ignores invalid ones', () => {
    const s = fresh()
    expect(updateMember(s, 'a', { birthYear: undefined }).couple.members[0].birthYear).toBeUndefined()
    expect(updateMember(s, 'a', { birthYear: 1990.5 }).couple.members[0].birthYear).toBe(1992)
    expect(updateMember(s, 'a', { name: '민' }).couple.members[0].birthYear).toBe(1992) // not in patch → kept
  })

  it('ignores an empty emoji and never touches tracksCycle', () => {
    const s = fresh()
    const next = updateMember(s, 'b', { emoji: ' ' , ...({ tracksCycle: false } as object) })
    expect(next.couple.members[1].emoji).toBe(s.couple.members[1].emoji)
    expect(owners(next)).toEqual(['b'])
  })
})

describe('birth year bounds', () => {
  it('accepts roughly 14–80 year olds', () => {
    expect(birthYearBounds(TODAY)).toEqual({ min: 1946, max: 2012 })
    expect(isValidBirthYear(1992, TODAY)).toBe(true)
    expect(isValidBirthYear(2020, TODAY)).toBe(false)
    expect(isValidBirthYear(1900, TODAY)).toBe(false)
    expect(isValidBirthYear(1992.5, TODAY)).toBe(false)
  })
})

describe('setCycleOwner', () => {
  it('keeps exactly one cycle owner', () => {
    const s = fresh()
    expect(owners(setCycleOwner(s, 'a'))).toEqual(['a'])
    expect(owners(setCycleOwner(s, 'b'))).toEqual(['b'])
  })

  it('repairs a broken state where both or neither track the cycle', () => {
    const s = fresh()
    const both = { ...s, couple: { ...s.couple, members: s.couple.members.map((m) => ({ ...m, tracksCycle: true })) as AppState['couple']['members'] } }
    const none = { ...s, couple: { ...s.couple, members: s.couple.members.map((m) => ({ ...m, tracksCycle: false })) as AppState['couple']['members'] } }
    expect(owners(setCycleOwner(both, 'a'))).toEqual(['a'])
    expect(owners(setCycleOwner(none, 'b'))).toEqual(['b'])
  })

  it('keeps history and each member’s own alert style', () => {
    const s = fresh()
    const next = setCycleOwner(s, 'a')
    expect(next.periods).toBe(s.periods)
    expect(next.settings.alertStyle).toEqual(s.settings.alertStyle)
    expect(next.couple.inviteCode).toBe(s.couple.inviteCode)
  })

  it('makes sharing private again for a new owner (they haven’t agreed to anything)', () => {
    const shared = setShareCycleDetails(fresh(), 'b', true)
    expect(canSeeCycleDetails(shared, 'a')).toBe(true)
    const moved = setCycleOwner(shared, 'a')
    expect(moved.settings.shareCycleDetails).toBe(false)
    expect(canSeeCycleDetails(moved, 'b')).toBe(false)
    // Same owner again: her choice stands.
    expect(setCycleOwner(shared, 'b').settings.shareCycleDetails).toBe(true)
    // Repairing a state with two owners is not a confirmed choice either.
    const both = {
      ...shared,
      couple: { ...shared.couple, members: shared.couple.members.map((m) => ({ ...m, tracksCycle: true })) as AppState['couple']['members'] },
    }
    expect(setCycleOwner(both, 'b').settings.shareCycleDetails).toBe(false)
    // handOverCycle (설정 › 두 사람) goes through the same rule.
    expect(handOverCycle(shared, 'a', 'b').settings.shareCycleDetails).toBe(false)
    expect(handOverCycle(shared, 'b', 'b')).toBe(shared)
  })
})

describe('linking', () => {
  it('sets and clears linkedAt', () => {
    const s = fresh()
    const linked = linkPartner(s, '2026-09-26T10:00:00+09:00')
    expect(linked.couple.linkedAt).toBe('2026-09-26T10:00:00+09:00')
    expect('linkedAt' in unlinkPartner(linked).couple).toBe(false)
  })
})

describe('setAlertStyle / alertStyleOf', () => {
  it('changes only the given member', () => {
    const s = fresh()
    const next = setAlertStyle(s, 'a', 'off')
    expect(next.settings.alertStyle).toEqual({ a: 'off', b: 'explicit' })
    expect(s.settings.alertStyle.a).toBe('soft')
  })

  it('ignores unknown styles', () => {
    const s = fresh()
    expect(setAlertStyle(s, 'a', 'loud' as never)).toBe(s)
  })

  it('falls back to explicit for the cycle owner and soft for the partner', () => {
    const s = fresh()
    const bare = { ...s, settings: { ...s.settings, alertStyle: {} as AppState['settings']['alertStyle'] } }
    expect(alertStyleOf(bare, 'b')).toBe('explicit')
    expect(alertStyleOf(bare, 'a')).toBe('soft')
  })
})

describe('setSetting', () => {
  it('sets a single couple-wide setting', () => {
    const s = fresh()
    const next = setSetting(s, 'lowPressure', true)
    expect(next.settings.lowPressure).toBe(true)
    expect(next.settings.discreet).toBe(false)
    expect(setSetting(s, 'discreet', true).settings.discreet).toBe(true)
    expect(s.settings.lowPressure).toBe(false)
  })
})

describe('setCycle', () => {
  it('clamps cycle length to 15–60 and period length to 1–14', () => {
    const s = fresh()
    expect(setCycle(s, { cycleLength: 5 }).cycle.cycleLength).toBe(CYCLE_LENGTH_RANGE.min)
    expect(setCycle(s, { cycleLength: 90 }).cycle.cycleLength).toBe(CYCLE_LENGTH_RANGE.max)
    expect(setCycle(s, { periodLength: 0 }).cycle.periodLength).toBe(PERIOD_LENGTH_RANGE.min)
    expect(setCycle(s, { periodLength: 20 }).cycle.periodLength).toBe(PERIOD_LENGTH_RANGE.max)
  })

  it('rounds, ignores NaN and leaves the other value alone', () => {
    const s = fresh()
    const next = setCycle(s, { cycleLength: 31.6 })
    expect(next.cycle).toEqual({ cycleLength: 32, periodLength: 5 })
    expect(setCycle(s, { cycleLength: Number.NaN }).cycle).toEqual(s.cycle)
  })
})

describe('setTtcStart', () => {
  it('sets, clears, and pulls future dates back to today', () => {
    const s = fresh()
    expect(setTtcStart(s, '2026-01-15', TODAY).settings.ttcStart).toBe('2026-01-15')
    expect(setTtcStart(s, '2027-01-01', TODAY).settings.ttcStart).toBe(TODAY)
    expect('ttcStart' in setTtcStart(s, '', TODAY).settings).toBe(false)
    expect('ttcStart' in setTtcStart(s, undefined, TODAY).settings).toBe(false)
  })

  it('ignores invalid dates', () => {
    const s = fresh()
    expect(setTtcStart(s, '2026-02-30', TODAY)).toBe(s)
  })

  it('ignores the half-typed years a desktop date field reports while typing', () => {
    // Typing "2026" into the year segment passes through 0002 → 0020 → 0202 → 2026.
    const s = fresh()
    for (const partial of ['0002-01-15', '0020-01-15', '0202-01-15']) {
      const next = setTtcStart(s, partial, TODAY)
      expect(next).toBe(s)
      expect(validateTtcStart(partial, TODAY)).not.toBeNull()
      // …so no "see a doctor after 24,000 months" notice is ever scheduled from it.
      expect(scheduledNotices(next, TODAY).some((n) => n.kind === 'doctor')).toBe(false)
    }
    // '0202-…' is a real calendar date, so only the range check stops it.
    expect(validateTtcStart('0202-01-15', TODAY)).toMatch(/최근 20년/)
    expect(setTtcStart(s, '2026-01-15', TODAY).settings.ttcStart).toBe('2026-01-15')
  })
})

describe('validateTtcStart / ttcBounds', () => {
  it('accepts the last 20 years up to today', () => {
    expect(ttcBounds(TODAY)).toEqual({ min: '2006-09-26', max: TODAY })
    expect(validateTtcStart(TODAY, TODAY)).toBeNull()
    expect(validateTtcStart('2006-09-26', TODAY)).toBeNull()
    expect(validateTtcStart('2006-09-25', TODAY)).not.toBeNull()
    expect(validateTtcStart('2026-09-27', TODAY)).toMatch(/오늘 이후/)
    expect(validateTtcStart('', TODAY)).not.toBeNull()
    expect(validateTtcStart('2026-13-01', TODAY)).not.toBeNull()
  })
})

describe('cycleSourceNote', () => {
  it('explains which numbers predictions use', () => {
    const settings = { cycleLength: 28, periodLength: 5 }
    const none = cycleStats([], settings)
    expect(cycleSourceNote(none, 0)).toMatch(/두 번 이상/)
    // Two logs 90 days apart: not averaged, and the note says why.
    const gap = cycleStats([{ start: '2026-06-01' }, { start: '2026-08-30' }], settings)
    expect(gap.source).toBe('settings')
    expect(cycleSourceNote(gap, 2)).toMatch(/15~60일/)
    const logs = cycleStats([{ start: '2026-08-01' }, { start: '2026-08-30' }], settings)
    expect(cycleSourceNote(logs, 2)).toMatch(/기록 평균/)
  })
})

describe('alertPreview', () => {
  const window = { fertileStart: '2026-10-03', fertileEnd: '2026-10-08' }

  it('explicit style names the estimated dates', () => {
    const p = alertPreview('explicit', { lowPressure: false, isCycleOwner: true, window })
    expect(p.message?.title).toContain('가임기')
    expect(p.message?.body).toContain('10월 3일')
    expect(p.message?.body).toContain('예상')
  })

  it('soft style avoids health words, in the note too', () => {
    const p = alertPreview('soft', { lowPressure: false, isCycleOwner: false, window })
    expect(p.message?.title).toContain('우리의 주간')
    expect(`${p.message?.title}${p.message?.body}${p.note}`).not.toMatch(/가임|배란/)
  })

  it('off and low-pressure send no fertile message', () => {
    expect(alertPreview('off', { lowPressure: false, isCycleOwner: false }).message).toBeNull()
    expect(alertPreview('off', { lowPressure: false, isCycleOwner: false }).note).toContain('숨겨져요')
    expect(alertPreview('off', { lowPressure: false, isCycleOwner: true }).note).toContain('그대로 볼 수')
    const low = alertPreview('explicit', { lowPressure: true, isCycleOwner: true, window })
    expect(low.message).toBeNull()
    expect(low.note).toContain('부담 없이')
    // Per person now, and no fertility words for someone who chose calm.
    expect(low.note).toContain('내 화면과 알림에만 적용돼요')
    expect(low.note).not.toMatch(/두 사람 모두|가임|배란|LH/)
  })

  it('never points at the removed 데이트 tab', () => {
    for (const isCycleOwner of [true, false]) {
      const p = alertPreview('soft', { lowPressure: false, isCycleOwner, window })
      expect(`${p.message?.body}${p.note}`).not.toContain('데이트')
    }
    expect(alertPreview('soft', { lowPressure: false, isCycleOwner: false }).message?.body).toContain('‘우리의 주간’ 카드')
  })

  it('has an option label for every style, with no pressure wording', () => {
    expect(ALERT_STYLE_OPTIONS.map((o) => o.value)).toEqual(['explicit', 'soft', 'off'])
    for (const style of ['explicit', 'soft', 'off'] as const) {
      const p = alertPreview(style, { lowPressure: false, isCycleOwner: false, window })
      expect(`${p.message?.title ?? ''}${p.message?.body ?? ''}${p.note}`).not.toMatch(/숙제|실패|꼭/)
    }
  })

  it('describes the preparing stage by the tabs it has (no 데이트 tab)', () => {
    expect(STAGE_INFO.preparing.body).not.toContain('데이트')
    for (const info of Object.values(STAGE_INFO)) expect(info.body).toMatch(/요\.$/)
  })

  it('discreet lock screen hides the content', () => {
    const msg = { title: '💞 가임기가 다가왔어요', body: '...' }
    expect(lockScreenText(msg, true)).toEqual({ title: '둘셋', body: '새 알림이 있어요 💌' })
    expect(lockScreenText(msg, false)).toBe(msg)
  })
})

describe('markPregnant', () => {
  it('switches stage, keeps history and tells the partner once', () => {
    const s = fresh()
    const next = markPregnant(s, { lmp: '2026-08-20' }, TODAY, 'b', '2026-09-26T10:00:00+09:00')
    expect(next.stage).toBe('pregnant')
    expect(next.pregnancy).toEqual({ lmp: '2026-08-20', confirmedAt: TODAY })
    expect(next.periods).toEqual(s.periods)
    expect(inbox(next, 'a').filter((n) => n.from === 'b')).toHaveLength(1)
    expect(inbox(next, 'b')).toHaveLength(0)
  })

  it('applies a doctor-given due date', () => {
    const next = markPregnant(fresh(), { lmp: '2026-08-20', dueDate: '2027-05-30' }, TODAY, 'a', '2026-09-26T10:00:00+09:00')
    expect(next.pregnancy?.dueDateOverride).toBe('2027-05-30')
    expect(dueDate(next.pregnancy!)).toBe('2027-05-30')
  })
})

describe('formatDot', () => {
  it('formats ISO dates and keeps free text', () => {
    expect(formatDot('2025-01-01')).toBe('2025.1.1')
    expect(formatDot('2026-09-26')).toBe('2026.9.26')
    expect(formatDot('지자체별 운영')).toBe('지자체별 운영')
    expect(effectiveLabel('2024-01-01')).toBe('2024.1.1 시행')
    expect(effectiveLabel('상시')).toBe('상시')
  })
})

describe('backup', () => {
  it('round-trips through JSON and parseState', () => {
    const s = fresh()
    const restored = parseState(JSON.stringify(s))
    expect(restored).toEqual(s)
    expect(BACKUP_FILENAME).toBe('dulset-backup.json')
    expect(parseState('{"hello":1}')).toBeNull()
    expect(parseState('not json')).toBeNull()
  })

  it('summarises what a backup holds', () => {
    const s = fresh({
      diary: [
        { id: '1', date: '2026-09-01', author: 'a', stage: 'preparing', text: 'hi', createdAt: '2026-09-01T10:00:00+09:00', photoId: 'p1' },
        { id: '2', date: '2026-09-02', author: 'b', stage: 'preparing', text: 'yo', createdAt: '2026-09-02T10:00:00+09:00' },
      ],
      checkLog: { '2026-09-25': { a: ['x'] }, '2026-09-26': { b: ['y'] } },
    })
    expect(backupSummary(s)).toEqual({
      names: '민수 · 지은',
      stage: '임신 준비 중',
      periods: 1,
      diary: 2,
      photos: 1,
      checkDays: 2,
      createdAt: '2026-09-26',
    })
  })

  it('picks the extra app keys to remove on reset', () => {
    // (see also sanitizeBackup below)
    const keys = ['dulset:state:v1', 'dulset:state:v1:corrupt:123', 'dulset:calendar:month', 'other-app', 'dulsetx']
    expect(extraStorageKeys(keys, 'dulset:state:v1')).toEqual(['dulset:state:v1:corrupt:123', 'dulset:calendar:month'])
  })
})

describe('emojiChoices', () => {
  it('keeps a 12-item grid and puts an unknown current emoji first', () => {
    expect(emojiChoices(MEMBER_EMOJIS[0]!)).toEqual([...MEMBER_EMOJIS])
    const custom = emojiChoices('🦄')
    expect(custom[0]).toBe('🦄')
    expect(custom).toHaveLength(MEMBER_EMOJIS.length)
  })
})

describe('membersViewerFirst', () => {
  it('puts the viewer first', () => {
    const s = fresh()
    expect(membersViewerFirst(s, 'b').map((m) => m.id)).toEqual(['b', 'a'])
    expect(membersViewerFirst(s, 'a').map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('sanitizeBackup', () => {
  const clone = (s: AppState) => JSON.parse(JSON.stringify(s)) as AppState

  it('passes a real backup through unchanged', () => {
    const s = linkPartner(markPregnant(fresh(), { lmp: '2026-08-20' }, TODAY, 'b', '2026-09-26T10:00:00+09:00'), 'x')
    const restored = parseState(JSON.stringify(s))!
    expect(sanitizeBackup(restored)).toEqual(restored)
  })

  it('rejects files that are not a 둘셋 couple', () => {
    const bad1 = { ...clone(fresh()), stage: 'dating' as never }
    expect(sanitizeBackup(bad1)).toBeNull()
    const bad2 = clone(fresh())
    bad2.couple.members[1] = { ...bad2.couple.members[1], id: 'a' }
    expect(sanitizeBackup(bad2)).toBeNull()
    const bad3 = clone(fresh())
    ;(bad3.couple as { inviteCode: unknown }).inviteCode = 42
    expect(sanitizeBackup(bad3)).toBeNull()
  })

  it('repairs the cycle-owner invariant and member fields', () => {
    const s = clone(fresh())
    s.couple.members = [
      { ...s.couple.members[0], tracksCycle: true, role: 'boss' as never, name: '', birthYear: 'x' as never },
      { ...s.couple.members[1], tracksCycle: true, emoji: '' },
    ]
    const out = sanitizeBackup(s)!
    expect(out.couple.members.filter((m) => m.tracksCycle).map((m) => m.id)).toEqual(['a'])
    expect(out.couple.members[0]).toMatchObject({ role: 'partner', name: '배우자' })
    expect('birthYear' in out.couple.members[0]).toBe(false)
    expect(out.couple.members[1].emoji).toBe('👩')
  })

  it('puts members in a/b order', () => {
    const s = clone(fresh())
    s.couple.members = [s.couple.members[1], s.couple.members[0]]
    expect(sanitizeBackup(s)!.couple.members.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('clamps cycle numbers and fixes settings', () => {
    const s = clone(fresh())
    s.cycle = { cycleLength: 0, periodLength: '5' as never }
    s.settings = { ...s.settings, lowPressure: 'yes' as never, ttcStart: 'soon', alertStyle: { a: 'loud' as never, b: 'off' } }
    const out = sanitizeBackup(s)!
    expect(out.cycle).toEqual({ cycleLength: 15, periodLength: 5 })
    expect(out.settings.lowPressure).toBe(false)
    expect('ttcStart' in out.settings).toBe(false)
    // 'b' tracks the cycle in fresh(): invalid 'a' falls back to the partner default.
    expect(out.settings.alertStyle).toEqual({ a: 'soft', b: 'off' })
  })

  it('drops broken records instead of crashing later', () => {
    const s = clone(fresh())
    s.periods = [{ start: '2026-09-10', end: '2026-09-01' }, { start: 'nope' }, null as never, { start: '2026-08-12', end: '2026-08-16' }]
    s.checkLog = null as never
    s.pregnancy = { lmp: 'bad', confirmedAt: TODAY }
    s.baby = { name: '', birthDate: '2026-09-01', sex: 'cat' as never }
    s.diary = [{ id: '1', date: '2026-09-01', author: 'z' as never, stage: 'preparing', text: 'x', createdAt: '' }]
    const out = sanitizeBackup(s)!
    expect(out.periods).toEqual([{ start: '2026-09-10' }, { start: '2026-08-12', end: '2026-08-16' }])
    expect(out.checkLog).toEqual({})
    expect(out.pregnancy).toBeUndefined()
    expect(out.baby).toEqual({ name: '아기', birthDate: '2026-09-01', sex: 'unknown' })
    expect(out.diary).toEqual([])
    expect(() => backupSummary(out)).not.toThrow()
  })

  it('keeps a pregnancy with a valid LMP and drops a bad due date', () => {
    const s = clone(fresh())
    s.pregnancy = { lmp: '2026-08-20', dueDateOverride: '2027-02-30', confirmedAt: 'x' }
    expect(sanitizeBackup(s)!.pregnancy).toEqual({ lmp: '2026-08-20', confirmedAt: '2026-08-20' })
  })
})

describe('sanitizeBackup: cover photo', () => {
  const clone = (s: AppState) => JSON.parse(JSON.stringify(s)) as AppState
  const withCover = (cover: unknown, personal?: unknown): AppState => {
    const s = clone(fresh())
    ;(s.couple as { cover?: unknown }).cover = cover
    if (personal !== undefined) (s.settings as { personal?: unknown }).personal = personal
    return s
  }
  const good = { photoId: 'photo-1', focusY: 64, caption: '9.20 · 한강 산책', setBy: 'b', setAt: '2026-09-01' }

  it('keeps a valid cover (an IndexedDB id or a known built-in picture)', () => {
    expect(sanitizeBackup(withCover(good))!.couple.cover).toEqual(good)
    expect(sanitizeBackup(withCover({ ...good, photoId: 'builtin:hangang' }))!.couple.cover!.photoId).toBe('builtin:hangang')
    // A real backup round-trips unchanged.
    const s = setCover(fresh(), { photoId: 'builtin:sea', focusY: 40, caption: '강릉' }, 'a', TODAY)
    expect(parseState(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
  })

  it('drops a built-in id this version does not have', () => {
    expect(sanitizeBackup(withCover({ ...good, photoId: 'builtin:moon' }))!.couple.cover).toBeUndefined()
    expect('cover' in sanitizeBackup(withCover({ ...good, photoId: 'builtin:' }))!.couple).toBe(false)
  })

  it('drops an unusable cover and clamps the focus', () => {
    for (const bad of [
      { ...good, focusY: 'top' },
      { ...good, focusY: null },
      { ...good, photoId: '' },
      { ...good, photoId: 'x'.repeat(201) },
      { ...good, setBy: 'z' },
      { ...good, setAt: 'yesterday' },
      'photo-1',
      [good],
    ]) {
      expect(sanitizeBackup(withCover(bad))!.couple.cover).toBeUndefined()
    }
    expect(sanitizeBackup(withCover({ ...good, focusY: -20 }))!.couple.cover!.focusY).toBe(0)
    expect(sanitizeBackup(withCover({ ...good, focusY: 250.7 }))!.couple.cover!.focusY).toBe(100)
    expect(sanitizeBackup(withCover({ ...good, focusY: 33.6 }))!.couple.cover!.focusY).toBe(34)
  })

  it('drops only a caption that is too long, not text, or has health words', () => {
    const { caption: _c, ...noCaption } = good
    for (const caption of ['가'.repeat(17), 12, '배란 테스트 날', '병원 가는 길', '   ']) {
      expect(sanitizeBackup(withCover({ ...good, caption }))!.couple.cover).toEqual(noCaption)
    }
    expect(sanitizeBackup(withCover({ ...good, caption: `  ${'가'.repeat(16)}  ` }))!.couple.cover!.caption).toBe('가'.repeat(16))
  })

  it('keeps hideCover only as a yes/no, per person', () => {
    const out = sanitizeBackup(withCover(good, { a: { hideCover: true, lowPressure: true }, b: { hideCover: 'yes' } }))!
    expect(out.settings.personal).toEqual({ a: { hideCover: true, lowPressure: true }, b: {} })
    const off = sanitizeBackup(withCover(good, { b: { hideCover: false } }))!
    expect(off.settings.personal).toEqual({ b: { hideCover: false } })
    // normalize (before sanitizeBackup) keeps the same rule.
    expect(normalize(withCover(good, { a: { hideCover: 1, discreet: true } })).settings.personal).toEqual({ a: { discreet: true } })
    expect(parseState(JSON.stringify(setHideCover(fresh(), 'a', true)))!.settings.personal).toEqual({ a: { hideCover: true } })
  })

  it('normalize applies the same cover check', () => {
    expect(normalize(withCover({ ...good, focusY: 'x' })).couple.cover).toBeUndefined()
    expect(normalize(withCover({ ...good, caption: '임테기' })).couple.cover).toEqual({
      photoId: 'photo-1',
      focusY: 64,
      setBy: 'b',
      setAt: '2026-09-01',
    })
    expect('cover' in normalize(clone(fresh())).couple).toBe(false)
  })
})

describe('sharing & per-person prefs survive a backup', () => {
  it('keeps weekly check-ins, the claim mark, the sharing choice and personal prefs', () => {
    let s = applyOnboardingExtras(
      fresh(),
      {
        habits: { smokes: true, drinks: 'often', exercises: false, takesSupplements: false },
        myPrefs: { lowPressure: true },
      },
      TODAY,
    )
    s = setShareCycleDetails(s, 'b', true)
    s = setFertilityClaimed(s, true, TODAY, 'a')
    const back = parseState(JSON.stringify(s))!
    expect(back.checkItems.filter((i) => i.cadence === 'weekly').map((i) => i.label)).toEqual(['금연', '금주', '사우나·뜨거운 탕 쉬기'])
    expect(back.planDone[FERTILITY_CLAIM_ID]).toEqual({ at: TODAY, by: 'a' })
    expect(back.settings.shareCycleDetails).toBe(true)
    expect(back.settings.personal).toEqual({ a: { lowPressure: true } })
  })

  it('never lets the partner widen what they see', () => {
    const s = fresh()
    expect(setShareCycleDetails(s, 'a', true)).toBe(s)
    expect(setShareCycleDetails(s, 'a', true).settings.shareCycleDetails).toBe(false)
    // The old import path still works.
    expect(viaPartnerTrack).toBe(setShareCycleDetails)
  })

  it('keeps data from before the setting existed private (normalize, like sanitizeBackup)', () => {
    const s = fresh()
    const { shareCycleDetails: _dropped, ...older } = setShareCycleDetails(s, 'b', true).settings
    const legacy = { ...s, settings: older } as AppState
    expect(normalize(legacy).settings.shareCycleDetails).toBe(false)
    expect(sanitizeBackup(JSON.parse(JSON.stringify(legacy)))!.settings.shareCycleDetails).toBe(false)
    expect(parseState(JSON.stringify(legacy))!.settings.shareCycleDetails).toBe(false)
    expect(canSeeCycleDetails(parseState(JSON.stringify(legacy))!, 'a')).toBe(false)
    // A stored choice is kept.
    expect(parseState(JSON.stringify(setShareCycleDetails(s, 'b', true)))!.settings.shareCycleDetails).toBe(true)
  })
})
