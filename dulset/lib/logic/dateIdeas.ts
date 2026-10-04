// 둘만의 시간 (#date, no longer a tab) logic (pure): weekly idea rotation, map
// links, shared date plans and the partner notice that goes out when one of us
// proposes a date. A plan's default day never follows the fertile window: a
// pattern the partner learns ("she always suggests those days") turns a date
// into pressure (docs/review-preconception.md, 데이트).

import {
  CATEGORY_ORDER,
  type Budget,
  type DateCategory,
  type DateFlag,
  type DateIdea,
  type Season,
} from '../content/dateIdeas'
import { addDays, formatKo, isISODate, parts, weekdayIndex } from '../dates'
import { uid } from '../id'
import type { AppState, DatePlan, ISODate, MemberId, Stage } from '../types'
import { fertilityStatus, ourWeekSoon } from './cycle'
import { sharedWeek } from './cycleRing'
import { mergeNotices } from './notifications'
import { canLogCycle, canSeeCycleDetails, canSeeWeekBand, lowPressureFor } from './prefs'
import { activePositivePending, activeRest } from './ttc'

// ── Season / week ───────────────────────────────────────────

/** Mar–May spring, Jun–Aug summer, Sep–Nov fall, Dec–Feb winter. */
export function seasonOf(date: ISODate): Season {
  const { month } = parts(date)
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

/** Monday of the week containing `date` (weeks run Mon–Sun). */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((weekdayIndex(date) + 6) % 7))
}

/** Saturday on/after `date` ("이번 주 토요일"; today if it is Saturday). */
export function thisSaturday(date: ISODate): ISODate {
  return addDays(date, (6 - weekdayIndex(date) + 7) % 7)
}

/** FNV-1a 32-bit — small, stable hash for deterministic rotation. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export type SeasonFit = 'in' | 'any' | 'out'

export function seasonFit(idea: Pick<DateIdea, 'seasons'>, season: Season): SeasonFit {
  if (!idea.seasons || idea.seasons.length === 0) return 'any'
  return idea.seasons.includes(season) ? 'in' : 'out'
}

// ── Weekly picks ────────────────────────────────────────────

export interface PickOptions {
  today: ISODate
  stage: Stage
  /** Ideas to skip, e.g. already planned in the last 30 days. */
  excludeIds?: Iterable<string>
  count?: number
}

const SEASON_BONUS: Record<SeasonFit, number> = { in: 0.35, any: 0, out: -1 }

/**
 * "이번 주 추천": a deterministic pick that changes every Monday. Only ideas for
 * the current stage; in-season ideas are favoured and out-of-season ones only
 * fill in when nothing else is left. Picks spread across categories when
 * possible. Excluded ideas come back only if there aren't enough others.
 */
export function pickIdeas(ideas: DateIdea[], opts: PickOptions): DateIdea[] {
  const count = Math.max(0, opts.count ?? 3)
  const exclude = new Set(opts.excludeIds ?? [])
  const season = seasonOf(opts.today)
  const seed = `${mondayOf(opts.today)}:${opts.stage}`
  const score = (i: DateIdea) => hashString(`${seed}:${i.id}`) / 0x1_0000_0000 + SEASON_BONUS[seasonFit(i, season)]
  const rank = (list: DateIdea[]) =>
    list
      .map((idea) => ({ idea, s: score(idea) }))
      .sort((a, b) => b.s - a.s || (a.idea.id < b.idea.id ? -1 : 1))
      .map((x) => x.idea)

  const forStage = ideas.filter((i) => i.stages.includes(opts.stage))
  const fresh = rank(forStage.filter((i) => !exclude.has(i.id)))
  const planned = rank(forStage.filter((i) => exclude.has(i.id)))

  const out: DateIdea[] = []
  const usedCats = new Set<DateCategory>()
  // First pass: best idea per category, so the three picks feel different.
  for (const idea of fresh) {
    if (out.length >= count) break
    if (usedCats.has(idea.category)) continue
    // Never let an out-of-season idea win a slot over an in-season duplicate category.
    if (seasonFit(idea, season) === 'out') continue
    out.push(idea)
    usedCats.add(idea.category)
  }
  for (const idea of [...fresh, ...planned]) {
    if (out.length >= count) break
    if (!out.includes(idea)) out.push(idea)
  }
  return out
}

