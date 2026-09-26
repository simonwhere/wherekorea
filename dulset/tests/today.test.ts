import { describe, expect, it } from 'vitest'
import {
  SUGGESTIONS,
  availableSuggestions,
  infoNotes,
  isSuggestionAdded,
  normalizeLabel,
  suggestionsForRole,
} from '@/lib/content/supplements'
import { activeItems, addCheckItem, toggleCheck } from '@/lib/logic/checks'
import { fertilityStatus } from '@/lib/logic/cycle'
import { NUDGES_PER_DAY, inbox, nudgesSentToday, sendNudge } from '@/lib/logic/notifications'
import { fertilityView } from '@/lib/logic/calendarView'
import {
  LMP_MAX_DAYS,
  SPERM_CYCLE_DAYS,
  confirmPregnancy,
  dayCount,
  doctorAdvice,
  fertilityVoice,
  firstUnchecked,
  folicTimer,
  greetingFor,
  groupByDay,
  habitTimer,
  isSpermSide,
  isValidLmp,
  lastPeriodStart,
  laterOf,
  noticeTarget,
  nowOn,
  relativeTimeKo,
  rowProgress,
  showDateTeaser,
  splitTitleIcon,
  stampOn,
  toggleWithCompletion,
} from '@/lib/logic/today'
import { createInitialState } from '@/lib/initial'
import type { AppState } from '@/lib/types'

// 'a' = 민수 (does not track the cycle), 'b' = 지은 (tracks the cycle).
function fresh(over: Partial<AppState> = {}): AppState {
  const s = createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1993 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-01',
      ttcStart: '2026-09-01',
    },
    new Date(2026, 8, 1, 9, 0),
  )
  return { ...s, ...over }
}

describe('greeting', () => {
  it('picks morning / afternoon / evening', () => {
    expect(greetingFor(7)).toBe('좋은 아침이에요')
    expect(greetingFor(13)).toBe('좋은 오후예요')
    expect(greetingFor(21)).toBe('좋은 저녁이에요')
    expect(greetingFor(2)).toBe('좋은 저녁이에요')
  })
})

describe('fertility voice', () => {
  const base = { lowPressure: false, alertStyle: { a: 'soft', b: 'explicit' } as const }

  it('is explicit for the cycle owner and soft for a soft partner', () => {
    expect(fertilityVoice(base, 'b', true)).toBe('explicit')
    expect(fertilityVoice(base, 'a', false)).toBe('soft')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'explicit', b: 'explicit' } }, 'a', false)).toBe('explicit')
  })

  it("respects an owner who chose the soft wording (same rule as the calendar)", () => {
    const soft = { lowPressure: false, alertStyle: { a: 'soft', b: 'soft' } as const }
    expect(fertilityVoice(soft, 'b', true)).toBe('soft')
    expect(fertilityView(soft, 'b', 'b')).toBe('soft')
    // Nothing stored: the owner defaults to explicit, the partner to soft.
    const none = { lowPressure: false, alertStyle: undefined as never }
    expect(fertilityVoice(none, 'b', true)).toBe('explicit')
    expect(fertilityVoice(none, 'a', false)).toBe('soft')
  })

  it('goes calm with low-pressure mode or alerts off — even for the owner', () => {
    expect(fertilityVoice({ ...base, lowPressure: true }, 'b', true)).toBe('calm')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'off', b: 'explicit' } }, 'a', false)).toBe('calm')
    expect(fertilityVoice({ ...base, alertStyle: { a: 'soft', b: 'off' } }, 'b', true)).toBe('calm')
  })

  it('shows the date teaser only near the window and never when calm', () => {
    const s = fresh()
    const fertile = fertilityStatus(s, '2026-09-12')
    expect(fertile.kind).toBe('fertile')
    expect(showDateTeaser(fertile, 'soft')).toBe(true)
    expect(showDateTeaser(fertile, 'calm')).toBe(false)
    const early = fertilityStatus(s, '2026-09-06')
    expect(early).toMatchObject({ kind: 'before-fertile', daysUntil: 4 })
    expect(showDateTeaser(early, 'explicit')).toBe(false)
    expect(showDateTeaser(fertilityStatus(s, '2026-09-07'), 'explicit')).toBe(true)
  })
})

