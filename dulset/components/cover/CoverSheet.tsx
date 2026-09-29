'use client'

// "표지 사진" — pick the photo at the top of both people's 오늘 screen, move it
// up or down in its frame, and give it a short line. The picture stays on this
// phone (IndexedDB, or a built-in demo drawing); the state keeps only its id.
// An album pick is COPIED, so deleting the diary entry never breaks the cover.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import { Sheet, Toggle, cx, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { useNearScreen, usePhotoURL } from '@/components/us/usePhotoURL'
import { formatKo, formatShort } from '@/lib/dates'
import {
  COVER_CAPTION_MAX,
  captionLength,
  clampFocus,
  clearCover,
  coverCaptionProblem,
  coverView,
  releasableCoverPhoto,
  setCover,
  setHideCover,
} from '@/lib/logic/cover'
import { albumGroups } from '@/lib/logic/usView'
import { deletePhoto, downscaleImage, getPhotoBlob, isBuiltinPhoto, savePhoto } from '@/lib/photos'
import { useApp } from '@/lib/store'
import type { AppState, DiaryEntry } from '@/lib/types'

/** Thumbnails in the album row (newest first). */
const ALBUM_MAX = 15

const SAVE_FAILED = '이 브라우저에서는 사진을 저장할 수 없어요. 기본 그림으로 보여 드릴게요.'
/** The same failure when a cover is already hung: nothing changes, so say that. */
const SAVE_FAILED_KEEP = '이 브라우저에서는 사진을 저장할 수 없어요. 지금 표지는 그대로 둘게요.'

type Choice =
  /** The cover already hung (move it or change its line in place). */
  | { kind: 'current'; photoId: string }
  /** A diary photo — copied on save (a built-in picture keeps its id). */
  | { kind: 'album'; photoId: string; entryId: string }
  /** From the phone's photos — downscaled, kept in memory until save. */
  | { kind: 'file'; blob: Blob; url: string }

export default function CoverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="표지 사진">
      {/* The body mounts per opening, so it always starts from the cover as it is now. */}
      {open ? <CoverSheetBody onClose={onClose} /> : null}
    </Sheet>
  )
}

/**
 * Change the cover, then drop the stored copy of the photo it replaced
 * (lib/logic/cover.releasableCoverPhoto: never a built-in picture, never one a
 * diary entry uses). The previous id is read from the state the change was
 * applied to, so a cover the other phone hung a moment ago is released too.
 */
function changeCover(update: (fn: (s: AppState) => AppState) => void, change: (s: AppState) => AppState): void {
  const first: { before?: AppState; after?: AppState } = {}
  update((s) => {
    const next = change(s)
    // update() may re-apply the change on newer data (the other tab); the first run is this tap.
    if (!first.before) Object.assign(first, { before: s, after: next })
    return next
  })
  if (!first.before || !first.after) return
  const id = releasableCoverPhoto(first.after, first.before.couple.cover?.photoId)
  if (id) void deletePhoto(id)
}

