// The partner snapshot — the ONLY thing the owner's phone ever publishes for
// the no-install partner link (Next A ①, docs/review-realuse.md 다음 단계 5:
// 남편이 보는 건 우리의 주간 띠 · 이번 달 할 일 · 신호 답장 · 콕/응원뿐).
//
// It is computed on the OWNER's phone through the same lenses the in-app
// partner screen uses — ttcFlow.ttcMoment / cycleStrip, which read
// calendarView.cycleLens, prefs.canSeeCycleDetails and the partner's own
// alertStyle · 부담 없이 · 잠금화면 숨김 as stored in settings — and it is
// pre-rendered: strings and small flags, nothing to compute on the other
// side, nothing to re-derive. What it holds:
//   • names and avatars, 함께한 지 D+N (cover.coverView — none on quiet days)
//   • the moment card exactly as ttcMoment words it for the partner: eyebrow /
//     title / body / note / 오늘 해 줄 수 있는 것, and the action LABELS only
//   • the shared "우리의 주간" band — cycleStrip in 'weeks' mode, and never the
//     cycle ring: even when she shares details in the app, the link carries no
//     period day, no LH mark and no cycle day number (linkState below)
//   • two date ideas inside the 우리의 주간 card (titles, map links) when the
//     card shows them (ttcMoment.dateIdeas — dateIdeas.fertileHintsAllowed)
//   • his 이번 달 할 일 (partnerTrack.monthlyTask), his own checks with
//     today's done state, the signal waiting for his answer with its replies,
//     her progress line (numbers only — no item names), and the cover photo's
//     id ONLY when she opted in (prefs.coverOnLink)
//   • version and validUntil (today + SNAPSHOT_VALID_DAYS): a stale link shows nothing
// What it never holds, by construction (tests/partnerSnapshot.test.ts walks
// every lens × moment): period dates, LH results, pregnancy tests, personalLog,
// '나만 보기' entries, 관계일, treatment notes, positivePending / bleeding, a
// cycle day when not shared, a banned word. The AppState never goes anywhere:
// this is a projection for one viewer, not a sync. For the owner herself it is
// null — her own view is never published.

import { BUDGET_META, DATE_IDEAS } from '../content/dateIdeas'
import { addDays } from '../dates'
import type { AppState, CheckKind, ISODate, ISODateTime, MemberId, Role, Stage } from '../types'
import { activeItems, isDone, isWeekly, nudgeableItem, weekCount, weeklyDone } from './checks'
import { coverView, heroLine, type HeroLine } from './cover'
import { describeStrip } from './cycleRing'
import { fertileHintsAllowed, mapLinks, pickIdeas, recentlyPlannedIdeaIds } from './dateIdeas'
import { canNudge } from './notifications'
import { monthlyTask, type ClaimDocState, type FertilityStep, type MonthlyTask, type TaskGuide, type TaskStage } from './partnerTrack'
import { coverOnLink } from './prefs'
import type { ItemStatus } from './roadmap'
import { SIGNALS_PER_DAY, pendingSignal, repliesFor, signalById, signalIdOf, signalsFor, signalsSentToday, type Signal } from './signals'
import { rowProgress } from './today'
import { PERIOD_PARTNER_TIP, cycleOwnerId, cycleStrip, ttcMoment, type CycleStrip, type MomentCopyKey, type MomentTone } from './ttcFlow'

export const PARTNER_SNAPSHOT_VERSION = 1 as const
/** A snapshot is good for today and tomorrow; after that the link shows nothing. */
export const SNAPSHOT_VALID_DAYS = 1
/** Ideas inside the 우리의 주간 card — the same two the home shows (components/today/OurWeekIdeas). */
export const LINK_DATE_IDEAS = 2

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
  /** Daily: checked today. Weekly: checked any day this week. */
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
  /** 콕 is offered: she takes nudges (acceptNudges), one is left today, and she has an unchecked item. */
  canNudge: boolean
}

export type SnapshotStrip = CycleStrip & { mode: 'weeks'; label: string }

export interface PartnerSnapshot {
  version: typeof PARTNER_SNAPSHOT_VERSION
  today: ISODate
  validUntil: ISODate
  stage: Stage
  /** The partner the link is for. */
  viewer: MemberId
  cycleOwner: MemberId
  members: [SnapshotMember, SnapshotMember]
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
  /** The signals he may send (signals.signalsFor for the partner). */
  signals: Signal[]
  signalsLeft: number
  owner: SnapshotOwnerLine
}

