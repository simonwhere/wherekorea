// The store stamps what a change touched (lib/sync/model.ts stampChanges)
// and keeps the two-tab rebase marks outside the state (lib/storage.ts
// SYNC_KEY) — through the real StoreProvider, the way the app runs it.

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/dates'
import { addEntry } from '@/lib/logic/diary'
import { logPeriodStart } from '@/lib/logic/logs'
import { STORAGE_KEY, SYNC_KEY, parseState, readSyncMarks } from '@/lib/storage'
import { useApp } from '@/lib/store'
import { isStamp } from '@/lib/sync/model'
import type { ISODate } from '@/lib/types'
import { demoState, renderApp, stateProbe } from '../setup'

const T0: ISODate = '2026-10-02'

function Tapper() {
  const { update, today } = useApp()
  return (
    <>
      <button onClick={() => update((s) => logPeriodStart(s, addDays(today, -1), 'b', today))}>기록</button>
      <button
        onClick={() => update((s) => addEntry(s, { id: 'e-tap', date: today, author: 'a', text: '오늘' }, `${today}T10:00:00+09:00`))}
      >
        일기
      </button>
    </>
  )
}

describe('StoreProvider.update stamps records and keeps the rebase marks in the sidecar', () => {
  it('a logged period gets an id and updatedAt on today; untouched records keep theirs; the saved state holds no `sync`', () => {
    const probe = stateProbe()
    const seed = demoState(T0)
    renderApp(
      <>
        <Tapper />
        <probe.Probe />
      </>,
      { state: seed, viewer: 'b', today: T0 },
    )
    expect(probe.current.hydrated).toBe(true)
    expect(window.localStorage.getItem(SYNC_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '기록' }))
    const after = probe.current.state!
    const added = after.periods.find((p) => p.start === addDays(T0, -1))!
    expect(added).toBeDefined()
    expect(typeof added.id).toBe('string')
    expect(added.id!.startsWith('period:')).toBe(false)
    expect(isStamp(added.updatedAt)).toBe(true)
    expect(added.updatedAt!.startsWith(T0)).toBe(true)
    for (const p of after.periods) if (p !== added) expect(seed.periods).toContainEqual(p)
    expect(after.lhTests).toEqual(seed.lhTests)

    // Saved as such; the marks live beside it, never inside.
    const saved = parseState(window.localStorage.getItem(STORAGE_KEY))!
    expect(saved.periods.find((p) => p.start === addDays(T0, -1))).toEqual(added)
    expect('sync' in saved).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('"sync"')
    const marks = readSyncMarks()
    expect(Object.values(marks)).toEqual([1])

    fireEvent.click(screen.getByRole('button', { name: '일기' }))
    const later = probe.current.state!
    expect(later.diary.find((e) => e.id === 'e-tap')).toMatchObject({
      text: '오늘',
      updatedAt: expect.stringMatching(new RegExp(`^${T0}T`)) as string,
    })
    // update() builds on the freshly parsed save, so objects are new — but the period's stamp and id did not move.
    expect(later.periods.find((p) => p.start === addDays(T0, -1))).toEqual(added)
    expect(later.periods.map((p) => p.updatedAt)).toEqual(after.periods.map((p) => p.updatedAt))
    expect(Object.values(readSyncMarks())).toEqual([2])
    expect(Object.keys(readSyncMarks())).toEqual(Object.keys(marks))
  })
})
