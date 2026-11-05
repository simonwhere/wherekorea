import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { destinations } from '../data/destinations.ts'
import { filterDestinations } from '../lib/filters.ts'

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/data/walks/index.ts') && specifier.startsWith('./')) {
      return next(new URL(specifier + '.ts', context.parentURL).href, context)
    }
    return next(specifier, context)
  },
})
const { walks } = await import('../data/walks/index.ts')

test('each published walk and stop can be found in English and Korean', () => {
  for (const walk of walks) {
    for (const place of [walk, ...walk.stops]) {
      for (const name of [place.name, place.nameKo]) {
        const found = filterDestinations(destinations, [], name)
        assert.ok(found.some(city => city.slug === walk.city), name)
      }
    }
  }
})

test('neighbourhood search respects city filters', () => {
  assert.deepEqual(filterDestinations(destinations, [], '대림창고').map(d => d.slug), ['seoul'])
  assert.deepEqual(filterDestinations(destinations, ['coastal'], '대림창고'), [])
})
