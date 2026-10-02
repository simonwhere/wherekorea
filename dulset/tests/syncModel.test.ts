import { describe, expect, it } from 'vitest'
import { createDemoState } from '@/lib/demo'
import { createInitialState } from '@/lib/initial'
import { sanitizeBackup } from '@/lib/logic/settings'
import { periodToldKey, periodTellState, skipTellPartnerPeriod, tellPartnerPeriod } from '@/lib/logic/ttcFlow'
import { MIGRATIONS, SCHEMA_VERSION, legacyStamp, migrate, schemaVersionOf } from '@/lib/sync/migrations'
import {
  DECISION_KEY_RE,
  cleanDecisions,
  decide,
  decided,
  decisionDay,
  decisionsFromNotifications,
  ensureRecordIds,
  isLive,
  isStamp,
  lhId,
  lhIdOf,
  liveOnly,
  newerOf,
  periodId,
  periodIdOf,
  tombstone,
  touch,
  undecide,
} from '@/lib/sync/model'
import { parseState } from '@/lib/storage'
import type { AppNotification, AppState, LHTest, PeriodLog } from '@/lib/types'

const TODAY = '2026-10-02'
const NOW = new Date('2026-10-02T09:00:00+09:00')

/** A fresh (schema 2) state: 민수 a, 지은 b (cycle owner). */
function fresh(): AppState {
  return createInitialState(
    {
      me: { name: '민수', role: 'husband', birthYear: 1992 },
      partner: { name: '지은', role: 'wife', birthYear: 1994 },
      cycleOwner: 'b',
      lastPeriodStart: '2026-09-20',
      ttcStart: '2026-06-01',
    },
    NOW,
  )
}

const stub = (key: string, createdAt: string, to: 'a' | 'b' = 'b'): AppNotification => ({
  id: `n-${key}`,
  to,
  kind: 'system',
  title: '',
  body: '',
  createdAt,
  key,
  read: true,
  dismissed: true,
})

/**
 * A save exactly as the app wrote it before Next A: no schemaVersion, no
 * decisions, no ids on periods / LH strips, decisions as dismissed stubs.
 */
function v1Blob(): Record<string, unknown> {
  const s = fresh()
  const { schemaVersion: _v, decisions: _d, ...rest } = s
  return JSON.parse(
    JSON.stringify({
      ...rest,
      periods: [{ start: '2026-08-23', end: '2026-08-27', by: 'b' }, { start: '2026-09-20' }],
      lhTests: [
        { date: '2026-09-02', time: '08:30', result: 'faint', by: 'b' },
        { date: '2026-09-03', slot: 'evening', result: 'positive' },
        { date: '2026-09-04', result: 'negative' },
        { date: '2026-09-04', result: 'peak' },
      ],
      pregnancyTests: [{ id: 'pt1', date: '2026-09-17', result: 'negative', by: 'b' }],
      appointments: [{ id: 'ap1', date: '2026-10-06', title: '검진', who: 'b', kind: 'hospital', createdBy: 'b' }],
      diary: [{ id: 'e1', date: '2026-09-01', author: 'a', stage: 'preparing', text: '시작', createdAt: '2026-09-01T20:00:00+09:00' }],
      customTasks: [{ id: 'c1', title: '결과지 모으기', phase: 'preconception', who: 'both', createdBy: 'b' }],
      treatments: [{ id: 't1', kind: 'iui', startDate: '2026-07-10', endDate: '2026-08-02', outcome: 'negative' }],
      notifications: [
        {
          id: 'real',
          to: 'a',
          from: 'b',
          kind: 'system',
          title: '지은님이 알려 왔어요',
          body: '이번 달은 쉬어 가요.',
          createdAt: '2026-08-23T09:10:00+09:00',
          key: 'period-told:2026-08-23',
          read: true,
        },
        stub('period-told:2026-07-26:skip', '2026-07-26T21:00:00+09:00'),
        stub('rest-suggest:pre-mmr:2026-06-20', '2026-06-21T08:00:00+09:00'),
        stub('positive-told:2026-09-15', '2026-09-16T07:00:00+09:00', 'a'),
        stub('bleeding-told:2026-09-15', '2026-09-18T07:00:00+09:00', 'a'),
        { id: 'x', to: 'a', kind: 'cheer', title: '👏', body: '응원', createdAt: '2026-09-30T10:00:00+09:00', read: false },
      ],
    }),
  )
}

