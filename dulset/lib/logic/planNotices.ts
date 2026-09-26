// Reminders for hard administrative deadlines on the 챙길 것 roadmap
// (출생신고 1개월, 행복출산 60일, 산후도우미 바우처 …). Kept out of
// notifications.ts so the plan view-model (which reads pregnancy helpers that
// themselves use notifications) doesn't form an import cycle.

import { ROADMAP } from '../content/roadmap'
import { diffDays, formatKo } from '../dates'
import type { AppState, Appointment, ISODate } from '../types'
import { appointmentNotices } from './appointments'
import type { Notice } from './notifications'
import { planItems } from './plan'

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

export function planDeadlineNotices(state: AppState, today: ISODate): Notice[] {
  // Every hard deadline on the roadmap is tied to the pregnancy or the birth.
  if (state.stage === 'preparing') return []
  const out: Notice[] = []
  for (const it of planItems(state, today)) {
    if (!it.deadline || it.status === 'done' || it.lapsed || !it.end || it.pending) continue
    if (!it.start || today < it.start) continue
    const until = diffDays(today, it.end)
    if (!(DEADLINE_REMINDER_DAYS as readonly number[]).includes(until)) continue
    for (const to of it.owners) {
      out.push({
        key: `deadline:${it.id}:${it.end}:${until}:${to}`,
        to,
        kind: 'system',
        title: `📝 ${it.title} ${until === 0 ? '오늘까지예요' : `D-${until}`}`,
        body: `${formatKo(it.end)}까지예요. 이미 했다면 챙길 것에서 체크해 주세요.`,
      })
    }
  }
  return out
}
