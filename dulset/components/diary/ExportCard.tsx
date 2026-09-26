'use client'

import { useState } from 'react'
import { Button, Card, useToast } from '@/components/ui'
import { buildDiaryHtml, isSafeImageDataURL, mapWithConcurrency } from '@/lib/logic/diaryExport'
import { downloadText } from '@/lib/logic/ics'
import { getPhotoDataURL } from '@/lib/photos'
import { useApp } from '@/lib/store'

export const EXPORT_TITLE = '둘이 셋이 되기까지'
export const EXPORT_FILENAME = '둘셋-우리이야기.html'

/** Photos read from IndexedDB at the same time while exporting. */
const PHOTO_READS = 4

/** Download the whole diary (all stages, both authors) as one standalone HTML file. */
export default function ExportCard() {
  const { state, today } = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const count = state.diary.length
  const photoCount = state.diary.filter((e) => e.photoId).length

  async function run() {
    if (busy || !count) return
    // Snapshot now so an edit on the other "phone" mid-export can't mix versions.
    const snapshot = state
    setBusy(true)
    try {
      const ids = Array.from(new Set(snapshot.diary.flatMap((e) => (e.photoId ? [e.photoId] : []))))
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
        entries: snapshot.diary,
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

  const what = photoCount ? `기록 ${count}개와 사진 ${photoCount}장을` : `기록 ${count}개를`
  const label = !busy
    ? '우리 이야기 내보내기 (HTML)'
    : progress && progress.total
      ? `사진 담는 중… ${progress.done}/${progress.total}`
      : '파일 만드는 중…'

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          📖
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-ink">우리 이야기 한 권으로</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            두 사람의 {what} 오래된 순서대로 한 파일에 담아요. 브라우저에서 열어 인쇄하거나 PDF로 저장할 수 있어요.
          </p>
        </div>
      </div>
      <Button full variant="secondary" className="mt-3" onClick={run} disabled={busy || !count}>
        <span aria-live="polite">{label}</span>
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        나중에 포토북 인쇄와 연결할 수 있어요 (맘스다이어리처럼). 파일에는 글과 사진이 그대로 담기니, 다른 사람에게
        보낼 때는 한 번 더 확인해 주세요.
      </p>
    </Card>
  )
}
