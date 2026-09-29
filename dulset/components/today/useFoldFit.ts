'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/** The cover photo never gets shorter than this to make room (a strip still reads as a photo). */
export const COVER_MIN_FIT = 88
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
    const target = root.querySelector<HTMLElement>('[data-fold]')
    const nav = document.querySelector<HTMLElement>('nav[aria-label="주요 메뉴"]')
    if (!photo || !target) {
      root.style.removeProperty('--cover-fit')
      return
    }
    const viewport = smallViewportHeight()
    const limit = viewport - (nav?.offsetHeight ?? 0) - FAB_CLEARANCE
    // Document coordinates: the fold is the first screen, wherever the page is scrolled now.
    const bottom = target.getBoundingClientRect().bottom + window.scrollY
    // Layout height (the frame's tilt doesn't change it); shrinking the photo by x lifts the target by x.
    const next = Math.max(COVER_MIN_FIT, Math.floor(photo.offsetHeight + (limit - bottom)))
    root.style.setProperty('--cover-fit', `${next}px`)
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
