'use client'

// The top of the preparing home: "우리 표지". The date and 함께한 지 D+N, one
// line (a signal to answer, the partner's news, an anniversary or a greeting —
// lib/logic/cover.heroLine, never cycle words), and the couple's photo in an
// instant-photo frame. Without a photo, a small drawn landscape for the time of
// day with "우리 사진 걸기". The cover never follows the cycle phase. In the
// quiet weeks after a loss it stands still: no tilt, tape, heart or D+, and a
// photo hung after the (ended) pregnancy was confirmed waits behind the drawing
// until this person chooses.

import { useCallback, useEffect, useState } from 'react'
import type { TabKey } from '@/components/AppShell'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import CoverSheet from '@/components/cover/CoverSheet'
import Polaroid from '@/components/cover/Polaroid'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { usePhotoURL } from '@/components/us/usePhotoURL'
import { formatKo, weekdayKo } from '@/lib/dates'
import { coverView, heroLine, setHideCover } from '@/lib/logic/cover'
import { useApp } from '@/lib/store'
import { MemberBubble, andParticle } from './bits'

/** Where "답하기" lands: the reply chips in 우리 한 줄 (or its first control). */
function goToUsLine() {
  const section = document.getElementById('us-line')
  if (!section) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  const target =
    section.querySelector<HTMLElement>('[data-reply]:not([disabled])') ??
    section.querySelector<HTMLElement>('button:not([disabled])')
  target?.focus({ preventScroll: true })
}

