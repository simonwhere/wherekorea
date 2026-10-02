import { describe, expect, it } from 'vitest'
import evidence from '@/docs/research/early-pregnancy-bleeding.json'
import { createInitialState } from '@/lib/initial'
import {
  BLEEDING_ADVICE_CHECKED_AT,
  BLEEDING_LINES,
  BLEEDING_SIGNS,
  BLEEDING_SIGN_LABEL,
  BLEEDING_SOURCES,
  bleedingAdvice,
  bleedingSince,
  clearBleeding,
  markBleeding,
} from '@/lib/logic/positiveBleeding'
import { sanitizeBackup } from '@/lib/logic/settings'
import { markPositivePending } from '@/lib/logic/ttc'
import { logPeriodOrBleeding, settleBleedingAsPeriod, ttcMoment } from '@/lib/logic/ttcFlow'
import { parseState } from '@/lib/storage'
import type { AppState } from '@/lib/types'

const TODAY = '2026-10-02'

function fresh(): AppState {
  return createInitialState(
    { me: { name: '민수', role: 'husband' }, partner: { name: '지은', role: 'wife' }, cycleOwner: 'b', lastPeriodStart: '2026-09-01' },
    new Date('2026-10-02T09:00:00+09:00'),
  )
}

/** A positive home test on 09-28, waiting for the clinic. */
const pending = () => markPositivePending(fresh(), '2026-09-28', 'pt1')

interface Finding {
  id: string
  ui: string | null
  sources: string[]
  confidence: string
  inUI: boolean
  checked: string
}
const findings = (evidence as { checkedAt: string; findings: Finding[] }).findings

