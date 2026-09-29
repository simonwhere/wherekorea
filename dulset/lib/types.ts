// Domain types for 둘셋. All dates are local calendar dates as 'YYYY-MM-DD'
// strings (see lib/dates.ts) so nothing drifts across time zones.

export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string // new Date().toISOString()

/** The two members of a couple. 'a' is whoever created the space. */
export type MemberId = 'a' | 'b'
export const MEMBER_IDS: readonly MemberId[] = ['a', 'b'] as const

export type Role = 'wife' | 'husband' | 'partner'

export interface Member {
  id: MemberId
  name: string
  role: Role
  /** Used for "when to see a doctor" guidance (35+ → 6 months). */
  birthYear?: number
  /** The member whose menstrual cycle is tracked. Exactly one member should be true. */
  tracksCycle: boolean
  emoji: string
}

/** Life stage of the couple space. The app re-shapes its tabs per stage. */
export type Stage = 'preparing' | 'pregnant' | 'parenting'

// ── Daily check ─────────────────────────────────────────────

export type CheckKind = 'supplement' | 'medication' | 'habit'

export interface CheckItem {
  id: string
  owner: MemberId
  label: string
  kind: CheckKind
  /** Short helper text, e.g. dose "400µg". */
  note?: string
  /** Archived items keep their history but no longer show up daily. */
  active: boolean
  createdAt: ISODate
  /** First day the item no longer counts (set when archived). */
  archivedAt?: ISODate
  /**
   * 'daily' (default) or 'weekly' — a once-a-week check-in for "keep not doing
   * it" habits (금주·금연 …), so they don't become a daily chore.
   */
  cadence?: 'daily' | 'weekly'
}

/** checkLog[date][memberId] = ids of CheckItems done that day. */
export type CheckLog = Record<ISODate, Partial<Record<MemberId, string[]>>>

// ── Cycle ───────────────────────────────────────────────────

export interface PeriodLog {
  start: ISODate
  /** Last bleeding day, inclusive. Optional. */
  end?: ISODate
  /** Who logged it. */
  by?: MemberId
}

/**
 * Urine LH (배테기) result as the user reads the strip: 음성, 희미(faint — test
 * line lighter than control), 양성, 가장 진함(peak — the darkest of the cycle).
 * 'positive' and 'peak' count as a surge.
 */
export type LHResult = 'negative' | 'faint' | 'positive' | 'peak'

export interface LHTest {
  date: ISODate
  result: LHResult
  /** 'HH:MM' — up to two tests a day are kept (morning / evening). */
  time?: string
  /** Who logged it. */
  by?: MemberId
}

/** Home pregnancy test (임테기). */
export type PregnancyTestResult = 'negative' | 'faint' | 'positive'

export interface PregnancyTest {
  id: string
  date: ISODate
  time?: string
  result: PregnancyTestResult
  by?: MemberId
}

/**
 * "이번 주기는 쉬어요": fertile display and alerts off until the next period is
 * logged after `since` (also suggested after a live vaccine or a loss).
 */
export interface RestCycle {
  since: ISODate
  reason: 'rest' | 'vaccine' | 'loss'
}

/** A positive home test, not yet confirmed at the clinic — no celebration yet. */
export interface PositivePending {
  since: ISODate
  /** The first positive test that started this state. */
  testId?: string
}

export interface CycleSettings {
  /** Used until at least 2 logged periods exist, then logs take over. */
  cycleLength: number
  periodLength: number
}

// ── Notifications / nudges ──────────────────────────────────

export type NotificationKind =
  | 'fertile-start' // fertile window begins (sent to both)
  | 'peak' // most likely days (sent to both)
  | 'period-due'
  | 'nudge' // "콕" from partner
  | 'cheer' // partner finished all checks / sent a cheer
  | 'date-idea'
  | 'milestone'
  | 'doctor' // gentle "consider seeing a doctor" reminder
  | 'system'

export interface AppNotification {
  id: string
  to: MemberId
  from?: MemberId
  kind: NotificationKind
  title: string
  body: string
  createdAt: ISODateTime
  /** Dedup key for generated notifications, e.g. 'fertile-start:2026-10-03'. */
  key?: string
  read: boolean
  /** Hidden from the inbox but kept so a generated notice isn't delivered again. */
  dismissed?: boolean
}

// ── Dates (romance) ─────────────────────────────────────────

export interface DatePlan {
  id: string
  date: ISODate
  ideaId?: string
  title: string
  place?: string
  note?: string
  done: boolean
  createdBy: MemberId
  /** The partner said 좋아요 to this plan (kept here, not inferred from the inbox). */
  acceptedBy?: MemberId
}

// ── Diary / pregnancy / baby ────────────────────────────────

export interface DiaryEntry {
  id: string
  date: ISODate
  author: MemberId
  /** Stage the entry was written in (준비 기록 / 태교일기 / 육아일기). */
  stage: Stage
  text: string
  mood?: string
  /** Key of a photo stored in IndexedDB (lib/photos.ts). */
  photoId?: string
  createdAt: ISODateTime
  /** The partner's small reaction (e.g. '❤️') — Between-style, no comments thread. */
  reactions?: Partial<Record<MemberId, string>>
}

export interface Pregnancy {
  /** First day of the last menstrual period. */
  lmp: ISODate
  /** Optional doctor-given due date that overrides the LMP calculation. */
  dueDateOverride?: ISODate
  confirmedAt: ISODate
  /**
   * Set when the couple went back to preparing (e.g. after a loss). Until a new
   * period is logged, cycle predictions pause and the "trying" clock restarts here.
   */
  endedAt?: ISODate
}

export type BabySex = 'girl' | 'boy' | 'unknown'

