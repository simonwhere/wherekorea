import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { hasArrivalCard, arrivalPath } from '../lib/arrival-routes.ts'

const registry = new URL('../data/arrival/index.ts', import.meta.url)
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === registry.href && specifier.startsWith('./')) {
      return nextResolve(new URL(`${specifier}.ts`, registry).href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { arrivalCards } = await import(registry.href)
const cards = Object.fromEntries(arrivalCards.map(card => [card.slug, card]))

test('only reviewed routes expose shareable city paths', () => {
  assert.deepEqual(arrivalCards.map(card => card.slug).sort(), [
    'andong', 'gangneung', 'gyeongju', 'jeju', 'jeonju', 'namhae', 'sokcho', 'tongyeong', 'yeosu',
  ])
  for (const { slug } of arrivalCards) {
    assert.equal(hasArrivalCard(slug), true)
    assert.equal(arrivalPath(slug), `/from-seoul/${slug}`)
  }
  for (const slug of ['', 'busan', 'Gyeongju', 'constructor', '../andong']) {
    assert.equal(hasArrivalCard(slug), false)
  }
})

test('each card identifies the return stop, transport mode and official departure lookups', () => {
  const seoulTerminals = {
    andong: /Cheongnyangni/, gyeongju: /Seoul Station/, jeonju: /Yongsan/,
    sokcho: /Gyeongbu|서울경부/, tongyeong: /Gyeongbu/, jeju: /Gimpo/,
    gangneung: /Seoul Station/, yeosu: /Yongsan/, namhae: /Nambu/,
  }
  const localHosts = {
    andong: ['bus.andong.go.kr'],
    gyeongju: ['livebus.gyeongju.go.kr'],
    jeonju: ['its.jeonju.go.kr', 'hanok.jeonju.go.kr'],
    sokcho: ['bis.sokcho.go.kr'], tongyeong: ['tsbis.kr'], jeju: ['www.airport.co.kr', 'bus.jeju.go.kr'],
    gangneung: ['bis.gn.go.kr'],
    yeosu: ['its.yeosu.go.kr', 'www.yeosu.go.kr'], namhae: ['tsbis.kr'],
  }
  for (const card of arrivalCards) {
    assert.ok(card.returnLocal.includes(card.returnStop))
    assert.match(card.checked, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(card.checked >= '2026-11-04')
    for (const leg of [card.glance.fromSeoul, card.fromSeoul, card.glance.back, card.returnSeoul]) {
      assert.match(leg, seoulTerminals[card.slug])
    }
    assert.deepEqual([...new Set(card.sources.map(source => source.use))].sort(), ['intercity', 'local', 'return'])
    for (const source of card.sources) {
      const { protocol, hostname } = new URL(source.url)
      assert.equal(protocol, 'https:')
      if (source.use !== 'intercity') assert.ok(localHosts[card.slug].includes(hostname), source.url)
      else if (card.mainMode === 'rail') assert.equal(hostname, 'www.korail.com')
    }
  }
})

test('outbound and return instructions identify the correct local bus and stop for each direction', () => {
  const { andong, gyeongju, jeonju, sokcho, tongyeong, jeju } = cards
  assert.match(andong.onward, /210.*하회보건진료소.*하회마을/)
  assert.match(andong.returnLocal, /하회마을.*210.*교보생명.*안동역/)
  assert.match(gyeongju.onward, /경주역.*710.*천마총후문.황리단길/)
  assert.match(gyeongju.returnLocal, /710.*01315.*고속버스.시외버스터미널.*경주역/)
  assert.equal(new URL(gyeongju.sources.find(s => s.use === 'local').url).search, '?s352000923')
  assert.equal(new URL(gyeongju.sources.find(s => s.use === 'return').url).search, '?s352000893')
  assert.match(jeonju.onward, /31109.*119.*평화동종점.*30601/)
  assert.match(jeonju.returnLocal, /30602.*119.*전주대학교.*31093/)
  assert.equal(sokcho.mainMode, 'coach')
  assert.match(sokcho.onward, /4311120.*설악산소공원/)
  assert.match(sokcho.returnLocal, /4311290.*4311440/)
  assert.equal(tongyeong.mainMode, 'coach')
  assert.match(tongyeong.onward, /3830057.*101.*3830334/)
  assert.match(tongyeong.returnLocal, /3830335.*토성고개.*3830058/)
  assert.equal(jeju.mainMode, 'flight')
  assert.match(jeju.onward, /Gate 5.*600.*주상절리대\[남\]/)
  assert.match(jeju.returnLocal, /406000402.*제주국제공항.*제주 썬호텔/)
})

test('Gyeongpo Beach uses separate arrival and departure stops on the two loops', () => {
  const { gangneung } = cards
  assert.match(gangneung.onward, /4200721.*202-1.*4201420/)
  assert.match(gangneung.returnLocal, /202\b.*4201242.*경포호.*4200293/)
})

test('Hyangiram uses different transfers and a different stop for the ride home', () => {
  const { yeosu } = cards
  assert.match(yeosu.onward, /3259001.*화장동차고지.*3251180.*111.*3251044/)
  assert.match(yeosu.returnLocal, /3251042.*111.*한국전력.*3250846.*3259001/)
})

test('the German Village loop continues from the same stop towards the terminal', () => {
  const { namhae } = cards
  assert.match(namhae.onward, /020.*3930542.*가천.*3930625/)
  assert.match(namhae.returnLocal, /020.*3930625.*동천삼거리.*3930612/)
})