describe('migrations: the ordered chain', () => {
  it('is contiguous from 1 to SCHEMA_VERSION and reads a missing version as 1', () => {
    expect(SCHEMA_VERSION).toBe(3)
    let v = 1
    for (const m of MIGRATIONS) {
      expect(m.from).toBe(v)
      expect(m.to).toBe(v + 1)
      v = m.to
    }
    expect(v).toBe(SCHEMA_VERSION)
    expect(schemaVersionOf({})).toBe(1)
    expect(schemaVersionOf({ schemaVersion: 2 })).toBe(2)
    expect(schemaVersionOf({ schemaVersion: 0 })).toBe(1)
    expect(schemaVersionOf({ schemaVersion: 2.5 })).toBe(1)
    expect(schemaVersionOf({ schemaVersion: '2' as never })).toBe(1)
  })

  it('v1 → v2: ids, a lower-bound updatedAt, decisions from the stubs; the stubs stay until v3', () => {
    const blob = v1Blob() as unknown as AppState
    const out = migrate(blob, MIGRATIONS.slice(0, 1))
    expect(out.schemaVersion).toBe(2)
    expect(out.periods.map((p) => p.id)).toEqual(['period:2026-08-23', 'period:2026-09-20'])
    expect(out.lhTests.map((t) => t.id)).toEqual(['lh:2026-09-02:08:30', 'lh:2026-09-03:evening', 'lh:2026-09-04:', 'lh:2026-09-04:#2'])
    const at = legacyStamp(blob)
    expect(at).toBe(blob.createdAt)
    for (const list of [out.periods, out.lhTests, out.pregnancyTests, out.appointments, out.customTasks, out.treatments!]) {
      expect(list.every((r) => r.updatedAt === at)).toBe(true)
    }
    expect(out.diary[0]!.updatedAt).toBe(at)
    expect(out.decisions).toEqual({
      'period-told:2026-08-23': '2026-08-23',
      'period-told:2026-07-26:skip': '2026-07-26',
      'rest-suggest:pre-mmr:2026-06-20': '2026-06-21',
      'positive-told:2026-09-15': '2026-09-16',
      'bleeding-told:2026-09-15': '2026-09-18',
    })
    expect(out.notifications).toEqual(blob.notifications)
    // The readers see the same answers (decided reads decisions first, a notice with the key second).
    expect(periodTellState(out, '2026-08-23')).toBe('told')
    expect(periodTellState(out, '2026-07-26')).toBe('skipped')
    expect(periodTellState(out, '2026-09-20')).toBe('ask')
  })

  it('v2 → v3: the pure decision stubs leave notifications (the real notices stay), `sync` leaves the state, decisions are re-merged', () => {
    const blob = v1Blob() as unknown as AppState
    const v2 = migrate(blob, MIGRATIONS.slice(0, 1))
    // A v2 save written between the steps: a stub without its decision, a real notice, the rebase marks.
    const between = {
      ...v2,
      decisions: {},
      sync: { tab1: 4 },
      notifications: [
        ...v2.notifications,
        stub('partner-event:ev-1', '2026-10-01T09:00:00+09:00'),
        stub('rest-suggest:pre-varicella:2026-09-01', '2026-09-02T09:00:00+09:00'),
      ],
    } as AppState
    const out = migrate(between)
    expect(out.schemaVersion).toBe(3)
    expect('sync' in out).toBe(false)
    // Every stub became a decision on its day; the stubs are gone; the notices someone reads stay.
    expect(out.decisions).toEqual({
      'period-told:2026-08-23': '2026-08-23',
      'period-told:2026-07-26:skip': '2026-07-26',
      'rest-suggest:pre-mmr:2026-06-20': '2026-06-21',
      'positive-told:2026-09-15': '2026-09-16',
      'bleeding-told:2026-09-15': '2026-09-18',
      'partner-event:ev-1': '2026-10-01',
      'rest-suggest:pre-varicella:2026-09-01': '2026-09-02',
    })
    expect(out.notifications.some((n) => n.title === '' && n.body === '' && n.dismissed)).toBe(false)
    expect(
      out.notifications
        .map((n) => n.key)
        .filter(Boolean)
        .sort(),
    ).toEqual(
      between.notifications
        .filter((n) => !(n.title === '' && n.body === '' && n.dismissed === true))
        .map((n) => n.key)
        .filter(Boolean)
        .sort(),
    )
    // The readers still answer the same.
    expect(periodTellState(out, '2026-08-23')).toBe('told')
    expect(periodTellState(out, '2026-07-26')).toBe('skipped')
    // An existing decision wins over a stub's day; a v3 state is left alone.
    const kept = migrate({ ...between, decisions: { 'period-told:2026-08-23': '2026-08-20' } } as AppState)
    expect(kept.decisions['period-told:2026-08-23']).toBe('2026-08-20')
    expect(migrate(out)).toBe(out)
  })

  it('is idempotent and byte-stable: a second pass returns the same object; parseState twice gives the same bytes', () => {
    const blob = v1Blob() as unknown as AppState
    const once = migrate(blob)
    expect(migrate(once)).toBe(once)
    expect(JSON.stringify(migrate(JSON.parse(JSON.stringify(once))))).toBe(JSON.stringify(once))
    const raw = JSON.stringify(blob)
    const first = parseState(raw)!
    expect(first.schemaVersion).toBe(SCHEMA_VERSION)
    expect(first.periods[0]!.id).toBe('period:2026-08-23')
    expect(first.decisions['period-told:2026-08-23']).toBe('2026-08-23')
    const second = parseState(JSON.stringify(first))!
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    // The same for sanitizeBackup called on its own with a v1 blob (a backup from an older app).
    expect(sanitizeBackup(JSON.parse(raw))).toEqual(first)
  })

  it('keeps ids and stamps a record already has, and never touches a state at or past the current version', () => {
    const blob = v1Blob() as unknown as AppState
    blob.periods[0] = { ...blob.periods[0]!, id: 'own-id', updatedAt: '2026-09-30T10:00:00+09:00' }
    const out = migrate(blob)
    expect(out.periods[0]).toMatchObject({ id: 'own-id', updatedAt: '2026-09-30T10:00:00+09:00' })
    const current = fresh()
    expect(migrate(current)).toBe(current)
    const newer = { ...current, schemaVersion: SCHEMA_VERSION + 1 }
    expect(migrate(newer)).toBe(newer)
    expect(parseState(JSON.stringify(newer))!.schemaVersion).toBe(SCHEMA_VERSION + 1)
  })

  it('legacyStamp: the space’s createdAt when it is a stamp, else the first moment of its day, else the app’s epoch', () => {
    expect(legacyStamp({ createdAt: '2026-06-01T21:00:00+09:00' })).toBe('2026-06-01T21:00:00+09:00')
    expect(legacyStamp({ createdAt: '2026-06-01' })).toBe('2026-06-01T00:00:00')
    expect(legacyStamp({ createdAt: 'nope' })).toBe('2026-01-01T00:00:00')
    expect(legacyStamp({ createdAt: undefined as never })).toBe('2026-01-01T00:00:00')
  })
})

