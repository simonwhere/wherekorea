// '양성 뒤에 출혈이 시작됐어요' (Next B), pure helpers.
//
// While a positive home test waits for the clinic (positivePending), the
// owner can mark the day bleeding started (positivePending.bleedingSince).
// bleedingAdvice turns that — plus any warning signs the owner ticked on the
// card — into a kind (watch / see-doctor / urgent) and a few lines. Every
// line is, character for character, the `ui` text of a finding with
// inUI: true in docs/research/early-pregnancy-bleeding.json (ACOG · NHS;
// tests/positiveBleeding.test.ts compares them). The app never says what the
// bleeding means: no 유산, no 자궁외임신, no odds — '이어지지 않을 수도 있어요'
// and the clinic. The partner only hears about it through the cycle lens
// (shareCycleDetails), like every other cycle detail.

import { diffDays, isISODate } from '../dates'
import type { AppState, ISODate } from '../types'
import { activePositivePending } from './ttc'

/** When the lines below were last checked against docs/research/early-pregnancy-bleeding.json. */
export const BLEEDING_ADVICE_CHECKED_AT = '2026-10-02'

/**
 * docs/research/early-pregnancy-bleeding.json → findings[id].ui — one line
 * each. Keys are the finding ids.
 */
export const BLEEDING_LINES = {
  common: '임신 초기 출혈은 드물지 않아요. 임신 초기에 15~25%가 겪고, 많은 경우 큰 문제 없이 지나가요.',
  'contact-clinic': '양이 적어도 출혈이 있으면 다니는 병원에 알려 두는 게 좋아요. 전화로 먼저 물어봐도 돼요.',
  'urgent-signs':
    '패드가 한 시간 안에 흠뻑 젖을 만큼 많거나, 참기 어려운 배 통증이나 어깨 끝 통증이 있거나, 어지럽고 쓰러질 것 같으면 바로 응급실로 가거나 119를 불러요.',
  'not-always-loss': '출혈이 있다고 임신이 꼭 끝나는 건 아니에요. 다만 임신이 이어지지 않을 수도 있어서, 병원에서 확인하는 게 가장 정확해요.',
  'fever-call': '열이 나거나 오한이 있으면 바로 병원에 연락해요.',
} as const

export type BleedingLineId = keyof typeof BLEEDING_LINES

/** Where each line comes from (for a '근거' link under the card). */
export const BLEEDING_SOURCES = [
  { name: 'ACOG — Bleeding During Pregnancy (FAQ)', url: 'https://www.acog.org/womens-health/faqs/bleeding-during-pregnancy' },
  { name: 'NHS — Vaginal bleeding in pregnancy', url: 'https://www.nhs.uk/pregnancy/related-conditions/common-symptoms/vaginal-bleeding/' },
  { name: 'ACOG — Early Pregnancy Loss (FAQ)', url: 'https://www.acog.org/womens-health/faqs/early-pregnancy-loss' },
] as const

/**
 * What the owner can tick on the card. heavy / pain / shoulder / faint are the
 * NHS 999 signs (→ urgent); fever is ACOG's 'call right away' (→ see-doctor).
 */
export type BleedingSign = 'heavy' | 'pain' | 'shoulder' | 'faint' | 'fever'
export const BLEEDING_SIGNS: readonly BleedingSign[] = ['heavy', 'pain', 'shoulder', 'faint', 'fever'] as const

/** Chip labels — descriptive, no diagnosis. */
export const BLEEDING_SIGN_LABEL: Record<BleedingSign, string> = {
  heavy: '패드가 한 시간 안에 젖어요',
  pain: '참기 어려운 배 통증',
  shoulder: '어깨 끝이 아파요',
  faint: '어지럽고 쓰러질 것 같아요',
  fever: '열이 나거나 오한',
}

const URGENT_SIGNS: readonly BleedingSign[] = ['heavy', 'pain', 'shoulder', 'faint']

export function isBleedingSign(value: unknown): value is BleedingSign {
  return typeof value === 'string' && (BLEEDING_SIGNS as readonly string[]).includes(value)
}

// ── State ───────────────────────────────────────────────────