const captionButton =
  'relative -mr-1 flex h-11 shrink-0 items-center px-1 text-[12.5px] font-bold text-ink-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export default function CoverHero({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { state, update, today, me, partner } = useApp()
  // The clock hour only picks the line's greeting and the drawing's palette;
  // date logic always uses `today`.
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  const view = coverView(state, me.id, today)
  const line = heroLine(state, today, me.id, hour)
  const photo = usePhotoURL(view.photo?.photoId, view.mode === 'photo')

  // Fade the photo in once it has decoded; an unreadable file counts as missing.
  const [loadedURL, setLoadedURL] = useState<string | null>(null)
  const [brokenURL, setBrokenURL] = useState<string | null>(null)
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) setLoadedURL(img.currentSrc || img.src)
    },
    [],
  )
  const url = photo.status === 'ready' && photo.url !== brokenURL ? photo.url : null
  const missing = view.mode === 'photo' && (photo.status === 'missing' || (!!photo.url && photo.url === brokenURL))
  const shown = url !== null && loadedURL === url

  const [sheetOpen, setSheetOpen] = useState(false)
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const hasCover = !!view.photo
  const tod = timeOfDay(hour)
  const partnerMember = state.couple.members.find((m) => m.id === line.avatar)
  const together = view.together

  const onLine = () => {
    if (line.target === 'us') goToUsLine()
    else if (line.target === 'diary') onNavigate('diary')
  }

  // The caption's right side, first match.
  let right: React.ReactNode
  if (view.quiet && hasCover && view.mode === 'photo' && !missing) {
    right = (
      <button type="button" className={captionButton} onClick={() => update((s) => setHideCover(s, me.id, true))}>
        잠시 가리기
      </button>
    )
  } else if ((view.quiet || view.hidden) && hasCover && view.mode === 'art') {
    // Auto-hidden (hung while the ended pregnancy was confirmed), or hidden by
    // choice ('잠시 가리기' or the sheet's toggle) — always a way back. In the
    // quiet weeks "show it" is explicit (false); later it returns to automatic.
    right = (
      <button
        type="button"
        className={captionButton}
        onClick={() => update((s) => setHideCover(s, me.id, view.quiet ? false : undefined))}
      >
        사진 다시 보기
      </button>
    )
  } else if (missing) {
    right = (
      <button type="button" className={captionButton} onClick={openSheet}>
        사진을 다시 골라 주세요
      </button>
    )
  } else if (view.mode === 'photo' && view.photo?.caption) {
    right = <span className="min-w-0 shrink-[2] truncate text-[12.5px] font-medium text-ink-3">{view.photo.caption}</span>
  } else {
    right = <span className="min-w-0 shrink-[2] truncate text-[12.5px] font-medium text-ink-3">사진은 이 폰에만 저장돼요</span>
  }

  const names = view.decorate ? (
    <span className="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.02em] text-ink">
      {me.name}
      <span aria-hidden className="mx-[3px] text-[13px] text-glow">
        ♥
      </span>
      <span className="sr-only">{andParticle(me.name)} </span>
      {partner.name}
    </span>
  ) : (
    <span className="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.02em] text-ink">
      {me.name}
      <span aria-hidden className="mx-[5px] text-ink-3">
        ·
      </span>
      <span className="sr-only">{andParticle(me.name)} </span>
      {partner.name}
    </span>
  )

  return (
    <section aria-label="우리 표지">
      {/* -mt-0.5: the masthead sits 14px under the header, as in the mockup (main has pt-4). */}
      <div className="-mt-0.5 px-0.5">
        <div className="flex items-baseline justify-between gap-2 text-[12.5px] font-semibold leading-[17px] text-ink-3">
          <span>
            {formatKo(today, { weekday: false })} {weekdayKo(today)}요일
          </span>
          {together !== null ? (
            <span>
              함께한 지
              <b className="ml-[3px] text-[13.5px] font-extrabold tabular-nums tracking-[-0.01em] text-brand-ink">
                D+{together.toLocaleString('ko-KR')}
              </b>
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-h-9 items-center">
          <h1 className="min-w-0 flex-1 text-[20px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink outline-none">
            {line.target ? (
              <button
                type="button"
                onClick={onLine}
                className="-my-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {partnerMember ? <MemberBubble member={partnerMember} size={30} /> : null}
                <span className="min-w-0 truncate">{line.text}</span>
                {line.kind === 'signal' ? (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-px text-[13px] font-bold tracking-[-0.01em] text-brand-ink">
                    답하기
                    <Icon name="right" className="h-[15px] w-[15px]" strokeWidth={2.2} />
                  </span>
                ) : null}
              </button>
            ) : (
              line.text
            )}
          </h1>
        </div>
      </div>

      <Polaroid className="mt-3.5" decorated={view.decorate} quiet={view.quiet} caption={<>{names}{right}</>}>
        {/* The drawing shows until the photo has loaded (and whenever there is none). */}
        {!shown ? <CoverArt tod={tod} quiet={view.quiet} className="absolute inset-0" /> : null}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL (IndexedDB), not an optimisable asset
          <img
            ref={imgRef}
            src={url}
            alt={view.photo?.caption || `${me.name}${andParticle(me.name)} ${partner.name}의 표지 사진`}
            decoding="async"
            onLoad={() => setLoadedURL(url)}
            onError={() => setBrokenURL(url)}
            className={cx(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 dark:brightness-[.86] dark:saturate-[.94]',
              shown ? 'opacity-100' : 'opacity-0',
            )}
            style={{ objectPosition: `50% ${view.photo?.focusY ?? 50}%` }}
          />
        ) : null}

        {view.decorate && hasCover ? (
          <button
            type="button"
            onClick={openSheet}
            aria-label="표지 사진 바꾸기"
            className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-[0_2px_10px_rgb(0_0_0/.16)] before:absolute before:-inset-0.5 before:content-[''] hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Icon name="cam" className="h-5 w-5" />
          </button>
        ) : null}

        {!view.quiet && !hasCover ? (
          <button
            type="button"
            onClick={openSheet}
            className="absolute bottom-4 left-1/2 inline-flex h-[42px] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface pl-3.5 pr-[18px] text-sm font-bold text-ink shadow-[0_4px_16px_-4px_rgb(var(--brand)/.28)] hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:shadow-[0_4px_16px_-4px_rgb(0_0_0/.5)]"
          >
            <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2.2} />
            우리 사진 걸기
          </button>
        ) : null}
      </Polaroid>

      <CoverSheet open={sheetOpen} onClose={closeSheet} />
    </section>
  )
}
