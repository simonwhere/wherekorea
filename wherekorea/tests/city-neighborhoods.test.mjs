import assert from 'node:assert/strict'
import test from 'node:test'
import { cityNeighborhoods } from '../data/city-neighborhoods.ts'
import { destinations } from '../data/destinations.ts'

test('every destination has distinct, sourced map points inside Korea and food guidance', () => {
  assert.deepEqual(Object.keys(cityNeighborhoods).sort(), destinations.map(city => city.slug).sort())
  for (const [city, guide] of Object.entries(cityNeighborhoods)) {
    assert.ok(guide.food.trim(), city)
    assert.ok(guide.places.length >= 2, city)
    const points = new Set()
    for (const place of guide.places) {
      assert.ok(place.lat > 33 && place.lat < 39 && place.lng > 124 && place.lng < 132, place.name)
      assert.ok(place.name.trim() && /[가-힣]/u.test(place.nameKo) && place.detail.trim(), city)
      assert.equal(new URL(place.source).protocol, 'https:', place.name)
      points.add([place.lat, place.lng].join(','))
    }
    assert.equal(points.size, guide.places.length, city)
  }
})
