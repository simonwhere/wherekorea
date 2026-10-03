// The partner snapshot — the ONLY thing the owner's phone ever publishes for
// the no-install partner link (Next A ①, docs/review-realuse.md 다음 단계 5:
// 남편이 보는 건 우리의 주간 띠 · 이번 달 할 일 · 신호 답장 · 콕/응원뿐).
//
// It is computed on the OWNER's phone through the same lenses the in-app
// partner screen uses — ttcFlow.ttcMoment / cycleStrip, which read
// calendarView.cycleLens, prefs.canSeeWeekBand / canSeeCycleDetails and the
// partner's own alertStyle · 부담 없이 · 잠금화면 숨김 as stored in settings —
// and it is pre-rendered: strings and small flags, nothing to compute on the
// other side, nothing to re-derive.
//
// Version 2 (Now 3 N20, 일주일 버티는 링크): one snapshot carries SEVEN days,
// today and the six after it (`days[]`, validUntil = today + 6), each built
// with buildPartnerDay for that date exactly as a same-day snapshot would be
// — so the page shows the entry for his own local date and keeps working
// while her phone stays closed. Two rules keep a pre-computed day from saying
// more than that day itself would (docs/positioning.md §4 규칙 1: 화면이
// 바뀌는 것도 정보):
//   • a future day never shows a change that only a PREDICTED period would
//     bring: from the day the phase would turn 'late' (the period was due and
//     she logged nothing) the entry holds the previous day's card, band and
//     ideas (forecastHold) — a details-sharing partner never meets
//     'late-shared' ahead of time, nobody's band vanishes on the due day;
//   • everything else on a future day is what that day's own snapshot would
//     carry from the same records (tests/partnerSnapshot.test.ts compares the
//     two, day by day, through every lens) — no untold event, no owner-only
//     record, nothing beyond the lens.
//
// What one day holds:
//   • names and avatars, 함께한 지 D+N (cover.coverView — none on quiet days)
//   • the moment card exactly as ttcMoment words it for the partner: eyebrow /
//     title / body / note / 오늘 해 줄 수 있는 것, and the action LABELS only
//   • the shared "우리의 주간" band — cycleStrip in 'weeks' mode, and never the
//     cycle ring: even when she shares details in the app, the link carries no
//     period day, no LH mark and no cycle day number (linkState below)
//   • two date ideas inside the 우리의 주간 card (titles, map links) when the
//     card shows them (ttcMoment.dateIdeas — dateIdeas.fertileHintsAllowed)
//   • his 이번 달 할 일 (partnerTrack.monthlyTask) unless it rests (after a
//     loss — the home's own rule), leading the page in the link's first two
//     weeks while it is the 신청 step (N22); his own checks with that day's
//     done state, the signal waiting for his answer with its replies, her
//     progress line (numbers only — no item names), and the cover photo's id
//     ONLY when she opted in (prefs.coverOnLink)
//   • '이번 주 우리 둘' (N21, weekTogether): the week's three picks (ids and
//     words), his pick and [했어요], 내 준비 (his habit timer, his complete
//     days this week, his 검사 chain so far — each only when there is
//     something: no zeros), and her [고마워요] of this week
// What it never holds, by construction (tests/partnerSnapshot.test.ts walks
// every lens × moment × day): period dates, LH results, pregnancy tests,
// personalLog, '나만 보기' entries, 관계일, treatment notes, positivePending /
// bleeding, a cycle day when not shared, a banned word. The AppState never
// goes anywhere: this is a projection for one viewer, not a sync. For the
// owner herself it is null — her own view is never published.
//
// Events back (N20): his taps are applied on her phone by the moment the
// transport took them in (applyReceivedEvents — receivedAt, not her 'today'),
// so a reply sent on Monday still counts when she opens on Thursday.

