import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import WalkExplorer from '@/components/walks/WalkExplorer'
import styles from '@/components/walks/Walk.module.css'
import { walks, findWalk } from '@/data/walks'
import { walkStopNumber, walkStopPath } from '@/lib/walk-links'
import { getCommunityConfig } from '@/lib/community-config'
import { getDestinationBySlug } from '@/data/destinations'
import { withBrowseContext, homeHrefFromSearch, pageSearch } from '@/lib/browse-state'

type Props = { params: Promise<{slug: string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }
export const generateStaticParams = () => walks.map(({slug}) => ({slug}))

export async function generateMetadata({params,searchParams}: Props): Promise<Metadata> {
  const guide = findWalk((await params).slug)
  if (!guide) return {}
  const number = walkStopNumber((await searchParams).stop, guide.stops.length)
  const stop = number ? guide.stops[number - 1] : undefined
  const title = stop ? guide.name + ' · ' + stop.name : guide.name + ' on foot'
  const description = stop?.walk ?? guide.intro
  const path = '/walks/' + guide.slug
  return { title, description, alternates: { canonical: path }, openGraph: {
    title, description, url: number ? walkStopPath(guide.slug, number) : path,
    ...(stop?.photo ? { images: [{ url: stop.photo.src, alt: stop.photo.alt }] } : {}),
  } }
}

export default async function WalkPage({params,searchParams}: Props) {
  const guide = findWalk((await params).slug)
  if (!guide) notFound()
  const city = getDestinationBySlug(guide.city)!.name
  const query = await searchParams
  const initialStop = walkStopNumber(query.stop, guide.stops.length)
  const context = pageSearch(query)
  const fromExplore = query.from === 'explore'
  return <><Header /><main className={styles.shell}>
    <Link className={styles.back} href={fromExplore ? homeHrefFromSearch(context) : withBrowseContext('/destination/' + guide.city + '#neighborhoods', context)}>
      ← {fromExplore ? 'Back to places' : 'Back to ' + city}
    </Link>
    <header className={styles.intro}><p className={styles.kicker}>{city} · On foot</p>
      <h1>{guide.name} <small lang="ko">{guide.nameKo}</small></h1><p>{guide.intro}</p></header>
    <WalkExplorer key={guide.slug + (initialStop ?? 0)} initialStop={initialStop} walk={guide} context={context} draftsOnly={!getCommunityConfig().postingEnabled} />
  </main></>
}
