// 병원에 보여 줄 한 장 요약 — the renderings (pure, no React, no DOM).
//
// One model (lib/logic/clinicSummary.ts) → three forms that say the same thing:
//   • summarySections: titled line groups — the sheet's preview and the text
//   • buildClinicSummaryText: the plain text for '텍스트 복사'
//   • buildClinicSummaryHtml: a single self-contained HTML file (inline CSS,
//     A4 print, no scripts, no remote resources — the lib/logic/diaryExport.ts
//     pattern). Every piece of user text is escaped.
// Dates in the tables stay 'YYYY-MM-DD' so a doctor reads them without ambiguity.

import { formatKo } from '../dates'
import {
  CLINIC_SUMMARY_HEADER,
  PREGNANCY_TEST_LABEL,
  summaryWho,
  type ClinicSummary,
  type SummaryCycleRow,
  type SummaryPerson,
} from './clinicSummary'
import { escapeHtml } from './diaryExport'
import { OUTCOME_LABEL, SUPPORT_SOURCE, TREATMENT_LABEL, supportCountLabel } from './treatments'

export { escapeHtml }

export const CLINIC_SUMMARY_FILENAME = '둘셋-병원요약.html'
export const CLINIC_SUMMARY_TITLE = '둘셋 기록 요약'

// ── Shared wording ──────────────────────────────────────────

function personLine(p: SummaryPerson): string {
  const age = p.age !== undefined ? `${p.age}세 (${p.birthYear}년생)` : '나이 미입력'
  return `${p.name} · ${p.role} · ${age}${p.cycleOwner ? ' · 주기 기록' : ''}`
}

/** 'N개월' and the logged cycles since the start, when counted. */
export function ttcLine(s: ClinicSummary): string | undefined {
  if (!s.ttc) return undefined
  const months = s.ttc.months === 0 ? '1개월 미만' : `${s.ttc.months}개월`
  const cycles = s.ttc.cycles !== undefined ? ` · 그동안 ${s.ttc.cyclesEstimated ? '약 ' : ''}${s.ttc.cycles}주기` : ''
  return `${s.ttc.start}부터 · ${months}${cycles}`
}

/** '28일 · 범위 27~29일 · 기록 3주기 기준'. */
export function statsLine(s: ClinicSummary): string | undefined {
  if (!s.stats) return undefined
  const range = s.stats.min !== undefined && s.stats.max !== undefined && s.stats.min !== s.stats.max ? ` · 범위 ${s.stats.min}~${s.stats.max}일` : ''
  const src = s.stats.source === 'settings' ? ' · 기록 전이라 설정값이에요' : ''
  return `평균 ${s.stats.average}일${range} · ${s.stats.basis}${src}`
}

/** The row's length cell: '28일', '진행 중 12일째', '간격 75일 (기록 없는 기간일 수 있어요)', '—'. */
export function lengthText(r: SummaryCycleRow): string {
  if (r.length !== undefined) return `${r.length}일`
  if (r.runningDay !== undefined) return `진행 중 · ${r.runningDay}일째`
  if (r.gapDays !== undefined) return `간격 ${r.gapDays}일 (기록 없는 기간일 수 있어요)`
  return '—'
}

/** '5일' or '마지막 날 미기록'. */
export function bleedText(r: SummaryCycleRow): string {
  return r.bleedDays !== undefined ? `${r.bleedDays}일` : '미기록'
}

/** '양성 12일째 (2026-09-02)', '3회 · 양성 없음', '2회 (아직)', '—' (no strips). */
export function lhText(r: SummaryCycleRow): string {
  if (!r.lh) return '—'
  if (r.lh.surgeDay !== undefined) return `첫 양성 ${r.lh.surgeDay}일째 (${r.lh.surgeDate})`
  if (r.runningDay !== undefined) return `${r.lh.tests}회 · 아직 양성 없음`
  return `${r.lh.tests}회 · 양성 없음`
}

/** '음성 24일째 · 음성 27일째' or '—'. */
export function testsText(r: SummaryCycleRow): string {
  if (!r.tests.length) return '—'
  return r.tests.map((t) => `${PREGNANCY_TEST_LABEL[t.result]} ${t.cycleDay}일째`).join(' · ')
}

