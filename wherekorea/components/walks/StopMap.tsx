'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as StreetMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { WalkStop } from '@/data/walks/types'
import styles from './Walk.module.css'

export default function StopMap({ stops, selected, onSelect }: {
  stops: Pick<WalkStop, 'name' | 'lat' | 'lng'>[]; selected: number; onSelect: (index: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const markers = useRef<Marker[]>([])
  const currentMap = useRef<StreetMap | null>(null)
  const active = useRef(selected)
  const [error, setError] = useState(false)

  useEffect(() => {
    active.current = selected
    const point = markers.current[selected]?.getLatLng()
    if (point && currentMap.current && !currentMap.current.getBounds().pad(-0.08).contains(point)) {
      currentMap.current.panTo(point, { animate: false })
    }
    for (const [i, marker] of markers.current.entries()) {
      const node = marker.getElement()
      node?.setAttribute('aria-pressed', String(i === selected))
      marker.setZIndexOffset(i === selected ? 1000 : 0)
    }
  }, [selected])

  useEffect(() => {
    let cancelled = false
    let map: StreetMap | undefined
    let resize: ResizeObserver | undefined
    import('leaflet').then(L => {
      if (cancelled || !container.current) return
      const points = stops.map(({ lat, lng }): [number, number] => [lat, lng])
      const bounds = L.latLngBounds(points)
      map = L.map(container.current, { scrollWheelZoom: false, zoomSnap: 0.25 })
      currentMap.current = map
      map.fitBounds(bounds, { padding: [30, 28], maxZoom: 17 })
      const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
      layer.on('tileerror', () => { if (!cancelled) setError(true) })
      markers.current = stops.map((stop, index) => {
        const marker = L.marker(points[index], {
          title: stop.name, alt: stop.name,
          icon: L.divIcon({ className: styles.marker, html: String(index + 1), iconSize: [32, 32], iconAnchor: [16, 16] }),
        }).addTo(map!)
        marker.on('click', () => onSelect(index))
        const el = marker.getElement()
        el?.setAttribute('aria-label', (index + 1) + '. ' + stop.name)
        el?.setAttribute('aria-pressed', String(active.current === index))
        marker.setZIndexOffset(active.current === index ? 1000 : 0)
        return marker
      })
      resize = new ResizeObserver(() => map?.invalidateSize())
      resize.observe(container.current)
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; resize?.disconnect(); map?.remove(); currentMap.current = null; markers.current = [] }
  }, [stops, onSelect])

  return <div className={styles.mapBox}>
    <div ref={container} className={styles.map} role="region" aria-label="Street map with numbered stops" />
    {error && <p className={styles.mapError} role="status">Some map details couldn’t load. Use the numbered stops for directions.</p>}
  </div>
}
