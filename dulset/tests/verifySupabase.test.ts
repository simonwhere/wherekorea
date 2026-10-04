// scripts/verify-supabase.mjs (N25 prep) against a fake Supabase: an
// in-memory server that keeps the rules of supabase/schema.sql (owner key +
// couple id, token hashes with revoke, events once per id, '링크 연 날' per
// day, delete with cascade) and answers like PostgREST (404 for a missing
// function, 401 for a wrong key, 403 for a refused owner / token). The
// script must walk the whole round trip, say PASS / FAIL with the HTTP status
// and a Korean hint, clean up after itself — and never print the key.
//
// It also runs the script as a real process against a local HTTP server
// speaking the same fake, so reading the env / .env.local and the exit code
// are covered too.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseTransport, rpcHeaders as appHeaders } from '@/lib/sync/supabaseTransport'

const SCRIPT = path.resolve(__dirname, '../scripts/verify-supabase.mjs')

interface Step {
  id: string
  fn: string
  label: string
  result: 'PASS' | 'FAIL' | 'SKIP'
  status?: number
  note?: string
  hint?: string
}
interface Result {
  ok: boolean
  steps: Step[]
  coupleId: string
  cleaned: boolean
}
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; text(): Promise<string> }>
interface VerifyModule {
  STEPS: Array<{ id: string; fn: string; label: string }>
  parseDotEnv(text: string): Record<string, string>
  keyKind(key: string): 'anon' | 'publishable' | 'service' | 'secret' | 'unknown'
  readSupabaseEnv(opts: {
    env?: Record<string, string | undefined>
    envFile?: string
    readFile?: (p: string) => string
    exists?: (p: string) => boolean
  }): { url: string; anonKey: string; source: string | null; kind: string | null; problems: string[]; warnings: string[] }
  rpcHeaders(anonKey: string): Record<string, string>
  hintFor(r: { status?: number; network?: boolean; cause?: string }): string
  redact(text: string, secrets: string[]): string
  displayWidth(text: string): number
  syntheticSnapshot(marker: string, today: string): Record<string, unknown>
  verifySupabase(opts: { url: string; anonKey: string; fetch?: FetchLike; now?: () => Date }): Promise<Result>
  formatTable(result: Result, cfg?: { url?: string; kind?: string | null; source?: string | null; anonKey?: string }): string
}

let V: VerifyModule
beforeAll(async () => {
  // A computed specifier: the script is plain .mjs (no types), loaded as-is.
  V = (await import(/* @vite-ignore */ SCRIPT)) as unknown as VerifyModule
})

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const ANON = `eyJhbGciOiJIUzI1NiJ9.${b64url({ role: 'anon', ref: 'abcd' })}.c2lnbmF0dXJlLXNlY3JldA`
const SERVICE = `eyJhbGciOiJIUzI1NiJ9.${b64url({ role: 'service_role', ref: 'abcd' })}.c2lnbmF0dXJl`
const URL = 'https://abcd.supabase.co'

// ── A fake Supabase that keeps schema.sql's rules ───────────

interface FakeOptions {
  /** Functions that do not exist (PostgREST: 404 PGRST202). */
  missing?: string[]
  /** snapshot_by_token ignores revoked_at (a broken server). */
  readsRevoked?: boolean
  /** The key the project accepts. */
  key?: string
}

interface Call {
  fn: string
  body: Record<string, unknown>
  headers: Record<string, string>
}