describe('record ids (lib/sync/model.ts)', () => {
  it('derives deterministic ids from the natural keys and keeps them unique', () => {
    expect(periodId('2026-09-20')).toBe('period:2026-09-20')
    expect(lhId({ date: '2026-09-02', time: '08:30' })).toBe('lh:2026-09-02:08:30')
    expect(lhId({ date: '2026-09-02', slot: 'morning' })).toBe('lh:2026-09-02:morning')
    expect(lhId({ date: '2026-09-02' })).toBe('lh:2026-09-02:')
    const s: { periods: PeriodLog[]; lhTests: LHTest[] } = {
      periods: [{ start: '2026-09-20' }, { id: 'period:2026-09-21', start: '2026-09-21' }, { start: '2026-09-21' }],
      lhTests: [
        { date: '2026-09-02', result: 'faint' },
        { date: '2026-09-02', result: 'peak' },
      ],
    }
    const out = ensureRecordIds(s)
    expect(out.periods.map((p) => p.id)).toEqual(['period:2026-09-20', 'period:2026-09-21', 'period:2026-09-21#2'])
    expect(out.lhTests.map((t) => t.id)).toEqual(['lh:2026-09-02:', 'lh:2026-09-02:#2'])
    expect(ensureRecordIds(out)).toBe(out)
    expect(periodIdOf({ start: '2026-01-01' })).toBe('period:2026-01-01')
    expect(periodIdOf({ id: 'x', start: '2026-01-01' })).toBe('x')
    expect(lhIdOf({ date: '2026-01-01', result: 'negative' })).toBe('lh:2026-01-01:')
  })
})

