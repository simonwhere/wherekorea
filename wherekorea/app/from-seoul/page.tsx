import type { Metadata } from 'next'
import Link from 'next/link'
import { arrivalCards, modeLabels } from '@/data/arrival'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import { arrivalPath } from '@/lib/arrival-routes'
import { homeHrefFromSearch, withBrowseContext, pageSearch } from '@/lib/browse-state'

export const metadata: Metadata = {
  title: 'From Seoul without a car',
  description: 'Compare car-free trips from Seoul to Andong, Gyeongju, Jeonju, Sokcho, Tongyeong and Jeju. Find the local bus and the stop for the journey back.',
  alternates: { canonical: '/from-seoul' },
}

export default async function FromSeoul({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = pageSearch(await searchParams)
  return (
    <main className="arr-wrap">
      <Link className="arr-back" href={homeHrefFromSearch(search)}>← Back to your results</Link>
      <p className="arr-kicker">TRAINS · COACHES · FLIGHTS</p>
      <h1>From Seoul without a car</h1>
      <p className="arr-intro">See which local bus to take when you arrive and where to board it on the way back. Each card has the stop names in Korean and links to departures.</p>
      <div className="arr-compare">
        {arrivalCards.map(card => {
          const city = card.slug.charAt(0).toUpperCase() + card.slug.slice(1)
          return <article key={card.slug} className="arr-option">
            <header><p lang="ko">{KOREAN_NAMES[card.slug]}</p><h2>{city}</h2><span>{card.place}</span></header>
            <dl>
              <div><dt>{modeLabels[card.mainMode].service} from Seoul</dt><dd>{card.glance.fromSeoul}</dd></div>
              <div><dt>{modeLabels[card.mainMode].arrival}</dt><dd>{card.glance.onward}</dd></div>
              <div><dt>Back to Seoul · stop {card.returnStop}</dt><dd>{card.glance.back}</dd></div>
            </dl>
            <Link className="arr-link" href={withBrowseContext(arrivalPath(card.slug), search)} aria-label={`Open ${city} arrival card`}>Open arrival card <span aria-hidden>→</span></Link>
          </article>
        })}
      </div>
      <p className="arr-footnote">Check the return bus and your connecting train, coach or flight for your travel date.</p>
    </main>
  )
}
