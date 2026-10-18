'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import RestoreFullBackup from '@/components/system/RestoreFullBackup'
import { Button, Card, Sheet, useToast } from '@/components/ui'
import { IconTile } from '@/components/ui/icons'
import { downloadText } from '@/lib/logic/ics'
import { BACKUP_FILENAME } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { buildFullBackup, deliverFile, fullBackupFilename, markBackedUp, photoIdsInState } from '@/lib/persist'
import { exportPhotos } from '@/lib/photos'
import { useApp } from '@/lib/store'
import { clearDeviceData } from '@/lib/storage'
import { ConfirmActions, SettingsSection } from './bits'

const noop = () => {}

export default function DataSection() {
  const { state, replace, setViewer, today } = useApp()
  const toast = useToast()
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0)
  const [busy, setBusy] = useState(false)
  const [packing, setPacking] = useState(false)
  // Stable callbacks: Sheet re-focuses its panel whenever onClose changes.
  const closeWipe = useCallback(() => setWipeStep(0), [])
  // Each wipe step swaps the sheet's content; put focus on the new step's text
  // (not on <body>, and not straight onto the destructive button).
  const stepRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (wipeStep === 2) stepRef.current?.focus()
  }, [wipeStep])

  const photoCount = photoIdsInState(state).length

  /** 전체 백업: the record plus every photo this device still has, as one .zip. */
  const exportFull = async () => {
    if (packing) return
    setPacking(true)
    let blob: Blob
    let packed = 0
    try {
      const photos = await exportPhotos(photoIdsInState(state))
      packed = photos.length
      const bytes = buildFullBackup(state, photos, new Date())
      blob = new Blob([bytes as BlobPart], { type: 'application/zip' })
    } catch {
      setPacking(false)
      toast.show('백업 파일을 만들지 못했어요. 잠시 뒤 다시 해 주세요')
      return
    }
    // iOS: the share sheet, and "backed up" only once it resolves (lib/persist deliverFile).
    const result = await deliverFile(blob, fullBackupFilename(today))
    setPacking(false)
    if (result === 'shared' || result === 'downloaded') {
      // Resets the weekly "백업한 지 N일" nudge (BackupBanner / InstallBackupCard) on this device.
      markBackedUp(stampOn(today))
      const photosNote = packed > 0 ? ` · 사진 ${packed}장` : ''
      toast.show(result === 'shared' ? `백업 파일을 보냈어요${photosNote}` : `백업 파일을 저장했어요${photosNote}`)
    } else if (result === 'cancelled') {
      toast.show('백업을 취소했어요')
    } else {
      toast.show('백업 파일을 저장하지 못했어요. 잠시 뒤 다시 해 주세요')
    }
  }

  /** 기록만 (.json): small, opens anywhere — the photos stay on this device. */
  const exportJson = async () => {
    let blob: Blob
    try {
      blob = new Blob([JSON.stringify(state)], { type: 'application/json' })
    } catch {
      toast.show('백업 파일을 만들지 못했어요. 잠시 뒤 다시 해 주세요')
      return
    }
    const result = await deliverFile(blob, BACKUP_FILENAME)
    if (result === 'shared' || result === 'downloaded') {
      markBackedUp(stampOn(today))
      toast.show(result === 'shared' ? '기록 파일을 보냈어요' : '기록 파일을 저장했어요')
    } else if (result === 'cancelled') {
      toast.show('백업을 취소했어요')
    } else {
      // Last resort: the plain download link.
      try {
        downloadText(BACKUP_FILENAME, JSON.stringify(state), 'application/json')
        markBackedUp(stampOn(today))
        toast.show('기록 파일을 저장했어요')
      } catch {
        toast.show('백업 파일을 저장하지 못했어요. 잠시 뒤 다시 해 주세요')
      }
    }
  }

  const wipe = async () => {
    setBusy(true)
    setViewer('a')
    await clearDeviceData()
    // Removes the main state; the other tab (partner's "phone") follows via the storage event.
    replace(null)
  }

  return (
    <SettingsSection id="data" title="데이터와 개인정보">
      <div className="grid gap-2">
        <Card>
          <div className="flex items-start gap-3">
            <IconTile name="box" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-ink">백업</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                브라우저 데이터를 지우면 기록도 함께 지워져요. 일주일에 한 번 백업해 두세요.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button full variant="secondary" onClick={() => void exportFull()} disabled={packing}>
              {packing
                ? '백업 파일 만드는 중…'
                : photoCount > 0
                  ? `전체 백업 받기 (기록 + 사진 ${photoCount}장, .zip)`
                  : '전체 백업 받기 (.zip)'}
            </Button>
            <RestoreFullBackup label="백업 파일 불러오기 (.zip · .json)" onMessage={toast.show} />
            <Button full variant="ghost" onClick={() => void exportJson()}>
              기록만 .json으로 받기
            </Button>
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <Button full variant="danger" onClick={() => setWipeStep(1)}>
              모든 기록 지우기
            </Button>
          </div>
        </Card>

      </div>

      <Sheet open={wipeStep > 0} onClose={busy ? noop : closeWipe} title="모든 기록 지우기">
        {wipeStep === 1 ? (
          <div>
            <p className="text-sm leading-relaxed text-ink">이 기기의 기록과 사진이 모두 지워지고, 되돌릴 수 없어요.</p>
            <div className="mt-5 grid gap-2">
              <Button full variant="secondary" onClick={() => void exportFull()} disabled={packing}>
                {packing ? '백업 파일 만드는 중…' : '먼저 전체 백업 받기'}
              </Button>
              <Button full variant="danger" onClick={() => setWipeStep(2)}>
                다음
              </Button>
              <Button full variant="ghost" onClick={closeWipe}>
                그만둘게요
              </Button>
            </div>
          </div>
        ) : null}
        {wipeStep === 2 ? (
          <div>
            <p ref={stepRef} tabIndex={-1} className="text-sm font-semibold leading-relaxed text-ink outline-none">
              정말 모두 지울까요?
            </p>
            <ConfirmActions
              variant="danger"
              confirmLabel={busy ? '지우는 중…' : '모두 지우기'}
              onConfirm={() => void wipe()}
              onCancel={closeWipe}
              cancelLabel="그만둘게요"
              busy={busy}
            />
          </div>
        ) : null}
      </Sheet>
    </SettingsSection>
  )
}
