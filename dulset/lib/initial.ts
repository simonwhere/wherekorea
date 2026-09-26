import { todayISO } from './dates'
import { inviteCode, uid } from './id'
import type { AppState, CheckItem, Member, MemberId, Role } from './types'

export const DEFAULT_CYCLE_LENGTH = 28
export const DEFAULT_PERIOD_LENGTH = 5

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
 * Starter checklist per member. Supplements are only suggestions the couple can
 * edit; the evidence note for each lives in lib/content/supplements.ts.
 */
export function defaultCheckItems(members: [Member, Member], today = todayISO()): CheckItem[] {
  const items: CheckItem[] = []
  for (const m of members) {
    const add = (label: string, kind: CheckItem['kind'], note?: string) =>
      items.push({ id: uid(), owner: m.id, label, kind, note, active: true, createdAt: today })
    if (m.tracksCycle) {
      // Folic acid is the one supplement with strong evidence (USPSTF A, WHO, KDCA).
      add('엽산', 'supplement', '400µg')
      add('비타민 D', 'supplement', '선택')
    } else {
      // For men, zinc/folate pills showed no benefit (FAZST, JAMA 2020) — habits matter more.
      add('사우나·뜨거운 탕 피하기', 'habit', '고환 온도')
      add('담배 안 피우기', 'habit')
    }
    add('술 안 마시기', 'habit')
    add('30분 걷기·운동', 'habit')
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
  ttcStart?: string
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
    createdAt: now.toISOString(),
    onboarded: true,
    couple: { members, inviteCode: inviteCode() },
    stage: 'preparing',
    checkItems: defaultCheckItems(members, today),
    checkLog: {},
    periods: input.lastPeriodStart ? [{ start: input.lastPeriodStart }] : [],
    lhTests: [],
    cycle: {
      cycleLength: input.cycleLength ?? DEFAULT_CYCLE_LENGTH,
      periodLength: input.periodLength ?? DEFAULT_PERIOD_LENGTH,
    },
    notifications: [],
    datePlans: [],
    diary: [],
    growth: [],
    milestones: [],
    settings: {
      discreet: false,
      browserNotifications: false,
      lowPressure: false,
      alertStyle: { a: members[0].tracksCycle ? 'explicit' : 'soft', b: members[1].tracksCycle ? 'explicit' : 'soft' },
      ttcStart: input.ttcStart ?? today,
    },
  }
}
