'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { CityNeighborhoodGuide, CityPlace } from '@/data/city-neighborhoods'
import SectionTitle from './SectionTitle'
import styles from './CityNeighborhoods.module.css'

function streetMap(place: CityPlace) {
  const { lat, lng } = place
  const params = new URLSearchParams({
    bbox: [lng - 0.008, lat - 0.004, lng + 0.008, lat + 0.004].join(','),
    marker: [lat, lng].join(','),
    layer: 'mapnik',
  })
  return 'https://www.openstreetmap.org/export/embed.html?' + params
}

// North-up overview in local kilometres. Markers stay proportional even when
// one destination covers two counties. No road or walking route is implied.
function AreaOverview({ places, selected, onSelect }: {
  places: CityPlace[]
  selected: number
  onSelect: (index: number) => void
}) {
  const plot = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    if (!plot.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(plot.current)
    return () => observer.disconnect()
  }, [])
  const meanLat = places.reduce((sum, place) => sum + place.lat, 0) / places.length
  const eastScale = 111.32 * Math.cos(meanLat * Math.PI / 180)
  const east = places.map(place => place.lng * eastScale)
  const north = places.map(place => place.lat * 111.32)
  const eastMin = Math.min(...east), eastMax = Math.max(...east)
  const northMin = Math.min(...north), northMax = Math.max(...north)
  const centerX = (eastMin + eastMax) / 2, centerY = (northMin + northMax) / 2
  const scale = Math.max((eastMax - eastMin) / 70, (northMax - northMin) / 32, 0.003)
  const scaleKm = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50].filter(km => km <= 25 * scale).at(-1) ?? 0.05

  const height = width / 2
  const pins: { x: number; y: number; labelX: number; labelY: number }[] = []
  for (let i = 0; i < places.length; i++) {
    const x = width * (0.5 + (east[i] - centerX) / (100 * scale))
    const y = height * (0.5 - (north[i] - centerY) / (50 * scale))
    // For neighboring places, move only the numbered button. The dot and
    // leader line keep the geographic point visible at its real location.
    const shifts = [[0, 0], [48, 0], [-48, 0], [0, 48], [0, -48], [48, 48], [-48, -48]]
    const [dx, dy] = shifts.find(([dx, dy]) =>
      x + dx >= 21 && x + dx <= width - 21 && y + dy >= 21 && y + dy <= height - 21 &&
      pins.every(pin => Math.hypot(pin.labelX - x - dx, pin.labelY - y - dy) >= 44)
    ) ?? [0, 0]
    pins.push({ x, y, labelX: x + dx, labelY: y + dy })
  }

  return <div ref={plot} className={styles.overview} role="group" aria-label="Relative locations, north at the top">
    <svg className={styles.leaders} viewBox={'0 0 ' + width + ' ' + height} aria-hidden="true">
      {pins.map((pin, index) => <g key={index}>
        <line x1={pin.x} y1={pin.y} x2={pin.labelX} y2={pin.labelY} stroke="currentColor" strokeWidth="2" />
        <circle cx={pin.x} cy={pin.y} r="3" fill="currentColor" />
      </g>)}
    </svg>
    <span className={styles.north} aria-hidden="true">↑ N</span>
    <span className={styles.distance} style={{ width: (scaleKm / scale) + '%' }}>
      {scaleKm < 1 ? (scaleKm * 1000) + ' m' : scaleKm + ' km'}
    </span>
    {places.map((place, index) => (
      <button key={place.name} type="button"
        className={styles.pin} aria-label={place.name}
        aria-pressed={index === selected} onClick={() => onSelect(index)}
        style={{ left: (pins[index].labelX / width * 100) + '%', top: (pins[index].labelY / height * 100) + '%' }}>
        {index + 1}
      </button>
    ))}
  </div>
}

export default function CityNeighborhoods({ guide, city, food, walk }: { guide: CityNeighborhoodGuide; city: string; food: string; walk?: { name: string; href: string; placeName?: string } }) {
  const [selected, setSelected] = useState(0)
  const [overview, setOverview] = useState(false)
  const place = guide.places[selected]
  if (!place) return null

  return <section className={styles.section} id="neighborhoods" aria-labelledby="neighborhood-title">
    <SectionTitle><span id="neighborhood-title">Streets &amp; local food</span></SectionTitle>
    {walk && <Link className={styles.walkLink} href={walk.href}><span><strong>{walk.name} on foot</strong><small>Where to start, what to see and what to eat</small></span><b aria-hidden="true">→</b></Link>}
    <div className={styles.choices} role="group" aria-label={'Places in ' + city}>
      {guide.places.map((item, index) => walk?.placeName === item.name
        ? <Link key={item.name} href={walk.href} className={styles.walkChip}><span aria-hidden="true">{index + 1}</span>{item.name} →</Link>
        : <button key={item.name} type="button" aria-pressed={index === selected}
          onClick={() => setSelected(index)} aria-controls="local-place-detail">
          <span aria-hidden="true">{index + 1}</span>{item.name}
        </button>
      )}
    </div>
    <div className={styles.panel}>
      <div className={styles.mapTools} role="group" aria-label="Map view">
        <button type="button" aria-pressed={!overview} onClick={() => setOverview(false)}>Street map</button>
        <button type="button" aria-pressed={overview} onClick={() => setOverview(true)}>All places</button>
      </div>
      {overview ? <AreaOverview places={guide.places} selected={selected} onSelect={setSelected} /> :
        <iframe key={place.name} className={styles.streetMap} loading="lazy" title={'Street map of ' + place.name}
          referrerPolicy="strict-origin-when-cross-origin" src={streetMap(place)} />}
      <div className={styles.description} id="local-place-detail" aria-live="polite">
        {guide.places.map((item, index) => <div key={item.name} hidden={index !== selected}>
          <h3>{item.name} <span lang="ko">{item.nameKo}</span></h3>
          <p>{item.detail}</p>
          <a href={item.source} target="_blank" rel="noopener noreferrer">{item.name} visitor guide ↗</a>
        </div>)}
      </div>
    </div>
    <div className={styles.food}>
      <h3>What to eat</h3>
      <p>{guide.food}</p>
      <details>
        <summary>More food around {city}</summary>
        <p>{food}</p>
      </details>
    </div>
  </section>
}
