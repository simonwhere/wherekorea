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

/** Half of the day a strip was taken, for a past day logged without a clock time (N17). */
export type LHSlot = 'morning' | 'evening'
export const LH_SLOTS: readonly LHSlot[] = ['morning', 'evening'] as const

export interface LHTest {
  date: ISODate
  result: LHResult
  /** 'HH:MM' — up to two tests a day are kept (morning / evening). */
  time?: string
  /** 아침 / 저녁 for a past-date entry that has no `time` (N17 slots). */
  slot?: LHSlot
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
 * Why the couple is pausing: 'rest' (이번 주기는 쉬어요), 'vaccine' (after a
 * live vaccine), 'loss' (after a loss) end with the next logged period
 * (lib/logic/ttc.ts periodEndsRest). 'clinic' (병원과 함께 준비 중, N13) does
 * NOT end with a period — the clinic sets the timing and a period is logged on
 * the way to the next cycle; only the couple turns it off (lib/logic/clinic.ts).
 */
export type RestReason = 'rest' | 'vaccine' | 'loss' | 'clinic'
export const REST_REASONS: readonly RestReason[] = ['rest', 'vaccine', 'loss', 'clinic'] as const

/**
 * "이번 주기는 쉬어요": fertile display and alerts off until the next period is
 * logged after `since` (also suggested after a live vaccine or a loss), or —
 * for 'clinic' — until the couple ends it.
 */
export interface RestCycle {
  since: ISODate
  reason: RestReason
  /**
   * Optional last day of the pause (Next B, 'loss' rests): the rest also ends
   * when this day has passed, even without a period — the first period after a
   * loss usually comes in 4–6 weeks (docs/research/after-loss.json
   * 'period-return'), so a track may set endedAt + 42 days. Never before `since`.
   */
  until?: ISODate
}

/** A positive home test, not yet confirmed at the clinic — no celebration yet. */
export interface PositivePending {
  since: ISODate
  /** The first positive test that started this state. */
  testId?: string
  /**
   * '양성 뒤에 출혈이 시작됐어요' (Next B): the first day of bleeding after the
   * positive test, set by the owner through lib/logic/positiveBleeding.ts.
   * Never before `since`. No reading of what it means is stored — the advice
   * lines come from docs/research/early-pregnancy-bleeding.json.
   */
  bleedingSince?: ISODate
}

export interface CycleSettings {
  /** Used until at least 2 logged periods exist, then logs take over. */
  cycleLength: number
  periodLength: number
  /**
   * "주기가 45일 이상이거나 들쭉날쭉해요" (N12): the accepted cycle length goes
   * up to 90 days instead of 60 (lib/initial.ts CYCLE_RANGE_LONG) and the
   * calendar shows a possible range rather than a peak.
   */
  longCycles?: boolean
}

/**
 * Per-cycle notes the owner leaves, keyed by that cycle's start date (N12):
 * `stillWaiting` is the day she answered '아직 안 왔어요' to a late cycle, so
 * the app keeps counting the day instead of asking for a missed log.
 */
export interface CycleNote {
  stillWaiting?: ISODate
}

export type CycleNotes = Record<ISODate, CycleNote>

// ── 난임 시술 · 난임치료휴가 (Next B) ─────────────────────────

/**
 * One clinic attempt. 'ivf-fresh' / 'ivf-frozen' are one pool for the
 * 건강보험 count (체외수정 20회, 신선·동결 통합 since 2024-02); 'iui' has its
 * own 5; 'ovulation-induction' (약·주사) is not part of the 25 at all
 * (docs/research/kr-programs.json 'ivf-count-merged-2024-02').
 */
export type TreatmentKind = 'ovulation-induction' | 'iui' | 'ivf-fresh' | 'ivf-frozen'
export const TREATMENT_KINDS: readonly TreatmentKind[] = ['ovulation-induction', 'iui', 'ivf-fresh', 'ivf-frozen'] as const

/** How the attempt ended: 음성 / 양성 / 중단 (cancelled before transfer, not counted) / still 진행 중. */
export type TreatmentOutcome = 'negative' | 'positive' | 'cancelled' | 'ongoing'
export const TREATMENT_OUTCOMES: readonly TreatmentOutcome[] = ['negative', 'positive', 'cancelled', 'ongoing'] as const

export interface Treatment {
  id: string
  kind: TreatmentKind
  /** The day the attempt started (약 시작·채취·이식 중 the couple's choice). */
  startDate: ISODate
  /** The day it ended (test, period, or cancellation); never before startDate. */
  endDate?: ISODate
  outcome?: TreatmentOutcome
  /** 정부 지원(난임부부 시술비 지원)을 쓴 회차 — only these count toward N/25. */
  supported?: boolean
  /** 지원결정통지서 유효기간 끝 (발급일 + 6개월 from 2026-01, + 3개월 before). */
  noticeExpires?: ISODate
  /** The couple's own line (≤ 140 characters, lib/logic/treatments.ts TREATMENT_NOTE_MAX). */
  note?: string
}

/** 난임치료휴가 (연 6일 — 유급 2일, 4일 from 2026-11-27; docs/research/kr-programs.json). */
export type LeaveKind = 'infertility'
export const LEAVE_KINDS: readonly LeaveKind[] = ['infertility'] as const

export interface LeaveDay {
  date: ISODate
  kind: LeaveKind
}

/** leaveDays[member] = that person's own leave days (each member has their own 6). */
export type LeaveDays = Partial<Record<MemberId, LeaveDay[]>>

// ── 관계일 기록 (Next B, owner only, separate consent) ─────────

/**
 * The cycle owner's own record of 관계일, kept only after a separate consent
 * (`consentAt`, by the owner). Nobody but the holder (`by`) ever sees `days`:
 * not the partner's screen, not a notice, not an export or the state another
 * phone may hold (lib/logic/intimacy.ts stripIntimacy — the stateForViewer
 * pattern). Revoking deletes everything. Nothing here predicts anything.
 */
export interface Intimacy {
  consentAt: ISODate
  by: MemberId
  /** Sorted, unique 'YYYY-MM-DD' days. */
  days: ISODate[]
}

// ── Personal log (본인만 보기) ────────────────────────────────

/**
 * How the owner felt that day — chips in the 기다리는 주 (N11). Read and set
 * through lib/logic/personalLog.ts; never shown to the other member.
 */
export type PersonalFeel = 'normal' | 'tired' | 'sensitive' | 'breast' | 'cramps' | 'spotting' | 'nausea'
export const PERSONAL_FEELS: readonly PersonalFeel[] = ['normal', 'tired', 'sensitive', 'breast', 'cramps', 'spotting', 'nausea'] as const

export interface PersonalDay {
  feel?: PersonalFeel
  /** A private line (≤ 140 characters, lib/logic/personalLog.ts PERSONAL_NOTE_MAX). */
  note?: string
}

/** personalLog[member][date] — each member's own days, invisible to the other. */
export type PersonalLog = Partial<Record<MemberId, Record<ISODate, PersonalDay>>>

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
  /**
   * '나만 보기' (N11): only this member sees the entry — nowhere on the other
   * member's screen, never in anything shared with them. Normally the author.
   * Read through lib/logic/personalLog.ts canSeeEntry / visibleEntries.
   */
  privateTo?: MemberId
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
  /**
   * Does the cycle owner use LH strips (배란테스트기)? true 써요 / false 안 써요 /
   * 'later' 나중에 — undefined means the question hasn't been asked yet (N17).
   */
  usesLH?: boolean | 'later'
  /**
   * 'N년 전 오늘' on the home / 우리 (Next B). Unset = off (lib/initial.ts
   * SETTINGS_DEFAULTS; read with lib/logic/settings.ts memoriesOn).
   */
  memories?: boolean
  /** 기념일 D-7·당일 알림 (Next B). Unset = on (anniversaryAlertsOn). */
  anniversaryAlerts?: boolean
  /**
   * '시도 N번째 주기' in the cycle history (Next B). Unset = hidden — the
   * neutral wording is the default (showTryCountOn).
   */
  showTryCount?: boolean
}