describe('stamps, touch, tombstones, last-writer-wins', () => {
  it('isStamp accepts a date or a local-date-prefixed timestamp only', () => {
    expect(isStamp('2026-10-02')).toBe(true)
    expect(isStamp('2026-10-02T09:00:00+09:00')).toBe(true)
    expect(isStamp('2026-10-02T00:00:00.000Z')).toBe(true)
    expect(isStamp('yesterday')).toBe(false)
    expect(isStamp(20261002)).toBe(false)
    expect(isStamp('2026-13-40T00:00:00')).toBe(false)
    expect(isStamp(`2026-10-02${'x'.repeat(40)}`)).toBe(false)
  })

  it('touch stamps a change (same object when already so); tombstone marks a delete; liveOnly hides it', () => {
    const p: PeriodLog = { start: '2026-09-20' }
    const t1 = touch(p, '2026-10-02T09:00:00+09:00')
    expect(t1).toEqual({ start: '2026-09-20', updatedAt: '2026-10-02T09:00:00+09:00' })
    expect(touch(t1, '2026-10-02T09:00:00+09:00')).toBe(t1)
    const gone = tombstone(t1, '2026-10-03T08:00:00+09:00')
    expect(gone).toEqual({ start: '2026-09-20', updatedAt: '2026-10-03T08:00:00+09:00', deletedAt: '2026-10-03T08:00:00+09:00' })
    expect(isLive(p)).toBe(true)
    expect(isLive(gone)).toBe(false)
    const list = [t1, gone, p]
    expect(liveOnly(list)).toEqual([t1, p])
    const allLive = [t1, p]
    expect(liveOnly(allLive)).toBe(allLive)
  })

  it('newerOf: the later stamp wins, a legacy copy loses, a tie keeps mine', () => {
    const mine: PeriodLog = { start: '2026-09-20', updatedAt: '2026-10-02T09:00:00+09:00' }
    const theirs: PeriodLog = { start: '2026-09-21', updatedAt: '2026-10-02T09:00:01+09:00' }
    expect(newerOf(mine, theirs)).toBe(theirs)
    expect(newerOf(theirs, mine)).toBe(theirs)
    expect(newerOf(mine, { start: '2026-09-22' })).toBe(mine)
    expect(newerOf({ start: '2026-09-22' }, mine)).toBe(mine)
    expect(newerOf(mine, { ...mine })).toBe(mine)
  })
})

