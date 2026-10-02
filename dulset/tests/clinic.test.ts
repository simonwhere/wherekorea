import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import {
  CLINIC_LABEL,
  CLINIC_PARTNER_HEADLINE,
  cycleLens,
  cycleSummary,
  explainDayFor,
  icsAvailability,
  legendItems,
  lensPhase,
  pauseHeadline,
  sharedHeadline,
} from '@/lib/logic/calendarView'
import { CLINIC_REASON, clinicRest, clinicSince, endClinicMode, isClinicMode, setClinicMode, startClinicMode } from '@/lib/logic/clinic'
import { dayInfo } from '@/lib/logic/cycle'
import { fertileHintsAllowed } from '@/lib/logic/dateIdeas'
import { doctorTold, scheduledNotices } from '@/lib/logic/notifications'
import { tickItem } from '@/lib/logic/plan'
import { customDeadlineTasks, planDeadlineNotices } from '@/lib/logic/planNotices'
import { sanitizeBackup } from '@/lib/logic/settings'
import { noticeTarget } from '@/lib/logic/today'
import { activeRest, onPeriodLogged, periodEndsRest, startRestCycle } from '@/lib/logic/ttc'
import { parseState } from '@/lib/storage'
import { REST_REASONS, type AppState } from '@/lib/types'

const TODAY = '2026-10-02'

function fresh(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart: '2026-09-21' },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

describe('clinic mode (병원과 함께 준비 중)', () => {
  it('is a rest cycle with reason clinic, from the day it was turned on', () => {
    const s = startClinicMode(fresh(), TODAY)
    expect(s.restCycle).toEqual({ since: TODAY, reason: 'clinic' })
    expect(isClinicMode(s)).toBe(true)
    expect(clinicRest(s)).toEqual({ since: TODAY, reason: CLINIC_REASON })
    expect(clinicSince(s)).toBe(TODAY)
    expect(REST_REASONS).toContain('clinic')
    // Off by default; a bad date does nothing.
    const base = fresh()
    expect(isClinicMode(base)).toBe(false)
    expect(clinicSince(base)).toBeUndefined()
    expect(startClinicMode(base, 'soon')).toBe(base)
  })

  it('does not end when a period is logged — only the couple ends it', () => {
    let s = startClinicMode(fresh(), '2026-09-25')
    s = { ...s, periods: [...s.periods, { start: '2026-10-01', by: 'b' }] }
    expect(isClinicMode(s)).toBe(true)
    expect(clinicSince(s)).toBe('2026-09-25')
    const off = endClinicMode(s)
    expect('restCycle' in off).toBe(false)
    expect(isClinicMode(off)).toBe(false)
    expect(endClinicMode(off)).toBe(off)
  })

  it('keeps the first date when turned on twice, takes over an ordinary rest, and leaves other rests alone when ending', () => {
    const on = startClinicMode(fresh(), '2026-09-25')
    expect(startClinicMode(on, TODAY)).toBe(on)
    const fromRest = startClinicMode(startRestCycle(fresh(), '2026-09-20', 'rest'), TODAY)
    expect(fromRest.restCycle).toEqual({ since: TODAY, reason: 'clinic' })
    const vaccine = startRestCycle(fresh(), '2026-09-20', 'vaccine')
    expect(endClinicMode(vaccine)).toBe(vaccine)
    expect(isClinicMode(vaccine)).toBe(false)
  })

  it('a logged period never ends it — activeRest and onPeriodLogged agree with isClinicMode', () => {
    const s = startClinicMode(fresh(), '2026-09-25')
    expect(periodEndsRest(s.restCycle!, '2026-10-01')).toBe(false)
    expect(periodEndsRest(s.restCycle!, '2027-01-01')).toBe(false)
    const logged = { ...s, periods: [...s.periods, { start: '2026-10-01', by: 'b' as const }] }
    expect(activeRest(logged)?.reason).toBe('clinic')
    expect(onPeriodLogged(logged, '2026-10-01').restCycle).toEqual({ since: '2026-09-25', reason: 'clinic' })
    // An ordinary rest still ends with the next period.
    const rest = startRestCycle(fresh(), '2026-09-25', 'rest')
    expect(periodEndsRest(rest.restCycle!, '2026-10-01')).toBe(true)
  })

  it('setClinicMode is the toggle', () => {
    const on = setClinicMode(fresh(), true, TODAY)
    expect(isClinicMode(on)).toBe(true)
    expect(isClinicMode(setClinicMode(on, false, TODAY))).toBe(false)
  })

  it('survives a reload and a backup', () => {
    const s = startClinicMode(fresh(), TODAY)
    const raw = JSON.stringify(s)
    expect(parseState(raw)!.restCycle).toEqual({ since: TODAY, reason: 'clinic' })
    expect(sanitizeBackup(JSON.parse(raw))!.restCycle).toEqual({ since: TODAY, reason: 'clinic' })
    const bad = JSON.parse(raw) as AppState
    bad.restCycle = { since: TODAY, reason: 'hospital' as never }
    expect(sanitizeBackup(bad)!.restCycle).toBeUndefined()
  })
})

