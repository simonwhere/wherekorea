import { describe, expect, it } from 'vitest'
import {
  GUIDE_SECTIONS,
  NICE_GUIDANCE,
  ESTIMATE_DISCLAIMER,
  doctorAgeLine,
  doctorGuideMonths,
  guideSections,
  guideSources,
} from '@/lib/content/fertility'
import { addDays, range } from '@/lib/dates'
import { dayInfo, type CycleInput } from '@/lib/logic/cycle'
import {
  averageSourceLabel,
  canShiftMonth,
  cellView,
  PHASE_CLASS,
  cycleSummary,
  dayActions,
  dayChanceLabel,
  dayTitle,
  explainDay,
  fertilityView,
  icsAvailability,
  irregularMessage,
  legendItems,
  monthOffset,
  monthTitle,
  periodCovering,
  periodHistory,
  phaseLabel,
  shiftMonth,
  statusHeadline,
  viewNotice,
  visiblePhase,
  type FertilityView,
} from '@/lib/logic/calendarView'
import type { Settings } from '@/lib/types'

const base = (over: Partial<CycleInput> = {}): CycleInput => ({
  periods: [{ start: '2026-09-01', end: '2026-09-05' }],
  lhTests: [],
  cycle: { cycleLength: 28, periodLength: 5 },
  ...over,
})

const settings = (over: Partial<Settings> = {}): Settings => ({
  discreet: false,
  browserNotifications: false,
  lowPressure: false,
  alertStyle: { a: 'soft', b: 'explicit' },
  ...over,
})

const PRESSURE_WORDS = /숙제|관계를 가져야|실패|노력 부족|오늘 꼭/

describe('fertilityView', () => {
  it('hides everything in low-pressure mode', () => {
    expect(fertilityView(settings({ lowPressure: true }), 'b', 'b')).toBe('hidden')
    expect(fertilityView(settings({ lowPressure: true }), 'a', 'b')).toBe('hidden')
  })

  it('follows each viewer’s alert style', () => {
    expect(fertilityView(settings(), 'b', 'b')).toBe('explicit')
    expect(fertilityView(settings(), 'a', 'b')).toBe('soft')
    expect(fertilityView(settings({ alertStyle: { a: 'explicit', b: 'explicit' } }), 'a', 'b')).toBe('explicit')
  })

  it("'off' hides estimates for the partner but not for the cycle owner", () => {
    const s = settings({ alertStyle: { a: 'off', b: 'off' } })
    expect(fertilityView(s, 'a', 'b')).toBe('hidden')
    expect(fertilityView(s, 'b', 'b')).toBe('explicit')
  })

  it('defaults when alertStyle is missing (older saved state)', () => {
    const s = { lowPressure: false } as Settings
    expect(fertilityView(s, 'b', 'b')).toBe('explicit')
    expect(fertilityView(s, 'a', 'b')).toBe('soft')
  })
})

describe('phase labels', () => {
  it('drops fertile phases in the hidden view only', () => {
    expect(visiblePhase('peak', 'hidden')).toBe('none')
    expect(visiblePhase('possible', 'hidden')).toBe('none')
    expect(visiblePhase('period-predicted', 'hidden')).toBe('period-predicted')
    expect(visiblePhase('peak', 'soft')).toBe('peak')
  })

  it('words fertile days per view', () => {
    expect(phaseLabel('peak', 'explicit')).toBe('가임기 예상, 가능성 높음')
    expect(phaseLabel('fertile', 'soft')).toBe('우리의 주간 예상')
    expect(phaseLabel('fertile', 'hidden')).toBe('')
    expect(phaseLabel('period', 'hidden')).toBe('생리')
  })

  it('legend matches the view', () => {
    expect(legendItems('hidden').map((l) => l.key)).toEqual(['period', 'period-predicted'])
    expect(legendItems('soft').map((l) => l.label)).toContain('우리의 주간')
    expect(legendItems('explicit').map((l) => l.label)).toContain('가능 범위')
  })
})

