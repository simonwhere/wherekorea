import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import CompareView from '@/components/compare/CompareView'
import ComparePageTracker from '@/components/compare/ComparePageTracker'
import CompareContextSync from '@/components/compare/CompareContextSync'
import Header from '@/components/layout/Header'

// Suggested matchups for the empty state — the real decisions travelers weigh
const SUGGESTED: { label: string; slugs: string[] }[] = [
  { label: 'Busan vs Jeju', slugs: ['busan', 'jeju'] },
  { label: 'Gangneung vs Sokcho', slugs: ['gangneung', 'sokcho'] },
  { label: 'Gyeongju vs Andong vs Jeonju', slugs: ['gyeongju', 'andong', 'jeonju'] },
  { label: 'Tongyeong vs Namhae vs Yeosu', slugs: ['tongyeong', 'namhae', 'yeosu'] },
  { label: 'Suwon vs Chuncheon', slugs: ['suwon', 'chuncheon'] },
]

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
      <div>
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-14">
          <CompareContextSync slugs={resolvedSlugs} />
          <h1 className="text-xl font-semibold text-white mb-2">Compare destinations</h1>
          <p className="text-sm text-white/60 mb-8">
            Pick 2–3 places with the <span className="text-white/85">+ Compare</span> button on any card — or start
            from a matchup travelers actually weigh:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {SUGGESTED.map((s) => (
              <Link
                key={s.label}
                href={`/compare?destinations=${s.slugs.join(',')}`}
                className="px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white/85 hover:border-white/35 transition-colors"
              >
                {s.label} →
              </Link>
            ))}
          </div>
          <Link href="/" className="text-sm text-white/60 hover:text-white">
            ← Browse all destinations
          </Link>
        </div>
      </div>
    )
  }

  const weatherMap = await fetchWeatherForAll(resolved)
  const enriched = applyWeather(resolved, weatherMap)

  return (
    <div>
      <Header />
      <div className="max-w-screen-lg mx-auto px-4 py-8">
        <CompareContextSync slugs={resolvedSlugs} />
        <ComparePageTracker slugs={resolvedSlugs} />
        <h1 className="text-xl font-semibold text-white mb-8">Compare</h1>
        <CompareView destinations={enriched} canonicalPath={canonicalPath} />
      </div>
    </div>
  )
}
