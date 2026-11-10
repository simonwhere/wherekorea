'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { WalkGuide } from '@/data/walks/types'
import { communityHref } from '@/lib/community'
import { withBrowseContext } from '@/lib/browse-state'
import { readSavedWalk, updateSavedWalkStop } from '@/lib/saved-walks'
import { walkStopNumber } from '@/lib/walk-links'
import WalkActions from './WalkActions'
import StopMap from './StopMap'
import WalkBreakfast from './WalkBreakfast'
import styles from './Walk.module.css'

export default function WalkExplorer({ walk, context, draftsOnly, initialStop, mapFirst }: { walk: WalkGuide; context: string; draftsOnly: boolean; initialStop?: number; mapFirst?: boolean }) {
  const [selected, setSelected] = useState((initialStop ?? 1) - 1)
  const [saveError, setSaveError] = useState('')
  const { slug, stops } = walk
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(location.search)
      const values = params.getAll('stop')
      const stop = values.length === 1 ? walkStopNumber(values[0], stops.length) : undefined
      if (params.has('stop')) { setSelected((stop ?? 1) - 1); return }
      try { setSelected((readSavedWalk(slug)?.stop ?? 1) - 1) }
      catch { setSelected(0) }
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [slug, stops.length])
  const select = useCallback((index: number) => {
    setSelected(index)
    const url = new URL(location.href)
    url.searchParams.set('stop', String(index + 1))
    window.history.replaceState(null, '', url)
    try { updateSavedWalkStop(slug, index + 1); setSaveError('') }
    catch { setSaveError('Your saved stop couldn’t be updated in this browser.') }
  }, [slug])
  const stop = walk.stops[selected]
  const picturedStop = stop.photo ? stop : stops.find(item => item.photo)
  const photo = picturedStop?.photo
  const meetup = communityHref('/community/new?walk=' + walk.slug + '&stop=' + (selected + 1), context, { type: 'meetups', city: walk.city })
  const map = <StopMap stops={walk.stops} selected={selected} onSelect={select} />
  const stopButtons = <nav aria-label="Stops on this walk" className={styles.stops}>
    {walk.stops.map((item, i) => <button key={item.name} type="button" aria-pressed={i === selected}
      aria-controls="walk-stop walk-map" onClick={() => select(i)}><span>{i + 1}</span>{item.name}</button>)}
  </nav>
  const walkActions = <WalkActions slug={slug} walkName={walk.name} stopNumber={selected + 1} stopName={stop.name} savedHref={withBrowseContext('/saved', context)} />
  return <>
    {mapFirst && <section className={styles.routeMap} id="walk-map" aria-label={walk.name + ' walking map'} tabIndex={-1}>
      <h2>{walk.name} <small>· Walking map</small></h2>
      {map}
      <p className={styles.mapPlace} aria-live="polite">Stop {selected + 1} · {stop.name} <span lang="ko">{stop.nameKo}</span></p>
      {stopButtons}
      {walkActions}
    </section>}
    {walk.breakfast && <WalkBreakfast breakfast={walk.breakfast} food={walk.food} controls="walk-map walk-stop" onMap={number => {
      select(number - 1)
      requestAnimationFrame(() => document.getElementById('walk-map')?.scrollIntoView({ block: 'center' }))
    }} />}
    {!mapFirst && <>{stopButtons}{walkActions}</>}
    {saveError && <p role="alert">{saveError}</p>}
    <section id="walk-stop" className={styles.card}>
      <div className={styles.stopInfo} aria-live="polite">
        <p className={styles.kicker}>{selected === 0 ? 'Start here' : 'Stop ' + (selected + 1)}</p>
        <h2>{stop.name} <small lang="ko">{stop.nameKo}</small></h2>
        <p>{stop.walk}</p>
        <p>{stop.what}</p>
      </div>
      <div className={styles.visuals} data-has-photo={Boolean(photo)} data-map-first={Boolean(mapFirst)}>
        {photo && <figure>
          <div className={styles.photo}>
            <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 640px) 100vw, 420px" priority={selected === 0} />
          </div>
          <figcaption>{!stop.photo && 'On this walk · '}{photo.caption ?? picturedStop?.name}</figcaption>
          <details className={styles.credit}><summary>Photo credit</summary><a href={photo.source} target="_blank" rel="noreferrer">{photo.credit}</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> · Cropped to fit</details>
        </figure>}
        {!mapFirst && <div id="walk-map">{map}</div>}
      </div>
    </section>
    <div className={styles.food}>
      <p className={styles.kicker}>What to order</p>
      <h2>{walk.food.name} <small lang="ko">{walk.food.nameKo}</small></h2>
      <p>{walk.food.detail}</p>
    </div>
    <div className={styles.buddy}><div><h2>Walk together</h2><p>{draftsOnly ? 'Public posting is closed. You can save your plan on this browser.' : `Suggest a walk or a meal in ${walk.name}.`}</p></div>
      <Link href={meetup}>{draftsOnly ? 'Draft a meetup' : 'Write a meetup post'} →</Link></div>
    <details className={styles.sources}><summary>Visitor information</summary><ul>{walk.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></li>)}</ul></details>
  </>
}
