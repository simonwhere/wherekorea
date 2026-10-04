// 우리 tab — Between-style record book view helpers (pure).
//
// The story is one book in chapters: 우리 둘 (before preparing) → 준비 → 임신
// → 육아. A chapter is read from the entry's date against the day the
// prep/pregnancy story began, so a backdated memory from dating days lands in
// 우리 둘 whatever stage it was written in. Counters follow the Korean
// convention used across the app (the first day is day 1).

import { FERTILITY_CHECK_GUIDE } from '../content/programs'
import { addDays, addMonths, diffDays, formatKo, isISODate, todayISO } from '../dates'
import type { AppNotification, AppState, Baby, CustomAnniversary, DiaryEntry, ISODate, MemberId, Pregnancy, Stage } from '../types'
import { anniversariesBetween, daysSince, type AnniversaryEvent } from './anniversary'
import { dayOfLife } from './baby'
import { DIARY_NAME, groupByMonth, removeEntry } from './diary'
import { ALBUM_CAPTION_MAX, STAGE_SHORT, entryStageLabel, excerpt } from './diaryExport'
import { inbox, mergeNotices, ttcClockStart } from './notifications'
import { fertilityChain, testIdFor } from './partnerTrack'
import { canSeeEntry, visibleEntries } from './personalLog'
import { stepAppointment } from './plan'
import { PREGNANCY_DAYS, gestationalAge, recentlyEnded } from './pregnancy'
import { canLogCycle, lowPressureFor } from './prefs'
import { homeDiscreetFor } from './settings'
import { fertilityVoice, isSpermSide } from './today'

const fmt = (n: number) => n.toLocaleString('ko-KR')

// ── Chapters ────────────────────────────────────────────────

export type Chapter = 'couple' | Stage

export const CHAPTER_ORDER: readonly Chapter[] = ['couple', 'preparing', 'pregnant', 'parenting']

export const CHAPTER_SHORT: Record<Chapter, string> = { couple: '우리 둘', ...STAGE_SHORT }

export interface ChapterContext {
  /** First day of the prep/pregnancy story. Entries dated before it are 우리 둘. */
  prepStart?: ISODate
  pregnancy?: Pregnancy
  baby?: Baby
}

/**
 * When the prep/pregnancy story began: the earliest of 함께 준비 시작
 * (settings.ttcStart) and the pregnancy's LMP (a couple who joined already
 * pregnant has a ttcStart of the joining day). Without a pregnancy record, a
 * baby's birth − 280 days stands in for the LMP. With none of these, the day
 * the couple space was created.
 */
export function prepStartOf(state: Pick<AppState, 'settings' | 'pregnancy' | 'baby' | 'createdAt'>): ISODate | undefined {
  const found: ISODate[] = []
  if (isISODate(state.settings.ttcStart)) found.push(state.settings.ttcStart)
  if (state.pregnancy && isISODate(state.pregnancy.lmp)) found.push(state.pregnancy.lmp)
  else if (state.baby && isISODate(state.baby.birthDate)) found.push(addDays(state.baby.birthDate, -PREGNANCY_DAYS))
  if (!found.length) {
    const day = createdDay(state.createdAt)
    if (day) found.push(day)
  }
  return found.sort()[0]
}

/**
 * Local calendar day of a stored timestamp. App timestamps carry a local
 * offset (localNowISO), so their date prefix is the local day; a UTC 'Z'
 * stamp (older data) is converted first.
 */
function createdDay(stamp: unknown): ISODate | undefined {
  if (typeof stamp !== 'string') return undefined
  if (/Z$/i.test(stamp)) {
    const d = new Date(stamp)
    return Number.isNaN(d.getTime()) ? undefined : todayISO(d)
  }
  const day = stamp.slice(0, 10)
  return isISODate(day) ? day : undefined
}

export function chapterContext(state: Pick<AppState, 'settings' | 'pregnancy' | 'baby' | 'createdAt'>): ChapterContext {
  return { prepStart: prepStartOf(state), pregnancy: state.pregnancy, baby: state.baby }
}

export function entryChapter(entry: Pick<DiaryEntry, 'stage' | 'date'>, ctx: ChapterContext): Chapter {
  if (ctx.prepStart && entry.date < ctx.prepStart) return 'couple'
  return entry.stage
}

