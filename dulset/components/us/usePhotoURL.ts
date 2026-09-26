'use client'

import { useEffect, useRef, useState } from 'react'
import { getPhotoURL } from '@/lib/photos'

/**
 * true once the element has come within `rootMargin` of the screen (then
 * stays true). Without IntersectionObserver it is true right away.
 */
export function useNearScreen<T extends Element>(rootMargin = '400px 0px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near, rootMargin])
  return [ref, near]
}

export type PhotoStatus = 'idle' | 'loading' | 'ready' | 'missing'

/**
 * Object URL of a diary photo from IndexedDB, loaded only while `enabled`.
 * The URL is revoked when the photo changes or the component unmounts.
 */
export function usePhotoURL(photoId: string | undefined, enabled = true): { url: string | null; status: PhotoStatus } {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!enabled || !photoId) return
    let alive = true
    let created: string | null = null
    getPhotoURL(photoId)
      .then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        created = u
        setLoaded({ id: photoId, url: u })
      })
      .catch(() => {
        if (alive) setLoaded({ id: photoId, url: null })
      })
    return () => {
      alive = false
      if (created) {
        const gone = created
        URL.revokeObjectURL(gone)
        // Never render a revoked URL if the same photo is asked for again.
        setLoaded((prev) => (prev?.url === gone ? null : prev))
      }
    }
  }, [photoId, enabled])

  if (!enabled || !photoId) return { url: null, status: 'idle' }
  // A result for a previous photo (the viewer moved on) counts as still loading.
  if (!loaded || loaded.id !== photoId) return { url: null, status: 'loading' }
  return loaded.url ? { url: loaded.url, status: 'ready' } : { url: null, status: 'missing' }
}
