'use client'

// "백업 파일 불러오기" — shared by 설정 › 데이터, the welcome screen (after a
// wipe or cleared browser data) and the recovery screen, so every entry point
// runs the same check → summary → confirm flow.

import { useCallback, useRef, useState } from 'react'
import { ConfirmActions } from '@/components/settings/bits'
import { Button, Sheet } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { backupSummary } from '@/lib/logic/settings'
import { useStore } from '@/lib/store'
import { BACKUP_ERROR_TEXT, readBackupFile } from '@/lib/storage'
import type { AppState } from '@/lib/types'

export default function RestoreBackup({
  label = '백업 파일 불러오기',
  variant = 'secondary',
  onMessage,
  onRestored,
}: {
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Where to show errors / success (e.g. the app toast). Defaults to a line under the button. */
  onMessage?: (text: string) => void
  onRestored?: () => void
}) {
  const { replace } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<AppState | null>(null)
  const [note, setNote] = useState('')
  // Stable, so the Sheet doesn't re-focus its panel on every render.
  const cancel = useCallback(() => setPending(null), [])

  const say = (text: string) => (onMessage ? onMessage(text) : setNote(text))

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again
    if (!file) return
    const result = await readBackupFile(file)
    if ('error' in result) {
      say(BACKUP_ERROR_TEXT[result.error])
      return
    }
    setNote('')
    setPending(result.state)
  }

  const confirm = () => {
    if (!pending) return
    const next = pending
    setPending(null)
    replace(next)
    if (onMessage) onMessage('백업을 불러왔어요')
    onRestored?.()
  }

  return (
    <>
      <Button full variant={variant} onClick={() => fileRef.current?.click()}>
        {label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e)}
      />
      {onMessage ? null : (
        <p role="status" className="text-center text-xs leading-relaxed text-period empty:hidden">
          {note}
        </p>
      )}
      <Sheet open={!!pending} onClose={cancel} title="백업을 불러올까요?">
        {pending ? <ImportConfirm next={pending} onConfirm={confirm} onCancel={cancel} /> : null}
      </Sheet>
    </>
  )
}

export function ImportConfirm({ next, onConfirm, onCancel }: { next: AppState; onConfirm: () => void; onCancel: () => void }) {
  const sum = backupSummary(next)
  return (
    <div>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5 rounded-xl bg-surface-2 p-3 text-xs">
        <dt className="font-semibold text-ink-3">두 사람</dt>
        <dd className="text-ink">{sum.names}</dd>
        <dt className="font-semibold text-ink-3">단계</dt>
        <dd className="text-ink">{sum.stage}</dd>
        <dt className="font-semibold text-ink-3">기록</dt>
        <dd className="text-ink">
          생리 {sum.periods}번 · 체크 {sum.checkDays}일 · 일기 {sum.diary}개
        </dd>
        {sum.createdAt ? (
          <>
            <dt className="font-semibold text-ink-3">시작한 날</dt>
            <dd className="text-ink">{formatKo(sum.createdAt, { year: true })}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-ink">지금 이 기기의 기록이 백업 내용으로 바뀌어요.</p>
      {sum.photos > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          사진 {sum.photos}장은 백업에 들어 있지 않아서, 이 기기에 없는 사진은 보이지 않을 수 있어요.
        </p>
      ) : null}
      <ConfirmActions confirmLabel="불러오기" onConfirm={onConfirm} onCancel={onCancel} cancelLabel="취소" />
    </div>
  )
}
