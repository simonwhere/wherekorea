import type { Metadata } from 'next'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import { fetchFestivalDataForAll, applyFestivals } from '@/lib/live/festivals'
import type { FestivalDataStatus } from '@/lib/live/status'
import HomepageClient from '@/components/homepage/HomepageClient'
import { currentKoreaMonth, parseBrowseState } from '@/lib/browse-state'

export const revalidate = 3600

export const metadata: Metadata = { alternates: { canonical: '/' } }

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function HomePage({ searchParams }: Props) {
  const query = await searchParams
  const nowMonth = currentKoreaMonth()
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, entry)
    }
  }
  const browse = parseBrowseState(params, nowMonth)
  const requestedSlug = first(query.destination)
  const selectedSlug = destinations.some((destination) => destination.slug === requestedSlug)
    ? requestedSlug ?? null : null

  let enriched = destinations
  let festivalStatus: FestivalDataStatus | undefined
  if (browse.mode === 'now') {
    const [weatherMap, festivalMap] = await Promise.all([
      fetchWeatherForAll(destinations),
      fetchFestivalDataForAll(destinations),
    ])
    enriched = applyFestivals(applyWeather(destinations, weatherMap), festivalMap.data)
    festivalStatus = festivalMap.status
  }
  return <HomepageClient destinations={enriched} selectedSlug={selectedSlug} month={browse.month} nowMonth={nowMonth} browse={browse} festivalStatus={festivalStatus} />
}
