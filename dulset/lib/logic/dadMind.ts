// 아빠 마음, 한 번 묻기 (founder 2026-11-01, '12개 전부' #12) — pure.
//
// The parenting stage has no partner loop, and a father's own low mood tends
// to come a few months after the birth (research medical.json
// 'paternal-perinatal-depression', verified:false). So from 출생일 + 90
// (partnerDates.dadMindDay) his parenting home asks once, privately: '요즘 나는
// 어때요?' with [괜찮아요] and [이야기할 곳 보기]. Either answer closes it.
//
// • Only 'asked' is kept — decisions 'dad-mind-asked:<birthDate>:<member>' →
//   the day — never an answer, a score or which button. Nothing reaches her:
//   no line, no digest entry, no notice, no snapshot field.
// • The sheet lists where to talk (research medical.json 'mental-health-lines-kr',
//   verified:false): 정신건강위기상담 1577-0199 (24시간), 109 for thoughts of
//   dying (24시간), 119 for an emergency, and 난임·임산부심리상담센터 (spouses
//   may use it). 109 is never offered as a general counselling number.
// • Not for the person who gave birth (the cycle owner), and not in the quiet
//   after a loss (weekTogether.weekQuiet).
// • Kept out of exports too (critique fix line): a backup file leaves out the
//   'dad-mind-asked:' answers and his 'dad-mind:' notices (withoutDadMind —
//   components/settings/DataSection). A restored phone may ask him once more.

import { isISODate } from '../dates'
import { decide, decided } from '../sync/model'
import type { AppState, ISODate, MemberId } from '../types'
import { dadMindDay, dadMindLastDay } from './partnerDates'
import { usableBaby } from './plan'
import { canLogCycle } from './prefs'
import { weekQuiet } from './weekTogether'

/** decisions key: he was asked (either button) for this baby. */
export const dadMindKey = (birthDate: ISODate, member: MemberId): string => `dad-mind-asked:${birthDate}:${member}`

/** The card's question. */
export const DAD_MIND_QUESTION = '요즘 나는 어때요?'

export interface DadMindLine {
  /** '정신건강위기상담' */
  name: string
  /** What to dial, when there is one ('1577-0199'). */
  number?: string
  /** '24시간' · '배우자도 상담받을 수 있어요' */
  note?: string
}

/**
 * Where to talk, in order (critique 2026-11-01): the crisis line, 109 only for
 * thoughts of dying, 119 for an emergency, the counselling centre. Every
 * number is in docs/research/medical.json 'mental-health-lines-kr'.
 */
export const DAD_MIND_LINES: readonly DadMindLine[] = [
  { name: '정신건강위기상담', number: '1577-0199', note: '24시간' },
  { name: '죽고 싶은 생각이 들면', number: '109', note: '24시간' },
  { name: '위급하면', number: '119' },
  { name: '난임·임산부심리상담센터', note: '배우자도 상담받을 수 있어요' },
]

/** 'tel:15770199' for a line's number. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^0-9]/g, '')}`
}

/**
 * Does `member`'s parenting home ask today? From 출생일 + 90 through 출생일 +
 * 364 (partnerDates.dadMindLastDay — the first year the research covers), for
 * the person who did not give birth, until either button is tapped; never in
 * the quiet.
 */
export function dadMindDue(state: AppState, today: ISODate, member: MemberId): boolean {
  if (state.stage !== 'parenting' || !isISODate(today) || canLogCycle(state, member)) return false
  const baby = usableBaby(state.baby)
  if (!baby || today < dadMindDay(baby.birthDate) || today > dadMindLastDay(baby.birthDate)) return false
  if (weekQuiet(state, today)) return false
  return !decided(state, dadMindKey(baby.birthDate, member))
}

/** The prefixes 아빠 마음 writes into shared state: the 'asked' decision and the notice. */
export const DAD_MIND_DECISION_PREFIX = 'dad-mind-asked:'
export const DAD_MIND_NOTICE_PREFIX = 'dad-mind:'

/**
 * The state as a backup file carries it: without any 'dad-mind-asked:'
 * decision or 'dad-mind:' notice (the critique's fix line — excluded from her
 * views, the digest and exports). The same object when there is none.
 */
export function withoutDadMind<S extends Pick<AppState, 'decisions' | 'notifications'>>(state: S): S {
  const keys = Object.keys(state.decisions ?? {}).filter((k) => k.startsWith(DAD_MIND_DECISION_PREFIX))
  const notices = state.notifications.filter((n) => !n.key?.startsWith(DAD_MIND_NOTICE_PREFIX))
  if (!keys.length && notices.length === state.notifications.length) return state
  const decisions = { ...(state.decisions ?? {}) }
  for (const k of keys) delete decisions[k]
  return { ...state, decisions, notifications: notices }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * The stored state as the recovery screen's '지금 기록을 파일로 받기' saves it
 * (components/AppErrorBoundary): the raw string without the 아빠 마음 records,
 * like withoutDadMind. The recovery path exists for broken shapes, so this
 * never throws: anything that is not a JSON object with a `notifications`
 * array (and, if present, an object `decisions`) comes back unchanged, and so
 * does a state with nothing to leave out.
 */
export function rawWithoutDadMind(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }
  if (!isPlainObject(parsed) || !Array.isArray(parsed.notifications)) return raw
  const decisions = parsed.decisions
  if (decisions !== undefined && decisions !== null && !isPlainObject(decisions)) return raw
  const keys = Object.keys(decisions ?? {}).filter((k) => k.startsWith(DAD_MIND_DECISION_PREFIX))
  const isDadMindNotice = (n: unknown) => isPlainObject(n) && typeof n.key === 'string' && n.key.startsWith(DAD_MIND_NOTICE_PREFIX)
  const notifications = parsed.notifications.filter((n) => !isDadMindNotice(n))
  if (!keys.length && notifications.length === parsed.notifications.length) return raw
  const kept = { ...(decisions ?? {}) }
  for (const k of keys) delete kept[k]
  return JSON.stringify({ ...parsed, ...(decisions == null ? {} : { decisions: kept }), notifications })
}

/**
 * [괜찮아요] or [이야기할 곳 보기]: remember that he was asked — nothing else —
 * and mark his '💬 요즘 나는 어때요?' notice read: the card it opens is gone.
 * (The key is built here: partnerNotices imports this file.)
 */
export function markDadMindAsked(state: AppState, today: ISODate, member: MemberId): AppState {
  const baby = usableBaby(state.baby)
  if (!baby || !isISODate(today)) return state
  const asked = decide(state, dadMindKey(baby.birthDate, member), today)
  const key = `${DAD_MIND_NOTICE_PREFIX}${baby.birthDate}:${member}`
  if (!asked.notifications.some((n) => n.key === key && n.to === member && !n.read)) return asked
  return { ...asked, notifications: asked.notifications.map((n) => (n.key === key && n.to === member ? { ...n, read: true } : n)) }
}
