import { describe, expect, it } from 'vitest'
import { DATE_IDEAS, DATE_TIP_SOURCES, type DateIdea } from '@/lib/content/dateIdeas'
import { addDays, weekdayIndex } from '@/lib/dates'
import { createInitialState } from '@/lib/initial'
import {
  acceptDatePlan,
  addDatePlan,
  browseIdeas,
  buildDatePlan,
  canMarkDone,
  categoriesFor,
  dateBanner,
  fertileHintsAllowed,
  hashString,
  ideaTip,
  isPlanAccepted,
  mapLinks,
  mondayOf,
  pastPlans,
  pickIdeas,
  planDateHint,
  planIcsEvent,
  proposalBody,
  proposeDatePlan,
  proposePlanNotice,
  recentlyPlannedIdeaIds,
  removeDatePlan,
  seasonFit,
  seasonOf,
  suggestPlanDate,
  thisSaturday,
  toggleDatePlanDone,
  upcomingIdeaDates,
  upcomingPlans,
  validatePlan,
  visibleFlags,
} from '@/lib/logic/dateIdeas'
import { fertilityStatus, upcomingWindows } from '@/lib/logic/cycle'
import { markPositivePending, startRestCycle } from '@/lib/logic/ttc'
import type { AppState, DatePlan, Settings, Stage } from '@/lib/types'

// Cycle: period 2026-09-01, 28 days → fertile 09-10..09-15 (ovulation 09-15),
// next period 09-29, next fertile 10-08..10-13.
function fresh(over: Partial<AppState> = {}, settings: Partial<Settings> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over, settings: { ...s.settings, ...settings } }
}

const ids = (list: DateIdea[]) => list.map((i) => i.id)
const NOW = '2026-09-26T10:00:00+09:00'
const PRESSURE_WORDS = /숙제|관계를 가져야|실패|노력 부족|오늘 꼭/
const EXPLICIT_WORDS = /성관계|섹스|잠자리|임신 시도|배란일/

describe('seasonOf', () => {
  it('maps months to Korean seasons', () => {
    expect(seasonOf('2026-03-01')).toBe('spring')
    expect(seasonOf('2026-05-31')).toBe('spring')
    expect(seasonOf('2026-06-01')).toBe('summer')
    expect(seasonOf('2026-08-31')).toBe('summer')
    expect(seasonOf('2026-09-26')).toBe('fall')
    expect(seasonOf('2026-11-30')).toBe('fall')
    expect(seasonOf('2026-12-01')).toBe('winter')
    expect(seasonOf('2027-01-15')).toBe('winter')
    expect(seasonOf('2027-02-28')).toBe('winter')
  })

  it('knows when an idea fits the season', () => {
    expect(seasonFit({ seasons: ['spring', 'fall'] }, 'fall')).toBe('in')
    expect(seasonFit({ seasons: ['spring'] }, 'winter')).toBe('out')
    expect(seasonFit({}, 'winter')).toBe('any')
  })
})

describe('week helpers', () => {
  it('finds the Monday of the week (Mon–Sun weeks)', () => {
    expect(mondayOf('2026-09-21')).toBe('2026-09-21') // Monday
    expect(mondayOf('2026-09-26')).toBe('2026-09-21') // Saturday
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
  })

  it('finds this Saturday', () => {
    expect(thisSaturday('2026-09-26')).toBe('2026-09-26')
    expect(thisSaturday('2026-09-21')).toBe('2026-09-26')
    expect(thisSaturday('2026-09-27')).toBe('2026-10-03')
  })

  it('hashes deterministically', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
    expect(hashString('')).toBeGreaterThanOrEqual(0)
  })
})

