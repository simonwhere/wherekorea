import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { arrivalCards, modeLabels } from '@/data/arrival'
import { arrivalPath } from '@/lib/arrival-routes'
import { withBrowseContext, pageSearch } from '@/lib/browse-state'
import ArrivalActions from '@/components/detail/ArrivalActions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getCard(slug: string) {
  const card = arrivalCards.find(item => item.slug === slug)
  if (!card) notFound()
  return { card, city: card.slug.charAt(0).toUpperCase() + card.slug.slice(1) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { card, city } = getCard((await params).slug)
  const title = `${city} arrival card`
  const description = `From Seoul to ${card.place} and back. ${card.glance.onward}. ${card.glance.back}.`
  return { title, description, alternates: { canonical: arrivalPath(card.slug) }, openGraph: { title, description, url: arrivalPath(card.slug) } }
}

export default async function TravelCard({ params, searchParams }: Props) {
  const { card, city } = getCard((await params).slug)
  const search = pageSearch(await searchParams)
  const checked = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(card.checked))
  return <main className="arr-wrap arr-single">
    <Link className="arr-back" href={withBrowseContext('/from-seoul', search)}>← Compare routes from Seoul</Link>
    <p className="arr-kicker">ARRIVAL CARD · FROM SEOUL</p>
    <h1>{city}</h1>
    <p className="arr-subtitle">{card.place} <span lang="ko">{card.placeKo}</span></p>
    <ArrivalActions key={card.slug} slug={card.slug} city={city} place={card.place} />
    <nav aria-label="Trip directions" className="arr-shortcuts">
      <a href="#return">Return bus · stop {card.returnStop} ↓</a>
      <a href="#departures">Check departures ↓</a>
    </nav>
    <div className="arr-trip">
      <section><h2>Getting there</h2><dl>
        <div><dt>{modeLabels[card.mainMode].service} to {city}</dt><dd>{card.fromSeoul}</dd></div>
        <div><dt>{card.station} <span lang="ko">{card.stationKo}</span> → {card.place}</dt><dd>{card.onward}</dd></div>
      </dl></section>
      <section id="return"><h2>Heading back</h2><dl>
        <div><dt>{card.place} → {card.station}</dt><dd>{card.returnLocal}</dd></div>
        <div><dt>{modeLabels[card.mainMode].service} back to Seoul</dt><dd>{card.returnSeoul}</dd></div>
      </dl></section>
    </div>
    <section className="arr-check" id="departures"><h2>Check on the day</h2><p>{card.check}</p>
      <ul>{card.sources.map(source => <li key={source.url + source.label}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} <span aria-hidden>↗</span></a></li>)}</ul>
      <p className="arr-footnote">Route checked <time dateTime={card.checked}>{checked}</time>. Check times, fares and seats with the operator for your date.</p>
    </section>
    <Link className="arr-back" href={withBrowseContext(`/destination/${card.slug}`, search)}>Explore {city} →</Link>
  </main>
}
