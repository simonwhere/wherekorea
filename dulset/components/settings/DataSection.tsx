'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import RestoreBackup from '@/components/RestoreBackup'
import { Button, Card, Sheet, useToast } from '@/components/ui'
import { downloadText } from '@/lib/logic/ics'
import { BACKUP_FILENAME } from '@/lib/logic/settings'
import { useApp } from '@/lib/store'
import { clearDeviceData } from '@/lib/storage'
import { ConfirmActions, SettingsSection } from './bits'

const noop = () => {}

/** Per-tab "whose phone" key (lib/storage.ts keeps it private). */

const PRINCIPLES: ReadonlyArray<{ icon: string; title: string; body: string }> = [
  {
    icon: '🔒',
    title: '민감정보는 따로 동의받기',
    body: '생리 주기·가임기 같은 건강 정보는 개인정보보호법(제23조)의 민감정보예요. 다른 동의와 분리해 별도로 동의를 받아요.',
  },
  {
    icon: '💑',
    title: '파트너 공유도 항목별로',
    body: '상대에게 보여 주는 것도 사실상 ‘제공’이라, 연결은 두 사람 모두 수락해야 이뤄지고 어떤 항목을 나눌지 각자에게 따로 물어요. 연결을 끊으면 공유가 바로 멈춰요.',
  },
  {
    icon: '🚫',
    title: '광고·분석 SDK에 건강 데이터 보내지 않기',
    body: '생리 기록이 제3자 SDK로 흘러가 문제가 된 Flo 사례(미국 FTC 합의, 2021)의 교훈이에요.',
  },
  {
    icon: '🛡️',
    title: '암호화와 최소 수집',
    body: '보낼 때도 저장할 때도 암호화하고, 필요한 것만 모아요.',
  },
  {
    icon: '🗑️',
    title: '언제든 내보내고 지우기',
    body: '내 기록은 언제든 파일로 받거나 완전히 지울 수 있어야 해요.',
  },
]

export default function DataSection() {
  const { state, replace, setViewer } = useApp()
  const toast = useToast()
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0)
  const [busy, setBusy] = useState(false)
  // Stable callbacks: Sheet re-focuses its panel whenever onClose changes.
  const closeWipe = useCallback(() => setWipeStep(0), [])
  // Each wipe step swaps the sheet's content; put focus on the new step's text
  // (not on <body>, and not straight onto the destructive button).
  const stepRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (wipeStep === 2) stepRef.current?.focus()
  }, [wipeStep])

  const exportBackup = () => {
    downloadText(BACKUP_FILENAME, JSON.stringify(state), 'application/json')
    toast.show('백업 파일을 저장했어요')
  }

  const wipe = async () => {
    setBusy(true)
    setViewer('a')
    await clearDeviceData()
    // Removes the main state; the other tab (partner's "phone") follows via the storage event.
    replace(null)
  }

  return (
    <SettingsSection title="데이터와 개인정보">
      <div className="grid gap-2">
        <Card>
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-2xl">
              📱
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-ink">이 기기에만 저장돼요</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                지금은 모든 기록이 이 브라우저 안에만 있어요. 서버로 보내지 않아요. 대신 브라우저 데이터를 지우면 함께 사라지니,
                가끔 백업 파일을 받아 두세요.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button full variant="secondary" onClick={exportBackup}>
              백업 파일 내보내기 (.json)
            </Button>
            <RestoreBackup onMessage={toast.show} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            사진은 크기 때문에 백업 파일에 들어가지 않아요. 사진이 담긴 일기는 일기 탭의 ‘우리 이야기 내보내기’로 따로 남길 수 있어요.
          </p>

          <div className="mt-3 border-t border-line pt-3">
            <Button full variant="danger" onClick={() => setWipeStep(1)}>
              모든 기록 지우기
            </Button>
          </div>
        </Card>

        <Card tone="muted">
          <h3 className="text-sm font-bold text-ink">실제 앱에서 지킬 약속</h3>
          <p className="mt-0.5 text-[11px] text-ink-3">서버와 계정이 생기면 이렇게 다룰게요</p>
          <ul className="mt-3 space-y-2.5">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="flex gap-2.5">
                <span aria-hidden className="text-base leading-5">
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">{p.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Sheet open={wipeStep > 0} onClose={busy ? noop : closeWipe} title="모든 기록 지우기">
        {wipeStep === 1 ? (
          <div>
            <p className="text-sm leading-relaxed text-ink">
              두 사람의 체크, 생리 기록, 일기와 사진, 알림이 이 기기에서 모두 지워져요. 지운 뒤에는 되돌릴 수 없어요.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">남겨 두고 싶은 기록이 있다면 먼저 백업 파일을 받아 두세요.</p>
            <div className="mt-5 grid gap-2">
              <Button full variant="secondary" onClick={exportBackup}>
                먼저 백업 파일 받기
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
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              지우고 나면 처음 시작 화면으로 돌아가요. 다른 탭에 열어 둔 둘셋도 함께 초기화돼요.
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
