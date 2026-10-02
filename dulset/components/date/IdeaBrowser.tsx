'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Disclaimer, EmptyState, SectionTitle } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import {
  BUDGET_META,
  CATEGORY_META,
  DATE_IDEAS,
  DATE_TIP_SOURCES,
  type Budget,
  type DateCategory,
  type DateIdea,
} from '@/lib/content/dateIdeas'
import { browseIdeas, categoriesFor, upcomingIdeaDates } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'
import IdeaCard from './IdeaCard'

const PAGE = 6
const BUDGETS: Budget[] = [1, 2, 3]
const chipClass = 'min-h-[44px] px-3.5'
const rowClass = '-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * Every idea for the stage, with category and budget filters in one row.
 * Folded on #date until '아이디어 더 보기' opens it (review D-16); `onFold`
 * puts it away again.
 */
export default function IdeaBrowser({
  id,
  onPlan,
  onFold,
}: {
  /** The section's id (the fold button's aria-controls). */
  id?: string
  onPlan: (idea: DateIdea) => void
  onFold?: () => void
}) {
  const { state, today } = useApp()
  const [category, setCategory] = useState<DateCategory | 'all'>('all')
  const [budget, setBudget] = useState<Budget | 'all'>('all')
  const [shown, setShown] = useState(PAGE)
  const headingRef = useRef<HTMLDivElement>(null)
  // Opened by the fold button: start keyboard / screen-reader users at the section.
  useEffect(() => {
    if (onFold) headingRef.current?.querySelector('h2')?.focus({ preventScroll: true })
  }, [onFold])

  const cats = categoriesFor(DATE_IDEAS, state.stage)
  const list = browseIdeas(DATE_IDEAS, state.stage, today, {
    category,
    budget,
  })
  const visible = list.slice(0, shown)
  const rest = list.length - visible.length
  const planned = upcomingIdeaDates(state.datePlans, today)
  const sources = DATE_TIP_SOURCES[state.stage]
  const reset = () => {
    setCategory('all')
    setBudget('all')
    setShown(PAGE)
  }

  return (
    <section id={id} className="mt-6" ref={headingRef}>
      <SectionTitle
        sub={`${list.length}개 · 지금 계절에 맞는 것부터 보여 드려요`}
        action={
          onFold ? (
            <button
              type="button"
              onClick={onFold}
              className="-mr-1 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              접기
              <Icon name="chev" className="h-4 w-4 rotate-180" strokeWidth={2.2} />
            </button>
          ) : undefined
        }
      >
        <span tabIndex={-1} className="outline-none">
          아이디어 모아보기
        </span>
      </SectionTitle>

      {/* One row: categories, a thin divider, then budgets (text, not pictures). */}
      <div role="group" aria-label="분류와 예산" className={rowClass}>
        <Chip
          selected={category === 'all'}
          className={chipClass}
          onClick={() => {
            setCategory('all')
            setShown(PAGE)
          }}
        >
          전체
        </Chip>
        {cats.map((c) => (
          <Chip
            key={c}
            selected={category === c}
            className={chipClass}
            onClick={() => {
              setCategory(c)
              setShown(PAGE)
            }}
          >
            {CATEGORY_META[c].label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 my-auto h-6 w-px shrink-0 bg-line" />
        <Chip
          selected={budget === 'all'}
          className={chipClass}
          onClick={() => {
            setBudget('all')
            setShown(PAGE)
          }}
        >
          예산 전체
        </Chip>
        {BUDGETS.map((b) => (
          <Chip
            key={b}
            selected={budget === b}
            className={chipClass}
            onClick={() => {
              setBudget(b)
              setShown(PAGE)
            }}
          >
            <span aria-hidden className="font-bold">
              {BUDGET_META[b].symbol}
            </span>{' '}
            {BUDGET_META[b].label}
          </Chip>
        ))}
      </div>

      <div className="mt-3">
        {list.length === 0 ? (
          <EmptyState
            icon="search"
            title="조건에 맞는 아이디어가 없어요"
            body="분류나 예산을 바꿔 보세요."
            action={
              <Button variant="secondary" onClick={reset}>
                필터 초기화
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((idea) => (
              <li key={idea.id}>
                <IdeaCard idea={idea} onPlan={onPlan} plannedOn={planned.get(idea.id)} />
              </li>
            ))}
          </ul>
        )}
        {rest > 0 ? (
          <Button variant="secondary" full className="mt-3" onClick={() => setShown((n) => n + PAGE)}>
            더 보기 <span className="font-normal text-ink-3">· {rest}개 남았어요</span>
          </Button>
        ) : null}
      </div>

      {sources.length === 0 ? null : (
        <Disclaimer>
          건강 팁 출처:{' '}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? ', ' : null}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {s.label}
              </a>
            </span>
          ))}
          . 일반적인 정보이고 의료 상담을 대신하지 않아요. 장소 정보는 지도 앱에서 확인해 주세요.
        </Disclaimer>
      )}
    </section>
  )
}
