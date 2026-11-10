import { put } from '@vercel/blob'
import { walks } from '@/data/walks'
import { koreaDay, receiptPath, validWalkMetric } from '@/lib/walk-metric-receipts'

export const runtime = 'nodejs'
const walkSlugs = new Set(walks.map(walk => walk.slug))
const maxBytes = 768
const respond = (status: number) => new Response(null, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})

async function smallJson(req: Request): Promise<unknown> {
  if (!req.body || Number(req.headers.get('content-length')) > maxBytes) throw new RangeError()
  const reader = req.body.getReader()
  const bytes = new Uint8Array(maxBytes)
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (length + value.length > maxBytes) { await reader.cancel(); throw new RangeError() }
      bytes.set(value, length)
      length += value.length
    }
  } finally { reader.releaseLock() }
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)))
}

export async function POST(req: Request) {
  if (req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') return respond(403)
  const origin = req.headers.get('origin')
  const fetchSite = req.headers.get('sec-fetch-site')
  // Browsers can send Origin: null for same-origin POSTs using no-referrer.
  const sameSiteRequest = origin && origin !== 'null'
    ? origin === new URL(req.url).origin : fetchSite === 'same-origin'
  if (!sameSiteRequest || fetchSite === 'cross-site') return respond(403)
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return respond(415)
  let metric: unknown
  try { metric = await smallJson(req) }
  catch (error) { return respond(error instanceof RangeError ? 413 : 400) }
  if (!validWalkMetric(metric, walkSlugs, koreaDay())) return respond(400)
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return respond(503)

  try {
    const qa = req.headers.get('x-wherekorea-metrics-test') === '1'
    await put(receiptPath(metric, qa), '1', {
      access: 'private', allowOverwrite: true, addRandomSuffix: false,
      contentType: 'text/plain', abortSignal: AbortSignal.timeout(8000),
    })
    return respond(204)
  } catch {
    return respond(503)
  }
}
