#!/usr/bin/env node
// 둘셋 · N25 — 창업자 Supabase 프로젝트를 몇 분 안에 확인하는 스크립트.
//
//   node scripts/verify-supabase.mjs          # dulset/ 안에서
//
// What it does: reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// from the environment (else from dulset/.env.local), then walks the whole
// partner-link round trip the app uses (lib/sync/supabaseTransport.ts) with
// THROWAWAY data and prints a Korean PASS / FAIL table with the HTTP status
// and a hint for every failure:
//
//   create_couple → issue_token → publish_snapshot (a synthetic snapshot with
//   no health data at all) → snapshot_by_token (the link reads it) →
//   send_event → pull_events → record_link_open → link_open_days →
//   revoke_token → snapshot_by_token again (must read nothing) →
//   delete_couple (removes the throwaway couple and, by cascade, its token,
//   snapshot, event and '링크 연 날' row).
//
// It never prints the key (only its kind and length — redacted from every
// server reply, every network error and even an unexpected crash), refuses a
// service_role / secret key or one with characters a header cannot carry,
// and sends nothing of the app's state: the owner key, couple id
// and token are random and made here. Plain Node ≥ 18, no dependencies, no
// imports from the app (the request shapes are kept in step with
// lib/sync/supabaseTransport.ts by tests/verifySupabase.test.ts).
//
// DULSET_VERIFY_ENV_FILE points it at another env file (tests use it).
//
// Behind an HTTPS proxy (a cloud environment), Node's fetch needs
// NODE_USE_ENV_PROXY=1 (Node ≥ 22.21): the script re-runs itself with it.
//
// Exit code: 0 all passed · 1 a step failed · 2 the env is missing or unusable.

import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const ENV_FILE = join(ROOT, '.env.local')
export const URL_NAME = 'NEXT_PUBLIC_SUPABASE_URL'
export const KEY_NAME = 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
/** One request may take this long before it counts as a network failure. */
export const REQUEST_TIMEOUT_MS = 15_000

/** The steps, in order — `fn` is the RPC each one calls. */
export const STEPS = [
  { id: 'create', fn: 'create_couple', label: '커플 공간 만들기' },
  { id: 'issue', fn: 'issue_token', label: '링크 토큰 발급' },
  { id: 'publish', fn: 'publish_snapshot', label: '스냅숏 올리기 · 건강 기록 없음' },
  { id: 'fetch', fn: 'snapshot_by_token', label: '링크로 스냅숏 읽기' },
  { id: 'send', fn: 'send_event', label: '남편 이벤트 보내기' },
  { id: 'pull', fn: 'pull_events', label: '이벤트 받아 오기' },
  { id: 'open', fn: 'record_link_open', label: '링크 연 날 기록' },
  { id: 'days', fn: 'link_open_days', label: '링크 연 날 읽기' },
  { id: 'revoke', fn: 'revoke_token', label: '링크 해제' },
  { id: 'revoked', fn: 'snapshot_by_token', label: '해제 뒤 읽기는 막혀요' },
  { id: 'cleanup', fn: 'delete_couple', label: '테스트 데이터 지우기' },
]

// ── Reading the two variables ───────────────────────────────

/** KEY=value lines (comments, blank lines, `export `, quotes and CRLF handled). */
export function parseDotEnv(text) {
  const out = {}
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    else v = v.replace(/\s+#.*$/, '')
    out[m[1]] = v
  }
  return out
}