describe('decisions: decided / decide / undecide', () => {
  it('records the first answer only, by key, on a real day; bad input leaves the state alone', () => {
    const s = fresh()
    expect(decided(s, 'period-told:2026-09-20')).toBe(false)
    const a = decide(s, 'period-told:2026-09-20', TODAY)
    expect(a.decisions).toEqual({ 'period-told:2026-09-20': TODAY })
    expect(decided(a, 'period-told:2026-09-20')).toBe(true)
    expect(decisionDay(a, 'period-told:2026-09-20')).toBe(TODAY)
    expect(decide(a, 'period-told:2026-09-20', '2026-10-05')).toBe(a)
    expect(decide(s, '', TODAY)).toBe(s)
    expect(decide(s, 'x'.repeat(121), TODAY)).toBe(s)
    expect(decide(s, 'rest-suggest:a:b', 'soon')).toBe(s)
    const b = undecide(a, 'period-told:2026-09-20')
    expect(b.decisions).toEqual({})
    expect(undecide(b, 'period-told:2026-09-20')).toBe(b)
    // A re-applied change (two-tab rebase) is a no-op the second time.
    expect(decide(decide(s, 'k', TODAY), 'k', TODAY)).toEqual(decide(s, 'k', TODAY))
  })

  it('falls back to a notification with that key (the legacy stub or the notice itself) until every writer uses decide', () => {
    const s = { ...fresh(), notifications: [stub('rest-suggest:pre-mmr:2026-06-20', '2026-06-21T08:00:00+09:00')] }
    expect(decided(s, 'rest-suggest:pre-mmr:2026-06-20')).toBe(true)
    expect(decisionDay(s, 'rest-suggest:pre-mmr:2026-06-20')).toBe('2026-06-21')
    expect(decided(s, 'rest-suggest:other')).toBe(false)
    expect(decisionDay(s, 'rest-suggest:other')).toBeUndefined()
    // The real flow: 알리기 sends the notice; decide remembers; ttcFlow's reader agrees either way.
    const told = decide(tellPartnerPeriod(s, '2026-09-20', `${TODAY}T09:00:00+09:00`), periodToldKey('2026-09-20'), TODAY)
    expect(periodTellState(told, '2026-09-20')).toBe('told')
    expect(decided(told, periodToldKey('2026-09-20'))).toBe(true)
    const skipped = skipTellPartnerPeriod(s, '2026-09-20', `${TODAY}T09:00:00+09:00`)
    expect(decided(skipped, 'period-told:2026-09-20:skip')).toBe(true)
  })

  it('decisionsFromNotifications keeps the earliest day per key and only the decision families', () => {
    const list = [
      stub('period-told:2026-08-23:skip', '2026-08-25T21:00:00+09:00'),
      stub('period-told:2026-08-23:skip', '2026-08-23T21:00:00+09:00'),
      stub('doctor:2026-06-01', '2026-09-01T08:00:00+09:00'),
      stub('fertile-start:2026-09-30', '2026-09-29T08:00:00+09:00'),
      { ...stub('positive-told:2026-09-15', 'bad'), createdAt: 'bad' },
    ]
    expect(decisionsFromNotifications(list)).toEqual({ 'period-told:2026-08-23:skip': '2026-08-23' })
    expect(DECISION_KEY_RE.test('bleeding-told:2026-09-15')).toBe(true)
    // The partner link's applied-once marks are decisions too (lib/logic/partnerEvents.ts).
    expect(DECISION_KEY_RE.test('partner-event:abc')).toBe(true)
    expect(DECISION_KEY_RE.test('doctor:2026-06-01')).toBe(false)
    expect(DECISION_KEY_RE.test('complete:a:2026-10-02')).toBe(false)
  })

  it('cleanDecisions keeps short string keys with real days and drops the rest', () => {
    expect(cleanDecisions({ a: '2026-10-02', b: 'soon', c: 20261002, ['x'.repeat(121)]: '2026-10-02', '': '2026-10-02' })).toEqual({
      a: '2026-10-02',
    })
    expect(cleanDecisions(null)).toEqual({})
    expect(cleanDecisions(['2026-10-02'])).toEqual({})
    expect(cleanDecisions('2026-10-02')).toEqual({})
  })
})

