import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { addAnniversary, anniversaryNotices, setCoupleDates } from '@/lib/logic/anniversary'
import { addEntry } from '@/lib/logic/diary'
import { setEntryPrivacy } from '@/lib/logic/personalLog'
import { backToPreparing, startPregnancy, recordBirth } from '@/lib/logic/pregnancy'
import { anniversaryAlertsOn, setSetting } from '@/lib/logic/settings'
import {
  ALBUM_CAPTION_MAX,
  albumFeed,
  albumGroups,
  anniversaryEmoji,
  anniversaryLists,
  chapterContext,
  chapterLabel,
  chaptersWithEntries,
  checkAnyDate,
  checkPastDate,
  completedYears,
  composerTitle,
  entryChapter,
  excerpt,
  filterStory,
  marriedLine,
  nextCustomOccurrence,
  ourDaysChain,
  prepStartOf,
  reactToEntry,
  reactionNoticeKey,
  reactionOf,
  receivedReactions,
  removeStoryEntry,
  setReaction,
  toggleReaction,
} from '@/lib/logic/usView'
import type { AppState, DiaryEntry } from '@/lib/types'

function fresh(ttcStart = '2026-03-01'): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart,
    },
    new Date(2026, 2, 1, 9),
  )
}

let seq = 0
function entry(over: Partial<DiaryEntry> & Pick<DiaryEntry, 'date'>): DiaryEntry {
  seq++
  return {
    id: `e${seq}`,
    author: 'a',
    stage: 'preparing',
    text: `기록 ${seq}`,
    createdAt: `${over.date}T09:00:00+09:00`,
    ...over,
  }
}

function withEntries(s: AppState, entries: DiaryEntry[]): AppState {
  return { ...s, diary: entries }
}

describe('chapters (우리 둘 → 준비 → 임신 → 육아)', () => {
  it('puts entries dated before 함께 준비 시작 in 우리 둘', () => {
    const ctx = chapterContext(fresh('2026-03-01'))
    expect(ctx.prepStart).toBe('2026-03-01')
    expect(entryChapter({ stage: 'preparing', date: '2026-02-28' }, ctx)).toBe('couple')
    expect(entryChapter({ stage: 'preparing', date: '2026-03-01' }, ctx)).toBe('preparing')
    expect(chapterLabel({ stage: 'preparing', date: '2025-12-24' }, ctx)).toBe('우리 둘')
    expect(chapterLabel({ stage: 'preparing', date: '2026-04-01' }, ctx)).toBe('준비')
  })

  it('uses the LMP when the couple joined already pregnant (ttcStart = joining day)', () => {
    const s = startPregnancy(fresh('2026-09-20'), '2026-07-01', '2026-09-20')
    const ctx = chapterContext(s)
    expect(ctx.prepStart).toBe('2026-07-01')
    // A pregnancy-stage entry dated inside the pregnancy keeps its week badge…
    expect(chapterLabel({ stage: 'pregnant', date: '2026-09-23' }, ctx)).toBe('임신 12주')
    // …and a backdated dating memory is 우리 둘, not "임신".
    expect(chapterLabel({ stage: 'pregnant', date: '2019-05-14' }, ctx)).toBe('우리 둘')
  })

  it('falls back to birth − 280 days, then to the day the space was created', () => {
    const base = fresh()
    const noTtc = { ...base, settings: { ...base.settings, ttcStart: undefined } }
    expect(prepStartOf({ ...noTtc, baby: { name: '콩', birthDate: '2026-09-01', sex: 'unknown' } })).toBe('2025-11-25')
    expect(prepStartOf(noTtc)).toBe(base.createdAt.slice(0, 10))
  })

  it('reads the created day as a local date (offset stamps as-is, UTC stamps converted)', () => {
    const base = fresh()
    const noTtc = { ...base, settings: { ...base.settings, ttcStart: undefined } }
    expect(prepStartOf({ ...noTtc, createdAt: '2026-03-01T00:30:00+09:00' })).toBe('2026-03-01')
    const utc = '2026-02-28T15:30:00.000Z'
    const local = new Date(utc)
    const day = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    expect(prepStartOf({ ...noTtc, createdAt: utc })).toBe(day)
    expect(prepStartOf({ ...noTtc, createdAt: 'nonsense' })).toBeUndefined()
  })

  it('lists chapters in life order and filters by chapter + author', () => {
    const s = startPregnancy(fresh('2026-03-01'), '2026-07-01', '2026-08-10')
    const ctx = chapterContext(s)
    const list = [
      entry({ date: '2026-08-20', stage: 'pregnant', author: 'b' }),
      entry({ date: '2026-02-01', stage: 'preparing' }),
      entry({ date: '2026-04-01', stage: 'preparing', author: 'b' }),
    ]
    expect(chaptersWithEntries(list, ctx)).toEqual(['couple', 'preparing', 'pregnant'])
    expect(filterStory(list, ctx, { chapter: 'couple', author: 'all' }).map((e) => e.date)).toEqual(['2026-02-01'])
    expect(filterStory(list, ctx, { chapter: 'preparing', author: 'all' }).map((e) => e.date)).toEqual(['2026-04-01'])
    expect(filterStory(list, ctx, { chapter: 'all', author: 'b' })).toHaveLength(2)
  })

  it('titles the composer by the chapter the date falls in', () => {
    const prep = chapterContext(fresh('2026-03-01'))
    expect(composerTitle('preparing', '2026-09-26', prep)).toBe('우리의 기록')
    expect(composerTitle('preparing', '2025-10-01', prep)).toBe('우리 둘 기록')
    expect(composerTitle('pregnant', '2026-09-26', prep)).toBe('태교일기')
    expect(composerTitle('parenting', '2026-09-26', prep)).toBe('육아일기')
  })
})