import { BUDGET_META, DATE_IDEAS } from '../content/dateIdeas'
import { addDays, diffDays, formatShort, isISODate } from '../dates'
import type { ReceivedEvent } from '../sync/transport'
import type { AppState, CheckKind, ISODate, ISODateTime, MemberId, Role, Stage } from '../types'
import { activeItems, isDone, isWeekly, mondayOf, nudgeableItem, weekCount, weeklyDone } from './checks'
import { coverView, heroLine, type HeroLine } from './cover'
import { describeStrip } from './cycleRing'
import { fertileHintsAllowed, mapLinks, pickIdeas, recentlyPlannedIdeaIds } from './dateIdeas'
import { canNudge, localNowISO } from './notifications'
import { applyPartnerEvent, forgetOldEvents, type PartnerEvent } from './partnerEvents'
import {
  fertilityChain,
  monthlyTask,
  type ClaimDocState,
  type FertilityStep,
  type MonthlyTask,
  type TaskGuide,
  type TaskStage,
} from './partnerTrack'
import { canSeeWeekBand, coverOnLink, withShareLevelAtMost } from './prefs'
import type { ItemStatus } from './roadmap'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, signalById, signalIdOf, signalsFor, signalsSentToday, type Signal } from './signals'
import { habitTimer, rowProgress, stampOn } from './today'
import {
  PERIOD_PARTNER_TIP,
  cycleOwnerId,
  cycleStrip,
  partnerTaskVisible,
  ttcMoment,
  type CycleStrip,
  type MomentCopyKey,
  type MomentKind,
  type MomentTone,
} from './ttcFlow'
import { thanksThisWeek, weekDone, weekOf, weekOptions, weekPick, weekTogetherOn, type WeekOptionId } from './weekTogether'

export const PARTNER_SNAPSHOT_VERSION = 2 as const
/** Days one snapshot carries: today and the six after it (N20). */
export const SNAPSHOT_DAYS = 7
/** validUntil = today + this: after it the page shows the calm '다시 채워져요' view. */
export const SNAPSHOT_VALID_DAYS = SNAPSHOT_DAYS - 1
/** Ideas inside the 우리의 주간 card — the same two the home shows (components/today/OurWeekIdeas). */
export const LINK_DATE_IDEAS = 2
/** The link's first two weeks (from couple.link.createdAt): his 신청 step leads the page (N22). */
export const LINK_FIRST_WEEKS_DAYS = 14

export interface SnapshotMember {
  id: MemberId
  name: string
  emoji: string
  role: Role
}

/** The moment card's words — what the partner's screen renders, nothing of what sits behind it. */
export interface SnapshotMoment {
  copy: MomentCopyKey
  tone: MomentTone
  eyebrow?: string
  title: string
  body: string
  note?: string
  /** '오늘 해 줄 수 있는 것' on the card itself (period days 1–3). */
  partnerTip?: string
  /** Action labels only: the link has no log sheet and no tabs to open. */
  primary?: string
  secondary?: string
  /** 잠금화면 숨김을 홈 카드까지 (his own choice): the page shows VEIL_COPY until he taps. */
  veiled: boolean
  /** After a loss: the quiet support list (ttcFlow.LOSS_SUPPORT, static content). */
  support: boolean
  /** The card features his month task (else it sits in 우리 한 줄). */
  monthlyTask: boolean
}

export interface SnapshotIdea {
  id: string
  emoji: string
  title: string
  duration: string
  /** '₩' · '₩₩' · '₩₩₩' */
  budget: string
  kakao: string
  naver: string
}

export interface SnapshotTask {
  id: string
  title: string
  status: ItemStatus
  step?: Exclude<FertilityStep, 'done'>
  stage?: TaskStage
  dueBy?: ISODate
  dueText?: string
  why?: string
  tip?: string
  guide?: TaskGuide
  docs?: ClaimDocState[]
  link?: { label: string; url: string }
  /** His booked test: the day, the time and the place — never the note. */
  appointment?: { id: string; date: ISODate; time?: string; place?: string }
  top: boolean
  defaultDoneAt: ISODate
  minDoneAt?: ISODate
}

export interface SnapshotCheck {
  id: string
  label: string
  kind: CheckKind
  note?: string
  weekly: boolean
  /** Daily: checked that day. Weekly: checked any day of that week. */
  done: boolean
}

export interface SnapshotChecks {
  items: SnapshotCheck[]
  done: number
  total: number
  complete: boolean
  /** '이번 주 N/7' */
  week: number
}

export interface SnapshotSignal {
  /** The catalogue id (signals.signalById); undefined for an unknown old one. */
  signalId?: string
  emoji?: string
  text: string
  from: MemberId
  at: ISODateTime
  replies: Signal[]
  /** '해 줄 말' under '이번 달은 아니었어요' (ttcFlow.PERIOD_PARTNER_TIP). */
  tip?: string
}

