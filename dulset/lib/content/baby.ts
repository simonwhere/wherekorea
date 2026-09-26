// Content for the 아기 tab. Checkup windows and vaccine anchors come from the
// NHIS / KDCA summaries in the research notes (kr-programs, checked 2026-09-26);
// milestone ages are loose "most babies around…" ranges, not norms. Nothing here
// is a diagnosis — every screen that shows it points to 영유아 건강검진.

import type { BabySex } from '../types'

export const SEX_EMOJI: Record<BabySex, string> = {
  girl: '👧',
  boy: '👦',
  unknown: '👶',
}

export const SEX_LABEL: Record<BabySex, string> = {
  girl: '여아',
  boy: '남아',
  unknown: '선택 안 함',
}

export const SEX_OPTIONS: BabySex[] = ['girl', 'boy', 'unknown']

// ── 발달 이정표 ─────────────────────────────────────────────

export interface Milestone {
  key: string
  label: string
  emoji: string
  /** Loose typical age, shown as-is ("2개월 무렵"). */
  typical: string
  /** Rough start month — only used for ordering. */
  fromMonth: number
}

export const MILESTONES: Milestone[] = [
  { key: 'smile', label: '사회적 미소', emoji: '😊', typical: '2개월 무렵', fromMonth: 2 },
  { key: 'head', label: '목 가누기', emoji: '🙆', typical: '3~4개월 무렵', fromMonth: 3 },
  { key: 'roll', label: '뒤집기', emoji: '🔄', typical: '4~6개월 무렵', fromMonth: 4 },
  { key: 'sit', label: '혼자 앉기', emoji: '🪑', typical: '6~8개월 무렵', fromMonth: 6 },
  { key: 'peekaboo', label: '까꿍 놀이에 웃기', emoji: '🙈', typical: '6~9개월 무렵', fromMonth: 6 },
  { key: 'crawl', label: '기기', emoji: '🐢', typical: '7~10개월 무렵', fromMonth: 7 },
  { key: 'clap', label: '짝짜꿍 (박수)', emoji: '👏', typical: '9~12개월 무렵', fromMonth: 9 },
  { key: 'pullstand', label: '잡고 서기', emoji: '🧍', typical: '9~12개월 무렵', fromMonth: 9 },
  { key: 'firstword', label: '첫 단어', emoji: '🗣️', typical: '10~14개월 무렵', fromMonth: 10 },
  { key: 'walk', label: '첫 걸음', emoji: '👣', typical: '9~15개월 무렵', fromMonth: 11 },
]

export const MILESTONE_NOTE = '아이마다 속도가 달라요. 걱정되면 영유아 건강검진 때 상담하세요.'

// ── 영유아 건강검진 (국민건강보험공단) ────────────────────────

export type CheckupKind = 'general' | 'dental'

/**
 * A checkup window. `fromDays`/`toDays` are days after birth; month windows
 * run from the day the baby turns `fromMonth` months to the day before they
 * turn `toMonth + 1` months ("4~6개월" = 만 4개월 ~ 6개월 끝).
 */
export type CheckupSpec =
  | { id: string; kind: CheckupKind; round: number; label: string; fromDays: number; toDays: number }
  | { id: string; kind: CheckupKind; round: number; label: string; fromMonth: number; toMonth: number }

export const CHECKUPS: CheckupSpec[] = [
  { id: '1', kind: 'general', round: 1, label: '생후 14~35일', fromDays: 14, toDays: 35 },
  { id: '2', kind: 'general', round: 2, label: '생후 4~6개월', fromMonth: 4, toMonth: 6 },
  { id: '3', kind: 'general', round: 3, label: '생후 9~12개월', fromMonth: 9, toMonth: 12 },
  { id: '4', kind: 'general', round: 4, label: '생후 18~24개월', fromMonth: 18, toMonth: 24 },
  { id: '5', kind: 'general', round: 5, label: '생후 30~36개월', fromMonth: 30, toMonth: 36 },
  { id: '6', kind: 'general', round: 6, label: '생후 42~48개월', fromMonth: 42, toMonth: 48 },
  { id: '7', kind: 'general', round: 7, label: '생후 54~60개월', fromMonth: 54, toMonth: 60 },
  { id: '8', kind: 'general', round: 8, label: '생후 66~71개월', fromMonth: 66, toMonth: 71 },
  { id: 'd1', kind: 'dental', round: 1, label: '생후 18~29개월', fromMonth: 18, toMonth: 29 },
  { id: 'd2', kind: 'dental', round: 2, label: '생후 30~41개월', fromMonth: 30, toMonth: 41 },
  { id: 'd3', kind: 'dental', round: 3, label: '생후 42~53개월', fromMonth: 42, toMonth: 53 },
  { id: 'd4', kind: 'dental', round: 4, label: '생후 54~65개월', fromMonth: 54, toMonth: 65 },
]