function fakeSupabase(opts: FakeOptions = {}) {
  const key = opts.key ?? ANON
  const hash = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
  const couples = new Map<string, string>() // id → owner hash
  const tokens = new Map<string, { couple: string; revoked: boolean }>()
  const snapshots = new Map<string, { version: number; payload: unknown }[]>()
  const events = new Map<string, { id: string; kind: string; payload: unknown; created_at: string }[]>()
  const opens = new Map<string, Map<string, number>>()
  const calls: Call[] = []
  const reply = (status: number, body?: unknown) => ({ status, text: body === undefined ? '' : JSON.stringify(body) })
  const denied = () => reply(403, { code: '42501', message: 'not the owner of this couple' })
  const owner = (b: Record<string, unknown>) => {
    const id = String(b.p_couple_id)
    return couples.get(id) === hash(String(b.p_owner_key)) ? id : null
  }
  const live = (t: unknown) => {
    const r = tokens.get(hash(String(t)))
    return r && (!r.revoked || opts.readsRevoked) ? r : null
  }
  const seoul = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)

  function handle(fn: string, body: Record<string, unknown>, headers: Record<string, string>) {
    calls.push({ fn, body, headers })
    if (headers.apikey !== key) return reply(401, { message: 'Invalid API key' })
    if (opts.missing?.includes(fn)) return reply(404, { code: 'PGRST202', message: `Could not find the function public.${fn}` })
    switch (fn) {
      case 'create_couple': {
        const id = String(body.p_couple_id)
        const h = hash(String(body.p_owner_key))
        if (!couples.has(id)) couples.set(id, h)
        return couples.get(id) === h ? reply(200, id) : denied()
      }
      case 'issue_token': {
        const c = owner(body)
        if (!c) return denied()
        tokens.set(hash(String(body.p_token)), { couple: c, revoked: false })
        return reply(200, new Date(Date.now() + 86_400_000).toISOString())
      }
      case 'publish_snapshot': {
        const c = owner(body)
        if (!c) return denied()
        const list = snapshots.get(c) ?? []
        const version = list.length + 1
        snapshots.set(c, [...list, { version, payload: body.p_payload }])
        return reply(200, version)
      }
      case 'snapshot_by_token': {
        const t = live(body.p_token)
        const list = t ? (snapshots.get(t.couple) ?? []) : []
        const last = list[list.length - 1]
        return reply(200, last ? [{ couple_id: t!.couple, version: last.version, published_at: new Date().toISOString(), payload: last.payload }] : [])
      }
      case 'send_event': {
        const t = live(body.p_token)
        if (!t || tokens.get(hash(String(body.p_token)))!.revoked) return reply(403, { code: '42501', message: 'link not valid' })
        const list = events.get(t.couple) ?? []
        if (!list.some((e) => e.id === body.p_event_id))
          list.push({ id: String(body.p_event_id), kind: String(body.p_kind), payload: body.p_payload, created_at: new Date().toISOString() })
        events.set(t.couple, list)
        return reply(204)
      }
      case 'pull_events': {
        const c = owner(body)
        if (!c) return denied()
        return reply(200, (events.get(c) ?? []).map((e) => ({ ...e, read_at: null })))
      }
      case 'record_link_open': {
        const t = live(body.p_token)
        if (t && !tokens.get(hash(String(body.p_token)))!.revoked) {
          const days = opens.get(t.couple) ?? new Map()
          days.set(seoul, (days.get(seoul) ?? 0) + 1)
          opens.set(t.couple, days)
        }
        return reply(204)
      }
      case 'link_open_days': {
        const c = owner(body)
        if (!c) return denied()
        const days = [...(opens.get(c)?.keys() ?? [])].filter((d) => d >= String(body.p_from) && d <= String(body.p_to))
        return reply(200, days.length)
      }
      case 'revoke_token': {
        const c = owner(body)
        if (!c) return denied()
        const t = tokens.get(hash(String(body.p_token)))
        if (t && t.couple === c) t.revoked = true
        return reply(204)
      }
      case 'delete_couple': {
        const c = owner(body)
        if (!c) return denied()
        couples.delete(c)
        for (const [h, t] of tokens) if (t.couple === c) tokens.delete(h)
        snapshots.delete(c)
        events.delete(c)
        opens.delete(c)
        return reply(200, true)
      }
      default:
        return reply(404, { code: 'PGRST202', message: 'no such function' })
    }
  }

  const fetch: FetchLike = async (url, init) => {
    const fn = url.split('/rest/v1/rpc/')[1] ?? ''
    const r = handle(fn, init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {}, init.headers)
    return { status: r.status, text: async () => r.text }
  }
  return { fetch, handle, calls, couples, tokens, snapshots, events, opens }
}

