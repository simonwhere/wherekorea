import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import WalkExplorer from '@/components/walks/WalkExplorer'
import styles from '@/components/walks/Walk.module.css'
import { walks, findWalk } from '@/data/walks'
import { getCommunityConfig } from '@/lib/community-config'
import { getDestinationBySlug } from '@/data/destinations'
import { withBrowseContext, pageSearch } from '@/lib/browse-state'

type Props = { params: Promise<{slug: string}>; searchParams: Promise<Record<string,string|string[]|undefined>> }
export const generateStaticParams = () => walks.map(({slug}) => ({slug}))

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const guide = findWalk((await params).slug)
  if (!guide) return {}
  return { title: guide.name + ' on foot', description: guide.intro, alternates: {canonical: '/walks/' + guide.slug} }
}

export default async function WalkPage({params,searchParams}: Props) {
  const guide = findWalk((await params).slug)
  if (!guide) notFound()
  const city = getDestinationBySlug(guide.city)!.name
  const context = pageSearch(await searchParams)
  return <><Header /><main className={styles.shell}>
    <Link className={styles.back} href={withBrowseContext('/destination/' + guide.city + '#neighborhoods',context)}>← Back to {city}</Link>
    <header className={styles.intro}><p className={styles.kicker}>{city} · On foot</p>
      <h1>{guide.name} <small lang="ko">{guide.nameKo}</small></h1><p>{guide.intro}</p></header>
    <WalkExplorer walk={guide} context={context} draftsOnly={!getCommunityConfig().postingEnabled} />
  </main></>
}
