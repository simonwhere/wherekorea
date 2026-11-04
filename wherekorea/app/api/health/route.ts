import { runtimeReadiness } from '@/lib/live/status'

// This proves that the application can respond, not that external data is fresh.
// Do not turn a frequent liveness check into weather/TourAPI traffic.
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(runtimeReadiness(), {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