describe('month navigation', () => {
  const today = '2026-09-26'

  it('moves by months and clamps to ±12', () => {
    expect(shiftMonth('2026-09-01', -1, today)).toBe('2026-08-01')
    expect(shiftMonth('2026-12-01', 1, today)).toBe('2027-01-01')
    expect(shiftMonth('2026-09-01', 13, today)).toBe('2027-09-01')
    expect(shiftMonth('2027-09-01', 1, today)).toBe('2027-09-01')
    expect(shiftMonth('2026-09-01', -20, today)).toBe('2025-09-01')
  })

  it('knows when the buttons are disabled', () => {
    expect(canShiftMonth('2027-09-01', 1, today)).toBe(false)
    expect(canShiftMonth('2027-08-01', 1, today)).toBe(true)
    expect(canShiftMonth('2025-09-01', -1, today)).toBe(false)
    expect(canShiftMonth('2025-09-01', 1, today)).toBe(true)
    expect(monthOffset('2027-01-15', today)).toBe(4)
  })

  it('titles months in Korean', () => {
    expect(monthTitle('2026-10-01')).toBe('2026년 10월')
  })
})

describe('cellView', () => {
  const input = base({ lhTests: [{ date: '2026-09-12', result: 'negative' }, { date: '2026-09-11', result: 'positive' }] })
  const ctx = (view: FertilityView) => ({ month: '2026-09-01', today: '2026-09-26', view })

  it('builds an accessible label with date, weekday and phase', () => {
    const c = cellView(dayInfo(base(), '2026-09-14'), ctx('explicit'))
    expect(c.phase).toBe('peak')
    expect(c.ariaLabel).toMatch(/^9월 14일 .요일, 가임기 예상, 가능성 높음$/)
    expect(c.className).toContain('bg-fert')
  })

  it('marks ovulation only in the explicit view', () => {
    expect(cellView(dayInfo(base(), '2026-09-15'), ctx('explicit')).star).toBe(true)
    expect(cellView(dayInfo(base(), '2026-09-15'), ctx('soft')).star).toBe(false)
    const hidden = cellView(dayInfo(base(), '2026-09-15'), ctx('hidden'))
    expect(hidden.star).toBe(false)
    expect(hidden.phase).toBe('none')
    expect(hidden.ariaLabel).not.toMatch(/가임기|배란|가능/)
  })

  it('shows LH results except in the hidden view', () => {
    // A positive LH on 09-11 moves ovulation to 09-12.
    const neg = cellView(dayInfo(input, '2026-09-12'), ctx('explicit'))
    expect(neg.lh).toBe('negative')
    expect(neg.star).toBe(true)
    expect(neg.ariaLabel).toContain('LH 음성')
    expect(cellView(dayInfo(input, '2026-09-11'), ctx('soft')).lh).toBe('positive')
    expect(cellView(dayInfo(input, '2026-09-11'), ctx('hidden')).lh).toBeUndefined()
  })

  it('flags today and days outside the month', () => {
    const t = cellView(dayInfo(base(), '2026-09-26'), ctx('explicit'))
    expect(t.isToday).toBe(true)
    expect(t.className).toContain('ring-brand')
    expect(t.ariaLabel).toContain('오늘')
    const out = cellView(dayInfo(base(), '2026-08-31'), ctx('explicit'))
    expect(out.inMonth).toBe(false)
    // Dimmed fill, readable digits (no whole-cell opacity).
    expect(out.className).not.toContain('opacity-')
    expect(out.className).toMatch(/text-ink-[23]/)
    expect(cellView(dayInfo(base(), '2026-09-30'), ctx('explicit')).isFuture).toBe(true)
  })

  it('keeps logged periods visible in every view', () => {
    for (const v of ['explicit', 'soft', 'hidden'] as const) {
      expect(cellView(dayInfo(base(), '2026-09-02'), ctx(v)).phase).toBe('period')
      expect(cellView(dayInfo(base(), '2026-09-30'), ctx(v)).phase).toBe('period-predicted')
    }
  })
})

