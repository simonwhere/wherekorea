'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { WalkGuide } from '@/data/walks/types'
import { communityHref } from '@/lib/community'
import StopMap from './StopMap'
import styles from './Walk.module.css'

export default function WalkExplorer({ walk, context, draftsOnly }: { walk: WalkGuide; context: string; draftsOnly: boolean }) {
  const [selected, setSelected] = useState(0)
  const stop = walk.stops[selected]
  const photo = stop.photo
  const meetup = communityHref('/community/new?walk=' + walk.slug + '&stop=' + (selected + 1), context, { type: 'meetups', city: walk.city })
  return <>
    <nav aria-label="Stops on this walk" className={styles.stops}>
      {walk.stops.map((item, i) => <button key={item.name} type="button" aria-pressed={i === selected}
        aria-controls="walk-stop" onClick={() => setSelected(i)}><span>{i + 1}</span>{item.name}</button>)}
    </nav>
    <section id="walk-stop" className={styles.card}>
      <div className={styles.stopInfo} aria-live="polite">
        <p className={styles.kicker}>{selected === 0 ? 'Start here' : 'Stop ' + (selected + 1)}</p>
        <h2>{stop.name} <small lang="ko">{stop.nameKo}</small></h2>
        <p>{stop.walk}</p>
        <p>{stop.what}</p>
      </div>
      <div className={styles.visuals} data-has-photo={Boolean(photo)}>
        {photo && <figure>
          <div className={styles.photo}>
            <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 640px) 100vw, 420px" priority={selected === 0} />
          </div>
          <figcaption>{stop.name}</figcaption>
          <details className={styles.credit}><summary>Photo credit</summary><a href={photo.source} target="_blank" rel="noreferrer">{photo.credit}</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> · Cropped to fit</details>
        </figure>}
        <StopMap stops={walk.stops} selected={selected} onSelect={setSelected} />
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
