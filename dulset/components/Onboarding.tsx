'use client'

// First-run flow: welcome (or a demo couple) → 우리 둘 → 주기 → 시작 시점 →
// 생활 습관 (the partner's starter checklist) → 알림 방식 (+ my own 부담 없이 /
// 잠금화면) → 개인정보 (general + separate 민감정보 consent, and what the partner
// may see) → 초대 코드. Answers live in a draft (lib/demo.ts) plus the extras
// kept here, and become the app state only on the last "시작하기".

import { useCallback, useEffect, useRef, useState } from 'react'
import AlertStep, { DEFAULT_MY_PREFS, type MyPrefs } from '@/components/onboarding/AlertStep'
import ConsentStep from '@/components/onboarding/ConsentStep'
import CoupleStep from '@/components/onboarding/CoupleStep'
import CycleStep from '@/components/onboarding/CycleStep'
import DoneStep from '@/components/onboarding/DoneStep'
import HabitStep, { EMPTY_HABITS, habitAnswers, habitProblem, habitSubject, type HabitDraft } from '@/components/onboarding/HabitStep'
import StartStep from '@/components/onboarding/StartStep'
import WelcomeStep from '@/components/onboarding/WelcomeStep'
import type { ShareChoice } from '@/components/onboarding/consentCopy'
import { ProgressDots } from '@/components/onboarding/parts'
import { Button } from '@/components/ui'
import {
  createDemoState,
  draftNames,
  draftToChoices,
  initialDraft,
  stateFromOnboarding,
  stepProblem,
  type OnboardingDraft,
} from '@/lib/demo'
import { inviteCode } from '@/lib/id'
import { applyOnboardingExtras } from '@/lib/initial'
import { useStore } from '@/lib/store'
import type { Stage } from '@/lib/types'

type StepKey = 'couple' | 'cycle' | 'start' | 'habits' | 'alerts' | 'consent' | 'done'

const STEPS: readonly StepKey[] = ['couple', 'cycle', 'start', 'habits', 'alerts', 'consent', 'done']

/** lib/demo's stepProblem numbers its steps without the habits step. */
const DRAFT_STEP: Record<StepKey, number> = { couple: 1, cycle: 2, start: 3, habits: 0, alerts: 4, consent: 5, done: 6 }

function stepMeta(key: StepKey, names: { a: string; b: string }, subjectIsMe: boolean, subject: string): { title: string; sub?: string } {
  switch (key) {
    case 'couple':
      return { title: '우리 둘을 소개해 주세요', sub: '서로 부르는 이름이나 애칭이면 돼요.' }
    case 'cycle':
      return { title: '주기를 알려 주세요', sub: '가임기 예상에 쓰여요. 몰라도 괜찮아요, 나중에 ‘+ 기록’에서 남기면 돼요.' }
    case 'start':
      return { title: '언제부터 함께 준비했나요?', sub: '오래 준비했는데 소식이 없으면, 전문의 상담 시기를 알려 드려요.' }
    case 'habits':
      return {
        title: subjectIsMe ? '나의 생활 습관을 알려 주세요' : `${subject}님의 생활 습관을 알려 주세요`,
        sub: '체크 항목을 고르는 데만 써요. 필요한 것만 담을게요.',
      }
    case 'alerts':
      return { title: '가임기 소식은 어떻게 받을까요?', sub: '각자 편한 방식으로 골라요. 언제든 설정에서 바꿀 수 있어요.' }
    case 'consent':
      return { title: '기록은 이렇게 지켜요', sub: '시작하기 전에 확인해 주세요.' }
    default:
      return { title: '준비됐어요! 이제 둘이 함께예요', sub: `${names.b}님과 연결하는 방법이에요.` }
  }
}

/**
 * Open the app on 오늘: a hash left from before (e.g. #settings after 모두
 * 지우기) would otherwise open that tab. replaceState keeps ?today= and adds no
 * history entry; the app reads the hash when it mounts after `replace`.
 */
function openOnHome() {
  if (typeof window === 'undefined' || !window.location.hash) return
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
}

/** Scroll to the top once the new screen has painted (the onboarding unmounts on replace). */
function scrollTopSoon() {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0 })
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: 0 })))
}

export default function Onboarding() {
  const { replace, today, setViewer } = useStore()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft)
  const [habits, setHabits] = useState<HabitDraft>(EMPTY_HABITS)
  const [prefs, setPrefs] = useState<MyPrefs>(DEFAULT_MY_PREFS)
  const [sensitive, setSensitive] = useState(false)
  const [share, setShare] = useState<ShareChoice>('week')
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

  // The habit answers describe one person (whoever doesn't track the cycle). If
  // going back changes who that is, ask again rather than move the answers over.
  const subject = habitSubject(draft)
  const [habitsOf, setHabitsOf] = useState(subject)
  if (habitsOf !== subject) {
    setHabitsOf(subject)
    setHabits(EMPTY_HABITS)
  }

  // The demo opens on the cycle owner's screen (지은) — the app's main user — at the top.
  const startDemo = (stage: Stage) => {
    const demo = createDemoState(today, new Date(), stage)
    setViewer(demo.couple.members.find((m) => m.tracksCycle)?.id ?? 'a')
    openOnHome()
    replace(demo)
    scrollTopSoon()
  }

  if (step === 0)
    return <WelcomeStep onStart={() => setStep(1)} onDemo={startDemo} onRestored={() => setViewer('a')} focusTitle={cameBack} />

  const key = STEPS[step - 1] ?? 'done'
  const names = draftNames(draft)
  const last = key === 'done'
  const meta = stepMeta(key, names, subject === 'a', names[subject])
  const problem =
    key === 'habits'
      ? habitProblem(habits)
      : (stepProblem(DRAFT_STEP[key], draft, today) ??
        (key === 'consent' && !sensitive ? '민감정보 수집·이용에도 따로 동의해 주세요.' : null))

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
    // 부담 없이 is per person now (settings.personal) — never couple-wide from here.
    const base = stateFromOnboarding({ ...choices, lowPressure: false }, today, new Date(), code)
    const state = applyOnboardingExtras(
      base,
      { habits: habitAnswers(habits), shareCycleDetails: share === 'details', myPrefs: prefs },
      today,
    )
    setViewer('a')
    openOnHome()
    replace(state)
    scrollTopSoon()
  }

  const body = (() => {
    switch (key) {
      case 'couple':
        return <CoupleStep draft={draft} patch={patch} today={today} />
      case 'cycle':
        return <CycleStep draft={draft} patch={patch} today={today} />
      case 'start':
        return <StartStep draft={draft} patch={patch} today={today} />
      case 'habits':
        return <HabitStep draft={draft} habits={habits} setHabits={setHabits} today={today} />
      case 'alerts':
        return <AlertStep draft={draft} patch={patch} today={today} prefs={prefs} setPrefs={setPrefs} />
      case 'consent':
        return (
          <ConsentStep
            draft={draft}
            patch={patch}
            sensitive={sensitive}
            onSensitive={setSensitive}
            share={share}
            onShare={setShare}
          />
        )
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
            <ProgressDots step={step} total={STEPS.length} />
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
          {last ? '시작하기' : key === 'consent' ? '동의하고 계속하기' : '다음'}
        </Button>
      </footer>
    </div>
  )
}