/** The base64url-decoded JSON payload of a JWT, or null. */
function jwtPayload(key) {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * What kind of key it is, without ever showing it: 'anon' (classic JWT, role
 * anon), 'publishable' (sb_publishable_…), 'service' (JWT role service_role)
 * or 'secret' (sb_secret_…) — the last two are refused — else 'unknown'.
 */
export function keyKind(key) {
  const k = String(key ?? '').trim()
  if (k.startsWith('sb_publishable_')) return 'publishable'
  if (k.startsWith('sb_secret_')) return 'secret'
  const p = k.startsWith('eyJ') ? jwtPayload(k) : null
  if (p && p.role === 'anon') return 'anon'
  if (p && p.role === 'service_role') return 'service'
  return 'unknown'
}

/** What an anon / publishable key is made of (JWT: base64url parts and dots; sb_…: letters, digits, _ and -). */
const KEY_CHARS = /^[A-Za-z0-9._-]+$/

const KEY_KIND_WORD = {
  anon: 'anon 키(JWT)',
  publishable: 'publishable 키',
  service: 'service_role 키',
  secret: 'secret 키',
  unknown: '형식을 알 수 없는 키',
}

/**
 * The URL and key to use: the environment first, then .env.local. `problems`
 * lists why it cannot run (missing, not a URL, a service_role / secret key);
 * `warnings` what is odd but may still work.
 */
export function readSupabaseEnv({
  env = process.env,
  envFile = env.DULSET_VERIFY_ENV_FILE || ENV_FILE,
  readFile = (p) => readFileSync(p, 'utf8'),
  exists = existsSync,
} = {}) {
  let url = (env[URL_NAME] ?? '').trim()
  let anonKey = (env[KEY_NAME] ?? '').trim()
  let source = url && anonKey ? '환경 변수' : null
  if (!source && exists(envFile)) {
    const file = parseDotEnv(readFile(envFile))
    url = url || (file[URL_NAME] ?? '').trim()
    anonKey = anonKey || (file[KEY_NAME] ?? '').trim()
    if (url && anonKey) source = '.env.local'
  }
  url = url.replace(/\/+$/, '')
  const problems = []
  const warnings = []
  if (!url) problems.push(`${URL_NAME}가 없어요. 환경 설정의 환경 변수나 dulset/.env.local에 넣어 주세요(.env.local.example 참고).`)
  if (!anonKey) problems.push(`${KEY_NAME}가 없어요. Supabase → Project Settings → API의 anon public 키예요.`)
  if (url) {
    let u = null
    try {
      u = new URL(url)
    } catch {
      problems.push(`${URL_NAME}가 주소 모양이 아니에요. https://<프로젝트>.supabase.co 처럼 넣어요.`)
    }
    if (u) {
      if (u.protocol !== 'https:' && u.protocol !== 'http:') problems.push(`${URL_NAME}는 https:// 로 시작해야 해요.`)
      else if (u.protocol !== 'https:') warnings.push('https가 아닌 주소예요(로컬 시험용이 아니라면 https로 바꿔요).')
      if (u.pathname && u.pathname !== '/') warnings.push(`주소 뒤의 경로(${u.pathname})는 빼고 프로젝트 주소만 넣어요.`)
      if (u.protocol === 'https:' && !/\.supabase\.co$/.test(u.hostname)) warnings.push('supabase.co 주소가 아니에요(직접 연결한 도메인이면 괜찮아요).')
    }
  }
  const kind = anonKey ? keyKind(anonKey) : null
  // A key that cannot go in an HTTP header (a pasted space, a quote, a Korean letter): said before
  // any request — fetch's own error would otherwise quote the header, key and all.
  if (anonKey && !KEY_CHARS.test(anonKey)) problems.push(`${KEY_NAME}에 키에 쓸 수 없는 글자(빈칸·따옴표·한글 등)가 섞여 있어요. 키를 다시 복사해 붙여 주세요.`)
  if (kind === 'service' || kind === 'secret')
    problems.push(`${KEY_KIND_WORD[kind]}예요. 이 키는 모든 규칙을 우회해서 절대 앱이나 환경 변수에 넣지 않아요 — anon public 키로 바꿔 주세요.`)
  if (kind === 'unknown') warnings.push('anon 키 모양이 아니에요(eyJ… 또는 sb_publishable_…). 다른 값을 넣지 않았는지 확인해요.')
  return { url, anonKey, source, kind, problems, warnings }
}

// ── Requests ────────────────────────────────────────────────

/** The same headers the app sends (lib/sync/supabaseTransport.ts rpcHeaders). */
export function rpcHeaders(anonKey) {
  return {
    apikey: anonKey,
    ...(anonKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${anonKey}` }),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** Every occurrence of each secret replaced (so nothing printed can carry one). */
export function redact(text, secrets) {
  let out = String(text ?? '')
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('[숨김]')
  return out
}

/** What kind of network failure a fetch error's cause names: timeout · tls · dns · refused · blocked (the rest). */
export function networkClass(cause) {
  const c = String(cause ?? '')
  if (c === 'timeout') return 'timeout'
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_(GET|VERIFY)/i.test(c)) return 'tls'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(c)) return 'dns'
  if (/ECONNREFUSED/i.test(c)) return 'refused'
  return 'blocked'
}

export function hintFor({ status, network, cause } = {}) {
  if (network) {
    const kind = networkClass(cause)
    if (kind === 'timeout') return '응답이 15초 안에 오지 않았어요. 주소가 맞는지, 프로젝트가 멈춰 있지 않은지(무료 플랜은 1주 미사용 시 멈춤) 확인해요.'
    if (kind === 'tls')
      return '인증서 확인에서 막혔어요. 프록시가 있는 환경이면 NODE_EXTRA_CA_CERTS에 그 환경의 CA 묶음 경로를 넣고 다시 실행해요(인증서 확인을 끄지는 않아요).'
    if (kind === 'dns') return '주소를 찾지 못했어요. NEXT_PUBLIC_SUPABASE_URL의 프로젝트 이름(https://<프로젝트>.supabase.co)이 맞는지 확인해요.'
    if (kind === 'refused') return '연결이 거절됐어요. 주소(URL)와 포트가 맞는지 확인해요(로컬 시험 서버라면 켜져 있는지).'
    return '네트워크에서 막혔어요. 이 환경의 Network access가 *.supabase.co를 허용하는지 확인해요(환경 설정 → Network access → Custom → Allowed domains에 *.supabase.co 추가, 패키지 매니저 기본값은 그대로). 내 컴퓨터라면 주소(URL)를 다시 확인해요.'
  }
  if (status === 404) return 'SQL이 아직 실행되지 않았거나 예전 버전이에요. Supabase SQL Editor에서 supabase/schema.sql → policies.sql 순서로 실행해요(방금 실행했다면 1분 뒤 다시).'
  if (status === 401) return 'anon 키가 틀렸거나 다른 프로젝트 것이에요. Project Settings → API의 anon public 키를 다시 복사해요.'
  if (status === 403) return '키 또는 권한(정책) 문제예요. policies.sql을 실행했는지, anon 키가 이 프로젝트 것인지 확인해요.'
  if (status === 400 || status === 422) return '인자 모양이 달라요. supabase/schema.sql 최신본을 다시 실행해요(함수 인자 이름 p_…이 앱과 같아야 해요).'
  if (status === 409) return '같은 값이 이미 있어요. schema.sql 최신본(owner_key_hash unique 제거)을 다시 실행해요.'
  if (typeof status === 'number' && status >= 500) return 'Supabase 쪽 오류예요. 프로젝트가 멈춰 있으면 대시보드에서 다시 켜고, 계속되면 SQL Editor에서 schema.sql을 다시 실행해요.'
  return '예상하지 못한 응답이에요. 메모의 내용을 다음 작업 세션에 그대로 붙여 주세요(키는 출력되지 않아요).'
}

/** 'YYYY-MM-DD' in Seoul for `date` (the server counts '링크 연 날' on its Seoul date). */
export function seoulDay(date = new Date()) {
  return new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A snapshot-shaped payload with nothing about anyone: names '확인', no days, a marker to read back. */
export function syntheticSnapshot(marker, today) {
  return {
    version: 2,
    verify: true,
    marker,
    today,
    validUntil: today,
    stage: 'preparing',
    viewer: 'a',
    cycleOwner: 'b',
    members: [
      { id: 'a', name: '확인', emoji: '🙂', role: 'partner' },
      { id: 'b', name: '확인', emoji: '🙂', role: 'partner' },
    ],
    signals: [],
    days: [],
  }
}

/**
 * Walk every step against the project. `fetch` is injectable (tests use a
 * fake server). Returns { ok, steps, coupleId, cleaned } — each step
 * { id, fn, label, result: 'PASS' | 'FAIL' | 'SKIP', status?, note?, hint? }.
 */
export async function verifySupabase({ url, anonKey, fetch: doFetch = globalThis.fetch, now = () => new Date(), random } = {}) {
  const rnd = random ?? {
    ownerKey: () => randomBytes(32).toString('hex'),
    coupleId: () => randomUUID(),
    token: () => randomBytes(16).toString('base64url'),
    id: () => `verify-${randomBytes(6).toString('hex')}`,
  }
  const base = String(url).replace(/\/+$/, '')
  const ownerKey = rnd.ownerKey()
  const coupleId = rnd.coupleId()
  const token = rnd.token()
  const eventId = rnd.id()
  const marker = rnd.id()
  const secrets = [anonKey, ownerKey, token]
  const today = seoulDay(now())

  async function call(fn, body) {
    let res
    try {
      const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined
      res = await doFetch(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: rpcHeaders(anonKey), body: JSON.stringify(body), ...(signal ? { signal } : {}) })
    } catch (err) {
      const name = err && typeof err === 'object' ? err.name : ''
      const code = err && typeof err === 'object' && err.cause && typeof err.cause === 'object' ? err.cause.code || err.cause.message : undefined
      const cause = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : code
      return { network: true, cause: cause ? String(cause) : String(err && err.message ? err.message : 'network') }
    }
    const text = await res.text().catch(() => '')
    let json
    if (text.trim()) {
      try {
        json = JSON.parse(text)
      } catch {
        json = undefined
      }
    }
    return { status: res.status, ok: res.status >= 200 && res.status < 300, text, json }
  }

  /** The server's own words for a failure (PostgREST {code, message}), short and with no secret. */
  const said = (r) => {
    if (r.network) return `네트워크: ${r.cause}`
    const j = r.json && typeof r.json === 'object' ? r.json : null
    const words = j ? [j.code, j.message].filter(Boolean).join(' ') : r.text
    return redact(String(words ?? '').replace(/\s+/g, ' ').slice(0, 120), secrets)
  }

  const steps = []
  const pass = (s, r, note) => steps.push({ ...s, result: 'PASS', ...(r && r.status ? { status: r.status } : {}), ...(note ? { note } : {}) })
  const fail = (s, r, note, hint) =>
    steps.push({
      ...s,
      result: 'FAIL',
      ...(r && r.status ? { status: r.status } : {}),
      note: redact(note ?? said(r), secrets),
      hint: hint ?? hintFor({ status: r && r.status, network: r && r.network, cause: r && r.cause }),
    })
  const skip = (s, note) => steps.push({ ...s, result: 'SKIP', note })
  const step = (id) => STEPS.find((s) => s.id === id)

  // 1. The couple space (her phone's own id, as the app registers it).
  const c = await call('create_couple', { p_owner_key: ownerKey, p_couple_id: coupleId })
  const created = c.ok && typeof c.json === 'string' && c.json.toLowerCase() === coupleId.toLowerCase()
  if (created) pass(step('create'), c)
  else if (c.ok) fail(step('create'), c, `다른 값이 왔어요: ${said(c)}`, hintFor({ status: 400 }))
  else fail(step('create'), c)
  if (!created) {
    const why = c.network ? '연결이 안 돼서 건너뛰었어요' : '커플 공간이 없어서 건너뛰었어요'
    for (const s of STEPS.slice(1)) skip(s, why)
    return { ok: false, steps, coupleId, cleaned: false }
  }

  // 2. A token for the link (one day is enough).
  const i = await call('issue_token', { p_owner_key: ownerKey, p_couple_id: coupleId, p_token: token, p_days: 1 })
  if (i.ok && typeof i.json === 'string' && Number.isFinite(Date.parse(i.json))) pass(step('issue'), i)
  else if (i.ok) fail(step('issue'), i, `만료 시각이 아니에요: ${said(i)}`, hintFor({ status: 400 }))
  else fail(step('issue'), i)

  // 3. A snapshot with nothing in it but a marker.
  const p = await call('publish_snapshot', {
    p_owner_key: ownerKey,
    p_couple_id: coupleId,
    p_token: token,
    p_payload: syntheticSnapshot(marker, today),
    p_published_at: now().toISOString(),
  })
  if (p.ok && typeof p.json === 'number' && p.json >= 1) pass(step('publish'), p, `버전 ${p.json}`)
  else if (p.ok) fail(step('publish'), p, `버전 번호가 아니에요: ${said(p)}`, hintFor({ status: 400 }))
  else fail(step('publish'), p)

  // 4. The link reads it back with the token alone.
  const f = await call('snapshot_by_token', { p_token: token })
  const row = f.ok && Array.isArray(f.json) ? f.json[0] : undefined
  if (row && row.payload && row.payload.marker === marker) pass(step('fetch'), f)
  else if (f.ok) fail(step('fetch'), f, Array.isArray(f.json) && !f.json.length ? '읽은 줄이 없어요' : `다른 내용이 왔어요: ${said(f)}`, '스냅숏이 올라가지 않았거나 토큰이 등록되지 않았어요. 3단계(스냅숏 올리기)의 메모를 먼저 봐요.')
  else fail(step('fetch'), f)

  // 5. An event from his page (a cheer: ids only).
  const e = await call('send_event', { p_token: token, p_event_id: eventId, p_kind: 'cheer', p_payload: { id: eventId, kind: 'cheer', from: 'a' } })
  if (e.ok) pass(step('send'), e)
  else fail(step('send'), e)

  // 6. Her phone pulls it.
  const l = await call('pull_events', { p_owner_key: ownerKey, p_couple_id: coupleId, p_since: null })
  if (l.ok && Array.isArray(l.json) && l.json.some((r) => r && r.id === eventId)) pass(step('pull'), l)
  else if (l.ok) fail(step('pull'), l, '보낸 이벤트가 없어요', '5단계(이벤트 보내기)가 막혔거나 pull_events가 다른 커플을 보고 있어요. schema.sql을 다시 실행해요.')
  else fail(step('pull'), l)

  // 7–8. '링크 연 날': the token only; read back with the owner key (the server counts its Seoul date).
  const o = await call('record_link_open', { p_token: token })
  if (o.ok) pass(step('open'), o)
  else fail(step('open'), o)
  const d = await call('link_open_days', { p_owner_key: ownerKey, p_couple_id: coupleId, p_from: addDays(today, -1), p_to: addDays(today, 1) })
  if (d.ok && typeof d.json === 'number' && d.json >= 1) pass(step('days'), d, `${d.json}일`)
  else if (d.ok) fail(step('days'), d, `연 날이 0이에요: ${said(d)}`, '7단계(링크 연 날 기록)가 막혔는지 봐요. 서버 시계가 서울 날짜와 하루 넘게 다르면 이렇게 나와요.')
  else fail(step('days'), d)

  // 9–10. The link stops working at once.
  const v = await call('revoke_token', { p_owner_key: ownerKey, p_couple_id: coupleId, p_token: token })
  if (v.ok) pass(step('revoke'), v)
  else fail(step('revoke'), v)
  const g = await call('snapshot_by_token', { p_token: token })
  if (g.ok && Array.isArray(g.json) && g.json.length === 0) pass(step('revoked'), g, '읽은 줄 없음')
  else if (!g.ok && !g.network && g.status >= 400 && g.status < 500) pass(step('revoked'), g, '거절됨')
  else if (g.ok) fail(step('revoked'), g, '해제한 링크로 아직 읽혀요', 'snapshot_by_token이 revoked_at을 보는지 schema.sql을 확인하고 다시 실행해요. 9단계(링크 해제)의 결과도 봐요.')
  else fail(step('revoked'), g)

  // 11. Leave nothing behind.
  const x = await call('delete_couple', { p_owner_key: ownerKey, p_couple_id: coupleId })
  const cleaned = x.ok && x.json === true
  if (cleaned) pass(step('cleanup'), x)
  else
    fail(
      step('cleanup'),
      x,
      x.ok ? `지운 줄이 없어요: ${said(x)}` : undefined,
      `${x.status === 404 ? 'delete_couple 함수가 없어요(예전 SQL) — schema.sql·policies.sql 최신본을 실행해요. ' : ''}남은 테스트 줄은 SQL Editor에서 지워요: delete from public.couples where id = '${coupleId}'; (토큰·스냅숏·이벤트·링크 연 날이 함께 지워져요)`,
    )

  return { ok: steps.every((s) => s.result === 'PASS'), steps, coupleId, cleaned }
}

// ── Printing ────────────────────────────────────────────────

/** Terminal columns a string takes (Hangul and other wide characters count two). */
export function displayWidth(text) {
  let w = 0
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0)
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      cp >= 0x1f300
    w += wide ? 2 : 1
  }
  return w
}

const pad = (text, width) => text + ' '.repeat(Math.max(0, width - displayWidth(text)))

/** The PASS / FAIL table and what to do next, in Korean — never the key. */
export function formatTable(result, { url, kind, source, anonKey } = {}) {
  const secrets = [anonKey]
  const rows = result.steps.map((s, i) => ({
    n: String(i + 1),
    step: `${s.label} (${s.fn})`,
    result: s.result,
    http: s.status ? String(s.status) : '-',
    note: s.note ?? '',
  }))
  const w = {
    n: 2,
    step: Math.max(displayWidth('단계'), ...rows.map((r) => displayWidth(r.step))),
    result: 6,
    http: 4,
  }
  const lines = []
  lines.push('둘셋 · Supabase 연결 확인')
  if (url) {
    let host = url
    try {
      host = new URL(url).origin
    } catch {
      /* as given */
    }
    lines.push(`프로젝트: ${host}`)
  }
  if (kind) lines.push(`키: ${KEY_KIND_WORD[kind] ?? kind}${anonKey ? `, ${anonKey.length}자` : ''} (키 값은 출력하지 않아요)`)
  if (source) lines.push(`읽은 곳: ${source}`)
  lines.push('')
  lines.push(`${pad('#', w.n)}  ${pad('단계', w.step)}  ${pad('결과', w.result)}  ${pad('HTTP', w.http)}  메모`)
  lines.push('-'.repeat(w.n + w.step + w.result + w.http + 14))
  for (const r of rows) lines.push(`${pad(r.n, w.n)}  ${pad(r.step, w.step)}  ${pad(r.result, w.result)}  ${pad(r.http, w.http)}  ${r.note}`)
  const failed = result.steps.filter((s) => s.result === 'FAIL')
  const passed = result.steps.filter((s) => s.result === 'PASS').length
  lines.push('')
  if (result.ok) {
    lines.push(`결과: ${result.steps.length}단계 모두 통과했어요. 앱을 이 두 값으로 빌드하면 '연결: Supabase'로 동작해요.`)
  } else {
    lines.push(`결과: ${result.steps.length}단계 중 ${passed}단계 통과, ${failed.length}단계 막힘${result.steps.some((s) => s.result === 'SKIP') ? '(나머지는 건너뜀)' : ''}.`)
    lines.push('고칠 것:')
    const seen = new Set()
    for (const s of failed) {
      if (!s.hint || seen.has(s.hint)) continue
      seen.add(s.hint)
      lines.push(`  - ${s.label}: ${s.hint}`)
    }
  }
  if (result.cleaned) lines.push(`테스트로 만든 줄은 모두 지웠어요(커플 id ${result.coupleId}).`)
  return redact(lines.join('\n'), secrets)
}

// ── Running ─────────────────────────────────────────────────

/** Node's fetch reads HTTPS_PROXY only with NODE_USE_ENV_PROXY=1 (Node ≥ 22.21 / 24): re-run once with it. */
function proxyRerunNeeded(env = process.env, version = process.versions.node) {
  if (env.DULSET_VERIFY_CHILD || env.NODE_USE_ENV_PROXY) return false
  if (!(env.HTTPS_PROXY || env.https_proxy)) return false
  const [maj, min] = version.split('.').map(Number)
  return maj > 22 || (maj === 22 && min >= 21)
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (proxyRerunNeeded(env)) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...argv], {
      stdio: 'inherit',
      env: { ...env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1', DULSET_VERIFY_CHILD: '1' },
    })
    return child.status ?? 1
  }
  const cfg = readSupabaseEnv({ env })
  if (cfg.problems.length) {
    console.log('둘셋 · Supabase 연결 확인')
    for (const p of cfg.problems) console.log(`- ${redact(p, [cfg.anonKey])}`)
    console.log('\n자세한 순서: docs/next-a-setup.md §4~§5')
    return 2
  }
  for (const w of cfg.warnings) console.log(`참고: ${w}`)
  const result = await verifySupabase({ url: cfg.url, anonKey: cfg.anonKey })
  console.log(formatTable(result, cfg))
  return result.ok ? 0 : 1
}

const invokedDirectly = (() => {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  } catch {
    return false
  }
})()

/** An unexpected error's message with the key (from the environment or the env file) taken out. */
export function safeErrorMessage(err, env = process.env) {
  const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err)
  let secrets = [env[KEY_NAME]]
  try {
    secrets = [...secrets, readSupabaseEnv({ env }).anonKey]
  } catch {
    /* the env file could not be read: the environment's value is enough */
  }
  return redact(message, secrets.filter(Boolean).map((k) => String(k).trim()))
}

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error('확인 스크립트가 멈췄어요:', safeErrorMessage(err))
      process.exit(1)
    },
  )
}
