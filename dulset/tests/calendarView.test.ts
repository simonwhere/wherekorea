import { describe, expect, it } from 'vitest'
import {
  GUIDE_SECTIONS,
  LH_CHOICES,
  NICE_GUIDANCE,
  ESTIMATE_DISCLAIMER,
  PTEST_CHOICES,
  PTEST_EARLY_NOTE,
  ptestAfterCopy,
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
  confidenceLabel,
  LEGEND_MAX,
  PHASE_CLASS,
  cycleFeels,
  cycleHistory,
  cycleLens,
  cycleSummary,
  dayChanceFor,
  dayLine,
  explainDayFor,
  isMissedGap,
  knownCycleDay,
  lensPhase,
  lhBadge,
  lhRowLine,
  monthConfidence,
  PEAK_SOFT_LABEL,
  peakLabel,
  showsPeak,
  ptestBadge,
  sharedHeadline,
  showsLH,
  showsTests,
  strongestTest,
  type Lens,
  dayActions,
  dayChanceLabel,
  dayTitle,
  explainDay,
  futureDayNote,
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
  windowLabel,
  type FertilityView,
} from '@/lib/logic/calendarView'
import { createInitialState } from '@/lib/initial'
import type { AppState, Settings } from '@/lib/types'

// Three regular 28-day cycles before the current period (confidence 'cycles'):
// window 09-10…09-15, peak 09-13…09-15, the next period expected on 09-29.
const base = (over: Partial<CycleInput> = {}): CycleInput => ({
  periods: [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01', end: '2026-09-05' }],
  lhTests: [],
  cycle: { cycleLength: 28, periodLength: 5 },
  ...over,
})
/** One logged period + the setting: a settings-only estimate (confidence 'low'). */
const single = (over: Partial<CycleInput> = {}): CycleInput => base({ periods: [{ start: '2026-09-01', end: '2026-09-05' }], ...over })

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
    expect(legendItems('hidden').map((l) => l.key)).toEqual(['period'])
    expect(legendItems('soft').map((l) => l.label)).toContain('우리의 주간')
    expect(legendItems('explicit').map((l) => l.label)).toEqual(['생리 · 예정', '가임기 예상', '가능성 높음', '가능 범위', '배란 예상'])
  })

  it('never has more than five items', () => {
    for (const view of ['explicit', 'soft', 'hidden'] as const)
      for (const details of [true, false])
        for (const owner of [true, false])
          for (const pause of [undefined, 'rest', 'positive'] as const)
            expect(legendItems(view, { details, owner, pause }).length).toBeLessThanOrEqual(LEGEND_MAX)
    expect(LEGEND_MAX).toBe(5)
  })

  it('narrows for the partner and while paused', () => {
    // Soft partner with details: the peak days too, named softly (same as the home strip).
    expect(legendItems('soft', { owner: false }).map((l) => l.key)).toEqual(['period', 'fertile', 'peak', 'possible'])
    expect(legendItems('soft', { owner: false }).find((l) => l.key === 'peak')?.label).toBe('특히 좋은 때 (예상)')
    expect(legendItems('soft').find((l) => l.key === 'peak')?.label).toBe(PEAK_SOFT_LABEL)
    expect(legendItems('explicit', { owner: false }).find((l) => l.key === 'peak')?.label).toBe('가능성 높음')
    // No details: only the shared band.
    expect(legendItems('explicit', { details: false, owner: false }).map((l) => l.label)).toEqual(['우리의 주간 (예상)'])
    expect(legendItems('hidden', { details: false, owner: false })).toEqual([])
    // Rest / waiting for the clinic: periods only.
    expect(legendItems('explicit', { pause: 'rest' }).map((l) => l.key)).toEqual(['period'])
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

  it('names LH in notes only for the explicit view', () => {
    expect(futureDayNote('explicit')).toContain('LH')
    for (const v of ['soft', 'hidden'] as const) {
      expect(futureDayNote(v)).not.toMatch(/LH|가임기|배란/)
      expect(irregularMessage(v)).not.toMatch(/LH|가임기|배란/)
    }
    expect(irregularMessage('explicit')).toContain('LH')
  })

  it('shows LH results only in the explicit view', () => {
    // A positive LH on 09-11 moves ovulation to 09-12.
    const neg = cellView(dayInfo(input, '2026-09-12'), ctx('explicit'))
    expect(neg.lh).toBe('negative')
    expect(neg.star).toBe(true)
    expect(neg.ariaLabel).toContain('LH 음성')
    expect(cellView(dayInfo(input, '2026-09-11'), ctx('explicit')).lh).toBe('positive')
    // Soft wording never shows LH (the home strip follows the same rule).
    expect(cellView(dayInfo(input, '2026-09-11'), ctx('soft')).lh).toBeUndefined()
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

  it('next-month days keep the same predicted colours (not dimmer)', () => {
    // 10-08…10-13 is the next estimated window; 10-10 is the September grid's last cell.
    const inSep = cellView(dayInfo(base(), '2026-10-10'), ctx('explicit'))
    const inOct = cellView(dayInfo(base(), '2026-10-10'), { ...ctx('explicit'), month: '2026-10-01' })
    expect(inSep.inMonth).toBe(false)
    expect(inSep.phase).toBe('fertile')
    expect(inSep.className).toBe(inOct.className)
    expect(inSep.className).toContain(PHASE_CLASS.fertile)
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
    expect(s.rows.find((r) => r.key === 'period')).toMatchObject({ value: '9월 29일 무렵', sub: 'D-22 · 기록 기준' })
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
    // An owner who turned alerts off keeps her explicit calendar, but no LH by name.
    const off = cycleSummary(base({ lhTests: [{ date: '2026-09-16', result: 'positive' }] }), '2026-09-08', 'explicit', { lh: false })
    expect(off.rows.find((r) => r.key === 'ovulation')?.sub).toBe('기록 기준')
  })

  it('handles a late period', () => {
    const s = cycleSummary(base(), '2026-10-01', 'explicit')
    expect(s.status.kind).toBe('late')
    expect(s.cycleDay).toBe(31)
    expect(s.headline.title).toBe('생리 예정일이 2일 지났어요')
    expect(s.rows[0]).toMatchObject({ label: '생리 예정 (지남)', value: '9월 29일 무렵', sub: 'D+2' })
    // The next window depends on when the period actually starts.
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'avg'])
  })

  it('explains where the average comes from', () => {
    expect(cycleSummary(single(), '2026-09-07', 'explicit').rows.at(-1)?.sub).toBe(
      '설정값 — 두 번 이상 기록하면 자동으로 계산해요',
    )
    expect(cycleSummary(base(), '2026-09-07', 'explicit').rows.at(-1)?.sub).toBe('최근 3주기 평균')
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
    expect(s.headline.title).toBe('혹시 기록을 빠뜨렸나요?')
    expect(s.headline.sub).toContain('9월 1일')
    // No stale due date, no guessed window, no "주기 111일째".
    expect(s.rows.map((r) => r.key)).toEqual(['avg'])
    expect(s.cycleDay).toBeUndefined()
    // A few days late keeps the gentle count.
    expect(cycleSummary(base(), '2026-10-05', 'explicit').headline.title).toBe('생리 예정일이 6일 지났어요')
  })

  it('does not claim the end date improves predictions', () => {
    const h = statusHeadline({ kind: 'period', cycleDay: 2, nextFertileStart: '2026-09-10', confidence: 'cycles' }, 'hidden', { today: '2026-09-02' })
    expect(h.sub).not.toContain('예측')
  })

  it('explicit fertile days reassure instead of prescribing daily timing', () => {
    const s = cycleSummary(base(), '2026-09-12', 'explicit')
    expect(s.status.kind).toBe('fertile')
    expect(s.headline.sub).toContain('매일이 아니어도 괜찮아요')
    expect(s.headline.sub).toContain('2~3번')
  })
})

