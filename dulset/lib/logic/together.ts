// 같이 챙길 것 — what she looks after, on his screens too (pure).
//
// Founder request (2026-10-09): "여자가 챙겨야 할 것들을 남자에게도 계속
// 보여줘야해 같이 하는거야." In every stage, the roadmap items that are hers
// (the 'carrier' ones: tests, checkups, vaccines, vouchers, admin, work
// programs) keep showing on the 함께하는 사람's app home, 챙길 것 and link —
// each with what HE can do to share it (lib/content roadmap `support`). This
// module is the one view model those three surfaces read:
//
//  • togetherItems(state, today, viewer) — the viewer's near-term view of the
//    shared plan: their own and the shared items with the plan's own status,
//    the other person's items with a NEUTRAL status only ('예정 · 10월 21일',
//    '이번 주', '했어요 ✓'). Her item on his screen never reads '기한 지남',
//    never warns and never says '안 했어요': a deadline that passed or a window
//    that lapsed simply leaves his list (no surveillance, no pressure on her).
//    Her own screen keeps the plan's normal statuses for her items.
//  • [같이 할게요] — supportItem / unsupportItem keep his answer in `decisions`
//    ('support:<itemId>:<member>' → the day, lib/sync/model decide — an answer,
//    not a record), so it travels like every other answer and the link sends it
//    as a 'support' event (lib/logic/partnerEvents). Her screen reads it as
//    '민수님이 같이 챙긴대요' on the item (togetherRow.supportedBy) and in 우리 한 줄
//    (partnerSupportLines, at most two lines). He can take it back.
//  • linkTogether(state, today, partnerId) — exactly what the link may carry:
//    roadmap items only (no free-text titles of their own items), ids · the
//    catalogue title · a neutral status · his support line, and in the
//    pregnant / parenting stages the DAY of a booked appointment — never its
//    time, place, title or note. While preparing her bookings stay in the app.
//
// What it reads: 챙길 것's own model (plan.planItems — ticks, windows from the
// due date, the couple's own items), the appointments linked to an item, and
// `decisions`. Nothing from her cycle, no test result, no personalLog, no
// '나만 보기' — so the view never moves with anything she logs privately.
// Pregnancy weeks / the due date are known to both once the stage is pregnant
// (she switched it), which is all the windows need.
//
// Quiet: during the 42 days after a pregnancy ended (and the 'loss' rest) all
// of it rests — no list, no [같이 할게요], no 우리 한 줄 line
// (weekTogether.weekQuiet). Parenting keeps its screens; the same support lines
// simply appear on her postpartum items.

import { ROADMAP, planKey } from '../content/roadmap'
import { addDays, diffDays, formatKo, isISODate } from '../dates'
import { decide, isLive, undecide } from '../sync/model'
import type { AppState, ISODate, MemberId, RoadmapPhase } from '../types'
import { mondayOf } from './checks'
import { linkedAppointment, planItems, tickSince, type PlanItem } from './plan'
import { STAGE_PHASES, ownersOf, type ItemStatus, type RoadmapKind } from './roadmap'
import { weekQuiet } from './weekTogether'

// ── Words ───────────────────────────────────────────────────

/** The support line on one of HER own items (직접 추가) — the titles are hers, so the line stays general. */
export const CUSTOM_SUPPORT = '도울 게 있는지 물어보기'

/** A neutral status: what her item looks like on his screen. Never 'overdue'. */
export type NeutralStatus = 'upcoming' | 'this-week' | 'done'

export const NEUTRAL_DONE_LABEL = '했어요 ✓'
export const NEUTRAL_THIS_WEEK_LABEL = '이번 주'
export const NEUTRAL_UPCOMING_LABEL = '예정'

/** Whose item it is, from the viewer's side: only theirs ('mine'), only the other's ('theirs'), or both ('ours'). */
export type TogetherWhose = 'mine' | 'theirs' | 'ours'