describe('pickIdeas', () => {
  const opts = { today: '2026-09-23', stage: 'preparing' as Stage }

  it('returns 3 ideas by default, the same all week', () => {
    const week = ids(pickIdeas(DATE_IDEAS, opts))
    expect(week).toHaveLength(3)
    for (let d = 0; d < 7; d++) {
      expect(ids(pickIdeas(DATE_IDEAS, { ...opts, today: addDays('2026-09-21', d) }))).toEqual(week)
    }
  })

  it('rotates from week to week', () => {
    const weeks = Array.from({ length: 8 }, (_, w) =>
      ids(pickIdeas(DATE_IDEAS, { ...opts, today: addDays('2026-09-07', w * 7) })),
    )
    const unique = new Set(weeks.flat())
    expect(unique.size).toBeGreaterThan(6)
    const changes = weeks.slice(1).filter((w, i) => w.join() !== weeks[i]!.join()).length
    expect(changes).toBeGreaterThanOrEqual(6)
  })

  it('spreads picks across categories', () => {
    for (let w = 0; w < 12; w++) {
      const picks = pickIdeas(DATE_IDEAS, {
        ...opts,
        today: addDays('2026-01-05', w * 30),
      })
      expect(new Set(picks.map((p) => p.category)).size).toBe(3)
    }
  })

  it('favours the season: no out-of-season picks while others are available', () => {
    for (const today of ['2026-01-14', '2026-04-15', '2026-07-15', '2026-10-14']) {
      for (const stage of ['preparing', 'pregnant', 'parenting'] as Stage[]) {
        const season = seasonOf(today)
        for (const p of pickIdeas(DATE_IDEAS, { today, stage })) expect(seasonFit(p, season)).not.toBe('out')
      }
    }
  })

  it('only picks ideas for the stage', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as Stage[]) {
      for (let w = 0; w < 10; w++) {
        const picks = pickIdeas(DATE_IDEAS, {
          today: addDays('2026-09-07', w * 7),
          stage,
        })
        expect(picks).toHaveLength(3)
        for (const p of picks) expect(p.stages).toContain(stage)
      }
    }
  })

  it('skips excluded ideas and replaces them', () => {
    const first = ids(pickIdeas(DATE_IDEAS, opts))
    const next = ids(pickIdeas(DATE_IDEAS, { ...opts, excludeIds: first }))
    expect(next).toHaveLength(3)
    for (const id of first) expect(next).not.toContain(id)
  })

  it('falls back to excluded ideas when nothing else is left', () => {
    const pool = DATE_IDEAS.slice(0, 4)
    const picks = pickIdeas(pool, {
      ...opts,
      stage: 'preparing',
      excludeIds: pool.map((i) => i.id).slice(0, 3),
    })
    expect(picks).toHaveLength(3)
    expect(picks[0]!.id).toBe(pool[3]!.id)
  })

  it('respects count and handles empty lists', () => {
    expect(pickIdeas(DATE_IDEAS, { ...opts, count: 5 })).toHaveLength(5)
    expect(pickIdeas(DATE_IDEAS, { ...opts, count: 0 })).toEqual([])
    expect(pickIdeas([], opts)).toEqual([])
  })

  it('differs per stage in the same week', () => {
    const a = ids(pickIdeas(DATE_IDEAS, { ...opts, stage: 'preparing' }))
    const c = ids(pickIdeas(DATE_IDEAS, { ...opts, stage: 'parenting' }))
    expect(a).not.toEqual(c)
  })
})

describe('recentlyPlannedIdeaIds', () => {
  const plan = (date: string, ideaId?: string): DatePlan => ({
    id: `${date}-${ideaId}`,
    date,
    ideaId,
    title: 't',
    done: false,
    createdBy: 'a',
  })

  it('covers the last 30 days and upcoming plans', () => {
    const plans = [
      plan('2026-08-26', 'picnic'), // 31 days ago
      plan('2026-08-27', 'pottery'), // 30 days ago
      plan('2026-10-10', 'hocance'),
      plan('2026-09-20'),
      plan('2026-09-21', 'pottery'),
    ]
    expect(recentlyPlannedIdeaIds(plans, '2026-09-26').sort()).toEqual(['hocance', 'pottery'])
  })
})