describe('checks on the home screen', () => {
  it('notifies the partner exactly when the list is completed', () => {
    let s = fresh()
    const items = activeItems(s, 'a')
    const day = '2026-09-02'
    const now = '2026-09-02T09:00:00+09:00'
    for (const [i, item] of items.entries()) {
      const r = toggleWithCompletion(s, 'a', 'b', day, item.id, now)
      s = r.state
      expect(r.completed).toBe(i === items.length - 1)
    }
    expect(rowProgress(s, 'a', day)).toEqual({ done: items.length, total: items.length, complete: true })
    const done = inbox(s, 'b').filter((n) => n.kind === 'cheer')
    expect(done).toHaveLength(1)
    expect(done[0]!.title).toContain('민수')
    // Un-check and re-check: still only one notice that day.
    s = toggleWithCompletion(s, 'a', 'b', day, items[0]!.id, now).state
    const again = toggleWithCompletion(s, 'a', 'b', day, items[0]!.id, now)
    expect(again.completed).toBe(true)
    expect(inbox(again.state, 'b').filter((n) => n.kind === 'cheer')).toHaveLength(1)
  })

  it('finds the first unchecked item for a nudge', () => {
    let s = fresh()
    const [first, second] = activeItems(s, 'b')
    expect(firstUnchecked(s, 'b', '2026-09-02')?.id).toBe(first!.id)
    s = toggleCheck(s, 'b', '2026-09-02', first!.id)
    expect(firstUnchecked(s, 'b', '2026-09-02')?.id).toBe(second!.id)
  })
})

describe('clock anchored to today', () => {
  it('keeps the device time but uses the app date', () => {
    const d = nowOn('2026-10-01', new Date(2026, 8, 26, 9, 5, 7))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2026, 9, 1, 9, 5, 7,
    ])
    expect(stampOn('2026-10-01', new Date(2026, 8, 26, 9, 5, 7))).toMatch(/^2026-10-01T09:05:07[+-]\d{2}:\d{2}$/)
    // Same day → identical to the plain clock.
    expect(stampOn('2026-09-26', new Date(2026, 8, 26, 23, 59, 0)).slice(0, 19)).toBe('2026-09-26T23:59:00')
  })

  it('makes the 3-a-day 콕 limit and 오늘 grouping work on a pinned date', () => {
    let s = fresh()
    const pinned = '2026-10-01'
    const realClock = new Date(2026, 8, 26, 9, 0)
    for (let i = 0; i < NUDGES_PER_DAY + 1; i++) s = sendNudge(s, 'a', 'b', pinned, stampOn(pinned, realClock), '엽산')
    expect(nudgesSentToday(s, 'a', pinned)).toBe(NUDGES_PER_DAY)
    expect(groupByDay(inbox(s, 'b'), pinned).today).toHaveLength(NUDGES_PER_DAY)
  })
})

