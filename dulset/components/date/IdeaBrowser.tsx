'use client'

import { useState } from 'react'
import { Button, Chip, Disclaimer, EmptyState, SectionTitle } from '@/components/ui'
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

/** Every idea for the stage, with category and budget filters. */
export default function IdeaBrowser({ onPlan }: { onPlan: (idea: DateIdea) => void }) {
  const { state, today } = useApp()
  const [category, setCategory] = useState<DateCategory | 'all'>('all')
  const [budget, setBudget] = useState<Budget | 'all'>('all')
  const [shown, setShown] = useState(PAGE)

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
    <section className="mt-6">
      <SectionTitle sub={`${list.length}개 · 지금 계절에 맞는 것부터 보여 드려요`}>아이디어 모아보기</SectionTitle>

      <div role="group" aria-label="분류" className={rowClass}>
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
            <span aria-hidden>{CATEGORY_META[c].emoji}</span>
            {CATEGORY_META[c].label}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label="예산" className={`${rowClass} mt-1.5`}>
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
            icon="🔍"
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
