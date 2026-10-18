'use client'

// 설정 › 정보: what this build is (not a medical device), its version, and —
// since N27 — the other stages' examples. The first screen offers only '준비 중
// 예시 보기' (the product is the preparing couple's); '임신 중' and '육아 중'
// live here, behind one confirm, because opening an example replaces what is
// on this phone (window.confirm is not used — AGENTS.md).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Sheet } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { useApp } from '@/lib/store'
import { clearDeviceData } from '@/lib/storage'
import type { Stage } from '@/lib/types'
import { goToSettings } from './anchors'
import { ConfirmActions, SettingsSection } from './bits'

export const APP_VERSION = '0.1'

/** The examples that left the first screen (N27). */
export const OTHER_STAGE_DEMOS: ReadonlyArray<{ stage: Exclude<Stage, 'preparing'>; icon: IconName; label: string }> = [
  { stage: 'pregnant', icon: 'bump', label: '임신 중 예시' },
  { stage: 'parenting', icon: 'baby', label: '육아 중 예시' },
]

const noop = () => {}

export default function AboutSection() {
  const { today, replace, setViewer } = useApp()
  const [asking, setAsking] = useState<Exclude<Stage, 'preparing'> | null>(null)
  const [busy, setBusy] = useState(false)
  const close = useCallback(() => setAsking(null), [])
  const textRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (asking) textRef.current?.focus({ preventScroll: true })
  }, [asking])

  const open = async (stage: Exclude<Stage, 'preparing'>) => {
    setBusy(true)
    try {
      // The demo couple's data is its own chunk, fetched only here and on the first screen.
      const { DEMO_START_VIEWER, createDemoState } = await import('@/lib/demo')
      const demo = createDemoState(today, new Date(), stage)
      // The same clean slate as 모두 지우기 (photos, this phone's link record, the viewer), then the example.
      await clearDeviceData()
      setViewer(DEMO_START_VIEWER)
      replace(demo)
      window.location.hash = 'today'
      window.scrollTo({ top: 0 })
    } finally {
      setBusy(false)
      setAsking(null)
    }
  }

  const label = OTHER_STAGE_DEMOS.find((d) => d.stage === asking)?.label ?? ''

  return (
    <SettingsSection id="about" title="정보">
      <div className="grid gap-2">
        <Card tone="muted">
          <p className="text-sm leading-relaxed text-ink">
            둘셋은 의료기기가 아니에요. 날짜 예상은 참고용이라 진단·치료나 피임에 쓰면 안 돼요. 걱정되면 전문의와 상담하세요.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3">
            <span className="font-bold text-ink">둘셋</span>
            <span className="tabular-nums">버전 {APP_VERSION}</span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-ink">다른 단계 예시</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {OTHER_STAGE_DEMOS.map((d) => (
              <Button key={d.stage} variant="secondary" onClick={() => setAsking(d.stage)}>
                <Icon name={d.icon} className="h-[18px] w-[18px] text-ink-3" />
                {d.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      <Sheet open={asking !== null} onClose={busy ? noop : close} title={`${label} 열기`}>
        <p ref={textRef} tabIndex={-1} className="text-sm leading-relaxed text-ink outline-none">
          지금 기록은 지워지고 되돌릴 수 없어요.
        </p>
        <Button
          full
          variant="ghost"
          className="mt-3"
          onClick={() => {
            close()
            goToSettings('data')
          }}
          disabled={busy}
        >
          먼저 백업하러 가기
        </Button>
        <ConfirmActions
          variant="danger"
          confirmLabel={busy ? '여는 중…' : '지우고 예시 열기'}
          onConfirm={() => asking && void open(asking)}
          onCancel={close}
          cancelLabel="그만둘게요"
          busy={busy}
        />
      </Sheet>
    </SettingsSection>
  )
}