/**
 * The state the link's strip is read from: the shared band only, as for a
 * partner she shares no details with. Everything else (the moment card) reads
 * the settings as stored — what she shares in the app stays in the app.
 */
export function linkState(state: AppState): AppState {
  if (state.settings.shareCycleDetails !== true) return state
  return { ...state, settings: { ...state.settings, shareCycleDetails: false } }
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

function snapshotTask(t: MonthlyTask): SnapshotTask {
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
    top: t.top,
    defaultDoneAt: t.defaultDoneAt,
    ...(t.minDoneAt ? { minDoneAt: t.minDoneAt } : {}),
  }
}

/**
 * The partner's page, computed on the owner's phone. `partner` must be the
 * member who does NOT track the cycle: for the owner it is null — her own
 * view is never published. Pure and deterministic for (state, today).
 */
export function buildPartnerSnapshot(state: AppState, today: ISODate, partner: MemberId): PartnerSnapshot | null {
  const owner = cycleOwnerId(state)
  if (partner === owner) return null

  // The moment card, word for word (ttcMoment applies the partner's lens:
  // homeVoice, canSeeCycleDetails, fertileHintsAllowed, homeDiscreetFor) —
  // on the 'link' surface, where a sentence that points to 설정 is reworded.
  const m = ttcMoment(state, today, partner, { surface: 'link' })
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

  // The shared band only (linkState): 'weeks' mode or nothing.
  const raw = cycleStrip(linkState(state), today, partner)
  const strip: SnapshotStrip | null = raw && raw.mode === 'weeks' ? { ...raw, mode: 'weeks', label: describeStrip(raw) } : null

  const ideas = m?.dateIdeas ? linkIdeas(state, today, partner) : []

  const task = monthlyTask(state, today, partner)

  const items = activeItems(state, partner)
  const prog = rowProgress(state, partner, today)
  const checks: SnapshotChecks = {
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      kind: i.kind,
      ...(i.note ? { note: i.note } : {}),
      weekly: isWeekly(i),
      done: isWeekly(i) ? weeklyDone(state, partner, i.id, today) : isDone(state, partner, today, i.id),
    })),
    done: prog.done,
    total: prog.total,
    complete: prog.complete,
    week: weekCount(state, partner, today),
  }

  const pending = pendingSignal(state, partner, today)
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

  const ownerProg = rowProgress(state, owner, today)
  const ownerLine: SnapshotOwnerLine = {
    name: member(state, owner).name,
    done: ownerProg.done,
    total: ownerProg.total,
    complete: ownerProg.complete,
    canNudge: !!nudgeableItem(state, owner, today) && canNudge(state, partner, owner, today),
  }

  const view = coverView(state, partner, today)
  const cover = coverOnLink(state.settings) && view.mode === 'photo' && view.photo ? { ...view.photo } : undefined

  // The hour only picks the greeting, which the page makes from its own clock.
  const hero = heroLine(state, today, partner, 12)
  const line = hero.kind === 'greeting' || hero.kind === 'memory' ? undefined : { kind: hero.kind, text: hero.text }

  return {
    version: PARTNER_SNAPSHOT_VERSION,
    today,
    validUntil: addDays(today, SNAPSHOT_VALID_DAYS),
    stage: state.stage,
    viewer: partner,
    cycleOwner: owner,
    members: [member(state, 'a'), member(state, 'b')],
    together: view.together,
    ...(line ? { line } : {}),
    ...(cover ? { cover } : {}),
    moment,
    strip,
    ideas,
    ...(task ? { task: snapshotTask(task) } : {}),
    checks,
    ...(signal ? { signal } : {}),
    signals: signalsFor(state.stage, false).map((s) => ({ ...s })),
    signalsLeft: Math.max(0, SIGNALS_PER_DAY - signalsSentToday(state, partner, today)),
    owner: ownerLine,
  }
}

/** A link shows a snapshot only while it is current: today on or before `validUntil`, and this version. */
export function snapshotUsable(snapshot: Pick<PartnerSnapshot, 'version' | 'validUntil'> | null | undefined, today: ISODate): boolean {
  return !!snapshot && snapshot.version === PARTNER_SNAPSHOT_VERSION && today <= snapshot.validUntil
}
