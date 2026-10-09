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
//     words), his pick and [했어요], and her [고마워요] of this week
//   • 내 준비 (N30, myPrep): his habit timer, this week's N/7 and his 검사
//     chain step — read from his own records only, each part only when it
//     has something to say (no zeros); the page draws it as a bar under the
//     week card. (Snapshots from before N30 carried a shorter `week.prep`.)
//   • 병원과 함께일 때 (N32, linkClinic): while the couple's clinic mode is on,
//     the appointments of the next seven days that are HIS or '둘이 함께' —
//     the day, the time, the place and a kind word ('검사', '병원 진료'), never
//     the title, the note, a treatment or a count — each with whether he has
//     said [같이 갈게요], plus one line about 난임치료휴가 with its source
//     (docs/research/kr-programs.json). Only appointments the two of them put
//     in: nothing here finds or suggests a hospital (positioning §6).
//   • 같이 챙길 것 (founder request 2026-10-09: "여자가 챙겨야 할 것들을 남자에게도
//     계속 보여줘야해 같이 하는거야", `togetherPlan`): her roadmap items and the
//     shared ones of the near term, exactly as together.linkTogether gives
//     them — the catalogue title, a NEUTRAL status ('예정 · 10월 21일' /
//     '이번 주' / '했어요 ✓' — never '기한 지남' about her: a passed deadline
//     simply leaves the list), his support line and whether he said [같이
//     할게요] (a 'support' event back). Roadmap items only (the couple's own
//     items have free-text titles); while pregnant / parenting a booked
//     appointment gives its DAY only. In every stage, never in the quiet.
//   • the pregnant stage card (`stageCard`): '임신 N주 M일', the trimester,
//     '예정일 … (예상)' and D-N — pregnancy weeks and the due date are known to
//     both once she switched the stage — and his next shared checkup within
//     two weeks (her own or '둘이 함께', a visit / test / shot): the day, the
//     catalogue name of the item it is for or a kind word, and what he does
//     that day. The time and place only for one they go to together (as his
//     clinic week); never the title or the note of an appointment.
//   • while pregnant, '이번 주 우리 둘' runs from its own catalogue
//     (weekTogether) and 내 준비 lists his own pregnancy-stage items
//     (myPrep `items`: 배우자 지원 제도 … 배우자 출산휴가 20일).
// What it never holds, by construction (tests/partnerSnapshot.test.ts walks
// every lens × moment × day): period dates, LH results, pregnancy tests,
// personalLog, '나만 보기' entries, 관계일, treatment notes or counts,
// appointment titles and notes, her own appointments, positivePending /
// bleeding, a cycle day when not shared, a banned word. The AppState never
// goes anywhere: this is a projection for one viewer, not a sync. For the
// owner herself it is null — her own view is never published.
//
// Events back (N20): his taps are applied on her phone by the moment the
// transport took them in (applyReceivedEvents — receivedAt, not her 'today'),
// so a reply sent on Monday still counts when she opens on Thursday.