/** Her line in 우리 한 줄: numbers only — her item names stay in the app. */
export interface SnapshotOwnerLine {
  name: string
  done: number
  total: number
  complete: boolean
  /** 콕 is offered: she takes nudges (acceptNudges), one is left that day, and she has an unchecked item. */
  canNudge: boolean
}

export type SnapshotStrip = CycleStrip & { mode: 'weeks'; label: string }

/** One of the week's three picks (weekTogether.WEEK_OPTIONS — relationship-side words, no health content). */
export interface SnapshotWeekOption {
  id: WeekOptionId
  text: string
}

/**
 * 내 준비 — his own progress in one line, each part only when there is
 * something to say (규칙 2: no zeros, no '안 했어요').
 */
export interface SnapshotPrep {
  /** The habit timer while it counts ('D+40'; today.habitTimer). */
  habit?: string
  /** The timer has passed its ~3 months. */
  habitReached?: boolean
  /** Days this week his daily checks were all done (1–7). */
  week?: number
  /** His 검사 chain so far, once a step is done ('신청했어요, 다음은 검사'). */
  chain?: string
}

/** '이번 주 우리 둘' on his side (N21). Absent outside the preparing stage and in the quiet after a loss. */
export interface SnapshotWeek {
  /** The week's Monday (weekTogether.weekOf). */
  monday: ISODate
  /** The three picks offered this week. */
  options: SnapshotWeekOption[]
  /** What he picked (one of `options`). */
  pick?: WeekOptionId
  /** He said [했어요] this week. */
  done: boolean
  /** How the pick reads once done ('저녁 한 번 차렸어요'). */
  doneText?: string
  /** The day she said [고마워요] this week — kept on his card for the rest of the week. */
  thanks?: ISODate
  prep?: SnapshotPrep
}

/** Everything the page shows for one date. */
export interface PartnerDay {
  date: ISODate
  /** 함께한 지 N일; null without a met day or on quiet days. */
  together: number | null
  /** The cover's one line (cover.heroLine) — never the greeting (that is the page's clock) nor a memory (its entry is not here). */
  line?: { kind: Exclude<HeroLine['kind'], 'greeting' | 'memory'>; text: string }
  /** Only with her opt-in (prefs.coverOnLink) and when his own phone would show the photo (coverView). */
  cover?: { photoId: string; focusY: number; caption?: string }
  /** null outside the preparing stage (ttcMoment). */
  moment: SnapshotMoment | null
  strip: SnapshotStrip | null
  /** Inside the 우리의 주간 card; [] when the card has no ideas. */
  ideas: SnapshotIdea[]
  task?: SnapshotTask
  checks: SnapshotChecks
  signal?: SnapshotSignal
  signalsLeft: number
  owner: SnapshotOwnerLine
  week?: SnapshotWeek
}

export interface PartnerSnapshot {
  version: typeof PARTNER_SNAPSHOT_VERSION
  /** The day her phone built it (days[0].date). */
  today: ISODate
  /** today + SNAPSHOT_VALID_DAYS: the last date it has an entry for. */
  validUntil: ISODate
  stage: Stage
  /** The partner the link is for. */
  viewer: MemberId
  cycleOwner: MemberId
  members: [SnapshotMember, SnapshotMember]
  /** The signals he may send (signals.signalsFor for the partner). */
  signals: Signal[]
  /** today … validUntil, one entry per date, in order. */
  days: PartnerDay[]
}

/** One date of a snapshot with the snapshot's shared fields — what the page (and a preview) draws. */
export type PartnerPage = Omit<PartnerSnapshot, 'days'> & PartnerDay

/**
 * The state the link's strip is read from: the shared band only (at most
 * 우리의 주간), as for a partner she shares no details with — and nothing at all
 * when she chose 날짜 없음 (the level is never widened). Everything else (the
 * moment card) reads the settings as stored — what she shares in the app
 * stays in the app.
 */
export function linkState(state: AppState): AppState {
  return withShareLevelAtMost(state, 'week')
}

function member(state: Pick<AppState, 'couple'>, id: MemberId): SnapshotMember {
  const m = state.couple.members.find((x) => x.id === id) ?? state.couple.members[0]
  return { id: m.id, name: m.name, emoji: m.emoji, role: m.role }
}

