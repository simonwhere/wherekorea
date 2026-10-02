// "표지 사진" — the couple's photo at the top of 오늘 (pure).
//
// The state holds an id only (IndexedDB key or a 'builtin:' demo picture);
// the image never leaves this phone and backups carry no blobs. The cover
// never follows the cycle: it is the same on a fertile day, a period day or a
// 기다리는 주, and the line above it (heroLine) never uses cycle words.
//
// Imports stay within ../types, ../dates, ./pregnancy, ./signals,
// ./anniversary, ./today and ./prefs (see the import-cycle note in AGENTS.md;
// settings.ts and ttcFlow.ts import this file, so their flags are read inline).

import { addDays, diffDays, isISODate } from '../dates'
import type { AppState, Appointment, CoverPhoto, DiaryEntry, ISODate, MemberId, PeriodLog, Pregnancy, PregnancyTest } from '../types'
import { anniversariesBetween, daysSince } from './anniversary'
import { QUIET_DAYS_AFTER_END, recentlyEnded } from './pregnancy'
import { isSignal, pendingSignal } from './signals'
import { greetingFor, rowProgress } from './today'

// ── Caption ─────────────────────────────────────────────────

export const COVER_CAPTION_MAX = 16

/**
 * Words the cover never shows — it sits on both people's first screen (and
 * over a shoulder), so health, cycle and clinic talk stays in its own places.
 */
export const COVER_WORDS = /가임기|배란|LH|생리|테스트|임신|임테기|병원|시험관|난임|유산|초음파|주사/i

/** Length as a person counts it (an emoji is one character). */
export function captionLength(text: string): number {
  return [...text.trim()].length
}

/** Why a caption can't be saved, or null when it can (empty is fine: it's optional). */
export function coverCaptionProblem(text: string): string | null {
  if (captionLength(text) > COVER_CAPTION_MAX) return `${COVER_CAPTION_MAX}자 이내로 적어 주세요`
  if (COVER_WORDS.test(text)) return '표지에는 건강·병원 이야기를 넣지 않아요. 다른 말로 적어 주세요.'
  return null
}

/** The caption to store: trimmed, and dropped when empty or not allowed. */
function cleanCaption(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined
  const t = text.trim()
  return t && coverCaptionProblem(t) === null ? t : undefined
}

// ── Stored shape ────────────────────────────────────────────

export const COVER_ID_MAX = 200

export function clampFocus(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= COVER_ID_MAX

/**
 * A stored cover, checked (storage.normalize and settings.sanitizeBackup):
 * undefined when the id, focus, author or date is unusable; a bad caption is
 * dropped on its own. Unknown built-in ids are dropped by sanitizeBackup.
 */
export function cleanCover(raw: unknown): CoverPhoto | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const c = raw as Record<string, unknown>
  if (!validId(c.photoId)) return undefined
  if (typeof c.focusY !== 'number' || !Number.isFinite(c.focusY)) return undefined
  if (c.setBy !== 'a' && c.setBy !== 'b') return undefined
  if (!isISODate(c.setAt)) return undefined
  const caption = cleanCaption(c.caption)
  return {
    photoId: c.photoId,
    focusY: clampFocus(c.focusY),
    ...(caption ? { caption } : {}),
    setBy: c.setBy,
    setAt: c.setAt,
  }
}

// ── State changes ───────────────────────────────────────────

/**
 * Hang a photo as the couple's cover (both phones). focusY is clamped to
 * 0–100; an empty or invalid caption is left out. An unusable id is a no-op.
 */
export function setCover(
  state: AppState,
  input: { photoId: string; focusY: number; caption?: string },
  by: MemberId,
  today: ISODate,
): AppState {
  if (!validId(input.photoId)) return state
  const caption = cleanCaption(input.caption)
  const cover: CoverPhoto = {
    photoId: input.photoId,
    focusY: Number.isFinite(input.focusY) ? clampFocus(input.focusY) : 50,
    ...(caption ? { caption } : {}),
    setBy: by,
    setAt: today,
  }
  return { ...state, couple: { ...state.couple, cover } }
}

/** Move the photo up or down in its frame (keeps who set it and when). */
export function setCoverFocus(state: AppState, focusY: number): AppState {
  const cover = state.couple.cover
  if (!cover || !Number.isFinite(focusY)) return state
  const next = clampFocus(focusY)
  return next === cover.focusY ? state : { ...state, couple: { ...state.couple, cover: { ...cover, focusY: next } } }
}

/** Back to the default art, for both people. */
export function clearCover(state: AppState): AppState {
  if (!state.couple.cover) return state
  const couple = { ...state.couple }
  delete couple.cover
  return { ...state, couple }
}