/** A done item stays on the near-term list this many days ('했어요 ✓'), today included. */
export const DONE_SHOWN_DAYS = 7
/** A dated item counts as near term this many days ahead (plan's SOON_DAYS). */
export const NEAR_DAYS = 14
/** Her 우리 한 줄: at most this many '민수님이 … 같이 챙긴대요' lines, from the last SUPPORT_LINE_DAYS days. */
export const SUPPORT_LINES_MAX = 2
export const SUPPORT_LINE_DAYS = 7
/** The link carries at most this many items. */
export const LINK_TOGETHER_MAX = 5

/**
 * Items that are "when it applies" rather than something to look after this
 * month (난임 치료가 필요할 때, 고위험 임산부 의료비, 아기 여권). They stay in
 * 챙길 것 with their support line; they are not pushed onto a home or the link.
 */
export const WHEN_NEEDED: ReadonlySet<string> = new Set(['pre-infertility-support', 'pp-high-risk', 'pp-passport'])

const other = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a')

function nameOf(state: Pick<AppState, 'couple'>, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name?.trim() ?? ''
}

/** '지은님' — or '함께하는 사람' / '기록하는 사람' when the name is empty. */
function callName(state: Pick<AppState, 'couple'>, id: MemberId): string {
  const name = nameOf(state, id)
  if (name) return `${name}님`
  return carrierOf(state) === id ? '기록하는 사람' : '함께하는 사람'
}

/** The person who carries the pregnancy (who tracks the cycle) — roadmap.ownersOf's own rule. */
export function carrierOf(state: Pick<AppState, 'couple'>): MemberId {
  return ownersOf(state, 'carrier')[0]!
}

/** A one-line name for an item: '국민행복카드 (임신·출산 진료비) 신청' → '국민행복카드'. */
export function shortTitle(title: string): string {
  const head = title.split(' (')[0]!.split(' · ')[0]!.trim()
  const s = head || title.trim()
  return s.length > 18 ? `${s.slice(0, 17)}…` : s
}

// ── Keys (decisions) ────────────────────────────────────────

/** decisions key: `member` said [같이 할게요] to the item (→ the day). */
export const supportKey = (itemId: string, member: MemberId): string => `support:${itemId}:${member}`

const TEMPLATE_PHASE = new Map(ROADMAP.map((t) => [t.id, t.phase]))

/**
 * The earliest day a support still belongs to this pregnancy / child (the
 * same rule plan.tickSince gives a tick on that item): an answer to 'NT 검사'
 * from an earlier pregnancy is not an answer for this one. 임신 준비 items and
 * the couple's own items always count.
 */
function supportSince(state: AppState, itemId: string): ISODate | undefined {
  const phase = TEMPLATE_PHASE.get(itemId)
  if (!phase || phase === 'preconception') return undefined
  return tickSince(state, planKey(itemId))
}

/** The day `member` said [같이 할게요] to the item, when it still counts. */
export function supportedOn(state: AppState, itemId: string, member: MemberId): ISODate | undefined {
  const day = state.decisions?.[supportKey(itemId, member)]
  if (day === undefined) return undefined
  const since = supportSince(state, itemId)
  return since && day < since ? undefined : day
}

/** Has `member` said [같이 할게요] to the item (for this pregnancy / child)? */
export function isSupported(state: AppState, itemId: string, member: MemberId): boolean {
  return supportedOn(state, itemId, member) !== undefined
}

/** Who said [같이 할게요] to the item. */
export function supportsFor(state: AppState, itemId: string): MemberId[] {
  return (['a', 'b'] as const).filter((m) => isSupported(state, itemId, m))
}

// ── One row ─────────────────────────────────────────────────

