import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { fetchWeatherForAll, applyWeather } from '@/lib/weather'
import { compareSlugsFromParam } from '@/lib/compare-state'
import { comparisonHref } from '@/lib/compare-navigation'
import { parseBrowseState, homeHrefFromSearch, withBrowseContext, pageSearch } from '@/lib/browse-state'
import { hasArrivalCard } from '@/lib/arrival-routes'
import CompareView from '@/components/compare/CompareView'
import ComparePageTracker from '@/components/compare/ComparePageTracker'
import CompareContextSync from '@/components/compare/CompareContextSync'
import Header from '@/components/layout/Header'

const SUGGESTED = [
  { label: 'Busan vs Jeju', slugs: ['busan', 'jeju'], note: 'City beaches and markets · volcanic coast and island roads' },
  { label: 'Gangneung vs Sokcho', slugs: ['gangneung', 'sokcho'], note: 'Beach cafés · Seoraksan and the fishing harbour' },
  { label: 'Gyeongju vs Andong vs Jeonju', slugs: ['gyeongju', 'andong', 'jeonju'], note: 'Silla sites · Hahoe Village · hanok streets and food' },
  { label: 'Tongyeong vs Namhae vs Yeosu', slugs: ['tongyeong', 'namhae', 'yeosu'], note: 'Southern harbours, islands and coastal roads' },
  { label: 'Suwon vs Chuncheon', slugs: ['suwon', 'chuncheon'], note: 'Hwaseong Fortress · lakes and dakgalbi' },
]

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ComparePage({ searchParams }: Props) {
  const raw = await searchParams
  const params = new URLSearchParams(pageSearch(raw))
  const browse = parseBrowseState(params)
  const resolvedSlugs = compareSlugsFromParam(raw.destinations, destinations.map((d) => d.slug))
  const resolved = (resolvedSlugs ?? []).flatMap((slug) => destinations.filter((d) => d.slug === slug))
  const canonicalPath = comparisonHref(resolvedSlugs ?? [], params.toString())
  const homeHref = homeHrefFromSearch(params.toString())
  const routeLink = <Link className="wk-arrival-entry" href={withBrowseContext('/from-seoul', params.toString())}>From Seoul without a car · Compare arrival and return routes →</Link>

  if (resolved.length < 2) {
    return (
      <div style={{ minHeight: '100vh', background: '#13171e' }}>
        <Header />
        <main className="max-w-3xl mx-auto px-5 py-10 pb-32">
          <CompareContextSync slugs={resolvedSlugs} />
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#ff936b' }}>Compare</p>
          <h1 className="text-3xl font-semibold text-white mb-3">Places, side by side.</h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#b8c2cf' }}>
            {resolved.length === 1
              ? `${resolved[0].name} is selected. Add one more destination to compare.`
              : 'Choose 2–3 destinations to compare travel time, cost, seasons and highlights.'}
          </p>
          <Link href={homeHref} className="inline-block rounded-lg px-5 py-3 text-sm font-semibold mb-9" style={{ background: '#ff936b', color: '#13171e' }}>
            {resolved.length === 1 ? 'Add another destination →' : 'Choose destinations →'}
          </Link>
          <h2 className="text-base font-semibold text-white mb-4">Compare these places</h2>
          {routeLink}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUGGESTED.map((s) => (
              <Link key={s.label} href={comparisonHref(s.slugs, params.toString())}
                className="p-4 rounded-xl border border-white/15 hover:border-orange-300/60 transition-colors" style={{ background: '#1d2530' }}>
                <span className="block text-sm font-semibold text-white">{s.label} →</span>
                <span className="block mt-2 text-xs leading-relaxed" style={{ color: '#b8c2cf' }}>{s.note}</span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // A planned month is a seasonal comparison, never a live-weather forecast.
  const enriched = browse.mode === 'now'
    ? applyWeather(resolved, await fetchWeatherForAll(resolved))
    : resolved

  return (
    <div style={{ minHeight: '100vh', background: '#13171e' }}>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 pb-32">
        <CompareContextSync slugs={resolvedSlugs} />
        <ComparePageTracker slugs={resolvedSlugs ?? []} />
        {resolved.some(d => hasArrivalCard(d.slug)) && routeLink}
        <CompareView destinations={enriched} canonicalPath={canonicalPath} browse={browse} homeHref={homeHref} />
      </main>
    </div>
  )
}