describe('browseIdeas', () => {
  it('filters by stage, category and budget', () => {
    const all = browseIdeas(DATE_IDEAS, 'preparing', '2026-09-26')
    expect(all.length).toBe(DATE_IDEAS.filter((i) => i.stages.includes('preparing')).length)
    const home = browseIdeas(DATE_IDEAS, 'preparing', '2026-09-26', {
      category: 'home',
    })
    expect(home.length).toBeGreaterThan(0)
    expect(home.every((i) => i.category === 'home')).toBe(true)
    const cheap = browseIdeas(DATE_IDEAS, 'preparing', '2026-09-26', {
      budget: 1,
      category: 'all',
    })
    expect(cheap.every((i) => i.budget === 1)).toBe(true)
    expect(browseIdeas(DATE_IDEAS, 'parenting', '2026-09-26').every((i) => i.stages.includes('parenting'))).toBe(true)
  })

  it('lists in-season ideas first and out-of-season last', () => {
    const list = browseIdeas(DATE_IDEAS, 'preparing', '2026-09-26')
    const fits = list.map((i) => ({ in: 0, any: 1, out: 2 })[seasonFit(i, 'fall')])
    expect([...fits].sort((a, b) => a - b)).toEqual(fits)
  })

  it('offers only categories that exist for the stage', () => {
    expect(categoriesFor(DATE_IDEAS, 'preparing')).toEqual(['home', 'walk', 'food', 'culture', 'drive', 'trip', 'stay'])
    for (const c of categoriesFor(DATE_IDEAS, 'parenting')) {
      expect(DATE_IDEAS.some((i) => i.category === c && i.stages.includes('parenting'))).toBe(true)
    }
  })
})

describe('mapLinks', () => {
  it('builds key-free Kakao and Naver search links', () => {
    const l = mapLinks('루프탑 레스토랑')
    expect(l.kakao).toBe(`https://map.kakao.com/link/search/${encodeURIComponent('루프탑 레스토랑')}`)
    expect(l.naver).toBe(`https://map.naver.com/p/search/${encodeURIComponent('루프탑 레스토랑')}`)
    expect(l.kakao).toContain('%20')
    expect(l.kakao).not.toContain(' ')
  })

  it('escapes reserved characters and trims', () => {
    const l = mapLinks('  a/b&c?d#e ')
    expect(l.kakao).toBe('https://map.kakao.com/link/search/a%2Fb%26c%3Fd%23e')
    expect(l.naver).toBe('https://map.naver.com/p/search/a%2Fb%26c%3Fd%23e')
  })
})

describe('badges and tips', () => {
  const hocance = DATE_IDEAS.find((i) => i.id === 'hocance')!

  it('hides health badges after birth', () => {
    expect(visibleFlags(hocance, 'preparing')).toEqual(['no-heat', 'no-alcohol'])
    expect(visibleFlags(hocance, 'pregnant')).toEqual(['no-heat', 'no-alcohol'])
    expect(visibleFlags(hocance, 'parenting')).toEqual([])
    expect(visibleFlags({ flags: ['low-energy', 'no-alcohol'] }, 'parenting')).toEqual(['low-energy'])
    expect(visibleFlags({}, 'preparing')).toEqual([])
  })

  it("shows '아기와 함께' only once the baby is here", () => {
    const flags = { flags: ['baby-friendly', 'low-energy'] as DateIdea['flags'] }
    expect(visibleFlags(flags, 'preparing')).toEqual(['low-energy'])
    expect(visibleFlags(flags, 'pregnant')).toEqual(['low-energy'])
    expect(visibleFlags(flags, 'parenting')).toEqual(['baby-friendly', 'low-energy'])
  })

  it('shows the heat tip with its source while preparing', () => {
    expect(ideaTip(hocance, 'preparing')).toBe(
      '뜨거운 탕·사우나 대신 수영장·산책 (남성은 고환 온도가 오르면 정자 질이 떨어져요 — Garolla 2013)',
    )
    expect(ideaTip(hocance, 'parenting')).not.toMatch(/정자|고환/)
    expect(ideaTip({ tip: 'x' }, 'pregnant')).toBe('x')
    expect(ideaTip({ tip: 'x', stageTips: { pregnant: 'y' } }, 'pregnant')).toBe('y')
  })
})

