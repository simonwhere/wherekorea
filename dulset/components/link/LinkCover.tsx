'use client'

// The top of the partner page: the date and 함께한 지 D+N, the greeting with
// his name (the page's own clock picks the hour), the cover's one line when
// the snapshot carries one (a signal to answer, her 체크 완료, an anniversary —
// lib/logic/cover.heroLine wording, never a cycle word), and the couple's
// photo in the instant-photo frame — only when she opted in and this browser
// can show it (in the two-tab prototype the photo sits in the same IndexedDB;
// elsewhere the drawing shows).

import { useCallback, useEffect, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import Polaroid from '@/components/cover/Polaroid'
import { andParticle } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { usePhotoURL } from '@/components/us/usePhotoURL'
import { formatKo, weekdayKo } from '@/lib/dates'
import type { PartnerPage } from '@/lib/logic/partnerSnapshot'
import { greetingFor } from '@/lib/logic/today'
import type { ISODate } from '@/lib/types'
import { Bubble, isHer } from './bits'
import { ownerOf, viewerOf } from './model'

export default function LinkCover({
  snapshot,
  today,
  onLine,
}: {
  snapshot: PartnerPage
  today: ISODate
  /** The line is a signal to answer: scroll to the replies. */
  onLine?: () => void
}) {
  const me = viewerOf(snapshot)
  const owner = ownerOf(snapshot)
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  // The quiet weeks after a loss (the snapshot's support list): a still frame, no D+.
  const quiet = !!snapshot.moment?.support
  const decorate = !quiet
  const photo = usePhotoURL(snapshot.cover?.photoId, !!snapshot.cover && !quiet)
  const [loadedURL, setLoadedURL] = useState<string | null>(null)
  const [brokenURL, setBrokenURL] = useState<string | null>(null)
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoadedURL(img.currentSrc || img.src)
  }, [])
  const url = photo.status === 'ready' && photo.url !== brokenURL ? photo.url : null
  const shown = url !== null && loadedURL === url
  const line = snapshot.line
  const lineIsSignal = line?.kind === 'signal'

  return (
    <section aria-label="우리 표지">
      <div className="-mt-0.5 px-0.5">
        <div className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold leading-[17px] text-ink-3">
          <span>
            {formatKo(today, { weekday: false })} {weekdayKo(today)}요일
          </span>
          {snapshot.together !== null ? (
            <span>
              함께한 지
              <b className="ml-[3px] text-[13.5px] font-extrabold tabular-nums tracking-[-0.01em] text-brand-ink">
                D+{snapshot.together.toLocaleString('ko-KR')}
              </b>
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-h-9 items-center">
          <h1 className="min-w-0 flex-1 text-[20px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink outline-none">
            {greetingFor(hour)}, {me.name}님
          </h1>
        </div>
        {line ? (
          lineIsSignal && onLine ? (
            <button
              type="button"
              onClick={onLine}
              className="-my-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl text-left text-[15px] font-bold tracking-[-0.02em] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Bubble member={owner} her={isHer(owner.id, snapshot.cycleOwner)} />
              <span className="min-w-0 truncate">{line.text}</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-px text-[13px] font-bold tracking-[-0.01em] text-brand-ink">
                답하기
                <Icon name="right" className="h-[15px] w-[15px]" strokeWidth={2.2} />
              </span>
            </button>
          ) : (
            <p className="flex min-h-[30px] items-center gap-2 text-[15px] font-bold tracking-[-0.02em] text-ink">
              {line.kind === 'done' || line.kind === 'cheer' ? <Bubble member={owner} her={isHer(owner.id, snapshot.cycleOwner)} /> : null}
              <span className="min-w-0 truncate">{line.text}</span>
            </p>
          )
        ) : null}
      </div>

      <Polaroid
        className="mt-3.5"
        decorated={decorate}
        quiet={quiet}
        caption={
          <>
            <span className="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.02em] text-ink">
              {me.name}
              {decorate ? (
                <Icon
                  name="heart"
                  className="mx-[3px] inline-block h-[13px] w-[13px] fill-current align-[-1px] text-glow"
                  strokeWidth={1.5}
                />
              ) : (
                <span aria-hidden className="mx-[5px] text-ink-3">
                  ·
                </span>
              )}
              <span className="sr-only">{andParticle(me.name)} </span>
              {owner.name}
            </span>
            <span className="min-w-0 shrink-[2] truncate text-[12.5px] font-medium text-ink-3">
              {shown && snapshot.cover?.caption ? snapshot.cover.caption : `${owner.name}님의 둘셋에서 왔어요`}
            </span>
          </>
        }
      >
        {!shown ? <CoverArt tod={timeOfDay(hour)} quiet={quiet} className="absolute inset-0" /> : null}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
          <img
            ref={imgRef}
            src={url}
            alt={snapshot.cover?.caption || `${me.name}${andParticle(me.name)} ${owner.name}의 표지 사진`}
            decoding="async"
            onLoad={() => setLoadedURL(url)}
            onError={() => setBrokenURL(url)}
            className={cx(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 dark:brightness-[.86] dark:saturate-[.94]',
              shown ? 'opacity-100' : 'opacity-0',
            )}
            style={{ objectPosition: `50% ${snapshot.cover?.focusY ?? 50}%` }}
          />
        ) : null}
      </Polaroid>
    </section>
  )
}
