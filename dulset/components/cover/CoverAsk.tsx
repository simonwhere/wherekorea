'use client'

// "첫 화면에 우리 사진을 걸어 볼까요?" — asked once, right after the
// onboarding's 시작하기 (requestCoverAsk in components/Onboarding). [사진 고르기]
// opens the usual 표지 사진 sheet; [나중에] just closes — the home's "우리 사진
// 걸기" button stays there anyway. Never asked when a cover is already hung
// (a restore, the demo) or in the quiet weeks after a loss.

import { useCallback, useEffect, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import CoverSheet from '@/components/cover/CoverSheet'
import { Button, Sheet } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { coverView } from '@/lib/logic/cover'
import { useApp } from '@/lib/store'
import { takeCoverAsk } from './coverAskFlag'

export default function CoverAsk() {
  const { state, today, me } = useApp()
  const [asking, setAsking] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const closeAsk = useCallback(() => setAsking(false), [])
  const closePicker = useCallback(() => setPickerOpen(false), [])
  // The clock hour only picks the drawing's palette.
  const [hour] = useState(() => new Date().getHours())

  useEffect(() => {
    if (!takeCoverAsk()) return
    const view = coverView(state, me.id, today)
    if (view.photo || view.quiet) return
    setAsking(true)
    // Only on the first render after the onboarding; the state then is the one just created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = () => {
    setAsking(false)
    setPickerOpen(true)
  }

  return (
    <>
      <Sheet open={asking} onClose={closeAsk} title="첫 화면에 우리 사진을 걸어 볼까요?">
        <div className="-mt-1 overflow-hidden rounded-[14px] bg-surface-2">
          <div className="relative h-[120px]">
            <CoverArt tod={timeOfDay(hour)} className="absolute inset-0" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          두 사람의 오늘 화면 맨 위에 걸려요.
        </p>
        <div className="mt-4 grid gap-2">
          <Button size="lg" full onClick={pick}>
            <Icon name="img" className="h-[18px] w-[18px]" strokeWidth={2} />
            사진 고르기
          </Button>
          <Button full variant="ghost" onClick={closeAsk}>
            나중에
          </Button>
        </div>
      </Sheet>
      <CoverSheet open={pickerOpen} onClose={closePicker} />
    </>
  )
}