export interface PersonalPrefs {
  lowPressure?: boolean
  discreet?: boolean
  /** 'HH:MM' — when this person tests LH, for later local reminders (N17; no reminder yet). */
  lhTestTime?: string
  /**
   * The cover photo on this person's own phone: undefined = automatic (the
   * app may show the default art for a while, e.g. a photo set during an
   * ended pregnancy), true = always the default art, false = always the photo.
   */
  hideCover?: boolean
  /**
   * 콕 받기 (Next B): whether this person wants the partner's 콕 nudges at
   * all. Unset = yes (lib/logic/settings.ts acceptNudgesFor).
   */
  acceptNudges?: boolean
  /**
   * 잠금화면 숨김을 홈 카드까지 (Next B): when true the home's moment card and
   * strip use the neutral (discreet) wording even for the cycle owner. Unset
   * follows this person's `discreet` (homeDiscreetFor).
   */
  homeDiscreet?: boolean
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

/**
 * 'injection' (주사) and 'medication' (약) are the clinic-cycle kinds (N13):
 * a time is expected for them (the sheet asks for one).
 */
export type AppointmentKind = 'hospital' | 'test' | 'vaccine' | 'admin' | 'other' | 'injection' | 'medication'
export const APPOINTMENT_KINDS: readonly AppointmentKind[] = [
  'hospital',
  'test',
  'vaccine',
  'admin',
  'other',
  'injection',
  'medication',
] as const

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
  /**
   * '기한' (N13): this own item has a real deadline (결정통지서 만료 …), so it
   * gets D-7 · D-1 · 당일 notices even in the preparing stage. Off by default
   * so a shopping item never nags.
   */
  deadlineAlerts?: boolean
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
  /**
   * Each member's own days (feel chips, private lines) — visible only to that
   * member, never to the partner, never in anything shared with them; a backup
   * keeps it. lib/logic/personalLog.ts.
   */
  personalLog?: PersonalLog
  /** Per-cycle notes by cycle start date ('아직 안 왔어요' …). */
  cycleNotes?: CycleNotes
  /**
   * 난임 시술 회차 (Next B), oldest first — shared by the couple; the
   * 지원 counter reads them (lib/logic/treatments.ts). Absent = none yet.
   */
  treatments?: Treatment[]
  /** Each person's own 난임치료휴가 days (lib/logic/treatments.ts leaveUsed). */
  leaveDays?: LeaveDays
  /**
   * 관계일 기록 (Next B): the cycle owner's own, after a separate consent.
   * Never reaches the partner (lib/logic/intimacy.ts); a backup keeps it.
   */
  intimacy?: Intimacy
  settings: Settings
  /**
   * Prototype two-tab sync bookkeeping (lib/store.tsx): for each recent browser
   * tab, the sequence number of its last update this state includes.
   */
  sync?: Record<string, number>
}