const fns = (calls: Call[]) => calls.map((c) => c.fn)

// ── Reading the env ─────────────────────────────────────────

describe('verify-supabase: reading the two variables', () => {
  it('parseDotEnv: comments, export, quotes, CRLF, trailing comments', () => {
    expect(
      V.parseDotEnv('# c\r\nexport NEXT_PUBLIC_SUPABASE_URL="https://x.supabase.co"\r\nNEXT_PUBLIC_SUPABASE_ANON_KEY = abc # note\nBAD LINE\n\nQ=\'a b\''),
    ).toEqual({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'abc', Q: 'a b' })
  })

  it('the environment first, then .env.local; a trailing slash goes; what is missing is said in Korean', () => {
    const file = `NEXT_PUBLIC_SUPABASE_URL=https://file.supabase.co/\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}\n`
    const fromFile = V.readSupabaseEnv({ env: {}, envFile: '/x/.env.local', exists: () => true, readFile: () => file })
    expect(fromFile).toMatchObject({ url: 'https://file.supabase.co', anonKey: ANON, source: '.env.local', kind: 'anon', problems: [] })
    const fromEnv = V.readSupabaseEnv({
      env: { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON },
      exists: () => true,
      readFile: () => file,
    })
    expect(fromEnv).toMatchObject({ url: URL, source: '환경 변수' })
    const none = V.readSupabaseEnv({ env: {}, exists: () => false })
    expect(none.problems).toHaveLength(2)
    expect(none.problems.join(' ')).toContain('NEXT_PUBLIC_SUPABASE_URL가 없어요')
    expect(V.readSupabaseEnv({ env: { NEXT_PUBLIC_SUPABASE_URL: 'not a url', NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON }, exists: () => false }).problems[0]).toContain('주소 모양')
  })

  it('refuses a service_role or secret key (never needed, never to be used); knows the anon and publishable keys', () => {
    expect(V.keyKind(ANON)).toBe('anon')
    expect(V.keyKind('sb_publishable_abc123')).toBe('publishable')
    expect(V.keyKind(SERVICE)).toBe('service')
    expect(V.keyKind('sb_secret_abc')).toBe('secret')
    expect(V.keyKind('hello')).toBe('unknown')
    for (const k of [SERVICE, 'sb_secret_abc']) {
      const r = V.readSupabaseEnv({ env: { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: k }, exists: () => false })
      expect(r.problems.join(' ')).toContain('anon public 키로 바꿔')
      expect(r.problems.join(' ')).not.toContain(k)
    }
  })

  it('sends the same headers as the app (lib/sync/supabaseTransport.ts rpcHeaders) for both kinds of key', () => {
    for (const k of [ANON, 'sb_publishable_abc123']) expect(V.rpcHeaders(k)).toEqual(appHeaders({ url: URL, anonKey: k }))
  })
})

// ── The round trip ──────────────────────────────────────────

