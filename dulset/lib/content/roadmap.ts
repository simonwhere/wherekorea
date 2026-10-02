// "챙길 것" roadmap content: what a couple looks after from preparing to the
// first months with the baby — hospitals, tests, vaccines, work rights and
// admin deadlines.
//
// The items live in ./data/roadmap.json (checked research notes:
// medical-checklist, admin-timeline, kr-programs). Rules and amounts change
// almost every year and differ by region, so each item carries its effective
// date, its last check, its sources and a verified flag (lib/content/meta.ts),
// and the UI always says to confirm with the care team / company / 보건소.
// This module is the typed loader: it resolves source keys, milestone keys
// and program links, and keeps every export the screens and logic use.
//
// Windows are in days from an anchor:
//   lmp   — first day of the last period (day 0). "N주 M일" = N*7+M. The 챙길 것
//           view dates it from the due date (due − 280), like the 임신 tab, so a
//           doctor-adjusted due date moves these windows too.
//   edd   — due date. After the birth the 챙길 것 view reads the real birth day
//           here, so rights counted "출산일부터" line up (see lib/logic/plan).
//   birth — birth day (day 0). "N일 안" deadlines use the earliest reading
//           (birth day counted as day 1), like the 60-day claim in lib/logic/babyView.
// Preconception items have no window: there is no date to count from.
// A window without an end stays open until it's ticked (or the birth, for
// pregnancy items): things that are still needed later — a car seat, the
// hospital bag, applications that stay open — never read as "지났어요".

import { CLAIM_KEY, checkupKey } from '../logic/babyView'
import { bagKey, prenatalKey } from '../logic/pregnancyView'
import type { RoadmapTemplate } from '../logic/roadmap'
import type { RoadmapPhase } from '../types'
import data from './data/roadmap.json'
import { auditOf, checkAudited, contentError, resolveSources, type ContentAudit, type ContentSource } from './meta'
import { programById } from './programs'

/**
 * Completion shared between two roadmap items that are the same action seen
 * before and after the birth (e.g. 산후도우미 신청: opens 40 days before the
 * due date, closes 60 days after the birth).
 */
export const planKey = (id: string) => `plan:${id}`

type MilestoneRef = { kind: 'prenatal' | 'bag' | 'checkup' | 'plan'; id: string } | { kind: 'claim' }

interface RoadmapItemJson extends ContentAudit {
  id: string
  phase: RoadmapPhase
  who: RoadmapTemplate['who']
  kind: RoadmapTemplate['kind']
  title: string
  when: string
  detail: string
  window?: RoadmapTemplate['window']
  deadline?: boolean
  /** "1개월 안" in calendar months (MONTH_DEADLINES). */
  monthDeadline?: number
  /** Things to know or keep doing rather than one visit to book (NOT_ONE_APPOINTMENT). */
  notOneAppointment?: boolean
  /** Completion key shared with the 임신 / 아기 tabs. */
  milestone?: MilestoneRef
  /** lib/content/programs id — that program's link wins over `link` (ROADMAP_PROGRAMS). */
  program?: string
  /** Key into `links`, used when the item maps to no program. */
  link?: string
  /** Keys into `sources`. */
  sources: string[]
}

interface RoadmapJson {
  checkedAt: string
  sources: Record<string, ContentSource>
  links: Record<string, { label: string; url: string }>
  items: RoadmapItemJson[]
}

const raw = data as unknown as RoadmapJson
checkAudited(raw.items, 'roadmap.items')

export const ROADMAP_CHECKED_AT: string = raw.checkedAt

/**
 * Deadlines the law counts in calendar months ("1개월 안"), in months from the
 * window's anchor. Windows are in days, so the template itself carries the
 * shortest possible reading (a February birth: 27 days) for any code that reads
 * raw windows; the 챙길 것 view swaps in the exact last day (lib/logic/plan).
 */
export const MONTH_DEADLINES: Readonly<Record<string, number>> = Object.fromEntries(
  raw.items.filter((t) => t.monthDeadline !== undefined).map((t) => [t.id, t.monthDeadline!]),
)

/**
 * Things to know or to keep doing (every visit, all pregnancy long, when it
 * applies) rather than one visit to book: no "일정 잡기" — one appointment
 * marked done would tick the whole item.
 */
export const NOT_ONE_APPOINTMENT: ReadonlySet<string> = new Set(raw.items.filter((t) => t.notOneAppointment).map((t) => t.id))

/** Roadmap item → lib/content/programs id, for the "신청하러 가기" link. */
export const ROADMAP_PROGRAMS: Record<string, string> = Object.fromEntries(
  raw.items.filter((t) => t.program !== undefined).map((t) => [t.id, t.program!]),
)

function programLink(itemId: string): RoadmapTemplate['link'] {
  const p = programById(ROADMAP_PROGRAMS[itemId] ?? '')
  return p ? { label: p.urlLabel, url: p.url } : undefined
}

function milestoneKeyOf(m: MilestoneRef, where: string): string {
  switch (m.kind) {
    case 'prenatal':
      return prenatalKey(m.id)
    case 'bag':
      return bagKey(m.id)
    case 'checkup':
      return checkupKey(m.id)
    case 'plan':
      return planKey(m.id)
    case 'claim':
      return CLAIM_KEY
    default:
      return contentError(where, `unknown milestone kind '${String((m as { kind: string }).kind)}'`)
  }
}

/** Official program link wins over a generic one when the item maps to a program card. */
export const ROADMAP: RoadmapTemplate[] = raw.items.map((t) => {
  const where = `roadmap.items '${t.id}'`
  const link = programLink(t.id) ?? (t.link ? (raw.links[t.link] ?? contentError(where, `unknown link '${t.link}'`)) : undefined)
  const template: RoadmapTemplate = {
    id: t.id,
    phase: t.phase,
    who: t.who,
    kind: t.kind,
    title: t.title,
    when: t.when,
    ...(t.window ? { window: t.window } : {}),
    ...(t.deadline ? { deadline: true } : {}),
    ...(t.milestone ? { milestoneKey: milestoneKeyOf(t.milestone, where) } : {}),
    detail: t.detail,
    sources: resolveSources(t.sources, raw.sources, where).map(({ name, url }) => ({ name, url })),
    ...(link ? { link } : {}),
  }
  return template
})

/** The audit of each item by id ('미확인' = verified false, see checkNote). */
export const ROADMAP_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries(raw.items.map((t) => [t.id, auditOf(t)]))

export function templateById(id: string): RoadmapTemplate | undefined {
  return ROADMAP.find((t) => t.id === id)
}