/** Idea ids planned from 30 days ago onwards (upcoming ones included). */
export function recentlyPlannedIdeaIds(plans: DatePlan[], today: ISODate, days = 30): string[] {
  const from = addDays(today, -days)
  const ids = new Set<string>()
  for (const p of plans) if (p.ideaId && p.date >= from) ids.add(p.ideaId)
  return [...ids]
}

/** Soonest upcoming (not done) plan date per idea, for the "일정에 있어요" badge. */
export function upcomingIdeaDates(plans: DatePlan[], today: ISODate): Map<string, ISODate> {
  const out = new Map<string, ISODate>()
  for (const p of plans) {
    if (!p.ideaId || p.done || p.date < today) continue
    const cur = out.get(p.ideaId)
    if (!cur || p.date < cur) out.set(p.ideaId, p.date)
  }
  return out
}

// ── Browsing ────────────────────────────────────────────────

export interface IdeaFilter {
  category?: DateCategory | 'all'
  budget?: Budget | 'all'
}

/** Full list for a stage: filtered, in-season first, then by category order. */
export function browseIdeas(ideas: DateIdea[], stage: Stage, today: ISODate, filter: IdeaFilter = {}): DateIdea[] {
  const season = seasonOf(today)
  const fitRank: Record<SeasonFit, number> = { in: 0, any: 1, out: 2 }
  const catRank = (c: DateCategory) => CATEGORY_ORDER.indexOf(c)
  return ideas
    .filter((i) => i.stages.includes(stage))
    .filter((i) => !filter.category || filter.category === 'all' || i.category === filter.category)
    .filter((i) => !filter.budget || filter.budget === 'all' || i.budget === filter.budget)
    .map((idea, index) => ({ idea, index }))
    .sort(
      (a, b) =>
        fitRank[seasonFit(a.idea, season)] - fitRank[seasonFit(b.idea, season)] ||
        catRank(a.idea.category) - catRank(b.idea.category) ||
        a.index - b.index,
    )
    .map((x) => x.idea)
}

/** Categories that have at least one idea for the stage (for the filter chips). */
export function categoriesFor(ideas: DateIdea[], stage: Stage): DateCategory[] {
  const present = new Set(ideas.filter((i) => i.stages.includes(stage)).map((i) => i.category))
  return CATEGORY_ORDER.filter((c) => present.has(c))
}

/**
 * Health badges only make sense while preparing / pregnant; '아기와 함께' only
 * once the baby is here. 체력 부담 적음 shows in every stage.
 */
export function visibleFlags(idea: Pick<DateIdea, 'flags'>, stage: Stage): DateFlag[] {
  const flags = idea.flags ?? []
  if (stage === 'parenting') return flags.filter((f) => f !== 'no-alcohol' && f !== 'no-heat')
  return flags.filter((f) => f !== 'baby-friendly')
}

export function ideaTip(idea: Pick<DateIdea, 'tip' | 'stageTips'>, stage: Stage): string | undefined {
  return idea.stageTips?.[stage] ?? idea.tip
}

// ── Map links ───────────────────────────────────────────────

/**
 * Key-free search links (research: map.kakao.com/link/search/{검색어},
 * map.naver.com/p/search/{검색어} as the web fallback for nmap://search).
 */