/** '우리 둘', or the usual badge ('준비', '임신 12주', '34일째' …). */
export function chapterLabel(entry: Pick<DiaryEntry, 'stage' | 'date'>, ctx: ChapterContext): string {
  return entryChapter(entry, ctx) === 'couple' ? CHAPTER_SHORT.couple : entryStageLabel(entry, ctx)
}

/** Chapters that have at least one entry, in life order. */
export function chaptersWithEntries(entries: DiaryEntry[], ctx: ChapterContext): Chapter[] {
  const present = new Set(entries.map((e) => entryChapter(e, ctx)))
  return CHAPTER_ORDER.filter((c) => present.has(c))
}

export interface StoryFilter {
  chapter: Chapter | 'all'
  author: MemberId | 'all'
  /**
   * Who is reading: the other member's '나만 보기' entries (DiaryEntry.privateTo,
   * lib/logic/personalLog.ts) are left out. Every screen that lists the story
   * passes it; without it nothing is hidden (a backup summary, a count).
   */
  viewer?: MemberId
}

export function filterStory(entries: DiaryEntry[], ctx: ChapterContext, f: StoryFilter): DiaryEntry[] {
  return entries.filter(
    (e) =>
      (f.viewer === undefined || canSeeEntry(e, f.viewer)) &&
      (f.chapter === 'all' || entryChapter(e, ctx) === f.chapter) &&
      (f.author === 'all' || e.author === f.author),
  )
}

/** Composer heading for an entry on `date`: 우리 둘 기록 / 우리의 기록 / 태교일기 / 육아일기. */
export function composerTitle(stage: Stage, date: ISODate, ctx: ChapterContext): string {
  return entryChapter({ stage, date }, ctx) === 'couple' ? '우리 둘 기록' : DIARY_NAME[stage]
}

// ── Reactions (Between-style: a small feeling, no comment thread) ──

export const REACTIONS: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: '❤️', label: '좋아요' },
  { emoji: '🥹', label: '뭉클해요' },
  { emoji: '👏', label: '멋져요' },
  { emoji: '😂', label: '웃겨요' },
]

export function reactionLabel(emoji: string | undefined): string | undefined {
  return emoji ? REACTIONS.find((r) => r.emoji === emoji)?.label : undefined
}

const isMember = (v: unknown): v is MemberId => v === 'a' || v === 'b'

/** A member's reaction on an entry, if it's one we know (stored data is read defensively). */
export function reactionOf(entry: Pick<DiaryEntry, 'reactions'>, member: MemberId): string | undefined {
  const r = entry.reactions
  if (!r || typeof r !== 'object') return undefined
  const v = (r as Record<string, unknown>)[member]
  return typeof v === 'string' && reactionLabel(v) ? v : undefined
}

/** Reactions from anyone but the author, a → b. */
export function receivedReactions(entry: Pick<DiaryEntry, 'author' | 'reactions'>): Array<{ member: MemberId; emoji: string }> {
  const out: Array<{ member: MemberId; emoji: string }> = []
  for (const member of ['a', 'b'] as const) {
    if (member === entry.author) continue
    const emoji = reactionOf(entry, member)
    if (emoji) out.push({ member, emoji })
  }
  return out
}

/**
 * Set (or clear with null) `from`'s reaction on someone else's entry.
 * Idempotent, so re-applying it on a newer state (two-tab sync) is safe.
 * Authors can't react to their own entries.
 */
export function setReaction(state: AppState, entryId: string, from: MemberId, emoji: string | null): AppState {
  if (!isMember(from)) return state
  if (emoji !== null && !reactionLabel(emoji)) return state
  let changed = false
  const diary = state.diary.map((e) => {
    if (e.id !== entryId || e.author === from) return e
    if ((reactionOf(e, from) ?? null) === emoji) return e
    changed = true
    const next: Partial<Record<MemberId, string>> = {}
    for (const m of ['a', 'b'] as const) {
      const v = m === from ? emoji : reactionOf(e, m)
      if (v) next[m] = v
    }
    const out: DiaryEntry = { ...e }
    if (Object.keys(next).length) out.reactions = next
    else delete out.reactions
    return out
  })
  return changed ? { ...state, diary } : state
}