describe('verify-supabase: the whole round trip against a fake project', () => {
  it('passes every step in the app’s order, with throwaway data and nothing about anyone; leaves nothing behind', async () => {
    const f = fakeSupabase()
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: f.fetch })
    expect(r.steps.map((s) => [s.fn, s.result])).toEqual(V.STEPS.map((s) => [s.fn, 'PASS']))
    expect(r.ok).toBe(true)
    expect(r.cleaned).toBe(true)
    expect(fns(f.calls)).toEqual(V.STEPS.map((s) => s.fn))
    // Nothing left: the couple and everything under it went.
    expect(f.couples.size).toBe(0)
    expect(f.tokens.size).toBe(0)
    expect(f.snapshots.size + f.events.size + f.opens.size).toBe(0)
    // Owner calls carry the owner key and the couple; the link's calls only the token.
    const ownerKey = f.calls[0]!.body.p_owner_key as string
    const token = f.calls[1]!.body.p_token as string
    expect(ownerKey).toMatch(/^[0-9a-f]{64}$/)
    expect(token.length).toBeGreaterThanOrEqual(16)
    for (const c of f.calls) {
      const partner = ['snapshot_by_token', 'send_event', 'record_link_open'].includes(c.fn)
      expect('p_owner_key' in c.body, c.fn).toBe(!partner)
      if (partner) expect(Object.keys(c.body).filter((k) => k !== 'p_token' && !k.startsWith('p_event') && k !== 'p_kind' && k !== 'p_payload'), c.fn).toEqual([])
    }
    // The synthetic snapshot carries nothing of a real couple: no record, no date of anyone's cycle.
    const payload = JSON.stringify(f.calls.find((c) => c.fn === 'publish_snapshot')!.body.p_payload)
    for (const w of ['periods', 'lhTests', 'pregnancyTests', 'personalLog', 'intimacy', '생리', '배란', '가임기', 'LH', '임신'])
      expect(payload.includes(w), w).toBe(false)
    expect(JSON.parse(payload)).toMatchObject({ verify: true, days: [], members: [{ name: '확인' }, { name: '확인' }] })
  })

  it('creates the couple with its own id — the same request the app sends before its first publish', async () => {
    const f = fakeSupabase()
    await V.verifySupabase({ url: URL, anonKey: ANON, fetch: f.fetch })
    const script = f.calls[0]!
    const app = fakeSupabase()
    const t = createSupabaseTransport({
      url: URL,
      anonKey: ANON,
      ownerKey: script.body.p_owner_key as string,
      fetch: async (input, init) => {
        const r = await app.fetch(input, init)
        return { ok: r.status < 300, status: r.status, text: () => r.text() }
      },
    })
    await t.ensureCouple(script.body.p_couple_id as string)
    expect(app.calls[0]).toEqual(script)
    // And the arguments of every other call are the app's (supabaseTransport) names.
    const appCalls = fakeSupabase()
    const t2 = createSupabaseTransport({
      url: URL,
      anonKey: ANON,
      ownerKey: 'o'.repeat(64),
      fetch: async (input, init) => {
        const r = await appCalls.fetch(input, init)
        return { ok: r.status < 300, status: r.status, text: () => r.text() }
      },
    })
    const id = '7f3c2a10-1b2c-4d5e-8f90-0123456789ab'
    const tok = 'tok-0123456789abcdef'
    await t2.issueToken(id, tok, 1)
    await t2.publishSnapshot(id, tok, V.syntheticSnapshot('m', '2026-10-04') as never)
    await t2.fetchSnapshot(tok)
    await t2.sendEvent(tok, { id: 'e1', kind: 'cheer' })
    await t2.pullEvents(id, '')
    await t2.recordLinkOpen(tok, '2026-10-04')
    await t2.linkOpenDays(id, '2026-10-03', '2026-10-05')
    await t2.revokeToken(id, tok)
    await t2.deleteCouple(id)
    const keysOf = (calls: Call[], fn: string) => Object.keys(calls.find((c) => c.fn === fn)!.body).sort()
    for (const s of V.STEPS) expect(keysOf(f.calls, s.fn), s.fn).toEqual(keysOf(appCalls.calls, s.fn))
  })

  it('404 (SQL not run): the first step fails with the SQL hint, the rest are skipped, nothing is pretended', async () => {
    const f = fakeSupabase({ missing: ['create_couple'] })
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: f.fetch })
    expect(r.ok).toBe(false)
    expect(r.steps[0]).toMatchObject({ result: 'FAIL', status: 404 })
    expect(r.steps[0]!.hint).toContain('schema.sql → policies.sql')
    expect(r.steps.slice(1).every((s) => s.result === 'SKIP')).toBe(true)
    expect(fns(f.calls)).toEqual(['create_couple'])
    const table = V.formatTable(r, { url: URL, kind: 'anon', source: '환경 변수', anonKey: ANON })
    expect(table).toContain('FAIL')
    expect(table).toContain('404')
    expect(table).toContain('SQL Editor')
  })

  it('401 (wrong key) and 403 (key / policy) each get their own hint', async () => {
    const wrong = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: fakeSupabase({ key: 'other' }).fetch })
    expect(wrong.steps[0]).toMatchObject({ result: 'FAIL', status: 401 })
    expect(wrong.steps[0]!.hint).toContain('anon public 키를 다시 복사')
    expect(V.hintFor({ status: 403 })).toContain('policies.sql')
    expect(V.hintFor({ status: 400 })).toContain('schema.sql')
    expect(V.hintFor({ status: 503 })).toContain('멈춰 있으면')
  })

  it('a network error (the host is blocked) says to allow *.supabase.co in this environment’s Network access', async () => {
    const blocked: FetchLike = async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { message: 'Request was cancelled.' } })
    }
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: blocked })
    expect(r.steps[0]).toMatchObject({ result: 'FAIL' })
    expect(r.steps[0]!.status).toBeUndefined()
    expect(r.steps[0]!.note).toContain('네트워크')
    expect(r.steps[0]!.hint).toContain('*.supabase.co')
    expect(r.steps[0]!.hint).toContain('Network access')
    expect(r.steps.slice(1).every((s) => s.result === 'SKIP' && s.note!.includes('연결'))).toBe(true)
  })

  it('a link that still reads after revoke fails step 10; a missing delete_couple fails the cleanup with the SQL to run', async () => {
    const leaky = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: fakeSupabase({ readsRevoked: true }).fetch })
    const step10 = leaky.steps.find((s) => s.id === 'revoked')!
    expect(step10).toMatchObject({ result: 'FAIL', status: 200, note: '해제한 링크로 아직 읽혀요' })
    expect(step10.hint).toContain('revoked_at')
    const old = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: fakeSupabase({ missing: ['delete_couple'] }).fetch })
    const cleanup = old.steps.find((s) => s.id === 'cleanup')!
    expect(cleanup).toMatchObject({ result: 'FAIL', status: 404 })
    expect(cleanup.hint).toContain(`delete from public.couples where id = '${old.coupleId}';`)
    expect(old.cleaned).toBe(false)
    expect(old.steps.filter((s) => s.result === 'FAIL').map((s) => s.id)).toEqual(['cleanup'])
  })

  it('never prints the key — not even when the server echoes it back in an error', async () => {
    const echo: FetchLike = async (_url, init) => ({ status: 401, text: async () => JSON.stringify({ message: `bad key ${init.headers.apikey}` }) })
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: echo })
    const table = V.formatTable(r, { url: URL, kind: 'anon', source: '.env.local', anonKey: ANON })
    expect(table.includes(ANON)).toBe(false)
    expect(JSON.stringify(r).includes(ANON)).toBe(false)
    expect(table).toContain('[숨김]')
    expect(table).toContain(`${ANON.length}자`)
    expect(V.redact(`a ${ANON} b`, [ANON])).toBe('a [숨김] b')
  })

  it('the table lines up Korean labels (two columns a character)', async () => {
    expect(V.displayWidth('단계')).toBe(4)
    expect(V.displayWidth('abc')).toBe(3)
    const r = await V.verifySupabase({ url: URL, anonKey: ANON, fetch: fakeSupabase().fetch })
    const table = V.formatTable(r, { url: URL, kind: 'anon', source: '환경 변수', anonKey: ANON })
    const rows = table.split('\n').filter((l) => /^\d+\s/.test(l))
    expect(rows).toHaveLength(V.STEPS.length)
    const resultCol = rows.map((l) => V.displayWidth(l.slice(0, l.indexOf('PASS'))))
    expect(new Set(resultCol).size).toBe(1)
    expect(table).toContain('11단계 모두 통과')
    expect(table).toContain('테스트로 만든 줄은 모두 지웠어요')
  })
})