import { BUDGET_META, DATE_IDEAS } from '../content/dateIdeas'
import { addDays, dLabel, diffDays, formatKo, formatShort, isISODate } from '../dates'
import { isLive } from '../sync/model'
import type { ReceivedEvent } from '../sync/transport'
import type { AppState, AppointmentKind, CheckKind, ISODate, ISODateTime, MemberId, Role, Stage } from '../types'
import { templateById } from '../content/roadmap'
import { CLINIC_KIND_WORD, compareAppointments } from './appointments'
import { activeItems, isDone, isWeekly, mondayOf, nudgeableItem, weekCount, weeklyDone } from './checks'
import { coverView, heroLine, type HeroLine } from './cover'
import { describeStrip } from './cycleRing'
import { fertileHintsAllowed, mapLinks, partnerHintState, pickIdeas, recentlyPlannedIdeaIds } from './dateIdeas'
import { myPrep, type PrepItem } from './myPrep'
import { canNudge, localNowISO } from './notifications'
import { applyPartnerEvent, earliestDoneAt, forgetOldEvents, hasJoinedAppointment, type PartnerEvent } from './partnerEvents'
import {
  FERTILITY_APPLY_ID,
  fertilityChain,
  monthlyTask,
  type ClaimDocState,
  type FertilityStep,
  type MonthlyTask,
  type TaskGuide,
  type TaskStage,
} from './partnerTrack'
import { usablePregnancy } from './plan'
import { TOGETHER_VISIT_LINE, isForEndedPregnancy } from './planNotices'
import { canSeeWeekBand, coverOnLink, withShareLevelAtMost } from './prefs'
import { dueDate, formatGA, gestationalAge } from './pregnancy'
import type { ItemStatus } from './roadmap'
import {
  SIGNALS_PER_DAY,
  pendingSignal,
  receivedReply,
  repliesFor,
  sayForSignal,
  signalById,
  signalIdOf,
  signalsFor,
  signalsSentToday,
  type Signal,
} from './signals'
import { NEAR_DAYS, linkTogether, shortTitle, type LinkTogether } from './together'
import { TRIMESTER_LABEL, habitTimer, rowProgress, stampOn } from './today'
import { LEAVE_DAYS_PER_YEAR, PAID_LEAVE_CHANGE, PAID_LEAVE_DAYS } from './treatments'
import { activeRest } from './ttc'
import {
  PERIOD_PARTNER_TIP,
  cycleOwnerId,
  cycleStrip,
  partnerTaskVisible,
  ttcMoment,
  type CycleStrip,
  type Moment,
  type MomentCopyKey,
  type MomentKind,
  type MomentTone,
} from './ttcFlow'
import { thanksThisWeek, weekDone, weekOf, weekOptions, weekPick, weekQuiet, weekTogetherOn, type WeekOptionId } from './weekTogether'

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
  /**
   * 해 줄 말 · 아껴 둘 말 (N30) — only on a card she SENT ([알리기]: her period,
   * a positive test, bleeding after it; ttcFlow toldSay): the two lines, the
   * two answers he can send (as a 'signal' event — partnerEvents accepts
   * exactly these while the card stands), and the one he sent since she told.
   */
  say?: SnapshotSay & { replies: Signal[]; sent?: string }
}

/** 해 줄 말 · 아껴 둘 말 (signals.sayForTold / sayForSignal) — fixed catalogue lines, never her words. */
export interface SnapshotSay {
  say: string
  save: string
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
  /** '해 줄 말' under '이번 달은 아니었어요' (ttcFlow.PERIOD_PARTNER_TIP) — kept for pages that read only this. */
  tip?: string
  /** 해 줄 말 · 아껴 둘 말 for her signal (signals.sayForSignal, N30); the answers are `replies`. */
  say?: SnapshotSay
}

/**
 * Her answer to his last signal (signals.receivedReply — what the app's 우리 한
 * 줄 shows him): the reply's catalogue words, when, and the words of what it
 * answered. Only what she SENT; nothing inferred, nothing of her records.
 */