/** The ideas inside the 우리의 주간 card, as components/today/OurWeekIdeas picks them. */
export function linkIdeas(state: AppState, today: ISODate, viewer: MemberId): SnapshotIdea[] {
  if (!fertileHintsAllowed(state, viewer, today)) return []
  const picks = pickIdeas(
    DATE_IDEAS.filter((i) => !/박/.test(i.duration)),
    { today, stage: state.stage, excludeIds: recentlyPlannedIdeaIds(state.datePlans, today), count: LINK_DATE_IDEAS },
  )
  return picks.map((idea) => {
    const links = mapLinks(idea.mapQuery)
    return {
      id: idea.id,
      emoji: idea.emoji,
      title: idea.title,
      duration: idea.duration,
      budget: BUDGET_META[idea.budget].symbol,
      kakao: links.kakao,
      naver: links.naver,
    }
  })
}

function snapshotTask(t: MonthlyTask, top: boolean): SnapshotTask {
  const a = t.appointment
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    ...(t.step ? { step: t.step } : {}),
    ...(t.stage ? { stage: t.stage } : {}),
    ...(t.dueBy ? { dueBy: t.dueBy } : {}),
    ...(t.dueText ? { dueText: t.dueText } : {}),
    ...(t.why ? { why: t.why } : {}),
    ...(t.tip ? { tip: t.tip } : {}),
    ...(t.guide ? { guide: { ...t.guide } } : {}),
    ...(t.docs ? { docs: t.docs.map((d) => ({ ...d })) } : {}),
    ...(t.link ? { link: { ...t.link } } : {}),
    ...(a ? { appointment: { id: a.id, date: a.date, ...(a.time ? { time: a.time } : {}), ...(a.place ? { place: a.place } : {}) } } : {}),
    top,
    defaultDoneAt: t.defaultDoneAt,
    ...(t.minDoneAt ? { minDoneAt: t.minDoneAt } : {}),
  }
}

/**
 * Does his month task show on `day`? The home's own rule, one function for
 * both (ttcFlow.partnerTaskVisible: never through the quiet after a
 * pregnancy ended — that time is for each other, not for tasks; N19 ②).
 */
export function linkTaskVisible(state: AppState, day: ISODate, partner: MemberId): boolean {
  return partnerTaskVisible(state, day, partner)
}

/** The link's first two weeks: from the day she made it (couple.link.createdAt), LINK_FIRST_WEEKS_DAYS days. */
export function linkFirstWeeks(state: Pick<AppState, 'couple'>, day: ISODate): boolean {
  const made = state.couple.link?.createdAt?.slice(0, 10)
  if (!made || !isISODate(made) || day < made) return false
  return diffDays(made, day) < LINK_FIRST_WEEKS_DAYS
}

/** His 검사 chain in a few words, once a step is done (partnerTrack.fertilityChain). */
export function prepChainText(state: AppState, day: ISODate, partner: MemberId): string | undefined {
  const c = fertilityChain(state, day, partner)
  if (c.step === 'apply') return undefined
  if (c.step === 'test') return '신청했어요, 다음은 검사'
  if (c.step === 'claim') return '검사 받았어요, 다음은 청구'
  if (c.appliedAt && c.testedAt && c.claimedAt) return '신청·검사·청구를 마쳤어요'
  if (c.appliedAt && c.testedAt) return '신청·검사를 마쳤어요'
  return c.testedAt ? '검사 받았어요' : undefined
}

/** 내 준비 for `day` — undefined when every part would be empty. */
export function linkPrep(state: AppState, day: ISODate, partner: MemberId, withChain: boolean): SnapshotPrep | undefined {
  const t = habitTimer(state, partner, day)
  const week = weekCount(state, partner, day)
  const chain = withChain ? prepChainText(state, day, partner) : undefined
  const prep: SnapshotPrep = {
    ...(t.state !== 'not-started' ? { habit: t.label } : {}),
    ...(t.state === 'reached' ? { habitReached: true } : {}),
    ...(week > 0 ? { week } : {}),
    ...(chain ? { chain } : {}),
  }
  return Object.keys(prep).length ? prep : undefined
}