describe('content', () => {
  it('has ~30+ ideas with unique ids and required fields', () => {
    expect(DATE_IDEAS.length).toBeGreaterThanOrEqual(30)
    expect(new Set(DATE_IDEAS.map((i) => i.id)).size).toBe(DATE_IDEAS.length)
    for (const i of DATE_IDEAS) {
      expect(i.title && i.description && i.why && i.mapQuery.trim()).toBeTruthy()
      expect(i.stages.length).toBeGreaterThan(0)
    }
  })

  it('has at least 3 categories of in-season ideas for every stage and season', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as Stage[]) {
      for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
        const ok = DATE_IDEAS.filter((i) => i.stages.includes(stage) && seasonFit(i, season) !== 'out')
        expect(new Set(ok.map((i) => i.category)).size).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('never uses pressure or explicit wording', () => {
    for (const i of DATE_IDEAS) {
      const text = [i.title, i.description, i.why, i.tip ?? '', ...Object.values(i.stageTips ?? {})].join(' ')
      expect(text).not.toMatch(PRESSURE_WORDS)
      expect(text).not.toMatch(EXPLICIT_WORDS)
    }
  })

  it('attaches heat guidance to every no-heat idea while preparing', () => {
    for (const i of DATE_IDEAS.filter((x) => x.flags?.includes('no-heat'))) {
      expect(ideaTip(i, 'preparing')).toMatch(/탕|사우나|스파|자쿠지/)
    }
  })

  it('includes the WhereKorea couple destinations', () => {
    for (const id of [
      'gangneung',
      'gyeongju',
      'yeosu',
      'chuncheon',
      'namhae',
      'tongyeong',
      'jeju',
      'damyang-boseong',
    ]) {
      expect(DATE_IDEAS.some((i) => i.id === `trip-${id}`)).toBe(true)
    }
  })
})

describe('dateBanner', () => {
  it('softly marks our week around the fertile window', () => {
    for (const viewer of ['a', 'b'] as const) {
      expect(dateBanner(fresh(), '2026-09-11', viewer).kind).toBe('our-week')
      expect(dateBanner(fresh(), '2026-09-07', viewer).kind).toBe('our-week') // 3 days before
    }
    expect(dateBanner(fresh(), '2026-09-06', 'a').kind).toBe('preparing') // 4 days before
    expect(dateBanner(fresh(), '2026-09-20', 'a').kind).toBe('preparing')
    const b = dateBanner(fresh(), '2026-09-11', 'a')
    expect(b.title).toBe('이번 주는 우리의 주간 💞')
    expect(b.body).toBe('무리하지 말고 같이 있는 시간 자체를 즐겨요.')
  })

  it("respects low-pressure mode and a viewer's 'off' style", () => {
    const low = dateBanner(fresh({}, { lowPressure: true }), '2026-09-11', 'b')
    expect(low.kind).toBe('low-pressure')
    expect(low.title).toBe('주기 상관없이, 자주 함께하는 게 제일 좋아요')
    const off = fresh({}, { alertStyle: { a: 'off', b: 'explicit' } })
    expect(dateBanner(off, '2026-09-11', 'a').kind).toBe('preparing')
    expect(dateBanner(off, '2026-09-11', 'b').kind).toBe('our-week')
  })

  it('switches with the stage', () => {
    expect(dateBanner(fresh({ stage: 'pregnant' }), '2026-09-11', 'a').title).toContain('태교 여행·산책')
    expect(dateBanner(fresh({ stage: 'parenting' }), '2026-09-11', 'a').title).toBe('아기 재운 뒤 30분, 둘만의 시간')
  })

  it('adds a heat/alcohol note before birth only', () => {
    expect(dateBanner(fresh(), '2026-09-11', 'a').note).toMatch(/술.*사우나/)
    expect(dateBanner(fresh({}, { lowPressure: true }), '2026-09-11', 'a').note).toMatch(/술/)
    expect(dateBanner(fresh({ stage: 'pregnant' }), '2026-09-11', 'a').note).toMatch(/사우나/)
    expect(dateBanner(fresh({ stage: 'parenting' }), '2026-09-11', 'a').note).toBeUndefined()
  })

  it('never uses pressure or countdown wording', () => {
    const states = [
      fresh(),
      fresh({}, { lowPressure: true }),
      fresh({ stage: 'pregnant' }),
      fresh({ stage: 'parenting' }),
    ]
    for (const s of states) {
      for (const d of ['2026-09-07', '2026-09-11', '2026-09-20']) {
        const b = dateBanner(s, d, 'a')
        const text = `${b.title} ${b.body} ${b.note ?? ''}`
        expect(text).not.toMatch(PRESSURE_WORDS)
        expect(text).not.toMatch(/D-\d|가임기|배란/)
      }
    }
  })

  it('works without cycle data', () => {
    expect(dateBanner(fresh({ periods: [] }), '2026-09-11', 'a').kind).toBe('preparing')
  })

  it('stays quiet about 우리의 주간 in a rest cycle or while a positive test awaits the clinic', () => {
    const rest = startRestCycle(fresh(), '2026-09-05')
    const pending = markPositivePending(fresh(), '2026-09-09')
    for (const s of [rest, pending]) {
      for (const viewer of ['a', 'b'] as const) {
        expect(dateBanner(s, '2026-09-11', viewer).kind).toBe('preparing')
        expect(fertileHintsAllowed(s, viewer)).toBe(false)
      }
    }
    // The next logged period ends the rest cycle (and settles the pending test): back to normal.
    const after = { ...rest, periods: [...rest.periods, { start: '2026-09-29' }] }
    expect(dateBanner(after, '2026-10-06', 'a').kind).toBe('our-week')
    expect(fertileHintsAllowed({ ...pending, periods: [...pending.periods, { start: '2026-09-29' }] }, 'b')).toBe(true)
  })
})

describe('suggestPlanDate', () => {
  it('suggests the coming Saturday, never a day picked from the fertile window', () => {
    // 09-11 is inside the estimated window (09-10..09-15): still the Saturday.
    expect(suggestPlanDate(fresh(), '2026-09-11', 'a')).toEqual({ date: '2026-09-12', reason: 'saturday' })
    expect(suggestPlanDate(fresh(), '2026-09-08', 'a')).toEqual({ date: '2026-09-12', reason: 'saturday' })
    expect(suggestPlanDate(fresh(), '2026-09-15', 'a')).toEqual({ date: '2026-09-19', reason: 'saturday' })
    expect(suggestPlanDate(fresh(), '2026-09-20', 'a')).toEqual({ date: '2026-09-26', reason: 'saturday' })
    expect(suggestPlanDate(fresh({ stage: 'pregnant' }), '2026-09-11', 'a')).toEqual({ date: '2026-09-12', reason: 'saturday' })
    expect(suggestPlanDate(fresh({ periods: [] }), '2026-09-21', 'a')).toEqual({ date: '2026-09-26', reason: 'saturday' })
  })

  it('is the same for both people and every alert style (no pattern to learn)', () => {
    const states = [
      fresh(),
      fresh({}, { lowPressure: true }),
      fresh({}, { alertStyle: { a: 'explicit', b: 'explicit' } }),
      fresh({}, { alertStyle: { a: 'off', b: 'soft' } }),
    ]
    for (let d = 0; d < 28; d++) {
      const today = addDays('2026-09-01', d)
      for (const s of states) {
        for (const viewer of ['a', 'b'] as const) {
          const got = suggestPlanDate(s, today, viewer)
          expect(got).toEqual({ date: thisSaturday(today), reason: 'saturday' })
          // Never a weekday picked for the window: always a Saturday.
          expect(weekdayIndex(got.date)).toBe(6)
        }
      }
    }
  })

  it('moves to the Saturday after when the coming one already has a plan', () => {
    let s = addDatePlan(fresh(), { date: '2026-09-12', title: '산책', createdBy: 'b' }, 'p1')
    expect(suggestPlanDate(s, '2026-09-08')).toEqual({ date: '2026-09-19', reason: 'next-saturday' })
    // A plan already done (or on another day) doesn't count.
    s = toggleDatePlanDone(s, 'p1')
    expect(suggestPlanDate(s, '2026-09-08')).toEqual({ date: '2026-09-12', reason: 'saturday' })
    const other = addDatePlan(fresh(), { date: '2026-09-13', title: '산책', createdBy: 'b' }, 'p2')
    expect(suggestPlanDate(other, '2026-09-08').reason).toBe('saturday')
  })
})

describe('date plans', () => {
  it('adds a cleaned-up plan', () => {
    const s = addDatePlan(
      fresh(),
      {
        date: '2026-10-03',
        title: '  도자기 공방 ',
        ideaId: 'pottery',
        place: ' ',
        note: ' 오후 2시 ',
        createdBy: 'a',
      },
      'p1',
    )
    expect(s.datePlans).toEqual([
      {
        id: 'p1',
        date: '2026-10-03',
        title: '도자기 공방',
        ideaId: 'pottery',
        note: '오후 2시',
        done: false,
        createdBy: 'a',
      },
    ])
    expect(buildDatePlan({ date: '2026-10-03', title: 'x'.repeat(80), createdBy: 'b' }, 'p').title).toHaveLength(40)
  })

  it('validates the date and title', () => {
    expect(validatePlan({ date: '2026-09-26', title: '산책' }, '2026-09-26')).toBeNull()
    expect(validatePlan({ date: '2026-09-25', title: '산책' }, '2026-09-26')).toBe('date')
    expect(validatePlan({ date: '2026-02-30', title: '산책' }, '2026-01-01')).toBe('date')
    expect(validatePlan({ date: '2026-10-01', title: '   ' }, '2026-09-26')).toBe('title')
  })

  it('toggles done and removes', () => {
    let s = addDatePlan(fresh(), { date: '2026-09-26', title: '산책', createdBy: 'a' }, 'p1')
    s = toggleDatePlanDone(s, 'p1')
    expect(s.datePlans[0]!.done).toBe(true)
    s = toggleDatePlanDone(s, 'p1')
    expect(s.datePlans[0]!.done).toBe(false)
    expect(toggleDatePlanDone(s, 'nope')).toBe(s)
    expect(removeDatePlan(s, 'nope')).toBe(s)
    expect(removeDatePlan(s, 'p1').datePlans).toEqual([])
  })

  it('splits upcoming and past plans', () => {
    let s = fresh()
    s = addDatePlan(s, { date: '2026-10-10', title: 'C', createdBy: 'a' }, 'c')
    s = addDatePlan(s, { date: '2026-09-26', title: 'B', createdBy: 'b' }, 'b')
    s = addDatePlan(s, { date: '2026-09-20', title: 'A', createdBy: 'a' }, 'a')
    s = addDatePlan(s, { date: '2026-09-27', title: 'D', createdBy: 'a' }, 'd')
    s = toggleDatePlanDone(s, 'd')
    expect(upcomingPlans(s, '2026-09-26').map((p) => p.id)).toEqual(['b', 'c'])
    expect(pastPlans(s, '2026-09-26').map((p) => p.id)).toEqual(['d', 'a'])
    expect(canMarkDone({ date: '2026-09-26' }, '2026-09-26')).toBe(true)
    expect(canMarkDone({ date: '2026-09-27' }, '2026-09-26')).toBe(false)
  })

  it('exports a plan as an all-day calendar event', () => {
    const e = planIcsEvent({
      id: 'p1',
      date: '2026-10-03',
      title: '산책',
      place: '한강',
      done: false,
      createdBy: 'a',
    })
    expect(e).toMatchObject({
      uid: 'date-p1@dulset',
      start: '2026-10-03',
      end: '2026-10-03',
      title: '💞 산책',
    })
    expect(e.description).toBe('장소: 한강')
    expect(
      'description' in
        planIcsEvent({
          id: 'p2',
          date: '2026-10-03',
          title: 'x',
          done: false,
          createdBy: 'a',
        }),
    ).toBe(false)
  })
})

describe('partner notices', () => {
  it('tells the partner when I propose a date', () => {
    const s = proposeDatePlan(
      fresh(),
      {
        date: '2026-10-03',
        title: '도자기 공방',
        place: '성수',
        createdBy: 'a',
      },
      NOW,
      'p1',
    )
    expect(s.datePlans).toHaveLength(1)
    expect(s.notifications).toHaveLength(1)
    const n = s.notifications[0]!
    expect(n).toMatchObject({
      to: 'b',
      from: 'a',
      kind: 'date-idea',
      read: false,
      key: 'date-plan:p1',
      createdAt: NOW,
    })
    expect(n.title).toBe('💌 민수님이 10월 3일 (토) 데이트를 제안했어요')
    expect(n.body).toBe('도자기 공방 · 📍 성수')
    expect(`${n.title} — ${n.body}`).toMatch(/^💌 민수님이 10월 3일 \(토\) 데이트를 제안했어요 — 도자기 공방/)
  })

  it('goes the other way when the partner proposes, and only once per plan', () => {
    const s = proposeDatePlan(fresh(), { date: '2026-10-04', title: '산책', createdBy: 'b' }, NOW, 'p2')
    expect(s.notifications[0]).toMatchObject({ to: 'a', from: 'b' })
    expect(s.notifications[0]!.title).toContain('지은님이')
    const again = proposePlanNotice(s, s.datePlans[0]!, NOW)
    expect(again.notifications).toHaveLength(1)
  })

  it('builds a short body', () => {
    expect(proposalBody({ title: '산책' })).toBe('산책')
    expect(proposalBody({ title: '산책', note: '저녁 7시' })).toBe('산책 · “저녁 7시”')
  })

  it('lets the partner say 좋아요 once', () => {
    let s = proposeDatePlan(fresh(), { date: '2026-10-03', title: '산책', createdBy: 'a' }, NOW, 'p1')
    expect(acceptDatePlan(s, 'p1', 'a', NOW)).toBe(s) // can't accept my own
    expect(acceptDatePlan(s, 'missing', 'b', NOW)).toBe(s)
    expect(isPlanAccepted(s, 'p1', 'b')).toBe(false)
    s = acceptDatePlan(s, 'p1', 'b', NOW)
    expect(isPlanAccepted(s, 'p1', 'b')).toBe(true)
    const reply = s.notifications.find((n) => n.key === 'date-ok:p1:b')!
    expect(reply).toMatchObject({ to: 'a', from: 'b', kind: 'date-idea' })
    expect(reply.title).toBe('👍 지은님이 10월 3일 (토) 데이트 좋대요')
    expect(acceptDatePlan(s, 'p1', 'b', NOW).notifications).toHaveLength(s.notifications.length)
  })
})

describe('review fixes', () => {
  it('does not suggest a day in the projected window while the period is late', () => {
    // Expected period 09-29; on 10-01 it is 2 days late and the projected next
    // window (10-08) is within a week — still, no "우리의 주간" suggestion.
    const s = fresh()
    expect(fertilityStatus(s, '2026-10-01').kind).toBe('late')
    // The projection itself is withheld while late (cycle.forecastLimit).
    expect(upcomingWindows(s, '2026-10-01', 1)).toEqual([])
    expect(suggestPlanDate(s, '2026-10-01', 'b')).toEqual({ date: '2026-10-03', reason: 'saturday' })
    expect(dateBanner(s, '2026-10-01', 'b').kind).toBe('preparing')
  })

  it('explains the suggested date without ambiguity', () => {
    expect(planDateHint({ date: '2026-10-03', reason: 'saturday' }, '2026-09-27')).toBe(
      '다가오는 토요일(10월 3일)로 골라 뒀어요.',
    )
    expect(planDateHint({ date: '2026-09-26', reason: 'saturday' }, '2026-09-26')).toBe('오늘, 토요일로 골라 뒀어요.')
    expect(planDateHint({ date: '2026-10-10', reason: 'next-saturday' }, '2026-09-28')).toBe(
      '이번 토요일엔 일정이 있어서 다음 토요일(10월 10일)로 골라 뒀어요. 편한 날로 바꿔도 좋아요.',
    )
    for (const h of [
      planDateHint({ date: '2026-10-10', reason: 'next-saturday' }, '2026-09-28'),
      planDateHint({ date: '2026-10-03', reason: 'saturday' }, '2026-09-27'),
    ]) {
      expect(h).not.toMatch(PRESSURE_WORDS)
      expect(h).not.toMatch(/가임기|배란/)
    }
  })

  it('knows which ideas already have an upcoming plan (soonest date)', () => {
    let s = fresh()
    s = addDatePlan(s, { date: '2026-10-10', title: 'x', ideaId: 'pottery', createdBy: 'a' }, 'p1')
    s = addDatePlan(s, { date: '2026-10-03', title: 'x', ideaId: 'pottery', createdBy: 'b' }, 'p2')
    s = addDatePlan(s, { date: '2026-09-20', title: 'x', ideaId: 'picnic', createdBy: 'a' }, 'p3') // past
    s = addDatePlan(s, { date: '2026-09-27', title: 'x', ideaId: 'hocance', createdBy: 'a' }, 'p4')
    s = toggleDatePlanDone(s, 'p4') // done
    s = addDatePlan(s, { date: '2026-09-26', title: 'x', createdBy: 'a' }, 'p5') // no idea
    const m = upcomingIdeaDates(s.datePlans, '2026-09-26')
    expect([...m.entries()]).toEqual([['pottery', '2026-10-03']])
  })

  it('marks the proposal read when the partner says 좋아요', () => {
    let s = proposeDatePlan(fresh(), { date: '2026-10-03', title: '산책', createdBy: 'a' }, NOW, 'p1')
    expect(s.notifications.find((n) => n.key === 'date-plan:p1')!.read).toBe(false)
    s = acceptDatePlan(s, 'p1', 'b', NOW)
    expect(s.notifications.find((n) => n.key === 'date-plan:p1')!.read).toBe(true)
    // The reply itself is unread for the proposer.
    expect(s.notifications.find((n) => n.key === 'date-ok:p1:b')!.read).toBe(false)
  })

  it('cites stage-appropriate sources for the health tips', () => {
    expect(DATE_TIP_SOURCES.preparing.map((x) => x.url)).toContain('https://pubmed.ncbi.nlm.nih.gov/23411620/')
    expect(DATE_TIP_SOURCES.pregnant.map((x) => x.url)).toContain('https://pubmed.ncbi.nlm.nih.gov/1640616/')
    expect(DATE_TIP_SOURCES.pregnant.map((x) => x.url)).not.toContain('https://pubmed.ncbi.nlm.nih.gov/23411620/')
    expect(DATE_TIP_SOURCES.parenting).toEqual([])
    for (const list of Object.values(DATE_TIP_SOURCES)) for (const x of list) expect(x.url).toMatch(/^https:\/\//)
  })

  it('keeps fertile-window wording out of idea cards (shown to every alert style)', () => {
    for (const i of DATE_IDEAS) {
      const text = [i.title, i.description, i.why, i.tip ?? '', ...Object.values(i.stageTips ?? {})].join(' ')
      expect(text).not.toMatch(/가임기|배란|D-\d/)
    }
  })
})