export interface TogetherItem {
  id: string
  custom: boolean
  title: string
  /** For one-liners ('국민행복카드'). */
  short: string
  kind: RoadmapKind
  phase: RoadmapPhase
  /** From the viewer's side. */
  whose: TogetherWhose
  /** Who looks after it, as the viewer calls them: '지은님' for theirs, '둘이 함께' for ours, '' for mine. */
  ownerName: string
  /**
   * The viewer's own and shared items: the plan's status (lib/logic/roadmap
   * ItemStatus). The other person's items: a NeutralStatus — never 'overdue'.
   */
  status: ItemStatus | NeutralStatus
  /**
   * The one status word the row shows ('예정 · 10월 21일', '예정', '이번 주', '했어요 ✓',
   * '기한 지남' only on one's own), or null — on the other person's item whose
   * deadline passed or window lapsed (it reads as nothing there).
   */
  label: string | null
  /** The day it is dated to: a booked appointment's day, else the day its window opens (when ahead). */
  date?: ISODate
  /** A booked appointment's time (app only — linkTogether never carries it). */
  time?: string
  /** What the viewer can do to share it — only for the person who is not the carrier, on the other's or shared items. */
  support?: string
  supportNote?: string
  /** [같이 할게요] is possible now. */
  canSupport: boolean
  /** The viewer already said [같이 할게요]. */
  supported: boolean
  /** On the item's owner's screen: '민수님이 같이 챙긴대요' when the other person said so. */
  supportedBy?: string
}

/** Where `viewer` stands to the item. */
export function whoseFor(item: Pick<PlanItem, 'owners'>, viewer: MemberId): TogetherWhose {
  if (item.owners.length > 1) return 'ours'
  return item.owners[0] === viewer ? 'mine' : 'theirs'
}

function sameWeek(a: ISODate, b: ISODate): boolean {
  return mondayOf(a) === mondayOf(b)
}

/**
 * The neutral reading of an item for the person it does not belong to:
 * done → 'done'; a booked day or a window opening this week → 'this-week';
 * an open window → 'this-week'; a day further on → 'upcoming' with that day;
 * no date yet → 'upcoming'. A deadline that passed ('overdue') or a window
 * that lapsed reads as nothing at all (null) — the row stays quiet.
 */
export function neutralStatus(
  item: Pick<PlanItem, 'status' | 'lapsed' | 'start'>,
  today: ISODate,
  bookedOn?: ISODate,
): { status: NeutralStatus; date?: ISODate } | null {
  if (item.status === 'done') return { status: 'done' }
  if (item.status === 'overdue' || item.lapsed) return null
  if (bookedOn && bookedOn >= today) return { status: sameWeek(bookedOn, today) ? 'this-week' : 'upcoming', date: bookedOn }
  if (item.status === 'now') return { status: 'this-week' }
  if (item.start && item.start > today) return { status: sameWeek(item.start, today) ? 'this-week' : 'upcoming', date: item.start }
  return { status: 'upcoming' }
}

/** '했어요 ✓' · '이번 주' / '이번 주 · 10월 10일 (토)' · '예정 · 10월 21일' / '예정'. */
export function neutralLabel(n: { status: NeutralStatus; date?: ISODate }): string {
  if (n.status === 'done') return NEUTRAL_DONE_LABEL
  if (n.status === 'this-week') return n.date ? `${NEUTRAL_THIS_WEEK_LABEL} · ${formatKo(n.date)}` : NEUTRAL_THIS_WEEK_LABEL
  return n.date ? `${NEUTRAL_UPCOMING_LABEL} · ${formatKo(n.date, { weekday: false })}` : NEUTRAL_UPCOMING_LABEL
}

/** The label on one's own / a shared item, in 챙길 것's words (plan.statusPill) with its day when there is one. */
function ownLabel(item: PlanItem, today: ISODate, date: ISODate | undefined): string | null {
  const day = date ? formatKo(date, { weekday: false }) : undefined
  switch (item.status) {
    case 'done':
      return NEUTRAL_DONE_LABEL
    case 'overdue':
      return '기한 지남'
    case 'now':
      if (date) return sameWeek(date, today) ? `이번 주 · ${formatKo(date)}` : `예정 · ${day}`
      return item.end ? `${formatKo(item.end, { weekday: false })}까지` : '지금'
    case 'soon':
      return `곧 · ${day ?? ''}`.replace(/ · $/, '')
    default:
      if (item.lapsed) return '지났어요'
      // An open item with no day yet reads '예정', as her undated items do on his side.
      return day ? `예정 · ${day}` : NEUTRAL_UPCOMING_LABEL
  }
}

