import type { Metadata } from 'next'
import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import TimingStrip from '@/components/shared/TimingStrip'
import Header from '@/components/layout/Header'
import SignatureEventsExplorer from '@/components/whentogo/SignatureEventsExplorer'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'When to go where in Korea — WhereKorea',
  description:
    'Month-by-month timing for every destination: best months, shoulder seasons, and crowding peaks — based on seasonal data and mobile-network visitor volumes.',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function WhenToGoPage() {
  const currentMonth = Number(
    new Date().toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' })
  )
  const sorted = [...destinations].sort(
    (a, b) => b.base_appeal - a.base_appeal || a.name.localeCompare(b.name)
  )

  return (
    <div>
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-2">When to go where</h1>
      <p className="text-sm text-white/60 leading-relaxed mb-1">
        Month-by-month timing for every destination. Now: <span className="text-white/90 font-medium">{MONTH_NAMES[currentMonth - 1]}</span> (highlighted column).
      </p>
      <p className="text-[11px] text-white/55 mb-8">
        <span className="text-green-300/90">■</span> best months&ensp;
        <span className="text-yellow-300/70">■</span> shoulder&ensp;
        <span className="text-white/30">■</span> off-season&ensp;
        <span className="text-red-400">•</span> peak crowds (visitor-data verified)
      </p>

      <div className="space-y-4">
        {sorted.map((d) => (
          <div
            key={d.slug}
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-3 border-b border-white/10"
          >
            <div className="w-44 shrink-0">
              <Link
                href={`/destination/${d.slug}`}
                className="text-sm font-semibold text-white hover:underline"
              >
                {d.name}
              </Link>
              <span className="ml-2 text-xs text-white/55">{KOREAN_NAMES[d.slug]}</span>
            </div>
            <TimingStrip destination={d} currentMonth={currentMonth} />
          </div>
        ))}
      </div>

      <SignatureEventsExplorer currentMonth={currentMonth} />

      <p className="text-xs text-white/50 mt-8 leading-relaxed">
        Best months are editorial judgements of when the experience is genuinely good; crowd peaks
        come from KT/SKT mobile-network visitor volumes (non-local + foreign, 12-month sample).
        Live weather and festivals feed the &ldquo;Best now&rdquo; ranking on the home page.
      </p>
      </div>
    </div>
  )
}
