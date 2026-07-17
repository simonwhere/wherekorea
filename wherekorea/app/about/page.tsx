import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { KRW_PER_USD } from '@/lib/currency'

export const metadata: Metadata = {
  title: 'About & data methodology — WhereKorea',
  description:
    'What WhereKorea is, who it is for, and exactly where every number comes from: weather, visitor volumes, festivals, budgets, and crowd levels.',
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

export default function AboutPage() {
  return (
    <div>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-white mb-2">About WhereKorea</h1>
        <p className="text-base text-white/70 leading-relaxed mb-4">
          WhereKorea answers one question: <em>where in Korea should I go right now?</em> It is a
          decision tool, not a travel blog — every destination is described with the same
          controlled vocabulary so you can compare honestly, and the &ldquo;Best now&rdquo; ranking
          moves with real seasonal and live data.
        </p>
        <p className="text-sm text-white/60 leading-relaxed">
          Built for first-time and returning visitors planning a 1–2 week trip — typically Seoul
          plus two or three other places. No bookings, no ads, no sponsored placements.
        </p>

        <Section title="How the ranking works">
          <p>
            &ldquo;Best now&rdquo; = year-round appeal (editorial, 1–10) + season fit (is this
            genuinely a good month?) + live weather comfort. Crowds and festivals are shown as
            information but <strong>never</strong> move the ranking — busy can mean wonderful, and
            only you know which way that cuts.
          </p>
        </Section>

        <Section title="Where the numbers come from">
          <p>
            <strong>Weather</strong> — live conditions and 7-day forecasts from{' '}
            <a className="underline text-white" href="https://open-meteo.com" rel="noopener">Open-Meteo</a>,
            refreshed hourly. Monthly averages use last year&apos;s archive for the same month.
          </p>
          <p>
            <strong>Crowd seasonality</strong> — monthly visitor volumes per destination from the
            Korea Tourism Organization&apos;s visitor data (KT/SKT mobile-network counts,
            non-local and foreign visitors, 12-month sample). Peak-month markers on every timing
            strip come from this data, not guesses.
          </p>
          <p>
            <strong>Festivals</strong> — Korea Tourism Organization TourAPI, matched to each
            destination by coordinates and refreshed daily.
          </p>
          <p>
            <strong>Budgets</strong> — the ₩/day figure is a mid-range traveler&apos;s all-in day:
            per person, two people sharing one mid-range room, including lodging, meals, local
            transport and light activities; excluding intercity travel, flights and shopping.
            USD figures are approximations at ₩{KRW_PER_USD.toLocaleString()}/$.
          </p>
          <p>
            <strong>Editorial fields</strong> — &ldquo;best for / skip if&rdquo;, insider tips and
            best months are written and maintained by us, destination by destination. Every metric
            carries internal source and confidence metadata, re-verified on a dated schedule.
          </p>
        </Section>

        <Section title="What WhereKorea is not">
          <p>
            Not a booking site, not a review community, not an itinerary planner, and not an
            exhaustive directory. Fifteen destinations, curated — depth over coverage.
          </p>
        </Section>

        <p className="text-xs text-white/55 mt-6">
          Spotted something off?{' '}
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_URL ?? 'https://t.me/wherekorea'}
            rel="noopener"
            className="underline text-white/85 hover:text-white"
          >
            Tell us on Telegram
          </a>{' '}
          — we want the numbers to be right.
        </p>
        <Link href="/" className="inline-block mt-4 text-sm text-white/60 hover:text-white">
          ← Browse destinations
        </Link>
      </div>
    </div>
  )
}
