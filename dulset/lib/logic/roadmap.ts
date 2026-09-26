// "챙길 것" — the couple's road from preparing to birth (pure).
//
// Items come from lib/content/roadmap.ts (templates with research-backed timing)
// plus the couple's own custom tasks. A template may carry a date window
// anchored to the last period (LMP), the due date (EDD) or the birth date;
// windows resolve to real dates once that anchor exists.

import { addDays, diffDays } from '../dates'
import { uid } from '../id'
import type { AppState, CustomTask, ISODate, MemberId, RoadmapPhase, Stage } from '../types'
import { dueDate } from './pregnancy'

export const PHASES: readonly RoadmapPhase[] = [
  'preconception',
  'pregnancy-1st',
  'pregnancy-2nd',
  'pregnancy-3rd',
  'birth',
  'postpartum',
] as const

export const PHASE_LABEL: Record<RoadmapPhase, string> = {
  preconception: '임신 준비',
  'pregnancy-1st': '임신 초기 (~13주)',
  'pregnancy-2nd': '임신 중기 (14~27주)',
  'pregnancy-3rd': '임신 후기 (28주~)',
  birth: '출산 직후',
  postpartum: '출산 후',
}

/** Phases shown first for each life stage (others stay reachable). */
export const STAGE_PHASES: Record<Stage, RoadmapPhase[]> = {
  preparing: ['preconception'],
  pregnant: ['pregnancy-1st', 'pregnancy-2nd', 'pregnancy-3rd', 'birth'],
  parenting: ['birth', 'postpartum'],
}

/** Who a template is for: the person who carries the pregnancy, the other partner, or both. */
export type RoadmapWho = 'carrier' | 'partner' | 'both'

export type RoadmapKind = 'hospital' | 'test' | 'vaccine' | 'admin' | 'work' | 'prep' | 'habit'

export interface RoadmapWindow {
  anchor: 'lmp' | 'edd' | 'birth'
  /** Offset in days from the anchor where the window opens. */
  start: number
  /** Offset where it closes (inclusive). Omit for "from start onward". */
  end?: number
}

export interface RoadmapTemplate {
  id: string
  phase: RoadmapPhase
  who: RoadmapWho
  kind: RoadmapKind
  title: string
  /** Human timing, e.g. "임신 11주~13주 6일". */
  when: string
  /** 1–3 sentences: what and why. */
  detail: string
  window?: RoadmapWindow
  /** A legal/administrative deadline (missing it costs money or rights). */
  deadline?: boolean
  /** Completion lives in state.milestones under this key (shared with 임신/아기 tabs). */
  milestoneKey?: string
  link?: { label: string; url: string }
  sources: Array<{ name: string; url: string }>
}

export type ItemStatus = 'done' | 'overdue' | 'now' | 'soon' | 'later' | 'undated'

export interface RoadmapItem {
  id: string
  custom: boolean
  phase: RoadmapPhase
  title: string
  when: string
  detail?: string
  kind: RoadmapKind
  /** Concrete member(s) responsible. */
  owners: MemberId[]
  who: RoadmapWho
  start?: ISODate
  end?: ISODate
  deadline: boolean
  status: ItemStatus
  doneAt?: ISODate
  doneBy?: MemberId
  template?: RoadmapTemplate
}

export const SOON_DAYS = 14

export interface Anchors {
  lmp?: ISODate
  edd?: ISODate
  birth?: ISODate
}

export function anchorsOf(state: Pick<AppState, 'pregnancy' | 'baby'>): Anchors {
  const out: Anchors = {}
  if (state.pregnancy) {
    out.lmp = state.pregnancy.lmp
    out.edd = dueDate(state.pregnancy)
  }
  if (state.baby) out.birth = state.baby.birthDate
  return out
}

export function resolveWindow(w: RoadmapWindow | undefined, anchors: Anchors): { start?: ISODate; end?: ISODate } {
  if (!w) return {}
  const base = anchors[w.anchor]
  if (!base) return {}
  return { start: addDays(base, w.start), end: w.end === undefined ? undefined : addDays(base, w.end) }
}

export function ownersOf(state: Pick<AppState, 'couple'>, who: RoadmapWho): MemberId[] {
  const carrier = state.couple.members.find((m) => m.tracksCycle)?.id ?? 'a'
  const partner: MemberId = carrier === 'a' ? 'b' : 'a'
  return who === 'both' ? ['a', 'b'] : who === 'carrier' ? [carrier] : [partner]
}

export function statusFor(
  opts: { done: boolean; start?: ISODate; end?: ISODate; deadline: boolean },
  today: ISODate,
): ItemStatus {
  if (opts.done) return 'done'
  if (!opts.start) return 'undated'
  if (opts.end && today > opts.end) return opts.deadline ? 'overdue' : 'later'
  if (today >= opts.start) return 'now'
  if (diffDays(today, opts.start) <= SOON_DAYS) return 'soon'
  return 'later'
}