function cycleLine(r: SummaryCycleRow, includesLH: boolean): string {
  const parts = [
    r.n !== undefined ? `주기 ${r.n}` : undefined,
    `${r.start} 시작`,
    lengthText(r),
    `생리 ${bleedText(r)}`,
    includesLH ? `LH ${lhText(r)}` : undefined,
    `임테기 ${testsText(r)}`,
  ]
  return parts.filter((p): p is string => !!p).join(' · ')
}

function treatmentLine(t: ClinicSummary['treatments'][number]): string {
  const parts = [
    TREATMENT_LABEL[t.kind],
    t.endDate && t.endDate !== t.startDate ? `${t.startDate} ~ ${t.endDate}` : t.startDate,
    t.outcome ? OUTCOME_LABEL[t.outcome] : undefined,
    t.supported === true ? '지원 회차' : t.supported === false ? '본인 부담' : undefined,
    t.noticeExpires ? `통지서 ${t.noticeExpires}까지` : undefined,
  ]
  return parts.filter((p): p is string => !!p).join(' · ')
}

function supportLine(s: ClinicSummary): string | undefined {
  if (!s.support) return undefined
  const c = s.support
  const parts = [`인공수정 ${supportCountLabel(c.iui)}`, `체외수정 ${supportCountLabel(c.ivf)}`, `합계 ${supportCountLabel(c.all)}`]
  if (c.ovulationInduction.used > 0) parts.push(`배란유도 ${supportCountLabel(c.ovulationInduction)}`)
  const since = c.since ? ` · ${c.since} 출산 뒤부터` : ''
  return `지원 회차 (기록 기준) ${parts.join(' · ')}${since}`
}

export interface SummarySection {
  id: 'people' | 'cycles' | 'medications' | 'checkups' | 'appointments' | 'treatments' | 'notes'
  title: string
  lines: string[]
  /** Shown when `lines` is empty. */
  empty?: string
}

/** The whole summary as titled line groups — the preview and the text share them. */
export function summarySections(s: ClinicSummary): SummarySection[] {
  const people: string[] = [personLine(s.owner), personLine(s.partner)]
  const ttc = ttcLine(s)
  if (ttc) people.push(`준비 기간: ${ttc}`)
  if (s.clinicSince) people.push(`병원과 함께 준비 중: ${s.clinicSince}부터`)

  const cycles = s.cycles.map((r) => cycleLine(r, s.includesLH))
  const stats = statsLine(s)
  if (stats) cycles.push(stats)
  if (s.totalCycles > s.cycles.length) cycles.push(`기록된 주기 ${s.totalCycles}개 중 최근 ${s.cycles.length}개예요.`)

  const treatments = s.treatments.map(treatmentLine)
  const support = supportLine(s)
  if (support) treatments.push(support)
  for (const l of s.leave) treatments.push(`난임치료휴가 ${summaryWho(s, l.member)} · ${l.year}년 ${l.used}/${l.total}일`)

  return [
    { id: 'people', title: '두 사람', lines: people },
    { id: 'cycles', title: '주기 기록', lines: cycles, empty: '아직 기록한 생리 시작일이 없어요.' },
    {
      id: 'medications',
      title: '먹고 있는 영양제·약',
      lines: s.medications.map((m) => `${summaryWho(s, m.member)} · ${m.label}${m.note ? ` (${m.note})` : ''} · ${m.since}부터`),
      empty: '기록한 영양제·약이 없어요.',
    },
    {
      id: 'checkups',
      title: '임신 전 검사·접종 (완료로 표시한 것)',
      lines: s.checkups.map((c) => `${c.doneAt} · ${c.title}${c.member ? ` · ${summaryWho(s, c.member)}` : ''}`),
      empty: '완료로 표시한 검사·접종이 없어요.',
    },
    {
      id: 'appointments',
      title: '최근 6개월 병원·검사 일정',
      lines: s.appointments.map(
        (a) => `${a.date}${a.time ? ` ${a.time}` : ''} · ${a.title} · ${a.kindLabel}${a.place ? ` · ${a.place}` : ''} · ${summaryWho(s, a.who)}${a.done ? ' · 다녀왔어요' : ''}`,
      ),
      empty: '최근 6개월에 기록한 일정이 없어요.',
    },
    { id: 'treatments', title: '시술 기록', lines: treatments, empty: '기록한 시술이 없어요.' },
    { id: 'notes', title: '참고', lines: [...s.notes] },
  ]
}