describe('bleedingAdvice lines come from docs/research/early-pregnancy-bleeding.json', () => {
  it('every line equals the `ui` text of a finding with inUI: true, with sources and a check date', () => {
    for (const [id, text] of Object.entries(BLEEDING_LINES)) {
      const f = findings.find((x) => x.id === id)
      expect(f, id).toBeDefined()
      expect(f!.inUI, id).toBe(true)
      expect(f!.ui, id).toBe(text)
      expect(f!.sources.length, id).toBeGreaterThan(0)
      expect(f!.sources.every((u) => u.startsWith('https://')), id).toBe(true)
      expect(f!.checked, id).toBe(BLEEDING_ADVICE_CHECKED_AT)
    }
    expect((evidence as { checkedAt: string }).checkedAt).toBe(BLEEDING_ADVICE_CHECKED_AT)
    // ACOG and NHS are the sources behind the lines.
    const urls = new Set(findings.filter((f) => f.inUI).flatMap((f) => f.sources))
    expect([...urls].some((u) => u.includes('acog.org'))).toBe(true)
    expect([...urls].some((u) => u.includes('nhs.uk'))).toBe(true)
    for (const s of BLEEDING_SOURCES) expect(urls.has(s.url)).toBe(true)
  })

  it('never diagnoses: no 유산·자궁외임신·착상혈, no odds, no banned words; 해요체', () => {
    const all = [...Object.values(BLEEDING_LINES), ...Object.values(BLEEDING_SIGN_LABEL)].join(' ')
    for (const word of ['유산', '자궁외', '착상혈', '확률', '성공', '숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '가임기', '배란', 'LH']) {
      expect(all, word).not.toContain(word)
    }
    for (const line of Object.values(BLEEDING_LINES)) expect(line.endsWith('요.')).toBe(true)
    expect(BLEEDING_LINES['not-always-loss']).toContain('이어지지 않을 수도 있어서')
    expect(BLEEDING_LINES['urgent-signs']).toContain('119')
  })
})

describe('markBleeding / clearBleeding', () => {
  it('marks the first bleeding day while a positive test is pending, never before the test, keeps the earlier day', () => {
    const s = pending()
    expect(bleedingSince(s)).toBeUndefined()
    expect(markBleeding(s, '2026-09-27')).toBe(s) // before the positive test
    expect(markBleeding(s, '2026-09-31')).toBe(s)
    const marked = markBleeding(s, '2026-10-01')
    expect(marked.positivePending).toEqual({ since: '2026-09-28', testId: 'pt1', bleedingSince: '2026-10-01' })
    expect(bleedingSince(marked)).toBe('2026-10-01')
    expect(markBleeding(marked, '2026-10-02')).toBe(marked) // later day → keep the since
    expect(bleedingSince(markBleeding(marked, '2026-09-30'))).toBe('2026-09-30') // earlier → that one
    const cleared = clearBleeding(marked)
    expect(cleared.positivePending).toEqual({ since: '2026-09-28', testId: 'pt1' })
    expect(clearBleeding(cleared)).toBe(cleared)
    const none = fresh()
    expect(clearBleeding(none)).toBe(none)
  })

  it('is a no-op without a pending test, and once a later period settled it', () => {
    const s = fresh()
    expect(markBleeding(s, TODAY)).toBe(s)
    const settled: AppState = { ...pending(), periods: [{ start: '2026-09-01' }, { start: '2026-10-01', by: 'b' }] }
    expect(markBleeding(settled, TODAY)).toBe(settled)
    expect(bleedingSince(settled)).toBeUndefined()
  })

  it('survives a backup and a reload; a bad or too-early day is dropped, the pending test kept', () => {
    const marked = markBleeding(pending(), '2026-10-01')
    const raw = JSON.stringify(marked)
    expect(parseState(raw)).toEqual(JSON.parse(raw))
    const early = { ...JSON.parse(raw), positivePending: { since: '2026-09-28', bleedingSince: '2026-09-20' } }
    expect(sanitizeBackup(early)!.positivePending).toEqual({ since: '2026-09-28' })
    const bad = { ...JSON.parse(raw), positivePending: { since: '2026-09-28', bleedingSince: 'yesterday' } }
    expect(sanitizeBackup(bad)!.positivePending).toEqual({ since: '2026-09-28' })
  })
})

describe('bleedingAdvice', () => {
  it('watch while nothing is marked: common · not the end · the 응급실 signs', () => {
    const a = bleedingAdvice(pending(), TODAY)
    expect(a.kind).toBe('watch')
    expect(a.lineIds).toEqual(['common', 'not-always-loss', 'urgent-signs'])
    expect(a.lines).toEqual(a.lineIds.map((id) => BLEEDING_LINES[id]))
    expect(a.days).toBeUndefined()
  })

  it('see-doctor once bleeding is marked: tell the clinic first, with days since', () => {
    const s = markBleeding(pending(), '2026-09-30')
    const a = bleedingAdvice(s, TODAY)
    expect(a.kind).toBe('see-doctor')
    expect(a.lineIds).toEqual(['contact-clinic', 'not-always-loss', 'urgent-signs'])
    expect(a.days).toBe(2)
    expect(bleedingAdvice(s, '2026-09-30').days).toBe(0)
  })

  it('urgent on any NHS 999 sign, whether or not a day is marked; fever alone is see-doctor with the ACOG line first', () => {
    for (const sign of ['heavy', 'pain', 'shoulder', 'faint'] as const) {
      const a = bleedingAdvice(pending(), TODAY, [sign])
      expect(a.kind, sign).toBe('urgent')
      expect(a.lineIds[0], sign).toBe('urgent-signs')
    }
    const withFever = bleedingAdvice(markBleeding(pending(), TODAY), TODAY, ['heavy', 'fever'])
    expect(withFever.kind).toBe('urgent')
    expect(withFever.lineIds).toEqual(['urgent-signs', 'fever-call'])
    const fever = bleedingAdvice(pending(), TODAY, ['fever'])
    expect(fever.kind).toBe('see-doctor')
    expect(fever.lineIds).toEqual(['fever-call', 'contact-clinic', 'not-always-loss', 'urgent-signs'])
    // Unknown chips are ignored.
    expect(bleedingAdvice(pending(), TODAY, ['dizzy' as never]).kind).toBe('watch')
    expect(BLEEDING_SIGNS).toEqual(['heavy', 'pain', 'shoulder', 'faint', 'fever'])
  })

  it('says nothing outside a pending positive test', () => {
    expect(bleedingAdvice(fresh(), TODAY)).toEqual({ kind: 'watch', lines: [], lineIds: [] })
    const pregnant: AppState = { ...markBleeding(pending(), TODAY), stage: 'pregnant' }
    expect(bleedingAdvice(pregnant, TODAY).lines).toEqual([])
  })
})

describe('the home card reads the advice (ttcFlow, Next B)', () => {
  it('the card body is the first advice line, the rest follow; ticked signs re-read the advice the same way', () => {
    const s = logPeriodOrBleeding(pending(), '2026-10-01', 'b', TODAY)
    expect(bleedingSince(s)).toBe('2026-10-01')
    const m = ttcMoment(s, TODAY, 'b')!
    const a = bleedingAdvice(s, TODAY)
    expect(m.kind).toBe('positive-bleeding')
    expect([m.body, ...m.bleeding!.lines]).toEqual(a.lines)
    expect(m.bleeding!.days).toBe(a.days)
    const urgent = bleedingAdvice(s, TODAY, ['faint'])
    expect(urgent.kind).toBe('urgent')
    expect(urgent.lines[0]).toBe(BLEEDING_LINES['urgent-signs'])
    // Settled as a period: nothing to advise any more.
    const settled = settleBleedingAsPeriod(s, TODAY)
    expect(bleedingSince(settled)).toBeUndefined()
    expect(bleedingAdvice(settled, TODAY)).toEqual({ kind: 'watch', lines: [], lineIds: [] })
  })
})