describe('reactions', () => {
  const base = () => withEntries(fresh(), [entry({ id: 'x', date: '2026-09-01', author: 'b' })])

  it('toggles the viewer’s reaction on the partner’s entry', () => {
    let s = toggleReaction(base(), 'x', 'a', '❤️')
    expect(s.diary[0]!.reactions).toEqual({ a: '❤️' })
    s = toggleReaction(s, 'x', 'a', '😂')
    expect(reactionOf(s.diary[0]!, 'a')).toBe('😂')
    s = toggleReaction(s, 'x', 'a', '😂')
    expect(s.diary[0]!.reactions).toBeUndefined()
  })

  it('ignores reactions to your own entry and unknown emoji', () => {
    const s = base()
    expect(toggleReaction(s, 'x', 'b', '❤️')).toBe(s)
    expect(toggleReaction(s, 'x', 'a', '🍕')).toBe(s)
    expect(toggleReaction(s, 'nope', 'a', '❤️')).toBe(s)
  })

  it('setReaction is idempotent (safe to re-apply on a newer state)', () => {
    const once = setReaction(base(), 'x', 'a', '🥹')
    expect(setReaction(once, 'x', 'a', '🥹')).toBe(once)
    expect(setReaction(once, 'x', 'a', null).diary[0]!.reactions).toBeUndefined()
  })

  it('reads stored reactions defensively and shows only other people’s', () => {
    const e = entry({ date: '2026-09-01', author: 'b', reactions: { a: '👏', b: '❤️' } })
    expect(receivedReactions(e)).toEqual([{ member: 'a', emoji: '👏' }])
    const junk = { ...e, reactions: { a: 5 as unknown as string } }
    expect(receivedReactions(junk)).toEqual([])
    expect(reactionOf({ reactions: 'x' as unknown as DiaryEntry['reactions'] }, 'a')).toBeUndefined()
  })

  it('tells the author once, and takes an unseen note back when cleared', () => {
    const now = '2026-09-26T10:00:00+09:00'
    let s = reactToEntry(base(), 'x', 'a', '❤️', now)
    const key = reactionNoticeKey('x', 'a')
    const notes = s.notifications.filter((n) => n.key === key)
    expect(notes).toHaveLength(1)
    expect(notes[0]!.to).toBe('b')
    expect(notes[0]!.title).toContain('민수님이')
    // Switching the emoji doesn't send another.
    s = reactToEntry(s, 'x', 'a', '👏', now)
    expect(s.notifications.filter((n) => n.key === key)).toHaveLength(1)
    // Clearing while unread removes it.
    s = reactToEntry(s, 'x', 'a', null, now)
    expect(s.notifications.filter((n) => n.key === key)).toHaveLength(0)
    expect(s.diary[0]!.reactions).toBeUndefined()
  })

  it('deleting an entry also drops the reaction notes about it', () => {
    const now = '2026-09-26T10:00:00+09:00'
    let s = withEntries(fresh(), [
      entry({ id: 'x', date: '2026-09-01', author: 'b' }),
      entry({ id: 'y', date: '2026-09-02', author: 'b' }),
    ])
    s = reactToEntry(s, 'x', 'a', '❤️', now)
    s = reactToEntry(s, 'y', 'a', '👏', now)
    const other = s.notifications.length
    const next = removeStoryEntry(s, 'x')
    expect(next.diary.map((e) => e.id)).toEqual(['y'])
    expect(next.notifications.some((n) => n.key === reactionNoticeKey('x', 'a'))).toBe(false)
    expect(next.notifications.some((n) => n.key === reactionNoticeKey('y', 'a'))).toBe(true)
    expect(next.notifications).toHaveLength(other - 1)
    expect(removeStoryEntry(next, 'nope')).toBe(next)
  })
})

