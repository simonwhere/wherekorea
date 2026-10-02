// Suggested daily-check items and the evidence behind each one.
//
// The items live in ./data/supplements.json (sources: the guideline / trial
// pages collected in docs/research/medical.json), each with its audit fields
// (lib/content/meta.ts). Wording stays conservative: every item says how
// strong the evidence is, and items without benefit are shown as information
// only — the app never "sells" a supplement. This module is the typed loader
// plus the small pure helpers the screens use.

import type { CheckItem, CheckKind, Stage } from '../types'
import data from './data/supplements.json'
import { auditOf, checkAudited, stripAudit, type ContentAudit, type ContentSource } from './meta'

/**
 * Who a suggestion is for. 'partner' means the member whose cycle is NOT
 * tracked (sperm-side advice), not "the other person on this phone".
 */
export type Audience = 'cycle-owner' | 'partner' | 'both'

export type Evidence = 'strong' | 'moderate' | 'limited' | 'not-recommended'

export interface Suggestion {
  id: string
  label: string
  kind: CheckKind
  note?: string
  audience: Audience
  evidence: Evidence
  /** One line, plain Korean, no medical claims beyond the source. */
  summary: string
  source: { name: string; url: string }
  /** Words that mean the item is already on someone's list (e.g. '담배' for 금연). */
  match?: string[]
  /** Shown as a note only — never offered as a check item. */
  infoOnly?: boolean
  /** Sperm-side advice (heat, men's supplements) — hidden for a non-owner who is '아내'. */
  sperm?: boolean
  /** Stages the item makes sense in (default: every stage). */
  stages?: readonly Stage[]
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: '근거 탄탄',
  moderate: '근거 보통',
  limited: '근거 제한적',
  'not-recommended': '권장하지 않아요',
}

interface SuggestionJson extends Suggestion, ContentAudit {
  sources: ContentSource[]
}
interface SupplementsJson {
  checkedAt: string
  items: SuggestionJson[]
}

const raw = data as unknown as SupplementsJson
checkAudited(raw.items, 'supplements.items')

export const SUGGESTIONS_CHECKED_AT: string = raw.checkedAt

export const SUGGESTIONS: Suggestion[] = raw.items.map((s) => {
  const { sources: _s, ...rest } = stripAudit(s)
  return rest
})

/** The audit of each suggestion by id ('미확인' = verified false, see checkNote). */
export const SUGGESTION_AUDIT: Readonly<Record<string, ContentAudit>> = Object.fromEntries(raw.items.map((s) => [s.id, auditOf(s)]))

/** Lowercase, no spaces or separators — so '비타민 D' matches '비타민d'. */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[\s·・,./()\-_]/g, '')
}

export function isSuggestionAdded(s: Suggestion, items: Pick<CheckItem, 'label'>[]): boolean {
  const keys = [s.label, ...(s.match ?? [])].map(normalizeLabel).filter(Boolean)
  return items.some((i) => {
    const l = normalizeLabel(i.label)
    return keys.some((k) => l.includes(k))
  })
}

export interface SuggestionFilter {
  /** false hides sperm-side items (see lib/logic/today isSpermSide). Default true. */
  sperm?: boolean
  /** The couple's stage — hides items that only fit another stage. Default: no stage filter. */
  stage?: Stage
}

/** Everything relevant to this member, including info-only notes. */
export function suggestionsForRole(role: Exclude<Audience, 'both'>, filter: SuggestionFilter = {}): Suggestion[] {
  const sperm = filter.sperm ?? true
  const stage = filter.stage
  return SUGGESTIONS.filter(
    (s) =>
      (s.audience === 'both' || s.audience === role) &&
      (sperm || !s.sperm) &&
      (!stage || !s.stages || s.stages.includes(stage)),
  )
}

/** Suggestions a member can still add (relevant, not info-only, not on their list yet). */
export function availableSuggestions(
  role: Exclude<Audience, 'both'>,
  items: Pick<CheckItem, 'label'>[],
  filter: SuggestionFilter = {},
): Suggestion[] {
  return suggestionsForRole(role, filter).filter((s) => !s.infoOnly && !isSuggestionAdded(s, items))
}

/** Info-only notes for a member (e.g. "men's zinc/folate pills: no benefit"). */
export function infoNotes(role: Exclude<Audience, 'both'>, filter: SuggestionFilter = {}): Suggestion[] {
  return suggestionsForRole(role, filter).filter((s) => s.infoOnly)
}
