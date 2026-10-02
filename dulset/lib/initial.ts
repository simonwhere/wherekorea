import { todayISO } from './dates'
import { inviteCode, uid } from './id'
import { localNowISO } from './logic/notifications'
import type { AppState, CheckItem, ISODate, Member, MemberId, PersonalPrefs, Role, Settings } from './types'

export const DEFAULT_CYCLE_LENGTH = 28
export const DEFAULT_PERIOD_LENGTH = 5

/**
 * Cycle lengths (days) the onboarding, the settings and a backup accept — the
 * one source for every clamp (lib/demo.ts CYCLE_RANGE, lib/logic/settings.ts
 * sanitizeBackup). 15–60 matches lib/logic/cycle.ts MIN_CYCLE / MAX_CYCLE.
 */
export const CYCLE_RANGE_DEFAULT = { min: 15, max: 60 } as const
/** With CycleSettings.longCycles ("45일 이상이거나 들쭉날쭉해요", N12): up to 90 days. */
export const CYCLE_RANGE_LONG = { min: 15, max: 90 } as const

export function cycleLengthRange(longCycles: boolean | undefined): { min: number; max: number } {
  return longCycles ? CYCLE_RANGE_LONG : CYCLE_RANGE_DEFAULT
}

/**
 * Defaults for the optional couple-wide switches added in Next B. They are
 * NOT written into a new state (an unset field means the default, so an older
 * save loads unchanged); read them through lib/logic/settings.ts memoriesOn /
 * anniversaryAlertsOn / showTryCountOn.
 */
export const SETTINGS_DEFAULTS: Required<Pick<Settings, 'memories' | 'anniversaryAlerts' | 'showTryCount'>> = {
  memories: false,
  anniversaryAlerts: true,
  showTryCount: false,
} as const

/**
 * Defaults for the per-person switches (settings.personal[member]). Same
 * rule: unset = default. `homeDiscreet` has no fixed default — it follows that
 * person's `discreet` (lib/logic/settings.ts homeDiscreetFor).
 */
export const PERSONAL_DEFAULTS: Required<Pick<PersonalPrefs, 'acceptNudges'>> = {
  acceptNudges: true,
} as const

export const ROLE_LABEL: Record<Role, string> = {
  wife: '아내',
  husband: '남편',
  partner: '배우자',
}

export const ROLE_EMOJI: Record<Role, string> = {
  wife: '👩',
  husband: '👨',
  partner: '🧑',
}

export function otherMember(id: MemberId): MemberId {
  return id === 'a' ? 'b' : 'a'
}

/**
 * The partner's habits, asked in onboarding (N7): they decide the starter list
 * so nobody gets a daily "don't smoke" tap they don't need.
 */
export interface HabitAnswers {
  smokes: boolean
  drinks: 'rarely' | 'sometimes' | 'often'
  /** What they already do. */
  exercises: boolean
  takesSupplements: boolean
}

/** Daily rows stay short (1–2); "keep not doing it" habits are weekly check-ins. */
export const MAX_DAILY_STARTERS = 2

/**
 * Starter checklist per member, built from the partner's answers:
 *  • the cycle owner: 엽산 (daily — the one supplement with strong evidence:
 *    USPSTF A, WHO, KDCA) + 비타민 D (optional);
 *  • the partner: 1–2 daily rows (걷기 30분, or the 운동 they already do; the
 *    supplement they already take) and weekly check-ins — 금연 only for smokers,
 *    금주 only for drinkers, 사우나·뜨거운 탕 쉬기 for the sperm side.
 *    No men's zinc/folate pill by default: FAZST (JAMA 2020) found no benefit.
 *
 * Without answers (the demo couple, older callers) the original list is kept.
 */
export function defaultCheckItems(members: [Member, Member], today = todayISO(), habits?: HabitAnswers): CheckItem[] {
  const items: CheckItem[] = []
  for (const m of members) {
    const add = (label: string, kind: CheckItem['kind'], note?: string, cadence?: 'weekly') =>
      items.push({
        id: uid(),
        owner: m.id,
        label,
        kind,
        ...(note ? { note } : {}),
        active: true,
        createdAt: today,
        ...(cadence ? { cadence } : {}),
      })
    if (m.tracksCycle) {
      add('엽산', 'supplement', '400µg')
      add('비타민 D', 'supplement', '선택')
      if (!habits) {
        add('술 안 마시기', 'habit')
        add('30분 걷기·운동', 'habit')
      }
      continue
    }
    if (!habits) {
      // Original list (kept for callers that don't ask).
      if (m.role !== 'wife') add('사우나·뜨거운 탕 피하기', 'habit', '고환 온도')
      add('담배 안 피우기', 'habit')
      add('술 안 마시기', 'habit')
      add('30분 걷기·운동', 'habit')
      continue
    }
    // Daily: one habit to do, plus what they already take — at most two rows.
    add(habits.exercises ? '운동 30분' : '걷기 30분', 'habit', habits.exercises ? '하던 운동 그대로' : '가볍게 시작해요')
    if (habits.takesSupplements) add('먹던 영양제', 'supplement', '하던 그대로')
    // Weekly check-ins: holding back isn't a daily chore (no 콕 on these).
    if (habits.smokes) add('금연', 'habit', '주 1회 체크인', 'weekly')
    if (habits.drinks !== 'rarely') add('금주', 'habit', '주 1회 체크인', 'weekly')
    if (m.role !== 'wife') add('사우나·뜨거운 탕 쉬기', 'habit', '고환 온도 · 주 1회 체크인', 'weekly')
  }
  return items
}