/** Her own 직접 추가 item gets the general line; a shared one of their own carries none. */
function customLine(whose: TogetherWhose): { support?: string } {
  return whose === 'theirs' ? { support: CUSTOM_SUPPORT } : {}
}

function supportLineOf(item: PlanItem): { support?: string; supportNote?: string } {
  if (item.template) {
    const { support, supportNote } = item.template
    return support ? { support, ...(supportNote ? { supportNote } : {}) } : {}
  }
  return {}
}

/** The current stage's phases (챙길 것's own default view). */
function inStage(state: Pick<AppState, 'stage'>, item: Pick<PlanItem, 'phase'>): boolean {
  return STAGE_PHASES[state.stage].includes(item.phase)
}

/**
 * May `member` say [같이 할게요] to this item now? Only the person who is not
 * the carrier, on an open item of the current stage that is the other's or
 * shared and carries a support line (a 'carrier' item always does; her own
 * 직접 추가 item gets CUSTOM_SUPPORT) — never during the quiet after a loss.
 */
export function canSupportItem(state: AppState, member: MemberId, item: PlanItem, today: ISODate): boolean {
  if (!isISODate(today) || weekQuiet(state, today)) return false
  if (member === carrierOf(state) || item.status === 'done' || !inStage(state, item)) return false
  const whose = whoseFor(item, member)
  if (whose === 'mine') return false
  if (item.custom) return whose === 'theirs'
  return !!item.template?.support
}

/**
 * One item as `viewer` sees it — the row helper for 챙길 것 (its own list of
 * PlanItems) and the building block of togetherItems. On the other person's
 * item whose deadline passed / window lapsed the `label` is null (the row
 * shows no status at all — never '기한 지남' about her). In the quiet after a
 * loss the row is the plan only: no support line, no note, no
 * '민수님이 같이 챙긴대요' and no [같이 할게요] — one place for every screen
 * that draws a row (챙길 것, 검사 일정, 이번 주 챙길 것).
 */
export function togetherRow(state: AppState, today: ISODate, viewer: MemberId, item: PlanItem): TogetherItem {
  const quiet = !isISODate(today) || weekQuiet(state, today)
  const whose = whoseFor(item, viewer)
  const carrier = carrierOf(state)
  const booked = linkedAppointment(state.appointments, item.id, today)
  const base = {
    id: item.id,
    custom: item.custom,
    title: item.title,
    short: shortTitle(item.title),
    kind: item.kind,
    phase: item.phase,
    whose,
    ownerName: whose === 'theirs' ? callName(state, item.owners[0]!) : whose === 'ours' ? '둘이 함께' : '',
  }
  let status: TogetherItem['status']
  let label: string | null
  let date: ISODate | undefined
  if (whose === 'theirs') {
    const n = neutralStatus(item, today, booked?.date)
    status = n?.status ?? 'upcoming'
    label = n ? neutralLabel(n) : null
    date = n?.date
  } else {
    status = item.status
    date = booked?.date ?? (item.start && item.start > today ? item.start : undefined)
    label = ownLabel(item, today, date)
  }
  // Support lines are for the person who is not the carrier, on her items and shared ones.
  const lines = quiet || viewer === carrier || whose === 'mine' ? {} : item.custom ? customLine(whose) : supportLineOf(item)
  const by = other(viewer)
  const supportedBy = !quiet && whose !== 'theirs' && isSupported(state, item.id, by) ? `${callName(state, by)}이 같이 챙긴대요` : undefined
  return {
    ...base,
    status,
    label,
    ...(date ? { date } : {}),
    ...(booked?.time && date === booked.date ? { time: booked.time } : {}),
    ...lines,
    canSupport: canSupportItem(state, viewer, item, today),
    supported: isSupported(state, item.id, viewer),
    ...(supportedBy ? { supportedBy } : {}),
  }
}