describe('우리의 날들 chain', () => {
  it('shows only the links that apply, in story order', () => {
    const s = fresh('2026-03-01')
    expect(ourDaysChain(s, '2026-09-26').map((l) => l.text)).toEqual(['함께 준비한 지 D+210'])
    const dated = { ...s, couple: { ...s.couple, metDate: '2021-05-14', marriedDate: '2024-10-19' } }
    expect(ourDaysChain(dated, '2026-09-26').map((l) => l.text)).toEqual([
      '만난 지 1,962일',
      '결혼 1년',
      '함께 준비한 지 D+210',
    ])
  })

  it('moves on to 임신 N주, then 태어난 지 N일째, keeping the couple counters', () => {
    const s0 = fresh('2026-03-01')
    const s = { ...s0, couple: { ...s0.couple, metDate: '2021-05-14' } }
    const pregnant = startPregnancy(s, '2026-07-01', '2026-08-10')
    expect(ourDaysChain(pregnant, '2026-09-26').map((l) => l.key)).toEqual(['met', 'pregnant'])
    expect(ourDaysChain(pregnant, '2026-09-26')[1]!.text).toBe('임신 12주')
    const born = recordBirth(pregnant, { name: '콩', birthDate: '2027-04-01', sex: 'girl' })
    expect(ourDaysChain(born, '2027-04-10').map((l) => l.text)).toEqual(['만난 지 2,158일', '태어난 지 10일째'])
  })

  it('leaves out the prep counter in low-pressure mode and right after a loss', () => {
    const s = fresh('2026-03-01')
    const calm = { ...s, settings: { ...s.settings, lowPressure: true } }
    expect(ourDaysChain(calm, '2026-09-26')).toEqual([])
    const ended = backToPreparing(startPregnancy(s, '2026-07-01', '2026-08-10'), '2026-09-01')
    expect(ourDaysChain(ended, '2026-09-26').map((l) => l.key)).toEqual([])
    expect(ourDaysChain(ended, '2026-12-01').map((l) => l.key)).toEqual(['ttc'])
  })

  it('counts the prep days like the home screen: restarting after an ended pregnancy', () => {
    const s = fresh('2026-03-01')
    const ended = backToPreparing(startPregnancy(s, '2026-05-01', '2026-06-10'), '2026-07-20')
    // 68 days after the end (quiet period over): D+69 from the day it ended, not D+210 from ttcStart.
    expect(ourDaysChain(ended, '2026-09-26').map((l) => l.text)).toEqual(['함께 준비한 지 D+69'])
  })

  it('skips dates in the future and counts 결혼 in days during the first year', () => {
    const s = fresh()
    const c = { ...s, couple: { ...s.couple, metDate: '2027-01-01', marriedDate: '2026-09-01' } }
    const texts = ourDaysChain(c, '2026-09-26').map((l) => l.text)
    expect(texts[0]).toBe('결혼한 지 26일')
    expect(texts.some((t) => t.startsWith('만난'))).toBe(false)
  })

  it('counts whole years (2/29 → 2/28)', () => {
    expect(completedYears('2024-10-19', '2026-10-18')).toBe(1)
    expect(completedYears('2024-10-19', '2026-10-19')).toBe(2)
    expect(completedYears('2024-02-29', '2025-02-28')).toBe(1)
    expect(completedYears('2026-09-27', '2026-09-26')).toBe(0)
    expect(marriedLine('2024-10-19', '2026-10-19')).toBe('결혼한 지 731일 · 2024년 10월 19일')
    expect(marriedLine('2026-09-01', '2026-09-26')).toBe('결혼한 지 26일 · 2026년 9월 1일')
    expect(marriedLine('2026-10-01', '2026-09-26')).toBe('결혼 예정 · 2026년 10월 1일')
  })
})