/**
 * After the cover changed (a new photo, or 기본 그림으로): the previous photo's
 * id when its stored copy can be deleted from this phone, else null. Never a
 * built-in picture, never the photo the cover (still) shows, and never one a
 * diary entry uses — an album pick is hung as a COPY, so deleting the old cover
 * only ever removes that copy. Pass the state AFTER the change.
 */
export function releasableCoverPhoto(state: Pick<AppState, 'couple' | 'diary'>, previousId: string | undefined): string | null {
  if (!previousId || previousId.startsWith('builtin:')) return null
  if (state.couple.cover?.photoId === previousId) return null
  if (state.diary.some((e) => e.photoId === previousId)) return null
  return previousId
}

/**
 * This person's own choice: true = the default art on my phone, false = always
 * the photo, undefined = automatic (see coverView.autoHidden).
 */
export function setHideCover(state: AppState, member: MemberId, value: boolean | undefined): AppState {
  const current = state.settings.personal?.[member]
  const unchanged = value === undefined ? !current || !('hideCover' in current) : current?.hideCover === value
  if (unchanged) return state
  const mine = { ...(current ?? {}) }
  if (value === undefined) delete mine.hideCover
  else mine.hideCover = value
  const personal = { ...(state.settings.personal ?? {}), [member]: mine }
  return { ...state, settings: { ...state.settings, personal } }
}

// ── View ────────────────────────────────────────────────────

export interface CoverView {
  /** The couple's cover, when there is one (shown only when mode is 'photo'). */
  photo?: { photoId: string; focusY: number; caption?: string }
  /** 'photo' shows the picture; 'art' the default illustration. */
  mode: 'photo' | 'art'
  /** The 42 days after a pregnancy ended (QUIET_DAYS_AFTER_END): no tilt, tape, heart or D+. */
  quiet: boolean
  /**
   * Quiet days hide a photo hung between the (ended) pregnancy's confirmation
   * and the day it ended, until this person decides (hideCover false / true).
   */
  autoHidden: boolean
  /** This person chose the default art (hideCover true). */
  hidden: boolean
  /** 함께한 지 N일 (the met day is day 1); null without a met day or on quiet days. */
  together: number | null
  /** Tape, back sheet, tilt and the ♥ — off on quiet days. */
  decorate: boolean
}

/**
 * Was this cover hung while the (now ended) pregnancy was confirmed — from the
 * clinic's confirmation to the day it ended, inclusive? A photo chosen after
 * the loss (on a later day) is that person's choice for now and is never
 * hidden for them automatically.
 */
function hungDuringEndedPregnancy(cover: CoverPhoto, pregnancy: AppState['pregnancy']): boolean {
  const confirmedAt = pregnancy?.confirmedAt
  const endedAt = pregnancy?.endedAt
  if (!isISODate(confirmedAt) || !isISODate(endedAt)) return false
  return cover.setAt >= confirmedAt && cover.setAt <= endedAt
}

export function coverView(state: AppState, viewer: MemberId, today: ISODate): CoverView {
  const cover = state.couple.cover
  const quiet = recentlyEnded(state, today)
  const pref = state.settings.personal?.[viewer]?.hideCover
  const hidden = pref === true
  const autoHidden = !!cover && quiet && pref === undefined && hungDuringEndedPregnancy(cover, state.pregnancy)
  const met = state.couple.metDate
  return {
    ...(cover
      ? { photo: { photoId: cover.photoId, focusY: cover.focusY, ...(cover.caption ? { caption: cover.caption } : {}) } }
      : {}),
    mode: cover && !hidden && !autoHidden ? 'photo' : 'art',
    quiet,
    autoHidden,
    hidden,
    together: !quiet && isISODate(met) && met <= today ? daysSince(met, today) : null,
    decorate: !quiet,
  }
}

// ── 'N년 전 오늘' (Next B) ───────────────────────────────────

/** How far back a memory reaches: an entry from exactly 1, 2 or 3 years ago today. */
export const MEMORY_YEARS = { min: 1, max: 3 } as const

/** Period days 1–3 — the 수고했어요 days (ttcFlow.PERIOD_EARLY_DAYS; pinned by a test). */
const PERIOD_QUIET_DAYS = 3

export interface Memory {
  entryId: string
  date: ISODate
  /** 1, 2 or 3. */
  years: number
}

/** Day 1–3 of a logged period. */
function onPeriodStart(periods: readonly PeriodLog[], date: ISODate): boolean {
  return periods.some((p) => date >= p.start && date <= addDays(p.start, PERIOD_QUIET_DAYS - 1))
}

