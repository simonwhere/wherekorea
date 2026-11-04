import type { Metadata } from 'next'
import Link from 'next/link'
import { arrivalCards } from '@/data/arrival'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import { arrivalPath } from '@/lib/arrival-routes'
import { homeHrefFromSearch, withBrowseContext, pageSearch } from '@/lib/browse-state'

export const metadata: Metadata = {
  title: 'From Seoul without a car',
  description: 'Compare trains, local buses and the trip back from Hahoe Village, Hwangnidan-gil and Jeonju Hanok Village.',
  alternates: { canonical: '/from-seoul' },
}

export default async function FromSeoul({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = pageSearch(await searchParams)
  return (
    <main className="arr-wrap">
      <Link className="arr-back" href={homeHrefFromSearch(search)}>← Back to your results</Link>
      <p className="arr-kicker">RAIL + LOCAL BUS</p>
      <h1>From Seoul without a car</h1>
      <p className="arr-intro">Compare the ride from each station into town and the way back to Seoul. Open a city’s card for both bus stops and departure lookups.</p>
      <div className="arr-compare">
        {arrivalCards.map(card => {
          const city = card.slug.charAt(0).toUpperCase() + card.slug.slice(1)
          return <article key={card.slug} className="arr-option">
            <header><p lang="ko">{KOREAN_NAMES[card.slug]}</p><h2>{city}</h2><span>{card.place}</span></header>
            <dl>
              <div><dt>Train from Seoul</dt><dd>{card.glance.rail}</dd></div>
              <div><dt>From the station</dt><dd>{card.glance.onward}</dd></div>
              <div><dt>Back to Seoul · stop {card.returnStop}</dt><dd>{card.glance.back}</dd></div>
            </dl>
            <Link className="arr-link" href={withBrowseContext(arrivalPath(card.slug), search)} aria-label={`Open ${city} arrival card`}>Open arrival card <span aria-hidden>→</span></Link>
          </article>
        })}
      </div>
      <p className="arr-footnote">Each route covers one neighbourhood or village. Check both train departures and the bus back for your travel date.</p>
    </main>
  )
}