describe('habit timers', () => {
  it('counts Korean-style from the start day', () => {
    expect(dayCount('2026-09-01', '2026-09-01')).toBe(1)
    expect(dayCount('2026-09-01', '2026-09-10')).toBe(10)
    expect(dayCount('2026-09-11', '2026-09-10')).toBeUndefined()
    expect(dayCount(undefined, '2026-09-10')).toBeUndefined()
    expect(laterOf('2026-09-01', '2026-09-05')).toBe('2026-09-05')
    expect(laterOf(undefined, '2026-09-05')).toBe('2026-09-05')
    expect(laterOf('2026-09-01', undefined)).toBe('2026-09-01')
  })

  it('uses ttcStart, or the first habit check when that is later', () => {
    let s = fresh()
    expect(habitTimer(s, 'a', '2026-09-10')).toMatchObject({ start: '2026-09-01', day: 10 })
    const habit = activeItems(s, 'a').find((i) => i.kind === 'habit')!
    s = toggleCheck(s, 'a', '2026-09-05', habit.id)
    const t = habitTimer(s, 'a', '2026-09-10')
    expect(t).toMatchObject({ start: '2026-09-05', day: 6, goal: SPERM_CYCLE_DAYS })
    expect(t.progress).toBeCloseTo(6 / SPERM_CYCLE_DAYS)
    expect(habitTimer(s, 'a', '2026-12-31').progress).toBe(1)
  })

  it('only treats a non-owner who is not 아내 as the sperm side', () => {
    expect(isSpermSide({ tracksCycle: false, role: 'husband' })).toBe(true)
    expect(isSpermSide({ tracksCycle: false, role: 'partner' })).toBe(true)
    expect(isSpermSide({ tracksCycle: false, role: 'wife' })).toBe(false)
    expect(isSpermSide({ tracksCycle: true, role: 'wife' })).toBe(false)
  })

  it('tracks folic acid from its first check', () => {
    let s = fresh()
    expect(folicTimer(s, 'a', '2026-09-10')).toBeNull() // 민수 has no 엽산 item
    const t0 = folicTimer(s, 'b', '2026-09-10')
    expect(t0?.item.label).toBe('엽산')
    expect(t0?.day).toBeUndefined()
    s = toggleCheck(s, 'b', '2026-09-03', t0!.item.id)
    expect(folicTimer(s, 'b', '2026-09-10')?.day).toBe(8)
  })
})

describe('doctor advice', () => {
  it('follows the age threshold and irregular cycles', () => {
    expect(doctorAdvice(fresh(), '2026-09-20')).toBeNull()
    const long = fresh({ settings: { ...fresh().settings, ttcStart: '2025-08-01' } })
    expect(doctorAdvice(long, '2026-09-20')?.reasons).toEqual(['months'])
    // 지은 born 1990 → 36 in 2026 → 6 months.
    const older = fresh({
      couple: {
        ...fresh().couple,
        members: [fresh().couple.members[0], { ...fresh().couple.members[1], birthYear: 1990 }],
      },
      settings: { ...fresh().settings, ttcStart: '2026-03-01' },
    })
    expect(doctorAdvice(older, '2026-09-20')).toMatchObject({ reasons: ['months'], threshold: 6 })
    const irregular = fresh({
      periods: [{ start: '2026-05-01' }, { start: '2026-05-23' }, { start: '2026-06-30' }, { start: '2026-07-24' }],
    })
    expect(doctorAdvice(irregular, '2026-08-01')).toMatchObject({ irregularBy: 'variation' })
    expect(doctorAdvice(irregular, '2026-08-01')?.reasons).toContain('irregular')
    // Only an entered 40-day cycle (nothing measured yet) → "short or long", not "varies a lot".
    const longCycle = fresh({ cycle: { cycleLength: 40, periodLength: 5 } })
    expect(doctorAdvice(longCycle, '2026-09-20')).toMatchObject({ reasons: ['irregular'], irregularBy: 'length' })
    expect(doctorAdvice(fresh(), '2026-09-20')?.irregularBy).toBeUndefined()
    // 40+ → right away, even on day one.
    const forty = fresh({
      couple: {
        ...fresh().couple,
        members: [fresh().couple.members[0], { ...fresh().couple.members[1], birthYear: 1986 }],
      },
    })
    expect(doctorAdvice(forty, '2026-09-01')).toMatchObject({ reasons: ['age'], threshold: 0 })
    expect(doctorAdvice({ ...long, stage: 'pregnant' }, '2026-09-20')).toBeNull()
  })
})

