'use client'

// "백업 파일 불러오기" for both kinds of backup: the full .zip (기록 + 사진,
// N16) and the plain .json — shared by 설정 › 데이터, the welcome screen and
// the recovery screen. Check → summary → confirm → "이 폰은 누구 거예요?"
// (the phone opens on the person who restored it, remembered per device —
// review P-7), then the photos go back into IndexedDB under their ids before
// the record is replaced, so the album and cover find them.

import { useCallback, useRef, useState } from 'react'
import { WhosePhoneChooser } from '@/components/onboarding/WhosePhoneSheet'
import { rememberDeviceViewer } from '@/components/onboarding/deviceViewer'
import { ConfirmActions } from '@/components/settings/bits'
import { Button, Sheet } from '@/components/ui'
import { formatKo } from '@/lib/dates'
import { backupSummary } from '@/lib/logic/settings'
import { BACKUP_READ_ERROR_TEXT, readAnyBackup, type AnyBackup } from '@/lib/persist'
import { restorePhotos } from '@/lib/photos'
import { useStore } from '@/lib/store'
import type { MemberId } from '@/lib/types'

type Page = 'confirm' | 'whose'

export default function RestoreFullBackup({
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
  const { replace, setViewer, viewer } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<AnyBackup | null>(null)
  const [page, setPage] = useState<Page>('confirm')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  // Stable, so the Sheet doesn't re-focus its panel on every render.
  const cancel = useCallback(() => {
    setPending(null)
    setPage('confirm')
  }, [])
  const noop = useCallback(() => {}, [])

  const say = (text: string) => (onMessage ? onMessage(text) : setNote(text))

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again
    if (!file) return
    const result = await readAnyBackup(file)
    if ('error' in result) {
      say(BACKUP_READ_ERROR_TEXT[result.error])
      return
    }
    setNote('')
    setPage('confirm')
    setPending(result)
  }

  const finish = async (id: MemberId) => {
    if (!pending || busy) return
    setBusy(true)
    const { state, photos } = pending
    // Photos first: when the record lands, the pictures it points to are there.
    const landed = photos.length ? await restorePhotos(photos) : 0
    setPending(null)
    setPage('confirm')
    setBusy(false)
    setViewer(id)
    rememberDeviceViewer(id)
    replace(state)
    if (onMessage) {
      onMessage(
        photos.length === 0
          ? '백업을 불러왔어요'
          : landed === photos.length
            ? `백업을 불러왔어요 · 사진 ${landed}장`
            : landed === 0
              ? '백업을 불러왔어요. 사진은 이 브라우저에 저장하지 못했어요'
              : `백업을 불러왔어요 · 사진 ${landed}/${photos.length}장`,
      )
    }
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
        accept="application/zip,application/x-zip-compressed,application/json,.zip,.json"
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
      <Sheet open={!!pending} onClose={busy ? noop : cancel} title={page === 'whose' ? '이 폰은 누구 거예요?' : '백업을 불러올까요?'}>
        {pending && page === 'confirm' ? (
          <ImportConfirm backup={pending} busy={busy} onConfirm={() => setPage('whose')} onCancel={cancel} />
        ) : null}
        {pending && page === 'whose' ? (
          <WhosePhoneChooser
            members={pending.state.couple.members}
            current={viewer}
            onPick={(id) => void finish(id)}
            note="불러온 기록을 누구의 화면으로 열까요? 이 폰은 앞으로 그 사람 화면으로 열려요."
          />
        ) : null}
      </Sheet>
    </>
  )
}

export function ImportConfirm({
  backup,
  busy,
  onConfirm,
  onCancel,
}: {
  backup: AnyBackup
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const sum = backupSummary(backup.state)
  const packed = backup.photos.length
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
        {packed > 0 ? (
          <>
            <dt className="font-semibold text-ink-3">사진</dt>
            <dd className="text-ink">{packed}장 (함께 되살려요)</dd>
          </>
        ) : null}
        {sum.createdAt ? (
          <>
            <dt className="font-semibold text-ink-3">시작한 날</dt>
            <dd className="text-ink">{formatKo(sum.createdAt, { year: true })}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-ink">지금 이 기기의 기록이 백업 내용으로 바뀌어요.</p>
      {packed === 0 && sum.photos > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          사진 {sum.photos}장은 이 백업에 들어 있지 않아서, 이 기기에 없는 사진은 보이지 않을 수 있어요. 사진까지 옮기려면 ‘전체
          백업(.zip)’으로 받아 주세요.
        </p>
      ) : null}
      <ConfirmActions confirmLabel={busy ? '불러오는 중…' : '불러오기'} onConfirm={onConfirm} onCancel={onCancel} cancelLabel="취소" busy={busy} />
    </div>
  )
}
