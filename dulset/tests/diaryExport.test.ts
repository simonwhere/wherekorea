import { describe, expect, it } from 'vitest'
import {
  ALBUM_CAPTION_MAX,
  ALBUM_SECTION,
  DIARY_MAX_TEXT,
  albumOrder,
  buildDiaryHtml,
  excerpt,
  clampDiaryDate,
  diaryDraftKey,
  entryStageLabel,
  escapeHtml,
  filterEntries,
  isDraftEmpty,
  isSafeImageDataURL,
  mapWithConcurrency,
  monthLabel,
  moodLabel,
  parseDiaryDraft,
  serializeDiaryDraft,
  stagesWithEntries,
  storyOrder,
  STAGE_SECTION,
} from '@/lib/logic/diaryExport'
import { koreanDays } from '@/lib/logic/baby'
import { extraStorageKeys } from '@/lib/logic/settings'
import type { Baby, DiaryEntry, Member, Pregnancy } from '@/lib/types'

const members: [Member, Member] = [
  { id: 'a', name: '민수', role: 'husband', tracksCycle: false, emoji: '👨' },
  { id: 'b', name: '지은', role: 'wife', tracksCycle: true, emoji: '👩' },
]

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

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function html(entries: DiaryEntry[], extra: Partial<Parameters<typeof buildDiaryHtml>[0]> = {}): string {
  return buildDiaryHtml({ entries, members, title: '둘이 셋이 되기까지', photos: {}, ...extra })
}

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})

