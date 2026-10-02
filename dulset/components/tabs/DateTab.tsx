'use client'

import { useCallback, useId, useState } from 'react'
import DateBanner from '@/components/date/DateBanner'
import IdeaBrowser from '@/components/date/IdeaBrowser'
import PlanList from '@/components/date/PlanList'
import PlanSheet from '@/components/date/PlanSheet'
import WeeklyPicks from '@/components/date/WeeklyPicks'
import { Icon } from '@/components/ui/icons'
import { DATE_IDEAS, type DateIdea } from '@/lib/content/dateIdeas'
import { browseIdeas } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'

/**
 * 둘만의 시간 아이디어 (#date). Not a bottom tab any more: it opens from the
 * 우리의 주간 card and 더 보기 on 오늘, so it carries its own title and a way
 * back. Short on purpose (review D-16): a gentle context line, this week's
 * three picks, our shared plans — and every other idea folded behind one
 * '더 보기' until it's asked for. Adding a plan sends the partner a proposal
 * notice; the suggested day is the coming Saturday, never the window.
 */
export default function DateTab() {
  const { state, today } = useApp()
  // null = closed; { idea: undefined } = a plan without an idea (직접 추가).
  const [draft, setDraft] = useState<{ idea?: DateIdea } | null>(null)
  const open = useCallback((idea?: DateIdea) => setDraft({ idea }), [])
  // Stable identity: the Sheet re-focuses its panel whenever onClose changes.
  const close = useCallback(() => setDraft(null), [])
  // The full list (filters, every idea for the stage) stays folded until asked.
  const [browsing, setBrowsing] = useState(false)
  const browserId = useId()
  const total = browseIdeas(DATE_IDEAS, state.stage, today).length

  const back = () => {
    // AppShell follows the hash (#today); start the home screen at its top.
    window.location.hash = 'today'
    window.scrollTo({ top: 0 })
  }

  return (
    <div>
      <header className="mb-4 flex items-start gap-1">
        <button
          type="button"
          onClick={back}
          aria-label="오늘로 돌아가기"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Icon name="left" className="h-6 w-6" strokeWidth={2} />
        </button>
        <div className="min-w-0 pt-1.5">
          {/* Focused by AppShell on arrival (tabIndex -1): no ring on a heading nobody tabs to. */}
          <h1 className="text-xl font-extrabold leading-tight tracking-tight text-ink outline-none">둘만의 시간 아이디어</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            가볍게 둘러보고, 마음에 들면 날짜를 골라 제안해요. 언제 할지는 둘이 편한 날로 정해요.
          </p>
        </div>
      </header>
      <DateBanner />
      <WeeklyPicks onPlan={open} />
      <PlanList onAdd={() => open()} />
      {browsing ? (
        <IdeaBrowser id={browserId} onPlan={open} onFold={() => setBrowsing(false)} />
      ) : (
        <section className="mt-6">
          <button
            type="button"
            aria-expanded={false}
            aria-controls={browserId}
            onClick={() => setBrowsing(true)}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl2 border border-dashed border-line px-4 text-left text-sm font-semibold text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>
              아이디어 더 보기 <span className="font-normal text-ink-3">· {total}개 · 분류와 예산으로 골라요</span>
            </span>
            <Icon name="chev" className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={2} />
          </button>
        </section>
      )}
      {draft ? <PlanSheet idea={draft.idea} onClose={close} /> : null}
    </div>
  )
}