// ── N12: confidence on the calendar ─────────────────────────

describe('low confidence on the calendar (settings only, 1–2 cycles, irregular)', () => {
  const ctx = (view: FertilityView) => ({ month: '2026-09-01', today: '2026-09-07', view })

  it('draws no peak day and no ⭐, and rates no day', () => {
    for (const d of ['2026-09-13', '2026-09-14', '2026-09-15']) {
      const c = cellView(dayInfo(single(), d), ctx('explicit'))
      expect(c.phase, d).toBe('fertile')
      expect(c.star, d).toBe(false)
      expect(c.confidence).toBe('low')
      expect(c.ariaLabel).not.toMatch(/가능성|배란/)
      expect(dayChanceLabel(dayInfo(single(), d), 'explicit')).toBeNull()
    }
    expect(explainDay(dayInfo(single(), '2026-09-14'), 'explicit', false)).toContain('넓게 잡은 예상 범위')
    expect(explainDay(dayInfo(single(), '2026-09-14'), 'explicit', false)).not.toMatch(/배란 예상일/)
    // With three regular cycles the same day is a peak day with its ⭐.
    expect(cellView(dayInfo(base(), '2026-09-15'), ctx('explicit'))).toMatchObject({ phase: 'peak', star: true, confidence: 'cycles' })
    // An irregular record (24, 35, 27, 32) is low too — even with four cycles.
    const irregular = base({ periods: [{ start: '2026-05-01' }, { start: '2026-05-25' }, { start: '2026-06-29' }, { start: '2026-07-26' }, { start: '2026-08-27' }] })
    expect(cellView(dayInfo(irregular, '2026-09-10'), { ...ctx('explicit'), today: '2026-09-01' }).confidence).toBe('low')
    expect(dayInfo(irregular, '2026-09-10').phase).not.toBe('peak')
  })

  it('the legend follows: 예상 범위 (넓음), no 가능성 높음, no 배란 예상', () => {
    expect(legendItems('explicit', undefined, { confidence: 'low' }).map((l) => l.label)).toEqual(['생리 · 예정', '예상 범위 (넓음)', '가능 범위'])
    expect(legendItems('soft', undefined, { confidence: 'low' }).map((l) => l.label)).toEqual(['생리 · 예정', '우리의 주간 (예상 범위)', '가능 범위'])
    expect(legendItems('explicit', { details: false, owner: false }, { confidence: 'low' }).map((l) => l.label)).toEqual(['우리의 주간 (예상 범위)'])
    expect(legendItems('explicit', undefined, { confidence: 'cycles' }).map((l) => l.key)).toContain('peak')
    // A month's legend is low only when every window day in it is.
    const sep = range('2026-08-30', '2026-10-10').map((d) => cellView(dayInfo(single(), d), ctx('explicit')))
    expect(monthConfidence(sep)).toBe('low')
    expect(monthConfidence(range('2026-08-30', '2026-10-10').map((d) => cellView(dayInfo(base(), d), ctx('explicit'))))).toBe('cycles')
    expect(monthConfidence([])).toBe('cycles')
    expect(windowLabel('explicit', 'low')).toBe('예상 범위 (넓음)')
    expect(windowLabel('explicit')).toBe('가임기 (예상)')
    expect(windowLabel('soft', 'lh')).toBe('우리의 주간 (예상)')
    expect(confidenceLabel('low', 0)).toBe('달력 기준 · 설정값')
    expect(confidenceLabel('low', 2)).toBe('달력 기준 · 기록 2주기')
    expect(confidenceLabel('cycles', 3)).toBe('기록 3주기 기준')
    expect(confidenceLabel('lh', 3)).toBe('LH 기준')
  })

  it('the summary names the basis instead of an ovulation day, and reads the range in every view', () => {
    const s = cycleSummary(single(), '2026-09-12', 'explicit')
    expect(s.headline.title).toBe('가임기 예상 범위예요 (넓음)')
    expect(s.headline.sub).toContain('달력 기준 · 설정값')
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'window', 'basis', 'avg'])
    expect(s.rows.find((r) => r.key === 'window')?.label).toBe('예상 범위 (넓음)')
    expect(s.rows.find((r) => r.key === 'basis')).toMatchObject({ label: '예상 기준', value: '달력 기준 · 설정값' })
    expect(s.rows.find((r) => r.key === 'period')).toMatchObject({ value: '9월 27일~10월 1일 무렵', sub: 'D-15 · 설정값 기준' })
    expect(cycleSummary(single(), '2026-09-07', 'explicit').headline.title).toBe('가임기 무렵까지 3일 (예상)')
    // Soft wording: the same range, its own words, no basis row.
    const soft = cycleSummary(single(), '2026-09-12', 'soft')
    expect(soft.rows.map((r) => r.key)).toEqual(['period', 'window', 'avg'])
    expect(soft.rows.find((r) => r.key === 'window')?.label).toBe('우리의 주간 (예상 범위)')
    // Hidden wording never names LH, even when LH set the range.
    const lh = single({ lhTests: [{ date: '2026-09-12', result: 'positive' }] })
    const hidden = cycleSummary(lh, '2026-09-20', 'hidden')
    expect(hidden.rows.map((r) => `${r.label} ${r.value} ${r.sub ?? ''}`).join(' ')).not.toMatch(/LH/)
    expect(hidden.rows.find((r) => r.key === 'period')?.sub).toContain('기록 기준')
    expect(cycleSummary(lh, '2026-09-20', 'explicit').rows.find((r) => r.key === 'period')?.sub).toContain('LH 기준')
    expect(cycleSummary(lh, '2026-09-20', 'explicit', { lh: false }).rows.find((r) => r.key === 'period')?.sub).toContain('기록 기준')
  })
})

