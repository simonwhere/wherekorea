'use client'

import { useState } from 'react'
import type { DestinationGuide } from '@/data/destination-guides'
import styles from './DestinationGuide.module.css'

/** Real, attributed photographs; no synthetic destination imagery or implied live view. */
export default function DestinationPhotoGallery({ photos, name }: { photos: DestinationGuide['photos']; name: string }) {
  const [selected, setSelected] = useState(0)
  const [failed, setFailed] = useState<string[]>([])
  const photo = photos[selected] ?? photos[0]
  if (!photo) return null
  return <section className={styles.gallery} aria-label={`${name} in pictures`}>
    <figure className={styles.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {failed.includes(photo.src) ? <div className={styles.photoFailure}><p>This photograph could not load.</p><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">View the original photograph ↗</a></div> : <img key={photo.src} src={photo.src} alt={photo.alt} className={styles.mainPhoto} decoding="async" onError={() => setFailed(previous => previous.includes(photo.src) ? previous : [...previous, photo.src])} />}
      <figcaption className={styles.caption} aria-live="polite" aria-atomic="true">
        <div className={styles.captionHeading}><strong>{photo.title}</strong><span>{selected + 1} / {photos.length}</span></div>
        <p>{photo.caption}</p>
        <details className={styles.credit}>
          <summary>Photo credit</summary>
          <p><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">{photo.credit} ↗</a> · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">Licence ↗</a>. Main photograph shown without cropping; thumbnails are cropped.</p>
        </details>
      </figcaption>
    </figure>
    <div className={styles.thumbnails} aria-label="Choose a photograph">
      {photos.map((item, index) => <button key={item.src} type="button" aria-pressed={index === selected} aria-label={`Show ${item.title}`} className={styles.thumbnail} onClick={() => setSelected(index)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt="" loading="lazy" decoding="async" style={{ objectPosition: item.objectPosition }} />
        <span>{item.title}</span>
      </button>)}
    </div>
  </section>
}