// ── As a process ────────────────────────────────────────────

describe('verify-supabase: as a real process (env / .env.local, exit codes)', () => {
  let server: Server
  let base = ''
  const fake = fakeSupabase()
  beforeAll(async () => {
    server = createServer((req, res) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => {
        const fn = (req.url ?? '').split('/rest/v1/rpc/')[1] ?? ''
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]))
        const r = fake.handle(fn, data ? (JSON.parse(data) as Record<string, unknown>) : {}, headers)
        res.writeHead(r.status, { 'Content-Type': 'application/json' })
        res.end(r.text)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const dir = mkdtempSync(path.join(tmpdir(), 'dulset-verify-'))
  const NO_FILE = path.join(dir, 'missing.env')

  function run(env: Record<string, string>): Promise<{ code: number | null; out: string }> {
    return new Promise((resolve) => {
      const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NEXT_PUBLIC_SUPABASE')))
      // DULSET_VERIFY_CHILD: no proxy re-run (the fake is on 127.0.0.1); the env file defaults to one that is not there.
      const childEnv = { ...clean, DULSET_VERIFY_ENV_FILE: NO_FILE, ...env, DULSET_VERIFY_CHILD: '1' } as unknown as NodeJS.ProcessEnv
      const child = spawn(process.execPath, [SCRIPT], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      child.stdout.on('data', (c: Buffer) => (out += c.toString()))
      child.stderr.on('data', (c: Buffer) => (out += c.toString()))
      child.on('close', (code) => resolve({ code, out }))
    })
  }

  it('reads the two names from the environment, passes every step, exits 0 and prints no key', async () => {
    const { code, out } = await run({ NEXT_PUBLIC_SUPABASE_URL: base, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON })
    expect(out).toContain('11단계 모두 통과')
    expect(out.match(/PASS/g)).toHaveLength(11)
    expect(out.includes(ANON)).toBe(false)
    expect(out).toContain('읽은 곳: 환경 변수')
    expect(code).toBe(0)
    expect(fake.couples.size).toBe(0)
  }, 30_000)

  it('without the two names it says what is missing and exits 2; a service_role key is refused before any request', async () => {
    const before = fake.calls.length
    const none = await run({})
    expect(none.code).toBe(2)
    expect(none.out).toContain('NEXT_PUBLIC_SUPABASE_URL가 없어요')
    const service = await run({ NEXT_PUBLIC_SUPABASE_URL: base, NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE })
    expect(service.code).toBe(2)
    expect(service.out).toContain('service_role')
    expect(service.out.includes(SERVICE)).toBe(false)
    expect(fake.calls.length).toBe(before)
  }, 30_000)

  it('falls back to an env file (dulset/.env.local by default) when the environment has neither name', async () => {
    const file = path.join(dir, '.env.local')
    writeFileSync(file, `# 둘셋\nNEXT_PUBLIC_SUPABASE_URL=${base}/\nNEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON}"\n`)
    const { code, out } = await run({ DULSET_VERIFY_ENV_FILE: file })
    expect(out).toContain('읽은 곳: .env.local')
    expect(out.includes(ANON)).toBe(false)
    expect(code).toBe(0)
  }, 30_000)

  it('a wrong key exits 1 with the 401 hint', async () => {
    const { code, out } = await run({ NEXT_PUBLIC_SUPABASE_URL: base, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_wrong' })
    expect(code).toBe(1)
    expect(out).toContain('401')
    expect(out).toContain('anon public 키를 다시 복사')
    expect(out.includes('sb_publishable_wrong')).toBe(false)
  }, 30_000)
})
