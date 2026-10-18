'use client'

import { useDiaryExport } from '@/components/diary/useDiaryExport'
import { goToSettings } from '@/components/settings/anchors'
import { Button, Card } from '@/components/ui'
import { IconTile } from '@/components/ui/icons'

/** 설정 › 데이터와 개인정보, where the full backup is. */
const openSettings = () => goToSettings('data')

/**
 * Records must never feel hostage: everything stays on this device and can be
 * taken out for free at any time (the HTML story here, the full backup in 설정).
 */
export default function KeepCard() {
  const { run, busy, label, count, photoCount } = useDiaryExport()
  const what = !count ? '' : photoCount ? `기록 ${count}개 · 사진 ${photoCount}장` : `기록 ${count}개`

  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile name="book" size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-ink">내보내기와 백업</h2>
          {what ? <p className="mt-1 text-xs leading-relaxed text-ink-2">{what}</p> : null}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Button full variant="secondary" onClick={run} disabled={busy || !count}>
          <span aria-live="polite">{count ? label : '기록이 생기면 내보낼 수 있어요'}</span>
        </Button>
        <Button full variant="ghost" onClick={openSettings}>
          설정에서 전체 백업 받기 (.zip)
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">기기를 바꾸거나 브라우저 데이터를 지우기 전에 전체 백업을 받아 두세요.</p>
    </Card>
  )
}