describe('sanitizeBackup: schemaVersion, decisions and the sync marks', () => {
  const clone = (s: AppState) => JSON.parse(JSON.stringify(s)) as AppState

  it('keeps valid marks on every synced type (appointments and treatments are rebuilt field by field) and drops bad ones', () => {
    const s = clone(fresh())
    const good = '2026-10-01T10:00:00+09:00'
    s.periods = [
      { id: 'p1', start: '2026-09-20', updatedAt: good, deletedAt: good },
      { start: '2026-08-23', updatedAt: 'later' as never, id: 7 as never },
    ]
    s.lhTests = [
      { id: 'l1', date: '2026-09-02', result: 'faint', updatedAt: good },
      { date: '2026-09-03', result: 'peak', deletedAt: {} as never },
    ]
    s.pregnancyTests = [{ id: 'pt1', date: '2026-09-17', result: 'negative', updatedAt: good, deletedAt: 'x' as never }]
    s.appointments = [
      { id: 'ap1', date: '2026-10-06', title: '검진', who: 'b', kind: 'hospital', createdBy: 'b', updatedAt: good, deletedAt: 1 as never },
    ]
    s.diary = [
      {
        id: 'e1',
        date: '2026-09-01',
        author: 'a',
        stage: 'preparing',
        text: '시작',
        createdAt: '2026-09-01T20:00:00+09:00',
        updatedAt: good,
      },
    ]
    s.customTasks = [
      { id: 'c1', title: '결과지', phase: 'preconception', who: 'both', createdBy: 'b', updatedAt: 'no' as never, deletedAt: good },
    ]
    s.treatments = [{ id: 't1', kind: 'iui', startDate: '2026-07-10', updatedAt: good, deletedAt: 'no' as never }]
    s.decisions = { 'period-told:2026-09-20': '2026-09-20', bad: 'nope' } as never
    const out = sanitizeBackup(s)!
    expect(out.periods).toEqual([{ id: 'p1', start: '2026-09-20', updatedAt: good, deletedAt: good }, { start: '2026-08-23' }])
    expect(out.lhTests).toEqual([
      { id: 'l1', date: '2026-09-02', result: 'faint', updatedAt: good },
      { date: '2026-09-03', result: 'peak' },
    ])
    expect(out.pregnancyTests).toEqual([{ id: 'pt1', date: '2026-09-17', result: 'negative', updatedAt: good }])
    expect(out.appointments[0]).toEqual({
      id: 'ap1',
      date: '2026-10-06',
      title: '검진',
      who: 'b',
      kind: 'hospital',
      createdBy: 'b',
      updatedAt: good,
    })
    expect(out.diary[0]!.updatedAt).toBe(good)
    expect(out.customTasks[0]).toMatchObject({ deletedAt: good })
    expect('updatedAt' in out.customTasks[0]!).toBe(false)
    expect(out.treatments).toEqual([{ id: 't1', kind: 'iui', startDate: '2026-07-10', updatedAt: good }])
    expect(out.decisions).toEqual({ 'period-told:2026-09-20': '2026-09-20' })
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    // Canonical: a second pass is the identity.
    expect(sanitizeBackup(clone(out))).toEqual(out)
    expect(parseState(JSON.stringify(out))).toEqual(out)
    // An unreadable version number counts as 1: the migration runs (ids filled) and the number is set right.
    const odd = { ...clone(out), schemaVersion: 'two' as never }
    const fixed = sanitizeBackup(odd)!
    expect(fixed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(fixed.periods[1]).toEqual({ id: 'period:2026-08-23', start: '2026-08-23', updatedAt: out.createdAt })
  })

  it('a state without decisions gets {} and stays otherwise byte-identical; a backup without schemaVersion is migrated', () => {
    const s = clone(fresh())
    const { decisions: _d, ...noDecisions } = s
    const out = sanitizeBackup(noDecisions as AppState)!
    expect(out.decisions).toEqual({})
    expect({ ...out, decisions: undefined }).toEqual({ ...s, decisions: undefined })
    const { schemaVersion: _v, ...noVersion } = s
    const migrated = sanitizeBackup(noVersion as AppState)!
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.periods[0]).toMatchObject({ id: 'period:2026-09-20', updatedAt: s.createdAt })
  })
})

describe('the demo exercises the model (5-place rule)', () => {
  it('every synced record has an id and a stamp no later than today; a decision is recorded; parseState is the identity', () => {
    for (const stage of ['preparing', 'pregnant', 'parenting'] as const) {
      const s = createDemoState(TODAY, NOW, stage)
      expect(s.schemaVersion).toBe(SCHEMA_VERSION)
      for (const p of s.periods) expect(p).toMatchObject({ id: periodId(p.start) })
      for (const t of s.lhTests) expect(t.id).toBe(lhId(t))
      const lists = [
        s.periods,
        s.lhTests,
        s.pregnancyTests,
        s.appointments,
        s.diary,
        s.customTasks,
        ...(s.treatments ? [s.treatments] : []),
      ]
      for (const list of lists) {
        for (const r of list) {
          expect(isStamp(r.updatedAt)).toBe(true)
          expect(r.updatedAt!.slice(0, 10) <= TODAY).toBe(true)
          expect('deletedAt' in r).toBe(false)
        }
      }
      expect(parseState(JSON.stringify(s))).toEqual(JSON.parse(JSON.stringify(s)))
    }
    const prep = createDemoState(TODAY, NOW, 'preparing')
    const last = [...prep.periods].sort((a, b) => (a.start < b.start ? 1 : -1))[0]!.start
    expect(prep.decisions).toEqual({ [periodToldKey(last)]: last })
    expect(periodTellState(prep, last)).toBe('told')
    expect(prep.notifications.find((n) => n.key === periodToldKey(last))).toMatchObject({ to: 'a', read: true })
  })
})
