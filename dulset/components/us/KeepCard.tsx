'use client'

import { useDiaryExport } from '@/components/diary/useDiaryExport'
import { Button, Card } from '@/components/ui'

function openSettings() {
  if (window.location.hash.replace(/^#/, '') !== 'settings') window.location.hash = 'settings'
  window.scrollTo({ top: 0 })
}

/**
 * Records must never feel hostage: everything stays on this device and can be
 * taken out for free at any time (the HTML story here, the full backup in 설정).
 */
export default function KeepCard() {
  const { run, busy, label, count, photoCount } = useDiaryExport()
  const what = !count ? '' : photoCount ? `기록 ${count}개와 사진 ${photoCount}장을 ` : `기록 ${count}개를 `

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          🔒
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-ink">우리 기록은 이 기기에 저장돼요</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            언제든 무료로 내보낼 수 있어요. {what}오래된 순서대로 한 파일에 담아, 브라우저에서 열어 보거나 인쇄·PDF로
            남길 수 있어요.
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Button full variant="secondary" onClick={run} disabled={busy || !count}>
          <span aria-live="polite">{count ? label : '기록이 생기면 내보낼 수 있어요'}</span>
        </Button>
        <Button full variant="ghost" onClick={openSettings}>
          설정에서 전체 백업 받기 (.json)
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        기기를 바꾸거나 브라우저 데이터를 지우기 전에 한 번 받아 두세요. 백업 파일에는 사진이 빠지니, 사진은 ‘우리 이야기
        내보내기’로 함께 남겨 주세요. 파일에는 글과 사진이 그대로 담기니, 다른 사람에게 보낼 때는 한 번 더 확인해 주세요.
      </p>
    </Card>
  )
}
