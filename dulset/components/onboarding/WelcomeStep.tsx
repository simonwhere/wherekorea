'use client'

import { useEffect, useRef } from 'react'
import RestoreBackup from '@/components/RestoreBackup'
import { Button } from '@/components/ui'
import type { Stage } from '@/lib/types'

const VALUE_PROPS = [
  { emoji: '✅', title: '매일 영양제·습관 서로 체크', body: '엽산·생활습관을 같이 챙기고, 콕 찔러 응원해요.' },
  { emoji: '💞', title: '가임기를 두 사람에게 같이 알려 줘요', body: '부담 없이, 각자 편한 말투로 받아요.' },
  {
    emoji: '🏥',
    title: '병원·검사·신청까지 함께 챙기기',
    body: '임신 준비부터 출산 뒤까지, 챙길 것과 병원 예약을 둘이 같이 봐요.',
  },
  {
    emoji: '📔',
    title: '비트윈처럼 둘이 쌓는 기록장',
    body: '만난 날과 기념일, 사진과 일기가 아기가 생긴 뒤에도 한 권으로 이어져요.',
  },
] as const

const DEMOS: Array<{ stage: Stage; emoji: string; label: string }> = [
  { stage: 'preparing', emoji: '🌱', label: '준비 중' },
  { stage: 'pregnant', emoji: '🤰', label: '임신 중' },
  { stage: 'parenting', emoji: '👶', label: '육아 중' },
]

/** Two circles and a smaller third one — "둘이 셋이 되기까지". */
function Mark() {
  return (
    <div aria-hidden className="relative mx-auto h-16 w-24">
      <span className="absolute left-1 top-2 h-12 w-12 rounded-full bg-him/80" />
      <span className="absolute left-8 top-2 h-12 w-12 rounded-full bg-her/75" />
      <span className="absolute right-0 top-0 h-6 w-6 rounded-full bg-brand ring-4 ring-bg" />
    </div>
  )
}

export default function WelcomeStep({
  onStart,
  onDemo,
  onRestored,
  focusTitle,
}: {
  onStart: () => void
  onDemo: (stage: Stage) => void
  /** After a backup was restored from here (e.g. after a wipe or cleared browser data). */
  onRestored: () => void
  /** Move focus here when coming back from step 1 (the 뒤로 button is gone). */
  focusTitle?: boolean
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus({ preventScroll: true })
  }, [focusTitle])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe pt-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <Mark />
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="mt-5 text-center text-4xl font-extrabold tracking-tight text-brand outline-none"
        >
          둘셋
        </h1>
        <p className="mt-2 text-center text-base font-medium text-ink-2">둘이 셋이 되기까지, 함께</p>

        <ul className="mt-9 space-y-3">
          {VALUE_PROPS.map((v) => (
            <li key={v.title} className="flex items-start gap-3 rounded-xl2 border border-line bg-surface p-3.5 shadow-card">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xl">
                {v.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{v.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{v.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-5 pb-4">
        <div className="grid gap-2">
          <Button size="lg" full onClick={onStart}>
            시작하기
          </Button>
          {/* Restoring shouldn't need a demo or a whole new onboarding first. */}
          <RestoreBackup label="백업 파일로 복원하기" variant="ghost" onRestored={onRestored} />
        </div>

        <section aria-labelledby="demo-title" className="rounded-xl2 bg-surface-2 p-3.5">
          <h2 id="demo-title" className="text-sm font-bold text-ink">
            예시로 둘러보기
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            가상의 커플 민수·지은의 기록으로 미리 볼 수 있어요. 둘러본 뒤 설정에서 지우고 새로 시작하면 돼요.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.stage}
                type="button"
                onClick={() => onDemo(d.stage)}
                className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 text-sm font-semibold text-ink-2 hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden>{d.emoji}</span>
                {d.label}
                <span className="sr-only"> 예시 보기</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
