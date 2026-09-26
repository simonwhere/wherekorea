'use client'

// First-run flow: welcome (or a demo couple) → 우리 둘 → 주기 → 시작 시점 →
// 알림 방식 → 개인정보 → 초대 코드. Answers live in a draft (lib/demo.ts) and
// become the app state only on the last "시작하기".

import { useCallback, useEffect, useRef, useState } from 'react'
import AlertStep from '@/components/onboarding/AlertStep'
import ConsentStep from '@/components/onboarding/ConsentStep'
import CoupleStep from '@/components/onboarding/CoupleStep'
import CycleStep from '@/components/onboarding/CycleStep'
import DoneStep from '@/components/onboarding/DoneStep'
import StartStep from '@/components/onboarding/StartStep'
import WelcomeStep from '@/components/onboarding/WelcomeStep'
import { ProgressDots } from '@/components/onboarding/parts'
import { Button } from '@/components/ui'
import {
  ONBOARDING_STEPS,
  createDemoState,
  draftNames,
  draftToChoices,
  initialDraft,
  stateFromOnboarding,
  stepProblem,
  type OnboardingDraft,
} from '@/lib/demo'
import { inviteCode } from '@/lib/id'
import { useStore } from '@/lib/store'
import type { Stage } from '@/lib/types'

function stepMeta(step: number, partner: string): { title: string; sub?: string } {
  switch (step) {
    case 1:
      return { title: '우리 둘을 소개해 주세요', sub: '서로 부르는 이름이나 애칭이면 돼요.' }
    case 2:
      return { title: '주기를 알려 주세요', sub: '가임기 예상에 쓰여요. 몰라도 괜찮아요, 나중에 달력에서 기록하면 돼요.' }
    case 3:
      return { title: '언제부터 함께 준비했나요?', sub: '오래 준비했는데 소식이 없으면, 전문의 상담 시기를 알려 드려요.' }
    case 4:
      return { title: '가임기 소식은 어떻게 받을까요?', sub: '각자 편한 방식으로 골라요. 언제든 설정에서 바꿀 수 있어요.' }
    case 5:
      return { title: '기록은 이렇게 지켜요', sub: '시작하기 전에 확인해 주세요.' }
    default:
      return { title: '준비됐어요! 이제 둘이 함께예요', sub: `${partner}님과 연결하는 방법이에요.` }
  }
}

export default function Onboarding() {
  const { replace, today, setViewer } = useStore()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft)
  // One code for the whole flow, so going back and forth doesn't change it.
  const [code] = useState(() => inviteCode())
  const headingRef = useRef<HTMLHeadingElement>(null)
  // True once the user went back to the welcome screen, so focus lands on it.
  const [cameBack, setCameBack] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (step > 0) headingRef.current?.focus({ preventScroll: true })
  }, [step])

  const patch = useCallback((p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p })), [])

  const startDemo = (stage: Stage) => {
    setViewer('a')
    replace(createDemoState(today, new Date(), stage))
  }

  if (step === 0) return <WelcomeStep onStart={() => setStep(1)} onDemo={startDemo} focusTitle={cameBack} />

  const names = draftNames(draft)
  const problem = stepProblem(step, draft, today)
  const last = step === ONBOARDING_STEPS
  const meta = stepMeta(step, names.b)

  const next = () => {
    if (problem) return
    if (!last) {
      setStep(step + 1)
      return
    }
    const choices = draftToChoices(draft, today)
    if (!choices) {
      setStep(1)
      return
    }
    setViewer('a')
    replace(stateFromOnboarding(choices, today, new Date(), code))
  }

  const body = (() => {
    switch (step) {
      case 1:
        return <CoupleStep draft={draft} patch={patch} />
      case 2:
        return <CycleStep draft={draft} patch={patch} today={today} />
      case 3:
        return <StartStep draft={draft} patch={patch} today={today} />
      case 4:
        return <AlertStep draft={draft} patch={patch} today={today} />
      case 5:
        return <ConsentStep draft={draft} patch={patch} />
      default:
        return <DoneStep code={code} partner={names.b} />
    }
  })()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="pt-safe sticky top-0 z-10 bg-bg/95 backdrop-blur">
        <div className="flex h-14 items-center px-2">
          <button
            type="button"
            onClick={() => {
              if (step === 1) setCameBack(true)
              setStep(step - 1)
            }}
            className="flex h-11 min-w-[4.5rem] items-center gap-1 rounded-xl px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span aria-hidden>‹</span> 뒤로
          </button>
          <div className="flex flex-1 justify-center">
            <ProgressDots step={step} total={ONBOARDING_STEPS} />
          </div>
          <span aria-hidden className="min-w-[4.5rem]" />
        </div>
      </header>

      <main className="flex-1 px-5 pb-6 pt-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold leading-snug text-ink outline-none">
          {meta.title}
        </h1>
        {meta.sub ? <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{meta.sub}</p> : null}
        <div className="mt-6">{body}</div>
      </main>

      <footer className="pb-safe sticky bottom-0 z-10 border-t border-line/70 bg-bg/95 px-5 pt-3 backdrop-blur">
        <p aria-live="polite" className="mb-2 min-h-[1rem] text-center text-xs text-ink-3">
          {problem ?? ''}
        </p>
        <Button size="lg" full onClick={next} disabled={!!problem}>
          {last ? '시작하기' : step === 5 ? '동의하고 계속하기' : '다음'}
        </Button>
      </footer>
    </div>
  )
}
