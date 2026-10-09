// Reminders for hard administrative deadlines on the 챙길 것 roadmap
// (출생신고 1개월, 행복출산 60일, 산후도우미 바우처 …), for the couple's own
// dated items that asked for them ('기한', CustomTask.deadlineAlerts), and for
// the 지원결정통지서 written on a 난임 시술 회차 (Next B, D-30 · D-7 · D-1).
// Kept out of notifications.ts so the plan view-model (which reads pregnancy
// helpers that themselves use notifications) doesn't form an import cycle.

import { ROADMAP } from '../content/roadmap'
import { addDays, diffDays, formatKo, isISODate } from '../dates'
import { isLive } from '../sync/model'
import { MEMBER_IDS, type AppState, type Appointment, type AppointmentKind, type CustomTask, type ISODate, type MemberId } from '../types'
import { APPOINTMENT_KIND_EMOJI, appointmentNotices } from './appointments'
import type { Notice } from './notifications'
import { monthlyTask, partnerId } from './partnerTrack'
import { planItems } from './plan'
import { recentlyEnded } from './pregnancy'
import { noticeStatus } from './treatments'
import { partnerTaskVisible } from './ttcFlow'
import { weekQuiet } from './weekTogether'

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

/**
 * Appointment reminders, minus visits that belonged to an ended pregnancy (and
 * tombstones — a deleted appointment is never a reminder). While pregnant, the
 * 함께하는 사람's heads-up the day before one of HER appointments says what he
 * can do (togetherAppointmentNotice).
 */
export function appointmentReminders(state: AppState, today: ISODate): Notice[] {
  const list = appointmentNotices(state, today, (a) => !isLive(a) || isForEndedPregnancy(state, a))
  if (!togetherNoticesOn(state, today)) return list
  const tomorrow = addDays(today, 1)
  const carrier = carrierId(state)
  const hers = new Map(
    state.appointments.filter((a) => a.who === carrier && isLive(a) && !a.done && a.date === tomorrow).map((a) => [fyiKey(a, partnerId(state)), a]),
  )
  return list.map((n) => {
    const a = n.key ? hers.get(n.key) : undefined
    return a ? togetherAppointmentNotice(state, a, n) : n
  })
}

// ── 같이 챙길 것: his heads-up the day before (2026-10-09) ────
//
// What she looks after keeps showing on his screens, so the day before one
// of HER appointments (or one of her own dated items) while pregnant, he
// gets one gentle line with what he can do: '🏥 내일 지은님 정기 검진이에요' ·
// '같이 갈 수 있으면 시간 비워 두기 · 10월 10일 (토) 14:00'. The words are the
// title she already shares in 챙길 것 and the item's support line (lib/content
// roadmap `support`) — nothing from her cycle, no result, no note. Keys carry
// the appointment / item id and its day only:
//   'appt:<id>:<date>:fyi:<member>'           — the appointment's own heads-up
//     (lib/logic/appointments), reworded: one notice, never two;
//   'deadline:together:<task id>:<due>:<member>' — her own dated item.
// Both prefixes open 챙길 것 (today.noticeTarget). Not for someone whose alert
// style is 'off' (they keep the plain heads-up), not in the quiet after a loss;
// the lock screen hides the words in 잠금화면 숨김 (useNotificationEngine).

/** The generic line when the appointment is not linked to an item with a support line. */
export const TOGETHER_VISIT_LINE = '같이 갈 수 있으면 시간 비워 두기'
export const TOGETHER_TASK_LINE = '도울 게 있는지 물어보기'

const VISIT_KINDS: readonly AppointmentKind[] = ['hospital', 'test', 'vaccine', 'injection']

function carrierId(state: Pick<AppState, 'couple'>): MemberId {
  return state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
}

const fyiKey = (a: Appointment, to: MemberId): string => `appt:${a.id}:${a.date}:fyi:${to}`

/** 'deadline:together:<task id>:<due>:<member>' — her dated item, the day before. */
export function togetherTaskKey(taskId: string, due: ISODate, to: MemberId): string {
  return `deadline:together:${taskId}:${due}:${to}`
}

/** While pregnant, outside the quiet, for a partner whose alert style is not 'off'. */
function togetherNoticesOn(state: AppState, today: ISODate): boolean {
  if (state.stage !== 'pregnant' || !isISODate(today) || weekQuiet(state, today)) return false
  return (state.settings.alertStyle?.[partnerId(state)] ?? 'soft') !== 'off'
}

/** '이에요' after a final consonant, '예요' after a vowel; nothing after a non-Hangul end. */
function ieyo(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1)
  if (code < 0xac00 || code > 0xd7a3) return ''
  return (code - 0xac00) % 28 === 0 ? '예요' : '이에요'
}

function nameOf(state: AppState, id: MemberId): string {
  const name = state.couple.members.find((m) => m.id === id)?.name?.trim()
  return name ? `${name}님` : '기록하는 사람'
}

/** His heads-up for one of her appointments tomorrow, in place of the plain one. */
function togetherAppointmentNotice(state: AppState, a: Appointment, plain: Notice): Notice {
  const linked = a.taskId ? ROADMAP.find((t) => t.id === a.taskId)?.support : undefined
  const line = linked ?? (VISIT_KINDS.includes(a.kind) ? TOGETHER_VISIT_LINE : TOGETHER_TASK_LINE)
  const when = `${formatKo(a.date)}${a.time ? ` ${a.time}` : ''}`
  return {
    ...plain,
    title: `${APPOINTMENT_KIND_EMOJI[a.kind]} 내일 ${nameOf(state, a.who as MemberId)} ${a.title}${ieyo(a.title)}`,
    body: `${line} · ${when}${a.place ? ` · ${a.place}` : ''}`,
  }
}

