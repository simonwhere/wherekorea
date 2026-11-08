import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { filterDestinations } from '../lib/filters.ts'
import { searchedCityWalk, searchedWalkStop } from '../lib/walk-links.ts'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/data/walks') return next(new URL('../data/walks/index.ts', import.meta.url).href, context)
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context)
    if (context.parentURL?.endsWith('/data/walks/index.ts') && specifier.startsWith('./')) {
      return next(new URL(specifier + '.ts', context.parentURL).href, context)
    }
    return next(specifier, context)
  },
})
const { walks } = await import('../data/walks/index.ts')
const { searchableDestinations: destinations } = await import('../data/searchable-destinations.ts')

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

test('unique stop names deep-link and general or ambiguous searches keep the walk entry', () => {
  const [seongsu, gyeongju, jeonju] = walks
  assert.equal(searchedWalkStop(seongsu, '대림창고'), 2)
  assert.equal(searchedWalkStop(gyeongju, ' cheomseongdae '), 4)
  assert.equal(searchedWalkStop(jeonju, '남부시장'), 3)
  for (const q of ['', 'Seongsu', '성수', 's', 'Seoul']) assert.equal(searchedWalkStop(seongsu, q), undefined)
})

test('Busan searches open the matching walk, leaving city-wide searches on the chooser', () => {
  const busanWalks = walks.filter(walk => walk.city === 'busan')
  assert.equal(busanWalks.length, 3)
  for (const walk of busanWalks) {
    for (const name of [walk.name, walk.nameKo, walk.food.nameKo]) {
      assert.equal(searchedCityWalk(busanWalks, name)?.slug, walk.slug, name)
      assert.ok(filterDestinations(destinations, [], name).some(city => city.slug === 'busan'), name)
    }
    assert.equal(searchedWalkStop(walk, walk.food.nameKo), walk.food.stop)
  }
  assert.equal(searchedCityWalk(busanWalks, '남포동')?.slug, 'nampo')
  for (const term of ['Busan', '부산', '', '역']) assert.equal(searchedCityWalk(busanWalks, term), undefined)
  assert.equal(searchedCityWalk([walks[0]], ''), walks[0])
})

test('Seoul Lantern Festival is searchable in both languages within the current filters', () => {
  for (const name of ['서울빛초롱축제', 'Seoul Lantern Festival', '청계천']) {
    assert.ok(filterDestinations(destinations, [], name).some(city => city.slug === 'seoul'), name)
    assert.equal(filterDestinations(destinations, ['coastal'], name).some(city => city.slug === 'seoul'), false)
  }
})
