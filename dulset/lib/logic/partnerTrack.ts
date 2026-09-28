// The partner's "이번 달 할 일" — one meaningful task a month instead of many
// daily chores (research: partner features alone don't engage men; a clear,
// bounded task does). Refined in the partner-track step.

import type { AppState, ISODate, MemberId } from '../types'
import { planItems, type PlanItem } from './plan'

/**
 * The single most useful open roadmap item for `member` right now: overdue or
 * open items first, then undated preparing items that are theirs alone.
 */
export function monthlyTask(state: AppState, today: ISODate, member: MemberId): PlanItem | undefined {
  const mine = planItems(state, today).filter(
    (i) => i.status !== 'done' && !i.lapsed && !i.pending && i.owners.includes(member),
  )
  const rank = (i: PlanItem) =>
    (i.status === 'overdue' ? 0 : i.status === 'now' ? 1 : i.status === 'soon' ? 2 : i.status === 'undated' ? 3 : 4) +
    (i.owners.length === 1 ? 0 : 0.5)
  return [...mine].sort((a, b) => rank(a) - rank(b))[0]
}