export interface Baby {
  name: string
  birthDate: ISODate
  sex: BabySex
}

export interface GrowthRecord {
  id: string
  date: ISODate
  heightCm?: number
  weightKg?: number
  headCm?: number
}

export interface MilestoneRecord {
  key: string
  date: ISODate
}

// ── Settings / root state ───────────────────────────────────

/**
 * How a member hears about fertile days. Each partner chooses for themselves —
 * pressure from single "D-day" alerts is linked to distress, so the default for
 * the partner is the softer "couple time" framing.
 */
export type AlertStyle = 'explicit' | 'soft' | 'off'

export interface Settings {
  /** Lock-screen-safe wording: "우리의 날" instead of "가임기". */
  discreet: boolean
  /** Show browser notifications while the app is open. */
  browserNotifications: boolean
  /**
   * NICE-style "every 2–3 days, all cycle long" mode: no fertile-day alerts or
   * countdowns; the app frames everything as couple time.
   */
  lowPressure: boolean
  alertStyle: Record<MemberId, AlertStyle>
  /** When the couple started trying — drives the "see a doctor" guidance. */
  ttcStart?: ISODate
  /**
   * Per-person overrides of `lowPressure` / `discreet` (each partner decides for
   * their own phone). Read through lib/logic/prefs.ts, never directly.
   */
  personal?: Partial<Record<MemberId, PersonalPrefs>>
  /**
   * Set by the person who tracks the cycle: whether the partner sees the details
   * (period days, LH and pregnancy-test results). The shared "우리의 주간" is
   * always visible. New couples start with false (privacy by default).
   */
  shareCycleDetails?: boolean
}

export interface PersonalPrefs {
  lowPressure?: boolean
  discreet?: boolean
  /**
   * The cover photo on this person's own phone: undefined = automatic (the
   * app may show the default art for a while, e.g. a photo set during an
   * ended pregnancy), true = always the default art, false = always the photo.
   */
  hideCover?: boolean
}

/**
 * "표지 사진" — the photo at the top of both people's 오늘 screen. The state
 * holds the id only: the image stays in this phone's IndexedDB (lib/photos.ts)
 * or is a built-in demo picture ('builtin:…', lib/content/demoPhotos.ts), so
 * backups never carry it. Read through lib/logic/cover.ts.
 */
export interface CoverPhoto {
  photoId: string
  /** Vertical focus in percent (0 = top, 100 = bottom) — the img object-position. */
  focusY: number
  /** Short line under the photo (≤ 16 characters, no health or clinic words). */
  caption?: string
  setBy: MemberId
  setAt: ISODate
}

export interface Couple {
  members: [Member, Member]
  inviteCode: string
  /** Set once the partner "joined" (simulated in the prototype). */
  linkedAt?: ISODateTime
  /** 처음 만난 날 / 사귄 날 — day 1 of "함께한 지 N일". */
  metDate?: ISODate
  /** 결혼한 날. */
  marriedDate?: ISODate
  /**
   * The couple's cover photo (오늘 맨 위). Shared by both people; each can
   * still show the default art on their own phone (PersonalPrefs.hideCover).
   */
  cover?: CoverPhoto
}

// ── Our days / appointments / roadmap ───────────────────────

export interface CustomAnniversary {
  id: string
  title: string
  date: ISODate
  /** Repeats every year (N주년) or happens once. */
  yearly: boolean
  emoji?: string
}

export type AppointmentKind = 'hospital' | 'test' | 'vaccine' | 'admin' | 'other'

export interface Appointment {
  id: string
  date: ISODate
  /** 'HH:MM' (24h), optional. */
  time?: string
  title: string
  place?: string
  /** Who goes. */
  who: MemberId | 'both'
  kind: AppointmentKind
  note?: string
  /** Roadmap item this appointment belongs to. */
  taskId?: string
  createdBy: MemberId
  done?: boolean
}

export type RoadmapPhase = 'preconception' | 'pregnancy-1st' | 'pregnancy-2nd' | 'pregnancy-3rd' | 'birth' | 'postpartum'

export interface CustomTask {
  id: string
  title: string
  phase: RoadmapPhase
  who: MemberId | 'both'
  due?: ISODate
  doneAt?: ISODate
  doneBy?: MemberId
  createdBy: MemberId
}

export interface AppState {
  version: 1
  createdAt: ISODateTime
  onboarded: boolean
  couple: Couple
  stage: Stage
  checkItems: CheckItem[]
  checkLog: CheckLog
  periods: PeriodLog[]
  lhTests: LHTest[]
  cycle: CycleSettings
  notifications: AppNotification[]
  datePlans: DatePlan[]
  diary: DiaryEntry[]
  pregnancy?: Pregnancy
  baby?: Baby
  growth: GrowthRecord[]
  milestones: MilestoneRecord[]
  /** Couple's own anniversaries (첫 여행, 프러포즈 …). */
  anniversaries: CustomAnniversary[]
  /** Shared hospital/test/admin appointments. */
  appointments: Appointment[]
  /** Roadmap template completion: templateId → when/who. */
  planDone: Record<string, { at: ISODate; by?: MemberId }>
  /** Roadmap items the couple added themselves. */
  customTasks: CustomTask[]
  /** Home pregnancy tests (임테기). */
  pregnancyTests: PregnancyTest[]
  /** This cycle is a rest cycle (no fertile display / alerts). */
  restCycle?: RestCycle
  /** Positive home test awaiting clinic confirmation. */
  positivePending?: PositivePending
  settings: Settings
  /**
   * Prototype two-tab sync bookkeeping (lib/store.tsx): for each recent browser
   * tab, the sequence number of its last update this state includes.
   */
  sync?: Record<string, number>
}
