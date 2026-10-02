// Korean public support programs the app points couples to. Amounts and rules
// change almost every year and differ by region, so every item carries its
// effective date and an official link. A production app should serve this from
// a server, not hard-code it.
//
// The data lives in ./data/programs.json (one object per program, plus the
// 임신 사전건강관리 step-by-step guide), each with its audit fields
// (effectiveFrom · checkedAt · sources · verified, lib/content/meta.ts). This
// module is the typed loader: it keeps the shapes the screens and logic use
// and exposes the audit separately (PROGRAM_AUDIT).

import type { Stage } from '../types'
import data from './data/programs.json'
import { auditOf, checkAudited, stripAudit, type ContentAudit, type ContentSource } from './meta'

export interface Program {
  id: string
  stages: Stage[]
  title: string
  /** One-line "what you get". */
  benefit: string
  who: string
  how: string
  /** Deadlines worth a reminder. */
  deadline?: string
  /** When the current rule took effect. */
  effective: string
  url: string
  urlLabel: string
}

/** The four papers a 임신 사전건강관리 claim needs (검사 후 1개월 안). */
export const CLAIM_DOC_IDS = ['form', 'receipt', 'statement', 'bankbook'] as const
export type ClaimDocId = (typeof CLAIM_DOC_IDS)[number]
export interface ClaimDoc {
  id: ClaimDocId
  label: string
}

/**
 * 임신 사전건강관리, step by step, for the partner's staged "이번 달 할 일" card
 * (N14). Every line is from docs/research/kr-programs.json ('검사 항목과 금액',
 * '신청과 환급 절차'): apply first → referral → a participating clinic within
 * 3 months → claim within 1 month with four papers → paid within 3 months.
 * Whether one application covers both people is still to be confirmed by a
 * person (docs/STATUS.md N18), so nothing here says so.
 */
export interface FertilityCheckGuide {
  /** What each person's supported test is and what the support covers. */
  test: Readonly<Record<'partner' | 'carrier', { what: string; cost: string }>>
  apply: { where: string; gives: string }
  /** Where to be tested and what to bring. */
  where: string
  bring: string
  claimDocs: readonly ClaimDoc[]
  claimWhere: string
  paidWithin: string
  url: string
  urlLabel: string
  checkedAt: string
}

interface ProgramJson extends Program, ContentAudit {
  sources: ContentSource[]
}
interface GuideJson extends Omit<FertilityCheckGuide, 'checkedAt' | 'claimDocs'>, ContentAudit {
  claimDocs: Array<{ id: string; label: string }>
  sources: ContentSource[]
}
interface ProgramsJson {
  checkedAt: string
  items: ProgramJson[]
  fertilityCheckGuide: GuideJson
}

const raw = data as unknown as ProgramsJson
checkAudited(raw.items, 'programs.items')
checkAudited([raw.fertilityCheckGuide], 'programs.fertilityCheckGuide')

export const PROGRAMS_CHECKED_AT: string = raw.checkedAt

export const PROGRAMS: Program[] = raw.items.map((p) => {
  const { sources: _s, ...rest } = stripAudit(p)
  return rest
})

/** The audit of each program by id, and of the guide under 'fertility-check-guide'. */
export const PROGRAM_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries([
  ...raw.items.map((p) => [p.id, auditOf(p)] as const),
  ['fertility-check-guide', auditOf(raw.fertilityCheckGuide)] as const,
])

const isClaimDocId = (id: string): id is ClaimDocId => (CLAIM_DOC_IDS as readonly string[]).includes(id)

export const FERTILITY_CHECK_GUIDE: FertilityCheckGuide = (() => {
  const { sources: _s, claimDocs, ...g } = stripAudit(raw.fertilityCheckGuide)
  const docs: ClaimDoc[] = claimDocs.map((d) => {
    if (!isClaimDocId(d.id)) throw new Error(`lib/content/data: programs.fertilityCheckGuide — unknown claim doc '${d.id}'`)
    return { id: d.id, label: d.label }
  })
  return { ...g, claimDocs: docs, checkedAt: PROGRAMS_CHECKED_AT }
})()

export function programsFor(stage: Stage): Program[] {
  return PROGRAMS.filter((p) => p.stages.includes(stage))
}

export function programById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id)
}
