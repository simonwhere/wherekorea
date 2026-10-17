// Seams between the three 2026-10-17 tracks (founder decision "추천대로 1~3번 다
// 진행해줘"), at the logic level:
//  ① the link renews itself while 둘셋 is in use (renewedExpiry → the couple.link
//    mirror) × the snapshot builder: a renewal moves only the expiry, so the
//    snapshot it triggers is the same one (nothing re-sent, nothing new on his
//    page), the link's first-two-weeks order (from createdAt) never restarts,
//    and the expiry never travels to him (it is hers to see, not a read receipt);
//  ② her '나만 보기' appointment booked from one of her items × his [같이 할게요]
//    (the link's 'support' event, the pregnant link that dates items from
//    bookings): his seven-day page is the page without it, before and after he
//    says it; his answer lands exactly as it would without it and leaves her
//    appointment untouched.

import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { createDemoState } from '@/lib/demo'
import { addAppointment, sharedAppointments } from '@/lib/logic/appointments'
import { applyPartnerEvent, partnerEventProblem, type PartnerEvent } from '@/lib/logic/partnerEvents'
import { coupleLinkOf, makeLink, renewedExpiry, setCoupleLink } from '@/lib/logic/partnerLink'
import { buildPartnerSnapshot } from '@/lib/logic/partnerSnapshot'
import { planItems } from '@/lib/logic/plan'
import { stampOn } from '@/lib/logic/today'
import { canSupportItem, isSupported, supportKey } from '@/lib/logic/together'
import { renewLinkOnTransport } from '@/lib/useLinkSync'
import type { AppState, ISODate, Stage } from '@/lib/types'

const T: ISODate = '2026-10-17'
const HIM = 'a' as const
const HER = 'b' as const
const demo = (stage: Stage, today: ISODate = T) => createDemoState(today, new Date(`${today}T10:00:00`), stage)
/** A fixed random source, so the token and the couple id are the same on every run. */
const fixed = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256)

describe('① a renewal × the snapshot builder', () => {
  for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
    it(`${stage}: renewing moves only the expiry — the snapshot is the same, and the expiry is never in it`, async () => {
      const link = makeLink(null, stampOn(T), fixed)
      for (const day of [addDays(T, 5), addDays(T, 20)]) {
        const nowISO = stampOn(day)
        const renewedAt = renewedExpiry(link, nowISO)
        expect(renewedAt, day).not.toBeNull()
        // What the owner tab keeps after the transport took it (renewLinkOnTransport → keepRenewal).
        const renewed = await renewLinkOnTransport(link, nowISO, { extendToken: async () => `${addDays(day, 30)}T00:00:00Z` })
        expect(renewed).toEqual({ ...link, expiresAt: renewedAt })
        const base = demo(stage, day)
        const before = setCoupleLink(base, coupleLinkOf(link))
        const after = setCoupleLink(before, coupleLinkOf(renewed!))
        expect(after.couple.link!.createdAt).toBe(link.createdAt)
        expect(after.couple.link!.expiresAt).toBe(renewedAt)
        // The couple.link mirror moving re-runs the publish effect: the same snapshot → nothing re-sent
        // (and, the two expiries differing, proof that neither is in it).
        const snap = buildPartnerSnapshot(after, day, HIM)
        expect(snap).toEqual(buildPartnerSnapshot(before, day, HIM))
        const json = JSON.stringify(snap)
        for (const secret of [link.expiresAt, renewedAt!, link.token, after.couple.link!.tokenHash]) {
          expect(json.includes(secret), `${stage} ${day}: ${secret}`).toBe(false)
        }
      }
    })
  }
})

describe('② her 나만 보기 booking on an item he says [같이 할게요] to — the pregnant link', () => {
  /** The pregnant demo (its own 나만 보기 example left out), one of her open items with his support line, booked three days ahead. */
  function setup(privateTo?: typeof HER) {
    const base = demo('pregnant')
    const s0: AppState = { ...base, appointments: sharedAppointments(base.appointments) }
    const linked = new Set(s0.appointments.map((a) => a.taskId))
    const item = planItems(s0, T).find(
      (i) => !linked.has(i.id) && i.owners.length === 1 && i.owners[0] === HER && !!i.template?.support && canSupportItem(s0, HIM, i, T),
    )!
    expect(item, 'an open item of hers he can say [같이 할게요] to').toBeTruthy()
    const input = {
      date: addDays(T, 3),
      time: '07:40',
      title: 'PRIV_TITLE_R1017',
      place: 'PRIV_PLACE_R1017',
      who: HER,
      kind: 'hospital' as const,
    }
    const state = addAppointment(s0, { ...input, taskId: item.id, ...(privateTo ? { privateTo } : {}) }, HER)
    return { s0, state, item, appt: state.appointments[state.appointments.length - 1]! }
  }

  it('his seven-day page is the page without it — and a shared booking would have dated the item', () => {
    const { s0, state } = setup(HER)
    const page = buildPartnerSnapshot(state, T, HIM)
    expect(page).toEqual(buildPartnerSnapshot(s0, T, HIM))
    expect(JSON.stringify(page)).not.toMatch(/PRIV_|07:40/)
    expect(buildPartnerSnapshot(setup().state, T, HIM)).not.toEqual(buildPartnerSnapshot(s0, T, HIM))
  })

  it('his [같이 할게요] from the link lands exactly as without it; her appointment is untouched; his page stays the page without it', () => {
    const { s0, state, item, appt } = setup(HER)
    const ev: PartnerEvent = { id: 'ev-support-r1017', from: HIM, kind: 'support', itemId: item.id, on: true }
    expect(partnerEventProblem(state, ev, T)).toBeNull()
    const now = `${T}T12:00:00`
    const after = applyPartnerEvent(state, ev, T, now)
    const after0 = applyPartnerEvent(s0, ev, T, now)
    expect(isSupported(after, item.id, HIM)).toBe(true)
    expect(after.decisions[supportKey(item.id, HIM)]).toBe(T)
    expect(after.appointments.find((a) => a.id === appt.id)).toBe(appt)
    expect({ ...after, appointments: after.appointments.filter((a) => a.id !== appt.id) }).toEqual(after0)
    expect(buildPartnerSnapshot(after, T, HIM)).toEqual(buildPartnerSnapshot(after0, T, HIM))
    // [취소] the same way.
    const off: PartnerEvent = { ...ev, id: 'ev-support-r1017-off', on: false }
    const back = applyPartnerEvent(after, off, T, now)
    expect(isSupported(back, item.id, HIM)).toBe(false)
    expect({ ...back, appointments: back.appointments.filter((a) => a.id !== appt.id) }).toEqual(applyPartnerEvent(after0, off, T, now))
  })
})
