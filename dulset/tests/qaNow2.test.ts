import { describe, expect, it } from 'vitest'
import { createInitialState } from '@/lib/initial'
import { partnerTip, partnerTipsFor } from '@/lib/logic/partnerTrack'
import { canSeeCycleDetails } from '@/lib/logic/prefs'
import { doctorAdvice } from '@/lib/logic/today'
import { markStillWaiting, ttcMoment } from '@/lib/logic/ttcFlow'
import type { AppState, ISODate, MemberId } from '@/lib/types'

// Final QA for Now 2: the two lib changes made while closing the visual review's notes.
// 'a' = 민수 (partner), 'b' = 지은 (tracks the cycle).
const OWNER: MemberId = 'b'
const PARTNER: MemberId = 'a'

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

const REGULAR = [{ start: '2026-06-09' }, { start: '2026-07-07' }, { start: '2026-08-04' }, { start: '2026-09-01' }]

describe('waiting-week eyebrow at low confidence (N12: no ovulation day is named)', () => {
  it('one logged period → 기다리는 주, never 배란 뒤 N일째', () => {
    const s = fresh({ periods: [{ start: '2026-09-01' }] })
    for (let i = 17; i <= 27; i++) {
      const d = `2026-09-${String(i).padStart(2, '0')}` as ISODate
      const m = ttcMoment(s, d, OWNER)
      if (!m || !/^owner\.(tww|retest)$/.test(m.copy)) continue
      expect(m.eyebrow, d).toBe('기다리는 주')
      expect(m.eyebrow, d).not.toMatch(/배란/)
    }
  })

  it('long cycles + one period → the same', () => {
    const s = fresh({ periods: [{ start: '2026-08-18' }], cycle: { cycleLength: 50, periodLength: 5, longCycles: true } })
    const m = ttcMoment(s, '2026-09-28', OWNER)
    if (m && /^owner\.(tww|retest)$/.test(m.copy)) expect(m.eyebrow).toBe('기다리는 주')
    expect(m?.eyebrow ?? '').not.toMatch(/배란 뒤/)
  })

  it('three regular cycles keep the counted eyebrow (positive control)', () => {
    const s = fresh({ periods: REGULAR })
    const m = ttcMoment(s, '2026-09-20', OWNER)
    expect(m?.copy).toBe('owner.tww')
    expect(m?.eyebrow).toMatch(/^배란 뒤 \d+일째 \(예상\)$/)
  })
})

describe("partner tip vs the moment body (one screen never says the same sentence twice)", () => {
  it('tww: the tip no longer repeats 증상은 묻지 말고', () => {
    // (N19) The waiting card is for a partner she shares the details with; without
    // them the waiting weeks are the '평소 주' card.
    const s = { ...fresh({ periods: REGULAR }), settings: { ...fresh().settings, shareLevel: 'details' as const } }
    const m = ttcMoment(s, '2026-09-20', PARTNER)
    expect(m?.copy).toBe('partner.tww')
    expect(m?.body).toContain('증상은 묻지 말고')
    const tip = partnerTip(s, '2026-09-20', PARTNER)
    // (N24) One of the waiting week's rotating lines.
    expect(partnerTipsFor('partner.tww')).toContain(tip)
    expect(tip).not.toContain('증상은 묻지')
    expect(ttcMoment(fresh({ periods: REGULAR }), '2026-09-20', PARTNER)?.copy).toBe('partner.neutral')
  })

  it('every day of a cycle: no sentence of the tip appears in the card', () => {
    const plain = fresh({ periods: REGULAR })
    for (const s of [plain, { ...plain, settings: { ...plain.settings, shareLevel: 'details' as const } }]) {
      for (let i = 1; i <= 30; i++) {
        const d = `2026-09-${String(i).padStart(2, '0')}` as ISODate
        const m = ttcMoment(s, d, PARTNER)
        const tip = partnerTip(s, d, PARTNER)
        if (!m || !tip) continue
        const card = [m.eyebrow, m.title, m.body, m.note, m.partnerTip].filter(Boolean).join(' ')
        for (const sentence of tip.split(/[.,] ?/).map((x) => x.trim()).filter((x) => x.length > 4)) {
          expect(card, `${d}: "${sentence}"`).not.toContain(sentence)
        }
      }
    }
  })
})

describe("DoctorCard 'amenorrhea' reason is her period data (viewer gate)", () => {
  // 31-day cycle, last start 08-20, due 09-20; 10-07 is 17 days late and she answered '아직 안 왔어요'.
  const LATE = ['2026-05-19', '2026-06-19', '2026-07-20', '2026-08-20'].map((start) => ({ start }))
  const DAY = '2026-10-07'
  const waiting = () => markStillWaiting(fresh({ periods: LATE }), '2026-08-20', DAY)

  it('the couple view and the owner get it', () => {
    expect(doctorAdvice(waiting(), DAY)?.reasons).toContain('amenorrhea')
    expect(doctorAdvice(waiting(), DAY, OWNER)?.reasons).toContain('amenorrhea')
  })

  it('the partner without shared details never gets it (and the card is empty)', () => {
    const s = waiting()
    expect(canSeeCycleDetails(s, PARTNER)).toBe(false)
    expect(doctorAdvice(s, DAY, PARTNER)).toBeNull()
  })

  it('with shared details he reads it', () => {
    const s = { ...waiting(), settings: { ...waiting().settings, shareLevel: 'details' as const } }
    expect(canSeeCycleDetails(s, PARTNER)).toBe(true)
    expect(doctorAdvice(s, DAY, PARTNER)?.reasons).toContain('amenorrhea')
  })
})

describe('irregular-cycle doctor line follows the sharing lens (lead decision after QA)', () => {
  const irregular = fresh({
    periods: [{ start: '2026-05-01' }, { start: '2026-05-24' }, { start: '2026-07-03' }, { start: '2026-07-30' }, { start: '2026-09-01' }],
  })
  it('the owner and a partner with shared details read it', () => {
    expect(doctorAdvice(irregular, '2026-09-10', OWNER)?.reasons).toContain('irregular')
    const shared = { ...irregular, settings: { ...irregular.settings, shareLevel: 'details' as const } }
    expect(canSeeCycleDetails(shared, PARTNER)).toBe(true)
    expect(doctorAdvice(shared, '2026-09-10', PARTNER)?.reasons).toContain('irregular')
  })
  it('a partner without shared details does not', () => {
    expect(canSeeCycleDetails(irregular, PARTNER)).toBe(false)
    expect(doctorAdvice(irregular, '2026-09-10', PARTNER)?.reasons ?? []).not.toContain('irregular')
  })
})