describe('pregnancy confirmation', () => {
  it('validates the LMP and tells the other member', () => {
    const s = fresh()
    expect(lastPeriodStart(s)).toBe('2026-09-01')
    expect(isValidLmp('2026-09-01', '2026-10-05')).toBe(true)
    expect(isValidLmp('2026-10-06', '2026-10-05')).toBe(false)
    expect(isValidLmp('2025-09-01', '2026-10-05')).toBe(false)
    expect(isValidLmp('2025-12-01', '2026-10-05')).toBe(true) // exactly LMP_MAX_DAYS back
    expect(isValidLmp('2025-11-30', '2026-10-05')).toBe(false)
    // Same 44 weeks as the 임신 tab / 설정 / 예정일 수정 (pregnancyView.validateLmp).
    expect(LMP_MAX_DAYS).toBe(308)
    expect(isValidLmp('nope', '2026-10-05')).toBe(false)
    const next = confirmPregnancy(s, '2026-09-01', '2026-10-05', 'b', 'a', '2026-10-05T08:00:00+09:00')
    expect(next.stage).toBe('pregnant')
    expect(next.pregnancy?.lmp).toBe('2026-09-01')
    const msg = inbox(next, 'a')
    expect(msg).toHaveLength(1)
    expect(msg[0]!.body).toContain('지은')
    expect(inbox(next, 'b')).toHaveLength(0)
  })
})

describe('inbox helpers', () => {
  it('uses the leading emoji as the icon', () => {
    expect(splitTitleIcon('👉 지은님이 콕 찔렀어요', 'nudge')).toEqual({ icon: '👉', text: '지은님이 콕 찔렀어요' })
    expect(splitTitleIcon('🗓️ 내일이 생리 예정일이에요', 'period-due')).toEqual({
      icon: '🗓️',
      text: '내일이 생리 예정일이에요',
    })
    expect(splitTitleIcon('알림', 'doctor')).toEqual({ icon: '🩺', text: '알림' })
  })

  it('formats relative time', () => {
    const now = Date.parse('2026-09-26T12:00:00+09:00')
    expect(relativeTimeKo('2026-09-26T11:59:30+09:00', now)).toBe('방금')
    expect(relativeTimeKo('2026-09-26T11:55:00+09:00', now)).toBe('5분 전')
    expect(relativeTimeKo('2026-09-26T09:00:00+09:00', now)).toBe('3시간 전')
    expect(relativeTimeKo('2026-09-24T09:00:00+09:00', now)).toBe('2일 전')
    expect(relativeTimeKo('2026-09-03T09:00:00+09:00', now)).toBe('9월 3일')
    expect(relativeTimeKo('garbage', now)).toBe('')
  })

  it('opens only tabs that exist in the current stage', () => {
    expect(noticeTarget('nudge', 'preparing')).toBe('today')
    expect(noticeTarget('cheer', 'parenting')).toBe('today')
    expect(noticeTarget('fertile-start', 'preparing')).toBe('cycle')
    expect(noticeTarget('peak', 'pregnant')).toBeNull() // no 달력 tab while pregnant
    expect(noticeTarget('milestone', 'pregnant')).toBe('pregnancy')
    expect(noticeTarget('milestone', 'parenting')).toBe('baby')
    expect(noticeTarget('milestone', 'preparing')).toBeNull()
    expect(noticeTarget('milestone', 'pregnant', 'anniv:met-year:5:2026-05-14:0:a')).toBe('diary')
    expect(noticeTarget('system', 'preparing', 'appt:x:2026-09-10:1:a')).toBe('plan')
    expect(noticeTarget('system', 'parenting', 'deadline:birth-report:2026-10-28:7:a')).toBe('plan')
    expect(noticeTarget('system', 'preparing', 'reaction:e1:a')).toBe('diary')
    expect(noticeTarget('date-idea', 'parenting')).toBe('date')
    expect(noticeTarget('doctor', 'preparing')).toBe('today')
    expect(noticeTarget('system', 'preparing')).toBeNull()
  })

  it('groups by the local date prefix', () => {
    const g = groupByDay(
      [{ createdAt: '2026-09-26T08:00:00+09:00' }, { createdAt: '2026-09-25T23:00:00+09:00' }],
      '2026-09-26',
    )
    expect(g.today).toHaveLength(1)
    expect(g.earlier).toHaveLength(1)
  })
})