describe('cycleSummary', () => {
  it('explicit view: window, ovulation and average rows', () => {
    const s = cycleSummary(base(), '2026-09-07', 'explicit')
    expect(s.status.kind).toBe('before-fertile')
    expect(s.cycleDay).toBe(7)
    expect(s.nextPeriod).toBe('2026-09-29')
    expect(s.headline.title).toBe('가임기까지 3일 (예상)')
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'window', 'ovulation', 'avg'])
    expect(s.rows.find((r) => r.key === 'ovulation')?.sub).toBe('달력 계산')
    expect(s.rows.find((r) => r.key === 'period')?.sub).toBe('D-22')
  })

  it('soft view: 우리의 주간 without countdown', () => {
    const s = cycleSummary(base(), '2026-09-07', 'soft')
    expect(s.headline.title).toMatch(/^다음 우리의 주간: 9월 10일/)
    expect(s.rows.map((r) => r.label)).toContain('우리의 주간 (예상)')
    expect(s.rows.map((r) => r.key)).not.toContain('ovulation')
  })

  it('hidden view: only the period estimate', () => {
    const s = cycleSummary(base(), '2026-09-12', 'hidden')
    expect(s.headline.title).toBe('다음 생리까지 17일 (예상)')
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'avg'])
  })

  it('reports LH-based ovulation', () => {
    const s = cycleSummary(base({ lhTests: [{ date: '2026-09-16', result: 'positive' }] }), '2026-09-08', 'explicit')
    expect(s.window?.ovulation).toBe('2026-09-17')
    expect(s.rows.find((r) => r.key === 'ovulation')?.sub).toBe('LH 테스트 기준')
  })

  it('handles a late period', () => {
    const s = cycleSummary(base(), '2026-10-01', 'explicit')
    expect(s.status.kind).toBe('late')
    expect(s.cycleDay).toBe(31)
    expect(s.headline.title).toBe('생리 예정일이 2일 지났어요')
    expect(s.rows[0]).toMatchObject({ label: '생리 예정일 (지남)', sub: 'D+2' })
    // The next window depends on when the period actually starts.
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'avg'])
  })

  it('explains where the average comes from', () => {
    expect(cycleSummary(base(), '2026-09-07', 'explicit').rows.at(-1)?.sub).toBe(
      '설정값 — 두 번 이상 기록하면 자동으로 계산해요',
    )
    const logged = base({ periods: [{ start: '2026-07-01' }, { start: '2026-07-27' }, { start: '2026-08-28' }] })
    expect(averageSourceLabel(cycleSummary(logged, '2026-09-05', 'explicit').stats)).toBe('최근 2주기 평균 (26~32일)')
  })

  it('never uses fertile wording where it is hidden, nor pressure words anywhere', () => {
    const inputs = [
      base(),
      base({ lhTests: [{ date: '2026-09-14', result: 'positive' }] }),
      base({ periods: [{ start: '2026-07-01' }, { start: '2026-07-24' }, { start: '2026-09-01' }] }),
    ]
    for (const input of inputs)
      for (const view of ['explicit', 'soft', 'hidden'] as const) {
        const texts: string[] = [irregularMessage(view)]
        for (const d of range('2026-08-25', '2026-11-30')) {
          const s = cycleSummary(input, d, view)
          texts.push(s.headline.title, s.headline.sub ?? '')
          for (const r of s.rows) texts.push(r.label, r.value, r.sub ?? '')
          const info = dayInfo(input, d)
          texts.push(phaseLabel(info.phase, view), cellView(info, { month: '2026-09-01', today: d, view }).ariaLabel)
          texts.push(explainDay(info, view, true), explainDay(info, view, false), dayChanceLabel(info, view) ?? '')
        }
        const notice = viewNotice(view, { lowPressure: view === 'hidden' })
        texts.push(notice?.text ?? '')
        const all = texts.join('\n')
        expect(all).not.toMatch(PRESSURE_WORDS)
        if (view === 'soft') expect(all).not.toMatch(/가임기|배란/)
        if (view === 'hidden') expect(all).not.toMatch(/가임기|배란|우리의 주간|가능성|LH/)
        if (view === 'explicit') expect(all).toMatch(/가임기/)
      }
  })
})

