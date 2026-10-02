'use client'

// "설정 마저 하기" — the four-screen onboarding (N15) no longer asks for the
// birth year, 함께 준비를 시작한 날 or 결혼한 날, so the home offers them once:
// a compact line under 우리 한 줄 naming what is still empty, with a way to
// 설정. Closing it hides it on this device (a convenience, not record data).
// Wording never names the cycle: both phones show the same card.

import { useEffect, useState } from 'react'
import { goToSettings } from '@/components/settings/anchors'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { isISODate } from '@/lib/dates'
import { useApp } from '@/lib/store'

const DISMISSED_KEY = 'dulset:setupCardDismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    /* storage blocked — the card closes for this visit */
  }
}

const link =
  'inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[12.5px] font-bold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export default function SetupCard({ className }: { className?: string }) {
  const { state, me } = useApp()
  // Read after mount: the static export renders without a window.
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => setDismissed(readDismissed()), [])

  const missing: string[] = []
  if (!me.birthYear) missing.push('내 출생연도')
  if (!isISODate(state.settings.ttcStart)) missing.push('함께 준비를 시작한 날')
  if (!isISODate(state.couple.marriedDate)) missing.push('결혼한 날 (있다면)')
  if (dismissed || missing.length === 0) return null

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <section aria-label="설정 마저 하기" className={cx('relative rounded-xl bg-surface-2 py-3 pl-4 pr-12', className)}>
      <div className="flex items-start gap-3">
        <Icon name="gear" className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-5 text-ink">설정 마저 하기</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
            {missing.join(' · ')} — 출생연도와 시작한 날은 전문의 상담 시기를 알려 드릴 때 써요. 지금 아니어도 괜찮아요.
          </p>
          <div className="-mb-2 -ml-1.5 mt-0.5 flex flex-wrap items-center gap-x-2">
            <button type="button" className={link} onClick={() => goToSettings()}>
              설정 열기
            </button>
            <button type="button" className={link} onClick={() => goToSettings('alerts')}>
              내 알림 방식
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Icon name="plus" className="h-[18px] w-[18px] rotate-45" strokeWidth={2} />
      </button>
    </section>
  )
}
