'use client'

import { useEffect, useRef, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import Polaroid from '@/components/cover/Polaroid'
import WelcomeRestore from '@/components/onboarding/WelcomeRestore'
import { Button } from '@/components/ui'
import type { Stage } from '@/lib/types'

// Preparing comes first (founder direction); pregnancy / baby / 기록장 follow later.
// One-line bodies so the start button stays on the first screen.
const VALUE_PROPS = [
  { emoji: '✅', tile: 'bg-ok-soft', title: '매일 할 일은 짧게, 서로 챙기기', body: '엽산·걷기처럼 하루 1~2개만, 서로 응원해요' },
  { emoji: '💞', tile: 'bg-fert-soft', title: '가임기 예상을 두 사람에게', body: '‘우리의 주간’처럼 각자 편한 말투로 받아요' },
  { emoji: '🏥', tile: 'bg-brand-soft', title: '검사·신청 기한까지 함께', body: '가임력 검사 신청부터 청구까지 둘이 봐요' },
  { emoji: '🔒', tile: 'bg-him-soft', title: '자세한 기록은 허용할 때만', body: '생리일·테스트 결과는 기록하는 사람이 정해요' },
] as const

const DEMOS: Array<{ stage: Stage; emoji: string; label: string }> = [
  { stage: 'preparing', emoji: '🌱', label: '준비 중' },
  { stage: 'pregnant', emoji: '🤰', label: '임신 중' },
  { stage: 'parenting', emoji: '👶', label: '육아 중' },
]

/** Two overlapping circles and a small glow dot — "둘이 셋이 되기까지". The app's only 둘→셋 symbol. */
function Mark() {
  return (
    <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="12" cy="17" r="11" fill="rgb(var(--him))" opacity=".78" />
      <circle cx="25" cy="17" r="11" fill="rgb(var(--her))" opacity=".72" />
      <circle cx="38" cy="6" r="5" fill="rgb(var(--glow))" />
    </svg>
  )
}

export default function WelcomeStep({
  onStart,
  onDemo,
  focusTitle,
}: {
  onStart: () => void
  onDemo: (stage: Stage) => void
  /** Move focus here when coming back from step 1 (the 뒤로 button is gone). */
  focusTitle?: boolean
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) titleRef.current?.focus({ preventScroll: true })
  }, [focusTitle])

  // The clock hour only picks the illustration's palette.
  const [hour] = useState(() => new Date().getHours())

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe pt-safe">
      <div className="pb-10 pt-7">
        {/* A preview of the home's cover: the couple's own photo will hang here. */}
        <div className="welcome-cover mt-2.5 px-3">
          <Polaroid
            caption={
              <>
                <span className="text-[13px] font-semibold text-ink-2">여기에 우리 사진을 걸 수 있어요</span>
                <span aria-hidden className="text-[12.5px]">
                  📷
                </span>
              </>
            }
          >
            <CoverArt tod={timeOfDay(hour)} />
          </Polaroid>
        </div>

        <div className="mt-7 flex items-center gap-2.5">
          <Mark />
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="text-[38px] font-extrabold leading-none tracking-[-0.05em] text-ink outline-none"
          >
            둘셋
          </h1>
        </div>
        <p className="mt-2 text-[18px] font-bold tracking-[-0.03em] text-ink-2">둘이 셋이 되기까지, 함께</p>

        <ul className="mt-[22px]">
          {VALUE_PROPS.map((v) => (
            <li key={v.title} className="flex items-center gap-3 py-[9px]">
              <span
                aria-hidden
                className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[19px] ${v.tile}`}
              >
                {v.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-[1.35] tracking-[-0.025em] text-ink">{v.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-3">{v.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          full
          onClick={onStart}
          // ! because Button's own radius/type classes can sort later in the CSS.
          className="mt-[18px] h-[54px] !rounded-full !text-[17px] !font-extrabold tracking-[-0.02em]"
        >
          시작하기
        </Button>
        {/* Restoring shouldn't need a demo or a whole new onboarding first; it ends with "이 폰은 누구 거예요?". */}
        <div className="mt-1 [&>button]:h-12 [&>button]:rounded-full [&>button]:text-[14.5px] [&>button]:font-bold">
          <WelcomeRestore label="백업 파일로 복원하기" />
        </div>

        <section aria-labelledby="demo-title" className="mt-[18px] rounded-[22px] bg-surface-2 p-4">
          <h2 id="demo-title" className="text-[14.5px] font-extrabold text-ink">
            예시로 둘러보기
          </h2>
          <p className="mt-1 text-[12.5px] leading-normal text-ink-3">
            가상의 커플 민수·지은의 기록으로 미리 볼 수 있어요. 주기를 기록하는 지은님 화면에서 시작하고, 위쪽 ⇄로 민수님
            화면도 볼 수 있어요. 둘러본 뒤 설정에서 지우고 새로 시작하면 돼요.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.stage}
                type="button"
                onClick={() => onDemo(d.stage)}
                className="flex h-[46px] items-center justify-center gap-1 rounded-[14px] bg-surface px-2 text-sm font-bold text-ink-2 hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand forced-colors:border forced-colors:border-line"
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