describe('dayActions', () => {
  const periods = [{ start: '2026-09-01', end: '2026-09-05' }]
  const today = '2026-09-26'

  it('finds the logged period covering a date', () => {
    expect(dayActions(periods, '2026-09-03', today, 5)).toMatchObject({
      canLog: true,
      covering: periods[0],
      isStart: false,
      isEnd: false,
    })
    expect(dayActions(periods, '2026-09-01', today, 5).isStart).toBe(true)
    expect(dayActions(periods, '2026-09-05', today, 5).isEnd).toBe(true)
  })

  it('uses periodLength when no end is logged', () => {
    expect(periodCovering([{ start: '2026-09-01' }], '2026-09-05', 5)?.start).toBe('2026-09-01')
    expect(periodCovering([{ start: '2026-09-01' }], '2026-09-06', 5)).toBeUndefined()
  })

  it('offers extending a period a few days later, and warns about near-duplicates', () => {
    const a = dayActions(periods, '2026-09-07', today, 5)
    expect(a.covering).toBeUndefined()
    expect(a.extendable?.start).toBe('2026-09-01')
    expect(a.nearby?.start).toBe('2026-09-01')
    const b = dayActions(periods, '2026-09-12', today, 5)
    expect(b.extendable).toBeUndefined()
    expect(b.nearby?.start).toBe('2026-09-01')
    const c = dayActions(periods, '2026-09-20', today, 5)
    expect(c.extendable).toBeUndefined()
    expect(c.nearby).toBeUndefined()
    // A logged start a couple of days later → probably the same period.
    expect(dayActions(periods, '2026-08-30', today, 5).nearby?.start).toBe('2026-09-01')
  })

  it('does not allow logging future days', () => {
    expect(dayActions(periods, addDays(today, 1), today, 5).canLog).toBe(false)
    expect(dayActions(periods, today, today, 5).canLog).toBe(true)
  })
})

describe('periodHistory', () => {
  it('lists newest first with measured cycle lengths and hints', () => {
    const rows = periodHistory([
      { start: '2026-01-01' },
      { start: '2026-01-30', end: '2026-02-03' },
      { start: '2026-02-10' },
      { start: '2026-06-01' },
    ])
    expect(rows.map((r) => r.start)).toEqual(['2026-06-01', '2026-02-10', '2026-01-30', '2026-01-01'])
    expect(rows[0]).toMatchObject({ current: true, cycleLength: undefined, hint: undefined })
    expect(rows[1]).toMatchObject({ cycleLength: 111, hint: 'gap' })
    expect(rows[2]).toMatchObject({ cycleLength: 11, hint: 'short', bleedDays: 5, end: '2026-02-03' })
    expect(rows[3]).toMatchObject({ cycleLength: 29, hint: undefined, current: false })
  })

  it('is empty without logs', () => {
    expect(periodHistory([])).toEqual([])
  })
})

describe('icsAvailability', () => {
  const today = '2026-09-07'

  it('exports the next three windows', () => {
    const a = icsAvailability(base(), today, settings(), 'explicit')
    expect(a.enabled).toBe(true)
    expect(a.windows.map((w) => w.fertileStart)).toEqual(['2026-09-10', '2026-10-08', '2026-11-05'])
  })

  it('is disabled without logs, in low-pressure mode, or when the viewer turned it off', () => {
    expect(icsAvailability(base({ periods: [] }), today, settings(), 'explicit')).toMatchObject({ enabled: false })
    const low = icsAvailability(base(), today, settings({ lowPressure: true }), 'hidden')
    expect(low.enabled).toBe(false)
    expect(low.reason).toContain('부담 없이')
    expect(icsAvailability(base(), today, settings(), 'hidden').enabled).toBe(false)
  })
})

