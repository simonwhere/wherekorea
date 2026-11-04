import type { Metadata } from 'next'
import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import { browseHref, homeHrefFromSearch, withBrowseContext } from '@/lib/browse-state'
import { CROWD_SAMPLE_NOTE } from '@/lib/trust'
import TimingStrip from '@/components/shared/TimingStrip'
import Header from '@/components/layout/Header'
import SignatureEventsExplorer from '@/components/whentogo/SignatureEventsExplorer'
import TravelMonthSelect from '@/components/whentogo/TravelMonthSelect'
import { TIMING_MONTHS, timingView } from '@/components/whentogo/timing-model'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'When to go where in Korea',
  alternates: { canonical: '/when-to-go' },
  description: 'Compare typical seasons, busy periods and recurring events across Korean destinations.',
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WhenToGoPage({ searchParams }: Props) {
  const query = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, entry)
  }
  const { browse, visible } = timingView(destinations, params)
  const contextSearch = withBrowseContext('/when-to-go', params.toString()).split('?')[1] ?? ''
  const contextHref = withBrowseContext('/when-to-go', params.toString())
  const narrowed = browse.filters.length > 0 || !!browse.q || browse.excludeSeoul || browse.category !== 'best-now' || browse.maxDailyKrw !== undefined
  const resetHref = browseHref({ ...browse, q: '', filters: [], category: 'best-now', excludeSeoul: false, maxDailyKrw: undefined }, '/when-to-go')

  return (
    <div>
      <Header />
      <main className="max-w-screen-xl mx-auto px-4 py-7 sm:py-8">
        <Link href={homeHrefFromSearch(contextSearch)} className="text-xs text-[#ffb495] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff936b]">← Back to your results</Link>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-5 mb-2">When to go where</h1>
        <p className="text-sm text-white/75 leading-relaxed">
          Compare typical seasons. The outlined column shows your selected month:
          {' '}<strong className="text-white">{TIMING_MONTHS[browse.month - 1]}</strong>.
        </p>

        <TravelMonthSelect browse={browse} contextHref={contextHref} />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-white/85">{visible.length} {visible.length === 1 ? 'place' : 'places'}{narrowed ? ' matching your conditions' : ' to compare'}.
            <span className="block text-xs text-white/65 mt-1">Your search and filters also apply to the events below.</span>
          </p>
          {narrowed && <Link href={resetHref} className="min-h-10 inline-flex items-center rounded-lg border border-white/25 px-3 text-xs text-white hover:bg-white/5">Show all places for this month</Link>}
        </div>

        <p className="text-[11px] text-white/70 leading-relaxed mb-6">
          <span className="text-green-300/90" aria-hidden="true">■</span> recommended month&ensp;
          <span className="text-yellow-300/80" aria-hidden="true">■</span> neighboring season&ensp;
          <span className="text-white/50" aria-hidden="true">■</span> outside recommended months&ensp;
          <span className="text-red-400" aria-hidden="true">•</span> usual peak period · not live crowd data
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">
          <section aria-label="Destination seasonal comparison">
            {visible.length === 0 ? (
              <div className="rounded-xl border border-white/20 p-5">
                <h2 className="text-base font-semibold text-white">No places match all these conditions.</h2>
                <p className="text-sm text-white/70 mt-2">Try another month or change your filters in Explore.</p>
                <Link href={homeHrefFromSearch(contextSearch)} className="inline-flex min-h-11 items-center text-sm text-[#ffb495] mt-2">Adjust conditions in Explore →</Link>
              </div>
            ) : visible.map((destination) => (
              <div key={destination.slug} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 py-4 border-b border-white/15">
                <div className="sm:w-36 shrink-0">
                  <Link href={withBrowseContext('/destination/' + destination.slug, contextSearch)}
                    className="text-sm font-semibold text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff936b]">{destination.name}</Link>
                  <span className="ml-2 text-xs text-white/60" lang="ko">{KOREAN_NAMES[destination.slug]}</span>
                  <p className="text-[11px] text-white/65 mt-1">{destination.recommended_stay} · {destination.no_car_friendliness === 'Easy' ? 'Easy without a car' : destination.no_car_friendliness === 'Okay' ? 'Some transit planning' : 'Car helpful'}</p>
                </div>
                <TimingStrip destination={destination} currentMonth={browse.month} />
              </div>
            ))}
          </section>
          <div className="lg:sticky lg:top-24">
            <SignatureEventsExplorer browse={browse} allowedCities={visible.map((destination) => destination.slug)} contextSearch={contextSearch} />
          </div>
        </div>

        <section aria-label="How to read this guide" className="text-xs text-white/65 mt-8 pt-5 border-t border-white/15 leading-relaxed">
          <p>Recommended months describe typical seasons, not a weather forecast. Check forecasts, opening hours and access before you go.</p>
          <p className="mt-2">{CROWD_SAMPLE_NOTE} Peak markers show usual busy periods, not current crowd levels.</p>
        </section>
      </main>
    </div>
  )
}