// ── Plain text ──────────────────────────────────────────────

/** The summary as text for the clipboard (the same lines the preview shows). */
export function buildClinicSummaryText(s: ClinicSummary): string {
  const out: string[] = [CLINIC_SUMMARY_HEADER, `만든 날 ${s.generatedOn}`, '']
  for (const sec of summarySections(s)) {
    out.push(`[${sec.title}]`)
    if (sec.lines.length) for (const l of sec.lines) out.push(`- ${l}`)
    else if (sec.empty) out.push(`- ${sec.empty}`)
    out.push('')
  }
  return out.join('\n').trimEnd() + '\n'
}

// ── HTML ────────────────────────────────────────────────────

const EXPORT_CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:light;--ink:#26201e;--ink2:#635954;--ink3:#8a7f79;--line:#e8e1db;--bg:#faf7f4;--card:#fff;--brand:#5a3e36;--soft:#f3ebe6}
html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;font-size:13px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:760px;margin:0 auto;padding:28px 20px 48px}
header{border-bottom:2px solid var(--brand);padding-bottom:10px;margin-bottom:14px}
.eyebrow{margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;color:var(--brand)}
h1{margin:4px 0 2px;font-size:22px;line-height:1.3}
.headline{margin:0;font-size:13px;font-weight:700;color:var(--ink2)}
.made{margin:4px 0 0;font-size:12px;color:var(--ink3)}
.tip{margin:8px 0 0;font-size:12px;color:var(--ink3)}
section{margin:16px 0 0}
h2{margin:0 0 6px;font-size:14px;color:var(--brand);border-left:3px solid var(--brand);padding-left:8px}
table{width:100%;border-collapse:collapse;background:var(--card);font-size:12.5px}
th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
th{background:var(--soft);font-weight:700;color:var(--ink2);white-space:nowrap}
td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.kv{margin:0;padding:0;list-style:none}
.kv li{padding:3px 0;border-bottom:1px solid var(--line)}
.kv li:last-child{border-bottom:0}
.sub{margin:6px 0 0;font-size:12px;color:var(--ink2)}
.empty{margin:0;font-size:12px;color:var(--ink3)}
.notes{margin:18px 0 0;padding:10px 12px;border:1px dashed var(--line);border-radius:10px;font-size:11.5px;color:var(--ink2)}
.notes ul{margin:0;padding-left:18px}
footer{margin-top:16px;font-size:11px;color:var(--ink3);text-align:center}
@page{size:A4;margin:14mm 12mm}
@media print{
  html,body{background:#fff}
  .sheet{max-width:none;padding:0}
  .tip{display:none}
  section{break-inside:avoid;page-break-inside:avoid}
  tr{break-inside:avoid;page-break-inside:avoid}
  h2{break-after:avoid;page-break-after:avoid}
}
`.trim()

function cell(text: string, num = false): string {
  return `<td${num ? ' class="num"' : ''}>${escapeHtml(text)}</td>`
}

function list(lines: string[], empty: string | undefined): string {
  if (!lines.length) return `<p class="empty">${escapeHtml(empty ?? '')}</p>`
  return `<ul class="kv">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
}

function peopleTable(s: ClinicSummary): string {
  const row = (p: SummaryPerson) =>
    `<tr>${cell(p.name)}${cell(p.role)}${cell(p.age !== undefined ? `${p.age}세 (${p.birthYear}년생)` : '미입력', true)}${cell(p.cycleOwner ? '주기 기록' : '')}</tr>`
  return `<table><thead><tr><th>이름</th><th>역할</th><th>나이</th><th>구분</th></tr></thead><tbody>${row(s.owner)}${row(s.partner)}</tbody></table>`
}