// ── The near-term list ──────────────────────────────────────

export interface TogetherOptions {
  /** A dated item counts as near term this many days ahead (default NEAR_DAYS). */
  days?: number
  /** At most this many, after sorting (default: all). */
  limit?: number
  /** Include what was done in the last DONE_SHOWN_DAYS days ('했어요 ✓', default true). */
  done?: boolean
  /** Only these (e.g. ['theirs'] for '지은님 챙길 것' on his home). Default: all three. */
  whose?: readonly TogetherWhose[]
  /**
   * Ids another card on the same screen already carries (his month task, his
   * 내 준비 items) — left out BEFORE `limit`, so the next row takes the place.
   */
  exclude?: readonly string[]
}

const WHOSE_ORDER: Record<TogetherWhose, number> = { theirs: 0, ours: 1, mine: 2 }

interface Ranked {
  /** 0 a day (booked / opening), 1 an open window without one, 2 no date yet. */
  band: number
  day: ISODate
  whose: TogetherWhose
  idx: number
}

/**
 * Sorted by date: what has a day (a booking, a window opening) by that day,
 * then the windows open now, then what has no date yet — hers before shared
 * before one's own at the same place, then 챙길 것's own order.
 */
function byDate(a: Ranked, b: Ranked): number {
  if (a.band !== b.band) return a.band - b.band
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  if (a.whose !== b.whose) return WHOSE_ORDER[a.whose] - WHOSE_ORDER[b.whose]
  return a.idx - b.idx
}

/** Done ones: most recent first. */
function byDoneDay(a: Ranked, b: Ranked): number {
  if (a.day !== b.day) return a.day > b.day ? -1 : 1
  if (a.whose !== b.whose) return WHOSE_ORDER[a.whose] - WHOSE_ORDER[b.whose]
  return a.idx - b.idx
}

function openBand(date: ISODate | undefined, status: PlanItem['status']): number {
  if (date) return 0
  return status === 'now' || status === 'overdue' ? 1 : 2
}

/**
 * The viewer's view of the shared plan for this week and the near term,
 * sorted by date: the viewer's own items and the shared ones with the plan's
 * status, the other person's with a neutral one (never overdue — a passed
 * deadline or a lapsed window of hers leaves the list). Open items of the
 * current stage: booked or opening within `days`, open now, or undated;
 * then what was done in the last week. Not the 'when it applies' items
 * (WHEN_NEEDED), not a dated item whose anchor is still unknown. Empty during
 * the quiet after a loss. Works in every stage.
 */
export function togetherItems(state: AppState, today: ISODate, viewer: MemberId, opts: TogetherOptions = {}): TogetherItem[] {
  if (!isISODate(today) || weekQuiet(state, today)) return []
  const days = opts.days ?? NEAR_DAYS
  const whoseOk = opts.whose ?? ['mine', 'theirs', 'ours']
  const doneFrom = addDays(today, -(DONE_SHOWN_DAYS - 1))
  const liveCustom = new Set(state.customTasks.filter((c) => isLive(c)).map((c) => c.id))
  const skip = new Set(opts.exclude ?? [])
  const open: Array<Ranked & { row: TogetherItem }> = []
  const done: Array<Ranked & { row: TogetherItem }> = []
  planItems(state, today).forEach((item, idx) => {
    if (!inStage(state, item) || WHEN_NEEDED.has(item.id) || skip.has(item.id)) return
    if (item.custom && !liveCustom.has(item.id)) return
    const row = togetherRow(state, today, viewer, item)
    if (!whoseOk.includes(row.whose)) return
    if (item.status === 'done') {
      if (opts.done === false || !item.doneAt || item.doneAt < doneFrom || item.doneAt > today) return
      done.push({ row, band: 0, day: item.doneAt, whose: row.whose, idx })
      return
    }
    if (item.pending || item.lapsed) return
    // Hers on his screen: a passed deadline is not his to point at.
    if (row.whose === 'theirs' && row.label === null) return
    if (row.date && diffDays(today, row.date) > days) return
    open.push({ row, band: openBand(row.date, item.status), day: row.date ?? '', whose: row.whose, idx })
  })
  open.sort(byDate)
  done.sort(byDoneDay)
  const out = [...open, ...done].map((x) => x.row)
  return opts.limit === undefined ? out : out.slice(0, Math.max(0, opts.limit))
}