describe('long cycles and 기록 누락? (N12)', () => {
  it("flags a gap only past the settings' maximum AND twice the average", () => {
    expect(isMissedGap(61)).toBe(true)
    expect(isMissedGap(60)).toBe(false)
    expect(isMissedGap(61, { average: 28 })).toBe(true)
    expect(isMissedGap(64, { maxCycle: 60, average: 35 })).toBe(false) // under 2 × 35
    expect(isMissedGap(64, { maxCycle: 90, average: 30 })).toBe(false) // a long cycle is a cycle
    expect(isMissedGap(125, { maxCycle: 90, average: 60 })).toBe(true)
    // A 긴 주기 record: 64, 55, 64 → no '기록 누락?', the day counts past 60.
    const periods = [{ start: '2026-01-01' }, { start: '2026-03-06' }, { start: '2026-04-30' }, { start: '2026-07-03' }]
    const long = { periods, lhTests: [], cycle: { cycleLength: 50, periodLength: 5, longCycles: true } }
    const h = cycleHistory(long, '2026-09-04', '2026-01-01')
    expect(h.maxCycle).toBe(90)
    expect(h.rows.map((r) => r.hint)).toEqual([undefined, undefined, undefined, undefined])
    expect(h.rows.map((r) => r.attempt)).toEqual([4, 3, 2, 1])
    expect(h.estimated).toBe(false)
    // Without the setting a 64-day gap is dropped from the average but, at under twice the
    // 55-day average, still not called a missed log; a 70-day gap on 28-day cycles is one.
    const plain = cycleHistory({ ...long, cycle: { cycleLength: 28, periodLength: 5 } }, '2026-09-04', '2026-01-01')
    expect(plain.maxCycle).toBe(60)
    expect(plain.rows.filter((r) => r.hint === 'gap')).toHaveLength(0)
    const missed = cycleHistory(
      { periods: [{ start: '2026-01-01' }, { start: '2026-01-29' }, { start: '2026-02-26' }, { start: '2026-05-07' }], lhTests: [], cycle: { cycleLength: 28, periodLength: 5 } },
      '2026-05-10',
      '2026-01-01',
    )
    expect(missed.rows.map((r) => r.hint)).toEqual([undefined, 'gap', undefined, undefined])
    expect(missed.estimated).toBe(true)
    expect(periodHistory(missed.rows.map((r) => ({ start: r.start })), { maxCycle: 90, average: 28 }).map((r) => r.hint)).toEqual([undefined, undefined, undefined, undefined])
    expect(knownCycleDay({ cycleDay: 64 })).toBeUndefined()
    expect(knownCycleDay({ cycleDay: 64 }, 90)).toBe(64)
    expect(cycleSummary(long, '2026-09-04', 'explicit').cycleDay).toBe(64)
  })

  it("'아직 안 왔어요' keeps the 주기 tab counting a long-late cycle", () => {
    const input = base({ cycleNotes: { '2026-09-01': { stillWaiting: '2026-10-20' } } })
    const s = cycleSummary(input, '2026-10-25', 'explicit')
    expect(s.status).toMatchObject({ kind: 'late', daysLate: 26 })
    expect(s.cycleDay).toBe(55)
    expect(s.headline).toEqual({ title: '주기 55일째 · 길어지고 있어요', sub: expect.stringContaining('병원에서 확인해 봐요') })
    expect(s.headline.sub).not.toMatch(/\d+(일|주|개월)/)
    // Without the answer: the missed-log question.
    expect(cycleSummary(base(), '2026-10-25', 'explicit').headline.title).toBe('혹시 기록을 빠뜨렸나요?')
    // The partner (details) reads neither as a nudge.
    expect(cycleSummary(input, '2026-10-25', 'explicit', { owner: false }).headline.title).toBe('최근 생리 기록이 없어요')
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
    expect(dayChanceLabel(dayInfo(input, '2026-05-20'), 'explicit')).toBeNull() // before the first log
  })

  it('explains ordinary days without 가임기 wording in the soft view', () => {
    const info = dayInfo(base(), '2026-09-22')
    expect(info.phase).toBe('none')
    expect(explainDay(info, 'soft', false)).not.toMatch(/가임기|배란/)
    expect(explainDay(info, 'explicit', false)).toBe('예상 범위 밖이에요 · 예측은 주기마다 틀릴 수 있어요.')
    expect(explainDay(info, 'hidden', false)).not.toMatch(/가임기|배란/)
    expect(explainDay(dayInfo(base(), '2026-05-20'), 'explicit', true)).toContain('기록 전')
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
    const reason = icsAvailability(base(), '2026-09-07', settings(), 'hidden').reason
    expect(reason).toContain('받지 않을래요')
    expect(reason).toContain('설정 › 내 알림')
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

// ── Lens: details sharing, partner wording, rest / positive pause ──

/** 지은 (b) tracks the cycle and shares nothing by default; 민수 (a) is the partner. */
function couple(over: Partial<AppState> = {}, settingsOver: Partial<Settings> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband' },
      partner: { name: '지은', role: 'wife' },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  const periods = [{ start: '2026-09-01', end: '2026-09-05' }]
  return { ...s, periods, ...over, settings: { ...s.settings, shareCycleDetails: false, ...settingsOver } }
}

describe('cycleLens', () => {
  it('the owner sees details in their own wording', () => {
    expect(cycleLens(couple(), 'b')).toEqual({ view: 'explicit', details: true, owner: true, lh: true })
  })

  it('a partner sees details only when shared; otherwise soft wording at most', () => {
    expect(cycleLens(couple({}, { alertStyle: { a: 'explicit', b: 'explicit' } }), 'a')).toEqual({
      view: 'soft',
      details: false,
      owner: false,
      lh: false,
    })
    expect(cycleLens(couple({}, { shareCycleDetails: true, alertStyle: { a: 'explicit', b: 'explicit' } }), 'a')).toMatchObject({
      view: 'explicit',
      details: true,
      lh: true,
    })
    // 부담 없이 is per person.
    expect(cycleLens(couple({}, { personal: { a: { lowPressure: true } } }), 'a').view).toBe('hidden')
    expect(cycleLens(couple({}, { personal: { a: { lowPressure: true } } }), 'b').view).toBe('explicit')
  })

  it('pauses for a rest cycle or a positive test awaiting the clinic', () => {
    expect(cycleLens(couple({ restCycle: { since: '2026-09-03', reason: 'rest' } }), 'b').pause).toBe('rest')
    const pending = cycleLens(couple({ positivePending: { since: '2026-09-27' } }), 'b')
    expect(pending).toMatchObject({ pause: 'positive', pendingSince: '2026-09-27' })
    // A later period settles both.
    const after = couple({
      periods: [{ start: '2026-09-01' }, { start: '2026-09-29' }],
      restCycle: { since: '2026-09-03', reason: 'rest' },
      positivePending: { since: '2026-09-27' },
    })
    expect(cycleLens(after, 'b').pause).toBeUndefined()
  })
})

describe('what each viewer sees on the calendar', () => {
  const owner: Lens = { view: 'explicit', details: true, owner: true }
  const noDetails: Lens = { view: 'soft', details: false, owner: false }
  const softPartner: Lens = { view: 'soft', details: true, owner: false }
  const input = base({ lhTests: [{ date: '2026-09-13', result: 'peak' }, { date: '2026-09-12', result: 'faint' }] })
  const cell = (d: string, lens: Lens, ptest?: 'negative' | 'faint' | 'positive') =>
    cellView(dayInfo(input, d), { month: '2026-09-01', today: '2026-09-26', view: lens.view, lens, ptest })

  it('shows LH strength and 임테기 marks to the owner', () => {
    expect(cell('2026-09-12', owner).lhBadge?.text).toBe('희미')
    expect(cell('2026-09-13', owner).ariaLabel).toContain('LH 가장 진함')
    expect(cell('2026-09-13', owner).lhBadge?.text).toBe('진함')
    expect(lhBadge('positive').text).toBe('양성')
    expect(lhBadge('negative').text).toBe('')
    const t = cell('2026-09-26', owner, 'positive')
    expect(t.ptestBadge?.text).toBe('임')
    expect(t.ariaLabel).toContain('임테기 양성')
    expect(ptestBadge('faint').className).not.toBe(ptestBadge('positive').className)
    expect(strongestTest(['negative', 'faint'])).toBe('faint')
  })

  it('a partner without details sees only the 우리의 주간 band', () => {
    expect(cell('2026-09-02', noDetails).phase).toBe('none') // logged period
    expect(cell('2026-09-30', noDetails).phase).toBe('none') // projected period
    expect(cell('2026-09-13', noDetails).phase).toBe('fertile') // LH moved the window here
    const c = cell('2026-09-13', noDetails, 'positive')
    expect(c.lh).toBeUndefined()
    expect(c.ptest).toBeUndefined()
    expect(c.star).toBe(false)
    expect(c.ariaLabel).not.toMatch(/생리|LH|임테기|배란|가능성|가장/)
    // No 가능 범위 band either.
    for (const d of range('2026-09-01', '2026-10-31')) expect(['none', 'fertile']).toContain(cell(d, noDetails).phase)
  })

  it('a soft partner with details: the peak days, named softly — no LH, no tests', () => {
    expect(showsLH(softPartner)).toBe(false)
    expect(showsTests(softPartner)).toBe(false)
    expect(showsPeak(softPartner)).toBe(true)
    expect(lensPhase('peak', softPartner)).toBe('peak')
    expect(lensPhase('period', softPartner)).toBe('period')
    const c = cell('2026-09-14', softPartner)
    expect(c.phase).toBe('peak')
    expect(c.ariaLabel).toContain('특히 좋은 때 (예상)')
    expect(c.ariaLabel).not.toMatch(/가임기|배란|LH|가능성/)
    expect(c.star).toBe(false)
    expect(peakLabel('soft')).toBe('특히 좋은 때 (예상)')
    expect(peakLabel('explicit')).toBe('가능성 높음')
    // Soft, off and low-pressure never see LH marks — the owner included (her
    // records stay in "+ 기록"); hidden or paused never shows the peak.
    expect(showsLH({ view: 'soft', details: true, owner: true })).toBe(false)
    expect(showsLH({ view: 'explicit', details: true, owner: true, lh: false })).toBe(false)
    expect(showsLH({ view: 'hidden', details: true, owner: true })).toBe(false)
    expect(showsPeak({ view: 'hidden', details: true })).toBe(false)
    expect(showsPeak({ view: 'explicit', details: true, pause: 'rest' })).toBe(false)
    expect(showsPeak(noDetails)).toBe(false)
    expect(showsTests({ view: 'hidden', details: true, owner: true })).toBe(true)
  })

  it('cycleLens applies the LH rule per viewer (soft / off / low-pressure → no LH)', () => {
    const owner = (over: Partial<Settings>) => cycleLens(couple({}, over), 'b')
    expect(showsLH(owner({ alertStyle: { a: 'soft', b: 'explicit' } }))).toBe(true)
    expect(showsLH(owner({ alertStyle: { a: 'soft', b: 'soft' } }))).toBe(false)
    // 'off' keeps the owner's calendar explicit (her record) but drops LH marks.
    const off = owner({ alertStyle: { a: 'soft', b: 'off' } })
    expect(off.view).toBe('explicit')
    expect(showsLH(off)).toBe(false)
    expect(showsPeak(off)).toBe(true)
    expect(showsLH(owner({ alertStyle: { a: 'soft', b: 'explicit' }, personal: { b: { lowPressure: true } } }))).toBe(false)
    // The partner: LH only with details and explicit wording; the peak with details.
    const partner = (over: Partial<Settings>) => cycleLens(couple({}, over), 'a')
    expect(showsLH(partner({ shareCycleDetails: true, alertStyle: { a: 'explicit', b: 'explicit' } }))).toBe(true)
    expect(showsLH(partner({ shareCycleDetails: true, alertStyle: { a: 'soft', b: 'explicit' } }))).toBe(false)
    expect(showsPeak(partner({ shareCycleDetails: true, alertStyle: { a: 'soft', b: 'explicit' } }))).toBe(true)
    expect(showsPeak(partner({ shareCycleDetails: false, alertStyle: { a: 'explicit', b: 'explicit' } }))).toBe(false)
  })

  it('a pause drops the fertile band (and, while waiting, the projected period)', () => {
    const rest: Lens = { ...owner, pause: 'rest' }
    const positive: Lens = { ...owner, pause: 'positive' }
    for (const p of ['peak', 'fertile', 'possible'] as const) {
      expect(lensPhase(p, rest)).toBe('none')
      expect(lensPhase(p, positive)).toBe('none')
    }
    expect(lensPhase('period-predicted', rest)).toBe('period-predicted')
    expect(lensPhase('period-predicted', positive)).toBe('none')
    expect(lensPhase('period', positive)).toBe('period')
    expect(cell('2026-09-14', rest).star).toBe(false)
  })

  it('explains days through the lens', () => {
    const info = dayInfo(input, '2026-09-13')
    expect(explainDayFor(info, { ...owner, pause: 'rest' }, false)).toContain('쉬는 중')
    expect(explainDayFor(info, { ...owner, pause: 'positive' }, false)).toContain('병원')
    expect(explainDayFor(info, noDetails, false)).toContain('우리의 주간')
    expect(explainDayFor(dayInfo(input, '2026-09-02'), noDetails, true)).not.toMatch(/생리/)
    // The partner is never asked to log.
    expect(explainDayFor(dayInfo(input, '2026-09-29'), softPartner, true)).not.toContain('기록해')
    expect(dayChanceFor(info, owner)).toBe('높음')
    expect(dayChanceFor(info, { ...owner, pause: 'rest' })).toBeNull()
    expect(dayChanceFor(info, noDetails)).toBeNull()
    expect(dayLine(info, owner)).toBe('주기 13일째 · 가임기 예상, 가능성 높음')
    expect(dayLine(info, { ...owner, pause: 'rest' })).toBe('주기 13일째')
  })
})

describe('cycleSummary through the lens', () => {
  it('a partner without details: only the shared band, no cycle day, nothing about periods', () => {
    const texts: string[] = []
    for (const d of range('2026-08-25', '2026-11-30')) {
      const s = cycleSummary(base(), d, 'explicit', { details: false, owner: false })
      expect(s.cycleDay).toBeUndefined()
      expect(s.rows.every((r) => r.key === 'window')).toBe(true)
      texts.push(s.headline.title, s.headline.sub ?? '', ...s.rows.flatMap((r) => [r.label, r.value]))
    }
    const all = texts.join('\n')
    expect(all).toContain('우리의 주간')
    expect(all).not.toMatch(/생리|가임기|배란|LH|임테기|지났어요|주기 \d+일째|임신/)
    expect(all).not.toMatch(PRESSURE_WORDS)
    // Hidden wording: no band at all.
    const hidden = cycleSummary(base(), '2026-09-12', 'hidden', { details: false, owner: false })
    expect(hidden.rows).toEqual([])
    expect(hidden.headline.sub).toBe(sharedHeadline({ kind: 'no-data' }, 'hidden').sub)
  })

  it('a rest cycle: calm headline, no window rows', () => {
    const s = cycleSummary(base(), '2026-09-07', 'explicit', { pause: 'rest' })
    expect(s.headline.title).toBe('이번 주기는 쉬어요')
    expect(s.headline.sub).toContain('다음 생리를 기록하면 다시 켜져요')
    expect(s.rows.map((r) => r.key)).toEqual(['period', 'avg'])
    expect(s.window).toBeUndefined()
    expect(cycleSummary(base(), '2026-09-07', 'soft', { pause: 'rest' }).headline.sub).not.toMatch(/가임기|배란/)
    expect(cycleSummary(base(), '2026-09-07', 'explicit', { pause: 'rest', owner: false }).headline.title).toBe('이번 주기는 쉬어 가요')
  })

  it('a positive test awaiting the clinic: calm, no celebration, no late-period nudge', () => {
    const s = cycleSummary(base(), '2026-10-02', 'explicit', { pause: 'positive', pendingSince: '2026-09-30' })
    expect(s.status.kind).toBe('late')
    expect(s.headline.title).toBe('병원에서 확인해 봐요')
    expect(s.headline.sub).not.toContain('임신 테스트')
    expect(s.rows).toEqual([{ key: 'ptest', label: '임테기 양성', value: '9월 30일 (수)', sub: '병원 확인 전', wide: true }])
    const partner = cycleSummary(base(), '2026-10-02', 'explicit', { pause: 'positive', owner: false })
    expect(`${partner.headline.title} ${partner.headline.sub}`).toContain('확인 전')
    for (const h of [s.headline, partner.headline]) expect(`${h.title}${h.sub}`).not.toMatch(/🎉|축하/)
    // A soft-wording partner (details shared): no test result by name, like the calendar.
    const soft = cycleSummary(base(), '2026-10-02', 'soft', { pause: 'positive', owner: false, pendingSince: '2026-09-30' })
    expect(soft.rows).toEqual([])
    expect(`${soft.headline.title} ${soft.headline.sub}`).not.toMatch(/임테기|양성/)
  })

  it('a partner with details reads the status without the owner-only asks', () => {
    const partnerTexts: string[] = []
    for (const d of range('2026-08-25', '2026-11-30'))
      for (const view of ['explicit', 'soft', 'hidden'] as const) {
        const h = cycleSummary(base(), d, view, { owner: false }).headline
        partnerTexts.push(h.title, h.sub ?? '')
      }
    const all = partnerTexts.join('\n')
    expect(all).not.toMatch(/기록해 주세요|LH 테스트를 해 보면|임신 테스트를 해 봐도/)
    expect(all).not.toMatch(PRESSURE_WORDS)
    // After the window: a calm "don't ask" line (review: 배란 뒤 남편 화면).
    expect(cycleSummary(base(), '2026-09-20', 'soft', { owner: false }).headline.sub).toBe('기다리는 시간이에요. 증상은 묻지 말고 평소처럼 보내요.')
    // …but no waiting framing in the hidden view.
    expect(cycleSummary(base(), '2026-09-20', 'hidden', { owner: false }).headline.sub).not.toContain('기다리는')
    // Late: same title, no nudge to test.
    const late = cycleSummary(base(), '2026-10-02', 'explicit', { owner: false }).headline
    expect(late.title).toBe('생리 예정일이 3일 지났어요')
    expect(late.sub).toContain('재촉하지 말고')
    // The owner's wording is unchanged.
    expect(cycleSummary(base(), '2026-10-02', 'explicit').headline.sub).toContain('임신 테스트')
    // The next window stays visible to a partner during the period.
    expect(cycleSummary(base(), '2026-09-02', 'soft', { owner: false }).headline.sub).toContain('우리의 주간')
  })

  it('no calendar export while paused', () => {
    expect(icsAvailability(base(), '2026-09-07', settings(), 'explicit', 'rest')).toMatchObject({ enabled: false })
    const p = icsAvailability(base(), '2026-09-07', settings(), 'explicit', 'positive')
    expect(p.enabled).toBe(false)
    expect(p.reason).not.toMatch(/가임기|배란/)
  })
})

describe('cycleHistory (시도 N번째 주기)', () => {
  const periods = [
    { start: '2026-06-01', end: '2026-06-05' },
    { start: '2026-06-29' },
    { start: '2026-07-28' },
    { start: '2026-08-25' },
    { start: '2026-09-22' },
  ]
  const input = { periods, lhTests: [], cycle: { cycleLength: 28, periodLength: 5 } }

  it('numbers the cycle containing ttcStart as #1', () => {
    const h = cycleHistory(input, '2026-09-28', '2026-07-10')
    const byStart = Object.fromEntries(h.rows.map((r) => [r.start, r.attempt]))
    expect(byStart['2026-06-29']).toBe(1)
    expect(byStart['2026-07-28']).toBe(2)
    expect(byStart['2026-09-22']).toBe(4)
    expect(byStart['2026-06-01']).toBeUndefined()
    expect(h.current).toBe(4)
    expect(h.estimated).toBe(false)
    // Started on a period day: that period is #1.
    expect(cycleHistory(input, '2026-09-28', '2026-08-25').current).toBe(2)
  })

  it('estimates cycles before the first log and across a missed log', () => {
    // Trying since March, first log in June: about three unlogged starts in between.
    const early = cycleHistory(input, '2026-09-28', '2026-03-01')
    expect(early.estimated).toBe(true)
    expect(early.rows.at(-1)!.attempt).toBe(5)
    // Just before the first log: its own cycle is #1, the first logged start #2, exact.
    const near = cycleHistory(input, '2026-09-28', '2026-05-25')
    expect(near.estimated).toBe(false)
    expect(near.rows.at(-1)!.attempt).toBe(2)
    const gap = cycleHistory({ ...input, periods: [{ start: '2026-03-01' }, { start: '2026-06-01' }] }, '2026-06-10', '2026-03-01')
    expect(gap.estimated).toBe(true)
    expect(gap.current).toBe(4) // 92 days ≈ 3 cycles of 28
    expect(cycleHistory(input, '2026-09-28').current).toBeUndefined()
  })

  it('a start date still ahead numbers nothing; a duplicate log is not another try', () => {
    expect(cycleHistory(input, '2026-09-28', '2026-10-15').current).toBeUndefined()
    expect(cycleHistory(input, '2026-09-28', '2026-10-15').rows.every((r) => r.attempt === undefined)).toBe(true)
    // 08-25 logged twice, three days apart (flagged 'short'): still the same try.
    const dup = cycleHistory({ ...input, periods: [...periods, { start: '2026-08-28' }] }, '2026-09-28', '2026-07-10')
    const byStart = Object.fromEntries(dup.rows.map((r) => [r.start, r.attempt]))
    expect(byStart['2026-08-25']).toBe(3)
    expect(byStart['2026-08-28']).toBe(3)
    expect(dup.current).toBe(4)
  })

  it('counts each cycle’s LH strips: a finished cycle without a surge reads LH N회 · 양성 없음', () => {
    const lhTests = [
      { date: '2026-06-30', result: 'negative' as const },
      { date: '2026-07-02', result: 'negative' as const, time: '08:00' },
      { date: '2026-07-02', result: 'faint' as const, time: '21:00' },
      { date: '2026-07-12', result: 'positive' as const },
      { date: '2026-08-30', result: 'negative' as const },
      { date: '2026-09-25', result: 'negative' as const },
    ]
    const h = cycleHistory({ ...input, lhTests }, '2026-09-28', '2026-07-10')
    const rows = Object.fromEntries(h.rows.map((r) => [r.start, r]))
    // 06-29 cycle: four strips and a surge → the surge line wins.
    expect(rows['2026-06-29']!.lhCount).toBe(4)
    expect(lhRowLine(rows['2026-06-29']!)).toBe('첫 LH 양성 14일째')
    // 08-25 cycle (finished 09-21): one strip, no surge.
    expect(rows['2026-08-25']!.lhCount).toBe(1)
    expect(lhRowLine(rows['2026-08-25']!)).toBe('LH 1회 · 양성 없음')
    // 07-28: none → nothing to say. The running cycle (09-22): one strip, still testing.
    expect(rows['2026-07-28']!.lhCount).toBe(0)
    expect(lhRowLine(rows['2026-07-28']!)).toBeUndefined()
    expect(rows['2026-09-22']!.lhCount).toBe(1)
    expect(lhRowLine(rows['2026-09-22']!)).toBe('LH 1회')
    // The strip on 09-25 belongs to the running cycle only.
    expect(h.rows.reduce((n, r) => n + r.lhCount, 0)).toBe(6)
  })

  it('her feel chips per cycle row (오늘 컨디션) — never built for the partner', () => {
    const h = cycleHistory(input, '2026-09-28', '2026-07-10')
    const personalLog = {
      b: {
        '2026-09-10': { feel: 'tired' as const },
        '2026-09-18': { feel: 'breast' as const, note: '음성' },
        '2026-09-20': { note: '메모만' },
        '2026-09-25': { feel: 'normal' as const },
      },
      a: { '2026-09-10': { feel: 'tired' as const } },
    }
    const feels = cycleFeels({ personalLog }, 'b', h.rows, '2026-09-28')
    expect(Object.keys(feels)).toEqual(['2026-09-22', '2026-08-25'])
    // Chips and 나만 보기 lines alike, oldest first, each cycle's own days only.
    expect(feels['2026-08-25']).toEqual([
      { date: '2026-09-10', feel: 'tired' },
      { date: '2026-09-18', feel: 'breast', note: '음성' },
      { date: '2026-09-20', note: '메모만' },
    ])
    expect(feels['2026-09-22']!.map((d) => d.feel)).toEqual(['normal'])
    expect(cycleFeels({ personalLog }, 'a', h.rows, '2026-09-28')).toEqual({ '2026-08-25': [{ date: '2026-09-10', feel: 'tired' }] })
    expect(cycleFeels({}, 'b', h.rows, '2026-09-28')).toEqual({})
  })

  it('shows each cycle’s first LH surge day', () => {
    const lhTests = [
      { date: '2026-07-11', result: 'faint' as const },
      { date: '2026-07-12', result: 'positive' as const },
      { date: '2026-07-13', result: 'peak' as const },
      { date: '2026-10-05', result: 'positive' as const },
      { date: '2026-09-23', result: 'positive' as const }, // cycle day 2 — ignored
    ]
    const h = cycleHistory({ ...input, lhTests }, '2026-09-28', '2026-07-10')
    const surge = Object.fromEntries(h.rows.map((r) => [r.start, r.surge]))
    expect(surge['2026-06-29']).toEqual({ date: '2026-07-12', cycleDay: 14 })
    expect(surge['2026-07-28']).toBeUndefined()
    // The running cycle only counts days up to today.
    expect(surge['2026-09-22']).toBeUndefined()
  })
})

describe('log sheet copy', () => {
  it('explains the strip plainly and stays calm', () => {
    expect(LH_CHOICES.map((c) => c.result)).toEqual(['negative', 'faint', 'positive', 'peak'])
    expect(LH_CHOICES.find((c) => c.result === 'faint')!.hint).toBe('검사선이 대조선보다 연해요')
    expect(PTEST_CHOICES.map((c) => c.result)).toEqual(['negative', 'faint', 'positive'])
    expect(PTEST_EARLY_NOTE).toBe('생리 예정일 전이면 음성이 나올 수 있어요.')
    const after = (['negative', 'faint', 'positive'] as const).flatMap((r) =>
      [true, false].map((explicit) => ptestAfterCopy(r, explicit)),
    )
    expect(ptestAfterCopy('positive', true).title).toBe('병원에서 확인해 봐요')
    expect(ptestAfterCopy('positive', false).body.join(' ')).not.toMatch(/가임기|배란/)
    // A past positive already followed by a period: just a record, nothing pauses.
    const settled = ptestAfterCopy('positive', true, false)
    expect(`${settled.title} ${settled.body.join(' ')}`).not.toMatch(/병원 확인 전|멈춰요/)
    after.push(settled)
    const text = [...LH_CHOICES.map((c) => c.hint), ...PTEST_CHOICES.map((c) => c.hint), ...after.flatMap((a) => [a.title, ...a.body])].join('\n')
    expect(text).not.toMatch(PRESSURE_WORDS)
    expect(text).not.toMatch(/노력|🎉|축하|정확한 배란일|성공률/)
  })
})
