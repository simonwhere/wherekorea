// The joining partner's own first-run choices, in one place so the app's
// sheet (PartnerFirstRunSheet + HabitQuestions) and the link's first-run card
// (components/link/LinkIntro) ask with the same words. Data only — no React,
// no logic imports — so the /link bundle stays small.

import type { HabitAnswers } from '@/lib/initial'
import type { AlertStyle } from '@/lib/types'
import type { Option } from './parts'

/**
 * The smoking question. '전자담배 포함' (2026-11-01, research medical.json
 * 'male-e-cigarettes'): someone who only vapes answers 피워요 and gets the
 * weekly 금연 check-in. Only the question says it — the row labels stay
 * '금연' / '담배 안 피우기' (lib/initial SMOKE_CHECK_LABELS must keep matching).
 */
export const SMOKE_QUESTION = '담배를 피우나요? (전자담배 포함)'

/** 담배를 피우나요? (전자담배 포함) */
export const SMOKE_OPTIONS: Option<'no' | 'yes'>[] = [
  { value: 'no', label: '안 피워요' },
  { value: 'yes', label: '피워요' },
]

/** The drinking question. */
export const DRINK_QUESTION = '술은 얼마나 마시나요?'

/** 술은 얼마나 마시나요? */
export const DRINK_OPTIONS: Option<HabitAnswers['drinks']>[] = [
  { value: 'rarely', label: '거의 안 마셔요' },
  { value: 'sometimes', label: '가끔 (주 1~2번)' },
  { value: 'often', label: '자주 (주 3번 이상)' },
]

/**
 * 소식 받는 방식 — the three styles (lib/logic/settings ALERT_STYLE_OPTIONS)
 * named without health words: the person choosing starts on 은근하게, so their
 * first screen says nothing a soft viewer shouldn't read. 설정 › 내 알림 has
 * the full names.
 */
export const STYLE_OPTIONS: Option<AlertStyle>[] = [
  { value: 'explicit', label: '날짜와 함께 알려 주세요' },
  { value: 'soft', label: '‘우리의 주간’처럼 은근하게' },
  { value: 'off', label: '받지 않을래요' },
]