// ── [같이 할게요] ───────────────────────────────────────────

/** The item as 챙길 것 reads it today (template or the couple's own), if it exists. */
function findItem(state: AppState, itemId: string, today: ISODate): PlanItem | undefined {
  if (!isISODate(today)) return undefined
  const c = state.customTasks.find((x) => x.id === itemId)
  if (c && !isLive(c)) return undefined
  return planItems(state, today).find((i) => i.id === itemId)
}

/**
 * [같이 할게요]: `member` will share the item — kept in `decisions`
 * ('support:<itemId>:<member>' → today). Only where canSupportItem allows it
 * (him, on her open item or a shared one of this stage with a support line,
 * outside the quiet); already said → the same state (the first day stands).
 */
export function supportItem(state: AppState, member: MemberId, itemId: string, today: ISODate): AppState {
  const item = findItem(state, itemId, today)
  if (!item || !canSupportItem(state, member, item, today)) return state
  if (isSupported(state, itemId, member)) return state
  // A stale answer from an earlier pregnancy is replaced by today's.
  return decide(undecide(state, supportKey(itemId, member)), supportKey(itemId, member), today)
}

/** Take [같이 할게요] back (any time; nothing said → the same state). */
export function unsupportItem(state: AppState, member: MemberId, itemId: string): AppState {
  return undecide(state, supportKey(itemId, member))
}

// ── Her 우리 한 줄 ──────────────────────────────────────────

export interface SupportLine {
  itemId: string
  /** '민수님이 ‘국민행복카드’ 같이 챙긴대요' */
  text: string
  /** The day he said it. */
  day: ISODate
}

/**
 * For `ownerId`'s 우리 한 줄: up to two lines '민수님이 ‘국민행복카드’ 같이
 * 챙긴대요' — the other person's [같이 할게요] of the last week, on items that
 * are still open and of this stage, newest first. Empty during the quiet.
 */
export function partnerSupportLines(state: AppState, today: ISODate, ownerId: MemberId): SupportLine[] {
  if (!isISODate(today) || weekQuiet(state, today)) return []
  const by = other(ownerId)
  const from = addDays(today, -(SUPPORT_LINE_DAYS - 1))
  const suffix = `:${by}`
  const said: Array<{ itemId: string; day: ISODate }> = []
  for (const [key, day] of Object.entries(state.decisions ?? {})) {
    if (!key.startsWith('support:') || !key.endsWith(suffix)) continue
    const itemId = key.slice('support:'.length, key.length - suffix.length)
    if (!itemId || day < from || day > today || supportedOn(state, itemId, by) === undefined) continue
    said.push({ itemId, day })
  }
  if (!said.length) return []
  const items = new Map(planItems(state, today).map((i) => [i.id, i]))
  const who = callName(state, by)
  return said
    .filter(({ itemId }) => {
      const it = items.get(itemId)
      return !!it && it.status !== 'done' && inStage(state, it) && whoseFor(it, ownerId) !== 'theirs'
    })
    .sort((a, b) => (a.day !== b.day ? (a.day > b.day ? -1 : 1) : a.itemId < b.itemId ? -1 : 1))
    .slice(0, SUPPORT_LINES_MAX)
    .map(({ itemId, day }) => ({ itemId, day, text: `${who}이 ‘${shortTitle(items.get(itemId)!.title)}’ 같이 챙긴대요` }))
}

// ── The link ────────────────────────────────────────────────

