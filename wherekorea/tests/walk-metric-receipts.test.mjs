import test from 'node:test'
import assert from 'node:assert/strict'
import { koreaDay, validWalkMetric, receiptPath, summarizeReceipts } from '../lib/walk-metric-receipts.ts'

const today = '2026-11-10'
const slugs = new Set(['seongsu'])
const start = { version: 1, id: '1bc2ee3e-e0a8-4db0-8e97-d13b2a24be70', walk: 'seongsu',
  source: 'save', event: 'start', cohortDay: '2026-11-09', day: '2026-11-09' }
const returned = { ...start, event: 'return', day: today }
test('only a later Korea calendar day can count as a return', () => {
  assert.equal(koreaDay(new Date('2026-11-09T15:00:00.000Z')), today)
  assert.ok(validWalkMetric(start, slugs, today))
  assert.ok(validWalkMetric(returned, slugs, today))
  for (const invalid of [ { ...start, day: today }, { ...returned, day: start.cohortDay },
    { ...returned, day: '2026-11-11' }, { ...start, event: 'saved' }, { ...start, source: 'external' },
    { ...start, day: '2026-02-30', cohortDay: '2026-02-30' }, { ...start, walk: 'arbitrary' },
    { ...start, contact: 'extra-property' }, { ...start, id: 'not-a-uuid' } ]) {
    assert.equal(validWalkMetric(invalid, slugs, today), false)
  }
})
test('retries, out-of-order receipt arrival, test traffic and today’s cohort preserve the denominator', () => {
  const path = m => receiptPath(m, false)
  const futureReturn = { ...returned, day: '2026-12-01' }
  assert.equal(path(returned), path(futureReturn))
  assert.ok(!path(returned).includes(start.id))
  const orphan = { ...returned, id: 'f7449e98-85c8-453b-ab34-c91fd5665481' }
  const rows = summarizeReceipts([path(orphan), path(returned), path(start), path(start), path(futureReturn),
    receiptPath({...start, source: 'share'}, true),
    path({...start, source: 'shared_link', day: today, cohortDay: today})], false, today)
  assert.deepEqual(rows.find(r => r.day === start.day && r.source === 'save'),
    { day: start.day, source: 'save', starts: 1, returned: 1, eligible: true })
  assert.equal(rows.find(r => r.day === start.day && r.source === 'share').starts, 0)
  assert.deepEqual(rows.find(r => r.day === today && r.source === 'shared_link'),
    { day: today, source: 'shared_link', starts: 1, returned: 0, eligible: false })
})