describe('anniversary lists', () => {
  it('splits upcoming (soonest first) and this year’s past days (latest first)', () => {
    const couple = { metDate: '2021-05-14', marriedDate: '2024-10-19' }
    const { upcoming, pastThisYear } = anniversaryLists(couple, [], '2026-09-26')
    expect(upcoming[0]!.title).toBe('결혼 2주년')
    expect(upcoming.every((e) => e.date >= '2026-09-26')).toBe(true)
    expect(pastThisYear.every((e) => e.date < '2026-09-26' && e.date >= '2026-01-01')).toBe(true)
    expect(pastThisYear[0]!.date >= pastThisYear[pastThisYear.length - 1]!.date).toBe(true)
    expect(pastThisYear.map((e) => e.key)).toContain('met-year:5')
  })

  it('finds the next occurrence of a custom day', () => {
    const trip = { id: 't', title: '첫 여행', date: '2022-07-02', yearly: true }
    expect(nextCustomOccurrence(trip, '2026-09-26')!.date).toBe('2027-07-02')
    expect(nextCustomOccurrence({ ...trip, yearly: false }, '2026-09-26')).toBeUndefined()
    // Days still ahead, even past the 400-day list window, are not "지난 날".
    const far = { id: 'f', title: '신혼여행 10주년 여행', date: '2028-05-01', yearly: false }
    expect(nextCustomOccurrence(far, '2026-09-26')!.date).toBe('2028-05-01')
    expect(nextCustomOccurrence({ ...far, yearly: true }, '2026-09-26')!.n).toBeUndefined()
    expect(nextCustomOccurrence({ ...trip, date: '2026-09-26' }, '2026-09-26')!.date).toBe('2026-09-26')
    expect(anniversaryEmoji({ emoji: 42 as unknown as string })).toBe('⭐')
    expect(anniversaryEmoji({ emoji: '✈️' })).toBe('✈️')
  })

  it('validates couple dates and custom days', () => {
    expect(checkPastDate('', '2026-09-26')).toBe('empty')
    expect(checkPastDate('2026-02-30', '2026-09-26')).toBe('invalid')
    expect(checkPastDate('2026-09-27', '2026-09-26')).toBe('future')
    expect(checkPastDate('2026-09-26', '2026-09-26')).toBe('ok')
    expect(checkAnyDate('2027-01-01')).toBe('ok')
    expect(checkAnyDate('0999-01-01')).toBe('invalid')
  })
})

describe('album', () => {
  it('keeps photo entries only, newest first, grouped by month', () => {
    let s = fresh()
    s = addEntry(s, { date: '2026-08-02', author: 'a', text: '', photoId: 'p1' }, '2026-08-02T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-10', author: 'b', text: '글만' }, '2026-09-10T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-12', author: 'b', text: '사진', photoId: 'p2' }, '2026-09-12T10:00:00+09:00')
    s = addEntry(s, { date: '2026-08-20', author: 'a', text: '사진2', photoId: 'p3' }, '2026-08-20T10:00:00+09:00')
    const groups = albumGroups(s.diary)
    expect(groups.map((g) => g.month)).toEqual(['2026-09', '2026-08'])
    expect(groups[1]!.entries.map((e) => e.photoId)).toEqual(['p3', 'p1'])
  })

  it('cuts long text at a code point boundary', () => {
    expect(excerpt('  짧은 글  ')).toBe('짧은 글')
    expect(excerpt('가나다라마', 3)).toBe('가나다…')
    expect(excerpt('😀😀😀', 2)).toBe('😀😀…')
  })
})

