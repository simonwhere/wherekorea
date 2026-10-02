// What every content item in lib/content/data/*.json carries besides its own
// fields, and the small helpers the loaders share. Facts about medicine,
// public programs and the law change and go stale, so each item says when
// the rule it describes took effect, when it was last checked, where it comes
// from, and whether a person has confirmed it against the original
// (`verified: false` = '미확인'; scripts/validate-content.mjs insists on a
// `checkNote` then). The loaders strip these fields from what the screens get
// and keep them in a `*_AUDIT` map, so no screen type changed.

export interface ContentAudit {
  /** The day the rule or guidance took effect ('YYYY-MM-DD'); the authoring day when there is no such date. */
  effectiveFrom: string
  /** When the numbers and links were last checked against the sources. */
  checkedAt: string
  /**
   * true: matches a docs/research finding with confidence high. false: the
   * research is medium/low, the original could not be opened, or a question is
   * still open — '미확인' until a person checks it (see checkNote).
   */
  verified: boolean
  /** Why it is still unverified and what to check (required when verified is false). */
  checkNote?: string
}

export interface ContentSource {
  name: string
  url: string
  /** A caveat worth showing next to the source (e.g. a conflict of interest). */
  note?: string
}

/** The audit fields of an item, on their own. */
export function auditOf(item: ContentAudit): ContentAudit {
  return {
    effectiveFrom: item.effectiveFrom,
    checkedAt: item.checkedAt,
    verified: item.verified,
    ...(item.checkNote ? { checkNote: item.checkNote } : {}),
  }
}

/** The item without its audit fields (and without `sources` when the screen type has none). */
export function stripAudit<T extends ContentAudit>(item: T): Omit<T, keyof ContentAudit> {
  const { effectiveFrom: _e, checkedAt: _c, verified: _v, checkNote: _n, ...rest } = item
  return rest
}

export function contentError(where: string, message: string): never {
  throw new Error(`lib/content/data: ${where} — ${message}`)
}

/** Source keys → source objects, in order; an unknown key is a content error. */
export function resolveSources(keys: readonly string[], table: Readonly<Record<string, ContentSource>>, where: string): ContentSource[] {
  return keys.map((k) => table[k] ?? contentError(where, `unknown source '${k}'`))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The cheap structural check the loaders run outside production (the full
 * rules — URL shapes, banned words, research references — live in
 * scripts/validate-content.mjs, which `npm test` runs first). It fails fast
 * so a malformed item never reaches a screen in development or a test.
 */
export function checkAudited(items: ReadonlyArray<ContentAudit & { sources?: unknown }>, where: string): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
  items.forEach((it, i) => {
    const at = `${where}[${i}]`
    if (!ISO_DATE.test(it.effectiveFrom)) contentError(at, `effectiveFrom '${it.effectiveFrom}' is not YYYY-MM-DD`)
    if (!ISO_DATE.test(it.checkedAt)) contentError(at, `checkedAt '${it.checkedAt}' is not YYYY-MM-DD`)
    if (typeof it.verified !== 'boolean') contentError(at, 'verified must be true or false')
    if (!it.verified && !it.checkNote?.trim()) contentError(at, 'an unverified item needs a checkNote')
    if (!Array.isArray(it.sources)) contentError(at, 'sources must be an array')
  })
}