/** Same emoji again clears it; another emoji replaces it. */
export function toggleReaction(state: AppState, entryId: string, from: MemberId, emoji: string): AppState {
  const entry = state.diary.find((e) => e.id === entryId)
  if (!entry) return state
  return setReaction(state, entryId, from, reactionOf(entry, from) === emoji ? null : emoji)
}

export function reactionNoticeKey(entryId: string, from: MemberId): string {
  return `reaction:${entryId}:${from}`
}

// ── Where a note goes: the 🔔 or the 기록장 (N27) ──────────────

/** Key prefix of the '내 기록에 마음을 남겼어요' notes. */
export const REACTION_NOTICE_PREFIX = 'reaction:'

/**
 * While preparing, the record book's own news — a reaction on one of my
 * entries — stays inside the 기록장 (우리 탭), not in the 🔔 or the badge
 * (N27: the bell is for what the two of us are doing now). Other stages keep
 * it in the bell as before. The note itself is the same keyed notice either
 * way, so dedup, 되돌리기 and removeStoryEntry keep working.
 */
export function isRecordBookNotice(n: Pick<AppNotification, 'key'>, stage: Stage): boolean {
  return stage === 'preparing' && typeof n.key === 'string' && n.key.startsWith(REACTION_NOTICE_PREFIX)
}

/** The 🔔 list for `member`: their inbox without the record book's notes (isRecordBookNotice). */
export function bellInbox(state: AppState, member: MemberId): AppNotification[] {
  return inbox(state, member).filter((n) => !isRecordBookNotice(n, state.stage))
}

/** The 🔔 badge: unread notes in bellInbox. */
export function bellUnread(state: AppState, member: MemberId): number {
  return bellInbox(state, member).filter((n) => !n.read).length
}

/**
 * The 🔔 '비우기': clearNotifications for what the bell shows only — the
 * record book's notes (isRecordBookNotice) stay as they are, so its unread
 * '새로 받은 마음' still wait in the 기록장. Keyed notices stay (dismissed) so
 * their key isn't delivered again; unkeyed ones go. Nothing to clear → the
 * same state object.
 */
export function clearBell(state: AppState, member: MemberId): AppState {
  const inBell = (n: AppNotification) => n.to === member && !isRecordBookNotice(n, state.stage)
  if (!state.notifications.some((n) => inBell(n) && (!n.key || !n.dismissed || !n.read))) return state
  return {
    ...state,
    notifications: state.notifications.filter((n) => !inBell(n) || n.key).map((n) => (inBell(n) ? { ...n, read: true, dismissed: true } : n)),
  }
}

/**
 * The record book's own notes for `member` that they haven't seen — the
 * reactions on their entries, newest first. Empty outside the preparing stage
 * (the bell carries them there) and for anything already read or cleared.
 */
export function recordBookNotes(state: AppState, member: MemberId): AppNotification[] {
  return inbox(state, member).filter((n) => !n.read && isRecordBookNotice(n, state.stage))
}

/** Mark `member`'s record-book notes read (the 기록장 showed them). The same state when there is nothing to mark. */
export function markRecordBookNotesRead(state: AppState, member: MemberId): AppState {
  if (!recordBookNotes(state, member).length) return state
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.to === member && !n.read && !n.dismissed && isRecordBookNotice(n, state.stage) ? { ...n, read: true } : n,
    ),
  }
}

/**
 * setReaction + a quiet note to the author the first time (keyed, so
 * changing the emoji never sends another). Clearing a reaction the author
 * hasn't seen yet takes the note back. While preparing the note shows in the
 * 기록장, not the 🔔 (isRecordBookNotice).
 */