export interface LinkTogetherItem {
  /** A roadmap template id (the couple's own items never travel: their titles are free text). */
  id: string
  title: string
  kind: RoadmapKind
  /** Hers, or one they share. */
  whose: 'theirs' | 'ours'
  status: NeutralStatus
  /** '예정 · 10월 21일' / '이번 주' / '했어요 ✓'. */
  label: string
  /** A day (window opening, or — pregnant / parenting only — a booked appointment's day). */
  date?: ISODate
  /** What he can do. */
  support: string
  supportNote?: string
  /** He already said [같이 할게요]. */
  supported: boolean
  /** [같이 할게요] is possible (the link sends a 'support' event). */
  canSupport: boolean
}

export interface LinkTogether {
  /** '지은님' — whose items these are. */
  ownerName: string
  items: LinkTogetherItem[]
}

export interface LinkTogetherOptions {
  /**
   * Ids another card of the page already carries (his month task, his 내 준비
   * items, the 신청 row whose shared 'done' would tell him she applied —
   * partnerSnapshot.linkTogetherPlan). Left out BEFORE the list is cut to
   * LINK_TOGETHER_MAX, so their place goes to the next row and nothing about
   * them moves the others.
   */
  exclude?: readonly string[]
}

/**
 * Exactly what the link may show of the shared plan on `today` for
 * `partnerId` (the person who is not the carrier): her near-term roadmap
 * items and the shared ones that carry a support line — catalogue title,
 * neutral status (for shared ones too), his support line and whether he said
 * [같이 할게요]. In the pregnant / parenting stages a booked appointment gives
 * its DAY only; while preparing her bookings stay in the app (the link's N32
 * rule: her own appointments never travel). No custom item, no time, place,
 * note or appointment title, nothing from her cycle. `exclude` leaves out
 * the rows another card of the page carries, before the cut. Undefined for the
 * carrier, during the quiet, and when there is nothing to show.
 */
export function linkTogether(
  state: AppState,
  today: ISODate,
  partnerId: MemberId,
  opts: LinkTogetherOptions = {},
): LinkTogether | undefined {
  if (!isISODate(today) || partnerId === carrierOf(state) || weekQuiet(state, today)) return undefined
  const datesFromBookings = state.stage !== 'preparing'
  const doneFrom = addDays(today, -(DONE_SHOWN_DAYS - 1))
  const skip = new Set(opts.exclude ?? [])
  const open: Array<Ranked & { it: LinkTogetherItem }> = []
  const done: Array<Ranked & { it: LinkTogetherItem }> = []
  planItems(state, today).forEach((item, idx) => {
    if (item.custom || !item.template?.support || !inStage(state, item) || WHEN_NEEDED.has(item.id) || skip.has(item.id)) return
    const whose = whoseFor(item, partnerId)
    if (whose === 'mine') return
    if (item.status !== 'done' && (item.pending || item.lapsed)) return
    const booked = datesFromBookings ? linkedAppointment(state.appointments, item.id, today)?.date : undefined
    const n = neutralStatus(item, today, booked)
    if (!n) return
    if (n.date && diffDays(today, n.date) > NEAR_DAYS) return
    const it: LinkTogetherItem = {
      id: item.id,
      title: item.title,
      kind: item.kind,
      whose,
      status: n.status,
      label: neutralLabel(n),
      ...(n.date ? { date: n.date } : {}),
      support: item.template.support,
      ...(item.template.supportNote ? { supportNote: item.template.supportNote } : {}),
      supported: isSupported(state, item.id, partnerId),
      canSupport: canSupportItem(state, partnerId, item, today),
    }
    if (n.status === 'done') {
      if (!item.doneAt || item.doneAt < doneFrom || item.doneAt > today) return
      done.push({ it, band: 0, day: item.doneAt, whose, idx })
    } else open.push({ it, band: openBand(n.date, item.status), day: n.date ?? '', whose, idx })
  })
  open.sort(byDate)
  done.sort(byDoneDay)
  const items = [...open, ...done].slice(0, LINK_TOGETHER_MAX).map((x) => x.it)
  if (!items.length) return undefined
  return { ownerName: callName(state, carrierOf(state)), items }
}