export interface SnapshotReply {
  emoji: string
  text: string
  from: MemberId
  at: ISODateTime
  /** The words of his signal it answers ('오늘 저녁은 내가 할게요'). */
  answered?: string
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

/**
 * 내 준비 as the page draws it (N30) — myPrep's words for his own progress,
 * each part only when it has something to say. Never empty when present.
 */
export interface SnapshotMyPrep {
  /** '생활 습관 D+40 · 약 3개월 중' / '생활 습관 약 3개월을 채웠어요'. */
  timerLabel?: string
  /** 0–1, with timerLabel. */
  timerProgress?: number
  /** '이번 주 3/7'. */
  weekCount?: string
  /** '신청 ✓ · 다음은 검사 예약' … — while pregnant, the line for his own items ('다음은 배우자 지원 제도 살펴보기'). */
  chainStep?: string
  /**
   * While pregnant: his own pregnancy-stage items in order (myPrep `items` —
   * 배우자 지원 제도 · 육아휴직 계획 · 카시트 · Tdap · 배우자 출산휴가 20일), each
   * with its state and the day its window opens / closes. His own, so nothing
   * of hers; absent while preparing.
   */
  items?: SnapshotPrepItem[]
}

/** One of his own pregnancy-stage items in 내 준비 (lib/logic/myPrep PrepItem). */
export type SnapshotPrepItem = PrepItem

/**
 * One appointment of the couple's own, as his clinic week shows it (N32):
 * the day, the time, the place and a kind word — never the title, the note,
 * a treatment or a count. Only his own and '둘이 함께' ones get here.
 */
export interface SnapshotAppointment {
  id: string
  date: ISODate
  time?: string
  place?: string
  /** '병원 진료' · '검사' · '예방접종' · '병원 일정' (CLINIC_KIND_WORD). */
  label: string
  /** 'both' — 둘이 함께 ([같이 갈게요] is offered); 'mine' — his own. */
  with: 'both' | 'mine'
  /** He said [같이 갈게요] (her phone applied it). */
  joined: boolean
}

/** A line with where it comes from (no number without a source — AGENTS.md). */
export interface SnapshotSourcedLine {
  text: string
  /** '회사마다 달라요'. */
  note: string
  source: { label: string; url: string }
}

/** '병원과 함께' on his side (N32): while the couple's clinic mode is on. */
export interface SnapshotClinic {
  /** The next seven days, his and '둘이 함께', in order; [] when none. */
  appointments: SnapshotAppointment[]
  /** 난임치료휴가 — 남성 근로자도 · 유급 일수 (CLINIC_LEAVE_SOURCE). */
  leave: SnapshotSourcedLine
}

/**
 * 같이 챙길 것 on his side (founder request 2026-10-09): together.linkTogether
 * as is — her near-term roadmap items and the shared ones, each with the
 * catalogue title, a neutral status and label (never 'overdue'), the day when
 * it has one, his support line, and whether he said [같이 할게요].
 */
export type SnapshotTogetherPlan = LinkTogether

/** His next shared checkup on the pregnant stage card (linkStageCard). */
export interface SnapshotCheckup {
  date: ISODate
  /** Only for one they go to together ('둘이 함께'), as his clinic week carries it. */
  time?: string
  place?: string
  /** The catalogue name of the item it is for ('NT(목덜미 투명대)'), else a kind word ('병원 진료') — never the appointment's own title. */
  label: string
  /** 'both' — 둘이 함께; 'hers' — her own (he is welcome). */
  with: 'both' | 'hers'
  /**
   * What he does that day: the support line of the item it is booked for
   * ('같이 가기 · 확인서 받을 때 옆에 있기', '접종 날 같이 가기' — on hers the
   * same line his day-before 🔔 gives, planNotices.togetherAppointmentNotice);
   * without one, '둘이 같이 가는 날이에요' for one they go to together and
   * '같이 갈 수 있으면 시간 비워 두기' on hers.
   */
  role: string
  /**
   * The roadmap item it is booked for, when that item carries a support line
   * (a catalogue id — the label already names it). The page draws that item's
   * [같이 할게요] here and leaves its row out of 같이 챙길 것, so the visit shows
   * once.
   */
  itemId?: string
}

/**
 * The pregnant stage's card on his page (the app's StageHero, his side):
 * pregnancy weeks and the due date are known to both once she switched the
 * stage. Pre-rendered words and two numbers; no LMP, nothing she logs.
 */
export interface SnapshotStageCard {
  kind: 'pregnant'
  /** '임신 초기' · '임신 중기' · '임신 후기' (today.TRIMESTER_LABEL). */
  eyebrow: string
  /** '임신 12주 3일'. */
  title: string
  /** Completed weeks (the bar's '12주 / 40주'). */
  weeks: number
  /** 0–1 through 40 weeks. */
  progress: number
  /** 'D-193' · 'D-day' · 'D+2'. */
  dday: string
  /** '예정일 4월 20일 (예상)' — '병원 예정일 4월 20일' when the hospital gave it. */
  dueLabel: string
  checkup?: SnapshotCheckup
}

/** '이번 주 우리 둘' on his side (N21; the pregnant stage too since 2026-10-09). Absent in the parenting stage and in the quiet after a loss. */
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
  /**
   * Before N30 the week card carried a short 내 준비 line; snapshots built
   * since carry PartnerDay.myPrep instead (the page falls back to this one
   * for a cached older snapshot).
   */
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
  /** Her answer to his signal (QA Now 3b: the link had no way to show it). */
  reply?: SnapshotReply
  signalsLeft: number
  owner: SnapshotOwnerLine
  week?: SnapshotWeek
  /** 내 준비 (N30), when any part has something to say. */
  myPrep?: SnapshotMyPrep
  /** 병원과 함께 (N32), while the couple's clinic mode is on. */
  clinic?: SnapshotClinic
  /** 같이 챙길 것 (2026-10-09): her items and the shared ones, neutral statuses, his support lines. Absent when empty and in the quiet. */
  togetherPlan?: SnapshotTogetherPlan
  /** The pregnant stage's card (임신 N주 · 예정일 D-N · his next shared checkup). Only while pregnant. */
  stageCard?: SnapshotStageCard
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

/**
 * The ideas inside the 우리의 주간 card, as components/today/OurWeekIdeas picks
 * them — gated as the card is (dateIdeas.partnerHintState: a rest or a
 * positive test she starts inside his window and does not tell keeps them).
 */
export function linkIdeas(state: AppState, today: ISODate, viewer: MemberId): SnapshotIdea[] {
  if (!fertileHintsAllowed(partnerHintState(state, viewer), viewer, today)) return []
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
  const minDoneAt = earliestDoneAt(t)
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
    // Never before the booked day (partnerEvents.earliestDoneAt — the 'task-done' gate reads the same).
    ...(minDoneAt ? { minDoneAt } : {}),
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

/**
 * '이번 주 우리 둘' for `day`, or undefined when the week rests
 * (weekTogether.weekOptions is empty). Its `prep` line is what the in-app
 * home and older snapshots used; since N30 the snapshot drops it and carries
 * the day's myPrep instead (linkMyPrep — the page's own 내 준비 bar).
 */
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

/** 내 준비 for `day` (lib/logic/myPrep — his own records only), or undefined when no part has anything to say. */
export function linkMyPrep(state: AppState, day: ISODate, partner: MemberId): SnapshotMyPrep | undefined {
  const p = myPrep(state, day, partner)
  const out: SnapshotMyPrep = {
    ...(p.timerLabel ? { timerLabel: p.timerLabel, timerProgress: Math.min(1, Math.max(0, p.timerProgress ?? 0)) } : {}),
    ...(p.weekCount ? { weekCount: p.weekCount } : {}),
    ...(p.chainStep ? { chainStep: p.chainStep } : {}),
    ...(p.items?.length ? { items: p.items.map((i) => ({ ...i })) } : {}),
  }
  return out.timerLabel || out.weekCount || out.chainStep || out.items ? out : undefined
}

// ── 같이 챙길 것 (2026-10-09) ───────────────────────────────

/**
 * Rows the link's 같이 챙길 것 leaves to other cards: 임신 사전건강관리 신청 —
 * his half is his month task (신청 → 검사 → 청구, already on his page) and her
 * half is her own chain record (partnerTrack.setFertilityApplied), which
 * travels nowhere on the link: the shared row turns 'done' only when her half
 * is in, so drawing it would tell him she applied (tests/integrationNow3b
 * 'her own 검사 applied').
 */
export const LINK_TOGETHER_ELSEWHERE: readonly string[] = [FERTILITY_APPLY_ID]

/**
 * 같이 챙길 것 for `day` (together.linkTogether) without the rows another card
 * carries — LINK_TOGETHER_ELSEWHERE, and `alsoElsewhere`: the item of his month
 * task when the page shows it (a shared one, e.g. '분만 병원 정하기' while
 * pregnant, is his month task card with its own [했어요]) and his own 내 준비
 * items while pregnant (카시트 · 육아휴직 계획 are shared items, and 내 준비
 * already lists them). They are left out BEFORE the list is cut to
 * LINK_TOGETHER_MAX (linkTogether's `exclude`), so their place goes to the next
 * row and nothing about them moves the others. Undefined for her, in the quiet,
 * and when there is nothing to show.
 */
export function linkTogetherPlan(
  state: AppState,
  day: ISODate,
  partner: MemberId,
  alsoElsewhere: readonly string[] = [],
): SnapshotTogetherPlan | undefined {
  if (!isISODate(day)) return undefined
  return linkTogether(state, day, partner, { exclude: [...LINK_TOGETHER_ELSEWHERE, ...alsoElsewhere] })
}

// ── 임신 중: 단계 카드와 다음 검진 (2026-10-09) ─────────────

/** A '검진 날': a visit, a test or a shot (weekTogether's own CHECKUP kinds — not 주사·약 at home, not admin). */
export const CHECKUP_KINDS: readonly AppointmentKind[] = ['hospital', 'test', 'vaccine']

/** What he does on a checkup day: one they go to together, or one of hers he is welcome at. */
export const CHECKUP_ROLE = { both: '둘이 같이 가는 날이에요', hers: TOGETHER_VISIT_LINE } as const

/**
 * His next shared checkup for `day` (pregnant stage): the first live, not-done
 * visit / test / shot of hers or of both of them from `day` on, within
 * NEAR_DAYS. Her own: the day only. '둘이 함께': the day, the time and the
 * place (his clinic week's rule). The name is the catalogue's for the item it
 * is booked for (shortTitle) or a kind word — never the appointment's title or
 * note. What he does is that item's support line when it has one (as his
 * day-before 🔔 says it on hers). His own appointments are his monthly task's
 * / clinic week's business.
 */
export function linkCheckup(state: AppState, day: ISODate, partner: MemberId): SnapshotCheckup | undefined {
  const owner = cycleOwnerId(state)
  if (partner === owner) return undefined
  const next = state.appointments
    .filter(
      (a) =>
        isLive(a) &&
        !a.done &&
        (a.who === 'both' || a.who === owner) &&
        CHECKUP_KINDS.includes(a.kind) &&
        isISODate(a.date) &&
        a.date >= day &&
        diffDays(day, a.date) <= NEAR_DAYS,
    )
    .sort(compareAppointments)[0]
  if (!next) return undefined
  const template = next.taskId ? templateById(next.taskId) : undefined
  const both = next.who === 'both'
  return {
    date: next.date,
    ...(both && next.time ? { time: next.time } : {}),
    ...(both && next.place ? { place: next.place } : {}),
    label: template ? shortTitle(template.title) : (CLINIC_KIND_WORD[next.kind] ?? '병원 일정'),
    with: both ? 'both' : 'hers',
    role: template?.support ?? (both ? CHECKUP_ROLE.both : CHECKUP_ROLE.hers),
    ...(template?.support ? { itemId: template.id } : {}),
  }
}

/**
 * The pregnant stage's card for `day` (the app's StageHero on his side):
 * '임신 12주 3일', the trimester, the due date with D-N ('(예상)' unless the
 * hospital gave it) and his next shared checkup. Undefined outside the
 * pregnant stage, without a usable pregnancy record, for her, and in the quiet.
 */
export function linkStageCard(state: AppState, day: ISODate, partner: MemberId): SnapshotStageCard | undefined {
  if (state.stage !== 'pregnant' || partner === cycleOwnerId(state) || !isISODate(day) || weekQuiet(state, day)) return undefined
  const p = usablePregnancy(state.pregnancy)
  if (!p) return undefined
  const ga = gestationalAge(p, day)
  const due = dueDate(p)
  const checkup = linkCheckup(state, day, partner)
  const dueWords = formatKo(due, { weekday: false })
  return {
    kind: 'pregnant',
    eyebrow: TRIMESTER_LABEL[ga.trimester],
    title: `임신 ${formatGA(ga)}`,
    weeks: ga.weeks,
    progress: ga.progress,
    dday: dLabel(due, day),
    dueLabel: p.dueDateOverride ? `병원 예정일 ${dueWords}` : `예정일 ${dueWords} (예상)`,
    ...(checkup ? { checkup } : {}),
  }
}

// ── 병원과 함께일 때 남편의 주 (N32) ─────────────────────────

/** How far ahead his clinic week looks: the day and the six after it. */
export const CLINIC_WEEK_DAYS = 7

// CLINIC_KIND_WORD (a kind word, never the title) lives in ./appointments so
// the clinic card (ttcFlow, which this file imports) reads the same words.
export { CLINIC_KIND_WORD } from './appointments'

/**
 * Where the 난임치료휴가 line comes from: docs/research/kr-programs.json
 * 'infertility-leave-paid-4-days-2026-11-27' (유급 2일 → 4일, 연 6일 그대로) and
 * admin-timeline.json '난임치료휴가 연 6일 활용' (남성 근로자도 쓸 수 있어요) —
 * the numbers themselves are lib/logic/treatments.ts's (LEAVE_DAYS_PER_YEAR,
 * PAID_LEAVE_DAYS, PAID_LEAVE_CHANGE), pinned to the same findings.
 */
export const CLINIC_LEAVE_SOURCE = {
  label: 'KDI 경제정보센터 · 남녀고용평등법 개정',
  url: 'https://eiec.kdi.re.kr/policy/materialView.do?num=285673',
  checked: '2026-10-02',
} as const

/** '난임치료휴가는 남성 근로자도 쓸 수 있어요 · 2026년 11월 27일부터 유급 4일(연 6일)' — from that day on, '유급 4일(연 6일)'. */
export function clinicLeaveLine(day: ISODate): SnapshotSourcedLine {
  const paid =
    day < PAID_LEAVE_CHANGE
      ? `${formatKo(PAID_LEAVE_CHANGE, { year: true, weekday: false })}부터 유급 ${PAID_LEAVE_DAYS.from}일(연 ${LEAVE_DAYS_PER_YEAR}일)`
      : `유급 ${PAID_LEAVE_DAYS.from}일(연 ${LEAVE_DAYS_PER_YEAR}일)`
  return {
    text: `난임치료휴가는 남성 근로자도 쓸 수 있어요 · ${paid}`,
    note: '회사마다 달라요',
    source: { label: CLINIC_LEAVE_SOURCE.label, url: CLINIC_LEAVE_SOURCE.url },
  }
}

/** Is the couple's clinic mode on for `day` (the home's own test: ttcFlow's clinic card)? */
export function clinicOn(state: AppState, day: ISODate): boolean {
  return state.stage === 'preparing' && state.restCycle?.reason === 'clinic' && activeRest(state, day)?.reason === 'clinic'
}

/**
 * His clinic week for `day` (N32): while the couple's clinic mode is on —
 * not in the quiet after a pregnancy ended — the live, not-done appointments
 * of `day` … `day + 6` that are his or '둘이 함께', as day · time · place ·
 * kind word, each with whether he said [같이 갈게요]; and the 난임치료휴가
 * line. Her own appointments, titles, notes and anything about a treatment
 * stay in the app. Undefined when clinic mode is off.
 */
export function linkClinic(state: AppState, day: ISODate, partner: MemberId): SnapshotClinic | undefined {
  if (!clinicOn(state, day) || weekQuiet(state, day) || partner === cycleOwnerId(state)) return undefined
  const until = addDays(day, CLINIC_WEEK_DAYS - 1)
  const appointments = state.appointments
    .filter(
      (a) =>
        isLive(a) &&
        !a.done &&
        !isForEndedPregnancy(state, a) &&
        (a.who === 'both' || a.who === partner) &&
        isISODate(a.date) &&
        a.date >= day &&
        a.date <= until,
    )
    .sort(compareAppointments)
    .map(
      (a): SnapshotAppointment => ({
        id: a.id,
        date: a.date,
        ...(a.time ? { time: a.time } : {}),
        ...(a.place ? { place: a.place } : {}),
        label: CLINIC_KIND_WORD[a.kind] ?? '일정',
        with: a.who === 'both' ? 'both' : 'mine',
        joined: a.who === 'both' && hasJoinedAppointment(state, a.id, partner),
      }),
    )
  return { appointments, leave: clinicLeaveLine(day) }
}

/** A told card's 해 줄 말 for the page: the lines, the answers as catalogue signals, what he sent since. */
function snapshotSay(say: NonNullable<Moment['say']>): NonNullable<SnapshotMoment['say']> {
  const replies = say.replies.map((id) => signalById(id)).filter((r): r is Signal => !!r).map((r) => ({ ...r }))
  return { say: say.say, save: say.save, replies, ...(say.sent ? { sent: say.sent } : {}) }
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
        ...(m.say ? { say: snapshotSay(m.say) } : {}),
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
  // Lines for him under a signal SHE sent (components/signals/SignalsCard reads the same rule).
  const pendingSay = pending && (pending.from ?? owner) === owner ? sayForSignal(pendingId) : undefined
  const signal: SnapshotSignal | undefined = pending
    ? {
        ...(pendingId ? { signalId: pendingId } : {}),
        ...(pendingSig ? { emoji: pendingSig.emoji } : {}),
        text: pendingSig?.text ?? pending.title,
        from: pending.from ?? owner,
        at: pending.createdAt,
        replies: repliesFor(pendingId).map((r) => ({ ...r })),
        ...(pendingId === 'not-this-month' ? { tip: PERIOD_PARTNER_TIP } : {}),
        ...(pendingSay ? { say: { say: pendingSay.say, save: pendingSay.save } } : {}),
      }
    : undefined

  // Her answer to his last signal, as his app's 우리 한 줄 shows it (signals.receivedReply).
  const got = receivedReply(state, partner, date)
  const reply: SnapshotReply | undefined =
    got && got.from === owner
      ? {
          emoji: got.reply.emoji,
          text: got.reply.text,
          from: got.from,
          at: got.at,
          ...(got.answered ? { answered: got.answered.text } : {}),
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

  // The week card without its old 내 준비 line: the day carries myPrep (its own bar on the page).
  const fullWeek = linkWeek(state, date, partner, taskShown)
  const week: SnapshotWeek | undefined = fullWeek ? (({ prep: _prep, ...rest }) => rest)(fullWeek) : undefined
  const prep = linkMyPrep(state, date, partner)
  const clinic = linkClinic(state, date, partner)
  // 같이 챙길 것 and the pregnant stage card (2026-10-09) — the plan she shares and the stage she switched, never her records.
  const elsewhere = [...(task ? [task.id] : []), ...(prep?.items ?? []).map((i) => i.id)]
  const togetherPlan = linkTogetherPlan(state, date, partner, elsewhere)
  const stageCard = linkStageCard(state, date, partner)

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
    ...(reply ? { reply } : {}),
    signalsLeft: Math.max(0, SIGNALS_PER_DAY - signalsSentToday(state, partner, date)),
    owner: ownerLine,
    ...(week ? { week } : {}),
    ...(prep ? { myPrep: prep } : {}),
    ...(clinic ? { clinic } : {}),
    ...(togetherPlan ? { togetherPlan } : {}),
    ...(stageCard ? { stageCard } : {}),
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
 * Does this event wait out her quiet? '이번 주 우리 둘' taps need the loop to be
 * on for her today (weekTogetherOn); a [같이 할게요] (support, on) needs her
 * today outside the quiet after a loss — taking one back never waits.
 */
function waitsOut(state: AppState, ev: PartnerEvent, today: ISODate): boolean {
  if (WEEK_KINDS.has(ev.kind)) return !weekTogetherOn(state, today)
  if (ev.kind === 'support' && ev.on) return weekQuiet(state, today)
  return false
}

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
 * once-per-id rule, unchanged). '이번 주 우리 둘' taps and a [같이 할게요] also
 * need her today to be outside the quiet (a tap from before a loss is not
 * applied inside it — waitsOut).
 * The same object when nothing applied.
 */
export function applyReceivedEvents(state: AppState, received: readonly ReceivedEvent[], today: ISODate): AppState {
  let s = state
  for (const r of received) {
    if (waitsOut(s, r.event, today)) continue
    const day = judgedDay(r, today)
    s = applyPartnerEvent(s, r.event, day, eventStamp(r.receivedAt, day))
  }
  return s === state ? state : forgetOldEvents(s, today)
}
