// Diary view helpers + the standalone "우리 이야기" HTML export (pure).
//
// The export is a single self-contained HTML file: no scripts, no external
// resources, photos inlined as data: URLs. Every piece of user text is escaped
// and line breaks are kept with `white-space: pre-wrap`, so no markup is ever
// built from what people wrote.

import { formatKo, isISODate } from '../dates'
import type { Baby, DiaryEntry, ISODate, Member, MemberId, Pregnancy, Stage } from '../types'
import { dayOfLife } from './baby'
import { canSeeEntry, visibleEntries } from './personalLog'
import { gestationalAge } from './pregnancy'

/** Longest diary text (composer and edit sheet share it). */
export const DIARY_MAX_TEXT = 2000

// ── Moods ───────────────────────────────────────────────────

export const MOODS: ReadonlyArray<{ emoji: string; label: string }> = [
  { emoji: '😊', label: '좋아요' },
  { emoji: '🥰', label: '설레요' },
  { emoji: '😌', label: '편안해요' },
  { emoji: '😴', label: '피곤해요' },
  { emoji: '😢', label: '슬퍼요' },
  { emoji: '😤', label: '속상해요' },
]

export function moodLabel(emoji: string | undefined): string | undefined {
  if (!emoji) return undefined
  return MOODS.find((m) => m.emoji === emoji)?.label
}

// ── Stage labels ────────────────────────────────────────────

export const STAGE_SHORT: Record<Stage, string> = {
  preparing: '준비',
  pregnant: '임신',
  parenting: '육아',
}

/** Section headings in the exported story. */
export const STAGE_SECTION: Record<Stage, string> = {
  preparing: '둘이 준비하던 시간',
  pregnant: '셋을 기다리던 시간 · 태교일기',
  parenting: '셋이 된 시간 · 육아일기',
}

export const STAGE_ORDER: readonly Stage[] = ['preparing', 'pregnant', 'parenting']

/** Longest plausible pregnancy we still label with a week number. */
const MAX_LABEL_WEEKS = 44

/**
 * Badge for an entry: '준비', '임신 12주' (at the entry's date), '태어난 날',
 * '34일째'. Baby days use the Korean N일째 count (birth day = 1, 백일 = 100일째)
 * — the same number as "태어난 지 N일째" on the baby and today screens, which
 * show "생후 N일" as whole days since birth, so "생후" is avoided here.
 * Falls back to the plain stage word when the dates don't line up (e.g. an
 * entry from an earlier pregnancy, or one backdated to before the birth).
 */
export function entryStageLabel(
  entry: Pick<DiaryEntry, 'stage' | 'date'>,
  ctx: { pregnancy?: Pregnancy; baby?: Baby },
): string {
  if (entry.stage === 'pregnant' && ctx.pregnancy) {
    const ga = gestationalAge(ctx.pregnancy, entry.date)
    if (ga.totalDays >= 0 && ga.weeks <= MAX_LABEL_WEEKS) return `임신 ${ga.weeks}주`
  }
  if (entry.stage === 'parenting' && ctx.baby) {
    const n = dayOfLife(ctx.baby.birthDate, entry.date)
    if (n === 1) return '태어난 날'
    if (n > 1) return `${n}일째`
  }
  return STAGE_SHORT[entry.stage]
}

/** 'YYYY-MM' → '2026년 9월' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${Number(y)}년 ${Number(m)}월`
}

/**
 * Diary dates may be backdated but never set in the future. Anything that
 * isn't a valid date (e.g. a cleared date input) falls back to today.
 */
export function clampDiaryDate(value: string, today: ISODate): ISODate {
  if (!isISODate(value)) return today
  return value > today ? today : value
}

// ── Composer draft ──────────────────────────────────────────
//
// A half-written entry survives switching tabs, the ⇄ viewer switch and a
// reload. Drafts are per viewer, so each person's words stay theirs, and the
// key starts with `dulset:` so "모든 데이터 지우기" clears it too.

export interface DiaryDraft {
  text: string
  mood?: string
  /** A picked past date; absent = follow today. */
  date?: ISODate
  /** Photo already stored in IndexedDB, not yet part of an entry. */
  photoId?: string
}

export function diaryDraftKey(viewer: MemberId): string {
  return `dulset:diary-draft:${viewer}`
}

/** A date alone isn't worth keeping; text, a mood or a photo is. */
export function isDraftEmpty(d: DiaryDraft): boolean {
  return !d.text.trim() && !d.mood && !d.photoId
}

/** JSON for storage, or null when there is nothing to keep (→ remove the key). */
export function serializeDiaryDraft(d: DiaryDraft): string | null {
  if (isDraftEmpty(d)) return null
  const out: DiaryDraft = { text: d.text.slice(0, DIARY_MAX_TEXT) }
  if (d.mood) out.mood = d.mood
  if (d.date && isISODate(d.date)) out.date = d.date
  if (d.photoId) out.photoId = d.photoId
  return JSON.stringify(out)
}