export const CHECKUP_KIND_LABEL: Record<CheckupKind, string> = {
  general: '건강검진',
  dental: '구강검진',
}

export const CHECKUP_NOTE =
  '본인부담 없이 받을 수 있어요. 날짜는 생일로 계산한 예상 기간이라, 정확한 기간과 검진기관은 국민건강보험공단에서 확인해 주세요.'

export const CHECKUP_LINK = { url: 'https://www.nhis.or.kr', label: '국민건강보험공단' } as const

// ── 예방접종 — a few anchors only; the full schedule lives on 예방접종도우미 ──

export const VACCINE_ANCHORS: { name: string; when: string }[] = [
  { name: 'BCG (결핵)', when: '생후 4주 이내' },
  { name: 'B형간염', when: '0 · 1 · 6개월' },
  { name: 'MMR (홍역·유행성이하선염·풍진)', when: '12~15개월' },
]

export const VACCINE_NOTE =
  '국가 지원 백신은 위탁의료기관에서 무료로 맞을 수 있어요. 접종이 늦어지면 횟수와 일정이 달라질 수 있으니 예진 때 상담해 주세요.'

export const VACCINE_ALERT_TIP =
  '국민비서(카카오톡·네이버 등)에서 ‘필수예방접종 알림’을 신청하면 다음 접종 시기를 알려 줘요. 비슷한 이름의 비공식 앱도 있으니 공식 사이트(nip.kdca.go.kr)에서 확인하세요.'

// ── 성장 기록 ───────────────────────────────────────────────

export interface GrowthLimit {
  min: number
  max: number
  step: number
  unit: string
  label: string
}

export const GROWTH_LIMITS = {
  heightCm: { min: 30, max: 130, step: 0.1, unit: 'cm', label: '키' },
  weightKg: { min: 1, max: 30, step: 0.01, unit: 'kg', label: '몸무게' },
  headCm: { min: 25, max: 60, step: 0.1, unit: 'cm', label: '머리둘레' },
} as const satisfies Record<'heightCm' | 'weightKg' | 'headCm', GrowthLimit>

export type GrowthField = keyof typeof GROWTH_LIMITS

export const GROWTH_CHART_LINK = {
  text: '성장 백분위는 질병관리청 2017 소아청소년 성장도표에서 확인하세요',
  url: 'https://www.kdca.go.kr',
} as const

// ── 한국 기념일 ─────────────────────────────────────────────

/** 국립민속박물관 한국민속대백과 (돌, 돌잡이) summary. */
export const KOREAN_DAYS_NOTE = {
  title: '백일과 돌',
  body: '예부터 백일과 돌에는 떡을 이웃과 나누며 아이가 건강하게 자라고 있음을 알렸어요. 돌상에는 백설기·수수팥떡 같은 음식을 올리고, 쌀·돈·책·실 등을 놓고 아기가 하나를 고르는 ‘돌잡이’를 해요.',
  source: { url: 'https://folkency.nfm.go.kr/topic/detail/147', label: '한국민속대백과' },
} as const

// ── 지원 제도 ───────────────────────────────────────────────

/**
 * 부모급여·아동수당·양육수당: apply within 60 days of birth to be paid from the
 * birth month. lib/logic/babyView counts the birth day as day 1 (the earlier
 * reading), so the last day shown is the 60th day of life.
 */
export const CLAIM_WINDOW_DAYS = 60

/** lib/content/programs ids with the 60-day rule, and 첫만남이용권 (use within 1 year). */
export const CLAIM_60_PROGRAM_IDS: readonly string[] = ['parent-allowance', 'child-allowance']
export const FIRST_MEETING_PROGRAM_ID = 'first-meeting'

export const HAPPY_BIRTH = {
  title: '정부24 “행복출산”',
  body: '출생신고 때 첫만남이용권·부모급여·아동수당 등을 한 번에 신청할 수 있어요.',
  url: 'https://www.gov.kr/portal/onestopSvc/happyBirth',
} as const