export function reactToEntry(
  state: AppState,
  entryId: string,
  from: MemberId,
  emoji: string | null,
  nowISO: string,
): AppState {
  const next = setReaction(state, entryId, from, emoji)
  if (next === state) return state
  const entry = next.diary.find((e) => e.id === entryId)
  if (!entry) return next
  const key = reactionNoticeKey(entryId, from)
  if (emoji === null) {
    const notifications = next.notifications.filter((n) => !(n.key === key && !n.read && !n.dismissed))
    return notifications.length === next.notifications.length ? next : { ...next, notifications }
  }
  const name = next.couple.members.find((m) => m.id === from)?.name ?? ''
  return mergeNotices(
    next,
    [
      {
        key,
        to: entry.author,
        from,
        kind: 'system',
        title: `${emoji} ${name}님이 내 기록에 마음을 남겼어요`,
        body: `${formatKo(entry.date)} 기록 · 우리 탭 이야기에서 볼 수 있어요`,
      },
    ],
    nowISO,
  ).state
}

/**
 * Delete a story entry together with the reaction notes about it (they would
 * point at a record that no longer exists).
 */
export function removeStoryEntry(state: AppState, entryId: string): AppState {
  const prefix = `reaction:${entryId}:`
  const hasNotes = state.notifications.some((n) => n.key?.startsWith(prefix))
  if (!hasNotes && !state.diary.some((e) => e.id === entryId)) return state
  const next = removeEntry(state, entryId)
  const notifications = next.notifications.filter((n) => !(n.key && n.key.startsWith(prefix)))
  return notifications.length === next.notifications.length ? next : { ...next, notifications }
}

// ── "우리의 날들" chain ─────────────────────────────────────

export type ChainKey = 'met' | 'married' | 'ttc' | 'pregnant' | 'baby'

export interface ChainLink {
  key: ChainKey
  emoji: string
  text: string
}

/** Whole years from `start` to `today` (주년 falls on the same date; 2/29 → 2/28). */
export function completedYears(start: ISODate, today: ISODate): number {
  let n = Math.max(0, Number(today.slice(0, 4)) - Number(start.slice(0, 4)))
  while (n > 0 && addMonths(start, 12 * n) > today) n--
  return n
}

/**
 * 만난 지 N일 → 결혼 N년 → 함께 준비한 지 D+N → 임신 N주 → 태어난 지 N일째,
 * only the links that apply. Earlier counters stay as the story moves on; the
 * prep counter belongs to the preparing stage, counts like the rest of the app
 * (restarting after an ended pregnancy), and steps aside in low-pressure mode
 * and in the quiet weeks after a pregnancy ended.
 */
export function ourDaysChain(
  state: Pick<AppState, 'couple' | 'settings' | 'stage' | 'pregnancy' | 'baby'>,
  today: ISODate,
  viewer: MemberId = 'a',
): ChainLink[] {
  const out: ChainLink[] = []
  const { metDate, marriedDate } = state.couple
  if (isISODate(metDate) && metDate <= today) {
    out.push({ key: 'met', emoji: '💞', text: `만난 지 ${fmt(daysSince(metDate, today))}일` })
  }
  if (isISODate(marriedDate) && marriedDate <= today) {
    const years = completedYears(marriedDate, today)
    out.push({
      key: 'married',
      emoji: '💍',
      text: years >= 1 ? `결혼 ${years}년` : `결혼한 지 ${fmt(daysSince(marriedDate, today))}일`,
    })
  }
  // Same clock as the home screen's "함께 준비한 지 N개월": from ttcStart, or
  // from the day a pregnancy ended if that is later (notifications.ttcClockStart).
  const ttc = ttcClockStart(state)
  if (
    state.stage === 'preparing' &&
    isISODate(ttc) &&
    ttc <= today &&
    !lowPressureFor(state.settings, viewer) &&
    !recentlyEnded(state, today)
  ) {
    out.push({ key: 'ttc', emoji: '🌱', text: `함께 준비한 지 D+${fmt(daysSince(ttc, today))}` })
  }
  const p = state.pregnancy
  if (state.stage === 'pregnant' && p && !p.endedAt) {
    const ga = gestationalAge(p, today)
    if (ga.totalDays >= 0) out.push({ key: 'pregnant', emoji: '🤰', text: `임신 ${ga.weeks}주` })
  }
  const birth = state.baby?.birthDate
  if (isISODate(birth) && birth <= today) {
    out.push({ key: 'baby', emoji: '👶', text: `태어난 지 ${fmt(dayOfLife(birth, today))}일째` })
  }
  return out
}

