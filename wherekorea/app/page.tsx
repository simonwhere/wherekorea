import { Suspense } from 'react'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import HomepageClient from '@/components/homepage/HomepageClient'

export const revalidate = 3600

export default async function HomePage() {
  const weatherMap = await fetchWeatherForAll(destinations)
  const enriched = applyWeather(destinations, weatherMap)
  return (
    <Suspense>
      <HomepageClient destinations={enriched} />
    </Suspense>
  )
}
