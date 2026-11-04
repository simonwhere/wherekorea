import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { destinations, getDestinationBySlug } from '@/data/destinations'
import { fetchWeatherSnapshot, fetchMonthlyAverage, wmoToEmoji, COORDS } from '@/lib/weather'
import { KOREAN_NAMES, DAILY_AVG } from '@/data/destinations-meta'
import { usdApprox } from '@/lib/currency'
import { MONTH_SHORT } from '@/lib/crowd'
import { SITE_NAME, absUrl } from '@/lib/site'
import { fetchFestivalData } from '@/lib/live/festivals'
import HeroSummary from '@/components/detail/HeroSummary'
import BestForSkipIf from '@/components/detail/BestForSkipIf'
import AccessMovement from '@/components/detail/AccessMovement'
import WeatherBlock from '@/components/detail/WeatherBlock'
import WhenToGoBlock from '@/components/detail/WhenToGoBlock'
import DontMiss from '@/components/detail/DontMiss'
import FoodBlock from '@/components/detail/FoodBlock'
import CityNeighborhoods from '@/components/detail/CityNeighborhoods'
import { cityNeighborhoods } from '@/data/city-neighborhoods'
import BudgetBlock from '@/components/detail/BudgetBlock'
import InsiderTips from '@/components/detail/InsiderTips'
import SimilarDestinations from '@/components/detail/SimilarDestinations'
import Header from '@/components/layout/Header'
import DetailPageTracker from '@/components/detail/DetailPageTracker'
import UsefulLinks from '@/components/detail/UsefulLinks'
import TravelReality from '@/components/detail/TravelReality'
import LiveDataNotice from '@/components/shared/LiveDataNotice'
import BudgetFitNote from '@/components/shared/BudgetFitNote'
import DestinationCommunity from '@/components/community/DestinationCommunity'
import { parseBrowseState, browseHref, withBrowseContext, homeHrefFromSearch } from '@/lib/browse-state'
import { getDestinationGuide } from '@/data/destination-guides'
import { DestinationOrientation, DestinationQuestions } from '@/components/detail/DestinationGuideSections'

export const revalidate = 3600

export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }))
}

// Compact month list: [4,5,6,9,10,11] → "Apr–Jun, Sep–Nov"
function monthRanges(months: number[]): string {
  const sorted = [...months].sort((a, b) => a - b)
  const out: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    out.push(i === j ? MONTH_SHORT[sorted[i] - 1] : `${MONTH_SHORT[sorted[i] - 1]}–${MONTH_SHORT[sorted[j] - 1]}`)
    i = j + 1
  }
  return out.join(', ')
}

function clip(s: string, max = 158): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

// S1 — per-destination title/description/canonical. Numbers first (exclusive-data lead).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const d = getDestinationBySlug(slug)
  if (!d) return {}
  const perDay = DAILY_AVG[d.slug] ?? d.card_budget_level
  const usd = usdApprox(perDay) ?? perDay
  const fromSeoul = d.travel_time.from_seoul.replace(/^~/, '')
  // ~55 chars before the site-name template — Google clips titles around 60.
  const title = `${d.name}: best months, cost & how to get there`
  const description = clip(
    `${d.name} (${KOREAN_NAMES[d.slug] ?? ''}): ${d.card_vibe}. Best months ${monthRanges(d.best_months)}. ` +
    `About ${usd}/day${fromSeoul && fromSeoul !== '—' ? `, ${fromSeoul} from Seoul` : ''}. ${d.best_for}`
  )
  return {
    title,
    description,
    alternates: { canonical: `/destination/${d.slug}` },
    openGraph: { title: `${d.name} — ${SITE_NAME}`, description, url: absUrl(`/destination/${d.slug}`), type: 'article' },
  }
}

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DestinationPage({ params, searchParams }: Props) {
  const { slug } = await params
  const destination = getDestinationBySlug(slug)

  if (!destination) notFound()
  const guide = getDestinationGuide(slug)
  const neighborhoods = cityNeighborhoods[slug]

  const currentMonth = Number(
    new Date().toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' })
  )
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value)
    else if (value) value.forEach((item) => query.append(key, item))
  }
  const browse = parseBrowseState(query, currentMonth)
  const contextSearch = query.toString()
  const sharePath = withBrowseContext(browseHref(browse, `/destination/${slug}`), contextSearch)
  const showLive = browse.mode === 'now' && browse.month === currentMonth
  // Planning pages do not need live requests; their source is seasonal/editorial.
  const [weather, monthlyAvg, festivals] = showLive ? await Promise.all([
    fetchWeatherSnapshot(slug, destination.live_weather_snapshot),
    fetchMonthlyAverage(slug),
    fetchFestivalData([destination]),
  ]) : [null, null, null]
  const enriched = {
    ...destination,
    live_weather_snapshot: weather?.snapshot ?? destination.live_weather_snapshot,
    live_weather_current: weather?.currentTemp,
    live_weather_icon: weather ? wmoToEmoji(weather.currentCode) : undefined,
    live_weather_code: weather?.currentCode,
    live_weather_is_live: weather?.isLive ?? false,
    live_festivals: festivals?.data.now[slug],
    live_festivals_upcoming: festivals?.data.upcoming[slug],
  }

  // GEO — structured data so AI/search engines can cite the destination with its facts.
  const coords = COORDS[slug]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination.name,
    alternateName: KOREAN_NAMES[slug],
    description: destination.hero_summary,
    url: absUrl(`/destination/${slug}`),
    image: destination.image.src,
    touristType: destination.tags,
    containedInPlace: { '@type': 'Country', name: 'South Korea' },
    ...(coords ? { geo: { '@type': 'GeoCoordinates', latitude: coords.lat, longitude: coords.lon } } : {}),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absUrl('/') },
  }

  return (
    <div>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-2xl mx-auto px-4 py-8">
      <DetailPageTracker slug={slug} />
      <HeroSummary destination={enriched} currentMonth={browse.month} browse={browse} showLive={showLive} backHref={homeHrefFromSearch(contextSearch)} sharePath={sharePath} />
      <BudgetFitNote slug={slug} browse={browse} />
      {festivals && <LiveDataNotice status={festivals.status} />}
      {neighborhoods && <CityNeighborhoods key={slug} city={destination.name} guide={neighborhoods} food={destination.food} />}
      <BestForSkipIf destination={enriched} />
      <DontMiss destination={enriched} />
      {!guide && <DestinationCommunity slug={slug} name={destination.name} contextSearch={contextSearch} />}
      <WhenToGoBlock destination={enriched} currentMonth={browse.month} showLive={showLive} />
      <AccessMovement destination={enriched} hasLocalGuide={Boolean(guide)} />
      {guide ? <DestinationOrientation guide={guide} /> : <TravelReality slug={slug} />}
      {guide && <DestinationQuestions guide={guide} name={destination.name} contextSearch={contextSearch} />}
      {guide && <DestinationCommunity slug={slug} name={destination.name} contextSearch={contextSearch} />}
      <WeatherBlock destination={enriched} monthlyAvg={monthlyAvg} daily={weather?.daily} showLive={showLive} month={browse.month} />
      {!neighborhoods && <FoodBlock destination={enriched} />}
      <BudgetBlock destination={enriched} />
      <InsiderTips destination={enriched} />
      <UsefulLinks destination={enriched} />
      <SimilarDestinations destination={enriched} allDestinations={destinations} browse={browse} contextSearch={contextSearch} />
      </div>
    </div>
  )
}