describe('supplement suggestions', () => {
  it('has the core evidence-backed items', () => {
    const folic = SUGGESTIONS.find((s) => s.id === 'folic-acid')!
    expect(folic).toMatchObject({ evidence: 'strong', audience: 'cycle-owner' })
    expect(SUGGESTIONS.find((s) => s.id === 'male-zinc-folate')).toMatchObject({
      evidence: 'not-recommended',
      infoOnly: true,
    })
    for (const s of SUGGESTIONS) expect(s.source.url).toMatch(/^https?:\/\//)
  })

  it('filters by who tracks the cycle', () => {
    const owner = suggestionsForRole('cycle-owner').map((s) => s.id)
    const partner = suggestionsForRole('partner').map((s) => s.id)
    expect(owner).toContain('folic-acid')
    expect(owner).not.toContain('no-sauna')
    expect(partner).toContain('no-sauna')
    expect(partner).not.toContain('folic-acid')
    expect(owner).toContain('no-alcohol')
    expect(partner).toContain('no-alcohol')
    // A non-owner who is 아내 gets no sperm-side advice (heat, men's supplements).
    const noSperm = suggestionsForRole('partner', { sperm: false }).map((s) => s.id)
    expect(noSperm).toContain('no-alcohol')
    expect(noSperm).not.toContain('no-sauna')
    expect(noSperm).not.toContain('no-laptop-lap')
    expect(noSperm).not.toContain('coq10')
    expect(infoNotes('partner', { sperm: false })).toHaveLength(0)
    // Conception-only advice disappears once pregnant / parenting.
    for (const stage of ['pregnant', 'parenting'] as const) {
      const ids = suggestionsForRole('partner', { stage }).map((s) => s.id)
      expect(ids).not.toContain('no-laptop-lap')
      expect(ids).not.toContain('no-sauna')
      expect(ids).not.toContain('coq10')
      expect(ids).not.toContain('male-zinc-folate')
      expect(ids).toContain('no-smoking')
    }
    expect(suggestionsForRole('partner', { stage: 'preparing' }).map((s) => s.id)).toContain('no-laptop-lap')
  })

  it('hides what is already on the list, matching loosely', () => {
    expect(normalizeLabel('비타민 D')).toBe('비타민d')
    const coq = SUGGESTIONS.find((s) => s.id === 'coq10')!
    expect(isSuggestionAdded(coq, [{ label: '코엔자임Q10' }])).toBe(true)
    const s = fresh()
    const partnerIds = availableSuggestions('partner', activeItems(s, 'a')).map((x) => x.id)
    // Defaults: sauna, no smoking, no alcohol, exercise.
    expect(partnerIds).not.toContain('no-sauna')
    expect(partnerIds).not.toContain('no-smoking')
    expect(partnerIds).not.toContain('exercise')
    expect(partnerIds).toContain('caffeine')
    expect(partnerIds).not.toContain('male-zinc-folate') // info-only, never offered
    expect(partnerIds).not.toContain('coq10') // low-certainty: a note, not a "추천 항목"
    expect(infoNotes('partner').map((x) => x.id)).toEqual(['coq10', 'male-zinc-folate'])
    expect(infoNotes('cycle-owner')).toHaveLength(0)
    const ownerIds = availableSuggestions('cycle-owner', activeItems(s, 'b')).map((x) => x.id)
    expect(ownerIds).not.toContain('folic-acid')
    expect(ownerIds).not.toContain('vitamin-d')
    expect(ownerIds).toContain('multivitamin')
    const added = addCheckItem(s, 'b', '커피 한 잔만', 'habit', '2026-09-02')
    expect(availableSuggestions('cycle-owner', activeItems(added, 'b')).map((x) => x.id)).not.toContain('caffeine')
  })
})