/**
 * "결혼한 지 708일 · 2024년 10월 19일" — counted in days like 함께한 지, so it
 * never reads against the upcoming "결혼 2주년" shown right below it.
 */
export function marriedLine(marriedDate: ISODate, today: ISODate): string {
  const day = formatKo(marriedDate, { year: true, weekday: false })
  if (marriedDate > today) return `결혼 예정 · ${day}`
  return `결혼한 지 ${fmt(daysSince(marriedDate, today))}일 · ${day}`
}

// ── Anniversaries ───────────────────────────────────────────

export const ANNIVERSARY_WINDOW_DAYS = 400

/** Upcoming (today … +400일, soonest first) and this year's past ones (latest first). */
export function anniversaryLists(
  couple: Pick<AppState['couple'], 'metDate' | 'marriedDate'>,
  custom: CustomAnniversary[],
  today: ISODate,
): { upcoming: AnniversaryEvent[]; pastThisYear: AnniversaryEvent[] } {
  const upcoming = anniversariesBetween(couple, custom, today, addDays(today, ANNIVERSARY_WINDOW_DAYS))
  const yearStart = `${today.slice(0, 4)}-01-01`
  const pastThisYear =
    today > yearStart ? anniversariesBetween(couple, custom, yearStart, addDays(today, -1)).reverse() : []
  return { upcoming, pastThisYear }
}

/**
 * The next occurrence of one custom day (undefined for a one-off day that has
 * passed). A day still ahead is its own next occurrence, however far off —
 * a plan two years out is not "지난 날".
 */
export function nextCustomOccurrence(c: CustomAnniversary, today: ISODate): AnniversaryEvent | undefined {
  if (!isISODate(c.date)) return undefined
  if (c.date >= today) {
    return { key: `custom:${c.id}:0`, title: c.title, date: c.date, kind: 'custom', emoji: anniversaryEmoji(c) }
  }
  if (!c.yearly) return undefined
  return anniversariesBetween({}, [c], today, addDays(today, ANNIVERSARY_WINDOW_DAYS))[0]
}

export const ANNIVERSARY_EMOJIS: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: '⭐', label: '별' },
  { emoji: '💍', label: '반지' },
  { emoji: '✈️', label: '여행' },
  { emoji: '🎂', label: '케이크' },
  { emoji: '🏠', label: '집' },
  { emoji: '🌸', label: '꽃' },
  { emoji: '🐾', label: '반려동물' },
  { emoji: '🎉', label: '축하' },
]

export const ANNIVERSARY_TITLE_MAX = 30

/** Stored emoji, read defensively (older or hand-edited data). */
export function anniversaryEmoji(c: Pick<CustomAnniversary, 'emoji'>): string {
  return typeof c.emoji === 'string' && c.emoji.length > 0 && c.emoji.length <= 8 ? c.emoji : '⭐'
}

export type DateCheck = 'empty' | 'invalid' | 'future' | 'ok'

/** For 만난 날 / 결혼한 날: must be a real date, not after today. */
export function checkPastDate(value: string, today: ISODate): DateCheck {
  if (!value) return 'empty'
  if (!isISODate(value) || value < '1900-01-01') return 'invalid'
  return value > today ? 'future' : 'ok'
}

/** For a custom day (may be ahead, e.g. a planned 프러포즈). */
export function checkAnyDate(value: string): DateCheck {
  if (!value) return 'empty'
  return isISODate(value) && value >= '1900-01-01' && value <= '2100-12-31' ? 'ok' : 'invalid'
}

// ── Album ───────────────────────────────────────────────────

/** Entries with a photo, newest first, by month — for `viewer`, without the other member's '나만 보기' entries. */
export function albumGroups(entries: DiaryEntry[], viewer?: MemberId): Array<{ month: string; entries: DiaryEntry[] }> {
  const mine = viewer === undefined ? entries : visibleEntries(entries, viewer)
  return groupByMonth(mine.filter((e) => typeof e.photoId === 'string' && e.photoId.length > 0))
}

// The caption length and the cut live with the export (lib/logic/diaryExport.ts),
// which renders the same album as its last chapter; re-exported for the feed's callers.
export { ALBUM_CAPTION_MAX, excerpt }

