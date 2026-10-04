'use client'

import { useEffect, useRef, useState } from 'react'
import CoverArt, { timeOfDay } from '@/components/cover/CoverArt'
import Polaroid from '@/components/cover/Polaroid'
import WelcomeRestore from '@/components/onboarding/WelcomeRestore'
import { Button } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import type { Stage } from '@/lib/types'

// The one line (docs/positioning.md §1, founder decision 2026-10-03) and,
// always right under it, the sub-copy that says who it is for — couples,
// engaged and common-law couples alike. It replaced the four value rows (N27).
export const WELCOME_LINE = '남편이 같이 하는 임신 준비'
export const WELCOME_SUB = '기록하는 사람 혼자 챙기지 않게 — 부부·예비부부·사실혼, 함께 준비하는 두 사람 누구나'

/** The fifth promise (review G11), one short line so 시작하기 still sits above the fold at 375×667. */
const NO_ADS_LINE = '광고도, 추적 SDK도 없어요 · 기록은 이 폰에만'

// Only the preparing couple here: the 임신 중 · 육아 중 examples moved to
// 설정 › 정보 (N27 — a first look of '커플 앱 + 임신 앱' is not the product).
const DEMO: { stage: Stage; icon: IconName; label: string } = { stage: 'preparing', icon: 'sprout', label: '준비 중 예시 보기' }

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
                <Icon name="cam" className="h-4 w-4 text-ink-3" />
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
        <p className="mt-3 text-[21px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink">{WELCOME_LINE}</p>
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-ink-2 [word-break:keep-all]">{WELCOME_SUB}</p>
        <p className="mt-4 flex items-center gap-2 text-[12.5px] font-semibold leading-[1.45] text-ink-2">
          <Icon name="ban" className="h-[18px] w-[18px] shrink-0 text-ink-3" strokeWidth={2} />
          {NO_ADS_LINE}
        </p>

        <Button
          size="lg"
          full
          onClick={onStart}
          // ! because Button's own radius/type classes can sort later in the CSS.
          className="mt-3.5 h-[54px] !rounded-full !text-[17px] !font-extrabold tracking-[-0.02em]"
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
          <button
            type="button"
            onClick={() => onDemo(DEMO.stage)}
            className="mt-3 flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[14px] bg-surface px-3 text-sm font-bold text-ink-2 hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand forced-colors:border forced-colors:border-line"
          >
            <Icon name={DEMO.icon} className="h-[18px] w-[18px] text-ink-3" />
            {DEMO.label}
          </button>
          <p className="mt-2 text-[11.5px] leading-normal text-ink-3">임신 중·육아 중 예시는 둘러보는 중에 설정 › 정보에서 열 수 있어요.</p>
        </section>
      </div>
    </main>
  )
}
