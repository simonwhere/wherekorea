'use client'

// Last line of defence: if saved data still manages to break a screen, show a
// way out (keep the data as a file, restore a backup, or start over) instead of
// a blank "Application error" on every load. Only those choices (and 다시 시도)
// leave the recovery screen: a state change from elsewhere (the other tab
// saving) must not re-render the broken screen and flicker back here.

import { Component, useState } from 'react'
import RestoreFullBackup from '@/components/system/RestoreFullBackup'
import { Button } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { downloadText } from '@/lib/logic/ics'
import { BACKUP_FILENAME } from '@/lib/logic/settings'
import { useStore } from '@/lib/store'
import { clearDeviceData, rawStoredState } from '@/lib/storage'

interface Props {
  children: React.ReactNode
}

interface State {
  failed: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('둘셋: 화면을 그리는 중 오류가 났어요', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <RecoveryScreen onRetry={() => this.setState({ failed: false })} />
  }
}

function RecoveryScreen({ onRetry }: { onRetry: () => void }) {
  const { replace, setViewer } = useStore()
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [busy, setBusy] = useState(false)
  const raw = rawStoredState()

  const wipe = async () => {
    setBusy(true)
    setViewer('a')
    await clearDeviceData()
    replace(null)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 pb-safe pt-safe">
      <p aria-hidden className="flex justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-ink-2">
          <Icon name="alert" className="h-7 w-7" />
        </span>
      </p>
      <h1 className="mt-3 text-center text-xl font-bold text-ink">화면을 여는 중에 문제가 생겼어요</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-2">
        저장된 기록 중 일부를 읽지 못했어요. 지금 기록을 파일로 받아 두고, 백업 파일로 복원하거나 새로 시작할 수 있어요.
      </p>
      <div className="mt-6 grid gap-2">
        {raw ? (
          <Button full variant="secondary" onClick={() => downloadText(BACKUP_FILENAME, raw, 'application/json')}>
            지금 기록을 파일로 받기
          </Button>
        ) : null}
        <RestoreFullBackup label="백업 파일로 복원하기 (.zip · .json)" variant="primary" onRestored={onRetry} />
        <Button full variant="ghost" onClick={onRetry}>
          다시 시도하기
        </Button>
      </div>
      <div className="mt-6 border-t border-line pt-4">
        {confirmWipe ? (
          <div role="group" aria-labelledby="wipe-q" className="grid gap-2">
            <p id="wipe-q" className="text-sm leading-relaxed text-ink">
              이 기기의 둘셋 기록을 모두 지우고 처음 화면으로 돌아갈까요? 되돌릴 수 없어요.
            </p>
            <Button full variant="danger" onClick={() => void wipe()} disabled={busy}>
              {busy ? '지우는 중…' : '모두 지우기'}
            </Button>
            <Button full variant="ghost" onClick={() => setConfirmWipe(false)} disabled={busy}>
              그만둘게요
            </Button>
          </div>
        ) : (
          <Button full variant="danger" onClick={() => setConfirmWipe(true)}>
            모든 기록 지우고 새로 시작하기
          </Button>
        )}
      </div>
    </main>
  )
}