describe('album feed (우리 › 앨범, Next B)', () => {
  function withPhotos(): AppState {
    let s = fresh()
    s = addEntry(s, { date: '2026-08-02', author: 'a', text: '', photoId: 'p1' }, '2026-08-02T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-10', author: 'b', text: '글만' }, '2026-09-10T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-12', author: 'b', text: '아침 산책\n두 번째 줄', photoId: 'p2' }, '2026-09-12T10:00:00+09:00')
    s = addEntry(s, { date: '2026-09-12', author: 'a', text: '같은 날 저녁', photoId: 'p4' }, '2026-09-12T19:00:00+09:00')
    s = addEntry(s, { date: '2026-08-20', author: 'a', text: '가'.repeat(ALBUM_CAPTION_MAX + 20), photoId: 'p3' }, '2026-08-20T10:00:00+09:00')
    return s
  }

  it('is flat, photos only, newest first (same day: the later one first), with the month and a caption', () => {
    const feed = albumFeed(withPhotos().diary)
    expect(feed.map((i) => i.entry.photoId)).toEqual(['p4', 'p2', 'p3', 'p1'])
    expect(feed.map((i) => i.month)).toEqual(['2026-09', '2026-09', '2026-08', '2026-08'])
    expect(feed[0]!.caption).toBe('같은 날 저녁')
    expect(feed[1]!.caption).toBe('아침 산책\n두 번째 줄')
    expect(feed[3]!.caption).toBe('') // a photo without words
    // A long story is cut like the viewer's excerpt.
    expect(Array.from(feed[2]!.caption)).toHaveLength(ALBUM_CAPTION_MAX + 1)
    expect(feed[2]!.caption.endsWith('…')).toBe(true)
  })

  it("leaves the other member's '나만 보기' photos out for that viewer, and shows the owner's own", () => {
    let s = withPhotos()
    const hers = s.diary.find((e) => e.photoId === 'p2')!
    s = setEntryPrivacy(s, hers.id, 'b', true)
    expect(albumFeed(s.diary, 'a').map((i) => i.entry.photoId)).toEqual(['p4', 'p3', 'p1'])
    expect(albumFeed(s.diary, 'b').map((i) => i.entry.photoId)).toEqual(['p4', 'p2', 'p3', 'p1'])
    // Without a viewer nothing is hidden (a count, a backup).
    expect(albumFeed(s.diary)).toHaveLength(4)
  })

  it('carries nothing but diary entries — no cycle, test or stage data rides along', () => {
    const s = { ...withPhotos(), lhTests: [{ date: '2026-09-12', result: 'positive', time: '08:00' }] } as AppState
    const json = JSON.stringify(albumFeed(s.diary, 'a'))
    expect(json).not.toContain('lhTests')
    expect(json).not.toContain('positive')
    expect(json).not.toContain('periods')
    for (const item of albumFeed(s.diary, 'a')) expect(Object.keys(item).sort()).toEqual(['caption', 'entry', 'month'])
  })
})

describe('기념일 알림 switch (settings.anniversaryAlerts, Next B)', () => {
  function withDays(): AppState {
    let s = setCoupleDates(fresh(), { metDate: '2021-05-14' })
    s = addAnniversary(s, { title: '첫 여행', date: '2022-10-09', yearly: true })
    return s
  }

  it('sends D-7 and 당일 notices to both by default (unset = on)', () => {
    const s = withDays()
    expect(anniversaryAlertsOn(s.settings)).toBe(true)
    const d7 = anniversaryNotices(s, '2026-10-02')
    expect(d7.map((n) => n.to).sort()).toEqual(['a', 'b'])
    expect(d7[0]!.title).toMatch(/첫 여행.*까지 일주일/)
    const day = anniversaryNotices(s, '2026-10-09')
    expect(day.some((n) => /오늘은 .*첫 여행/.test(n.title))).toBe(true)
  })

  it('sends nothing once the couple turned it off, and again once it is back on', () => {
    const off = setSetting(withDays(), 'anniversaryAlerts', false)
    expect(anniversaryAlertsOn(off.settings)).toBe(false)
    expect(anniversaryNotices(off, '2026-10-02')).toEqual([])
    expect(anniversaryNotices(off, '2026-10-09')).toEqual([])
    const on = setSetting(off, 'anniversaryAlerts', true)
    expect(anniversaryNotices(on, '2026-10-02')).toHaveLength(2)
  })

  it('reads the switch the same way as settings.anniversaryAlertsOn for every stored value', () => {
    for (const value of [undefined, true, false] as const) {
      const s = value === undefined ? withDays() : setSetting(withDays(), 'anniversaryAlerts', value)
      expect(anniversaryNotices(s, '2026-10-02').length > 0).toBe(anniversaryAlertsOn(s.settings))
    }
  })
})
