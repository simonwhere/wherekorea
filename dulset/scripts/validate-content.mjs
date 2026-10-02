#!/usr/bin/env node
// Checks lib/content/data/*.json before the tests run (`npm test`), with no
// build step: plain Node, no imports from the app.
//
// For every file: it parses, has `_meta.audited` (the lists / objects that
// carry audit fields), and every audited item has
//   effectiveFrom · checkedAt   'YYYY-MM-DD' (a real calendar day)
//   sources                     an array; each entry a key of the file's
//                               sources table or an inline { name, url }
//   verified                    true | false
//   checkNote                   non-empty when verified is false ('미확인')
// Every URL in the file (sources, links, items) is https:// or http:// and
// parses. Fact lists (roadmap, programs, supplements, fertility sections)
// need at least one source per item. No banned word (AGENTS.md 제품·문구 규칙)
// in any string of any file. Ids are unique within a list.
//
//   node scripts/validate-content.mjs            # exit 1 on the first file with problems
//   node scripts/validate-content.mjs --summary  # also print the unverified ('미확인') count per file

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** CONTENT_DATA_DIR points the checks at another folder (used to test the validator itself). */
const DATA_DIR = process.env.CONTENT_DATA_DIR ?? join(ROOT, 'lib/content/data')

/** AGENTS.md 금지어 (and the contraception / diagnosis / success-rate phrases the 의료기기 boundary forbids). */
const BANNED = ['숙제', '실패', '노력', '오늘 꼭', '관계를 가져야', '정확한 배란일', '성공률을 높여', '피임 목적으로 써', '진단해 드려']
/** Audited lists whose every item must cite at least one source. */
const NEEDS_SOURCE = new Set([
  'roadmap.items',
  'programs.items',
  'programs.fertilityCheckGuide',
  'supplements.items',
  'fertility.sections',
  'fertility.niceGuidance',
])

const ISO = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDay(s) {
  if (!ISO.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function isUrl(s) {
  if (typeof s !== 'string' || !/^https?:\/\//.test(s)) return false
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

/** Resolve 'a.b.c' inside an object. */
function at(obj, path) {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
}

/** Every string value in a JSON tree, with its path. */
function* strings(value, path = '') {
  if (typeof value === 'string') yield [path, value]
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], `${path}[${i}]`)
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k)
}

function validateFile(name, json) {
  const problems = []
  const bad = (where, msg) => problems.push(`${name}.json ${where}: ${msg}`)
  const meta = json._meta
  if (!meta || !Array.isArray(meta.audited) || meta.audited.length === 0) {
    bad('_meta', 'needs an `audited` list of the item lists that carry audit fields')
    return { problems, unverified: 0, items: 0 }
  }
  if (!isCalendarDay(json.checkedAt ?? '')) bad('checkedAt', `'${json.checkedAt}' is not a calendar day`)

  const sources = json.sources ?? json.tipSources ?? {}
  for (const [key, src] of Object.entries(sources)) {
    const url = src?.url
    const label = src?.name ?? src?.label
    if (!isUrl(url)) bad(`sources.${key}`, `bad url '${url}'`)
    if (typeof label !== 'string' || !label.trim()) bad(`sources.${key}`, 'needs a name/label')
  }
  for (const [key, link] of Object.entries(json.links ?? {})) {
    if (!isUrl(link?.url)) bad(`links.${key}`, `bad url '${link?.url}'`)
    if (typeof link?.label !== 'string' || !link.label.trim()) bad(`links.${key}`, 'needs a label')
  }

  let unverified = 0
  let items = 0
  for (const listPath of meta.audited) {
    const target = at(json, listPath)
    if (target === undefined) {
      bad(listPath, 'listed in _meta.audited but missing')
      continue
    }
    const list = Array.isArray(target) ? target : [target]
    const where = `${name}.${listPath}`
    const ids = new Set()
    list.forEach((it, i) => {
      items += 1
      const id = it?.id ?? it?.key ?? (it?.from !== undefined ? `${it.from}-${it.to}` : it?.name ?? it?.title)
      const here = Array.isArray(target) ? `${listPath}[${i}]${id !== undefined ? ` (${id})` : ''}` : listPath
      if (!it || typeof it !== 'object') return bad(here, 'not an object')
      if (Array.isArray(target) && id !== undefined) {
        if (ids.has(id)) bad(here, `duplicate id '${id}'`)
        ids.add(id)
      }
      if (!isCalendarDay(it.effectiveFrom ?? '')) bad(here, `effectiveFrom '${it.effectiveFrom}' is not a calendar day`)
      if (!isCalendarDay(it.checkedAt ?? '')) bad(here, `checkedAt '${it.checkedAt}' is not a calendar day`)
      if (it.effectiveFrom && it.checkedAt && it.effectiveFrom > it.checkedAt && it.verified === true)
        bad(here, `effectiveFrom ${it.effectiveFrom} is after checkedAt ${it.checkedAt} but verified is true — a future rule cannot be checked yet`)
      if (typeof it.verified !== 'boolean') bad(here, 'verified must be true or false')
      if (it.verified === false) {
        unverified += 1
        if (typeof it.checkNote !== 'string' || !it.checkNote.trim()) bad(here, "verified is false ('미확인') but there is no checkNote")
      }
      if (!Array.isArray(it.sources)) bad(here, 'sources must be an array')
      else {
        if (NEEDS_SOURCE.has(where) && it.sources.length === 0) bad(here, 'a fact item needs at least one source')
        it.sources.forEach((s, j) => {
          if (typeof s === 'string') {
            if (!sources[s]) bad(`${here}.sources[${j}]`, `unknown source key '${s}'`)
          } else if (!s || typeof s !== 'object' || !isUrl(s.url) || typeof s.name !== 'string' || !s.name.trim())
            bad(`${here}.sources[${j}]`, 'an inline source needs { name, url }')
        })
      }
    })
  }

  for (const [path, s] of strings(json)) {
    if (path.startsWith('_meta')) continue
    // Any field that looks like a link must be a real URL.
    if (/(^|\.)url$/.test(path) && !isUrl(s)) bad(path, `bad url '${s}'`)
    // checkNote may quote a research file's own wording (e.g. '실패'); the rule is for what people read.
    if (/(^|\.)checkNote$/.test(path)) continue
    for (const w of BANNED) if (s.includes(w)) bad(path, `banned word '${w}'`)
  }
  return { problems, unverified, items }
}

const summary = process.argv.includes('--summary')
const files = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
if (files.length === 0) {
  console.error(`validate-content: no JSON files in ${DATA_DIR}`)
  process.exit(1)
}

let failed = false
for (const file of files) {
  const name = file.replace(/\.json$/, '')
  let json
  try {
    json = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
  } catch (e) {
    console.error(`${file}: ${e.message}`)
    failed = true
    continue
  }
  const { problems, unverified, items } = validateFile(name, json)
  if (problems.length) {
    failed = true
    for (const p of problems) console.error(p)
  } else if (summary) console.log(`${file}: ${items} items, ${unverified} unverified (미확인)`)
}
if (failed) {
  console.error('validate-content: problems found')
  process.exit(1)
}
console.log(`validate-content: ${files.length} files ok`)