/** One card of the 앨범 feed (우리 › 앨범): a photo, its day and a bit of the story. */
export interface AlbumItem {
  entry: DiaryEntry
  /** 'YYYY-MM' — the feed puts a small month line where it changes. */
  month: string
  /** The first line(s) of the story, cut to ALBUM_CAPTION_MAX; '' for a photo without words. */
  caption: string
}

/**
 * The 앨범 feed: every photo `viewer` may see, newest first (same day: the
 * later one first), flat — one card per photo. Built from the diary only:
 * nothing from the cycle, the health records or the stage ever goes in here,
 * and the other member's '나만 보기' entries stay out (albumGroups).
 */
export function albumFeed(entries: DiaryEntry[], viewer?: MemberId): AlbumItem[] {
  return albumGroups(entries, viewer).flatMap((g) =>
    g.entries.map((entry) => ({ entry, month: g.month, caption: excerpt(entry.text, ALBUM_CAPTION_MAX) })),
  )
}

// ── His month task, one line on her home (N28) ─────────────

/** A finished step (검사 받았어요 · 청구까지) stays on her home this many days, then the line rests. */
export const PARTNER_PROGRESS_KEEP_DAYS = 30

export interface PartnerProgressLine {
  /** Whose progress it is (the person who does not track the cycle). */
  member: MemberId
  /** '민수님 · 정액검사 예약했어요' — the stage only: no date, place, result or deadline. */
  text: string
}

/**
 * One line on the cycle owner's preparing home about the partner's 이번 달 할
 * 일 (the 가임력 검사 chain, partnerTrack.fertilityChain): the last step he
 * took — 지원 신청했어요 → 예약했어요 → 받았어요 → 검사비 청구까지 마쳤어요.
 * Nothing before his first step (never a zero, never '아직'), nothing for his
 * own phone (his card is the task itself), nothing in the 42 quiet days after
 * a loss, and a finished or long-lapsed chain rests after
 * PARTNER_PROGRESS_KEEP_DAYS. Only his own records feed it (his ticks and the
 * test appointment linked to his row), so it tells her nothing new about
 * anyone's health. The check's name follows her voice: 가임력 only for an
 * explicit voice, and just '검사' when her home cards are discreet.
 */
export function partnerProgressLine(state: AppState, today: ISODate, viewer: MemberId): PartnerProgressLine | undefined {
  if (state.stage !== 'preparing' || !canLogCycle(state, viewer)) return undefined
  if (recentlyEnded(state, today)) return undefined
  const partner = state.couple.members.find((m) => m.id !== viewer)
  if (!partner) return undefined
  const chain = fertilityChain(state, today, partner.id)
  const recent = (at: ISODate | undefined): boolean => !!at && at <= today && diffDays(at, today) < PARTNER_PROGRESS_KEEP_DAYS
  // A step whose deadline passed long ago is no longer this month's news (monthlyTask lets it go the same way).
  const stale = (due: ISODate | undefined): boolean => chain.lapsed && !!due && diffDays(due, today) >= PARTNER_PROGRESS_KEEP_DAYS

  const discreet = homeDiscreetFor(state.settings, viewer)
  const explicit = fertilityVoice(state.settings, viewer, true) === 'explicit'
  const checkName = discreet ? '검사' : explicit ? '가임력 검사' : '임신 전 검사'
  const testName = discreet ? '검사' : isSpermSide(partner) ? FERTILITY_CHECK_GUIDE.test.partner.what : checkName

  let step: string | undefined
  if (chain.step === 'test') {
    if (stale(chain.testBy)) return undefined
    const booked = stepAppointment(state.appointments, testIdFor(state, partner.id), today)
    step = booked ? `${testName} 예약했어요` : `${checkName} 지원 신청했어요`
  } else if (chain.step === 'claim') {
    if (stale(chain.claimBy)) return undefined
    step = `${testName} 받았어요`
  } else if (chain.step === 'done') {
    if (chain.claimedAt) step = recent(chain.claimedAt) ? '검사비 청구까지 마쳤어요' : undefined
    else if (recent(chain.testedAt)) step = `${testName} 받았어요`
  }
  return step ? { member: partner.id, text: `${partner.name}님 · ${step}` } : undefined
}
