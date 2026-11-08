import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { destinations } from '../data/destinations.ts'
import { SIGNATURE_EVENTS } from '../data/signature-events.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context)
    return nextResolve(specifier, context)
  },
})
const {
  timingView, timingMonthHref, timingMonthStatus, timingCellLabel, signatureEventsForMonth, signatureTimingLabel,
} = await import('../components/whentogo/timing-model.ts')

test('seasonal view reads the selected URL month and all destination constraints', () => {
  const params = new URLSearchParams('month=5&filters=no-car+friendly&filters=couple&excludeSeoul=1')
  const { browse, visible } = timingView(destinations, params, 10)
  assert.equal(browse.month, 5)
  assert.ok(visible.length > 0)
  assert.ok(visible.every((destination) => destination.no_car_friendliness === 'Easy' && destination.tags.includes('couple') && destination.slug !== 'seoul'))
})

test('seasonal view applies search and keeps an empty result without broadening filters', () => {
  const selected = timingView(destinations, new URLSearchParams('month=11&q=busan'), 10)
  assert.ok(selected.visible.some((destination) => destination.slug === 'busan'))
  const empty = timingView(destinations, new URLSearchParams('month=11&q=no-such-destination-ever'), 10)
  assert.deepEqual(empty.visible, [])
  assert.deepEqual(signatureEventsForMonth(SIGNATURE_EVENTS, empty.browse.month, []), [])
})

test('seasonal view validates malformed months instead of passing invalid indices to strips', () => {
  const { browse } = timingView(destinations, new URLSearchParams('month=1.5'), 10)
  assert.equal(browse.month, 10)
})

test('month navigation keeps search, filters, category, Seoul exclusion, and return preview', () => {
  const { browse } = timingView(destinations, new URLSearchParams('month=10&mode=now&q=coast&filters=no-car+friendly&category=beach&excludeSeoul=1'), 10)
  const href = timingMonthHref(browse, 4, '/when-to-go?destination=busan')
  const query = new URL(href, 'https://wherekorea.local').searchParams
  assert.equal(query.get('month'), '4')
  assert.equal(query.has('mode'), false)
  assert.equal(query.get('q'), 'coast')
  assert.equal(query.get('filters'), 'no-car friendly')
  assert.equal(query.get('category'), 'beach')
  assert.equal(query.get('excludeSeoul'), '1')
  assert.equal(query.get('destination'), 'busan')
})

test('selecting even the current month explicitly switches to planning', () => {
  const { browse } = timingView(destinations, new URLSearchParams('month=10&mode=now'), 10)
  assert.equal(browse.mode, 'now')
  const href = timingMonthHref(browse, 10)
  assert.equal(new URL(href, 'https://wherekorea.local').searchParams.has('mode'), false)
})

test('event ideas follow the selected month and eligible destination list', () => {
  const list = signatureEventsForMonth(SIGNATURE_EVENTS, 5, ['busan', 'chuncheon'])
  assert.ok(list.length > 0)
  assert.ok(list.every((event) => event.months.includes(5) && ['busan', 'chuncheon'].includes(event.city)))
  assert.deepEqual(signatureEventsForMonth(SIGNATURE_EVENTS, 1.5, ['busan']), [])
})

test('undated event seeds never turn their weekly or exact-date text into a confirmed schedule', () => {
  const weekly = { city: 'busan', name: 'Example', months: Array.from({ length: 12 }, (_, index) => index + 1), when: 'every Sat night', note: 'Free now', ticketing: 'walk-in' }
  assert.equal(signatureTimingLabel(weekly), 'Typical pattern: year-round')
  assert.equal(signatureTimingLabel({ ...weekly, months: [12, 1], when: 'Dec 31–Jan 1' }), 'Typical months: Dec, Jan')
  assert.equal(signatureTimingLabel({ ...weekly, months: [] }), 'Typical timing not recorded')
})

test('timing labels use unambiguous month names and identify the selected month, not Now', () => {
  const destination = { ...destinations[0], best_months: [1], crowd_peak_months: [6] }
  assert.equal(timingMonthStatus(destination, 12), 'shoulder')
  assert.match(timingCellLabel(destination, 6, 6), /^June:/)
  assert.match(timingCellLabel(destination, 6, 6), /selected travel month/)
  assert.match(timingCellLabel(destination, 6, 6), /not live crowd data/)
  assert.doesNotMatch(timingCellLabel(destination, 7, 6), /selected travel month/)
})

test('dated listings use the published year and turn into past editions after the final Korea date', () => {
  const lanterns = SIGNATURE_EVENTS.find(event => event.official?.anchor === 'seoul-lantern-festival')
  assert.equal(signatureTimingLabel(lanterns, '20261210'), 'Confirmed dates · Dec 11, 2026 – Jan 31, 2027')
  assert.match(signatureTimingLabel(lanterns, '20261211'), /^Underway/)
  assert.match(signatureTimingLabel(lanterns, '20270131'), /^Underway/)
  assert.match(signatureTimingLabel(lanterns, '20270201'), /^Ended/)
  for (const month of [12, 1]) assert.ok(signatureEventsForMonth(SIGNATURE_EVENTS, month, ['seoul']).includes(lanterns))
  const seoulFireworks = SIGNATURE_EVENTS.find(event => event.official?.anchor === 'seoul-fireworks-festival')
  assert.equal(signatureTimingLabel(seoulFireworks, '20261109'), 'Ended · Sep 5, 2026')
  assert.ok(signatureEventsForMonth(SIGNATURE_EVENTS, 9, ['seoul']).includes(seoulFireworks))
  assert.ok(!signatureEventsForMonth(SIGNATURE_EVENTS, 10, ['seoul']).includes(seoulFireworks))
  const busanFireworks = SIGNATURE_EVENTS.find(event => event.official?.anchor === 'busan-fireworks-festival')
  assert.equal(signatureTimingLabel(busanFireworks, '20261109'), 'Ended · Nov 7, 2026')
})

test('a county hold remains visible as a city notice but never appears in monthly event results', () => {
  const status = SIGNATURE_EVENTS.find(event => event.official?.anchor === 'boseong-tea-field-light-festival')
  assert.equal(signatureTimingLabel(status), 'On hold')
  for (let month = 1; month <= 12; month++) {
    assert.ok(!signatureEventsForMonth(SIGNATURE_EVENTS, month, ['damyang-boseong']).includes(status))
  }
  assert.ok(signatureEventsForMonth(SIGNATURE_EVENTS, 5, ['damyang-boseong']).some(event => event.name === 'Boseong Green Tea Festival'))
})

test('published dates agree with the months shown, including a festival crossing New Year', () => {
  const official = SIGNATURE_EVENTS.filter(event => event.official)
  assert.equal(new Set(official.map(event => event.official.anchor)).size, official.length)
  for (const event of official) {
    const schedule = event.official.schedule
    if (schedule.kind === 'paused') {
      assert.deepEqual(event.months, [])
      continue
    }
    const startMonth = Number(schedule.start.slice(4, 6))
    const endMonth = Number(schedule.end.slice(4, 6))
    const months = [startMonth]
    while (months.at(-1) !== endMonth) months.push(months.at(-1) % 12 + 1)
    assert.deepEqual(event.months, months)
  }
})