/**
 * Her own dated items (직접 추가, who = her) due tomorrow, while pregnant: one
 * heads-up for him ('📝 내일 지은님 …' · '도울 게 있는지 물어보기').
 */
export function togetherTaskNotices(state: AppState, today: ISODate): Notice[] {
  if (!togetherNoticesOn(state, today)) return []
  const tomorrow = addDays(today, 1)
  const carrier = carrierId(state)
  const to = partnerId(state)
  return state.customTasks
    .filter((c) => c.who === carrier && isLive(c) && !c.doneAt && c.due === tomorrow)
    .map((c) => ({
      key: togetherTaskKey(c.id, c.due!, to),
      to,
      kind: 'system' as const,
      title: `📝 내일 ${nameOf(state, carrier)} ${c.title}`,
      body: `${TOGETHER_TASK_LINE} · ${formatKo(c.due!)}`,
    }))
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

// ── 이번 달 할 일 (N30, preparing) ────────────────────────────
//
// His month task's three dates (docs/positioning.md §3-1, partnerTrack
// fertilityChain): the day after a booked test with no '다녀왔어요' yet, the
// 검사 deadline (신청 후 3개월) and the 청구 deadline (검사 후 1개월) — D-7 ·
// D-1 · 당일. To the partner only, from his own chain and his own booking:
// nothing here reads her cycle. Not in the quiet after a pregnancy ended
// (ttcFlow.partnerTaskVisible — the task card rests then too). The keys name
// the step, its deadline and his booking's id — no health data of hers — and
// start with 'deadline:task-', so the notice opens his month task card on 오늘
// while preparing (today.noticeTarget).

/** Every key monthlyTaskNotices writes: the step, his deadline or booking id, and him — nothing else (tests read it). */
export const MONTHLY_TASK_KEY_SAFE = /^deadline:task-(?:visit:[\w-]+|(?:test|claim):\d{4}-\d{2}-\d{2}:\d):[ab]$/

/** 'deadline:task-visit:<appointment id>:<member>' — once per booking. */
export function taskVisitKey(appointmentId: string, to: MemberId): string {
  return `deadline:task-visit:${appointmentId}:${to}`
}

/** 'deadline:task-<test|claim>:<deadline>:<days left>:<member>'. */
export function taskDueKey(step: 'test' | 'claim', dueBy: ISODate, until: number, to: MemberId): string {
  return `deadline:task-${step}:${dueBy}:${until}:${to}`
}

export function monthlyTaskNotices(state: AppState, today: ISODate): Notice[] {
  if (state.stage !== 'preparing' || !isISODate(today)) return []
  const to = partnerId(state)
  if (!partnerTaskVisible(state, today, to)) return []
  const task = monthlyTask(state, today, to)
  if (task?.step !== 'test' && task?.step !== 'claim') return []
  const out: Notice[] = []
  const a = task.appointment
  if (task.step === 'test' && task.stage === 'visited' && a && a.date < today) {
    out.push({
      key: taskVisitKey(a.id, to),
      to,
      kind: 'system',
      title: '📝 검사 다녀왔어요?',
      body: `${formatKo(a.date)} 예약이었어요. 다녀왔다면 이번 달 할 일에서 ‘네, 다녀왔어요’를 눌러 주세요.`,
    })
  }
  const until = task.dueBy && task.status !== 'overdue' ? diffDays(today, task.dueBy) : undefined
  if (task.dueBy && until !== undefined && (DEADLINE_REMINDER_DAYS as readonly number[]).includes(until)) {
    out.push({
      key: taskDueKey(task.step, task.dueBy, until, to),
      to,
      kind: 'system',
      title: `📝 ${task.title} ${until === 0 ? '오늘까지예요' : `D-${until}`}`,
      body:
        task.step === 'test'
          ? `검사 마감 ${formatKo(task.dueBy)} · 신청 후 3개월 안이에요. 이미 받았다면 이번 달 할 일에서 체크해 주세요.`
          : `청구 마감 ${formatKo(task.dueBy)} · 검사 후 1개월 안이에요. 이미 청구했다면 이번 달 할 일에서 체크해 주세요.`,
    })
  }
  return out
}

export function planDeadlineNotices(state: AppState, today: ISODate): Notice[] {
  const out: Notice[] = []
  // The couple's own '기한' items go out in every stage — these, the
  // 지원결정통지서 and his month task's dates are the only deadline notices while
  // preparing (every other roadmap deadline is tied to the pregnancy or the birth).
  for (const c of customDeadlineTasks(state)) {
    const until = diffDays(today, c.due)
    if (!(DEADLINE_REMINDER_DAYS as readonly number[]).includes(until)) continue
    const owners: MemberId[] = c.who === 'both' ? ['a', 'b'] : [c.who]
    for (const to of owners) out.push(deadlineNotice({ id: c.id, title: c.title, end: c.due }, until, to))
  }
  out.push(...noticeExpiryNotices(state, today))
  // His month task's dates (N30) — the only roadmap-chain notices while preparing.
  out.push(...monthlyTaskNotices(state, today))
  // Her own dated items, the day before, for him (pregnant stage).
  out.push(...togetherTaskNotices(state, today))
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
