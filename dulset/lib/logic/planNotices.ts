// Reminders for hard administrative deadlines on the 챙길 것 roadmap
// (출생신고 1개월, 행복출산 60일, 산후도우미 바우처 …), for the couple's own
// dated items that asked for them ('기한', CustomTask.deadlineAlerts), and for
// the 지원결정통지서 written on a 난임 시술 회차 (Next B, D-30 · D-7 · D-1).
// Kept out of notifications.ts so the plan view-model (which reads pregnancy
// helpers that themselves use notifications) doesn't form an import cycle.

import { ROADMAP } from '../content/roadmap'
import { diffDays, formatKo, isISODate } from '../dates'
import { MEMBER_IDS, type AppState, type Appointment, type CustomTask, type ISODate, type MemberId } from '../types'
import { appointmentNotices } from './appointments'
import type { Notice } from './notifications'
import { planItems } from './plan'
import { recentlyEnded } from './pregnancy'
import { noticeStatus } from './treatments'

let phaseByTemplate: Map<string, string> | undefined
function templatePhase(id: string): string | undefined {
  phaseByTemplate ??= new Map(ROADMAP.map((t) => [t.id, t.phase]))
  return phaseByTemplate.get(id)
}

/**
 * Visits booked for a pregnancy that has ended (back to preparing): 정밀초음파,
 * 조리원 상담 … — no reminders for those. Birth-phase visits stay when a baby
 * exists (e.g. preparing for a second child).
 */
export function isForEndedPregnancy(
  state: Pick<AppState, 'stage' | 'pregnancy' | 'baby' | 'customTasks'>,
  a: Appointment,
): boolean {
  if (state.stage !== 'preparing' || !state.pregnancy?.endedAt || !a.taskId) return false
  const phase = templatePhase(a.taskId) ?? state.customTasks.find((c) => c.id === a.taskId)?.phase
  if (!phase) return false
  return phase.startsWith('pregnancy') || (phase === 'birth' && !state.baby)
}

/** Appointment reminders, minus visits that belonged to an ended pregnancy. */
export function appointmentReminders(state: AppState, today: ISODate): Notice[] {
  return appointmentNotices(state, today, (a) => isForEndedPregnancy(state, a))
}

/** Days before the last day on which a reminder goes out. */
export const DEADLINE_REMINDER_DAYS = [7, 1, 0] as const

function deadlineNotice(it: { id: string; title: string; end: ISODate }, until: number, to: MemberId): Notice {
  return {
    key: `deadline:${it.id}:${it.end}:${until}:${to}`,
    to,
    kind: 'system',
    title: `📝 ${it.title} ${until === 0 ? '오늘까지예요' : `D-${until}`}`,
    body: `${formatKo(it.end)}까지예요. 이미 했다면 챙길 것에서 체크해 주세요.`,
  }
}

/**
 * The couple's own items that asked for deadline notices (N13 '기한'): dated,
 * not done, and `deadlineAlerts` on. Off by default, so a shopping item never nags.
 */
export function customDeadlineTasks(state: Pick<AppState, 'customTasks'>): Array<CustomTask & { due: ISODate }> {
  return state.customTasks.filter((c): c is CustomTask & { due: ISODate } => c.deadlineAlerts === true && !c.doneAt && isISODate(c.due))
}

// ── 지원결정통지서 만료 (Next B) ─────────────────────────────

/** Days before the last valid day of a 지원결정통지서 on which a reminder goes out. */
export const NOTICE_EXPIRY_REMINDER_DAYS = [30, 7, 1] as const

/** 'notice-expiry:<last valid day>:<days left>:<member>' — one per step and person. */
export function noticeExpiryKey(expires: ISODate, until: number, to: MemberId): string {
  return `notice-expiry:${expires}:${until}:${to}`
}

export const NOTICE_EXPIRY_TITLE = '📄 지원결정통지서 만료'

/**
 * The newest 지원결정통지서 on the couple's attempts (lib/logic/treatments.ts
 * noticeStatus): D-30 · D-7 · D-1 to both people, while preparing and while it
 * is still valid. Not in the 42 quiet days after a pregnancy ended — the
 * notice that attempt used is spent, and nothing nags then. The wording says
 * what the date is, not what to do about a used one: 보건소마다 달라요.
 */
export function noticeExpiryNotices(state: AppState, today: ISODate): Notice[] {
  if (state.stage !== 'preparing' || recentlyEnded(state, today)) return []
  const n = noticeStatus(state, today)
  if (!n || n.expired || !(NOTICE_EXPIRY_REMINDER_DAYS as readonly number[]).includes(n.daysLeft)) return []
  return MEMBER_IDS.map((to) => ({
    key: noticeExpiryKey(n.expires, n.daysLeft, to),
    to,
    kind: 'system',
    title: `${NOTICE_EXPIRY_TITLE} D-${n.daysLeft}`,
    body: `${formatKo(n.expires)}까지 유효해요. 다음 시술은 그 안에 시작해야 지원이 적용돼요. 자세한 건 보건소마다 달라요.`,
  }))
}

export function planDeadlineNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  // The couple's own '기한' items go out in every stage — these and the
  // 지원결정통지서 are the only deadline notices while preparing (every roadmap
  // deadline is tied to the pregnancy or the birth).
  for (const c of customDeadlineTasks(state)) {
    const until = diffDays(today, c.due)
    if (!(DEADLINE_REMINDER_DAYS as readonly number[]).includes(until)) continue
    const owners: MemberId[] = c.who === 'both' ? ['a', 'b'] : [c.who]
    for (const to of owners) out.push(deadlineNotice({ id: c.id, title: c.title, end: c.due }, until, to))
  }
  out.push(...noticeExpiryNotices(state, today))
  if (state.stage === 'preparing') return out
  for (const it of planItems(state, today)) {
    if (it.custom || !it.deadline || it.status === 'done' || it.lapsed || !it.end || it.pending) continue
    if (!it.start || today < it.start) continue
    const until = diffDays(today, it.end)
    if (!(DEADLINE_REMINDER_DAYS as readonly number[]).includes(until)) continue
    for (const to of it.owners) out.push(deadlineNotice({ id: it.id, title: it.title, end: it.end }, until, to))
  }
  return out
}