/** '이번 주 우리 둘' for `day`, or undefined when the week rests (weekTogether.weekOptions is empty). */
export function linkWeek(state: AppState, day: ISODate, partner: MemberId, withChain: boolean): SnapshotWeek | undefined {
  const options = weekOptions(state, day, partner)
  if (!options.length) return undefined
  const monday = weekOf(day)
  const pick = weekPick(state, monday, partner)
  const doneOn = weekDone(state, monday, partner)
  const done = !!pick && doneOn !== undefined && doneOn <= day
  const thanks = thanksThisWeek(state, partner, day)
  const prep = linkPrep(state, day, partner, withChain)
  return {
    monday,
    options: options.map((o) => ({ id: o.id, text: o.text })),
    ...(pick ? { pick: pick.id } : {}),
    done,
    ...(done && pick ? { doneText: pick.doneText } : {}),
    ...(thanks ? { thanks: thanks.day } : {}),
    ...(prep ? { prep } : {}),
  }
}

/** One date as the page shows it, and the moment's phase (for the forecast rule). */
function dayOf(state: AppState, date: ISODate, partner: MemberId, owner: MemberId): { day: PartnerDay; kind: MomentKind | undefined } {
  // The moment card, word for word (ttcMoment applies the partner's lens:
  // homeVoice, canSeeCycleDetails, fertileHintsAllowed, homeDiscreetFor) —
  // on the 'link' surface, where a sentence that points to 설정 is reworded.
  const m = ttcMoment(state, date, partner, { surface: 'link' })
  const moment: SnapshotMoment | null = m
    ? {
        copy: m.copy,
        tone: m.tone,
        ...(m.eyebrow ? { eyebrow: m.eyebrow } : {}),
        title: m.title,
        body: m.body,
        ...(m.note ? { note: m.note } : {}),
        ...(m.partnerTip ? { partnerTip: m.partnerTip } : {}),
        ...(m.primary ? { primary: m.primary.label } : {}),
        ...(m.secondary ? { secondary: m.secondary.label } : {}),
        veiled: !!m.veiled,
        support: !!m.support,
        monthlyTask: !!m.monthlyTask,
      }
    : null

  // The shared band only (linkState): 'weeks' mode or nothing — and nothing at
  // all when she shares no dates (날짜 없음: prefs.canSeeWeekBand), whatever the
  // lenses upstream say.
  const band = canSeeWeekBand(state, partner)
  const raw = band ? cycleStrip(linkState(state), date, partner) : null
  const strip: SnapshotStrip | null = raw && raw.mode === 'weeks' ? { ...raw, mode: 'weeks', label: describeStrip(raw) } : null

  const ideas = band && m?.dateIdeas ? linkIdeas(state, date, partner) : []

  const taskShown = linkTaskVisible(state, date, partner)
  const task = taskShown ? monthlyTask(state, date, partner) : undefined
  // The link's first two weeks: the 신청 step leads the page (review-realuse D-3).
  const top = !!task && (task.top || (task.step === 'apply' && linkFirstWeeks(state, date)))

  const items = activeItems(state, partner)
  const prog = rowProgress(state, partner, date)
  const checks: SnapshotChecks = {
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      ...(i.note ? { note: i.note } : {}),
      weekly: isWeekly(i),
      done: isWeekly(i) ? weeklyDone(state, partner, i.id, date) : isDone(state, partner, date, i.id),
    })),
    done: prog.done,
    total: prog.total,
    complete: prog.complete,
    week: weekCount(state, partner, date),
  }

  const pending = pendingSignal(state, partner, date)
  const pendingId = pending ? signalIdOf(pending) : undefined
  const pendingSig = pendingId ? signalById(pendingId) : undefined
  const signal: SnapshotSignal | undefined = pending
    ? {
        ...(pendingId ? { signalId: pendingId } : {}),
        ...(pendingSig ? { emoji: pendingSig.emoji } : {}),
        text: pendingSig?.text ?? pending.title,
        from: pending.from ?? owner,
        at: pending.createdAt,
        replies: repliesFor(pendingId).map((r) => ({ ...r })),
        ...(pendingId === 'not-this-month' ? { tip: PERIOD_PARTNER_TIP } : {}),
      }
    : undefined

  const ownerProg = rowProgress(state, owner, date)
  const ownerLine: SnapshotOwnerLine = {
    name: member(state, owner).name,
    done: ownerProg.done,
    total: ownerProg.total,
    complete: ownerProg.complete,
    canNudge: !!nudgeableItem(state, owner, date) && canNudge(state, partner, owner, date),
  }

  const view = coverView(state, partner, date)
  const cover = coverOnLink(state.settings) && view.mode === 'photo' && view.photo ? { ...view.photo } : undefined

  // The hour only picks the greeting, which the page makes from its own clock.
  const hero = heroLine(state, date, partner, 12)
  const line = hero.kind === 'greeting' || hero.kind === 'memory' ? undefined : { kind: hero.kind, text: hero.text }

  const week = linkWeek(state, date, partner, taskShown)

  const day: PartnerDay = {
    date,
    together: view.together,
    ...(line ? { line } : {}),
    ...(cover ? { cover } : {}),
    moment,
    strip,
    ideas,
    ...(task ? { task: snapshotTask(task, top) } : {}),
    checks,
    ...(signal ? { signal } : {}),
    signalsLeft: Math.max(0, SIGNALS_PER_DAY - signalsSentToday(state, partner, date)),
    owner: ownerLine,
    ...(week ? { week } : {}),
  }
  return { day, kind: m?.kind }
}