/**
 * Read a stored draft defensively (it may be from an older build or edited by
 * hand). A date that is today or later is dropped so the draft follows today.
 */
export function parseDiaryDraft(raw: string | null, today: ISODate): DiaryDraft | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const draft: DiaryDraft = { text: typeof o.text === 'string' ? o.text.slice(0, DIARY_MAX_TEXT) : '' }
  if (typeof o.mood === 'string' && moodLabel(o.mood)) draft.mood = o.mood
  if (isISODate(o.date) && o.date < today) draft.date = o.date
  if (typeof o.photoId === 'string' && o.photoId.length > 0 && o.photoId.length <= 100) draft.photoId = o.photoId
  return isDraftEmpty(draft) ? null : draft
}

// ── Async helper (export) ───────────────────────────────────

/**
 * Run `fn` over `items` with at most `limit` calls in flight (so a big diary
 * doesn't open hundreds of IndexedDB reads at once). Results keep input order;
 * `onProgress` gets the number finished so far.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number) => void,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!, i)
      done++
      onProgress?.(done)
    }
  }
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  await Promise.all(Array.from({ length: workers }, worker))
  return out
}

// ── Filtering / ordering ────────────────────────────────────

export interface DiaryFilter {
  stage: Stage | 'all'
  author: MemberId | 'all'
  /** Who is reading: the other member's '나만 보기' entries are left out (lib/logic/personalLog.ts). */
  viewer?: MemberId
}

export function filterEntries(entries: DiaryEntry[], f: DiaryFilter): DiaryEntry[] {
  return entries.filter(
    (e) =>
      (f.viewer === undefined || canSeeEntry(e, f.viewer)) &&
      (f.stage === 'all' || e.stage === f.stage) &&
      (f.author === 'all' || e.author === f.author),
  )
}

/** Stages that have at least one entry, in life order. */
export function stagesWithEntries(entries: DiaryEntry[]): Stage[] {
  const present = new Set(entries.map((e) => e.stage))
  return STAGE_ORDER.filter((s) => present.has(s))
}

/** Oldest → newest, so the export reads as a story. Same day: by creation time. */
export function storyOrder(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

// ── HTML export ─────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!)
}

/**
 * Only base64 image data URLs are embedded — anything else (a stray
 * `javascript:` or `data:text/html`) is treated as a missing photo.
 */
export function isSafeImageDataURL(url: unknown): url is string {
  return typeof url === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i.test(url)
}

export interface DiaryExportInput {
  entries: DiaryEntry[]
  /**
   * Who is exporting: the other member's '나만 보기' entries never leave the
   * phone in a file (lib/logic/personalLog.ts visibleEntries). Pass it from
   * every export screen; a build without it exports everything it was given.
   */
  viewer?: MemberId
  members: readonly Member[]
  title: string
  /** photoId → data: URL. Missing ids are skipped with a short note. */
  photos: Record<string, string>
  baby?: Baby
  pregnancy?: Pregnancy
  /** Footer date ("… 만들었어요"). Passed in so the output is deterministic. */
  generatedOn?: ISODate
}

