// (a) Privacy on the preparing home: a partner without shared details never
// sees period / LH / 임테기 data, and a soft / off partner never sees 가임기 /
// 배란 words — rendered through the real components and the real store, not
// the pure lenses alone (those are covered in tests/*.test.ts).

import { describe, expect, it } from 'vitest'
import TodayTab from '@/components/tabs/TodayTab'
import { addDays } from '@/lib/dates'
import { addPeriod } from '@/lib/logic/cycle'
import type { AlertStyle, AppState, ISODate } from '@/lib/types'
import { demoState, foundWords, pageText, renderApp } from '../setup'

const T0: ISODate = '2026-10-02'
/** 민수 (a) — the demo's partner; 지은 (b) records the cycle. */
const PARTNER = 'a'
const OWNER = 'b'

/**
 * Words that only the cycle owner's own records can produce. ('컨디션' alone is
 * not one: the shared diary prompt asks '요즘 우리 둘의 컨디션은 어때요?' — the
 * private chip reads '오늘 컨디션 · …'.)
 */
const CYCLE_DATA = [
  '생리',
  'LH',
  '배테기',
  '임테기',
  '테스트기',
  '양성',
  '음성',
  '희미',
  '가장 진함',
  '오늘 컨디션',
  '지난 주기 컨디션',
  '나만 보기',
  // 지은's feel chips (lib/content/fertility FEEL_CHIPS)
  '살짝 비쳐요',
  '가슴이 아파요',
  '배가 살짝 아파요',
  '예민해요',
]
/** Fertile-window wording a soft / off partner must not meet (AGENTS.md 제품·문구 규칙). */
const FERTILE_WORDS = ['가임기', '배란']
/**
 * Lines straight out of 지은's records in the demo (lib/demo.ts): her strips
 * with their times, her test times, her private note. (A bare clock time is
 * not private — 민수's own appointment shows one.)
 */
const PRIVATE_LINES = ['08:40 · 희미', '20:50 · 희미', '06:50', '06:40', '테스트는 음성', '아직 이를 수 있으니']

function partnerStyle(s: AppState, style: AlertStyle): AppState {
  return {
    ...s,
    settings: { ...s.settings, shareLevel: 'week', alertStyle: { ...s.settings.alertStyle, [PARTNER]: style } },
  }
}

/** The home at different moments of the demo cycle (the demo's last period starts on T0 − 11). */
function moments(): Array<{ name: string; state: AppState; today: ISODate }> {
  const base = demoState(T0)
  const nextStart = addDays(T0, 17)
  return [
    { name: '우리의 주간 (cycle day 12)', state: base, today: T0 },
    { name: '기다리는 주 (day 17)', state: base, today: addDays(T0, 5) },
    { name: '예정일 (day 28)', state: base, today: nextStart },
    { name: '늦음 (day 31)', state: base, today: addDays(T0, 20) },
    { name: '생리 2일째 (new period logged)', state: addPeriod(base, nextStart, undefined, OWNER), today: addDays(nextStart, 1) },
  ]
}

const STYLES: AlertStyle[] = ['explicit', 'soft', 'off']

/** Fails naming the word and where it sits on the page. */
function expectNone(text: string, words: readonly string[]): void {
  const hits = foundWords(text, words)
  expect(hits, hits.join(' | ')).toEqual([])
}

describe('PreparingHome · partner without shared details', () => {
  for (const style of STYLES)
    for (const m of moments())
      it(`${style} · ${m.name}: no period / LH / test data on the page`, () => {
        renderApp(<TodayTab onNavigate={() => {}} />, { state: partnerStyle(m.state, style), viewer: PARTNER, today: m.today })
        const text = pageText()
        expect(text.length).toBeGreaterThan(200)
        expectNone(text, CYCLE_DATA)
        expectNone(text, PRIVATE_LINES)
        if (style !== 'explicit') expectNone(text, FERTILE_WORDS)
      })

  it('control: the owner’s own home does show her cycle words (so the word list can catch a leak)', () => {
    renderApp(<TodayTab onNavigate={() => {}} />, { state: demoState(T0), viewer: OWNER, today: T0 })
    expect(foundWords(pageText(), CYCLE_DATA).length).toBeGreaterThan(0)
  })

  it('low-pressure partner (부담 없이) sees no fertile-window wording either', () => {
    const s = demoState(T0)
    const state: AppState = {
      ...s,
      settings: {
        ...s.settings,
        shareLevel: 'week',
        alertStyle: { ...s.settings.alertStyle, [PARTNER]: 'explicit' },
        personal: { ...s.settings.personal, [PARTNER]: { ...s.settings.personal?.[PARTNER], lowPressure: true } },
      },
    }
    renderApp(<TodayTab onNavigate={() => {}} />, { state, viewer: PARTNER, today: T0 })
    const text = pageText()
    expectNone(text, CYCLE_DATA)
    expectNone(text, FERTILE_WORDS)
  })
})