/** The day bleeding started, while the positive test is still pending (else undefined). */
export function bleedingSince(state: Pick<AppState, 'positivePending' | 'periods' | 'stage'>): ISODate | undefined {
  return activePositivePending(state)?.bleedingSince
}

/**
 * Is a period start on `date` really a bleeding mark? While a positive test
 * waits for the clinic, bleeding from that day on is not yet a period: the
 * log layer (lib/logic/logs.ts logPeriodStart) marks it instead of logging a
 * period, and the home card asks what to do with it. A start before the test
 * is an ordinary (late-entered) period.
 */
export function isBleedingDuringPositive(state: Pick<AppState, 'positivePending' | 'periods' | 'stage'>, date: ISODate): boolean {
  const pending = activePositivePending(state)
  return !!pending && date >= pending.since
}

/**
 * Mark the day bleeding started. Only while a positive test is pending, and
 * never before that test; marking again keeps the earlier of the two days
 * (it is a 'since'). Anything else is a no-op.
 */
export function markBleeding(state: AppState, date: ISODate): AppState {
  const pending = activePositivePending(state)
  if (!pending || !isISODate(date) || date < pending.since) return state
  const current = state.positivePending!
  const since = current.bleedingSince && current.bleedingSince <= date ? current.bleedingSince : date
  if (since === current.bleedingSince) return state
  return { ...state, positivePending: { ...current, bleedingSince: since } }
}

/** Take the mark back (the test stays pending). */
export function clearBleeding(state: AppState): AppState {
  const current = state.positivePending
  if (!current || current.bleedingSince === undefined) return state
  const { bleedingSince: _gone, ...rest } = current
  return { ...state, positivePending: rest }
}

// ── Advice ──────────────────────────────────────────────────

export type BleedingAdviceKind = 'watch' | 'see-doctor' | 'urgent'

export interface BleedingAdvice {
  kind: BleedingAdviceKind
  /** The lines to show, in order (each a BLEEDING_LINES entry). */
  lines: string[]
  /** Ids of those lines, for a test or a '근거' link. */
  lineIds: BleedingLineId[]
  /** Days since bleeding started (0 = today); undefined when none is marked. */
  days?: number
}

/**
 * What the card says for `today`:
 *  • no bleeding marked → 'watch': it is common, it isn't necessarily the end,
 *    and the signs that mean 응급실;
 *  • bleeding marked → 'see-doctor': tell the clinic, it isn't necessarily the
 *    end, the 응급실 signs;
 *  • any NHS 999 sign ticked → 'urgent': the one 응급실 line first;
 *  • fever ticked (no 999 sign) → 'see-doctor' with the ACOG 'call right away' line.
 * Outside a pending positive test there is nothing to say (kind 'watch', no lines).
 */
export function bleedingAdvice(
  state: Pick<AppState, 'positivePending' | 'periods' | 'stage'>,
  today: ISODate,
  signs: readonly BleedingSign[] = [],
): BleedingAdvice {
  const pending = activePositivePending(state)
  if (!pending) return { kind: 'watch', lines: [], lineIds: [] }
  const since = pending.bleedingSince
  const days = since && isISODate(today) && today >= since ? diffDays(since, today) : undefined
  const ticked = signs.filter(isBleedingSign)
  const urgent = ticked.some((s) => URGENT_SIGNS.includes(s))
  const fever = ticked.includes('fever')

  let kind: BleedingAdviceKind
  let lineIds: BleedingLineId[]
  if (urgent) {
    kind = 'urgent'
    lineIds = ['urgent-signs', ...(fever ? (['fever-call'] as const) : [])]
  } else if (since !== undefined || fever) {
    kind = 'see-doctor'
    lineIds = fever
      ? ['fever-call', 'contact-clinic', 'not-always-loss', 'urgent-signs']
      : ['contact-clinic', 'not-always-loss', 'urgent-signs']
  } else {
    kind = 'watch'
    lineIds = ['common', 'not-always-loss', 'urgent-signs']
  }
  return {
    kind,
    lines: lineIds.map((id) => BLEEDING_LINES[id]),
    lineIds,
    ...(days !== undefined ? { days } : {}),
  }
}
