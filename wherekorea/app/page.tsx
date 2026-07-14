import { Suspense } from 'react'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import { fetchFestivalsForAll, applyFestivals } from '@/lib/live/festivals'
import HomepageClient from '@/components/homepage/HomepageClient'

export const revalidate = 3600

export default async function HomePage() {
  const [weatherMap, festivalMap] = await Promise.all([
    fetchWeatherForAll(destinations),
    fetchFestivalsForAll(destinations),
  ])
  const enriched = applyFestivals(applyWeather(destinations, weatherMap), festivalMap)
  return (
    <Suspense>
      <HomepageClient destinations={enriched} />
    </Suspense>
  )
}