export function mapLinks(query: string): { kakao: string; naver: string } {
  const q = encodeURIComponent(query.trim())
  return {
    kakao: `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  }
}

// ── Context banner ──────────────────────────────────────────

export interface DateBanner {
  kind: 'our-week' | 'low-pressure' | 'preparing' | 'pregnant' | 'parenting'
  emoji: string
  title: string
  body: string
  /** Short fertility-friendly reminder (preparing / pregnant only). */
  note?: string
}

const PREPARING_NOTE = '🍹 술은 잠시 쉬고, ♨️ 뜨거운 탕·사우나 대신 산책으로 골라요.'
const PREGNANT_NOTE = '🍹 음료는 무알콜로, ♨️ 뜨거운 탕·사우나는 피하고 틈틈이 쉬어 가요.'

type BannerState = Pick<
  AppState,
  'stage' | 'settings' | 'couple' | 'periods' | 'lhTests' | 'cycle' | 'pregnancy' | 'restCycle' | 'positivePending'
> &
  Partial<Pick<AppState, 'cycleNotes'>>

/** The viewer's alert style, with the same defaults as the calendar. */
export function viewerAlertStyle(state: Pick<AppState, 'settings' | 'couple'>, viewer: MemberId) {
  const owner = state.couple.members.find((m) => m.tracksCycle) ?? state.couple.members[0]
  return state.settings.alertStyle?.[viewer] ?? (viewer === owner.id ? 'explicit' : 'soft')
}

/**
 * May the 둘만의 시간 screen mention the fertile window (as "우리의 주간") to this
 * viewer? Not in low-pressure mode or with alerts off, not to a partner she
 * shares no dates with ('날짜 없음', prefs.canSeeWeekBand — N23), and not
 * while the cycle rests ("이번 주기는 쉬어요") or a positive test waits for the
 * clinic. With `today`, a rest whose last day has passed (the 42-day quiet
 * after a loss, ttc.activeRest) no longer counts; without it the quiet lasts
 * until a period after it is logged — the quiet side.
 */
export function fertileHintsAllowed(
  state: Pick<AppState, 'stage' | 'settings' | 'couple'> &
    Partial<Pick<AppState, 'periods' | 'restCycle' | 'positivePending'>>,
  viewer: MemberId,
  today?: ISODate,
): boolean {
  if (state.stage !== 'preparing') return false
  if (!canSeeWeekBand(state, viewer)) return false
  if (lowPressureFor(state.settings, viewer) || viewerAlertStyle(state, viewer) === 'off') return false
  const periods = state.periods ?? []
  if (activeRest({ restCycle: state.restCycle, periods }, today)) return false
  if (activePositivePending({ positivePending: state.positivePending, periods, stage: state.stage })) return false
  return true
}

/**
 * The state the 둘만의 시간 gate (fertileHintsAllowed) reads for `viewer`.
 * For her and a partner she shares the details with: the state as it is. For
 * a partner without them: her own rest (not the clinic mode, not the 'loss'
 * quiet — both phones show those) and her positive test left out — his one
 * window (cycleRing.sharedWeek) already stays off when one started before it,
 * and one she starts inside it must not take his card or its ideas away (a
 * screen change on the day of something she did not tell). Every screen that
 * gates on it reads through this: the home card (ttcFlow.ttcMoment), its
 * ideas (components/today/OurWeekIdeas → partnerSnapshot.linkIdeas), the
 * link's ideas and the #date banner (dateBanner). Idempotent.
 */
export function partnerHintState<S extends Pick<AppState, 'couple' | 'settings' | 'restCycle' | 'positivePending'>>(state: S, viewer: MemberId): S {
  if (canLogCycle(state, viewer) || canSeeCycleDetails(state, viewer)) return state
  const r = state.restCycle
  const keepRest = r?.reason === 'clinic' || r?.reason === 'loss'
  if (!state.positivePending && (!r || keepRest)) return state
  return { ...state, restCycle: keepRest ? r : undefined, positivePending: undefined }
}

export function dateBanner(state: BannerState, today: ISODate, viewer: MemberId): DateBanner {
  if (state.stage === 'pregnant') {
    return {
      kind: 'pregnant',
      emoji: '🤰',
      title: '태교 여행·산책 아이디어',
      body: '무리하지 않는 일정으로, 쉬어 가며 즐겨요.',
      note: PREGNANT_NOTE,
    }
  }
  if (state.stage === 'parenting') {
    return {
      kind: 'parenting',
      emoji: '🌙',
      title: '아기 재운 뒤 30분, 둘만의 시간',
      body: '짧아도 괜찮아요. 서로 이야기 들어 주는 시간이면 충분해요.',
    }
  }
  if (lowPressureFor(state.settings, viewer)) {
    return {
      kind: 'low-pressure',
      emoji: '🌿',
      title: '주기 상관없이, 자주 함께하는 게 제일 좋아요',
      body: '특별한 날을 정하지 않아도 돼요. 편한 날 가볍게 골라 봐요.',
      note: PREPARING_NOTE,
    }
  }
  // Read through partnerHintState, as the home card is: a rest or a positive
  // test she starts inside his window and does not tell never flips this
  // banner (the window itself — sharedWeek, below — reads the stored state).
  if (fertileHintsAllowed(partnerHintState(state, viewer), viewer, today)) {
    // Same rule as the home teaser and the "이번 주는 우리의 주간" notice: her
    // own (LH-tuned) estimate for her and a partner she shares the details
    // with; for a partner without them the one shared window (cycleRing
    // .sharedWeek — her logged starts only, never on period days 1–3), so an
    // untold period, LH strip or test never flips this banner (N19).
    const soon = canSeeCycleDetails(state, viewer) ? ourWeekSoon(fertilityStatus(state, today)) : !!sharedWeek(state, today)
    if (soon) {
      return {
        kind: 'our-week',
        emoji: '💞',
        title: '이번 주는 우리의 주간 💞',
        body: '무리하지 말고 같이 있는 시간 자체를 즐겨요.',
        note: PREPARING_NOTE,
      }
    }
  }
  return {
    kind: 'preparing',
    emoji: '💞',
    title: '이번 주 둘만의 시간',
    body: '거창하지 않아도 좋아요. 같이 웃는 시간이 쌓이면 돼요.',
    note: PREPARING_NOTE,
  }
}

// ── Default date for a new plan ─────────────────────────────

export interface SuggestedDate {
  date: ISODate
  /** saturday: the coming Saturday · next-saturday: that one already has a plan. */
  reason: 'saturday' | 'next-saturday'
}

/**
 * The day a new plan starts on: the coming Saturday (today, if it is Saturday),
 * or the Saturday after when that one already has a plan. Never the fertile
 * window — the couple picks any other day in the sheet. `_viewer` is accepted
 * for older call sites; the suggestion is the same for both people.
 */
export function suggestPlanDate(
  state: Pick<AppState, 'datePlans'>,
  today: ISODate,
  _viewer?: MemberId,
): SuggestedDate {
  const saturday = thisSaturday(today)
  const taken = state.datePlans.some((p) => !p.done && p.date === saturday)
  return taken ? { date: addDays(saturday, 7), reason: 'next-saturday' } : { date: saturday, reason: 'saturday' }
}

/** Helper line under the date field while the suggested day is still selected. */
export function planDateHint(suggested: SuggestedDate, today: ISODate): string {
  const day = formatKo(suggested.date, { weekday: false })
  if (suggested.reason === 'next-saturday') return `이번 토요일엔 일정이 있어서 다음 토요일(${day})로 골라 뒀어요. 편한 날로 바꿔도 좋아요.`
  // "이번 주 토요일" is ambiguous on a Sunday, so say what we mean.
  return suggested.date === today ? '오늘, 토요일로 골라 뒀어요.' : `다가오는 토요일(${day})로 골라 뒀어요.`
}

// ── Plans (pure mutations) ──────────────────────────────────

export interface NewDatePlan {
  date: ISODate
  title: string
  ideaId?: string
  place?: string
  note?: string
  createdBy: MemberId
}

const clean = (s: string | undefined) => {
  const t = s?.trim()
  return t ? t : undefined
}

export const PLAN_TITLE_MAX = 40
export const PLAN_TEXT_MAX = 120

export type PlanError = 'date' | 'title'

export function validatePlan(input: Pick<NewDatePlan, 'date' | 'title'>, today: ISODate): PlanError | null {
  if (!isISODate(input.date) || input.date < today) return 'date'
  if (!input.title.trim()) return 'title'
  return null
}

export function buildDatePlan(input: NewDatePlan, id: string = uid()): DatePlan {
  const plan: DatePlan = {
    id,
    date: input.date,
    title: input.title.trim().slice(0, PLAN_TITLE_MAX),
    done: false,
    createdBy: input.createdBy,
  }
  const ideaId = clean(input.ideaId)
  const place = clean(input.place)?.slice(0, PLAN_TEXT_MAX)
  const note = clean(input.note)?.slice(0, PLAN_TEXT_MAX)
  if (ideaId) plan.ideaId = ideaId
  if (place) plan.place = place
  if (note) plan.note = note
  return plan
}

export function addDatePlan(state: AppState, input: NewDatePlan, id: string = uid()): AppState {
  return {
    ...state,
    datePlans: [...state.datePlans, buildDatePlan(input, id)],
  }
}

export function toggleDatePlanDone(state: AppState, id: string): AppState {
  if (!state.datePlans.some((p) => p.id === id)) return state
  return {
    ...state,
    datePlans: state.datePlans.map((p) => (p.id === id ? { ...p, done: !p.done } : p)),
  }
}

export function removeDatePlan(state: AppState, id: string): AppState {
  if (!state.datePlans.some((p) => p.id === id)) return state
  return { ...state, datePlans: state.datePlans.filter((p) => p.id !== id) }
}

/** Not done yet and today or later — soonest first. */
export function upcomingPlans(state: Pick<AppState, 'datePlans'>, today: ISODate): DatePlan[] {
  return state.datePlans
    .filter((p) => !p.done && p.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
}

/** Done, or the day has passed — most recent first. */
export function pastPlans(state: Pick<AppState, 'datePlans'>, today: ISODate): DatePlan[] {
  return state.datePlans
    .filter((p) => p.done || p.date < today)
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.id < b.id ? -1 : 1))
}

/** "다녀왔어요" makes sense from the day itself onwards. */
export function canMarkDone(plan: Pick<DatePlan, 'date'>, today: ISODate): boolean {
  return plan.date <= today
}

// ── Partner notices ─────────────────────────────────────────

function nameOf(state: AppState, id: MemberId): string {
  return state.couple.members.find((m) => m.id === id)?.name ?? ''
}

function partnerOf(state: AppState, id: MemberId): MemberId {
  return state.couple.members.find((m) => m.id !== id)?.id ?? (id === 'a' ? 'b' : 'a')
}

export function proposalTitle(fromName: string, date: ISODate): string {
  return `💌 ${fromName}님이 ${formatKo(date)} 데이트를 제안했어요`
}

export function proposalBody(plan: Pick<DatePlan, 'title' | 'place' | 'note'>): string {
  return [plan.title, plan.place ? `📍 ${plan.place}` : null, plan.note ? `“${plan.note}”` : null]
    .filter(Boolean)
    .join(' · ')
}

/** Tell the partner about a plan I just added (once per plan). */
export function proposePlanNotice(state: AppState, plan: DatePlan, nowISO: string): AppState {
  const from = plan.createdBy
  return mergeNotices(
    state,
    [
      {
        key: `date-plan:${plan.id}`,
        to: partnerOf(state, from),
        from,
        kind: 'date-idea',
        title: proposalTitle(nameOf(state, from), plan.date),
        body: proposalBody(plan),
      },
    ],
    nowISO,
  ).state
}

/** Add a plan and send the partner the proposal notice in one update. */
export function proposeDatePlan(state: AppState, input: NewDatePlan, nowISO: string, id: string = uid()): AppState {
  const next = addDatePlan(state, input, id)
  const plan = next.datePlans[next.datePlans.length - 1]!
  return proposePlanNotice(next, plan, nowISO)
}

const acceptKey = (planId: string, by: MemberId) => `date-ok:${planId}:${by}`

/**
 * Did `by` already say "좋아요" to this plan? Stored on the plan itself — the
 * inbox is trimmed, so the reply notice can't be the record. (Older data only
 * has the notice, so that still counts.)
 */
export function isPlanAccepted(state: Pick<AppState, 'notifications' | 'datePlans'>, planId: string, by: MemberId): boolean {
  if (state.datePlans.some((p) => p.id === planId && p.acceptedBy === by)) return true
  const key = acceptKey(planId, by)
  return state.notifications.some((n) => n.key === key)
}

/** The partner's "좋아요 👍" reply to a proposal (once per plan). */
export function acceptDatePlan(state: AppState, planId: string, by: MemberId, nowISO: string): AppState {
  const plan = state.datePlans.find((p) => p.id === planId)
  if (!plan || plan.createdBy === by || isPlanAccepted(state, planId, by)) return state
  // Replying answers the proposal, so it no longer counts as unread for `by`.
  const proposalKey = `date-plan:${planId}`
  const answered: AppState = {
    ...state,
    datePlans: state.datePlans.map((p) => (p.id === planId ? { ...p, acceptedBy: by } : p)),
    notifications: state.notifications.map((n) => (n.key === proposalKey && n.to === by && !n.read ? { ...n, read: true } : n)),
  }
  return mergeNotices(
    answered,
    [
      {
        key: acceptKey(planId, by),
        to: plan.createdBy,
        from: by,
        kind: 'date-idea',
        title: `👍 ${nameOf(state, by)}님이 ${formatKo(plan.date)} 데이트 좋대요`,
        body: plan.title,
      },
    ],
    nowISO,
  ).state
}

// ── Calendar export ─────────────────────────────────────────

export function planIcsEvent(plan: DatePlan) {
  const description = [plan.place ? `장소: ${plan.place}` : null, plan.note ?? null].filter(Boolean).join('\n')
  return {
    uid: `date-${plan.id}@dulset`,
    start: plan.date,
    end: plan.date,
    title: `💞 ${plan.title}`,
    ...(description ? { description } : {}),
    // 9:00 the day before (all-day events start at 00:00 → 15 h before).
    alarmMinutesBefore: 15 * 60,
  }
}
