import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/saved-walk-events') return nextResolve(new URL('../lib/saved-walk-events.ts', import.meta.url).href, context)
    if (specifier === '@/data/walks') return nextResolve(new URL('../data/walks/index.ts', import.meta.url).href, context)
    if (context.parentURL?.includes('/data/walks/') && specifier.startsWith('./')) {
      return nextResolve(new URL(specifier + '.ts', context.parentURL).href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { SAVED_WALKS_KEY, readSavedWalks, saveWalkStop, removeSavedWalk, updateSavedWalkStop, subscribeSavedWalks } = await import('../lib/saved-walks.ts')

function browser(t) {
  const store = new Map()
  const page = new EventTarget()
  page.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, val),
    removeItem: key => store.delete(key),
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: page })
  t.after(() => { delete globalThis.window })
  return { store, page }
}

test('saving, revisiting and removing a walk leave other walks and saved cities intact', t => {
  const { store } = browser(t)
  store.set('wk_saved', '["jeonju"]')
  saveWalkStop('seongsu', 2)
  saveWalkStop('hanok', 1)
  assert.ok(updateSavedWalkStop('seongsu', 3))
  assert.equal(readSavedWalks().find(row => row.slug === 'seongsu').stop, 3)
  removeSavedWalk('seongsu')
  assert.equal(updateSavedWalkStop('seongsu', 2), false)
  assert.deepEqual(readSavedWalks().map(entry => [entry.slug, entry.stop]), [['hanok', 1]])
  assert.equal(store.get('wk_saved'), '["jeonju"]')
})

test('a damaged entry does not hide the other saved walks or overwrite the broken data', t => {
  const { store } = browser(t)
  saveWalkStop('hanok', 2)
  const key = SAVED_WALKS_KEY + '.seongsu'
  store.set(key, '{broken')
  let errors = 0
  assert.equal(readSavedWalks(() => errors++)[0].slug, 'hanok')
  assert.equal(errors, 1)
  assert.equal(store.get(key), '{broken')
  assert.throws(() => saveWalkStop('hanok', 500))
  assert.equal(readSavedWalks(() => {})[0].stop, 2)
})

test('a failed write reports failure and never signals that the walk was saved', t => {
  const { page } = browser(t)
  let notifications = 0
  const stop = subscribeSavedWalks(() => { notifications++ })
  page.localStorage.setItem = () => { throw new Error('storage unavailable') }
  assert.throws(() => saveWalkStop('hanok', 1))
  assert.equal(notifications, 0)
  stop()
})
