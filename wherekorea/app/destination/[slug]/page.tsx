import { notFound } from 'next/navigation'
import { destinations, getDestinationBySlug } from '@/data/destinations'
import { fetchWeatherSnapshot } from '@/lib/weather'
import HeroSummary from '@/components/detail/HeroSummary'
import WhyDestination from '@/components/detail/WhyDestination'
import BestForSkipIf from '@/components/detail/BestForSkipIf'
import AccessMovement from '@/components/detail/AccessMovement'
import WeatherBlock from '@/components/detail/WeatherBlock'
import FoodBlock from '@/components/detail/FoodBlock'
import BudgetBlock from '@/components/detail/BudgetBlock'
import SimilarDestinations from '@/components/detail/SimilarDestinations'
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

  const liveWeather = await fetchWeatherSnapshot(slug, destination.live_weather_snapshot)
  const enriched = { ...destination, live_weather_snapshot: liveWeather }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <DetailPageTracker slug={slug} />
      <HeroSummary destination={enriched} />
      <WhyDestination destination={enriched} />
      <BestForSkipIf destination={enriched} />
      <AccessMovement destination={enriched} />
      <WeatherBlock destination={enriched} />
      <FoodBlock destination={enriched} />
      <BudgetBlock destination={enriched} />
      <SimilarDestinations destination={enriched} allDestinations={destinations} />
    </div>
  )
}