/**
 * A home test on that day that did not lead anywhere: a negative or faint
 * one, or a positive outside a pregnancy that went on (it was settled by a
 * period, or the pregnancy ended — insideEndedPregnancy covers the latter's
 * days too). A positive inside the pregnancy that is still going on, or that
 * ended with a birth, is left alone — 그날의 두 줄 is a happy memory.
 */
function sadTestOn(state: Pick<AppState, 'pregnancyTests' | 'pregnancy'>, date: ISODate): boolean {
  const p = state.pregnancy
  const carried = !!p && !p.endedAt && date >= p.lmp
  return !!state.pregnancyTests?.some((t) => t.date === date && (t.result !== 'positive' || !carried))
}

/** A clinic day: a visit, test, shot, injection or medication appointment on that day (신청·행정 and 기타 are not). */
const CLINIC_APPOINTMENT_KINDS: ReadonlySet<Appointment['kind']> = new Set(['hospital', 'test', 'vaccine', 'injection', 'medication'])

function clinicDayOn(appointments: readonly Appointment[] | undefined, date: ISODate): boolean {
  return !!appointments?.some((a) => a.date === date && CLINIC_APPOINTMENT_KINDS.has(a.kind))
}

/**
 * Inside the ended pregnancy — from its last period's first day to the day it
 * ended — or in the 42 quiet days after it (QUIET_DAYS_AFTER_END).
 */
function insideEndedPregnancy(p: Pregnancy | undefined, date: ISODate): boolean {
  if (!p?.endedAt || !(p.endedAt > p.confirmedAt)) return false
  return date >= p.lmp && date <= addDays(p.endedAt, QUIET_DAYS_AFTER_END - 1)
}

/**
 * The entry behind '1년 전 오늘의 이야기': a diary entry the two wrote for each
 * other, dated exactly 1–3 years ago today (the most recent year first). Off
 * unless the couple turned 'N년 전 오늘' on (settings.memories; unset = off, as
 * lib/initial.ts SETTINGS_DEFAULTS has it — read inline, see the import note).
 * Hard filters, so nothing painful or private resurfaces (설정 › 첫 화면
 * promises exactly these): no '나만 보기' entry at all — not even the viewer's
 * own, it is not a shared memory (`viewer` is kept for a later per-person
 * rule); no entry written while pregnant; none dated inside an ended pregnancy
 * or its 42 quiet days; none from period days 1–3, a home test's day that led
 * nowhere (sadTestOn) or a clinic day (clinicDayOn); none with a health word
 * (COVER_WORDS). And no memory at all on a quiet day, a period day 1–3 or the
 * day of such a test.
 */
export function memoryFor(
  state: Pick<AppState, 'stage' | 'settings' | 'diary' | 'periods' | 'pregnancyTests' | 'pregnancy'> & Partial<Pick<AppState, 'appointments'>>,
  today: ISODate,
  viewer: MemberId,
): Memory | undefined {
  void viewer
  if (state.settings.memories !== true) return undefined
  if (!isISODate(today) || recentlyEnded(state, today)) return undefined
  if (onPeriodStart(state.periods, today) || sadTestOn(state, today)) return undefined
  const monthDay = today.slice(5)
  const year = Number(today.slice(0, 4))
  let best: (Memory & { createdAt: string }) | undefined
  for (const e of state.diary) {
    if (!isISODate(e.date) || e.date.slice(5) !== monthDay) continue
    const years = year - Number(e.date.slice(0, 4))
    if (years < MEMORY_YEARS.min || years > MEMORY_YEARS.max) continue
    if (e.privateTo !== undefined) continue
    if (e.stage === 'pregnant') continue
    if (insideEndedPregnancy(state.pregnancy, e.date)) continue
    if (onPeriodStart(state.periods, e.date) || sadTestOn(state, e.date) || clinicDayOn(state.appointments, e.date)) continue
    if (COVER_WORDS.test(e.text)) continue
    // The nearest year; within it, the day's first entry.
    if (!best || years < best.years || (years === best.years && e.createdAt < best.createdAt)) {
      best = { entryId: e.id, date: e.date, years, createdAt: e.createdAt }
    }
  }
  return best ? { entryId: best.entryId, date: best.date, years: best.years } : undefined
}

/** '1년 전 오늘의 이야기 ›' */
export function memoryLineText(memory: Pick<Memory, 'years'>): string {
  return `${memory.years}년 전 오늘의 이야기 ›`
}

// ── The line above the photo ────────────────────────────────

