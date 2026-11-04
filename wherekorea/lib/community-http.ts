export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = 'invalid_request') {
    super(message)
    this.status = status
    this.code = code
  }
}

const MAX_BYTES = 16_384

/** Mutation entry point: no cross-site forms, forged forwarded host, or unbounded body. */
export async function readCommunityJson(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin')
  let expected: string
  try {
    const canonical = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_SITE_URL : request.url
    const parsed = new URL(canonical || '')
    // Loopback production builds are used only for local verification.
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error()
    if (parsed.username || parsed.password) throw new Error()
    expected = parsed.origin
  } catch { throw new HttpError(503, 'The community is not configured yet.', 'unavailable') }
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Open this page on WhereKorea and try again.', 'origin_rejected')
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Send a JSON request.')
  const declared = request.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) throw new HttpError(413, 'This request is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new HttpError(400, 'The request is empty.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, 'This request is too large.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value
  } catch { throw new HttpError(400, 'The request could not be read.') }
}

export function communityJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Cookie',
  } })
}

export function communityError(error: unknown) {
  if (error instanceof HttpError) return communityJson({ error: error.message, code: error.code }, error.status)
  if (error instanceof Error && error.name === 'CommunityInputError') return communityJson({ error: error.message, code: 'invalid_request' }, 400)
  // Never leak provider errors, query text, credentials or entered content.
  return communityJson({ error: 'The community could not be reached. Your text has not been discarded. Try again.', code: 'unavailable' }, 503)
}