describe('fertility content', () => {
  it('shows only non-timing sections in the hidden view', () => {
    expect(guideSections(true).map((s) => s.id)).toEqual(['frequency', 'doctor'])
    expect(guideSections(false)).toHaveLength(GUIDE_SECTIONS.length)
  })

  it('every section cites https sources, listed once', () => {
    for (const s of GUIDE_SECTIONS) {
      expect(s.sources.length).toBeGreaterThan(0)
      for (const src of s.sources) expect(src.url).toMatch(/^https:\/\//)
    }
    const all = guideSources(GUIDE_SECTIONS)
    expect(new Set(all.map((s) => s.url)).size).toBe(all.length)
    expect(all.length).toBeLessThan(GUIDE_SECTIONS.flatMap((s) => s.sources).length) // NICE is shared
  })

  it('keeps the researched numbers', () => {
    const text = GUIDE_SECTIONS.flatMap((s) => s.points).join('\n')
    for (const fact of ['30%', '21%', '53곳', '4곳', '1.36', '24~36시간', '2~3일', '80%', '35세', '6개월', '1년', '0.3~0.6°C'])
      expect(text).toContain(fact)
  })

  it('uses the ASRM 12/6-month rule', () => {
    expect(doctorGuideMonths(undefined)).toBe(12)
    expect(doctorGuideMonths(34)).toBe(12)
    expect(doctorGuideMonths(35)).toBe(6)
    // 40+: right away — the same rule as the notice and the home card.
    expect(doctorGuideMonths(41)).toBe(0)
    expect(doctorGuideMonths(39)).toBe(6)
  })

  it('stays low-pressure and non-medical', () => {
    const text = [
      ...GUIDE_SECTIONS.flatMap((s) => [s.title, s.softTitle ?? '', s.summary, ...s.points]),
      NICE_GUIDANCE.title,
      NICE_GUIDANCE.body,
      ESTIMATE_DISCLAIMER,
    ].join('\n')
    expect(text).not.toMatch(PRESSURE_WORDS)
    expect(ESTIMATE_DISCLAIMER).toContain('피임')
    expect(NICE_GUIDANCE.body).not.toMatch(/가임기|배란/)
  })
})

describe('view notice', () => {
  it('is empty for the explicit view', () => {
    expect(viewNotice('explicit', { lowPressure: false })).toBeNull()
  })

  it('never names 가임기/배란 in the soft or hidden notice', () => {
    const soft = viewNotice('soft', { lowPressure: false })!
    const low = viewNotice('hidden', { lowPressure: true })!
    const off = viewNotice('hidden', { lowPressure: false })!
    for (const n of [soft, low, off]) expect(n.text).not.toMatch(/가임기|배란/)
    expect(soft.text).toContain('우리의 주간')
    expect(low.text).toContain('부담 없이 모드')
    // Uses the same wording as the settings screen's option.
    expect(off.text).toContain('받지 않을래요')
  })
})

describe('dark-mode safe classes', () => {
  it('filled day markers use a token text colour, not white', () => {
    for (const cls of Object.values(PHASE_CLASS)) expect(cls).not.toMatch(/text-white|gray-|slate-|#[0-9a-f]{3}/i)
    expect(PHASE_CLASS.period).toContain('text-surface')
    expect(PHASE_CLASS.peak).toContain('text-surface')
  })
})

describe('headline edge cases', () => {
  it('a very late period reads as a missing log, not "100일 지났어요"', () => {
    const s = cycleSummary(base(), '2026-12-20', 'explicit')
    expect(s.status.kind).toBe('late')
    expect(s.headline.title).toBe('최근 생리 기록이 없어요')
    expect(s.headline.sub).toContain('9월 1일')
    // No stale due date, no guessed window, no "주기 111일째".
    expect(s.rows.map((r) => r.key)).toEqual(['avg'])
    expect(s.cycleDay).toBeUndefined()
    // A few days late keeps the gentle count.
    expect(cycleSummary(base(), '2026-10-05', 'explicit').headline.title).toBe('생리 예정일이 6일 지났어요')
  })

  it('does not claim the end date improves predictions', () => {
    const h = statusHeadline({ kind: 'period', cycleDay: 2, nextFertileStart: '2026-09-10' }, 'hidden', { today: '2026-09-02' })
    expect(h.sub).not.toContain('예측')
  })

  it('explicit fertile days reassure instead of prescribing daily timing', () => {
    const s = cycleSummary(base(), '2026-09-12', 'explicit')
    expect(s.status.kind).toBe('fertile')
    expect(s.headline.sub).toContain('매일이 아니어도 괜찮아요')
    expect(s.headline.sub).toContain('2~3번')
  })
})

describe('day sheet helpers', () => {
  it('titles other years with the year', () => {
    expect(dayTitle('2026-10-03', '2026-09-26')).toBe('10월 3일 (토)')
    expect(dayTitle('2025-10-03', '2026-09-26')).toBe('2025년 10월 3일 (금)')
  })

  it('shows the chance only where it makes sense', () => {
    const input = base()
    expect(dayChanceLabel(dayInfo(input, '2026-09-14'), 'explicit')).toBe('높음')
    expect(dayChanceLabel(dayInfo(input, '2026-09-11'), 'explicit')).toBe('보통')
    // The soft view ("건강 용어 없이") never shows a pregnancy-chance rating.
    expect(dayChanceLabel(dayInfo(input, '2026-09-11'), 'soft')).toBeNull()
    expect(dayChanceLabel(dayInfo(input, '2026-09-14'), 'soft')).toBeNull()
    // Outside the window and its band: no confident "낮음" ("safe day" framing).
    expect(dayChanceLabel(dayInfo(input, '2026-09-22'), 'explicit')).toBeNull()
    // The wider band is calendar uncertainty, not a confident "low".
    const possible = range('2026-09-01', '2026-09-28').find((d) => dayInfo(input, d).phase === 'possible')!
    expect(dayChanceLabel(dayInfo(input, possible), 'explicit')).toBe('낮음~보통')
    expect(dayChanceLabel(dayInfo(input, '2026-09-14'), 'hidden')).toBeNull()
    expect(dayChanceLabel(dayInfo(input, '2026-09-02'), 'explicit')).toBeNull()
    expect(dayChanceLabel(dayInfo(input, '2026-08-20'), 'explicit')).toBeNull()
  })

  it('explains ordinary days without 가임기 wording in the soft view', () => {
    const info = dayInfo(base(), '2026-09-22')
    expect(info.phase).toBe('none')
    expect(explainDay(info, 'soft', false)).not.toMatch(/가임기|배란/)
    expect(explainDay(info, 'explicit', false)).toBe('예상 범위 밖이에요 · 예측은 주기마다 틀릴 수 있어요.')
    expect(explainDay(info, 'hidden', false)).not.toMatch(/가임기|배란/)
    expect(explainDay(dayInfo(base(), '2026-08-20'), 'explicit', true)).toContain('기록 전')
  })

  it('points at the closest nearby log and offers moving a later start', () => {
    // 08-20 and 09-10 are both within 15 days of 09-03; 09-10 is the likely duplicate.
    const periods = [{ start: '2026-08-20' }, { start: '2026-09-10' }]
    const a = dayActions(periods, '2026-09-03', '2026-09-26', 5)
    expect(a.nearby?.start).toBe('2026-09-10')
    expect(a.moveable?.start).toBe('2026-09-10')
    expect(a.extendable).toBeUndefined()
    // Only a later start within a plausible bleed is offered as "move".
    expect(dayActions([{ start: '2026-09-20' }], '2026-09-05', '2026-09-26', 5).moveable).toBeUndefined()
  })

  it('does not export guessed dates while the period is late', () => {
    const a = icsAvailability(base(), '2026-10-02', settings(), 'explicit')
    expect(a.enabled).toBe(false)
    expect(a.reason).toContain('예정일이 지나서')
    expect(a.reason).not.toMatch(/가임기|배란/)
    // The expected day itself is not late yet.
    expect(icsAvailability(base(), '2026-09-29', settings(), 'explicit').enabled).toBe(true)
  })

  it('names the settings option when export is off for this viewer', () => {
    expect(icsAvailability(base(), '2026-09-07', settings(), 'hidden').reason).toContain('받지 않을래요')
  })
})

describe('guide in the hidden view', () => {
  it('drops date-timing wording and the "turn on low-pressure" tip', () => {
    const text = guideSections(true)
      .flatMap((s) => [s.title, s.summary, ...s.points])
      .join('\n')
    expect(text).not.toMatch(/가임기|배란|LH/)
    expect(text).not.toContain('부담 없이 모드')
    expect(text).toContain('2~3일에 한 번')
    expect(text).toContain('80%')
  })

  it('keeps collapsed titles and summaries soft for the soft view', () => {
    for (const s of GUIDE_SECTIONS) expect(`${s.softTitle ?? s.title} ${s.summary}`).not.toMatch(/가임기|배란/)
  })

  it('personal doctor line follows the 12/6-month rule', () => {
    expect(doctorAgeLine('지은', 33)).toBe('지은님(33세) 기준으로는 1년 동안 소식이 없으면 상담을 받아 보세요.')
    expect(doctorAgeLine('지은', 36)).toContain('6개월')
    expect(doctorAgeLine('지은', 41)).toBe('지은님(41세) 기준으로는 기다리지 말고 지금 상담해 보세요.')
  })
})
