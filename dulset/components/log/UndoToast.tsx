'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface UndoMessage {
  id: number
  text: string
}

/** How long 되돌리기 stays available after a log. */
export const UNDO_MS = 5_000

/**
 * "기록했어요 · 되돌리기" toast. Lives outside the sheet (portal on <body>) so it
 * outlasts the sheet closing; `data-live-region` keeps it out of the sheet's
 * inert backdrop when another sheet opens meanwhile.
 */
export default function UndoToast({
  message,
  onUndo,
  onExpire,
}: {
  message: UndoMessage | null
  onUndo: () => void
  onExpire: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onExpire, UNDO_MS)
    return () => window.clearTimeout(t)
  }, [message, onExpire])

  if (!mounted) return null
  return createPortal(
    <div
      data-live-region=""
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4"
    >
      {message ? (
        <div
          key={message.id}
          className="pointer-events-auto flex max-w-md items-center gap-1 rounded-full bg-ink py-1 pl-4 pr-1 text-sm font-medium text-bg shadow-lg"
        >
          <span className="min-w-0 py-1.5">{message.text}</span>
          <button
            type="button"
            onClick={onUndo}
            className="h-11 shrink-0 rounded-full px-3 text-sm font-bold text-bg underline underline-offset-2 hover:bg-bg/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bg"
          >
            되돌리기
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
