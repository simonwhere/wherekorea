'use client'

import { Button, Sheet, useToast } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { removeEntry } from '@/lib/logic/diary'
import { deletePhoto } from '@/lib/photos'
import { useApp } from '@/lib/store'
import type { DiaryEntry } from '@/lib/types'

/** Confirm before deleting one of my own entries (and its photo). `onClose` must be stable. */
export default function DeleteEntrySheet({ entry, onClose }: { entry: DiaryEntry | null; onClose: () => void }) {
  const { update, partner } = useApp()
  const toast = useToast()

  function confirm() {
    if (!entry) return
    const { id, photoId } = entry
    update((s) => removeEntry(s, id))
    if (photoId) void deletePhoto(photoId)
    toast.show('기록을 지웠어요')
    onClose()
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title="이 기록을 지울까요?">
      {entry ? (
        <>
          <p className="text-sm leading-relaxed text-ink-2">
            {formatKo(entry.date)}에 남긴 기록이에요. 지우면 되돌릴 수 없고, {partner.name}님 화면에서도 사라져요.
            {entry.photoId ? ' 함께 올린 사진도 지워져요.' : ''}
          </p>
          {entry.text ? (
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
              {entry.text}
            </p>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onClose}>
              그대로 두기
            </Button>
            <Button variant="danger" onClick={confirm}>
              지우기
            </Button>
          </div>
        </>
      ) : null}
    </Sheet>
  )
}