export interface HeroLine {
  kind: 'signal' | 'done' | 'cheer' | 'memory' | 'anniversary' | 'greeting'
  text: string
  /** Whose avatar goes in front of the line (the partner's, for things they did). */
  avatar?: MemberId
  /** Where tapping the line goes: 우리 한 줄 on this screen, or the 우리 tab. */
  target?: 'us' | 'diary'
  /** kind 'memory': the entry the line points at. */
  memory?: Memory
}

/** Days ahead an anniversary is mentioned on the cover. */
export const HERO_ANNIVERSARY_DAYS = 7

/** Digits read aloud without a final consonant: 이(2) 사(4) 오(5) 구(9). */
const VOWEL_DIGITS = '2459'

/** '이에요' after a final consonant, '예요' after a vowel (프러포즈예요 · 1,100일이에요 · 여행 2예요). */
export function copula(word: string): string {
  const last = word.trimEnd().slice(-1)
  if (last >= '0' && last <= '9') return VOWEL_DIGITS.includes(last) ? '예요' : '이에요'
  const code = last.charCodeAt(0) - 0xac00
  if (!(code >= 0 && code <= 11171)) return '이에요'
  return code % 28 === 0 ? '예요' : '이에요'
}

/**
 * One line over the cover. First match wins:
 *  1. a signal from the partner waiting for an answer — always generic (the
 *     message itself stays in 우리 한 줄, never on the first line);
 *  2. the partner finished today's checks — the 'complete:' notice, and the
 *     day still complete (not on quiet days);
 *  3. the partner sent a cheer today;
 *  4. 'N년 전 오늘' (settings.memories, off by default): a diary entry from
 *     exactly 1–3 years ago today that passes memoryFor's filters (not on
 *     quiet days);
 *  5. an anniversary within 7 days whose title has no health words (not on
 *     quiet days, and not when the couple turned 기념일 알림 off —
 *     settings.anniversaryAlerts, unset = on; 💍 is the only emoji, never 🎉);
 *  6. the greeting.
 * No cycle, test or pregnancy words ever — whoever looks at the phone.
 */
export function heroLine(state: AppState, today: ISODate, viewer: MemberId, hour: number): HeroLine {
  const me = state.couple.members.find((m) => m.id === viewer)
  const partner = state.couple.members.find((m) => m.id !== viewer)
  const p = partner?.name ?? ''
  const partnerId: MemberId = partner?.id ?? (viewer === 'a' ? 'b' : 'a')
  const quiet = recentlyEnded(state, today)

  if (pendingSignal(state, viewer, today)) {
    return { kind: 'signal', text: `${p}님이 신호를 보냈어요`, avatar: partnerId, target: 'us' }
  }

  // The notice is sent once; the line is live, so it also checks the day is
  // still complete (an unchecked item takes it back, like 우리 한 줄's count).
  const doneKey = `complete:${partnerId}:${today}`
  if (
    !quiet &&
    state.notifications.some((n) => n.key === doneKey && n.to === viewer) &&
    rowProgress(state, partnerId, today).complete
  ) {
    return { kind: 'done', text: `${p}님이 오늘 할 일을 다 마쳤어요`, avatar: partnerId, target: 'us' }
  }

  const cheered = state.notifications.some(
    (n) =>
      n.kind === 'cheer' &&
      n.from === partnerId &&
      n.to === viewer &&
      typeof n.createdAt === 'string' &&
      n.createdAt.startsWith(today) &&
      !isSignal(n) &&
      !n.key?.startsWith('complete:'),
  )
  if (cheered) return { kind: 'cheer', text: `${p}님이 응원을 보냈어요`, avatar: partnerId, target: 'us' }

  if (!quiet) {
    const memory = memoryFor(state, today, viewer)
    if (memory) return { kind: 'memory', text: memoryLineText(memory), target: 'diary', memory }
  }

  // 기념일 알림 off (settings.anniversaryAlerts === false) silences the cover line
  // too; the 우리 tab still lists the days.
  if (!quiet && state.settings.anniversaryAlerts !== false) {
    // Every day in the next week (not just the next few events), so a skipped
    // title never hides an allowed one behind it.
    const week = anniversariesBetween(state.couple, state.anniversaries, today, addDays(today, HERO_ANNIVERSARY_DAYS))
    for (const ev of week) {
      const n = diffDays(today, ev.date)
      if (n < 0 || n > HERO_ANNIVERSARY_DAYS) continue
      if (COVER_WORDS.test(ev.title)) continue
      return {
        kind: 'anniversary',
        text: n === 0 ? `오늘은 ${ev.title}${copula(ev.title)}` : `💍 ${ev.title}까지 D-${n}`,
        target: 'diary',
      }
    }
  }

  return { kind: 'greeting', text: `${me?.name ?? ''}님, ${greetingFor(hour)}` }
}