describe('clinic mode on the screens (N13)', () => {
  const on = () => startClinicMode(fresh(), '2026-09-25')

  it('is a pause of its own on the calendar: logged data only, no projected period, no .ics', () => {
    const s = on()
    const lens = cycleLens(s, 'b')
    expect(lens.pause).toBe('clinic')
    expect(cycleLens(startRestCycle(fresh(), '2026-09-25', 'rest'), 'b').pause).toBe('rest')
    // 10-19 is inside the expected range of the 09-21 cycle: predicted for an ordinary rest, nothing with a clinic.
    const predicted = dayInfo(s, '2026-10-19', TODAY)
    expect(predicted.phase).toBe('period-predicted')
    expect(lensPhase(predicted.phase, lens)).toBe('none')
    expect(lensPhase(predicted.phase, { ...lens, pause: 'rest' })).toBe('period-predicted')
    expect(lensPhase('fertile', lens)).toBe('none')
    expect(lensPhase('period', lens)).toBe('period')
    expect(legendItems('explicit', lens).map((i) => i.key)).toEqual(['period'])
    expect(explainDayFor(predicted, lens, false)).toContain('병원과 함께 준비하는 동안')
    expect(icsAvailability(s, TODAY, s.settings, 'explicit', 'clinic')).toMatchObject({ enabled: false })
    expect(icsAvailability(s, TODAY, s.settings, 'explicit', 'clinic').reason).toContain('병원과 함께')
    // The 주기 tab's first card: owner and partner lines, only the average row.
    const own = cycleSummary(s, TODAY, 'explicit', lens)
    expect(own.headline).toMatchObject({ title: CLINIC_LABEL })
    expect(own.headline.sub).toContain('생리를 기록해도 꺼지지 않아요')
    expect(own.rows.map((r) => r.key)).toEqual(['avg'])
    expect(pauseHeadline('clinic', 'soft', false)).toEqual(CLINIC_PARTNER_HEADLINE)
    expect(sharedHeadline({ kind: 'no-data' }, 'soft', 'clinic')).toEqual(CLINIC_PARTNER_HEADLINE)
    expect(cycleSummary(s, TODAY, 'soft', cycleLens(s, 'a')).headline).toEqual(CLINIC_PARTNER_HEADLINE)
    expect(cycleSummary(s, TODAY, 'hidden', cycleLens(s, 'a')).headline).toEqual(CLINIC_PARTNER_HEADLINE)
  })

  it('sends no date notice and no 🩺 notice while on; both come back when it ends', () => {
    const long: AppState = { ...on(), settings: { ...on().settings, ttcStart: '2025-01-01' } }
    const kinds = (s: AppState, d: string) => scheduledNotices(s, d).filter((n) => n.kind !== 'milestone' && !n.key.startsWith('anniv:')).map((n) => n.kind)
    // 10-18 is the day before the expected range of the 09-21 cycle; 11-05 is late.
    for (const d of ['2026-10-01', '2026-10-18', '2026-11-05']) expect(kinds(long, d)).toEqual([])
    const off = endClinicMode(long)
    expect(kinds(off, '2026-10-01')).toContain('doctor')
    expect(doctorTold(long, '2025-01-01')).toBe(false)
  })

  it('keeps date ideas and the 우리의 주간 teaser off both screens', () => {
    const s = on()
    expect(fertileHintsAllowed(s, 'a')).toBe(false)
    expect(fertileHintsAllowed(s, 'b')).toBe(false)
    expect(fertileHintsAllowed(endClinicMode(s), 'a')).toBe(true)
  })
})

describe("the couple's own '기한' items get D-7 · D-1 · 당일 notices (N13)", () => {
  const dated = (deadlineAlerts: boolean | undefined, who: 'a' | 'b' | 'both' = 'both'): AppState => {
    const s = fresh()
    const task = { id: 'notice-expiry', title: '결정통지서 만료', phase: 'preconception' as const, who, createdBy: 'b' as const, due: '2026-10-20' }
    return { ...s, customTasks: [{ ...task, ...(deadlineAlerts === undefined ? {} : { deadlineAlerts }) }] }
  }
  const at = (s: AppState, d: string) => planDeadlineNotices(s, d).filter((n) => n.key.startsWith('deadline:notice-expiry:'))

  it('while preparing, only items with the check on — to whoever the item is for', () => {
    const s = dated(true)
    expect(customDeadlineTasks(s).map((c) => c.id)).toEqual(['notice-expiry'])
    const d7 = at(s, '2026-10-13')
    expect(d7.map((n) => n.to).sort()).toEqual(['a', 'b'])
    expect(d7[0]).toMatchObject({ kind: 'system', title: '📝 결정통지서 만료 D-7', key: 'deadline:notice-expiry:2026-10-20:7:a' })
    expect(d7[0]!.body).toContain('10월 20일')
    expect(at(s, '2026-10-19')[0]!.title).toContain('D-1')
    expect(at(s, '2026-10-20')[0]!.title).toContain('오늘까지예요')
    expect(at(s, '2026-10-14')).toEqual([])
    expect(at(s, '2026-10-21')).toEqual([])
    expect(noticeTarget(d7[0]!.kind, 'preparing', d7[0]!.key)).toBe('plan')
    expect(at(dated(true, 'b'), '2026-10-13').map((n) => n.to)).toEqual(['b'])
    // Off (or never set): a shopping item never nags.
    expect(at(dated(false), '2026-10-13')).toEqual([])
    expect(at(dated(undefined), '2026-10-13')).toEqual([])
    expect(customDeadlineTasks(dated(undefined))).toEqual([])
  })

  it('stops once the item is ticked, and needs a real date', () => {
    const s = dated(true)
    expect(at(tickItem('notice-expiry', true, '2026-10-10', 'b')(s), '2026-10-13')).toEqual([])
    const undated: AppState = { ...s, customTasks: [{ ...s.customTasks[0]!, due: undefined }] }
    expect(at(undated, '2026-10-13')).toEqual([])
    expect(customDeadlineTasks(undated)).toEqual([])
    // Survives a backup: the flag is kept only as a boolean.
    expect(sanitizeBackup(JSON.parse(JSON.stringify(s)))!.customTasks[0]!.deadlineAlerts).toBe(true)
  })
})
