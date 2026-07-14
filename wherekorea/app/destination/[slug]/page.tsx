import { notFound } from 'next/navigation'
import { destinations, getDestinationBySlug } from '@/data/destinations'
import { fetchWeatherSnapshot, fetchMonthlyAverage, wmoToEmoji } from '@/lib/weather'
import { fetchFestivalSignals } from '@/lib/live/festivals'
import HeroSummary from '@/components/detail/HeroSummary'
import WhyDestination from '@/components/detail/WhyDestination'
import BestForSkipIf from '@/components/detail/BestForSkipIf'
import AccessMovement from '@/components/detail/AccessMovement'
import WeatherBlock from '@/components/detail/WeatherBlock'
import WhenToGoBlock from '@/components/detail/WhenToGoBlock'
import FoodBlock from '@/components/detail/FoodBlock'
import BudgetBlock from '@/components/detail/BudgetBlock'
import InsiderTips from '@/components/detail/InsiderTips'
import SimilarDestinations from '@/components/detail/SimilarDestinations'
import Header from '@/components/layout/Header'
import DetailPageTracker from '@/components/detail/DetailPageTracker'

export const revalidate = 3600

export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function DestinationPage({ params }: Props) {
  const { slug } = await params
  const destination = getDestinationBySlug(slug)

  if (!destination) notFound()

  const currentMonth = Number(
    new Date().toLocaleString('en-US', { month: 'numeric', timeZone: 'Asia/Seoul' })
  )
  const [weather, monthlyAvg, festivals] = await Promise.all([
    fetchWeatherSnapshot(slug, destination.live_weather_snapshot),
    fetchMonthlyAverage(slug),
    fetchFestivalSignals([destination]),
  ])
  const enriched = {
    ...destination,
    live_weather_snapshot: weather.snapshot,
    live_weather_current: weather.currentTemp,
    live_weather_icon: wmoToEmoji(weather.currentCode),
    live_festivals: festivals.now[slug],
    live_festivals_upcoming: festivals.upcoming[slug],
  }

  return (
    <div>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
      <DetailPageTracker slug={slug} />
      <HeroSummary destination={enriched} currentMonth={currentMonth} />
      <WhyDestination destination={enriched} />
      <BestForSkipIf destination={enriched} />
      <WhenToGoBlock destination={enriched} currentMonth={currentMonth} />
      <AccessMovement destination={enriched} />
      <WeatherBlock destination={enriched} monthlyAvg={monthlyAvg} daily={weather.daily} />
      <FoodBlock destination={enriched} />
      <BudgetBlock destination={enriched} />
      <InsiderTips destination={enriched} />
      <SimilarDestinations destination={enriched} allDestinations={destinations} />
      </div>
    </div>
  )
}
