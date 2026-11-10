import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { KRW_PER_USD } from '@/lib/currency'
import { CONTACT_EMAIL, TELEGRAM_URL } from '@/lib/site'
import { BUDGET_ASSUMPTIONS, TRAVEL_SCOPE, CROWD_SAMPLE_NOTE } from '@/lib/trust'
import { homeHrefFromSearch } from '@/lib/browse-state'

export const metadata: Metadata = {
  title: 'About WhereKorea',
  alternates: { canonical: '/about' },
  description:
    'Compare places in Korea by season, travel time, suggested stay and approximate daily cost.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-6 border-b border-white/10">
      <h2 className="flex items-center gap-2 text-[13px] font-bold text-white/90 uppercase tracking-wider mb-3">
        <span aria-hidden className="w-1 h-3.5 rounded-full shrink-0" style={{ background: '#FF6A3D' }} />
        {title}
      </h2>
      <div className="text-sm text-white/85 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
  }
  return (
    <div>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-white mb-2">About WhereKorea</h1>
        <p className="text-base text-white/70 leading-relaxed mb-4">
          Explore places in Korea, then compare their seasons, travel times, recommended stays
          and approximate daily costs.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          Save places as you browse, or put up to three side by side.
        </p>

        <Section title="How places are sorted">
          <p>
            Filters narrow the list. The selected month&apos;s season comes next, followed by
            the usual display order. &ldquo;Here now&rdquo; also uses current weather when available.
            &ldquo;Plan a trip&rdquo; uses seasonal guidance, not today&apos;s weather.
          </p>
          <p>The daily budget filter uses the shared-room estimate shown on cards. A private room for one costs more per person.</p>
        </Section>

        <Section title="About the estimates">
          <p id="budget" className="scroll-mt-24">
            <strong>Daily costs</strong> — {BUDGET_ASSUMPTIONS} Actual room prices vary by date.
          </p>
          <p>
            <strong>Travel times</strong> — {TRAVEL_SCOPE}
          </p>
          <p>
            <strong>Seasons and events</strong> — Usual conditions and recurring events can help
            you compare months. Check the forecast, event dates and opening hours before departure.
          </p>
          <details className="text-xs text-white/65 leading-relaxed">
            <summary className="cursor-pointer py-2">Sources and calculation details</summary>
            <div className="space-y-3 mt-2">
              <p><strong>Weather:</strong> <a className="underline text-white" href="https://open-meteo.com" rel="noopener">Open-Meteo</a> current conditions and 7-day forecasts, cached for up to an hour. Archive averages cover the same month in the previous year, not a long-term climate average.</p>
              <p><strong>Visitor levels:</strong> Korea Tourism Organization mobile-network samples. {CROWD_SAMPLE_NOTE} The Low/Medium/High labels are general guides.</p>
              <p><strong>Festivals:</strong> Korea Tourism Organization TourAPI listings, matched by location and cached daily. Seasonal highlights show usual timing, not confirmed dates.</p>
              <p><strong>Currency:</strong> USD uses ₩{KRW_PER_USD.toLocaleString()}/$, a fixed reference rate rather than a live conversion.</p>
              <p>Dates shown beside estimates record the last review of that information, not today&apos;s availability.</p>
            </div>
          </details>
        </Section>

        <Section title="Saved and shared walks">
          <p>Your bookmarked stops stay in this browser. When a walk is saved, shared or opened from a shared link, we count whether this browser opens it again on a later day in Korea.</p>
          <p>Each count uses the walk, the action, the dates and a random key specific to that walk and action. You can turn off these counts with Global Privacy Control or Do Not Track in your browser.</p>
        </Section>

        <Section title="Contact">
          <p>
            Found an incorrect price, route or date? Let us know through{' '}
            {CONTACT_EMAIL && (
              <>
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-white hover:text-white/80">{CONTACT_EMAIL}</a>
                {' or '}
              </>
            )}
            <a href={TELEGRAM_URL} rel="noopener" className="underline text-white hover:text-white/80">Telegram</a>.
            Please include the place and a link to the correct information.
          </p>
        </Section>
        <Link href={homeHrefFromSearch(query.toString())} className="inline-block mt-4 text-sm text-white/60 hover:text-white">
          ← Browse destinations
        </Link>
      </div>
    </div>
  )
}
