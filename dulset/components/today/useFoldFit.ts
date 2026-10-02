'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

/** The cover photo never gets shorter than this to make room (a strip still reads as a photo). */
export const COVER_MIN_FIT = 88
/**
 * When even that leaves the moment's action under the tab bar (a 375×667 phone
 * with the 알릴까요? buttons or a long card), the cover collapses to this strip —
 * names and caption stay, the picture becomes a sliver (QF5).
 */
export const COVER_STRIP = 56
/** Room kept between the moment's action and the tab bar, so the raised "+" button never covers it. */
const FAB_CLEARANCE = 22

/**
 * The fold rule of the preparing home: on the first screen, the moment card's
 * action (or its title, when it has none) sits above the tab bar — on a
 * 375×667 phone too, whatever the moment says.
 *
 * The photo box already shrinks on short screens (.cover-photo-h in
 * globals.css). When a moment's copy runs longer than usual, this caps the
 * photo a little more (a CSS variable, --cover-fit, read as max-height), down
 * to COVER_MIN_FIT. It never makes the photo taller than the CSS allows.
 * Runs before paint on mount and when `key` changes (a different moment),
 * when the page's content resizes, and when the small viewport changes — not
 * on toolbar-driven resizes, so nothing jumps while scrolling.
 */
export function useFoldFit(key: string) {
  const ref = useRef<HTMLDivElement>(null)

  const fit = useCallback(() => {
    const root = ref.current
    if (!root) return
    const photo = root.querySelector<HTMLElement>('.cover-photo-h, .cover-photo-h-quiet')
    // Fold targets in page order: a leading 이번 달 할 일 card's action row, then
    // the moment card's action or title. The last one that the cover can make
    // room for wins — so both show when they can, and the leading card's
    // action alone when the moment's title would need more than the strip.
    const targets = [...root.querySelectorAll<HTMLElement>('[data-fold]')]
    const nav = document.querySelector<HTMLElement>('nav[aria-label="주요 메뉴"]')
    if (!photo || targets.length === 0) {
      root.style.removeProperty('--cover-fit')
      root.removeAttribute('data-cover-strip')
      return
    }
    const viewport = smallViewportHeight()
    const limit = viewport - (nav?.offsetHeight ?? 0) - FAB_CLEARANCE
    let next = COVER_STRIP
    for (let i = targets.length - 1; i >= 0; i--) {
      // Document coordinates: the fold is the first screen, wherever the page is scrolled now.
      const bottom = targets[i]!.getBoundingClientRect().bottom + window.scrollY
      // Layout height (the frame's tilt doesn't change it); shrinking the photo by x lifts the target by x.
      const ideal = Math.floor(photo.offsetHeight + (limit - bottom))
      // Down to COVER_MIN_FIT it is still a photo; past that, snap to the strip rather than a random sliver.
      if (ideal >= COVER_MIN_FIT) {
        next = ideal
        break
      }
      if (ideal >= COVER_STRIP) break
    }
    root.style.setProperty('--cover-fit', `${next}px`)
    root.toggleAttribute('data-cover-strip', next === COVER_STRIP)
  }, [])

  useLayoutEffect(() => {
    fit()
  }, [fit, key])

  // Anything else that moves the moment card (a name that wraps, a new line of
  // copy after a log): fit is idempotent, so re-running it on a resize is safe.
  useEffect(() => {
    const root = ref.current
    if (!root || typeof ResizeObserver === 'undefined') return
    // Next frame, so resizing the photo never happens inside the observer's own delivery.
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    })
    ro.observe(root)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [fit])

  useEffect(() => {
    let last = smallViewportHeight()
    let lastW = window.innerWidth
    const onResize = () => {
      const h = smallViewportHeight()
      if (h === last && window.innerWidth === lastW) return
      last = h
      lastW = window.innerWidth
      fit()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fit])

  return ref
}

/**
 * A short phone (375×667 and the like): the viewport is under 700px tall. The
 * same cut as the `[@media(max-height:700px)]` spacing in the home's cards. A
 * leading 이번 달 할 일 card folds to one row there (MonthlyTaskCard). Rendered
 * as `false` on the server, so hydration never mismatches.
 */
const SHORT_VIEWPORT = '(max-height: 699px)'

function subscribeShort(onChange: () => void): () => void {
  const mq = window.matchMedia(SHORT_VIEWPORT)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function useShortViewport(): boolean {
  return useSyncExternalStore(
    subscribeShort,
    () => window.matchMedia(SHORT_VIEWPORT).matches,
    () => false,
  )
}

/** 100svh in px (the viewport with the browser's toolbars shown), else innerHeight. */
function smallViewportHeight(): number {
  if (typeof CSS !== 'undefined' && CSS.supports?.('height', '100svh')) {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    const h = probe.offsetHeight
    probe.remove()
    if (h > 0) return h
  }
  return window.innerHeight
}