/**
 * One date of the partner's page, exactly as a snapshot built on that date
 * carries it (days[0]). Null for the cycle owner. Pure and deterministic.
 */
export function buildPartnerDay(state: AppState, date: ISODate, partner: MemberId): PartnerDay | null {
  const owner = cycleOwnerId(state)
  if (partner === owner) return null
  return dayOf(state, date, partner, owner).day
}

/**
 * The previous day's band moved on to `date`: the same days with today's
 * mark moved; into a new week, the band's second week becomes the first and
 * the days after it carry no band (the next window is never drawn ahead).
 */
export function holdStrip(prev: SnapshotStrip | null, date: ISODate): SnapshotStrip | null {
  if (!prev || !prev.days.length) return prev
  const start = mondayOf(date)
  const tone = new Map(prev.days.map((d) => [d.date, d]))
  const days = Array.from({ length: prev.days.length }, (_, i) => {
    const d = addDays(start, i)
    const was = tone.get(d)
    return { date: d, tone: was?.tone ?? 'none', level: was?.level ?? 0, today: d === date }
  })
  const held: CycleStrip & { mode: 'weeks' } = {
    ...prev,
    mode: 'weeks',
    days,
    todayIndex: diffDays(start, date),
    startLabel: formatShort(start),
    endLabel: formatShort(addDays(start, prev.days.length - 1)),
    hasWindow: days.some((d) => d.tone !== 'none'),
  }
  return { ...held, label: describeStrip(held) }
}

/**
 * Should the entry for a future day hold the day before it? Only when that
 * day's phase is 'late' — the period was due and nothing was logged — and
 * today's is not: a change that a prediction alone would bring is never
 * pre-rendered (a late period that has already begun is today's, and the
 * same on every day after). The one exception is the day after the quiet
 * following a loss: its support card is not carried on; that day reads as
 * for a partner without her details instead (buildPartnerSnapshot).
 */
export function forecastHold(todayKind: MomentKind | undefined, dayKind: MomentKind | undefined): boolean {
  return dayKind === 'late' && todayKind !== 'late'
}

/**
 * The partner's page for today and the six days after it, computed on the
 * owner's phone. `partner` must be the member who does NOT track the cycle:
 * for the owner it is null — her own view is never published. Pure and
 * deterministic for (state, today).
 */
export function buildPartnerSnapshot(state: AppState, today: ISODate, partner: MemberId): PartnerSnapshot | null {
  const owner = cycleOwnerId(state)
  if (partner === owner) return null

  const built = Array.from({ length: SNAPSHOT_DAYS }, (_, k) => dayOf(state, addDays(today, k), partner, owner))
  const todayKind = built[0]!.kind
  const days: PartnerDay[] = []
  built.forEach(({ day, kind }, k) => {
    const prev = days[k - 1]
    if (k > 0 && prev && forecastHold(todayKind, kind)) {
      if (prev.moment?.support) {
        // The quiet after a loss has just ended (a known day, not a prediction):
        // never carry its card past the end — the day reads as for a partner
        // without her details ('평소 주'), so a late period still shows nothing.
        const plain = dayOf(linkState(state), day.date, partner, owner).day
        days.push({ ...day, moment: plain.moment, ideas: [] })
      } else days.push({ ...day, moment: prev.moment, strip: holdStrip(prev.strip, day.date), ideas: prev.ideas })
    } else days.push(day)
  })

  return {
    version: PARTNER_SNAPSHOT_VERSION,
    today,
    validUntil: addDays(today, SNAPSHOT_VALID_DAYS),
    stage: state.stage,
    viewer: partner,
    cycleOwner: owner,
    members: [member(state, 'a'), member(state, 'b')],
    signals: signalsFor(state.stage, false).map((s) => ({ ...s })),
    days,
  }
}