/** Completion read from the right place (shared milestone key or planDone). */
export function doneInfo(
  state: Pick<AppState, 'planDone' | 'milestones'>,
  t: Pick<RoadmapTemplate, 'id' | 'milestoneKey'>,
): { at: ISODate; by?: MemberId } | undefined {
  if (t.milestoneKey) {
    const m = state.milestones.find((x) => x.key === t.milestoneKey)
    return m ? { at: m.date } : undefined
  }
  return state.planDone[t.id]
}

export function buildItems(
  state: Pick<AppState, 'couple' | 'pregnancy' | 'baby' | 'planDone' | 'milestones' | 'customTasks'>,
  templates: RoadmapTemplate[],
  today: ISODate,
): RoadmapItem[] {
  const anchors = anchorsOf(state)
  const items: RoadmapItem[] = templates.map((t) => {
    const { start, end } = resolveWindow(t.window, anchors)
    const d = doneInfo(state, t)
    return {
      id: t.id,
      custom: false,
      phase: t.phase,
      title: t.title,
      when: t.when,
      detail: t.detail,
      kind: t.kind,
      who: t.who,
      owners: ownersOf(state, t.who),
      start,
      end,
      deadline: !!t.deadline,
      status: statusFor({ done: !!d, start, end, deadline: !!t.deadline }, today),
      doneAt: d?.at,
      doneBy: d?.by,
      template: t,
    }
  })
  for (const c of state.customTasks) {
    items.push({
      id: c.id,
      custom: true,
      phase: c.phase,
      title: c.title,
      when: c.due ? '' : '날짜 없음',
      kind: 'prep',
      who: c.who === 'both' ? 'both' : c.who === ownersOf(state, 'carrier')[0] ? 'carrier' : 'partner',
      owners: c.who === 'both' ? ['a', 'b'] : [c.who],
      start: c.due,
      end: c.due,
      deadline: false,
      status: statusFor({ done: !!c.doneAt, start: c.due, end: c.due, deadline: false }, today),
      doneAt: c.doneAt,
      doneBy: c.doneBy,
    })
  }
  return items
}

const STATUS_ORDER: Record<ItemStatus, number> = { overdue: 0, now: 1, soon: 2, undated: 3, later: 4, done: 5 }

/** Within a phase: overdue → now → soon → undated → later → done, then by date. */
export function sortItems(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (s) return s
    const da = a.start ?? '9999-12-31'
    const db = b.start ?? '9999-12-31'
    return da < db ? -1 : da > db ? 1 : 0
  })
}

export function byPhase(items: RoadmapItem[]): Map<RoadmapPhase, RoadmapItem[]> {
  const map = new Map<RoadmapPhase, RoadmapItem[]>()
  for (const p of PHASES) map.set(p, [])
  for (const it of items) map.get(it.phase)!.push(it)
  for (const [p, list] of map) map.set(p, sortItems(list))
  return map
}

/** What matters this week: overdue deadlines, open windows, and items opening soon. */
export function focusItems(items: RoadmapItem[], limit = 3): RoadmapItem[] {
  return sortItems(items.filter((i) => i.status === 'overdue' || i.status === 'now' || i.status === 'soon')).slice(0, limit)
}

export function progressOf(items: RoadmapItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.status === 'done').length, total: items.length }
}

// ── Mutations ───────────────────────────────────────────────

export function setTemplateDone(
  state: AppState,
  t: Pick<RoadmapTemplate, 'id' | 'milestoneKey'>,
  done: boolean,
  today: ISODate,
  by: MemberId,
): AppState {
  if (t.milestoneKey) {
    const key = t.milestoneKey
    const milestones = state.milestones.filter((m) => m.key !== key)
    if (done) milestones.push({ key, date: today })
    return { ...state, milestones }
  }
  const planDone = { ...state.planDone }
  if (done) planDone[t.id] = { at: today, by }
  else delete planDone[t.id]
  return { ...state, planDone }
}

export function addCustomTask(
  state: AppState,
  input: { title: string; phase: RoadmapPhase; who: MemberId | 'both'; due?: ISODate },
  createdBy: MemberId,
): AppState {
  const title = input.title.trim()
  if (!title) return state
  const task: CustomTask = { id: uid(), title, phase: input.phase, who: input.who, createdBy, ...(input.due ? { due: input.due } : {}) }
  return { ...state, customTasks: [...state.customTasks, task] }
}

export function setCustomTaskDone(state: AppState, id: string, done: boolean, today: ISODate, by: MemberId): AppState {
  return {
    ...state,
    customTasks: state.customTasks.map((c) => {
      if (c.id !== id) return c
      if (done) return { ...c, doneAt: today, doneBy: by }
      const { doneAt: _a, doneBy: _b, ...rest } = c
      return rest
    }),
  }
}

export function removeCustomTask(state: AppState, id: string): AppState {
  return { ...state, customTasks: state.customTasks.filter((c) => c.id !== id) }
}