function CoverSheetBody({ onClose }: { onClose: () => void }) {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const cover = state.couple.cover
  const view = coverView(state, me.id, today)
  // The clock hour only picks the default art's palette.
  const [hour] = useState(() => new Date().getHours())

  // In the quiet weeks, a photo waiting behind the drawing (autoHidden) is not
  // put back on screen here either: the sheet starts empty until they choose.
  const startCover = cover && !view.autoHidden ? cover : undefined
  const [choice, setChoice] = useState<Choice | null>(() => (startCover ? { kind: 'current', photoId: startCover.photoId } : null))
  const [focusY, setFocusY] = useState(() => startCover?.focusY ?? 50)
  const [caption, setCaption] = useState(() => startCover?.caption ?? '')
  // A line they haven't typed belongs to the photo it came with: a new pick replaces it.
  const [captionTyped, setCaptionTyped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [broken, setBroken] = useState<string | null>(null)

  // A picked file's preview URL lives until it is replaced, saved or the sheet closes.
  const fileURL = useRef<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (fileURL.current) URL.revokeObjectURL(fileURL.current)
      fileURL.current = null
    }
  }, [])
  const choose = useCallback((next: Choice | null) => {
    const keep = next?.kind === 'file' ? next.url : null
    if (fileURL.current && fileURL.current !== keep) URL.revokeObjectURL(fileURL.current)
    fileURL.current = keep
    setChoice(next)
    setBroken(null)
    setError(null)
  }, [])

  const storedId = choice && choice.kind !== 'file' ? choice.photoId : undefined
  const stored = usePhotoURL(storedId)
  const previewURL = choice?.kind === 'file' ? choice.url : stored.url
  const shownURL = previewURL && previewURL !== broken ? previewURL : null
  const missing = (!!storedId && stored.status === 'missing') || (!!previewURL && previewURL === broken)

  // In the quiet weeks the row leaves out the ended pregnancy's entries (e.g. ultrasound photos).
  const album = useMemo(
    () => albumGroups(view.quiet ? state.diary.filter((e) => e.stage !== 'pregnant') : state.diary).flatMap((g) => g.entries),
    [state.diary, view.quiet],
  )
  const selectedEntry = choice?.kind === 'album' ? choice.entryId : null

  const problem = coverCaptionProblem(caption)
  const length = captionLength(caption)
  const canSave = !!choice && !missing && !problem && !busy && (choice.kind === 'file' || !!shownURL)

  // ── Moving the photo in its frame ──
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ id: number; y: number; start: number; range: number } | null>(null)

  /** How many px of the photo are hidden above + below (object-fit: cover). */
  const hiddenHeight = () => {
    const img = imgRef.current
    const box = boxRef.current
    if (!img || !box || !img.naturalWidth || !img.naturalHeight) return 0
    const scale = Math.max(box.clientWidth / img.naturalWidth, box.clientHeight / img.naturalHeight)
    return img.naturalHeight * scale - box.clientHeight
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!shownURL) return
    const range = hiddenHeight()
    if (range < 1) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { id: e.pointerId, y: e.clientY, start: focusY, range }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // Dragging the photo down shows more of its top (a smaller focusY).
    setFocusY(clampFocus(d.start - ((e.clientY - d.y) / d.range) * 100))
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }
  const onSliderKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    const step: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 10, PageDown: -10 }
    let next: number | null = null
    if (e.key in step) next = focusY + step[e.key]!
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    if (next === null) return
    e.preventDefault()
    setFocusY(clampFocus(next))
  }

  // ── Choosing a photo ──
  const fileRef = useRef<HTMLInputElement>(null)
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = '' // the same file can be picked again
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) {
      toast.show('사진 파일만 올릴 수 있어요')
      return
    }
    setBusy(true)
    try {
      const blob = await downscaleImage(file, 1280, 0.82)
      if (!mounted.current) return
      choose({ kind: 'file', blob, url: URL.createObjectURL(blob) })
      setFocusY(50)
      if (!captionTyped) setCaption('')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function pickAlbum(entry: DiaryEntry) {
    if (!entry.photoId) return
    choose({ kind: 'album', photoId: entry.photoId, entryId: entry.id })
    setFocusY(50)
    // Only the date — the diary text is theirs, not the cover's.
    if (!captionTyped || !caption.trim()) setCaption(formatShort(entry.date))
  }

  function onPreviewError() {
    if (!previewURL) return
    setBroken(previewURL)
    if (choice?.kind === 'file') setError('이 사진은 열 수 없어요. 다른 사진을 골라 주세요')
  }

  // ── Saving ──
  async function save() {
    if (!canSave || !choice) return
    const text = caption.trim()

    if (choice.kind === 'current') {
      if (cover && cover.photoId === choice.photoId && cover.focusY === focusY && (cover.caption ?? '') === text) {
        onClose()
        return
      }
      if (cover?.photoId !== choice.photoId) {
        // The other phone replaced the cover meanwhile: start again from the one hung now.
        choose(cover ? { kind: 'current', photoId: cover.photoId } : null)
        setFocusY(cover?.focusY ?? 50)
        setError('방금 표지가 바뀌었어요. 사진을 다시 확인해 주세요')
        return
      }
      // Same photo: move it / change its line in place (who hung it and when stay).
      update((s) => {
        const c = s.couple.cover
        if (!c || c.photoId !== choice.photoId) return s // the other phone changed it meanwhile
        return setCover(s, { photoId: c.photoId, focusY, caption: text }, c.setBy, c.setAt)
      })
      toast.show('표지를 걸었어요')
      onClose()
      return
    }

    setBusy(true)
    setError(null)
    try {
      let id: string
      if (choice.kind === 'album' && isBuiltinPhoto(choice.photoId)) {
        id = choice.photoId
      } else {
        const blob = choice.kind === 'file' ? choice.blob : await getPhotoBlob(choice.photoId)
        if (!blob) {
          if (mounted.current) setError('이 사진을 찾을 수 없어요. 다른 사진을 골라 주세요')
          return
        }
        id = await savePhoto(blob)
      }
      changeCover(update, (s) => setCover(s, { photoId: id, focusY, caption: text }, me.id, today))
      toast.show('표지를 걸었어요')
      onClose()
    } catch {
      if (mounted.current) setError(cover ? SAVE_FAILED_KEEP : SAVE_FAILED)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  function hangDefaultArt() {
    changeCover(update, clearCover)
    toast.show('기본 그림으로 바꿨어요')
    onClose()
  }

  const captionId = useId()
  const countId = useId()
  const problemId = useId()
  const albumId = useId()

  return (
    <div className="-mt-3">
      <p className="text-[13px] leading-relaxed text-ink-2">
        두 사람의 오늘 화면 맨 위에 걸려요. 위아래로 옮겨 얼굴이 잘 보이게 맞춰요.
      </p>

      {/* Preview — the photo as it will sit in the frame (drag or arrow keys to move it). */}
      <div
        ref={boxRef}
        className={cx('relative mt-3 h-[132px] overflow-hidden rounded-[14px] bg-surface-2', shownURL && 'cursor-grab touch-none select-none active:cursor-grabbing')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {shownURL ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
            <img
              ref={imgRef}
              src={shownURL}
              alt="표지로 걸 사진 미리 보기"
              className="pointer-events-none h-full w-full object-cover dark:brightness-[.86] dark:saturate-[.94]"
              style={{ objectPosition: `50% ${focusY}%` }}
              decoding="async"
              draggable={false}
              onError={onPreviewError}
            />
            <span
              role="slider"
              tabIndex={0}
              aria-label="사진 위치"
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={focusY}
              aria-valuetext={focusY <= 5 ? '맨 위' : focusY >= 95 ? '맨 아래' : `위에서 ${focusY}%`}
              onKeyDown={onSliderKey}
              className="absolute right-2.5 top-2.5 inline-flex h-8 items-center gap-1 rounded-full bg-surface/90 px-3 text-[12.5px] font-bold text-ink shadow-warm before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:shadow-none"
            >
              <Icon name="move" className="h-[15px] w-[15px]" strokeWidth={2} />
              위치 옮기기
            </span>
          </>
        ) : (
          <CoverArt tod={timeOfDay(hour)} quiet={view.quiet} />
        )}
      </div>
      {missing && choice?.kind === 'current' ? (
        <p className="mt-1.5 text-xs text-ink-2">이 폰에서 표지 사진을 찾을 수 없어요. 사진을 다시 골라 주세요.</p>
      ) : null}

      {/* The line under the photo */}
      <label htmlFor={captionId} className="mt-4 block text-[12.5px] font-bold text-ink-2">
        사진 한 줄 (선택)
      </label>
      <div className="relative mt-1.5">
        <input
          id={captionId}
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value)
            setCaptionTyped(true)
          }}
          placeholder="예: 9.20 · 한강 산책"
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${countId} ${problemId}` : countId}
          className="block h-[46px] w-full rounded-[14px] border-[1.5px] border-control bg-surface pl-3.5 pr-16 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <span
          id={countId}
          className={cx(
            'pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs tabular-nums',
            length > COVER_CAPTION_MAX ? 'font-bold text-warn' : 'text-ink-3',
          )}
        >
          <span className="sr-only">글자 수 </span>
          {length}/{COVER_CAPTION_MAX}
        </span>
      </div>
      {problem ? (
        <p id={problemId} className="mt-1.5 text-xs font-medium text-warn">
          {problem}
        </p>
      ) : null}

      {/* 우리 앨범에서 — diary photos, newest first */}
      {album.length ? (
        <section aria-labelledby={albumId}>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <h3 id={albumId} className="text-sm font-extrabold text-ink">
              우리 앨범에서
            </h3>
            <span className="text-xs text-ink-3">사진 {album.length.toLocaleString('ko-KR')}장</span>
          </div>
          <ul className="-mx-5 flex gap-1.5 overflow-x-auto px-5 py-[7px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {album.slice(0, ALBUM_MAX).map((e) => (
              <li key={e.id} className="shrink-0">
                <AlbumThumb entry={e} today={today} selected={selectedEntry === e.id} onPick={pickAlbum} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={cx('flex gap-2', album.length ? 'mt-1.5' : 'mt-4')}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-sm font-extrabold tracking-[-0.02em] text-ink transition-colors hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
        >
          <Icon name="img" className="h-[18px] w-[18px]" strokeWidth={2} />
          휴대폰 사진에서
        </button>
        <button
          type="button"
          onClick={hangDefaultArt}
          disabled={!cover || busy}
          className="inline-flex h-[46px] min-w-0 flex-1 items-center justify-center rounded-full bg-surface-2 px-2.5 text-sm font-extrabold tracking-[-0.02em] text-ink transition-colors hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
        >
          기본 그림으로
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onPickFile} />
      </div>

      <div className="mt-3.5 rounded-2xl bg-surface-2 px-3.5 py-1.5">
        {/* An auto-hidden photo (quiet weeks) reads as ON; turning it off then means "show it" (false). */}
        <Toggle
          checked={view.hidden || view.autoHidden}
          onChange={(next) => update((s) => setHideCover(s, me.id, next ? true : view.quiet ? false : undefined))}
          label={<span className="font-bold">내 화면에서는 그림만 보기</span>}
          description={`사진 대신 기본 그림이 보여요. ${partner.name}님 화면은 그대로예요.`}
        />
      </div>

      <p className="mt-3 flex gap-1.5 text-xs leading-relaxed text-ink-2">
        <Icon name="lock" className="h-[18px] w-[18px]" />
        <span>사진은 이 폰에만 저장돼요. 어디에도 올리지 않고, 백업 파일에도 들어가지 않아요.</span>
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-[50px] min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-base font-extrabold text-ink transition-colors hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          aria-busy={busy || undefined}
          className="h-[50px] min-w-0 flex-1 rounded-full bg-brand px-4 text-base font-extrabold text-white shadow-[0_6px_16px_-8px_rgb(var(--brand)/.55)] transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:shadow-none"
        >
          이 사진으로 걸기
        </button>
      </div>
    </div>
  )
}

function AlbumThumb({
  entry,
  today,
  selected,
  onPick,
}: {
  entry: DiaryEntry
  today: string
  selected: boolean
  onPick: (entry: DiaryEntry) => void
}) {
  const [ref, near] = useNearScreen<HTMLButtonElement>('200px 200px')
  const { url, status } = usePhotoURL(entry.photoId, near)
  const [broken, setBroken] = useState<string | null>(null)
  const shown = url && url !== broken ? url : null
  const missing = status === 'missing' || (!!url && url === broken)
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onPick(entry)}
      disabled={missing}
      aria-pressed={selected}
      aria-label={`${formatKo(entry.date, { weekday: false, year: entry.date.slice(0, 4) !== today.slice(0, 4) })} 사진`}
      className={cx(
        'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[10px] bg-surface-2',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected && 'ring-2 ring-ink ring-offset-[3px] ring-offset-bg',
        !shown && !missing && 'animate-pulse',
      )}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: URL
        <img
          src={shown}
          alt=""
          className="h-full w-full object-cover dark:brightness-[.86] dark:saturate-[.94]"
          decoding="async"
          draggable={false}
          onError={() => setBroken(shown)}
        />
      ) : missing ? (
        <span aria-hidden className="text-lg text-ink-3">
          📷
        </span>
      ) : null}
      {selected ? (
        <span className="absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink text-bg">
          <Icon name="check" className="h-[13px] w-[13px]" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  )
}