describe('buildDiaryHtml', () => {
  it('returns a complete standalone document', () => {
    const out = html([entry({ date: '2026-09-01' })], { generatedOn: '2026-09-26' })
    expect(out.startsWith('<!doctype html>')).toBe(true)
    expect(out).toContain('<html lang="ko">')
    expect(out).toContain('<meta charset="utf-8">')
    expect(out).toContain('<title>둘이 셋이 되기까지</title>')
    expect(out.trimEnd().endsWith('</html>')).toBe(true)
    // Print-friendly: page setup and no entry split across pages.
    expect(out).toContain('@media print')
    expect(out).toContain('break-inside:avoid')
    // No remote resources.
    expect(out).not.toMatch(/(src|href)="https?:/)
    expect(out).toContain('2026년 9월 26일')
    expect(out).toContain('👨 민수 &amp; 👩 지은')
  })

  it('escapes entry text, names and title — a <script> never survives', () => {
    const evil = entry({ date: '2026-09-02', text: '<script>alert("x")</script>\n<img src=x onerror=alert(1)>' })
    const out = buildDiaryHtml({
      entries: [evil],
      members: [{ ...members[0], name: '<b>민수</b>' }, members[1]],
      title: '</title><script>1</script>',
      photos: {},
    })
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toContain('<img src=x')
    expect(out).not.toContain('<b>민수</b>')
    expect(out).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(out).toContain('&lt;b&gt;민수&lt;/b&gt;')
    expect(out).toContain('<title>&lt;/title&gt;&lt;script&gt;1&lt;/script&gt;</title>')
  })

  it('keeps line breaks (pre-wrap) instead of building markup', () => {
    const out = html([entry({ date: '2026-09-03', text: '첫 줄\r\n둘째 줄' })])
    expect(out).toContain('<p class="text">첫 줄\n둘째 줄</p>')
    expect(out).toContain('white-space:pre-wrap')
  })

  it('tells the story oldest → newest, same-day entries by creation time', () => {
    const late = entry({ date: '2026-09-20', text: '셋째' })
    const early = entry({ date: '2026-09-05', text: '첫째' })
    const sameDayLater = entry({ date: '2026-09-10', text: '둘째-b', createdAt: '2026-09-10T21:00:00+09:00' })
    const sameDayEarlier = entry({ date: '2026-09-10', text: '둘째-a', createdAt: '2026-09-10T08:00:00+09:00' })
    const out = html([late, sameDayLater, early, sameDayEarlier])
    const order = ['첫째', '둘째-a', '둘째-b', '셋째'].map((t) => out.indexOf(`>${t}<`))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(out).toContain('2026년 9월 5일 – 2026년 9월 20일 · 기록 4개')
  })

  it('adds a section heading each time the stage changes, with month headings inside', () => {
    const pregnancy: Pregnancy = { lmp: '2026-10-01', confirmedAt: '2026-11-05' }
    const baby: Baby = { name: '콩이', birthDate: '2027-07-08', sex: 'unknown' }
    const out = html(
      [
        entry({ date: '2027-07-20', stage: 'parenting', text: '육아-1' }),
        entry({ date: '2026-09-01', stage: 'preparing', text: '준비-1' }),
        entry({ date: '2026-11-10', stage: 'pregnant', text: '임신-1' }),
        entry({ date: '2026-10-02', stage: 'preparing', text: '준비-2' }),
      ],
      { pregnancy, baby },
    )
    const h = (s: string) => out.indexOf(`<h2>${s.replace('&', '&amp;')}</h2>`)
    const prep = h(STAGE_SECTION.preparing)
    const preg = h(STAGE_SECTION.pregnant)
    const par = h(STAGE_SECTION.parenting)
    expect(prep).toBeGreaterThan(0)
    expect(prep).toBeLessThan(out.indexOf('준비-1'))
    expect(out.indexOf('준비-2')).toBeLessThan(preg)
    expect(preg).toBeLessThan(out.indexOf('임신-1'))
    expect(out.indexOf('임신-1')).toBeLessThan(par)
    expect(par).toBeLessThan(out.indexOf('육아-1'))
    expect(out.match(/<h2>/g)).toHaveLength(3)
    expect(out.match(/<section class="stage/g)).toHaveLength(3)
    expect(out.match(/<\/section>/g)).toHaveLength(3)
    // Month headings restart per section: 9월, 10월 | 11월 | 7월.
    expect(out.match(/<h3>/g)).toHaveLength(4)
    expect(out).toContain('<h3>2026년 9월</h3>')
    // Badges computed at each entry's own date.
    expect(out).toContain('임신 5주')
    expect(out).toContain('13일째')
  })

  it('opens a new section when a couple goes back to preparing', () => {
    const out = html([
      entry({ date: '2026-09-01', stage: 'preparing' }),
      entry({ date: '2026-10-01', stage: 'pregnant' }),
      entry({ date: '2026-12-01', stage: 'preparing' }),
    ])
    expect(out.match(/<h2>/g)).toHaveLength(3)
  })

  it('embeds photos that exist and skips missing or unsafe ones with a short note', () => {
    const withPhoto = entry({ date: '2026-09-01', photoId: 'p1', text: '사진 있음' })
    const missing = entry({ date: '2026-09-02', photoId: 'gone', text: '' })
    const unsafe = entry({ date: '2026-09-03', photoId: 'bad' })
    const out = html([withPhoto, missing, unsafe], {
      photos: { p1: PNG, bad: 'javascript:alert(1)' },
    })
    // One in the story, and the same one again in the album chapter at the end.
    const story = out.slice(0, out.indexOf('stage-album'))
    expect(story.match(/<img /g)).toHaveLength(1)
    expect(out.match(/<img /g)).toHaveLength(2)
    expect(out).toContain(`<img src="${PNG}"`)
    expect(out).toContain('alt="민수의 사진 · 2026년 9월 1일"')
    expect(out.match(/class="photo-missing"/g)).toHaveLength(2)
    expect(out).not.toContain('javascript:')
    // Photo-only entry with a missing photo still renders its card, without an empty text block.
    expect(out.match(/<article class="entry">/g)).toHaveLength(3)
    expect(out.match(/<p class="text">/g)).toHaveLength(2)
  })

  it('renders a friendly empty document', () => {
    const out = html([])
    expect(out).toContain('아직 남긴 기록이 없어요')
    expect(out).not.toContain('<section')
  })

  describe('album chapter (export order: story, then the photos again)', () => {
    const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    const story = () => [
      entry({ date: '2026-08-02', author: 'a', text: '', photoId: 'p1' }),
      entry({ date: '2026-09-10', author: 'b', text: '글만' }),
      entry({ date: '2026-09-12', author: 'b', text: '아침 산책\n두 번째 줄', photoId: 'p2', createdAt: '2026-09-12T10:00:00+09:00' }),
      entry({ date: '2026-09-12', author: 'a', text: '같은 날 저녁', photoId: 'p4', createdAt: '2026-09-12T19:00:00+09:00' }),
      entry({ date: '2026-08-20', author: 'a', text: '가'.repeat(ALBUM_CAPTION_MAX + 20), photoId: 'p3' }),
    ]
    const photos = { p1: PNG, p2: JPG, p3: PNG, p4: JPG }

    it('comes last, newest first with month headings, the day, the author and a cut caption', () => {
      const out = html(story(), { photos, viewer: 'a' })
      const album = out.slice(out.indexOf('class="stage stage-album"'))
      // After every stage chapter and before the footer.
      expect(out.indexOf('stage-album')).toBeGreaterThan(out.lastIndexOf('class="stage stage-preparing"'))
      expect(album.indexOf('<footer>')).toBeGreaterThan(album.indexOf('</section>'))
      expect(album).toContain(`<h2>${ALBUM_SECTION}</h2>`)
      expect(album).toContain('사진 4장 · 최근 것부터')
      // Newest first; same day: the later one first; month headings where the month changes.
      const srcs = Array.from(album.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)).map((m) => [m[1], m[2]])
      expect(srcs.map((s) => s[1])).toEqual([
        '민수의 사진 · 2026년 9월 12일',
        '지은의 사진 · 2026년 9월 12일',
        '민수의 사진 · 2026년 8월 20일',
        '민수의 사진 · 2026년 8월 2일',
      ])
      expect(album.match(/<h3>/g)).toHaveLength(2)
      expect(album.indexOf('2026년 9월')).toBeLessThan(album.indexOf('2026년 8월'))
      // The same photo bytes as the story card (no second encoding), lazily loaded.
      expect(srcs[0]![0]).toBe(JPG)
      expect(album.match(/loading="lazy"/g)).toHaveLength(4)
      // Captions: the words (pre-wrap, cut at the album length), none for a photo without words.
      expect(album).toContain('<span class="caption">같은 날 저녁</span>')
      expect(album).toContain('<span class="caption">아침 산책\n두 번째 줄</span>')
      expect(album.match(/class="caption"/g)).toHaveLength(3)
      expect(album).toContain(`${'가'.repeat(ALBUM_CAPTION_MAX)}…`)
    })

    it('shows only photos that exist here, and no chapter at all without one', () => {
      const out = html(story(), { photos: { p2: JPG }, viewer: 'b' })
      expect(out.match(/stage-album/g)).toHaveLength(1)
      expect(out).toContain('사진 1장 · 최근 것부터')
      expect(out.slice(out.indexOf('stage-album')).match(/<img /g)).toHaveLength(1)
      expect(html(story(), { photos: {} })).not.toContain('stage-album')
      expect(html([entry({ date: '2026-09-01' })], { photos })).not.toContain(ALBUM_SECTION)
      // Unsafe data never reaches the album either.
      const bad = html([entry({ date: '2026-09-01', photoId: 'x' })], { photos: { x: 'javascript:alert(1)' } })
      expect(bad).not.toContain('stage-album')
      expect(bad).not.toContain('javascript:')
    })

    it("keeps the other member's '나만 보기' photo out for that reader, like the story", () => {
      const list = story()
      const hers = { ...list[2]!, privateTo: 'b' as const }
      const entries = [list[0]!, list[1]!, hers, list[3]!, list[4]!]
      expect(albumOrder(entries, 'a').map((e) => e.photoId)).toEqual(['p4', 'p3', 'p1'])
      expect(albumOrder(entries, 'b').map((e) => e.photoId)).toEqual(['p4', 'p2', 'p3', 'p1'])
      expect(albumOrder(entries).map((e) => e.photoId)).toEqual(['p4', 'p2', 'p3', 'p1'])
      const his = html(entries, { photos, viewer: 'a' })
      expect(his).not.toContain(JPG.slice(0, 30) + '" alt="지은')
      expect(his).not.toContain('아침 산책')
      expect(his.slice(his.indexOf('stage-album'))).toContain('사진 3장')
      const own = html(entries, { photos, viewer: 'b' })
      expect(own.slice(own.indexOf('stage-album'))).toContain('사진 4장')
      expect(own).toContain('아침 산책')
    })

    it('escapes everything a person wrote in a caption', () => {
      const out = html([entry({ date: '2026-09-01', photoId: 'p1', text: '<img onerror=alert(1)> & "따옴표"' })], { photos })
      expect(out).not.toContain('<img onerror')
      expect(out).toContain('&lt;img onerror=alert(1)&gt; &amp; &quot;따옴표&quot;')
    })

    it('cuts a caption at a code point boundary', () => {
      expect(excerpt('  짧은 글  ')).toBe('짧은 글')
      expect(excerpt('가나다라마', 3)).toBe('가나다…')
      expect(excerpt('😀😀😀', 2)).toBe('😀😀…')
    })
  })

  it('labels moods for screen readers', () => {
    const out = html([entry({ date: '2026-09-01', mood: '🥰' })])
    expect(out).toContain('aria-label="설레요"')
  })
})

describe('isSafeImageDataURL', () => {
  it('accepts base64 image data URLs only', () => {
    expect(isSafeImageDataURL(PNG)).toBe(true)
    expect(isSafeImageDataURL('data:image/jpeg;base64,/9j/4AAQ')).toBe(true)
    expect(isSafeImageDataURL('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(isSafeImageDataURL('data:image/png;base64,abc" onerror="x')).toBe(false)
    expect(isSafeImageDataURL('https://example.com/a.jpg')).toBe(false)
    expect(isSafeImageDataURL(undefined)).toBe(false)
  })
})

describe('entryStageLabel', () => {
  const pregnancy: Pregnancy = { lmp: '2026-10-01', confirmedAt: '2026-11-05' }
  const baby: Baby = { name: '콩이', birthDate: '2027-07-08', sex: 'girl' }

  it('shows the week of pregnancy at the entry date', () => {
    expect(entryStageLabel({ stage: 'pregnant', date: '2026-12-10' }, { pregnancy })).toBe('임신 10주')
  })

  it('uses a doctor-adjusted due date when present', () => {
    const adjusted: Pregnancy = { ...pregnancy, dueDateOverride: '2027-07-01' }
    // due 7/1 → LMP-equivalent 2026-09-24 → 2026-12-10 is 11주 0일.
    expect(entryStageLabel({ stage: 'pregnant', date: '2026-12-10' }, { pregnancy: adjusted })).toBe('임신 11주')
  })

  it('counts baby days the Korean way (birth day = 1일째, 백일 = 100일째)', () => {
    expect(entryStageLabel({ stage: 'parenting', date: '2027-07-08' }, { baby })).toBe('태어난 날')
    expect(entryStageLabel({ stage: 'parenting', date: '2027-07-09' }, { baby })).toBe('2일째')
    expect(entryStageLabel({ stage: 'parenting', date: '2027-10-15' }, { baby })).toBe('100일째')
    // Same day as the app's 백일 milestone.
    const baekil = koreanDays(baby.birthDate).find((d) => d.key === 'day100')!
    expect(entryStageLabel({ stage: 'parenting', date: baekil.date }, { baby })).toBe('100일째')
    // Never the ambiguous "생후 N일" (the baby screen uses that for whole days since birth).
    expect(entryStageLabel({ stage: 'parenting', date: '2027-07-20' }, { baby })).not.toMatch(/생후/)
  })

  it('falls back to the plain stage word when data is missing or dates do not line up', () => {
    expect(entryStageLabel({ stage: 'preparing', date: '2026-09-01' }, { pregnancy, baby })).toBe('준비')
    expect(entryStageLabel({ stage: 'pregnant', date: '2026-12-10' }, {})).toBe('임신')
    expect(entryStageLabel({ stage: 'pregnant', date: '2026-09-01' }, { pregnancy })).toBe('임신')
    expect(entryStageLabel({ stage: 'pregnant', date: '2028-01-01' }, { pregnancy })).toBe('임신')
    expect(entryStageLabel({ stage: 'parenting', date: '2027-07-01' }, { baby })).toBe('육아')
    expect(entryStageLabel({ stage: 'parenting', date: '2027-07-10' }, {})).toBe('육아')
  })
})

describe('view helpers', () => {
  const list = [
    entry({ date: '2026-09-01', stage: 'preparing', author: 'a' }),
    entry({ date: '2026-09-02', stage: 'preparing', author: 'b' }),
    entry({ date: '2026-11-02', stage: 'pregnant', author: 'b' }),
  ]

  it('filters by stage and author', () => {
    expect(filterEntries(list, { stage: 'all', author: 'all' })).toHaveLength(3)
    expect(filterEntries(list, { stage: 'preparing', author: 'all' })).toHaveLength(2)
    expect(filterEntries(list, { stage: 'all', author: 'b' })).toHaveLength(2)
    expect(filterEntries(list, { stage: 'pregnant', author: 'a' })).toHaveLength(0)
  })

  it('lists stages that have entries in life order', () => {
    expect(stagesWithEntries([...list].reverse())).toEqual(['preparing', 'pregnant'])
    expect(stagesWithEntries([])).toEqual([])
  })

  it('orders a story without mutating the input', () => {
    const input = [list[2]!, list[0]!, list[1]!]
    const out = storyOrder(input)
    expect(out.map((e) => e.date)).toEqual(['2026-09-01', '2026-09-02', '2026-11-02'])
    expect(input[0]).toBe(list[2])
  })

  it('formats month groups and moods', () => {
    expect(monthLabel('2026-09')).toBe('2026년 9월')
    expect(monthLabel('2027-12')).toBe('2027년 12월')
    expect(moodLabel('😴')).toBe('피곤해요')
    expect(moodLabel(undefined)).toBeUndefined()
    expect(moodLabel('🦄')).toBeUndefined()
  })
})

describe('clampDiaryDate', () => {
  it('allows backdating but not future dates; invalid input falls back to today', () => {
    expect(clampDiaryDate('2026-09-01', '2026-09-26')).toBe('2026-09-01')
    expect(clampDiaryDate('2026-09-26', '2026-09-26')).toBe('2026-09-26')
    expect(clampDiaryDate('2026-10-01', '2026-09-26')).toBe('2026-09-26')
    expect(clampDiaryDate('', '2026-09-26')).toBe('2026-09-26')
    expect(clampDiaryDate('2026-02-30', '2026-09-26')).toBe('2026-09-26')
  })
})

describe('composer draft', () => {
  const today = '2026-09-26'

  it('keys drafts per viewer under the dulset: prefix (cleared by 모든 데이터 지우기)', () => {
    expect(diaryDraftKey('a')).not.toBe(diaryDraftKey('b'))
    const keys = [diaryDraftKey('a'), diaryDraftKey('b'), 'other-app:x', 'dulset:state:v1']
    expect(extraStorageKeys(keys, 'dulset:state:v1')).toEqual([diaryDraftKey('a'), diaryDraftKey('b')])
  })

  it('round-trips text, mood, a past date and a photo id', () => {
    const raw = serializeDiaryDraft({ text: '오늘은\n산책', mood: '😌', date: '2026-09-20', photoId: 'p-1' })
    expect(parseDiaryDraft(raw, today)).toEqual({ text: '오늘은\n산책', mood: '😌', date: '2026-09-20', photoId: 'p-1' })
  })

  it('stores nothing for an empty draft (a date alone is not worth keeping)', () => {
    expect(serializeDiaryDraft({ text: '   ' })).toBeNull()
    expect(serializeDiaryDraft({ text: '', date: '2026-09-01' })).toBeNull()
    expect(isDraftEmpty({ text: '', mood: '😊' })).toBe(false)
    expect(isDraftEmpty({ text: '', photoId: 'p' })).toBe(false)
  })

  it('reads stored drafts defensively', () => {
    expect(parseDiaryDraft(null, today)).toBeNull()
    expect(parseDiaryDraft('not json', today)).toBeNull()
    expect(parseDiaryDraft('[1,2]', today)).toBeNull()
    expect(parseDiaryDraft('{"text":42}', today)).toBeNull()
    // Unknown mood and junk fields are dropped; text is capped.
    const long = '가'.repeat(DIARY_MAX_TEXT + 50)
    const d = parseDiaryDraft(JSON.stringify({ text: long, mood: '🦄', photoId: 7 }), today)
    expect(d?.text).toHaveLength(DIARY_MAX_TEXT)
    expect(d?.mood).toBeUndefined()
    expect(d?.photoId).toBeUndefined()
  })

  it('drops a date that is today or later so the draft follows today', () => {
    expect(parseDiaryDraft('{"text":"a","date":"2026-09-26"}', today)?.date).toBeUndefined()
    expect(parseDiaryDraft('{"text":"a","date":"2026-12-01"}', today)?.date).toBeUndefined()
    expect(parseDiaryDraft('{"text":"a","date":"2026-02-30"}', today)?.date).toBeUndefined()
    expect(parseDiaryDraft('{"text":"a","date":"2026-09-25"}', today)?.date).toBe('2026-09-25')
  })
})

describe('mapWithConcurrency', () => {
  it('keeps input order, never exceeds the limit and reports progress', async () => {
    let inFlight = 0
    let peak = 0
    const progress: number[] = []
    const out = await mapWithConcurrency(
      [5, 1, 4, 2, 3, 0],
      2,
      async (n, i) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, n))
        inFlight--
        return `${i}:${n}`
      },
      (done) => progress.push(done),
    )
    expect(out).toEqual(['0:5', '1:1', '2:4', '3:2', '4:3', '5:0'])
    expect(peak).toBe(2)
    expect(progress).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('handles an empty list and a silly limit', async () => {
    expect(await mapWithConcurrency([], 4, async (x: number) => x)).toEqual([])
    expect(await mapWithConcurrency([1, 2], 0, async (x) => x * 2)).toEqual([2, 4])
  })

  it('rejects when a call fails (the caller catches per item when it wants to skip)', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (x) => {
        if (x === 2) throw new Error('boom')
        return x
      }),
    ).rejects.toThrow('boom')
  })
})