export interface OnboardingInput {
  me: { name: string; role: Role; birthYear?: number }
  partner: { name: string; role: Role; birthYear?: number }
  /** Which member's cycle is tracked. */
  cycleOwner: MemberId
  lastPeriodStart?: string
  cycleLength?: number
  periodLength?: number
  /** "주기가 45일 이상이거나 들쭉날쭉해요" (N12) — saved as cycle.longCycles when true. */
  longCycles?: boolean
  ttcStart?: string
  /** The partner's (non-cycle-owner's) answers; omit to keep the original starter list. */
  habits?: HabitAnswers
}

export function createInitialState(input: OnboardingInput, now = new Date()): AppState {
  const today = todayISO(now)
  const members: [Member, Member] = [
    {
      id: 'a',
      name: input.me.name.trim() || ROLE_LABEL[input.me.role],
      role: input.me.role,
      birthYear: input.me.birthYear,
      tracksCycle: input.cycleOwner === 'a',
      emoji: ROLE_EMOJI[input.me.role],
    },
    {
      id: 'b',
      name: input.partner.name.trim() || ROLE_LABEL[input.partner.role],
      role: input.partner.role,
      birthYear: input.partner.birthYear,
      tracksCycle: input.cycleOwner === 'b',
      emoji: ROLE_EMOJI[input.partner.role],
    },
  ]
  return {
    version: 1,
    // Local-date-prefixed like every other timestamp, so createdAt.slice(0, 10)
    // is the day the couple started (a UTC string reads as yesterday before 9am in Korea).
    createdAt: localNowISO(now),
    onboarded: true,
    // No cover photo yet (couple.cover): the home shows the default art until
    // one of them hangs a photo (components/cover/CoverSheet).
    couple: { members, inviteCode: inviteCode() },
    stage: 'preparing',
    checkItems: defaultCheckItems(members, today, input.habits),
    checkLog: {},
    periods: input.lastPeriodStart ? [{ start: input.lastPeriodStart }] : [],
    lhTests: [],
    cycle: {
      cycleLength: input.cycleLength ?? DEFAULT_CYCLE_LENGTH,
      periodLength: input.periodLength ?? DEFAULT_PERIOD_LENGTH,
      ...(input.longCycles ? { longCycles: true } : {}),
    },
    notifications: [],
    datePlans: [],
    diary: [],
    growth: [],
    milestones: [],
    anniversaries: [],
    appointments: [],
    planDone: {},
    customTasks: [],
    pregnancyTests: [],
    settings: {
      discreet: false,
      browserNotifications: false,
      lowPressure: false,
      alertStyle: { a: members[0].tracksCycle ? 'explicit' : 'soft', b: members[1].tracksCycle ? 'explicit' : 'soft' },
      ttcStart: input.ttcStart ?? today,
      // Privacy by default: the partner sees the shared 우리의 주간, not the details.
      shareCycleDetails: false,
      // memories / anniversaryAlerts / showTryCount stay unset (SETTINGS_DEFAULTS);
      // so do treatments, leaveDays and intimacy at the root — nothing until the
      // couple adds one (lib/logic/treatments.ts, lib/logic/intimacy.ts).
    },
  }
}

// ── Onboarding answers that the draft (lib/demo) doesn't carry ──

export interface OnboardingExtras {
  /** The partner's habits (builds their starter list). */
  habits?: HabitAnswers
  /** Chosen by the cycle owner: the partner also sees period days and LH / test results. */
  shareCycleDetails?: boolean
  /** The onboarding person's own (member 'a') 부담 없이 / 잠금화면 숨김 — per person, never couple-wide. */
  myPrefs?: { lowPressure?: boolean; discreet?: boolean }
}

/**
 * Apply the extra onboarding answers on top of a freshly built state:
 * rebuild the starter checklist from the habit answers, set the sharing choice
 * (only the cycle owner's answer counts — otherwise it stays private), and save
 * the person's own prefs under settings.personal.a.
 */
export function applyOnboardingExtras(state: AppState, extras: OnboardingExtras, today: ISODate): AppState {
  let s = state
  if (extras.habits) {
    s = { ...s, checkItems: defaultCheckItems(s.couple.members, today, extras.habits), checkLog: {} }
  }
  const ownerIsMe = s.couple.members.find((m) => m.tracksCycle)?.id === 'a'
  const share = ownerIsMe ? extras.shareCycleDetails === true : false
  const mine = extras.myPrefs
  const personal = mine
    ? {
        ...(s.settings.personal ?? {}),
        a: {
          ...(s.settings.personal?.a ?? {}),
          ...(mine.lowPressure !== undefined ? { lowPressure: mine.lowPressure } : {}),
          ...(mine.discreet !== undefined ? { discreet: mine.discreet } : {}),
        },
      }
    : s.settings.personal
  return {
    ...s,
    settings: {
      ...s.settings,
      shareCycleDetails: share,
      ...(personal ? { personal } : {}),
    },
  }
}
