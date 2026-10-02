'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui'
import { buildDiaryHtml, isSafeImageDataURL, mapWithConcurrency } from '@/lib/logic/diaryExport'
import { downloadText } from '@/lib/logic/ics'
import { visibleEntries } from '@/lib/logic/personalLog'
import { getPhotoDataURL } from '@/lib/photos'
import { useApp } from '@/lib/store'

export const EXPORT_TITLE = '둘이 셋이 되기까지'
export const EXPORT_FILENAME = '둘셋-우리이야기.html'

/** Photos read from IndexedDB at the same time while exporting. */
const PHOTO_READS = 4

/**
 * Download the whole story (all chapters, both authors, photos inlined) as one
 * standalone HTML file. Always free — the record is the couple's, not ours.
 */
export function useDiaryExport() {
  const { state, today, me } = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // The export is the reader's view: the other member's '나만 보기' entries stay out.
  const visible = visibleEntries(state.diary, me.id)
  const count = visible.length
  const photoCount = visible.filter((e) => e.photoId).length

  async function run() {
    if (busy || !count) return
    // Snapshot now so an edit on the other "phone" mid-export can't mix versions.
    const snapshot = state
    setBusy(true)
    try {
      const entries = visibleEntries(snapshot.diary, me.id)
      const ids = Array.from(new Set(entries.flatMap((e) => (e.photoId ? [e.photoId] : []))))
      if (ids.length) setProgress({ done: 0, total: ids.length })
      const loaded = await mapWithConcurrency(
        ids,
        PHOTO_READS,
        async (id) => [id, await getPhotoDataURL(id).catch(() => null)] as const,
        (done) => setProgress({ done, total: ids.length }),
      )
      const photos: Record<string, string> = {}
      let missing = 0
      for (const [id, url] of loaded) {
        if (isSafeImageDataURL(url)) photos[id] = url
        else missing++
      }
      const html = buildDiaryHtml({
        entries,
        viewer: me.id,
        members: snapshot.couple.members,
        title: EXPORT_TITLE,
        photos,
        baby: snapshot.baby,
        pregnancy: snapshot.pregnancy,
        generatedOn: today,
      })
      downloadText(EXPORT_FILENAME, html, 'text/html;charset=utf-8')
      toast.show(missing ? `저장했어요. 사진 ${missing}장은 이 기기에 없어서 뺐어요` : '우리 이야기를 파일로 저장했어요')
    } catch {
      toast.show('파일을 만들지 못했어요. 잠시 뒤 다시 해 볼까요?')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const label = !busy
    ? '우리 이야기 내보내기 (HTML)'
    : progress && progress.total
      ? `사진 담는 중… ${progress.done}/${progress.total}`
      : '파일 만드는 중…'

  return { run, busy, label, count, photoCount }
}
