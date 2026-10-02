'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { getPhotoURL } from '@/lib/photos'

type Status = 'waiting' | 'loading' | 'ready' | 'missing' | 'broken'

/**
 * A diary photo from IndexedDB. Loads only when it scrolls near the screen (a
 * long diary doesn't open every photo at once), shows a skeleton meanwhile, a
 * quiet note if the photo isn't on this device or can't be shown, and opens
 * full size in a sheet on tap. The object URL is revoked on cleanup.
 */
export default function DiaryPhoto({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('waiting')
  const [near, setNear] = useState(false)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (near) return
    const el = holder.current
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
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])

  useEffect(() => {
    if (!near) return
    let alive = true
    let created: string | null = null
    setStatus('loading')
    setUrl(null)
    getPhotoURL(photoId)
      .then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        created = u
        setUrl(u)
        setStatus(u ? 'ready' : 'missing')
      })
      .catch(() => {
        if (alive) setStatus('missing')
      })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [photoId, near])

  if (status === 'waiting' || status === 'loading') {
    return (
      <div
        ref={holder}
        className="mt-3 aspect-[4/3] w-full animate-pulse rounded-xl bg-surface-2"
        role="img"
        aria-label="사진 불러오는 중"
      />
    )
  }

  if (status !== 'ready' || !url) {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-3">
        <Icon name="cam" className="h-4 w-4 shrink-0" />
        {status === 'broken' ? '이 사진은 이 브라우저에서 보여 줄 수 없어요.' : '이 기기에서 사진을 찾을 수 없어요.'}
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full overflow-hidden rounded-xl bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-label={`${alt} 크게 보기`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
        <img
          src={url}
          alt=""
          className="max-h-80 w-full object-cover"
          decoding="async"
          onError={() => setStatus('broken')}
        />
      </button>
      <Sheet open={open} onClose={close} title="사진">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
        <img src={url} alt={alt} className="mx-auto max-h-[70dvh] w-full rounded-xl object-contain" />
      </Sheet>
    </>
  )
}