/** A link shows a snapshot only while it is current: today on or before `validUntil`, and this version. */
export function snapshotUsable(snapshot: Pick<PartnerSnapshot, 'version' | 'validUntil'> | null | undefined, today: ISODate): boolean {
  return !!snapshot && snapshot.version === PARTNER_SNAPSHOT_VERSION && today <= snapshot.validUntil
}

/**
 * The page for `today` (his own local date): that date's entry; before the
 * first one (his clock behind hers) the first; null once the snapshot is not
 * usable (after validUntil, another version) or has no days.
 */
export function snapshotDay(snapshot: PartnerSnapshot | null | undefined, today: ISODate): PartnerPage | null {
  if (!snapshot || !snapshotUsable(snapshot, today) || !Array.isArray(snapshot.days) || !snapshot.days.length) return null
  const day = snapshot.days.find((d) => d.date === today) ?? (today < snapshot.days[0]!.date ? snapshot.days[0] : undefined)
  if (!day) return null
  const { days: _days, ...shared } = snapshot
  return { ...shared, ...day }
}

// ── Events back, by the moment they were taken in (N20) ─────

/**
 * The local day an event was taken in (its receivedAt — the mock's stamp or
 * the server's created_at, read in this device's time zone), kept between
 * `today - backDays` and `today`: a transport clock ahead of hers counts as
 * today, a very old one as the oldest day the pull window holds.
 */
export function eventDay(receivedAt: string, today: ISODate, backDays = 7): ISODate {
  let day: string | undefined
  const t = Date.parse(receivedAt)
  if (Number.isFinite(t) && /T\d{2}:\d{2}/.test(receivedAt)) day = localNowISO(new Date(t)).slice(0, 10)
  else if (isISODate(receivedAt.slice(0, 10))) day = receivedAt.slice(0, 10)
  if (!day || !isISODate(day) || day > today) return today
  const floor = addDays(today, -backDays)
  return day < floor ? floor : day
}

/** The local stamp an applied event's notices get: the moment it was taken in, on its day (else stampOn(day)). */
function eventStamp(receivedAt: string, day: ISODate): string {
  const t = Date.parse(receivedAt)
  if (Number.isFinite(t) && /T\d{2}:\d{2}/.test(receivedAt)) {
    const local = localNowISO(new Date(t))
    if (local.slice(0, 10) === day) return local
  }
  return stampOn(day)
}

const WEEK_KINDS: ReadonlySet<PartnerEvent['kind']> = new Set(['week-pick', 'week-done'])

/**
 * The day an event is judged on: the day it was taken in (eventDay); for an
 * event dated later than that (his phone's clock, or a demo's `?today=` pin,
 * ahead of the transport's) its own date, never past her `today` — what the
 * one-day rule allowed before, and still nothing from the future.
 */
export function judgedDay(r: ReceivedEvent, today: ISODate): ISODate {
  const day = eventDay(r.receivedAt, today)
  const own = 'date' in r.event && isISODate(r.event.date) ? r.event.date : undefined
  return own && own > day && own <= today ? own : day
}

/**
 * Apply what the transport took in, each event on the day it arrived
 * (judgedDay) rather than on her `today`: a reply to her signal, a check, a
 * 콕 sent while her phone was closed is judged as of that day — the signal was
 * still waiting, the check was within its week — so opening the app three
 * days later loses nothing (partnerEvents.applyPartnerEvent's own gates and
 * once-per-id rule, unchanged). '이번 주 우리 둘' taps also need her today to
 * be outside the quiet (a tap from before a loss is not applied inside it).
 * The same object when nothing applied.
 */
export function applyReceivedEvents(state: AppState, received: readonly ReceivedEvent[], today: ISODate): AppState {
  let s = state
  for (const r of received) {
    if (WEEK_KINDS.has(r.event.kind) && !weekTogetherOn(s, today)) continue
    const day = judgedDay(r, today)
    s = applyPartnerEvent(s, r.event, day, eventStamp(r.receivedAt, day))
  }
  return s === state ? state : forgetOldEvents(s, today)
}
