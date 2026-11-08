'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { WalkGuide } from '@/data/walks/types'
import { withBrowseContext } from '@/lib/browse-state'
import { readSavedWalk, updateSavedWalkStop } from '@/lib/saved-walks'
import { walkStopPath } from '@/lib/walk-links'
import StopMap from '@/components/walks/StopMap'
import WalkBreakfast from '@/components/walks/WalkBreakfast'
import WalkActions from '@/components/walks/WalkActions'
import styles from './NeighborhoodWalks.module.css'

function WalkPreview({ walk, context }: { walk: WalkGuide; context: string }) {
  const [selected, setSelected] = useState(0)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    try { setSelected((readSavedWalk(walk.slug)?.stop ?? 1) - 1) }
    catch { setSaveError('This browser couldn’t read your saved stop.') }
  }, [walk.slug])
  const selectStop = useCallback((index: number) => {
    setSelected(index)
    try { updateSavedWalkStop(walk.slug, index + 1); setSaveError('') }
    catch { setSaveError('This browser couldn’t update your saved stop.') }
  }, [walk.slug])
  const stop = walk.stops[selected]
  const foodStop = walk.food.stop
  function showOnMap(number: number) {
    selectStop(number - 1)
    document.getElementById('area-map')?.scrollIntoView({ block: 'center' })
  }

  return <div className={styles.preview} id="area-walk">
    <h3>{walk.name}</h3>
    <p className={styles.route}>{walk.cardRoute}</p>
    {walk.breakfast && <WalkBreakfast breakfast={walk.breakfast} food={walk.food} onMap={showOnMap} controls="area-map area-stop" />}
    {!walk.breakfast && <><div className={styles.food}>
      <div><p className={styles.label}>What to eat</p>
        <h4>{walk.food.name} <span lang="ko">{walk.food.nameKo}</span></h4>
      </div>
      {foodStop && <button type="button" aria-controls="area-map area-stop" onClick={() => showOnMap(foodStop)}>Find on map · {foodStop} <span aria-hidden="true">↓</span></button>}
    </div>
    <p className={styles.foodNote}>{walk.food.detail}</p></>}
    <div id="area-map" className={styles.map}>
      <StopMap stops={walk.stops} selected={selected} onSelect={selectStop} />
    </div>
    <ol className={styles.stops} aria-label={'Walking order in ' + walk.name}>
      {walk.stops.map((item, i) => <li key={item.name}>
        <button type="button" aria-pressed={i === selected} onClick={() => selectStop(i)} aria-controls="area-stop">
          <b>{i + 1}</b><span>{item.name}</span>
        </button>
      </li>)}
    </ol>
    <div className={styles.stop} id="area-stop" aria-live="polite" aria-atomic="true">
      <p className={styles.label}>{selected === 0 ? 'Start here' : 'Stop ' + (selected + 1)}</p>
      <h4>{stop.name} <span lang="ko">{stop.nameKo}</span></h4>
      <p>{stop.walk}</p><p>{stop.what}</p>
      {stop.photo && <figure className={styles.stopPhoto}>
        <Image src={stop.photo.src} alt={stop.photo.alt} width={640} height={360} sizes="(max-width: 640px) 88vw, 570px" />
        <figcaption>{stop.photo.caption && <>{stop.photo.caption} · </>}<a href={stop.photo.source} target="_blank" rel="noreferrer">{stop.photo.credit}</a> · <a href={stop.photo.licenseUrl} target="_blank" rel="noreferrer">{stop.photo.license}</a></figcaption>
      </figure>}
    </div>
    {walk.breakfast && <details className={styles.moreFood}><summary>What to eat · {walk.food.name}</summary>
      <p lang="ko">{walk.food.nameKo}</p><p>{walk.food.detail}</p>
      {foodStop && <button type="button" onClick={() => showOnMap(foodStop)}>Find on map · {foodStop} ↓</button>}
    </details>}
    <Link className={styles.fullWalk} href={withBrowseContext(walkStopPath(walk.slug, selected + 1), context)}>
      Open the {walk.name} walking guide <span aria-hidden="true">→</span>
    </Link>
    <WalkActions slug={walk.slug} walkName={walk.name} stopNumber={selected + 1} stopName={stop.name} savedHref={withBrowseContext('/saved', context)} />
    {saveError && <p className={styles.foodNote} role="alert">{saveError}</p>}
  </div>
}

export default function NeighborhoodWalks({ walks, context, city }: {
  walks: WalkGuide[]; context: string; city: string
}) {
  const area = useSearchParams().get('area')
  const active = walks.find(walk => walk.slug === area) ?? walks[0]
  const breakfastWalk = active.breakfast ? undefined : walks.find(walk => walk.breakfast)
  const choices = walks.map(walk => {
    const picturedStop = walk.stops.find(stop => stop.photo)
    return { walk, photo: picturedStop?.photo, caption: picturedStop?.photo?.caption ?? picturedStop?.name }
  })
  return <section id="neighborhoods" aria-labelledby="choose-area" className={styles.section}>
    <h2 id="choose-area">Where to walk in {city}</h2>
    {choices.length > 1 ? <nav aria-label={city + ' neighbourhoods'} className={styles.choices} style={{ gridTemplateColumns: 'repeat(' + choices.length + ', minmax(0, 1fr))' }}>
      {choices.map(({ walk, photo }) => <a key={walk.slug} className={styles.choice}
        href={withBrowseContext('/destination/' + walk.city + '?area=' + walk.slug + '#neighborhoods', context)}
        onClick={event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
          event.preventDefault()
          if (active.slug !== walk.slug) window.history.pushState(null, '', event.currentTarget.href)
        }}
        aria-current={active.slug === walk.slug ? 'true' : undefined} aria-controls="area-walk">
        {photo && <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 672px) 31vw, 207px" />}
        {active.slug === walk.slug && <b className={styles.check} aria-hidden="true">✓</b>}
        <span className={styles.caption}><strong>{walk.name}</strong><span lang="ko">{walk.nameKo}</span></span>
      </a>)}
    </nav> : choices[0].photo && <figure className={styles.banner}>
      <Image src={choices[0].photo.src} alt={choices[0].photo.alt} fill sizes="(max-width: 672px) 96vw, 640px" />
      <figcaption>{choices[0].caption}</figcaption>
    </figure>}
    {breakfastWalk?.breakfast && <Link className={styles.breakfastLink}
      href={withBrowseContext(walkStopPath(breakfastWalk.slug, breakfastWalk.breakfast.stop), context)}>
      Breakfast at {breakfastWalk.breakfast.venue} · {breakfastWalk.breakfast.hours} →
    </Link>}
    <WalkPreview key={active.slug} walk={active} context={context} />
    <details className={styles.credits}><summary>Neighbourhood photos</summary>
      <ul>{choices.map(({ walk, photo }) => photo && <li key={walk.slug}>
        {walk.name} · <a href={photo.source} target="_blank" rel="noreferrer">{photo.credit}</a>
        {' · '}<a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> · Cropped and shaded
      </li>)}</ul>
    </details>
  </section>
}