const EXPORT_CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:light;--ink:#26201e;--ink2:#635954;--ink3:#8a7f79;--line:#e8e1db;--bg:#faf7f4;--card:#fff;--brand:#b04036;--soft:#fce9e5}
html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;line-height:1.7;word-break:keep-all;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.book{max-width:680px;margin:0 auto;padding:40px 20px 64px}
.cover{text-align:center;padding:48px 0 32px;border-bottom:1px solid var(--line);margin-bottom:8px}
.eyebrow{margin:0;font-size:13px;font-weight:700;letter-spacing:.2em;color:var(--brand)}
h1{margin:12px 0 8px;font-size:30px;line-height:1.3}
.couple{margin:0;font-size:16px;color:var(--ink2)}
.range{margin:6px 0 0;font-size:13px;color:var(--ink3)}
.tip{margin:20px auto 0;max-width:420px;font-size:12px;color:var(--ink3)}
.stage{padding-top:24px}
h2{margin:32px 0 4px;font-size:21px;color:var(--brand)}
h3{margin:24px 0 10px;font-size:14px;font-weight:700;color:var(--ink3)}
.entry{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin:0 0 14px}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px;color:var(--ink2)}
.author{font-weight:700;color:var(--ink)}
.badge{display:inline-block;border-radius:999px;background:var(--soft);color:var(--brand);padding:1px 10px;font-size:12px;font-weight:600}
.mood{font-size:16px}
.text{margin:10px 0 0;white-space:pre-wrap;font-size:15px}
figure{margin:12px 0 0}
img{display:block;max-width:100%;max-height:520px;margin:0 auto;border-radius:12px;object-fit:contain}
.photo-missing{margin:10px 0 0;font-size:12px;color:var(--ink3)}
.empty{text-align:center;color:var(--ink3);padding:48px 0}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);text-align:center;font-size:12px;color:var(--ink3)}
@page{size:A4;margin:16mm 14mm}
@media print{
  html,body{background:#fff}
  .book{max-width:none;padding:0}
  .cover{padding-top:30vh;border-bottom:0;break-after:page;page-break-after:always}
  .tip{display:none}
  .stage + .stage{break-before:page;page-break-before:always}
  h2,h3{break-after:avoid;page-break-after:avoid}
  .entry{break-inside:avoid;page-break-inside:avoid;border-color:#ddd}
  img{max-height:110mm}
}
`.trim()

function memberLine(m: Member | undefined): string {
  return m ? `${m.emoji} ${m.name}` : '?'
}

function renderEntry(e: DiaryEntry, input: DiaryExportInput, byId: Map<MemberId, Member>): string {
  const author = byId.get(e.author)
  const badge = entryStageLabel(e, input)
  const mood = moodLabel(e.mood)
  const out: string[] = []
  out.push('<article class="entry">')
  out.push('<div class="meta">')
  out.push(`<span class="author">${escapeHtml(memberLine(author))}</span>`)
  out.push(`<time datetime="${escapeHtml(e.date)}">${escapeHtml(formatKo(e.date, { year: true }))}</time>`)
  out.push(`<span class="badge">${escapeHtml(badge)}</span>`)
  if (e.mood) {
    const label = mood ? ` title="${escapeHtml(mood)}" aria-label="${escapeHtml(mood)}"` : ''
    out.push(`<span class="mood"${label}>${escapeHtml(e.mood)}</span>`)
  }
  out.push('</div>')
  const text = e.text.replace(/\r\n?/g, '\n')
  if (text.trim()) out.push(`<p class="text">${escapeHtml(text)}</p>`)
  if (e.photoId) {
    const src = input.photos[e.photoId]
    if (isSafeImageDataURL(src)) {
      const alt = `${author?.name ?? ''}의 사진 · ${formatKo(e.date, { year: true, weekday: false })}`
      out.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></figure>`)
    } else {
      out.push('<p class="photo-missing">📷 이 기기에 사진이 없어서 빼고 저장했어요.</p>')
    }
  }
  out.push('</article>')
  return out.join('')
}

/**
 * A complete, standalone HTML document telling the diary oldest → newest,
 * with a section heading each time the stage changes (준비 → 임신 → 육아, or
 * back again) and a month heading inside each section.
 */
export function buildDiaryHtml(input: DiaryExportInput): string {
  const byId = new Map<MemberId, Member>(input.members.map((m) => [m.id, m]))
  const entries = storyOrder(input.viewer === undefined ? input.entries : visibleEntries(input.entries, input.viewer))
  const title = input.title.trim() || '우리 이야기'

  const body: string[] = []
  body.push('<header class="cover">')
  body.push('<p class="eyebrow">둘셋</p>')
  body.push(`<h1>${escapeHtml(title)}</h1>`)
  if (input.members.length) {
    body.push(`<p class="couple">${input.members.map((m) => escapeHtml(memberLine(m))).join(' &amp; ')}</p>`)
  }
  const first = entries[0]
  const last = entries[entries.length - 1]
  if (first && last) {
    const from = formatKo(first.date, { year: true, weekday: false })
    const to = formatKo(last.date, { year: true, weekday: false })
    const span = from === to ? from : `${from} – ${to}`
    body.push(`<p class="range">${escapeHtml(span)} · 기록 ${entries.length}개</p>`)
  }
  body.push(
    '<p class="tip">브라우저에서 인쇄(Ctrl+P · ⌘P)를 누르면 PDF로 저장하거나 종이로 뽑을 수 있어요.</p>',
  )
  body.push('</header>')

  if (!entries.length) {
    body.push('<p class="empty">아직 남긴 기록이 없어요.</p>')
  }

  let stage: Stage | null = null
  let month: string | null = null
  for (const e of entries) {
    if (e.stage !== stage) {
      if (stage !== null) body.push('</section>')
      stage = e.stage
      month = null
      body.push(`<section class="stage stage-${stage}">`)
      body.push(`<h2>${escapeHtml(STAGE_SECTION[stage])}</h2>`)
    }
    const m = e.date.slice(0, 7)
    if (m !== month) {
      month = m
      body.push(`<h3>${escapeHtml(monthLabel(m))}</h3>`)
    }
    body.push(renderEntry(e, input, byId))
  }
  if (stage !== null) body.push('</section>')

  const made = input.generatedOn ? `${formatKo(input.generatedOn, { year: true, weekday: false })}, ` : ''
  body.push(`<footer>${escapeHtml(made)}둘셋에서 두 사람이 함께 남긴 기록을 모았어요.</footer>`)

  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Defense in depth: nothing in this file should ever run or load remotely.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">`,
    '<meta name="generator" content="둘셋">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${EXPORT_CSS}</style>`,
    '</head>',
    '<body>',
    '<main class="book">',
    body.join('\n'),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
