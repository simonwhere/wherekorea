'use client'

// "민수님, 처음이죠?" — the joining member's own first run (N15): the person
// who onboarded answered nothing about them, so the first time their screen
// opens they choose their own two habit questions (if they don't track the
// cycle) and how they want to hear about fertile days. Until then they have
// the defaults (걷기 30분 + 은근하게). Completing (or skipping) records that
// they joined (couple.linkedAt), so this never comes back.
//
// Mount it once inside the main app (AppShell's MainApp); it decides by
// itself whether to open (lib/logic/onboarding needsPartnerFirstRun).

import { useCallback, useState } from 'react'
import HabitQuestions, { EMPTY_HABITS, habitAnswers, habitProblem, type HabitDraft } from '@/components/onboarding/HabitQuestions'
import { ChoiceGroup } from '@/components/onboarding/parts'
import { STYLE_OPTIONS } from '@/components/onboarding/partnerChoices'
import { Button, Sheet, useToast } from '@/components/ui'
import { completePartnerFirstRun, needsPartnerFirstRun, starterItemsFor } from '@/lib/logic/onboarding'
import { alertStyleOf } from '@/lib/logic/settings'
import { stampOn } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { AlertStyle } from '@/lib/types'

export default function PartnerFirstRunSheet() {
  const { state, update, today, viewer, me, partner } = useApp()
  const toast = useToast()
  const open = needsPartnerFirstRun(state, viewer)
  const asksHabits = !me.tracksCycle
  const [habits, setHabits] = useState<HabitDraft>(EMPTY_HABITS)
  const [style, setStyle] = useState<AlertStyle | null>(null)
  const chosenStyle = style ?? alertStyleOf(state, me.id)
  const answers = habitAnswers(habits)
  const problem = asksHabits ? habitProblem(habits) : null
  const preview = asksHabits && answers ? starterItemsFor(state, me.id, today, answers) : null

  // Closing with ✕ / the backdrop keeps the defaults — same as '이대로 시작할게요'.
  const keepDefaults = useCallback(() => {
    update((s) => completePartnerFirstRun(s, viewer, null, today, stampOn(today)))
  }, [update, viewer, today])

  const save = () => {
    if (problem) return
    update((s) =>
      completePartnerFirstRun(s, viewer, { ...(asksHabits && answers ? { habits: answers } : {}), alertStyle: chosenStyle }, today, stampOn(today)),
    )
    toast.show('저장했어요')
  }

  const daily = preview?.filter((i) => i.cadence !== 'weekly').map((i) => i.label) ?? []
  const weekly = preview?.filter((i) => i.cadence === 'weekly').map((i) => i.label) ?? []

  return (
    <Sheet open={open} onClose={keepDefaults} title={`${me.name}님, 처음이죠?`}>
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-2">{partner.name}님이 둘셋을 시작했어요.</p>

        {asksHabits ? (
          <section aria-label="내 생활 습관" className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
            <p className="mb-3 text-sm font-bold text-ink">매일 체크할 것</p>
            <HabitQuestions habits={habits} setHabits={setHabits} />
            <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-ink-2 empty:hidden">
              {preview ? `매일 ${daily.join(', ') || '없음'}${weekly.length ? ` · 주 1회 ${weekly.join(', ')}` : ''}` : ''}
            </p>
          </section>
        ) : null}

        <section aria-label="알림 방식" className="rounded-xl2 border border-line bg-surface p-4 shadow-card">
          <p className="mb-3 text-sm font-bold text-ink">소식은 어떻게 받을까요?</p>
          <ChoiceGroup label="소식 받는 방식" options={STYLE_OPTIONS} columns={1} value={chosenStyle} onChange={setStyle} />
        </section>

        <div className="grid gap-2 pb-2">
          <Button full size="lg" onClick={save} disabled={!!problem}>
            이대로 시작하기
          </Button>
          <Button full variant="ghost" onClick={keepDefaults}>
            나중에 할게요
          </Button>
          <p aria-live="polite" className="min-h-[1rem] text-center text-xs text-ink-3">
            {problem ?? ''}
          </p>
        </div>
      </div>
    </Sheet>
  )
}