function cyclesTable(s: ClinicSummary): string {
  if (!s.cycles.length) return `<p class="empty">아직 기록한 생리 시작일이 없어요.</p>`
  const head = ['주기', '시작일', '길이', '생리', ...(s.includesLH ? ['LH'] : []), '임테기']
  const rows = s.cycles.map(
    (r) =>
      `<tr>${cell(r.n !== undefined ? String(r.n) : '', true)}${cell(r.start, true)}${cell(lengthText(r), true)}${cell(bleedText(r), true)}${
        s.includesLH ? cell(lhText(r)) : ''
      }${cell(testsText(r))}</tr>`,
  )
  return `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
}

/**
 * A complete standalone HTML document: header line, the people, the cycle
 * table with its average, what she takes, ticked 검사·접종, recent
 * appointments, 시술 기록, the caveats. Deterministic for a given summary.
 */
export function buildClinicSummaryHtml(s: ClinicSummary): string {
  const sections = new Map(summarySections(s).map((sec) => [sec.id, sec]))
  const sec = (id: SummarySection['id']) => sections.get(id)!
  const body: string[] = []

  body.push('<header>')
  body.push('<p class="eyebrow">둘셋</p>')
  body.push(`<h1>${escapeHtml(CLINIC_SUMMARY_TITLE)}</h1>`)
  body.push(`<p class="headline">${escapeHtml(CLINIC_SUMMARY_HEADER)}</p>`)
  body.push(`<p class="made">만든 날 ${escapeHtml(formatKo(s.generatedOn, { year: true }))}</p>`)
  body.push('<p class="tip">브라우저에서 인쇄(Ctrl+P · ⌘P)를 누르면 PDF로 저장하거나 종이로 뽑을 수 있어요.</p>')
  body.push('</header>')

  body.push('<section><h2>두 사람</h2>')
  body.push(peopleTable(s))
  const ttc = ttcLine(s)
  const extra: string[] = []
  if (ttc) extra.push(`준비 기간: ${ttc}`)
  if (s.clinicSince) extra.push(`병원과 함께 준비 중: ${s.clinicSince}부터`)
  if (extra.length) body.push(`<p class="sub">${extra.map(escapeHtml).join('<br>')}</p>`)
  body.push('</section>')

  body.push(`<section><h2>주기 기록${s.cycles.length ? ` (최근 ${s.cycles.length}개)` : ''}</h2>`)
  body.push(cyclesTable(s))
  const stats = statsLine(s)
  const subs: string[] = []
  if (stats) subs.push(stats)
  if (s.totalCycles > s.cycles.length) subs.push(`기록된 주기 ${s.totalCycles}개 중 최근 ${s.cycles.length}개예요.`)
  if (s.cycles.length) subs.push('날짜는 모두 기록한 시작일 기준이고, 일째는 시작일을 1일째로 세요.')
  if (subs.length) body.push(`<p class="sub">${subs.map(escapeHtml).join('<br>')}</p>`)
  body.push('</section>')

  for (const id of ['medications', 'checkups', 'appointments', 'treatments'] as const) {
    const x = sec(id)
    body.push(`<section><h2>${escapeHtml(x.title)}</h2>${list(x.lines, x.empty)}</section>`)
  }
  if (s.support) {
    body.push(
      `<p class="sub">지원 횟수 출처: ${escapeHtml(SUPPORT_SOURCE.name)} (시행 ${escapeHtml(SUPPORT_SOURCE.effective)} · 확인 ${escapeHtml(SUPPORT_SOURCE.checked)})</p>`,
    )
  }

  body.push(`<div class="notes"><ul>${s.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`)
  body.push(`<footer>${escapeHtml(formatKo(s.generatedOn, { year: true, weekday: false }))}, 둘셋에서 두 사람이 남긴 기록을 모았어요.</footer>`)

  return [
    '<!doctype html>',
    '<html lang="ko">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Defense in depth: nothing in this file should ever run or load remotely.
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    '<meta name="generator" content="둘셋">',
    `<title>${escapeHtml(CLINIC_SUMMARY_TITLE)}</title>`,
    `<style>${EXPORT_CSS}</style>`,
    '</head>',
    '<body>',
    '<main class="sheet">',
    body.join('\n'),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

