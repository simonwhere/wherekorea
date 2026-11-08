import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { filterDestinations } from '../lib/filters.ts'
import { searchedCityWalk, searchedWalkStop } from '../lib/walk-links.ts'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/data/walks') return next(new URL('../data/walks/index.ts', import.meta.url).href, context)
    if (specifier.startsWith('@/')) return next(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context)
    if (context.parentURL?.includes('/data/walks/') && specifier.startsWith('./')) {
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
  const [seongsu, gyeongju, jeonju] = ['seongsu', 'hwangnidan', 'hanok'].map(slug => walks.find(walk => walk.slug === slug))
  assert.equal(searchedWalkStop(seongsu, '대림창고'), 2)
  assert.equal(searchedWalkStop(gyeongju, ' cheomseongdae '), 4)
  assert.equal(searchedWalkStop(jeonju, '남부시장'), 3)
  for (const q of ['', 'Seongsu', '성수', 's', 'Seoul']) assert.equal(searchedWalkStop(seongsu, q), undefined)
})

test('every destination has a photographed walk and a named breakfast spot with published hours', () => {
  assert.equal(new Set(walks.map(walk => walk.slug)).size, walks.length)
  assert.deepEqual(new Set(walks.map(walk => walk.city)), new Set(destinations.map(city => city.slug)))
  for (const city of destinations) {
    assert.ok(walks.some(walk => walk.city === city.slug && walk.breakfast), city.name)
  }
  for (const walk of walks) {
    assert.ok(walk.stops.length >= 3, walk.slug)
    assert.ok(walk.stops.some(stop => stop.photo), walk.slug)
    for (const stop of walk.stops) {
      assert.ok(stop.nameKo && stop.walk && stop.what && Number.isFinite(stop.lat) && Number.isFinite(stop.lng), stop.name)
      if (!stop.photo) continue
      assert.ok(stop.photo.credit && stop.photo.license && stop.photo.alt, stop.name)
      assert.match(stop.photo.source, /^https?:\/\//)
      assert.match(stop.photo.licenseUrl, /^https?:\/\//)
      assert.ok(existsSync(new URL('../public' + stop.photo.src, import.meta.url)), stop.photo.src)
    }
    const b = walk.breakfast
    if (!b) continue
    assert.ok(Number.isInteger(b.stop) && walk.stops[b.stop - 1], walk.slug)
    assert.ok(b.address && b.venueKo && b.venue && b.detail && b.source.label, walk.slug)
    assert.match(b.source.url, /^https?:\/\//)
    assert.match(b.checked, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(b.hours, /\d/, b.hours)
    assert.ok(filterDestinations(destinations, [], b.venueKo).some(city => city.slug === walk.city), b.venueKo)
    assert.equal(searchedWalkStop(walk, b.venueKo), b.stop, b.venueKo)
  }
})

test('the Jeonju breakfast walk reaches Nambu Market and older shared links keep their stops', () => {
  const jeonju = walks.filter(walk => walk.city === 'jeonju')
  const breakfast = searchedCityWalk(jeonju, '신뱅이')
  assert.equal(breakfast?.slug, 'hanok-breakfast')
  assert.equal(breakfast.stops[0].nameKo, '신뱅이')
  assert.equal(breakfast.stops.at(-1).nameKo, '남부시장')
  assert.equal(searchedCityWalk(jeonju, '전주 한옥마을')?.slug, 'hanok')
  assert.ok(searchedCityWalk(jeonju, '남부시장')?.stops.some(stop => stop.nameKo === '남부시장'))
  assert.deepEqual(jeonju.find(walk => walk.slug === 'hanok').stops.map(stop => stop.nameKo), ['경기전', '전동성당', '남부시장'])
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
