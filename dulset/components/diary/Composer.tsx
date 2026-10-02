'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Avatar, Button, Card, Field, cx, inputClass, textareaClass, useToast } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { PROMPTS, addEntry, promptFor } from '@/lib/logic/diary'
import {
  DIARY_MAX_TEXT,
  clampDiaryDate,
  diaryDraftKey,
  parseDiaryDraft,
  serializeDiaryDraft,
  type DiaryDraft,
} from '@/lib/logic/diaryExport'
import { stampOn } from '@/lib/logic/today'
import { chapterContext, composerTitle, entryChapter } from '@/lib/logic/usView'
import { uid } from '@/lib/id'
import { deletePhoto, downscaleImage, getPhotoURL, savePhoto } from '@/lib/photos'
import { useApp } from '@/lib/store'
import MoodPicker from './MoodPicker'

interface PendingPhoto {
  id: string
  /** Object URL of the downscaled blob, for the preview. */
  url: string
}

function readDraft(key: string, today: string): DiaryDraft | null {
  try {
    return parseDiaryDraft(window.localStorage.getItem(key), today)
  } catch {
    return null
  }
}

/** true when the draft is safely stored (or there was nothing to store). */
function writeDraft(key: string, draft: DiaryDraft): boolean {
  try {
    const raw = serializeDiaryDraft(draft)
    if (raw) window.localStorage.setItem(key, raw)
    else window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * Write a diary entry. The tab remounts it (key) when the viewer changes, and
 * each viewer has their own saved draft, so a half-written entry is never
 * saved under the other person's name — and never lost on a tab switch.
 */
export default function Composer() {
  const { state, update, today, me, partner } = useApp()
  const toast = useToast()
  const stage = state.stage
  const prompts = PROMPTS[stage]
  const base = Math.max(0, prompts.indexOf(promptFor(stage, today)))
  const [offset, setOffset] = useState(0)
  const prompt = prompts[(base + offset) % prompts.length]!

  const draftKey = diaryDraftKey(me.id)
  // Client-only: the app shell renders screens after hydration.
  const [initial] = useState(() => readDraft(draftKey, today))
  const [text, setText] = useState(initial?.text ?? '')
  const [mood, setMood] = useState<string | undefined>(initial?.mood)
  // null = "today" (follows a midnight rollover); a picked date may be in the past.
  const [pickedDate, setPickedDate] = useState<string | null>(initial?.date ?? null)
  const date = pickedDate ?? today
  const [photo, setPhotoState] = useState<PendingPhoto | null>(null)
  const [busy, setBusy] = useState(false)
  // Re-attaching a draft's photo from IndexedDB.
  const [restoring, setRestoring] = useState(!!initial?.photoId)

  // Photo attached but not saved with an entry yet.
  const pending = useRef<PendingPhoto | null>(null)
  const mounted = useRef(false)
  const draftStored = useRef(true)
  // Latest diary, so removing a pending photo never deletes one an entry uses.
  const diaryRef = useRef(state.diary)
  useEffect(() => {
    diaryRef.current = state.diary
  }, [state.diary])

  const setPhoto = useCallback((next: PendingPhoto | null, { keepStored = false } = {}) => {
    const prev = pending.current
    if (prev && prev.id !== next?.id) {
      URL.revokeObjectURL(prev.url)
      const inUse = diaryRef.current.some((e) => e.photoId === prev.id)
      if (!keepStored && !inUse) void deletePhoto(prev.id)
    }
    pending.current = next
    setPhotoState(next)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const p = pending.current
      pending.current = null
      if (p) {
        URL.revokeObjectURL(p.url)
        // The saved draft still points at the photo; only drop it if the draft couldn't be kept.
        if (!draftStored.current && !diaryRef.current.some((e) => e.photoId === p.id)) void deletePhoto(p.id)
      }
    }
  }, [])

  // Bring back the photo of a saved draft (skipped quietly if it's gone).
  useEffect(() => {
    const id = initial?.photoId
    if (!id) return
    let alive = true
    getPhotoURL(id)
      .then((url) => {
        if (!alive) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        if (url) setPhoto({ id, url })
        setRestoring(false)
      })
      .catch(() => {
        if (alive) setRestoring(false)
      })
    return () => {
      alive = false
    }
  }, [initial, setPhoto])

  // Keep the draft in step with what's on screen.
  const draftPhotoId = photo?.id ?? (restoring ? initial?.photoId : undefined)
  useEffect(() => {
    draftStored.current = writeDraft(draftKey, {
      text,
      mood,
      date: pickedDate ?? undefined,
      photoId: draftPhotoId,
    })
  }, [draftKey, text, mood, pickedDate, draftPhotoId])

  const promptId = useId()
  const textId = useId()
  const countId = useId()
  const fileId = useId()

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = '' // let the same file be picked again
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) {
      toast.show('사진 파일만 올릴 수 있어요')
      return
    }
    setBusy(true)
    try {
      const blob = await downscaleImage(file)
      const id = await savePhoto(blob)
      if (!mounted.current) {
        void deletePhoto(id)
        return
      }
      setPhoto({ id, url: URL.createObjectURL(blob) })
    } catch {
      if (mounted.current) toast.show('사진을 저장하지 못했어요')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  // The browser couldn't show the picked file (e.g. HEIC outside Safari).
  function onPreviewError() {
    setPhoto(null)
    toast.show('이 사진은 열 수 없어요. 다른 사진을 골라 주세요')
  }

  const hasContent = text.trim().length > 0 || !!photo
  const canSave = !busy && !restoring && hasContent

  function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSave) return
    const entryDate = clampDiaryDate(date, today)
    const photoId = photo?.id
    // A fixed id: the two-tab sync may apply this change again, and it must add one entry.
    const id = uid()
    update((s) => addEntry(s, { id, date: entryDate, author: me.id, text, mood, photoId }, stampOn(today)))
    // The photo now belongs to the entry: drop the preview but keep the stored file.
    setPhoto(null, { keepStored: true })
    setText('')
    setMood(undefined)
    setPickedDate(null)
    toast.show(`기록했어요. ${partner.name}님도 함께 볼 수 있어요`)
  }

  const backdated = date !== '' && date < today
  // 우리 둘 기록 / 우리의 기록 / 태교일기 / 육아일기 — follows the picked date's chapter.
  const ctx = chapterContext(state)
  const effectiveDate = clampDiaryDate(date, today)
  const title = composerTitle(stage, effectiveDate, ctx)
  const coupleChapter = entryChapter({ stage, date: effectiveDate }, ctx) === 'couple'
  const onDateBlur = () => setPickedDate((d) => (d === null ? null : clampDiaryDate(d, today)))

  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
        <Icon name="pen" className="h-[18px] w-[18px] text-ink-2" />
        {title}
      </h2>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-brand-ink">오늘의 질문</p>
          <p id={promptId} className="mt-0.5 text-[15px] font-bold leading-snug text-ink" aria-live="polite">
            {prompt}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => (o + 1) % prompts.length)}
          className="-mr-2 -mt-1.5 flex h-11 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Icon name="refresh" className="h-4 w-4" strokeWidth={2} /> 다른 질문
        </button>
      </div>

      <form className="mt-3 space-y-3" onSubmit={save}>
        <div>
          <label htmlFor={textId} className="sr-only">
            {me.name}의 기록
          </label>
          <textarea
            id={textId}
            rows={4}
            maxLength={DIARY_MAX_TEXT}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/⌘+Enter saves — but not mid-syllable while a Korean IME is composing.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) save()
            }}
            placeholder="한 줄이면 충분해요. 떠오르는 대로 적어 보세요."
            aria-describedby={`${promptId} ${countId}`}
            className={cx(textareaClass, 'resize-none text-[15px] leading-relaxed')}
          />
          <div className="mt-1 flex items-center justify-between gap-2 px-0.5 text-[11px] text-ink-3">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Avatar member={me} size="sm" />
              <span className="sr-only">작성: </span>
              <span className="truncate">{me.name}</span>
            </span>
            <span
              id={countId}
              className={cx('tabular-nums', text.length >= DIARY_MAX_TEXT && 'font-semibold text-brand-ink')}
            >
              {text.length.toLocaleString('ko-KR')} / {DIARY_MAX_TEXT.toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink-2">
            기분 <span className="font-normal text-ink-3">(선택)</span>
          </p>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        <div className="grid grid-cols-2 items-start gap-2">
          <Field
            label="날짜"
            hint={coupleChapter ? '‘우리 둘’ 이야기로 남겨요' : backdated ? '지난 날의 기록으로 남겨요' : undefined}
          >
            <input
              type="date"
              className={cx(inputClass, 'px-2.5')}
              value={date}
              max={today}
              onChange={(e) => setPickedDate(e.target.value)}
              onBlur={onDateBlur}
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-ink-2">사진</span>
            <input
              id={fileId}
              type="file"
              accept="image/*"
              className="peer sr-only"
              onChange={onPick}
              disabled={busy || restoring}
            />
            <label
              htmlFor={fileId}
              aria-busy={busy || restoring}
              className={cx(
                'flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-surface text-sm font-medium text-ink-2 hover:bg-surface-2',
                'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand',
                (busy || restoring) && 'cursor-wait opacity-60',
              )}
            >
              <Icon name="cam" className="h-[18px] w-[18px]" />
              {busy || restoring ? '준비 중…' : photo ? '다른 사진' : '사진 추가'}
            </label>
          </div>
        </div>

        {photo ? (
          <div className="relative overflow-hidden rounded-xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
            <img
              src={photo.url}
              alt="첨부한 사진 미리보기"
              className="max-h-60 w-full object-cover"
              onError={onPreviewError}
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              aria-label="사진 빼기"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-bg">
                <Icon name="x" className="h-4 w-4" strokeWidth={2.4} />
              </span>
            </button>
          </div>
        ) : null}

        <div>
          <Button type="submit" full disabled={!canSave}>
            기록 남기기
          </Button>
          <p className="mt-1.5 text-center text-[11px] text-ink-3">
            {hasContent || busy || restoring
              ? `${partner.name}님과 함께 보는 기록이에요`
              : '글이나 사진, 하나만 있어도 남길 수 있어요'}
          </p>
        </div>
      </form>
    </Card>
  )
}
