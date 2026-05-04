import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import CompareView from '@/components/compare/CompareView'
import ComparePageTracker from '@/components/compare/ComparePageTracker'
import CompareContextSync from '@/components/compare/CompareContextSync'

interface Props {
  searchParams: Promise<{ destinations?: string }>
}

export default async function ComparePage({ searchParams }: Props) {
  const { destinations: param } = await searchParams

  const rawSlugs = param ? param.split(',') : []
  const uniqueSlugs = [...new Set(rawSlugs)]
  const resolved = uniqueSlugs
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)
    .slice(0, 3)

  const resolvedSlugs = resolved.map((d) => d.slug)
  const canonicalPath = resolvedSlugs.length > 0
    ? `/compare?destinations=${resolvedSlugs.join(',')}`
    : '/compare'

  if (resolved.length < 2) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <CompareContextSync slugs={resolvedSlugs} />
        <p className="text-sm text-gray-500 mb-4">
          Select 2 or 3 destinations to compare them side by side.
        </p>
        <Link href="/" className="text-sm text-gray-900 underline">
          Browse destinations
        </Link>
      </div>
    )
  }

  const weatherMap = await fetchWeatherForAll(resolved)
  const enriched = applyWeather(resolved, weatherMap)

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8">
      <CompareContextSync slugs={resolvedSlugs} />
      <ComparePageTracker slugs={resolvedSlugs} />
      <h1 className="text-xl font-semibold text-gray-900 mb-8">Compare</h1>
      <CompareView destinations={enriched} canonicalPath={canonicalPath} />
    </div>
  )
}
